-- Reproduces the Data API's prepared call shape and 8-second budget for Americanas.
BEGIN;
DO $$ BEGIN PERFORM set_config('request.jwt.claim.sub',(SELECT id::text FROM public.profiles WHERE role='1001' AND status='aprovado' LIMIT 1),true); END $$;
SET LOCAL ROLE authenticated;
SET LOCAL statement_timeout='8s';
SET LOCAL plan_cache_mode='force_generic_plan';
PREPARE coverage_americanas_data(jsonb,int,int) AS
WITH pgrst_source AS(SELECT pgrst_call.pgrst_scalar FROM(SELECT $1 AS json_data) pgrst_payload,
LATERAL(SELECT p_filters FROM jsonb_to_record(pgrst_payload.json_data) AS _(p_filters jsonb) LIMIT 1) pgrst_body,
LATERAL(SELECT public.get_coverage_page_v1(pgrst_body.p_filters) pgrst_scalar) pgrst_call)
SELECT md5(coalesce(json_agg(t.pgrst_scalar)->0,'null')::text) result_hash FROM(SELECT * FROM pgrst_source LIMIT $2 OFFSET $3)t;
PREPARE coverage_americanas_filters(jsonb,int,int) AS
WITH pgrst_source AS(SELECT pgrst_call.pgrst_scalar FROM(SELECT $1 AS json_data) pgrst_payload,
LATERAL(SELECT p_filters FROM jsonb_to_record(pgrst_payload.json_data) AS _(p_filters jsonb) LIMIT 1) pgrst_body,
LATERAL(SELECT public.get_dashboard_filters_v1('coverage',pgrst_body.p_filters) pgrst_scalar) pgrst_call)
SELECT md5(coalesce(json_agg(t.pgrst_scalar)->0,'null')::text) result_hash FROM(SELECT * FROM pgrst_source LIMIT $2 OFFSET $3)t;
EXECUTE coverage_americanas_data('{"p_filters":{"mode":"seller","sellers":["1001"]}}',1,0);
EXECUTE coverage_americanas_filters('{"p_filters":{"mode":"seller","sellers":["1001"]}}',1,0);
EXECUTE coverage_americanas_data('{"p_filters":{"mode":"seller","sellers":["1001"],"suppliers":["707"]}}',1,0);
EXECUTE coverage_americanas_filters('{"p_filters":{"mode":"seller","sellers":["1001"],"suppliers":["707"]}}',1,0);
DEALLOCATE coverage_americanas_data;
DEALLOCATE coverage_americanas_filters;
SELECT 'Americanas: consultas preparadas da API, dados e filtros, orçamento de 8s: OK' result;
ROLLBACK;
