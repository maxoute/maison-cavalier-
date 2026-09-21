import { QuoteActions } from '@/components/features/quote-actions';
import { QuoteForm } from '@/components/features/quote-form';
import { Select, Input } from '@/components/ui/input';
import { requestsForStaff } from '@/lib/operations/requests';
import { check } from '@/lib/operations/server';
import { quoteLabels, quoteMetrics } from '@/lib/quotes';
import { serviceLabels } from '@/lib/requests';
import type { Quote, ServiceType } from '@/types';

type QuoteRow = Quote & { residents: { id: string; full_name: string } | null; service_requests: { service: ServiceType } | null };

export default async function DevisPage({ searchParams }: { searchParams: Promise<{ resident?: string; service?: string; status?: string }> }) {
  const filters = await searchParams;
  const { db, session, requests } = await requestsForStaff();
  const quotes: QuoteRow[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from('quotes').select('*, residents!quotes_resident_tenant(id, full_name), service_requests!quotes_request_tenant(service)')
      .eq('building_id', session.buildingId).order('created_at', { ascending: false }).order('id').range(offset, offset + 499);
    check(error); quotes.push(...((data ?? []) as unknown as QuoteRow[]));
    if (!data || data.length < 500) break;
  }
  const requestOptions = requests.map(request => ({ id: request.id, label: `${request.residents?.full_name ?? 'Résident'} · ${serviceLabels[request.service]} · ${new Date(request.created_at).toLocaleDateString('fr-FR', { timeZone: 'UTC' })} · ${request.id.slice(0, 8)}` }));
  const metrics = quoteMetrics(quotes);
  const shown = quotes.filter(quote => (!filters.status || quote.status === filters.status)
    && (!filters.service || (quote.document_snapshot?.service ?? quote.service_requests?.service) === filters.service)
    && (!filters.resident || (quote.document_snapshot?.resident_name ?? quote.residents?.full_name ?? '').toLocaleLowerCase('fr-FR').includes(filters.resident.toLocaleLowerCase('fr-FR'))));
  return <div className="space-y-6 text-base">
    <header><h1 className="text-3xl">Devis</h1><p className="mt-2 text-grey">Propositions aux résidents, PDF et historique. Notifications en mode simulation.</p></header>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[['Montant en cours', `${(metrics.pendingCents / 100).toLocaleString('fr-FR')} €`], ['Devis actifs', metrics.pendingCount], ['Taux d’acceptation (devis décidés)', metrics.acceptancePercent === null ? '—' : `${metrics.acceptancePercent} %`], ['Délai moyen d’acceptation', metrics.averageAcceptanceHours === null ? '—' : `${metrics.averageAcceptanceHours.toFixed(1)} h`]].map(([label, value]) => <div key={label} className="rounded-lg border border-navy-3 bg-navy-2 p-4"><p className="text-2xl">{value}</p><p className="text-grey">{label}</p></div>)}
    </div>
    <details className="rounded-lg border border-navy-3 p-4"><summary className="cursor-pointer">Créer un devis depuis une demande</summary><div className="mt-4 max-w-xl"><QuoteForm requests={requestOptions} /></div></details>
    <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <label className="space-y-1"><span>Résident</span><Input name="resident" type="search" placeholder="Rechercher un nom" defaultValue={filters.resident ?? ''} /></label>
      <label className="space-y-1"><span>Service</span><Select name="service" defaultValue={filters.service ?? ''}><option value="">Tous les services</option>{Object.entries(serviceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label>
      <label className="space-y-1"><span>Statut</span><Select name="status" defaultValue={filters.status ?? ''}><option value="">Actifs et archives</option>{Object.entries(quoteLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label>
      <button className="self-end rounded-3xl border border-navy-3 px-4 py-3" type="submit">Filtrer</button>
    </form>
    <p className="text-grey">{shown.length} devis affiché(s). Les décisions sont enregistrées par la conciergerie après échange avec le résident.</p>
    <div className="grid gap-4 lg:grid-cols-2">{shown.map(quote => <article key={quote.id} className="min-w-0 rounded-lg border border-navy-3 bg-navy-2 p-5 space-y-3">
      <h2 className="text-xl">{quote.document_snapshot?.resident_name ?? quote.residents?.full_name ?? 'Résident à rattacher'} · {quoteLabels[quote.status]}</h2>
      <p className="whitespace-pre-wrap break-words">{quote.label}</p>
      <p>{quote.provider} · {quote.amount_cents == null ? 'Montant à renseigner' : `${(quote.amount_cents / 100).toLocaleString('fr-FR')} €`}</p>
      <p className="text-grey">Créé le {new Date(quote.created_at).toLocaleString('fr-FR', { timeZone: 'UTC' })} UTC</p>
      {quote.sent_at && <p className="text-grey">Envoi simulé le {new Date(quote.sent_at).toLocaleString('fr-FR', { timeZone: 'UTC' })} UTC</p>}
      {quote.decided_at && <p className="text-grey">Décision enregistrée le {new Date(quote.decided_at).toLocaleString('fr-FR', { timeZone: 'UTC' })} UTC</p>}
      {quote.amount_cents != null && quote.resident_id && <a href={`/api/quotes/${quote.id}/pdf`} className="inline-block rounded-3xl border border-navy-3 px-4 py-2 hover:bg-navy">Télécharger le PDF</a>}
      {quote.status === 'en_attente' && <details><summary className="cursor-pointer underline underline-offset-4">Compléter ou modifier le devis</summary><div className="mt-3"><QuoteForm quote={quote} requests={requestOptions} /></div></details>}
      <QuoteActions id={quote.id} status={quote.status} version={quote.updated_at} />
    </article>)}</div>
    {!shown.length && <p>Aucun devis ne correspond aux filtres.</p>}
  </div>;
}
