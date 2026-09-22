# État de reprise — 22 septembre 2026 (veille de démonstration)

## Contexte

Démonstration complète de l'application prévue le 23 septembre 2026 : toutes les fonctionnalités de base doivent fonctionner sur les trois portails. La session a consisté en un audit complet (code, RLS, parcours navigateur), le passage en **mode clair**, l'uniformisation des écrans opérationnels et la réalisation des cinq écrans jusque-là vides (Immeubles, Utilisateurs, Finance, Reporting syndic, Live Map).

## Environnement de démonstration

- Stack locale : `npx supabase start` puis `npx supabase db reset` (12 migrations + seed), `.env.local` généré depuis `npx supabase status` (URL, clé anon, clé service-role, `CRON_SECRET`).
- `npm run dev` sur http://localhost:3000 ; comptes `concierge@demo.mc`, `admin@demo.mc`, `super@demo.mc`, `syndic@demo.mc`, `concierge3@demo.mc` (mot de passe `cavalier123`).
- Le seed a été enrichi pour que les écrans ne soient pas vides : annonces, documents syndic, incidents d'intervention (dont un grave, résolu, qui alimente le fil syndic), courses chauffeur, montants et commissions des réservations partenaires.
- Après un `db reset`, si le tableau des demandes affiche « Actualisation chaque minute » au lieu de « Temps réel connecté », relancer la passerelle locale : `docker restart supabase_kong_MAISON-CAVALIER` (le conteneur Realtime redémarre avec une nouvelle adresse que Kong ne voit pas toujours).
- La MFA reste désactivée (`mfaRequiredRoles = []`) : aucun compte de démo n'a de TOTP enrôlé ; les écrans `/login/mfa*` proposent désormais un retour à la connexion.

## Audit et corrections

Constats de l'audit (détail dans `docs/developpement.md`) et corrections apportées :

- **Suppression d'une fiche résident** : provoquait une page d'erreur (violation de clé étrangère) pour tout résident ayant un historique. Les actions résident renvoient désormais un `ActionResult` affiché en ligne, la suppression est confirmée dans une boîte de dialogue et refusée proprement quand un historique existe.
- **Super-admin** : les résidents, la fiche résident et le fil syndic n'étaient pas filtrés par immeuble (mélange des huit immeubles). `getSession` résout maintenant l'immeuble actif (cookie `mc-building`, validé en base) pour le super-admin, et tous les portails le suivent ; sélecteur d'immeuble ajouté à la barre latérale concierge.
- **Navigation entre portails** : liens « Autres espaces » (administration, espace concierge, portail syndic) selon le rôle ; libellés anglais remplacés (« Administration », « Tableau de bord »).
- **Montant facturé** : `service_requests.amount_cents` n'était écrit nulle part ; il est saisissable à la création d'une demande et dans le formulaire prestataire d'une intervention, ce qui alimente les revenus du tableau de bord et de la finance.
- **Colis** : transition « Retour transporteur » exposée (elle existait en base).
- **Dates** : les champs `datetime-local` sont saisis en heure de Paris et stockés en UTC (`parseParisDateTime`, testé) ; tous les affichages passent par `lib/format.ts` (dates relatives, durées humanisées, montants).
- **Frontières d'erreur** : `app/error.tsx`, `app/not-found.tsx`, `app/syndic/error.tsx` ajoutés ; les erreurs de lecture distinguées des erreurs d'écriture (`checkRead`).
- Divers : libellé de service unifié (« Personal shopper »), rouge hors charte corrigé, `rel="noopener"` sur les liens WhatsApp, manifeste PWA démarrant sur `/`, icônes de navigation distinctes.

## Mode clair et système de composants

- `app/globals.css` : tokens sémantiques (`--page`, `--surface`, `--surface-2`, `--line`, `--ink`, `--muted`, `--gold-deep`) exposés en classes Tailwind (`bg-page`, `bg-surface`, `border-line`, `text-ink`, `text-muted`, `text-gold-deep`). Le navy et l'or restent les couleurs de marque (sceau, bouton principal).
- Nouveaux composants partagés : `PageHeader` / `SectionTitle` / `EmptyState` (`components/ui/page-header.tsx`), `StatCard` / `StatGrid` / `Meter` (`components/ui/stat.tsx`), `Disclosure` (`components/ui/disclosure.tsx`), `OperationForm` avec variante de bouton, boutons d'action rapide basés sur `Button`.
- Tous les écrans opérationnels (demandes, interventions, colis, pressing, WhatsApp, devis, recommandations, annonces, documents et messagerie syndic, résidents) ont été réécrits sur ce gabarit : en-tête uniforme, indicateurs, formulaires repliables, badges de statut et de service, un seul bouton or par écran.

## Écrans réalisés

- **Immeubles** (`/admin/immeubles`, PRD §6.3.2) : parc avec formule, résidents, équipe, demandes en cours, services actifs, bascule de l'immeuble piloté ; onboarding en une étape (immeuble + concierge + syndic optionnel) via `app/actions/buildings.ts` et le client service-role, catalogue provisionné par trigger, comptes créés avec mot de passe temporaire, l'immeuble créé devient l'immeuble piloté.
- **Utilisateurs** (`/admin/utilisateurs`, PRD §6.3.3) : comptes staff par immeuble (rôle, email, dernière connexion, état), création et désactivation/réactivation via `app/actions/users.ts` (`auth.admin`), autorisations strictes (l'admin ne gère que concierges et syndics de son immeuble, jamais lui-même), journal `audit_logs`.
- **Finance** (`/admin/finance`, PRD §6.3.5) : KPIs du mois (revenus des services terminés, commissions Maison Cavalier au taux du catalogue, commissions d'affiliation, reversements partenaires, devis acceptés), tendance sur six mois, répartition par service et par immeuble (super-admin), export CSV Excel FR via `GET /api/finance/export?mois=YYYY-MM` (401/403 hors admin). Logique pure dans `lib/finance.ts` (11 tests). Stripe Connect signalé « à raccorder ».
- **Reporting syndic** (`/syndic/reporting`, PRD §6.2/§7.4) : fonction SQL `public.syndic_monthly_report(uuid, date)` `security definer` (migration `20260922000001`) ne renvoyant que des agrégats — demandes par service, taux de respect des délais, incidents (total/graves/résolus), annonces, messages, satisfaction moyenne, tendance 12 mois ; refus hors immeuble testé dans la suite RLS. Écran avec sélecteur de mois, graphiques et synthèse rédigée.
- **Live Map** (`/concierge/live-map`, PRD §6.1.2/§6.1.3) : contrat `DriverPositionProvider` (`lib/drivers/`), fournisseur simulé déterministe (4 chauffeurs, trajets, statuts, latence < 1 s, 13 tests) et stub Mapbox activé par `NEXT_PUBLIC_MAPBOX_TOKEN` ; carte SVG stylisée, marqueurs orientés, suivi d'un chauffeur, filtres, fiche détail, courses réelles de `driver_trips`, Plan B (alerte après 3 min sans réponse, taxi externe) côté client.

Points à connaître : le seed n'alimentant pas `completed_at`/`decided_at`, les agrégats finance et reporting se basent sur `completed_at ?? created_at` (documenté et testé) ; la migration de reporting doit être appliquée au projet Supabase Cloud avant le déploiement (`npx supabase db push`).

## Vérifications

- `npx tsc --noEmit`, `npm run lint`, `npm run test:unit` (tests étendus : heure de Paris, SLA humanisé).
- `npm run test:rls` : suite complète verte sur la base locale rejouée.
- `.playwright-mcp/crawl.mjs` : toutes les routes, cinq rôles, aucun écran en erreur, aucune erreur JavaScript, refus d'accès corrects.
- `.playwright-mcp/flows.mjs` : 31 contrôles de bout en bout réussis (création/modification/suppression résident, cycle complet d'une demande avec montant, colis reçu → stocké → retourné, collecte pressing, devis créé → PDF → envoyé → accepté, intervention assignée + incident signalé et résolu, annonce, fil WhatsApp, recommandation partagée, message et document syndic, isolation syndic, bascule d'immeuble du super-admin).
