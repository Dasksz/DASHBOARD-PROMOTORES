create table public.data_catalog_support_items (
 code text primary key, descricao text not null, classification_reason text not null,
 source_data jsonb not null, dimension_snapshot jsonb, stock_snapshot jsonb,
 first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
 present_in_latest_catalog boolean not null default true
);
alter table public.data_catalog_support_items enable row level security;
create policy support_items_admin on public.data_catalog_support_items to authenticated
 using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.data_catalog_support_items from anon,authenticated;
grant select,insert,update on public.data_catalog_support_items to authenticated;
alter table dashboard_private.product_catalog_imports add column if not exists support_count integer not null default 0;

create or replace function dashboard_private.catalog_support_reason(p_code text,p_description text)
returns text language sql immutable security invoker set search_path='' as $$
 select case
 when p_code='1443' or d ~ '^(EC )?PALETE( |$)' then 'Material logístico'
 when p_code='10010' or d ~ '^KIT PECAS MANUTENCAO( |$)' then 'Material de manutenção'
 when p_code in ('4036','4522','4772','5429','6311','6312','6313','6314','6315')
   or d ~ '^(EC )?RACK( |$)' or d ~ '^(EC )?ILHA (SALTY|ULTRA|MODULAR)( |$)' or d ~ '^(EC )?GAIOLA ELMA CHIPS( |$)'
 then 'Equipamento de exposição' end
 from (select translate(upper(btrim(coalesce(p_description,''))),'ÁÀÂÃÉÊÍÓÔÕÚÇ','AAAAEEIOOOUC') d) normalized;
$$;
revoke all on function dashboard_private.catalog_support_reason(text,text) from public,anon;
grant execute on function dashboard_private.catalog_support_reason(text,text) to authenticated;

create or replace function public.replace_product_catalog_v1(p_rows jsonb,p_import_id uuid,p_hashes jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare receipt dashboard_private.product_catalog_imports; n integer; support_n integer; fingerprint text;
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
  return jsonb_build_object('product_count',receipt.product_count,'support_count',receipt.support_count,'replayed',true);
 end if;
 perform * from jsonb_populate_recordset(null::public.data_product_details,p_rows);
 -- Support records are retained even if later omitted from a master file.
 update public.data_catalog_support_items set present_in_latest_catalog=false where code is not null;
 insert into public.data_catalog_support_items(code,descricao,classification_reason,source_data,dimension_snapshot,stock_snapshot)
 select btrim(r->>'code'),r->>'descricao',dashboard_private.catalog_support_reason(btrim(r->>'code'),r->>'descricao'),r,
  (select to_jsonb(d) from public.dim_produtos d where d.codigo=btrim(r->>'code')),
  (select coalesce(jsonb_agg(to_jsonb(st)),'[]') from public.data_stock st where st.product_code=btrim(r->>'code'))
 from jsonb_array_elements(p_rows) r where dashboard_private.catalog_support_reason(btrim(r->>'code'),r->>'descricao') is not null
 on conflict(code) do update set descricao=excluded.descricao,classification_reason=excluded.classification_reason,
 source_data=excluded.source_data,dimension_snapshot=coalesce(excluded.dimension_snapshot,data_catalog_support_items.dimension_snapshot),
 stock_snapshot=excluded.stock_snapshot,last_seen_at=now(),present_in_latest_catalog=true;
 get diagnostics support_n=row_count;
 select coalesce(jsonb_agg(r),'[]') into p_rows from jsonb_array_elements(p_rows) r
 where dashboard_private.catalog_support_reason(btrim(r->>'code'),r->>'descricao') is null;
 n:=jsonb_array_length(p_rows);
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
 insert into dashboard_private.product_catalog_imports(id,digest,product_count,support_count) values(p_import_id,fingerprint,n,support_n);
 insert into public.data_metadata(key,value) values('non_merchandise_codes',(
   select coalesce(jsonb_agg(code order by code),'[]')::text from public.data_catalog_support_items
 )) on conflict(key) do update set value=excluded.value;
 return jsonb_build_object('product_count',n,'support_count',support_n,'replayed',false);
end $$;
revoke all on function public.replace_product_catalog_v1(jsonb,uuid,jsonb) from public,anon;
grant execute on function public.replace_product_catalog_v1(jsonb,uuid,jsonb) to authenticated;
