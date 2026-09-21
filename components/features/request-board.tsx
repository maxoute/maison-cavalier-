'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { requestLabels, requestSla, serviceLabels } from '@/lib/requests';
import { RequestStatusActions } from './request-status-actions';
import { Input, Select } from '@/components/ui/input';
import type { RequestStatus, ServiceRequest } from '@/types';

export type BoardRequest = ServiceRequest & { residents: { id: string; full_name: string } | null };

function RequestCard({ request, now }: { request: BoardRequest; now: number }) {
  const sla = requestSla(request.sla_deadline, request.status, now);
  const description = request.payload.description ?? Object.values(request.payload)[0];
  return <article className="rounded-lg border border-navy-3 bg-navy-2 p-4 space-y-3">
    <div className="flex flex-wrap justify-between gap-2"><span>{serviceLabels[request.service]}</span>
      {request.priority === 'urgente' && request.status !== 'termine' && <span className="text-red">Urgente</span>}
    </div>
    <h3 className="text-xl">{request.residents ? <Link className="underline underline-offset-4" href={`/concierge/residents/${request.residents.id}`}>{request.residents.full_name}</Link> : 'Résident indisponible'}</h3>
    {typeof description === 'string' && <p className="break-words whitespace-pre-wrap">{description}</p>}
    {sla && <p className={sla.late ? 'text-red' : 'text-grey'}>{sla.label}</p>}
    {request.status === 'termine' && <p className="text-grey">Réalisation validée{request.completed_at ? ` le ${new Date(request.completed_at).toLocaleString('fr-FR', { timeZone: 'UTC' })} UTC` : ''}</p>}
    <RequestStatusActions id={request.id} status={request.status} />
  </article>;
}

export function RequestBoard({ requests, buildingId, initialNow }: { requests: BoardRequest[]; buildingId: string; initialNow: number }) {
  const router = useRouter();
  const [now, setNow] = useState(initialNow);
  const [service, setService] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [resident, setResident] = useState('');
  const [connection, setConnection] = useState('Connexion au suivi en direct…');

  useEffect(() => {
    const db = createClient();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const refresh = () => {
      if (refreshTimer || disposed) return;
      refreshTimer = setTimeout(() => { refreshTimer = undefined; router.refresh(); }, 150);
    };
    const channel = db.channel(`requests:${buildingId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'service_requests', filter: `building_id=eq.${buildingId}` }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'service_requests', filter: `building_id=eq.${buildingId}` }, refresh)
      .subscribe(state => {
        if (disposed) return;
        setConnection(state === 'SUBSCRIBED' ? 'Suivi en direct connecté' : 'Suivi en direct indisponible · actualisation chaque minute');
        if (state === 'SUBSCRIBED') refresh();
      });
    // Rattrape les changements manqués, suppressions et retours d'arrière-plan.
    const polling = setInterval(refresh, 60_000);
    const clock = setInterval(() => setNow(Date.now()), 15_000);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', refresh);
    return () => {
      disposed = true;
      clearTimeout(refreshTimer); clearInterval(polling); clearInterval(clock);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', refresh);
      void db.removeChannel(channel);
    };
  }, [buildingId, router]);

  const active = requests.filter(request => request.status !== 'termine');
  const filtered = requests.filter(request => (!service || request.service === service)
    && (!status || request.status === status) && (!priority || request.priority === priority)
    && (!resident || (request.residents?.full_name ?? '').toLocaleLowerCase('fr-FR').includes(resident.toLocaleLowerCase('fr-FR'))));

  return <div className="space-y-5 text-base">
    <div className="flex flex-wrap justify-between gap-3">
      <p>{active.length} à traiter · {active.filter(request => request.priority === 'urgente').length} urgentes · {active.filter(request => requestSla(request.sla_deadline, request.status, now)?.late).length} en retard SLA</p>
      <p role="status" className="text-grey">{connection}</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <label className="space-y-1"><span>Service</span><Select value={service} onChange={event => setService(event.target.value)}><option value="">Tous les services</option>{Object.entries(serviceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label>
      <label className="space-y-1"><span>Résident</span><Input type="search" value={resident} onChange={event => setResident(event.target.value)} placeholder="Rechercher un nom" /></label>
      <label className="space-y-1"><span>Statut</span><Select value={status} onChange={event => setStatus(event.target.value)}><option value="">Tous les statuts</option>{Object.entries(requestLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label>
      <label className="space-y-1"><span>Priorité</span><Select value={priority} onChange={event => setPriority(event.target.value)}><option value="">Toutes les priorités</option><option value="normale">Normale</option><option value="urgente">Urgente</option></Select></label>
    </div>
    <p role="status" className="text-grey">{filtered.length} demande(s) affichée(s)</p>
    <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-4">
      {(Object.entries(requestLabels) as [RequestStatus, string][]).filter(([value]) => !status || value === status).map(([value, label]) => {
        const cards = filtered.filter(request => request.status === value);
        return <section key={value} aria-label={label} className="min-w-0 space-y-3">
          <h2 className="text-xl">{label} · {cards.length}</h2>
          {cards.map(request => <RequestCard key={request.id} request={request} now={now} />)}
          {!cards.length && <p className="text-grey">Aucune demande</p>}
        </section>;
      })}
    </div>
  </div>;
}
