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
  ('33333333-3333-3333-3333-333333333333', 'Hôtel Malesherbes', '3 boulevard Malesherbes, 75008 Paris', 'premium'),
  ('44444444-4444-4444-4444-444444444444', 'Hôtel de Marigny', '25 rue du Faubourg Saint-Honoré, 75008 Paris', 'signature'),
  ('55555555-5555-5555-5555-555555555555', 'Résidence Foch', '8 avenue Foch, 75116 Paris', 'premium'),
  ('66666666-6666-6666-6666-666666666666', 'Le Trocadéro', '15 avenue Raymond Poincaré, 75116 Paris', 'essentiel'),
  ('77777777-7777-7777-7777-777777777777', 'Villa Montsouris', '22 rue Nansouty, 75014 Paris', 'essentiel'),
  ('88888888-8888-8888-8888-888888888888', 'Hôtel particulier Varenne', '40 rue de Varenne, 75007 Paris', 'premium');

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

-- ---------- Résidents (Hôtel de Marigny, 5) ----------
insert into public.residents (id, building_id, full_name, email, phone, floor, unit, owner_status, preferences, satisfaction_score) values
  ('eeeeeeee-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'Astrid Lindqvist',   'a.lindqvist@example.com', '+33698765701', '4', '4A', 'proprietaire', 'Fleuriste hebdomadaire.',                 4.70),
  ('eeeeeeee-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'Bertrand Achille',   'b.achille@example.com',   '+33698765702', '2', '2B', 'locataire',    null,                                       4.10),
  ('eeeeeeee-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', 'Clémence Duroy',     'c.duroy@example.com',     '+33698765703', '5', '5A', 'proprietaire', 'Chauffeur quotidien vers Roissy.',         4.85),
  ('eeeeeeee-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444444', 'Younes El Fassi',    'y.elfassi@example.com',   '+33698765704', '3', '3C', 'locataire',    null,                                       null),
  ('eeeeeeee-0000-0000-0000-000000000005', '44444444-4444-4444-4444-444444444444', 'Solène Marchetti',   's.marchetti@example.com', '+33698765705', '1', '1A', 'proprietaire', 'Personal shopper haute joaillerie.',      4.95);

-- ---------- Résidents (Résidence Foch, 6) ----------
insert into public.residents (id, building_id, full_name, email, phone, floor, unit, owner_status, preferences, satisfaction_score) values
  ('ffffffff-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', 'Grégoire Vandenberghe','g.vandenberghe@example.com', '+33698765801', '6', '6A', 'proprietaire', 'Voiturier quotidien.',              4.60),
  ('ffffffff-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555555', 'Hortense Delaroche', 'h.delaroche@example.com', '+33698765802', '2', '2A', 'proprietaire', 'Billetterie opéra récurrente.',           5.00),
  ('ffffffff-0000-0000-0000-000000000003', '55555555-5555-5555-5555-555555555555', 'Ibrahim Toure',      'i.toure@example.com',     '+33698765803', '4', '4B', 'locataire',    null,                                       4.20),
  ('ffffffff-0000-0000-0000-000000000004', '55555555-5555-5555-5555-555555555555', 'Juliette Sarfati',   'j.sarfati@example.com',   '+33698765804', '3', '3A', 'proprietaire', 'Pressing haute couture.',                  4.75),
  ('ffffffff-0000-0000-0000-000000000005', '55555555-5555-5555-5555-555555555555', 'Kléber Fontanet',    'k.fontanet@example.com',  '+33698765805', '1', '1B', 'locataire',    null,                                       3.90),
  ('ffffffff-0000-0000-0000-000000000006', '55555555-5555-5555-5555-555555555555', 'Léonore Vasseur',    'l.vasseur@example.com',   '+33698765806', '5', '5B', 'proprietaire', 'Chauffeur aéroport, voyages fréquents.',  4.55);

-- ---------- Résidents (Le Trocadéro, 4 — plan essentiel, activité modérée) ----------
insert into public.residents (id, building_id, full_name, email, phone, floor, unit, owner_status) values
  ('a1a1a1a1-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666', 'Maxime Lécuyer',   'm.lecuyer@example.com',  '+33698765901', '1', '1A', 'proprietaire'),
  ('a1a1a1a1-0000-0000-0000-000000000002', '66666666-6666-6666-6666-666666666666', 'Nathalie Prévost', 'n.prevost@example.com',  '+33698765902', '2', '2A', 'locataire'),
  ('a1a1a1a1-0000-0000-0000-000000000003', '66666666-6666-6666-6666-666666666666', 'Olivier Ténot',    'o.tenot@example.com',    '+33698765903', '3', '3A', 'proprietaire'),
  ('a1a1a1a1-0000-0000-0000-000000000004', '66666666-6666-6666-6666-666666666666', 'Priscille Aumont', 'p.aumont@example.com',   '+33698765904', '1', '1B', 'locataire');

-- ---------- Résidents (Villa Montsouris, 4 — plan essentiel) ----------
insert into public.residents (id, building_id, full_name, email, phone, floor, unit, owner_status) values
  ('b2b2b2b2-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777', 'Quentin Roussille', 'q.roussille@example.com', '+33698766001', '1', '1A', 'proprietaire'),
  ('b2b2b2b2-0000-0000-0000-000000000002', '77777777-7777-7777-7777-777777777777', 'Rania Benslimane',  'r.benslimane@example.com','+33698766002', '2', '2A', 'locataire'),
  ('b2b2b2b2-0000-0000-0000-000000000003', '77777777-7777-7777-7777-777777777777', 'Sixte Delorme',     's.delorme@example.com',  '+33698766003', '2', '2B', 'proprietaire'),
  ('b2b2b2b2-0000-0000-0000-000000000004', '77777777-7777-7777-7777-777777777777', 'Tatiana Orlova',    't.orlova@example.com',   '+33698766004', '3', '3A', 'locataire');

-- ---------- Résidents (Hôtel particulier Varenne, 5) ----------
insert into public.residents (id, building_id, full_name, email, phone, floor, unit, owner_status, preferences, satisfaction_score) values
  ('c3c3c3c3-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888', 'Ursule d''Estaing',  'u.destaing@example.com', '+33698766101', '2', '2A', 'proprietaire', 'Réceptions privées fréquentes.',        4.90),
  ('c3c3c3c3-0000-0000-0000-000000000002', '88888888-8888-8888-8888-888888888888', 'Victor Anh Nguyen',  'v.nguyen@example.com',   '+33698766102', '1', '1A', 'locataire',    null,                                     4.30),
  ('c3c3c3c3-0000-0000-0000-000000000003', '88888888-8888-8888-8888-888888888888', 'Wilhelmine Coste',   'w.coste@example.com',    '+33698766103', '3', '3B', 'proprietaire', 'Personal shopper art contemporain.',    4.80),
  ('c3c3c3c3-0000-0000-0000-000000000004', '88888888-8888-8888-8888-888888888888', 'Xavier Delannoy',    'x.delannoy@example.com', '+33698766104', '1', '1B', 'locataire',    null,                                     4.05),
  ('c3c3c3c3-0000-0000-0000-000000000005', '88888888-8888-8888-8888-888888888888', 'Yasmine Berrada',    'y.berrada@example.com',  '+33698766105', '2', '2C', 'proprietaire', 'Chauffeur quotidien, discrétion requise.', 4.65);

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

-- ---------- Demandes de service (Hôtel de Marigny, 9) ----------
insert into public.service_requests (building_id, resident_id, service, status, priority, payload, amount_cents, sla_deadline) values
  ('44444444-4444-4444-4444-444444444444', 'eeeeeeee-0000-0000-0000-000000000003', 'chauffeur',        'nouveau',    'urgente', '{"destination": "Aéroport Roissy CDG"}',              13500, now() + interval '25 minutes'),
  ('44444444-4444-4444-4444-444444444444', 'eeeeeeee-0000-0000-0000-000000000001', 'colis',            'en_cours',   'normale', '{"transporteur": "Chronopost", "reference": "HM102"}',null,  now() + interval '3 hours'),
  ('44444444-4444-4444-4444-444444444444', 'eeeeeeee-0000-0000-0000-000000000005', 'personal_shopper', 'en_attente', 'normale', '{"mission": "Sélection joaillerie printemps"}',       98000, now() + interval '1 day'),
  ('44444444-4444-4444-4444-444444444444', 'eeeeeeee-0000-0000-0000-000000000002', 'pressing',         'termine',    'normale', '{"articles": "6 chemises, 2 costumes"}',              9000,  null),
  ('44444444-4444-4444-4444-444444444444', 'eeeeeeee-0000-0000-0000-000000000004', 'billetterie',      'nouveau',    'normale', '{"evenement": "Comédie-Française"}',                  32000, now() + interval '2 days'),
  ('44444444-4444-4444-4444-444444444444', 'eeeeeeee-0000-0000-0000-000000000003', 'colis',            'termine',    'normale', '{"transporteur": "DHL", "reference": "HM088"}',       null,  null),
  ('44444444-4444-4444-4444-444444444444', 'eeeeeeee-0000-0000-0000-000000000001', 'chauffeur',        'termine',    'normale', '{"destination": "Gare du Nord"}',                     6500,  null),
  ('44444444-4444-4444-4444-444444444444', 'eeeeeeee-0000-0000-0000-000000000005', 'pressing',         'en_cours',   'normale', '{"articles": "Robe de soirée"}',                      7200,  now() + interval '5 hours'),
  ('44444444-4444-4444-4444-444444444444', 'eeeeeeee-0000-0000-0000-000000000002', 'billetterie',      'en_attente', 'normale', '{"evenement": "Roland-Garros, court 1"}',             25000, now() + interval '4 days');

-- ---------- Demandes de service (Résidence Foch, 10) ----------
insert into public.service_requests (building_id, resident_id, service, status, priority, payload, amount_cents, sla_deadline) values
  ('55555555-5555-5555-5555-555555555555', 'ffffffff-0000-0000-0000-000000000001', 'chauffeur',        'en_cours',   'normale', '{"destination": "La Défense"}',                       8800,  now() + interval '2 hours'),
  ('55555555-5555-5555-5555-555555555555', 'ffffffff-0000-0000-0000-000000000002', 'billetterie',      'nouveau',    'urgente', '{"evenement": "Opéra Garnier, ce soir"}',             75000, now() - interval '10 minutes'),
  ('55555555-5555-5555-5555-555555555555', 'ffffffff-0000-0000-0000-000000000004', 'pressing',         'termine',    'normale', '{"articles": "Tailleurs sur-mesure x3"}',             11000, null),
  ('55555555-5555-5555-5555-555555555555', 'ffffffff-0000-0000-0000-000000000003', 'colis',            'en_attente', 'normale', '{"transporteur": "UPS", "reference": "RF221"}',       null,  now() + interval '2 days'),
  ('55555555-5555-5555-5555-555555555555', 'ffffffff-0000-0000-0000-000000000006', 'chauffeur',        'nouveau',    'normale', '{"destination": "Aéroport du Bourget"}',              15000, now() + interval '1 day'),
  ('55555555-5555-5555-5555-555555555555', 'ffffffff-0000-0000-0000-000000000005', 'colis',            'termine',    'normale', '{"transporteur": "Colissimo", "reference": "RF199"}', null,  null),
  ('55555555-5555-5555-5555-555555555555', 'ffffffff-0000-0000-0000-000000000001', 'personal_shopper', 'en_cours',   'normale', '{"mission": "Cadeau anniversaire"}',                  44000, now() + interval '6 hours'),
  ('55555555-5555-5555-5555-555555555555', 'ffffffff-0000-0000-0000-000000000002', 'billetterie',      'termine',    'normale', '{"evenement": "PSG - Marseille"}',                    62000, null),
  ('55555555-5555-5555-5555-555555555555', 'ffffffff-0000-0000-0000-000000000004', 'pressing',         'nouveau',    'normale', '{"articles": "Linge de maison"}',                     5000,  now() + interval '1 day'),
  ('55555555-5555-5555-5555-555555555555', 'ffffffff-0000-0000-0000-000000000006', 'chauffeur',        'termine',    'normale', '{"destination": "Gare de Lyon"}',                     6900,  null);

-- ---------- Demandes de service (Le Trocadéro, 5) ----------
insert into public.service_requests (building_id, resident_id, service, status, priority, payload, amount_cents, sla_deadline) values
  ('66666666-6666-6666-6666-666666666666', 'a1a1a1a1-0000-0000-0000-000000000001', 'colis',     'en_cours',   'normale', '{"transporteur": "Colissimo", "reference": "TR045"}', null,  now() + interval '4 hours'),
  ('66666666-6666-6666-6666-666666666666', 'a1a1a1a1-0000-0000-0000-000000000002', 'pressing',  'termine',    'normale', '{"articles": "3 chemises"}',                          4500,  null),
  ('66666666-6666-6666-6666-666666666666', 'a1a1a1a1-0000-0000-0000-000000000003', 'chauffeur', 'nouveau',    'urgente', '{"destination": "Aéroport Orly"}',                    9800,  now() + interval '40 minutes'),
  ('66666666-6666-6666-6666-666666666666', 'a1a1a1a1-0000-0000-0000-000000000004', 'colis',     'termine',    'normale', '{"transporteur": "DHL", "reference": "TR012"}',       null,  null),
  ('66666666-6666-6666-6666-666666666666', 'a1a1a1a1-0000-0000-0000-000000000001', 'pressing',  'en_attente', 'normale', '{"articles": "Costume 2 pièces"}',                    5200,  now() + interval '1 day');

-- ---------- Demandes de service (Villa Montsouris, 4) ----------
insert into public.service_requests (building_id, resident_id, service, status, priority, payload, amount_cents, sla_deadline) values
  ('77777777-7777-7777-7777-777777777777', 'b2b2b2b2-0000-0000-0000-000000000001', 'chauffeur', 'termine',    'normale', '{"destination": "Gare Montparnasse"}',                6000,  null),
  ('77777777-7777-7777-7777-777777777777', 'b2b2b2b2-0000-0000-0000-000000000002', 'colis',     'en_attente', 'normale', '{"transporteur": "Colissimo", "reference": "VM077"}', null,  now() + interval '2 days'),
  ('77777777-7777-7777-7777-777777777777', 'b2b2b2b2-0000-0000-0000-000000000003', 'pressing',  'termine',    'normale', '{"articles": "4 chemises"}',                          4000,  null),
  ('77777777-7777-7777-7777-777777777777', 'b2b2b2b2-0000-0000-0000-000000000004', 'chauffeur', 'nouveau',    'normale', '{"destination": "Aéroport Orly"}',                    9200,  now() + interval '1 day');

-- ---------- Demandes de service (Hôtel particulier Varenne, 9) ----------
insert into public.service_requests (building_id, resident_id, service, status, priority, payload, amount_cents, sla_deadline) values
  ('88888888-8888-8888-8888-888888888888', 'c3c3c3c3-0000-0000-0000-000000000001', 'personal_shopper', 'en_cours',   'normale', '{"mission": "Réception privée, décoration florale"}', 68000, now() + interval '3 hours'),
  ('88888888-8888-8888-8888-888888888888', 'c3c3c3c3-0000-0000-0000-000000000003', 'billetterie',      'nouveau',    'normale', '{"evenement": "Vernissage Grand Palais"}',            18000, now() + interval '2 days'),
  ('88888888-8888-8888-8888-888888888888', 'c3c3c3c3-0000-0000-0000-000000000005', 'chauffeur',        'nouveau',    'urgente', '{"destination": "Aéroport du Bourget"}',              14500, now() - interval '5 minutes'),
  ('88888888-8888-8888-8888-888888888888', 'c3c3c3c3-0000-0000-0000-000000000002', 'colis',            'termine',    'normale', '{"transporteur": "FedEx", "reference": "HV033"}',     null,  null),
  ('88888888-8888-8888-8888-888888888888', 'c3c3c3c3-0000-0000-0000-000000000004', 'pressing',         'termine',    'normale', '{"articles": "5 chemises, 1 costume"}',               7500,  null),
  ('88888888-8888-8888-8888-888888888888', 'c3c3c3c3-0000-0000-0000-000000000001', 'chauffeur',        'en_cours',   'normale', '{"destination": "Opéra Garnier"}',                    7000,  now() + interval '5 hours'),
  ('88888888-8888-8888-8888-888888888888', 'c3c3c3c3-0000-0000-0000-000000000003', 'personal_shopper', 'termine',    'normale', '{"mission": "Acquisition tableau contemporain"}',     185000,null),
  ('88888888-8888-8888-8888-888888888888', 'c3c3c3c3-0000-0000-0000-000000000005', 'colis',            'en_attente', 'normale', '{"transporteur": "UPS", "reference": "HV054"}',       null,  now() + interval '2 days'),
  ('88888888-8888-8888-8888-888888888888', 'c3c3c3c3-0000-0000-0000-000000000002', 'billetterie',      'termine',    'normale', '{"evenement": "Théâtre des Champs-Élysées"}',         21000, null);

-- ---------- Devis (Hôtel de Marigny, 2) ----------
insert into public.quotes (building_id, resident_id, provider, label, amount_cents, status) values
  ('44444444-4444-4444-4444-444444444444', 'eeeeeeee-0000-0000-0000-000000000005', 'Agence Style & Co',        'Personal Shopper — sélection joaillerie',    195000, 'envoye'),
  ('44444444-4444-4444-4444-444444444444', 'eeeeeeee-0000-0000-0000-000000000001', 'Cavalier Fleet Premium',   'Chauffeur — abonnement mensuel',             340000, 'accepte');

-- ---------- Devis (Résidence Foch, 2) ----------
insert into public.quotes (building_id, resident_id, provider, label, amount_cents, status) values
  ('55555555-5555-5555-5555-555555555555', 'ffffffff-0000-0000-0000-000000000002', 'Fnac Spectacles Pro',      'Billetterie — abonnement Opéra Garnier',     260000, 'en_attente'),
  ('55555555-5555-5555-5555-555555555555', 'ffffffff-0000-0000-0000-000000000004', 'Blanchisserie du Faubourg','Pressing — forfait trimestriel sur-mesure',  36000,  'accepte');

-- ---------- Devis (Hôtel particulier Varenne, 2) ----------
insert into public.quotes (building_id, resident_id, provider, label, amount_cents, status) values
  ('88888888-8888-8888-8888-888888888888', 'c3c3c3c3-0000-0000-0000-000000000003', 'Maison Artcurial Conseil', 'Personal Shopper — acquisitions art contemporain', 450000, 'accepte'),
  ('88888888-8888-8888-8888-888888888888', 'c3c3c3c3-0000-0000-0000-000000000001', 'Agence Style & Co',        'Personal Shopper — événementiel privé',            120000, 'envoye');

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

-- ============================================================
-- Génération de volume additionnel — pour démo client (beaucoup
-- plus de données sur tous les immeubles, y compris Villa Ségur).
-- ============================================================
do $$
declare
  b record;
  first_names text[] := array['Alice','Antoine','Béatrice','Charles','Claire','Damien','Elise','Fabien',
    'Gabrielle','Hugo','Inès','Julien','Karim','Laure','Mathieu','Nadège','Octave','Pauline','Quentin',
    'Rosalie','Simon','Théo','Ursule','Valentine','William','Zoé','Adrien','Camille','Delphine','Étienne',
    'Florence','Guillaume','Héloïse','Igor','Joséphine','Kevin','Lucie','Marc','Noémie','Oscar','Perrine',
    'Rodolphe','Sabine','Timothée','Violette','Xavier','Yolande','Zacharie','Agathe','Bastien','Constance'];
  last_names text[] := array['Dupont','Martin','Bernard','Petit','Durand','Leroy','Moreau','Simon','Laurent',
    'Lefebvre','Michel','Garcia','David','Bertrand','Roux','Vincent','Fournier','Morel','Girard','Bonnet',
    'Dupuis','Lambert','Fontaine','Rousseau','Blanchard','Guerin','Muller','Henry','Roussel','Nicolas',
    'Perrin','Robin','Clement','Morin','Gauthier','Dumont','Marchand','Noel','Meyer','Faure','Andre'];
  services service_type[] := array['chauffeur','pressing','colis','billetterie','personal_shopper']::service_type[];
  statuses request_status[] := array['nouveau','en_cours','en_attente','termine']::request_status[];
  floors text[] := array['1','2','3','4','5','6'];
  units text[] := array['A','B','C','D'];
  fn text;
  ln text;
  svc service_type;
  descr text;
  target_resident uuid;
  i int;
begin
  for b in select id from public.buildings loop
    -- 15 résidents supplémentaires par immeuble
    for i in 1..15 loop
      fn := first_names[1 + floor(random()*array_length(first_names,1))::int];
      ln := last_names[1 + floor(random()*array_length(last_names,1))::int];
      insert into public.residents (id, building_id, full_name, email, phone, floor, unit, owner_status, satisfaction_score)
      values (
        gen_random_uuid(), b.id,
        fn || ' ' || ln,
        lower(left(fn, 1) || '.' || ln) || '@example.com',
        '+336' || lpad(floor(random()*100000000)::text, 8, '0'),
        floors[1 + floor(random()*array_length(floors,1))::int],
        floors[1 + floor(random()*array_length(floors,1))::int] || units[1 + floor(random()*array_length(units,1))::int],
        (array['proprietaire','locataire']::owner_status[])[1 + floor(random()*2)::int],
        round((3.5 + random()*1.5)::numeric, 2)
      );
    end loop;

    -- 30 demandes de service supplémentaires par immeuble
    for i in 1..30 loop
      select id into target_resident from public.residents where building_id = b.id order by random() limit 1;
      svc := services[1 + floor(random()*5)::int];
      descr := case svc
        when 'chauffeur' then (array['Aéroport CDG','Aéroport Orly','Aéroport du Bourget','Gare de Lyon','Gare du Nord','La Défense','Rendez-vous centre-ville'])[1 + floor(random()*7)::int]
        when 'pressing' then (array['3 chemises','Costume 2 pièces','Robe de soirée','Linge de maison','Tailleur sur-mesure','5 chemises, 1 costume'])[1 + floor(random()*6)::int]
        when 'colis' then (array['Colissimo','DHL','UPS','FedEx','Chronopost'])[1 + floor(random()*5)::int] || ' — réf ' || upper(left(md5(random()::text), 6))
        when 'billetterie' then (array['Opéra Garnier','Opéra Bastille','Roland-Garros','PSG - OM','Comédie-Française','Théâtre des Champs-Élysées'])[1 + floor(random()*6)::int]
        else (array['Sélection joaillerie','Garde-robe saison','Cadeau anniversaire','Acquisition art','Personal shopper événementiel'])[1 + floor(random()*5)::int]
      end;
      insert into public.service_requests (building_id, resident_id, service, status, priority, payload, amount_cents, sla_deadline)
      values (
        b.id, target_resident, svc,
        statuses[1 + floor(random()*4)::int],
        case when random() < 0.15 then 'urgente'::request_priority else 'normale'::request_priority end,
        jsonb_build_object('detail', descr),
        case when random() < 0.75 then (2000 + floor(random()*90000))::int else null end,
        case when random() < 0.5 then now() + (floor(random()*96) || ' hours')::interval
             else now() - (floor(random()*48) || ' hours')::interval end
      );
    end loop;

    -- 3 devis supplémentaires par immeuble
    for i in 1..3 loop
      select id into target_resident from public.residents where building_id = b.id order by random() limit 1;
      insert into public.quotes (building_id, resident_id, provider, label, amount_cents, status)
      values (
        b.id, target_resident,
        (array['Blanchisserie du Faubourg','Agence Style & Co','Fnac Spectacles Pro','Cavalier Fleet Premium','Maison Artcurial Conseil'])[1 + floor(random()*5)::int],
        (array['Forfait trimestriel sur-mesure','Sélection joaillerie','Abonnement transferts aéroport','Loge saison, places premium','Garde-robe collection'])[1 + floor(random()*5)::int],
        (15000 + floor(random()*400000))::int,
        (array['en_attente','envoye','accepte','refuse']::quote_status[])[1 + floor(random()*4)::int]
      );
    end loop;
  end loop;
end;
$$;

-- ============================================================
-- Opérationnel : chat WhatsApp, colis, pressing, recommandations,
-- devis reçus par e-mail (migration 20260831000001).
-- Ids fixes sur Le Marly pour que la démo soit reproductible ; les autres
-- immeubles sont garnis dynamiquement pour éprouver l'isolation.
-- ============================================================

-- ---------- Fils WhatsApp (Le Marly) ----------
insert into public.conversations (id, building_id, resident_id, channel, external_thread_id, status, assigned_profile_id, last_read_at, created_at) values
  ('cccc0000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000001', 'whatsapp', 'wa:33698765401', 'ouverte',   'aaaaaaaa-0000-0000-0000-000000000001', now() - interval '3 hours', now() - interval '40 days'),
  ('cccc0000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000002', 'whatsapp', 'wa:33698765402', 'en_attente','aaaaaaaa-0000-0000-0000-000000000001', now() - interval '2 days',  now() - interval '35 days'),
  ('cccc0000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000004', 'whatsapp', 'wa:33698765404', 'ouverte',   'aaaaaaaa-0000-0000-0000-000000000001', now() - interval '1 day',   now() - interval '20 days'),
  ('cccc0000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000003', 'whatsapp', 'wa:33698765403', 'resolue',   'aaaaaaaa-0000-0000-0000-000000000001', now() - interval '6 days',  now() - interval '60 days');

-- `created_at` explicite : le trigger messages_touch_conversation recalcule
-- ensuite last_message_at à partir de ces valeurs.
insert into public.messages (building_id, conversation_id, direction, sender_profile_id, body, external_message_id, delivery_status, created_at) values
  ('11111111-1111-1111-1111-111111111111', 'cccc0000-0000-0000-0000-000000000001', 'entrant', null,                                    'Bonjour Jules, pouvez-vous récupérer mon costume au pressing avant vendredi ?', 'wamid.0001', 'lu',    now() - interval '5 hours'),
  ('11111111-1111-1111-1111-111111111111', 'cccc0000-0000-0000-0000-000000000001', 'sortant', 'aaaaaaaa-0000-0000-0000-000000000001', 'Bonjour Monsieur Dubois, c''est noté. Collecte demain 9h, retour prévu jeudi soir.', 'wamid.0002', 'lu', now() - interval '4 hours 50 minutes'),
  ('11111111-1111-1111-1111-111111111111', 'cccc0000-0000-0000-0000-000000000001', 'entrant', null,                                    'Parfait, merci beaucoup.', 'wamid.0003', 'lu', now() - interval '4 hours 30 minutes'),
  ('11111111-1111-1111-1111-111111111111', 'cccc0000-0000-0000-0000-000000000002', 'entrant', null,                                    'Un colis est-il arrivé pour moi aujourd''hui ?', 'wamid.0004', 'livre', now() - interval '3 hours'),
  ('11111111-1111-1111-1111-111111111111', 'cccc0000-0000-0000-0000-000000000003', 'entrant', null,                                    'Auriez-vous une adresse pour un dîner jeudi, plutôt discret ?', 'wamid.0005', 'lu', now() - interval '1 day 2 hours'),
  ('11111111-1111-1111-1111-111111111111', 'cccc0000-0000-0000-0000-000000000003', 'sortant', 'aaaaaaaa-0000-0000-0000-000000000001', 'Je vous recommande Le Petit Marius, avenue George V — je peux réserver pour deux à 20h30.', 'wamid.0006', 'lu', now() - interval '1 day 1 hour'),
  ('11111111-1111-1111-1111-111111111111', 'cccc0000-0000-0000-0000-000000000003', 'entrant', null,                                    'Volontiers, réservez.', 'wamid.0007', 'lu', now() - interval '23 hours'),
  ('11111111-1111-1111-1111-111111111111', 'cccc0000-0000-0000-0000-000000000004', 'sortant', 'aaaaaaaa-0000-0000-0000-000000000001', 'Votre colis volumineux est descendu en cave, badge n°12. Bonne journée.', 'wamid.0008', 'lu', now() - interval '6 days');

-- ---------- Colis (Le Marly) ----------
insert into public.parcels (id, building_id, resident_id, carrier, tracking_code, status, storage_location, photo_path, received_at, scheduled_delivery_at, delivered_at, reminder_sent_at, notes) values
  ('dddd0000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000002', 'Chronopost', 'XP4471203FR', 'recu',     'Loge — étagère A', 'parcels/marly/xp4471203.jpg', now() - interval '3 hours', null,                        null,                      null,                      'Colis fragile, signature demandée.'),
  ('dddd0000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000003', 'DHL',        'JJD0002299134', 'stocke',   'Cave n°12',       'parcels/marly/jjd0002299.jpg', now() - interval '4 days',  now() + interval '1 day',   null,                      now() - interval '2 days', 'Volumineux — descendu en cave.'),
  ('dddd0000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000004', 'UPS',        '1Z999AA10123456784', 'notifie', 'Loge — étagère B', null,                        now() - interval '1 day',   now() + interval '2 hours', null,                      null,                      null),
  ('dddd0000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000001', 'Colissimo',  '6A11223344556',  'remis',    null,              'parcels/marly/6a1122334.jpg', now() - interval '8 days',  null,                       now() - interval '7 days', null,                      null),
  ('dddd0000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000007', 'Amazon',     'TBA304991827',   'stocke',   'Loge — étagère A', null,                        now() - interval '5 days',  null,                       null,                      now() - interval '3 days', 'Rappel J+2 envoyé, sans réponse.'),
  ('dddd0000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000010', 'Fedex',      '7789 1122 3344', 'retourne', null,              null,                        now() - interval '20 days', null,                       null,                      now() - interval '18 days', 'Non retiré sous 14 jours — retour expéditeur.');

-- ---------- Pressing (Le Marly) ----------
insert into public.pressing_orders (id, building_id, resident_id, provider, status, items, item_count, amount_cents, collected_at, expected_return_at, returned_at, delivered_at, notes) values
  ('eeee0000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000001', 'Pressing Montaigne', 'chez_le_pressing', '[{"label": "Costume 2 pièces", "quantity": 1}, {"label": "Chemise", "quantity": 4}]', 5, 8900,  now() - interval '1 day',  now() + interval '2 days', null,                       null,                      'Retouche ourlet demandée.'),
  ('eeee0000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000006', 'Pressing Montaigne', 'pret',             '[{"label": "Robe de soirée", "quantity": 1}]',                                       1, 4500,  now() - interval '3 days', now() - interval '1 day',  now() - interval '1 day',   null,                      null),
  ('eeee0000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000002', 'Blanchisserie Georges V', 'collecte',    '[{"label": "Manteau cachemire", "quantity": 1}]',                                    1, 6200,  now() - interval '2 hours', now() + interval '4 days', null,                      null,                      null),
  ('eeee0000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000001', 'Pressing Montaigne', 'livre',            '[{"label": "Chemise", "quantity": 6}]',                                              6, 3600,  now() - interval '9 days', now() - interval '7 days', now() - interval '7 days',  now() - interval '7 days', 'Livraison hebdomadaire du lundi.'),
  ('eeee0000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000009', 'Pressing Montaigne', 'livre',            '[{"label": "Smoking", "quantity": 1}, {"label": "Noeud papillon", "quantity": 1}]',  2, 7400,  now() - interval '16 days', now() - interval '13 days', now() - interval '13 days', now() - interval '12 days', null);

-- ---------- Catalogue de recommandations (Le Marly) ----------
insert into public.recommendations (id, building_id, category, name, description, address, phone, url, is_partner, commission_rate, rating, is_active) values
  ('ffff0000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'restaurant', 'Le Petit Marius',       'Poissons et fruits de mer, salle discrète au premier étage.', '6 avenue George V, 75008 Paris',   '+33147203940', null, true,  10.00, 4.70, true),
  ('ffff0000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'restaurant', 'Table Montaigne',       'Cuisine française contemporaine, table du chef sur demande.',  '30 avenue Montaigne, 75008 Paris', '+33153230100', null, false, null,  4.50, true),
  ('ffff0000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'bien_etre',  'Spa Cinq Mondes',       'Massages à domicile possibles sous 48h.',                      '6 square de l''Opéra, 75009 Paris', '+33142668800', null, true,  12.00, 4.80, true),
  ('ffff0000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'artisan',    'Atelier Bertin',        'Cordonnerie et maroquinerie de luxe, collecte en loge.',       '11 rue de Marignan, 75008 Paris',  '+33143591122', null, true,  15.00, 4.90, true),
  ('ffff0000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'culture',    'Opéra Garnier — loges', 'Accès loges de catégorie 1 via notre partenaire billetterie.',  'Place de l''Opéra, 75009 Paris',   null,           null, true,  8.00,  4.60, true),
  ('ffff0000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'transport',  'Aéro Prestige',         'Transferts aéroport en berline, repli si aucun chauffeur interne.', null,                          '+33170362200', null, true,  12.00, 4.30, true),
  ('ffff0000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'artisan',    'Serrurerie Saint-Honoré','Dépannage 24/7, ancien prestataire — remplacé depuis mars.',   '82 rue Saint-Honoré, 75001 Paris', '+33142603311', null, false, null,  3.20, false);

insert into public.recommendation_shares (building_id, recommendation_id, resident_id, shared_by_profile_id, conversation_id, channel, status, feedback, created_at) values
  ('11111111-1111-1111-1111-111111111111', 'ffff0000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'cccc0000-0000-0000-0000-000000000003', 'whatsapp', 'reservee',  'Table réservée jeudi 20h30, deux couverts.', now() - interval '1 day'),
  ('11111111-1111-1111-1111-111111111111', 'ffff0000-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'cccc0000-0000-0000-0000-000000000002', 'whatsapp', 'consultee', null,                                        now() - interval '6 days'),
  ('11111111-1111-1111-1111-111111111111', 'ffff0000-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'cccc0000-0000-0000-0000-000000000001', 'whatsapp', 'reservee',  'Deux paires confiées le 12.',                now() - interval '11 days'),
  ('11111111-1111-1111-1111-111111111111', 'ffff0000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', null,                                   'email',    'refusee',   'Préfère un établissement plus proche.',      now() - interval '14 days'),
  ('11111111-1111-1111-1111-111111111111', 'ffff0000-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', null,                                   'whatsapp', 'proposee',  null,                                        now() - interval '2 days'),
  ('11111111-1111-1111-1111-111111111111', 'ffff0000-0000-0000-0000-000000000006', 'bbbbbbbb-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000001', null,                                   'whatsapp', 'reservee',  'Transfert CDG confirmé.',                    now() - interval '20 days');

-- ---------- Devis reçus par e-mail (PRD §6.1.6) ----------
-- Le troisième n'est encore rattaché à personne : c'est l'état « reçu, à
-- qualifier » que le concierge doit voir arriver.
insert into public.quotes (building_id, resident_id, provider, label, amount_cents, status, source, email_from, email_subject, email_received_at, email_message_id, attachment_path) values
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000001', 'Atelier Bertin',           'Restauration de deux paires — cuir pleine fleur', 34000, 'envoye',    'email', 'devis@atelier-bertin.fr',    'Devis n°2026-0412 — M. Dubois',        now() - interval '2 days',  '<a41f@atelier-bertin.fr>',  'quotes/marly/bertin-2026-0412.pdf'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000004', 'Spa Cinq Mondes',          'Massage à domicile — forfait 5 séances',         52000, 'en_attente','email', 'reservations@cinqmondes.fr', 'Votre demande de devis — forfait spa', now() - interval '5 hours', '<9b02@cinqmondes.fr>',      'quotes/marly/cinqmondes-forfait.pdf'),
  ('11111111-1111-1111-1111-111111111111', null,                                   'Serrurerie Saint-Honoré',  'Devis reçu — à rattacher à un résident',         null,  'en_attente','email', 'contact@serrurerie-sh.fr',   'Devis intervention porte palière 4e',  now() - interval '1 hour',  '<c73d@serrurerie-sh.fr>',   'quotes/marly/serrurerie-porte-4e.pdf'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000002', 'Blanchisserie Georges V',  'Entretien annuel manteau cachemire',              9800, 'accepte',   'email', 'devis@blanchisserie-gv.fr',  'Devis entretien cachemire',            now() - interval '18 days', '<1f55@blanchisserie-gv.fr>','quotes/marly/gv-cachemire.pdf');

-- ---------- Autres immeubles : de quoi éprouver l'isolation ----------
do $$
declare
  b record;
  target_resident uuid;
  target_conversation uuid;
  reco uuid;
  concierge_id uuid;
begin
  for b in select id from public.buildings where id <> '11111111-1111-1111-1111-111111111111' loop
    select id into concierge_id from public.profiles
      where building_id = b.id and role in ('concierge', 'admin') limit 1;

    for i in 1..4 loop
      select id into target_resident from public.residents
        where building_id = b.id order by random() limit 1;
      exit when target_resident is null;

      insert into public.parcels (building_id, resident_id, carrier, tracking_code, status, storage_location, received_at)
      values (b.id, target_resident,
              (array['Chronopost', 'DHL', 'UPS', 'Colissimo'])[1 + floor(random() * 4)],
              upper(substr(md5(random()::text), 1, 11)),
              (array['recu', 'stocke', 'notifie', 'remis'])[1 + floor(random() * 4)]::parcel_status,
              'Loge', now() - (random() * 10 || ' days')::interval);

      insert into public.pressing_orders (building_id, resident_id, provider, status, items, item_count, amount_cents, collected_at)
      values (b.id, target_resident, 'Pressing du quartier',
              (array['collecte', 'chez_le_pressing', 'pret', 'livre'])[1 + floor(random() * 4)]::pressing_status,
              '[{"label": "Chemise", "quantity": 3}]', 3, 2400 + floor(random() * 5000)::int,
              now() - (random() * 12 || ' days')::interval);
    end loop;

    -- Un fil WhatsApp ouvert par immeuble, avec un message entrant en attente.
    select id into target_resident from public.residents
      where building_id = b.id order by random() limit 1;
    if target_resident is not null then
      insert into public.conversations (building_id, resident_id, channel, status, assigned_profile_id)
      values (b.id, target_resident, 'whatsapp', 'ouverte', concierge_id)
      returning id into target_conversation;

      insert into public.messages (building_id, conversation_id, direction, sender_profile_id, body, delivery_status, created_at)
      values (b.id, target_conversation, 'entrant', null, 'Bonjour, auriez-vous un pressing à me recommander ?', 'livre', now() - interval '2 hours');
    end if;

    insert into public.recommendations (building_id, category, name, description, is_partner, commission_rate, rating)
    values (b.id, 'restaurant', 'Table du quartier', 'Adresse de proximité recommandée par la loge.', false, null, 4.10)
    returning id into reco;

    if target_resident is not null and reco is not null then
      insert into public.recommendation_shares (building_id, recommendation_id, resident_id, shared_by_profile_id, channel, status)
      values (b.id, reco, target_resident, concierge_id, 'whatsapp', 'proposee');
    end if;

    -- Un devis arrivé par mail, non encore qualifié.
    insert into public.quotes (building_id, resident_id, provider, label, amount_cents, status, source, email_from, email_subject, email_received_at, email_message_id)
    values (b.id, null, 'Prestataire local', 'Devis reçu — à qualifier', null, 'en_attente', 'email',
            'devis@prestataire.fr', 'Votre demande de devis', now() - (random() * 3 || ' days')::interval,
            '<' || substr(md5(random()::text), 1, 8) || '@prestataire.fr>');
  end loop;
end;
$$;

-- ---------- Catalogue services & tarifs (démo) ----------
-- Le catalogue est provisionné par trigger à la création de l'immeuble ;
-- on ne personnalise ici que quelques lignes pour illustrer l'écran admin.
update public.building_services set partner_name = 'Pressing Montaigne', base_price_cents = 2200, commission_rate = 22.00
  where building_id = '11111111-1111-1111-1111-111111111111' and service = 'pressing';
update public.building_services set partner_name = 'VTC Étoile', base_price_cents = 320, sla_minutes = 20
  where building_id = '11111111-1111-1111-1111-111111111111' and service = 'chauffeur';
-- Villa Ségur ne propose pas encore la billetterie : le service est fermé.
update public.building_services set enabled = false
  where building_id = '22222222-2222-2222-2222-222222222222' and service = 'billetterie';

insert into public.notification_templates (building_id, slug, label, title, body) values
  ('11111111-1111-1111-1111-111111111111', 'coupure_eau', 'Coupure d’eau',
   'Coupure d’eau programmée',
   'L’eau sera coupée le [date] de [heure] à [heure] dans [zone]. Votre concierge tient des bouteilles à disposition à la loge.'),
  ('11111111-1111-1111-1111-111111111111', 'travaux', 'Travaux (Le Marly)',
   'Travaux dans votre immeuble',
   'Des travaux sont prévus le [date] de [heure] à [heure] dans [zone]. La loge organise vos accès et la réception de vos colis pendant la période.');

-- ---------- Annonces, documents syndic, incidents et courses (Le Marly) ----------
-- Données de démonstration des modules communication, syndic, interventions
-- et Live Map : les demandes portent des identifiants aléatoires, d'où les
-- sous-requêtes.
insert into public.announcements (building_id, created_by, title, body, target_floor, target_owner_status, urgent, created_at) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'Ravalement de la façade cour',
   'Des travaux de ravalement sont prévus du 28 septembre au 16 octobre, de 8h à 17h, côté cour. Un échafaudage sera installé ; votre concierge organise vos accès et la réception de vos colis pendant la période.',
   null, null, false, now() - interval '6 days'),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'Coupure d’eau programmée',
   'L’eau sera coupée le jeudi 24 septembre de 9h à 12h dans l’ensemble de l’immeuble pour le remplacement d’une vanne. Des bouteilles sont à votre disposition à la loge.',
   null, null, true, now() - interval '2 days'),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'Assemblée générale des copropriétaires',
   'L’assemblée générale se tiendra le 24 juillet à 18h30 en salle de réunion. Les convocations ont été envoyées par le syndic ; la loge tient les pouvoirs à votre disposition.',
   null, 'proprietaire', false, now() - interval '1 day');

insert into public.building_documents (building_id, title, provider, body, amount_cents, email_from, email_message_id, created_by, created_at) values
  ('11111111-1111-1111-1111-111111111111', 'Remplacement du moteur de la porte du parking', 'Portes & Automatismes Paris',
   'Devis n° DEV-2026-118 : dépose du moteur existant, fourniture et pose d’un moteur FAAC 24 V avec cellules de sécurité, mise en conformité et garantie 2 ans. Intervention sous 10 jours ouvrés après acceptation.',
   485000, 'devis@portes-automatismes.fr', 'DEV-2026-118@portes-automatismes.fr', 'aaaaaaaa-0000-0000-0000-000000000001', now() - interval '4 days'),
  ('11111111-1111-1111-1111-111111111111', 'Contrôle annuel des extincteurs et BAES', 'Sécurité Incendie Île-de-France',
   'Vérification réglementaire des 24 extincteurs et 18 blocs autonomes d’éclairage de sécurité, remplacement des éléments hors service et remise du registre de sécurité.',
   68000, 'contact@sii-df.fr', 'CTRL-2026-0921@sii-df.fr', 'aaaaaaaa-0000-0000-0000-000000000001', now() - interval '1 day');

insert into public.intervention_incidents (building_id, request_id, reported_by, kind, severity, description, created_at)
select '11111111-1111-1111-1111-111111111111', id, 'aaaaaaaa-0000-0000-0000-000000000001', 'retard', 'standard',
  'Le pressing annonce 24 h de retard sur le retour : machine en panne chez le prestataire. Résident prévenu par WhatsApp.', now() - interval '3 hours'
from public.service_requests where building_id = '11111111-1111-1111-1111-111111111111' and service = 'pressing' and status = 'en_cours'
order by created_at desc limit 1;

insert into public.intervention_incidents (building_id, request_id, reported_by, kind, severity, description, created_at)
select '11111111-1111-1111-1111-111111111111', id, 'aaaaaaaa-0000-0000-0000-000000000001', 'technique', 'grave',
  'Panne de l’ascenseur principal pendant la livraison des places : technicien Otis appelé, remise en service prévue sous 4 h.', now() - interval '2 days'
from public.service_requests where building_id = '11111111-1111-1111-1111-111111111111' and service = 'billetterie' and status = 'en_cours'
order by created_at desc limit 1;

update public.intervention_incidents set resolution = 'Ascenseur remis en service par Otis à 17h40, contrôle de la carte de commande effectué.',
  resolved_by = 'aaaaaaaa-0000-0000-0000-000000000001', resolved_at = now() - interval '1 day 18 hours'
where building_id = '11111111-1111-1111-1111-111111111111' and severity = 'grave' and resolved_at is null;

insert into public.driver_trips (building_id, request_id, vehicle, status, origin, destination, last_lat, last_lng, eta, created_at)
select '11111111-1111-1111-1111-111111111111', id, 'Berline Mercedes Classe S', 'en_route', '12 avenue Montaigne, Paris 8e', 'Aéroport CDG, Terminal 2E',
  48.8862, 2.3610, now() + interval '25 minutes', now() - interval '20 minutes'
from public.service_requests where building_id = '11111111-1111-1111-1111-111111111111' and service = 'chauffeur' and status <> 'termine'
order by (status = 'en_cours') desc, created_at desc limit 1;

insert into public.driver_trips (building_id, request_id, vehicle, status, origin, destination, last_lat, last_lng, eta, created_at)
select '11111111-1111-1111-1111-111111111111', id, 'Van Mercedes Classe V', 'acceptee', '12 avenue Montaigne, Paris 8e', 'Gare de Lyon',
  48.8664, 2.3079, now() + interval '40 minutes', now() - interval '4 minutes'
from public.service_requests r where building_id = '11111111-1111-1111-1111-111111111111' and service = 'chauffeur' and status <> 'termine'
  and not exists (select 1 from public.driver_trips t where t.request_id = r.id)
order by created_at desc limit 1;

-- Montants des réservations suivies (Le Marly) : commission figée au taux du partenaire.
-- Le trigger fige les montants hors transition ; on le suspend le temps du seed.
alter table public.recommendation_shares disable trigger recommendation_share_transition;
update public.recommendation_shares s set
  booking_amount_cents = v.amount,
  commission_cents = case when r.is_partner and r.commission_rate is not null then round(v.amount * r.commission_rate / 100)::integer else 0 end
from (values ('Le Petit Marius', 18600), ('Atelier Bertin', 42000), ('Aéro Prestige', 14500)) as v(name, amount)
join public.recommendations r on r.name = v.name and r.building_id = '11111111-1111-1111-1111-111111111111'
where s.recommendation_id = r.id and s.status = 'reservee' and coalesce(s.booking_amount_cents, 0) = 0;
alter table public.recommendation_shares enable trigger recommendation_share_transition;

-- Historique : les demandes terminées sont réparties sur les six derniers mois
-- (déterministe) avec une date de réalisation cohérente, pour que les
-- tendances finance et reporting ne se limitent pas au mois courant.
with shifted as (
  select id,
    ((abs(hashtext(id::text)) % 170) + 1) * interval '1 day' + (abs(hashtext(id::text)) % 24) * interval '1 hour' as delta,
    ((abs(hashtext(id::text)) % 150) + 15) * interval '1 minute' as duration
  from public.service_requests where status = 'termine'
)
update public.service_requests r set
  created_at = r.created_at - s.delta,
  sla_deadline = r.sla_deadline - s.delta,
  started_at = coalesce(r.started_at, r.created_at) - s.delta + interval '5 minutes',
  completed_at = coalesce(r.completed_at, r.created_at) - s.delta + s.duration
from shifted s where s.id = r.id;
