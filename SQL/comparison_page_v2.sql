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
