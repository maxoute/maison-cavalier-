# Comptes sur invitation — conception

Date : 2 octobre 2026 · Statut : validé (conversation du 02/10/2026), implémenté sur `feat/comptes-invitation`

## Besoin

Une vraie connexion et une vraie création de compte pour la production :
plus de comptes de démonstration ni de mots de passe temporaires affichés à
l'écran. Maison Cavalier est vendue immeuble par immeuble : **pas
d'inscription publique**, tous les comptes naissent sur invitation.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Qui crée les comptes | Super-admin : tous les rôles, tous les immeubles. Admin : concierge et syndic de son immeuble (règles existantes inchangées). | SaaS B2B, périmètre multi-tenant déjà vérifié côté serveur. |
| Inscription publique | Coupée (`enable_signup = false` en local ; à couper dans le dashboard Supabase Cloud). | Un compte créé hors invitation n'a ni rôle ni accès, mais n'a rien à faire là. |
| Création | `auth.admin.generateLink({ type: 'invite' })` : compte sans mot de passe, rôle et immeuble posés dans `app_metadata`, profil créé ; tout est annulé si une étape échoue. | Mécanisme natif de Supabase ; aucune table d'invitations à maintenir. |
| Lien envoyé | Lien vers `/auth/confirm?token_hash=…&type=invite|recovery` de l'application, jamais l'`action_link` de Supabase. | Session ouverte côté serveur (cookies SSR) ; maîtrise de l'adresse publique (`APP_URL`). |
| Consommation du lien | Au clic sur un bouton de `/auth/confirm` (action serveur `verifyOtp`), pas à l'ouverture de la page. | Les antivirus de messagerie visitent les liens d'avance et grilleraient le jeton à usage unique. |
| E-mails | Envoyés par l'application via l'API Resend (`RESEND_API_KEY`, `EMAIL_FROM`), gabarits français dans `lib/auth/emails.ts`. Sans clé : lien affiché à l'admin avec « Copier ». | Écart assumé par rapport à « SMTP Resend dans Supabase » : même résultat pour l'utilisateur, aucun modèle d'e-mail à configurer dans Supabase, textes versionnés et testés. |
| Renvoi | « Renvoyer l'invitation » tant qu'elle n'est pas acceptée, « Lien d'accès » (réinitialisation) ensuite. Chaque lien invalide le précédent (vérifié). | Un seul lien valable à la fois. |
| Mot de passe oublié | `/mot-de-passe-oublie` : réponse identique que l'adresse existe ou non ; une demande par adresse toutes les 5 min ; comptes désactivés ignorés. Sans e-mails configurés : renvoi vers l'administrateur. | Pas d'énumération des comptes, pas d'envoi en rafale. |
| Mot de passe | 12 caractères minimum, lettres + chiffre ou symbole, confirmé (`lib/auth/links.ts`). | Comptes à privilèges sur des données de résidents. |
| Mon compte | `/compte` : choix du mot de passe à l'arrivée, changement à tout moment (lien depuis le pied de la barre latérale). | — |
| Démonstration | Boutons « Comptes de démonstration » seulement si `DEMO_LOGIN=true` (serveur, modifiable sans rebuild). | Local et démos ; jamais en production réelle. |
| Premier compte | `npm run bootstrap:super-admin -- --env <fichier> --email … --nom … --immeuble … --adresse …` : premier immeuble + premier super-admin, lien affiché ; refuse s'il existe déjà un super-admin. | `profiles.building_id` est obligatoire, même pour le super-admin. |

## Hors périmètre

- 2FA (prévue par le PRD, désactivée tant qu'aucun facteur n'est branché).
- Comptes résidents et chauffeurs (apps mobiles).

## Tests

- Unitaires (`tests/auth.test.mjs`) : lien d'accès, types acceptés, règles de mot de passe, gabarits d'e-mail, échappement HTML.
- Playwright (`.playwright-mcp/invitations.mjs`, 20 contrôles) : invitation → activation → mot de passe → portail ; reconnexion ; lien réutilisé refusé ; lien de réinitialisation ; ancien mot de passe refusé ; « Mon compte » ; mot de passe oublié ; onboarding d'immeuble avec invitation.
- Script de démarrage : refus sans argument, refus si un super-admin existe, chemin complet sur base vierge simulée (activation → `/admin`).
- Non-régression : crawl 43/43 pages, parcours métier 31/31.
