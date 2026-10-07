-- Apply after SQL_GERAL.sql or shared_dashboard_summaries_v1.sql.
-- RLS continues to authorize itinerary writes. Only the private dirty flag is updated.
-- Verified with an approved non-admin co-coordinator using INSERT ON CONFLICT UPDATE,
-- in a rolled-back transaction. Admin refresh remains restricted.
CREATE OR REPLACE FUNCTION dashboard_private.queue_summaries_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_SCHEMA<>'public' OR TG_TABLE_NAME NOT IN('data_detailed','data_history','data_clients','data_client_promoters','data_hierarchy','dim_produtos','dim_vendedores','dim_supervisores','data_product_details','data_titulos','dim_fornecedores','data_stock') THEN
  RAISE EXCEPTION 'Origem de atualização inválida';
 END IF;
 IF NOT (
  (auth.uid() IS NOT NULL AND (
   public.is_admin() OR
   (TG_TABLE_NAME='data_client_promoters' AND TG_OP IN ('INSERT','UPDATE','DELETE') AND public.is_approved())
  )) OR
  (auth.uid() IS NULL AND (session_user IN('postgres','supabase_admin') OR current_setting('role',true)='service_role'))
 ) THEN
  RAISE EXCEPTION 'Atualização reservada ao administrador' USING ERRCODE='42501';
 END IF;
 UPDATE dashboard_private.summary_state SET dirty=true,last_change=clock_timestamp() WHERE id=true;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION dashboard_private.queue_summaries_v1() FROM PUBLIC,anon,authenticated;