-- Read-only snapshot of existing helpers, used only by the isolated test database.
CREATE OR REPLACE FUNCTION dashboard_private.assignments_v1(s jsonb)
 RETURNS TABLE(client text, seller text, supervisor text, supervisor_name text, filial text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 WITH base AS MATERIALIZED(SELECT a.* FROM dashboard_private.client_assignments a WHERE s->>'kind'='admin'
 OR a.client IN(SELECT jsonb_array_elements_text(s->'clients')) OR a.client IN(SELECT jsonb_array_elements_text(s->'ghosts'))),
 sup AS(SELECT DISTINCT ON(seller) seller,raw_supervisor FROM base WHERE branch_source IS NOT NULL
 ORDER BY seller,branch_date DESC NULLS LAST,branch_source,raw_supervisor)
 SELECT b.client,b.seller,sup.raw_supervisor,coalesce(ds.nome,sup.raw_supervisor,'N/A'),b.filial
 FROM base b LEFT JOIN sup ON sup.seller=b.seller LEFT JOIN public.dim_supervisores ds ON ds.codigo=sup.raw_supervisor;
$function$;

CREATE OR REPLACE FUNCTION dashboard_private.clients_v1(s jsonb)
 RETURNS TABLE(code text, rca text, city text, rede text, coord text, coord_name text, cocoord text, cocoord_name text, promotor text, promotor_name text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 SELECT c.codigo_cliente,CASE WHEN upper(coalesce(c.razaosocial,c.nomecliente,'')) LIKE '%AMERICANAS%' THEN '1001' ELSE c.rca1 END,
 coalesce(nullif(c.cidade,''),'N/A'),coalesce(nullif(c.ramo,''),'N/A'),h.cod_coord,h.nome_coord,h.cod_cocoord,h.nome_cocoord,cp.promoter_code,coalesce(h.nome_promotor,cp.promoter_code)
 FROM public.data_clients c
 LEFT JOIN public.data_client_promoters cp ON cp.client_code=c.codigo_cliente
 LEFT JOIN LATERAL (SELECT * FROM public.data_hierarchy h WHERE lower(btrim(h.cod_promotor))=lower(btrim(cp.promoter_code)) ORDER BY h.id LIMIT 1) h ON true
 WHERE s->>'kind'='admin' OR c.codigo_cliente IN(SELECT jsonb_array_elements_text(s->'clients'))
 OR c.codigo_cliente IN(SELECT jsonb_array_elements_text(s->'ghosts'));
$function$;

CREATE OR REPLACE FUNCTION dashboard_private.rede_v1(f jsonb, v text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 SELECT CASE coalesce(f->>'rede_group','') WHEN 'com_rede' THEN coalesce(v,'N/A') NOT IN('','N/A') AND (coalesce(jsonb_array_length(f->'redes'),0)=0 OR coalesce(f->'redes' ? v,false))
 WHEN 'sem_rede' THEN coalesce(v,'N/A') IN('','N/A') ELSE true END;
$function$;

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
END $function$;

