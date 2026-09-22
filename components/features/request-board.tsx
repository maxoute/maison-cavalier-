'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { requestLabels, requestSla, serviceLabels } from '@/lib/requests';
import { formatDateTime, formatMoney } from '@/lib/format';
import { RequestStatusActions } from './request-status-actions';
import { Badge, ServiceBadge, serviceColors } from '@/components/ui/badge';
import { IconAlert, IconClock } from '@/components/ui/icons';
import { Input, Select } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import type { RequestStatus, ServiceRequest } from '@/types';

export type BoardRequest = ServiceRequest & { residents: { id: string; full_name: string } | null };

const columnTone: Record<RequestStatus, string> = {
  nouveau: 'var(--blue)', en_cours: 'var(--orange)', en_attente: 'var(--muted)', termine: 'var(--green)',
};

function RequestCard({ request, now }: { request: BoardRequest; now: number }) {
  const sla = requestSla(request.sla_deadline, request.status, now);
  const description = request.payload.description ?? Object.values(request.payload)[0];
  const urgent = request.priority === 'urgente' && request.status !== 'termine';
  return <article
    className={cn(
      'relative rounded-[8px] border bg-surface p-3.5 space-y-2.5 shadow-[0_1px_2px_rgba(10,22,40,.04)] transition-shadow duration-300 hover:shadow-[0_8px_20px_-14px_rgba(10,22,40,.25)]',
      sla?.late ? 'border-red/40' : urgent ? 'border-orange/40' : 'border-line',
    )}
    style={{ borderLeftWidth: 3, borderLeftColor: serviceColors[request.service] }}
  >
    <div className="flex flex-wrap items-center justify-between gap-2">
      <ServiceBadge service={request.service} />
      <div className="flex items-center gap-1.5">
        {urgent && <Badge tone="red">Urgente</Badge>}
        {request.amount_cents != null && <span className="text-[11px] text-muted">{formatMoney(request.amount_cents, { round: true })}</span>}
      </div>
    </div>
    <h3 className="text-[15px] leading-snug">
      {request.residents
        ? <Link className="hover:text-gold-deep transition-colors duration-300" href={`/concierge/residents/${request.residents.id}`}>{request.residents.full_name}</Link>
        : 'Résident indisponible'}
    </h3>
    {typeof description === 'string' && <p className="text-[12px] text-ink/80 break-words whitespace-pre-wrap leading-relaxed">{description}</p>}
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
      <span>{formatDateTime(request.created_at)}</span>
      {sla && <span className={cn('inline-flex items-center gap-1', sla.late ? 'text-red font-medium' : '')}>
        {sla.late ? <IconAlert size={11} /> : <IconClock size={11} />}{sla.label}
      </span>}
      {request.assigned_provider && <span>· {request.assigned_provider}</span>}
    </div>
    {request.status === 'termine'
      ? <p className="text-[11px] text-green">Réalisation validée{request.completed_at ? ` le ${formatDateTime(request.completed_at)}` : ''}</p>
      : <RequestStatusActions id={request.id} status={request.status} compact />}
  </article>;
}

export function RequestBoard({ requests, buildingId, initialNow }: { requests: BoardRequest[]; buildingId: string; initialNow: number }) {
  const router = useRouter();
  const [now, setNow] = useState(initialNow);
  const [service, setService] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [resident, setResident] = useState('');
  const [connection, setConnection] = useState<'connecting' | 'live' | 'polling'>('connecting');

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
        setConnection(state === 'SUBSCRIBED' ? 'live' : 'polling');
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
  const urgent = active.filter(request => request.priority === 'urgente').length;
  const late = active.filter(request => requestSla(request.sla_deadline, request.status, now)?.late).length;
  const filtered = requests.filter(request => (!service || request.service === service)
    && (!status || request.status === status) && (!priority || request.priority === priority)
    && (!resident || (request.residents?.full_name ?? '').toLocaleLowerCase('fr-FR').includes(resident.toLocaleLowerCase('fr-FR'))));
  const filtering = Boolean(service || status || priority || resident);

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-ink"><span className="font-medium">{active.length}</span> à traiter</span>
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1', urgent ? 'border-red/30 bg-red/[0.06] text-red' : 'border-line bg-surface text-muted')}><span className="font-medium">{urgent}</span> urgente{urgent > 1 ? 's' : ''}</span>
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1', late ? 'border-red/30 bg-red/[0.06] text-red' : 'border-line bg-surface text-muted')}><span className="font-medium">{late}</span> en retard SLA</span>
      </div>
      <p role="status" className="inline-flex items-center gap-1.5 text-[11px] text-muted">
        <span className={cn('w-1.5 h-1.5 rounded-full', connection === 'live' ? 'bg-green animate-pulse' : connection === 'polling' ? 'bg-orange' : 'bg-muted')} />
        {connection === 'live' ? 'Temps réel connecté' : connection === 'polling' ? 'Actualisation chaque minute' : 'Connexion au temps réel…'}
      </p>
    </div>

    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4 rounded-[8px] border border-line bg-surface p-3">
      <Select aria-label="Service" value={service} onChange={event => setService(event.target.value)} className="text-[12.5px] py-2"><option value="">Tous les services</option>{Object.entries(serviceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
      <Input aria-label="Résident" type="search" value={resident} onChange={event => setResident(event.target.value)} placeholder="Rechercher un résident" className="text-[12.5px] py-2" />
      <Select aria-label="Statut" value={status} onChange={event => setStatus(event.target.value)} className="text-[12.5px] py-2"><option value="">Tous les statuts</option>{Object.entries(requestLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
      <Select aria-label="Priorité" value={priority} onChange={event => setPriority(event.target.value)} className="text-[12.5px] py-2"><option value="">Toutes les priorités</option><option value="normale">Normale</option><option value="urgente">Urgente</option></Select>
    </div>
    {filtering && <p role="status" className="text-[11px] text-muted">{filtered.length} demande{filtered.length > 1 ? 's' : ''} affichée{filtered.length > 1 ? 's' : ''} · <button type="button" className="underline underline-offset-4 hover:text-ink cursor-pointer" onClick={() => { setService(''); setStatus(''); setPriority(''); setResident(''); }}>réinitialiser</button></p>}

    <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-4">
      {(Object.entries(requestLabels) as [RequestStatus, string][]).filter(([value]) => !status || value === status).map(([value, label]) => {
        const cards = filtered.filter(request => request.status === value);
        return <section key={value} aria-label={label} className="min-w-0 space-y-2.5 rounded-[8px] bg-ink/[0.025] p-2.5">
          <h2 className="flex items-center gap-2 px-1 text-[13px] font-sans font-medium text-ink">
            <span className="w-2 h-2 rounded-full" style={{ background: columnTone[value] }} />
            {label}
            <span className="ml-auto text-[11px] font-normal text-muted">{cards.length}</span>
          </h2>
          {cards.map(request => <RequestCard key={request.id} request={request} now={now} />)}
          {!cards.length && <p className="text-[11.5px] text-muted text-center py-6">Aucune demande</p>}
        </section>;
      })}
    </div>
  </div>;
}
