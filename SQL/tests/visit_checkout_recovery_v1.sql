-- Maintenance integration test. Requires the migration, run inside BEGIN/ROLLBACK.
-- Uses existing open visits but rolls back every update and queued webhook.
do $$ declare result jsonb; old_visit public.visitas; old_today jsonb; begin
 select * into old_visit from public.visitas where checkout_at is null and not dashboard_private.has_visit_survey(respostas)
 and data_visita < date_trunc('day',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' order by id limit 1;
 if old_visit.id is null then raise exception 'TEST requires an older unanswered open visit'; end if;
 select jsonb_agg(to_jsonb(v) order by id) into old_today from public.visitas v
 where data_visita>=date_trunc('day',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
 begin
  update public.visitas set checkout_at=now() where id=old_visit.id;
  raise exception 'TEST FAILED ordinary update bypassed survey';
 exception when check_violation then null; end;
 result:=dashboard_private.auto_checkout_overdue_visits_v1();
 if (result->>'closed')::int<1 or (result->>'failed')::int<>0 then raise exception 'TEST FAILED automatic result %',result; end if;
 if exists(select 1 from public.visitas where checkout_at is null and data_visita<date_trunc('day',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo') then raise exception 'TEST FAILED older open visits remain'; end if;
 if old_today is distinct from (select jsonb_agg(to_jsonb(v) order by id) from public.visitas v where data_visita>=date_trunc('day',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo') then raise exception 'TEST FAILED today altered'; end if;
 if not exists(select 1 from public.visitas where id=old_visit.id and respostas is not distinct from old_visit.respostas and status is not distinct from old_visit.status) then raise exception 'TEST FAILED survey/status changed'; end if;
 if not exists(select 1 from dashboard_private.visit_checkout_events where visit_id=old_visit.id and mode='automatic' and survey_missing and successful) then raise exception 'TEST FAILED audit missing'; end if;
 if (dashboard_private.auto_checkout_overdue_visits_v1()->>'closed')::int<>0 then raise exception 'TEST FAILED not idempotent'; end if;
end $$;
