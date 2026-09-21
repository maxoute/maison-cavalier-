<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Maison Cavalier — Application Web

Plateforme SaaS de conciergerie d'immeuble haut de gamme. Le PRD complet est dans `.CLAUDE.MD` — le lire avant toute évolution fonctionnelle.

## Stack
- Next.js 16 (App Router, TypeScript, Tailwind v4). Attention : le middleware s'appelle `proxy.ts` en Next 16 (même API, autre nom de fichier).
- Supabase : Postgres + RLS (multi-tenant), Auth (+ MFA TOTP), Realtime, Storage
- Stripe + Stripe Connect (à partir du Sprint 2)

## Règles non négociables
- **Multi-tenant** : toute table porte `building_id` et ses policies RLS dans la même migration. L'isolation se fait en base, jamais seulement dans le code applicatif.
- **Le navigateur n'a jamais la clé service-role** : les opérations à privilèges passent par les route handlers serveur (`app/api/`).
- **Syndic** : lecture + messagerie uniquement. Jamais d'accès aux fiches résident, historiques de services individuels ou données de paiement — vérifié par RLS et testé.
- **Design** : navy `#0A1628`, or `#B8922A`, crème `#F5F3EE`. Lora (titres) + Poppins (corps). Radius 8px cartes / 24px boutons. Un seul élément doré par écran.
- Interfaces + mocks pour les intégrations externes (SMS, WhatsApp, Mapbox) tant que les comptes ne sont pas ouverts.

## Commandes
- `npm run dev` — serveur de dev
- `npx supabase start` / `stop` — stack Supabase locale (Docker)
- `npx supabase db reset` — rejoue migrations + seed
- `npm run test:rls` — suite de tests d'isolation multi-tenant

## Déploiement (app.maison-cavalier.com)
- `Dockerfile` : build standalone Next.js (multi-stage, image finale minimale)
- `docker-compose.yml` : conteneur app seul, publié derrière le Traefik partagé de Dokploy (réseau externe `dokploy-network`, labels `traefik.*`, HTTPS Let's Encrypt sur le domaine)
- Cible un projet **Supabase Cloud** (pas le stack local) : copier `.env.production.example` en `.env`, renseigner les clés du dashboard Supabase, puis `docker compose up -d --build`
- La clé service-role reste côté serveur uniquement (jamais dans `NEXT_PUBLIC_*`)
