-- ============================================================
-- Tests de sécurité RLS (PRD §4, §5) — exécutés via `npm run test:rls`
-- Chaque violation lève une exception => échec du script.
-- Le tout est joué dans une transaction annulée à la fin.
--
-- Les effectifs attendus sont lus dans la base avant impersonation (le
-- propriétaire des tables n'est pas soumis à la RLS) : le seed peut grossir
-- sans casser la suite.
-- ============================================================
\set ON_ERROR_STOP on

begin;

-- Impersonation d'un utilisateur authentifié
create or replace function pg_temp.impersonate(u_id uuid, u_role text, b_id uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', u_id::text,
    'role', 'authenticated',
    'aal', 'aal2',
    'app_metadata', json_build_object('role', u_role, 'building_id', b_id::text)
  )::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function pg_temp.reset_role()
returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
end;
$$;

do $$
declare
  n integer;
  marly constant uuid := '11111111-1111-1111-1111-111111111111';
  segur constant uuid := '22222222-2222-2222-2222-222222222222';
  concierge1 constant uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  syndic1 constant uuid := 'aaaaaaaa-0000-0000-0000-000000000004';
  concierge2 constant uuid := 'aaaaaaaa-0000-0000-0000-000000000005';
  superadm constant uuid := 'aaaaaaaa-0000-0000-0000-000000000003';
  resident_test constant uuid := 'aaaaaaaa-0000-0000-0000-0000000000ff';
  resident_fiche constant uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
  -- Effectifs de référence, relevés hors RLS
  marly_residents integer;
  segur_residents integer;
  tous_residents integer;
  tous_immeubles integer;
  marly_colis integer;
  segur_colis integer;
  marly_pressing integer;
  marly_fils integer;
  ses_colis integer;
  ses_demandes integer;
  failed boolean;
begin
  select count(*) into marly_residents from public.residents where building_id = marly;
  select count(*) into segur_residents from public.residents where building_id = segur;
  select count(*) into tous_residents from public.residents;
  select count(*) into tous_immeubles from public.buildings;
  select count(*) into marly_colis from public.parcels where building_id = marly;
  select count(*) into segur_colis from public.parcels where building_id = segur;
  select count(*) into marly_pressing from public.pressing_orders where building_id = marly;
  select count(*) into marly_fils from public.conversations where building_id = marly;

  -- ------------------------------------------------------------
  -- 1. Isolation inter-immeubles
  -- ------------------------------------------------------------
  perform pg_temp.impersonate(concierge1, 'concierge', marly);
  select count(*) into n from public.residents;
  if n <> marly_residents then
    raise exception 'TEST 1a ÉCHOUÉ : le concierge Marly devrait voir % résidents, en voit %', marly_residents, n;
  end if;

  perform pg_temp.reset_role();
  perform pg_temp.impersonate(concierge2, 'concierge', segur);
  select count(*) into n from public.residents;
  if n <> segur_residents then
    raise exception 'TEST 1b ÉCHOUÉ : le concierge Ségur devrait voir % résidents, en voit %', segur_residents, n;
  end if;
  select count(*) into n from public.service_requests where building_id = marly;
  if n <> 0 then
    raise exception 'TEST 1c ÉCHOUÉ : le concierge Ségur voit % demandes du Marly', n;
  end if;

  -- 1d. Isolation sur les tables opérationnelles (colis, pressing, chat)
  select count(*) into n from public.parcels;
  if n <> segur_colis then
    raise exception 'TEST 1d ÉCHOUÉ : le concierge Ségur devrait voir % colis, en voit %', segur_colis, n;
  end if;
  select count(*) into n from public.parcels where building_id = marly;
  if n <> 0 then
    raise exception 'TEST 1e ÉCHOUÉ : le concierge Ségur voit % colis du Marly', n;
  end if;
  select count(*) into n from public.messages where building_id = marly;
  if n <> 0 then
    raise exception 'TEST 1f ÉCHOUÉ : le concierge Ségur voit % messages WhatsApp du Marly', n;
  end if;
  select count(*) into n from public.recommendation_shares where building_id = marly;
  if n <> 0 then
    raise exception 'TEST 1g ÉCHOUÉ : le concierge Ségur voit % recommandations envoyées au Marly', n;
  end if;

  -- 1h. Le concierge du Marly voit bien son propre opérationnel
  perform pg_temp.reset_role();
  perform pg_temp.impersonate(concierge1, 'concierge', marly);
  select count(*) into n from public.parcels;
  if n <> marly_colis then
    raise exception 'TEST 1h ÉCHOUÉ : le concierge Marly devrait voir % colis, en voit %', marly_colis, n;
  end if;
  select count(*) into n from public.pressing_orders;
  if n <> marly_pressing then
    raise exception 'TEST 1i ÉCHOUÉ : le concierge Marly devrait voir % commandes pressing, en voit %', marly_pressing, n;
  end if;
  select count(*) into n from public.conversations;
  if n <> marly_fils then
    raise exception 'TEST 1j ÉCHOUÉ : le concierge Marly devrait voir % fils WhatsApp, en voit %', marly_fils, n;
  end if;
  -- Les devis reçus par mail non encore rattachés à un résident restent visibles
  select count(*) into n from public.quotes where source = 'email' and resident_id is null;
  if n < 1 then
    raise exception 'TEST 1k ÉCHOUÉ : le concierge ne voit aucun devis e-mail à qualifier';
  end if;

  -- ------------------------------------------------------------
  -- 2. Le syndic ne voit AUCUNE donnée résident / service / paiement (PRD §4)
  -- ------------------------------------------------------------
  perform pg_temp.reset_role();
  perform pg_temp.impersonate(syndic1, 'syndic', marly);

  select count(*) into n from public.residents;
  if n <> 0 then
    raise exception 'TEST 2a ÉCHOUÉ : le syndic voit % fiches résident', n;
  end if;
  select count(*) into n from public.service_requests;
  if n <> 0 then
    raise exception 'TEST 2b ÉCHOUÉ : le syndic voit % demandes de service', n;
  end if;
  select count(*) into n from public.quotes;
  if n <> 0 then
    raise exception 'TEST 2c ÉCHOUÉ : le syndic voit % devis', n;
  end if;
  select count(*) into n from public.notifications;
  if n <> 0 then
    raise exception 'TEST 2d ÉCHOUÉ : le syndic voit % notifications', n;
  end if;
  select count(*) into n from public.audit_logs;
  if n <> 0 then
    raise exception 'TEST 2e ÉCHOUÉ : le syndic voit % lignes d''audit', n;
  end if;

  -- 2e2. Le syndic voit le staff de son immeuble mais aucun profil résident/chauffeur
  select count(*) into n from public.profiles where role in ('resident', 'chauffeur');
  if n <> 0 then
    raise exception 'TEST 2e2 ÉCHOUÉ : le syndic voit % profils résident/chauffeur', n;
  end if;
  select count(*) into n from public.profiles where role = 'concierge';
  if n < 1 then
    raise exception 'TEST 2e3 ÉCHOUÉ : le syndic devrait voir le concierge de son immeuble';
  end if;

  -- 2f. Le syndic accède bien à sa messagerie
  select count(*) into n from public.syndic_messages;
  if n < 3 then
    raise exception 'TEST 2f ÉCHOUÉ : le syndic devrait voir >= 3 messages, en voit %', n;
  end if;

  -- 2g. …et à rien de l'opérationnel résident (chat WhatsApp, colis, pressing,
  -- recommandations) : ce sont des données individuelles (PRD §4, §6.2).
  select count(*) into n from public.conversations;
  if n <> 0 then
    raise exception 'TEST 2g ÉCHOUÉ : le syndic voit % fils de chat résident', n;
  end if;
  select count(*) into n from public.messages;
  if n <> 0 then
    raise exception 'TEST 2h ÉCHOUÉ : le syndic voit % messages résident', n;
  end if;
  select count(*) into n from public.parcels;
  if n <> 0 then
    raise exception 'TEST 2i ÉCHOUÉ : le syndic voit % colis', n;
  end if;
  select count(*) into n from public.pressing_orders;
  if n <> 0 then
    raise exception 'TEST 2j ÉCHOUÉ : le syndic voit % commandes pressing', n;
  end if;
  select count(*) into n from public.recommendations;
  if n <> 0 then
    raise exception 'TEST 2k ÉCHOUÉ : le syndic voit % recommandations', n;
  end if;
  select count(*) into n from public.recommendation_shares;
  if n <> 0 then
    raise exception 'TEST 2l ÉCHOUÉ : le syndic voit % recommandations envoyées', n;
  end if;

  -- 2m. Écriture refusée sur le chat résident, même dans son immeuble
  failed := false;
  begin
    insert into public.conversations (building_id, resident_id)
    values (marly, resident_fiche);
  exception when others then
    failed := true;
  end;
  if not failed then
    raise exception 'TEST 2m ÉCHOUÉ : le syndic a pu ouvrir un fil de chat résident';
  end if;

  -- ------------------------------------------------------------
  -- 3. Écriture cross-tenant refusée (WITH CHECK)
  -- ------------------------------------------------------------
  perform pg_temp.reset_role();
  perform pg_temp.impersonate(concierge2, 'concierge', segur);
  failed := false;
  begin
    insert into public.residents (building_id, full_name)
    values (marly, 'Intrus Cross-Tenant');
  exception when others then
    failed := true;
  end;
  if not failed then
    raise exception 'TEST 3 ÉCHOUÉ : insertion cross-tenant acceptée';
  end if;

  -- 3b. Idem sur les colis
  failed := false;
  begin
    insert into public.parcels (building_id, resident_id, carrier)
    values (marly, resident_fiche, 'Intrus');
  exception when others then
    failed := true;
  end;
  if not failed then
    raise exception 'TEST 3b ÉCHOUÉ : colis inséré dans un autre immeuble';
  end if;

  -- ------------------------------------------------------------
  -- 4. audit_logs immuable
  -- ------------------------------------------------------------
  perform pg_temp.reset_role();
  failed := false;
  begin
    update public.audit_logs set action = 'falsifie' where true;
  exception when others then
    failed := true;
  end;
  if not failed then
    raise exception 'TEST 4a ÉCHOUÉ : update accepté sur audit_logs';
  end if;

  failed := false;
  begin
    delete from public.audit_logs where true;
  exception when others then
    failed := true;
  end;
  if not failed then
    raise exception 'TEST 4b ÉCHOUÉ : delete accepté sur audit_logs';
  end if;

  -- ------------------------------------------------------------
  -- 5. Le super_admin voit tous les immeubles
  -- ------------------------------------------------------------
  perform pg_temp.impersonate(superadm, 'super_admin', marly);
  select count(*) into n from public.buildings;
  if n <> tous_immeubles then
    raise exception 'TEST 5a ÉCHOUÉ : le super_admin devrait voir % immeubles, en voit %', tous_immeubles, n;
  end if;
  select count(*) into n from public.residents;
  if n <> tous_residents then
    raise exception 'TEST 5b ÉCHOUÉ : le super_admin devrait voir % résidents, en voit %', tous_residents, n;
  end if;
  select count(*) into n from public.parcels;
  if n <= marly_colis then
    raise exception 'TEST 5c ÉCHOUÉ : le super_admin devrait voir les colis de tous les immeubles, en voit %', n;
  end if;

  -- ------------------------------------------------------------
  -- 6. Résident (app mobile) : ses données à lui, et rien d'autre.
  -- Vérifie surtout que les policies résident ne sont pas muettes — une
  -- sous-requête RLS mal placée les rendrait silencieusement vides.
  -- ------------------------------------------------------------
  perform pg_temp.reset_role();
  insert into auth.users (id, aud, role, email, raw_app_meta_data)
  values (resident_test, 'authenticated', 'authenticated', 'resident.test@demo.mc',
          jsonb_build_object('role', 'resident', 'building_id', marly::text));
  insert into public.profiles (id, building_id, role, full_name)
  values (resident_test, marly, 'resident', 'Résident Test');
  update public.residents set profile_id = resident_test where id = resident_fiche;

  select count(*) into ses_colis from public.parcels where resident_id = resident_fiche;
  select count(*) into ses_demandes from public.service_requests where resident_id = resident_fiche;

  perform pg_temp.impersonate(resident_test, 'resident', marly);

  select count(*) into n from public.parcels;
  if n <> ses_colis then
    raise exception 'TEST 6a ÉCHOUÉ : le résident devrait voir ses % colis, en voit %', ses_colis, n;
  end if;
  select count(*) into n from public.service_requests;
  if n <> ses_demandes then
    raise exception 'TEST 6b ÉCHOUÉ : le résident devrait voir ses % demandes, en voit %', ses_demandes, n;
  end if;
  select count(*) into n from public.conversations;
  if n <> 1 then
    raise exception 'TEST 6c ÉCHOUÉ : le résident devrait voir son unique fil, en voit %', n;
  end if;
  select count(*) into n from public.messages;
  if n < 1 then
    raise exception 'TEST 6d ÉCHOUÉ : le résident ne voit aucun message de son propre fil';
  end if;
  -- Il ne parcourt jamais le CRM ni les fiches des voisins
  select count(*) into n from public.residents;
  if n <> 0 then
    raise exception 'TEST 6e ÉCHOUÉ : le résident lit % fiches CRM', n;
  end if;
  select count(*) into n from public.pressing_orders where resident_id <> resident_fiche;
  if n <> 0 then
    raise exception 'TEST 6f ÉCHOUÉ : le résident voit % commandes pressing de voisins', n;
  end if;
  -- Le catalogue de recommandations actif de son immeuble lui est ouvert
  select count(*) into n from public.recommendations;
  if n < 1 then
    raise exception 'TEST 6g ÉCHOUÉ : le résident ne voit aucune recommandation active';
  end if;
  select count(*) into n from public.recommendations where not is_active;
  if n <> 0 then
    raise exception 'TEST 6h ÉCHOUÉ : le résident voit % recommandations désactivées', n;
  end if;
  -- Écriture refusée : un résident ne poste pas dans le fil (le message
  -- entrant est écrit côté serveur par le webhook WhatsApp)
  failed := false;
  begin
    insert into public.parcels (building_id, resident_id, carrier)
    values (marly, resident_fiche, 'Colis fantôme');
  exception when others then
    failed := true;
  end;
  if not failed then
    raise exception 'TEST 6i ÉCHOUÉ : le résident a pu créer un colis';
  end if;

  perform pg_temp.reset_role();
  raise notice 'TOUS LES TESTS RLS SONT PASSÉS ✓';
end;
$$;

-- Parcours opérationnels ajoutés en septembre : documents syndic, références
-- inter-tenant et notifications atomiques. Toutes les fixtures sont annulées.
do $$
declare
  b1 uuid := '11111111-1111-1111-1111-111111111111';
  b2 uuid := '22222222-2222-2222-2222-222222222222';
  staff uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  syndic uuid := 'aaaaaaaa-0000-0000-0000-000000000004';
  r1 uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
  r2 uuid := 'cccccccc-0000-0000-0000-000000000001';
  doc uuid; parcel uuid; pressing uuid; n integer; failed boolean;
begin
  perform pg_temp.impersonate(staff, 'concierge', b1);
  insert into public.building_documents(building_id, title, provider, body, email_from, email_message_id, created_by)
    values(b1, 'Devis ascenseur', 'Ascensoriste', 'Entretien des parties communes', 'devis@example.com', 'test-email-unique', staff) returning id into doc;
  failed := false;
  begin
    insert into public.building_documents(building_id, title, provider, body, email_from, email_message_id, created_by)
      values(b1, 'Doublon', 'Ascensoriste', 'Devis', 'devis@example.com', 'test-email-unique', staff);
  exception when unique_violation then failed := true;
  end;
  if not failed then raise exception 'Un email dupliqué crée deux devis'; end if;

  failed := false;
  begin
    insert into public.parcels(building_id, resident_id) values(b1, r2);
  exception when foreign_key_violation then failed := true;
  end;
  if not failed then raise exception 'Colis relié au résident d’un autre immeuble'; end if;
  failed := false;
  begin
    insert into public.conversations(building_id, resident_id, channel) values(b1, r2, 'sms');
  exception when foreign_key_violation then failed := true;
  end;
  if not failed then raise exception 'Conversation reliée au résident d’un autre immeuble'; end if;

  insert into public.parcels(building_id, resident_id, tracking_code) values(b1, r1, 'RLS-TEST') returning id into parcel;
  select count(*) into n from public.notifications where payload->>'operation_id' = parcel::text and payload->>'simulated' = 'true';
  if n <> 3 then raise exception 'La réception doit générer 3 notifications simulées'; end if;
  failed := false;
  begin
    update public.parcels set status = 'remis' where id = parcel;
  exception when raise_exception then failed := true;
  end;
  if not failed then raise exception 'Le colis peut sauter les étapes'; end if;
  update public.parcels set status = 'stocke' where id = parcel;
  update public.parcels set status = 'notifie' where id = parcel;
  update public.parcels set status = 'notifie' where id = parcel;
  select count(*) into n from public.notifications where payload->>'operation_id' = parcel::text;
  if n <> 6 then raise exception 'Notifications dupliquées sur mise à jour identique'; end if;
  update public.parcels set status = 'remis' where id = parcel;
  if not exists(select 1 from public.parcels where id = parcel and delivered_at is not null) then raise exception 'Remise non horodatée'; end if;

  insert into public.pressing_orders(building_id, resident_id, item_count) values(b1, r1, 1) returning id into pressing;
  update public.pressing_orders set status = 'chez_le_pressing' where id = pressing;
  update public.pressing_orders set status = 'pret' where id = pressing;
  update public.pressing_orders set status = 'pret' where id = pressing;
  select count(*) into n from public.notifications where payload->>'operation_id' = pressing::text and event = 'pressing_pret';
  if n <> 3 then raise exception 'Notification pressing non atomique'; end if;
  if not exists(select 1 from public.pressing_orders where id = pressing and returned_at is not null) then raise exception 'Retour pressing non horodaté'; end if;

  perform pg_temp.reset_role();
  perform pg_temp.impersonate(syndic, 'syndic', b1);
  select count(*) into n from public.building_documents where id = doc;
  if n <> 1 then raise exception 'Le syndic ne voit pas son devis partagé'; end if;
  update public.building_documents set title = 'Modification interdite' where id = doc;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Le syndic peut modifier les devis'; end if;
  failed := false;
  begin
    insert into public.building_documents(building_id, title, provider, body, email_from, email_message_id, created_by)
      values(b1, 'Interdit', 'Test', 'Test', 'a@example.com', 'syndic-insert', syndic);
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'Le syndic peut créer un devis'; end if;
  select count(*) into n from public.quotes;
  if n <> 0 then raise exception 'Le syndic voit les devis privés'; end if;

  perform pg_temp.reset_role();
  perform pg_temp.impersonate('aaaaaaaa-0000-0000-0000-000000000005', 'concierge', b2);
  select count(*) into n from public.building_documents where id = doc;
  if n <> 0 then raise exception 'Devis partagé accessible depuis un autre immeuble'; end if;
  failed := false;
  begin
    insert into public.building_document_deliveries(building_id, document_id, recipient, external_id, sent_by)
      values(b2, doc, 'a@example.com', 'cross-tenant', auth.uid());
  exception when foreign_key_violation then failed := true;
  end;
  if not failed then raise exception 'Envoi associé au devis d’un autre immeuble'; end if;
  perform pg_temp.reset_role();
  raise notice 'TESTS PARCOURS OPÉRATIONNELS PASSÉS';
end;
$$;
-- Demandes : cycles valides, concurrence, référence tenant et clôture horodatée.
do $$
declare
  b1 constant uuid := '11111111-1111-1111-1111-111111111111';
  b2 constant uuid := '22222222-2222-2222-2222-222222222222';
  concierge constant uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  resident1 uuid;
  resident2 uuid;
  request_id uuid;
  n integer;
  failed boolean;
  closure timestamptz;
begin
  select id into strict resident1 from public.residents where building_id = b1 limit 1;
  select id into strict resident2 from public.residents where building_id = b2 limit 1;
  perform pg_temp.impersonate(concierge, 'concierge', b1);
  failed := false;
  begin
    insert into public.service_requests(building_id, resident_id, service) values(b1, resident2, 'colis');
  exception when foreign_key_violation then failed := true;
  end;
  if not failed then raise exception 'Demande reliée au résident d’un autre immeuble'; end if;
  failed := false;
  begin
    insert into public.service_requests(building_id, resident_id, service, status) values(b1, resident1, 'colis', 'termine');
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'Création directe d’une demande terminée'; end if;
  insert into public.service_requests(building_id, resident_id, service) values(b1, resident1, 'colis') returning id into request_id;
  failed := false;
  begin
    update public.service_requests set status='termine' where id=request_id;
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'Clôture sans prise en charge'; end if;
  update public.service_requests set status='en_attente' where id=request_id and status='nouveau';
  update public.service_requests set status='en_cours' where id=request_id and status='nouveau';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Une écriture obsolète écrase le statut'; end if;
  update public.service_requests set status='en_cours' where id=request_id;
  update public.service_requests set status='termine', completed_at='2000-01-01' where id=request_id;
  select completed_at into closure from public.service_requests where id=request_id;
  if closure is null or closure <> now() then raise exception 'Clôture non horodatée par la base'; end if;
  update public.service_requests set completed_at='2001-01-01' where id=request_id;
  if not exists(select 1 from public.service_requests where id=request_id and completed_at=closure) then raise exception 'Horodatage de clôture falsifiable'; end if;
  failed := false;
  begin
    update public.service_requests set status='en_cours' where id=request_id;
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'Réouverture d’une demande clôturée'; end if;
  select count(*) into n from public.audit_logs where entity_id=request_id;
  if n <> 0 then raise exception 'Concierge ayant accès au journal administrateur'; end if;
  perform pg_temp.reset_role();
  select count(*) into n from public.audit_logs where entity_id=request_id and action='update';
  if n <> 4 then raise exception 'Historique des demandes incomplet : %', n; end if;
  perform pg_temp.impersonate('aaaaaaaa-0000-0000-0000-000000000005', 'concierge', b2);
  update public.service_requests set priority='urgente' where id=request_id;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Modification d’une demande hors tenant'; end if;
  perform pg_temp.reset_role();
  perform pg_temp.impersonate('aaaaaaaa-0000-0000-0000-000000000004', 'syndic', b1);
  select count(*) into n from public.service_requests where id=request_id;
  if n <> 0 then raise exception 'Demande privée exposée au syndic'; end if;
  failed := false;
  begin
    insert into public.service_requests(building_id, resident_id, service) values(b1, resident1, 'colis');
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'Le syndic crée des demandes résidentielles'; end if;
  perform pg_temp.reset_role();
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='service_requests') then raise exception 'Publication Realtime manquante'; end if;
  raise notice 'TESTS DEMANDES ET CLÔTURE PASSÉS';
end;
$$;
-- Annonces : audience, canaux, atomicité, immutabilité et isolation.
do $$
declare
  b1 constant uuid := '11111111-1111-1111-1111-111111111111';
  b2 constant uuid := '22222222-2222-2222-2222-222222222222';
  concierge constant uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  announcement uuid;
  normal_announcement uuid;
  n integer;
  expected integer;
  failed boolean;
begin
  insert into public.residents(building_id, full_name, floor, owner_status) values
    (b1, 'Test annonce propriétaire 1', '__annonce_test__', 'proprietaire'),
    (b1, 'Test annonce propriétaire 2', '__annonce_test__', 'proprietaire'),
    (b1, 'Test annonce locataire', '__annonce_test__', 'locataire'),
    (b2, 'Test annonce autre immeuble', '__annonce_test__', 'proprietaire');
  select count(*) into expected from public.residents where building_id=b1;
  perform pg_temp.impersonate(concierge, 'concierge', b1);
  insert into public.announcements(building_id, created_by, title, body, target_floor, target_owner_status, urgent, recipient_count, channels)
    values(b1, concierge, 'Travaux', 'Information test', '__annonce_test__', 'proprietaire', true, 999, '{push}') returning id into announcement;
  if not exists(select 1 from public.announcements where id=announcement and recipient_count=2 and cardinality(channels)=4 and simulated) then raise exception 'Audience ou canaux urgents falsifiables'; end if;
  select count(*) into n from public.notifications where payload->>'announcement_id'=announcement::text and payload->>'simulated'='true' and event='annonce_urgente';
  if n <> 8 then raise exception 'L’annonce urgente devrait générer 8 notifications, obtenu %', n; end if;
  select count(*) into n from public.notifications x join public.residents r on r.id=x.recipient_resident_id
    where x.payload->>'announcement_id'=announcement::text and (r.building_id<>b1 or r.floor<>'__annonce_test__' or r.owner_status<>'proprietaire');
  if n <> 0 then raise exception 'Annonce reçue hors audience'; end if;
  insert into public.announcements(building_id, created_by, title, body)
    values(b1, concierge, 'Événement', 'Annonce générale') returning id into normal_announcement;
  if not exists(select 1 from public.announcements where id=normal_announcement and recipient_count=expected) then raise exception 'Audience générale incomplète'; end if;
  select count(*) into n from public.notifications where payload->>'announcement_id'=normal_announcement::text and channel in ('push','email') and event='annonce_immeuble';
  if n <> expected*2 then raise exception 'Canaux non urgents incorrects'; end if;
  failed := false;
  begin
    insert into public.announcements(building_id, created_by, title, body, target_floor)
      values(b1, concierge, 'Audience vide', 'Test', '__aucun_resident__');
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'Annonce acceptée sans destinataire'; end if;
  if exists(select 1 from public.announcements where title='Audience vide') then raise exception 'Annonce partiellement créée'; end if;
  failed := false;
  begin
    update public.announcements set body='Réécriture' where id=announcement;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'Historique annonce modifiable'; end if;
  failed := false;
  begin
    insert into public.announcements(building_id, created_by, title, body)
      values(b1, 'aaaaaaaa-0000-0000-0000-000000000004', 'Faux auteur', 'Test');
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'Auteur annonce usurpable'; end if;
  perform pg_temp.reset_role();
  perform pg_temp.impersonate('aaaaaaaa-0000-0000-0000-000000000005', 'concierge', b2);
  select count(*) into n from public.announcements where id=announcement;
  if n <> 0 then raise exception 'Annonce accessible hors immeuble'; end if;
  perform pg_temp.reset_role();
  perform pg_temp.impersonate('aaaaaaaa-0000-0000-0000-000000000004', 'syndic', b1);
  select count(*) into n from public.announcements;
  if n <> 0 then raise exception 'Audiences résidentes exposées au syndic'; end if;
  failed := false;
  begin
    insert into public.announcements(building_id, created_by, title, body)
      values(b1, auth.uid(), 'Annonce syndic interdite', 'Test');
  exception when insufficient_privilege or check_violation then failed := true;
  end;
  if not failed then raise exception 'Le syndic diffuse une annonce'; end if;
  perform pg_temp.reset_role();
  raise notice 'TESTS ANNONCES PASSÉS';
end;
$$;
-- Interventions : notes privées, escalade publique minimale, résolution et clôture.
do $$
declare
  b1 constant uuid := '11111111-1111-1111-1111-111111111111';
  b2 constant uuid := '22222222-2222-2222-2222-222222222222';
  concierge constant uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  syndic constant uuid := 'aaaaaaaa-0000-0000-0000-000000000004';
  resident1 uuid; resident2 uuid; request1 uuid; request2 uuid; incident uuid;
  messages_before integer; notifs_before integer; n integer; failed boolean; started timestamptz;
  secret constant text := 'Détail confidentiel résident TEST-PRIVE-INTERVENTION';
begin
  select id into strict resident1 from public.residents where building_id=b1 limit 1;
  select id into strict resident2 from public.residents where building_id=b2 limit 1;
  insert into public.service_requests(building_id, resident_id, service) values(b2,resident2,'pressing') returning id into request2;
  perform pg_temp.impersonate(concierge,'concierge',b1);
  insert into public.service_requests(building_id,resident_id,service) values(b1,resident1,'pressing') returning id into request1;
  update public.service_requests set assigned_provider='Pressing test', estimated_completion_at=now()+interval '1 hour',status='en_cours' where id=request1;
  select started_at into started from public.service_requests where id=request1;
  if started is null or started<>now() then raise exception 'Début intervention non horodaté'; end if;
  update public.service_requests set started_at='2000-01-01' where id=request1;
  if not exists(select 1 from public.service_requests where id=request1 and started_at=started) then raise exception 'Début intervention falsifiable'; end if;
  select count(*) into messages_before from public.syndic_messages where building_id=b1;
  -- Effectif de référence : la base peut déjà porter des incidents antérieurs.
  select count(*) into notifs_before from public.notifications where event='incident_grave' and recipient_profile_id=syndic;
  insert into public.intervention_incidents(building_id,request_id,reported_by,kind,severity,description)
    values(b1,request1,concierge,'plainte','grave',secret) returning id into incident;
  select count(*) into n from public.syndic_messages where building_id=b1;
  if n<>messages_before+1 then raise exception 'Escalade grave absente ou dupliquée'; end if;
  if exists(select 1 from public.syndic_messages where body like '%'||secret||'%') then raise exception 'Notes privées copiées dans le fil syndic'; end if;
  select count(*) into n from public.notifications where event='incident_grave' and recipient_profile_id=syndic and payload->>'simulated'='true';
  if n<>notifs_before+2 then raise exception 'Notifications syndic incorrectes : %', n-notifs_before; end if;
  failed:=false;
  begin update public.service_requests set status='termine' where id=request1;
  exception when check_violation then failed:=true; end;
  if not failed then raise exception 'Clôture avec incident non résolu'; end if;
  failed:=false;
  begin update public.intervention_incidents set severity='standard',resolution='Masquage' where id=incident;
  exception when check_violation then failed:=true; end;
  if not failed then raise exception 'Historique incident réécrit'; end if;
  failed:=false;
  begin insert into public.intervention_incidents(building_id,request_id,reported_by,kind,severity,description)
    values(b1,request2,concierge,'retard','standard','Hors immeuble');
  exception when foreign_key_violation then failed:=true; end;
  if not failed then raise exception 'Incident relié à une intervention hors immeuble'; end if;
  update public.intervention_incidents set resolution='Solution apportée',resolved_at='2000-01-01' where id=incident;
  if not exists(select 1 from public.intervention_incidents where id=incident and resolved_by=concierge and resolved_at=now()) then raise exception 'Résolution non horodatée ou non signée'; end if;
  select count(*) into n from public.syndic_messages where building_id=b1;
  if n<>messages_before+1 then raise exception 'Résolution dupliquant l’escalade'; end if;
  update public.service_requests set status='termine' where id=request1;
  failed:=false;
  begin insert into public.intervention_incidents(building_id,request_id,reported_by,kind,severity,description)
    values(b1,request1,concierge,'retard','standard','Après clôture');
  exception when check_violation then failed:=true; end;
  if not failed then raise exception 'Incident ajouté après clôture'; end if;
  failed:=false;
  begin update public.service_requests set assigned_provider='Autre' where id=request1;
  exception when check_violation then failed:=true; end;
  if not failed then raise exception 'Prestataire réécrit après clôture'; end if;
  perform pg_temp.reset_role();
  perform pg_temp.impersonate(syndic,'syndic',b1);
  select count(*) into n from public.intervention_incidents;
  if n<>0 then raise exception 'Le syndic voit les incidents privés'; end if;
  select count(*) into n from public.syndic_messages where building_id=b1;
  if n<>messages_before+1 then raise exception 'Alerte générique inaccessible au syndic'; end if;
  update public.intervention_incidents set resolution='Interdit' where id=incident;
  get diagnostics n=row_count;
  if n<>0 then raise exception 'Le syndic modifie les incidents'; end if;
  perform pg_temp.reset_role();
  perform pg_temp.impersonate('aaaaaaaa-0000-0000-0000-000000000005','concierge',b2);
  select count(*) into n from public.intervention_incidents where id=incident;
  if n<>0 then raise exception 'Incident accessible hors immeuble'; end if;
  perform pg_temp.reset_role();
  raise notice 'TESTS INTERVENTIONS PASSÉS';
end;
$$;
-- Devis : références cohérentes, cycle, contenu archivé et notifications uniques.
do $$
declare
  b1 constant uuid := '11111111-1111-1111-1111-111111111111';
  b2 constant uuid := '22222222-2222-2222-2222-222222222222';
  concierge constant uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  resident1 uuid; resident_other uuid; resident2 uuid; req uuid; q uuid; incomplete uuid;
  n integer; failed boolean; original_name text;
begin
  select id,full_name into strict resident1,original_name from public.residents where building_id=b1 limit 1;
  select id into strict resident_other from public.residents where building_id=b1 and id<>resident1 limit 1;
  select id into strict resident2 from public.residents where building_id=b2 limit 1;
  perform pg_temp.impersonate(concierge,'concierge',b1);
  insert into public.service_requests(building_id,resident_id,service) values(b1,resident1,'personal_shopper') returning id into req;
  failed:=false;
  begin insert into public.quotes(building_id,resident_id,provider,label,amount_cents)
    values(b1,resident2,'Test','Mauvais tenant',100);
  exception when foreign_key_violation then failed:=true; end;
  if not failed then raise exception 'Devis relié à un résident hors tenant'; end if;
  failed:=false;
  begin insert into public.quotes(building_id,resident_id,request_id,provider,label,amount_cents)
    values(b1,resident_other,req,'Test','Mauvais résident',100);
  exception when foreign_key_violation then failed:=true; end;
  if not failed then raise exception 'Devis et demande associés à des résidents différents'; end if;
  insert into public.quotes(building_id,provider,label) values(b1,'Test','À qualifier') returning id into incomplete;
  failed:=false;
  begin update public.quotes set status='envoye' where id=incomplete;
  exception when check_violation then failed:=true; end;
  if not failed then raise exception 'Envoi d’un devis incomplet'; end if;
  insert into public.quotes(building_id,resident_id,request_id,provider,label,amount_cents)
    values(b1,resident1,req,'Atelier test','Prestation privée',1999) returning id into q;
  failed:=false;
  begin update public.quotes set status='accepte' where id=q;
  exception when check_violation then failed:=true; end;
  if not failed then raise exception 'Acceptation sans envoi'; end if;
  update public.quotes set status='envoye',sent_at='2000-01-01',document_snapshot='{}' where id=q;
  if not exists(select 1 from public.quotes where id=q and sent_at=now() and document_snapshot->>'resident_name'=original_name and document_snapshot->>'amount_cents'='1999') then raise exception 'Snapshot devis ou horodatage incorrect'; end if;
  update public.residents set full_name='Nom ultérieur' where id=resident1;
  if not exists(select 1 from public.quotes where id=q and document_snapshot->>'resident_name'=original_name) then raise exception 'Snapshot historique modifié avec le CRM'; end if;
  failed:=false;
  begin update public.quotes set amount_cents=99999 where id=q;
  exception when check_violation then failed:=true; end;
  if not failed then raise exception 'Montant modifiable après envoi'; end if;
  update public.quotes set status='envoye' where id=q;
  select count(*) into n from public.notifications where payload->>'quote_id'=q::text;
  if n<>2 then raise exception 'Notifications devis envoyé dupliquées'; end if;
  update public.quotes set status='accepte',decided_at='2000-01-01' where id=q and status='envoye';
  update public.quotes set status='refuse' where id=q and status='envoye';
  get diagnostics n=row_count;
  if n<>0 then raise exception 'Décision concurrente écrasée'; end if;
  if not exists(select 1 from public.quotes where id=q and status='accepte' and decided_at=now()) then raise exception 'Décision non horodatée'; end if;
  select count(*) into n from public.notifications where payload->>'quote_id'=q::text and payload->>'simulated'='true';
  if n<>4 then raise exception 'Notifications de décision incorrectes'; end if;
  failed:=false;
  begin delete from public.quotes where id=q;
  exception when check_violation then failed:=true; end;
  if not failed then raise exception 'Archive de devis effaçable'; end if;
  perform pg_temp.reset_role();
  perform pg_temp.impersonate('aaaaaaaa-0000-0000-0000-000000000004','syndic',b1);
  select count(*) into n from public.quotes where id=q;
  if n<>0 then raise exception 'Le syndic voit les devis résidentiels'; end if;
  perform pg_temp.reset_role();
  perform pg_temp.impersonate('aaaaaaaa-0000-0000-0000-000000000005','concierge',b2);
  update public.quotes set label='Interdit' where id=q;
  get diagnostics n=row_count;
  if n<>0 then raise exception 'Modification de devis inter-immeubles'; end if;
  perform pg_temp.reset_role();
  raise notice 'TESTS DEVIS PASSÉS';
end;
$$;
-- Catalogue services & tarifs : lecture staff, écriture gestionnaire,
-- synchronisation des services actifs et fermeture d'un service.
do $$
declare
  b1 constant uuid := '11111111-1111-1111-1111-111111111111';
  b2 constant uuid := '22222222-2222-2222-2222-222222222222';
  concierge1 constant uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  admin1 constant uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
  superadm constant uuid := 'aaaaaaaa-0000-0000-0000-000000000003';
  syndic1 constant uuid := 'aaaaaaaa-0000-0000-0000-000000000004';
  concierge2 constant uuid := 'aaaaaaaa-0000-0000-0000-000000000005';
  resident1 uuid; neuf uuid; modele uuid; n integer; failed boolean; actifs service_type[];
begin
  select id into strict resident1 from public.residents where building_id = b1 limit 1;

  -- Provisionnement automatique d'un nouvel immeuble (PRD §6.3.2).
  insert into public.buildings (name, address, enabled_services)
    values ('Immeuble test catalogue', '1 rue de test', '{colis,pressing}') returning id into neuf;
  select count(*) into n from public.building_services where building_id = neuf;
  if n <> 5 then raise exception 'Catalogue non provisionné à la création de l’immeuble'; end if;
  select count(*) into n from public.building_services where building_id = neuf and enabled;
  if n <> 2 then raise exception 'Services activés à l’onboarding incorrects'; end if;
  select enabled_services into actifs from public.buildings where id = neuf;
  if actifs <> '{pressing,colis}'::service_type[] then raise exception 'enabled_services non synchronisé à la création'; end if;

  -- Le concierge lit son catalogue, jamais celui d'un autre immeuble.
  perform pg_temp.impersonate(concierge1, 'concierge', b1);
  select count(*) into n from public.building_services where building_id = b1;
  if n <> 5 then raise exception 'Catalogue illisible par le concierge'; end if;
  select count(*) into n from public.building_services where building_id <> b1;
  if n <> 0 then raise exception 'Catalogue d’un autre immeuble visible'; end if;
  update public.building_services set commission_rate = 99 where building_id = b1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Le concierge modifie les tarifs'; end if;
  perform pg_temp.reset_role();

  -- Le syndic n'a aucun accès au catalogue ni aux modèles (PRD §4).
  perform pg_temp.impersonate(syndic1, 'syndic', b1);
  select count(*) into n from public.building_services;
  if n <> 0 then raise exception 'Le syndic voit le catalogue'; end if;
  select count(*) into n from public.notification_templates;
  if n <> 0 then raise exception 'Le syndic voit les modèles de notification'; end if;
  perform pg_temp.reset_role();

  -- L'admin pilote son immeuble uniquement.
  perform pg_temp.impersonate(admin1, 'admin', b1);
  update public.building_services set base_price_cents = 3300, commission_rate = 12.50
    where building_id = b1 and service = 'pressing';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'L’admin ne peut pas régler son catalogue'; end if;
  update public.building_services set base_price_cents = 1 where building_id = b2;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Tarifs d’un autre immeuble modifiables'; end if;
  failed := false;
  begin update public.building_services set commission_rate = 140 where building_id = b1 and service = 'pressing';
  exception when check_violation then failed := true; end;
  if not failed then raise exception 'Commission supérieure à 100 %% acceptée'; end if;

  -- Fermeture d'un service : synchronisation et refus des nouvelles demandes.
  update public.building_services set enabled = false where building_id = b1 and service = 'colis';
  select enabled_services into actifs from public.buildings where id = b1;
  if 'colis' = any(actifs) then raise exception 'Service fermé toujours listé sur l’immeuble'; end if;
  failed := false;
  begin insert into public.service_requests (building_id, resident_id, service) values (b1, resident1, 'colis');
  exception when check_violation then failed := true; end;
  if not failed then raise exception 'Demande acceptée sur un service fermé'; end if;
  update public.building_services set enabled = true where building_id = b1 and service = 'colis';
  insert into public.service_requests (building_id, resident_id, service) values (b1, resident1, 'colis');

  -- Modèles de notification : écriture gestionnaire, lecture staff de l'immeuble.
  insert into public.notification_templates (building_id, slug, label, title, body)
    values (b1, 'test_modele', 'Modèle test', 'Titre test', 'Corps [date].') returning id into modele;
  perform pg_temp.reset_role();
  perform pg_temp.impersonate(concierge1, 'concierge', b1);
  select count(*) into n from public.notification_templates where id = modele;
  if n <> 1 then raise exception 'Modèle invisible pour le concierge de l’immeuble'; end if;
  failed := false;
  begin insert into public.notification_templates (building_id, slug, label, title, body)
    values (b1, 'interdit', 'Interdit', 'Titre', 'Corps');
  exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'Le concierge crée des modèles'; end if;
  perform pg_temp.reset_role();
  perform pg_temp.impersonate(concierge2, 'concierge', b2);
  select count(*) into n from public.notification_templates where id = modele;
  if n <> 0 then raise exception 'Modèle visible hors immeuble'; end if;
  perform pg_temp.reset_role();

  -- Le super-admin règle n'importe quel immeuble.
  perform pg_temp.impersonate(superadm, 'super_admin', b1);
  update public.building_services set partner_name = 'Partenaire global' where building_id = b2 and service = 'pressing';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Le super-admin ne peut pas régler un autre immeuble'; end if;
  perform pg_temp.reset_role();
  raise notice 'TESTS CATALOGUE PASSÉS';
end;
$$;
-- Colis : preuve photo, créneau corrigeable et rappel J+2 unique.
do $$
declare
  b1 constant uuid := '11111111-1111-1111-1111-111111111111';
  b2 constant uuid := '22222222-2222-2222-2222-222222222222';
  concierge1 constant uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  concierge2 constant uuid := 'aaaaaaaa-0000-0000-0000-000000000005';
  resident1 uuid; ancien uuid; recent uuid; n integer; sent integer; failed boolean;
begin
  select id into strict resident1 from public.residents where building_id = b1 limit 1;
  perform pg_temp.impersonate(concierge1, 'concierge', b1);
  insert into public.parcels (building_id, resident_id, tracking_code, received_at)
    values (b1, resident1, 'TEST-RAPPEL', now() - interval '3 days') returning id into ancien;
  insert into public.parcels (building_id, resident_id, tracking_code, received_at)
    values (b1, resident1, 'TEST-RECENT', now()) returning id into recent;

  sent := public.send_parcel_reminders();
  if sent < 1 then raise exception 'Aucun rappel J+2 envoyé'; end if;
  select count(*) into n from public.notifications
   where event = 'rappel_colis_non_retire' and payload->>'operation_id' = ancien::text;
  if n <> 2 then raise exception 'Rappel J+2 absent ou dupliqué : %', n; end if;
  if not exists (select 1 from public.parcels where id = ancien and reminder_sent_at = now()) then
    raise exception 'Rappel non horodaté'; end if;
  if exists (select 1 from public.parcels where id = recent and reminder_sent_at is not null) then
    raise exception 'Rappel envoyé avant deux jours'; end if;

  -- Rejouer l'opération ne renvoie rien : le rappel est unique par colis.
  perform public.send_parcel_reminders();
  select count(*) into n from public.notifications
   where event = 'rappel_colis_non_retire' and payload->>'operation_id' = ancien::text;
  if n <> 2 then raise exception 'Rappel J+2 rejoué : %', n; end if;

  -- Créneau corrigeable tant que le colis est en loge, figé après remise.
  update public.parcels set scheduled_delivery_at = now() + interval '4 hours' where id = ancien;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Créneau non modifiable avant remise'; end if;
  update public.parcels set status = 'stocke' where id = ancien;
  update public.parcels set status = 'notifie' where id = ancien;
  update public.parcels set status = 'remis' where id = ancien;
  failed := false;
  begin update public.parcels set scheduled_delivery_at = now() where id = ancien;
  exception when check_violation then failed := true; end;
  if not failed then raise exception 'Créneau modifié après remise'; end if;

  -- La preuve photo ne s'efface pas.
  update public.parcels set photo_path = b1 || '/' || recent || '/preuve.jpg' where id = recent;
  failed := false;
  begin update public.parcels set photo_path = null where id = recent;
  exception when check_violation then failed := true; end;
  if not failed then raise exception 'Preuve photo effaçable'; end if;

  perform pg_temp.reset_role();
  perform pg_temp.impersonate(concierge2, 'concierge', b2);
  select count(*) into n from public.parcels where id in (ancien, recent);
  if n <> 0 then raise exception 'Colis visibles hors immeuble'; end if;
  update public.parcels set storage_location = 'Interdit' where id = recent;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Colis modifiable hors immeuble'; end if;
  perform pg_temp.reset_role();
  raise notice 'TESTS COLIS PASSÉS';
end;
$$;
-- Affiliations : cycle d'un partage, commission figée et isolation.
do $$
declare
  b1 constant uuid := '11111111-1111-1111-1111-111111111111';
  b2 constant uuid := '22222222-2222-2222-2222-222222222222';
  concierge1 constant uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  concierge2 constant uuid := 'aaaaaaaa-0000-0000-0000-000000000005';
  resident1 uuid; partenaire uuid; simple uuid; partage uuid; autre uuid;
  n integer; failed boolean;
begin
  select id into strict resident1 from public.residents where building_id = b1 limit 1;
  perform pg_temp.impersonate(concierge1, 'concierge', b1);

  -- Un partenaire porte toujours un taux.
  failed := false;
  begin insert into public.recommendations (building_id, category, name, is_partner)
    values (b1, 'restaurant', 'Partenaire sans taux', true);
  exception when check_violation then failed := true; end;
  if not failed then raise exception 'Partenaire accepté sans taux de commission'; end if;

  insert into public.recommendations (building_id, category, name, is_partner, commission_rate)
    values (b1, 'restaurant', 'Table partenaire TEST', true, 10.00) returning id into partenaire;
  insert into public.recommendations (building_id, category, name)
    values (b1, 'artisan', 'Artisan non affilié TEST') returning id into simple;

  -- Le partage naît « proposée », sans montant même si on en fournit un.
  insert into public.recommendation_shares (building_id, recommendation_id, resident_id, booking_amount_cents)
    values (b1, partenaire, resident1, 9999) returning id into partage;
  if not exists (select 1 from public.recommendation_shares
                  where id = partage and status = 'proposee'
                    and booking_amount_cents is null and status_changed_at = now()) then
    raise exception 'État initial du partage incorrect'; end if;

  -- Pas de raccourci vers la réservation.
  failed := false;
  begin update public.recommendation_shares set status = 'reservee', booking_amount_cents = 10000 where id = partage;
  exception when check_violation then failed := true; end;
  if not failed then raise exception 'Réservation sans consultation préalable'; end if;

  update public.recommendation_shares set status = 'consultee' where id = partage;
  failed := false;
  begin update public.recommendation_shares set status = 'reservee' where id = partage;
  exception when check_violation then failed := true; end;
  if not failed then raise exception 'Réservation acceptée sans montant'; end if;

  update public.recommendation_shares set status = 'reservee', booking_amount_cents = 20000 where id = partage;
  if not exists (select 1 from public.recommendation_shares where id = partage and commission_cents = 2000) then
    raise exception 'Commission mal calculée'; end if;

  -- Montant et commission figés, y compris si le taux du partenaire change.
  update public.recommendation_shares set feedback = 'Très satisfait' where id = partage;
  update public.recommendations set commission_rate = 50.00 where id = partenaire;
  if not exists (select 1 from public.recommendation_shares
                  where id = partage and commission_cents = 2000 and booking_amount_cents = 20000) then
    raise exception 'Commission acquise modifiée après coup'; end if;
  failed := false;
  begin update public.recommendation_shares set status = 'refusee' where id = partage;
  exception when check_violation then failed := true; end;
  if not failed then raise exception 'Réservation annulée par simple transition'; end if;

  -- Sans affiliation, la mise en relation est suivie mais ne rapporte rien.
  insert into public.recommendation_shares (building_id, recommendation_id, resident_id)
    values (b1, simple, resident1) returning id into autre;
  update public.recommendation_shares set status = 'consultee' where id = autre;
  update public.recommendation_shares set status = 'reservee', booking_amount_cents = 30000 where id = autre;
  if not exists (select 1 from public.recommendation_shares where id = autre and commission_cents = 0) then
    raise exception 'Commission versée sur une adresse non affiliée'; end if;

  perform pg_temp.reset_role();
  perform pg_temp.impersonate(concierge2, 'concierge', b2);
  select count(*) into n from public.recommendation_shares where id in (partage, autre);
  if n <> 0 then raise exception 'Partages visibles hors immeuble'; end if;
  update public.recommendations set commission_rate = 99 where id = partenaire;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Taux de commission modifiable hors immeuble'; end if;
  perform pg_temp.reset_role();
  raise notice 'TESTS AFFILIATIONS PASSÉS';
end;
$$;
-- WhatsApp entrant : rattachement d'un numéro, fil unique et lecture.
do $$
declare
  b1 constant uuid := '11111111-1111-1111-1111-111111111111';
  b2 constant uuid := '22222222-2222-2222-2222-222222222222';
  concierge1 constant uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  resident1 uuid; resident2 uuid; fil uuid; autre uuid; n integer; failed boolean;
  lu timestamptz;
begin
  select id into strict resident1 from public.residents
   where building_id = b1 and phone is not null limit 1;
  select id into strict resident2 from public.residents
   where building_id = b2 and phone is not null limit 1;

  -- Le numéro retrouve son résident quelle que soit la saisie de la fiche.
  update public.residents set phone = '06 12 34 56 78' where id = resident1;
  select count(*) into n from public.resident_by_whatsapp('33612345678');
  if n <> 1 then raise exception 'Numéro WhatsApp non rattaché : %', n; end if;
  update public.residents set phone = '+33 6 12 34 56 78' where id = resident1;
  select count(*) into n from public.resident_by_whatsapp('+33612345678');
  if n <> 1 then raise exception 'Format E.164 non reconnu'; end if;

  -- Deux immeubles portant le même numéro : l'appelant doit pouvoir refuser.
  update public.residents set phone = '0612345678' where id = resident2;
  select count(*) into n from public.resident_by_whatsapp('33612345678');
  if n <> 2 then raise exception 'Ambiguïté de numéro non signalée : %', n; end if;
  update public.residents set phone = '0611111111' where id = resident2;

  perform pg_temp.impersonate(concierge1, 'concierge', b1);
  insert into public.conversations (building_id, resident_id, channel, external_thread_id)
    values (b1, resident1, 'whatsapp', '33612345678')
    on conflict (resident_id, channel) do update set external_thread_id = excluded.external_thread_id
    returning id into fil;

  -- Un identifiant de fil n'appartient qu'à une conversation.
  select id into strict autre from public.residents where building_id = b1 and id <> resident1 limit 1;
  failed := false;
  begin insert into public.conversations (building_id, resident_id, channel, external_thread_id)
    values (b1, autre, 'whatsapp', '33612345678');
  exception when unique_violation then failed := true; end;
  if not failed then raise exception 'Deux fils pour le même numéro WhatsApp'; end if;

  -- Un message entrant rouvre le fil et le laisse non lu.
  -- now() est figé dans la transaction : la lecture est datée d'avant.
  update public.conversations set last_read_at = now() - interval '1 hour', status = 'resolue' where id = fil;
  insert into public.messages (building_id, conversation_id, direction, body, external_message_id, delivery_status)
    values (b1, fil, 'entrant', 'Bonjour', 'wamid.TEST-1', 'livre');
  select last_read_at into lu from public.conversations where id = fil;
  if not exists (select 1 from public.conversations
                  where id = fil and status = 'ouverte' and last_message_at > lu) then
    raise exception 'Message entrant sans réouverture ni non-lu'; end if;

  -- Le même événement rejoué par Meta ne crée pas de doublon.
  failed := false;
  begin insert into public.messages (building_id, conversation_id, direction, body, external_message_id)
    values (b1, fil, 'entrant', 'Bonjour', 'wamid.TEST-1');
  exception when unique_violation then failed := true; end;
  if not failed then raise exception 'Message entrant dupliqué'; end if;

  -- Répondre vaut lecture.
  insert into public.messages (building_id, conversation_id, direction, sender_profile_id, body)
    values (b1, fil, 'sortant', concierge1, 'Bonjour, je vérifie.');
  if not exists (select 1 from public.conversations where id = fil and last_read_at = last_message_at) then
    raise exception 'Réponse de la loge sans marquage de lecture'; end if;
  perform pg_temp.reset_role();

  -- La fonction de rattachement reste hors de portée d'un client authentifié.
  if has_function_privilege('authenticated', 'public.resident_by_whatsapp(text)', 'execute') then
    raise exception 'resident_by_whatsapp exposée au client'; end if;
  raise notice 'TESTS WHATSAPP ENTRANT PASSÉS';
end;
$$;
-- Reporting mensuel du syndic : la fonction SECURITY DEFINER ne livre que
-- des agrégats, et jamais ceux d'un autre immeuble.
do $$
declare
  marly constant uuid := '11111111-1111-1111-1111-111111111111';
  malesherbes constant uuid := '33333333-3333-3333-3333-333333333333';
  syndic1 constant uuid := 'aaaaaaaa-0000-0000-0000-000000000004';
  syndic3 constant uuid := 'aaaaaaaa-0000-0000-0000-000000000007';
  mois constant date := date_trunc('month', now())::date;
  rapport jsonb;
  texte text;
  donnee text;
  n integer;
  failed boolean;
begin
  perform pg_temp.impersonate(syndic1, 'syndic', marly);
  rapport := public.syndic_monthly_report(marly, mois);
  if rapport is null or jsonb_typeof(rapport) <> 'object' then
    raise exception 'Rapport syndic absent'; end if;
  if (rapport #>> '{requests,total}')::integer < 0 then
    raise exception 'Total de demandes incohérent'; end if;
  if not (rapport ? 'sla' and rapport ? 'incidents' and rapport ? 'satisfaction'
          and rapport ? 'announcements' and rapport ? 'syndic_messages' and rapport ? 'trend') then
    raise exception 'Rapport syndic incomplet'; end if;
  if jsonb_array_length(rapport -> 'trend') <> 12 then
    raise exception 'Tendance sur douze mois attendue'; end if;
  -- La satisfaction n'est qu'une moyenne : aucune note individuelle.
  if jsonb_typeof(rapport -> 'satisfaction' -> 'average') not in ('number', 'null') then
    raise exception 'Satisfaction détaillée exposée'; end if;
  texte := rapport::text;
  perform pg_temp.reset_role();

  -- Aucun nom, e-mail ou téléphone de résident ne doit transiter.
  for donnee in
    select full_name from public.residents where building_id = marly
    union all select email from public.residents where building_id = marly and email is not null
    union all select phone from public.residents where building_id = marly and phone is not null
  loop
    if position(donnee in texte) > 0 then
      raise exception 'Donnée nominative exposée dans le rapport syndic : %', donnee; end if;
  end loop;

  -- Le syndic d'un autre immeuble n'obtient rien sur Le Marly.
  perform pg_temp.impersonate(syndic3, 'syndic', malesherbes);
  failed := false;
  begin perform public.syndic_monthly_report(marly, mois);
  exception when others then failed := true; end;
  if not failed then raise exception 'Reporting d’un autre immeuble accessible au syndic'; end if;
  if (public.syndic_monthly_report(malesherbes, mois) #>> '{residents}')::integer < 0 then
    raise exception 'Reporting de son propre immeuble refusé'; end if;
  -- Et il n'a toujours aucun accès direct aux demandes qu'il fait compter.
  select count(*) into n from public.service_requests where building_id = malesherbes;
  if n <> 0 then raise exception 'Demandes lisibles en direct par le syndic'; end if;
  perform pg_temp.reset_role();

  -- Sans session, la fonction est hors de portée.
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
  failed := false;
  begin perform public.syndic_monthly_report(marly, mois);
  exception when others then failed := true; end;
  if not failed then raise exception 'Reporting accessible sans authentification'; end if;
  perform pg_temp.reset_role();
  if has_function_privilege('anon', 'public.syndic_monthly_report(uuid, date)', 'execute') then
    raise exception 'Reporting syndic exécutable par anon'; end if;

  raise notice 'TESTS REPORTING SYNDIC PASSÉS';
end;
$$;
rollback;
