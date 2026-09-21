-- ============================================================
-- Colis : preuve photo, créneau modifiable et rappel J+2
-- (PRD §6.1.4, Annexe A « rappel_colis_non_retire »).
-- ============================================================

-- Immeuble porté par le chemin d'un objet Storage : `{building_id}/…`.
-- Renvoie null si le préfixe n'est pas un uuid, ce qui ferme l'accès au lieu
-- de faire échouer la policy.
create function public.storage_building(object_name text)
returns uuid language plpgsql immutable as $$
begin
  return split_part(object_name, '/', 1)::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;
grant execute on function public.storage_building(text) to authenticated, service_role;

-- Le créneau de remise se corrige tant que le colis est en loge ; une fois
-- remis ou retourné, l'historique ne bouge plus. La photo, elle, ne
-- s'efface pas : c'est la preuve en cas de litige.
create function public.check_parcel_edit() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.status in ('remis', 'retourne')
     and new.scheduled_delivery_at is distinct from old.scheduled_delivery_at then
    raise exception 'Créneau figé après remise du colis' using errcode = '23514';
  end if;
  if old.photo_path is not null and new.photo_path is null then
    raise exception 'Preuve photo non effaçable' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger parcel_edit_guard before update on public.parcels
  for each row execute function public.check_parcel_edit();

-- ---------- Rappel J+2 ----------
-- Un colis non retiré deux jours après sa réception vaut un rappel, une fois
-- et une seule : `reminder_sent_at` est posé dans la même instruction que
-- les notifications, donc deux exécutions concurrentes ne doublonnent pas.
create function public.send_parcel_reminders() returns integer
language plpgsql security invoker set search_path = public as $$
declare inserted integer;
begin
  with due as (
    select id from public.parcels
     where status in ('recu', 'stocke', 'notifie')
       and reminder_sent_at is null
       and received_at < now() - interval '2 days'
     for update skip locked
  ),
  marked as (
    update public.parcels p set reminder_sent_at = now()
      from due where p.id = due.id
      returning p.building_id, p.resident_id, p.id
  )
  insert into public.notifications (building_id, recipient_resident_id, event, channel, payload)
  select m.building_id, m.resident_id, 'rappel_colis_non_retire', c.channel,
         jsonb_build_object(
           'body', 'Votre colis attend toujours à la conciergerie.',
           'simulated', true, 'operation_id', m.id)
    from marked m
    cross join unnest(array['push', 'whatsapp']::public.notification_channel[]) as c(channel);
  get diagnostics inserted = row_count;
  return inserted / 2;
end;
$$;
grant execute on function public.send_parcel_reminders() to authenticated, service_role;

-- ---------- Stockage des preuves ----------
-- Le bucket n'existe que sur une stack Supabase complète ; la base de
-- vérification SQL n'a pas de schéma `storage`, d'où le garde-fou.
do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    raise notice 'Schéma storage absent : bucket colis non créé.';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('colis', 'colis', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- Isolation multi-tenant dans le bucket : le premier segment du chemin est
  -- l'immeuble, et seul son staff y accède. Le syndic n'a aucune policy.
  execute $policy$
    create policy colis_staff_select on storage.objects for select
      using (bucket_id = 'colis' and public.staff_of(public.storage_building(name)))
  $policy$;
  execute $policy$
    create policy colis_staff_insert on storage.objects for insert
      with check (bucket_id = 'colis' and public.staff_of(public.storage_building(name)))
  $policy$;
  execute $policy$
    create policy colis_staff_update on storage.objects for update
      using (bucket_id = 'colis' and public.staff_of(public.storage_building(name)))
      with check (bucket_id = 'colis' and public.staff_of(public.storage_building(name)))
  $policy$;
end;
$$;
