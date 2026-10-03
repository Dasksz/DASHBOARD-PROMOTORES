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

