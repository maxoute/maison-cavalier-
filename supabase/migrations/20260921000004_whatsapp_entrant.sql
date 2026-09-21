-- ============================================================
-- WhatsApp entrant (PRD §6.1.1, §7.3) : rattachement d'un message reçu
-- au bon fil, donc au bon immeuble. Le webhook écrit avec la clé
-- service-role ; rien de tout ceci n'est exposé au navigateur.
-- ============================================================

-- Un fil de discussion ne peut appartenir qu'à un seul résident.
create unique index conversations_external_thread_key
  on public.conversations (external_thread_id)
  where external_thread_id is not null;

-- Résident derrière un numéro WhatsApp. La comparaison porte sur les neuf
-- derniers chiffres : « +33 6 12 34 56 78 », « 06 12 34 56 78 » et le
-- « 33612345678 » de Meta désignent la même personne.
--
-- La fonction renvoie jusqu'à deux lignes volontairement : si deux immeubles
-- portent le même numéro, l'appelant doit refuser plutôt que de déposer le
-- message chez le mauvais tenant.
create function public.resident_by_whatsapp(wa_id text)
returns table (resident_id uuid, building_id uuid)
language sql stable security definer set search_path = public as $$
  select r.id, r.building_id
    from public.residents r
   where r.phone is not null
     and length(regexp_replace(r.phone, '[^0-9]', '', 'g')) >= 9
     and right(regexp_replace(r.phone, '[^0-9]', '', 'g'), 9)
       = right(regexp_replace(wa_id, '[^0-9]', '', 'g'), 9)
   order by r.building_id
   limit 2
$$;
-- Réservé au serveur : un client authentifié n'a pas à sonder les numéros.
revoke execute on function public.resident_by_whatsapp(text) from public, authenticated;
grant execute on function public.resident_by_whatsapp(text) to service_role;

-- Répondre vaut lecture : sans cela, le fil que la loge vient de traiter
-- resterait marqué « non lu » à cause de son propre message.
create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.conversations
     set last_message_at = new.created_at,
         last_read_at = case when new.direction = 'sortant' then new.created_at else last_read_at end,
         status = case when new.direction = 'entrant' then 'ouverte' else status end
   where id = new.conversation_id;
  return new;
end;
$$;
