# État de reprise — 21 septembre 2026

## Contexte

La reprise s'appuie sur le dépôt et `docs/developpement.md` ; l'historique conversationnel des sessions précédentes n'est pas disponible. De nombreuses modifications locales antérieures existent (WhatsApp, colis, pressing, recommandations, documents syndic, demandes, annonces, interventions, devis, déploiement) : elles sont conservées et ne sont pas réputées déployées.

## Travail de cette session

Paramétrage services & tarifs (PRD §6.3.4) et configuration par immeuble (§6.3.2) :

- Migration `20260921000001_service_catalog.sql` : `building_services` (activation, unité fixe/km/heure, tarif, commission, prestataire local, engagement SLA) et `notification_templates`, tous deux porteurs de `building_id` et de leurs policies. Lecture par le staff de l'immeuble, écriture réservée aux gestionnaires (`public.manages`), syndic exclu, audit sur les deux tables.
- Le catalogue est provisionné par trigger à la création d'un immeuble, et `buildings.enabled_services` est recalculé depuis lui : une seule vérité pour les services ouverts.
- Un service fermé refuse toute nouvelle demande en base, pas seulement dans l'écran.
- Écran `/admin/services` : catalogue éditable, commissions estimées sur les demandes terminées, modèles de notification de l'immeuble. Le super-admin agit sur l'immeuble sélectionné dans la barre latérale (`lib/admin/server.ts`).
- La création d'une demande lit le catalogue : service fermé refusé, échéance SLA par défaut issue de l'engagement configuré.
- Les modèles d'annonce du concierge combinent les modèles de l'immeuble et les modèles intégrés.

## Vérifications

- ESLint, TypeScript et `npm run build -- --webpack` : réussis.
- `npm run test:unit` : 12 tests, dont les 5 nouveaux sur tarifs, commissions, SLA et formats (`lib/catalog.ts`).
- Suite RLS complète (catalogue inclus) : verte sur la base E2E et sur une base vierge rejouée `mc_verify_20260921` (8 migrations + seed complet).
- Playwright, 19 contrôles sur la stack E2E servie en build de production : réglage des tarifs, refus d'une commission > 100 %, fermeture/réouverture d'un service et effet immédiat en loge, SLA par défaut, modèles proposés au concierge, refus concierge et syndic sur `/admin/services`, super-admin sur un autre immeuble, aucune erreur JS. Détail dans `docs/developpement.md`.
- Correction de la suite RLS : le contrôle des notifications d'incident grave comparait un effectif absolu et échouait sur toute base portant déjà des incidents.

## Deuxième temps de la session — demandes du client

Quatre demandes relayées : chat WhatsApp, gestion des colis, recommandations affiliées, pressing avec interface syndic et devis par mail. Les trois premières existaient partiellement, la quatrième était déjà en place (fil syndic et devis d'immeuble, saisie manuelle du mail reçu). Trois chantiers retenus :

- **Colis** : preuve photo dans un bucket Storage privé (`colis`, policies par immeuble, URL signées de 120 s), prise de vue directe depuis la tablette, créneau de remise corrigeable tant que le colis est en loge et figé après remise, preuve non effaçable, rappel J+2 unique par colis — déclenchable en loge ou par `POST /api/rappels/colis` avec `CRON_SECRET`.
- **Affiliations** : partenaire et taux saisissables, suivi du devenir de chaque partage (consultée, réservée, refusée) gardé en base, commission figée à la réservation d'après le taux du moment, revenus par adresse et compteurs d'immeuble.
- **WhatsApp entrant** : route `POST /api/whatsapp/webhook` à signature `X-Hub-Signature-256` vérifiée sur le corps brut, vérification d'abonnement en `GET`, idempotence sur `wamid`, rattachement du numéro au bon résident (neuf derniers chiffres, refus si inconnu ou porté par deux immeubles), accusés de livraison sans régression d'état, badge non lu et marquage de lecture. Le provider Meta Cloud API remplace le mock dès que les quatre variables `WHATSAPP_*` sont présentes ; il en manque une et tout reste simulé.

Vérifications : 27 contrôles navigateur et webhook réussis, quatre nouvelles migrations, suite RLS étendue (colis, affiliations, WhatsApp) verte sur la base E2E et sur une base vierge rejouée, 17 tests unitaires.

## Suite

Ordre de poursuite mis à jour dans `docs/developpement.md` :

1. Onboarding d'un immeuble (< 5 min) et gestion utilisateurs/affectations via route handler à privilèges, puis contexte super-admin sur les autres écrans admin.
2. Reporting syndic, puis voiturier/Plan B.
3. Paiement Stripe/Connect avec tests sandbox, qui rendra réelles les commissions aujourd'hui estimées.
4. Ingestion automatique des devis reçus par mail (écartée à l'arbitrage du 21/09, la saisie reste manuelle), pièces jointes Storage côté syndic et pressing, fidélité, exports.
5. Vérifier chaque critère d'acceptation en navigateur et sur Supabase, puis préparer la livraison.

Les intégrations SMS et email restent simulées ; WhatsApp est prêt des deux côtés et attend l'ouverture du compte Business. Aucune migration n'a été appliquée à un environnement de production.
