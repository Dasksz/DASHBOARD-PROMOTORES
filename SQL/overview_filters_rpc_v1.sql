-- Overview facets follow portfolio/parent selections, not KPI-result restrictions.
CREATE OR REPLACE FUNCTION public.get_overview_filters_v1(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $fn$
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
END $fn$;
REVOKE ALL ON FUNCTION public.get_overview_filters_v1(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_overview_filters_v1(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.search_overview_clients_v1(p_query text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE s jsonb:=dashboard_private.scope_v1(); result jsonb;
BEGIN
 IF length(btrim(coalesce(p_query,'')))<3 THEN RETURN '[]'::jsonb; END IF;
 WITH terms AS(SELECT lower(btrim(t)) term,regexp_replace(lower(btrim(t)),'[^a-z0-9]','','g') clean FROM unnest(string_to_array(left(p_query,200),'%')) t WHERE btrim(t)<>''),
 matches AS(
 SELECT c.codigo_cliente code,coalesce(nullif(c.fantasia,''),nullif(c.nomecliente,''),nullif(c.razaosocial,''),'Sem Nome') name,
  coalesce(c.cidade,'') city,coalesce(c.cnpj_cpf,'') doc,CASE WHEN sc.coord IS NOT NULL THEN sc.promotor END promotor
 FROM public.data_clients c JOIN dashboard_private.clients_v1(s) sc ON sc.code=c.codigo_cliente
 WHERE EXISTS(SELECT 1 FROM terms) AND NOT EXISTS(SELECT 1 FROM terms t WHERE NOT (
  (t.clean<>'' AND (strpos(lower(c.codigo_cliente),t.clean)>0 OR strpos(regexp_replace(coalesce(c.cnpj_cpf,''),'[^0-9]','','g'),t.clean)>0))
  OR strpos(lower(coalesce(c.nomecliente,'')),t.term)>0 OR strpos(lower(coalesce(c.razaosocial,'')),t.term)>0
  OR strpos(lower(coalesce(c.fantasia,'')),t.term)>0 OR strpos(lower(coalesce(c.cidade,'')),t.term)>0 OR strpos(lower(coalesce(c.bairro,'')),t.term)>0))
 ORDER BY c.id LIMIT 10)
 SELECT coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb) INTO result FROM matches m;
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION public.search_overview_clients_v1(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.search_overview_clients_v1(text) TO authenticated;
