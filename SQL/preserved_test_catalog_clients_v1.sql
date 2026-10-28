-- Explicit administrative exceptions for synthetic/test clients absent from the 302 file.
create table if not exists dashboard_private.preserved_catalog_clients (
 client_code text primary key, description text not null, created_at timestamptz not null default now()
);
alter table dashboard_private.preserved_catalog_clients enable row level security;
create policy preserved_catalog_admin on dashboard_private.preserved_catalog_clients to authenticated
 using ((select public.is_admin())) with check ((select public.is_admin()));
grant select,insert,update,delete on dashboard_private.preserved_catalog_clients to authenticated;

create or replace function public.replace_client_catalog_v1(p_rows jsonb,p_import_id uuid,p_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare receipt dashboard_private.client_catalog_imports; codes text[]; moved_count integer; row_count integer; digest text;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Importação reservada ao administrador.' using errcode='42501'; end if;
 if p_import_id is null or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)=0 then
   raise exception 'Cadastro vazio ou inválido. A base anterior foi preservada.' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) r where jsonb_typeof(r) is distinct from 'object' or nullif(btrim(r->>'codigo_cliente'),'') is null) then
   raise exception 'Todos os clientes devem ter um código válido.' using errcode='22023'; end if;
 select array_agg(btrim(r->>'codigo_cliente')) into codes from jsonb_array_elements(p_rows) r;
 row_count:=cardinality(codes);
 if row_count<>(select count(distinct code) from unnest(codes) code) then
   raise exception 'O cadastro possui códigos de cliente duplicados.' using errcode='22023'; end if;
 digest:=md5(p_rows::text);
 perform pg_advisory_xact_lock(70261027,302);
 select * into receipt from dashboard_private.client_catalog_imports where id=p_import_id;
 if found then
   if receipt.input_digest<>digest then raise exception 'Identificador de importação reutilizado com outro conteúdo.' using errcode='22023'; end if;
   return jsonb_build_object('clients_count',receipt.clients_count,'archived_count',receipt.archived_count,'replayed',true);
 end if;
 -- Keep explicitly registered test clients; incoming sheet data wins if the code is present.
 p_rows:=p_rows || coalesce((select jsonb_agg(to_jsonb(c)) from public.data_clients c
   join dashboard_private.preserved_catalog_clients kept on kept.client_code=c.codigo_cliente
   where not(c.codigo_cliente=any(codes))),'[]'::jsonb);
 select array_agg(btrim(r->>'codigo_cliente')) into codes from jsonb_array_elements(p_rows) r;
 row_count:=cardinality(codes);
 -- Validate all column types before changing any data. A later error also rolls back the entire RPC.
 perform * from jsonb_populate_recordset(null::public.data_clients,p_rows);
 moved_count:=dashboard_private.archive_missing_client_promoters(p_import_id,codes);
 -- id is a NOT NULL primary key; replace the validated catalog atomically.
 -- An explicit predicate keeps Supabase safeupdate protection enabled.
 delete from public.data_clients where id is not null;
 insert into public.data_clients select * from jsonb_populate_recordset(null::public.data_clients,(
   select jsonb_agg(r || jsonb_build_object('id',coalesce(r->>'id',gen_random_uuid()::text),'codigo_cliente',btrim(r->>'codigo_cliente')))
   from jsonb_array_elements(p_rows) r));
 if nullif(btrim(p_hash),'') is not null then
   insert into public.data_metadata(key,value) values('hash_clients',p_hash) on conflict(key) do update set value=excluded.value;
 end if;
 insert into dashboard_private.client_catalog_imports(id,input_digest,catalog_hash,clients_count,archived_count,imported_by)
 values(p_import_id,digest,p_hash,row_count,moved_count,auth.uid());
 return jsonb_build_object('clients_count',row_count,'archived_count',moved_count,'replayed',false);
end $$;

