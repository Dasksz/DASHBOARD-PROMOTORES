BEGIN;
DO $$ BEGIN PERFORM set_config('request.jwt.claim.sub',(SELECT id::text FROM public.profiles WHERE role='adm' LIMIT 1),true); END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE started timestamptz; result jsonb; timings jsonb:='[]'; rpc text;
BEGIN
 FOREACH rpc IN ARRAY ARRAY['get_coverage_page_v1','get_weekly_page_v1','get_comparison_kpis_v1'] LOOP
 started:=clock_timestamp();
 EXECUTE format('SELECT public.%I($1)',rpc) INTO result USING CASE WHEN rpc='get_comparison_kpis_v1' THEN (SELECT jsonb_build_object('client_codes',coalesce(jsonb_agg(codigo_cliente),'[]'::jsonb),'reference_date','2026-10-02') FROM public.data_clients) ELSE '{}'::jsonb END;
 IF result IS NULL THEN RAISE EXCEPTION 'Resposta vazia: %',rpc; END IF;
 timings:=timings||jsonb_build_array(jsonb_build_object('rpc',rpc,'ms',round(extract(epoch FROM clock_timestamp()-started)*1000,1)));
 END LOOP;
 started:=clock_timestamp(); result:=public.get_titulos_view_data();
 IF result IS NULL THEN RAISE EXCEPTION 'Resposta vazia em Títulos'; END IF;
 timings:=timings||jsonb_build_array(jsonb_build_object('rpc','get_titulos_view_data','ms',round(extract(epoch FROM clock_timestamp()-started)*1000,1)));
 PERFORM set_config('test.summary_timings',timings::text,true);
END $$;
SELECT current_setting('test.summary_timings')::jsonb AS timings;
ROLLBACK;
