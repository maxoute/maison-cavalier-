import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/types";

export interface SessionInfo {
  userId: string;
  role: Role;
  /** Immeuble piloté : celui du JWT, ou celui choisi par le super-admin. */
  buildingId: string;
  /** Immeuble d'origine du compte (JWT). */
  homeBuildingId: string;
  profile: Profile | null;
}

const uuidPattern = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/**
 * Lit la session côté serveur ; null si non connecté.
 * Le super-admin bascule d'immeuble sans se déconnecter (PRD §6.3.2) : son
 * immeuble actif est le cookie `mc-building` (validé en base), et tous les
 * portails le suivent. Les autres rôles restent sur l'immeuble de leur JWT,
 * la RLS refusant de toute façon les autres.
 */
export async function getSession(): Promise<SessionInfo | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;

  const role = claims.app_metadata?.role as Role | undefined;
  const homeBuildingId = claims.app_metadata?.building_id as string | undefined;
  if (!role || !homeBuildingId) return null;

  let buildingId = homeBuildingId;
  if (role === "super_admin") {
    const selected = (await cookies()).get("mc-building")?.value;
    if (selected && selected !== homeBuildingId && uuidPattern.test(selected)) {
      const { data: building } = await supabase.from("buildings").select("id").eq("id", selected).maybeSingle();
      if (building) buildingId = building.id;
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", claims.sub)
    .maybeSingle();

  return { userId: claims.sub, role, buildingId, homeBuildingId, profile };
}
