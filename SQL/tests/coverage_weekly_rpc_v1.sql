-- Fixtures isoladas: nenhuma alteração persiste.
BEGIN;
INSERT INTO public.dim_vendedores(codigo,nome) VALUES('__cw_s1','VENDEDOR TESTE'),('__cw_s2','OUTRO TESTE');
INSERT INTO public.dim_supervisores(codigo,nome) VALUES('__cw_sup','SUPERVISOR TESTE');
INSERT INTO public.data_hierarchy(cod_coord,nome_coord,cod_cocoord,nome_cocoord,cod_promotor,nome_promotor) VALUES('__cw_coord','COORD TESTE','__cw_co','CO TESTE','__cw_prom','PROM TESTE');
INSERT INTO public.data_clients(codigo_cliente,rca1,cidade,ramo) VALUES('__cw_a','__cw_s1','__cw_city','N/A'),('__cw_b','__cw_s1','__cw_city','REDE TESTE'),('__cw_c','__cw_s2','__cw_city','N/A');
INSERT INTO public.data_client_promoters(client_code,promoter_code) VALUES('__cw_a','__cw_prom'),('__cw_b','__cw_prom');
INSERT INTO public.dim_produtos(codigo,descricao,qtde_master) VALUES('__cw_p1','CHEETOS TESTE',10),('__cw_p2','TODDYNHO TESTE',5),('__cw_p3','PRODUTO NOVO TESTE',1);
INSERT INTO public.data_stock(product_code,filial,stock_qty) VALUES('__cw_p1','05',30),('__cw_p1','08',20),('__cw_p2','05',10),('__cw_p3','05',3);
INSERT INTO public.data_detailed(codcli,codusur,codsupervisor,produto,codfor,filial,tipovenda,dtped,vlvenda,vlbonific,qtvenda) VALUES
('__cw_a','__cw_s1','__cw_sup','__cw_p1','707','05','1','2026-10-01',20,0,10),
('__cw_a','__cw_s1','__cw_sup','__cw_p1','707','05','9','2026-10-02',-5,0,-2),
('__cw_b','__cw_s1','__cw_sup','__cw_p1','707','08','1','2026-10-02',0.8,0,5),
('__cw_b','__cw_s1','__cw_sup','__cw_p2','1119','05','5','2026-10-02',0,5,5),
('__cw_a','__cw_s1','__cw_sup','__cw_p3','707','05','1','2026-10-02',3,0,3),
('__cw_c','__cw_s2','__cw_sup','__cw_p1','707','08','1','2026-10-02',100,0,20);
INSERT INTO public.data_history(codcli,codusur,codsupervisor,produto,codfor,filial,tipovenda,dtped,vlvenda,vlbonific,qtvenda) VALUES
('__cw_a','__cw_s1','__cw_sup','__cw_p1','707','05','1','2026-09-01',10,0,10),
('__cw_b','__cw_s1','__cw_sup','__cw_p1','707','08','1','2026-09-02',20,0,20),
('__cw_a','__cw_s1','__cw_sup','__cw_p1','707','05','1','2026-09-30',40,0,30),
('__cw_a','__cw_s1','__cw_sup','__cw_p1','707','05','1','2026-08-31',7,0,10),
('__cw_a','__cw_s1','__cw_sup','__cw_p1','707','05','1','2026-03-31',5,0,10),
('__cw_a','__cw_s1','__cw_sup','__cw_p1','707','05','1','2026-02-28',6,0,20);
DO $$ BEGIN PERFORM set_config('request.jwt.claim.sub',(SELECT id::text FROM public.profiles WHERE role='adm' LIMIT 1),true); END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE f jsonb:='{"mode":"promoter","promotors":["__cw_prom"]}'; r jsonb; t jsonb; w jsonb;
BEGIN
 r:=public.get_coverage_page_v1(f);
 IF (r->>'active_clients')::int<>2 OR (r->>'active_3m')::int<>2 OR (r->>'current_clients')::int<>1 OR (r->>'previous_clients')::int<>2 THEN RAISE EXCEPTION 'Cobertura base: %',r; END IF;
 IF abs((r->>'total_boxes')::numeric-5.3)>0.000001 THEN RAISE EXCEPTION 'Caixas/devolução: %',r; END IF;
 SELECT value INTO t FROM jsonb_array_elements(r->'rows') WHERE value->>'code'='__cw_p1';
 IF (t->>'clientsCurrentCount')::int<>1 OR (t->>'clientsPreviousCount')::int<>2 OR (t->>'stockQty')::numeric<>50 OR abs((t->>'boxesSoldCurrentMonth')::numeric-1.3)>0.000001 OR (t->>'boxesSoldPreviousMonth')::numeric<>6 OR (t->>'pdvVariation')::numeric<>-50 OR (t->>'coverageCurrent')::numeric<>50 THEN RAISE EXCEPTION 'Produto: %',t; END IF;
 r:=public.get_coverage_page_v1(f||'{"types":["5"]}');
 IF (r->>'current_clients')::int<>1 OR (r->>'previous_clients')::int<>0 OR (r->>'total_boxes')::numeric<>1 THEN RAISE EXCEPTION 'Modo alternativo'; END IF;
 r:=public.get_coverage_page_v1(f||'{"types":["1","5"]}');
 IF (r->>'current_clients')::int<>1 OR abs((r->>'chart_total')::numeric-5.5)>0.000001 THEN RAISE EXCEPTION 'Modo misto'; END IF;
 r:=public.get_coverage_page_v1(f||'{"suppliers":["1119_TODDYNHO"],"types":["5"],"metric":"revenue"}');
 IF (r->>'chart_total')::numeric<>5 OR jsonb_array_length(r->'rows')<>1 THEN RAISE EXCEPTION 'Fornecedor virtual'; END IF;
 r:=public.get_coverage_page_v1(f||'{"date_start":"2026-10-01","date_end":"2026-10-02","products":["__cw_p1"]}');
 SELECT value INTO t FROM jsonb_array_elements(r->'rows') WHERE value->>'code'='__cw_p1';
 IF (t->>'boxesSoldPreviousMonth')::numeric<>3 THEN RAISE EXCEPTION 'Datas proporcionais: %',t; END IF;
 r:=public.get_coverage_page_v1(f||'{"date_start":"2026-09-30","date_end":"2026-09-30","products":["__cw_p1"]}');
 SELECT value INTO t FROM jsonb_array_elements(r->'rows') WHERE value->>'code'='__cw_p1';
 IF (t->>'boxesSoldCurrentMonth')::numeric<>3 OR (t->>'boxesSoldPreviousMonth')::numeric<>0 THEN RAISE EXCEPTION 'Dia 30 anterior'; END IF;
 r:=public.get_coverage_page_v1(f||'{"date_start":"2026-03-31","date_end":"2026-03-31","products":["__cw_p1"]}');
 SELECT value INTO t FROM jsonb_array_elements(r->'rows') WHERE value->>'code'='__cw_p1';
 IF (t->>'boxesSoldCurrentMonth')::numeric<>1 OR (t->>'boxesSoldPreviousMonth')::numeric<>2 THEN RAISE EXCEPTION '31 março / 28 fevereiro'; END IF;
 r:=public.get_coverage_page_v1(f||'{"date_start":"2026-09-01","date_end":"2026-10-02","products":["__cw_p1"]}');
 SELECT value INTO t FROM jsonb_array_elements(r->'rows') WHERE value->>'code'='__cw_p1';
 IF abs((t->>'boxesSoldCurrentMonth')::numeric-7.3)>0.000001 OR (t->>'boxesSoldPreviousMonth')::numeric<>4 THEN RAISE EXCEPTION 'Períodos sobrepostos'; END IF;
 r:=public.get_coverage_page_v1(f||'{"products":["__cw_p3"]}');
 IF (r#>>'{rows,0,trendDays}')::numeric<>2 THEN RAISE EXCEPTION 'Dias úteis desde início do mês'; END IF;
 r:=public.get_coverage_page_v1(f||'{"price_min":2,"products":["__cw_p1"]}');
 IF (r->>'total_boxes')::numeric<>0.8 THEN RAISE EXCEPTION 'Preço/devolução: %',r; END IF;
 r:=public.get_coverage_page_v1(f||'{"products":["__cw_missing"]}');
 IF jsonb_array_length(r->'rows')<>0 OR (r->>'chart_total')::numeric<>0 OR (r->>'total_boxes')::numeric<>0 THEN RAISE EXCEPTION 'Sem dados'; END IF;
 w:=public.get_weekly_page_v1(f);
 IF abs((w#>>'{weeks,0,total}')::numeric-18.8)>0.000001 OR (w#>>'{weeks,0,days,4}')::numeric<>20 OR abs((w#>>'{weeks,0,days,5}')::numeric+1.2)>0.000001 OR (w#>>'{ranking_fat,0,pos}')::int<>2 THEN RAISE EXCEPTION 'Semanal atual: %',w; END IF;
 w:=public.get_weekly_page_v1(f||'{"filial":"05","rede_group":"sem_rede"}');
 IF (w#>>'{best_days,3}')::numeric<>40 OR (w#>>'{best_days,2}')::numeric<>10 OR (w#>>'{weeks,0,total}')::numeric<>18 THEN RAISE EXCEPTION 'Filtros aplicados ao histórico: %',w; END IF;
 w:=public.get_weekly_page_v1(f||'{"month":"2026-09"}');
 IF (w#>>'{weeks,0,total}')::numeric<>30 OR (w#>>'{ranking_fat,0,val}')::numeric<>70 OR (w#>>'{best_days,1}')::numeric<>7 THEN RAISE EXCEPTION 'Semanal mês anterior: %',w; END IF;
 w:=public.get_weekly_page_v1(f||'{"month":"2026-08"}');
 IF (w#>>'{weeks,0,start}')::date<>'2026-08-03'::date OR jsonb_array_length(w->'weeks')<>5 THEN RAISE EXCEPTION 'Fim de semana inicial'; END IF;
 r:=public.get_dashboard_filters_v1('weekly',f);
 IF NOT(r->'months' ? '2026-10') OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'promotors') x WHERE x->>'code'='__cw_prom') THEN RAISE EXCEPTION 'Opções RPC'; END IF;
END $$;
RESET ROLE;
-- Trocar somente perfil dentro desta transação e testar carteira contra seleção forjada.
UPDATE public.profiles SET role='__cw_prom',status='aprovado' WHERE id=auth.uid();
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r:=public.get_coverage_page_v1('{}');
 IF (r->>'active_clients')::int<>2 THEN RAISE EXCEPTION 'Escopo promotor'; END IF;
 r:=public.get_weekly_page_v1('{"mode":"seller","sellers":["__cw_s2"]}');
 IF jsonb_array_length(r->'ranking_fat')<>0 THEN RAISE EXCEPTION 'Carteira forjada'; END IF;
 r:=public.get_dashboard_filters_v1('coverage');
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(r->'sellers') x WHERE x->>'code'='__cw_s2') THEN RAISE EXCEPTION 'Filtro vazou vendedor'; END IF;
END $$;
RESET ROLE;
UPDATE public.profiles SET role='__cw_s1' WHERE id=auth.uid();
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r:=public.get_coverage_page_v1('{"mode":"seller"}');
 IF (r->>'active_clients')::int<>2 THEN RAISE EXCEPTION 'Carteira vendedor'; END IF;
 r:=public.get_weekly_page_v1('{"mode":"seller","sellers":["__cw_s2"]}');
 IF jsonb_array_length(r->'ranking_fat')<>0 THEN RAISE EXCEPTION 'Vendedor fora da carteira'; END IF;
END $$;
RESET ROLE;
UPDATE public.profiles SET role='__cw_sup' WHERE id=auth.uid();
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r:=public.get_coverage_page_v1('{"mode":"seller"}');
 IF (r->>'active_clients')::int<>3 THEN RAISE EXCEPTION 'Carteira supervisor'; END IF;
 r:=public.get_weekly_page_v1('{"mode":"seller"}');
 IF abs((r#>>'{weeks,0,total}')::numeric-118.8)>0.000001 THEN RAISE EXCEPTION 'Supervisor semanal'; END IF;
END $$;
RESET ROLE;
UPDATE public.profiles SET status='pendente' WHERE id=auth.uid();
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.get_coverage_page_v1('{}'); RAISE EXCEPTION 'Aceitou perfil pendente'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.get_weekly_page_v1('{}'); RAISE EXCEPTION 'Aceitou sessão vazia'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF has_function_privilege('anon','public.get_weekly_page_v1(jsonb)','EXECUTE') OR has_function_privilege('anon','public.get_coverage_page_v1(jsonb)','EXECUTE') OR has_function_privilege('anon','public.get_dashboard_filters_v1(text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Acesso anon'; END IF;
END $$;
RESET ROLE;
SELECT '17 cenários de cálculo + opções, carteiras de promotor/vendedor/supervisor e permissões: OK' result;
ROLLBACK;
