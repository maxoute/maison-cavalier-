-- ============================================================
-- Maison Cavalier — Opérationnel : chat WhatsApp, colis, pressing,
-- recommandations, devis reçus par e-mail.
-- PRD §6.1.4 (Pressing & Colis), §6.1.5 (CRM), §6.1.6 (Devis),
-- §6.1.8 (Syndic), §7.3 (Notifications), Annexe A.
--
-- Règle non négociable : toute table porte `building_id` et ses policies
-- RLS dans cette même migration. Le syndic n'obtient AUCUNE policy sur ces
-- tables — elles portent toutes des données résident (PRD §4).
-- ============================================================

-- ---------- Enums ----------
-- Le chat opérationnel passe aujourd'hui par WhatsApp Business ; `app` et
-- `sms` sont prévus pour ne pas avoir à migrer l'enum plus tard (ALTER TYPE
-- ADD VALUE ne peut pas être utilisé dans la transaction qui le crée).
create type conversation_channel as enum ('whatsapp', 'app', 'sms');
create type conversation_status as enum ('ouverte', 'en_attente', 'resolue');
create type message_direction as enum ('entrant', 'sortant');
create type message_delivery_status as enum ('en_attente', 'envoye', 'livre', 'lu', 'echec');
create type parcel_status as enum ('recu', 'stocke', 'notifie', 'remis', 'retourne');
create type pressing_status as enum ('collecte', 'chez_le_pressing', 'pret', 'livre');
create type recommendation_category as enum ('restaurant', 'artisan', 'bien_etre', 'culture', 'transport', 'shopping', 'autre');
create type recommendation_share_status as enum ('proposee', 'consultee', 'reservee', 'refusee');
create type quote_source as enum ('manuel', 'email');

-- ============================================================
-- 1. Chat opérationnel résident ↔ conciergerie (canal WhatsApp)
-- Distinct de la messagerie syndic (`syndic_messages`, PRD §6.1.8) :
-- ni les mêmes interlocuteurs, ni les mêmes droits.
-- ============================================================

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id),
  resident_id uuid not null references public.residents (id) on delete cascade,
  channel conversation_channel not null default 'whatsapp',
  -- Identifiant du fil chez le provider (wa_id) : permet de rattacher un
  -- webhook entrant au bon résident sans dépendre du numéro affiché.
  external_thread_id text,
  status conversation_status not null default 'ouverte',
  -- Le concierge nommé qui suit le fil (PRD §1 : « l'humain incarne »).
  assigned_profile_id uuid references public.profiles (id) on delete set null,
  last_message_at timestamptz,
  -- Horodatage de dernière lecture côté loge : alimente le badge « non lus ».
  last_read_at timestamptz,
  created_at timestamptz not null default now()
);
-- Un seul fil par résident et par canal.
create unique index conversations_resident_channel_key
  on public.conversations (resident_id, channel);
create index on public.conversations (building_id, status, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  direction message_direction not null,
  -- Sortant : le membre du staff qui répond. Entrant : null, l'auteur est
  -- le résident propriétaire du fil.
  sender_profile_id uuid references public.profiles (id) on delete set null,
  body text not null,
  attachments text[] not null default '{}',
  -- Id du message chez le provider : rejouer un webhook ne duplique rien.
  external_message_id text,
  delivery_status message_delivery_status not null default 'envoye',
  -- Demande créée depuis ce message : traçabilité chat → opération.
  request_id uuid references public.service_requests (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint messages_sender_matches_direction check (
    (direction = 'sortant' and sender_profile_id is not null)
    or (direction = 'entrant' and sender_profile_id is null)
  )
);
create unique index messages_external_id_key
  on public.messages (building_id, external_message_id)
  where external_message_id is not null;
create index on public.messages (conversation_id, created_at);

-- ============================================================
-- 2. Colis (PRD §6.1.4)
-- ============================================================

create table public.parcels (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id),
  resident_id uuid not null references public.residents (id),
  request_id uuid references public.service_requests (id) on delete set null,
  carrier text,
  -- Scan QR depuis la tablette ou saisie manuelle (PRD §6.1.4).
  tracking_code text,
  status parcel_status not null default 'recu',
  storage_location text,
  -- Photo prise à la réception : preuve en cas de litige (PRD §6.1.4).
  photo_path text,
  received_at timestamptz not null default now(),
  -- Créneau du planning de livraison groupée.
  scheduled_delivery_at timestamptz,
  delivered_at timestamptz,
  -- Rappel « colis non retiré » J+2 (PRD Annexe A) : non nul = déjà envoyé.
  reminder_sent_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.parcels (building_id, status, received_at desc);
create index on public.parcels (resident_id);

-- ============================================================
-- 3. Pressing (PRD §6.1.4)
-- ============================================================

create table public.pressing_orders (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id),
  resident_id uuid not null references public.residents (id),
  request_id uuid references public.service_requests (id) on delete set null,
  provider text,
  -- Étapes parcourues en un clic depuis le cockpit (PRD §6.1.4).
  status pressing_status not null default 'collecte',
  -- [{ "label": "Costume 2 pièces", "quantity": 1 }, …]
  items jsonb not null default '[]',
  item_count integer not null default 0,
  amount_cents integer,
  collected_at timestamptz not null default now(),
  expected_return_at timestamptz,
  returned_at timestamptz,
  delivered_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.pressing_orders (building_id, status, collected_at desc);
create index on public.pressing_orders (resident_id);

-- ============================================================
-- 4. Recommandations : catalogue de l'immeuble + suivi des envois
-- ============================================================

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id),
  category recommendation_category not null default 'autre',
  name text not null,
  description text,
  address text,
  phone text,
  url text,
  -- Partenaire référencé : commission Maison Cavalier (PRD §7.2, §6.3.4).
  is_partner boolean not null default false,
  commission_rate numeric(5, 2),
  rating numeric(3, 2),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.recommendations (building_id, category) where is_active;

-- Une recommandation envoyée à un résident, et ce qu'elle est devenue :
-- c'est cette table qui fait du catalogue un « système » mesurable.
create table public.recommendation_shares (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id),
  recommendation_id uuid not null references public.recommendations (id) on delete cascade,
  resident_id uuid not null references public.residents (id) on delete cascade,
  shared_by_profile_id uuid references public.profiles (id) on delete set null,
  -- Fil WhatsApp par lequel elle a été envoyée, quand il y en a un.
  conversation_id uuid references public.conversations (id) on delete set null,
  channel notification_channel not null default 'whatsapp',
  status recommendation_share_status not null default 'proposee',
  feedback text,
  created_at timestamptz not null default now()
);
create index on public.recommendation_shares (building_id, created_at desc);
create index on public.recommendation_shares (recommendation_id, status);
create index on public.recommendation_shares (resident_id);

-- ============================================================
-- 5. Devis reçus par e-mail (PRD §6.1.6)
-- Un devis prestataire arrive par mail avant d'être rattaché à un résident :
-- `resident_id` et `amount_cents` deviennent donc facultatifs, le temps que
-- le concierge qualifie la pièce.
-- ============================================================

alter table public.quotes
  add column source quote_source not null default 'manuel',
  add column email_from text,
  add column email_subject text,
  add column email_received_at timestamptz,
  -- Message-Id RFC 5322 : garantit qu'un mail relu ne crée pas un doublon.
  add column email_message_id text,
  add column attachment_path text;

alter table public.quotes alter column resident_id drop not null;
alter table public.quotes alter column amount_cents drop not null;

alter table public.quotes add constraint quotes_email_source_check check (
  source <> 'email' or email_received_at is not null
);

create unique index quotes_email_message_id_key
  on public.quotes (building_id, email_message_id)
  where email_message_id is not null;

-- ============================================================
-- 6. Triggers
-- ============================================================

create trigger parcels_updated_at
  before update on public.parcels
  for each row execute function public.set_updated_at();

create trigger pressing_orders_updated_at
  before update on public.pressing_orders
  for each row execute function public.set_updated_at();

-- Le fil remonte en tête de liste dès qu'un message y arrive, et repasse
-- « ouverte » sur un message entrant : la loge ne peut pas rater une réponse.
create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.conversations
     set last_message_at = new.created_at,
         status = case when new.direction = 'entrant' then 'ouverte' else status end
   where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation();

-- Journal immuable sur les tables porteuses d'engagement (PRD §9).
-- `messages` en est exclu volontairement : volume élevé, et le fil est
-- lui-même l'historique.
create trigger audit_parcels
  after insert or update or delete on public.parcels
  for each row execute function public.write_audit_log();
create trigger audit_pressing_orders
  after insert or update or delete on public.pressing_orders
  for each row execute function public.write_audit_log();

-- ============================================================
-- 7. RLS — isolation tenant imposée en base (PRD §5)
-- Staff de l'immeuble en lecture/écriture ; résident en lecture sur ses
-- propres lignes (contrat app mobile, PRD Annexe B) ; syndic exclu.
-- ============================================================

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.parcels enable row level security;
alter table public.pressing_orders enable row level security;
alter table public.recommendations enable row level security;
alter table public.recommendation_shares enable row level security;

-- « Cette fiche résident est-elle la mienne ? »
--
-- SECURITY DEFINER est indispensable : une sous-requête écrite directement
-- dans une policy est elle-même soumise à la RLS de la table lue. Comme le
-- résident n'a aucune policy de lecture sur `residents`, un
-- `resident_id in (select id from residents where profile_id = auth.uid())`
-- ne renvoie jamais rien et la policy est muette. La fonction ne divulgue
-- qu'un booléen sur la propre fiche de l'appelant.
create or replace function public.is_own_resident(r_id uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select public.auth_role() = 'resident'
     and exists (
       select 1 from public.residents r
        where r.id = r_id
          and r.profile_id = auth.uid()
          and r.building_id = public.auth_building_id()
     )
$$;

-- Même correction sur la policy résident posée par la migration initiale :
-- elle portait la sous-requête en clair et ne laissait donc rien passer.
drop policy service_requests_resident on public.service_requests;
create policy service_requests_resident on public.service_requests
  for select using (public.is_own_resident(resident_id));

-- conversations
create policy conversations_staff on public.conversations
  for all using (public.staff_of(building_id))
  with check (public.staff_of(building_id));
create policy conversations_resident_select on public.conversations
  for select using (public.is_own_resident(resident_id));

-- messages
create policy messages_staff on public.messages
  for all using (public.staff_of(building_id))
  with check (public.staff_of(building_id));
create policy messages_resident_select on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
       where c.id = conversation_id
         and public.is_own_resident(c.resident_id)
    )
  );

-- parcels
create policy parcels_staff on public.parcels
  for all using (public.staff_of(building_id))
  with check (public.staff_of(building_id));
create policy parcels_resident_select on public.parcels
  for select using (public.is_own_resident(resident_id));

-- pressing_orders
create policy pressing_orders_staff on public.pressing_orders
  for all using (public.staff_of(building_id))
  with check (public.staff_of(building_id));
create policy pressing_orders_resident_select on public.pressing_orders
  for select using (public.is_own_resident(resident_id));

-- recommendations : catalogue de l'immeuble, lisible par le résident quand
-- la fiche est active ; seul le staff l'alimente.
create policy recommendations_staff on public.recommendations
  for all using (public.staff_of(building_id))
  with check (public.staff_of(building_id));
create policy recommendations_resident_select on public.recommendations
  for select using (
    public.auth_role() = 'resident'
    and building_id = public.auth_building_id()
    and is_active
  );

-- recommendation_shares
create policy recommendation_shares_staff on public.recommendation_shares
  for all using (public.staff_of(building_id))
  with check (public.staff_of(building_id));
create policy recommendation_shares_resident_select on public.recommendation_shares
  for select using (public.is_own_resident(resident_id));

-- ============================================================
-- 8. Grants — la RLS fait le filtrage fin (PRD §5)
-- ============================================================

grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert, update, delete on public.messages to authenticated;
grant select, insert, update, delete on public.parcels to authenticated;
grant select, insert, update, delete on public.pressing_orders to authenticated;
grant select, insert, update, delete on public.recommendations to authenticated;
grant select, insert, update, delete on public.recommendation_shares to authenticated;

grant all on public.conversations to service_role;
grant all on public.messages to service_role;
grant all on public.parcels to service_role;
grant all on public.pressing_orders to service_role;
grant all on public.recommendations to service_role;
grant all on public.recommendation_shares to service_role;

grant execute on function public.is_own_resident(uuid) to authenticated, service_role;
grant execute on function public.touch_conversation() to authenticated, service_role;
