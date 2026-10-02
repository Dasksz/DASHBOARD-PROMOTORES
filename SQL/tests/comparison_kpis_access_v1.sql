-- Somente leitura dos dados reais; a configuração de sessão é revertida.
BEGIN;
DO $$ BEGIN
 IF has_function_privilege('anon','public.get_comparison_kpis_v1(jsonb)','EXECUTE') THEN RAISE EXCEPTION 'anon tem acesso'; END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 PERFORM set_config('request.jwt.claims','{}',true);
 BEGIN
   PERFORM public.get_comparison_kpis_v1('{"client_codes":[],"reference_date":"2026-10-01"}');
   RAISE EXCEPTION 'Sessão vazia aceita';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM set_config('request.jwt.claim.sub',(SELECT id::text FROM public.profiles WHERE lower(role)='promotor1' AND status='aprovado' LIMIT 1),true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',(SELECT id::text FROM public.profiles WHERE lower(role)='promotor1' AND status='aprovado' LIMIT 1),'role','authenticated')::text,true);
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Perfil para teste não encontrado'; END IF;
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE f jsonb; r jsonb; expected numeric; outside_code text;
BEGIN
 SELECT jsonb_build_object('client_codes',jsonb_agg(codigo_cliente),'reference_date','2026-10-01') INTO f FROM public.data_clients;
 r:=public.get_comparison_kpis_v1(f);
 SELECT coalesce(sum(vlvenda),0) INTO expected FROM public.data_history
 WHERE tipovenda IN ('1','9') AND codcli IN (
   SELECT cp.client_code FROM public.data_client_promoters cp WHERE lower(cp.promoter_code)='promotor1');
 IF abs((r#>>'{kpis,history,fat}')::numeric-expected/3)>0.000001 THEN RAISE EXCEPTION 'Carteira de promotor divergente'; END IF;
 SELECT codigo_cliente INTO outside_code FROM public.data_clients
 WHERE codigo_cliente NOT IN (SELECT cp.client_code FROM public.data_client_promoters cp WHERE lower(cp.promoter_code)='promotor1') LIMIT 1;
 r:=public.get_comparison_kpis_v1(f||jsonb_build_object('client_codes',jsonb_build_array(outside_code)));
 IF (r#>>'{kpis,current,fat}')::numeric<>0 OR (r#>>'{kpis,history,fat}')::numeric<>0 THEN RAISE EXCEPTION 'Seleção ampliou carteira'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 PERFORM set_config('request.jwt.claim.sub',(SELECT id::text FROM public.profiles WHERE role='1001' AND status='aprovado' LIMIT 1),true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',(SELECT id::text FROM public.profiles WHERE role='1001' AND status='aprovado' LIMIT 1),'role','authenticated')::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE f jsonb; r jsonb; expected numeric;
BEGIN
 SELECT jsonb_build_object('client_codes',jsonb_agg(codigo_cliente),'reference_date','2026-10-01') INTO f FROM public.data_clients;
 r:=public.get_comparison_kpis_v1(f);
 SELECT coalesce(sum(vlvenda),0) INTO expected FROM public.data_history
 WHERE tipovenda IN ('1','9') AND codusur='1001' AND codcli IN(SELECT codigo_cliente FROM public.data_clients);
 IF abs((r#>>'{kpis,history,fat}')::numeric-expected/3)>0.000001 THEN RAISE EXCEPTION 'Carteira de vendedor divergente'; END IF;
END $$;
RESET ROLE;
SELECT 'Acesso: anon, sessão vazia, promotor, cliente fora da carteira e vendedor OK' result;
ROLLBACK;
