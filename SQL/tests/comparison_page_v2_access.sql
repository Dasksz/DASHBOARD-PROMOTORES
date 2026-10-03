BEGIN;
DO $$ BEGIN
 IF has_function_privilege('anon','public.get_comparison_page_v2(jsonb)','EXECUTE')
 OR has_function_privilege('anon','public.get_comparison_filters_v2(jsonb)','EXECUTE')
 OR has_function_privilege('anon','public.get_dashboard_summary_status_v1()','EXECUTE') THEN RAISE EXCEPTION 'Acesso anônimo'; END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 BEGIN PERFORM public.get_comparison_page_v2('{}'); RAISE EXCEPTION 'Sessão vazia aceita'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',(SELECT id::text FROM public.profiles WHERE role='promotor1' AND status='aprovado' LIMIT 1),true);
END $$;
SET LOCAL ROLE authenticated;
DO $$ DECLARE baseline jsonb; filtered jsonb; forged jsonb; s jsonb; outside_seller text; BEGIN
 s:=dashboard_private.scope_v1(); IF s->>'kind'<>'trade' THEN RAISE EXCEPTION 'Perfil de teste ausente'; END IF;
 baseline:=public.get_comparison_page_v2('{"pasta":"PEPSICO"}');
 filtered:=dashboard_private.comparison_result_v2(s,'{"pasta":"PEPSICO"}');
 IF baseline IS DISTINCT FROM filtered THEN RAISE EXCEPTION 'Cache geral vazou para promotor'; END IF;
 SELECT a.seller INTO outside_seller FROM dashboard_private.client_assignments a
 WHERE a.seller IS NOT NULL AND NOT EXISTS(SELECT 1 FROM dashboard_private.clients_v1(s) c WHERE c.rca=a.seller) LIMIT 1;
 forged:=public.get_comparison_page_v2(jsonb_build_object('mode','seller','sellers',jsonb_build_array(outside_seller),'kind','admin','client_codes',s->'clients'));
 IF (forged#>>'{kpis,current,fat}')::numeric<>0 OR (forged#>>'{kpis,history,fat}')::numeric<>0 OR jsonb_array_length(forged#>'{charts,groups}')<>0 THEN RAISE EXCEPTION 'Seleção ampliou carteira'; END IF;
 BEGIN PERFORM public.get_dashboard_summary_status_v1(); RAISE EXCEPTION 'Promotor consultou atualização administrativa'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN PERFORM set_config('request.jwt.claim.sub',(SELECT id::text FROM public.profiles WHERE role='1001' AND status='aprovado' LIMIT 1),true); END $$;
SET LOCAL ROLE authenticated;
DO $$ DECLARE a jsonb; b jsonb; BEGIN
 a:=public.get_comparison_page_v2('{"mode":"seller"}');
 b:=dashboard_private.comparison_result_v2(dashboard_private.scope_v1(),'{"mode":"seller"}');
 IF a IS DISTINCT FROM b THEN RAISE EXCEPTION 'Carteira vendedor divergente'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN PERFORM set_config('request.jwt.claim.sub',(SELECT id::text FROM public.profiles WHERE role='adm' LIMIT 1),true); END $$;
SET LOCAL ROLE authenticated;
DO $$ DECLARE a jsonb; b jsonb; key jsonb; BEGIN
 FOR key IN SELECT * FROM jsonb_array_elements('[{},{"pasta":"PEPSICO"}]') LOOP
 a:=public.get_comparison_page_v2(key);
 b:=dashboard_private.comparison_result_v2(dashboard_private.scope_v1(),key);
 IF a IS DISTINCT FROM b THEN RAISE EXCEPTION 'Cache divergente da geração atual'; END IF;
 IF public.get_comparison_filters_v2(key) IS DISTINCT FROM dashboard_private.comparison_filters_result_v2(dashboard_private.scope_v1(),key) THEN RAISE EXCEPTION 'Cache filtros divergente'; END IF;
 END LOOP;
 IF public.get_dashboard_summary_status_v1()->>'status'<>'current' THEN RAISE EXCEPTION 'Resumos pendentes'; END IF;
END $$;
SELECT 'Acesso, cache por carteira, seleção forjada, vendedor e geração atual: OK' result;
ROLLBACK;
