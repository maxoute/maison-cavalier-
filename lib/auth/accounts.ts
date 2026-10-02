import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { emailProvider, isEmailLive } from '@/lib/email/provider';
import { invitationEmail, resetEmail } from './emails';
import { accessLink } from './links';

type AdminClient = ReturnType<typeof createAdminClient>;

/** Adresse publique de l'application, base des liens envoyés par e-mail. */
export function appUrl(): string {
  return (process.env.APP_URL?.trim() || 'http://localhost:3000').replace(/\/+$/, '');
}

/** Résultat d'un envoi d'accès : le lien n'est restitué que s'il n'est pas parti par e-mail. */
export interface AccessDelivery {
  userId: string;
  email: string;
  emailed: boolean;
  /** Lien à transmettre à la main (e-mails non configurés ou envoi en échec). */
  link: string | null;
}

export function accountError(message: string, code: string | undefined, mail: string) {
  if (code === 'email_exists' || /already (been )?registered|already exists|duplicate/i.test(message)) {
    return new Error(`Un compte existe déjà avec l’adresse ${mail}.`);
  }
  return new Error(`Création du compte ${mail} impossible : ${message}`);
}

async function deliver(email: string, message: { subject: string; body: string; html: string }): Promise<boolean> {
  if (!isEmailLive()) return false;
  try {
    await emailProvider.send({ to: email, ...message });
    return true;
  } catch (error) {
    console.error('[auth:email]', error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Invite une personne : compte auth sans mot de passe (rôle + immeuble dans
 * app_metadata, lus par la RLS), profil, puis lien d'activation par e-mail
 * — ou restitué à l'écran si l'e-mail ne peut pas partir. Le compte auth est
 * supprimé si une étape échoue : pas de compte orphelin.
 */
export async function inviteAccount(
  admin: AdminClient,
  input: { email: string; fullName: string; phone?: string | null; role: string; buildingId: string; buildingName: string },
): Promise<AccessDelivery> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'invite',
    email: input.email,
    options: { data: { full_name: input.fullName } },
  });
  if (error || !data?.user || !data.properties?.hashed_token) {
    throw accountError(error?.message ?? 'réponse vide du service d’authentification', error?.code, input.email);
  }
  const userId = data.user.id;
  // Un compte déjà existant (même e-mail) serait sinon réattribué en silence.
  if (data.user.app_metadata?.role) {
    throw accountError('already registered', 'email_exists', input.email);
  }

  const { error: metadataError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role: input.role, building_id: input.buildingId },
  });
  const { error: profileError } = metadataError
    ? { error: metadataError }
    : await admin.from('profiles').insert({
        id: userId, building_id: input.buildingId, role: input.role, full_name: input.fullName, phone: input.phone ?? null,
      });
  if (profileError) {
    await admin.auth.admin.deleteUser(userId).catch(() => null);
    throw new Error(`Compte de ${input.fullName} non enregistré : ${profileError.message}`);
  }

  const link = accessLink(appUrl(), data.properties.hashed_token, 'invite');
  const emailed = await deliver(input.email, invitationEmail({
    fullName: input.fullName, role: input.role, buildingName: input.buildingName, link,
  }));
  return { userId, email: input.email, emailed, link: emailed ? null : link };
}

/**
 * Nouveau lien d'accès pour un compte existant : invitation renvoyée tant
 * qu'elle n'a pas été acceptée, réinitialisation du mot de passe ensuite.
 * Chaque nouveau lien invalide le précédent.
 */
export async function sendAccessLink(
  admin: AdminClient,
  target: { userId: string; fullName: string; role: string; buildingName: string },
): Promise<AccessDelivery & { kind: 'invite' | 'recovery' }> {
  const { data: found, error: lookupError } = await admin.auth.admin.getUserById(target.userId);
  const email = found?.user?.email;
  if (lookupError || !email) throw new Error('Compte introuvable dans l’annuaire d’authentification.');

  const kind = found.user.email_confirmed_at ? 'recovery' : 'invite';
  const { data, error } = await admin.auth.admin.generateLink({ type: kind, email });
  if (error || !data?.properties?.hashed_token) throw new Error(`Lien d’accès impossible : ${error?.message ?? 'réponse vide'}`);

  const link = accessLink(appUrl(), data.properties.hashed_token, kind);
  const message = kind === 'invite'
    ? invitationEmail({ fullName: target.fullName, role: target.role, buildingName: target.buildingName, link })
    : resetEmail({ fullName: target.fullName, link });
  const emailed = await deliver(email, message);
  return { userId: target.userId, email, emailed, link: emailed ? null : link, kind };
}

/**
 * « Mot de passe oublié » : envoie un lien de réinitialisation si — et
 * seulement si — un compte actif existe. Ne dit jamais à l'appelant si
 * l'adresse est connue.
 */
export async function requestReset(admin: AdminClient, email: string): Promise<void> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email });
  if (error || !data?.user || !data.properties?.hashed_token) return;
  const banned = data.user.banned_until && Date.parse(data.user.banned_until) > Date.now();
  if (banned || !data.user.app_metadata?.role) return;
  const fullName = (data.user.user_metadata?.full_name as string | undefined) ?? email;
  await deliver(email, resetEmail({ fullName, link: accessLink(appUrl(), data.properties.hashed_token, 'recovery') }));
}

export async function audit(
  admin: AdminClient,
  row: { building_id: string; actor_id: string; action: string; entity: string; entity_id: string; details: Record<string, unknown> },
) {
  // Journal best-effort : une écriture d'audit en échec ne doit pas annuler
  // l'opération métier déjà committée en base.
  await admin.from('audit_logs').insert(row);
}
