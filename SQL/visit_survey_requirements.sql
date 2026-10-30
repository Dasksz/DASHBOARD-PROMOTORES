-- Require a saved survey for each checkout; a route flag alone is not a survey.
-- Apply visit_checkout_recovery_v1.sql afterwards for audited midnight/admin exceptions.
create or replace function dashboard_private.has_visit_survey(answers jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(
    answers->>'estado_gondola' in ('Excelente', 'Boa', 'Bagunçada', 'Critica')
    and not exists (
      select 1 from unnest(array['tem_secao','tem_checkout','tem_correlatos_bebidas',
        'tem_correlatos_molho','tem_correlatos_biscoito','tem_ilha','tem_ponto_extra']) k
      where coalesce(answers->>k, '') not in ('Sim','Nao')
    ), false);
$$;

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

revoke all on function dashboard_private.has_visit_survey(jsonb) from public;
revoke all on function dashboard_private.enforce_visit_survey() from public;
grant usage on schema dashboard_private to authenticated, service_role;
grant execute on function dashboard_private.has_visit_survey(jsonb) to authenticated, service_role;
grant execute on function dashboard_private.enforce_visit_survey() to authenticated, service_role;
drop trigger if exists require_visit_survey on public.visitas;
create trigger require_visit_survey before insert or update on public.visitas
for each row execute function dashboard_private.enforce_visit_survey();
