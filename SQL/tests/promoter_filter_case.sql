BEGIN READ ONLY;
DO $$ BEGIN
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',(SELECT id FROM public.profiles WHERE lower(btrim(role))='promotor7' AND status='aprovado' LIMIT 1),'role','authenticated')::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE baseline jsonb; actual jsonb; options jsonb; code text;
BEGIN
 baseline:=public.get_overview_summary_v1('{}');
 IF (baseline->>'totalRelevantClients')::int=0 THEN RAISE EXCEPTION 'Richard fixture has no portfolio'; END IF;
 FOREACH code IN ARRAY ARRAY['promotor7','PROMOTOR7',' ProMoToR7 '] LOOP
  actual:=public.get_overview_summary_v1(jsonb_build_object('promotors',jsonb_build_array(code)));
  IF actual IS DISTINCT FROM baseline THEN RAISE EXCEPTION 'Case variant changed scoped KPIs: %',code; END IF;
  options:=public.get_overview_filters_v1(jsonb_build_object('promotors',jsonb_build_array(code)))->'sellers';
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(options)v WHERE v->>'code'='78')
  OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(options)v WHERE v->>'code'='172')
  THEN RAISE EXCEPTION 'Richard lost authorized sellers: %',code; END IF;
 END LOOP;
 actual:=public.get_overview_summary_v1('{"promotors":["PROMOTOR6"]}');
 IF (actual->>'totalRelevantClients')::int<>0 OR (actual->>'totalFaturamento')::numeric<>0 THEN RAISE EXCEPTION 'Other promoter expanded access'; END IF;
END $$;
ROLLBACK;
