import { after } from 'next/server';
import { readMetaConfig } from '@/lib/whatsapp';
import { triageInboundMessage } from '@/lib/whatsapp/triage';
import { recordInbound } from '@/lib/whatsapp/inbound';
import { parseWebhook, verifySignature } from '@/lib/whatsapp/webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Webhook Meta Cloud API (PRD §6.1.1). Tant que le compte Business n'est pas
 * ouvert, la route répond 503 : aucune écriture n'est possible sans le
 * secret qui authentifie Meta.
 */
export async function GET(request: Request) {
  const config = readMetaConfig();
  if (!config) return new Response('WhatsApp non configuré.', { status: 503 });
  const parameters = new URL(request.url).searchParams;
  const token = parameters.get('hub.verify_token') ?? '';
  const challenge = parameters.get('hub.challenge') ?? '';
  if (parameters.get('hub.mode') !== 'subscribe' || token !== config.verifyToken) {
    return new Response('Vérification refusée.', { status: 403 });
  }
  return new Response(challenge, { headers: { 'Content-Type': 'text/plain' } });
}

export async function POST(request: Request) {
  const config = readMetaConfig();
  if (!config) return new Response('WhatsApp non configuré.', { status: 503 });
  // La signature porte sur le corps brut : il est lu tel quel, jamais reparsé
  // avant vérification.
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get('x-hub-signature-256'), config.appSecret)) {
    return new Response('Signature invalide.', { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response('Charge utile illisible.', { status: 400 });
  }
  const { messages, statuses } = parseWebhook(payload);
  try {
    const { storedIds, ...report } = await recordInbound(messages, statuses);
    // Meta attend une réponse rapide : l'analyse LLM passe après l'accusé.
    after(async () => { for (const id of storedIds) await triageInboundMessage(id); });
    return Response.json(report);
  } catch {
    // Une erreur 5xx fait rejouer l'événement par Meta : c'est le
    // comportement voulu, l'insertion est idempotente.
    return new Response('Réception indisponible.', { status: 503 });
  }
}
