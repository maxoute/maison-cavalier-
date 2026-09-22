import type { RequestStatus, ServiceType } from '@/types';
import { formatDuration } from './format.ts';

export const serviceLabels: Record<ServiceType, string> = {
  chauffeur: 'Chauffeur', pressing: 'Pressing', colis: 'Colis',
  billetterie: 'Billetterie', personal_shopper: 'Personal shopper',
};
export const requestLabels: Record<RequestStatus, string> = {
  nouveau: 'Nouveau', en_cours: 'En cours', en_attente: 'En attente', termine: 'Terminé',
};
export const requestTransitions: Record<RequestStatus, RequestStatus[]> = {
  nouveau: ['en_cours', 'en_attente'], en_cours: ['en_attente', 'termine'],
  en_attente: ['en_cours'], termine: [],
};
export function isRequestStatus(value: string): value is RequestStatus {
  return Object.prototype.hasOwnProperty.call(requestLabels, value);
}
export function isServiceType(value: string): value is ServiceType {
  return Object.prototype.hasOwnProperty.call(serviceLabels, value);
}
/**
 * État SLA d'une demande : `late` dès la première seconde de dépassement,
 * libellé humanisé (« SLA dépassé de 1 h 05 », « SLA : 42 min restantes »).
 */
export function requestSla(deadline: string | null, status: RequestStatus, now: number) {
  if (!deadline || status === 'termine') return null;
  const remaining = Date.parse(deadline) - now;
  if (!Number.isFinite(remaining)) return null;
  const minutes = Math.ceil(Math.abs(remaining) / 60_000);
  const duration = formatDuration(minutes);
  return {
    late: remaining < 0,
    minutes: remaining < 0 ? -minutes : minutes,
    label: remaining < 0 ? `SLA dépassé de ${duration}` : `SLA : ${duration} restantes`,
  };
}
