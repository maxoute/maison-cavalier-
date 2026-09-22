# Développement complet — suivi du PRD

Objectif : développer l’application web Maison Cavalier de A à Z selon `.CLAUDE.MD`, sans réduire le périmètre aux écrans déjà existants. L’objectif n’est pas terminé. Ce document distingue le code présent des parcours vérifiés.

## Accès constatés le 17 septembre 2026

- Dépôt complet, PRD, composants et migrations : accessibles.
- Variables URL, clé publique et clé serveur Supabase : renseignées localement ; valeurs non reproduites ici. Cela ne prouve pas le bon fonctionnement du projet distant.
- Conteneur `maison-cavalier-rls-test` : accessible ; migrations et suite SQL exécutées avec succès.
- Stripe, Mapbox, WhatsApp : aucune valeur trouvée pour les variables de clés attendues ; intégrations réelles non validées. Email, SMS et WhatsApp utilisent des simulations.
- La base de test est un PostgreSQL avec les primitives Auth utilisées par les policies, pas une stack Supabase complète. Auth, Realtime et Storage exigent des tests complémentaires.

## Matrice de couverture

| Exigence PRD | État observé | Travail / preuve restant nécessaire |
| --- | --- | --- |
| §4–5 Rôles et isolation multi-tenant | Policies et tests SQL présents ; suite locale verte | Couvrir tous les nouveaux modules et tous les rôles au fur et à mesure ; tester les URL avec sessions réelles |
| §6.1.1 Demandes / Kanban | Kanban temps réel réécrit en mode clair (badges service, minuteur SLA humanisé, actions rapides, montant facturé saisissable), vérifié de bout en bout le 22/09 | Tests multi-session et volume |
| §6.1.1 Chat WhatsApp opérationnel | Fils par résident, envoi via le contrat provider, **réception** par webhook signé (vérification d'abonnement, idempotence `wamid`, rattachement du numéro au bon immeuble, refus si numéro inconnu ou ambigu), badge non lu ; provider Meta Cloud API retenu dès que les quatre variables sont présentes — vérifié de bout en bout le 21/09 avec une signature locale | Ouverture du compte WhatsApp Business, médias entrants, modèles validés hors fenêtre 24 h |
| §6.1.2 Live Map | Démonstration statique | Contrat provider, données chauffeurs, positions, sélection/suivi, filtres, vérification latence |
| §6.1.3 Voiturier | Table courses présente | Attribution manuelle/automatique, acceptation, notifications, alerte Plan B après 3 minutes |
| §6.1.4 Pressing / colis | Registres et planning hebdomadaire en heure de Paris, indicateurs, retour transporteur, preuve photo, rappels J+2 — parcours vérifiés le 22/09 | Notifications réelles (providers), preuves côté pressing |
| §6.1.5 CRM | Fiches, création/modification avec erreurs en ligne, suppression confirmée et refusée proprement en présence d’historique, insight automatique, filtrage par immeuble (super-admin) — vérifié le 22/09 | Score post-service saisi depuis l’app mobile, reversement réel des commissions |
| §6.1.6 Devis | Écran réécrit (badges, PDF, actions), création → envoi → acceptation vérifiés le 22/09 | Notifications réelles, rattachement d’un devis reçu par e-mail sans demande existante |
| §6.1.7 Interventions | Kanban réécrit, prestataire + fin prévue + montant, incidents signalés et résolus — vérifié le 22/09 | Liaison à la capture de paiement (Stripe) |
| §6.1.8 Messagerie syndic | Fil cloisonné par immeuble, documents partagés, incidents graves escaladés — vérifié le 22/09 côté concierge et syndic | Pièces jointes Storage, signature numérique |
| §6.1.9 Annonces | Formulaire avec modèles, audience calculée en direct, historique — vérifié le 22/09 | Écran d’accueil immeuble, providers réels |
| §6.2 Portail syndic | Messagerie et documents présents, reporting vide | Reporting agrégé sans données privées, notifications urgentes et tests URL |
| §6.3.1 Dashboard global | Quelques agrégats et liste immeubles | KPIs complets, séries temporelles, SLA, satisfaction, alertes et comparaison |
| §6.3.2 Immeubles | Page vide ; sélecteur de cookie présent ; configuration par immeuble (services, tarifs, prestataire local) et contexte super-admin effectif sur `/admin/services`, vérifiés le 21/09 | Onboarding d’un immeuble, affectations de concierges, contexte super-admin sur les autres écrans admin et exports par immeuble |
| §6.3.3 Utilisateurs | Page vide ; import résident disponible côté CRM | Création/désactivation Auth via API serveur, rôles/affectations, journal consultable |
| §6.3.4 Services et tarifs | Catalogue par immeuble (activation, unité fixe/km/heure, tarif, commission, prestataire, SLA), modèles de notification et commissions estimées ; écriture réservée aux gestionnaires, vérifié en navigateur et en SQL le 21/09 | Application du tarif aux montants facturés et aux devis, commissions réelles avec Stripe, exports |
| §6.3.5 Finance | Page vide | Transactions Stripe, remboursements/litiges, commissions, reversements et exports |
| §7.1 Authentification/MFA | Login, écrans TOTP avec retour à la connexion ; MFA volontairement désactivée pour la démo (aucun compte enrôlé) | Activer `mfaRequiredRoles` après enrôlement des comptes réels |
| §7.2 Stripe et Connect | Non implémenté | Modèle paiement, idempotence, webhooks signés, capture après validation, reçus, Connect, tests sandbox |
| §7.3 Notifications | Interfaces et mocks, journal et triggers de simulation | Providers réels, préférences/consentements, erreurs/reprises, délivrabilité et délai push |
| §7.4 Reporting | Page vide | Génération mensuelle, agrégats sûrs, accès admin/syndic et exports |
| §9 Non-fonctionnel | Build et tests partiels | Accessibilité navigateur, performances, latences, sauvegardes/restauration, RGPD et audit complet |
| §10 Design | Mode clair (crème/blanc, navy, or unique), tokens sémantiques, composants partagés (`PageHeader`, `StatCard`, `Disclosure`, `Badge`, `Button`) appliqués à tous les écrans le 22/09 | Contrôle contraste automatisé, responsive tablette en conditions réelles |
| §11 / annexe B Intégrations et contrat mobile | Types et tables partagés présents | API/webhooks partenaires, droits résident/chauffeur, contrats et compatibilité ; applications mobiles hors périmètre web |
| §12 Fidélité / Personal Shopper | Champ points et service générique présents | Parcours missions shopper, validation, règles de fidélité et administration |
| Déploiement et livraison | Docker/compose présents ; migrations et seed rejoués dans une base PostgreSQL vierge | Tester stack Supabase, staging authentifié et production ; ne pas confondre code local et déployé |

## Vérification du 22 septembre 2026 — audit, mode clair, écrans réalisés

Voir `docs/reprise.md` (état de reprise du 22 septembre) : audit complet, corrections (suppression résident, isolation super-admin, montants facturés, dates en heure de Paris, frontières d’erreur), mode clair, réécriture des écrans opérationnels, et vérifications (`crawl.mjs` toutes routes/tous rôles, `flows.mjs` 31 contrôles de bout en bout, RLS, unitaires).

## Dernières vérifications

- `npm run lint`, `npx tsc --noEmit` et `npm run build -- --webpack` : réussis après les modifications.
- `npm run test:unit` : tests SLA, transitions et dates UTC réussis.
- Suite `supabase/tests/rls.test.sql` exécutée dans le conteneur de test : isolation historique, opérations, demandes et annonces réussies ; transaction annulée à la fin.
- Migrations du 17 septembre appliquées uniquement à cette base de test.
- Migration `20260921000001_service_catalog.sql` (catalogue, tarifs, commissions, modèles) appliquée à la base E2E et rejouée depuis une base vierge.
- Rejeu complet du 21 septembre dans la base vierge `mc_verify_20260921` du conteneur de test : schéma Auth sans données, `pgcrypto` dans `extensions`, `search_path` à `public, extensions`, les 8 migrations dans l’ordre, seed complet puis toute la suite SQL, catalogue compris.
- Suite RLS : blocs ajoutés pour les colis (rappel J+2 unique, créneau figé après remise, preuve non effaçable), les affiliations (cycle du partage, commission figée, isolation) et la réception WhatsApp (rattachement du numéro, fil unique, non-lu, `resident_by_whatsapp` hors de portée du client).
- Suite RLS : le contrôle des notifications d’incident grave comparait un effectif absolu ; il part désormais d’un relevé avant insertion, sinon toute base portant déjà des incidents le faisait échouer.
- Rejeu complet réussi dans la base vierge `mc_verify_20260917` du même conteneur : schéma Auth de test sans données, toutes les migrations dans l’ordre, seed complet, puis toute la suite SQL. L’export Auth vidait `search_path` ; il a été rétabli à `public, extensions` avant les migrations. Aucune modification de production.
- L’abonnement Realtime est configuré d’après la documentation Supabase ; la publication SQL existe. Aucun test WebSocket de bout en bout effectué à ce stade.

## Vérification navigateur du 18 septembre 2026

Stack Supabase E2E complète (`npm run e2e:stack` : Auth, REST, Realtime, Storage) avec les 7 migrations ; `next dev` sur le port 3100 pointé vers cette stack. Suite RLS complète verte sur cette base (y compris interventions et devis). Parcours Playwright, 19 contrôles réussis :

- Concierge : création d’un devis depuis une demande, PDF valide (200, `%PDF`), envoi simulé, verrouillage de la modification, acceptation ; attribution prestataire et fin prévue, incident grave (alerte syndic), résolution ; aucune erreur JS.
- Syndic : redirection vers `/acces-refuse` sur `/concierge/devis`, PDF refusé (403), incident privé absent du portail syndic.
- Concierge d’un autre immeuble : PDF refusé (404), devis invisible.

Les données de test créées restent dans la base E2E dédiée (libellés « E2E … »). Realtime WebSocket et Storage non couverts par ce parcours.

## Vérification du 21 septembre 2026 — colis, affiliations, WhatsApp entrant

Même stack E2E, application servie en build de production sur le port 3100, configurée avec un secret d'ordonnanceur et une configuration WhatsApp locale (aucun appel à Meta). 27 contrôles réussis :

- Colis : réception, preuve photo téléversée dans le bucket privé et servie par URL signée, correction du créneau, rappels J+2 déclenchés depuis la loge ; `POST /api/rappels/colis` refuse sans secret (401) et pose un rappel unique par colis avec son secret.
- Affiliations : création d'un partenaire à 10 %, partage à un résident, passage en consultée puis réservée à 200 € — commission de 20 € figée sur la fiche et remontée dans les compteurs.
- WhatsApp entrant : vérification d'abonnement Meta (challenge rendu, jeton erroné refusé), événement non signé ou signé d'un autre secret refusé (401), message enregistré dans le fil du bon résident, rejeu sans doublon, numéro inconnu écarté, badge non lu puis marquage de lecture.
- Aucune erreur JavaScript.

Les envois sortants n'ont pas été exercés dans cette passe : le jeton Meta est fictif, et un envoi partirait réellement chez Meta.

## Vérification navigateur du 21 septembre 2026

Même stack E2E (Supabase complet sur les 8 migrations) ; application servie en build de production sur le port 3100 pointé vers cette stack. 19 contrôles Playwright réussis :

- Admin Le Marly : ouverture de `/admin/services`, réglage du pressing (33,00 €, commission 12,5 %, SLA 90 min, prestataire), refus d’une commission à 140 %, fermeture puis réouverture du service colis.
- Effet immédiat en loge : le service fermé disparaît du formulaire de demande et revient après réouverture ; une demande créée sans échéance reçoit l’échéance SLA du catalogue (90 min).
- Modèles : création d’un modèle d’immeuble, proposé au concierge dans Annonces à côté des modèles intégrés et pré-remplissant le message.
- Refus d’accès : concierge et syndic redirigés vers `/acces-refuse` sur `/admin/services`.
- Super-admin : immeuble actif Villa Ségur pris en compte, réglage d’un service d’un autre immeuble accepté.
- Aucune erreur JavaScript.

Le formulaire de connexion n’est actif qu’après hydratation : le script de vérification réessaie la connexion, sans quoi le navigateur envoie le formulaire en GET.

## Ordre de poursuite

1. ~~Compléter interventions/devis~~ (vérifié le 18/09), ~~puis services/tarifs~~, ~~colis (preuves, créneaux, rappels)~~, ~~affiliations~~ et ~~réception WhatsApp~~ (vérifiés le 21/09), puis l’onboarding d’immeuble afin de disposer des données réelles de paramétrage.
2. Implémenter reporting syndic et gestion utilisateurs/affectations, puis étendre aux autres écrans admin le contexte d’immeuble du super-admin (`lib/admin/server.ts`, aujourd’hui utilisé par `/admin/services`).
3. Développer voiturier/Plan B et les contrats de carte simulés, puis paiement Stripe/Connect avec tests sandbox.
4. Terminer Storage côté documents syndic et pressing, ingestion automatique des devis reçus par mail (écartée à l’arbitrage du 21/09), fidélité, exports et intégrations disponibles.
5. Vérifier chaque critère d’acceptation en navigateur et sur Supabase, puis préparer la livraison.
