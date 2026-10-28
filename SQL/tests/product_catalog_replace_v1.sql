-- Run inside a transaction and roll back; no historical sales are changed.
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='adm' and status='aprovado' limit 1),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $$ declare rows jsonb:='[{"code":"__catalog_1__","descricao":"Produto teste A","qtde_master":12},{"code":"__catalog_4__","descricao":"Produto teste sem vendas","qtde_master":6}]'; import_id uuid:=gen_random_uuid(); sales_count integer; begin
 select count(*) into sales_count from public.data_detailed;
 perform public.replace_product_catalog_v1(rows,import_id,'{}');
 if (select count(*) from public.data_product_details)<>2 or (select count(*) from public.dim_produtos)<>2 or (select count(*) from public.data_active_products)<>2 then raise exception 'TEST FAILED: catalog not completely replaced'; end if;
 if not exists(select 1 from public.data_product_details where code='__catalog_4__') then raise exception 'TEST FAILED: unsold product omitted'; end if;
 if sales_count<>(select count(*) from public.data_detailed) then raise exception 'TEST FAILED: historical sales altered'; end if;
 if public.replace_product_catalog_v1(rows,import_id,'{}')->>'replayed'<>'true' then raise exception 'TEST FAILED: retry not idempotent'; end if;
 begin perform public.replace_product_catalog_v1('[]',gen_random_uuid()); raise exception 'TEST FAILED: empty accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.replace_product_catalog_v1('[{"code":"1","descricao":"A"},{"code":"1","descricao":"B"}]',gen_random_uuid()); raise exception 'TEST FAILED: duplicates accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.replace_product_catalog_v1('[{"code":"1","descricao":"A","dtcadastro":"invalid-date"}]',gen_random_uuid()); raise exception 'TEST FAILED: bad date accepted'; exception when invalid_datetime_format then null; end;
 if (select count(*) from public.data_product_details)<>2 then raise exception 'TEST FAILED: failed import damaged catalog'; end if;
end $$;
reset role;
