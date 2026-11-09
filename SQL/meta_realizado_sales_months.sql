BEGIN;
CREATE OR REPLACE FUNCTION public.get_meta_realizado_sales_months_v1()
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO ''
SET statement_timeout TO '10s'
AS $fn$
BEGIN
 IF auth.uid() IS NULL OR NOT (public.is_admin() OR public.is_approved()) THEN
  RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE='42501';
 END IF;
 RETURN ARRAY(SELECT DISTINCT to_char(dtped AT TIME ZONE 'UTC','YYYY-MM') period
 FROM (SELECT dtped FROM public.data_detailed UNION ALL SELECT dtped FROM public.data_history)s
 WHERE dtped IS NOT NULL ORDER BY period DESC);
END;
$fn$;
REVOKE ALL ON FUNCTION public.get_meta_realizado_sales_months_v1() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_meta_realizado_sales_months_v1() TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
