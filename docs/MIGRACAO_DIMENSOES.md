# Plano de Migração: Uso de Tabelas Dimensão (Star Schema)

Este documento detalha as estratégias para atualizar o frontend e backend do projeto para utilizar as novas tabelas de dimensão (`dim_vendedores`, `dim_supervisores`, `dim_fornecedores`, `dim_produtos`), visando otimização de performance e redução de custos de armazenamento.

## 1. Contexto e Objetivo

Atualmente, o banco de dados foi atualizado para um modelo **Star Schema** (Esquema Estrela), onde:
*   **Fatos (Vendas):** Tabelas `data_detailed` e `data_history` contêm milhões de registros com códigos (IDs).
*   **Dimensões (Cadastros):** Tabelas `dim_*` contêm os textos (Nomes, Descrições) associados a esses códigos.

**O Objetivo:** Eliminar a dependência das colunas de texto duplicadas nas tabelas de vendas para reduzir o tamanho do download e do banco.

Existem duas estratégias principais para isso. A **Opção A** foi a escolhida para implementação imediata, mas a **Opção B** é detalhada abaixo como alternativa de alta performance para o futuro.

---

## 2. Opção A: Join no Frontend (Estratégia Imediata)

Esta abordagem mantém a arquitetura atual (SPA - Single Page Application), onde todos os dados são baixados no início e processados no navegador. É a mais segura para uma transição gradual.

### Passo 1: Atualizar o Carregamento de Dados (`js/init.js`)

**Objetivo:** Baixar as tabelas de dimensão em paralelo com as vendas, e selecionar apenas as colunas essenciais (códigos) da tabela de fatos.

**Como fazer:**
No arquivo `js/init.js`, alterar a lógica de `select()`:

```javascript
// 1. Buscar Dimensões (Tabelas Leves)
const [dimVendedores, dimSupervisores, dimProdutos] = await Promise.all([
    supabase.from('dim_vendedores').select('codigo, nome'),
    supabase.from('dim_supervisores').select('codigo, nome'),
    supabase.from('dim_produtos').select('codigo, descricao, codfor, mix_marca, mix_categoria')
]);

// 2. Buscar Vendas (Apenas Códigos e Valores)
// NOTA: Removemos 'nome', 'superv', 'descricao', 'fornecedor' do SELECT para economizar banda
const { data: sales } = await supabase.from('data_detailed')
    .select('id, pedido, codusur, codsupervisor, produto, codfor, qtvenda, vlvenda, dtped, dtsaida, posicao, filial, tipovenda');
```

### Passo 2: Criar Mapas de Acesso Rápido (`js/app/app.js`)

**Objetivo:** Transformar os arrays das dimensões em `Map` para permitir buscas instantâneas (O(1)).

**Como fazer:**
No início do `js/app/app.js`:

```javascript
// Inicialização dos Mapas
const maps = {
    vendedores: new Map(embeddedData.dim_vendedores.map(v => [v.codigo, v.nome])),
    supervisores: new Map(embeddedData.dim_supervisores.map(s => [s.codigo, s.nome])),
    produtos: new Map(embeddedData.dim_produtos.map(p => [p.codigo, p])), // Guarda o objeto todo
    fornecedores: new Map(embeddedData.dim_fornecedores.map(f => [f.codigo, f.nome]))
};

// Expor helper global
window.resolveDim = (type, code) => {
    if (!code) return 'N/A';
    const map = maps[type];
    if (type === 'produtos') return map?.get(code) || { descricao: `Produto ${code}` };
    return map?.get(code) || code;
};
```

### Passo 3: Atualizar a Lógica de Renderização

Substituir acessos diretos (`sale.NOME`) por lookups (`window.resolveDim('vendedores', sale.CODUSUR)`).

---

## 3. Opção B: Server-Side Rendering via RPCs (Alta Performance)

Esta é a estratégia definitiva para escalabilidade. O navegador deixa de baixar e processar milhões de linhas. Em vez disso, ele pede ao banco apenas os números agregados (Somas, Contagens) prontos para exibir.

**Prós:**
*   Carga inicial instantânea (independente do tamanho do histórico).
*   Uso mínimo de memória no navegador.
*   Segurança (o usuário não baixa o banco inteiro).

**Contras:**
*   Requer conexão constante com internet (filtros exigem nova requisição).
*   Exige refatoração profunda do `app.js` (transformar síncrono em assíncrono).

### Passo 1: Mapear as Funções Necessárias

Cada "View" do dashboard precisará de uma função correspondente no PostgreSQL (`SQL/RPC_DASHBOARD.sql`).

| View Frontend | Dados Necessários | Nome da RPC Sugerida |
| :--- | :--- | :--- |
| **Visão Geral** | Totais (Fat, Peso), Gráfico Mensal, Top 5 Sup/Vend | `get_main_dashboard_data` |
| **Comparativo** | Gráfico Tendência, Tabela Comparativa (Mês/Ano) | `get_comparison_view_data` |
| **Cidades** | Mapa (Heatmap), Tabela Clientes Ativos/Inativos | `get_city_view_data` |
| **Positivação** | Lista de Clientes com Status de Mix (Elma/Foods) | `get_positivacao_data` |
| **Produtos** | Top Produtos por Volume/Faturamento | `get_products_ranking` |

### Passo 2: Criar/Atualizar as RPCs (Backend)

As funções devem aceitar os filtros atuais como parâmetros (Arrays de Texto) e retornar JSON pronto.

**Exemplo (`SQL/RPC_DASHBOARD.sql`):**

```sql
CREATE OR REPLACE FUNCTION get_main_dashboard_data(
    p_filial text[],
    p_supervisor text[],
    p_ano int,
    p_mes int
)
RETURNS JSON AS $$
DECLARE
    v_total_fat numeric;
    v_chart_data json;
BEGIN
    -- 1. Calcular Totais usando JOINs eficientes com tabelas DIM
    SELECT SUM(s.vlvenda) INTO v_total_fat
    FROM data_detailed s
    WHERE s.ano = p_ano AND s.mes = p_mes
    AND (p_filial IS NULL OR s.filial = ANY(p_filial));

    -- 2. Montar Gráfico
    SELECT json_agg(...) INTO v_chart_data FROM ...;

    RETURN json_build_object(
        'kpi_fat', v_total_fat,
        'chart', v_chart_data
    );
END;
$$ LANGUAGE plpgsql;
```

### Passo 3: Refatorar o Frontend (`js/app/app.js`)

A lógica de filtrar arrays na memória (`sales.filter(...)`) deve ser substituída por chamadas à API.

**Transformação do Código:**

*   **Antes (Síncrono/Memória):**
    ```javascript
    function updateDashboard() {
        // Filtra 100.000 linhas no JS
        const filtered = allSalesData.filter(s => selectedSupervisors.has(s.SUPERV));
        const total = filtered.reduce((sum, s) => sum + s.VLVENDA, 0);
        document.getElementById('kpi-fat').textContent = formatMoney(total);
    }
    ```

*   **Depois (Assíncrono/RPC):**
    ```javascript
    async function updateDashboard() {
        showLoadingSpinner(); // UI de carregamento é essencial agora

        const params = {
            p_filial: Array.from(selectedFiliais),
            p_supervisor: Array.from(selectedSupervisors), // Enviar Códigos, não nomes!
            p_ano: currentYear,
            p_mes: currentMonth
        };

        const { data, error } = await supabase.rpc('get_main_dashboard_data', params);

        if (data) {
            document.getElementById('kpi-fat').textContent = formatMoney(data.kpi_fat);
            renderChart(data.chart);
        }
        hideLoadingSpinner();
    }
    ```

### Passo 4: Adaptação dos Filtros

Os dropdowns de filtro (Ex: Lista de Supervisores) não podem mais ser populados varrendo as vendas (pois elas não estão lá).
Eles devem ser populados diretamente das tabelas `dim_`.

*   **Ação:** Na inicialização, baixar apenas `dim_supervisores` e preencher o `<select>`.

### Resumo para Migração para Opção B

1.  **Backend:** Finalizar e testar todas as RPCs no arquivo `RPC_DASHBOARD.sql`.
2.  **Frontend:** Escolher uma View simples (ex: "Visão Geral") e migrar para RPC como prova de conceito.
3.  **Estado:** Implementar indicadores de "Carregando..." em todos os gráficos, pois a resposta não será mais instantânea (latência de rede).
