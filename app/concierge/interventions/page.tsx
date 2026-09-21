import { requestsForStaff } from '@/lib/operations/requests';
import { check } from '@/lib/operations/server';
import { incidentLabels, interventionMetrics, type InterventionIncident } from '@/lib/interventions';
import { requestLabels, serviceLabels } from '@/lib/requests';
import { OperationForm } from '@/components/features/operation-form';
import { Field } from '@/components/features/operation-fields';
import { RequestStatusActions } from '@/components/features/request-status-actions';
import { Select, Textarea } from '@/components/ui/input';
import { assignIntervention, reportInterventionIncident, resolveInterventionIncident } from '@/app/actions/interventions';
import type { RequestStatus, ServiceType } from '@/types';

const dateLabel = (value: string) => new Date(value).toLocaleString('fr-FR', { timeZone: 'UTC' }) + ' UTC';

export default async function InterventionsPage({ searchParams }: { searchParams: Promise<{ service?: string; status?: string }> }) {
  const filters = await searchParams;
  const { db, session, now, requests } = await requestsForStaff();
  const incidents: InterventionIncident[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from('intervention_incidents').select('*').eq('building_id', session.buildingId).order('created_at', { ascending: false }).order('id').range(offset, offset + 499);
    check(error); incidents.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }
  const metrics = interventionMetrics(requests, incidents, now);
  const filtered = requests.filter(request => (!filters.service || request.service === filters.service) && (!filters.status || request.status === filters.status));
  return <div className="space-y-6 text-base">
    <header><h1 className="text-3xl">Interventions</h1><p className="mt-2 text-grey">Suivez les prestataires et validez la réalisation de chaque mission.</p></header>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[['Actives', metrics.active], ['Clôturées aujourd’hui (UTC)', metrics.closedToday], ['Incidents ouverts', metrics.openIncidents], ['Clôtures sans incident aujourd’hui', metrics.firstPassPercent === null ? '—' : `${metrics.firstPassPercent} %`]].map(([label, value]) => <div key={label} className="rounded-lg border border-navy-3 bg-navy-2 p-4"><p className="text-2xl">{value}</p><p className="text-grey">{label}</p></div>)}
    </div>
    <details className="rounded-lg border border-navy-3 p-4"><summary className="cursor-pointer">Durée moyenne des missions clôturées aujourd’hui</summary>
      <p className="mt-2 text-grey">Du premier démarrage à la clôture, attentes incluses. Les anciennes missions sans horaires connus sont exclues.</p>
      <ul className="mt-2 space-y-1">{(Object.entries(metrics.durations) as [ServiceType, { totalMs: number; count: number }][]).map(([service, group]) => <li key={service}>{serviceLabels[service]} : {Math.round(group.totalMs / group.count / 60_000)} min · {group.count} mission(s)</li>)}</ul>
      {!Object.keys(metrics.durations).length && <p>Aucune durée disponible.</p>}
    </details>
    <form className="flex flex-wrap items-end gap-3">
      <label className="space-y-1"><span>Service</span><Select name="service" defaultValue={filters.service ?? ''}><option value="">Tous les services</option>{Object.entries(serviceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label>
      <label className="space-y-1"><span>Statut</span><Select name="status" defaultValue={filters.status ?? ''}><option value="">Tous les statuts</option>{Object.entries(requestLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label>
      <button className="rounded-3xl border border-navy-3 px-5 py-3" type="submit">Filtrer</button>
    </form>
    <div className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-4">
      {(Object.entries(requestLabels) as [RequestStatus, string][]).filter(([status]) => !filters.status || status === filters.status).map(([status, label]) => {
        const cards = filtered.filter(request => request.status === status);
        return <section key={status} className="min-w-0 space-y-3"><h2 className="text-2xl">{label} · {cards.length}</h2>
          {!cards.length && <p className="text-grey">Aucune intervention.</p>}
          {cards.map(request => {
            const history = incidents.filter(incident => incident.request_id === request.id);
            return <article key={request.id} id={`intervention-${request.id}`} className="rounded-lg border border-navy-3 bg-navy-2 p-4 space-y-3">
              <h3 className="text-xl">{request.residents?.full_name ?? 'Résident'}</h3>
              <p>{serviceLabels[request.service]} · {request.assigned_provider ?? 'Prestataire à attribuer'}</p>
              {request.started_at && <p className="text-grey">Début : {dateLabel(request.started_at)}</p>}
              {request.estimated_completion_at && <p className={status !== 'termine' && Date.parse(request.estimated_completion_at) < now ? 'text-red' : 'text-grey'}>Fin prévue : {dateLabel(request.estimated_completion_at)}</p>}
              {request.completed_at && <p className="text-grey">Réalisation validée : {dateLabel(request.completed_at)}</p>}
              {status !== 'termine' && <>
                <details><summary className="cursor-pointer underline underline-offset-4">Prestataire et heure prévue</summary><div className="mt-3"><OperationForm action={assignIntervention}>
                  <input type="hidden" name="id" value={request.id} /><input type="hidden" name="updated_at" value={request.updated_at} />
                  <Field name="assigned_provider" label="Prestataire assigné" required maxLength={200} defaultValue={request.assigned_provider ?? ''} />
                  <Field name="estimated_completion_at" label="Fin prévue (UTC)" type="datetime-local" defaultValue={request.estimated_completion_at ? new Date(request.estimated_completion_at).toISOString().slice(0, 16) : ''} />
                </OperationForm></div></details>
                <RequestStatusActions id={request.id} status={request.status} />
                <details><summary className="cursor-pointer underline underline-offset-4">Signaler un incident</summary><div className="mt-3"><OperationForm action={reportInterventionIncident} submit="Enregistrer l’incident">
                  <input type="hidden" name="request_id" value={request.id} />
                  <label className="block space-y-1"><span>Type</span><Select name="kind">{Object.entries(incidentLabels).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</Select></label>
                  <label className="block space-y-1"><span>Notes privées pour la conciergerie</span><Textarea name="description" required maxLength={4000} rows={3} /></label>
                  <label className="flex items-start gap-2"><input type="checkbox" name="grave" className="mt-1" /><span>Incident grave : alerter le syndic avec un message générique sans informations résident. Notifications externes simulées.</span></label>
                </OperationForm></div></details>
              </>}
              {history.length > 0 && <details open={history.some(incident => !incident.resolved_at)}><summary className="cursor-pointer">{history.length} incident(s)</summary>
                <ul className="mt-3 space-y-4">{history.map(incident => <li key={incident.id} className="border-t border-navy-3 pt-3 space-y-2">
                  <p>{incidentLabels[incident.kind]} · {incident.severity === 'grave' ? 'Grave · syndic alerté' : 'Standard'} · {incident.resolved_at ? 'Résolu' : 'Ouvert'}</p>
                  <p className="whitespace-pre-wrap break-words">{incident.description}</p>
                  <p className="text-grey">Signalé le {dateLabel(incident.created_at)}</p>
                  {incident.resolved_at ? <p className="whitespace-pre-wrap break-words">Résolution : {incident.resolution}<br />{dateLabel(incident.resolved_at)}</p> : <OperationForm action={resolveInterventionIncident} submit="Résoudre l’incident">
                    <input type="hidden" name="id" value={incident.id} /><Field name="resolution" label="Solution apportée" required maxLength={4000} />
                  </OperationForm>}
                </li>)}</ul>
              </details>}
            </article>;
          })}
        </section>;
      })}
    </div>
  </div>;
}
