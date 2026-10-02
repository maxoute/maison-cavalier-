import 'server-only';

import { timingSafeEqual } from 'node:crypto';

/**
 * Routes appelées par un ordonnanceur externe (« Authorization: Bearer
 * CRON_SECRET »). Sans secret configuré, tout est refusé : une tâche
 * déclenchable par n'importe qui vaudrait moins que pas de tâche du tout.
 */
export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
