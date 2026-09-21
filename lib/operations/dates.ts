/** Les champs datetime-local de la loge sont explicitement libellés en UTC. */
export function parseUtcDateTime(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) throw new Error('Date invalide.');
  const normalized = value.length === 16 ? `${value}:00` : value;
  const date = new Date(`${normalized}Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 19) !== normalized) throw new Error('Date invalide.');
  return date.toISOString();
}
