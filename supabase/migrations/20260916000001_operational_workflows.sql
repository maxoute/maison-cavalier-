-- Les références portent le tenant aussi : une ligne autorisée par RLS ne
-- peut pas pointer vers le résident ou le fil d'un autre immeuble.
create unique index residents_id_building_key on public.residents(id, building_id);
create unique index requests_id_building_key on public.service_requests(id, building_id);
create unique index conversations_id_building_key on public.conversations(id, building_id);
create unique index recommendations_id_building_key on public.recommendations(id, building_id);

do $$
declare t text;
begin
  foreach t in array array['conversations', 'parcels', 'pressing_orders', 'recommendation_shares'] loop
    execute format('alter table public.%I add constraint %I foreign key (resident_id, building_id) references public.residents(id, building_id)', t, t || '_resident_tenant');
  end loop;
  foreach t in array array['messages', 'parcels', 'pressing_orders'] loop
    execute format('alter table public.%I add constraint %I foreign key (request_id, building_id) references public.service_requests(id, building_id)', t, t || '_request_tenant');
  end loop;
end;
$$;
alter table public.messages add constraint messages_conversation_tenant foreign key (conversation_id, building_id) references public.conversations(id, building_id);
alter table public.recommendation_shares add constraint shares_conversation_tenant foreign key (conversation_id, building_id) references public.conversations(id, building_id);
alter table public.recommendation_shares add constraint shares_recommendation_tenant foreign key (recommendation_id, building_id) references public.recommendations(id, building_id);
alter table public.pressing_orders add constraint pressing_positive_count check (item_count > 0);

-- Les devis des parties communes n'ont aucune référence vers les devis privés.
create table public.building_documents (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id),
  title text not null check (length(trim(title)) between 1 and 200),
  provider text not null,
  body text not null check (length(trim(body)) between 1 and 10000),
  amount_cents integer check (amount_cents >= 0),
  email_from text not null,
  email_message_id text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (building_id, email_message_id),
  unique (id, building_id)
);
alter table public.building_documents enable row level security;
create policy building_documents_staff on public.building_documents for all
  using (public.staff_of(building_id)) with check (public.staff_of(building_id));
create policy building_documents_syndic_read on public.building_documents for select
  using (public.auth_role() = 'syndic' and building_id = public.auth_building_id());
grant select, insert, update, delete on public.building_documents to authenticated;
grant all on public.building_documents to service_role;
create trigger audit_building_documents after insert or update or delete on public.building_documents
  for each row execute function public.write_audit_log();

-- Historique réservé au staff, aucune adresse de destinataire exposée au syndic.
create table public.building_document_deliveries (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id),
  document_id uuid not null,
  recipient text not null,
  external_id text not null unique,
  simulated boolean not null default true,
  sent_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  foreign key (document_id, building_id) references public.building_documents(id, building_id)
);
alter table public.building_document_deliveries enable row level security;
create policy document_deliveries_read on public.building_document_deliveries for select using (public.staff_of(building_id));
create policy document_deliveries_insert on public.building_document_deliveries for insert with check (public.staff_of(building_id) and sent_by = auth.uid());
grant select, insert on public.building_document_deliveries to authenticated;
grant all on public.building_document_deliveries to service_role;

-- Statut + horodatage + notification simulée sont atomiques. Un échec annule
-- toute la mutation ; un double clic ne génère pas deux notifications.
create function public.operational_transition() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if tg_table_name = 'parcels' then
      if not ((old.status = 'recu' and new.status in ('stocke', 'retourne'))
        or (old.status = 'stocke' and new.status in ('notifie', 'retourne'))
        or (old.status = 'notifie' and new.status in ('remis', 'retourne'))) then
        raise exception 'Transition colis invalide';
      end if;
      if new.status = 'remis' then new.delivered_at = now(); end if;
    else
      if not ((old.status = 'collecte' and new.status = 'chez_le_pressing')
        or (old.status = 'chez_le_pressing' and new.status = 'pret')
        or (old.status = 'pret' and new.status = 'livre')) then
        raise exception 'Transition pressing invalide';
      end if;
      if new.status = 'pret' then new.returned_at = now(); end if;
      if new.status = 'livre' then new.delivered_at = now(); end if;
    end if;
  end if;
  return new;
end;
$$;
create trigger operation_parcel_transition before update on public.parcels for each row execute function public.operational_transition();
create trigger operation_pressing_transition before update on public.pressing_orders for each row execute function public.operational_transition();

create function public.operational_mock_notification() returns trigger language plpgsql set search_path = public as $$
declare event_name text; body_text text; target_channel public.notification_channel;
begin
  if tg_table_name = 'parcels' then
    if tg_op = 'INSERT' then
      event_name := 'colis_recu'; body_text := 'Votre colis est disponible à la conciergerie.';
    elsif new.status = 'notifie' and old.status is distinct from new.status then
      event_name := 'colis_recu'; body_text := 'Votre colis vous attend à la conciergerie.';
    else return new;
    end if;
  elsif tg_table_name = 'pressing_orders' then
    if new.status <> 'pret' or old.status = new.status then return new; end if;
    event_name := 'pressing_pret'; body_text := 'Votre pressing est prêt à être retiré.';
  else
    event_name := 'recommandation_partagee';
    select name || coalesce(' — ' || description, '') || coalesce(' — ' || address, '') || coalesce(' — ' || url, '') into body_text
      from public.recommendations where id = new.recommendation_id and building_id = new.building_id and is_active;
    if body_text is null then raise exception 'Recommandation indisponible'; end if;
  end if;
  foreach target_channel in array case when event_name = 'recommandation_partagee'
    then array['push', 'whatsapp']::public.notification_channel[]
    else array['push', 'whatsapp', 'email']::public.notification_channel[] end loop
    insert into public.notifications(building_id, recipient_resident_id, event, channel, payload)
    values(new.building_id, new.resident_id, event_name, target_channel,
      jsonb_build_object('body', body_text, 'simulated', true, 'operation_id', new.id));
  end loop;
  return new;
end;
$$;
create trigger parcel_mock_notification after insert or update on public.parcels for each row execute function public.operational_mock_notification();
create trigger pressing_mock_notification after update on public.pressing_orders for each row execute function public.operational_mock_notification();
create trigger recommendation_mock_notification after insert on public.recommendation_shares for each row execute function public.operational_mock_notification();
