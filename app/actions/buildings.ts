'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { managerContext } from '@/lib/admin/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { field } from '@/lib/operations/server';
import type { ActionResult } from '@/lib/operations/shared';

/**
 * Onboarding d'un immeuble en moins de 5 minutes (PRD §6.3.2).
 *
 * Tout passe par la clé service-role : créer un immeuble et des comptes
 * auth sort du périmètre de la RLS. L'autorisation est donc revérifiée
 * explicitement ici — un Server Action est un endpoint public.
 */

const plans = ['essentiel', 'premium', 'signature'] as const;

const emailPattern = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

type AdminClient = ReturnType<typeof createAdminClient>;

function emailField(form: FormData, name: string, required = true) {
  const value = field(form, name, required, 160);
  if (!value) return null;
  const normalised = value.toLowerCase();
  if (!emailPattern.test(normalised)) throw new Error(`Adresse e-mail invalide : ${value}`);
  return normalised;
}

function passwordField(form: FormData, name: string, required = true) {
  const value = field(form, name, required, 72);
  if (!value) return null;
  if (value.length < 8) throw new Error('Mot de passe temporaire : 8 caractères minimum.');
  return value;
}

/** Messages d'erreur auth traduits : l'e-mail déjà pris est le cas courant. */
function accountError(message: string, code: string | undefined, mail: string) {
  if (code === 'email_exists' || /already (been )?registered|already exists|duplicate/i.test(message)) {
    return new Error(`Un compte existe déjà avec l’adresse ${mail}.`);
  }
  if (code === 'weak_password') return new Error(`Mot de passe trop faible pour ${mail} : choisissez-en un plus long.`);
  return new Error(`Création du compte ${mail} impossible : ${message}`);
}

/**
 * Crée le compte auth (rôle + immeuble dans app_metadata, lus par la RLS)
 * puis son profil. Le compte auth est supprimé si le profil échoue : pas
 * de compte capable de se connecter sans profil.
 */
async function createAccount(
  admin: AdminClient,
  input: { email: string; password: string; fullName: string; phone?: string | null; role: string; buildingId: string },
) {
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    app_metadata: { role: input.role, building_id: input.buildingId },
    user_metadata: { full_name: input.fullName },
  });
  if (error || !data?.user) throw accountError(error?.message ?? 'réponse vide du service d’authentification', error?.code, input.email);

  const { error: profileError } = await admin.from('profiles').insert({
    id: data.user.id,
    building_id: input.buildingId,
    role: input.role,
    full_name: input.fullName,
    phone: input.phone ?? null,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id).catch(() => null);
    throw new Error(`Profil de ${input.fullName} non enregistré : ${profileError.message}`);
  }
  return data.user.id;
}

async function audit(
  admin: AdminClient,
  row: { building_id: string; actor_id: string; action: string; entity: string; entity_id: string; details: Record<string, unknown> },
) {
  // Journal best-effort : une écriture d'audit en échec ne doit pas annuler
  // l'opération métier déjà committée en base.
  await admin.from('audit_logs').insert(row);
}

export async function onboardBuilding(_: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = createAdminClient();
  let buildingId: string | null = null;
  const createdUsers: string[] = [];
  let committed = false;

  try {
    const { session } = await managerContext();
    if (session.role !== 'super_admin') throw new Error('Seul un super-administrateur peut créer un immeuble.');

    const name = field(form, 'name', true, 120)!;
    const address = field(form, 'address', true, 240)!;
    const plan = field(form, 'b2b_plan', true, 20)!;
    if (!(plans as readonly string[]).includes(plan)) throw new Error('Formule B2B inconnue.');

    const conciergeName = field(form, 'concierge_name', true, 120)!;
    const conciergeEmail = emailField(form, 'concierge_email')!;
    const conciergePassword = passwordField(form, 'concierge_password')!;

    const syndicName = field(form, 'syndic_name', false, 120);
    const syndicEmail = emailField(form, 'syndic_email', false);
    const syndicPassword = field(form, 'syndic_password', false, 72);
    const withSyndic = Boolean(syndicName || syndicEmail);
    if (withSyndic && !(syndicName && syndicEmail)) throw new Error('Compte syndic incomplet : le nom et l’e-mail vont ensemble.');
    if (withSyndic && (!syndicPassword || syndicPassword.length < 8)) throw new Error('Mot de passe du syndic : 8 caractères minimum.');
    if (withSyndic && syndicEmail === conciergeEmail) throw new Error('Le concierge et le syndic doivent avoir deux adresses distinctes.');

    const { data: building, error } = await admin
      .from('buildings')
      .insert({ name, address, b2b_plan: plan })
      .select('id, name')
      .single();
    if (error || !building) throw new Error(`Immeuble non créé : ${error?.message ?? 'réponse vide'}`);
    buildingId = building.id as string;

    createdUsers.push(
      await createAccount(admin, {
        email: conciergeEmail,
        password: conciergePassword,
        fullName: conciergeName,
        role: 'concierge',
        buildingId,
      }),
    );
    if (withSyndic) {
      createdUsers.push(
        await createAccount(admin, {
          email: syndicEmail!,
          password: syndicPassword!,
          fullName: syndicName!,
          role: 'syndic',
          buildingId,
        }),
      );
    }

    await audit(admin, {
      building_id: buildingId,
      actor_id: session.userId,
      action: 'onboard_building',
      entity: 'buildings',
      entity_id: buildingId,
      details: {
        name,
        address,
        b2b_plan: plan,
        concierge: conciergeEmail,
        syndic: withSyndic ? syndicEmail : null,
      },
    });
    committed = true;

    // L'immeuble fraîchement créé devient l'immeuble piloté : la démo
    // enchaîne sur son catalogue de services sans passer par le sélecteur.
    (await cookies()).set('mc-building', buildingId, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
    });
    revalidatePath('/admin', 'layout');
    revalidatePath('/concierge', 'layout');

    const lines = [
      `Immeuble « ${name} » créé et activé — catalogue de services provisionné.`,
      `Concierge · ${conciergeEmail} · mot de passe ${conciergePassword}`,
    ];
    if (withSyndic) lines.push(`Syndic · ${syndicEmail} · mot de passe ${syndicPassword}`);
    lines.push('Mots de passe temporaires : à faire changer à la première connexion.');
    return { success: lines.join('\n') };
  } catch (error) {
    if (!committed) {
      // Rollback au mieux : aucun immeuble à moitié créé ne doit rester.
      for (const id of createdUsers) await admin.auth.admin.deleteUser(id).catch(() => null);
      if (buildingId) {
        await admin.from('notification_templates').delete().eq('building_id', buildingId);
        await admin.from('building_services').delete().eq('building_id', buildingId);
        await admin.from('buildings').delete().eq('id', buildingId);
      }
    }
    return { error: error instanceof Error ? error.message : 'Création de l’immeuble impossible.' };
  }
}
