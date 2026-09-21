-- ============================================================
-- Catalogue de services, tarifs et commissions par immeuble
-- (PRD §6.3.2 « configuration par immeuble », §6.3.4).
-- Toute table porte building_id et ses policies dans cette migration.
-- ============================================================

create type pricing_unit as enum ('fixe', 'km', 'heure');

-- Gestionnaire de l'immeuble : seul habilité à changer tarifs et commissions.
-- Le concierge lit le catalogue (devis, demandes) mais ne le modifie pas.
create or replace function public.manages(b_id uuid)
returns boolean language sql stable as $$
  select public.is_super_admin()
      or (public.auth_role() = 'admin' and public.auth_building_id() = b_id)
$$;

create table public.building_services (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id),
  service service_type not null,
  enabled boolean not null default true,
  pricing_unit pricing_unit not null default 'fixe',
  base_price_cents integer not null default 0 check (base_price_cents between 0 and 100000000),
  commission_rate numeric(5,2) not null default 0 check (commission_rate between 0 and 100),
  partner_name text check (partner_name is null or length(trim(partner_name)) between 1 and 200),
  sla_minutes integer check (sla_minutes is null or sla_minutes between 5 and 10080),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (building_id, service)
);
create index building_services_building on public.building_services(building_id);

-- Modèles de notification personnalisables par immeuble (PRD §6.3.4).
-- Sans modèle enregistré, les portails retombent sur les modèles intégrés.
create table public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id),
  slug text not null check (slug ~ '^[a-z0-9_]{2,40}$'),
  label text not null check (length(trim(label)) between 1 and 80),
  title text not null check (length(trim(title)) between 1 and 200),
  body text not null check (length(trim(body)) between 1 and 4000),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (building_id, slug)
);
create index notification_templates_building on public.notification_templates(building_id);

create trigger building_services_updated_at before update on public.building_services
  for each row execute function public.set_updated_at();
create trigger notification_templates_updated_at before update on public.notification_templates
  for each row execute function public.set_updated_at();

-- ---------- Catalogue par défaut à la création d'un immeuble ----------
-- L'onboarding (PRD §6.3.2) ne demande que le nom, l'adresse et les services
-- actifs : la grille tarifaire est provisionnée ici, puis ajustée par immeuble.
create function public.default_service_catalog()
returns table (
  service service_type, pricing_unit pricing_unit,
  base_price_cents integer, commission_rate numeric(5,2), sla_minutes integer
)
language sql immutable as $$
  values
    ('chauffeur'::service_type,        'km'::pricing_unit,    250,  15.00::numeric(5,2),   30),
    ('pressing'::service_type,         'fixe'::pricing_unit, 1500,  20.00::numeric(5,2), 1440),
    ('colis'::service_type,            'fixe'::pricing_unit,    0,   0.00::numeric(5,2),  120),
    ('billetterie'::service_type,      'fixe'::pricing_unit,    0,  10.00::numeric(5,2),  720),
    ('personal_shopper'::service_type, 'heure'::pricing_unit, 6000, 20.00::numeric(5,2), 2880)
$$;

-- SECURITY DEFINER : la création d'un immeuble passe par la clé service-role,
-- mais le provisionnement doit aussi aboutir si la table est protégée par RLS.
create function public.provision_building_services() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.building_services
    (building_id, service, enabled, pricing_unit, base_price_cents, commission_rate, sla_minutes)
  select new.id, d.service, d.service = any(new.enabled_services),
         d.pricing_unit, d.base_price_cents, d.commission_rate, d.sla_minutes
  from public.default_service_catalog() d
  on conflict (building_id, service) do nothing;
  return new;
end;
$$;
create trigger provision_building_services after insert on public.buildings
  for each row execute function public.provision_building_services();

-- buildings.enabled_services reste la source lue par les portails : elle est
-- recalculée depuis le catalogue pour qu'il n'existe qu'une seule vérité.
create function public.sync_enabled_services() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  b_id uuid := coalesce(new.building_id, old.building_id);
begin
  update public.buildings b
     set enabled_services = coalesce((
       select array_agg(s.service order by s.service)
         from public.building_services s
        where s.building_id = b_id and s.enabled), '{}')
   where b.id = b_id;
  return coalesce(new, old);
end;
$$;
create trigger sync_enabled_services after insert or update or delete on public.building_services
  for each row execute function public.sync_enabled_services();

-- Un service désactivé n'accepte plus de nouvelle demande, même par URL directe.
create function public.check_service_enabled() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.building_services s
     where s.building_id = new.building_id and s.service = new.service and s.enabled
  ) then
    raise exception 'Service désactivé pour cet immeuble' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger request_service_enabled before insert on public.service_requests
  for each row execute function public.check_service_enabled();

create trigger audit_building_services
  after insert or update or delete on public.building_services
  for each row execute function public.write_audit_log();
create trigger audit_notification_templates
  after insert or update or delete on public.notification_templates
  for each row execute function public.write_audit_log();

-- ---------- RLS ----------
alter table public.building_services enable row level security;
alter table public.notification_templates enable row level security;

-- Lecture : staff de l'immeuble (le syndic n'a aucune policy, PRD §4).
create policy building_services_staff_read on public.building_services
  for select using (public.staff_of(building_id));
create policy building_services_manage_insert on public.building_services
  for insert with check (public.manages(building_id));
create policy building_services_manage_update on public.building_services
  for update using (public.manages(building_id))
  with check (public.manages(building_id));

create policy notification_templates_staff_read on public.notification_templates
  for select using (public.staff_of(building_id));
create policy notification_templates_manage on public.notification_templates
  for all using (public.manages(building_id))
  with check (public.manages(building_id));

-- Le catalogue n'est pas supprimable : un service se désactive (enabled=false),
-- ce qui conserve l'historique tarifaire et les commissions déjà appliquées.
grant select, insert, update on public.building_services to authenticated;
grant select, insert, update, delete on public.notification_templates to authenticated;
grant all on public.building_services to service_role;
grant all on public.notification_templates to service_role;

-- ---------- Reprise de l'existant ----------
insert into public.building_services
  (building_id, service, enabled, pricing_unit, base_price_cents, commission_rate, sla_minutes)
select b.id, d.service, d.service = any(b.enabled_services),
       d.pricing_unit, d.base_price_cents, d.commission_rate, d.sla_minutes
from public.buildings b cross join public.default_service_catalog() d
on conflict (building_id, service) do nothing;
