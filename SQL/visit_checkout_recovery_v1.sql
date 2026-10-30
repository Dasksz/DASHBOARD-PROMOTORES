-- Private, audited exceptions for unattended midnight checkout and confirmed corrections.
-- Normal promoter checkout still requires a saved survey and the photo rules.
create table dashboard_private.visit_checkout_events (
 id bigint generated always as identity primary key,
 visit_id bigint not null,
 checkout_at timestamptz not null,
 mode text not null check(mode in ('automatic','administrative')),
 reason text not null check(btrim(reason)<>''),
 survey_missing boolean not null,
 successful boolean not null default true,
 error_message text,
 visit_before jsonb not null,
 transaction_id bigint not null default txid_current(),
 recorded_at timestamptz not null default clock_timestamp(),
 database_actor text not null default current_user
);
create index visit_checkout_events_visit_idx on dashboard_private.visit_checkout_events(visit_id,transaction_id);
alter table dashboard_private.visit_checkout_events enable row level security;
revoke all on dashboard_private.visit_checkout_events from public,anon,authenticated,service_role;
revoke all on sequence dashboard_private.visit_checkout_events_id_seq from public,anon,authenticated,service_role;

create or replace function dashboard_private.close_visit_recorded_v1(p_visit_id bigint,p_checkout_at timestamptz,p_mode text,p_reason text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v public.visitas;
begin
 if current_user<>'postgres' then raise exception 'Operação reservada à manutenção do banco.' using errcode='42501'; end if;
 if p_mode not in ('automatic','administrative') or p_mode is null or nullif(btrim(p_reason),'') is null then
  raise exception 'Tipo e motivo do encerramento são obrigatórios.' using errcode='22023'; end if;
 select * into v from public.visitas where id=p_visit_id for update;
 if not found then raise exception 'Visita não encontrada.' using errcode='22023'; end if;
 if v.checkout_at is not null then return false; end if;
 if p_checkout_at is null or p_checkout_at<v.data_visita or p_checkout_at>clock_timestamp() then
  raise exception 'Horário de encerramento inválido.' using errcode='22023'; end if;
 insert into dashboard_private.visit_checkout_events(visit_id,checkout_at,mode,reason,survey_missing,visit_before)
 values(v.id,p_checkout_at,p_mode,p_reason,not dashboard_private.has_visit_survey(v.respostas),to_jsonb(v));
 update public.visitas set checkout_at=p_checkout_at where id=v.id and checkout_at is null;
 return found;
end $$;
revoke all on function dashboard_private.close_visit_recorded_v1(bigint,timestamptz,text,text) from public,anon,authenticated,service_role;

create or replace function dashboard_private.auto_checkout_overdue_visits_v1()
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v public.visitas; boundary timestamptz; closed integer:=0; failed integer:=0; target timestamptz; error_text text;
begin
 if current_user<>'postgres' then raise exception 'Operação reservada à manutenção do banco.' using errcode='42501'; end if;
 if not pg_try_advisory_xact_lock(70261030,1) then return jsonb_build_object('already_running',true); end if;
 boundary:=date_trunc('day',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
 for v in select * from public.visitas where checkout_at is null and data_visita<boundary order by id loop
  target:=((v.data_visita at time zone 'America/Sao_Paulo')::date+1)::timestamp at time zone 'America/Sao_Paulo';
  begin
   if dashboard_private.close_visit_recorded_v1(v.id,target,'automatic','Fechamento automático na virada do dia em America/Sao_Paulo; horário real de saída não informado.') then closed:=closed+1; end if;
  exception when others then
   get stacked diagnostics error_text=message_text;
   insert into dashboard_private.visit_checkout_events(visit_id,checkout_at,mode,reason,survey_missing,successful,error_message,visit_before)
   values(v.id,target,'automatic','Falha no fechamento automático; requer revisão.',not dashboard_private.has_visit_survey(v.respostas),false,error_text,to_jsonb(v));
   failed:=failed+1;
  end;
 end loop;
 return jsonb_build_object('closed',closed,'failed',failed,'timezone','America/Sao_Paulo');
end $$;
revoke all on function dashboard_private.auto_checkout_overdue_visits_v1() from public,anon,authenticated,service_role;

create or replace function dashboard_private.enforce_visit_survey()
returns trigger language plpgsql set search_path = '' as $$
declare
  checking_out boolean;
  survey_changed boolean;
  photos jsonb;
  old_photos jsonb := '[]'::jsonb;
  photo_type text;
  photo_count integer;
  old_count integer;
  photo_limit integer;
begin
  if tg_op = 'INSERT' then
    checking_out := new.checkout_at is not null;
    survey_changed := new.respostas is not null or new.observacao is not null;
  else
    checking_out := new.checkout_at is not null and old.checkout_at is null;
    survey_changed := new.respostas is distinct from old.respostas
      or new.observacao is distinct from old.observacao;
    if jsonb_typeof(old.respostas->'fotos') = 'array' then old_photos := old.respostas->'fotos'; end if;
  end if;
  -- Only a privileged operation with an audit event in this transaction may
  -- close an unanswered visit. Client-controlled JSON or settings cannot bypass this.
  if checking_out and tg_op = 'UPDATE' and current_user = 'postgres' then
    if new.respostas is not distinct from old.respostas and new.observacao is not distinct from old.observacao
      and exists(select 1 from dashboard_private.visit_checkout_events e
        where e.visit_id=new.id and e.checkout_at=new.checkout_at and e.transaction_id=txid_current()
        and e.successful and e.database_actor='postgres') then
      return new;
    end if;
  end if;
  if checking_out and not dashboard_private.has_visit_survey(new.respostas) then
    raise exception 'Salve a pesquisa desta visita antes de fazer o checkout.' using errcode = '23514';
  end if;
  if checking_out or survey_changed then
    photos := case when jsonb_typeof(new.respostas->'fotos') = 'array'
      then new.respostas->'fotos' else '[]'::jsonb end;
    if btrim(coalesce(new.observacao, '')) <> '' and not exists (
      select 1 from jsonb_array_elements(photos) p where coalesce(p->>'url','') <> ''
    ) then
      raise exception 'Anexe pelo menos uma foto para finalizar a pesquisa com observações.' using errcode = '23514';
    end if;
    foreach photo_type in array array['geral','antes','depois'] loop
      photo_limit := case when photo_type = 'geral' then 4 else 2 end;
      select count(*) into photo_count from jsonb_array_elements(photos) p where p->>'tipo' = photo_type;
      select count(*) into old_count from jsonb_array_elements(old_photos) p where p->>'tipo' = photo_type;
      -- Preserve already saved historical photos, without allowing extra attachments.
      if photo_count > greatest(photo_limit, old_count) then
        raise exception 'Limite de % fotos para %.', photo_limit, photo_type using errcode = '23514';
      end if;
    end loop;
  end if;
  return new;
end;
$$;

-- pg_cron is GMT on this project: 03:00 UTC is midnight in Brasilia.
select cron.schedule('auto-checkout-midnight','0 3 * * *','SELECT dashboard_private.auto_checkout_overdue_visits_v1()');
