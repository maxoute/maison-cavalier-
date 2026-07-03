-- ============================================================
-- Maison Cavalier — Schéma initial + RLS multi-tenant (PRD §5, §8)
-- Règle : toute table porte building_id et ses policies RLS
-- dans la même migration.
-- ============================================================

-- ---------- Enums ----------
create type user_role as enum ('concierge', 'admin', 'super_admin', 'syndic', 'resident', 'chauffeur');
create type service_type as enum ('chauffeur', 'pressing', 'colis', 'billetterie', 'personal_shopper');
create type request_status as enum ('nouveau', 'en_cours', 'en_attente', 'termine');
create type request_priority as enum ('normale', 'urgente');
create type quote_status as enum ('en_attente', 'envoye', 'accepte', 'refuse');
create type trip_status as enum ('en_attente_chauffeur', 'acceptee', 'en_route', 'arrivee', 'terminee', 'annulee');
create type notification_channel as enum ('push', 'whatsapp', 'email', 'sms');
create type owner_status as enum ('proprietaire', 'locataire');

-- ---------- Helpers JWT ----------
-- Le rôle et le building_id sont portés par app_metadata du JWT.
-- app_metadata n'est modifiable que par la clé service-role (jamais par le client).
create or replace function public.auth_role()
returns user_role
language sql stable
as $$
  select (nullif(auth.jwt() -> 'app_metadata' ->> 'role', ''))::user_role
$$;

create or replace function public.auth_building_id()
returns uuid
language sql stable
as $$
  select (nullif(auth.jwt() -> 'app_metadata' ->> 'building_id', ''))::uuid
$$;

create or replace function public.is_staff()
returns boolean
language sql stable
as $$
  select public.auth_role() in ('concierge', 'admin', 'super_admin')
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable
as $$
  select public.auth_role() = 'super_admin'
$$;

-- Staff de l'immeuble : concierge/admin du bon tenant, ou super_admin partout
create or replace function public.staff_of(b_id uuid)
returns boolean
language sql stable
as $$
  select public.is_super_admin()
      or (public.auth_role() in ('concierge', 'admin') and public.auth_building_id() = b_id)
$$;

-- ---------- Tables ----------

create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  b2b_plan text,
  enabled_services service_type[] not null default '{chauffeur,pressing,colis,billetterie,personal_shopper}',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  building_id uuid not null references public.buildings (id),
  role user_role not null,
  full_name text not null,
  phone text,
  preferences jsonb not null default '{}',
  loyalty_points integer not null default 0,
  created_at timestamptz not null default now()
);
create index on public.profiles (building_id);

-- Fiche CRM résident (PRD §6.1.5) — distincte du compte app mobile
create table public.residents (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id),
  profile_id uuid references public.profiles (id),
  full_name text not null,
  email text,
  phone text,
  floor text,
  unit text,
  owner_status owner_status not null default 'proprietaire',
  preferences text,
  special_access text,
  internal_notes text,
  satisfaction_score numeric(3, 2),
  created_at timestamptz not null default now()
);
create index on public.residents (building_id);

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id),
  resident_id uuid not null references public.residents (id),
  service service_type not null,
  status request_status not null default 'nouveau',
  priority request_priority not null default 'normale',
  payload jsonb not null default '{}',
  amount_cents integer,
  sla_deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.service_requests (building_id, status);

create table public.driver_trips (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id),
  request_id uuid not null references public.service_requests (id),
  driver_profile_id uuid references public.profiles (id),
  vehicle text,
  status trip_status not null default 'en_attente_chauffeur',
  origin text,
  destination text,
  last_lat double precision,
  last_lng double precision,
  eta timestamptz,
  commission_cents integer,
  created_at timestamptz not null default now()
);
create index on public.driver_trips (building_id, status);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id),
  resident_id uuid not null references public.residents (id),
  request_id uuid references public.service_requests (id),
  provider text not null,
  label text not null,
  amount_cents integer not null,
  status quote_status not null default 'en_attente',
  pdf_path text,
  created_at timestamptz not null default now()
);
create index on public.quotes (building_id, status);

-- Canal concierge <-> syndic (PRD §6.1.8) — historisé, jamais modifié
create table public.syndic_messages (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id),
  sender_profile_id uuid not null references public.profiles (id),
  body text not null,
  attachments text[] not null default '{}',
  is_incident boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.syndic_messages (building_id, created_at);

-- Journal immuable des actions sensibles (PRD §9)
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.audit_logs (building_id, created_at);

-- Historisation des notifications multicanal (PRD §7.3)
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id),
  recipient_resident_id uuid references public.residents (id),
  recipient_profile_id uuid references public.profiles (id),
  event text not null,
  channel notification_channel not null,
  payload jsonb not null default '{}',
  sent_at timestamptz not null default now()
);
create index on public.notifications (building_id, sent_at);

-- ---------- updated_at automatique ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger service_requests_updated_at
  before update on public.service_requests
  for each row execute function public.set_updated_at();

-- ---------- Audit trail (triggers sur tables sensibles) ----------
create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  rec record;
begin
  rec := coalesce(new, old);
  insert into public.audit_logs (building_id, actor_id, action, entity, entity_id, details)
  values (
    rec.building_id,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    rec.id,
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_residents
  after insert or update or delete on public.residents
  for each row execute function public.write_audit_log();
create trigger audit_quotes
  after insert or update or delete on public.quotes
  for each row execute function public.write_audit_log();
create trigger audit_service_requests
  after insert or update or delete on public.service_requests
  for each row execute function public.write_audit_log();

-- Immutabilité du journal : aucun UPDATE/DELETE, même par le propriétaire
create or replace function public.reject_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_logs est immuable';
end;
$$;

create trigger audit_logs_immutable
  before update or delete on public.audit_logs
  for each row execute function public.reject_mutation();

-- ============================================================
-- RLS — isolation tenant imposée en base (PRD §5)
-- Par défaut : tout est refusé ; chaque accès est ouvert par policy.
-- Le syndic n'a AUCUNE policy sur residents / service_requests /
-- quotes / driver_trips / notifications => accès refusé (PRD §4).
-- ============================================================

alter table public.buildings enable row level security;
alter table public.profiles enable row level security;
alter table public.residents enable row level security;
alter table public.service_requests enable row level security;
alter table public.driver_trips enable row level security;
alter table public.quotes enable row level security;
alter table public.syndic_messages enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;

-- buildings : chaque membre voit son immeuble ; super_admin voit tout
create policy buildings_select on public.buildings
  for select using (id = public.auth_building_id() or public.is_super_admin());

-- profiles : chacun lit son profil ; le staff lit les profils de son immeuble
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());
create policy profiles_select_staff on public.profiles
  for select using (public.staff_of(building_id));
-- Le syndic voit les profils du staff de son immeuble (pour nommer ses
-- interlocuteurs en messagerie) — jamais les profils résidents/chauffeurs.
create policy profiles_select_syndic_staff on public.profiles
  for select using (
    public.auth_role() = 'syndic'
    and building_id = public.auth_building_id()
    and role in ('concierge', 'admin', 'super_admin')
  );
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and building_id = public.auth_building_id() and role = public.auth_role());

-- residents : staff de l'immeuble uniquement (syndic exclu, PRD §4)
create policy residents_staff on public.residents
  for all using (public.staff_of(building_id))
  with check (public.staff_of(building_id));

-- service_requests : staff ; le résident (app mobile) voit les siennes
create policy service_requests_staff on public.service_requests
  for all using (public.staff_of(building_id))
  with check (public.staff_of(building_id));
create policy service_requests_resident on public.service_requests
  for select using (
    public.auth_role() = 'resident'
    and building_id = public.auth_building_id()
    and resident_id in (select id from public.residents where profile_id = auth.uid())
  );

-- driver_trips : staff ; le chauffeur voit/actualise ses courses
create policy driver_trips_staff on public.driver_trips
  for all using (public.staff_of(building_id))
  with check (public.staff_of(building_id));
create policy driver_trips_driver_select on public.driver_trips
  for select using (public.auth_role() = 'chauffeur' and driver_profile_id = auth.uid());
create policy driver_trips_driver_update on public.driver_trips
  for update using (public.auth_role() = 'chauffeur' and driver_profile_id = auth.uid())
  with check (driver_profile_id = auth.uid() and building_id = public.auth_building_id());

-- quotes : staff uniquement côté web (le résident y accédera via l'app mobile)
create policy quotes_staff on public.quotes
  for all using (public.staff_of(building_id))
  with check (public.staff_of(building_id));

-- syndic_messages : staff + syndic de l'immeuble, lecture et écriture, jamais de modification
create policy syndic_messages_select on public.syndic_messages
  for select using (
    public.staff_of(building_id)
    or (public.auth_role() = 'syndic' and building_id = public.auth_building_id())
  );
create policy syndic_messages_insert on public.syndic_messages
  for insert with check (
    sender_profile_id = auth.uid()
    and (
      public.staff_of(building_id)
      or (public.auth_role() = 'syndic' and building_id = public.auth_building_id())
    )
  );

-- audit_logs : lecture admin/super_admin ; écriture uniquement par triggers (security definer)
create policy audit_logs_select on public.audit_logs
  for select using (
    public.is_super_admin()
    or (public.auth_role() = 'admin' and building_id = public.auth_building_id())
  );

-- notifications : staff de l'immeuble (consultation d'audit) ; écriture côté serveur
create policy notifications_staff_select on public.notifications
  for select using (public.staff_of(building_id));
create policy notifications_staff_insert on public.notifications
  for insert with check (public.staff_of(building_id));

-- ============================================================
-- Grants — moindre privilège : les privilèges table sont ouverts
-- au rôle authenticated, la RLS fait le filtrage fin.
-- audit_logs : jamais d'UPDATE/DELETE, même pour service_role.
-- ============================================================

grant usage on schema public to anon, authenticated, service_role;

grant select on public.buildings to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.residents to authenticated;
grant select, insert, update, delete on public.service_requests to authenticated;
grant select, insert, update, delete on public.driver_trips to authenticated;
grant select, insert, update, delete on public.quotes to authenticated;
grant select, insert on public.syndic_messages to authenticated;
grant select on public.audit_logs to authenticated;
grant select, insert on public.notifications to authenticated;

grant all on all tables in schema public to service_role;
revoke update, delete on public.audit_logs from service_role;

grant execute on all functions in schema public to authenticated, service_role;
