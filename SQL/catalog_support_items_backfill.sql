-- Execute after catalog_support_items_v1.sql, in one transaction.
select pg_advisory_xact_lock(70261028,203);
insert into public.data_catalog_support_items(code,descricao,classification_reason,source_data,dimension_snapshot,stock_snapshot)
select p.code,p.descricao,dashboard_private.catalog_support_reason(p.code,p.descricao),to_jsonb(p),
 (select to_jsonb(d) from public.dim_produtos d where d.codigo=p.code),
 (select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.data_stock s where s.product_code=p.code)
from public.data_product_details p where dashboard_private.catalog_support_reason(p.code,p.descricao) is not null
on conflict(code) do update set descricao=excluded.descricao,classification_reason=excluded.classification_reason,
 source_data=excluded.source_data,dimension_snapshot=excluded.dimension_snapshot,stock_snapshot=excluded.stock_snapshot,last_seen_at=now();
delete from public.data_active_products where code in (select code from public.data_catalog_support_items);
delete from public.dim_produtos where codigo in (select code from public.data_catalog_support_items);
delete from public.data_product_details where code in (select code from public.data_catalog_support_items);
insert into public.data_metadata(key,value) values('non_merchandise_codes',(
 select coalesce(jsonb_agg(code order by code),'[]')::text from public.data_catalog_support_items
)) on conflict(key) do update set value=excluded.value;
