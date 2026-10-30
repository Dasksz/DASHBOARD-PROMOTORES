-- Fixture ids are selected dynamically; rollback this whole test.
select set_config('test.visit_checkout_failure_id',(select id::text from public.visitas where checkout_at is null
 and data_visita < date_trunc('day',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' order by id limit 1),true);
create function dashboard_private.test_checkout_failure() returns trigger language plpgsql as $$
begin if new.id::text=current_setting('test.visit_checkout_failure_id') and old.checkout_at is null and new.checkout_at is not null then
 raise exception 'Simulated failure for isolation test'; end if; return new; end $$;
create trigger test_checkout_failure before update on public.visitas for each row execute function dashboard_private.test_checkout_failure();
do $$ declare result jsonb; begin
 result:=dashboard_private.auto_checkout_overdue_visits_v1();
 if (result->>'closed')::int<1 or (result->>'failed')::int<>1 then raise exception 'TEST FAILED failure isolation %',result; end if;
 if not exists(select 1 from dashboard_private.visit_checkout_events where not successful and error_message='Simulated failure for isolation test') then raise exception 'TEST FAILED failed audit absent'; end if;
 if not exists(select 1 from public.visitas where id::text=current_setting('test.visit_checkout_failure_id') and checkout_at is null) then raise exception 'TEST FAILED failed visit closed'; end if;
end $$;
