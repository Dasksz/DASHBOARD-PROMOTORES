create table dashboard_private.product_catalog_imports (
 id uuid primary key, digest text not null, product_count integer not null, completed_at timestamptz not null default now()
);
alter table dashboard_private.product_catalog_imports enable row level security;
create policy product_catalog_import_admin on dashboard_private.product_catalog_imports to authenticated
 using ((select public.is_admin())) with check ((select public.is_admin()));
grant select,insert on dashboard_private.product_catalog_imports to authenticated;

create or replace function public.replace_product_catalog_v1(p_rows jsonb,p_import_id uuid,p_hashes jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare receipt dashboard_private.product_catalog_imports; n integer; fingerprint text;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Cadastro de produtos reservado ao administrador.' using errcode='42501'; end if;
 if p_import_id is null or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)=0 then
  raise exception 'Planilha de produtos vazia ou inválida. Cadastro anterior preservado.' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) r where jsonb_typeof(r) is distinct from 'object'
   or nullif(btrim(r->>'code'),'') is null or nullif(btrim(r->>'descricao'),'') is null) then
  raise exception 'Todos os produtos devem ter código e descrição.' using errcode='22023'; end if;
 n:=jsonb_array_length(p_rows);
 if n<>(select count(distinct btrim(r->>'code')) from jsonb_array_elements(p_rows) r) then
  raise exception 'A planilha contém códigos de produto duplicados.' using errcode='22023'; end if;
 fingerprint:=md5(p_rows::text);
 perform pg_advisory_xact_lock(70261028,203);
 select * into receipt from dashboard_private.product_catalog_imports where id=p_import_id;
 if found then
  if receipt.digest<>fingerprint then raise exception 'Importação reutilizada com outro conteúdo.' using errcode='22023'; end if;
  return jsonb_build_object('product_count',receipt.product_count,'replayed',true);
 end if;
 perform * from jsonb_populate_recordset(null::public.data_product_details,p_rows);
 delete from public.data_active_products where code is not null;
 delete from public.dim_produtos where codigo is not null;
 delete from public.data_product_details where code is not null;
 insert into public.data_product_details(code,descricao,fornecedor,codfor,dtcadastro,pasta,qtde_master)
 select btrim(p.code),p.descricao,p.fornecedor,p.codfor,p.dtcadastro,p.pasta,coalesce(nullif(p.qtde_master,0),1)
 from jsonb_populate_recordset(null::public.data_product_details,p_rows) p;
 insert into public.data_active_products(code) select code from public.data_product_details;
 insert into public.dim_produtos(codigo,descricao,codfor,qtde_master)
 select code,descricao,codfor,qtde_master from public.data_product_details;
 insert into public.data_metadata(key,value)
 select key,value from jsonb_each_text(p_hashes) where key in ('hash_product_details','hash_active_products','hash_dim_produtos')
 on conflict(key) do update set value=excluded.value;
 insert into dashboard_private.product_catalog_imports(id,digest,product_count) values(p_import_id,fingerprint,n);
 return jsonb_build_object('product_count',n,'replayed',false);
end $$;
revoke all on function public.replace_product_catalog_v1(jsonb,uuid,jsonb) from public,anon;
grant execute on function public.replace_product_catalog_v1(jsonb,uuid,jsonb) to authenticated;
