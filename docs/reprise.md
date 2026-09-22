# État de reprise — 22 septembre 2026 (veille de démonstration)

## Contexte

Démonstration complète de l'application prévue le 23 septembre 2026 : toutes les fonctionnalités de base doivent fonctionner sur les trois portails. La session a consisté en un audit complet (code, RLS, parcours navigateur), le passage en **mode clair**, l'uniformisation des écrans opérationnels et la réalisation des cinq écrans jusque-là vides (Immeubles, Utilisateurs, Finance, Reporting syndic, Live Map).

## Environnement de démonstration

- Stack locale : `npx supabase start` puis `npx supabase db reset` (12 migrations + seed), `.env.local` généré depuis `npx supabase status` (URL, clé anon, clé service-role, `CRON_SECRET`).
- `npm run dev` sur http://localhost:3000 ; comptes `concierge@demo.mc`, `admin@demo.mc`, `super@demo.mc`, `syndic@demo.mc`, `concierge3@demo.mc` (mot de passe `cavalier123`).
- Le seed a été enrichi pour que les écrans ne soient pas vides : annonces, documents syndic, incidents d'intervention (dont un grave, résolu, qui alimente le fil syndic), courses chauffeur, montants et commissions des réservations partenaires.
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

_Section complétée à la fin de la session avec le résultat des trois chantiers parallèles : Immeubles + Utilisateurs, Finance + Reporting syndic, Live Map._

## Vérifications

- `npx tsc --noEmit`, `npm run lint`, `npm run test:unit` (tests étendus : heure de Paris, SLA humanisé).
- `npm run test:rls` : suite complète verte sur la base locale rejouée.
- `.playwright-mcp/crawl.mjs` : toutes les routes, cinq rôles, aucun écran en erreur, aucune erreur JavaScript, refus d'accès corrects.
- `.playwright-mcp/flows.mjs` : 31 contrôles de bout en bout réussis (création/modification/suppression résident, cycle complet d'une demande avec montant, colis reçu → stocké → retourné, collecte pressing, devis créé → PDF → envoyé → accepté, intervention assignée + incident signalé et résolu, annonce, fil WhatsApp, recommandation partagée, message et document syndic, isolation syndic, bascule d'immeuble du super-admin).
