-- ============================================================
-- Seed local Maison Cavalier — données de démo (jamais en prod)
-- Comptes : mot de passe unique « cavalier123 »
--   concierge@demo.mc   (concierge, Le Marly)
--   admin@demo.mc       (admin, Le Marly)
--   super@demo.mc       (super_admin)
--   syndic@demo.mc      (syndic, Le Marly)
--   concierge2@demo.mc  (concierge, Villa Ségur — pour tester l'isolation, building volontairement peu peuplé)
--   concierge3@demo.mc  (concierge, Hôtel Malesherbes)
--   syndic3@demo.mc     (syndic, Hôtel Malesherbes)
-- ============================================================

-- ---------- Immeubles ----------
insert into public.buildings (id, name, address, b2b_plan) values
  ('11111111-1111-1111-1111-111111111111', 'Le Marly', '12 avenue Montaigne, 75008 Paris', 'signature'),
  ('22222222-2222-2222-2222-222222222222', 'Villa Ségur', '4 avenue de Ségur, 75007 Paris', 'essentiel'),
  ('33333333-3333-3333-3333-333333333333', 'Hôtel Malesherbes', '3 boulevard Malesherbes, 75008 Paris', 'premium');

-- ---------- Utilisateurs auth ----------
-- app_metadata porte role + building_id (lisibles par les policies RLS,
-- modifiables uniquement par la clé service-role).
do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'concierge@demo.mc',  'concierge',   '11111111-1111-1111-1111-111111111111'::uuid),
      ('aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'admin@demo.mc',      'admin',       '11111111-1111-1111-1111-111111111111'::uuid),
      ('aaaaaaaa-0000-0000-0000-000000000003'::uuid, 'super@demo.mc',      'super_admin', '11111111-1111-1111-1111-111111111111'::uuid),
      ('aaaaaaaa-0000-0000-0000-000000000004'::uuid, 'syndic@demo.mc',     'syndic',      '11111111-1111-1111-1111-111111111111'::uuid),
      ('aaaaaaaa-0000-0000-0000-000000000005'::uuid, 'concierge2@demo.mc', 'concierge',   '22222222-2222-2222-2222-222222222222'::uuid),
      ('aaaaaaaa-0000-0000-0000-000000000006'::uuid, 'concierge3@demo.mc', 'concierge',   '33333333-3333-3333-3333-333333333333'::uuid),
      ('aaaaaaaa-0000-0000-0000-000000000007'::uuid, 'syndic3@demo.mc',    'syndic',      '33333333-3333-3333-3333-333333333333'::uuid)
    ) as t(u_id, u_email, u_role, u_building)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', u.u_id, 'authenticated', 'authenticated',
      u.u_email, extensions.crypt('cavalier123', extensions.gen_salt('bf')), now(),
      jsonb_build_object(
        'provider', 'email', 'providers', jsonb_build_array('email'),
        'role', u.u_role, 'building_id', u.u_building
      ),
      '{}', now(), now(), '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), u.u_id, u.u_id::text,
      jsonb_build_object('sub', u.u_id::text, 'email', u.u_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end loop;
end;
$$;

insert into public.profiles (id, building_id, role, full_name, phone) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'concierge',   'Jules Fontaine',              '+33612345601'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'admin',       'Claire Beaumont',             '+33612345602'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'super_admin', 'Alexandre Cavalier',          '+33612345603'),
  ('aaaaaaaa-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'syndic',      'Cabinet Perrin',              '+33612345604'),
  ('aaaaaaaa-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'concierge',   'Margot Delcourt',             '+33612345605'),
  ('aaaaaaaa-0000-0000-0000-000000000006', '33333333-3333-3333-3333-333333333333', 'concierge',   'Margaux Isnard',              '+33612345606'),
  ('aaaaaaaa-0000-0000-0000-000000000007', '33333333-3333-3333-3333-333333333333', 'syndic',      'Cabinet Lefèvre & Associés',  '+33612345607');

-- ---------- Résidents (Le Marly, 15) ----------
insert into public.residents (id, building_id, full_name, email, phone, floor, unit, owner_status, preferences, special_access, internal_notes, satisfaction_score) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Henri Dubois',        'h.dubois@example.com',     '+33698765401', '3', '3A', 'proprietaire', 'Pressing chaque lundi matin. Journaux : Les Échos.',        'Ascenseur privatif aile est', 'Client fidèle depuis 2024, très attaché à la discrétion.', 4.80),
  ('bbbbbbbb-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Isabelle Morel',      'i.morel@example.com',      '+33698765402', '5', '5B', 'proprietaire', 'Voiturier fréquent le week-end.',                            null, 'Préférence : chauffeur M. Karim.', 4.95),
  ('bbbbbbbb-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Édouard Lambert',     'e.lambert@example.com',    '+33698765403', '2', '2A', 'locataire',    'Colis volumineux (cave).',                                   'Badge cave n°12', null, 4.20),
  ('bbbbbbbb-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Sophie de Vigny',     's.devigny@example.com',    '+33698765404', '6', '6A', 'proprietaire', 'Billetterie opéra & PSG hospitalité.',                       null, 'VIP — anniversaire le 14 mars.', 5.00),
  ('bbbbbbbb-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Marc-Antoine Girard', 'ma.girard@example.com',    '+33698765405', '1', '1B', 'locataire',    null, null, null, 3.90),
  ('bbbbbbbb-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'Camille Aubert',      'c.aubert@example.com',     '+33698765406', '4', '4A', 'proprietaire', 'Personal shopper mode.',                                     null, null, 4.60),
  ('bbbbbbbb-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'Thomas Renaud',       't.renaud@example.com',     '+33698765407', '4', '4B', 'locataire',    'Pressing chemises x10 / semaine.',                           null, null, 4.40),
  ('bbbbbbbb-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'Anne-Laure Chastel',  'al.chastel@example.com',   '+33698765408', '5', '5A', 'proprietaire', null, 'Accès terrasse commune', null, 4.75),
  ('bbbbbbbb-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'Victor Hennequin',    'v.hennequin@example.com',  '+33698765409', '2', '2B', 'proprietaire', 'Voiturier quotidien 8h30.',                                  null, 'Véhicule : Bentley Bentayga grise.', 4.10),
  ('bbbbbbbb-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'Élise Fournier',      'e.fournier@example.com',   '+33698765410', '3', '3B', 'locataire',    null, null, null, null),
  ('bbbbbbbb-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'Gabriel Estève',      'g.esteve@example.com',     '+33698765411', '6', '6B', 'proprietaire', 'Chauffeur VTC quotidien vers La Défense.',                   null, 'Dirigeant, discrétion absolue requise.', 4.55),
  ('bbbbbbbb-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', 'Constance Vasseur-Roy','c.vasseurroy@example.com','+33698765412', '1', '1A', 'locataire',    'Colis mode fréquents (dressing).',                           null, null, 4.30),
  ('bbbbbbbb-0000-0000-0000-000000000013', '11111111-1111-1111-1111-111111111111', 'Frédéric Choiseul',   'f.choiseul@example.com',   '+33698765413', '6', '6C', 'proprietaire', 'Personal shopper art & antiquités.',                         null, null, 4.90),
  ('bbbbbbbb-0000-0000-0000-000000000014', '11111111-1111-1111-1111-111111111111', 'Diane Ferrand',       'd.ferrand@example.com',    '+33698765414', '2', '2C', 'locataire',    null, null, 'Nouvelle résidente, arrivée le mois dernier.', null),
  ('bbbbbbbb-0000-0000-0000-000000000015', '11111111-1111-1111-1111-111111111111', 'Louis-Philippe d''Aumont','lp.aumont@example.com','+33698765415', '6', '6D', 'proprietaire', 'Billetterie opéra récurrente, loge personnelle.',            null, null, 4.85);

-- ---------- Résidents (Villa Ségur, 6 — building volontairement peu actif pour l'isolation RLS) ----------
insert into public.residents (id, building_id, full_name, email, phone, floor, unit, owner_status) values
  ('cccccccc-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Paul Vasseur',      'p.vasseur@example.com',   '+33698765501', '1', '1A', 'proprietaire'),
  ('cccccccc-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Nadia Berthier',    'n.berthier@example.com',  '+33698765502', '2', '2A', 'locataire'),
  ('cccccccc-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Odile Rambert',     'o.rambert@example.com',   '+33698765503', '3', '3A', 'locataire'),
  ('cccccccc-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'Grégoire Fabre',    'g.fabre@example.com',     '+33698765504', '1', '1B', 'proprietaire'),
  ('cccccccc-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'Camille Ostrowski', 'c.ostrowski@example.com', '+33698765505', '4', '4A', 'proprietaire'),
  ('cccccccc-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'Julien Sorel',      'j.sorel@example.com',     '+33698765506', '2', '2B', 'locataire');

-- ---------- Résidents (Hôtel Malesherbes, 8) ----------
insert into public.residents (id, building_id, full_name, email, phone, floor, unit, owner_status, preferences, special_access, internal_notes, satisfaction_score) values
  ('dddddddd-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Béatrice Solenn',  'b.solenn@example.com',   '+33698765601', '3', '3A', 'proprietaire', 'Pressing linge de maison, 2 fois par semaine.', null, null, 4.50),
  ('dddddddd-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'Antoine Ravier',   'a.ravier@example.com',   '+33698765602', '5', '5A', 'locataire',    null, null, null, 3.95),
  ('dddddddd-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'Wei Zhang',        'w.zhang@example.com',    '+33698765603', '6', '6A', 'proprietaire', 'Personal shopper haute couture, saisons FW/SS.', 'Penthouse — accès ascenseur dédié', null, 4.92),
  ('dddddddd-0000-0000-0000-000000000004', '33333333-3333-3333-3333-333333333333', 'Nour El Amrani',   'n.elamrani@example.com', '+33698765604', '2', '2A', 'locataire',    null, null, null, 4.15),
  ('dddddddd-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', 'Charles Pemberton','c.pemberton@example.com','+33698765605', '4', '4B', 'proprietaire', 'Chauffeur aéroport fréquent (Le Bourget).', null, 'Voyage d''affaires 2 à 3 fois par mois.', 4.60),
  ('dddddddd-0000-0000-0000-000000000006', '33333333-3333-3333-3333-333333333333', 'Inès Vaillant',    'i.vaillant@example.com', '+33698765606', '1', '1A', 'locataire',    null, null, 'Nouvelle résidente.', null),
  ('dddddddd-0000-0000-0000-000000000007', '33333333-3333-3333-3333-333333333333', 'Otto Bergman',     'o.bergman@example.com',  '+33698765607', '5', '5B', 'proprietaire', 'Billetterie événements sportifs.', null, null, 4.30),
  ('dddddddd-0000-0000-0000-000000000008', '33333333-3333-3333-3333-333333333333', 'Léna Duchâteau',   'l.duchateau@example.com','+33698765608', '3', '3B', 'locataire',    null, null, null, 4.05);

-- ---------- Demandes de service (Le Marly, 14) ----------
insert into public.service_requests (building_id, resident_id, service, status, priority, payload, amount_cents, sla_deadline) values
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000001', 'pressing',          'en_cours',   'normale', '{"articles": "3 costumes, 5 chemises"}',            8500,  now() + interval '4 hours'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000009', 'chauffeur',         'nouveau',    'urgente', '{"destination": "Aéroport CDG, Terminal 2E"}',       12000, now() + interval '30 minutes'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000003', 'colis',             'en_attente', 'normale', '{"transporteur": "DHL", "reference": "JD014"}',      null,  now() + interval '2 days'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000004', 'billetterie',       'nouveau',    'normale', '{"evenement": "PSG - OM, loge hospitalité"}',        95000, now() + interval '1 day'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000006', 'personal_shopper',  'termine',    'normale', '{"mission": "Cadeau anniversaire, budget 500€"}',    52000, null),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000007', 'pressing',          'termine',    'normale', '{"articles": "8 chemises"}',                          6000,  null),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000008', 'colis',             'termine',    'normale', '{"transporteur": "UPS", "reference": "AL229"}',       null,  null),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000002', 'chauffeur',         'termine',    'normale', '{"destination": "Gare de Lyon"}',                     7800,  null),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000015', 'billetterie',       'en_cours',   'normale', '{"evenement": "Opéra Bastille, loge personnelle"}',   61000, now() + interval '6 hours'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000012', 'personal_shopper',  'en_attente', 'normale', '{"mission": "Sélection dressing saison"}',           null,  now() + interval '1 day'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000011', 'chauffeur',         'nouveau',    'urgente', '{"destination": "La Défense, 8h00"}',                 9500,  now() - interval '12 minutes'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000013', 'pressing',          'en_attente', 'normale', '{"articles": "Robe de soirée, nettoyage délicat"}',   null,  now() + interval '1 day'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000014', 'colis',             'nouveau',    'normale', '{"transporteur": "Colissimo", "reference": "DF441"}',null,  now() + interval '3 days'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000005', 'billetterie',       'termine',    'normale', '{"evenement": "Roland-Garros, court central"}',       18000, null);

-- ---------- Demandes de service (Hôtel Malesherbes, 8) ----------
insert into public.service_requests (building_id, resident_id, service, status, priority, payload, amount_cents, sla_deadline) values
  ('33333333-3333-3333-3333-333333333333', 'dddddddd-0000-0000-0000-000000000005', 'chauffeur',         'nouveau',    'urgente', '{"destination": "Aéroport du Bourget"}',              14000, now() + interval '15 minutes'),
  ('33333333-3333-3333-3333-333333333333', 'dddddddd-0000-0000-0000-000000000001', 'pressing',          'en_cours',   'normale', '{"articles": "Linge de maison, 6 pièces"}',          7000,  now() + interval '5 hours'),
  ('33333333-3333-3333-3333-333333333333', 'dddddddd-0000-0000-0000-000000000002', 'colis',             'en_attente', 'normale', '{"transporteur": "FedEx", "reference": "AR552"}',    null,  now() + interval '2 days'),
  ('33333333-3333-3333-3333-333333333333', 'dddddddd-0000-0000-0000-000000000003', 'personal_shopper',  'nouveau',    'urgente', '{"mission": "Garde-robe collection printemps"}',     78000, now() - interval '5 minutes'),
  ('33333333-3333-3333-3333-333333333333', 'dddddddd-0000-0000-0000-000000000007', 'billetterie',       'en_cours',   'normale', '{"evenement": "Finale Roland-Garros"}',               43000, now() + interval '8 hours'),
  ('33333333-3333-3333-3333-333333333333', 'dddddddd-0000-0000-0000-000000000004', 'chauffeur',         'termine',    'normale', '{"destination": "Gare Montparnasse"}',                5500,  null),
  ('33333333-3333-3333-3333-333333333333', 'dddddddd-0000-0000-0000-000000000008', 'pressing',          'termine',    'normale', '{"articles": "4 chemises, 1 tailleur"}',              4000,  null),
  ('33333333-3333-3333-3333-333333333333', 'dddddddd-0000-0000-0000-000000000006', 'colis',             'nouveau',    'normale', '{"transporteur": "Colissimo", "reference": "IV003"}',null,  now() + interval '2 days');

-- ---------- Devis (Le Marly, 5) ----------
insert into public.quotes (building_id, resident_id, provider, label, amount_cents, status) values
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000002', 'Blanchisserie du Faubourg',    'Pressing haute couture — forfait trimestriel', 32000,  'envoye'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000004', 'Agence Style & Co',            'Personal Shopper — sélection joaillerie',      145000, 'accepte'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000015','Fnac Spectacles Pro',           'Billetterie — loge Opéra Bastille, saison',    280000, 'en_attente'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000011', 'Cavalier Fleet Premium',       'Chauffeur — mise à disposition mensuelle',     360000, 'accepte'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000013', 'Maison Artcurial Conseil',     'Personal Shopper — acquisitions antiquités',   420000, 'refuse');

-- ---------- Devis (Hôtel Malesherbes, 3) ----------
insert into public.quotes (building_id, resident_id, provider, label, amount_cents, status) values
  ('33333333-3333-3333-3333-333333333333', 'dddddddd-0000-0000-0000-000000000003', 'Agence Style & Co',        'Personal Shopper — garde-robe saison',      220000, 'envoye'),
  ('33333333-3333-3333-3333-333333333333', 'dddddddd-0000-0000-0000-000000000005', 'Cavalier Fleet Premium',   'Chauffeur — abonnement transferts aéroport', 98000,  'en_attente'),
  ('33333333-3333-3333-3333-333333333333', 'dddddddd-0000-0000-0000-000000000001', 'Blanchisserie du Faubourg','Pressing — linge de maison, forfait annuel', 26000,  'accepte');

-- ---------- Messages syndic (Le Marly, 6) ----------
insert into public.syndic_messages (building_id, sender_profile_id, body, is_incident, created_at) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'Bonjour, le prestataire ascenseur est passé ce matin : contrôle annuel conforme, rapport à suivre.', false, now() - interval '6 days'),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000004', 'Merci. Pouvez-vous transmettre le PV dès réception ?', false, now() - interval '6 days' + interval '20 minutes'),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'Incident : fuite détectée au parking niveau -1, intervention plombier programmée à 16h.', true, now() - interval '2 days'),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'Rapport mensuel de fréquentation transmis : 86 services traités, satisfaction moyenne 4,6/5.', false, now() - interval '1 day'),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000004', 'Bien reçu, merci. Pouvez-vous confirmer la date de la prochaine assemblée générale ?', false, now() - interval '20 hours'),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'AG prévue le 24 juillet à 18h30 en salle de réunion. Convocations envoyées par le syndic.', false, now() - interval '18 hours');

-- ---------- Messages syndic (Hôtel Malesherbes, 2) ----------
insert into public.syndic_messages (building_id, sender_profile_id, body, is_incident, created_at) values
  ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000006', 'Bonjour, le devis pressing linge de maison a été validé par Mme Solenn. Facture jointe.', false, now() - interval '3 days'),
  ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000007', 'Parfait, merci pour le suivi. Bonne journée.', false, now() - interval '3 days' + interval '40 minutes');

-- ---------- Notifications historisées (Le Marly, 4) ----------
insert into public.notifications (building_id, recipient_resident_id, event, channel, payload, sent_at) values
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000001', 'pressing_pret',       'push',     '{"title": "Votre pressing est prêt"}',                now() - interval '3 hours'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000009', 'chauffeur_en_route',  'push',     '{"title": "Votre chauffeur arrive"}',                 now() - interval '1 hour'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000003', 'colis_recu',          'whatsapp', '{"title": "Un colis vous attend à la loge"}',         now() - interval '2 days'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000004', 'offre_billetterie',   'email',    '{"title": "Loge PSG disponible ce week-end"}',        now() - interval '5 days');
