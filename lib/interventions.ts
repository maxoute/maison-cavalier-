import type { ServiceRequest, ServiceType } from '@/types';

export const incidentLabels = { retard: 'Retard', article_manquant: 'Article manquant', plainte: 'Plainte', technique: 'Incident technique', autre: 'Autre' };
export type IncidentKind = keyof typeof incidentLabels;
export interface InterventionIncident {
  id: string; building_id: string; request_id: string; reported_by: string;
  kind: IncidentKind; severity: 'standard' | 'grave'; description: string;
  resolution: string | null; resolved_by: string | null; resolved_at: string | null; created_at: string;
}

export function interventionMetrics(requests: ServiceRequest[], incidents: InterventionIncident[], now: number) {
  const date = new Date(now);
  const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const completed = requests.filter(request => request.status === 'termine' && request.completed_at
    && Date.parse(request.completed_at) >= dayStart && Date.parse(request.completed_at) < dayStart + 86_400_000);
  const incidentRequests = new Set(incidents.map(incident => incident.request_id));
  const durations: Partial<Record<ServiceType, { totalMs: number; count: number }>> = {};
  for (const request of completed) {
    if (!request.started_at) continue;
    const duration = Date.parse(request.completed_at!) - Date.parse(request.started_at);
    if (!Number.isFinite(duration) || duration < 0) continue;
    const group = durations[request.service] ?? { totalMs: 0, count: 0 };
    group.totalMs += duration; group.count += 1; durations[request.service] = group;
  }
  return {
    active: requests.filter(request => request.status !== 'termine').length,
    closedToday: completed.length,
    openIncidents: incidents.filter(incident => !incident.resolved_at).length,
    firstPassPercent: completed.length ? Math.round(100 * completed.filter(request => !incidentRequests.has(request.id)).length / completed.length) : null,
    durations,
  };
}
