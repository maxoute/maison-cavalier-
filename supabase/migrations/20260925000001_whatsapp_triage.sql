-- ============================================================
-- Triage des messages WhatsApp entrants par LLM : chaque message reçu est
-- analysé côté serveur (clé service-role) et peut ouvrir une demande.
-- `messages.request_id` porte déjà le lien message → demande ; on garde ici
-- la décision du modèle pour que la loge voie pourquoi une demande a été
-- ouverte — ou non. La colonne suit les policies existantes de `messages`
-- (building_id inchangé), aucune donnée ne sort de l'immeuble.
-- ============================================================

alter table public.messages add column ai_analysis jsonb;
