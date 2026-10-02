-- Etapa 1: KPIs do Comparativo. Filtros de carteira ainda vêm do fluxo legado.
-- A lista de clientes é uma seleção, NÃO uma autorização; RLS continua aplicada.
-- Não executar o consolidado inteiro para instalar esta função.
CREATE OR REPLACE FUNCTION public.get_comparison_kpis_v1(p_filters jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = '' SET statement_timeout = '15s'
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

  WITH raw AS MATERIALIZED (
    SELECT 'current'::text source, codcli, produto, codfor, filial, tipovenda, dtped,
           vlvenda, vlbonific, totpesoliq, observacaofor FROM public.data_detailed
    WHERE codcli=ANY(client_codes) AND (is_admin OR (allowed_clients IS NOT NULL AND codcli=ANY(allowed_clients))
      OR (allowed_clients IS NULL AND lower(btrim(codusur))=caller_role))
    UNION ALL
    SELECT 'history', codcli, produto, codfor, filial, tipovenda, dtped,
           vlvenda, vlbonific, totpesoliq, observacaofor FROM public.data_history
    WHERE codcli=ANY(client_codes) AND (is_admin OR (allowed_clients IS NOT NULL AND codcli=ANY(allowed_clients))
      OR (allowed_clients IS NULL AND lower(btrim(codusur))=caller_role))
  ), enriched AS MATERIALIZED (
    SELECT r.*, c.ramo, coalesce(c.cidade,'N/A') city,
      coalesce(nullif(dp.descricao,''),'Produto '||btrim(r.produto)) description,
      CASE WHEN coalesce(r.observacaofor,'') NOT IN ('','0','00','N/A') THEN r.observacaofor
           WHEN coalesce(df.pasta,'')<>'' THEN df.pasta
           WHEN upper(coalesce(df.nome,r.codfor)) LIKE '%PEPSICO%' THEN 'PEPSICO'
           ELSE 'MULTIMARCAS' END pasta,
      CASE WHEN alt_mode THEN coalesce(r.vlbonific,0) ELSE coalesce(r.vlvenda,0) END amount,
      to_char(r.dtped AT TIME ZONE 'UTC','YYYY-MM') month_key
    FROM raw r
    LEFT JOIN public.data_clients c ON c.codigo_cliente=r.codcli
    LEFT JOIN public.dim_produtos dp ON dp.codigo=r.produto
    LEFT JOIN public.dim_fornecedores df ON df.codigo=r.codfor
    WHERE r.codcli=ANY(client_codes)
  ), filtered AS MATERIALIZED (
    SELECT * FROM enriched e
    WHERE (coalesce(p_filters->>'filial','ambas')='ambas' OR e.filial=p_filters->>'filial')
      AND (coalesce(p_filters->>'city','')='' OR lower(e.city)=p_filters->>'city')
      AND (coalesce(p_filters->>'pasta','')='' OR e.pasta=p_filters->>'pasta')
      AND (cardinality(products)=0 OR e.produto=ANY(products))
      AND (cardinality(suppliers)=0 OR e.codfor=ANY(suppliers) OR
        (e.codfor='1119' AND (CASE
          WHEN upper(e.description) LIKE '%TODDYNHO%' THEN '1119_TODDYNHO'
          WHEN upper(e.description) LIKE '%TODDY%' THEN '1119_TODDY'
          WHEN upper(e.description) LIKE '%QUAKER%' OR upper(e.description) LIKE '%KEROCOCO%' THEN '1119_QUAKER_KEROCOCO'
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
      min(codfor) codfor,min(description) description,sum(amount) amount
    FROM sales WHERE codcli IS NOT NULL AND codcli<>'' AND (source='current' OR month_key IS NOT NULL)
    GROUP BY 1,2,3,4
  ), mixes AS (
    SELECT source,m,codcli,
      count(*) FILTER(WHERE amount>=1 AND codfor IN ('707','708','752')) mix,
      bool_or(amount>=1 AND upper(description) LIKE '%CHEETOS%') AND
      bool_or(amount>=1 AND upper(description) LIKE '%DORITOS%') AND
      bool_or(amount>=1 AND upper(description) LIKE '%FANDANGOS%') AND
      bool_or(amount>=1 AND upper(description) LIKE '%RUFFLES%') AND
      bool_or(amount>=1 AND upper(description) LIKE '%TORCIDA%') salty,
      bool_or(amount>=1 AND upper(description) LIKE '%TODDYNHO%') AND
      bool_or(amount>=1 AND upper(description) LIKE '%TODDY %') AND
      bool_or(amount>=1 AND upper(description) LIKE '%QUAKER%') AND
      bool_or(amount>=1 AND upper(description) LIKE '%KEROCOCO%') foods
    FROM product_totals GROUP BY 1,2,3
  ), month_mix AS (
    SELECT source,m,coalesce(avg(mix) FILTER(WHERE mix>0),0) mix,
      count(*) FILTER(WHERE salty) salty,count(*) FILTER(WHERE foods) foods FROM mixes GROUP BY 1,2
  ), latest AS (
    SELECT DISTINCT month_key FROM sales WHERE source='history' AND month_key IS NOT NULL ORDER BY month_key DESC LIMIT 3
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
