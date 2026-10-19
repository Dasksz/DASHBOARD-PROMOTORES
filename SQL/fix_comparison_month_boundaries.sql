CREATE OR REPLACE FUNCTION dashboard_private.comparison_charts_v2(daily jsonb, monthly jsonb, groups jsonb, ref date, holidays jsonb, tendency boolean, ratio numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
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
   IF dt BETWEEN first_day AND last_day THEN wc[idx]:=wc[idx]+value; table_days[(idx-1)*7+dow+1]:=table_days[(idx-1)*7+dow+1]+value; END IF;
   IF dt BETWEEN first_day AND last_day THEN day_sales:=jsonb_set(day_sales,ARRAY[dt::text],to_jsonb(coalesce((day_sales->>dt::text)::numeric,0)+value)); END IF;
  ELSE
   m:=date_trunc('month',dt)::date; idx:=((dt-(m-extract(dow FROM m)::int))/7)+1;
   IF idx<=week_count THEN wh[idx]:=wh[idx]+value/3.0; END IF;
   weights[dow+1]:=weights[dow+1]+value;

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
   SELECT count(*),count(*) FILTER(WHERE d::date<=ref) INTO total,passed FROM generate_series(greatest(first_day,first_sunday+(i-1)*7),least(last_day,first_sunday+(i-1)*7+6),'1 day') d
    WHERE extract(isodow FROM d) BETWEEN 1 AND 5 AND NOT coalesce(holidays ? to_char(d,'YYYY-MM-DD'),false);
   wc[i]:=CASE WHEN passed>0 AND total>0 THEN wc[i]/passed*total ELSE wh[i] END;
   IF passed>0 AND total>0 THEN
    SELECT sum(table_days[(i-1)*7+j]) INTO value FROM generate_series(1,7) j;
    remainder:=value/passed*total-value;
    SELECT coalesce(sum(weights[extract(dow FROM d)::int+1]),0),count(*) INTO weight_total,k FROM generate_series(greatest(first_day,first_sunday+(i-1)*7),least(last_day,first_sunday+(i-1)*7+6),'1 day') d
     WHERE d::date>ref AND extract(isodow FROM d) BETWEEN 1 AND 5 AND NOT coalesce(holidays ? to_char(d,'YYYY-MM-DD'),false);
    IF remainder>0 AND k>0 THEN
     FOR dt IN SELECT d::date FROM generate_series(greatest(first_day,first_sunday+(i-1)*7),least(last_day,first_sunday+(i-1)*7+6),'1 day') d WHERE d::date>ref AND extract(isodow FROM d) BETWEEN 1 AND 5 AND NOT coalesce(holidays ? to_char(d,'YYYY-MM-DD'),false) LOOP
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
END $function$

