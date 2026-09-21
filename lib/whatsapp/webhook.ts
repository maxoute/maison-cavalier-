import { createHmac, timingSafeEqual } from 'node:crypto';
import type { MessageDeliveryStatus } from '@/types';

/** Message reçu d'un résident, déjà réduit à ce que l'application stocke. */
export interface InboundMessage {
  /** Identifiant du fil chez Meta : le numéro du résident, sans « + ». */
  waId: string;
  /** Identifiant du message (« wamid.… ») : clé d'idempotence. */
  externalMessageId: string;
  body: string;
  receivedAt: string;
}

/** Accusé de livraison d'un message que nous avons envoyé. */
export interface InboundStatus {
  externalMessageId: string;
  status: MessageDeliveryStatus;
}

export interface WebhookPayload {
  messages: InboundMessage[];
  statuses: InboundStatus[];
}

const statusMap: Record<string, MessageDeliveryStatus> = {
  sent: 'envoye', delivered: 'livre', read: 'lu', failed: 'echec',
};

/**
 * Signature `X-Hub-Signature-256` de Meta : HMAC SHA-256 du corps **brut**
 * avec le secret de l'application. La comparaison est à temps constant ;
 * sans secret configuré, la vérification échoue au lieu de laisser passer.
 */
export function verifySignature(rawBody: string, header: string | null, appSecret: string | undefined): boolean {
  if (!appSecret || !header?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  const provided = Buffer.from(header.slice('sha256='.length), 'utf8');
  const reference = Buffer.from(expected, 'utf8');
  return provided.length === reference.length && timingSafeEqual(provided, reference);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Extrait messages et accusés d'un événement Meta. Tout ce qui n'est pas
 * exploitable (média sans légende, type inconnu, champ manquant) est ignoré
 * silencieusement : un webhook mal formé ne doit jamais faire échouer la
 * réception des messages qui l'accompagnent.
 */
export function parseWebhook(payload: unknown): WebhookPayload {
  const messages: InboundMessage[] = [];
  const statuses: InboundStatus[] = [];
  for (const entry of asArray(asRecord(payload).entry)) {
    for (const change of asArray(asRecord(entry).changes)) {
      const value = asRecord(asRecord(change).value);
      for (const raw of asArray(value.messages)) {
        const message = asRecord(raw);
        const body = asRecord(message.text).body;
        const waId = typeof message.from === 'string' ? message.from.replace(/\D/g, '') : '';
        const externalMessageId = typeof message.id === 'string' ? message.id : '';
        if (!waId || !externalMessageId || typeof body !== 'string' || !body.trim()) continue;
        const seconds = Number(message.timestamp);
        messages.push({
          waId, externalMessageId,
          body: body.slice(0, 4000),
          receivedAt: new Date(Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : Date.now()).toISOString(),
        });
      }
      for (const raw of asArray(value.statuses)) {
        const update = asRecord(raw);
        const status = typeof update.status === 'string' ? statusMap[update.status] : undefined;
        const externalMessageId = typeof update.id === 'string' ? update.id : '';
        if (!status || !externalMessageId) continue;
        statuses.push({ externalMessageId, status });
      }
    }
  }
  return { messages, statuses };
}
