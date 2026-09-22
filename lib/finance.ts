/**
 * Agrégations financières (PRD §6.3.5) — fonctions pures sur des lignes
 * brutes, sans accès base ni React : testées unitairement et réutilisées
 * par l'écran /admin/finance et par l'export CSV.
 *
 * Deux conventions structurent tout le fichier :
 *  - le mois est une clé « YYYY-MM » exprimée en heure de Paris, jamais un
 *    Date : deux serveurs de fuseaux différents rangent une demande du
 *    1er septembre 00h30 dans le même mois ;
 *  - chaque ligne porte une « date d'effet » : la clôture quand elle est
 *    horodatée, sinon la création. Les reprises de données antérieures aux
 *    workflows (clôture non horodatée) restent ainsi comptabilisées.
 */
import type { ServiceType } from '@/types';
import { commissionCents, serviceOrder } from './catalog.ts';
import { serviceLabels } from './requests.ts';

export const TIME_ZONE = 'Europe/Paris';

/** Clé de mois « YYYY-MM ». */
export type MonthKey = string;

const monthKeyFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit',
});
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Décalage (minutes) du fuseau de Paris à un instant donné. */
function zoneOffsetMinutes(utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs)).reduce<Record<string, number>>((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = Number(part.value);
    return acc;
  }, {});
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUtc - utcMs) / 60_000);
}

/** Mois calendaire parisien d'un instant : « 2026-09 ». */
export function monthKey(value: string | number | Date): MonthKey {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Date invalide.');
  return monthKeyFormat.format(date);
}

export function isMonthKey(value: unknown): value is MonthKey {
  return typeof value === 'string' && monthPattern.test(value);
}

/** Mois en cours à Paris. */
export function currentMonth(now: string | number | Date = new Date()): MonthKey {
  return monthKey(now);
}

/**
 * Paramètre `?mois=` : la valeur n'est retenue que si elle est un mois
 * valide et pas dans le futur ; sinon on retombe sur le mois en cours.
 */
export function parseMonthParam(
  value: string | string[] | undefined,
  now: string | number | Date = new Date(),
): MonthKey {
  const current = currentMonth(now);
  const raw = Array.isArray(value) ? value[0] : value;
  if (!isMonthKey(raw) || raw > current) return current;
  return raw;
}

/** Décale une clé de mois de `delta` mois (négatif vers le passé). */
export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [year, index] = month.split('-').map(Number);
  const total = year * 12 + (index - 1) + delta;
  const shiftedYear = Math.floor(total / 12);
  const shiftedMonth = total - shiftedYear * 12 + 1;
  return `${String(shiftedYear).padStart(4, '0')}-${String(shiftedMonth).padStart(2, '0')}`;
}

/** Les `length` derniers mois, le plus ancien d'abord, `month` inclus. */
export function lastMonths(month: MonthKey, length: number): MonthKey[] {
  return Array.from({ length: Math.max(0, length) }, (_, i) => shiftMonth(month, i - (length - 1)));
}

/** Instant UTC du 1er du mois à 00h00 heure de Paris. */
export function monthStartIso(month: MonthKey): string {
  const [year, index] = month.split('-').map(Number);
  const naive = Date.UTC(year, index - 1, 1);
  // Deux itérations suffisent à converger autour d'un changement d'heure.
  let offset = zoneOffsetMinutes(naive);
  offset = zoneOffsetMinutes(naive - offset * 60_000);
  return new Date(naive - offset * 60_000).toISOString();
}

const monthShortFormat = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: TIME_ZONE });

/** « sept. » — libellé court d'un mois, pour les axes de graphique. */
export function monthShortLabel(month: MonthKey): string {
  return monthShortFormat.format(new Date(monthStartIso(month)));
}

/** Bornes UTC [début, fin[ du mois parisien — utilisables telles quelles en SQL. */
export function monthRange(month: MonthKey): { start: string; end: string } {
  return { start: monthStartIso(month), end: monthStartIso(shiftMonth(month, 1)) };
}

/* ---------- Lignes brutes (formes minimales lues en base) ---------- */

export interface RequestRow {
  building_id: string;
  service: ServiceType;
  status: string;
  amount_cents: number | null;
  completed_at: string | null;
  created_at: string;
}
export interface ServiceRateRow {
  building_id: string;
  service: ServiceType;
  commission_rate: number;
}
export interface QuoteRow {
  building_id: string;
  status: string;
  amount_cents: number | null;
  decided_at: string | null;
  sent_at: string | null;
  created_at: string;
}
export interface ShareRow {
  building_id: string;
  status: string;
  commission_cents: number | null;
  status_changed_at: string | null;
  created_at: string;
}
export interface BuildingRow {
  id: string;
  name: string;
}

/** Date d'effet d'une demande : sa clôture, à défaut sa création. */
export function requestDate(row: Pick<RequestRow, 'completed_at' | 'created_at'>): string {
  return row.completed_at ?? row.created_at;
}
/** Date d'effet d'un devis : la décision, à défaut l'envoi, à défaut la création. */
export function quoteDate(row: Pick<QuoteRow, 'decided_at' | 'sent_at' | 'created_at'>): string {
  return row.decided_at ?? row.sent_at ?? row.created_at;
}
/** Date d'effet d'un partage : son dernier changement d'état, à défaut sa création. */
export function shareDate(row: Pick<ShareRow, 'status_changed_at' | 'created_at'>): string {
  return row.status_changed_at ?? row.created_at;
}

/** Index des taux de commission courants, par immeuble et service. */
export function rateIndex(rows: ServiceRateRow[]): Map<string, number> {
  return new Map(rows.map(row => [`${row.building_id}:${row.service}`, Number(row.commission_rate) || 0]));
}
export function rateFor(index: Map<string, number>, buildingId: string, service: ServiceType): number {
  return index.get(`${buildingId}:${service}`) ?? 0;
}

/** Demandes facturables du mois : terminées, date d'effet dans le mois. */
export function completedOfMonth<T extends RequestRow>(requests: T[], month: MonthKey): T[] {
  return requests.filter(row => row.status === 'termine' && monthKey(requestDate(row)) === month);
}

/* ---------- Rapport ---------- */

export interface ServiceLine {
  service: ServiceType;
  label: string;
  count: number;
  revenueCents: number;
  rate: number;
  commissionCents: number;
}
export interface BuildingLine {
  id: string;
  name: string;
  revenueCents: number;
  commissionCents: number;
  openRequests: number;
  completedRequests: number;
}
export interface TrendPoint {
  month: MonthKey;
  revenueCents: number;
  commissionCents: number;
}
export interface FinanceReport {
  month: MonthKey;
  /** Revenus des services terminés sur le mois. */
  revenueCents: number;
  /** Commission Maison Cavalier au taux courant du catalogue. */
  commissionCents: number;
  /** Commissions d'affiliation encaissées sur les recommandations réservées. */
  affiliationCents: number;
  /** Reversements partenaires : revenus − commission Maison Cavalier. */
  payoutCents: number;
  completedRequests: number;
  acceptedQuotes: { count: number; amountCents: number };
  services: ServiceLine[];
  buildings: BuildingLine[];
  trend: TrendPoint[];
}

export interface FinanceInput {
  month: MonthKey;
  requests: RequestRow[];
  services: ServiceRateRow[];
  quotes?: QuoteRow[];
  shares?: ShareRow[];
  buildings?: BuildingRow[];
  /**
   * Demandes ouvertes à ce jour, lues à part : elles peuvent avoir été
   * créées avant la fenêtre chargée pour la tendance. À défaut, elles sont
   * déduites de `requests`.
   */
  openRequests?: { building_id: string }[];
  /** Nombre de mois du graphique de tendance, mois courant inclus. */
  trendLength?: number;
}

export function buildFinanceReport(input: FinanceInput): FinanceReport {
  const { month, requests, services } = input;
  const quotes = input.quotes ?? [];
  const shares = input.shares ?? [];
  const buildings = input.buildings ?? [];
  const rates = rateIndex(services);
  const completed = completedOfMonth(requests, month);

  // Répartition par service : la commission est recalculée ligne à ligne
  // pour que le total de la colonne corresponde au KPI affiché en tête.
  const byService = new Map<ServiceType, ServiceLine>();
  for (const service of serviceOrder) {
    byService.set(service, {
      service, label: serviceLabels[service], count: 0, revenueCents: 0,
      rate: 0, commissionCents: 0,
    });
  }
  let revenueCents = 0;
  let commissionTotal = 0;
  for (const row of completed) {
    const amount = row.amount_cents ?? 0;
    const rate = rateFor(rates, row.building_id, row.service);
    const commission = commissionCents(amount, rate);
    revenueCents += amount;
    commissionTotal += commission;
    const line = byService.get(row.service) ?? {
      service: row.service, label: serviceLabels[row.service], count: 0,
      revenueCents: 0, rate: 0, commissionCents: 0,
    };
    line.count += 1;
    line.revenueCents += amount;
    line.commissionCents += commission;
    // Un service peut porter des taux différents selon l'immeuble : le taux
    // affiché est alors le taux moyen effectif de la ligne.
    line.rate = line.revenueCents > 0 ? (line.commissionCents / line.revenueCents) * 100 : rate;
    byService.set(row.service, line);
  }

  const affiliationCents = shares
    .filter(row => row.status === 'reservee' && monthKey(shareDate(row)) === month)
    .reduce((sum, row) => sum + (row.commission_cents ?? 0), 0);

  const accepted = quotes.filter(row => row.status === 'accepte' && monthKey(quoteDate(row)) === month);

  const openByBuilding = new Map<string, number>();
  const openRows = input.openRequests ?? requests.filter(row => row.status !== 'termine');
  for (const row of openRows) {
    openByBuilding.set(row.building_id, (openByBuilding.get(row.building_id) ?? 0) + 1);
  }
  const buildingLines: BuildingLine[] = buildings.map(building => {
    const rows = completed.filter(row => row.building_id === building.id);
    const buildingRevenue = rows.reduce((sum, row) => sum + (row.amount_cents ?? 0), 0);
    const buildingCommission = rows.reduce(
      (sum, row) => sum + commissionCents(row.amount_cents ?? 0, rateFor(rates, row.building_id, row.service)), 0,
    );
    return {
      id: building.id, name: building.name,
      revenueCents: buildingRevenue, commissionCents: buildingCommission,
      openRequests: openByBuilding.get(building.id) ?? 0,
      completedRequests: rows.length,
    };
  }).sort((a, b) => b.revenueCents - a.revenueCents || a.name.localeCompare(b.name, 'fr'));

  const trend = lastMonths(month, input.trendLength ?? 6).map(key => {
    const rows = completedOfMonth(requests, key);
    return {
      month: key,
      revenueCents: rows.reduce((sum, row) => sum + (row.amount_cents ?? 0), 0),
      commissionCents: rows.reduce(
        (sum, row) => sum + commissionCents(row.amount_cents ?? 0, rateFor(rates, row.building_id, row.service)), 0,
      ),
    };
  });

  return {
    month,
    revenueCents,
    commissionCents: commissionTotal,
    affiliationCents,
    payoutCents: revenueCents - commissionTotal,
    completedRequests: completed.length,
    acceptedQuotes: {
      count: accepted.length,
      amountCents: accepted.reduce((sum, row) => sum + (row.amount_cents ?? 0), 0),
    },
    services: serviceOrder.map(service => byService.get(service)!).filter(line => line.count > 0),
    buildings: buildingLines,
    trend,
  };
}

/* ---------- Export CSV ---------- */

export interface ExportLine {
  buildingName: string;
  date: string;
  service: ServiceType;
  serviceLabel: string;
  amountCents: number;
  rate: number;
  commissionCents: number;
}

/** Une ligne par demande terminée du mois, la plus ancienne d'abord. */
export function financeExportLines(input: {
  month: MonthKey;
  requests: RequestRow[];
  services: ServiceRateRow[];
  buildings?: BuildingRow[];
}): ExportLine[] {
  const rates = rateIndex(input.services);
  const names = new Map((input.buildings ?? []).map(building => [building.id, building.name]));
  return completedOfMonth(input.requests, input.month)
    .map(row => {
      const amountCents = row.amount_cents ?? 0;
      const rate = rateFor(rates, row.building_id, row.service);
      return {
        buildingName: names.get(row.building_id) ?? row.building_id,
        date: requestDate(row),
        service: row.service,
        serviceLabel: serviceLabels[row.service],
        amountCents,
        rate,
        commissionCents: commissionCents(amountCents, rate),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.buildingName.localeCompare(b.buildingName, 'fr'));
}

/** Nombre décimal à la française : 1234.5 -> « 1234,50 ». */
function decimal(value: number, digits = 2): string {
  return value.toFixed(digits).replace('.', ',');
}

/** Échappement CSV : guillemets doublés, champ encadré si nécessaire. */
function cell(value: string): string {
  return /[";\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

const csvDateFormat = new Intl.DateTimeFormat('fr-FR', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit',
});

/**
 * CSV lisible par Excel FR : BOM UTF-8, séparateur `;`, fins de ligne CRLF
 * et nombres à virgule. Aucune donnée nominative de résident n'y figure.
 */
export function financeCsv(lines: ExportLine[]): string {
  const header = ['Immeuble', 'Date', 'Service', 'Montant (EUR)', 'Taux de commission (%)', 'Commission (EUR)'];
  const body = lines.map(line => [
    cell(line.buildingName),
    cell(csvDateFormat.format(new Date(line.date)).replace(', ', ' ')),
    cell(line.serviceLabel),
    decimal(line.amountCents / 100),
    decimal(line.rate),
    decimal(line.commissionCents / 100),
  ].join(';'));
  const total = lines.reduce(
    (sum, line) => ({ amount: sum.amount + line.amountCents, commission: sum.commission + line.commissionCents }),
    { amount: 0, commission: 0 },
  );
  const footer = ['Total', '', '', decimal(total.amount / 100), '', decimal(total.commission / 100)].join(';');
  return `﻿${[header.join(';'), ...body, footer].join('\r\n')}\r\n`;
}
