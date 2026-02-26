
-- ==============================================================================
-- NEW RPCs FOR DASHBOARD (Server-Side Logic using Dim Tables)
-- ==============================================================================

-- Helper: Get Available Years
CREATE OR REPLACE FUNCTION get_available_years()
RETURNS int[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    years int[];
BEGIN
    SELECT array_agg(DISTINCT y ORDER BY y DESC) INTO years
    FROM (
        SELECT EXTRACT(YEAR FROM dtped)::int as y FROM public.data_detailed
        UNION
        SELECT EXTRACT(YEAR FROM dtped)::int as y FROM public.data_history
    ) t;
    RETURN years;
END;
$$;

-- 1. Main Dashboard Data (Optimized with Dimensions)
CREATE OR REPLACE FUNCTION get_main_dashboard_data(
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
    v_previous_year int;
    v_target_month int;
    v_sql text;
    v_where text := ' WHERE 1=1 ';
    v_result json;
BEGIN
    -- Determine Date Context
    IF p_ano IS NULL OR p_ano = 'todos' OR p_ano = '' THEN
        v_current_year := EXTRACT(YEAR FROM CURRENT_DATE)::int;
    ELSE
        v_current_year := p_ano::int;
    END IF;
    v_previous_year := v_current_year - 1;

    -- Base Filter Construction
    IF p_filial IS NOT NULL AND array_length(p_filial, 1) > 0 THEN
        v_where := v_where || format(' AND s.filial = ANY(%L) ', p_filial);
    END IF;

    -- Use Dimension Tables for filtering where possible (more robust)
    IF p_supervisor IS NOT NULL AND array_length(p_supervisor, 1) > 0 THEN
        v_where := v_where || format(' AND s.codsupervisor IN (SELECT codigo FROM dim_supervisores WHERE nome = ANY(%L)) ', p_supervisor);
    END IF;

    IF p_vendedor IS NOT NULL AND array_length(p_vendedor, 1) > 0 THEN
        v_where := v_where || format(' AND s.codusur IN (SELECT codigo FROM dim_vendedores WHERE nome = ANY(%L)) ', p_vendedor);
    END IF;

    IF p_fornecedor IS NOT NULL AND array_length(p_fornecedor, 1) > 0 THEN
        v_where := v_where || format(' AND s.codfor = ANY(%L) ', p_fornecedor);
    END IF;

    -- Logic for Aggregation (simplified for example)
    -- This shows how to JOIN with dimensions to return readable names
    v_sql := format('
        WITH combined_sales AS (
            SELECT
                EXTRACT(YEAR FROM s.dtped)::int as ano,
                EXTRACT(MONTH FROM s.dtped)::int as mes,
                s.vlvenda,
                s.totpesoliq as peso
            FROM public.data_detailed s
            %s
            AND EXTRACT(YEAR FROM s.dtped) IN (%L, %L)
            UNION ALL
            SELECT
                EXTRACT(YEAR FROM s.dtped)::int as ano,
                EXTRACT(MONTH FROM s.dtped)::int as mes,
                s.vlvenda,
                s.totpesoliq as peso
            FROM public.data_history s
            %s
            AND EXTRACT(YEAR FROM s.dtped) IN (%L, %L)
        ),
        agg AS (
            SELECT
                ano,
                mes,
                SUM(vlvenda) as total_venda,
                SUM(peso) as total_peso
            FROM combined_sales
            GROUP BY 1, 2
        )
        SELECT json_agg(row_to_json(agg.*)) FROM agg
    ', v_where, v_current_year, v_previous_year, v_where, v_current_year, v_previous_year);

    EXECUTE v_sql INTO v_result;

    RETURN json_build_object(
        'current_year', v_current_year,
        'data', COALESCE(v_result, '[]'::json)
    );
END;
$$;
