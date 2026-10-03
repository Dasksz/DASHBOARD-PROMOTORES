-- Cache only administrator-wide selections. Every request still derives its session wallet.
CREATE OR REPLACE FUNCTION public.get_comparison_page_v2(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET plan_cache_mode='force_custom_plan' SET jit='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); result jsonb; key jsonb;
BEGIN
 IF jsonb_typeof(p_filters) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 key:=dashboard_private.normalize_page_filters_v1(p_filters-ARRAY['holidays','tendency']);
 IF s->>'kind'='admin' AND NOT coalesce((p_filters->>'tendency')::boolean,false) AND coalesce(jsonb_array_length(p_filters->'holidays'),0)=0
 AND key IN('{}'::jsonb,'{"pasta":"PEPSICO"}'::jsonb) THEN
  SELECT payload INTO result FROM dashboard_private.page_rollups WHERE page='comparison' AND cache_key=key;
  IF FOUND THEN RETURN result; END IF;
 END IF;
 RETURN dashboard_private.comparison_result_v2(s,p_filters);
END $$;
CREATE OR REPLACE FUNCTION public.get_comparison_filters_v2(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET plan_cache_mode='force_custom_plan' SET jit='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); result jsonb; key jsonb;
BEGIN
 IF jsonb_typeof(p_filters) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 key:=dashboard_private.normalize_page_filters_v1(p_filters-ARRAY['holidays','tendency']);
 IF s->>'kind'='admin' AND key IN('{}'::jsonb,'{"pasta":"PEPSICO"}'::jsonb) THEN
  SELECT payload INTO result FROM dashboard_private.page_rollups WHERE page='comparison_filters' AND cache_key=key;
  IF FOUND THEN RETURN result; END IF;
 END IF;
 RETURN dashboard_private.comparison_filters_result_v2(s,p_filters);
END $$;
REVOKE ALL ON FUNCTION public.get_comparison_page_v2(jsonb),public.get_comparison_filters_v2(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_comparison_page_v2(jsonb),public.get_comparison_filters_v2(jsonb) TO authenticated;

-- Import completion polls this short call while the scheduled worker rebuilds the summaries.
-- A long rebuild cannot fit the Data API's 8-second statement timeout.
CREATE OR REPLACE FUNCTION public.get_dashboard_summary_status_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Consulta reservada ao administrador' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('status',CASE WHEN dirty THEN 'pending' ELSE 'current' END,'generation',generation,'refreshed_at',refreshed_at)
 INTO result FROM dashboard_private.summary_state WHERE id;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_dashboard_summary_status_v1() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary_status_v1() TO authenticated;
