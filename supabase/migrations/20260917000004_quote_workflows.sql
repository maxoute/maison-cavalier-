create unique index requests_resident_building_key on public.service_requests(id, resident_id, building_id);
alter table public.quotes
  add constraint quotes_resident_tenant foreign key (resident_id, building_id) references public.residents(id, building_id),
  add constraint quotes_request_tenant foreign key (request_id, building_id) references public.service_requests(id, building_id),
  add constraint quotes_request_resident foreign key (request_id, resident_id, building_id) references public.service_requests(id, resident_id, building_id),
  add constraint quotes_request_has_resident check (request_id is null or resident_id is not null),
  add constraint quotes_positive_amount check (amount_cents is null or amount_cents >= 0),
  add column sent_at timestamptz,
  add column decided_at timestamptz,
  add column updated_at timestamptz not null default now(),
  add column document_snapshot jsonb;

create function public.guard_quote_workflow() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'en_attente' then raise exception 'Un devis envoyé reste archivé' using errcode = '23514'; end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if current_user = 'authenticated' and new.status <> 'en_attente' then
      raise exception 'Un devis doit commencer en attente' using errcode = '23514';
    end if;
    new.document_snapshot := null; new.sent_at := null; new.decided_at := null;
  else
    if row(new.id, new.building_id, new.created_at) is distinct from row(old.id, old.building_id, old.created_at) then
      raise exception 'Identité du devis immuable' using errcode = '23514';
    end if;
    if old.status <> 'en_attente' and row(new.resident_id, new.request_id, new.provider, new.label, new.amount_cents)
      is distinct from row(old.resident_id, old.request_id, old.provider, old.label, old.amount_cents) then
      raise exception 'Le contenu d’un devis envoyé est figé' using errcode = '23514';
    end if;
    new.sent_at := old.sent_at; new.decided_at := old.decided_at; new.document_snapshot := old.document_snapshot;
    if new.status is distinct from old.status then
      if not ((old.status = 'en_attente' and new.status = 'envoye') or (old.status = 'envoye' and new.status in ('accepte','refuse'))) then
        raise exception 'Transition de devis invalide' using errcode = '23514';
      end if;
      if new.status = 'envoye' then
        if new.resident_id is null or new.amount_cents is null or length(trim(new.provider)) = 0 or length(trim(new.label)) = 0 then
          raise exception 'Complétez le résident, le prestataire, le libellé et le montant avant envoi' using errcode = '23514';
        end if;
        select jsonb_build_object('building_name', b.name, 'building_address', b.address, 'resident_name', r.full_name,
          'provider', new.provider, 'label', new.label, 'amount_cents', new.amount_cents, 'currency', 'EUR',
          'service', (select service from public.service_requests where id = new.request_id and building_id = new.building_id))
          into new.document_snapshot from public.buildings b join public.residents r on r.building_id = b.id
          where b.id = new.building_id and r.id = new.resident_id;
        if new.document_snapshot is null then raise exception 'Résident inaccessible' using errcode = '23503'; end if;
        new.sent_at := now();
      else
        new.decided_at := now();
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger guard_quote_workflow before insert or update or delete on public.quotes
  for each row execute function public.guard_quote_workflow();

create function public.notify_quote_workflow() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status and new.resident_id is not null then
    insert into public.notifications(building_id, recipient_resident_id, event, channel, payload)
      select new.building_id, new.resident_id, 'devis_' || new.status::text, c.channel,
        jsonb_build_object('quote_id', new.id, 'title', 'Votre devis Maison Cavalier', 'status', new.status, 'simulated', true)
      from unnest(array['push','email']::public.notification_channel[]) c(channel);
  end if;
  return new;
end;
$$;
create trigger notify_quote_workflow after update on public.quotes
  for each row execute function public.notify_quote_workflow();
