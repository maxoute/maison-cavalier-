/**
 * Fenêtre de service WhatsApp : pendant 24 h après le dernier message du
 * résident, la conciergerie peut lui répondre en texte libre. Au-delà, Meta
 * refuse tout message qui n'est pas un modèle validé.
 */
export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function serviceWindowOpen(lastInboundAt: string | null | undefined, now: number): boolean {
  if (!lastInboundAt) return false;
  const received = Date.parse(lastInboundAt);
  return Number.isFinite(received) && now - received < SERVICE_WINDOW_MS;
}

/** Heure de fermeture de la fenêtre, ou `null` si elle est déjà fermée. */
export function serviceWindowClosesAt(lastInboundAt: string | null | undefined, now: number): Date | null {
  if (!serviceWindowOpen(lastInboundAt, now)) return null;
  return new Date(Date.parse(lastInboundAt!) + SERVICE_WINDOW_MS);
}
