import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canAccess, mfaRequiredRoles, roleHome } from "@/lib/rbac";
import type { Role } from "@/types";

const PUBLIC_PATHS = ["/login", "/acces-refuse"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Rafraîchit la session et vérifie le JWT
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const role = (claims?.app_metadata?.role as Role | undefined) ?? null;
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!claims) {
    if (isPublic) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 2FA obligatoire pour le staff (PRD §7.1) : session aal1 => challenge
  const aal = (claims.aal as string | undefined) ?? "aal1";
  if (
    role &&
    mfaRequiredRoles.includes(role) &&
    aal !== "aal2" &&
    !pathname.startsWith("/login")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login/mfa";
    return NextResponse.redirect(url);
  }

  // Utilisateur connecté sur /login (hors MFA en cours) → son portail
  if (pathname === "/login" || pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = role ? roleHome[role] : "/acces-refuse";
    return NextResponse.redirect(url);
  }

  // RBAC par portail : le syndic qui tape une URL concierge est refusé (PRD §6.2)
  if (!canAccess(pathname, role)) {
    const url = request.nextUrl.clone();
    url.pathname = "/acces-refuse";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest|icons|api/).*)",
  ],
};
