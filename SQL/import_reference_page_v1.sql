-- Read-only references for standalone spreadsheet imports. Invoker preserves RLS.
CREATE OR REPLACE FUNCTION public.get_import_reference_page_v1(
  p_source text, p_after text DEFAULT NULL, p_limit integer DEFAULT 2000
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_table text;
  v_pk text;
  v_rows jsonb;
  v_next text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Importação permitida apenas para administradores' USING ERRCODE = '42501';
  END IF;
  IF p_limit < 1 OR p_limit > 2000 OR p_limit IS NULL THEN
    RAISE EXCEPTION 'Limite inválido' USING ERRCODE = '22023';
  END IF;
  IF p_source = 'soldProducts' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('code', code) ORDER BY code), '[]'::jsonb), max(code)
      INTO v_rows, v_next
      FROM (
        SELECT code FROM (
          SELECT produto AS code FROM public.data_history
          UNION SELECT produto FROM public.data_detailed
        ) sold WHERE code IS NOT NULL AND (p_after IS NULL OR code > p_after)
        ORDER BY code LIMIT p_limit
      ) page;
    RETURN jsonb_build_object('rows', v_rows, 'next', v_next);
  END IF;
  CASE p_source
    WHEN 'clients' THEN v_table := 'data_clients'; v_pk := 'id';
    WHEN 'sales' THEN v_table := 'data_detailed'; v_pk := 'id';
    WHEN 'products' THEN v_table := 'data_product_details'; v_pk := 'code';
    WHEN 'activeProducts' THEN v_table := 'data_active_products'; v_pk := 'code';
    WHEN 'vendedores' THEN v_table := 'dim_vendedores'; v_pk := 'codigo';
    WHEN 'supervisores' THEN v_table := 'dim_supervisores'; v_pk := 'codigo';
    WHEN 'fornecedores' THEN v_table := 'dim_fornecedores'; v_pk := 'codigo';
    WHEN 'produtos' THEN v_table := 'dim_produtos'; v_pk := 'codigo';
    ELSE RAISE EXCEPTION 'Fonte de referência inválida' USING ERRCODE = '22023';
  END CASE;
  -- UUID tables use UUID comparisons so their primary-key indexes remain usable.
  EXECUTE format(
    'SELECT coalesce(jsonb_agg(to_jsonb(r) - ''id'' ORDER BY r.%1$I), ''[]''::jsonb),
            (array_agg(r.%1$I::text ORDER BY r.%1$I DESC))[1]
     FROM (SELECT * FROM public.%2$I WHERE ($1 IS NULL OR %1$I > $1::%3$s)
           ORDER BY %1$I LIMIT $2) r',
    v_pk, v_table, CASE WHEN v_pk = 'id' THEN 'uuid' ELSE 'text' END
  ) INTO v_rows, v_next USING p_after, p_limit;
  RETURN jsonb_build_object('rows', v_rows, 'next', v_next);
END;
$$;
REVOKE ALL ON FUNCTION public.get_import_reference_page_v1(text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_import_reference_page_v1(text, text, integer) TO authenticated, service_role;
