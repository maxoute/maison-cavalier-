alter table public.service_requests
  add column assigned_provider text check (assigned_provider is null or length(trim(assigned_provider)) between 1 and 200),
  add column estimated_completion_at timestamptz,
  add column started_at timestamptz;

create table public.intervention_incidents (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id),
  request_id uuid not null,
  reported_by uuid not null references public.profiles(id),
  kind text not null check (kind in ('retard', 'article_manquant', 'plainte', 'technique', 'autre')),
  severity text not null check (severity in ('standard', 'grave')),
  description text not null check (length(trim(description)) between 1 and 4000),
  resolution text check (resolution is null or length(trim(resolution)) between 1 and 4000),
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (request_id, building_id) references public.service_requests(id, building_id)
);
create index incidents_request on public.intervention_incidents(building_id, request_id);
alter table public.intervention_incidents enable row level security;
create policy incidents_staff_read on public.intervention_incidents for select using (public.staff_of(building_id));
create policy incidents_staff_insert on public.intervention_incidents for insert
  with check (public.staff_of(building_id) and reported_by = auth.uid());
create policy incidents_staff_resolve on public.intervention_incidents for update
  using (public.staff_of(building_id)) with check (public.staff_of(building_id) and resolved_by = auth.uid());
grant select, insert, update on public.intervention_incidents to authenticated, service_role;

create function public.guard_intervention_incident() returns trigger
language plpgsql set search_path = public as $$
declare request_state public.request_status;
begin
  if tg_op = 'INSERT' then
    -- Le verrou sérialise signalement et clôture d'une même intervention.
    select status into request_state from public.service_requests
      where id = new.request_id and building_id = new.building_id for update;
    if not found then raise exception 'Intervention inaccessible' using errcode = '23503'; end if;
    if request_state = 'termine' then raise exception 'Intervention déjà clôturée' using errcode = '23514'; end if;
    new.created_at := now();
    new.resolution := null; new.resolved_by := null; new.resolved_at := null;
  else
    if row(new.id, new.building_id, new.request_id, new.reported_by, new.kind, new.severity, new.description, new.created_at)
      is distinct from row(old.id, old.building_id, old.request_id, old.reported_by, old.kind, old.severity, old.description, old.created_at)
      or old.resolved_at is not null or new.resolution is null or length(trim(new.resolution)) = 0 then
      raise exception 'Seule la résolution d’un incident ouvert est autorisée' using errcode = '23514';
    end if;
    new.resolved_at := now(); new.resolved_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger guard_intervention_incident before insert or update on public.intervention_incidents
  for each row execute function public.guard_intervention_incident();

create function public.escalate_intervention_incident() returns trigger
language plpgsql set search_path = public as $$
declare public_body text := 'Incident grave signalé par la conciergerie. Une décision de la copropriété peut être nécessaire. Merci de contacter votre concierge dans ce fil.';
begin
  if new.severity = 'grave' then
    -- Aucun identifiant de demande, détail du service ou contenu libre privé.
    insert into public.syndic_messages(building_id, sender_profile_id, body, is_incident)
      values(new.building_id, new.reported_by, public_body, true);
    insert into public.notifications(building_id, recipient_profile_id, event, channel, payload)
      select new.building_id, p.id, 'incident_grave', c.channel,
        jsonb_build_object('title', 'Incident grave dans votre immeuble', 'body', public_body, 'simulated', true)
      from public.profiles p cross join unnest(array['push','email']::public.notification_channel[]) c(channel)
      where p.building_id = new.building_id and p.role = 'syndic';
  end if;
  return new;
end;
$$;
create trigger escalate_intervention_incident after insert on public.intervention_incidents
  for each row execute function public.escalate_intervention_incident();
create trigger audit_intervention_incidents after insert or update on public.intervention_incidents
  for each row execute function public.write_audit_log();

create or replace function public.check_request_transition() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if current_user = 'authenticated' and new.status <> 'nouveau' then
      raise exception 'Une demande doit commencer au statut nouveau' using errcode = '23514';
    end if;
    new.completed_at := null; new.started_at := null;
  else
    new.started_at := old.started_at;
    if new.status is distinct from old.status then
      if not ((old.status = 'nouveau' and new.status in ('en_cours', 'en_attente'))
        or (old.status = 'en_cours' and new.status in ('en_attente', 'termine'))
        or (old.status = 'en_attente' and new.status = 'en_cours')) then
        raise exception 'Transition de demande invalide' using errcode = '23514';
      end if;
      if new.status = 'termine' and exists(select 1 from public.intervention_incidents where request_id = old.id and building_id = old.building_id and resolved_at is null) then
        raise exception 'Résolvez les incidents avant de valider la réalisation' using errcode = '23514';
      end if;
      if new.status = 'en_cours' then new.started_at := coalesce(old.started_at, now()); end if;
      new.completed_at := case when new.status = 'termine' then now() else null end;
    else
      new.completed_at := old.completed_at;
    end if;
    if old.status = 'termine' and row(new.assigned_provider, new.estimated_completion_at)
      is distinct from row(old.assigned_provider, old.estimated_completion_at) then
      raise exception 'Intervention clôturée' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
