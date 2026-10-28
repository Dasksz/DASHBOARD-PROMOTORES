-- Run in a transaction and roll back.
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='adm' and status='aprovado' limit 1),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $$ declare result jsonb; batch uuid:=gen_random_uuid(); baseline integer; begin
 select count(*) into baseline from public.data_catalog_support_items;
 result:=public.replace_product_catalog_v1('[{"code":"__food__","descricao":"BISCOITO ILHA DOCE"},{"code":"__rack__","descricao":"EC RACK NOVO MODELO","fornecedor":"Fornecedor teste","qtde_master":2,"extra_note":"preservar"},{"code":"__toy__","descricao":"FAMPAR SKATE RADICAL DISPLAY"}]',batch);
 if (result->>'product_count')::integer<>2 or (result->>'support_count')::integer<>1 then raise exception 'TEST FAILED partition %',result; end if;
 if exists(select 1 from public.data_product_details where code='__rack__') or exists(select 1 from public.dim_produtos where codigo='__rack__') or exists(select 1 from public.data_active_products where code='__rack__') then raise exception 'TEST FAILED support in catalog'; end if;
 if not exists(select 1 from public.data_catalog_support_items where code='__rack__' and source_data->>'extra_note'='preservar' and source_data->>'qtde_master'='2') then raise exception 'TEST FAILED lost source fields'; end if;
 if not (select value::jsonb ? '__rack__' from public.data_metadata where key='non_merchandise_codes') then raise exception 'TEST FAILED missing frontend classification'; end if;
 if public.replace_product_catalog_v1('[{"code":"__food__","descricao":"BISCOITO ILHA DOCE"},{"code":"__rack__","descricao":"EC RACK NOVO MODELO","fornecedor":"Fornecedor teste","qtde_master":2,"extra_note":"preservar"},{"code":"__toy__","descricao":"FAMPAR SKATE RADICAL DISPLAY"}]',batch)->>'replayed'<>'true' then raise exception 'TEST FAILED retry'; end if;
 perform public.replace_product_catalog_v1('[{"code":"__food__","descricao":"Alimento"}]',gen_random_uuid());
 if (select count(*) from public.data_catalog_support_items)<>baseline+1 or not exists(select 1 from public.data_catalog_support_items where code='__rack__' and not present_in_latest_catalog) then raise exception 'TEST FAILED missing support history'; end if;
 perform public.replace_product_catalog_v1('[{"code":"__rack__","descricao":"EC RACK NOVO MODELO ATUALIZADO"}]',gen_random_uuid());
 if (select count(*) from public.data_catalog_support_items)<>baseline+1 or not exists(select 1 from public.data_catalog_support_items where code='__rack__' and present_in_latest_catalog and descricao like '%ATUALIZADO') then raise exception 'TEST FAILED update'; end if;
 if exists(select 1 from public.data_product_details) then raise exception 'TEST FAILED all-support upload'; end if;
 if dashboard_private.catalog_support_reason('new1','PALÉTE DE MADEIRA') is null or dashboard_private.catalog_support_reason('new2','ILHA ULTRA 4C') is null or dashboard_private.catalog_support_reason('new3','KIT PEÇAS MANUTENÇÃO DIVERSAS') is null then raise exception 'TEST FAILED recognition'; end if;
end $$;
reset role;
