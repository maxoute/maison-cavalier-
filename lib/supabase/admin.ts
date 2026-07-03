import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client à privilèges (service role) — SERVEUR UNIQUEMENT (PRD §5).
 * À réserver aux opérations qui contournent légitimement la RLS :
 * onboarding immeuble, création de comptes, agrégats cross-tenant.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
