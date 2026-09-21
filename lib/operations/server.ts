import 'server-only';
import { getSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { parseUtcDateTime } from './dates';

export async function staffContext() {
  const session = await getSession();
  if (!session || !['concierge', 'admin', 'super_admin'].includes(session.role)) throw new Error('Accès réservé à la conciergerie.');
  return { session, db: await createClient(), now: Date.now() };
}
export function field(data: FormData, name: string, required = false, max = 2000) {
  const value = data.get(name);
  const text = typeof value === 'string' ? value.trim() : '';
  if ((required && !text) || text.length > max) throw new Error(`Champ ${name} invalide.`);
  return text || null;
}
export function uuid(data: FormData, name: string) {
  const value = field(data, name, true)!;
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) throw new Error('Identifiant invalide.');
  return value;
}
export function dateField(data: FormData, name: string) {
  const value = field(data, name);
  if (!value) return null;
  return parseUtcDateTime(value);
}
export function check(error: { message: string; code?: string } | null) {
  if (error) throw new Error(error.code === '23505' ? 'Cet élément existe déjà.' : 'Enregistrement impossible. Vérifiez les données et réessayez.');
}
export async function residentsForStaff() {
  const { db, session } = await staffContext();
  const residents: { id: string; full_name: string }[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from('residents').select('id, full_name')
      .eq('building_id', session.buildingId).order('full_name').order('id').range(offset, offset + 499);
    check(error);
    residents.push(...(data ?? []));
    if (!data || data.length < 500) return residents;
  }
}
