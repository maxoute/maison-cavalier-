import { timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Rappels « colis non retiré » J+2 (PRD Annexe A), pour un ordonnanceur
 * externe. Sans `CRON_SECRET` configuré, la route refuse tout : un rappel
 * déclenchable par n'importe qui vaudrait moins que pas de rappel du tout.
 */
function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function POST(request: Request) {
  if (!authorized(request)) return new Response('Accès refusé.', { status: 401 });
  const { data, error } = await createAdminClient().rpc('send_parcel_reminders');
  if (error) return Response.json({ error: 'Rappels indisponibles.' }, { status: 503 });
  return Response.json({ reminders: typeof data === 'number' ? data : 0 });
}
