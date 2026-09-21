import type { PricingUnit, ServiceType } from '@/types';

export const pricingUnitLabels: Record<PricingUnit, string> = {
  fixe: 'Forfait', km: 'Au kilomètre', heure: 'À l’heure',
};
/** Suffixe affiché après le prix, vide pour un forfait. */
export const pricingUnitSuffix: Record<PricingUnit, string> = { fixe: '', km: ' / km', heure: ' / h' };

export function isPricingUnit(value: string): value is PricingUnit {
  return Object.prototype.hasOwnProperty.call(pricingUnitLabels, value);
}

export function formatEuros(cents: number) {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

export function formatTariff(cents: number, unit: PricingUnit) {
  return cents === 0 ? 'Offert' : `${formatEuros(cents)}${pricingUnitSuffix[unit]}`;
}

/** « 12,50 » ou « 12.50 » -> 1250 centimes. Lève si la saisie est inexploitable. */
export function parseEuros(input: string): number {
  const normalized = input.replace(/\s/g, '').replace(',', '.');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(normalized)) throw new Error('Tarif invalide : indiquez un montant en euros, par exemple 12,50.');
  return Math.round(Number(normalized) * 100);
}

/** Taux de commission en pourcentage, deux décimales, borné à 100 %. */
export function parseRate(input: string): number {
  const normalized = input.replace(/\s/g, '').replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(normalized)) throw new Error('Commission invalide : indiquez un pourcentage, par exemple 15 ou 12,5.');
  const rate = Number(normalized);
  if (rate > 100) throw new Error('La commission ne peut pas dépasser 100 %.');
  return rate;
}

/** Commission Maison Cavalier sur un montant facturé, arrondie au centime. */
export function commissionCents(amountCents: number, rate: number) {
  return Math.round((amountCents * rate) / 100);
}

/** Délai d'engagement lisible : 90 -> « 1 h 30 », 1440 -> « 24 h ». */
export function formatSla(minutes: number | null) {
  if (minutes === null) return 'Aucun engagement';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${String(rest).padStart(2, '0')}` : `${hours} h`;
}

/** Échéance SLA proposée à la création d'une demande, d'après le catalogue. */
export function slaDeadline(minutes: number | null, now: number) {
  return minutes === null ? null : new Date(now + minutes * 60_000).toISOString();
}

export const serviceOrder: ServiceType[] = ['chauffeur', 'pressing', 'colis', 'billetterie', 'personal_shopper'];
