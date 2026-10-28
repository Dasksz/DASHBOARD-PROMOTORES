-- Explicit administrative exceptions for synthetic/test clients absent from the 302 file.
create table if not exists dashboard_private.preserved_catalog_clients (
 client_code text primary key, description text not null, created_at timestamptz not null default now()
);
alter table dashboard_private.preserved_catalog_clients enable row level security;
create policy preserved_catalog_admin on dashboard_private.preserved_catalog_clients to authenticated
 using ((select public.is_admin())) with check ((select public.is_admin()));
grant select,insert,update,delete on dashboard_private.preserved_catalog_clients to authenticated;

-- A catalog replacement and its wallet reconciliation commit as one transaction.
create table if not exists public.data_client_promoters_removed (
 id uuid primary key default gen_random_uuid(),
 import_id uuid not null,
 client_code text not null,
 promoter_code text,
 itinerary_frequency text,
 itinerary_ref_date timestamptz,
 itinerary_days text,
 client_snapshot jsonb not null default '{}'::jsonb,
 hierarchy_snapshot jsonb not null default '{}'::jsonb,
 removed_at timestamptz not null default now(),
 status text not null default 'pending' check(status in ('pending','removal_confirmed','restored')),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id) on delete set null,
 review_note text check(length(review_note)<=500),
 unique(import_id,client_code)
);
create index if not exists client_promoters_removed_pending_idx on public.data_client_promoters_removed(status,removed_at desc,id);
create index if not exists client_promoters_removed_promoter_idx on public.data_client_promoters_removed(lower(btrim(promoter_code)));
alter table public.data_client_promoters_removed enable row level security;

create table if not exists dashboard_private.client_catalog_imports (
 id uuid primary key, input_digest text not null, catalog_hash text,
 clients_count integer not null, archived_count integer not null,
 completed_at timestamptz not null default now(), imported_by uuid references auth.users(id) on delete set null
);
alter table dashboard_private.client_catalog_imports enable row level security;
create policy catalog_import_admin on dashboard_private.client_catalog_imports to authenticated
 using ((select public.is_admin())) with check ((select public.is_admin()));
grant select,insert on dashboard_private.client_catalog_imports to authenticated;

create or replace function dashboard_private.wallet_can_manage(promoter text,coord text,cocoord text)
returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce(auth.uid() is not null and public.is_approved() and (
   public.is_admin() or exists(select 1 from public.profiles p where p.id=auth.uid() and (
     lower(btrim(p.role))=nullif(lower(btrim(coord)),'') or lower(btrim(p.role))=nullif(lower(btrim(cocoord)),'')
     or exists(select 1 from public.data_hierarchy h where lower(btrim(h.cod_promotor))=lower(btrim(promoter))
       and lower(btrim(p.role)) in (lower(btrim(h.cod_coord)),lower(btrim(h.cod_cocoord))))
   ))),false);
$$;
create policy removed_clients_read on public.data_client_promoters_removed for select to authenticated using (
 dashboard_private.wallet_can_manage(promoter_code,hierarchy_snapshot->>'cod_coord',hierarchy_snapshot->>'cod_cocoord')
 or ((select public.is_approved()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and lower(btrim(p.role))=lower(btrim(promoter_code))))
);
create policy removed_clients_insert on public.data_client_promoters_removed for insert to authenticated with check ((select public.is_admin()));
create policy removed_clients_review on public.data_client_promoters_removed for update to authenticated
 using (dashboard_private.wallet_can_manage(promoter_code,hierarchy_snapshot->>'cod_coord',hierarchy_snapshot->>'cod_cocoord'))
 with check (dashboard_private.wallet_can_manage(promoter_code,hierarchy_snapshot->>'cod_coord',hierarchy_snapshot->>'cod_cocoord'));
revoke all on public.data_client_promoters_removed from anon,authenticated;
grant select,insert on public.data_client_promoters_removed to authenticated;
grant update(status,review_note) on public.data_client_promoters_removed to authenticated;

create or replace function dashboard_private.guard_wallet_review()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.status<>'pending' then raise exception 'Esta ocorrência já foi revisada.' using errcode='23514'; end if;
 if new.status not in ('removal_confirmed','restored') then raise exception 'Escolha uma ação de revisão válida.' using errcode='23514'; end if;
 if new.status='restored' and not exists(select 1 from public.data_client_promoters p join public.data_clients c on c.codigo_cliente=p.client_code
   where p.client_code=new.client_code and lower(btrim(p.promoter_code))=lower(btrim(new.promoter_code))) then
   raise exception 'O cliente precisa voltar ao cadastro e ter seu vínculo restaurado.' using errcode='23514';
 end if;
 new.reviewed_at:=now(); new.reviewed_by:=auth.uid();
 return new;
end $$;
create trigger guard_wallet_review before update on public.data_client_promoters_removed for each row execute function dashboard_private.guard_wallet_review();

create or replace function dashboard_private.archive_missing_client_promoters(p_import_id uuid,p_expected_codes text[] default null)
returns integer language plpgsql security invoker set search_path='' as $$
declare moved_count integer;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Importação reservada ao administrador.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(70261027,302);
 with removed as (
   delete from public.data_client_promoters p where
    case when p_expected_codes is null then not exists(select 1 from public.data_clients c where c.codigo_cliente=p.client_code)
      else not(p.client_code=any(p_expected_codes)) end
   returning p.*
 )
 insert into public.data_client_promoters_removed(import_id,client_code,promoter_code,itinerary_frequency,itinerary_ref_date,itinerary_days,client_snapshot,hierarchy_snapshot)
 select p_import_id,p.client_code,p.promoter_code,p.itinerary_frequency,p.itinerary_ref_date,p.itinerary_days,
  coalesce(to_jsonb(c),jsonb_build_object('codigo_cliente',p.client_code,'nomecliente',(
    select o.cliente_nome from public.data_orders o where o.codcli=p.client_code and o.cliente_nome is not null order by o.dtped desc nulls last limit 1))),
  coalesce((select to_jsonb(h) from public.data_hierarchy h where lower(btrim(h.cod_promotor))=lower(btrim(p.promoter_code)) limit 1),'{}'::jsonb)
 from removed p left join public.data_clients c on c.codigo_cliente=p.client_code;
 get diagnostics moved_count=row_count;
 return moved_count;
end $$;

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

create or replace function public.get_wallet_review_v1(p_promoter text default null,p_offset integer default 0,p_limit integer default 50,p_history boolean default false)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare items jsonb; total integer; pending integer;
begin
 if auth.uid() is null or not public.is_approved() then raise exception 'Acesso não autorizado.' using errcode='42501'; end if;
 select count(*) into pending from public.data_client_promoters_removed where status='pending';
 select count(*) into total from public.data_client_promoters_removed a where (p_history or a.status='pending')
  and (p_promoter is null or lower(btrim(a.promoter_code))=lower(btrim(p_promoter)));
 select coalesce(jsonb_agg(v order by v.removed_at desc,v.id),'[]'::jsonb) into items from (
   select a.*, c.codigo_cliente is not null client_returned,
    dashboard_private.wallet_can_manage(a.promoter_code,a.hierarchy_snapshot->>'cod_coord',a.hierarchy_snapshot->>'cod_cocoord') can_review,
    (c.codigo_cliente is not null and exists(select 1 from public.data_hierarchy h where lower(btrim(h.cod_promotor))=lower(btrim(a.promoter_code)))
     and not exists(select 1 from public.data_client_promoters p where p.client_code=a.client_code)) can_restore
   from public.data_client_promoters_removed a left join public.data_clients c on c.codigo_cliente=a.client_code
   where (p_history or a.status='pending') and (p_promoter is null or lower(btrim(a.promoter_code))=lower(btrim(p_promoter)))
   order by a.removed_at desc,a.id offset greatest(p_offset,0) limit least(greatest(p_limit,1),100)
 )v;
 return jsonb_build_object('pending_count',pending,'total',total,'items',items);
end $$;

create or replace function public.review_removed_client_promoter_v1(p_id uuid,p_action text,p_note text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.data_client_promoters_removed; inserted integer;
begin
 if auth.uid() is null or not public.is_approved() then raise exception 'Acesso não autorizado.' using errcode='42501'; end if;
 if p_action not in ('removal_confirmed','restored') or p_action is null then raise exception 'Ação de revisão inválida.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(70261027,302);
 select * into a from public.data_client_promoters_removed where id=p_id for update;
 if not found or not dashboard_private.wallet_can_manage(a.promoter_code,a.hierarchy_snapshot->>'cod_coord',a.hierarchy_snapshot->>'cod_cocoord') then
  raise exception 'Sem permissão para revisar esta carteira.' using errcode='42501'; end if;
 if a.status<>'pending' then return jsonb_build_object('status',a.status,'already_reviewed',true); end if;
 if p_action='restored' then
   -- The shared catalog advisory lock above serializes this check with imports.
   -- Reading the catalog must not require the coordinator's UPDATE permission on it.
   perform 1 from public.data_clients where codigo_cliente=a.client_code;
   if not found then raise exception 'O cliente ainda não voltou ao cadastro 302. Corrija o cadastro antes de restaurar.' using errcode='23514'; end if;
   if not exists(select 1 from public.data_hierarchy h where lower(btrim(h.cod_promotor))=lower(btrim(a.promoter_code))) then
    raise exception 'O promotor original não está mais cadastrado. Confira o vínculo antes de restaurar.' using errcode='23514'; end if;
   insert into public.data_client_promoters(client_code,promoter_code,itinerary_frequency,itinerary_ref_date,itinerary_days)
   values(a.client_code,a.promoter_code,a.itinerary_frequency,a.itinerary_ref_date,a.itinerary_days) on conflict(client_code) do nothing;
   get diagnostics inserted=row_count;
   if inserted=0 then raise exception 'O cliente já possui um vínculo ativo. Confira a carteira atual.' using errcode='23514'; end if;
 end if;
 update public.data_client_promoters_removed set status=p_action,review_note=nullif(btrim(p_note),'') where id=p_id;
 return jsonb_build_object('status',p_action,'client_code',a.client_code);
end $$;

revoke all on function dashboard_private.wallet_can_manage(text,text,text) from public,anon;
revoke all on function dashboard_private.guard_wallet_review() from public,anon;
revoke all on function dashboard_private.archive_missing_client_promoters(uuid,text[]) from public,anon;
revoke all on function public.replace_client_catalog_v1(jsonb,uuid,text) from public,anon;
revoke all on function public.get_wallet_review_v1(text,integer,integer,boolean) from public,anon;
revoke all on function public.review_removed_client_promoter_v1(uuid,text,text) from public,anon;
grant usage on schema dashboard_private to authenticated;
grant execute on function dashboard_private.wallet_can_manage(text,text,text),dashboard_private.guard_wallet_review(),dashboard_private.archive_missing_client_promoters(uuid,text[]),
 public.replace_client_catalog_v1(jsonb,uuid,text),public.get_wallet_review_v1(text,integer,integer,boolean),public.review_removed_client_promoter_v1(uuid,text,text) to authenticated;
