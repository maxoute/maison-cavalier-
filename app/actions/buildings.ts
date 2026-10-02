'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { managerContext } from '@/lib/admin/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { audit, inviteAccount, type AccessDelivery } from '@/lib/auth/accounts';
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

function emailField(form: FormData, name: string, required = true) {
  const value = field(form, name, required, 160);
  if (!value) return null;
  const normalised = value.toLowerCase();
  if (!emailPattern.test(normalised)) throw new Error(`Adresse e-mail invalide : ${value}`);
  return normalised;
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

    const syndicName = field(form, 'syndic_name', false, 120);
    const syndicEmail = emailField(form, 'syndic_email', false);
    const withSyndic = Boolean(syndicName || syndicEmail);
    if (withSyndic && !(syndicName && syndicEmail)) throw new Error('Compte syndic incomplet : le nom et l’e-mail vont ensemble.');
    if (withSyndic && syndicEmail === conciergeEmail) throw new Error('Le concierge et le syndic doivent avoir deux adresses distinctes.');

    const { data: building, error } = await admin
      .from('buildings')
      .insert({ name, address, b2b_plan: plan })
      .select('id, name')
      .single();
    if (error || !building) throw new Error(`Immeuble non créé : ${error?.message ?? 'réponse vide'}`);
    buildingId = building.id as string;

    const invitations: { label: string; delivery: AccessDelivery }[] = [];
    const concierge = await inviteAccount(admin, {
      email: conciergeEmail, fullName: conciergeName, role: 'concierge', buildingId, buildingName: name,
    });
    createdUsers.push(concierge.userId);
    invitations.push({ label: 'Concierge', delivery: concierge });
    if (withSyndic) {
      const syndic = await inviteAccount(admin, {
        email: syndicEmail!, fullName: syndicName!, role: 'syndic', buildingId, buildingName: name,
      });
      createdUsers.push(syndic.userId);
      invitations.push({ label: 'Syndic', delivery: syndic });
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

    const lines = [`Immeuble « ${name} » créé et activé — catalogue de services provisionné.`];
    for (const { label, delivery } of invitations) {
      lines.push(delivery.emailed
        ? `${label} · invitation envoyée par e-mail à ${delivery.email}.`
        : `${label} · ${delivery.email} : e-mail non parti, lien d’activation à transmettre ci-dessous.`);
    }
    // Un seul lien affichable à la fois : les autres se renvoient depuis
    // « Utilisateurs » (« Envoyer un lien d’accès »).
    const pending = invitations.filter(({ delivery }) => delivery.link);
    if (pending.length > 1) lines.push('Les autres liens s’obtiennent depuis Utilisateurs → « Envoyer un lien d’accès ».');
    return { success: lines.join('\n'), link: pending[0]?.delivery.link ?? undefined };
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
