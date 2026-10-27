CREATE OR REPLACE FUNCTION dashboard_private.assignment_branches_v1(s jsonb)
 RETURNS TABLE(client text, seller text, supervisor text, supervisor_name text, filial text, raw_supervisor text, branch_date timestamp with time zone, branch_source text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION dashboard_private.assignments_source_v1(s jsonb)
 RETURNS TABLE(client text, seller text, supervisor text, supervisor_name text, filial text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION dashboard_private.refresh_summaries_v1(force_refresh boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET jit TO 'off'
 SET work_mem TO '32MB'
AS $function$
DECLARE st dashboard_private.summary_state; result jsonb;
BEGIN
 IF NOT ((auth.uid() IS NOT NULL AND public.is_admin()) OR (auth.uid() IS NULL AND (session_user IN('postgres','supabase_admin') OR current_setting('role',true)='service_role'))) THEN
  RAISE EXCEPTION 'Atualização reservada ao administrador' USING ERRCODE='42501';
 END IF;
 IF NOT pg_try_advisory_xact_lock(70261002,1) THEN RETURN jsonb_build_object('status','busy'); END IF;
 SELECT * INTO st FROM dashboard_private.summary_state WHERE id=true;
 IF NOT force_refresh AND NOT st.dirty THEN RETURN jsonb_build_object('status','current','generation',st.generation); END IF;
 -- Capture the revision without locking the upload trigger's state row.
 -- New source commits during the rebuild must leave dirty=true for the next generation.
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
 IF to_regprocedure('dashboard_private.comparison_result_v2(jsonb,jsonb)') IS NOT NULL THEN
  INSERT INTO dashboard_private.page_rollups
  SELECT 'comparison',k,dashboard_private.comparison_result_v2('{"kind":"admin"}',k)||jsonb_build_object('summary_generation',st.generation+1)
  FROM(VALUES('{}'::jsonb),('{"pasta":"PEPSICO"}'::jsonb)) keys(k);
 END IF;
 IF to_regprocedure('dashboard_private.comparison_filters_result_v2(jsonb,jsonb)') IS NOT NULL THEN
  INSERT INTO dashboard_private.page_rollups
  SELECT 'comparison_filters',k,dashboard_private.comparison_filters_result_v2('{"kind":"admin"}',k)
  FROM(VALUES('{}'::jsonb),('{"pasta":"PEPSICO"}'::jsonb)) keys(k);
 END IF;
 ANALYZE dashboard_private.sales_month_core; ANALYZE dashboard_private.receivables_summary;
 ANALYZE dashboard_private.sales_day; ANALYZE dashboard_private.sales_month; ANALYZE dashboard_private.weekly_day;
 ANALYZE dashboard_private.sales_facets; ANALYZE dashboard_private.sales_calendar; ANALYZE dashboard_private.client_assignments;
 UPDATE dashboard_private.summary_state SET dirty=(last_change IS DISTINCT FROM st.last_change),generation=generation+1,refreshed_at=clock_timestamp() WHERE id=true RETURNING
  jsonb_build_object('status','refreshed','generation',generation,'refreshed_at',refreshed_at) INTO result;
 RETURN result;
END $function$
;
CREATE OR REPLACE FUNCTION dashboard_private.rows_v1(s jsonb, f jsonb DEFAULT '{}'::jsonb, purpose text DEFAULT 'all'::text)
 RETURNS TABLE(source text, client text, product text, supplier text, virtual_supplier text, seller text, seller_name text, supervisor text, supervisor_name text, filial text, sale_type text, day date, amount numeric, bonus numeric, units numeric, boxes numeric, description text, registered date, city text, rede text, coord text, coord_name text, cocoord text, cocoord_name text, promotor text, promotor_name text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION dashboard_private.scope_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
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
END $function$
;
CREATE OR REPLACE FUNCTION public.get_overview_filters_v1(p_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE s jsonb:=dashboard_private.scope_v1(); f jsonb:=coalesce(p_filters,'{}'); r text; k text; result jsonb;
BEGIN
 IF jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 IF coalesce(f->>'mode','promoter') NOT IN ('promoter','seller') THEN RAISE EXCEPTION 'Modo inválido' USING ERRCODE='22023'; END IF;
 FOREACH k IN ARRAY ARRAY['coords','cocoords','promotors','supervisors','sellers','suppliers','types','redes'] LOOP
  IF f ? k AND (jsonb_typeof(f->k)<>'array' OR EXISTS(SELECT 1 FROM jsonb_array_elements(f->k) x WHERE jsonb_typeof(x)<>'string')) THEN RAISE EXCEPTION 'Filtro inválido: %',k USING ERRCODE='22023'; END IF;
 END LOOP;
 SELECT lower(btrim(role)) INTO r FROM public.profiles WHERE id=auth.uid();
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 hierarchy AS MATERIALIZED(
  SELECT upper(btrim(h.cod_coord)) coord,upper(coalesce(nullif(h.nome_coord,''),h.cod_coord)) coord_name,
   upper(btrim(h.cod_cocoord)) cocoord,upper(coalesce(nullif(h.nome_cocoord,''),h.cod_cocoord)) cocoord_name,
   upper(btrim(h.cod_promotor)) promotor,upper(coalesce(nullif(h.nome_promotor,''),h.cod_promotor)) promotor_name
  FROM public.data_hierarchy h WHERE s->>'kind'='admin'
   OR r IN(lower(btrim(h.cod_coord)),lower(btrim(h.cod_cocoord)),lower(btrim(h.cod_promotor)))
   OR (s->>'kind' IN ('seller','supervisor') AND EXISTS(SELECT 1 FROM clients c WHERE lower(btrim(c.promotor))=lower(btrim(h.cod_promotor))))
 ),
 sellers AS MATERIALIZED(
  SELECT DISTINCT c.rca code,coalesce(nullif(v.nome,''),c.rca) label,a.supervisor_name
  FROM clients c LEFT JOIN assignments a ON a.client=c.code LEFT JOIN public.dim_vendedores v ON v.codigo=c.rca
  WHERE c.rca NOT IN ('','0','N/A') AND
   CASE WHEN coalesce(f->>'mode','promoter')='seller' THEN
    coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? a.supervisor_name,false)
   ELSE (coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false))
    AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false))
    AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false)) END
 ),
 current_rows AS MATERIALIZED(
  SELECT codcli,codfor,tipovenda FROM public.data_detailed d WHERE s->>'kind'='admin' OR s->'clients' ? d.codcli OR s->'ghosts' ? d.codcli
 ),
 sources AS MATERIALIZED(
  SELECT codcli,codfor FROM current_rows UNION
  SELECT codcli,codfor FROM public.data_history d WHERE s->>'kind'='admin' OR s->'clients' ? d.codcli
 ),
 supplier_ids AS(
  SELECT DISTINCT d.codfor FROM sources d LEFT JOIN public.dim_fornecedores df ON df.codigo=d.codfor
  WHERE coalesce(df.nome,d.codfor,'') NOT IN ('','N/A') AND upper(d.codfor) NOT IN ('CODFOR','FORNECEDOR','COD FOR','NOME DO FORNECEDOR','FORNECEDOR_NOME')
   AND (coalesce(f->>'supplier_client','')='' OR d.codcli=f->>'supplier_client')
   AND (coalesce(f->>'supplier_pasta','')='' OR coalesce(nullif(df.pasta,''),CASE WHEN upper(coalesce(df.nome,d.codfor)) LIKE '%PEPSICO%' THEN 'PEPSICO' ELSE 'MULTIMARCAS' END)=f->>'supplier_pasta')
 ),
 options AS(
  SELECT 'coords' kind,coord code,min(coord_name) label FROM hierarchy WHERE coalesce(coord,'')<>'' GROUP BY coord
  UNION ALL SELECT 'cocoords',cocoord,min(cocoord_name) FROM hierarchy WHERE coalesce(cocoord,'')<>'' AND (coalesce(jsonb_array_length(f->'coords'),0)=0 OR f->'coords' ? coord) GROUP BY cocoord
  UNION ALL SELECT 'promotors',promotor,min(promotor_name) FROM hierarchy WHERE coalesce(promotor,'')<>''
   AND (coalesce(jsonb_array_length(f->'coords'),0)=0 OR f->'coords' ? coord)
   AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR f->'cocoords' ? cocoord) GROUP BY promotor
  UNION ALL SELECT 'sellers',code,min(label) FROM sellers GROUP BY code
  UNION ALL SELECT 'supervisors',supervisor_name,supervisor_name FROM assignments WHERE supervisor_name NOT IN ('','0','N/A') GROUP BY supervisor_name
  UNION ALL SELECT 'redes',rede,rede FROM clients WHERE upper(rede) NOT IN ('','N/A','RAMO','RAMO DE ATIVIDADE','RAMO_ATIVIDADE','DESCRICAO','ATIVIDADE') GROUP BY rede
  UNION ALL SELECT 'types',tipovenda,tipovenda FROM current_rows WHERE coalesce(tipovenda,'')<>'' AND upper(tipovenda) NOT IN ('TIPOVENDA','TIPO VENDA','TIPO','CODUSUR','CODCLI','SUPERV','NOME') GROUP BY tipovenda
  UNION ALL SELECT 'suppliers',i.codfor,CASE i.codfor WHEN '707' THEN 'EXTRUSADOS' WHEN '708' THEN 'NÃO EXTRUSADOS' WHEN '752' THEN 'TORCIDA' ELSE coalesce(df.nome,i.codfor) END FROM supplier_ids i LEFT JOIN public.dim_fornecedores df ON df.codigo=i.codfor WHERE i.codfor<>'1119'
  UNION ALL SELECT 'suppliers',v.code,v.label FROM (VALUES ('1119_TODDY','TODDY'),('1119_TODDYNHO','TODDYNHO'),('1119_QUAKER_KEROCOCO','QUAKER/KEROCOCO')) v(code,label) WHERE EXISTS(SELECT 1 FROM supplier_ids WHERE codfor='1119')
 ), grouped AS(SELECT kind,jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label,code) vals FROM options GROUP BY kind)
 SELECT jsonb_build_object('schema_version',1,'client_has_sales',EXISTS(SELECT 1 FROM sources WHERE codcli=f->>'supplier_client')) || coalesce(jsonb_object_agg(keys.kind,coalesce(g.vals,'[]'::jsonb)),'{}'::jsonb)
 INTO result FROM unnest(ARRAY['coords','cocoords','promotors','sellers','supervisors','redes','types','suppliers']) keys(kind) LEFT JOIN grouped g USING(kind);
 RETURN result;
END $function$
;
CREATE OR REPLACE FUNCTION public.get_overview_summary_v1(p_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE
 s jsonb := dashboard_private.scope_v1();
 f jsonb := coalesce(p_filters,'{}'::jsonb);
 k text;
 alt boolean;
 result jsonb;
BEGIN
 IF jsonb_typeof(f) <> 'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 IF coalesce(f->>'mode','promoter') NOT IN ('promoter','seller') THEN
  RAISE EXCEPTION 'Modo inválido' USING ERRCODE='22023';
 END IF;
 FOREACH k IN ARRAY ARRAY['coords','cocoords','promotors','supervisors','sellers','suppliers','types','redes'] LOOP
  IF f ? k AND (jsonb_typeof(f->k)<>'array' OR EXISTS(SELECT 1 FROM jsonb_array_elements(f->k) x WHERE jsonb_typeof(x)<>'string')) THEN
   RAISE EXCEPTION 'Filtro % inválido',k USING ERRCODE='22023';
  END IF;
 END LOOP;
 alt := coalesce(jsonb_array_length(f->'types'),0)>0 AND NOT (coalesce(f->'types' ? '1',false) OR coalesce(f->'types' ? '9',false));
 WITH
 clients AS MATERIALIZED (SELECT * FROM dashboard_private.clients_v1(s - 'ghosts')),
 assignments AS MATERIALIZED (SELECT * FROM dashboard_private.assignments_v1(s)),
 hierarchy_clients AS MATERIALIZED (
  SELECT c.* FROM clients c LEFT JOIN assignments a ON a.client=c.code
  WHERE (coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false))
   AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false))
   AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))
   AND (coalesce(f->>'mode','promoter')<>'seller' OR coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? a.supervisor_name,false))
   AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? c.rca,false))
 ),
 portfolio AS MATERIALIZED (SELECT * FROM hierarchy_clients c WHERE dashboard_private.rede_v1(f,c.rede)),
 hierarchy_filtered AS (SELECT (SELECT count(*) FROM hierarchy_clients)<(SELECT count(*) FROM clients) active),
 raw AS MATERIALIZED (
  SELECT d.*, CASE WHEN d.codfor='1119' THEN CASE WHEN upper(coalesce(dp.descricao,'')) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(coalesce(dp.descricao,'')) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(coalesce(dp.descricao,'')) LIKE '%QUAKER%' OR upper(coalesce(dp.descricao,'')) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END virtual_supplier, CASE WHEN coalesce(df.pasta,'')<>'' THEN df.pasta
      WHEN upper(coalesce(df.nome,d.codfor,'')) LIKE '%PEPSICO%' THEN 'PEPSICO' ELSE 'MULTIMARCAS' END resolved_pasta
  FROM public.data_detailed d LEFT JOIN public.dim_fornecedores df ON df.codigo=d.codfor LEFT JOIN public.dim_produtos dp ON dp.codigo=d.produto
  WHERE (s->>'kind'='admin' OR coalesce(s->'clients' ? d.codcli,false) OR coalesce(s->'ghosts' ? d.codcli,false))
   AND NOT upper(btrim(coalesce(d.codusur,'')))=ANY(ARRAY['SUPERV','CODUSUR','CODSUPERVISOR','CODCLI','PRODUTO','CODFOR','QTVENDA','VLVENDA','VLBONIFIC','TOTPESOLIQ','ESTOQUEUNIT','TIPOVENDA','FILIAL','ESTOQUECX'])
 ),
 filtered AS MATERIALIZED (
  SELECT r.*, CASE WHEN alt THEN coalesce(r.vlbonific,0) ELSE coalesce(r.vlvenda,0) END amount,
    c.coord,c.coord_name,c.cocoord,c.cocoord_name,c.promotor,c.promotor_name
  FROM raw r LEFT JOIN clients c ON c.code=r.codcli
  WHERE (NOT (SELECT active FROM hierarchy_filtered) OR r.codcli IN(SELECT code FROM hierarchy_clients))
   AND (coalesce(f->>'client','')='' OR r.codcli=f->>'client')
   AND (coalesce(f->>'position','')='' OR r.posicao=f->>'position')
   AND (coalesce(f->>'pasta','')='' OR r.resolved_pasta=f->>'pasta')
   -- The main index includes both physical supplier IDs and the virtual Foods categories.
   AND (coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? r.codfor,false) OR coalesce(f->'suppliers' ? r.virtual_supplier,false))
   AND (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? r.tipovenda,false))
   AND (alt OR r.tipovenda IN ('1','9'))
   AND (coalesce(f->>'rede_group','')='' OR r.codcli IN(SELECT code FROM portfolio))
 ),
 client_totals AS (SELECT codcli,sum(amount) amount FROM filtered WHERE coalesce(codcli,'')<>'' GROUP BY codcli),
 totals AS (SELECT coalesce(sum(amount),0) revenue,coalesce(sum(totpesoliq),0) weight FROM filtered),
 skus AS (SELECT count(*) n FROM (SELECT DISTINCT codcli,produto FROM filtered WHERE coalesce(codcli,'')<>'') x),
 positive AS (SELECT count(*) n FROM client_totals WHERE amount>=1),
 base AS (SELECT count(*) n FROM portfolio),
 groups AS (
  SELECT g.kind,g.name,sum(d.amount) amount FROM filtered d
  CROSS JOIN LATERAL (VALUES
   ('vendasPorCoord',CASE WHEN d.coord IS NULL THEN 'Sem Estrutura' ELSE nullif(d.coord_name,'') END),
   ('vendasPorCoCoord',CASE WHEN d.coord IS NULL THEN 'Sem Estrutura' ELSE nullif(d.cocoord_name,'') END),
   ('vendasPorPromotor',CASE WHEN d.coord IS NULL THEN 'Sem Estrutura' ELSE nullif(d.promotor_name,'') END)
  ) g(kind,name) WHERE g.name IS NOT NULL GROUP BY g.kind,g.name
 ),
 maps AS (SELECT kind,jsonb_object_agg(name,amount) values FROM groups GROUP BY kind)
 SELECT jsonb_build_object('schema_version',1,'totalFaturamento',t.revenue,'totalPeso',t.weight,
   'positivacaoCount',p.n,'totalRelevantClients',b.n,
   'positivacaoPercent',CASE WHEN b.n>0 THEN p.n*100.0/b.n ELSE 0 END,
   'skuPdv',CASE WHEN p.n>0 THEN sk.n::numeric/p.n ELSE 0 END,
   'vendasPorCoord',coalesce((SELECT values FROM maps WHERE kind='vendasPorCoord'),'{}'::jsonb),
   'vendasPorCoCoord',coalesce((SELECT values FROM maps WHERE kind='vendasPorCoCoord'),'{}'::jsonb),
   'vendasPorPromotor',coalesce((SELECT values FROM maps WHERE kind='vendasPorPromotor'),'{}'::jsonb))
 INTO result FROM totals t CROSS JOIN positive p CROSS JOIN base b CROSS JOIN skus sk;
 RETURN result;
END;
$function$
;
select dashboard_private.refresh_summaries_v1(true);