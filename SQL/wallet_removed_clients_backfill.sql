-- One-time reconciliation of missing catalog clients already present before this feature.
-- Execute as the database maintenance role, after wallet_removed_clients_v1.sql.
-- Normal subsequent replacements reconcile through replace_client_catalog_v1.
select pg_advisory_xact_lock(70261027,302);
lock table public.data_clients in share mode;
with batch as materialized(select gen_random_uuid() import_id), removed as (
 delete from public.data_client_promoters p
 where not exists(select 1 from public.data_clients c where c.codigo_cliente=p.client_code)
 returning p.*
)
insert into public.data_client_promoters_removed(import_id,client_code,promoter_code,itinerary_frequency,itinerary_ref_date,itinerary_days,client_snapshot,hierarchy_snapshot)
select b.import_id,p.client_code,p.promoter_code,p.itinerary_frequency,p.itinerary_ref_date,p.itinerary_days,
 jsonb_build_object('codigo_cliente',p.client_code,'nomecliente',(
   select o.cliente_nome from public.data_orders o where o.codcli=p.client_code and o.cliente_nome is not null order by o.dtped desc nulls last limit 1)),
 coalesce((select to_jsonb(h) from public.data_hierarchy h where lower(btrim(h.cod_promotor))=lower(btrim(p.promoter_code)) limit 1),'{}'::jsonb)
from removed p cross join batch b;
