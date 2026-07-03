import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/types";

export interface SessionInfo {
  userId: string;
  role: Role;
  buildingId: string;
  profile: Profile | null;
}

/** Lit la session côté serveur ; null si non connecté. */
export async function getSession(): Promise<SessionInfo | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;

  const role = claims.app_metadata?.role as Role | undefined;
  const buildingId = claims.app_metadata?.building_id as string | undefined;
  if (!role || !buildingId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", claims.sub)
    .single();

  return { userId: claims.sub, role, buildingId, profile };
}
