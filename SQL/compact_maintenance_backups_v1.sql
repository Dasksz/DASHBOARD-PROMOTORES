-- Lossless compression of two unused maintenance snapshots, not business data.
-- Original names remain readable through security-invoker views; empty schema
-- tables retain all original types/constraints for a future exact restoration.
set local lock_timeout='5s';
set local statement_timeout='120s';
create table dashboard_private.maintenance_archive_chunks (
 source_table text not null,
 chunk_id integer not null,
 row_count integer not null check(row_count>0),
 payload jsonb not null,
 primary key(source_table,chunk_id),
 check(jsonb_typeof(payload)='array' and jsonb_array_length(payload)=row_count)
);
alter table dashboard_private.maintenance_archive_chunks alter column payload set storage extended;
alter table dashboard_private.maintenance_archive_chunks alter column payload set compression pglz;
create table dashboard_private.maintenance_archive_manifest (
 source_table text primary key,
 schema_table text not null,
 original_rows bigint not null,
 original_bytes bigint not null,
 columns_snapshot jsonb not null,
 verified_rows bigint not null,
 archived_at timestamptz not null default now()
);
alter table dashboard_private.maintenance_archive_chunks enable row level security;
alter table dashboard_private.maintenance_archive_manifest enable row level security;
revoke all on dashboard_private.maintenance_archive_chunks,dashboard_private.maintenance_archive_manifest from public,anon,authenticated,service_role;
create policy archive_private_only on dashboard_private.maintenance_archive_chunks using(false) with check(false);
create policy manifest_private_only on dashboard_private.maintenance_archive_manifest using(false) with check(false);

do $$
declare t text; schema_name text; order_keys text; join_keys text; first_key text;
 original_count bigint; recovered_count bigint; source_bytes bigint; mismatch boolean; columns_info jsonb;
begin
 foreach t in array array['repair_20261019_rows','duplicate_sales_backup_20261007'] loop
  schema_name:=t||'_schema';
  if t='repair_20261019_rows' then
   order_keys:='source_table,original_id'; first_key:='source_table';
   join_keys:='a.source_table=b.source_table and a.original_id=b.original_id';
  else
   order_keys:='source,row_id'; first_key:='source';
   join_keys:='a.source=b.source and a.row_id=b.row_id';
  end if;
  execute format('lock table dashboard_private.%I in access exclusive mode',t);
  -- Refuse snapshots used by a view/FK, instead of altering a live dependency.
  if exists(select 1 from pg_depend d where d.refobjid=format('dashboard_private.%I',t)::regclass and d.deptype='n') then
   raise exception 'Archive source % has external dependencies; inspect manually.',t;
  end if;
  execute format('select count(*) from dashboard_private.%I',t) into original_count;
  source_bytes:=pg_total_relation_size(format('dashboard_private.%I',t)::regclass);
  select jsonb_agg(jsonb_build_object('column',column_name,'type',udt_name,'nullable',is_nullable,'default',column_default) order by ordinal_position)
   into columns_info from information_schema.columns where table_schema='dashboard_private' and table_name=t;
  execute format('insert into dashboard_private.maintenance_archive_chunks(source_table,chunk_id,row_count,payload)
   select %L,((rn-1)/500)::integer,count(*)::integer,jsonb_agg(row_data order by rn)
   from (select row_number() over(order by %s) rn,to_jsonb(r) row_data from dashboard_private.%I r) s group by ((rn-1)/500)',t,order_keys,t);
  execute format('select count(*) from dashboard_private.maintenance_archive_chunks c cross join lateral
   jsonb_populate_recordset(null::dashboard_private.%I,c.payload) r where c.source_table=%L',t,t) into recovered_count;
  if original_count<>recovered_count then raise exception 'Archive row count mismatch for %',t; end if;
  -- Compare every recovered row and every column, including original JSON and timestamps.
  execute format('select exists(select 1 from dashboard_private.%I a full join
   (select r.* from dashboard_private.maintenance_archive_chunks c cross join lateral
    jsonb_populate_recordset(null::dashboard_private.%I,c.payload) r where c.source_table=%L) b
   on %s where a.%I is null or b.%I is null or to_jsonb(a) is distinct from to_jsonb(b))',t,t,t,join_keys,first_key,first_key) into mismatch;
  if mismatch then raise exception 'Archive content mismatch for %',t; end if;
  insert into dashboard_private.maintenance_archive_manifest(source_table,schema_table,original_rows,original_bytes,columns_snapshot,verified_rows)
   values(t,schema_name,original_count,source_bytes,columns_info,recovered_count);
  execute format('alter table dashboard_private.%I rename to %I',t,schema_name);
  execute format('truncate table dashboard_private.%I',schema_name);
  execute format('alter table dashboard_private.%I enable row level security',schema_name);
  execute format('create policy archive_schema_private_only on dashboard_private.%I using(false) with check(false)',schema_name);
  execute format('revoke all on dashboard_private.%I from public,anon,authenticated,service_role',schema_name);
  execute format('create view dashboard_private.%I with(security_invoker=true) as
   select r.* from dashboard_private.maintenance_archive_chunks c cross join lateral
   jsonb_populate_recordset(null::dashboard_private.%I,c.payload) r where c.source_table=%L',t,schema_name,t);
  execute format('revoke all on dashboard_private.%I from public,anon,authenticated,service_role',t);
  execute format('comment on view dashboard_private.%I is %L',t,'Maintenance snapshot preserved losslessly in compressed chunks; see maintenance_archive_manifest. Read-only; no business data removed.');
 end loop;
end $$;
