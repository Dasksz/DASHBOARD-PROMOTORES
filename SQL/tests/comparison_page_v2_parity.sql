BEGIN;
DO $$ BEGIN PERFORM set_config('request.jwt.claim.sub',(SELECT id::text FROM public.profiles WHERE role='adm' LIMIT 1),true); END $$;
SET LOCAL ROLE authenticated;
DO $$ DECLARE f jsonb; s jsonb:=dashboard_private.scope_v1(); old jsonb; fresh jsonb; codes jsonb; ref date; report jsonb:='[]';
BEGIN
 SELECT max(day) FILTER(WHERE source='current') INTO ref FROM dashboard_private.sales_calendar;
 FOR f IN SELECT * FROM jsonb_array_elements('[{"pasta":"PEPSICO"},{"pasta":"PEPSICO","suppliers":["707"]},{"pasta":"PEPSICO","mode":"promoter","promotors":["promotor7"]},{"mode":"seller","sellers":["1001"]},{"mode":"seller","sellers":["1001"],"types":["5"]},{"pasta":"PEPSICO","types":["1","5"],"tendency":true,"holidays":["2026-10-12"]}]'::jsonb) LOOP
  SELECT coalesce(jsonb_agg(DISTINCT codcli),'[]') INTO codes FROM dashboard_private.comparison_rows_v2(s,f);
  old:=public.get_comparison_kpis_v1(f||jsonb_build_object('client_codes',codes,'reference_date',ref));
  fresh:=public.get_comparison_page_v2(f);
  IF old->'kpis' IS DISTINCT FROM fresh->'kpis' THEN RAISE EXCEPTION 'KPIs divergentes: % old % new %',f,old->'kpis',fresh->'kpis'; END IF;
  report:=report||jsonb_build_object('filters',f,'kpis_equal',true);
 END LOOP;
 PERFORM set_config('test.comparison_parity',report::text,true);
END $$;
SELECT current_setting('test.comparison_parity')::jsonb report;
ROLLBACK;
