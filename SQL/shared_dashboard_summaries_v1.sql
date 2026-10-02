-- Resumos compartilhados recuperados das migrações aplicadas em produção.
-- Aplicar após coverage_weekly_rpc_v1.sql e comparison_kpis_v1.sql.

-- Migration 20261002225841 shared_dashboard_sales_summaries_v1
-- Resumos privados: nenhuma mudança nas tabelas originais ou nos downloads legados.
CREATE TABLE IF NOT EXISTS dashboard_private.summary_state (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), dirty boolean NOT NULL DEFAULT true,
 generation bigint NOT NULL DEFAULT 0, refreshed_at timestamptz, last_change timestamptz NOT NULL DEFAULT clock_timestamp());
INSERT INTO dashboard_private.summary_state(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS dashboard_private.sales_day (
 source text NOT NULL, codcli text, produto text, codfor text, filial text, tipovenda text,
 codusur text,codsupervisor text,day date,unit_price numeric,virtual_supplier text,observacaofor text,
 vlvenda numeric NOT NULL,vlbonific numeric NOT NULL,qtvenda numeric NOT NULL,boxes numeric NOT NULL,totpesoliq numeric NOT NULL,
 row_count bigint NOT NULL);
CREATE TABLE IF NOT EXISTS dashboard_private.sales_month (LIKE dashboard_private.sales_day INCLUDING ALL);
CREATE TABLE IF NOT EXISTS dashboard_private.weekly_day (
 source text NOT NULL,codcli text,codfor text,filial text,codusur text,codsupervisor text,
 day date,virtual_supplier text,vlvenda numeric NOT NULL);
CREATE TABLE IF NOT EXISTS dashboard_private.sales_facets (
 source text NOT NULL,codcli text,produto text,codfor text,filial text,tipovenda text,day date);
CREATE TABLE IF NOT EXISTS dashboard_private.sales_calendar (source text NOT NULL,codcli text,day date);
CREATE TABLE IF NOT EXISTS dashboard_private.client_assignments (
 client text PRIMARY KEY,seller text,supervisor text,supervisor_name text,filial text);
CREATE INDEX IF NOT EXISTS sales_day_client_date ON dashboard_private.sales_day(codcli,day);
CREATE INDEX IF NOT EXISTS sales_day_supplier_date ON dashboard_private.sales_day(codfor,day);
CREATE INDEX IF NOT EXISTS sales_day_product_date ON dashboard_private.sales_day(produto,day);
CREATE INDEX IF NOT EXISTS sales_month_client ON dashboard_private.sales_month(codcli,source);
CREATE INDEX IF NOT EXISTS sales_month_supplier ON dashboard_private.sales_month(codfor,source);
CREATE INDEX IF NOT EXISTS sales_month_product ON dashboard_private.sales_month(produto,source);
CREATE INDEX IF NOT EXISTS weekly_day_client_date ON dashboard_private.weekly_day(codcli,day);
CREATE INDEX IF NOT EXISTS weekly_day_supplier_date ON dashboard_private.weekly_day(codfor,day);
CREATE INDEX IF NOT EXISTS facets_client ON dashboard_private.sales_facets(codcli);
CREATE INDEX IF NOT EXISTS facets_supplier ON dashboard_private.sales_facets(codfor);
CREATE INDEX IF NOT EXISTS calendar_date ON dashboard_private.sales_calendar(source,day DESC);
CREATE INDEX IF NOT EXISTS calendar_client ON dashboard_private.sales_calendar(codcli,day);

-- Same approved-reader policy as the underlying tables; API endpoints still derive the wallet.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['summary_state','sales_day','sales_month','weekly_day','sales_facets','sales_calendar','client_assignments'] LOOP
  EXECUTE format('ALTER TABLE dashboard_private.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON dashboard_private.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT SELECT ON dashboard_private.%I TO authenticated',t);
  EXECUTE format('DROP POLICY IF EXISTS summary_read ON dashboard_private.%I',t);
  EXECUTE format('CREATE POLICY summary_read ON dashboard_private.%I FOR SELECT TO authenticated USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()))',t);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION dashboard_private.assignments_source_v1(s jsonb)
RETURNS TABLE(client text,seller text,supervisor text,supervisor_name text,filial text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 raw AS MATERIALIZED(
 SELECT 'current'::text source,codcli,coalesce(nullif(c.rca,''),codusur) seller,codsupervisor,filial,dtped FROM public.data_detailed d LEFT JOIN clients c ON c.code=d.codcli
 WHERE s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))
 UNION ALL SELECT 'history',codcli,coalesce(nullif(c.rca,''),codusur),codsupervisor,filial,dtped FROM public.data_history d LEFT JOIN clients c ON c.code=d.codcli
 WHERE s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients'))),
 branch AS MATERIALIZED(SELECT DISTINCT ON(codcli) codcli,seller,filial,codsupervisor,dtped,source FROM raw ORDER BY codcli,source,dtped DESC NULLS LAST,filial),
 sup AS(SELECT DISTINCT ON(seller) seller,codsupervisor FROM branch ORDER BY seller,dtped DESC NULLS LAST,source,codsupervisor)
 SELECT coalesce(c.code,b.codcli),coalesce(nullif(c.rca,''),b.seller),sup.codsupervisor,coalesce(ds.nome,sup.codsupervisor,'N/A'),b.filial
 FROM clients c FULL JOIN branch b ON b.codcli=c.code LEFT JOIN sup ON sup.seller=coalesce(nullif(c.rca,''),b.seller)
 LEFT JOIN public.dim_supervisores ds ON ds.codigo=sup.codsupervisor;
$$;

-- Privileged writer lives outside the exposed schema and checks its caller.
CREATE OR REPLACE FUNCTION dashboard_private.refresh_summaries_v1(force_refresh boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' SET jit='off' SET work_mem='32MB' AS $$
DECLARE st dashboard_private.summary_state; result jsonb;
BEGIN
 IF NOT ((auth.uid() IS NOT NULL AND public.is_admin()) OR (auth.uid() IS NULL AND session_user IN('postgres','supabase_admin'))) THEN
  RAISE EXCEPTION 'Atualização reservada ao administrador' USING ERRCODE='42501';
 END IF;
 IF NOT pg_try_advisory_xact_lock(70261002,1) THEN RETURN jsonb_build_object('status','busy'); END IF;
 SELECT * INTO st FROM dashboard_private.summary_state WHERE id=true FOR UPDATE;
 IF NOT force_refresh AND NOT st.dirty THEN RETURN jsonb_build_object('status','current','generation',st.generation); END IF;
 -- The state row lock serializes committed source changes with this consistent rebuild.
 -- DELETE/INSERT is atomic under MVCC: concurrent readers keep the previous complete generation.
 DELETE FROM dashboard_private.sales_day;
 INSERT INTO dashboard_private.sales_day
 WITH raw AS MATERIALIZED(
  SELECT 'current'::text source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,
   (dtped AT TIME ZONE 'UTC')::date AS day,coalesce(vlvenda,0) amount,coalesce(vlbonific,0) bonus,coalesce(qtvenda,0) units,coalesce(totpesoliq,0) peso,observacaofor FROM public.data_detailed
  UNION ALL SELECT 'history',codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,
   (dtped AT TIME ZONE 'UTC')::date,coalesce(vlvenda,0),coalesce(vlbonific,0),coalesce(qtvenda,0),coalesce(totpesoliq,0),observacaofor FROM public.data_history),
 enriched AS(SELECT r.*,CASE WHEN units<>0 THEN amount/units END unit_price,
  units/CASE WHEN p.qtde_master>0 THEN p.qtde_master ELSE 1 END boxes,
  CASE WHEN r.codfor='1119' THEN CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END virtual_supplier
  FROM raw r LEFT JOIN public.dim_produtos p ON p.codigo=r.produto)
 SELECT source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,day,unit_price,virtual_supplier,observacaofor,
 sum(amount),sum(bonus),sum(units),sum(boxes),sum(peso),count(*) FROM enriched
 GROUP BY source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,day,unit_price,virtual_supplier,observacaofor;
 DELETE FROM dashboard_private.sales_month;
 INSERT INTO dashboard_private.sales_month
 SELECT source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,date_trunc('month',day)::date,unit_price,virtual_supplier,observacaofor,
 sum(vlvenda),sum(vlbonific),sum(qtvenda),sum(boxes),sum(totpesoliq),sum(row_count)
 FROM dashboard_private.sales_day GROUP BY source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,date_trunc('month',day)::date,unit_price,virtual_supplier,observacaofor;
 DELETE FROM dashboard_private.weekly_day;
 INSERT INTO dashboard_private.weekly_day SELECT source,codcli,codfor,filial,codusur,codsupervisor,day,virtual_supplier,sum(vlvenda)
 FROM dashboard_private.sales_day GROUP BY source,codcli,codfor,filial,codusur,codsupervisor,day,virtual_supplier;
 DELETE FROM dashboard_private.sales_facets;
 INSERT INTO dashboard_private.sales_facets SELECT source,codcli,produto,codfor,filial,tipovenda,max(day)
 FROM dashboard_private.sales_day GROUP BY source,codcli,produto,codfor,filial,tipovenda,date_trunc('month',day);
 DELETE FROM dashboard_private.sales_calendar;
 INSERT INTO dashboard_private.sales_calendar SELECT DISTINCT source,codcli,day FROM dashboard_private.sales_day;
 DELETE FROM dashboard_private.client_assignments;
 INSERT INTO dashboard_private.client_assignments SELECT * FROM dashboard_private.assignments_source_v1('{"kind":"admin"}');
 ANALYZE dashboard_private.sales_day; ANALYZE dashboard_private.sales_month; ANALYZE dashboard_private.weekly_day;
 ANALYZE dashboard_private.sales_facets; ANALYZE dashboard_private.sales_calendar; ANALYZE dashboard_private.client_assignments;
 UPDATE dashboard_private.summary_state SET dirty=false,generation=generation+1,refreshed_at=clock_timestamp() WHERE id=true RETURNING
  jsonb_build_object('status','refreshed','generation',generation,'refreshed_at',refreshed_at) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION dashboard_private.assignments_source_v1(jsonb),dashboard_private.refresh_summaries_v1(boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION dashboard_private.refresh_summaries_v1(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.refresh_dashboard_summaries_v1()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' SET statement_timeout='60s' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Atualização reservada ao administrador' USING ERRCODE='42501'; END IF;
 RETURN dashboard_private.refresh_summaries_v1(true);
END $$;
REVOKE ALL ON FUNCTION public.refresh_dashboard_summaries_v1() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.refresh_dashboard_summaries_v1() TO authenticated;

CREATE OR REPLACE FUNCTION dashboard_private.queue_summaries_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_SCHEMA<>'public' OR TG_TABLE_NAME NOT IN('data_detailed','data_history','data_clients','data_client_promoters','data_hierarchy','dim_produtos','dim_vendedores','dim_supervisores','data_product_details') THEN
  RAISE EXCEPTION 'Origem de atualização inválida';
 END IF;
 IF NOT ((auth.uid() IS NOT NULL AND public.is_admin()) OR (auth.uid() IS NULL AND session_user IN('postgres','supabase_admin'))) THEN
  RAISE EXCEPTION 'Atualização reservada ao administrador' USING ERRCODE='42501';
 END IF;
 UPDATE dashboard_private.summary_state SET dirty=true,last_change=clock_timestamp() WHERE id=true;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION dashboard_private.queue_summaries_v1() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['data_detailed','data_history','data_clients','data_client_promoters','data_hierarchy','dim_produtos','dim_vendedores','dim_supervisores','data_product_details'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS dashboard_summary_dirty ON public.%I',t);
  EXECUTE format('CREATE TRIGGER dashboard_summary_dirty AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION dashboard_private.queue_summaries_v1()',t);
 END LOOP;
END $$;
-- One minute safety net for integrations that don't explicitly finish an import.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='dashboard-page-summaries-v1') THEN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='dashboard-page-summaries-v1';
 END IF;
 PERFORM cron.schedule('dashboard-page-summaries-v1','* * * * *','SELECT dashboard_private.refresh_summaries_v1(false)');
END $$;
SELECT dashboard_private.refresh_summaries_v1(true);

CREATE OR REPLACE FUNCTION dashboard_private.assignments_v1(s jsonb)
RETURNS TABLE(client text,seller text,supervisor text,supervisor_name text,filial text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT a.* FROM dashboard_private.client_assignments a WHERE s->>'kind'='admin'
 OR a.client IN(SELECT jsonb_array_elements_text(s->'clients')) OR a.client IN(SELECT jsonb_array_elements_text(s->'ghosts'));
$$;
GRANT EXECUTE ON FUNCTION dashboard_private.assignments_v1(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION dashboard_private.assignments_v1(jsonb) FROM PUBLIC,anon;


-- Migration 20261002230230 coverage_weekly_filters_use_shared_summaries
-- Cobertura e Semanal: dados, cálculos e opções de filtros no PostgreSQL.
-- Helpers ficam fora do schema exposto pela API; todos preservam RLS.
CREATE SCHEMA IF NOT EXISTS dashboard_private;
REVOKE ALL ON SCHEMA dashboard_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA dashboard_private TO authenticated;

CREATE OR REPLACE FUNCTION dashboard_private.scope_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $$
DECLARE r text; kind text; sellers text[]; clients text[]; ghosts text[];
BEGIN
 IF auth.uid() IS NULL OR NOT(public.is_admin() OR public.is_approved()) THEN
  RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE='42501';
 END IF;
 SELECT lower(btrim(role)) INTO r FROM public.profiles WHERE id=auth.uid();
 IF r='adm' THEN RETURN jsonb_build_object('kind','admin'); END IF;
 -- Trade: carteira atribuída, inclusive coordenadores com carteira vazia.
 IF EXISTS(SELECT 1 FROM public.data_hierarchy h WHERE r IN(lower(btrim(h.cod_coord)),lower(btrim(h.cod_cocoord)),lower(btrim(h.cod_promotor))))
 OR EXISTS(SELECT 1 FROM public.data_client_promoters WHERE lower(btrim(promoter_code))=r) THEN
  kind:='trade';
  SELECT array_agg(cp.client_code) INTO clients FROM public.data_client_promoters cp
  WHERE lower(btrim(cp.promoter_code))=r OR EXISTS(SELECT 1 FROM public.data_hierarchy h
   WHERE lower(btrim(h.cod_promotor))=lower(btrim(cp.promoter_code)) AND r IN(lower(btrim(h.cod_coord)),lower(btrim(h.cod_cocoord)),lower(btrim(h.cod_promotor))));
 ELSE
  SELECT array_agg(DISTINCT codusur) INTO sellers FROM (
   SELECT codusur FROM public.data_detailed WHERE lower(btrim(codsupervisor))=r
   UNION ALL SELECT codusur FROM public.data_history WHERE lower(btrim(codsupervisor))=r) s;
  kind:=CASE WHEN sellers IS NULL THEN 'seller' ELSE 'supervisor' END;
  SELECT array_agg(codigo_cliente) INTO clients FROM public.data_clients
  WHERE (kind='seller' AND lower(btrim(rca1))=r) OR (kind='supervisor' AND rca1=ANY(sellers))
   OR (r='1001' AND upper(coalesce(razaosocial,nomecliente,'')) LIKE '%AMERICANAS%');
  -- Mesmo complemento da carteira legado: clientes com venda atual do vendedor/supervisor.
  SELECT array_agg(DISTINCT codcli) INTO ghosts FROM public.data_detailed
  WHERE (kind='seller' AND lower(btrim(codusur))=r) OR (kind='supervisor' AND lower(btrim(codsupervisor))=r);
 END IF;
 RETURN jsonb_build_object('kind',kind,'clients',coalesce(clients,ARRAY[]::text[]),'ghosts',coalesce(ghosts,ARRAY[]::text[]));
END $$;

CREATE OR REPLACE FUNCTION dashboard_private.clients_v1(s jsonb)
RETURNS TABLE(code text,rca text,city text,rede text,coord text,coord_name text,cocoord text,cocoord_name text,promotor text,promotor_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT c.codigo_cliente,CASE WHEN upper(coalesce(c.razaosocial,c.nomecliente,'')) LIKE '%AMERICANAS%' THEN '1001' ELSE c.rca1 END,
 coalesce(nullif(c.cidade,''),'N/A'),coalesce(nullif(c.ramo,''),'N/A'),h.cod_coord,h.nome_coord,h.cod_cocoord,h.nome_cocoord,cp.promoter_code,coalesce(h.nome_promotor,cp.promoter_code)
 FROM public.data_clients c
 LEFT JOIN public.data_client_promoters cp ON cp.client_code=c.codigo_cliente
 LEFT JOIN LATERAL (SELECT * FROM public.data_hierarchy h WHERE lower(btrim(h.cod_promotor))=lower(btrim(cp.promoter_code)) ORDER BY h.id LIMIT 1) h ON true
 WHERE s->>'kind'='admin' OR c.codigo_cliente IN(SELECT jsonb_array_elements_text(s->'clients'))
 OR c.codigo_cliente IN(SELECT jsonb_array_elements_text(s->'ghosts'));
$$;

CREATE OR REPLACE FUNCTION dashboard_private.matches_v1(f jsonb,k text,v text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(jsonb_array_length(f->k),0)=0 OR coalesce(f->k ? v,false);
$$;
CREATE OR REPLACE FUNCTION dashboard_private.rede_v1(f jsonb,v text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(v,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? v,false))
 WHEN 'sem_rede' THEN coalesce(v,'N/A') IN('','N/A') ELSE true END;
$$;

CREATE OR REPLACE FUNCTION dashboard_private.assignments_v1(s jsonb)
RETURNS TABLE(client text,seller text,supervisor text,supervisor_name text,filial text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 raw AS MATERIALIZED(
 SELECT 'current'::text source,codcli,coalesce(nullif(c.rca,''),codusur) seller,codsupervisor,filial,dtped FROM public.data_detailed d LEFT JOIN clients c ON c.code=d.codcli
 WHERE s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))
 UNION ALL SELECT 'history',codcli,coalesce(nullif(c.rca,''),codusur),codsupervisor,filial,dtped FROM public.data_history d LEFT JOIN clients c ON c.code=d.codcli
 WHERE s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients'))),
 branch AS MATERIALIZED(SELECT DISTINCT ON(codcli) codcli,seller,filial,codsupervisor,dtped,source FROM raw ORDER BY codcli,source,dtped DESC NULLS LAST,filial),
 sup AS(SELECT DISTINCT ON(seller) seller,codsupervisor FROM branch ORDER BY seller,dtped DESC NULLS LAST,source,codsupervisor)
 SELECT coalesce(c.code,b.codcli),coalesce(nullif(c.rca,''),b.seller),sup.codsupervisor,coalesce(ds.nome,sup.codsupervisor,'N/A'),b.filial
 FROM clients c FULL JOIN branch b ON b.codcli=c.code LEFT JOIN sup ON sup.seller=coalesce(nullif(c.rca,''),b.seller)
 LEFT JOIN public.dim_supervisores ds ON ds.codigo=sup.codsupervisor;
$$;

CREATE OR REPLACE FUNCTION dashboard_private.rows_v1(s jsonb,f jsonb DEFAULT '{}'::jsonb,purpose text DEFAULT 'all')
RETURNS TABLE(source text,client text,product text,supplier text,virtual_supplier text,seller text,seller_name text,supervisor text,supervisor_name text,filial text,sale_type text,day date,amount numeric,bonus numeric,units numeric,boxes numeric,description text,registered date,city text,rede text,coord text,coord_name text,cocoord text,cocoord_name text,promotor text,promotor_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 products AS MATERIALIZED(SELECT * FROM public.dim_produtos), details AS MATERIALIZED(SELECT * FROM public.data_product_details),
 vendors AS MATERIALIZED(SELECT * FROM public.dim_vendedores), supervisors AS MATERIALIZED(SELECT * FROM public.dim_supervisores), raw AS MATERIALIZED(
 SELECT 'current'::text source,d.codcli,d.produto,d.codfor,d.codusur,d.codsupervisor,d.filial,d.tipovenda,(d.dtped AT TIME ZONE 'UTC')::date AS day,coalesce(d.vlvenda,0) amount,coalesce(d.vlbonific,0) bonus,coalesce(d.qtvenda,0) units
 FROM public.data_detailed d LEFT JOIN clients c ON c.code=d.codcli WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR d.codcli IN(SELECT jsonb_array_elements_text(s->'ghosts')))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false)))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)))
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR (d.codfor='1119' AND EXISTS(SELECT 1 FROM products p WHERE p.codigo=d.produto AND coalesce(f->'suppliers' ? (CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END),false))))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? coalesce(nullif(c.rca,''),d.codusur),false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (purpose<>'weekly' OR coalesce(f->>'month','current')='current')
 UNION ALL
 SELECT 'history',d.codcli,d.produto,d.codfor,d.codusur,d.codsupervisor,d.filial,d.tipovenda,(d.dtped AT TIME ZONE 'UTC')::date,coalesce(d.vlvenda,0),coalesce(d.vlbonific,0),coalesce(d.qtvenda,0)
 FROM public.data_history d LEFT JOIN clients c ON c.code=d.codcli WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false)))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)))
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR (d.codfor='1119' AND EXISTS(SELECT 1 FROM products p WHERE p.codigo=d.produto AND coalesce(f->'suppliers' ? (CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END),false))))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? coalesce(nullif(c.rca,''),d.codusur),false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (purpose<>'weekly' OR ((d.dtped AT TIME ZONE 'UTC')::date >= (CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',(SELECT max(dtped) FROM public.data_detailed) AT TIME ZONE 'UTC')::date ELSE ((f->>'month')||'-01')::date END)-interval '1 month' AND (d.dtped AT TIME ZONE 'UTC')::date < (CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',(SELECT max(dtped) FROM public.data_detailed) AT TIME ZONE 'UTC')::date ELSE ((f->>'month')||'-01')::date+interval '1 month' END)))
 ), assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s))
 SELECT r.source,r.codcli,r.produto,r.codfor,CASE WHEN r.codfor='1119' THEN CASE
 WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY'
 WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END,
 coalesce(nullif(c.rca,''),r.codusur),coalesce(v.nome,coalesce(nullif(c.rca,''),r.codusur),'N/A'),
 coalesce(ss.supervisor,r.codsupervisor),coalesce(ds.nome,ss.supervisor,r.codsupervisor,'N/A'),r.filial,r.tipovenda,r.day,r.amount,r.bonus,r.units,
 r.units/CASE WHEN p.qtde_master>0 THEN p.qtde_master ELSE 1 END,
 coalesce(nullif(p.descricao,''),'Produto '||r.produto),(pd.dtcadastro AT TIME ZONE 'UTC')::date,
 coalesce(c.city,'N/A'),coalesce(c.rede,'N/A'),c.coord,c.coord_name,c.cocoord,c.cocoord_name,c.promotor,c.promotor_name
 FROM raw r LEFT JOIN clients c ON c.code=r.codcli
 LEFT JOIN products p ON p.codigo=r.produto
 LEFT JOIN details pd ON pd.code=r.produto
 LEFT JOIN assignments ss ON ss.client=r.codcli
 LEFT JOIN vendors v ON v.codigo=coalesce(nullif(c.rca,''),r.codusur)
 LEFT JOIN supervisors ds ON ds.codigo=coalesce(ss.supervisor,r.codsupervisor);
$$;

-- Page-local planner settings avoid JIT startup and merge joins caused by opaque helper cardinality.
-- Settings restore automatically on function exit; authorization/RLS remain unchanged.
-- As opções são pequenas projeções; nunca retornam linhas de vendas ao navegador.
CREATE OR REPLACE FUNCTION public.get_dashboard_filters_v1(p_page text,p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); result jsonb; f jsonb:=p_filters;
BEGIN
 IF p_page NOT IN('coverage','weekly') OR jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Página ou filtros inválidos' USING ERRCODE='22023'; END IF;
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 raw AS MATERIALIZED(SELECT * FROM dashboard_private.sales_facets WHERE s->>'kind'='admin'
 OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR (source='current' AND codcli IN(SELECT jsonb_array_elements_text(s->'ghosts')))),
 rows AS MATERIALIZED(SELECT r.source,r.day,r.filial,r.tipovenda sale_type,r.produto product,r.codfor supplier,
 coalesce(p.descricao,'Produto '||r.produto) description,
 CASE WHEN r.codfor='1119' THEN CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END virtual_supplier,
 a.seller,coalesce(v.nome,a.seller,'N/A') seller_name,a.supervisor_name,c.city,c.rede,c.coord,c.cocoord,c.promotor
 FROM raw r LEFT JOIN clients c ON c.code=r.codcli LEFT JOIN assignments a ON a.client=r.codcli
 LEFT JOIN public.dim_produtos p ON p.codigo=r.produto LEFT JOIN public.dim_vendedores v ON v.codigo=a.seller),
 scope AS MATERIALIZED(SELECT * FROM rows WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false)))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? seller,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? rede,false)) WHEN 'sem_rede' THEN coalesce(rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR filial=f->>'filial')
 AND (coalesce(f->>'city','')='' OR lower(city)=lower(f->>'city'))),
 supplier_options AS (SELECT DISTINCT supplier code,coalesce(df.nome,supplier) label FROM scope LEFT JOIN public.dim_fornecedores df ON df.codigo=scope.supplier
 UNION SELECT DISTINCT virtual_supplier,CASE virtual_supplier WHEN '1119_TODDYNHO' THEN 'TODDYNHO' WHEN '1119_TODDY' THEN 'TODDY' ELSE 'QUAKER / KEROCOCO' END FROM scope WHERE virtual_supplier IS NOT NULL),
 products AS (SELECT DISTINCT product code,'('||product||') '||description label FROM scope WHERE (coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? supplier,false)) OR coalesce(f->'suppliers' ? virtual_supplier,false)),
 sellers AS(SELECT DISTINCT seller code,seller_name label,supervisor_name supervisor FROM rows
 WHERE (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))),
 hierarchy AS(SELECT * FROM clients), months AS(SELECT DISTINCT to_char(day,'YYYY-MM') code FROM raw WHERE day IS NOT NULL)
 SELECT jsonb_build_object('schema_version',1,'reference_date',coalesce((SELECT max(day) FROM rows WHERE source='current'),(SELECT max(day) FROM rows),current_date),
 'suppliers',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM supplier_options t),'[]'),
 'products',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM products t),'[]'),
 'types',coalesce((SELECT jsonb_agg(jsonb_build_object('code',sale_type,'label',sale_type) ORDER BY sale_type) FROM (SELECT DISTINCT sale_type FROM scope WHERE sale_type IS NOT NULL)t),'[]'),
 'sellers',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM sellers t),'[]'),
 'supervisors',coalesce((SELECT jsonb_agg(jsonb_build_object('code',label,'label',label) ORDER BY label) FROM(SELECT DISTINCT supervisor_name label FROM rows)t),'[]'),
 'coords',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT coord code,coalesce(coord_name,coord) label FROM hierarchy WHERE coord IS NOT NULL)t),'[]'),
 'cocoords',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT cocoord code,coalesce(cocoord_name,cocoord) label FROM hierarchy WHERE cocoord IS NOT NULL AND (coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)))t),'[]'),
 'promotors',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT promotor code,coalesce(promotor_name,promotor) label FROM hierarchy WHERE promotor IS NOT NULL AND (coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)))t),'[]'),
 'cities',coalesce((SELECT jsonb_agg(city ORDER BY city) FROM(SELECT DISTINCT city FROM clients)t),'[]'),
 'redes',coalesce((SELECT jsonb_agg(jsonb_build_object('code',rede,'label',rede) ORDER BY rede) FROM(SELECT DISTINCT rede FROM clients WHERE rede NOT IN('','N/A'))t),'[]'),
 'months',coalesce((SELECT jsonb_agg(code ORDER BY code DESC) FROM months),'[]')) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.get_weekly_page_v1(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); f jsonb:=p_filters; ref date; target date; result jsonb;
BEGIN
 IF jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 SELECT coalesce(max(day) FILTER(WHERE source='current'),max(day),current_date) INTO ref FROM dashboard_private.sales_calendar;
 target:=CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',ref)::date ELSE ((f->>'month')||'-01')::date END;
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 rows AS MATERIALIZED(SELECT d.source,d.codcli client,d.day,d.vlvenda amount,d.codfor supplier,d.virtual_supplier,
 coalesce(nullif(c.rca,''),d.codusur) seller,coalesce(v.nome,coalesce(nullif(c.rca,''),d.codusur),'N/A') seller_name,
 coalesce(a.supervisor_name,ds.nome,d.codsupervisor,'N/A') supervisor_name,d.filial,coalesce(c.rede,'N/A') rede,
 c.coord,c.cocoord,c.promotor,c.promotor_name FROM dashboard_private.weekly_day d
 LEFT JOIN clients c ON c.code=d.codcli LEFT JOIN assignments a ON a.client=d.codcli
 LEFT JOIN public.dim_vendedores v ON v.codigo=coalesce(nullif(c.rca,''),d.codusur)
 LEFT JOIN public.dim_supervisores ds ON ds.codigo=d.codsupervisor
 WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR (d.source='current' AND d.codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))))
 AND ((coalesce(f->>'month','current')='current' AND d.source='current') OR (d.source='history' AND d.day>=target-interval '1 month' AND d.day<target+interval '1 month'))),
 filtered AS MATERIALIZED(SELECT * FROM rows WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false)))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? seller,false))
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? supplier,false)) OR coalesce(f->'suppliers' ? virtual_supplier,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? rede,false)) WHEN 'sem_rede' THEN coalesce(rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR filial=f->>'filial')),
 selected AS MATERIALIZED(SELECT * FROM filtered WHERE
 (coalesce(f->>'month','current')='current' AND source='current') OR (coalesce(f->>'month','current')<>'current' AND source='history' AND day>=target AND day<target+interval '1 month')),
 first_day AS(SELECT target+CASE extract(isodow FROM target)::int WHEN 6 THEN 2 WHEN 7 THEN 1 ELSE 0 END first),
 week_starts AS(SELECT first start FROM first_day UNION SELECT d::date FROM first_day,generate_series(date_trunc('week',first::timestamp)+interval '7 days',target::timestamp+interval '1 month - 1 day',interval '7 days') d),
 weeks AS(SELECT row_number() OVER(ORDER BY start) id,start,least((date_trunc('week',start::timestamp)+interval '6 days')::date,(target+interval '1 month - 1 day')::date) finish FROM week_starts),
 daily AS(SELECT w.id,extract(dow FROM s.day)::int weekday,sum(s.amount) amount FROM weeks w JOIN selected s ON s.day BETWEEN w.start AND w.finish GROUP BY 1,2),
 week_data AS(SELECT w.id,w.start,w.finish "end",coalesce((SELECT sum(amount) FROM daily d WHERE d.id=w.id),0) total,
 (SELECT jsonb_agg(coalesce(d.amount,0) ORDER BY wd) FROM generate_series(0,6) wd LEFT JOIN daily d ON d.id=w.id AND d.weekday=wd) days FROM weeks w),
 best_daily AS(SELECT day,sum(amount) amount FROM filtered WHERE source='history' AND day>=target-interval '1 month' AND day<target GROUP BY day),
 best AS(SELECT extract(dow FROM day)::int wd,greatest(max(amount),0) amount FROM best_daily GROUP BY 1),
 ranks AS(SELECT CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(promotor,'Sem Promotor') ELSE coalesce(seller,'N/A') END code,
 CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(promotor_name,'Sem Promotor') ELSE coalesce(seller_name,seller,'N/A') END name,
 sum(amount) val,count(DISTINCT client) pos FROM selected GROUP BY 1,2)
 SELECT jsonb_build_object('schema_version',1,'reference_date',ref,'target_month',to_char(target,'YYYY-MM'),
 'weeks',coalesce((SELECT jsonb_agg(to_jsonb(w) ORDER BY id) FROM week_data w),'[]'),
 'best_days',(SELECT jsonb_agg(coalesce(b.amount,0) ORDER BY wd) FROM generate_series(0,6) wd LEFT JOIN best b USING(wd)),
 'ranking_fat',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY val DESC,code) FROM(SELECT * FROM ranks ORDER BY val DESC,code LIMIT 10)t),'[]'),
 'ranking_pos',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY pos DESC,val DESC,code) FROM(SELECT * FROM ranks ORDER BY pos DESC,val DESC,code LIMIT 10)t),'[]')) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.get_coverage_page_v1(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); f jsonb:=p_filters; ref date; start_date date; end_date date; prev_start date; prev_end date;
 custom_date boolean; alt boolean; result jsonb; days integer:=greatest(coalesce((f->>'working_days')::int,0),0);
BEGIN
 IF jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 SELECT coalesce(max(day) FILTER(WHERE source='current'),max(day),current_date) INTO ref FROM dashboard_private.sales_calendar;
 custom_date:=nullif(f->>'date_start','') IS NOT NULL AND nullif(f->>'date_end','') IS NOT NULL;
 start_date:=CASE WHEN custom_date THEN (f->>'date_start')::date ELSE date_trunc('month',ref)::date END;
 end_date:=CASE WHEN custom_date THEN (f->>'date_end')::date ELSE (start_date+interval '1 month - 1 day')::date END;
 IF end_date<start_date THEN RAISE EXCEPTION 'Período inválido' USING ERRCODE='22023'; END IF;
 prev_start:=(start_date-interval '1 month')::date; prev_end:=(end_date-interval '1 month')::date;
 IF NOT custom_date THEN prev_end:=start_date-1; END IF;
 alt:=coalesce(jsonb_array_length(f->'types'),0)>0 AND NOT(coalesce(f->'types' ? '1',false) OR coalesce(f->'types' ? '9',false));
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 seller_sup AS(SELECT DISTINCT seller,supervisor_name FROM assignments),branches AS(SELECT client,filial FROM assignments),
 base_clients AS MATERIALIZED(SELECT c.* FROM clients c WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR EXISTS(SELECT 1 FROM seller_sup ss WHERE ss.seller=c.rca AND (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? ss.supervisor_name,false))) OR coalesce(jsonb_array_length(f->'supervisors'),0)=0)
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? c.rca,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (coalesce(f->>'filial','ambas') IN('ambas','all') OR EXISTS(SELECT 1 FROM branches b WHERE b.client=c.code AND b.filial=f->>'filial'))),
 scoped AS MATERIALIZED(SELECT d.source,d.codcli client,d.produto product,d.day,d.codusur seller,
 d.vlvenda amount,d.unit_price,d.boxes,CASE WHEN alt THEN d.vlbonific ELSE d.vlvenda END value
 FROM (SELECT * FROM dashboard_private.sales_month WHERE NOT custom_date
 UNION ALL SELECT * FROM dashboard_private.sales_day WHERE custom_date) d
 JOIN base_clients c ON c.code=d.codcli WHERE (coalesce(f->>'filial','ambas') IN('ambas','all') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR coalesce(f->'suppliers' ? d.virtual_supplier,false))
 AND (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false))
 AND (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false))),
 filtered AS NOT MATERIALIZED(SELECT * FROM scoped d WHERE ((f->>'price_min' IS NULL AND f->>'price_max' IS NULL) OR (d.unit_price IS NOT NULL
 AND (f->>'price_min' IS NULL OR d.unit_price>=(f->>'price_min')::numeric)
 AND (f->>'price_max' IS NULL OR d.unit_price<=(f->>'price_max')::numeric)))),
 periods AS MATERIALIZED(
 SELECT r.*,'current'::text period FROM filtered r WHERE (custom_date AND day BETWEEN start_date AND end_date) OR(NOT custom_date AND source='current')
 UNION ALL SELECT r.*,'previous' FROM filtered r WHERE (custom_date AND day BETWEEN prev_start AND prev_end) OR(NOT custom_date AND source='history' AND day BETWEEN prev_start AND prev_end)
 UNION ALL SELECT r.*,'history' FROM filtered r WHERE NOT custom_date AND source='history' AND day NOT BETWEEN prev_start AND prev_end),
 product_clients AS(SELECT product,client,period,sum(value) value FROM periods WHERE period IN('current','previous') GROUP BY 1,2,3),
 product_counts AS(SELECT product,count(*) FILTER(WHERE period='current' AND value>=1) current_count,count(*) FILTER(WHERE period='previous' AND value>=1) previous_count FROM product_clients GROUP BY product),
 selection AS(SELECT client,period,sum(value) value FROM periods WHERE period IN('current','previous') GROUP BY 1,2),
 active_history AS(SELECT client FROM scoped WHERE source='history' GROUP BY client HAVING sum(amount)>=1),
 working AS MATERIALIZED(SELECT DISTINCT day FROM dashboard_private.sales_calendar WHERE extract(isodow FROM day) BETWEEN 1 AND 5
 AND (s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR (source='current' AND codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))))),
 working_array AS(SELECT array_agg(day ORDER BY day) dates FROM working),
 stats_amounts AS(SELECT product,coalesce(sum(boxes) FILTER(WHERE period='current'),0) current_boxes,
 coalesce(sum(boxes) FILTER(WHERE period='previous'),0) previous_boxes,bool_or(day<date_trunc('month',ref)::date) has_history
 FROM periods GROUP BY product),
 stats AS MATERIALIZED(SELECT t.*,coalesce(nullif(p.descricao,''),'Produto '||t.product) description,(pd.dtcadastro AT TIME ZONE 'UTC')::date registered
 FROM stats_amounts t LEFT JOIN public.dim_produtos p ON p.codigo=t.product LEFT JOIN public.data_product_details pd ON pd.code=t.product),
 stock AS(SELECT product_code,sum(coalesce(stock_qty,0)) qty FROM public.data_stock WHERE coalesce(f->>'filial','ambas') IN('ambas','all') OR filial=f->>'filial' GROUP BY product_code),
 divisors AS MATERIALIZED(SELECT t.*,coalesce(st.qty,0) stock,coalesce(pc.current_count,0) current_count,coalesce(pc.previous_count,0) previous_count,
 greatest(1,CASE WHEN NOT coalesce(has_history,false) AND current_boxes>0 THEN least(
 greatest((SELECT count(*) FROM generate_series(date_trunc('month',ref)::date,ref,'1 day') d WHERE extract(isodow FROM d) BETWEEN 1 AND 5),1),
 CASE WHEN days>0 THEN days ELSE greatest((SELECT count(*) FROM generate_series(date_trunc('month',ref)::date,ref,'1 day') d WHERE extract(isodow FROM d) BETWEEN 1 AND 5),1) END)
 ELSE CASE WHEN days>0 THEN least(days,(SELECT count(*) FROM working WHERE registered IS NULL OR day>=registered)) ELSE (SELECT count(*) FROM working WHERE registered IS NULL OR day>=registered) END END)::numeric divisor
 FROM stats t LEFT JOIN stock st ON st.product_code=t.product LEFT JOIN product_counts pc USING(product)),
 -- Daily rows are read only for each product's required trend window, with original price buckets.
 trend_totals AS MATERIALIZED(SELECT dv.product,coalesce(sum(d.boxes*CASE WHEN custom_date THEN
 (CASE WHEN d.day BETWEEN start_date AND end_date THEN 1 ELSE 0 END+CASE WHEN d.day BETWEEN prev_start AND prev_end THEN 1 ELSE 0 END) ELSE 1 END),0)/dv.divisor daily_avg
 FROM divisors dv CROSS JOIN working_array w LEFT JOIN (dashboard_private.sales_day d JOIN base_clients c ON c.code=d.codcli)
 ON d.produto=dv.product AND d.day BETWEEN w.dates[greatest(1,cardinality(w.dates)-dv.divisor::int+1)] AND w.dates[cardinality(w.dates)]
 AND (coalesce(f->>'filial','ambas') IN('ambas','all') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR coalesce(f->'suppliers' ? d.virtual_supplier,false))
 AND (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false))
 AND (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)) AND ((f->>'price_min' IS NULL AND f->>'price_max' IS NULL) OR (d.unit_price IS NOT NULL
 AND (f->>'price_min' IS NULL OR d.unit_price>=(f->>'price_min')::numeric)
 AND (f->>'price_max' IS NULL OR d.unit_price<=(f->>'price_max')::numeric)))
 GROUP BY dv.product,dv.divisor),
 trend AS(SELECT d.*,t.daily_avg FROM divisors d JOIN trend_totals t USING(product)),
 table_all AS MATERIALIZED(SELECT product code,'('||product||') '||description descricao,stock "stockQty",current_boxes "boxesSoldCurrentMonth",previous_boxes "boxesSoldPreviousMonth",
 CASE WHEN previous_boxes>0 THEN (current_boxes-previous_boxes)/previous_boxes*100 WHEN current_boxes>0 THEN NULL ELSE 0 END "boxesVariation",
 CASE WHEN previous_count>0 THEN (current_count-previous_count)::numeric/previous_count*100 WHEN current_count>0 THEN NULL ELSE 0 END "pdvVariation",
 CASE WHEN daily_avg>0 THEN stock/daily_avg WHEN stock>0 THEN NULL ELSE 0 END "trendDays",previous_count "clientsPreviousCount",current_count "clientsCurrentCount",
 CASE WHEN (SELECT count(*) FROM base_clients)>0 THEN current_count::numeric/(SELECT count(*) FROM base_clients)*100 ELSE 0 END "coverageCurrent" FROM trend),
 table_filtered AS MATERIALIZED(SELECT * FROM table_all WHERE "boxesSoldCurrentMonth">0 AND CASE coalesce(f->>'trend','all') WHEN 'low' THEN "trendDays"<15 WHEN 'medium' THEN "trendDays">=15 AND "trendDays"<30 WHEN 'good' THEN "trendDays">=30 ELSE true END),
 cities AS(SELECT c.city name,sum(CASE WHEN coalesce(f->>'metric','boxes')='boxes' THEN r.boxes ELSE r.value END) value FROM periods r JOIN base_clients c ON c.code=r.client WHERE r.period='current' GROUP BY c.city),
 ranking AS(SELECT CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(c.promotor_name,'N/A') ELSE coalesce(v.nome,coalesce(nullif(c.rca,''),r.seller),'N/A') END name,
 sum(CASE WHEN coalesce(f->>'metric','boxes')='boxes' THEN r.boxes ELSE r.value END) value FROM periods r
 JOIN base_clients c ON c.code=r.client LEFT JOIN public.dim_vendedores v ON v.codigo=coalesce(nullif(c.rca,''),r.seller)
 WHERE r.period='current' GROUP BY 1),
 top_product AS(SELECT * FROM table_all WHERE "coverageCurrent">0 ORDER BY "coverageCurrent" DESC,code LIMIT 1)
 SELECT jsonb_build_object('schema_version',1,'reference_date',ref,'active_clients',(SELECT count(*) FROM base_clients),'active_3m',(SELECT count(*) FROM active_history),
 'current_clients',(SELECT count(*) FROM selection WHERE period='current' AND value>=1),'previous_clients',(SELECT count(*) FROM selection WHERE period='previous' AND value>=1),
 'top',coalesce((SELECT to_jsonb(t) FROM top_product t),'null'),
 'rows',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY "stockQty" DESC,code) FROM table_filtered t),'[]'),
 'total_boxes',coalesce((SELECT sum("boxesSoldCurrentMonth") FROM table_filtered),0),
 'chart_total',coalesce((SELECT sum(value) FROM cities),0),
 'cities',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY value DESC,name) FROM(SELECT * FROM cities ORDER BY value DESC,name LIMIT 10)t),'[]'),
 'ranking',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY value DESC,name) FROM(SELECT * FROM ranking ORDER BY value DESC,name LIMIT 10)t),'[]')) INTO result;
 RETURN result;
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA dashboard_private FROM PUBLIC,anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA dashboard_private TO authenticated;
REVOKE ALL ON FUNCTION public.get_dashboard_filters_v1(text,jsonb),public.get_coverage_page_v1(jsonb),public.get_weekly_page_v1(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_filters_v1(text,jsonb),public.get_coverage_page_v1(jsonb),public.get_weekly_page_v1(jsonb) TO authenticated;

-- Mesma autorização de leitura, avaliada uma vez por consulta.
ALTER POLICY "Acesso Leitura Unificado" ON public.data_product_details USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.data_stock USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.dim_vendedores USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.dim_supervisores USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
NOTIFY pgrst,'reload schema';


-- Migration 20261002230259 summary_rpc_cached_client_assignments
-- Cobertura e Semanal: dados, cálculos e opções de filtros no PostgreSQL.
-- Helpers ficam fora do schema exposto pela API; todos preservam RLS.
CREATE SCHEMA IF NOT EXISTS dashboard_private;
REVOKE ALL ON SCHEMA dashboard_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA dashboard_private TO authenticated;

CREATE OR REPLACE FUNCTION dashboard_private.scope_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $$
DECLARE r text; kind text; sellers text[]; clients text[]; ghosts text[];
BEGIN
 IF auth.uid() IS NULL OR NOT(public.is_admin() OR public.is_approved()) THEN
  RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE='42501';
 END IF;
 SELECT lower(btrim(role)) INTO r FROM public.profiles WHERE id=auth.uid();
 IF r='adm' THEN RETURN jsonb_build_object('kind','admin'); END IF;
 -- Trade: carteira atribuída, inclusive coordenadores com carteira vazia.
 IF EXISTS(SELECT 1 FROM public.data_hierarchy h WHERE r IN(lower(btrim(h.cod_coord)),lower(btrim(h.cod_cocoord)),lower(btrim(h.cod_promotor))))
 OR EXISTS(SELECT 1 FROM public.data_client_promoters WHERE lower(btrim(promoter_code))=r) THEN
  kind:='trade';
  SELECT array_agg(cp.client_code) INTO clients FROM public.data_client_promoters cp
  WHERE lower(btrim(cp.promoter_code))=r OR EXISTS(SELECT 1 FROM public.data_hierarchy h
   WHERE lower(btrim(h.cod_promotor))=lower(btrim(cp.promoter_code)) AND r IN(lower(btrim(h.cod_coord)),lower(btrim(h.cod_cocoord)),lower(btrim(h.cod_promotor))));
 ELSE
  SELECT array_agg(DISTINCT codusur) INTO sellers FROM (
   SELECT codusur FROM public.data_detailed WHERE lower(btrim(codsupervisor))=r
   UNION ALL SELECT codusur FROM public.data_history WHERE lower(btrim(codsupervisor))=r) s;
  kind:=CASE WHEN sellers IS NULL THEN 'seller' ELSE 'supervisor' END;
  SELECT array_agg(codigo_cliente) INTO clients FROM public.data_clients
  WHERE (kind='seller' AND lower(btrim(rca1))=r) OR (kind='supervisor' AND rca1=ANY(sellers))
   OR (r='1001' AND upper(coalesce(razaosocial,nomecliente,'')) LIKE '%AMERICANAS%');
  -- Mesmo complemento da carteira legado: clientes com venda atual do vendedor/supervisor.
  SELECT array_agg(DISTINCT codcli) INTO ghosts FROM public.data_detailed
  WHERE (kind='seller' AND lower(btrim(codusur))=r) OR (kind='supervisor' AND lower(btrim(codsupervisor))=r);
 END IF;
 RETURN jsonb_build_object('kind',kind,'clients',coalesce(clients,ARRAY[]::text[]),'ghosts',coalesce(ghosts,ARRAY[]::text[]));
END $$;

CREATE OR REPLACE FUNCTION dashboard_private.clients_v1(s jsonb)
RETURNS TABLE(code text,rca text,city text,rede text,coord text,coord_name text,cocoord text,cocoord_name text,promotor text,promotor_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT c.codigo_cliente,CASE WHEN upper(coalesce(c.razaosocial,c.nomecliente,'')) LIKE '%AMERICANAS%' THEN '1001' ELSE c.rca1 END,
 coalesce(nullif(c.cidade,''),'N/A'),coalesce(nullif(c.ramo,''),'N/A'),h.cod_coord,h.nome_coord,h.cod_cocoord,h.nome_cocoord,cp.promoter_code,coalesce(h.nome_promotor,cp.promoter_code)
 FROM public.data_clients c
 LEFT JOIN public.data_client_promoters cp ON cp.client_code=c.codigo_cliente
 LEFT JOIN LATERAL (SELECT * FROM public.data_hierarchy h WHERE lower(btrim(h.cod_promotor))=lower(btrim(cp.promoter_code)) ORDER BY h.id LIMIT 1) h ON true
 WHERE s->>'kind'='admin' OR c.codigo_cliente IN(SELECT jsonb_array_elements_text(s->'clients'))
 OR c.codigo_cliente IN(SELECT jsonb_array_elements_text(s->'ghosts'));
$$;

CREATE OR REPLACE FUNCTION dashboard_private.matches_v1(f jsonb,k text,v text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(jsonb_array_length(f->k),0)=0 OR coalesce(f->k ? v,false);
$$;
CREATE OR REPLACE FUNCTION dashboard_private.rede_v1(f jsonb,v text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(v,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? v,false))
 WHEN 'sem_rede' THEN coalesce(v,'N/A') IN('','N/A') ELSE true END;
$$;

CREATE OR REPLACE FUNCTION dashboard_private.assignments_v1(s jsonb)
RETURNS TABLE(client text,seller text,supervisor text,supervisor_name text,filial text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT a.* FROM dashboard_private.client_assignments a WHERE s->>'kind'='admin'
 OR a.client IN(SELECT jsonb_array_elements_text(s->'clients')) OR a.client IN(SELECT jsonb_array_elements_text(s->'ghosts'));
$$;

CREATE OR REPLACE FUNCTION dashboard_private.rows_v1(s jsonb,f jsonb DEFAULT '{}'::jsonb,purpose text DEFAULT 'all')
RETURNS TABLE(source text,client text,product text,supplier text,virtual_supplier text,seller text,seller_name text,supervisor text,supervisor_name text,filial text,sale_type text,day date,amount numeric,bonus numeric,units numeric,boxes numeric,description text,registered date,city text,rede text,coord text,coord_name text,cocoord text,cocoord_name text,promotor text,promotor_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 products AS MATERIALIZED(SELECT * FROM public.dim_produtos), details AS MATERIALIZED(SELECT * FROM public.data_product_details),
 vendors AS MATERIALIZED(SELECT * FROM public.dim_vendedores), supervisors AS MATERIALIZED(SELECT * FROM public.dim_supervisores), raw AS MATERIALIZED(
 SELECT 'current'::text source,d.codcli,d.produto,d.codfor,d.codusur,d.codsupervisor,d.filial,d.tipovenda,(d.dtped AT TIME ZONE 'UTC')::date AS day,coalesce(d.vlvenda,0) amount,coalesce(d.vlbonific,0) bonus,coalesce(d.qtvenda,0) units
 FROM public.data_detailed d LEFT JOIN clients c ON c.code=d.codcli WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR d.codcli IN(SELECT jsonb_array_elements_text(s->'ghosts')))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false)))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)))
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR (d.codfor='1119' AND EXISTS(SELECT 1 FROM products p WHERE p.codigo=d.produto AND coalesce(f->'suppliers' ? (CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END),false))))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? coalesce(nullif(c.rca,''),d.codusur),false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (purpose<>'weekly' OR coalesce(f->>'month','current')='current')
 UNION ALL
 SELECT 'history',d.codcli,d.produto,d.codfor,d.codusur,d.codsupervisor,d.filial,d.tipovenda,(d.dtped AT TIME ZONE 'UTC')::date,coalesce(d.vlvenda,0),coalesce(d.vlbonific,0),coalesce(d.qtvenda,0)
 FROM public.data_history d LEFT JOIN clients c ON c.code=d.codcli WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false)))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)))
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR (d.codfor='1119' AND EXISTS(SELECT 1 FROM products p WHERE p.codigo=d.produto AND coalesce(f->'suppliers' ? (CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END),false))))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? coalesce(nullif(c.rca,''),d.codusur),false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (purpose<>'weekly' OR ((d.dtped AT TIME ZONE 'UTC')::date >= (CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',(SELECT max(dtped) FROM public.data_detailed) AT TIME ZONE 'UTC')::date ELSE ((f->>'month')||'-01')::date END)-interval '1 month' AND (d.dtped AT TIME ZONE 'UTC')::date < (CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',(SELECT max(dtped) FROM public.data_detailed) AT TIME ZONE 'UTC')::date ELSE ((f->>'month')||'-01')::date+interval '1 month' END)))
 ), assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s))
 SELECT r.source,r.codcli,r.produto,r.codfor,CASE WHEN r.codfor='1119' THEN CASE
 WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY'
 WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END,
 coalesce(nullif(c.rca,''),r.codusur),coalesce(v.nome,coalesce(nullif(c.rca,''),r.codusur),'N/A'),
 coalesce(ss.supervisor,r.codsupervisor),coalesce(ds.nome,ss.supervisor,r.codsupervisor,'N/A'),r.filial,r.tipovenda,r.day,r.amount,r.bonus,r.units,
 r.units/CASE WHEN p.qtde_master>0 THEN p.qtde_master ELSE 1 END,
 coalesce(nullif(p.descricao,''),'Produto '||r.produto),(pd.dtcadastro AT TIME ZONE 'UTC')::date,
 coalesce(c.city,'N/A'),coalesce(c.rede,'N/A'),c.coord,c.coord_name,c.cocoord,c.cocoord_name,c.promotor,c.promotor_name
 FROM raw r LEFT JOIN clients c ON c.code=r.codcli
 LEFT JOIN products p ON p.codigo=r.produto
 LEFT JOIN details pd ON pd.code=r.produto
 LEFT JOIN assignments ss ON ss.client=r.codcli
 LEFT JOIN vendors v ON v.codigo=coalesce(nullif(c.rca,''),r.codusur)
 LEFT JOIN supervisors ds ON ds.codigo=coalesce(ss.supervisor,r.codsupervisor);
$$;

-- Page-local planner settings avoid JIT startup and merge joins caused by opaque helper cardinality.
-- Settings restore automatically on function exit; authorization/RLS remain unchanged.
-- As opções são pequenas projeções; nunca retornam linhas de vendas ao navegador.
CREATE OR REPLACE FUNCTION public.get_dashboard_filters_v1(p_page text,p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); result jsonb; f jsonb:=p_filters;
BEGIN
 IF p_page NOT IN('coverage','weekly') OR jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Página ou filtros inválidos' USING ERRCODE='22023'; END IF;
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 raw AS MATERIALIZED(SELECT * FROM dashboard_private.sales_facets WHERE s->>'kind'='admin'
 OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR (source='current' AND codcli IN(SELECT jsonb_array_elements_text(s->'ghosts')))),
 rows AS MATERIALIZED(SELECT r.source,r.day,r.filial,r.tipovenda sale_type,r.produto product,r.codfor supplier,
 coalesce(p.descricao,'Produto '||r.produto) description,
 CASE WHEN r.codfor='1119' THEN CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END virtual_supplier,
 a.seller,coalesce(v.nome,a.seller,'N/A') seller_name,a.supervisor_name,c.city,c.rede,c.coord,c.cocoord,c.promotor
 FROM raw r LEFT JOIN clients c ON c.code=r.codcli LEFT JOIN assignments a ON a.client=r.codcli
 LEFT JOIN public.dim_produtos p ON p.codigo=r.produto LEFT JOIN public.dim_vendedores v ON v.codigo=a.seller),
 scope AS MATERIALIZED(SELECT * FROM rows WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false)))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? seller,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? rede,false)) WHEN 'sem_rede' THEN coalesce(rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR filial=f->>'filial')
 AND (coalesce(f->>'city','')='' OR lower(city)=lower(f->>'city'))),
 supplier_options AS (SELECT DISTINCT supplier code,coalesce(df.nome,supplier) label FROM scope LEFT JOIN public.dim_fornecedores df ON df.codigo=scope.supplier
 UNION SELECT DISTINCT virtual_supplier,CASE virtual_supplier WHEN '1119_TODDYNHO' THEN 'TODDYNHO' WHEN '1119_TODDY' THEN 'TODDY' ELSE 'QUAKER / KEROCOCO' END FROM scope WHERE virtual_supplier IS NOT NULL),
 products AS (SELECT DISTINCT product code,'('||product||') '||description label FROM scope WHERE (coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? supplier,false)) OR coalesce(f->'suppliers' ? virtual_supplier,false)),
 sellers AS(SELECT DISTINCT seller code,seller_name label,supervisor_name supervisor FROM rows
 WHERE (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))),
 hierarchy AS(SELECT * FROM clients), months AS(SELECT DISTINCT to_char(day,'YYYY-MM') code FROM raw WHERE day IS NOT NULL)
 SELECT jsonb_build_object('schema_version',1,'reference_date',coalesce((SELECT max(day) FROM rows WHERE source='current'),(SELECT max(day) FROM rows),current_date),
 'suppliers',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM supplier_options t),'[]'),
 'products',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM products t),'[]'),
 'types',coalesce((SELECT jsonb_agg(jsonb_build_object('code',sale_type,'label',sale_type) ORDER BY sale_type) FROM (SELECT DISTINCT sale_type FROM scope WHERE sale_type IS NOT NULL)t),'[]'),
 'sellers',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM sellers t),'[]'),
 'supervisors',coalesce((SELECT jsonb_agg(jsonb_build_object('code',label,'label',label) ORDER BY label) FROM(SELECT DISTINCT supervisor_name label FROM rows)t),'[]'),
 'coords',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT coord code,coalesce(coord_name,coord) label FROM hierarchy WHERE coord IS NOT NULL)t),'[]'),
 'cocoords',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT cocoord code,coalesce(cocoord_name,cocoord) label FROM hierarchy WHERE cocoord IS NOT NULL AND (coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)))t),'[]'),
 'promotors',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT promotor code,coalesce(promotor_name,promotor) label FROM hierarchy WHERE promotor IS NOT NULL AND (coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)))t),'[]'),
 'cities',coalesce((SELECT jsonb_agg(city ORDER BY city) FROM(SELECT DISTINCT city FROM clients)t),'[]'),
 'redes',coalesce((SELECT jsonb_agg(jsonb_build_object('code',rede,'label',rede) ORDER BY rede) FROM(SELECT DISTINCT rede FROM clients WHERE rede NOT IN('','N/A'))t),'[]'),
 'months',coalesce((SELECT jsonb_agg(code ORDER BY code DESC) FROM months),'[]')) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.get_weekly_page_v1(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); f jsonb:=p_filters; ref date; target date; result jsonb;
BEGIN
 IF jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 SELECT coalesce(max(day) FILTER(WHERE source='current'),max(day),current_date) INTO ref FROM dashboard_private.sales_calendar;
 target:=CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',ref)::date ELSE ((f->>'month')||'-01')::date END;
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 rows AS MATERIALIZED(SELECT d.source,d.codcli client,d.day,d.vlvenda amount,d.codfor supplier,d.virtual_supplier,
 coalesce(nullif(c.rca,''),d.codusur) seller,coalesce(v.nome,coalesce(nullif(c.rca,''),d.codusur),'N/A') seller_name,
 coalesce(a.supervisor_name,ds.nome,d.codsupervisor,'N/A') supervisor_name,d.filial,coalesce(c.rede,'N/A') rede,
 c.coord,c.cocoord,c.promotor,c.promotor_name FROM dashboard_private.weekly_day d
 LEFT JOIN clients c ON c.code=d.codcli LEFT JOIN assignments a ON a.client=d.codcli
 LEFT JOIN public.dim_vendedores v ON v.codigo=coalesce(nullif(c.rca,''),d.codusur)
 LEFT JOIN public.dim_supervisores ds ON ds.codigo=d.codsupervisor
 WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR (d.source='current' AND d.codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))))
 AND ((coalesce(f->>'month','current')='current' AND d.source='current') OR (d.source='history' AND d.day>=target-interval '1 month' AND d.day<target+interval '1 month'))),
 filtered AS MATERIALIZED(SELECT * FROM rows WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false)))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? seller,false))
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? supplier,false)) OR coalesce(f->'suppliers' ? virtual_supplier,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? rede,false)) WHEN 'sem_rede' THEN coalesce(rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR filial=f->>'filial')),
 selected AS MATERIALIZED(SELECT * FROM filtered WHERE
 (coalesce(f->>'month','current')='current' AND source='current') OR (coalesce(f->>'month','current')<>'current' AND source='history' AND day>=target AND day<target+interval '1 month')),
 first_day AS(SELECT target+CASE extract(isodow FROM target)::int WHEN 6 THEN 2 WHEN 7 THEN 1 ELSE 0 END first),
 week_starts AS(SELECT first start FROM first_day UNION SELECT d::date FROM first_day,generate_series(date_trunc('week',first::timestamp)+interval '7 days',target::timestamp+interval '1 month - 1 day',interval '7 days') d),
 weeks AS(SELECT row_number() OVER(ORDER BY start) id,start,least((date_trunc('week',start::timestamp)+interval '6 days')::date,(target+interval '1 month - 1 day')::date) finish FROM week_starts),
 daily AS(SELECT w.id,extract(dow FROM s.day)::int weekday,sum(s.amount) amount FROM weeks w JOIN selected s ON s.day BETWEEN w.start AND w.finish GROUP BY 1,2),
 week_data AS(SELECT w.id,w.start,w.finish "end",coalesce((SELECT sum(amount) FROM daily d WHERE d.id=w.id),0) total,
 (SELECT jsonb_agg(coalesce(d.amount,0) ORDER BY wd) FROM generate_series(0,6) wd LEFT JOIN daily d ON d.id=w.id AND d.weekday=wd) days FROM weeks w),
 best_daily AS(SELECT day,sum(amount) amount FROM filtered WHERE source='history' AND day>=target-interval '1 month' AND day<target GROUP BY day),
 best AS(SELECT extract(dow FROM day)::int wd,greatest(max(amount),0) amount FROM best_daily GROUP BY 1),
 ranks AS(SELECT CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(promotor,'Sem Promotor') ELSE coalesce(seller,'N/A') END code,
 CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(promotor_name,'Sem Promotor') ELSE coalesce(seller_name,seller,'N/A') END name,
 sum(amount) val,count(DISTINCT client) pos FROM selected GROUP BY 1,2)
 SELECT jsonb_build_object('schema_version',1,'reference_date',ref,'target_month',to_char(target,'YYYY-MM'),
 'weeks',coalesce((SELECT jsonb_agg(to_jsonb(w) ORDER BY id) FROM week_data w),'[]'),
 'best_days',(SELECT jsonb_agg(coalesce(b.amount,0) ORDER BY wd) FROM generate_series(0,6) wd LEFT JOIN best b USING(wd)),
 'ranking_fat',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY val DESC,code) FROM(SELECT * FROM ranks ORDER BY val DESC,code LIMIT 10)t),'[]'),
 'ranking_pos',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY pos DESC,val DESC,code) FROM(SELECT * FROM ranks ORDER BY pos DESC,val DESC,code LIMIT 10)t),'[]')) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.get_coverage_page_v1(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); f jsonb:=p_filters; ref date; start_date date; end_date date; prev_start date; prev_end date;
 custom_date boolean; alt boolean; result jsonb; days integer:=greatest(coalesce((f->>'working_days')::int,0),0);
BEGIN
 IF jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 SELECT coalesce(max(day) FILTER(WHERE source='current'),max(day),current_date) INTO ref FROM dashboard_private.sales_calendar;
 custom_date:=nullif(f->>'date_start','') IS NOT NULL AND nullif(f->>'date_end','') IS NOT NULL;
 start_date:=CASE WHEN custom_date THEN (f->>'date_start')::date ELSE date_trunc('month',ref)::date END;
 end_date:=CASE WHEN custom_date THEN (f->>'date_end')::date ELSE (start_date+interval '1 month - 1 day')::date END;
 IF end_date<start_date THEN RAISE EXCEPTION 'Período inválido' USING ERRCODE='22023'; END IF;
 prev_start:=(start_date-interval '1 month')::date; prev_end:=(end_date-interval '1 month')::date;
 IF NOT custom_date THEN prev_end:=start_date-1; END IF;
 alt:=coalesce(jsonb_array_length(f->'types'),0)>0 AND NOT(coalesce(f->'types' ? '1',false) OR coalesce(f->'types' ? '9',false));
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 seller_sup AS(SELECT DISTINCT seller,supervisor_name FROM assignments),branches AS(SELECT client,filial FROM assignments),
 base_clients AS MATERIALIZED(SELECT c.* FROM clients c WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR EXISTS(SELECT 1 FROM seller_sup ss WHERE ss.seller=c.rca AND (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? ss.supervisor_name,false))) OR coalesce(jsonb_array_length(f->'supervisors'),0)=0)
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? c.rca,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (coalesce(f->>'filial','ambas') IN('ambas','all') OR EXISTS(SELECT 1 FROM branches b WHERE b.client=c.code AND b.filial=f->>'filial'))),
 scoped AS MATERIALIZED(SELECT d.source,d.codcli client,d.produto product,d.day,d.codusur seller,
 d.vlvenda amount,d.unit_price,d.boxes,CASE WHEN alt THEN d.vlbonific ELSE d.vlvenda END value
 FROM (SELECT * FROM dashboard_private.sales_month WHERE NOT custom_date
 UNION ALL SELECT * FROM dashboard_private.sales_day WHERE custom_date) d
 JOIN base_clients c ON c.code=d.codcli WHERE (coalesce(f->>'filial','ambas') IN('ambas','all') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR coalesce(f->'suppliers' ? d.virtual_supplier,false))
 AND (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false))
 AND (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false))),
 filtered AS NOT MATERIALIZED(SELECT * FROM scoped d WHERE ((f->>'price_min' IS NULL AND f->>'price_max' IS NULL) OR (d.unit_price IS NOT NULL
 AND (f->>'price_min' IS NULL OR d.unit_price>=(f->>'price_min')::numeric)
 AND (f->>'price_max' IS NULL OR d.unit_price<=(f->>'price_max')::numeric)))),
 periods AS MATERIALIZED(
 SELECT r.*,'current'::text period FROM filtered r WHERE (custom_date AND day BETWEEN start_date AND end_date) OR(NOT custom_date AND source='current')
 UNION ALL SELECT r.*,'previous' FROM filtered r WHERE (custom_date AND day BETWEEN prev_start AND prev_end) OR(NOT custom_date AND source='history' AND day BETWEEN prev_start AND prev_end)
 UNION ALL SELECT r.*,'history' FROM filtered r WHERE NOT custom_date AND source='history' AND day NOT BETWEEN prev_start AND prev_end),
 product_clients AS(SELECT product,client,period,sum(value) value FROM periods WHERE period IN('current','previous') GROUP BY 1,2,3),
 product_counts AS(SELECT product,count(*) FILTER(WHERE period='current' AND value>=1) current_count,count(*) FILTER(WHERE period='previous' AND value>=1) previous_count FROM product_clients GROUP BY product),
 selection AS(SELECT client,period,sum(value) value FROM periods WHERE period IN('current','previous') GROUP BY 1,2),
 active_history AS(SELECT client FROM scoped WHERE source='history' GROUP BY client HAVING sum(amount)>=1),
 working AS MATERIALIZED(SELECT DISTINCT day FROM dashboard_private.sales_calendar WHERE extract(isodow FROM day) BETWEEN 1 AND 5
 AND (s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR (source='current' AND codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))))),
 working_array AS(SELECT array_agg(day ORDER BY day) dates FROM working),
 stats_amounts AS(SELECT product,coalesce(sum(boxes) FILTER(WHERE period='current'),0) current_boxes,
 coalesce(sum(boxes) FILTER(WHERE period='previous'),0) previous_boxes,bool_or(day<date_trunc('month',ref)::date) has_history
 FROM periods GROUP BY product),
 stats AS MATERIALIZED(SELECT t.*,coalesce(nullif(p.descricao,''),'Produto '||t.product) description,(pd.dtcadastro AT TIME ZONE 'UTC')::date registered
 FROM stats_amounts t LEFT JOIN public.dim_produtos p ON p.codigo=t.product LEFT JOIN public.data_product_details pd ON pd.code=t.product),
 stock AS(SELECT product_code,sum(coalesce(stock_qty,0)) qty FROM public.data_stock WHERE coalesce(f->>'filial','ambas') IN('ambas','all') OR filial=f->>'filial' GROUP BY product_code),
 divisors AS MATERIALIZED(SELECT t.*,coalesce(st.qty,0) stock,coalesce(pc.current_count,0) current_count,coalesce(pc.previous_count,0) previous_count,
 greatest(1,CASE WHEN NOT coalesce(has_history,false) AND current_boxes>0 THEN least(
 greatest((SELECT count(*) FROM generate_series(date_trunc('month',ref)::date,ref,'1 day') d WHERE extract(isodow FROM d) BETWEEN 1 AND 5),1),
 CASE WHEN days>0 THEN days ELSE greatest((SELECT count(*) FROM generate_series(date_trunc('month',ref)::date,ref,'1 day') d WHERE extract(isodow FROM d) BETWEEN 1 AND 5),1) END)
 ELSE CASE WHEN days>0 THEN least(days,(SELECT count(*) FROM working WHERE registered IS NULL OR day>=registered)) ELSE (SELECT count(*) FROM working WHERE registered IS NULL OR day>=registered) END END)::numeric divisor
 FROM stats t LEFT JOIN stock st ON st.product_code=t.product LEFT JOIN product_counts pc USING(product)),
 -- Daily rows are read only for each product's required trend window, with original price buckets.
 trend_totals AS MATERIALIZED(SELECT dv.product,coalesce(sum(d.boxes*CASE WHEN custom_date THEN
 (CASE WHEN d.day BETWEEN start_date AND end_date THEN 1 ELSE 0 END+CASE WHEN d.day BETWEEN prev_start AND prev_end THEN 1 ELSE 0 END) ELSE 1 END),0)/dv.divisor daily_avg
 FROM divisors dv CROSS JOIN working_array w LEFT JOIN (dashboard_private.sales_day d JOIN base_clients c ON c.code=d.codcli)
 ON d.produto=dv.product AND d.day BETWEEN w.dates[greatest(1,cardinality(w.dates)-dv.divisor::int+1)] AND w.dates[cardinality(w.dates)]
 AND (coalesce(f->>'filial','ambas') IN('ambas','all') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR coalesce(f->'suppliers' ? d.virtual_supplier,false))
 AND (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false))
 AND (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)) AND ((f->>'price_min' IS NULL AND f->>'price_max' IS NULL) OR (d.unit_price IS NOT NULL
 AND (f->>'price_min' IS NULL OR d.unit_price>=(f->>'price_min')::numeric)
 AND (f->>'price_max' IS NULL OR d.unit_price<=(f->>'price_max')::numeric)))
 GROUP BY dv.product,dv.divisor),
 trend AS(SELECT d.*,t.daily_avg FROM divisors d JOIN trend_totals t USING(product)),
 table_all AS MATERIALIZED(SELECT product code,'('||product||') '||description descricao,stock "stockQty",current_boxes "boxesSoldCurrentMonth",previous_boxes "boxesSoldPreviousMonth",
 CASE WHEN previous_boxes>0 THEN (current_boxes-previous_boxes)/previous_boxes*100 WHEN current_boxes>0 THEN NULL ELSE 0 END "boxesVariation",
 CASE WHEN previous_count>0 THEN (current_count-previous_count)::numeric/previous_count*100 WHEN current_count>0 THEN NULL ELSE 0 END "pdvVariation",
 CASE WHEN daily_avg>0 THEN stock/daily_avg WHEN stock>0 THEN NULL ELSE 0 END "trendDays",previous_count "clientsPreviousCount",current_count "clientsCurrentCount",
 CASE WHEN (SELECT count(*) FROM base_clients)>0 THEN current_count::numeric/(SELECT count(*) FROM base_clients)*100 ELSE 0 END "coverageCurrent" FROM trend),
 table_filtered AS MATERIALIZED(SELECT * FROM table_all WHERE "boxesSoldCurrentMonth">0 AND CASE coalesce(f->>'trend','all') WHEN 'low' THEN "trendDays"<15 WHEN 'medium' THEN "trendDays">=15 AND "trendDays"<30 WHEN 'good' THEN "trendDays">=30 ELSE true END),
 cities AS(SELECT c.city name,sum(CASE WHEN coalesce(f->>'metric','boxes')='boxes' THEN r.boxes ELSE r.value END) value FROM periods r JOIN base_clients c ON c.code=r.client WHERE r.period='current' GROUP BY c.city),
 ranking AS(SELECT CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(c.promotor_name,'N/A') ELSE coalesce(v.nome,coalesce(nullif(c.rca,''),r.seller),'N/A') END name,
 sum(CASE WHEN coalesce(f->>'metric','boxes')='boxes' THEN r.boxes ELSE r.value END) value FROM periods r
 JOIN base_clients c ON c.code=r.client LEFT JOIN public.dim_vendedores v ON v.codigo=coalesce(nullif(c.rca,''),r.seller)
 WHERE r.period='current' GROUP BY 1),
 top_product AS(SELECT * FROM table_all WHERE "coverageCurrent">0 ORDER BY "coverageCurrent" DESC,code LIMIT 1)
 SELECT jsonb_build_object('schema_version',1,'reference_date',ref,'active_clients',(SELECT count(*) FROM base_clients),'active_3m',(SELECT count(*) FROM active_history),
 'current_clients',(SELECT count(*) FROM selection WHERE period='current' AND value>=1),'previous_clients',(SELECT count(*) FROM selection WHERE period='previous' AND value>=1),
 'top',coalesce((SELECT to_jsonb(t) FROM top_product t),'null'),
 'rows',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY "stockQty" DESC,code) FROM table_filtered t),'[]'),
 'total_boxes',coalesce((SELECT sum("boxesSoldCurrentMonth") FROM table_filtered),0),
 'chart_total',coalesce((SELECT sum(value) FROM cities),0),
 'cities',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY value DESC,name) FROM(SELECT * FROM cities ORDER BY value DESC,name LIMIT 10)t),'[]'),
 'ranking',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY value DESC,name) FROM(SELECT * FROM ranking ORDER BY value DESC,name LIMIT 10)t),'[]')) INTO result;
 RETURN result;
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA dashboard_private FROM PUBLIC,anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA dashboard_private TO authenticated;
REVOKE ALL ON FUNCTION public.get_dashboard_filters_v1(text,jsonb),public.get_coverage_page_v1(jsonb),public.get_weekly_page_v1(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_filters_v1(text,jsonb),public.get_coverage_page_v1(jsonb),public.get_weekly_page_v1(jsonb) TO authenticated;

-- Mesma autorização de leitura, avaliada uma vez por consulta.
ALTER POLICY "Acesso Leitura Unificado" ON public.data_product_details USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.data_stock USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.dim_vendedores USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.dim_supervisores USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
NOTIFY pgrst,'reload schema';


-- Migration 20261002230630 shared_monthly_rollups_receivables_summaries
-- Resumos privados: nenhuma mudança nas tabelas originais ou nos downloads legados.
CREATE TABLE IF NOT EXISTS dashboard_private.summary_state (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), dirty boolean NOT NULL DEFAULT true,
 generation bigint NOT NULL DEFAULT 0, refreshed_at timestamptz, last_change timestamptz NOT NULL DEFAULT clock_timestamp());
INSERT INTO dashboard_private.summary_state(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS dashboard_private.sales_day (
 source text NOT NULL, codcli text, produto text, codfor text, filial text, tipovenda text,
 codusur text,codsupervisor text,day date,unit_price numeric,virtual_supplier text,observacaofor text,
 vlvenda numeric NOT NULL,vlbonific numeric NOT NULL,qtvenda numeric NOT NULL,boxes numeric NOT NULL,totpesoliq numeric NOT NULL,
 row_count bigint NOT NULL);
CREATE TABLE IF NOT EXISTS dashboard_private.sales_month (LIKE dashboard_private.sales_day INCLUDING ALL);
CREATE TABLE IF NOT EXISTS dashboard_private.sales_month_core (LIKE dashboard_private.sales_day INCLUDING ALL);
CREATE TABLE IF NOT EXISTS dashboard_private.page_rollups(page text NOT NULL,cache_key jsonb NOT NULL,payload jsonb NOT NULL,PRIMARY KEY(page,cache_key));
CREATE TABLE IF NOT EXISTS dashboard_private.product_suppliers(product text,supplier text,virtual_supplier text);
CREATE TABLE IF NOT EXISTS dashboard_private.receivables_summary(cod_cliente text,dt_vencimento timestamptz,vl_titulos numeric,vl_receber numeric,
 qt_titulos numeric,qt_tit_receber numeric,positive_receber numeric,row_count bigint);
CREATE INDEX IF NOT EXISTS receivables_client_due ON dashboard_private.receivables_summary(cod_cliente,dt_vencimento);
CREATE INDEX IF NOT EXISTS sales_month_core_client ON dashboard_private.sales_month_core(codcli,source);
CREATE INDEX IF NOT EXISTS sales_month_core_supplier ON dashboard_private.sales_month_core(codfor,source);
CREATE TABLE IF NOT EXISTS dashboard_private.weekly_day (
 source text NOT NULL,codcli text,codfor text,filial text,codusur text,codsupervisor text,
 day date,virtual_supplier text,vlvenda numeric NOT NULL);
CREATE TABLE IF NOT EXISTS dashboard_private.sales_facets (
 source text NOT NULL,codcli text,produto text,codfor text,filial text,tipovenda text,day date);
CREATE TABLE IF NOT EXISTS dashboard_private.sales_calendar (source text NOT NULL,codcli text,day date);
CREATE TABLE IF NOT EXISTS dashboard_private.client_assignments (
 client text PRIMARY KEY,seller text,supervisor text,supervisor_name text,filial text);
CREATE INDEX IF NOT EXISTS sales_day_client_date ON dashboard_private.sales_day(codcli,day);
CREATE INDEX IF NOT EXISTS sales_day_supplier_date ON dashboard_private.sales_day(codfor,day);
CREATE INDEX IF NOT EXISTS sales_day_product_date ON dashboard_private.sales_day(produto,day);
CREATE INDEX IF NOT EXISTS sales_month_client ON dashboard_private.sales_month(codcli,source);
CREATE INDEX IF NOT EXISTS sales_month_supplier ON dashboard_private.sales_month(codfor,source);
CREATE INDEX IF NOT EXISTS sales_month_product ON dashboard_private.sales_month(produto,source);
CREATE INDEX IF NOT EXISTS weekly_day_client_date ON dashboard_private.weekly_day(codcli,day);
CREATE INDEX IF NOT EXISTS weekly_day_supplier_date ON dashboard_private.weekly_day(codfor,day);
CREATE INDEX IF NOT EXISTS facets_client ON dashboard_private.sales_facets(codcli);
CREATE INDEX IF NOT EXISTS facets_supplier ON dashboard_private.sales_facets(codfor);
CREATE INDEX IF NOT EXISTS calendar_date ON dashboard_private.sales_calendar(source,day DESC);
CREATE INDEX IF NOT EXISTS calendar_client ON dashboard_private.sales_calendar(codcli,day);

-- Same approved-reader policy as the underlying tables; API endpoints still derive the wallet.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['summary_state','sales_day','sales_month','sales_month_core','weekly_day','sales_facets','sales_calendar','client_assignments','page_rollups','product_suppliers','receivables_summary'] LOOP
  EXECUTE format('ALTER TABLE dashboard_private.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON dashboard_private.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT SELECT ON dashboard_private.%I TO authenticated',t);
  EXECUTE format('DROP POLICY IF EXISTS summary_read ON dashboard_private.%I',t);
  EXECUTE format('CREATE POLICY summary_read ON dashboard_private.%I FOR SELECT TO authenticated USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()))',t);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION dashboard_private.assignments_source_v1(s jsonb)
RETURNS TABLE(client text,seller text,supervisor text,supervisor_name text,filial text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 raw AS MATERIALIZED(
 SELECT 'current'::text source,codcli,coalesce(nullif(c.rca,''),codusur) seller,codsupervisor,filial,dtped FROM public.data_detailed d LEFT JOIN clients c ON c.code=d.codcli
 WHERE s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))
 UNION ALL SELECT 'history',codcli,coalesce(nullif(c.rca,''),codusur),codsupervisor,filial,dtped FROM public.data_history d LEFT JOIN clients c ON c.code=d.codcli
 WHERE s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients'))),
 branch AS MATERIALIZED(SELECT DISTINCT ON(codcli) codcli,seller,filial,codsupervisor,dtped,source FROM raw ORDER BY codcli,source,dtped DESC NULLS LAST,filial),
 sup AS(SELECT DISTINCT ON(seller) seller,codsupervisor FROM branch ORDER BY seller,dtped DESC NULLS LAST,source,codsupervisor)
 SELECT coalesce(c.code,b.codcli),coalesce(nullif(c.rca,''),b.seller),sup.codsupervisor,coalesce(ds.nome,sup.codsupervisor,'N/A'),b.filial
 FROM clients c FULL JOIN branch b ON b.codcli=c.code LEFT JOIN sup ON sup.seller=coalesce(nullif(c.rca,''),b.seller)
 LEFT JOIN public.dim_supervisores ds ON ds.codigo=sup.codsupervisor;
$$;

-- Privileged writer lives outside the exposed schema and checks its caller.
CREATE OR REPLACE FUNCTION dashboard_private.refresh_summaries_v1(force_refresh boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' SET jit='off' SET work_mem='32MB' AS $$
DECLARE st dashboard_private.summary_state; result jsonb;
BEGIN
 IF NOT ((auth.uid() IS NOT NULL AND public.is_admin()) OR (auth.uid() IS NULL AND session_user IN('postgres','supabase_admin'))) THEN
  RAISE EXCEPTION 'Atualização reservada ao administrador' USING ERRCODE='42501';
 END IF;
 IF NOT pg_try_advisory_xact_lock(70261002,1) THEN RETURN jsonb_build_object('status','busy'); END IF;
 SELECT * INTO st FROM dashboard_private.summary_state WHERE id=true FOR UPDATE;
 IF NOT force_refresh AND NOT st.dirty THEN RETURN jsonb_build_object('status','current','generation',st.generation); END IF;
 -- The state row lock serializes committed source changes with this consistent rebuild.
 -- DELETE/INSERT is atomic under MVCC: concurrent readers keep the previous complete generation.
 DELETE FROM dashboard_private.sales_day;
 INSERT INTO dashboard_private.sales_day
 WITH raw AS MATERIALIZED(
  SELECT 'current'::text source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,
   (dtped AT TIME ZONE 'UTC')::date AS day,coalesce(vlvenda,0) amount,coalesce(vlbonific,0) bonus,coalesce(qtvenda,0) units,coalesce(totpesoliq,0) peso,observacaofor FROM public.data_detailed
  UNION ALL SELECT 'history',codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,
   (dtped AT TIME ZONE 'UTC')::date,coalesce(vlvenda,0),coalesce(vlbonific,0),coalesce(qtvenda,0),coalesce(totpesoliq,0),observacaofor FROM public.data_history),
 enriched AS(SELECT r.*,CASE WHEN units<>0 THEN amount/units END unit_price,
  units/CASE WHEN p.qtde_master>0 THEN p.qtde_master ELSE 1 END boxes,
  CASE WHEN r.codfor='1119' THEN CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END virtual_supplier
  FROM raw r LEFT JOIN public.dim_produtos p ON p.codigo=r.produto)
 SELECT source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,day,unit_price,virtual_supplier,observacaofor,
 sum(amount),sum(bonus),sum(units),sum(boxes),sum(peso),count(*) FROM enriched
 GROUP BY source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,day,unit_price,virtual_supplier,observacaofor;
 DELETE FROM dashboard_private.sales_month;
 INSERT INTO dashboard_private.sales_month
 SELECT source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,date_trunc('month',day)::date,unit_price,virtual_supplier,observacaofor,
 sum(vlvenda),sum(vlbonific),sum(qtvenda),sum(boxes),sum(totpesoliq),sum(row_count)
 FROM dashboard_private.sales_day GROUP BY source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,date_trunc('month',day)::date,unit_price,virtual_supplier,observacaofor;
 DELETE FROM dashboard_private.sales_month_core;
 INSERT INTO dashboard_private.sales_month_core SELECT source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,day,NULL::numeric,virtual_supplier,observacaofor,
 sum(vlvenda),sum(vlbonific),sum(qtvenda),sum(boxes),sum(totpesoliq),sum(row_count) FROM dashboard_private.sales_month
 GROUP BY source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,day,virtual_supplier,observacaofor;
 DELETE FROM dashboard_private.product_suppliers;
 INSERT INTO dashboard_private.product_suppliers SELECT DISTINCT produto,codfor,virtual_supplier FROM dashboard_private.sales_day;
 DELETE FROM dashboard_private.receivables_summary;
 INSERT INTO dashboard_private.receivables_summary SELECT cod_cliente,dt_vencimento,sum(coalesce(vl_titulos,0)),sum(coalesce(vl_receber,0)),
 sum(coalesce(qt_titulos,0)),sum(coalesce(qt_tit_receber,0)),sum(CASE WHEN vl_receber>0 THEN vl_receber ELSE 0 END),count(*)
 FROM public.data_titulos GROUP BY cod_cliente,dt_vencimento;
 DELETE FROM dashboard_private.weekly_day;
 INSERT INTO dashboard_private.weekly_day SELECT source,codcli,codfor,filial,codusur,codsupervisor,day,virtual_supplier,sum(vlvenda)
 FROM dashboard_private.sales_day GROUP BY source,codcli,codfor,filial,codusur,codsupervisor,day,virtual_supplier;
 DELETE FROM dashboard_private.sales_facets;
 INSERT INTO dashboard_private.sales_facets SELECT source,codcli,produto,codfor,filial,tipovenda,max(day)
 FROM dashboard_private.sales_day GROUP BY source,codcli,produto,codfor,filial,tipovenda,date_trunc('month',day);
 DELETE FROM dashboard_private.sales_calendar;
 INSERT INTO dashboard_private.sales_calendar SELECT DISTINCT source,codcli,day FROM dashboard_private.sales_day;
 DELETE FROM dashboard_private.client_assignments;
 INSERT INTO dashboard_private.client_assignments SELECT * FROM dashboard_private.assignments_source_v1('{"kind":"admin"}');
 DELETE FROM dashboard_private.page_rollups;
 IF to_regprocedure('dashboard_private.coverage_result_v1(jsonb,jsonb)') IS NOT NULL THEN
  INSERT INTO dashboard_private.page_rollups VALUES('coverage','{}',dashboard_private.coverage_result_v1('{"kind":"admin"}','{}')),
  ('coverage','{"suppliers":["707"]}',dashboard_private.coverage_result_v1('{"kind":"admin"}','{"suppliers":["707"]}'));
 END IF;
 IF to_regprocedure('dashboard_private.facet_result_v1(text,jsonb,jsonb)') IS NOT NULL THEN
  INSERT INTO dashboard_private.page_rollups VALUES('filters','{}',dashboard_private.facet_result_v1('coverage','{"kind":"admin"}','{}'));
 END IF;
 ANALYZE dashboard_private.sales_month_core; ANALYZE dashboard_private.receivables_summary;
 ANALYZE dashboard_private.sales_day; ANALYZE dashboard_private.sales_month; ANALYZE dashboard_private.weekly_day;
 ANALYZE dashboard_private.sales_facets; ANALYZE dashboard_private.sales_calendar; ANALYZE dashboard_private.client_assignments;
 UPDATE dashboard_private.summary_state SET dirty=false,generation=generation+1,refreshed_at=clock_timestamp() WHERE id=true RETURNING
  jsonb_build_object('status','refreshed','generation',generation,'refreshed_at',refreshed_at) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION dashboard_private.assignments_source_v1(jsonb),dashboard_private.refresh_summaries_v1(boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION dashboard_private.refresh_summaries_v1(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.refresh_dashboard_summaries_v1()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' SET statement_timeout='60s' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Atualização reservada ao administrador' USING ERRCODE='42501'; END IF;
 RETURN dashboard_private.refresh_summaries_v1(false);
END $$;
REVOKE ALL ON FUNCTION public.refresh_dashboard_summaries_v1() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.refresh_dashboard_summaries_v1() TO authenticated;

CREATE OR REPLACE FUNCTION dashboard_private.queue_summaries_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_SCHEMA<>'public' OR TG_TABLE_NAME NOT IN('data_detailed','data_history','data_clients','data_client_promoters','data_hierarchy','dim_produtos','dim_vendedores','dim_supervisores','data_product_details','data_titulos','dim_fornecedores') THEN
  RAISE EXCEPTION 'Origem de atualização inválida';
 END IF;
 IF NOT ((auth.uid() IS NOT NULL AND public.is_admin()) OR (auth.uid() IS NULL AND session_user IN('postgres','supabase_admin'))) THEN
  RAISE EXCEPTION 'Atualização reservada ao administrador' USING ERRCODE='42501';
 END IF;
 UPDATE dashboard_private.summary_state SET dirty=true,last_change=clock_timestamp() WHERE id=true;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION dashboard_private.queue_summaries_v1() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['data_detailed','data_history','data_clients','data_client_promoters','data_hierarchy','dim_produtos','dim_vendedores','dim_supervisores','data_product_details','data_titulos','dim_fornecedores'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS dashboard_summary_dirty ON public.%I',t);
  EXECUTE format('CREATE TRIGGER dashboard_summary_dirty AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION dashboard_private.queue_summaries_v1()',t);
 END LOOP;
END $$;
-- One minute safety net for integrations that don't explicitly finish an import.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='dashboard-page-summaries-v1') THEN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='dashboard-page-summaries-v1';
 END IF;
 PERFORM cron.schedule('dashboard-page-summaries-v1','* * * * *','SELECT dashboard_private.refresh_summaries_v1(false)');
END $$;
SELECT dashboard_private.refresh_summaries_v1(true);

CREATE OR REPLACE FUNCTION dashboard_private.assignments_v1(s jsonb)
RETURNS TABLE(client text,seller text,supervisor text,supervisor_name text,filial text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT a.* FROM dashboard_private.client_assignments a WHERE s->>'kind'='admin'
 OR a.client IN(SELECT jsonb_array_elements_text(s->'clients')) OR a.client IN(SELECT jsonb_array_elements_text(s->'ghosts'));
$$;
GRANT EXECUTE ON FUNCTION dashboard_private.assignments_v1(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION dashboard_private.assignments_v1(jsonb) FROM PUBLIC,anon;


-- Migration 20261002230900 coverage_summary_rollups_and_filter_options
-- Cobertura e Semanal: dados, cálculos e opções de filtros no PostgreSQL.
-- Helpers ficam fora do schema exposto pela API; todos preservam RLS.
CREATE SCHEMA IF NOT EXISTS dashboard_private;
REVOKE ALL ON SCHEMA dashboard_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA dashboard_private TO authenticated;

CREATE OR REPLACE FUNCTION dashboard_private.scope_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $$
DECLARE r text; kind text; sellers text[]; clients text[]; ghosts text[];
BEGIN
 IF auth.uid() IS NULL OR NOT(public.is_admin() OR public.is_approved()) THEN
  RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE='42501';
 END IF;
 SELECT lower(btrim(role)) INTO r FROM public.profiles WHERE id=auth.uid();
 IF r='adm' THEN RETURN jsonb_build_object('kind','admin'); END IF;
 -- Trade: carteira atribuída, inclusive coordenadores com carteira vazia.
 IF EXISTS(SELECT 1 FROM public.data_hierarchy h WHERE r IN(lower(btrim(h.cod_coord)),lower(btrim(h.cod_cocoord)),lower(btrim(h.cod_promotor))))
 OR EXISTS(SELECT 1 FROM public.data_client_promoters WHERE lower(btrim(promoter_code))=r) THEN
  kind:='trade';
  SELECT array_agg(cp.client_code) INTO clients FROM public.data_client_promoters cp
  WHERE lower(btrim(cp.promoter_code))=r OR EXISTS(SELECT 1 FROM public.data_hierarchy h
   WHERE lower(btrim(h.cod_promotor))=lower(btrim(cp.promoter_code)) AND r IN(lower(btrim(h.cod_coord)),lower(btrim(h.cod_cocoord)),lower(btrim(h.cod_promotor))));
 ELSE
  SELECT array_agg(DISTINCT codusur) INTO sellers FROM (
   SELECT codusur FROM public.data_detailed WHERE lower(btrim(codsupervisor))=r
   UNION ALL SELECT codusur FROM public.data_history WHERE lower(btrim(codsupervisor))=r) s;
  kind:=CASE WHEN sellers IS NULL THEN 'seller' ELSE 'supervisor' END;
  SELECT array_agg(codigo_cliente) INTO clients FROM public.data_clients
  WHERE (kind='seller' AND lower(btrim(rca1))=r) OR (kind='supervisor' AND rca1=ANY(sellers))
   OR (r='1001' AND upper(coalesce(razaosocial,nomecliente,'')) LIKE '%AMERICANAS%');
  -- Mesmo complemento da carteira legado: clientes com venda atual do vendedor/supervisor.
  SELECT array_agg(DISTINCT codcli) INTO ghosts FROM public.data_detailed
  WHERE (kind='seller' AND lower(btrim(codusur))=r) OR (kind='supervisor' AND lower(btrim(codsupervisor))=r);
 END IF;
 RETURN jsonb_build_object('kind',kind,'clients',coalesce(clients,ARRAY[]::text[]),'ghosts',coalesce(ghosts,ARRAY[]::text[]));
END $$;

CREATE OR REPLACE FUNCTION dashboard_private.clients_v1(s jsonb)
RETURNS TABLE(code text,rca text,city text,rede text,coord text,coord_name text,cocoord text,cocoord_name text,promotor text,promotor_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT c.codigo_cliente,CASE WHEN upper(coalesce(c.razaosocial,c.nomecliente,'')) LIKE '%AMERICANAS%' THEN '1001' ELSE c.rca1 END,
 coalesce(nullif(c.cidade,''),'N/A'),coalesce(nullif(c.ramo,''),'N/A'),h.cod_coord,h.nome_coord,h.cod_cocoord,h.nome_cocoord,cp.promoter_code,coalesce(h.nome_promotor,cp.promoter_code)
 FROM public.data_clients c
 LEFT JOIN public.data_client_promoters cp ON cp.client_code=c.codigo_cliente
 LEFT JOIN LATERAL (SELECT * FROM public.data_hierarchy h WHERE lower(btrim(h.cod_promotor))=lower(btrim(cp.promoter_code)) ORDER BY h.id LIMIT 1) h ON true
 WHERE s->>'kind'='admin' OR c.codigo_cliente IN(SELECT jsonb_array_elements_text(s->'clients'))
 OR c.codigo_cliente IN(SELECT jsonb_array_elements_text(s->'ghosts'));
$$;

CREATE OR REPLACE FUNCTION dashboard_private.matches_v1(f jsonb,k text,v text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(jsonb_array_length(f->k),0)=0 OR coalesce(f->k ? v,false);
$$;
CREATE OR REPLACE FUNCTION dashboard_private.rede_v1(f jsonb,v text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(v,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? v,false))
 WHEN 'sem_rede' THEN coalesce(v,'N/A') IN('','N/A') ELSE true END;
$$;

CREATE OR REPLACE FUNCTION dashboard_private.assignments_v1(s jsonb)
RETURNS TABLE(client text,seller text,supervisor text,supervisor_name text,filial text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT a.* FROM dashboard_private.client_assignments a WHERE s->>'kind'='admin'
 OR a.client IN(SELECT jsonb_array_elements_text(s->'clients')) OR a.client IN(SELECT jsonb_array_elements_text(s->'ghosts'));
$$;

CREATE OR REPLACE FUNCTION dashboard_private.rows_v1(s jsonb,f jsonb DEFAULT '{}'::jsonb,purpose text DEFAULT 'all')
RETURNS TABLE(source text,client text,product text,supplier text,virtual_supplier text,seller text,seller_name text,supervisor text,supervisor_name text,filial text,sale_type text,day date,amount numeric,bonus numeric,units numeric,boxes numeric,description text,registered date,city text,rede text,coord text,coord_name text,cocoord text,cocoord_name text,promotor text,promotor_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 products AS MATERIALIZED(SELECT * FROM public.dim_produtos), details AS MATERIALIZED(SELECT * FROM public.data_product_details),
 vendors AS MATERIALIZED(SELECT * FROM public.dim_vendedores), supervisors AS MATERIALIZED(SELECT * FROM public.dim_supervisores), raw AS MATERIALIZED(
 SELECT 'current'::text source,d.codcli,d.produto,d.codfor,d.codusur,d.codsupervisor,d.filial,d.tipovenda,(d.dtped AT TIME ZONE 'UTC')::date AS day,coalesce(d.vlvenda,0) amount,coalesce(d.vlbonific,0) bonus,coalesce(d.qtvenda,0) units
 FROM public.data_detailed d LEFT JOIN clients c ON c.code=d.codcli WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR d.codcli IN(SELECT jsonb_array_elements_text(s->'ghosts')))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false)))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)))
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR (d.codfor='1119' AND EXISTS(SELECT 1 FROM products p WHERE p.codigo=d.produto AND coalesce(f->'suppliers' ? (CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END),false))))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? coalesce(nullif(c.rca,''),d.codusur),false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (purpose<>'weekly' OR coalesce(f->>'month','current')='current')
 UNION ALL
 SELECT 'history',d.codcli,d.produto,d.codfor,d.codusur,d.codsupervisor,d.filial,d.tipovenda,(d.dtped AT TIME ZONE 'UTC')::date,coalesce(d.vlvenda,0),coalesce(d.vlbonific,0),coalesce(d.qtvenda,0)
 FROM public.data_history d LEFT JOIN clients c ON c.code=d.codcli WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false)))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)))
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR (d.codfor='1119' AND EXISTS(SELECT 1 FROM products p WHERE p.codigo=d.produto AND coalesce(f->'suppliers' ? (CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END),false))))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? coalesce(nullif(c.rca,''),d.codusur),false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (purpose<>'weekly' OR ((d.dtped AT TIME ZONE 'UTC')::date >= (CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',(SELECT max(dtped) FROM public.data_detailed) AT TIME ZONE 'UTC')::date ELSE ((f->>'month')||'-01')::date END)-interval '1 month' AND (d.dtped AT TIME ZONE 'UTC')::date < (CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',(SELECT max(dtped) FROM public.data_detailed) AT TIME ZONE 'UTC')::date ELSE ((f->>'month')||'-01')::date+interval '1 month' END)))
 ), assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s))
 SELECT r.source,r.codcli,r.produto,r.codfor,CASE WHEN r.codfor='1119' THEN CASE
 WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY'
 WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END,
 coalesce(nullif(c.rca,''),r.codusur),coalesce(v.nome,coalesce(nullif(c.rca,''),r.codusur),'N/A'),
 coalesce(ss.supervisor,r.codsupervisor),coalesce(ds.nome,ss.supervisor,r.codsupervisor,'N/A'),r.filial,r.tipovenda,r.day,r.amount,r.bonus,r.units,
 r.units/CASE WHEN p.qtde_master>0 THEN p.qtde_master ELSE 1 END,
 coalesce(nullif(p.descricao,''),'Produto '||r.produto),(pd.dtcadastro AT TIME ZONE 'UTC')::date,
 coalesce(c.city,'N/A'),coalesce(c.rede,'N/A'),c.coord,c.coord_name,c.cocoord,c.cocoord_name,c.promotor,c.promotor_name
 FROM raw r LEFT JOIN clients c ON c.code=r.codcli
 LEFT JOIN products p ON p.codigo=r.produto
 LEFT JOIN details pd ON pd.code=r.produto
 LEFT JOIN assignments ss ON ss.client=r.codcli
 LEFT JOIN vendors v ON v.codigo=coalesce(nullif(c.rca,''),r.codusur)
 LEFT JOIN supervisors ds ON ds.codigo=coalesce(ss.supervisor,r.codsupervisor);
$$;

-- Page-local planner settings avoid JIT startup and merge joins caused by opaque helper cardinality.
-- Settings restore automatically on function exit; authorization/RLS remain unchanged.
-- As opções são pequenas projeções; nunca retornam linhas de vendas ao navegador.
CREATE OR REPLACE FUNCTION dashboard_private.normalize_page_filters_v1(f jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb:=f; k text; v jsonb;
BEGIN
 FOR k,v IN SELECT * FROM jsonb_each(f) LOOP
  IF v='null'::jsonb OR v='[]'::jsonb OR v='""'::jsonb
   OR (k='filial' AND v IN('"all"'::jsonb,'"ambas"'::jsonb))
   OR (k='mode' AND v='"promoter"'::jsonb) OR (k='month' AND v='"current"'::jsonb)
   OR (k='trend' AND v='"all"'::jsonb) OR (k='metric' AND v='"boxes"'::jsonb)
   OR (k='working_days' AND v='0'::jsonb) THEN result:=result-k; END IF;
 END LOOP;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION dashboard_private.normalize_page_filters_v1(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION dashboard_private.normalize_page_filters_v1(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION dashboard_private.facet_result_v1(p_page text,s jsonb,p_filters jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' AS $$
DECLARE result jsonb; f jsonb:=p_filters;
BEGIN
 IF p_page NOT IN('coverage','weekly') OR jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Página ou filtros inválidos' USING ERRCODE='22023'; END IF;
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 raw AS MATERIALIZED(SELECT * FROM dashboard_private.sales_facets WHERE s->>'kind'='admin'
 OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR (source='current' AND codcli IN(SELECT jsonb_array_elements_text(s->'ghosts')))),
 rows AS MATERIALIZED(SELECT r.source,r.day,r.filial,r.tipovenda sale_type,r.produto product,r.codfor supplier,
 coalesce(p.descricao,'Produto '||r.produto) description,
 CASE WHEN r.codfor='1119' THEN CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END virtual_supplier,
 a.seller,coalesce(v.nome,a.seller,'N/A') seller_name,a.supervisor_name,c.city,c.rede,c.coord,c.cocoord,c.promotor
 FROM raw r LEFT JOIN clients c ON c.code=r.codcli LEFT JOIN assignments a ON a.client=r.codcli
 LEFT JOIN public.dim_produtos p ON p.codigo=r.produto LEFT JOIN public.dim_vendedores v ON v.codigo=a.seller),
 scope AS MATERIALIZED(SELECT * FROM rows WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false)))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? seller,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? rede,false)) WHEN 'sem_rede' THEN coalesce(rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR filial=f->>'filial')
 AND (coalesce(f->>'city','')='' OR lower(city)=lower(f->>'city'))),
 supplier_options AS (SELECT DISTINCT supplier code,coalesce(df.nome,supplier) label FROM scope LEFT JOIN public.dim_fornecedores df ON df.codigo=scope.supplier
 UNION SELECT DISTINCT virtual_supplier,CASE virtual_supplier WHEN '1119_TODDYNHO' THEN 'TODDYNHO' WHEN '1119_TODDY' THEN 'TODDY' ELSE 'QUAKER / KEROCOCO' END FROM scope WHERE virtual_supplier IS NOT NULL),
 products AS (SELECT DISTINCT product code,'('||product||') '||description label FROM scope WHERE (coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? supplier,false)) OR coalesce(f->'suppliers' ? virtual_supplier,false)),
 sellers AS(SELECT DISTINCT seller code,seller_name label,supervisor_name supervisor FROM rows
 WHERE (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))),
 hierarchy AS(SELECT * FROM clients), months AS(SELECT DISTINCT to_char(day,'YYYY-MM') code FROM raw WHERE day IS NOT NULL)
 SELECT jsonb_build_object('schema_version',1,'reference_date',coalesce((SELECT max(day) FROM rows WHERE source='current'),(SELECT max(day) FROM rows),current_date),
 'suppliers',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM supplier_options t),'[]'),
 'products',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM products t),'[]'),
 'types',coalesce((SELECT jsonb_agg(jsonb_build_object('code',sale_type,'label',sale_type) ORDER BY sale_type) FROM (SELECT DISTINCT sale_type FROM scope WHERE sale_type IS NOT NULL)t),'[]'),
 'sellers',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM sellers t),'[]'),
 'supervisors',coalesce((SELECT jsonb_agg(jsonb_build_object('code',label,'label',label) ORDER BY label) FROM(SELECT DISTINCT supervisor_name label FROM rows)t),'[]'),
 'coords',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT coord code,coalesce(coord_name,coord) label FROM hierarchy WHERE coord IS NOT NULL)t),'[]'),
 'cocoords',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT cocoord code,coalesce(cocoord_name,cocoord) label FROM hierarchy WHERE cocoord IS NOT NULL AND (coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)))t),'[]'),
 'promotors',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT promotor code,coalesce(promotor_name,promotor) label FROM hierarchy WHERE promotor IS NOT NULL AND (coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)))t),'[]'),
 'cities',coalesce((SELECT jsonb_agg(city ORDER BY city) FROM(SELECT DISTINCT city FROM clients)t),'[]'),
 'redes',coalesce((SELECT jsonb_agg(jsonb_build_object('code',rede,'label',rede) ORDER BY rede) FROM(SELECT DISTINCT rede FROM clients WHERE rede NOT IN('','N/A'))t),'[]'),
 'months',coalesce((SELECT jsonb_agg(code ORDER BY code DESC) FROM months),'[]')) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.get_dashboard_filters_v1(p_page text,p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET plan_cache_mode='force_custom_plan' SET jit='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); result jsonb; products jsonb;
BEGIN
 IF p_page NOT IN('coverage','weekly') OR jsonb_typeof(p_filters)<>'object' THEN RAISE EXCEPTION 'Página ou filtros inválidos' USING ERRCODE='22023'; END IF;
 IF s->>'kind'='admin' AND dashboard_private.normalize_page_filters_v1(p_filters-'suppliers')='{}'::jsonb THEN
  SELECT payload INTO result FROM dashboard_private.page_rollups WHERE page='filters' AND cache_key='{}'::jsonb;
  IF FOUND THEN
   IF coalesce(jsonb_array_length(p_filters->'suppliers'),0)>0 THEN
    SELECT coalesce(jsonb_agg(p.item ORDER BY p.ordinal),'[]'::jsonb) INTO products
    FROM jsonb_array_elements(result->'products') WITH ORDINALITY p(item,ordinal)
    WHERE EXISTS(SELECT 1 FROM dashboard_private.product_suppliers x WHERE x.product=p.item->>'code'
     AND (coalesce(p_filters->'suppliers' ? x.supplier,false) OR coalesce(p_filters->'suppliers' ? x.virtual_supplier,false)));
    result:=jsonb_set(result,'{products}',products);
   END IF;
   RETURN result;
  END IF;
 END IF;
 RETURN dashboard_private.facet_result_v1(p_page,s,p_filters);
END $$;

CREATE OR REPLACE FUNCTION public.get_weekly_page_v1(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); f jsonb:=p_filters; ref date; target date; result jsonb;
BEGIN
 IF jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 SELECT coalesce(max(day) FILTER(WHERE source='current'),max(day),current_date) INTO ref FROM dashboard_private.sales_calendar;
 target:=CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',ref)::date ELSE ((f->>'month')||'-01')::date END;
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 rows AS MATERIALIZED(SELECT d.source,d.codcli client,d.day,d.vlvenda amount,d.codfor supplier,d.virtual_supplier,
 coalesce(nullif(c.rca,''),d.codusur) seller,coalesce(v.nome,coalesce(nullif(c.rca,''),d.codusur),'N/A') seller_name,
 coalesce(a.supervisor_name,ds.nome,d.codsupervisor,'N/A') supervisor_name,d.filial,coalesce(c.rede,'N/A') rede,
 c.coord,c.cocoord,c.promotor,c.promotor_name FROM dashboard_private.weekly_day d
 LEFT JOIN clients c ON c.code=d.codcli LEFT JOIN assignments a ON a.client=d.codcli
 LEFT JOIN public.dim_vendedores v ON v.codigo=coalesce(nullif(c.rca,''),d.codusur)
 LEFT JOIN public.dim_supervisores ds ON ds.codigo=d.codsupervisor
 WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR (d.source='current' AND d.codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))))
 AND ((coalesce(f->>'month','current')='current' AND d.source='current') OR (d.source='history' AND d.day>=target-interval '1 month' AND d.day<target+interval '1 month'))),
 filtered AS MATERIALIZED(SELECT * FROM rows WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false)))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? seller,false))
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? supplier,false)) OR coalesce(f->'suppliers' ? virtual_supplier,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? rede,false)) WHEN 'sem_rede' THEN coalesce(rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR filial=f->>'filial')),
 selected AS MATERIALIZED(SELECT * FROM filtered WHERE
 (coalesce(f->>'month','current')='current' AND source='current') OR (coalesce(f->>'month','current')<>'current' AND source='history' AND day>=target AND day<target+interval '1 month')),
 first_day AS(SELECT target+CASE extract(isodow FROM target)::int WHEN 6 THEN 2 WHEN 7 THEN 1 ELSE 0 END first),
 week_starts AS(SELECT first start FROM first_day UNION SELECT d::date FROM first_day,generate_series(date_trunc('week',first::timestamp)+interval '7 days',target::timestamp+interval '1 month - 1 day',interval '7 days') d),
 weeks AS(SELECT row_number() OVER(ORDER BY start) id,start,least((date_trunc('week',start::timestamp)+interval '6 days')::date,(target+interval '1 month - 1 day')::date) finish FROM week_starts),
 daily AS(SELECT w.id,extract(dow FROM s.day)::int weekday,sum(s.amount) amount FROM weeks w JOIN selected s ON s.day BETWEEN w.start AND w.finish GROUP BY 1,2),
 week_data AS(SELECT w.id,w.start,w.finish "end",coalesce((SELECT sum(amount) FROM daily d WHERE d.id=w.id),0) total,
 (SELECT jsonb_agg(coalesce(d.amount,0) ORDER BY wd) FROM generate_series(0,6) wd LEFT JOIN daily d ON d.id=w.id AND d.weekday=wd) days FROM weeks w),
 best_daily AS(SELECT day,sum(amount) amount FROM filtered WHERE source='history' AND day>=target-interval '1 month' AND day<target GROUP BY day),
 best AS(SELECT extract(dow FROM day)::int wd,greatest(max(amount),0) amount FROM best_daily GROUP BY 1),
 ranks AS(SELECT CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(promotor,'Sem Promotor') ELSE coalesce(seller,'N/A') END code,
 CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(promotor_name,'Sem Promotor') ELSE coalesce(seller_name,seller,'N/A') END name,
 sum(amount) val,count(DISTINCT client) pos FROM selected GROUP BY 1,2)
 SELECT jsonb_build_object('schema_version',1,'reference_date',ref,'target_month',to_char(target,'YYYY-MM'),
 'weeks',coalesce((SELECT jsonb_agg(to_jsonb(w) ORDER BY id) FROM week_data w),'[]'),
 'best_days',(SELECT jsonb_agg(coalesce(b.amount,0) ORDER BY wd) FROM generate_series(0,6) wd LEFT JOIN best b USING(wd)),
 'ranking_fat',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY val DESC,code) FROM(SELECT * FROM ranks ORDER BY val DESC,code LIMIT 10)t),'[]'),
 'ranking_pos',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY pos DESC,val DESC,code) FROM(SELECT * FROM ranks ORDER BY pos DESC,val DESC,code LIMIT 10)t),'[]')) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION dashboard_private.coverage_result_v1(s jsonb,p_filters jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' AS $$
DECLARE f jsonb:=p_filters; ref date; start_date date; end_date date; prev_start date; prev_end date;
 custom_date boolean; alt boolean; result jsonb; days integer:=greatest(coalesce((f->>'working_days')::int,0),0);
BEGIN
 IF jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 SELECT coalesce(max(day) FILTER(WHERE source='current'),max(day),current_date) INTO ref FROM dashboard_private.sales_calendar;
 custom_date:=nullif(f->>'date_start','') IS NOT NULL AND nullif(f->>'date_end','') IS NOT NULL;
 start_date:=CASE WHEN custom_date THEN (f->>'date_start')::date ELSE date_trunc('month',ref)::date END;
 end_date:=CASE WHEN custom_date THEN (f->>'date_end')::date ELSE (start_date+interval '1 month - 1 day')::date END;
 IF end_date<start_date THEN RAISE EXCEPTION 'Período inválido' USING ERRCODE='22023'; END IF;
 prev_start:=(start_date-interval '1 month')::date; prev_end:=(end_date-interval '1 month')::date;
 IF NOT custom_date THEN prev_end:=start_date-1; END IF;
 alt:=coalesce(jsonb_array_length(f->'types'),0)>0 AND NOT(coalesce(f->'types' ? '1',false) OR coalesce(f->'types' ? '9',false));
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 seller_sup AS(SELECT DISTINCT seller,supervisor_name FROM assignments),branches AS(SELECT client,filial FROM assignments),
 base_clients AS MATERIALIZED(SELECT c.* FROM clients c WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR EXISTS(SELECT 1 FROM seller_sup ss WHERE ss.seller=c.rca AND (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? ss.supervisor_name,false))) OR coalesce(jsonb_array_length(f->'supervisors'),0)=0)
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? c.rca,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (coalesce(f->>'filial','ambas') IN('ambas','all') OR EXISTS(SELECT 1 FROM branches b WHERE b.client=c.code AND b.filial=f->>'filial'))),
 scoped AS MATERIALIZED(SELECT d.source,d.codcli client,d.produto product,d.day,d.codusur seller,
 d.vlvenda amount,d.unit_price,d.boxes,CASE WHEN alt THEN d.vlbonific ELSE d.vlvenda END value
 FROM (SELECT * FROM dashboard_private.sales_month_core WHERE NOT custom_date AND f->>'price_min' IS NULL AND f->>'price_max' IS NULL
 UNION ALL SELECT * FROM dashboard_private.sales_month WHERE NOT custom_date AND (f->>'price_min' IS NOT NULL OR f->>'price_max' IS NOT NULL)
 UNION ALL SELECT * FROM dashboard_private.sales_day WHERE custom_date) d
 JOIN base_clients c ON c.code=d.codcli WHERE (coalesce(f->>'filial','ambas') IN('ambas','all') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR coalesce(f->'suppliers' ? d.virtual_supplier,false))
 AND (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false))
 AND (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false))),
 filtered AS NOT MATERIALIZED(SELECT * FROM scoped d WHERE ((f->>'price_min' IS NULL AND f->>'price_max' IS NULL) OR (d.unit_price IS NOT NULL
 AND (f->>'price_min' IS NULL OR d.unit_price>=(f->>'price_min')::numeric)
 AND (f->>'price_max' IS NULL OR d.unit_price<=(f->>'price_max')::numeric)))),
 periods AS MATERIALIZED(
 SELECT r.*,'current'::text period FROM filtered r WHERE (custom_date AND day BETWEEN start_date AND end_date) OR(NOT custom_date AND source='current')
 UNION ALL SELECT r.*,'previous' FROM filtered r WHERE (custom_date AND day BETWEEN prev_start AND prev_end) OR(NOT custom_date AND source='history' AND day BETWEEN prev_start AND prev_end)
 UNION ALL SELECT r.*,'history' FROM filtered r WHERE NOT custom_date AND source='history' AND day NOT BETWEEN prev_start AND prev_end),
 product_clients AS(SELECT product,client,period,sum(value) value FROM periods WHERE period IN('current','previous') GROUP BY 1,2,3),
 product_counts AS(SELECT product,count(*) FILTER(WHERE period='current' AND value>=1) current_count,count(*) FILTER(WHERE period='previous' AND value>=1) previous_count FROM product_clients GROUP BY product),
 selection AS(SELECT client,period,sum(value) value FROM periods WHERE period IN('current','previous') GROUP BY 1,2),
 active_history AS(SELECT client FROM scoped WHERE source='history' GROUP BY client HAVING sum(amount)>=1),
 working AS MATERIALIZED(SELECT DISTINCT day FROM dashboard_private.sales_calendar WHERE extract(isodow FROM day) BETWEEN 1 AND 5
 AND (s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR (source='current' AND codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))))),
 working_array AS(SELECT array_agg(day ORDER BY day) dates FROM working),
 stats_amounts AS(SELECT product,coalesce(sum(boxes) FILTER(WHERE period='current'),0) current_boxes,
 coalesce(sum(boxes) FILTER(WHERE period='previous'),0) previous_boxes,bool_or(day<date_trunc('month',ref)::date) has_history
 FROM periods GROUP BY product),
 stats AS MATERIALIZED(SELECT t.*,coalesce(nullif(p.descricao,''),'Produto '||t.product) description,(pd.dtcadastro AT TIME ZONE 'UTC')::date registered
 FROM stats_amounts t LEFT JOIN public.dim_produtos p ON p.codigo=t.product LEFT JOIN public.data_product_details pd ON pd.code=t.product),
 stock AS(SELECT product_code,sum(coalesce(stock_qty,0)) qty FROM public.data_stock WHERE coalesce(f->>'filial','ambas') IN('ambas','all') OR filial=f->>'filial' GROUP BY product_code),
 divisors AS MATERIALIZED(SELECT t.*,coalesce(st.qty,0) stock,coalesce(pc.current_count,0) current_count,coalesce(pc.previous_count,0) previous_count,
 greatest(1,CASE WHEN NOT coalesce(has_history,false) AND current_boxes>0 THEN least(
 greatest((SELECT count(*) FROM generate_series(date_trunc('month',ref)::date,ref,'1 day') d WHERE extract(isodow FROM d) BETWEEN 1 AND 5),1),
 CASE WHEN days>0 THEN days ELSE greatest((SELECT count(*) FROM generate_series(date_trunc('month',ref)::date,ref,'1 day') d WHERE extract(isodow FROM d) BETWEEN 1 AND 5),1) END)
 ELSE CASE WHEN days>0 THEN least(days,(SELECT count(*) FROM working WHERE registered IS NULL OR day>=registered)) ELSE (SELECT count(*) FROM working WHERE registered IS NULL OR day>=registered) END END)::numeric divisor
 FROM stats t LEFT JOIN stock st ON st.product_code=t.product LEFT JOIN product_counts pc USING(product)),
 -- Daily rows are read only for each product's required trend window, with original price buckets.
 trend_totals AS MATERIALIZED(SELECT dv.product,coalesce(sum(d.boxes*CASE WHEN custom_date THEN
 (CASE WHEN d.day BETWEEN start_date AND end_date THEN 1 ELSE 0 END+CASE WHEN d.day BETWEEN prev_start AND prev_end THEN 1 ELSE 0 END) ELSE 1 END),0)/dv.divisor daily_avg
 FROM divisors dv CROSS JOIN working_array w LEFT JOIN (dashboard_private.sales_day d JOIN base_clients c ON c.code=d.codcli)
 ON d.produto=dv.product AND d.day BETWEEN w.dates[greatest(1,cardinality(w.dates)-dv.divisor::int+1)] AND w.dates[cardinality(w.dates)]
 AND (coalesce(f->>'filial','ambas') IN('ambas','all') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR coalesce(f->'suppliers' ? d.virtual_supplier,false))
 AND (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false))
 AND (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)) AND ((f->>'price_min' IS NULL AND f->>'price_max' IS NULL) OR (d.unit_price IS NOT NULL
 AND (f->>'price_min' IS NULL OR d.unit_price>=(f->>'price_min')::numeric)
 AND (f->>'price_max' IS NULL OR d.unit_price<=(f->>'price_max')::numeric)))
 GROUP BY dv.product,dv.divisor),
 trend AS(SELECT d.*,t.daily_avg FROM divisors d JOIN trend_totals t USING(product)),
 table_all AS MATERIALIZED(SELECT product code,'('||product||') '||description descricao,stock "stockQty",current_boxes "boxesSoldCurrentMonth",previous_boxes "boxesSoldPreviousMonth",
 CASE WHEN previous_boxes>0 THEN (current_boxes-previous_boxes)/previous_boxes*100 WHEN current_boxes>0 THEN NULL ELSE 0 END "boxesVariation",
 CASE WHEN previous_count>0 THEN (current_count-previous_count)::numeric/previous_count*100 WHEN current_count>0 THEN NULL ELSE 0 END "pdvVariation",
 CASE WHEN daily_avg>0 THEN stock/daily_avg WHEN stock>0 THEN NULL ELSE 0 END "trendDays",previous_count "clientsPreviousCount",current_count "clientsCurrentCount",
 CASE WHEN (SELECT count(*) FROM base_clients)>0 THEN current_count::numeric/(SELECT count(*) FROM base_clients)*100 ELSE 0 END "coverageCurrent" FROM trend),
 table_filtered AS MATERIALIZED(SELECT * FROM table_all WHERE "boxesSoldCurrentMonth">0 AND CASE coalesce(f->>'trend','all') WHEN 'low' THEN "trendDays"<15 WHEN 'medium' THEN "trendDays">=15 AND "trendDays"<30 WHEN 'good' THEN "trendDays">=30 ELSE true END),
 cities AS(SELECT c.city name,sum(CASE WHEN coalesce(f->>'metric','boxes')='boxes' THEN r.boxes ELSE r.value END) value FROM periods r JOIN base_clients c ON c.code=r.client WHERE r.period='current' GROUP BY c.city),
 ranking AS(SELECT CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(c.promotor_name,'N/A') ELSE coalesce(v.nome,coalesce(nullif(c.rca,''),r.seller),'N/A') END name,
 sum(CASE WHEN coalesce(f->>'metric','boxes')='boxes' THEN r.boxes ELSE r.value END) value FROM periods r
 JOIN base_clients c ON c.code=r.client LEFT JOIN public.dim_vendedores v ON v.codigo=coalesce(nullif(c.rca,''),r.seller)
 WHERE r.period='current' GROUP BY 1),
 top_product AS(SELECT * FROM table_all WHERE "coverageCurrent">0 ORDER BY "coverageCurrent" DESC,code LIMIT 1)
 SELECT jsonb_build_object('schema_version',1,'reference_date',ref,'active_clients',(SELECT count(*) FROM base_clients),'active_3m',(SELECT count(*) FROM active_history),
 'current_clients',(SELECT count(*) FROM selection WHERE period='current' AND value>=1),'previous_clients',(SELECT count(*) FROM selection WHERE period='previous' AND value>=1),
 'top',coalesce((SELECT to_jsonb(t) FROM top_product t),'null'),
 'rows',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY "stockQty" DESC,code) FROM table_filtered t),'[]'),
 'total_boxes',coalesce((SELECT sum("boxesSoldCurrentMonth") FROM table_filtered),0),
 'chart_total',coalesce((SELECT sum(value) FROM cities),0),
 'cities',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY value DESC,name) FROM(SELECT * FROM cities ORDER BY value DESC,name LIMIT 10)t),'[]'),
 'ranking',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY value DESC,name) FROM(SELECT * FROM ranking ORDER BY value DESC,name LIMIT 10)t),'[]')) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.get_coverage_page_v1(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET plan_cache_mode='force_custom_plan' SET jit='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); result jsonb;
BEGIN
 IF jsonb_typeof(p_filters)<>'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 IF s->>'kind'='admin' THEN
  SELECT payload INTO result FROM dashboard_private.page_rollups WHERE page='coverage' AND cache_key=dashboard_private.normalize_page_filters_v1(p_filters);
  IF FOUND THEN RETURN result; END IF;
 END IF;
 RETURN dashboard_private.coverage_result_v1(s,p_filters);
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA dashboard_private FROM PUBLIC,anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA dashboard_private TO authenticated;
REVOKE ALL ON FUNCTION public.get_dashboard_filters_v1(text,jsonb),public.get_coverage_page_v1(jsonb),public.get_weekly_page_v1(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_filters_v1(text,jsonb),public.get_coverage_page_v1(jsonb),public.get_weekly_page_v1(jsonb) TO authenticated;

-- Mesma autorização de leitura, avaliada uma vez por consulta.
ALTER POLICY "Acesso Leitura Unificado" ON public.data_product_details USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.data_stock USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.dim_vendedores USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.dim_supervisores USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
NOTIFY pgrst,'reload schema';


-- Migration 20261002231606 comparison_kpis_shared_summary_v1
-- Etapa 1: KPIs do Comparativo. Filtros de carteira ainda vêm do fluxo legado.
-- A lista de clientes é uma seleção, NÃO uma autorização; RLS continua aplicada.
-- Não executar o consolidado inteiro para instalar esta função.
CREATE OR REPLACE FUNCTION public.get_comparison_kpis_v1(p_filters jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = '' SET statement_timeout = '15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB'
AS $fn$
DECLARE
  result jsonb;
  ref_date date := (p_filters->>'reference_date')::date;
  client_codes text[];
  suppliers text[];
  products text[];
  types text[];
  holidays text[];
  alt_mode boolean;
  total_days integer;
  passed_days integer;
  ratio numeric := 1;
  caller_role text;
  allowed_clients text[];
  is_admin boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_admin() OR public.is_approved()) THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;
  SELECT lower(btrim(role)) INTO caller_role FROM public.profiles WHERE id=auth.uid();
  is_admin := caller_role='adm';
  -- Carteira derivada da sessão. Os códigos enviados só restringem o resultado.
  SELECT array_agg(cp.client_code) INTO allowed_clients
  FROM public.data_client_promoters cp
  WHERE lower(btrim(cp.promoter_code))=caller_role OR EXISTS (
    SELECT 1 FROM public.data_hierarchy h
    WHERE lower(btrim(h.cod_promotor))=lower(btrim(cp.promoter_code))
      AND caller_role IN (lower(btrim(h.cod_coord)),lower(btrim(h.cod_cocoord)),lower(btrim(h.cod_promotor)))
  );
  IF allowed_clients IS NULL AND EXISTS (
    SELECT 1 FROM public.data_hierarchy h WHERE caller_role IN
      (lower(btrim(h.cod_coord)),lower(btrim(h.cod_cocoord)),lower(btrim(h.cod_promotor)))) THEN
    allowed_clients := ARRAY[]::text[];
  END IF;
  IF jsonb_typeof(p_filters) <> 'object' OR ref_date IS NULL
     OR jsonb_typeof(p_filters->'client_codes') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'reference_date e client_codes são obrigatórios' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(array_agg(value), ARRAY[]::text[]) INTO client_codes FROM jsonb_array_elements_text(p_filters->'client_codes');
  SELECT coalesce(array_agg(value), ARRAY[]::text[]) INTO suppliers FROM jsonb_array_elements_text(coalesce(p_filters->'suppliers','[]'));
  SELECT coalesce(array_agg(value), ARRAY[]::text[]) INTO products FROM jsonb_array_elements_text(coalesce(p_filters->'products','[]'));
  SELECT coalesce(array_agg(value), ARRAY[]::text[]) INTO types FROM jsonb_array_elements_text(coalesce(p_filters->'types','[]'));
  SELECT coalesce(array_agg(value), ARRAY[]::text[]) INTO holidays FROM jsonb_array_elements_text(coalesce(p_filters->'holidays','[]'));
  alt_mode := cardinality(types)>0 AND NOT ('1'=ANY(types) OR '9'=ANY(types));
  SELECT count(*), greatest(count(*) FILTER(WHERE d::date<=ref_date),1)
  INTO total_days, passed_days
  FROM pg_catalog.generate_series(date_trunc('month',ref_date::timestamp), date_trunc('month',ref_date::timestamp)+interval '1 month - 1 day', interval '1 day') d
  WHERE extract(isodow FROM d) BETWEEN 1 AND 5 AND NOT (to_char(d,'YYYY-MM-DD')=ANY(holidays));
  IF coalesce((p_filters->>'tendency')::boolean,false) AND passed_days<total_days AND total_days>0 THEN
    ratio := total_days::numeric/passed_days;
  END IF;

  WITH selected_clients AS MATERIALIZED (
    SELECT DISTINCT unnest(client_codes) codcli
  ), client_info AS MATERIALIZED (
    SELECT codigo_cliente,cidade,ramo FROM public.data_clients
  ), product_info AS MATERIALIZED (
    SELECT codigo,descricao,
      (CASE WHEN upper(descricao) LIKE '%CHEETOS%' THEN 1 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%DORITOS%' THEN 2 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%FANDANGOS%' THEN 4 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%RUFFLES%' THEN 8 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%TORCIDA%' THEN 16 ELSE 0 END) salty_mask,
      (CASE WHEN upper(descricao) LIKE '%TODDYNHO%' THEN 1 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%TODDY %' THEN 2 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%QUAKER%' THEN 4 ELSE 0 END +
       CASE WHEN upper(descricao) LIKE '%KEROCOCO%' THEN 8 ELSE 0 END) foods_mask
    FROM public.dim_produtos
  ), supplier_info AS MATERIALIZED (
    SELECT codigo,pasta,nome FROM public.dim_fornecedores
  ), filtered AS MATERIALIZED (
    SELECT r.source,r.codcli,r.produto,r.codfor,r.tipovenda,r.totpesoliq,c.ramo,
      CASE WHEN alt_mode THEN coalesce(r.vlbonific,0) ELSE coalesce(r.vlvenda,0) END amount,
      to_char(r.dtped AT TIME ZONE 'UTC','YYYY-MM') month_key,r.vlbonific
    FROM (
    SELECT source, codcli, produto, codfor, filial, tipovenda, day::timestamp AT TIME ZONE 'UTC' dtped,
           vlvenda, vlbonific, totpesoliq, observacaofor FROM dashboard_private.sales_month_core
    WHERE source='current' AND codcli IN (SELECT codcli FROM selected_clients) AND (is_admin OR (allowed_clients IS NOT NULL AND codcli=ANY(allowed_clients))
      OR (allowed_clients IS NULL AND lower(btrim(codusur))=caller_role))
    UNION ALL
    SELECT source, codcli, produto, codfor, filial, tipovenda, day::timestamp AT TIME ZONE 'UTC',
           vlvenda, vlbonific, totpesoliq, observacaofor FROM dashboard_private.sales_month_core
    WHERE source='history' AND codcli IN (SELECT codcli FROM selected_clients) AND (is_admin OR (allowed_clients IS NOT NULL AND codcli=ANY(allowed_clients))
      OR (allowed_clients IS NULL AND lower(btrim(codusur))=caller_role))
    ) r
    LEFT JOIN client_info c ON c.codigo_cliente=r.codcli
    LEFT JOIN product_info dp ON dp.codigo=r.produto
    LEFT JOIN supplier_info df ON df.codigo=r.codfor
    WHERE (coalesce(p_filters->>'filial','ambas')='ambas' OR r.filial=p_filters->>'filial')
      AND (coalesce(p_filters->>'city','')='' OR lower(coalesce(c.cidade,'N/A'))=p_filters->>'city')
      AND (coalesce(p_filters->>'pasta','')='' OR (CASE WHEN coalesce(r.observacaofor,'') NOT IN ('','0','00','N/A') THEN r.observacaofor WHEN coalesce(df.pasta,'')<>'' THEN df.pasta WHEN upper(coalesce(df.nome,r.codfor)) LIKE '%PEPSICO%' THEN 'PEPSICO' ELSE 'MULTIMARCAS' END)=p_filters->>'pasta')
      AND (cardinality(products)=0 OR r.produto=ANY(products))
      AND (cardinality(suppliers)=0 OR r.codfor=ANY(suppliers) OR
        (r.codfor='1119' AND (CASE
          WHEN upper(coalesce(nullif(dp.descricao,''),'Produto '||btrim(r.produto))) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO'
          WHEN upper(coalesce(nullif(dp.descricao,''),'Produto '||btrim(r.produto))) LIKE '%TODDY%' THEN '1119_TODDY'
          WHEN upper(coalesce(nullif(dp.descricao,''),'Produto '||btrim(r.produto))) LIKE '%QUAKER%' OR upper(coalesce(nullif(dp.descricao,''),'Produto '||btrim(r.produto))) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO'
          END)=ANY(suppliers)))
  ), sales AS MATERIALIZED (
    SELECT * FROM filtered
    WHERE (cardinality(types)=0 OR tipovenda=ANY(types)) AND (alt_mode OR tipovenda IN ('1','9'))
  ), totals AS (
    SELECT source,sum(amount) fat,sum(coalesce(totpesoliq,0)) peso FROM sales GROUP BY source
  ), losses AS (
    SELECT source,sum(coalesce(vlbonific,0)) perdas FROM filtered
    WHERE tipovenda='5' AND upper(coalesce(ramo,'')) NOT LIKE '%AMERICANAS%' AND upper(coalesce(ramo,'')) NOT LIKE '%BH%'
    GROUP BY source
  ), client_totals AS (
    SELECT source,CASE WHEN source='current' THEN '' ELSE month_key END m,codcli,sum(amount) amount
    FROM sales WHERE codcli IS NOT NULL AND codcli<>'' AND (source='current' OR month_key IS NOT NULL)
    GROUP BY 1,2,3
  ), client_counts AS (
    SELECT source,m,count(*) FILTER(WHERE amount>=1) clients FROM client_totals GROUP BY 1,2
  ), product_totals AS (
    SELECT source,CASE WHEN source='current' THEN '' ELSE month_key END m,codcli,produto,
      min(codfor) codfor,sum(amount) amount
    FROM sales WHERE codcli IS NOT NULL AND codcli<>'' AND (source='current' OR month_key IS NOT NULL)
    GROUP BY 1,2,3,4
  ), mixes AS (
    SELECT source,m,codcli,
      count(*) FILTER(WHERE amount>=1 AND codfor IN ('707','708','752')) mix,
      bit_or(CASE WHEN amount>=1 THEN coalesce(pi.salty_mask,0) ELSE 0 END)=31 salty,
      bit_or(CASE WHEN amount>=1 THEN coalesce(pi.foods_mask,0) ELSE 0 END)=15 foods
    FROM product_totals pt LEFT JOIN product_info pi ON pi.codigo=pt.produto GROUP BY source,m,codcli
  ), month_mix AS (
    SELECT source,m,coalesce(avg(mix) FILTER(WHERE mix>0),0) mix,
      count(*) FILTER(WHERE salty) salty,count(*) FILTER(WHERE foods) foods FROM mixes GROUP BY 1,2
  ), latest AS (
    SELECT month_key FROM sales WHERE source='history' AND month_key IS NOT NULL GROUP BY month_key ORDER BY month_key DESC LIMIT 3
  ), kpis AS (
    SELECT 'current' source,
      coalesce((SELECT clients FROM client_counts WHERE source='current'),0)::numeric clients,
      coalesce((SELECT mix FROM month_mix WHERE source='current'),0) mix,
      coalesce((SELECT salty FROM month_mix WHERE source='current'),0)::numeric salty,
      coalesce((SELECT foods FROM month_mix WHERE source='current'),0)::numeric foods
    UNION ALL
    SELECT 'history',
      coalesce((SELECT sum(clients) FROM client_counts WHERE source='history' AND m IN(SELECT month_key FROM latest)),0)/3.0,
      coalesce((SELECT sum(mix) FROM month_mix WHERE source='history' AND m IN(SELECT month_key FROM latest)),0)/3.0,
      coalesce((SELECT sum(salty) FROM month_mix WHERE source='history' AND m IN(SELECT month_key FROM latest)),0)/3.0,
      coalesce((SELECT sum(foods) FROM month_mix WHERE source='history' AND m IN(SELECT month_key FROM latest)),0)/3.0
  ), final AS (
    SELECT k.source,coalesce(t.fat,0)/CASE WHEN k.source='current' THEN 1 ELSE 3.0 END*CASE WHEN k.source='current' THEN ratio ELSE 1 END fat,
      coalesce(t.peso,0)/CASE WHEN k.source='current' THEN 1 ELSE 3.0 END*CASE WHEN k.source='current' THEN ratio ELSE 1 END peso,
      CASE WHEN k.source='current' AND ratio<>1 THEN floor(k.clients*ratio+0.5) ELSE k.clients END clients,
      k.mix,
      CASE WHEN k.source='current' AND ratio<>1 THEN floor(k.salty*ratio+0.5) ELSE k.salty END salty,
      CASE WHEN k.source='current' AND ratio<>1 THEN floor(k.foods*ratio+0.5) ELSE k.foods END foods,
      coalesce(l.perdas,0)/CASE WHEN k.source='current' THEN 1 ELSE 3.0 END*CASE WHEN k.source='current' THEN ratio ELSE 1 END perdas
    FROM kpis k LEFT JOIN totals t USING(source) LEFT JOIN losses l USING(source)
  )
  SELECT jsonb_build_object('schema_version',1,'reference_date',ref_date,'tendency_ratio',ratio,
    'kpis',jsonb_object_agg(source,jsonb_build_object('fat',fat,'peso',peso,'clients',clients,'mixPepsico',mix,
      'positivacaoSalty',salty,'positivacaoFoods',foods,'perdas',perdas,'ticket',CASE WHEN clients>0 THEN fat/clients ELSE 0 END)))
  INTO result FROM final;
  RETURN result;
END;
$fn$;
REVOKE ALL ON FUNCTION public.get_comparison_kpis_v1(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_comparison_kpis_v1(jsonb) TO authenticated;


-- Migration 20261002231609 titles_shared_summary_v1
-- Títulos: KPIs resumidos por cliente/vencimento; linhas originais e paginação preservadas.
CREATE OR REPLACE FUNCTION public.get_titulos_view_data(p_filial text[] DEFAULT NULL::text[], p_cidade text[] DEFAULT NULL::text[], p_supervisor text[] DEFAULT NULL::text[], p_vendedor text[] DEFAULT NULL::text[], p_rede text[] DEFAULT NULL::text[], p_search text DEFAULT NULL::text, p_coordenador text[] DEFAULT NULL::text[], p_cocoordenador text[] DEFAULT NULL::text[], p_page integer DEFAULT 0, p_limit integer DEFAULT 50)
 RETURNS json
 LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET plan_cache_mode='force_custom_plan' SET jit='off' AS $function$
DECLARE s jsonb:=dashboard_private.scope_v1(); result json; v_critical_date date:=CURRENT_DATE-60;
BEGIN
 IF p_page<0 OR p_limit<1 THEN RAISE EXCEPTION 'Paginação inválida' USING ERRCODE='22023'; END IF;
 WITH authorized AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 filtered AS MATERIALIZED(SELECT
        t.cod_cliente,
        t.vl_titulos,
        t.vl_receber,
        t.dt_vencimento,t.row_count,t.positive_receber,
        COALESCE(c.nomecliente, c.razaosocial, c.fantasia, 'Desconhecido') AS nomecliente,
        COALESCE(c.cidade, 'N/A') AS cidade,
        COALESCE(c.rca1, 'N/A') AS vendedor_nome,
        c.ramo,
        c.filial,
        c.supervisor
    FROM dashboard_private.receivables_summary t
    LEFT JOIN public.data_clients c ON (
        COALESCE(c.codigo_cliente, c.cod_cliente, '')::text = t.cod_cliente::text
        OR TRIM(LEADING '0' FROM COALESCE(c.codigo_cliente, c.cod_cliente, '')::text) = TRIM(LEADING '0' FROM t.cod_cliente::text)
    )
    WHERE (p_cidade IS NULL OR c.cidade = ANY(p_cidade))
      AND (
          p_filial IS NULL
          OR c.filial = ANY(p_filial)
          OR TRIM(c.filial) = ANY(p_filial)
          OR TRIM(LEADING '0' FROM COALESCE(c.filial, '')) = ANY(
              SELECT TRIM(LEADING '0' FROM elem) FROM unnest(p_filial) AS elem
          )
          OR LPAD(TRIM(COALESCE(c.filial, '')), 2, '0') = ANY(
              SELECT LPAD(TRIM(elem), 2, '0') FROM unnest(p_filial) AS elem
          )
          OR EXISTS (
              SELECT 1 FROM unnest(p_filial) elem
              WHERE c.filial ILIKE '%' || elem || '%'
          )
          OR EXISTS (
              SELECT 1 FROM public.config_city_branches ccb
              WHERE UPPER(ccb.cidade) = UPPER(COALESCE(c.cidade, ''))
                AND (
                    ccb.filial = ANY(p_filial)
                    OR TRIM(ccb.filial) = ANY(p_filial)
                    OR TRIM(LEADING '0' FROM COALESCE(ccb.filial, '')) = ANY(
                        SELECT TRIM(LEADING '0' FROM elem) FROM unnest(p_filial) AS elem
                    )
                    OR LPAD(TRIM(COALESCE(ccb.filial, '')), 2, '0') = ANY(
                        SELECT LPAD(TRIM(elem), 2, '0') FROM unnest(p_filial) AS elem
                    )
                )
          )
      )
      AND (
          p_supervisor IS NULL
          OR c.supervisor = ANY(p_supervisor)
          OR c.cod_supervisor = ANY(p_supervisor)
          OR UPPER(TRIM(COALESCE(c.supervisor, ''))) = ANY(SELECT UPPER(TRIM(elem)) FROM unnest(p_supervisor) AS elem)
          OR UPPER(TRIM(COALESCE(c.cod_supervisor, ''))) = ANY(SELECT UPPER(TRIM(elem)) FROM unnest(p_supervisor) AS elem)
          OR EXISTS (
              SELECT 1 FROM unnest(p_supervisor) elem
              WHERE (c.supervisor IS NOT NULL AND (c.supervisor ILIKE '%' || elem || '%' OR elem ILIKE '%' || c.supervisor || '%'))
                 OR (c.cod_supervisor IS NOT NULL AND (c.cod_supervisor ILIKE '%' || elem || '%' OR elem ILIKE '%' || c.cod_supervisor || '%'))
                 OR (elem LIKE '% - %' AND (
                     c.supervisor ILIKE '%' || trim(split_part(elem, ' - ', 2)) || '%'
                     OR c.cod_supervisor = trim(split_part(elem, ' - ', 1))
                 ))
          )
          OR EXISTS (
              SELECT 1 FROM public.data_clients c2
              WHERE (
                  (c2.rca1 IS NOT NULL AND c2.rca1 <> '' AND c2.rca1 = c.rca1)
                  OR (c2.vendedor_codigo IS NOT NULL AND c2.vendedor_codigo <> '' AND c2.vendedor_codigo = c.vendedor_codigo)
              )
              AND (
                  c2.supervisor = ANY(p_supervisor)
                  OR c2.cod_supervisor = ANY(p_supervisor)
                  OR UPPER(TRIM(COALESCE(c2.supervisor, ''))) = ANY(SELECT UPPER(TRIM(elem)) FROM unnest(p_supervisor) AS elem)
                  OR EXISTS (
                      SELECT 1 FROM unnest(p_supervisor) elem
                      WHERE c2.supervisor ILIKE '%' || elem || '%'
                         OR elem ILIKE '%' || c2.supervisor || '%'
                         OR (elem LIKE '% - %' AND (
                             c2.supervisor ILIKE '%' || trim(split_part(elem, ' - ', 2)) || '%'
                             OR c2.cod_supervisor = trim(split_part(elem, ' - ', 1))
                         ))
                  )
              )
          )
                    OR EXISTS (
              SELECT 1 FROM public.data_orders o
              WHERE (o.codcli = COALESCE(c.codigo_cliente, c.cod_cliente, ''))
                AND (
                    o.superv = ANY(p_supervisor)
                    OR EXISTS (
                        SELECT 1 FROM unnest(p_supervisor) elem
                        WHERE o.superv ILIKE '%' || elem || '%'
                           OR elem ILIKE '%' || o.superv || '%'
                           OR (elem LIKE '% - %' AND (
                               o.superv ILIKE '%' || trim(split_part(elem, ' - ', 2)) || '%'
                           ))
                    )
                )
          )
      )
      AND (
          p_vendedor IS NULL
          OR c.rca1 = ANY(p_vendedor)
          OR c.vendedor = ANY(p_vendedor)
          OR c.vendedor_codigo = ANY(p_vendedor)
      )
      AND (
          p_coordenador IS NULL
          OR EXISTS (
              SELECT 1 FROM public.data_hierarchy dh
              LEFT JOIN public.data_client_promoters dcp ON dcp.promoter_code = dh.cod_promotor
              WHERE (dh.nome_coord = ANY(p_coordenador) OR dh.cod_coord = ANY(p_coordenador))
                AND (
                    dcp.client_code = COALESCE(c.codigo_cliente, c.cod_cliente)
                    OR dh.cod_promotor = c.rca1
                    OR dh.cod_promotor = c.vendedor_codigo
                )
          )
      )
      AND (
          p_cocoordenador IS NULL
          OR EXISTS (
              SELECT 1 FROM public.data_hierarchy dh
              LEFT JOIN public.data_client_promoters dcp ON dcp.promoter_code = dh.cod_promotor
              WHERE (dh.nome_cocoord = ANY(p_cocoordenador) OR dh.cod_cocoord = ANY(p_cocoordenador))
                AND (
                    dcp.client_code = COALESCE(c.codigo_cliente, c.cod_cliente)
                    OR dh.cod_promotor = c.rca1
                    OR dh.cod_promotor = c.vendedor_codigo
                )
          )
      )
      AND (
          p_rede IS NULL
          OR (array_position(p_rede, 'C/ REDE') IS NOT NULL AND (c.ramo IS NOT NULL AND c.ramo <> '' AND c.ramo <> 'N/A'))
          OR (array_position(p_rede, 'S/ REDE') IS NOT NULL AND (c.ramo IS NULL OR c.ramo = '' OR c.ramo = 'N/A'))
          OR (c.ramo = ANY(p_rede))
      )
      AND (
          p_search IS NULL
          OR p_search = ''
          OR t.cod_cliente::text ILIKE '%' || p_search || '%'
          OR c.nomecliente ILIKE '%' || p_search || '%'
          OR c.razaosocial ILIKE '%' || p_search || '%'
          OR c.fantasia ILIKE '%' || p_search || '%'
      ) AND (s->>'kind'='admin' OR EXISTS(SELECT 1 FROM authorized ac WHERE
 ac.code=COALESCE(c.codigo_cliente,c.cod_cliente,'') OR ac.code=t.cod_cliente
 OR ltrim(ac.code,'0')=ltrim(t.cod_cliente,'0')))),
 rows AS(SELECT t.cod_cliente,t.vl_titulos,t.vl_receber,t.dt_vencimento,f.nomecliente,f.cidade,f.vendedor_nome,f.ramo
 FROM public.data_titulos t JOIN filtered f ON f.cod_cliente=t.cod_cliente AND f.dt_vencimento IS NOT DISTINCT FROM t.dt_vencimento
 ORDER BY t.dt_vencimento ASC NULLS LAST,t.cod_cliente ASC OFFSET (p_page*p_limit) LIMIT p_limit)
 SELECT json_build_object('kpis',json_build_object(
 'total_rows',coalesce((SELECT sum(row_count) FROM filtered),0),
 'total_vl_receber',coalesce((SELECT sum(vl_receber) FROM filtered),0),
 'critical_vl_receber',coalesce((SELECT sum(positive_receber) FROM filtered WHERE dt_vencimento<v_critical_date),0),
 'critical_clients',(SELECT count(DISTINCT cod_cliente) FROM filtered WHERE dt_vencimento<v_critical_date AND positive_receber>0)),
 'rows',coalesce((SELECT json_agg(r) FROM rows r),'[]'::json)) INTO result;
 RETURN result;
END $function$;
REVOKE ALL ON FUNCTION public.get_titulos_view_data(text[],text[],text[],text[],text[],text,text[],text[],integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_titulos_view_data(text[],text[],text[],text[],text[],text,text[],text[],integer,integer) TO authenticated;


-- Migration 20261002231752 shared_summary_import_refresh_and_wallet_assignments
-- Resumos privados: nenhuma mudança nas tabelas originais ou nos downloads legados.
CREATE TABLE IF NOT EXISTS dashboard_private.summary_state (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), dirty boolean NOT NULL DEFAULT true,
 generation bigint NOT NULL DEFAULT 0, refreshed_at timestamptz, last_change timestamptz NOT NULL DEFAULT clock_timestamp());
INSERT INTO dashboard_private.summary_state(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS dashboard_private.sales_day (
 source text NOT NULL, codcli text, produto text, codfor text, filial text, tipovenda text,
 codusur text,codsupervisor text,day date,unit_price numeric,virtual_supplier text,observacaofor text,
 vlvenda numeric NOT NULL,vlbonific numeric NOT NULL,qtvenda numeric NOT NULL,boxes numeric NOT NULL,totpesoliq numeric NOT NULL,
 row_count bigint NOT NULL);
CREATE TABLE IF NOT EXISTS dashboard_private.sales_month (LIKE dashboard_private.sales_day INCLUDING ALL);
CREATE TABLE IF NOT EXISTS dashboard_private.sales_month_core (LIKE dashboard_private.sales_day INCLUDING ALL);
CREATE TABLE IF NOT EXISTS dashboard_private.page_rollups(page text NOT NULL,cache_key jsonb NOT NULL,payload jsonb NOT NULL,PRIMARY KEY(page,cache_key));
CREATE TABLE IF NOT EXISTS dashboard_private.product_suppliers(product text,supplier text,virtual_supplier text);
CREATE TABLE IF NOT EXISTS dashboard_private.receivables_summary(cod_cliente text,dt_vencimento timestamptz,vl_titulos numeric,vl_receber numeric,
 qt_titulos numeric,qt_tit_receber numeric,positive_receber numeric,row_count bigint);
CREATE INDEX IF NOT EXISTS receivables_client_due ON dashboard_private.receivables_summary(cod_cliente,dt_vencimento);
CREATE INDEX IF NOT EXISTS sales_month_core_client ON dashboard_private.sales_month_core(codcli,source);
CREATE INDEX IF NOT EXISTS sales_month_core_supplier ON dashboard_private.sales_month_core(codfor,source);
CREATE TABLE IF NOT EXISTS dashboard_private.weekly_day (
 source text NOT NULL,codcli text,codfor text,filial text,codusur text,codsupervisor text,
 day date,virtual_supplier text,vlvenda numeric NOT NULL);
CREATE TABLE IF NOT EXISTS dashboard_private.sales_facets (
 source text NOT NULL,codcli text,produto text,codfor text,filial text,tipovenda text,day date);
CREATE TABLE IF NOT EXISTS dashboard_private.sales_calendar (source text NOT NULL,codcli text,day date);
CREATE TABLE IF NOT EXISTS dashboard_private.client_assignments (
 client text PRIMARY KEY,seller text,supervisor text,supervisor_name text,filial text);
ALTER TABLE dashboard_private.client_assignments ADD COLUMN IF NOT EXISTS raw_supervisor text;
ALTER TABLE dashboard_private.client_assignments ADD COLUMN IF NOT EXISTS branch_date timestamptz;
ALTER TABLE dashboard_private.client_assignments ADD COLUMN IF NOT EXISTS branch_source text;
CREATE INDEX IF NOT EXISTS sales_day_client_date ON dashboard_private.sales_day(codcli,day);
CREATE INDEX IF NOT EXISTS sales_day_supplier_date ON dashboard_private.sales_day(codfor,day);
CREATE INDEX IF NOT EXISTS sales_day_product_date ON dashboard_private.sales_day(produto,day);
CREATE INDEX IF NOT EXISTS sales_month_client ON dashboard_private.sales_month(codcli,source);
CREATE INDEX IF NOT EXISTS sales_month_supplier ON dashboard_private.sales_month(codfor,source);
CREATE INDEX IF NOT EXISTS sales_month_product ON dashboard_private.sales_month(produto,source);
CREATE INDEX IF NOT EXISTS weekly_day_client_date ON dashboard_private.weekly_day(codcli,day);
CREATE INDEX IF NOT EXISTS weekly_day_supplier_date ON dashboard_private.weekly_day(codfor,day);
CREATE INDEX IF NOT EXISTS facets_client ON dashboard_private.sales_facets(codcli);
CREATE INDEX IF NOT EXISTS facets_supplier ON dashboard_private.sales_facets(codfor);
CREATE INDEX IF NOT EXISTS calendar_date ON dashboard_private.sales_calendar(source,day DESC);
CREATE INDEX IF NOT EXISTS calendar_client ON dashboard_private.sales_calendar(codcli,day);

-- Same approved-reader policy as the underlying tables; API endpoints still derive the wallet.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['summary_state','sales_day','sales_month','sales_month_core','weekly_day','sales_facets','sales_calendar','client_assignments','page_rollups','product_suppliers','receivables_summary'] LOOP
  EXECUTE format('ALTER TABLE dashboard_private.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON dashboard_private.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT SELECT ON dashboard_private.%I TO authenticated',t);
  EXECUTE format('DROP POLICY IF EXISTS summary_read ON dashboard_private.%I',t);
  EXECUTE format('CREATE POLICY summary_read ON dashboard_private.%I FOR SELECT TO authenticated USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()))',t);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION dashboard_private.assignment_branches_v1(s jsonb)
RETURNS TABLE(client text,seller text,supervisor text,supervisor_name text,filial text,raw_supervisor text,branch_date timestamptz,branch_source text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 raw AS MATERIALIZED(
 SELECT 'current'::text source,codcli,coalesce(nullif(c.rca,''),codusur) seller,codsupervisor,filial,dtped FROM public.data_detailed d LEFT JOIN clients c ON c.code=d.codcli
 WHERE s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))
 UNION ALL SELECT 'history',codcli,coalesce(nullif(c.rca,''),codusur),codsupervisor,filial,dtped FROM public.data_history d LEFT JOIN clients c ON c.code=d.codcli
 WHERE s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients'))),
 branch AS MATERIALIZED(SELECT DISTINCT ON(codcli) codcli,seller,filial,codsupervisor,dtped,source FROM raw ORDER BY codcli,source,dtped DESC NULLS LAST,filial),
 sup AS(SELECT DISTINCT ON(seller) seller,codsupervisor FROM branch ORDER BY seller,dtped DESC NULLS LAST,source,codsupervisor)
 SELECT coalesce(c.code,b.codcli),coalesce(nullif(c.rca,''),b.seller),sup.codsupervisor,coalesce(ds.nome,sup.codsupervisor,'N/A'),b.filial,b.codsupervisor,b.dtped,b.source
 FROM clients c FULL JOIN branch b ON b.codcli=c.code LEFT JOIN sup ON sup.seller=coalesce(nullif(c.rca,''),b.seller)
 LEFT JOIN public.dim_supervisores ds ON ds.codigo=sup.codsupervisor;
$$;

-- Privileged writer lives outside the exposed schema and checks its caller.
CREATE OR REPLACE FUNCTION dashboard_private.refresh_summaries_v1(force_refresh boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' SET jit='off' SET work_mem='32MB' AS $$
DECLARE st dashboard_private.summary_state; result jsonb;
BEGIN
 IF NOT ((auth.uid() IS NOT NULL AND public.is_admin()) OR (auth.uid() IS NULL AND (session_user IN('postgres','supabase_admin') OR current_setting('role',true)='service_role'))) THEN
  RAISE EXCEPTION 'Atualização reservada ao administrador' USING ERRCODE='42501';
 END IF;
 IF NOT pg_try_advisory_xact_lock(70261002,1) THEN RETURN jsonb_build_object('status','busy'); END IF;
 SELECT * INTO st FROM dashboard_private.summary_state WHERE id=true FOR UPDATE;
 IF NOT force_refresh AND NOT st.dirty THEN RETURN jsonb_build_object('status','current','generation',st.generation); END IF;
 -- The state row lock serializes committed source changes with this consistent rebuild.
 -- DELETE/INSERT is atomic under MVCC: concurrent readers keep the previous complete generation.
 DELETE FROM dashboard_private.sales_day;
 INSERT INTO dashboard_private.sales_day
 WITH raw AS MATERIALIZED(
  SELECT 'current'::text source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,
   (dtped AT TIME ZONE 'UTC')::date AS day,coalesce(vlvenda,0) amount,coalesce(vlbonific,0) bonus,coalesce(qtvenda,0) units,coalesce(totpesoliq,0) peso,observacaofor FROM public.data_detailed
  UNION ALL SELECT 'history',codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,
   (dtped AT TIME ZONE 'UTC')::date,coalesce(vlvenda,0),coalesce(vlbonific,0),coalesce(qtvenda,0),coalesce(totpesoliq,0),observacaofor FROM public.data_history),
 enriched AS(SELECT r.*,CASE WHEN units<>0 THEN amount/units END unit_price,
  units/CASE WHEN p.qtde_master>0 THEN p.qtde_master ELSE 1 END boxes,
  CASE WHEN r.codfor='1119' THEN CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END virtual_supplier
  FROM raw r LEFT JOIN public.dim_produtos p ON p.codigo=r.produto)
 SELECT source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,day,unit_price,virtual_supplier,observacaofor,
 sum(amount),sum(bonus),sum(units),sum(boxes),sum(peso),count(*) FROM enriched
 GROUP BY source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,day,unit_price,virtual_supplier,observacaofor;
 DELETE FROM dashboard_private.sales_month;
 INSERT INTO dashboard_private.sales_month
 SELECT source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,date_trunc('month',day)::date,unit_price,virtual_supplier,observacaofor,
 sum(vlvenda),sum(vlbonific),sum(qtvenda),sum(boxes),sum(totpesoliq),sum(row_count)
 FROM dashboard_private.sales_day GROUP BY source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,date_trunc('month',day)::date,unit_price,virtual_supplier,observacaofor;
 DELETE FROM dashboard_private.sales_month_core;
 INSERT INTO dashboard_private.sales_month_core SELECT source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,day,NULL::numeric,virtual_supplier,observacaofor,
 sum(vlvenda),sum(vlbonific),sum(qtvenda),sum(boxes),sum(totpesoliq),sum(row_count) FROM dashboard_private.sales_month
 GROUP BY source,codcli,produto,codfor,filial,tipovenda,codusur,codsupervisor,day,virtual_supplier,observacaofor;
 DELETE FROM dashboard_private.product_suppliers;
 INSERT INTO dashboard_private.product_suppliers SELECT DISTINCT produto,codfor,virtual_supplier FROM dashboard_private.sales_day;
 DELETE FROM dashboard_private.receivables_summary;
 INSERT INTO dashboard_private.receivables_summary SELECT cod_cliente,dt_vencimento,sum(coalesce(vl_titulos,0)),sum(coalesce(vl_receber,0)),
 sum(coalesce(qt_titulos,0)),sum(coalesce(qt_tit_receber,0)),sum(CASE WHEN vl_receber>0 THEN vl_receber ELSE 0 END),count(*)
 FROM public.data_titulos GROUP BY cod_cliente,dt_vencimento;
 DELETE FROM dashboard_private.weekly_day;
 INSERT INTO dashboard_private.weekly_day SELECT source,codcli,codfor,filial,codusur,codsupervisor,day,virtual_supplier,sum(vlvenda)
 FROM dashboard_private.sales_day GROUP BY source,codcli,codfor,filial,codusur,codsupervisor,day,virtual_supplier;
 DELETE FROM dashboard_private.sales_facets;
 INSERT INTO dashboard_private.sales_facets SELECT source,codcli,produto,codfor,filial,tipovenda,max(day)
 FROM dashboard_private.sales_day GROUP BY source,codcli,produto,codfor,filial,tipovenda,date_trunc('month',day);
 DELETE FROM dashboard_private.sales_calendar;
 INSERT INTO dashboard_private.sales_calendar SELECT DISTINCT source,codcli,day FROM dashboard_private.sales_day;
 DELETE FROM dashboard_private.client_assignments;
 INSERT INTO dashboard_private.client_assignments SELECT * FROM dashboard_private.assignment_branches_v1('{"kind":"admin"}') WHERE client IS NOT NULL;
 DELETE FROM dashboard_private.page_rollups;
 IF to_regprocedure('dashboard_private.coverage_result_v1(jsonb,jsonb)') IS NOT NULL THEN
  INSERT INTO dashboard_private.page_rollups VALUES('coverage','{}',dashboard_private.coverage_result_v1('{"kind":"admin"}','{}')),
  ('coverage','{"suppliers":["707"]}',dashboard_private.coverage_result_v1('{"kind":"admin"}','{"suppliers":["707"]}'));
 END IF;
 IF to_regprocedure('dashboard_private.facet_result_v1(text,jsonb,jsonb)') IS NOT NULL THEN
  INSERT INTO dashboard_private.page_rollups VALUES('filters','{}',dashboard_private.facet_result_v1('coverage','{"kind":"admin"}','{}'));
 END IF;
 ANALYZE dashboard_private.sales_month_core; ANALYZE dashboard_private.receivables_summary;
 ANALYZE dashboard_private.sales_day; ANALYZE dashboard_private.sales_month; ANALYZE dashboard_private.weekly_day;
 ANALYZE dashboard_private.sales_facets; ANALYZE dashboard_private.sales_calendar; ANALYZE dashboard_private.client_assignments;
 UPDATE dashboard_private.summary_state SET dirty=false,generation=generation+1,refreshed_at=clock_timestamp() WHERE id=true RETURNING
  jsonb_build_object('status','refreshed','generation',generation,'refreshed_at',refreshed_at) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION dashboard_private.assignment_branches_v1(jsonb),dashboard_private.refresh_summaries_v1(boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION dashboard_private.refresh_summaries_v1(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.refresh_dashboard_summaries_v1()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' SET statement_timeout='60s' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Atualização reservada ao administrador' USING ERRCODE='42501'; END IF;
 -- Serialize an explicit import finish with the scheduled worker; never return a busy snapshot.
 PERFORM pg_advisory_xact_lock(70261002,1);
 RETURN dashboard_private.refresh_summaries_v1(false);
END $$;
REVOKE ALL ON FUNCTION public.refresh_dashboard_summaries_v1() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.refresh_dashboard_summaries_v1() TO authenticated;

CREATE OR REPLACE FUNCTION dashboard_private.queue_summaries_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_SCHEMA<>'public' OR TG_TABLE_NAME NOT IN('data_detailed','data_history','data_clients','data_client_promoters','data_hierarchy','dim_produtos','dim_vendedores','dim_supervisores','data_product_details','data_titulos','dim_fornecedores') THEN
  RAISE EXCEPTION 'Origem de atualização inválida';
 END IF;
 IF NOT ((auth.uid() IS NOT NULL AND public.is_admin()) OR (auth.uid() IS NULL AND (session_user IN('postgres','supabase_admin') OR current_setting('role',true)='service_role'))) THEN
  RAISE EXCEPTION 'Atualização reservada ao administrador' USING ERRCODE='42501';
 END IF;
 UPDATE dashboard_private.summary_state SET dirty=true,last_change=clock_timestamp() WHERE id=true;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION dashboard_private.queue_summaries_v1() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['data_detailed','data_history','data_clients','data_client_promoters','data_hierarchy','dim_produtos','dim_vendedores','dim_supervisores','data_product_details','data_titulos','dim_fornecedores'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS dashboard_summary_dirty ON public.%I',t);
  EXECUTE format('CREATE TRIGGER dashboard_summary_dirty AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION dashboard_private.queue_summaries_v1()',t);
 END LOOP;
END $$;
-- One minute safety net for integrations that don't explicitly finish an import.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='dashboard-page-summaries-v1') THEN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='dashboard-page-summaries-v1';
 END IF;
 PERFORM cron.schedule('dashboard-page-summaries-v1','* * * * *','SELECT dashboard_private.refresh_summaries_v1(false)');
END $$;

CREATE OR REPLACE FUNCTION dashboard_private.assignments_v1(s jsonb)
RETURNS TABLE(client text,seller text,supervisor text,supervisor_name text,filial text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH base AS MATERIALIZED(SELECT a.* FROM dashboard_private.client_assignments a WHERE s->>'kind'='admin'
 OR a.client IN(SELECT jsonb_array_elements_text(s->'clients')) OR a.client IN(SELECT jsonb_array_elements_text(s->'ghosts'))),
 sup AS(SELECT DISTINCT ON(seller) seller,raw_supervisor FROM base WHERE branch_source IS NOT NULL
 ORDER BY seller,branch_date DESC NULLS LAST,branch_source,raw_supervisor)
 SELECT b.client,b.seller,sup.raw_supervisor,coalesce(ds.nome,sup.raw_supervisor,'N/A'),b.filial
 FROM base b LEFT JOIN sup ON sup.seller=b.seller LEFT JOIN public.dim_supervisores ds ON ds.codigo=sup.raw_supervisor;
$$;
GRANT EXECUTE ON FUNCTION dashboard_private.assignments_v1(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION dashboard_private.assignments_v1(jsonb) FROM PUBLIC,anon;

SELECT dashboard_private.refresh_summaries_v1(true);


-- Migration 20261002231911 summary_page_wallet_assignments
-- Cobertura e Semanal: dados, cálculos e opções de filtros no PostgreSQL.
-- Helpers ficam fora do schema exposto pela API; todos preservam RLS.
CREATE SCHEMA IF NOT EXISTS dashboard_private;
REVOKE ALL ON SCHEMA dashboard_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA dashboard_private TO authenticated;

CREATE OR REPLACE FUNCTION dashboard_private.scope_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $$
DECLARE r text; kind text; sellers text[]; clients text[]; ghosts text[];
BEGIN
 IF auth.uid() IS NULL OR NOT(public.is_admin() OR public.is_approved()) THEN
  RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE='42501';
 END IF;
 SELECT lower(btrim(role)) INTO r FROM public.profiles WHERE id=auth.uid();
 IF r='adm' THEN RETURN jsonb_build_object('kind','admin'); END IF;
 -- Trade: carteira atribuída, inclusive coordenadores com carteira vazia.
 IF EXISTS(SELECT 1 FROM public.data_hierarchy h WHERE r IN(lower(btrim(h.cod_coord)),lower(btrim(h.cod_cocoord)),lower(btrim(h.cod_promotor))))
 OR EXISTS(SELECT 1 FROM public.data_client_promoters WHERE lower(btrim(promoter_code))=r) THEN
  kind:='trade';
  SELECT array_agg(cp.client_code) INTO clients FROM public.data_client_promoters cp
  WHERE lower(btrim(cp.promoter_code))=r OR EXISTS(SELECT 1 FROM public.data_hierarchy h
   WHERE lower(btrim(h.cod_promotor))=lower(btrim(cp.promoter_code)) AND r IN(lower(btrim(h.cod_coord)),lower(btrim(h.cod_cocoord)),lower(btrim(h.cod_promotor))));
 ELSE
  SELECT array_agg(DISTINCT codusur) INTO sellers FROM (
   SELECT codusur FROM public.data_detailed WHERE lower(btrim(codsupervisor))=r
   UNION ALL SELECT codusur FROM public.data_history WHERE lower(btrim(codsupervisor))=r) s;
  kind:=CASE WHEN sellers IS NULL THEN 'seller' ELSE 'supervisor' END;
  SELECT array_agg(codigo_cliente) INTO clients FROM public.data_clients
  WHERE (kind='seller' AND lower(btrim(rca1))=r) OR (kind='supervisor' AND rca1=ANY(sellers))
   OR (r='1001' AND upper(coalesce(razaosocial,nomecliente,'')) LIKE '%AMERICANAS%');
  -- Mesmo complemento da carteira legado: clientes com venda atual do vendedor/supervisor.
  SELECT array_agg(DISTINCT codcli) INTO ghosts FROM public.data_detailed
  WHERE (kind='seller' AND lower(btrim(codusur))=r) OR (kind='supervisor' AND lower(btrim(codsupervisor))=r);
 END IF;
 RETURN jsonb_build_object('kind',kind,'clients',coalesce(clients,ARRAY[]::text[]),'ghosts',coalesce(ghosts,ARRAY[]::text[]));
END $$;

CREATE OR REPLACE FUNCTION dashboard_private.clients_v1(s jsonb)
RETURNS TABLE(code text,rca text,city text,rede text,coord text,coord_name text,cocoord text,cocoord_name text,promotor text,promotor_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT c.codigo_cliente,CASE WHEN upper(coalesce(c.razaosocial,c.nomecliente,'')) LIKE '%AMERICANAS%' THEN '1001' ELSE c.rca1 END,
 coalesce(nullif(c.cidade,''),'N/A'),coalesce(nullif(c.ramo,''),'N/A'),h.cod_coord,h.nome_coord,h.cod_cocoord,h.nome_cocoord,cp.promoter_code,coalesce(h.nome_promotor,cp.promoter_code)
 FROM public.data_clients c
 LEFT JOIN public.data_client_promoters cp ON cp.client_code=c.codigo_cliente
 LEFT JOIN LATERAL (SELECT * FROM public.data_hierarchy h WHERE lower(btrim(h.cod_promotor))=lower(btrim(cp.promoter_code)) ORDER BY h.id LIMIT 1) h ON true
 WHERE s->>'kind'='admin' OR c.codigo_cliente IN(SELECT jsonb_array_elements_text(s->'clients'))
 OR c.codigo_cliente IN(SELECT jsonb_array_elements_text(s->'ghosts'));
$$;

CREATE OR REPLACE FUNCTION dashboard_private.matches_v1(f jsonb,k text,v text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(jsonb_array_length(f->k),0)=0 OR coalesce(f->k ? v,false);
$$;
CREATE OR REPLACE FUNCTION dashboard_private.rede_v1(f jsonb,v text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(v,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? v,false))
 WHEN 'sem_rede' THEN coalesce(v,'N/A') IN('','N/A') ELSE true END;
$$;

CREATE OR REPLACE FUNCTION dashboard_private.assignments_v1(s jsonb)
RETURNS TABLE(client text,seller text,supervisor text,supervisor_name text,filial text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH base AS MATERIALIZED(SELECT a.* FROM dashboard_private.client_assignments a WHERE s->>'kind'='admin'
 OR a.client IN(SELECT jsonb_array_elements_text(s->'clients')) OR a.client IN(SELECT jsonb_array_elements_text(s->'ghosts'))),
 sup AS(SELECT DISTINCT ON(seller) seller,raw_supervisor FROM base WHERE branch_source IS NOT NULL
 ORDER BY seller,branch_date DESC NULLS LAST,branch_source,raw_supervisor)
 SELECT b.client,b.seller,sup.raw_supervisor,coalesce(ds.nome,sup.raw_supervisor,'N/A'),b.filial
 FROM base b LEFT JOIN sup ON sup.seller=b.seller LEFT JOIN public.dim_supervisores ds ON ds.codigo=sup.raw_supervisor;
$$;

CREATE OR REPLACE FUNCTION dashboard_private.rows_v1(s jsonb,f jsonb DEFAULT '{}'::jsonb,purpose text DEFAULT 'all')
RETURNS TABLE(source text,client text,product text,supplier text,virtual_supplier text,seller text,seller_name text,supervisor text,supervisor_name text,filial text,sale_type text,day date,amount numeric,bonus numeric,units numeric,boxes numeric,description text,registered date,city text,rede text,coord text,coord_name text,cocoord text,cocoord_name text,promotor text,promotor_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 products AS MATERIALIZED(SELECT * FROM public.dim_produtos), details AS MATERIALIZED(SELECT * FROM public.data_product_details),
 vendors AS MATERIALIZED(SELECT * FROM public.dim_vendedores), supervisors AS MATERIALIZED(SELECT * FROM public.dim_supervisores), raw AS MATERIALIZED(
 SELECT 'current'::text source,d.codcli,d.produto,d.codfor,d.codusur,d.codsupervisor,d.filial,d.tipovenda,(d.dtped AT TIME ZONE 'UTC')::date AS day,coalesce(d.vlvenda,0) amount,coalesce(d.vlbonific,0) bonus,coalesce(d.qtvenda,0) units
 FROM public.data_detailed d LEFT JOIN clients c ON c.code=d.codcli WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR d.codcli IN(SELECT jsonb_array_elements_text(s->'ghosts')))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false)))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)))
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR (d.codfor='1119' AND EXISTS(SELECT 1 FROM products p WHERE p.codigo=d.produto AND coalesce(f->'suppliers' ? (CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END),false))))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? coalesce(nullif(c.rca,''),d.codusur),false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (purpose<>'weekly' OR coalesce(f->>'month','current')='current')
 UNION ALL
 SELECT 'history',d.codcli,d.produto,d.codfor,d.codusur,d.codsupervisor,d.filial,d.tipovenda,(d.dtped AT TIME ZONE 'UTC')::date,coalesce(d.vlvenda,0),coalesce(d.vlbonific,0),coalesce(d.qtvenda,0)
 FROM public.data_history d LEFT JOIN clients c ON c.code=d.codcli WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false)))
 AND (purpose<>'coverage' OR (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)))
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR (d.codfor='1119' AND EXISTS(SELECT 1 FROM products p WHERE p.codigo=d.produto AND coalesce(f->'suppliers' ? (CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END),false))))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? coalesce(nullif(c.rca,''),d.codusur),false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (purpose<>'weekly' OR ((d.dtped AT TIME ZONE 'UTC')::date >= (CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',(SELECT max(dtped) FROM public.data_detailed) AT TIME ZONE 'UTC')::date ELSE ((f->>'month')||'-01')::date END)-interval '1 month' AND (d.dtped AT TIME ZONE 'UTC')::date < (CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',(SELECT max(dtped) FROM public.data_detailed) AT TIME ZONE 'UTC')::date ELSE ((f->>'month')||'-01')::date+interval '1 month' END)))
 ), assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s))
 SELECT r.source,r.codcli,r.produto,r.codfor,CASE WHEN r.codfor='1119' THEN CASE
 WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY'
 WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END,
 coalesce(nullif(c.rca,''),r.codusur),coalesce(v.nome,coalesce(nullif(c.rca,''),r.codusur),'N/A'),
 coalesce(ss.supervisor,r.codsupervisor),coalesce(ds.nome,ss.supervisor,r.codsupervisor,'N/A'),r.filial,r.tipovenda,r.day,r.amount,r.bonus,r.units,
 r.units/CASE WHEN p.qtde_master>0 THEN p.qtde_master ELSE 1 END,
 coalesce(nullif(p.descricao,''),'Produto '||r.produto),(pd.dtcadastro AT TIME ZONE 'UTC')::date,
 coalesce(c.city,'N/A'),coalesce(c.rede,'N/A'),c.coord,c.coord_name,c.cocoord,c.cocoord_name,c.promotor,c.promotor_name
 FROM raw r LEFT JOIN clients c ON c.code=r.codcli
 LEFT JOIN products p ON p.codigo=r.produto
 LEFT JOIN details pd ON pd.code=r.produto
 LEFT JOIN assignments ss ON ss.client=r.codcli
 LEFT JOIN vendors v ON v.codigo=coalesce(nullif(c.rca,''),r.codusur)
 LEFT JOIN supervisors ds ON ds.codigo=coalesce(ss.supervisor,r.codsupervisor);
$$;

-- Page-local planner settings avoid JIT startup and merge joins caused by opaque helper cardinality.
-- Settings restore automatically on function exit; authorization/RLS remain unchanged.
-- As opções são pequenas projeções; nunca retornam linhas de vendas ao navegador.
CREATE OR REPLACE FUNCTION dashboard_private.normalize_page_filters_v1(f jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb:=f; k text; v jsonb;
BEGIN
 FOR k,v IN SELECT * FROM jsonb_each(f) LOOP
  IF v='null'::jsonb OR v='[]'::jsonb OR v='""'::jsonb
   OR (k='filial' AND v IN('"all"'::jsonb,'"ambas"'::jsonb))
   OR (k='mode' AND v='"promoter"'::jsonb) OR (k='month' AND v='"current"'::jsonb)
   OR (k='trend' AND v='"all"'::jsonb) OR (k='metric' AND v='"boxes"'::jsonb)
   OR (k='working_days' AND v='0'::jsonb) THEN result:=result-k; END IF;
 END LOOP;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION dashboard_private.normalize_page_filters_v1(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION dashboard_private.normalize_page_filters_v1(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION dashboard_private.facet_result_v1(p_page text,s jsonb,p_filters jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' AS $$
DECLARE result jsonb; f jsonb:=p_filters;
BEGIN
 IF p_page NOT IN('coverage','weekly') OR jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Página ou filtros inválidos' USING ERRCODE='22023'; END IF;
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 raw AS MATERIALIZED(SELECT * FROM dashboard_private.sales_facets WHERE s->>'kind'='admin'
 OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR (source='current' AND codcli IN(SELECT jsonb_array_elements_text(s->'ghosts')))),
 rows AS MATERIALIZED(SELECT r.source,r.day,r.filial,r.tipovenda sale_type,r.produto product,r.codfor supplier,
 coalesce(p.descricao,'Produto '||r.produto) description,
 CASE WHEN r.codfor='1119' THEN CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END virtual_supplier,
 a.seller,coalesce(v.nome,a.seller,'N/A') seller_name,a.supervisor_name,c.city,c.rede,c.coord,c.cocoord,c.promotor
 FROM raw r LEFT JOIN clients c ON c.code=r.codcli LEFT JOIN assignments a ON a.client=r.codcli
 LEFT JOIN public.dim_produtos p ON p.codigo=r.produto LEFT JOIN public.dim_vendedores v ON v.codigo=a.seller),
 scope AS MATERIALIZED(SELECT * FROM rows WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false)))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? seller,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? rede,false)) WHEN 'sem_rede' THEN coalesce(rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR filial=f->>'filial')
 AND (coalesce(f->>'city','')='' OR lower(city)=lower(f->>'city'))),
 supplier_options AS (SELECT DISTINCT supplier code,coalesce(df.nome,supplier) label FROM scope LEFT JOIN public.dim_fornecedores df ON df.codigo=scope.supplier
 UNION SELECT DISTINCT virtual_supplier,CASE virtual_supplier WHEN '1119_TODDYNHO' THEN 'TODDYNHO' WHEN '1119_TODDY' THEN 'TODDY' ELSE 'QUAKER / KEROCOCO' END FROM scope WHERE virtual_supplier IS NOT NULL),
 products AS (SELECT DISTINCT product code,'('||product||') '||description label FROM scope WHERE (coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? supplier,false)) OR coalesce(f->'suppliers' ? virtual_supplier,false)),
 sellers AS(SELECT DISTINCT seller code,seller_name label,supervisor_name supervisor FROM rows
 WHERE (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))),
 hierarchy AS(SELECT * FROM clients), months AS(SELECT DISTINCT to_char(day,'YYYY-MM') code FROM raw WHERE day IS NOT NULL)
 SELECT jsonb_build_object('schema_version',1,'reference_date',coalesce((SELECT max(day) FROM rows WHERE source='current'),(SELECT max(day) FROM rows),current_date),
 'suppliers',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM supplier_options t),'[]'),
 'products',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM products t),'[]'),
 'types',coalesce((SELECT jsonb_agg(jsonb_build_object('code',sale_type,'label',sale_type) ORDER BY sale_type) FROM (SELECT DISTINCT sale_type FROM scope WHERE sale_type IS NOT NULL)t),'[]'),
 'sellers',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY label) FROM sellers t),'[]'),
 'supervisors',coalesce((SELECT jsonb_agg(jsonb_build_object('code',label,'label',label) ORDER BY label) FROM(SELECT DISTINCT supervisor_name label FROM rows)t),'[]'),
 'coords',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT coord code,coalesce(coord_name,coord) label FROM hierarchy WHERE coord IS NOT NULL)t),'[]'),
 'cocoords',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT cocoord code,coalesce(cocoord_name,cocoord) label FROM hierarchy WHERE cocoord IS NOT NULL AND (coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)))t),'[]'),
 'promotors',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) FROM(SELECT DISTINCT promotor code,coalesce(promotor_name,promotor) label FROM hierarchy WHERE promotor IS NOT NULL AND (coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)))t),'[]'),
 'cities',coalesce((SELECT jsonb_agg(city ORDER BY city) FROM(SELECT DISTINCT city FROM clients)t),'[]'),
 'redes',coalesce((SELECT jsonb_agg(jsonb_build_object('code',rede,'label',rede) ORDER BY rede) FROM(SELECT DISTINCT rede FROM clients WHERE rede NOT IN('','N/A'))t),'[]'),
 'months',coalesce((SELECT jsonb_agg(code ORDER BY code DESC) FROM months),'[]')) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.get_dashboard_filters_v1(p_page text,p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET plan_cache_mode='force_custom_plan' SET jit='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); result jsonb; products jsonb;
BEGIN
 IF p_page NOT IN('coverage','weekly') OR jsonb_typeof(p_filters)<>'object' THEN RAISE EXCEPTION 'Página ou filtros inválidos' USING ERRCODE='22023'; END IF;
 IF s->>'kind'='admin' AND dashboard_private.normalize_page_filters_v1(p_filters-'suppliers')='{}'::jsonb THEN
  SELECT payload INTO result FROM dashboard_private.page_rollups WHERE page='filters' AND cache_key='{}'::jsonb;
  IF FOUND THEN
   IF coalesce(jsonb_array_length(p_filters->'suppliers'),0)>0 THEN
    SELECT coalesce(jsonb_agg(p.item ORDER BY p.ordinal),'[]'::jsonb) INTO products
    FROM jsonb_array_elements(result->'products') WITH ORDINALITY p(item,ordinal)
    WHERE EXISTS(SELECT 1 FROM dashboard_private.product_suppliers x WHERE x.product=p.item->>'code'
     AND (coalesce(p_filters->'suppliers' ? x.supplier,false) OR coalesce(p_filters->'suppliers' ? x.virtual_supplier,false)));
    result:=jsonb_set(result,'{products}',products);
   END IF;
   RETURN result;
  END IF;
 END IF;
 RETURN dashboard_private.facet_result_v1(p_page,s,p_filters);
END $$;

CREATE OR REPLACE FUNCTION public.get_weekly_page_v1(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); f jsonb:=p_filters; ref date; target date; result jsonb;
BEGIN
 IF jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 SELECT coalesce(max(day) FILTER(WHERE source='current'),max(day),current_date) INTO ref FROM dashboard_private.sales_calendar;
 target:=CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',ref)::date ELSE ((f->>'month')||'-01')::date END;
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 rows AS MATERIALIZED(SELECT d.source,d.codcli client,d.day,d.vlvenda amount,d.codfor supplier,d.virtual_supplier,
 coalesce(nullif(c.rca,''),d.codusur) seller,coalesce(v.nome,coalesce(nullif(c.rca,''),d.codusur),'N/A') seller_name,
 coalesce(a.supervisor_name,ds.nome,d.codsupervisor,'N/A') supervisor_name,d.filial,coalesce(c.rede,'N/A') rede,
 c.coord,c.cocoord,c.promotor,c.promotor_name FROM dashboard_private.weekly_day d
 LEFT JOIN clients c ON c.code=d.codcli LEFT JOIN assignments a ON a.client=d.codcli
 LEFT JOIN public.dim_vendedores v ON v.codigo=coalesce(nullif(c.rca,''),d.codusur)
 LEFT JOIN public.dim_supervisores ds ON ds.codigo=d.codsupervisor
 WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR (d.source='current' AND d.codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))))
 AND ((coalesce(f->>'month','current')='current' AND d.source='current') OR (d.source='history' AND d.day>=target-interval '1 month' AND d.day<target+interval '1 month'))),
 filtered AS MATERIALIZED(SELECT * FROM rows WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? supervisor_name,false)))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? seller,false))
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? supplier,false)) OR coalesce(f->'suppliers' ? virtual_supplier,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? rede,false)) WHEN 'sem_rede' THEN coalesce(rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR filial=f->>'filial')),
 selected AS MATERIALIZED(SELECT * FROM filtered WHERE
 (coalesce(f->>'month','current')='current' AND source='current') OR (coalesce(f->>'month','current')<>'current' AND source='history' AND day>=target AND day<target+interval '1 month')),
 first_day AS(SELECT target+CASE extract(isodow FROM target)::int WHEN 6 THEN 2 WHEN 7 THEN 1 ELSE 0 END first),
 week_starts AS(SELECT first start FROM first_day UNION SELECT d::date FROM first_day,generate_series(date_trunc('week',first::timestamp)+interval '7 days',target::timestamp+interval '1 month - 1 day',interval '7 days') d),
 weeks AS(SELECT row_number() OVER(ORDER BY start) id,start,least((date_trunc('week',start::timestamp)+interval '6 days')::date,(target+interval '1 month - 1 day')::date) finish FROM week_starts),
 daily AS(SELECT w.id,extract(dow FROM s.day)::int weekday,sum(s.amount) amount FROM weeks w JOIN selected s ON s.day BETWEEN w.start AND w.finish GROUP BY 1,2),
 week_data AS(SELECT w.id,w.start,w.finish "end",coalesce((SELECT sum(amount) FROM daily d WHERE d.id=w.id),0) total,
 (SELECT jsonb_agg(coalesce(d.amount,0) ORDER BY wd) FROM generate_series(0,6) wd LEFT JOIN daily d ON d.id=w.id AND d.weekday=wd) days FROM weeks w),
 best_daily AS(SELECT day,sum(amount) amount FROM filtered WHERE source='history' AND day>=target-interval '1 month' AND day<target GROUP BY day),
 best AS(SELECT extract(dow FROM day)::int wd,greatest(max(amount),0) amount FROM best_daily GROUP BY 1),
 ranks AS(SELECT CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(promotor,'Sem Promotor') ELSE coalesce(seller,'N/A') END code,
 CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(promotor_name,'Sem Promotor') ELSE coalesce(seller_name,seller,'N/A') END name,
 sum(amount) val,count(DISTINCT client) pos FROM selected GROUP BY 1,2)
 SELECT jsonb_build_object('schema_version',1,'reference_date',ref,'target_month',to_char(target,'YYYY-MM'),
 'weeks',coalesce((SELECT jsonb_agg(to_jsonb(w) ORDER BY id) FROM week_data w),'[]'),
 'best_days',(SELECT jsonb_agg(coalesce(b.amount,0) ORDER BY wd) FROM generate_series(0,6) wd LEFT JOIN best b USING(wd)),
 'ranking_fat',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY val DESC,code) FROM(SELECT * FROM ranks ORDER BY val DESC,code LIMIT 10)t),'[]'),
 'ranking_pos',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY pos DESC,val DESC,code) FROM(SELECT * FROM ranks ORDER BY pos DESC,val DESC,code LIMIT 10)t),'[]')) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION dashboard_private.coverage_result_v1(s jsonb,p_filters jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' AS $$
DECLARE f jsonb:=p_filters; ref date; start_date date; end_date date; prev_start date; prev_end date;
 custom_date boolean; alt boolean; result jsonb; days integer:=greatest(coalesce((f->>'working_days')::int,0),0);
BEGIN
 IF jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 SELECT coalesce(max(day) FILTER(WHERE source='current'),max(day),current_date) INTO ref FROM dashboard_private.sales_calendar;
 custom_date:=nullif(f->>'date_start','') IS NOT NULL AND nullif(f->>'date_end','') IS NOT NULL;
 start_date:=CASE WHEN custom_date THEN (f->>'date_start')::date ELSE date_trunc('month',ref)::date END;
 end_date:=CASE WHEN custom_date THEN (f->>'date_end')::date ELSE (start_date+interval '1 month - 1 day')::date END;
 IF end_date<start_date THEN RAISE EXCEPTION 'Período inválido' USING ERRCODE='22023'; END IF;
 prev_start:=(start_date-interval '1 month')::date; prev_end:=(end_date-interval '1 month')::date;
 IF NOT custom_date THEN prev_end:=start_date-1; END IF;
 alt:=coalesce(jsonb_array_length(f->'types'),0)>0 AND NOT(coalesce(f->'types' ? '1',false) OR coalesce(f->'types' ? '9',false));
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 seller_sup AS(SELECT DISTINCT seller,supervisor_name FROM assignments),branches AS(SELECT client,filial FROM assignments),
 base_clients AS MATERIALIZED(SELECT c.* FROM clients c WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR EXISTS(SELECT 1 FROM seller_sup ss WHERE ss.seller=c.rca AND (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? ss.supervisor_name,false))) OR coalesce(jsonb_array_length(f->'supervisors'),0)=0)
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? c.rca,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (coalesce(f->>'filial','ambas') IN('ambas','all') OR EXISTS(SELECT 1 FROM branches b WHERE b.client=c.code AND b.filial=f->>'filial'))),
 scoped AS MATERIALIZED(SELECT d.source,d.codcli client,d.produto product,d.day,d.codusur seller,
 d.vlvenda amount,d.unit_price,d.boxes,CASE WHEN alt THEN d.vlbonific ELSE d.vlvenda END value
 FROM (SELECT * FROM dashboard_private.sales_month_core WHERE NOT custom_date AND f->>'price_min' IS NULL AND f->>'price_max' IS NULL
 UNION ALL SELECT * FROM dashboard_private.sales_month WHERE NOT custom_date AND (f->>'price_min' IS NOT NULL OR f->>'price_max' IS NOT NULL)
 UNION ALL SELECT * FROM dashboard_private.sales_day WHERE custom_date) d
 JOIN base_clients c ON c.code=d.codcli WHERE (coalesce(f->>'filial','ambas') IN('ambas','all') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR coalesce(f->'suppliers' ? d.virtual_supplier,false))
 AND (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false))
 AND (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false))),
 filtered AS NOT MATERIALIZED(SELECT * FROM scoped d WHERE ((f->>'price_min' IS NULL AND f->>'price_max' IS NULL) OR (d.unit_price IS NOT NULL
 AND (f->>'price_min' IS NULL OR d.unit_price>=(f->>'price_min')::numeric)
 AND (f->>'price_max' IS NULL OR d.unit_price<=(f->>'price_max')::numeric)))),
 periods AS MATERIALIZED(
 SELECT r.*,'current'::text period FROM filtered r WHERE (custom_date AND day BETWEEN start_date AND end_date) OR(NOT custom_date AND source='current')
 UNION ALL SELECT r.*,'previous' FROM filtered r WHERE (custom_date AND day BETWEEN prev_start AND prev_end) OR(NOT custom_date AND source='history' AND day BETWEEN prev_start AND prev_end)
 UNION ALL SELECT r.*,'history' FROM filtered r WHERE NOT custom_date AND source='history' AND day NOT BETWEEN prev_start AND prev_end),
 product_clients AS(SELECT product,client,period,sum(value) value FROM periods WHERE period IN('current','previous') GROUP BY 1,2,3),
 product_counts AS(SELECT product,count(*) FILTER(WHERE period='current' AND value>=1) current_count,count(*) FILTER(WHERE period='previous' AND value>=1) previous_count FROM product_clients GROUP BY product),
 selection AS(SELECT client,period,sum(value) value FROM periods WHERE period IN('current','previous') GROUP BY 1,2),
 active_history AS(SELECT client FROM scoped WHERE source='history' GROUP BY client HAVING sum(amount)>=1),
 working AS MATERIALIZED(SELECT DISTINCT day FROM dashboard_private.sales_calendar WHERE extract(isodow FROM day) BETWEEN 1 AND 5
 AND (s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR (source='current' AND codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))))),
 working_array AS(SELECT array_agg(day ORDER BY day) dates FROM working),
 stats_amounts AS(SELECT product,coalesce(sum(boxes) FILTER(WHERE period='current'),0) current_boxes,
 coalesce(sum(boxes) FILTER(WHERE period='previous'),0) previous_boxes,bool_or(day<date_trunc('month',ref)::date) has_history
 FROM periods GROUP BY product),
 stats AS MATERIALIZED(SELECT t.*,coalesce(nullif(p.descricao,''),'Produto '||t.product) description,(pd.dtcadastro AT TIME ZONE 'UTC')::date registered
 FROM stats_amounts t LEFT JOIN public.dim_produtos p ON p.codigo=t.product LEFT JOIN public.data_product_details pd ON pd.code=t.product),
 stock AS(SELECT product_code,sum(coalesce(stock_qty,0)) qty FROM public.data_stock WHERE coalesce(f->>'filial','ambas') IN('ambas','all') OR filial=f->>'filial' GROUP BY product_code),
 divisors AS MATERIALIZED(SELECT t.*,coalesce(st.qty,0) stock,coalesce(pc.current_count,0) current_count,coalesce(pc.previous_count,0) previous_count,
 greatest(1,CASE WHEN NOT coalesce(has_history,false) AND current_boxes>0 THEN least(
 greatest((SELECT count(*) FROM generate_series(date_trunc('month',ref)::date,ref,'1 day') d WHERE extract(isodow FROM d) BETWEEN 1 AND 5),1),
 CASE WHEN days>0 THEN days ELSE greatest((SELECT count(*) FROM generate_series(date_trunc('month',ref)::date,ref,'1 day') d WHERE extract(isodow FROM d) BETWEEN 1 AND 5),1) END)
 ELSE CASE WHEN days>0 THEN least(days,(SELECT count(*) FROM working WHERE registered IS NULL OR day>=registered)) ELSE (SELECT count(*) FROM working WHERE registered IS NULL OR day>=registered) END END)::numeric divisor
 FROM stats t LEFT JOIN stock st ON st.product_code=t.product LEFT JOIN product_counts pc USING(product)),
 -- Daily rows are read only for each product's required trend window, with original price buckets.
 trend_totals AS MATERIALIZED(SELECT dv.product,coalesce(sum(d.boxes*CASE WHEN custom_date THEN
 (CASE WHEN d.day BETWEEN start_date AND end_date THEN 1 ELSE 0 END+CASE WHEN d.day BETWEEN prev_start AND prev_end THEN 1 ELSE 0 END) ELSE 1 END),0)/dv.divisor daily_avg
 FROM divisors dv CROSS JOIN working_array w LEFT JOIN (dashboard_private.sales_day d JOIN base_clients c ON c.code=d.codcli)
 ON d.produto=dv.product AND d.day BETWEEN w.dates[greatest(1,cardinality(w.dates)-dv.divisor::int+1)] AND w.dates[cardinality(w.dates)]
 AND (coalesce(f->>'filial','ambas') IN('ambas','all') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR coalesce(f->'suppliers' ? d.virtual_supplier,false))
 AND (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false))
 AND (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)) AND ((f->>'price_min' IS NULL AND f->>'price_max' IS NULL) OR (d.unit_price IS NOT NULL
 AND (f->>'price_min' IS NULL OR d.unit_price>=(f->>'price_min')::numeric)
 AND (f->>'price_max' IS NULL OR d.unit_price<=(f->>'price_max')::numeric)))
 GROUP BY dv.product,dv.divisor),
 trend AS(SELECT d.*,t.daily_avg FROM divisors d JOIN trend_totals t USING(product)),
 table_all AS MATERIALIZED(SELECT product code,'('||product||') '||description descricao,stock "stockQty",current_boxes "boxesSoldCurrentMonth",previous_boxes "boxesSoldPreviousMonth",
 CASE WHEN previous_boxes>0 THEN (current_boxes-previous_boxes)/previous_boxes*100 WHEN current_boxes>0 THEN NULL ELSE 0 END "boxesVariation",
 CASE WHEN previous_count>0 THEN (current_count-previous_count)::numeric/previous_count*100 WHEN current_count>0 THEN NULL ELSE 0 END "pdvVariation",
 CASE WHEN daily_avg>0 THEN stock/daily_avg WHEN stock>0 THEN NULL ELSE 0 END "trendDays",previous_count "clientsPreviousCount",current_count "clientsCurrentCount",
 CASE WHEN (SELECT count(*) FROM base_clients)>0 THEN current_count::numeric/(SELECT count(*) FROM base_clients)*100 ELSE 0 END "coverageCurrent" FROM trend),
 table_filtered AS MATERIALIZED(SELECT * FROM table_all WHERE "boxesSoldCurrentMonth">0 AND CASE coalesce(f->>'trend','all') WHEN 'low' THEN "trendDays"<15 WHEN 'medium' THEN "trendDays">=15 AND "trendDays"<30 WHEN 'good' THEN "trendDays">=30 ELSE true END),
 cities AS(SELECT c.city name,sum(CASE WHEN coalesce(f->>'metric','boxes')='boxes' THEN r.boxes ELSE r.value END) value FROM periods r JOIN base_clients c ON c.code=r.client WHERE r.period='current' GROUP BY c.city),
 ranking AS(SELECT CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(c.promotor_name,'N/A') ELSE coalesce(v.nome,coalesce(nullif(c.rca,''),r.seller),'N/A') END name,
 sum(CASE WHEN coalesce(f->>'metric','boxes')='boxes' THEN r.boxes ELSE r.value END) value FROM periods r
 JOIN base_clients c ON c.code=r.client LEFT JOIN public.dim_vendedores v ON v.codigo=coalesce(nullif(c.rca,''),r.seller)
 WHERE r.period='current' GROUP BY 1),
 top_product AS(SELECT * FROM table_all WHERE "coverageCurrent">0 ORDER BY "coverageCurrent" DESC,code LIMIT 1)
 SELECT jsonb_build_object('schema_version',1,'reference_date',ref,'active_clients',(SELECT count(*) FROM base_clients),'active_3m',(SELECT count(*) FROM active_history),
 'current_clients',(SELECT count(*) FROM selection WHERE period='current' AND value>=1),'previous_clients',(SELECT count(*) FROM selection WHERE period='previous' AND value>=1),
 'top',coalesce((SELECT to_jsonb(t) FROM top_product t),'null'),
 'rows',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY "stockQty" DESC,code) FROM table_filtered t),'[]'),
 'total_boxes',coalesce((SELECT sum("boxesSoldCurrentMonth") FROM table_filtered),0),
 'chart_total',coalesce((SELECT sum(value) FROM cities),0),
 'cities',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY value DESC,name) FROM(SELECT * FROM cities ORDER BY value DESC,name LIMIT 10)t),'[]'),
 'ranking',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY value DESC,name) FROM(SELECT * FROM ranking ORDER BY value DESC,name LIMIT 10)t),'[]')) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.get_coverage_page_v1(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET plan_cache_mode='force_custom_plan' SET jit='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); result jsonb;
BEGIN
 IF jsonb_typeof(p_filters)<>'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 IF s->>'kind'='admin' THEN
  SELECT payload INTO result FROM dashboard_private.page_rollups WHERE page='coverage' AND cache_key=dashboard_private.normalize_page_filters_v1(p_filters);
  IF FOUND THEN RETURN result; END IF;
 END IF;
 RETURN dashboard_private.coverage_result_v1(s,p_filters);
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA dashboard_private FROM PUBLIC,anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA dashboard_private TO authenticated;
REVOKE ALL ON FUNCTION dashboard_private.assignment_branches_v1(jsonb),dashboard_private.queue_summaries_v1() FROM authenticated;
REVOKE ALL ON FUNCTION public.get_dashboard_filters_v1(text,jsonb),public.get_coverage_page_v1(jsonb),public.get_weekly_page_v1(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_filters_v1(text,jsonb),public.get_coverage_page_v1(jsonb),public.get_weekly_page_v1(jsonb) TO authenticated;

-- Mesma autorização de leitura, avaliada uma vez por consulta.
ALTER POLICY "Acesso Leitura Unificado" ON public.data_product_details USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.data_stock USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.dim_vendedores USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
ALTER POLICY "Acesso Leitura Unificado" ON public.dim_supervisores USING ((SELECT public.is_admin()) OR (SELECT public.is_approved()));
NOTIFY pgrst,'reload schema';


-- Migration 20261002231915 titles_summary_null_keys
-- Títulos: KPIs resumidos por cliente/vencimento; linhas originais e paginação preservadas.
CREATE OR REPLACE FUNCTION public.get_titulos_view_data(p_filial text[] DEFAULT NULL::text[], p_cidade text[] DEFAULT NULL::text[], p_supervisor text[] DEFAULT NULL::text[], p_vendedor text[] DEFAULT NULL::text[], p_rede text[] DEFAULT NULL::text[], p_search text DEFAULT NULL::text, p_coordenador text[] DEFAULT NULL::text[], p_cocoordenador text[] DEFAULT NULL::text[], p_page integer DEFAULT 0, p_limit integer DEFAULT 50)
 RETURNS json
 LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET plan_cache_mode='force_custom_plan' SET jit='off' AS $function$
DECLARE s jsonb:=dashboard_private.scope_v1(); result json; v_critical_date date:=CURRENT_DATE-60;
BEGIN
 IF p_page<0 OR p_limit<1 THEN RAISE EXCEPTION 'Paginação inválida' USING ERRCODE='22023'; END IF;
 WITH authorized AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 filtered AS MATERIALIZED(SELECT
        t.cod_cliente,
        t.vl_titulos,
        t.vl_receber,
        t.dt_vencimento,t.row_count,t.positive_receber,
        COALESCE(c.nomecliente, c.razaosocial, c.fantasia, 'Desconhecido') AS nomecliente,
        COALESCE(c.cidade, 'N/A') AS cidade,
        COALESCE(c.rca1, 'N/A') AS vendedor_nome,
        c.ramo,
        c.filial,
        c.supervisor
    FROM dashboard_private.receivables_summary t
    LEFT JOIN public.data_clients c ON (
        COALESCE(c.codigo_cliente, c.cod_cliente, '')::text = t.cod_cliente::text
        OR TRIM(LEADING '0' FROM COALESCE(c.codigo_cliente, c.cod_cliente, '')::text) = TRIM(LEADING '0' FROM t.cod_cliente::text)
    )
    WHERE (p_cidade IS NULL OR c.cidade = ANY(p_cidade))
      AND (
          p_filial IS NULL
          OR c.filial = ANY(p_filial)
          OR TRIM(c.filial) = ANY(p_filial)
          OR TRIM(LEADING '0' FROM COALESCE(c.filial, '')) = ANY(
              SELECT TRIM(LEADING '0' FROM elem) FROM unnest(p_filial) AS elem
          )
          OR LPAD(TRIM(COALESCE(c.filial, '')), 2, '0') = ANY(
              SELECT LPAD(TRIM(elem), 2, '0') FROM unnest(p_filial) AS elem
          )
          OR EXISTS (
              SELECT 1 FROM unnest(p_filial) elem
              WHERE c.filial ILIKE '%' || elem || '%'
          )
          OR EXISTS (
              SELECT 1 FROM public.config_city_branches ccb
              WHERE UPPER(ccb.cidade) = UPPER(COALESCE(c.cidade, ''))
                AND (
                    ccb.filial = ANY(p_filial)
                    OR TRIM(ccb.filial) = ANY(p_filial)
                    OR TRIM(LEADING '0' FROM COALESCE(ccb.filial, '')) = ANY(
                        SELECT TRIM(LEADING '0' FROM elem) FROM unnest(p_filial) AS elem
                    )
                    OR LPAD(TRIM(COALESCE(ccb.filial, '')), 2, '0') = ANY(
                        SELECT LPAD(TRIM(elem), 2, '0') FROM unnest(p_filial) AS elem
                    )
                )
          )
      )
      AND (
          p_supervisor IS NULL
          OR c.supervisor = ANY(p_supervisor)
          OR c.cod_supervisor = ANY(p_supervisor)
          OR UPPER(TRIM(COALESCE(c.supervisor, ''))) = ANY(SELECT UPPER(TRIM(elem)) FROM unnest(p_supervisor) AS elem)
          OR UPPER(TRIM(COALESCE(c.cod_supervisor, ''))) = ANY(SELECT UPPER(TRIM(elem)) FROM unnest(p_supervisor) AS elem)
          OR EXISTS (
              SELECT 1 FROM unnest(p_supervisor) elem
              WHERE (c.supervisor IS NOT NULL AND (c.supervisor ILIKE '%' || elem || '%' OR elem ILIKE '%' || c.supervisor || '%'))
                 OR (c.cod_supervisor IS NOT NULL AND (c.cod_supervisor ILIKE '%' || elem || '%' OR elem ILIKE '%' || c.cod_supervisor || '%'))
                 OR (elem LIKE '% - %' AND (
                     c.supervisor ILIKE '%' || trim(split_part(elem, ' - ', 2)) || '%'
                     OR c.cod_supervisor = trim(split_part(elem, ' - ', 1))
                 ))
          )
          OR EXISTS (
              SELECT 1 FROM public.data_clients c2
              WHERE (
                  (c2.rca1 IS NOT NULL AND c2.rca1 <> '' AND c2.rca1 = c.rca1)
                  OR (c2.vendedor_codigo IS NOT NULL AND c2.vendedor_codigo <> '' AND c2.vendedor_codigo = c.vendedor_codigo)
              )
              AND (
                  c2.supervisor = ANY(p_supervisor)
                  OR c2.cod_supervisor = ANY(p_supervisor)
                  OR UPPER(TRIM(COALESCE(c2.supervisor, ''))) = ANY(SELECT UPPER(TRIM(elem)) FROM unnest(p_supervisor) AS elem)
                  OR EXISTS (
                      SELECT 1 FROM unnest(p_supervisor) elem
                      WHERE c2.supervisor ILIKE '%' || elem || '%'
                         OR elem ILIKE '%' || c2.supervisor || '%'
                         OR (elem LIKE '% - %' AND (
                             c2.supervisor ILIKE '%' || trim(split_part(elem, ' - ', 2)) || '%'
                             OR c2.cod_supervisor = trim(split_part(elem, ' - ', 1))
                         ))
                  )
              )
          )
                    OR EXISTS (
              SELECT 1 FROM public.data_orders o
              WHERE (o.codcli = COALESCE(c.codigo_cliente, c.cod_cliente, ''))
                AND (
                    o.superv = ANY(p_supervisor)
                    OR EXISTS (
                        SELECT 1 FROM unnest(p_supervisor) elem
                        WHERE o.superv ILIKE '%' || elem || '%'
                           OR elem ILIKE '%' || o.superv || '%'
                           OR (elem LIKE '% - %' AND (
                               o.superv ILIKE '%' || trim(split_part(elem, ' - ', 2)) || '%'
                           ))
                    )
                )
          )
      )
      AND (
          p_vendedor IS NULL
          OR c.rca1 = ANY(p_vendedor)
          OR c.vendedor = ANY(p_vendedor)
          OR c.vendedor_codigo = ANY(p_vendedor)
      )
      AND (
          p_coordenador IS NULL
          OR EXISTS (
              SELECT 1 FROM public.data_hierarchy dh
              LEFT JOIN public.data_client_promoters dcp ON dcp.promoter_code = dh.cod_promotor
              WHERE (dh.nome_coord = ANY(p_coordenador) OR dh.cod_coord = ANY(p_coordenador))
                AND (
                    dcp.client_code = COALESCE(c.codigo_cliente, c.cod_cliente)
                    OR dh.cod_promotor = c.rca1
                    OR dh.cod_promotor = c.vendedor_codigo
                )
          )
      )
      AND (
          p_cocoordenador IS NULL
          OR EXISTS (
              SELECT 1 FROM public.data_hierarchy dh
              LEFT JOIN public.data_client_promoters dcp ON dcp.promoter_code = dh.cod_promotor
              WHERE (dh.nome_cocoord = ANY(p_cocoordenador) OR dh.cod_cocoord = ANY(p_cocoordenador))
                AND (
                    dcp.client_code = COALESCE(c.codigo_cliente, c.cod_cliente)
                    OR dh.cod_promotor = c.rca1
                    OR dh.cod_promotor = c.vendedor_codigo
                )
          )
      )
      AND (
          p_rede IS NULL
          OR (array_position(p_rede, 'C/ REDE') IS NOT NULL AND (c.ramo IS NOT NULL AND c.ramo <> '' AND c.ramo <> 'N/A'))
          OR (array_position(p_rede, 'S/ REDE') IS NOT NULL AND (c.ramo IS NULL OR c.ramo = '' OR c.ramo = 'N/A'))
          OR (c.ramo = ANY(p_rede))
      )
      AND (
          p_search IS NULL
          OR p_search = ''
          OR t.cod_cliente::text ILIKE '%' || p_search || '%'
          OR c.nomecliente ILIKE '%' || p_search || '%'
          OR c.razaosocial ILIKE '%' || p_search || '%'
          OR c.fantasia ILIKE '%' || p_search || '%'
      ) AND (s->>'kind'='admin' OR EXISTS(SELECT 1 FROM authorized ac WHERE
 ac.code=COALESCE(c.codigo_cliente,c.cod_cliente,'') OR ac.code=t.cod_cliente
 OR ltrim(ac.code,'0')=ltrim(t.cod_cliente,'0')))),
 rows AS(SELECT t.cod_cliente,t.vl_titulos,t.vl_receber,t.dt_vencimento,f.nomecliente,f.cidade,f.vendedor_nome,f.ramo
 FROM public.data_titulos t JOIN filtered f ON f.cod_cliente IS NOT DISTINCT FROM t.cod_cliente AND f.dt_vencimento IS NOT DISTINCT FROM t.dt_vencimento
 ORDER BY t.dt_vencimento ASC NULLS LAST,t.cod_cliente ASC OFFSET (p_page*p_limit) LIMIT p_limit)
 SELECT json_build_object('kpis',json_build_object(
 'total_rows',coalesce((SELECT sum(row_count) FROM filtered),0),
 'total_vl_receber',coalesce((SELECT sum(vl_receber) FROM filtered),0),
 'critical_vl_receber',coalesce((SELECT sum(positive_receber) FROM filtered WHERE dt_vencimento<v_critical_date),0),
 'critical_clients',(SELECT count(DISTINCT cod_cliente) FROM filtered WHERE dt_vencimento<v_critical_date AND positive_receber>0)),
 'rows',coalesce((SELECT json_agg(r) FROM rows r),'[]'::json)) INTO result;
 RETURN result;
END $function$;
REVOKE ALL ON FUNCTION public.get_titulos_view_data(text[],text[],text[],text[],text[],text,text[],text[],integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_titulos_view_data(text[],text[],text[],text[],text[],text,text[],text[],integer,integer) TO authenticated;


-- Migration 20261002231918 shared_summary_stock_changes_queue
CREATE OR REPLACE FUNCTION dashboard_private.queue_summaries_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_SCHEMA<>'public' OR TG_TABLE_NAME NOT IN('data_detailed','data_history','data_clients','data_client_promoters','data_hierarchy','dim_produtos','dim_vendedores','dim_supervisores','data_product_details','data_titulos','dim_fornecedores','data_stock') THEN
  RAISE EXCEPTION 'Origem de atualização inválida';
 END IF;
 IF NOT ((auth.uid() IS NOT NULL AND public.is_admin()) OR (auth.uid() IS NULL AND (session_user IN('postgres','supabase_admin') OR current_setting('role',true)='service_role'))) THEN
  RAISE EXCEPTION 'Atualização reservada ao administrador' USING ERRCODE='42501';
 END IF;
 UPDATE dashboard_private.summary_state SET dirty=true,last_change=clock_timestamp() WHERE id=true;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION dashboard_private.queue_summaries_v1() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['data_detailed','data_history','data_clients','data_client_promoters','data_hierarchy','dim_produtos','dim_vendedores','dim_supervisores','data_product_details','data_titulos','dim_fornecedores','data_stock'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS dashboard_summary_dirty ON public.%I',t);
  EXECUTE format('CREATE TRIGGER dashboard_summary_dirty AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION dashboard_private.queue_summaries_v1()',t);
 END LOOP;
END $$;

REVOKE ALL ON FUNCTION dashboard_private.queue_summaries_v1(),dashboard_private.assignment_branches_v1(jsonb),dashboard_private.assignments_source_v1(jsonb) FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
