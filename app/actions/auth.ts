"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requestReset } from "@/lib/auth/accounts";
import { isAccessLinkType, passwordProblem } from "@/lib/auth/links";
import { isEmailLive } from "@/lib/email/provider";
import { field } from "@/lib/operations/server";
import type { ActionResult } from "@/lib/operations/shared";
import { roleHome } from "@/lib/rbac";
import type { Role } from "@/types";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Consomme le lien d'accès (invitation ou réinitialisation) au clic sur le
 * bouton de /auth/confirm — jamais à l'ouverture de la page, que les
 * antivirus de messagerie visitent d'avance. Ouvre la session puis mène au
 * choix du mot de passe.
 */
export async function confirmAccessLink(form: FormData) {
  const tokenHash = form.get("token_hash");
  const type = form.get("type");
  if (typeof tokenHash !== "string" || !tokenHash || !isAccessLinkType(type)) redirect("/login?erreur=lien");

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) redirect("/login?erreur=lien");
  redirect(type === "invite" ? "/compte?etape=bienvenue" : "/compte?etape=reinitialisation");
}

/**
 * Choix ou changement du mot de passe de la personne connectée. Après une
 * invitation ou une réinitialisation, la suite mène directement au portail.
 */
export async function setPassword(_: ActionResult, form: FormData): Promise<ActionResult> {
  const password = typeof form.get("password") === "string" ? (form.get("password") as string) : "";
  const confirmation = typeof form.get("confirmation") === "string" ? (form.get("confirmation") as string) : "";
  const problem = passwordProblem(password, confirmation);
  if (problem) return { error: problem };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const role = data?.claims?.app_metadata?.role as Role | undefined;
  if (!data?.claims || !role) return { error: "Session expirée : rouvrez le lien reçu ou reconnectez-vous." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { error: "Ce mot de passe est déjà le vôtre : choisissez-en un nouveau." };
    if (error.code === "weak_password") return { error: "Mot de passe jugé trop faible : allongez-le." };
    return { error: "Mot de passe non enregistré. Réessayez dans un instant." };
  }
  if (form.get("continuer") === "1") redirect(roleHome[role]);
  return { success: "Mot de passe mis à jour." };
}

// Garde-fou contre l'envoi en rafale vers une même adresse : une demande
// par adresse toutes les 5 minutes (mémoire du conteneur, suffisant pour
// une instance unique).
const lastResetRequest = new Map<string, number>();
const RESET_INTERVAL_MS = 5 * 60 * 1000;

/** « Mot de passe oublié » : réponse identique que l'adresse existe ou non. */
export async function requestPasswordReset(_: ActionResult, form: FormData): Promise<ActionResult> {
  let email: string;
  try {
    email = field(form, "email", true, 160)!.toLowerCase();
  } catch {
    return { error: "Indiquez votre adresse e-mail." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) return { error: "Adresse e-mail invalide." };
  if (!isEmailLive()) {
    return { error: "L’envoi d’e-mails n’est pas encore activé : demandez un lien d’accès à votre administrateur." };
  }

  const now = Date.now();
  const previous = lastResetRequest.get(email);
  if (!previous || now - previous > RESET_INTERVAL_MS) {
    lastResetRequest.set(email, now);
    await requestReset(createAdminClient(), email).catch((error) => {
      console.error("[auth:reset]", error instanceof Error ? error.message : error);
    });
  }
  return { success: "Si un compte existe pour cette adresse, un e-mail vient de partir avec un lien pour choisir un nouveau mot de passe. Pensez à vérifier vos courriers indésirables." };
}
