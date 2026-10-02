import { cronAuthorized } from '@/lib/cron';
import { createAdminClient } from '@/lib/supabase/admin';
import { flushWhatsAppOutbox } from '@/lib/whatsapp/outbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Rappels « colis non retiré » J+2 (PRD Annexe A), pour un ordonnanceur
 * externe. Les rappels WhatsApp mis en file partent dans la foulée.
 */
export async function POST(request: Request) {
  if (!cronAuthorized(request)) return new Response('Accès refusé.', { status: 401 });
  const { data, error } = await createAdminClient().rpc('send_parcel_reminders');
  if (error) return Response.json({ error: 'Rappels indisponibles.' }, { status: 503 });
  const whatsapp = await flushWhatsAppOutbox().catch(() => null);
  return Response.json({ reminders: typeof data === 'number' ? data : 0, whatsapp });
}
