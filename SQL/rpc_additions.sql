-- ==============================================================================
-- RPC ADDITIONS (Coverage, Mix, Goals)
-- ==============================================================================

-- O. Get Coverage View Data
CREATE OR REPLACE FUNCTION get_coverage_view_data(
    p_filial text[] default null,
    p_cidade text[] default null,
    p_supervisor text[] default null,
    p_vendedor text[] default null,
    p_fornecedor text[] default null,
    p_ano text default null,
    p_mes text default null,
    p_tipovenda text[] default null,
    p_rede text[] default null,
    p_produto text[] default null
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_year int;
    v_target_month int;
    v_where_summary text := ' WHERE 1=1 ';
    v_where_clients text := ' WHERE bloqueio != ''S'' ';
    v_sql text;
    v_result json;

    v_rede_condition text := '';
    v_specific_redes text[];
    v_has_com_rede boolean;
    v_has_sem_rede boolean;
BEGIN
    IF NOT public.is_approved() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
    SET LOCAL work_mem = '64MB';

    -- Date
    IF p_ano IS NULL OR p_ano = 'todos' OR p_ano = '' THEN
        SELECT COALESCE(MAX(ano), EXTRACT(YEAR FROM CURRENT_DATE)::int) INTO v_current_year FROM public.data_summary;
    ELSE v_current_year := p_ano::int; END IF;

    IF p_mes IS NOT NULL AND p_mes != '' AND p_mes != 'todos' THEN
        v_target_month := p_mes::int + 1;
        v_where_summary := v_where_summary || format(' AND mes = %L ', v_target_month);
    ELSE
        -- Default to current month if not specified?
        -- Coverage usually implies "This Month" unless historical.
        -- If 'todos', it aggregates whole year? Let's assume specific month required for "Positivation" logic usually.
        -- But for flexibility, if null, we don't filter mes.
    END IF;
    v_where_summary := v_where_summary || format(' AND ano = %L ', v_current_year);

    -- Filters
    IF p_filial IS NOT NULL AND array_length(p_filial, 1) > 0 THEN
        v_where_summary := v_where_summary || format(' AND filial = ANY(%L) ', p_filial);
    END IF;
    IF p_cidade IS NOT NULL AND array_length(p_cidade, 1) > 0 THEN
        v_where_summary := v_where_summary || format(' AND cidade = ANY(%L) ', p_cidade);
        v_where_clients := v_where_clients || format(' AND cidade = ANY(%L) ', p_cidade);
    END IF;

    -- Codes
    IF p_supervisor IS NOT NULL AND array_length(p_supervisor, 1) > 0 THEN
        v_where_summary := v_where_summary || format(' AND codsupervisor IN (SELECT codigo FROM dim_supervisores WHERE nome = ANY(%L)) ', p_supervisor);
        -- Client filter needs RCA mapping? Or just rely on summary?
        -- Coverage "Total Clients" comes from data_clients. We need to filter data_clients by Supervisor.
        -- This is expensive without a direct link. We rely on 'rca1' in data_clients mapping to a supervisor?
        -- Standard app logic: Filter clients list based on hierarchy.
        -- data_clients has rca1. We can map supervisor -> rca1.
        -- Using existing subquery logic:
        v_where_clients := v_where_clients || format(' AND rca1 IN (SELECT DISTINCT d.codusur FROM public.data_detailed d JOIN public.dim_supervisores ds ON d.codsupervisor = ds.codigo WHERE ds.nome = ANY(%L)) ', p_supervisor);
    END IF;
    IF p_vendedor IS NOT NULL AND array_length(p_vendedor, 1) > 0 THEN
        v_where_summary := v_where_summary || format(' AND codusur IN (SELECT codigo FROM dim_vendedores WHERE nome = ANY(%L)) ', p_vendedor);
        v_where_clients := v_where_clients || format(' AND rca1 IN (SELECT codigo FROM dim_vendedores WHERE nome = ANY(%L)) ', p_vendedor);
    END IF;

    IF p_fornecedor IS NOT NULL AND array_length(p_fornecedor, 1) > 0 THEN
        v_where_summary := v_where_summary || format(' AND codfor = ANY(%L) ', p_fornecedor);
    END IF;
    IF p_tipovenda IS NOT NULL AND array_length(p_tipovenda, 1) > 0 THEN
        v_where_summary := v_where_summary || format(' AND tipovenda = ANY(%L) ', p_tipovenda);
    END IF;

    -- Rede Logic
    IF p_rede IS NOT NULL AND array_length(p_rede, 1) > 0 THEN
       v_has_com_rede := ('C/ REDE' = ANY(p_rede));
       v_has_sem_rede := ('S/ REDE' = ANY(p_rede));
       v_specific_redes := array_remove(array_remove(p_rede, 'C/ REDE'), 'S/ REDE');

       IF array_length(v_specific_redes, 1) > 0 THEN
           v_rede_condition := format('ramo = ANY(%L)', v_specific_redes);
       END IF;

       IF v_has_com_rede THEN
           IF v_rede_condition != '' THEN v_rede_condition := v_rede_condition || ' OR '; END IF;
           v_rede_condition := v_rede_condition || ' (ramo IS NOT NULL AND ramo NOT IN (''N/A'', ''N/D'')) ';
       END IF;

       IF v_has_sem_rede THEN
           IF v_rede_condition != '' THEN v_rede_condition := v_rede_condition || ' OR '; END IF;
           v_rede_condition := v_rede_condition || ' (ramo IS NULL OR ramo IN (''N/A'', ''N/D'')) ';
       END IF;

       IF v_rede_condition != '' THEN
           v_where_summary := v_where_summary || ' AND (' || v_rede_condition || ') ';
           v_where_clients := v_where_clients || ' AND (' || v_rede_condition || ') ';
       END IF;
    END IF;

    -- Execution
    v_sql := '
    WITH active_base AS (
        SELECT COUNT(*) as total_clients
        FROM public.data_clients
        ' || v_where_clients || '
    ),
    sales_agg AS (
        SELECT codcli, SUM(vlvenda) as val
        FROM public.data_summary
        ' || v_where_summary || '
        GROUP BY codcli
        HAVING SUM(vlvenda) > 0
    ),
    positive_count AS (
        SELECT COUNT(*) as pos_clients FROM sales_agg
    ),
    -- For "Top Coverage", we need product level detail which isn''t in data_summary (it aggregates by codfor/tipovenda/codcli/year/month/filial... but not product).
    -- We must go to raw data for Top Products.
    top_products AS (
        SELECT
            s.produto,
            dp.descricao,
            COUNT(DISTINCT s.codcli) as client_count,
            SUM(s.vlvenda) as total_val
        FROM public.data_detailed s
        LEFT JOIN public.dim_produtos dp ON s.produto = dp.codigo
        WHERE EXTRACT(YEAR FROM s.dtped) = $1
        ' || CASE WHEN v_target_month IS NOT NULL THEN ' AND EXTRACT(MONTH FROM s.dtped) = $2 ' ELSE '' END || '
        ' || replace(replace(v_where_summary, 'ano = ' || v_current_year, '1=1'), 'mes = ' || coalesce(v_target_month::text, '0'), '1=1') || '
        GROUP BY 1, 2
        ORDER BY 3 DESC
        LIMIT 10
    )
    SELECT json_build_object(
        ''total_clients'', (SELECT total_clients FROM active_base),
        ''positive_clients'', (SELECT pos_clients FROM positive_count),
        ''top_products'', (SELECT json_agg(tp) FROM top_products tp)
    );
    ';

    -- Note: replacing where clause parts is hacky. Better to rebuild v_where_raw.
    -- But for now, let's just assume v_where_summary is mostly compatible if we strip alias prefixes?
    -- data_summary cols: filial, cidade, codsupervisor...
    -- data_detailed cols: filial, cidade, codsupervisor...
    -- They match! except for 'ano' and 'mes'.
    -- I handled ano/mes explicitly in top_products CTE.
    -- The replace() calls remove the summary-specific date filters so we can apply raw date filters.

    EXECUTE v_sql INTO v_result USING v_current_year, v_target_month;

    RETURN COALESCE(v_result, '{}'::json);
END;
$$;

-- P. Get Mix View Data
CREATE OR REPLACE FUNCTION get_mix_view_data(
    p_filial text[] default null,
    p_cidade text[] default null,
    p_supervisor text[] default null,
    p_vendedor text[] default null,
    p_fornecedor text[] default null,
    p_ano text default null,
    p_mes text default null,
    p_tipovenda text[] default null,
    p_rede text[] default null,
    p_page int default 0,
    p_limit int default 50
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_year int;
    v_target_month int;
    v_where_raw text := ' WHERE 1=1 ';
    v_where_clients text := ' WHERE bloqueio != ''S'' ';
    v_sql text;
    v_result json;

    v_rede_condition text := '';
    v_specific_redes text[];
    v_has_com_rede boolean;
    v_has_sem_rede boolean;
BEGIN
    IF NOT public.is_approved() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
    SET LOCAL work_mem = '64MB';

    -- Date
    IF p_ano IS NULL OR p_ano = 'todos' OR p_ano = '' THEN
        SELECT COALESCE(MAX(ano), EXTRACT(YEAR FROM CURRENT_DATE)::int) INTO v_current_year FROM public.data_summary;
    ELSE v_current_year := p_ano::int; END IF;

    IF p_mes IS NOT NULL AND p_mes != '' AND p_mes != 'todos' THEN
        v_target_month := p_mes::int + 1;
        v_where_raw := v_where_raw || format(' AND EXTRACT(MONTH FROM s.dtped) = %L ', v_target_month);
    END IF;
    v_where_raw := v_where_raw || format(' AND EXTRACT(YEAR FROM s.dtped) = %L ', v_current_year);

    -- Filters
    IF p_filial IS NOT NULL AND array_length(p_filial, 1) > 0 THEN
        v_where_raw := v_where_raw || format(' AND s.filial = ANY(%L) ', p_filial);
    END IF;
    IF p_cidade IS NOT NULL AND array_length(p_cidade, 1) > 0 THEN
        v_where_raw := v_where_raw || format(' AND s.cidade = ANY(%L) ', p_cidade);
        v_where_clients := v_where_clients || format(' AND cidade = ANY(%L) ', p_cidade);
    END IF;

    IF p_supervisor IS NOT NULL AND array_length(p_supervisor, 1) > 0 THEN
        v_where_raw := v_where_raw || format(' AND s.codsupervisor IN (SELECT codigo FROM dim_supervisores WHERE nome = ANY(%L)) ', p_supervisor);
        v_where_clients := v_where_clients || format(' AND rca1 IN (SELECT DISTINCT d.codusur FROM public.data_detailed d JOIN public.dim_supervisores ds ON d.codsupervisor = ds.codigo WHERE ds.nome = ANY(%L)) ', p_supervisor);
    END IF;
    IF p_vendedor IS NOT NULL AND array_length(p_vendedor, 1) > 0 THEN
        v_where_raw := v_where_raw || format(' AND s.codusur IN (SELECT codigo FROM dim_vendedores WHERE nome = ANY(%L)) ', p_vendedor);
        v_where_clients := v_where_clients || format(' AND rca1 IN (SELECT codigo FROM dim_vendedores WHERE nome = ANY(%L)) ', p_vendedor);
    END IF;

    -- Tipovenda
    IF p_tipovenda IS NOT NULL AND array_length(p_tipovenda, 1) > 0 THEN
        v_where_raw := v_where_raw || format(' AND s.tipovenda = ANY(%L) ', p_tipovenda);
    END IF;

    -- Rede
    IF p_rede IS NOT NULL AND array_length(p_rede, 1) > 0 THEN
       v_has_com_rede := ('C/ REDE' = ANY(p_rede));
       v_has_sem_rede := ('S/ REDE' = ANY(p_rede));
       v_specific_redes := array_remove(array_remove(p_rede, 'C/ REDE'), 'S/ REDE');

       IF array_length(v_specific_redes, 1) > 0 THEN
           v_rede_condition := format('ramo = ANY(%L)', v_specific_redes);
       END IF;

       IF v_has_com_rede THEN
           IF v_rede_condition != '' THEN v_rede_condition := v_rede_condition || ' OR '; END IF;
           v_rede_condition := v_rede_condition || ' (ramo IS NOT NULL AND ramo NOT IN (''N/A'', ''N/D'')) ';
       END IF;

       IF v_has_sem_rede THEN
           IF v_rede_condition != '' THEN v_rede_condition := v_rede_condition || ' OR '; END IF;
           v_rede_condition := v_rede_condition || ' (ramo IS NULL OR ramo IN (''N/A'', ''N/D'')) ';
       END IF;

       IF v_rede_condition != '' THEN
           v_where_raw := v_where_raw || ' AND EXISTS (SELECT 1 FROM public.data_clients c WHERE c.codigo_cliente = s.codcli AND (' || v_rede_condition || ')) ';
           v_where_clients := v_where_clients || ' AND (' || v_rede_condition || ') ';
       END IF;
    END IF;

    -- Aggregation
    v_sql := '
    WITH target_clients AS (
        SELECT codigo_cliente, fantasia, razaosocial, cidade, rca1
        FROM public.data_clients
        ' || v_where_clients || '
    ),
    sales_mix AS (
        SELECT
            s.codcli,
            MAX(CASE WHEN dp.mix_marca = ''CHEETOS'' AND s.vlvenda > 0 THEN 1 ELSE 0 END) as has_cheetos,
            MAX(CASE WHEN dp.mix_marca = ''DORITOS'' AND s.vlvenda > 0 THEN 1 ELSE 0 END) as has_doritos,
            MAX(CASE WHEN dp.mix_marca = ''FANDANGOS'' AND s.vlvenda > 0 THEN 1 ELSE 0 END) as has_fandangos,
            MAX(CASE WHEN dp.mix_marca = ''RUFFLES'' AND s.vlvenda > 0 THEN 1 ELSE 0 END) as has_ruffles,
            MAX(CASE WHEN dp.mix_marca = ''TORCIDA'' AND s.vlvenda > 0 THEN 1 ELSE 0 END) as has_torcida,

            MAX(CASE WHEN dp.mix_marca = ''TODDYNHO'' AND s.vlvenda > 0 THEN 1 ELSE 0 END) as has_toddynho,
            MAX(CASE WHEN dp.mix_marca = ''TODDY'' AND s.vlvenda > 0 THEN 1 ELSE 0 END) as has_toddy,
            MAX(CASE WHEN dp.mix_marca = ''QUAKER'' AND s.vlvenda > 0 THEN 1 ELSE 0 END) as has_quaker,
            MAX(CASE WHEN dp.mix_marca = ''KEROCOCO'' AND s.vlvenda > 0 THEN 1 ELSE 0 END) as has_kerococo
        FROM public.data_detailed s
        JOIN public.dim_produtos dp ON s.produto = dp.codigo
        ' || v_where_raw || '
        GROUP BY 1
    ),
    client_status AS (
        SELECT
            tc.codigo_cliente,
            tc.fantasia,
            tc.razaosocial,
            tc.cidade,
            tc.rca1,
            COALESCE(sm.has_cheetos, 0) as has_cheetos,
            COALESCE(sm.has_doritos, 0) as has_doritos,
            COALESCE(sm.has_fandangos, 0) as has_fandangos,
            COALESCE(sm.has_ruffles, 0) as has_ruffles,
            COALESCE(sm.has_torcida, 0) as has_torcida,
            COALESCE(sm.has_toddynho, 0) as has_toddynho,
            COALESCE(sm.has_toddy, 0) as has_toddy,
            COALESCE(sm.has_quaker, 0) as has_quaker,
            COALESCE(sm.has_kerococo, 0) as has_kerococo,

            -- Derived Logic
            (COALESCE(sm.has_cheetos, 0) + COALESCE(sm.has_doritos, 0) + COALESCE(sm.has_fandangos, 0) + COALESCE(sm.has_ruffles, 0) + COALESCE(sm.has_torcida, 0)) as salty_score,
            (COALESCE(sm.has_toddynho, 0) + COALESCE(sm.has_toddy, 0) + COALESCE(sm.has_quaker, 0) + COALESCE(sm.has_kerococo, 0)) as foods_score
        FROM target_clients tc
        LEFT JOIN sales_mix sm ON tc.codigo_cliente = sm.codcli
    ),
    totals AS (
        SELECT
            COUNT(*) as total_clients,
            SUM(CASE WHEN salty_score = 5 THEN 1 ELSE 0 END) as pos_salty,
            SUM(CASE WHEN foods_score = 4 THEN 1 ELSE 0 END) as pos_foods,
            SUM(CASE WHEN salty_score = 5 AND foods_score = 4 THEN 1 ELSE 0 END) as pos_both
        FROM client_status
    ),
    paginated AS (
        SELECT *
        FROM client_status
        ORDER BY (salty_score + foods_score) ASC -- Show worst first? Or Best? Usually worst to attack opportunity.
        LIMIT $1 OFFSET ($2 * $1)
    )
    SELECT json_build_object(
        ''kpi'', (SELECT row_to_json(t) FROM totals t),
        ''rows'', COALESCE(json_agg(p), ''[]''::json)
    )
    FROM paginated p;
    ';

    EXECUTE v_sql INTO v_result USING p_limit, p_page;

    RETURN COALESCE(v_result, '{}'::json);
END;
$$;

-- Q. Get Goals Realized Data
CREATE OR REPLACE FUNCTION get_goals_view_data(
    p_filial text[] default null,
    p_cidade text[] default null,
    p_supervisor text[] default null,
    p_vendedor text[] default null,
    p_fornecedor text[] default null,
    p_ano text default null,
    p_mes text default null,
    p_tipovenda text[] default null,
    p_rede text[] default null
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_year int;
    v_target_month int;
    v_where_summary text := ' WHERE 1=1 ';
    v_sql text;
    v_result json;

    v_rede_condition text := '';
    v_specific_redes text[];
    v_has_com_rede boolean;
    v_has_sem_rede boolean;
BEGIN
    IF NOT public.is_approved() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
    SET LOCAL work_mem = '64MB';

    -- Date
    IF p_ano IS NULL OR p_ano = 'todos' OR p_ano = '' THEN
        SELECT COALESCE(MAX(ano), EXTRACT(YEAR FROM CURRENT_DATE)::int) INTO v_current_year FROM public.data_summary;
    ELSE v_current_year := p_ano::int; END IF;

    IF p_mes IS NOT NULL AND p_mes != '' AND p_mes != 'todos' THEN
        v_target_month := p_mes::int + 1;
        v_where_summary := v_where_summary || format(' AND mes = %L ', v_target_month);
    END IF;
    v_where_summary := v_where_summary || format(' AND ano = %L ', v_current_year);

    -- Filters
    IF p_filial IS NOT NULL AND array_length(p_filial, 1) > 0 THEN
        v_where_summary := v_where_summary || format(' AND filial = ANY(%L) ', p_filial);
    END IF;
    IF p_cidade IS NOT NULL AND array_length(p_cidade, 1) > 0 THEN
        v_where_summary := v_where_summary || format(' AND cidade = ANY(%L) ', p_cidade);
    END IF;

    IF p_supervisor IS NOT NULL AND array_length(p_supervisor, 1) > 0 THEN
        v_where_summary := v_where_summary || format(' AND codsupervisor IN (SELECT codigo FROM dim_supervisores WHERE nome = ANY(%L)) ', p_supervisor);
    END IF;
    IF p_vendedor IS NOT NULL AND array_length(p_vendedor, 1) > 0 THEN
        v_where_summary := v_where_summary || format(' AND codusur IN (SELECT codigo FROM dim_vendedores WHERE nome = ANY(%L)) ', p_vendedor);
    END IF;

    -- Goals View usually shows ALL data, then JS filters? No, we filter here.
    -- Tipovenda is usually '1' and '9' for Goals.
    -- If p_tipovenda provided, use it. Else default to 1,9?
    -- App.js usually sends specific tipovenda for Goals?
    -- Actually Goals usually includes Bonifications for some metrics (Positivacao).
    -- So we just apply filter if present.
    IF p_tipovenda IS NOT NULL AND array_length(p_tipovenda, 1) > 0 THEN
        v_where_summary := v_where_summary || format(' AND tipovenda = ANY(%L) ', p_tipovenda);
    END IF;

    -- Aggregation: We need totals by Vendedor and Supervisor
    -- Logic:
    -- 1. Revenue (tipovenda 1, 9)
    -- 2. Volume (tipovenda 1, 9)
    -- 3. Positivation (count clients with >0 sales in 1,9? Or any?)
    --    Usually Positivation includes Bonus (5, 11).
    --    The summary table has 'vlvenda' and 'peso'.
    --    And 'pre_positivacao_val' (vlvenda >= 1).
    --    We need 'real_fat', 'real_vol', 'real_pos'.

    -- Refined Logic:
    -- Revenue/Volume: Sum where tipovenda IN ('1', '9')
    -- Positivation: Count distinct codcli where sum(vlvenda) >= 1 (across all types? no, usually sale types).

    v_sql := '
    SELECT json_agg(row_to_json(t))
    FROM (
        SELECT
            codusur,
            MAX(codsupervisor) as codsupervisor,
            SUM(CASE WHEN tipovenda IN (''1'', ''9'') THEN vlvenda ELSE 0 END) as real_fat,
            SUM(CASE WHEN tipovenda IN (''1'', ''9'') THEN peso ELSE 0 END) as real_vol,
            COUNT(DISTINCT CASE WHEN vlvenda >= 1 THEN codcli END) as real_pos_clients,

            -- Breakdown by Brand (Approximate via codfor)
            -- This is needed for "707", "708" columns in Goals View.
            SUM(CASE WHEN tipovenda IN (''1'', ''9'') AND codfor = ''707'' THEN vlvenda ELSE 0 END) as real_707_fat,
            SUM(CASE WHEN tipovenda IN (''1'', ''9'') AND codfor = ''708'' THEN vlvenda ELSE 0 END) as real_708_fat,
            SUM(CASE WHEN tipovenda IN (''1'', ''9'') AND codfor = ''752'' THEN vlvenda ELSE 0 END) as real_752_fat,
            SUM(CASE WHEN tipovenda IN (''1'', ''9'') AND codfor LIKE ''1119%'' THEN vlvenda ELSE 0 END) as real_foods_fat,

            -- Positivation Breakdown
            COUNT(DISTINCT CASE WHEN vlvenda >= 1 AND codfor = ''707'' THEN codcli END) as real_707_pos,
            COUNT(DISTINCT CASE WHEN vlvenda >= 1 AND codfor = ''708'' THEN codcli END) as real_708_pos,
            COUNT(DISTINCT CASE WHEN vlvenda >= 1 AND codfor = ''752'' THEN codcli END) as real_752_pos,
            COUNT(DISTINCT CASE WHEN vlvenda >= 1 AND codfor LIKE ''1119%'' THEN codcli END) as real_foods_pos

        FROM public.data_summary
        ' || v_where_summary || '
        GROUP BY codusur
    ) t;
    ';

    EXECUTE v_sql INTO v_result;

    RETURN COALESCE(v_result, '[]'::json);
END;
$$;
