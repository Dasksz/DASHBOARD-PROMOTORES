-- ==============================================================================
-- PROVA DE CONCEITO (PoC) - SERVER-SIDE RENDERING (RPC)
-- ==============================================================================
-- Objetivo: Mover o processamento pesado de Javascript (frontend) para PostgreSQL.
-- Uso: Esta função retorna os totais gerais (Faturamento, Volume, Mix, Positivação)
-- agregados e prontos para exibição no dashboard, sem precisar baixar milhões de linhas.

CREATE OR REPLACE FUNCTION get_rpc_dashboard_data(
    p_ano int,
    p_mes int,
    p_filial text[] DEFAULT NULL,
    p_vendedor text[] DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_fat numeric := 0;
    v_total_peso numeric := 0;
    v_total_pos_clientes integer := 0;
    
    v_mix_salty_count integer := 0;
    v_mix_foods_count integer := 0;
    
    v_total_metas numeric := 0;
    v_total_inovacoes integer := 0;
    
    v_resultado json;
    v_month_key text;
BEGIN

    -- 0. Formatar a chave do mês (YYYY-MM) para as tabelas auxiliares
    v_month_key := TO_CHAR(MAKE_DATE(p_ano, p_mes, 1), 'YYYY-MM');

    -- 1. Totais Gerais (Faturamento e Peso Líquido)
    SELECT 
        COALESCE(SUM(vlvenda), 0),
        COALESCE(SUM(totpesoliq), 0)
    INTO 
        v_total_fat,
        v_total_peso
    FROM data_detailed d
    WHERE 
        EXTRACT(YEAR FROM d.dtped) = p_ano 
        AND EXTRACT(MONTH FROM d.dtped) = p_mes
        AND (p_filial IS NULL OR d.filial = ANY(p_filial))
        AND (p_vendedor IS NULL OR d.codusur = ANY(p_vendedor));

    -- 2. Positivação (Contagem de Clientes Únicos que Compraram)
    SELECT COUNT(DISTINCT codcli)
    INTO v_total_pos_clientes
    FROM data_detailed d
    WHERE 
        EXTRACT(YEAR FROM d.dtped) = p_ano 
        AND EXTRACT(MONTH FROM d.dtped) = p_mes
        AND (p_filial IS NULL OR d.filial = ANY(p_filial))
        AND (p_vendedor IS NULL OR d.codusur = ANY(p_vendedor));

    -- 3. Mix de Produtos (Salty e Foods)
    -- Fazemos um JOIN com a tabela dim_produtos para ler a classificação (mix_categoria)
    SELECT 
        COUNT(DISTINCT CASE WHEN p.mix_categoria = 'SALTY' THEN d.codcli END),
        COUNT(DISTINCT CASE WHEN p.mix_categoria = 'FOODS' THEN d.codcli END)
    INTO 
        v_mix_salty_count,
        v_mix_foods_count
    FROM data_detailed d
    JOIN dim_produtos p ON d.produto = p.codigo
    WHERE 
        EXTRACT(YEAR FROM d.dtped) = p_ano 
        AND EXTRACT(MONTH FROM d.dtped) = p_mes
        AND (p_filial IS NULL OR d.filial = ANY(p_filial))
        AND (p_vendedor IS NULL OR d.codusur = ANY(p_vendedor));

    -- 4. Metas (Tabela goals_distribution)
    -- As metas são salvas em um campo JSON. Para simplificar no SQL, tentamos buscar a soma das metas dos vendedores, se existir, 
    -- ou apenas retornar 0 caso a estrutura seja muito complexa para um PoC genérico.
    -- Vamos ler a meta agregada (Targets Gerais) para 'ALL' e 'GENERAL'.
    SELECT 
        COALESCE(
            (goals_data->'targets'->'ALL'->>'fat')::numeric, 
            0
        ) INTO v_total_metas
    FROM goals_distribution
    WHERE month_key = v_month_key AND supplier = 'ALL' AND brand = 'GENERAL'
    LIMIT 1;

    -- 5. Inovações
    -- Contamos quantos produtos na tabela de inovações foram vendidos neste período.
    SELECT COUNT(DISTINCT d.produto)
    INTO v_total_inovacoes
    FROM data_detailed d
    JOIN data_innovations i ON d.produto = i.codigo
    WHERE 
        EXTRACT(YEAR FROM d.dtped) = p_ano 
        AND EXTRACT(MONTH FROM d.dtped) = p_mes
        AND (p_filial IS NULL OR d.filial = ANY(p_filial))
        AND (p_vendedor IS NULL OR d.codusur = ANY(p_vendedor));

    -- 6. Construir o Objeto JSON de Resposta
    v_resultado := json_build_object(
        'kpi_faturamento', v_total_fat,
        'kpi_peso_kg', v_total_peso,
        'kpi_clientes_positivados', v_total_pos_clientes,
        'kpi_mix_salty', v_mix_salty_count,
        'kpi_mix_foods', v_mix_foods_count,
        'kpi_metas', COALESCE(v_total_metas, 0),
        'kpi_inovacoes', COALESCE(v_total_inovacoes, 0)
    );

    RETURN v_resultado;

EXCEPTION WHEN OTHERS THEN
    -- Em caso de erro, retorna um objeto seguro em vez de falhar a aplicação
    RETURN json_build_object(
        'error', SQLERRM,
        'kpi_faturamento', 0,
        'kpi_peso_kg', 0,
        'kpi_clientes_positivados', 0,
        'kpi_mix_salty', 0,
        'kpi_mix_foods', 0,
        'kpi_metas', 0,
        'kpi_inovacoes', 0
    );
END;
$$;

-- Comando para testar no SQL Editor após a criação:
-- SELECT get_rpc_dashboard_data(2024, 11);
