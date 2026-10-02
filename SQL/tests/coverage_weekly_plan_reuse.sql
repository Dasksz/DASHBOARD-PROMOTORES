-- Simula conexões que reutilizam planos: seleção repetida seguida de Limpar.
-- Somente leitura; sessão/variáveis são revertidas ao final.
BEGIN;
DO $$ BEGIN PERFORM set_config('request.jwt.claim.sub',(SELECT id::text FROM public.profiles WHERE role='adm' LIMIT 1),true); END $$;
SET LOCAL ROLE authenticated;
SET LOCAL plan_cache_mode='force_generic_plan';
DO $$
DECLARE baseline jsonb; cleared jsonb; weekly_baseline jsonb; started timestamptz;
 elapsed numeric; i integer; timings jsonb:='[]'; f jsonb;
BEGIN
 started:=clock_timestamp(); baseline:=public.get_coverage_page_v1('{}');
 timings:=timings||jsonb_build_array(jsonb_build_object('step','initial_general','ms',round(extract(epoch FROM clock_timestamp()-started)*1000,1)));
 weekly_baseline:=public.get_weekly_page_v1('{}');
 FOR i IN 1..8 LOOP
  f:=CASE WHEN i%2=0 THEN '{"mode":"promoter","promotors":["promotor7"]}'::jsonb ELSE '{"mode":"promoter","promotors":["promotor7"],"suppliers":["707"]}'::jsonb END;
  PERFORM public.get_coverage_page_v1(f); PERFORM public.get_weekly_page_v1(f);
 END LOOP;
 started:=clock_timestamp(); cleared:=public.get_coverage_page_v1('{}');
 elapsed:=round(extract(epoch FROM clock_timestamp()-started)*1000,1);
 timings:=timings||jsonb_build_array(jsonb_build_object('step','clear_general_after_8_filters','ms',elapsed));
 IF baseline IS DISTINCT FROM cleared THEN RAISE EXCEPTION 'Limpar não restaurou o resultado geral'; END IF;
 IF weekly_baseline IS DISTINCT FROM public.get_weekly_page_v1('{}') THEN RAISE EXCEPTION 'Semanal geral mudou depois dos filtros'; END IF;
 IF current_setting('plan_cache_mode')<>'force_generic_plan' THEN RAISE EXCEPTION 'A função alterou a configuração externa da sessão'; END IF;
 PERFORM set_config('test.rpc_plan_timings',timings::text,true);
END $$;
SELECT current_setting('test.rpc_plan_timings')::jsonb timings,'Reuso de conexão, 8 seleções e retorno aos dados gerais: OK' result;
ROLLBACK;
