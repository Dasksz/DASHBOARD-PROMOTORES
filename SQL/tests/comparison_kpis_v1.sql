-- Executar como postgres. Todas as fixtures e alterações de sessão sofrem ROLLBACK.
BEGIN;
INSERT INTO public.data_clients(codigo_cliente,rca1,cidade,ramo) VALUES
 ('__rpc_test_a','__rpc_seller','__rpc_city','N/A'),
 ('__rpc_test_b','__rpc_seller','__rpc_city','BH'),
 ('__rpc_test_c','__rpc_seller','__rpc_city','N/A');
INSERT INTO public.dim_produtos(codigo,descricao) VALUES
 ('__rpc_p1','CHEETOS'),('__rpc_p2','DORITOS'),('__rpc_p3','FANDANGOS'),
 ('__rpc_p4','RUFFLES'),('__rpc_p5','TORCIDA'),('__rpc_p6','TODDYNHO'),
 ('__rpc_p7','TODDY ORIGINAL'),('__rpc_p8','QUAKER'),('__rpc_p9','KEROCOCO');
INSERT INTO public.data_detailed(codcli,codusur,produto,codfor,filial,tipovenda,dtped,vlvenda,vlbonific,totpesoliq,observacaofor)
 SELECT '__rpc_test_a','__rpc_seller','__rpc_p'||n,CASE WHEN n<=5 THEN '707' ELSE '1119' END,'05','1','2026-10-01'::timestamptz,CASE WHEN n<=5 THEN 10 ELSE 5 END,0,1,'PEPSICO' FROM generate_series(1,9) n;
INSERT INTO public.data_detailed(codcli,codusur,produto,codfor,filial,tipovenda,dtped,vlvenda,vlbonific,totpesoliq,observacaofor)
 SELECT '__rpc_test_b','__rpc_seller','__rpc_p1','752','08','1','2026-10-01'::timestamptz,1,0,1,'PEPSICO' FROM generate_series(1,2)
 UNION ALL SELECT '__rpc_test_c','__rpc_seller','__rpc_p1','752','08','1','2026-10-01'::timestamptz,0.4,0,1,'PEPSICO' FROM generate_series(1,2)
 UNION ALL SELECT '__rpc_test_a','__rpc_seller','__rpc_p1','707','05','5','2026-10-01'::timestamptz,0,7,1,'PEPSICO'
 UNION ALL SELECT '__rpc_test_b','__rpc_seller','__rpc_p1','752','08','5','2026-10-01'::timestamptz,0,99,1,'PEPSICO';
INSERT INTO public.data_history(codcli,codusur,produto,codfor,filial,tipovenda,dtped,vlvenda,vlbonific,totpesoliq,observacaofor)
 SELECT '__rpc_test_a','__rpc_seller','__rpc_p1','707','05','1',make_date(2026,6+n,1),30*n,0,1,'PEPSICO' FROM generate_series(1,3) n
 UNION ALL SELECT '__rpc_test_b','__rpc_seller','__rpc_p1','752','08','1',make_date(2026,6+n,1),3*n,0,1,'PEPSICO' FROM generate_series(1,3) n
 UNION ALL SELECT '__rpc_test_a','__rpc_seller','__rpc_p1','707','05','5',make_date(2026,6+n,1),0,7,1,'PEPSICO' FROM generate_series(1,3) n;
DO $$ BEGIN
 PERFORM set_config('request.jwt.claim.sub',(SELECT id::text FROM public.profiles WHERE role='adm' LIMIT 1),true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',(SELECT id::text FROM public.profiles WHERE role='adm' LIMIT 1),'role','authenticated')::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE f jsonb := '{"client_codes":["__rpc_test_a","__rpc_test_b","__rpc_test_c"],"reference_date":"2026-10-01"}';
 r jsonb; c jsonb; h jsonb; factor numeric;
BEGIN
 r:=public.get_comparison_kpis_v1(f); c:=r#>'{kpis,current}'; h:=r#>'{kpis,history}';
 IF (c->>'fat')::numeric<>72.8 OR (c->>'peso')::numeric<>13 OR (c->>'clients')::numeric<>2
   OR (c->>'mixPepsico')::numeric<>3 OR (c->>'positivacaoSalty')::numeric<>1
   OR (c->>'positivacaoFoods')::numeric<>1 OR (c->>'perdas')::numeric<>7 OR (c->>'ticket')::numeric<>36.4 THEN
   RAISE EXCEPTION 'KPIs atuais divergentes: %',c;
 END IF;
 IF (h->>'fat')::numeric<>66 OR (h->>'peso')::numeric<>2 OR (h->>'clients')::numeric<>2
   OR (h->>'mixPepsico')::numeric<>1 OR (h->>'positivacaoSalty')::numeric<>0
   OR (h->>'positivacaoFoods')::numeric<>0 OR (h->>'perdas')::numeric<>7 OR (h->>'ticket')::numeric<>33 THEN
   RAISE EXCEPTION 'KPIs históricos divergentes: %',h;
 END IF;
 r:=public.get_comparison_kpis_v1(f||'{"types":["5"]}');
 IF (r#>>'{kpis,current,fat}')::numeric<>106 OR (r#>>'{kpis,current,perdas}')::numeric<>7 THEN RAISE EXCEPTION 'Tipo alternativo/perdas'; END IF;
 r:=public.get_comparison_kpis_v1(f||'{"types":["1","5"]}');
 IF (r#>>'{kpis,current,fat}')::numeric<>72.8 THEN RAISE EXCEPTION 'Tipo misto'; END IF;
 r:=public.get_comparison_kpis_v1(f||'{"filial":"05"}');
 IF (r#>>'{kpis,current,fat}')::numeric<>70 OR (r#>>'{kpis,history,fat}')::numeric<>60 THEN RAISE EXCEPTION 'Filial'; END IF;
 r:=public.get_comparison_kpis_v1(f||'{"suppliers":["1119_QUAKER_KEROCOCO"]}');
 IF (r#>>'{kpis,current,fat}')::numeric<>10 THEN RAISE EXCEPTION 'Fornecedor virtual'; END IF;
 r:=public.get_comparison_kpis_v1(f||'{"products":["__rpc_p7"]}');
 IF (r#>>'{kpis,current,fat}')::numeric<>5 THEN RAISE EXCEPTION 'Produto'; END IF;
 r:=public.get_comparison_kpis_v1(f||'{"city":"inexistente"}');
 IF (r#>>'{kpis,current,fat}')::numeric<>0 THEN RAISE EXCEPTION 'Cidade'; END IF;
 r:=public.get_comparison_kpis_v1(f||'{"client_codes":[]}');
 IF (r#>>'{kpis,current,fat}')::numeric<>0 OR (r#>>'{kpis,current,ticket}')::numeric<>0 THEN RAISE EXCEPTION 'Carteira vazia'; END IF;
 r:=public.get_comparison_kpis_v1(f||'{"tendency":true}'); factor:=(r->>'tendency_ratio')::numeric;
 IF factor<>22 OR abs((r#>>'{kpis,current,fat}')::numeric-72.8*factor)>0.000001
   OR (r#>>'{kpis,current,clients}')::numeric<>44 OR (r#>>'{kpis,current,mixPepsico}')::numeric<>3 THEN RAISE EXCEPTION 'Tendência'; END IF;
 r:=public.get_comparison_kpis_v1(f||'{"tendency":true,"holidays":["2026-10-01"]}');
 IF (r->>'tendency_ratio')::numeric<>21 THEN RAISE EXCEPTION 'Feriado'; END IF;
END $$;
RESET ROLE;
SELECT '11 cenários determinísticos: OK; fixtures serão revertidas' result;
ROLLBACK;
