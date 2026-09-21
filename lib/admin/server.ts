import 'server-only';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

const uuidPattern = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/**
 * Contexte d'administration (PRD §6.3) : rôle gestionnaire et immeuble
 * réellement piloté. Le super-admin travaille sur l'immeuble sélectionné
 * dans la barre latérale (cookie `mc-building`), pas sur celui de son JWT ;
 * l'admin reste sur son immeuble, la RLS refusant de toute façon les autres.
 */
export async function managerContext() {
  const session = await getSession();
  if (!session || !['admin', 'super_admin'].includes(session.role)) throw new Error('Accès réservé à l’administration.');
  const db = await createClient();
  let buildingId = session.buildingId;
  if (session.role === 'super_admin') {
    const selected = (await cookies()).get('mc-building')?.value;
    if (selected && uuidPattern.test(selected)) {
      const { data } = await db.from('buildings').select('id').eq('id', selected).maybeSingle();
      if (data) buildingId = data.id;
    }
  }
  return { session, db, buildingId };
}
