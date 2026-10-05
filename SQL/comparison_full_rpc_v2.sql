-- Comparativo RPC completo e correção de Cobertura/Americanas — 02/10/2026
-- Instalar após shared_dashboard_summaries_v1.sql.

-- Comparativo completo: autorização, seleção, indicadores, gráficos e tabelas no banco.
-- Instalar após shared_dashboard_summaries_v1.sql. Nenhuma alteração nas fontes.
CREATE OR REPLACE FUNCTION dashboard_private.comparison_rows_v2(s jsonb,f jsonb)
RETURNS TABLE(source text,codcli text,produto text,codfor text,tipovenda text,day date,
 amount numeric,vlvenda numeric,vlbonific numeric,totpesoliq numeric,ramo text,group_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH clients AS MATERIALIZED(SELECT * FROM dashboard_private.clients_v1(s)),
 assignments AS MATERIALIZED(SELECT * FROM dashboard_private.assignments_v1(s)),
 selected AS MATERIALIZED(SELECT c.* FROM clients c LEFT JOIN assignments a ON a.client=c.code WHERE
 (coalesce(f->>'mode','promoter')<>'seller' OR s->>'kind'<>'admin' OR nullif(c.rca,'') IS NOT NULL)
 AND (coalesce(f->>'mode','promoter')='seller' OR (
 (coalesce(jsonb_array_length(f->'coords'),0)=0 OR coalesce(f->'coords' ? c.coord,false))
 AND (coalesce(jsonb_array_length(f->'cocoords'),0)=0 OR coalesce(f->'cocoords' ? c.cocoord,false))
 AND (coalesce(jsonb_array_length(f->'promotors'),0)=0 OR coalesce(f->'promotors' ? c.promotor,false))))
 AND (coalesce(f->>'mode','promoter')<>'seller' OR (
 (coalesce(jsonb_array_length(f->'supervisors'),0)=0 OR coalesce(f->'supervisors' ? a.supervisor_name,false))
 AND (coalesce(jsonb_array_length(f->'sellers'),0)=0 OR coalesce(f->'sellers' ? c.rca,false))))
 AND dashboard_private.rede_v1(f,c.rede)
 AND (coalesce(f->>'city','')='' OR lower(c.city)=lower(f->>'city')))
 SELECT d.source,d.codcli,d.produto,d.codfor,d.tipovenda,d.day,
 CASE WHEN coalesce(jsonb_array_length(f->'types'),0)>0 AND NOT(coalesce(f->'types' ? '1',false) OR coalesce(f->'types' ? '9',false)) THEN d.vlbonific ELSE d.vlvenda END,
 d.vlvenda,d.vlbonific,d.totpesoliq,c.rede,
 CASE WHEN f->>'facet_pasta'='true' THEN (CASE WHEN coalesce(d.observacaofor,'') NOT IN('','0','00','N/A') THEN d.observacaofor WHEN coalesce(df.pasta,'')<>'' THEN df.pasta WHEN upper(coalesce(df.nome,d.codfor)) LIKE '%PEPSICO%' THEN 'PEPSICO' ELSE 'MULTIMARCAS' END)
 WHEN coalesce(f->>'mode','promoter')='seller' THEN coalesce(ds.nome,d.codsupervisor,'N/A')
 WHEN c.promotor IS NULL THEN 'Sem Hierarquia'
 WHEN coalesce(jsonb_array_length(f->'coords'),0)>0 THEN coalesce(c.promotor_name,c.promotor)
 ELSE coalesce(c.coord_name,c.coord,'Sem Hierarquia') END
 FROM dashboard_private.sales_day d JOIN selected c ON c.code=d.codcli
 LEFT JOIN public.dim_fornecedores df ON df.codigo=d.codfor
 LEFT JOIN public.dim_supervisores ds ON ds.codigo=d.codsupervisor
 WHERE (s->>'kind' IN('admin','trade') OR
 (s->>'kind'='seller' AND lower(btrim(d.codusur))=(SELECT lower(btrim(role)) FROM public.profiles WHERE id=auth.uid())) OR
 (s->>'kind'='supervisor' AND lower(btrim(d.codsupervisor))=(SELECT lower(btrim(role)) FROM public.profiles WHERE id=auth.uid())))
 AND (coalesce(f->>'filial','ambas') IN('all','ambas') OR d.filial=f->>'filial')
 AND (coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false) OR coalesce(f->'suppliers' ? d.virtual_supplier,false))
 AND (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false))
 AND (coalesce(f->>'pasta','')='' OR (CASE WHEN coalesce(d.observacaofor,'') NOT IN('','0','00','N/A') THEN d.observacaofor WHEN coalesce(df.pasta,'')<>'' THEN df.pasta WHEN upper(coalesce(df.nome,d.codfor)) LIKE '%PEPSICO%' THEN 'PEPSICO' ELSE 'MULTIMARCAS' END)=f->>'pasta');
$$;

-- Only compact daily/monthly/group aggregates enter this calendar calculation.
CREATE OR REPLACE FUNCTION dashboard_private.comparison_charts_v2(daily jsonb,monthly jsonb,groups jsonb,ref date,holidays jsonb,tendency boolean,ratio numeric)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE first_day date:=date_trunc('month',ref)::date; last_day date:=(date_trunc('month',ref)+interval '1 month - 1 day')::date;
 first_sunday date:=first_day-extract(dow FROM first_day)::int; week_count int; current_week int;
 wc numeric[]; wh numeric[]; table_days numeric[]; weights numeric[]:=array_fill(0::numeric,ARRAY[7]);
 sums numeric[]:=array_fill(0::numeric,ARRAY[31]); counts int[]:=array_fill(0,ARRAY[31]); prev numeric[]:=array_fill(0::numeric,ARRAY[31]); prev_max int:=0;
 day_sales jsonb:='{}'; rec jsonb; dt date; m date; finish date; wd int; idx int; dow int; i int; k int;
 total_wd int:=0; passed int; total int; value numeric; raw_value numeric; remainder numeric; weight_total numeric; avg_value numeric;
 labels jsonb:='[]'; current_data jsonb:='[]'; history_data jsonb:='[]'; weeks jsonb:='[]'; weekly_rows jsonb:='[]'; grand numeric:=0;
BEGIN
 week_count:=((last_day-first_sunday)/7)+1; current_week:=((ref-first_sunday)/7)+1;
 wc:=array_fill(0::numeric,ARRAY[week_count]); wh:=wc; table_days:=array_fill(0::numeric,ARRAY[week_count*7]);
 FOR rec IN SELECT x FROM jsonb_array_elements(daily) x LOOP
  dt:=(rec->>'day')::date; value:=(rec->>'amount')::numeric; raw_value:=(rec->>'raw_value')::numeric; dow:=extract(dow FROM dt)::int;
  IF rec->>'source'='current' THEN
   idx:=((dt-first_sunday)/7)+1;
   IF dt>=first_sunday AND dt<=first_sunday+week_count*7-1 THEN wc[idx]:=wc[idx]+value; table_days[(idx-1)*7+dow+1]:=table_days[(idx-1)*7+dow+1]+raw_value; END IF;
   IF dt BETWEEN first_day AND last_day THEN day_sales:=jsonb_set(day_sales,ARRAY[dt::text],to_jsonb(coalesce((day_sales->>dt::text)::numeric,0)+value)); END IF;
  ELSE
   m:=date_trunc('month',dt)::date; idx:=((dt-(m-extract(dow FROM m)::int))/7)+1;
   IF idx<=week_count THEN wh[idx]:=wh[idx]+value/3.0; END IF;
   weights[dow+1]:=weights[dow+1]+value;
   IF dt>=first_sunday AND dt<first_day THEN wc[1]:=wc[1]+value; table_days[dow+1]:=table_days[dow+1]+raw_value; END IF;
  END IF;
 END LOOP;
 SELECT sum(weights[j]) INTO value FROM generate_series(1,7) j;
 IF value>0 THEN FOR k IN 1..7 LOOP weights[k]:=weights[k]/value; END LOOP;
 ELSE weights:=array_fill(0::numeric,ARRAY[7]); END IF;
 FOR m IN SELECT DISTINCT date_trunc('month',(x->>'day')::date)::date FROM jsonb_array_elements(daily) x WHERE x->>'source'='history' AND (x->>'has_sales')::boolean LOOP
  finish:=(m+interval '1 month - 1 day')::date; wd:=0; dt:=m;
  WHILE dt<=finish LOOP
   IF extract(isodow FROM dt) BETWEEN 1 AND 5 AND NOT coalesce(holidays ? dt::text,false) THEN
    wd:=wd+1;
    SELECT coalesce(sum((x->>'amount')::numeric),0) INTO value FROM jsonb_array_elements(daily) x WHERE x->>'source'='history' AND x->>'day'=dt::text;
    sums[wd]:=sums[wd]+value; counts[wd]:=counts[wd]+1;
    IF m=(first_day-interval '1 month')::date THEN prev[wd]:=value; prev_max:=wd; END IF;
   END IF;
   dt:=dt+1;
  END LOOP;
 END LOOP;
 SELECT count(*) INTO total_wd FROM generate_series(first_day,last_day,'1 day') d WHERE extract(isodow FROM d) BETWEEN 1 AND 5 AND NOT coalesce(holidays ? to_char(d,'YYYY-MM-DD'),false);
 wd:=0; dt:=first_day;
 WHILE dt<=last_day LOOP
  value:=coalesce((day_sales->>dt::text)::numeric,0);
  IF extract(isodow FROM dt) BETWEEN 1 AND 5 AND NOT coalesce(holidays ? dt::text,false) THEN
   wd:=wd+1;
   avg_value:=CASE WHEN counts[wd]>0 THEN sums[wd]/counts[wd] WHEN prev_max>0 AND total_wd>prev_max AND wd-(total_wd-prev_max)>0 THEN prev[wd-(total_wd-prev_max)] ELSE 0 END;
   labels:=labels||to_jsonb(dt-first_day+1); current_data:=current_data||to_jsonb(value); history_data:=history_data||to_jsonb(avg_value);
  ELSIF value>0 THEN labels:=labels||to_jsonb(dt-first_day+1); current_data:=current_data||to_jsonb(value); history_data:=history_data||'null'::jsonb;
  END IF;
  dt:=dt+1;
 END LOOP;
 FOR i IN 1..week_count LOOP
  IF tendency AND i=current_week THEN
   SELECT count(*),count(*) FILTER(WHERE d::date<=ref) INTO total,passed FROM generate_series(first_sunday+(i-1)*7,first_sunday+(i-1)*7+6,'1 day') d
    WHERE extract(isodow FROM d) BETWEEN 1 AND 5 AND NOT coalesce(holidays ? to_char(d,'YYYY-MM-DD'),false);
   wc[i]:=CASE WHEN passed>0 AND total>0 THEN wc[i]/passed*total ELSE wh[i] END;
   IF passed>0 AND total>0 THEN
    SELECT sum(table_days[(i-1)*7+j]) INTO value FROM generate_series(1,7) j;
    remainder:=value/passed*total-value;
    SELECT coalesce(sum(weights[extract(dow FROM d)::int+1]),0),count(*) INTO weight_total,k FROM generate_series(first_sunday+(i-1)*7,first_sunday+(i-1)*7+6,'1 day') d
     WHERE d::date>ref AND extract(isodow FROM d) BETWEEN 1 AND 5 AND NOT coalesce(holidays ? to_char(d,'YYYY-MM-DD'),false);
    IF remainder>0 AND k>0 THEN
     FOR dt IN SELECT d::date FROM generate_series(first_sunday+(i-1)*7,first_sunday+(i-1)*7+6,'1 day') d WHERE d::date>ref AND extract(isodow FROM d) BETWEEN 1 AND 5 AND NOT coalesce(holidays ? to_char(d,'YYYY-MM-DD'),false) LOOP
      dow:=extract(dow FROM dt)::int; table_days[(i-1)*7+dow+1]:=remainder*CASE WHEN weight_total>0 THEN weights[dow+1]/weight_total ELSE 1.0/k END;
     END LOOP;
    END IF;
   END IF;
  ELSIF tendency AND i>current_week THEN
   wc[i]:=wh[i];
   IF wh[i]>0 THEN
    SELECT sum(weights[j]) INTO weight_total FROM generate_series(2,6) j;
    FOR k IN 2..6 LOOP table_days[(i-1)*7+k]:=wh[i]*CASE WHEN weight_total>0 THEN weights[k]/weight_total ELSE 0.2 END; END LOOP;
   END IF;
  END IF;
  weeks:=weeks||jsonb_build_object('label','Semana '||i,'current',wc[i],'history',wh[i]);
  SELECT coalesce(sum(table_days[(i-1)*7+j]),0) INTO value FROM generate_series(1,7) j; grand:=grand+value;
  weekly_rows:=weekly_rows||jsonb_build_object('label','Semana '||i,'total',value);
 END LOOP;
 RETURN jsonb_build_object('daily',jsonb_build_object('labels',labels,'current',current_data,'history',history_data),'weekly',weeks,'monthly',monthly,
 'weekly_rows',weekly_rows,'weekly_total',grand,'groups',groups);
END $$;

CREATE OR REPLACE FUNCTION dashboard_private.comparison_result_v2(s jsonb,p_filters jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s'
SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' SET enable_nestloop='off' AS $fn$
DECLARE f jsonb:=p_filters; ref_date date; types text[]; alt_mode boolean;
 holidays jsonb:=coalesce(f->'holidays','[]'); total_days int; passed_days int; ratio numeric:=1; result jsonb;
BEGIN
 IF jsonb_typeof(f) IS DISTINCT FROM 'object' OR jsonb_typeof(holidays) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 SELECT coalesce(max(day) FILTER(WHERE source='current'),max(day),current_date) INTO ref_date FROM dashboard_private.sales_calendar;
 SELECT coalesce(array_agg(value),ARRAY[]::text[]) INTO types FROM jsonb_array_elements_text(coalesce(f->'types','[]'));
 alt_mode:=cardinality(types)>0 AND NOT('1'=ANY(types) OR '9'=ANY(types));
 SELECT count(*),greatest(count(*) FILTER(WHERE d::date<=ref_date),1) INTO total_days,passed_days
 FROM generate_series(date_trunc('month',ref_date)::date,(date_trunc('month',ref_date)+interval '1 month - 1 day')::date,'1 day') d
 WHERE extract(isodow FROM d) BETWEEN 1 AND 5 AND NOT coalesce(holidays ? to_char(d,'YYYY-MM-DD'),false);
 IF coalesce((f->>'tendency')::boolean,false) AND total_days>0 AND passed_days<total_days THEN ratio:=total_days::numeric/passed_days; END IF;
 WITH product_info AS MATERIALIZED (
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
  ), filtered AS MATERIALIZED(
 SELECT r.*,to_char(r.day,'YYYY-MM') month_key FROM dashboard_private.comparison_rows_v2(s,f) r
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
  ),
 daily AS(SELECT source,day,coalesce(sum(amount) FILTER(WHERE (cardinality(types)=0 OR tipovenda=ANY(types)) AND (alt_mode OR tipovenda IN('1','9'))),0) amount,
 coalesce(sum(vlvenda) FILTER(WHERE (cardinality(types)=0 OR tipovenda=ANY(types)) AND (source='current' OR alt_mode OR tipovenda IN('1','9'))),0) raw_value,
 bool_or((cardinality(types)=0 OR tipovenda=ANY(types)) AND (alt_mode OR tipovenda IN('1','9'))) has_sales
 FROM filtered WHERE day IS NOT NULL GROUP BY source,day),
 month_totals AS(SELECT month_key,sum(amount) fat FROM sales WHERE source='history' AND month_key IN(SELECT month_key FROM latest) GROUP BY month_key),
 monthly AS(SELECT month_key||'-01' month_date,fat,coalesce((SELECT clients FROM client_counts WHERE source='history' AND m=month_key),0) clients,false is_current FROM month_totals
 UNION ALL SELECT to_char(ref_date,'YYYY-MM')||'-01',fat,clients,true FROM final WHERE source='current'),
 group_totals AS(SELECT group_name name,coalesce(sum(amount) FILTER(WHERE source='current'),0)*ratio current,
 coalesce(sum(amount) FILTER(WHERE source='history' AND day IS NOT NULL),0)/3.0 history
 FROM sales GROUP BY group_name),
 groups AS(SELECT *,CASE WHEN history>0 THEN (current-history)/history*100 WHEN current>0 THEN 100 ELSE 0 END variation FROM group_totals)
 SELECT jsonb_build_object('schema_version',2,'reference_date',ref_date,'tendency_ratio',ratio,
 'summary_generation',(SELECT generation FROM dashboard_private.summary_state WHERE id),
 'kpis',(SELECT jsonb_object_agg(source,jsonb_build_object('fat',fat,'peso',peso,'clients',clients,'mixPepsico',mix,
 'positivacaoSalty',salty,'positivacaoFoods',foods,'perdas',perdas,'ticket',CASE WHEN clients>0 THEN fat/clients ELSE 0 END)) FROM final),
 'charts',dashboard_private.comparison_charts_v2(
 coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY source,day) FROM daily t),'[]'),
 coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY is_current,month_date) FROM monthly t),'[]'),
 coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY name) FROM groups t),'[]'),ref_date,holidays,coalesce((f->>'tendency')::boolean,false),ratio)) INTO result;
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION dashboard_private.comparison_rows_v2(jsonb,jsonb),dashboard_private.comparison_charts_v2(jsonb,jsonb,jsonb,date,jsonb,boolean,numeric),dashboard_private.comparison_result_v2(jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION dashboard_private.comparison_rows_v2(jsonb,jsonb),dashboard_private.comparison_charts_v2(jsonb,jsonb,jsonb,date,jsonb,boolean,numeric),dashboard_private.comparison_result_v2(jsonb,jsonb) TO authenticated;

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

-- Cache only administrator-wide selections. Every request still derives its session wallet.
CREATE OR REPLACE FUNCTION public.get_comparison_page_v2(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET plan_cache_mode='force_custom_plan' SET jit='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); result jsonb; key jsonb;
BEGIN
 IF jsonb_typeof(p_filters) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 key:=dashboard_private.normalize_page_filters_v1(p_filters-ARRAY['holidays','tendency']);
 IF s->>'kind'='admin' AND NOT coalesce((p_filters->>'tendency')::boolean,false) AND coalesce(jsonb_array_length(p_filters->'holidays'),0)=0
 AND key IN('{}'::jsonb,'{"pasta":"PEPSICO"}'::jsonb) THEN
  SELECT payload INTO result FROM dashboard_private.page_rollups WHERE page='comparison' AND cache_key=key;
  IF FOUND THEN RETURN result; END IF;
 END IF;
 RETURN dashboard_private.comparison_result_v2(s,p_filters);
END $$;
CREATE OR REPLACE FUNCTION public.get_comparison_filters_v2(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET plan_cache_mode='force_custom_plan' SET jit='off' AS $$
DECLARE s jsonb:=dashboard_private.scope_v1(); result jsonb; key jsonb;
BEGIN
 IF jsonb_typeof(p_filters) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023'; END IF;
 key:=dashboard_private.normalize_page_filters_v1(p_filters-ARRAY['holidays','tendency']);
 IF s->>'kind'='admin' AND key IN('{}'::jsonb,'{"pasta":"PEPSICO"}'::jsonb) THEN
  SELECT payload INTO result FROM dashboard_private.page_rollups WHERE page='comparison_filters' AND cache_key=key;
  IF FOUND THEN RETURN result; END IF;
 END IF;
 RETURN dashboard_private.comparison_filters_result_v2(s,p_filters);
END $$;
REVOKE ALL ON FUNCTION public.get_comparison_page_v2(jsonb),public.get_comparison_filters_v2(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_comparison_page_v2(jsonb),public.get_comparison_filters_v2(jsonb) TO authenticated;

-- Import completion polls this short call while the scheduled worker rebuilds the summaries.
-- A long rebuild cannot fit the Data API's 8-second statement timeout.
CREATE OR REPLACE FUNCTION public.get_dashboard_summary_status_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Consulta reservada ao administrador' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('status',CASE WHEN dirty THEN 'pending' ELSE 'current' END,'generation',generation,'refreshed_at',refreshed_at)
 INTO result FROM dashboard_private.summary_state WHERE id;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_dashboard_summary_status_v1() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary_status_v1() TO authenticated;

CREATE OR REPLACE FUNCTION dashboard_private.coverage_result_v1(s jsonb,p_filters jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' SET enable_nestloop='off' AS $$
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
 trend_daily AS MATERIALIZED(SELECT d.produto product,d.day,sum(d.boxes) boxes
 FROM dashboard_private.sales_day d JOIN base_clients c ON c.code=d.codcli
 WHERE true  AND (coalesce(f->>'filial','ambas') IN('ambas','all') OR d.filial=f->>'filial')
 AND ((coalesce(jsonb_array_length(f->'suppliers'),0)=0 OR coalesce(f->'suppliers' ? d.codfor,false)) OR coalesce(f->'suppliers' ? d.virtual_supplier,false))
 AND (coalesce(jsonb_array_length(f->'products'),0)=0 OR coalesce(f->'products' ? d.produto,false))
 AND (coalesce(jsonb_array_length(f->'types'),0)=0 OR coalesce(f->'types' ? d.tipovenda,false)) AND ((f->>'price_min' IS NULL AND f->>'price_max' IS NULL) OR (d.unit_price IS NOT NULL
 AND (f->>'price_min' IS NULL OR d.unit_price>=(f->>'price_min')::numeric)
 AND (f->>'price_max' IS NULL OR d.unit_price<=(f->>'price_max')::numeric)))

 GROUP BY d.produto,d.day),
 trend_totals AS MATERIALIZED(SELECT dv.product,coalesce(sum(d.boxes*CASE WHEN custom_date THEN
 (CASE WHEN d.day BETWEEN start_date AND end_date THEN 1 ELSE 0 END+CASE WHEN d.day BETWEEN prev_start AND prev_end THEN 1 ELSE 0 END) ELSE 1 END),0)/dv.divisor daily_avg
 FROM divisors dv CROSS JOIN working_array w LEFT JOIN trend_daily d
 ON d.product=dv.product AND d.day BETWEEN w.dates[greatest(1,cardinality(w.dates)-dv.divisor::int+1)] AND w.dates[cardinality(w.dates)]
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


CREATE OR REPLACE FUNCTION dashboard_private.facet_result_v1(p_page text,s jsonb,p_filters jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='15s' SET plan_cache_mode='force_custom_plan' SET jit='off' SET work_mem='32MB' SET enable_mergejoin='off' SET enable_nestloop='off' AS $$
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

SELECT dashboard_private.refresh_summaries_v1(true);
