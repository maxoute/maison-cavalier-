import Link from 'next/link';
import { QuoteActions } from '@/components/features/quote-actions';
import { QuoteForm } from '@/components/features/quote-form';
import { Badge, ServiceBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Disclosure } from '@/components/ui/disclosure';
import { IconDoc } from '@/components/ui/icons';
import { Select, Input } from '@/components/ui/input';
import { EmptyState, PageHeader } from '@/components/ui/page-header';
import { StatCard, StatGrid } from '@/components/ui/stat';
import { requestsForStaff } from '@/lib/operations/requests';
import { checkRead } from '@/lib/operations/server';
import { quoteLabels, quoteMetrics } from '@/lib/quotes';
import { serviceLabels } from '@/lib/requests';
import { formatDateTime, formatDuration, formatMoney, formatShortDate, count } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Quote, ServiceType } from '@/types';

type QuoteRow = Quote & { residents: { id: string; full_name: string } | null; service_requests: { service: ServiceType } | null };

const statusTone: Record<string, 'grey' | 'blue' | 'green' | 'red'> = { en_attente: 'grey', envoye: 'blue', accepte: 'green', refuse: 'red' };

export default async function DevisPage({ searchParams }: { searchParams: Promise<{ resident?: string; service?: string; status?: string }> }) {
  const filters = await searchParams;
  const { db, session, requests } = await requestsForStaff();
  const quotes: QuoteRow[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from('quotes').select('*, residents!quotes_resident_tenant(id, full_name), service_requests!quotes_request_tenant(service)')
      .eq('building_id', session.buildingId).order('created_at', { ascending: false }).order('id').range(offset, offset + 499);
    checkRead(error); quotes.push(...((data ?? []) as unknown as QuoteRow[]));
    if (!data || data.length < 500) break;
  }
  const requestOptions = requests.filter(request => request.status !== 'termine').map(request => ({ id: request.id, label: `${request.residents?.full_name ?? 'Résident'} · ${serviceLabels[request.service]} · ${formatShortDate(request.created_at)}${typeof request.payload.description === 'string' ? ` · ${request.payload.description.slice(0, 40)}` : ''}` }));
  const metrics = quoteMetrics(quotes);
  const shown = quotes.filter(quote => (!filters.status || quote.status === filters.status)
    && (!filters.service || (quote.document_snapshot?.service ?? quote.service_requests?.service) === filters.service)
    && (!filters.resident || (quote.document_snapshot?.resident_name ?? quote.residents?.full_name ?? '').toLocaleLowerCase('fr-FR').includes(filters.resident.toLocaleLowerCase('fr-FR'))));
  const filtering = Boolean(filters.status || filters.service || filters.resident);
  return <div className="space-y-6 fade-up">
    <PageHeader title="Devis" subtitle="Propositions aux résidents avec PDF au format Maison Cavalier, validation en un clic et historique par résident." />
    <StatGrid>
      <StatCard value={formatMoney(metrics.pendingCents, { round: true })} label="montant en cours" accent="gold" icon={IconDoc} />
      <StatCard value={metrics.pendingCount} label="devis actifs" accent="blue" />
      <StatCard value={metrics.acceptancePercent === null ? '—' : `${metrics.acceptancePercent} %`} label="taux d’acceptation" accent="green" hint="sur les devis décidés" />
      <StatCard value={metrics.averageAcceptanceHours === null ? '—' : formatDuration(metrics.averageAcceptanceHours * 60)} label="délai moyen d’acceptation" accent="violet" />
    </StatGrid>
    <Disclosure summary="Créer un devis depuis une demande" hint="PDF généré automatiquement">
      <div className="max-w-2xl"><QuoteForm requests={requestOptions} /></div>
    </Disclosure>
    <form className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto] rounded-[8px] border border-line bg-surface p-3">
      <Input name="resident" type="search" placeholder="Rechercher un résident" defaultValue={filters.resident ?? ''} aria-label="Résident" className="text-[12.5px] py-2" />
      <Select name="service" defaultValue={filters.service ?? ''} aria-label="Service" className="text-[12.5px] py-2"><option value="">Tous les services</option>{Object.entries(serviceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
      <Select name="status" defaultValue={filters.status ?? ''} aria-label="Statut" className="text-[12.5px] py-2"><option value="">Actifs et archives</option>{Object.entries(quoteLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
      <div className="flex items-center gap-2"><Button type="submit" variant="outline" size="sm">Filtrer</Button>{filtering && <Link href="/concierge/devis" className="text-[11px] text-muted hover:text-ink underline underline-offset-4">Réinitialiser</Link>}</div>
    </form>
    <p className="text-[11px] text-muted">{count(shown.length, 'devis', 'devis')} affiché{shown.length > 1 ? 's' : ''} · les décisions sont enregistrées par la conciergerie après échange avec le résident.</p>
    {!shown.length && <EmptyState title="Aucun devis ne correspond aux filtres." />}
    <div className="grid gap-3 lg:grid-cols-2">{shown.map(quote => {
      const service = quote.document_snapshot?.service ?? quote.service_requests?.service ?? null;
      const residentName = quote.document_snapshot?.resident_name ?? quote.residents?.full_name;
      const decided = quote.status === 'accepte' || quote.status === 'refuse';
      return <article key={quote.id} className={cn('min-w-0 rounded-[8px] border bg-surface p-4 space-y-3 shadow-[0_1px_2px_rgba(10,22,40,.04)]', decided ? 'border-line opacity-90' : 'border-line')}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              {service && <ServiceBadge service={service} />}
              {quote.source === 'email' && <Badge tone="violet">Reçu par email</Badge>}
            </div>
            <h3 className="text-[15px] leading-snug">
              {quote.residents ? <Link href={`/concierge/residents/${quote.residents.id}`} className="hover:text-gold-deep transition-colors duration-300">{residentName}</Link> : residentName ?? <span className="text-muted">Résident à rattacher</span>}
            </h3>
          </div>
          <Badge tone={statusTone[quote.status]}>{quoteLabels[quote.status]}</Badge>
        </div>
        <p className="text-[12.5px] text-ink/85 whitespace-pre-wrap break-words">{quote.label}</p>
        <p className="text-[12.5px]"><span className="text-muted">{quote.provider}</span> · <span className="font-medium text-ink">{quote.amount_cents == null ? 'Montant à renseigner' : formatMoney(quote.amount_cents)}</span></p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
          <span>Créé {formatDateTime(quote.created_at)}</span>
          {quote.sent_at && <span>· Envoyé {formatDateTime(quote.sent_at)}</span>}
          {quote.decided_at && <span>· Décision {formatDateTime(quote.decided_at)}</span>}
          {quote.email_from && <span>· De {quote.email_from}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {quote.amount_cents != null && quote.resident_id && <a href={`/api/quotes/${quote.id}/pdf`} target="_blank" rel="noopener noreferrer"><Button type="button" variant="outline" size="sm"><IconDoc size={11} /> PDF</Button></a>}
          <QuoteActions id={quote.id} status={quote.status} version={quote.updated_at} />
        </div>
        {quote.status === 'en_attente' && <Disclosure variant="inline" summary="Compléter ou modifier le devis"><QuoteForm quote={quote} requests={requestOptions} /></Disclosure>}
      </article>;
    })}</div>
  </div>;
}
