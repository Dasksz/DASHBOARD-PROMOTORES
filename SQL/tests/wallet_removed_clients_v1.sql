-- Compatible with safeupdate sessions: all replacement/test UPDATE and DELETE statements use predicates.
-- Run inside a transaction and roll it back. Uses synthetic clients, never visits or outbound notifications.
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='adm' and status='aprovado' limit 1),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
create temporary table wallet_test_state (payload jsonb,import_id uuid,archive_id uuid,confirm_id uuid,admin_id text,manager_id text,promoter_id text) on commit drop;
insert into wallet_test_state(import_id,admin_id,manager_id,promoter_id)
select gen_random_uuid(),auth.uid()::text,
 (select id::text from public.profiles where role='COORDENADOR 1' and status='aprovado' limit 1),
 (select id::text from public.profiles where role='promotor_teste' and status='aprovado' limit 1);
insert into public.data_clients(codigo_cliente,nomecliente) values('__wallet_keep__','Cliente mantido'),('__wallet_removed__','Cliente removido teste'),('__wallet_confirm__','Cliente retirado teste');
insert into public.data_client_promoters(client_code,promoter_code,itinerary_frequency,itinerary_ref_date,itinerary_days)
values('__wallet_removed__','promotor2','weekly','2026-10-26','1,3,5'),('__wallet_confirm__','promotor2','weekly','2026-10-26','2,4');
update wallet_test_state set payload=(select jsonb_agg(to_jsonb(c)) from public.data_clients c where c.codigo_cliente not in ('__wallet_removed__','__wallet_confirm__')) where import_id is not null;
do $$ declare result jsonb; s record; before_count integer; before_archive integer; duplicate_id uuid:=gen_random_uuid(); begin
 select * into s from wallet_test_state;
 result:=public.replace_client_catalog_v1(s.payload,s.import_id,'wallet-test');
 if result->>'clients_count' is distinct from jsonb_array_length(s.payload)::text then raise exception 'TEST FAILED: catalog count'; end if;
 if exists(select 1 from public.data_client_promoters where client_code='__wallet_removed__') then raise exception 'TEST FAILED: missing client remains active'; end if;
 if not exists(select 1 from public.data_client_promoters_removed where client_code='__wallet_removed__' and itinerary_days='1,3,5' and client_snapshot->>'nomecliente'='Cliente removido teste' and status='pending') then raise exception 'TEST FAILED: archive snapshot'; end if;
 if (public.replace_client_catalog_v1(s.payload,s.import_id,'wallet-test')->>'replayed') is distinct from 'true' then raise exception 'TEST FAILED: retry is not idempotent'; end if;
 select count(*) into before_count from public.data_clients;
 select count(*) into before_archive from public.data_client_promoters_removed;
 begin perform public.replace_client_catalog_v1('[]',gen_random_uuid(),'empty'); raise exception 'TEST FAILED: empty import allowed'; exception when invalid_parameter_value then null; end;
 begin perform public.replace_client_catalog_v1('[{"codigo_cliente":"1"},{"codigo_cliente":"1"}]',gen_random_uuid(),'duplicate'); raise exception 'TEST FAILED: duplicate allowed'; exception when invalid_parameter_value then null; end;
 begin perform public.replace_client_catalog_v1('[{"codigo_cliente":"__invalid__","id":"not-a-uuid"}]',gen_random_uuid(),'invalid'); raise exception 'TEST FAILED: invalid types allowed'; exception when invalid_text_representation then null; end;
 begin
  perform public.replace_client_catalog_v1(jsonb_build_array(jsonb_build_object('codigo_cliente','__broken_a__','id',duplicate_id),jsonb_build_object('codigo_cliente','__broken_b__','id',duplicate_id)),gen_random_uuid(),'broken');
  raise exception 'TEST FAILED: duplicate primary keys accepted';
 exception when unique_violation then null; end;
 if before_count<>(select count(*) from public.data_clients) then raise exception 'TEST FAILED: unsuccessful import damaged catalog'; end if;
 if before_archive<>(select count(*) from public.data_client_promoters_removed) then raise exception 'TEST FAILED: failed import archived active wallets'; end if;
end $$;
update wallet_test_state set archive_id=(select id from public.data_client_promoters_removed where client_code='__wallet_removed__'),confirm_id=(select id from public.data_client_promoters_removed where client_code='__wallet_confirm__') where import_id is not null;
insert into public.data_client_promoters_removed(import_id,client_code,promoter_code,hierarchy_snapshot)
 values(gen_random_uuid(),'__other_team__','__other_promoter__','{"cod_cocoord":"__other_manager__"}');
do $$ begin
 begin perform public.review_removed_client_promoter_v1((select archive_id from wallet_test_state),'restored'); raise exception 'TEST FAILED: absent client restored'; exception when check_violation then null; end;
end $$;
-- A promoter can see their own pending records but cannot review another team's archive.
select set_config('request.jwt.claim.sub',(select promoter_id from wallet_test_state),true);
do $$ begin
 if exists(select 1 from public.data_client_promoters_removed where client_code='__wallet_removed__') then raise exception 'TEST FAILED: archive leaked to unrelated promoter'; end if;
 begin perform public.review_removed_client_promoter_v1((select archive_id from wallet_test_state),'removal_confirmed'); raise exception 'TEST FAILED: unauthorized review allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',(select admin_id from wallet_test_state),true);
insert into public.data_clients(codigo_cliente,nomecliente) values('__wallet_removed__','Cliente voltou');
select set_config('request.jwt.claim.sub',(select manager_id from wallet_test_state),true);
do $$ declare result jsonb; begin
 if exists(select 1 from public.data_client_promoters_removed where client_code='__other_team__') then raise exception 'TEST FAILED: coordinator can see another team'; end if;
 if not exists(select 1 from public.data_client_promoters_removed where client_code='__wallet_removed__') then raise exception 'TEST FAILED: coordinator cannot see team archive'; end if;
 if public.get_wallet_review_v1('promotor2')->>'pending_count'='0' then raise exception 'TEST FAILED: manager notification'; end if;
 result:=public.review_removed_client_promoter_v1((select archive_id from wallet_test_state),'restored','Cadastro corrigido');
 if result->>'status'<>'restored' then raise exception 'TEST FAILED: restore response'; end if;
 if not exists(select 1 from public.data_client_promoters where client_code='__wallet_removed__' and promoter_code='promotor2' and itinerary_days='1,3,5') then raise exception 'TEST FAILED: original route not restored'; end if;
 if not exists(select 1 from public.data_client_promoters_removed where client_code='__wallet_removed__' and reviewed_by=auth.uid() and reviewed_at is not null) then raise exception 'TEST FAILED: review audit'; end if;
 perform public.review_removed_client_promoter_v1((select confirm_id from wallet_test_state),'removal_confirmed','Retirada conferida');
 if not exists(select 1 from public.data_client_promoters_removed where client_code='__wallet_confirm__' and status='removal_confirmed') then raise exception 'TEST FAILED: history not preserved'; end if;
 if exists(select 1 from public.data_client_promoters where client_code='__wallet_confirm__') then raise exception 'TEST FAILED: confirmation restored inactive client'; end if;
end $$;
reset role;
