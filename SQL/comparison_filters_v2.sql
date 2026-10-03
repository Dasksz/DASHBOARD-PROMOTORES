CREATE OR REPLACE FUNCTION dashboard_private.comparison_filters_result_v2(s jsonb,p_filters jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s'
SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' SET enable_nestloop='off' AS $$
DECLARE f jsonb:=p_filters; result jsonb; options jsonb;
BEGIN
 IF jsonb_typeof(f) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 result:=dashboard_private.facet_result_v1('coverage',s,f);
 WITH raw AS MATERIALIZED(SELECT r.*,c.cidade city,coalesce(p.descricao,'Produto '||r.produto) description,
 coalesce(df.nome,r.codfor) supplier_name,
 CASE WHEN r.codfor='1119' THEN CASE WHEN upper(p.descricao) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO' WHEN upper(p.descricao) LIKE '%TODDY%' THEN '1119_TODDY' WHEN upper(p.descricao) LIKE '%QUAKER%' OR upper(p.descricao) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO' END END virtual_supplier,
 r.group_name pasta
 FROM dashboard_private.comparison_rows_v2(s,(f-ARRAY['suppliers','products','city','pasta'])||'{"facet_pasta":true}') r
 JOIN public.data_clients c ON c.codigo_cliente=r.codcli
 LEFT JOIN public.dim_produtos p ON p.codigo=r.produto LEFT JOIN public.dim_fornecedores df ON df.codigo=r.codfor),
 flags AS MATERIALIZED(SELECT *,
 (coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? codfor,false) OR coalesce(f->'suppliers' ? virtual_supplier,false)) sm,
 (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? produto,false)) pm,
 (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? tipovenda,false)) tm,
 (coalesce(f->>'city','')='' OR lower(city)=lower(f->>'city')) cm,
 (coalesce(f->>'pasta','')='' OR pasta=f->>'pasta') fm FROM raw),
 opts AS(SELECT 'suppliers' key,codfor code,supplier_name label FROM flags WHERE pm AND tm AND cm AND fm
 UNION SELECT 'suppliers',virtual_supplier,CASE virtual_supplier WHEN '1119_TODDYNHO' THEN 'TODDYNHO' WHEN '1119_TODDY' THEN 'TODDY' ELSE 'QUAKER / KEROCOCO' END FROM flags WHERE pm AND tm AND cm AND fm AND virtual_supplier IS NOT NULL
 UNION SELECT 'products',produto,'('||produto||') '||description FROM flags WHERE sm AND tm AND cm AND fm
 UNION SELECT 'types',tipovenda,tipovenda FROM flags WHERE sm AND pm AND cm AND fm AND tipovenda IS NOT NULL
 UNION SELECT 'cities',city,city FROM flags WHERE sm AND pm AND tm AND fm AND city NOT IN('','N/A','CIDADE','MUNICIPIO','CIDADE_CLIENTE','NOME DA CIDADE','CITY')
 UNION SELECT 'pastas',pasta,pasta FROM flags WHERE sm AND pm AND tm AND cm)
 SELECT jsonb_object_agg(key,items) INTO options FROM(SELECT key,jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label) items FROM opts GROUP BY key)t;
 RETURN result||jsonb_build_object('suppliers',coalesce(options->'suppliers','[]'),'products',coalesce(options->'products','[]'),
 'types',coalesce(options->'types','[]'),'cities',coalesce((SELECT jsonb_agg(x->>'code' ORDER BY x->>'code') FROM jsonb_array_elements(coalesce(options->'cities','[]')) x),'[]'),
 'pastas',coalesce(options->'pastas','[]'));
END $$;
REVOKE ALL ON FUNCTION dashboard_private.comparison_filters_result_v2(jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION dashboard_private.comparison_filters_result_v2(jsonb,jsonb) TO authenticated;
