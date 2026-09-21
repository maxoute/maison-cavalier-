# Parcours opérationnels

Les pages utilisent la session Supabase et les policies RLS. Appliquer les migrations dans l’ordre avant d’ouvrir ces écrans, notamment `20260831000001_operationnel_whatsapp.sql` et `20260916000001_operational_workflows.sql`.

| Écran concierge | Parcours disponible |
| --- | --- |
| `/concierge` | Créer une demande, filtrer par service/résident/statut/priorité, prendre en charge, mettre en attente et valider la réalisation. Suivi Realtime et compteurs SLA. |
| `/concierge/annonces` | Modèles travaux/incident/événement, ciblage par étage et propriétaire/locataire, diffusion simulée et historique des 100 dernières annonces. |
| `/concierge/whatsapp` | Ouvrir un fil résident, lire les 100 derniers messages, simuler une réponse, classer le fil ouvert/en attente/résolu. |
| `/concierge/colis` | Enregistrer une réception, le suivi, l’emplacement et une livraison prévue ; avancer jusqu’à la remise horodatée. |
| `/concierge/pressing` | Enregistrer les articles, le nombre de pièces, le prestataire et le retour prévu ; avancer jusqu’à la livraison. |
| `/concierge/recommandations` | Ajouter une bonne adresse et enregistrer une recommandation à un résident. |
| `/concierge/documents` | Recopier un devis reçu par email concernant les parties communes, le rendre visible au syndic, simuler et historiser son envoi email. |

Le syndic lit les devis de son immeuble dans `/syndic/documents` et répond dans sa messagerie existante. Il ne peut ni modifier les devis partagés, ni lire les devis résidentiels. Les nouveaux documents sont indépendants de `quotes` : un devis résidentiel sans résident affecté ne devient jamais automatiquement public au syndic.

## Intégrations

WhatsApp et email restent **simulés**. Aucun message externe n’est envoyé. Le provider WhatsApp est dans `lib/whatsapp`, le provider email dans `lib/email/provider.ts`. L’interface indique le mode simulé et l’historique email porte `simulated = true`.

Les notifications colis, pressing prêt et recommandations sont inscrites atomiquement dans `notifications` par les triggers, avec `payload.simulated = true`. Ces entrées ne constituent pas une preuve de livraison. Une transition refusée annule aussi ses notifications ; une mise à jour sans changement de statut ne les duplique pas.

La réception email est une saisie manuelle des informations reçues, avec une référence unique par immeuble. Le connecteur de boîte mail et le webhook WhatsApp entrant restent à brancher à l’ouverture des comptes. Les PDF joints, les photos colis, le scan caméra et le rappel automatique J+2 ne font pas partie de cette première interface. Un lecteur de codes qui agit comme un clavier peut remplir le suivi colis.

Les horaires saisis et affichés sur ces écrans sont en UTC, explicitement indiqué dans les libellés.

Les registres colis et pressing proposent un planning hebdomadaire, du lundi au dimanche, des opérations en cours. Les créneaux sont triés par heure ; chaque entrée mène à sa fiche pour avancer le statut. Les compteurs signalent les opérations sans créneau et les retards, y compris hors de la semaine affichée. Les opérations terminées restent dans le registre mais quittent le planning.

## Demandes et annonces — migrations du 17 septembre

Appliquer `20260917000001_request_workflows.sql` et `20260917000002_announcements.sql` avant de lancer cette version. Elles ont été appliquées au conteneur PostgreSQL de test uniquement durant le développement.

Les demandes suivent `nouveau → en_cours / en_attente`, `en_attente → en_cours`, puis `en_cours → en_attente / termine`. La clôture exige une validation de réalisation. Les mises à jour comparent le statut affiché au statut en base ; les transitions et références résident/immeuble sont aussi contrôlées en SQL. L’horodatage `completed_at` est généré en base et ne peut être réécrit par une mise à jour normale. Les demandes historiques terminées conservent une date de clôture inconnue (`null`).

Le tableau écoute INSERT/UPDATE via la publication `supabase_realtime`, rattrape les changements à la connexion et actualise chaque minute en secours. Les suppressions sont récupérées par cette actualisation. Le compteur SLA se recalcule toutes les 15 secondes. La publication est vérifiée par les tests SQL ; la réception réelle WebSocket reste à vérifier sur une stack Supabase complète. Référence : [documentation Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).

Les annonces ciblent l’intersection étage/statut d’occupation. L’audience est recalculée en base ; une audience vide est refusée. La diffusion simulée crée deux notifications par destinataire (push/email) ou quatre pour une urgence (push/WhatsApp/email/SMS), dans la même transaction que l’annonce. Les champs d’audience et de contenu de l’historique ne sont pas modifiables par le client. L’affichage écran d’accueil immeuble reste à réaliser.

Vérifications supplémentaires :

1. Créer une demande puis la retrouver avec les filtres ; passer par attente, prise en charge et validation de réalisation.
2. Ouvrir deux sessions concierge et vérifier qu’une nouvelle demande apparaît sans rechargement manuel ; couper puis rétablir la connexion.
3. Donner une échéance dépassée à une demande normale : le SLA doit être rouge, sans attendre de la rendre urgente.
4. Simuler une annonce destinée aux propriétaires d’un étage, puis vérifier l’audience et les canaux dans l’historique.

Tests unitaires : `npm run test:unit` (SLA, transitions et saisie UTC, notamment avec un serveur dans un autre fuseau).

Alternative à `npm run test:rls` pour le conteneur PostgreSQL de test déjà préparé : `docker exec -i maison-cavalier-rls-test psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/rls.test.sql`. Cette base permet de vérifier les triggers et RLS mais ne remplace pas les tests Auth/Realtime/Storage sur Supabase.

## Vérification manuelle

1. Se connecter comme concierge, choisir un résident et enregistrer un colis. Le retrouver dans la liste ; avancer jusqu’à « Remis ».
2. Enregistrer un pressing, passer par « Chez le pressing », « Prêt », puis « Livré ».
3. Ajouter une adresse, la recommander à un résident et vérifier le compteur de partages.
4. Ouvrir une conversation, simuler un message, vérifier l’historique et classer le fil.
5. Saisir un devis de parties communes ; simuler l’envoi email et vérifier l’historique. Réutiliser la référence du mail : le doublon doit être refusé.
6. Se connecter comme syndic : le devis partagé est lisible sans commandes de modification. Les pages concierge sont refusées.
7. Avec le concierge du second immeuble, vérifier l’absence de toutes les données créées à l’étape précédente.

Vérifications automatisées : `npm run lint`, `npx tsc --noEmit`, `npm run build -- --webpack`, puis `npm run test:rls` sur la stack Supabase locale migrée. La suite SQL utilise une transaction annulée à la fin et couvre les transitions, l’horodatage, les notifications simulées, la déduplication email et les accès inter-immeubles/syndic.
