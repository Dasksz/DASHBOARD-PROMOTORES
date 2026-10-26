-- Branch-only proposal: phase 1 of Visão Geral. Do not apply before review.
-- Requires the existing dashboard_private scope_v1/clients_v1/assignments_v1 helpers.
-- Does not change source data, RLS, existing functions, or summary refresh jobs.
CREATE OR REPLACE FUNCTION public.get_overview_summary_v1(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $overview$
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
$overview$;
REVOKE ALL ON FUNCTION public.get_overview_summary_v1(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_overview_summary_v1(jsonb) TO authenticated;
COMMENT ON FUNCTION public.get_overview_summary_v1(jsonb) IS 'Visão Geral phase 1: existing KPI/hierarchy formulas; authorized scope derives from session, never from filters.';
