create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id),
  created_by uuid not null references public.profiles(id),
  title text not null check (length(trim(title)) between 1 and 200),
  body text not null check (length(trim(body)) between 1 and 4000),
  target_floor text check (target_floor is null or length(trim(target_floor)) between 1 and 100),
  target_owner_status public.owner_status,
  urgent boolean not null default false,
  recipient_count integer not null default 0,
  channels public.notification_channel[] not null default '{push,email}',
  simulated boolean not null default true check (simulated),
  created_at timestamptz not null default now()
);
create index announcements_building_created on public.announcements(building_id, created_at);
alter table public.announcements enable row level security;
create policy announcements_staff_read on public.announcements for select
  using (public.staff_of(building_id));
create policy announcements_staff_insert on public.announcements for insert
  with check (public.staff_of(building_id) and created_by = auth.uid());
grant select, insert on public.announcements to authenticated;
grant select, insert on public.announcements to service_role;

-- Audience figée au moment de la diffusion et notifications atomiques.
-- Les fonctions restent SECURITY INVOKER : les policies des résidents et
-- notifications s'appliquent également pendant l'exécution des triggers.
create function public.prepare_announcement() returns trigger
language plpgsql set search_path = public as $$
begin
  new.channels := case when new.urgent then array['push','whatsapp','email','sms']::public.notification_channel[]
    else array['push','email']::public.notification_channel[] end;
  select count(*) into new.recipient_count from public.residents
    where building_id = new.building_id
      and (new.target_floor is null or floor = new.target_floor)
      and (new.target_owner_status is null or owner_status = new.target_owner_status);
  if new.recipient_count = 0 then
    raise exception 'Aucun résident ne correspond à cette audience' using errcode = '23514';
  end if;
  new.simulated := true;
  return new;
end;
$$;
create function public.notify_announcement() returns trigger
language plpgsql set search_path = public as $$
begin
  insert into public.notifications(building_id, recipient_resident_id, event, channel, payload)
  select new.building_id, r.id,
    case when new.urgent then 'annonce_urgente' else 'annonce_immeuble' end,
    c.channel, jsonb_build_object('announcement_id', new.id, 'title', new.title, 'body', new.body, 'simulated', true)
  from public.residents r cross join unnest(new.channels) as c(channel)
  where r.building_id = new.building_id
    and (new.target_floor is null or r.floor = new.target_floor)
    and (new.target_owner_status is null or r.owner_status = new.target_owner_status);
  return new;
end;
$$;
create trigger prepare_announcement before insert on public.announcements
  for each row execute function public.prepare_announcement();
create trigger notify_announcement after insert on public.announcements
  for each row execute function public.notify_announcement();
create trigger audit_announcements after insert on public.announcements
  for each row execute function public.write_audit_log();
