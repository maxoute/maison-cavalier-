import Link from 'next/link';
import { requestsForStaff } from '@/lib/operations/requests';
import { checkRead } from '@/lib/operations/server';
import { incidentLabels, interventionMetrics, type InterventionIncident } from '@/lib/interventions';
import { requestLabels, serviceLabels, requestSla } from '@/lib/requests';
import { formatDateTime, formatDuration, formatRelative, toLocalInputValue, count } from '@/lib/format';
import { OperationForm } from '@/components/features/operation-form';
import { Field } from '@/components/features/operation-fields';
import { RequestStatusActions } from '@/components/features/request-status-actions';
import { Badge, ServiceBadge, serviceColors } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Disclosure } from '@/components/ui/disclosure';
import { IconAlert, IconClock, IconTool } from '@/components/ui/icons';
import { Select, Textarea } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard, StatGrid } from '@/components/ui/stat';
import { assignIntervention, reportInterventionIncident, resolveInterventionIncident } from '@/app/actions/interventions';
import { cn } from '@/lib/cn';
import type { RequestStatus, ServiceType } from '@/types';

const columnTone: Record<RequestStatus, string> = {
  nouveau: 'var(--blue)', en_cours: 'var(--orange)', en_attente: 'var(--muted)', termine: 'var(--green)',
};

export default async function InterventionsPage({ searchParams }: { searchParams: Promise<{ service?: string; status?: string }> }) {
  const filters = await searchParams;
  const { db, session, now, requests } = await requestsForStaff();
  const incidents: InterventionIncident[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from('intervention_incidents').select('*').eq('building_id', session.buildingId).order('created_at', { ascending: false }).order('id').range(offset, offset + 499);
    checkRead(error); incidents.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }
  const metrics = interventionMetrics(requests, incidents, now);
  const filtered = requests.filter(request => (!filters.service || request.service === filters.service) && (!filters.status || request.status === filters.status));
  const durations = Object.entries(metrics.durations) as [ServiceType, { totalMs: number; count: number }][];
  return <div className="space-y-6 fade-up">
    <PageHeader title="Interventions" subtitle="Toutes les missions en cours, tous services confondus : prestataire assigné, heure prévue, validation à la clôture et signalement d’incident." />
    <StatGrid>
      <StatCard value={metrics.active} label="missions actives" accent="blue" icon={IconTool} />
      <StatCard value={metrics.closedToday} label="clôturées aujourd’hui" accent="green" />
      <StatCard value={metrics.openIncidents} label="incidents ouverts" accent={metrics.openIncidents ? 'red' : 'grey'} />
      <StatCard value={metrics.firstPassPercent === null ? '—' : `${metrics.firstPassPercent} %`} label="validées du premier coup" accent="gold" hint={durations.length ? durations.map(([service, group]) => `${serviceLabels[service]} : ${formatDuration(group.totalMs / group.count / 60_000)} en moyenne`).join(' · ') : 'temps moyen par service dès la première clôture'} />
    </StatGrid>
    <form className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto] rounded-[8px] border border-line bg-surface p-3">
      <Select name="service" defaultValue={filters.service ?? ''} aria-label="Service" className="text-[12.5px] py-2"><option value="">Tous les services</option>{Object.entries(serviceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
      <Select name="status" defaultValue={filters.status ?? ''} aria-label="Statut" className="text-[12.5px] py-2"><option value="">Tous les statuts</option>{Object.entries(requestLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
      <div className="flex items-center gap-2"><Button type="submit" variant="outline" size="sm">Filtrer</Button>{(filters.service || filters.status) && <Link href="/concierge/interventions" className="text-[11px] text-muted hover:text-ink underline underline-offset-4">Réinitialiser</Link>}</div>
    </form>
    <div className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-4">
      {(Object.entries(requestLabels) as [RequestStatus, string][]).filter(([status]) => !filters.status || status === filters.status).map(([status, label]) => {
        const cards = filtered.filter(request => request.status === status);
        return <section key={status} className="min-w-0 space-y-2.5 rounded-[8px] bg-ink/[0.025] p-2.5">
          <h2 className="flex items-center gap-2 px-1 text-[13px] font-sans font-medium text-ink"><span className="w-2 h-2 rounded-full" style={{ background: columnTone[status] }} />{label}<span className="ml-auto text-[11px] font-normal text-muted">{cards.length}</span></h2>
          {!cards.length && <p className="text-[11.5px] text-muted text-center py-6">Aucune intervention</p>}
          {cards.map(request => {
            const history = incidents.filter(incident => incident.request_id === request.id);
            const openIncident = history.some(incident => !incident.resolved_at);
            const sla = requestSla(request.sla_deadline, request.status, now);
            const overdue = status !== 'termine' && request.estimated_completion_at && Date.parse(request.estimated_completion_at) < now;
            return <article key={request.id} id={`intervention-${request.id}`} className={cn('rounded-[8px] border bg-surface p-3.5 space-y-2.5 shadow-[0_1px_2px_rgba(10,22,40,.04)]', openIncident ? 'border-red/40' : overdue ? 'border-orange/40' : 'border-line')} style={{ borderLeftWidth: 3, borderLeftColor: serviceColors[request.service] }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <ServiceBadge service={request.service} />
                <div className="flex items-center gap-1.5">
                  {request.priority === 'urgente' && status !== 'termine' && <Badge tone="red">Urgente</Badge>}
                  {openIncident && <Badge tone="red">Incident</Badge>}
                </div>
              </div>
              <h3 className="text-[15px] leading-snug">{request.residents ? <Link href={`/concierge/residents/${request.residents.id}`} className="hover:text-gold-deep transition-colors duration-300">{request.residents.full_name}</Link> : 'Résident'}</h3>
              {typeof request.payload.description === 'string' && <p className="text-[12px] text-ink/80 leading-relaxed break-words">{request.payload.description}</p>}
              <p className="text-[12px]"><span className="text-muted">Prestataire :</span> {request.assigned_provider ?? <span className="text-orange">à attribuer</span>}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
                {request.started_at && <span>Début {formatDateTime(request.started_at)}</span>}
                {request.estimated_completion_at && <span className={cn('inline-flex items-center gap-1', overdue ? 'text-red font-medium' : '')}><IconClock size={11} />Fin prévue {formatDateTime(request.estimated_completion_at)}{overdue ? ` (${formatRelative(request.estimated_completion_at, now)})` : ''}</span>}
                {sla && <span className={cn('inline-flex items-center gap-1', sla.late ? 'text-red font-medium' : '')}>{sla.late && <IconAlert size={11} />}{sla.label}</span>}
                {request.completed_at && <span className="text-green">Validée {formatDateTime(request.completed_at)}</span>}
              </div>
              {status !== 'termine' && <>
                <RequestStatusActions id={request.id} status={request.status} compact />
                <div className="flex flex-wrap gap-4">
                  <Disclosure variant="inline" summary="Prestataire et heure prévue">
                    <OperationForm action={assignIntervention} submit="Enregistrer">
                      <input type="hidden" name="id" value={request.id} /><input type="hidden" name="updated_at" value={request.updated_at} />
                      <Field name="assigned_provider" label="Prestataire assigné" required maxLength={200} defaultValue={request.assigned_provider ?? ''} placeholder="VTC Étoile, Pressing Montaigne…" />
                      <Field name="estimated_completion_at" label="Fin prévue (heure de Paris)" type="datetime-local" defaultValue={toLocalInputValue(request.estimated_completion_at)} />
                      <Field name="amount" label="Montant facturé (€)" inputMode="decimal" defaultValue={request.amount_cents != null ? (request.amount_cents / 100).toFixed(2).replace('.', ',') : ''} placeholder="45,00" />
                    </OperationForm>
                  </Disclosure>
                  <Disclosure variant="inline" summary="Signaler un incident">
                    <OperationForm action={reportInterventionIncident} submit="Enregistrer l’incident">
                      <input type="hidden" name="request_id" value={request.id} />
                      <label className="block space-y-1 text-[12.5px] text-ink"><span>Type</span><Select name="kind">{Object.entries(incidentLabels).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</Select></label>
                      <label className="block space-y-1 text-[12.5px] text-ink"><span>Notes privées pour la conciergerie</span><Textarea name="description" required maxLength={4000} rows={3} /></label>
                      <label className="flex items-start gap-2 text-[12px]"><input type="checkbox" name="grave" className="mt-1 accent-[#b9452f]" /><span>Incident grave : le syndic reçoit une alerte générique, sans information résident.</span></label>
                    </OperationForm>
                  </Disclosure>
                </div>
              </>}
              {history.length > 0 && <Disclosure variant="inline" open={openIncident} summary={count(history.length, 'incident')}>
                <ul className="space-y-3">{history.map(incident => <li key={incident.id} className="space-y-1.5 text-[12px]">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-ink">{incidentLabels[incident.kind]}</span>
                    <Badge tone={incident.severity === 'grave' ? 'red' : 'orange'}>{incident.severity === 'grave' ? 'Grave · syndic alerté' : 'Standard'}</Badge>
                    <Badge tone={incident.resolved_at ? 'green' : 'grey'}>{incident.resolved_at ? 'Résolu' : 'Ouvert'}</Badge>
                    <span className="text-[11px] text-muted">{formatDateTime(incident.created_at)}</span>
                  </p>
                  <p className="whitespace-pre-wrap break-words text-ink/80">{incident.description}</p>
                  {incident.resolved_at ? <p className="whitespace-pre-wrap break-words text-green">Résolution : {incident.resolution} · {formatDateTime(incident.resolved_at)}</p> : <OperationForm action={resolveInterventionIncident} submit="Résoudre l’incident">
                    <input type="hidden" name="id" value={incident.id} /><Field name="resolution" label="Solution apportée" required maxLength={4000} />
                  </OperationForm>}
                </li>)}</ul>
              </Disclosure>}
            </article>;
          })}
        </section>;
      })}
    </div>
  </div>;
}
