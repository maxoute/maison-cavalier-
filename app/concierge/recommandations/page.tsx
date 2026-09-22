import Link from 'next/link';
import { staffContext, residentsForStaff, checkRead } from '@/lib/operations/server';
import { categories } from '@/lib/operations/shared';
import { OperationForm } from '@/components/features/operation-form';
import { Field, ResidentSelect } from '@/components/features/operation-fields';
import { Badge } from '@/components/ui/badge';
import { Disclosure } from '@/components/ui/disclosure';
import { IconExternal, IconStar } from '@/components/ui/icons';
import { Input, Select } from '@/components/ui/input';
import { EmptyState, PageHeader, SectionTitle } from '@/components/ui/page-header';
import { StatCard, StatGrid } from '@/components/ui/stat';
import { createRecommendation, shareRecommendation, updateRecommendation, setShareStatus } from '@/app/actions/operations';
import { formatDateTime, formatMoney, count } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Recommendation, RecommendationShare } from '@/types';

const shareLabels: Record<string, string> = {
  proposee: 'Proposée', consultee: 'Consultée', reservee: 'Réservée', refusee: 'Refusée',
};
const shareTone: Record<string, 'blue' | 'orange' | 'green' | 'grey'> = { proposee: 'blue', consultee: 'orange', reservee: 'green', refusee: 'grey' };
/** Suites possibles d'un partage — le cycle est aussi gardé en base. */
const nextStatuses: Record<string, string[]> = {
  proposee: ['consultee', 'refusee'], consultee: ['reservee', 'refusee'], reservee: [], refusee: [],
};
const labelClass = 'block space-y-1 text-[12.5px] text-ink';

export default async function Page() {
  const { db, session } = await staffContext();
  const residents = await residentsForStaff();
  const results = await Promise.all([
    db.from('recommendations').select('*').eq('building_id', session.buildingId).order('is_partner', { ascending: false }).order('name'),
    db.from('recommendation_shares').select('*').eq('building_id', session.buildingId).order('created_at', { ascending: false }).limit(200),
  ]);
  results.forEach(r => checkRead(r.error));
  const recommendations = (results[0].data ?? []) as Recommendation[];
  const shares = (results[1].data ?? []) as RecommendationShare[];
  const names = new Map(residents.map(r => [r.id, r.full_name]));
  const addresses = new Map(recommendations.map(r => [r.id, r.name]));

  const booked = shares.filter(share => share.status === 'reservee');
  const revenue = booked.reduce((sum, share) => sum + (share.booking_amount_cents ?? 0), 0);
  const commissions = booked.reduce((sum, share) => sum + (share.commission_cents ?? 0), 0);
  const partners = recommendations.filter(r => r.is_partner).length;
  const pending = shares.filter(share => nextStatuses[share.status].length > 0);

  return <div className="space-y-6 fade-up">
    <PageHeader title="Recommandations" subtitle="Bonnes adresses du quartier, partenaires affiliés et suivi de chaque mise en relation jusqu’à la réservation." />
    <StatGrid>
      <StatCard value={recommendations.length} label="adresses" accent="blue" icon={IconStar} />
      <StatCard value={partners} label="partenaires affiliés" accent="gold" />
      <StatCard value={booked.length} label="réservations suivies" accent="green" hint={`${formatMoney(revenue, { round: true })} apportés aux partenaires`} />
      <StatCard value={formatMoney(commissions, { round: true })} label="commissions acquises" accent="violet" />
    </StatGrid>

    <Disclosure summary="Ajouter une adresse" hint="Restaurant, artisan, bien-être, culture…">
      <div className="max-w-2xl"><OperationForm action={createRecommendation} primary submit="Ajouter l’adresse">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom" name="name" required maxLength={200} placeholder="Le Relais Plaza" />
          <label className={labelClass}><span>Catégorie</span><Select name="category">{Object.entries(categories).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</Select></label>
          <div className="sm:col-span-2"><Field label="Description" name="description" placeholder="Brasserie art déco, table réservée aux résidents le jeudi." /></div>
          <Field label="Adresse" name="address" />
          <Field label="Téléphone" name="phone" />
          <Field label="Site web" name="url" type="url" placeholder="https://" />
          <Field label="Taux de commission (%)" name="commission_rate" inputMode="decimal" maxLength={10} placeholder="10" />
        </div>
        <label className="flex items-start gap-2 text-[12px]"><input className="mt-1" type="checkbox" name="is_partner" /><span>Partenaire affilié : Maison Cavalier perçoit une commission sur les réservations apportées.</span></label>
      </OperationForm></div>
    </Disclosure>

    {!recommendations.length && <EmptyState title="Aucune adresse pour le moment." description="Ajoutez les bonnes adresses du quartier pour les recommander aux résidents." />}
    <div className="grid md:grid-cols-2 gap-3">{recommendations.map(r => {
      const own = shares.filter(share => share.recommendation_id === r.id);
      const ownBooked = own.filter(share => share.status === 'reservee');
      const ownCommission = ownBooked.reduce((sum, share) => sum + (share.commission_cents ?? 0), 0);
      return <article key={r.id} className={cn('rounded-[8px] border bg-surface p-4 space-y-2.5 shadow-[0_1px_2px_rgba(10,22,40,.04)]', r.is_partner ? 'border-gold/30' : 'border-line', !r.is_active && 'opacity-70')}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <Badge tone="grey">{categories[r.category]}</Badge>
              {r.is_partner && <Badge tone="gold">Partenaire · {String(r.commission_rate).replace('.', ',')} %</Badge>}
              {!r.is_active && <Badge tone="red">Retirée</Badge>}
            </div>
            <h3 className="text-[15px] leading-snug">{r.name}</h3>
          </div>
          {r.url && /^https?:\/\//i.test(r.url) && <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-gold-deep transition-colors duration-300" aria-label="Consulter le site"><IconExternal size={14} /></a>}
        </div>
        {r.description && <p className="text-[12.5px] text-ink/85">{r.description}</p>}
        <p className="text-[11.5px] text-muted">{[r.address, r.phone].filter(Boolean).join(' · ')}</p>
        <p className="text-[11px] text-muted">{count(own.length, 'partage')} · {count(ownBooked.length, 'réservation')} · {formatMoney(ownCommission, { round: true })} de commission</p>
        <div className="flex flex-wrap items-end gap-3 pt-1">
          {r.is_active && <OperationForm action={shareRecommendation} submit="Recommander">
            <input type="hidden" name="id" value={r.id} />
            <ResidentSelect residents={residents} />
          </OperationForm>}
          <Disclosure variant="inline" summary="Affiliation et visibilité">
            <OperationForm action={updateRecommendation} submit="Enregistrer">
              <input type="hidden" name="id" value={r.id} />
              <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" name="is_partner" defaultChecked={r.is_partner} /><span>Partenaire affilié</span></label>
              <label className={labelClass}><span>Taux de commission (%)</span><Input name="commission_rate" defaultValue={r.commission_rate === null ? '' : String(r.commission_rate).replace('.', ',')} inputMode="decimal" maxLength={10} /></label>
              <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" name="is_active" defaultChecked={r.is_active} /><span>Proposée aux résidents</span></label>
            </OperationForm>
          </Disclosure>
        </div>
      </article>;
    })}</div>

    <section className="space-y-3">
      <SectionTitle hint={pending.length === 0 ? 'Aucun partage en attente de suite' : `${count(pending.length, 'partage')} en attente de suite`}>Suivi des mises en relation</SectionTitle>
      {!shares.length && <EmptyState title="Aucune recommandation partagée." />}
      <div className="grid gap-3 md:grid-cols-2">
      {/* Les partages clos restent affichés : c'est là que se lit le résultat
          d'une mise en relation, commission comprise. */}
      {shares.slice(0, 24).map(share => <article key={share.id} className="rounded-[8px] border border-line bg-surface p-4 space-y-2 shadow-[0_1px_2px_rgba(10,22,40,.04)]">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[14px] leading-snug">{addresses.get(share.recommendation_id) ?? 'Adresse retirée'} <span className="text-muted">→</span> <Link href={`/concierge/residents/${share.resident_id}`} className="hover:text-gold-deep transition-colors duration-300">{names.get(share.resident_id) ?? 'Résident'}</Link></h3>
          <Badge tone={shareTone[share.status]}>{shareLabels[share.status]}</Badge>
        </div>
        <p className="text-[11px] text-muted">Partagée {formatDateTime(share.created_at)}{share.status_changed_at ? ` · mise à jour ${formatDateTime(share.status_changed_at)}` : ''}</p>
        {share.status === 'reservee' && <p className="text-[12.5px] text-ink">Réservation de <span className="font-medium">{formatMoney(share.booking_amount_cents ?? 0)}</span> · commission <span className="font-medium text-gold-deep">{formatMoney(share.commission_cents ?? 0)}</span></p>}
        {share.feedback && <p className="text-[12px] text-ink/80 italic">« {share.feedback} »</p>}
        {nextStatuses[share.status].length > 0 && <Disclosure variant="inline" summary="Enregistrer la suite donnée">
          <OperationForm action={setShareStatus} submit="Enregistrer le suivi">
            <input type="hidden" name="id" value={share.id} />
            <label className={labelClass}><span>Suite donnée</span><Select name="status" defaultValue={nextStatuses[share.status][0]}>
              {nextStatuses[share.status].map(status => <option key={status} value={status}>{shareLabels[status]}</option>)}
            </Select></label>
            <label className={labelClass}><span>Montant de la réservation (€)</span><Input name="amount" inputMode="decimal" maxLength={20} placeholder="200,00" /></label>
            <label className={labelClass}><span>Retour du résident</span><Input name="feedback" maxLength={500} /></label>
            <p className="text-[11px] text-muted">Le montant n’est demandé que pour une réservation ; la commission est alors figée au taux du partenaire.</p>
          </OperationForm>
        </Disclosure>}
      </article>)}
      </div>
    </section>
  </div>;
}
