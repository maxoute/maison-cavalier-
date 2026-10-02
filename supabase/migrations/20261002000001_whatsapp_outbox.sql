-- ============================================================
-- File d'envoi WhatsApp (PRD §7.3, Annexe A).
--
-- Les triggers opérationnels (colis, pressing, recommandations, annonces,
-- rappels J+2) écrivent déjà une ligne `notifications` par canal. Jusqu'ici
-- la ligne WhatsApp n'était qu'une trace : rien ne partait. Elle devient une
-- entrée de file : `en_attente` à l'insertion, puis le serveur l'envoie avec
-- le modèle Meta de l'événement et note le résultat.
--
-- Les lignes existantes gardent `delivery_status` nul : l'historique simulé
-- ne doit pas partir rétroactivement chez les résidents. Les colonnes
-- suivent les policies existantes de `notifications` (building_id inchangé).
-- ============================================================

alter table public.notifications
  add column delivery_status text
    check (delivery_status in ('en_attente', 'envoi', 'envoye', 'livre', 'lu', 'echec')),
  add column external_message_id text,
  add column delivered_at timestamptz,
  add column delivery_error text check (delivery_error is null or length(delivery_error) <= 500);

-- Seules les notifications adressées à un résident partent sur WhatsApp ;
-- celles destinées au staff (incident grave) restent des traces.
create function public.queue_whatsapp_notification() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.channel = 'whatsapp' and new.recipient_resident_id is not null and new.delivery_status is null then
    new.delivery_status := 'en_attente';
  end if;
  return new;
end;
$$;
create trigger notifications_queue_whatsapp before insert on public.notifications
  for each row execute function public.queue_whatsapp_notification();

create index notifications_whatsapp_pending on public.notifications (sent_at)
  where delivery_status = 'en_attente';
-- Les accusés Meta (livré, lu, échec) retrouvent la notification par son id.
create unique index notifications_external_message_key on public.notifications (external_message_id)
  where external_message_id is not null;
