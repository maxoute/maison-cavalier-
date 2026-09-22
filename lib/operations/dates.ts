const inputPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;

/** Les champs datetime-local libellés en UTC (conservé pour compatibilité). */
export function parseUtcDateTime(value: string): string {
  if (!inputPattern.test(value)) throw new Error('Date invalide.');
  const normalized = value.length === 16 ? `${value}:00` : value;
  const date = new Date(`${normalized}Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 19) !== normalized) throw new Error('Date invalide.');
  return date.toISOString();
}

/** Décalage (minutes) d'un fuseau à un instant donné, calculé avec Intl. */
function timeZoneOffsetMinutes(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs)).reduce<Record<string, number>>((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = Number(part.value);
    return acc;
  }, {});
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUtc - utcMs) / 60_000);
}

/**
 * Les champs datetime-local de la loge sont saisis en heure de Paris
 * (PRD §9 : l'équipe travaille en heure locale) et stockés en UTC.
 * Indépendant du fuseau du serveur.
 */
export function parseParisDateTime(value: string, timeZone = 'Europe/Paris'): string {
  const naive = parseUtcDateTime(value); // valide le format et l'existence de la date
  const naiveMs = Date.parse(naive);
  // Deux itérations suffisent pour converger autour d'un changement d'heure.
  let offset = timeZoneOffsetMinutes(naiveMs, timeZone);
  offset = timeZoneOffsetMinutes(naiveMs - offset * 60_000, timeZone);
  return new Date(naiveMs - offset * 60_000).toISOString();
}
