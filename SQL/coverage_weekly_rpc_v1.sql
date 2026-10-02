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
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET jit='off' SET work_mem='32MB' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); result jsonb; f jsonb:=p_filters;
BEGIN
 IF p_page NOT IN('coverage','weekly') OR jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Página ou filtros inválidos' USING ERRCODE='22023'; END IF;
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 raw AS MATERIALIZED(
 SELECT 'current'::text source,codcli,produto,codfor,filial,tipovenda,(dtped AT TIME ZONE 'UTC')::date AS day FROM public.data_detailed
 WHERE s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR codcli IN(SELECT jsonb_array_elements_text(s->'ghosts'))
 UNION ALL SELECT 'history',codcli,produto,codfor,filial,tipovenda,(dtped AT TIME ZONE 'UTC')::date FROM public.data_history
 WHERE s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients'))),
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
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); f jsonb:=p_filters; ref date; target date; result jsonb;
BEGIN
 IF jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 SELECT coalesce((SELECT max((dtped AT TIME ZONE 'UTC')::date) FROM public.data_detailed),(SELECT max((dtped AT TIME ZONE 'UTC')::date) FROM public.data_history),current_date) INTO ref;
 target:=CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',ref)::date ELSE ((f->>'month')||'-01')::date END;
 WITH rows AS NOT MATERIALIZED(SELECT source,client,day,amount,supplier,virtual_supplier,seller,seller_name,supervisor_name,filial,rede,coord,cocoord,promotor,promotor_name FROM (
WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 products AS MATERIALIZED(SELECT * FROM public.dim_produtos), details AS MATERIALIZED(SELECT * FROM public.data_product_details),
 vendors AS MATERIALIZED(SELECT * FROM public.dim_vendedores), supervisors AS MATERIALIZED(SELECT * FROM public.dim_supervisores), raw AS MATERIALIZED(
 SELECT 'current'::text source,d.codcli,d.produto,d.codfor,d.codusur,d.codsupervisor,d.filial,d.tipovenda,(d.dtped AT TIME ZONE 'UTC')::date AS day,coalesce(d.vlvenda,0) amount,coalesce(d.vlbonific,0) bonus,coalesce(d.qtvenda,0) units
 FROM public.data_detailed d LEFT JOIN clients c ON c.code=d.codcli WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR d.codcli IN(SELECT jsonb_array_elements_text(s->'ghosts')))
 AND ('weekly'<>'coverage' OR (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false)))
 AND ('weekly'<>'coverage' OR (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)))
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR (d.codfor='1119' AND EXISTS(SELECT 1 FROM products p WHERE p.codigo=d.produto AND coalesce(f->'suppliers' ? (CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END),false))))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? coalesce(nullif(c.rca,''),d.codusur),false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND ('weekly'<>'weekly' OR coalesce(f->>'month','current')='current')
 UNION ALL
 SELECT 'history',d.codcli,d.produto,d.codfor,d.codusur,d.codsupervisor,d.filial,d.tipovenda,(d.dtped AT TIME ZONE 'UTC')::date,coalesce(d.vlvenda,0),coalesce(d.vlbonific,0),coalesce(d.qtvenda,0)
 FROM public.data_history d LEFT JOIN clients c ON c.code=d.codcli WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')))
 AND ('weekly'<>'coverage' OR (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false)))
 AND ('weekly'<>'coverage' OR (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)))
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR (d.codfor='1119' AND EXISTS(SELECT 1 FROM products p WHERE p.codigo=d.produto AND coalesce(f->'suppliers' ? (CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END),false))))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? coalesce(nullif(c.rca,''),d.codusur),false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND ('weekly'<>'weekly' OR ((d.dtped AT TIME ZONE 'UTC')::date >= (CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',(SELECT max(dtped) FROM public.data_detailed) AT TIME ZONE 'UTC')::date ELSE ((f->>'month')||'-01')::date END)-interval '1 month' AND (d.dtped AT TIME ZONE 'UTC')::date < (CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',(SELECT max(dtped) FROM public.data_detailed) AT TIME ZONE 'UTC')::date ELSE ((f->>'month')||'-01')::date+interval '1 month' END)))
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
 LEFT JOIN supervisors ds ON ds.codigo=coalesce(ss.supervisor,r.codsupervisor)
) page_rows(source,client,product,supplier,virtual_supplier,seller,seller_name,supervisor,supervisor_name,filial,sale_type,day,amount,bonus,units,boxes,description,registered,city,rede,coord,coord_name,cocoord,cocoord_name,promotor,promotor_name)),
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
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); f jsonb:=p_filters; ref date; start_date date; end_date date; prev_start date; prev_end date;
 custom_date boolean; alt boolean; result jsonb; days integer:=greatest(coalesce((f->>'working_days')::int,0),0);
BEGIN
 IF jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 SELECT coalesce((SELECT max((dtped AT TIME ZONE 'UTC')::date) FROM public.data_detailed),(SELECT max((dtped AT TIME ZONE 'UTC')::date) FROM public.data_history),current_date) INTO ref;
 custom_date:=nullif(f->>'date_start','') IS NOT NULL AND nullif(f->>'date_end','') IS NOT NULL;
 start_date:=CASE WHEN custom_date THEN (f->>'date_start')::date ELSE date_trunc('month',ref)::date END;
 end_date:=CASE WHEN custom_date THEN (f->>'date_end')::date ELSE (start_date+interval '1 month - 1 day')::date END;
 IF end_date<start_date THEN RAISE EXCEPTION 'Período inválido' USING ERRCODE='22023'; END IF;
 prev_start:=(start_date-interval '1 month')::date; prev_end:=(end_date-interval '1 month')::date;
 IF NOT custom_date THEN prev_end:=start_date-1; END IF;
 alt:=coalesce(jsonb_array_length(f->'types'),0)>0 AND NOT(coalesce(f->'types' ? '1',false) OR coalesce(f->'types' ? '9',false));
 WITH rows AS NOT MATERIALIZED(SELECT source,client,product,supplier,virtual_supplier,filial,sale_type,day,amount,bonus,units,boxes,description,registered,city,rede,coord,cocoord,promotor,promotor_name,seller_name FROM (
WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 products AS MATERIALIZED(SELECT * FROM public.dim_produtos), details AS MATERIALIZED(SELECT * FROM public.data_product_details),
 vendors AS MATERIALIZED(SELECT * FROM public.dim_vendedores), supervisors AS MATERIALIZED(SELECT * FROM public.dim_supervisores), raw AS MATERIALIZED(
 SELECT 'current'::text source,d.codcli,d.produto,d.codfor,d.codusur,d.codsupervisor,d.filial,d.tipovenda,(d.dtped AT TIME ZONE 'UTC')::date AS day,coalesce(d.vlvenda,0) amount,coalesce(d.vlbonific,0) bonus,coalesce(d.qtvenda,0) units
 FROM public.data_detailed d LEFT JOIN clients c ON c.code=d.codcli WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR d.codcli IN(SELECT jsonb_array_elements_text(s->'ghosts')))
 AND ('coverage'<>'coverage' OR (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false)))
 AND ('coverage'<>'coverage' OR (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)))
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR (d.codfor='1119' AND EXISTS(SELECT 1 FROM products p WHERE p.codigo=d.produto AND coalesce(f->'suppliers' ? (CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END),false))))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? coalesce(nullif(c.rca,''),d.codusur),false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND ('coverage'<>'weekly' OR coalesce(f->>'month','current')='current')
 UNION ALL
 SELECT 'history',d.codcli,d.produto,d.codfor,d.codusur,d.codsupervisor,d.filial,d.tipovenda,(d.dtped AT TIME ZONE 'UTC')::date,coalesce(d.vlvenda,0),coalesce(d.vlbonific,0),coalesce(d.qtvenda,0)
 FROM public.data_history d LEFT JOIN clients c ON c.code=d.codcli WHERE (s->>'kind'='admin' OR d.codcli IN(SELECT jsonb_array_elements_text(s->'clients')))
 AND ('coverage'<>'coverage' OR (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false)))
 AND ('coverage'<>'coverage' OR (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)))
 AND (coalesce(f->>'filial','all') IN('all','ambas') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR (d.codfor='1119' AND EXISTS(SELECT 1 FROM products p WHERE p.codigo=d.produto AND coalesce(f->'suppliers' ? (CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END),false))))
 AND (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? coalesce(nullif(c.rca,''),d.codusur),false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND ('coverage'<>'weekly' OR ((d.dtped AT TIME ZONE 'UTC')::date >= (CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',(SELECT max(dtped) FROM public.data_detailed) AT TIME ZONE 'UTC')::date ELSE ((f->>'month')||'-01')::date END)-interval '1 month' AND (d.dtped AT TIME ZONE 'UTC')::date < (CASE WHEN coalesce(f->>'month','current')='current' THEN date_trunc('month',(SELECT max(dtped) FROM public.data_detailed) AT TIME ZONE 'UTC')::date ELSE ((f->>'month')||'-01')::date+interval '1 month' END)))
 )
 SELECT r.source,r.codcli,r.produto,r.codfor,CASE WHEN r.codfor='1119' THEN CASE
 WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY'
 WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END,
 coalesce(nullif(c.rca,''),r.codusur),coalesce(v.nome,coalesce(nullif(c.rca,''),r.codusur),'N/A'),
 r.codsupervisor,coalesce(r.codsupervisor,'N/A'),r.filial,r.tipovenda,r.day,r.amount,r.bonus,r.units,
 r.units/CASE WHEN p.qtde_master>0 THEN p.qtde_master ELSE 1 END,
 coalesce(nullif(p.descricao,''),'Produto '||r.produto),(pd.dtcadastro AT TIME ZONE 'UTC')::date,
 coalesce(c.city,'N/A'),coalesce(c.rede,'N/A'),c.coord,c.coord_name,c.cocoord,c.cocoord_name,c.promotor,c.promotor_name
 FROM raw r LEFT JOIN clients c ON c.code=r.codcli
 LEFT JOIN products p ON p.codigo=r.produto
 LEFT JOIN details pd ON pd.code=r.produto
 LEFT JOIN vendors v ON v.codigo=coalesce(nullif(c.rca,''),r.codusur)
) page_rows(source,client,product,supplier,virtual_supplier,seller,seller_name,supervisor,supervisor_name,filial,sale_type,day,amount,bonus,units,boxes,description,registered,city,rede,coord,coord_name,cocoord,cocoord_name,promotor,promotor_name)), clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 seller_sup AS(SELECT DISTINCT seller,supervisor_name FROM assignments),
 branches AS(SELECT client,filial FROM assignments),
 base_clients AS MATERIALIZED(SELECT c.* FROM clients c WHERE
 (coalesce(f->>'mode','promoter')='seller' OR ((coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false)) AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false)) AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR EXISTS(SELECT 1 FROM seller_sup ss WHERE ss.seller=c.rca AND (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? ss.supervisor_name,false))) OR coalesce(jsonb_array_length(f->'supervisors'),0)=0)
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? c.rca,false))
 AND (CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(c.rede,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? c.rede,false)) WHEN 'sem_rede' THEN coalesce(c.rede,'N/A') IN('','N/A') ELSE true END)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city'))
 AND (coalesce(f->>'filial','ambas') IN('ambas','all') OR EXISTS(SELECT 1 FROM branches b WHERE b.client=c.code AND b.filial=f->>'filial'))),
 scoped AS MATERIALIZED(SELECT source,client,product,day,description,registered,city,promotor_name,seller_name,amount,units,boxes,CASE WHEN alt THEN bonus ELSE amount END value FROM rows r
 WHERE client IN(SELECT code FROM base_clients)
 AND (coalesce(f->>'filial','ambas') IN('ambas','all') OR filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? supplier,false)) OR coalesce(f->'suppliers' ? virtual_supplier,false))
 AND (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? product,false)) AND (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? sale_type,false))),
 filtered AS NOT MATERIALIZED(SELECT source,client,product,day,description,registered,city,promotor_name,seller_name,boxes,value FROM scoped WHERE (f->>'price_min' IS NULL AND f->>'price_max' IS NULL) OR
 (units<>0 AND (f->>'price_min' IS NULL OR amount/units>=(f->>'price_min')::numeric) AND(f->>'price_max' IS NULL OR amount/units<=(f->>'price_max')::numeric))),
 periods AS MATERIALIZED(
 SELECT r.*,'current'::text period FROM filtered r WHERE (custom_date AND day BETWEEN start_date AND end_date) OR(NOT custom_date AND source='current')
 UNION ALL SELECT r.*,'previous' FROM filtered r WHERE (custom_date AND day BETWEEN prev_start AND prev_end) OR(NOT custom_date AND source='history' AND day BETWEEN prev_start AND prev_end)
 UNION ALL SELECT source,NULL::text,product,day,description,registered,NULL::text,NULL::text,NULL::text,sum(boxes),sum(value),'history'
 FROM filtered WHERE NOT custom_date AND source='history' AND day NOT BETWEEN prev_start AND prev_end
 GROUP BY source,product,day,description,registered),
 product_clients AS(SELECT product,client,period,sum(value) value FROM periods WHERE period IN('current','previous') GROUP BY 1,2,3),
 product_counts AS(SELECT product,count(*) FILTER(WHERE period='current' AND value>=1) current_count,count(*) FILTER(WHERE period='previous' AND value>=1) previous_count FROM product_clients GROUP BY product),
 selection AS(SELECT client,period,sum(value) value FROM periods WHERE period IN('current','previous') GROUP BY 1,2),
 active_history AS(SELECT client FROM scoped WHERE source='history' GROUP BY client HAVING sum(amount)>=1),
 working AS MATERIALIZED(SELECT DISTINCT day FROM (SELECT (dtped AT TIME ZONE 'UTC')::date AS day FROM public.data_detailed WHERE s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients')) OR codcli IN(SELECT jsonb_array_elements_text(s->'ghosts')) UNION ALL SELECT (dtped AT TIME ZONE 'UTC')::date FROM public.data_history WHERE s->>'kind'='admin' OR codcli IN(SELECT jsonb_array_elements_text(s->'clients'))) wd WHERE extract(isodow FROM day) BETWEEN 1 AND 5),
 working_array AS(SELECT array_agg(day ORDER BY day) dates FROM working),
 stats AS MATERIALIZED(SELECT product,min(description) description,min(registered) registered,
 coalesce(sum(boxes) FILTER(WHERE period='current'),0) current_boxes,coalesce(sum(boxes) FILTER(WHERE period='previous'),0) previous_boxes,
 bool_or(day<date_trunc('month',ref)::date) has_history FROM periods GROUP BY product),
 stock AS(SELECT product_code,sum(coalesce(stock_qty,0)) qty FROM public.data_stock WHERE coalesce(f->>'filial','ambas') IN('ambas','all') OR filial=f->>'filial' GROUP BY product_code),
 divisors AS MATERIALIZED(SELECT t.*,coalesce(st.qty,0) stock,coalesce(pc.current_count,0) current_count,coalesce(pc.previous_count,0) previous_count,
 greatest(1,CASE WHEN NOT coalesce(has_history,false) AND current_boxes>0 THEN least(
 greatest((SELECT count(*) FROM generate_series(date_trunc('month',ref)::date,ref,'1 day') d WHERE extract(isodow FROM d) BETWEEN 1 AND 5),1),
 CASE WHEN days>0 THEN days ELSE greatest((SELECT count(*) FROM generate_series(date_trunc('month',ref)::date,ref,'1 day') d WHERE extract(isodow FROM d) BETWEEN 1 AND 5),1) END)
 ELSE CASE WHEN days>0 THEN least(days,(SELECT count(*) FROM working WHERE registered IS NULL OR day>=registered)) ELSE (SELECT count(*) FROM working WHERE registered IS NULL OR day>=registered) END END)::numeric divisor
 FROM stats t LEFT JOIN stock st ON st.product_code=t.product LEFT JOIN product_counts pc USING(product)),
 -- Aggregate once per product/day, then join the small result to each divisor.
 -- UNION ALL period duplicates remain meaningful for overlapping custom ranges.
 product_days AS MATERIALIZED(SELECT product,day,sum(boxes) boxes FROM periods GROUP BY product,day),
 trend_totals AS MATERIALIZED(SELECT d.product,coalesce(sum(p.boxes),0)/d.divisor daily_avg
 FROM divisors d CROSS JOIN working_array w LEFT JOIN product_days p ON p.product=d.product
 AND p.day BETWEEN w.dates[greatest(1,cardinality(w.dates)-d.divisor::int+1)] AND w.dates[cardinality(w.dates)]
 GROUP BY d.product,d.divisor),
 trend AS(SELECT d.*,t.daily_avg FROM divisors d JOIN trend_totals t USING(product)),
 table_all AS MATERIALIZED(SELECT product code,'('||product||') '||description descricao,stock "stockQty",current_boxes "boxesSoldCurrentMonth",previous_boxes "boxesSoldPreviousMonth",
 CASE WHEN previous_boxes>0 THEN (current_boxes-previous_boxes)/previous_boxes*100 WHEN current_boxes>0 THEN NULL ELSE 0 END "boxesVariation",
 CASE WHEN previous_count>0 THEN (current_count-previous_count)::numeric/previous_count*100 WHEN current_count>0 THEN NULL ELSE 0 END "pdvVariation",
 CASE WHEN daily_avg>0 THEN stock/daily_avg WHEN stock>0 THEN NULL ELSE 0 END "trendDays",previous_count "clientsPreviousCount",current_count "clientsCurrentCount",
 CASE WHEN (SELECT count(*) FROM base_clients)>0 THEN current_count::numeric/(SELECT count(*) FROM base_clients)*100 ELSE 0 END "coverageCurrent" FROM trend),
 table_filtered AS MATERIALIZED(SELECT * FROM table_all WHERE "boxesSoldCurrentMonth">0 AND CASE coalesce(f->>'trend','all') WHEN 'low' THEN "trendDays"<15 WHEN 'medium' THEN "trendDays">=15 AND "trendDays"<30 WHEN 'good' THEN "trendDays">=30 ELSE true END),
 cities AS(SELECT city name,sum(CASE WHEN coalesce(f->>'metric','boxes')='boxes' THEN boxes ELSE value END) value FROM periods WHERE period='current' GROUP BY city),
 ranking AS(SELECT CASE WHEN coalesce(f->>'mode','promoter')='promoter' THEN coalesce(promotor_name,'N/A') ELSE seller_name END name,sum(CASE WHEN coalesce(f->>'metric','boxes')='boxes' THEN boxes ELSE value END) value FROM periods WHERE period='current' GROUP BY 1),
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
