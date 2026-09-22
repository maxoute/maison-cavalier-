import 'server-only';
import { getSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

/**
 * Contexte d'administration (PRD §6.3) : rôle gestionnaire et immeuble
 * réellement piloté. Le super-admin travaille sur l'immeuble sélectionné
 * dans la barre latérale (résolu par `getSession`), l'admin sur le sien.
 */
export async function managerContext() {
  const session = await getSession();
  if (!session || !['admin', 'super_admin'].includes(session.role)) throw new Error('Accès réservé à l’administration.');
  const db = await createClient();
  return { session, db, buildingId: session.buildingId, now: Date.now() };
}
