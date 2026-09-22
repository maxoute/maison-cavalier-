/**
 * Formats d'affichage partagés (client et serveur). Tout est rendu en
 * français et en heure de Paris : la loge travaille en heure locale, les
 * horodatages restent stockés en UTC.
 */
export const TIME_ZONE = 'Europe/Paris';

const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE,
});
const dateTimeYearFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE,
});
const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: TIME_ZONE,
});
const shortDateFormat = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short', day: 'numeric', month: 'short', timeZone: TIME_ZONE,
});
const timeFormat = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE,
});
const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: TIME_ZONE });
const moneyFormat = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const moneyRoundFormat = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const percentFormat = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 0 });

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

/** « 22 sept., 15:54 » — ajoute l'année quand elle diffère de l'année courante. */
export function formatDateTime(value: string | number | Date | null | undefined, now = new Date()): string {
  const date = toDate(value);
  if (!date) return '—';
  const sameYear = date.getFullYear() === now.getFullYear();
  return (sameYear ? dateTimeFormat : dateTimeYearFormat).format(date);
}

/** « 22 septembre 2026 ». */
export function formatDate(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  return date ? dateFormat.format(date) : '—';
}

/** « mar. 22 sept. ». */
export function formatShortDate(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  return date ? shortDateFormat.format(date) : '—';
}

/** « 15:54 ». */
export function formatTime(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  return date ? timeFormat.format(date) : '—';
}

/** « septembre 2026 ». */
export function formatMonth(value: string | number | Date): string {
  const date = toDate(value);
  return date ? monthFormat.format(date) : '—';
}

/** Montant en centimes → « 1 234,56 € ». */
export function formatMoney(cents: number | null | undefined, options: { round?: boolean } = {}): string {
  if (cents == null || !Number.isFinite(cents)) return '—';
  return (options.round ? moneyRoundFormat : moneyFormat).format(cents / 100);
}

/** 0.125 → « 13 % ». */
export function formatPercent(ratio: number | null | undefined): string {
  if (ratio == null || !Number.isFinite(ratio)) return '—';
  return percentFormat.format(ratio);
}

/** Durée en minutes → « 45 min », « 2 h 05 », « 3 j 4 h ». */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return '—';
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours < 24) return rest ? `${hours} h ${String(rest).padStart(2, '0')}` : `${hours} h`;
  const days = Math.floor(hours / 24);
  const hoursRest = hours % 24;
  return hoursRest ? `${days} j ${hoursRest} h` : `${days} j`;
}

/** Écart relatif à maintenant : « il y a 3 min », « dans 2 h 10 ». */
export function formatRelative(value: string | number | Date | null | undefined, now = Date.now()): string {
  const date = toDate(value);
  if (!date) return '—';
  const diff = date.getTime() - now;
  const minutes = Math.round(Math.abs(diff) / 60_000);
  if (minutes < 1) return "à l'instant";
  return diff < 0 ? `il y a ${formatDuration(minutes)}` : `dans ${formatDuration(minutes)}`;
}

/** Valeur `datetime-local` (heure de Paris) pour un input, à partir d'un ISO. */
export function toLocalInputValue(value: string | null | undefined): string {
  const date = toDate(value);
  if (!date) return '';
  const parts = new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TIME_ZONE,
  }).formatToParts(date).reduce<Record<string, string>>((acc, part) => { acc[part.type] = part.value; return acc; }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}`;
}

/** Pluriel simple : count(3, 'demande') → « 3 demandes ». */
export function count(value: number, singular: string, plural = `${singular}s`): string {
  return `${value.toLocaleString('fr-FR')} ${value > 1 ? plural : singular}`;
}
