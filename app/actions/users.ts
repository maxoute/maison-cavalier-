'use server';

import { revalidatePath } from 'next/cache';
import { managerContext } from '@/lib/admin/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { field } from '@/lib/operations/server';
import type { ActionResult } from '@/lib/operations/shared';

/**
 * Gestion des comptes d'accès web (PRD §6.3.3).
 *
 * Résidents et chauffeurs n'ont pas d'accès web (apps mobiles) : ils ne
 * sont jamais proposés à la création. La RLS ne protège pas `auth.users`,
 * donc chaque action revérifie le périmètre du demandeur :
 *  - super_admin : tous les immeubles, tous les rôles ;
 *  - admin : concierge et syndic de son seul immeuble ;
 *  - personne ne peut désactiver son propre compte.
 */

/** Rôles attribuables depuis la console (un fichier `use server` n'exporte
 *  que des fonctions : la liste affichée est redéclarée côté page). */
const assignableRoles = ['concierge', 'syndic', 'admin', 'super_admin'] as const;
/** Ce qu'un admin d'immeuble peut créer et désactiver. */
const adminManagedRoles = ['concierge', 'syndic'];

const BAN_FOREVER = '876000h'; // 100 ans : désactivation, réversible

const emailPattern = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const uuidPattern = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

type AdminClient = ReturnType<typeof createAdminClient>;

function accountError(message: string, code: string | undefined, mail: string) {
  if (code === 'email_exists' || /already (been )?registered|already exists|duplicate/i.test(message)) {
    return new Error(`Un compte existe déjà avec l’adresse ${mail}.`);
  }
  if (code === 'weak_password') return new Error('Mot de passe trop faible : choisissez-en un plus long.');
  return new Error(`Création du compte ${mail} impossible : ${message}`);
}

async function createAccount(
  admin: AdminClient,
  input: { email: string; password: string; fullName: string; phone: string | null; role: string; buildingId: string },
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
    phone: input.phone,
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
  await admin.from('audit_logs').insert(row);
}

function refreshUsers() {
  revalidatePath('/admin/utilisateurs');
  revalidatePath('/admin/immeubles');
  revalidatePath('/admin');
}

export async function createUser(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const { session, db } = await managerContext();
    const admin = createAdminClient();

    const role = field(form, 'role', true, 20)!;
    if (!(assignableRoles as readonly string[]).includes(role)) {
      throw new Error('Ce rôle ne s’attribue pas depuis la console : résidents et chauffeurs passent par les apps mobiles.');
    }

    // Périmètre : le super-admin choisit l'immeuble, l'admin est figé au sien.
    // `homeBuildingId` vient du JWT : contrairement à `buildingId`, aucun
    // cookie ne peut le déplacer — c'est lui qui borne les droits de l'admin.
    let buildingId = session.homeBuildingId;
    if (session.role === 'super_admin') {
      const requested = field(form, 'building_id', true, 40)!;
      if (!uuidPattern.test(requested)) throw new Error('Immeuble invalide.');
      buildingId = requested;
    } else {
      if (!adminManagedRoles.includes(role)) {
        throw new Error('Un administrateur d’immeuble ne crée que des comptes concierge ou syndic.');
      }
      const requested = field(form, 'building_id', false, 40);
      if (requested && requested !== session.homeBuildingId) {
        throw new Error('Un administrateur ne peut créer un compte que dans son propre immeuble.');
      }
    }

    // Double barrière : la policy RLS `buildings_select` ne laisse voir à
    // l'admin que son immeuble, le super_admin voit tout.
    const { data: building } = await db.from('buildings').select('id, name').eq('id', buildingId).maybeSingle();
    if (!building) throw new Error('Immeuble introuvable ou hors de votre périmètre.');

    const fullName = field(form, 'full_name', true, 120)!;
    const mail = field(form, 'email', true, 160)!.toLowerCase();
    if (!emailPattern.test(mail)) throw new Error(`Adresse e-mail invalide : ${mail}`);
    const phone = field(form, 'phone', false, 30);
    const password = field(form, 'password', true, 72)!;
    if (password.length < 8) throw new Error('Mot de passe temporaire : 8 caractères minimum.');

    const userId = await createAccount(admin, { email: mail, password, fullName, phone, role, buildingId });

    await audit(admin, {
      building_id: buildingId,
      actor_id: session.userId,
      action: 'create_user',
      entity: 'profiles',
      entity_id: userId,
      details: { email: mail, role, full_name: fullName, building: building.name },
    });

    refreshUsers();
    return {
      success: [
        `Compte créé pour ${fullName} — ${roleLabel(role)} · ${building.name}.`,
        `Identifiants · ${mail} · mot de passe ${password}`,
        'Mot de passe temporaire : à faire changer à la première connexion.',
      ].join('\n'),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Création du compte impossible.' };
  }
}

export async function setUserActive(id: string, active: boolean): Promise<ActionResult> {
  try {
    const { session } = await managerContext();
    if (!uuidPattern.test(id)) throw new Error('Identifiant invalide.');
    if (id === session.userId) throw new Error('Vous ne pouvez pas désactiver votre propre compte.');

    const admin = createAdminClient();
    const { data: target, error } = await admin
      .from('profiles')
      .select('id, building_id, role, full_name')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`Compte illisible : ${error.message}`);
    if (!target) throw new Error('Compte introuvable.');

    if (session.role !== 'super_admin') {
      if (target.building_id !== session.homeBuildingId) throw new Error('Ce compte dépend d’un autre immeuble.');
      if (!adminManagedRoles.includes(target.role)) {
        throw new Error('Un administrateur d’immeuble ne gère que les comptes concierge et syndic.');
      }
    }

    const { error: banError } = await admin.auth.admin.updateUserById(id, {
      ban_duration: active ? 'none' : BAN_FOREVER,
    });
    if (banError) throw new Error(`Modification impossible : ${banError.message}`);

    await audit(admin, {
      building_id: target.building_id,
      actor_id: session.userId,
      action: active ? 'reactivate_user' : 'deactivate_user',
      entity: 'profiles',
      entity_id: target.id,
      details: { full_name: target.full_name, role: target.role },
    });

    refreshUsers();
    return {
      success: active
        ? `Compte de ${target.full_name} réactivé.`
        : `Compte de ${target.full_name} désactivé : connexion refusée.`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Modification impossible.' };
  }
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    concierge: 'concierge',
    admin: 'administrateur',
    super_admin: 'super-administrateur',
    syndic: 'syndic',
  };
  return labels[role] ?? role;
}
