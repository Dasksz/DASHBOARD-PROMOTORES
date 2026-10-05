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

