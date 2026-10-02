import { cronAuthorized } from '@/lib/cron';
import { flushWhatsAppOutbox } from '@/lib/whatsapp/outbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Vidage de la file WhatsApp par l'ordonnanceur (toutes les minutes par
 * exemple) : rattrape un envoi qu'une action serveur n'aurait pas mené à
 * terme. La réservation ligne à ligne évite tout doublon.
 */
export async function POST(request: Request) {
  if (!cronAuthorized(request)) return new Response('Accès refusé.', { status: 401 });
  try {
    return Response.json(await flushWhatsAppOutbox());
  } catch {
    return Response.json({ error: 'File WhatsApp indisponible.' }, { status: 503 });
  }
}
