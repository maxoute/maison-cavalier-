import type { Role } from "@/types";

/** Portail d'atterrissage par rôle (PRD §4). */
export const roleHome: Record<Role, string> = {
  concierge: "/concierge",
  admin: "/concierge",
  super_admin: "/admin",
  syndic: "/syndic",
  resident: "/acces-refuse", // pas d'accès web (apps mobiles)
  chauffeur: "/acces-refuse",
};

/** Rôles autorisés par préfixe d'URL. */
export const portalAccess: Record<string, Role[]> = {
  "/concierge": ["concierge", "admin", "super_admin"],
  "/syndic": ["syndic", "super_admin"],
  "/admin": ["admin", "super_admin"],
};

/** Rôles pour lesquels la 2FA est obligatoire (PRD §7.1). */
export const mfaRequiredRoles: Role[] = [];

export function canAccess(pathname: string, role: Role | null): boolean {
  const portal = Object.keys(portalAccess).find((p) => pathname.startsWith(p));
  if (!portal) return true; // route publique
  if (!role) return false;
  return portalAccess[portal].includes(role);
}
