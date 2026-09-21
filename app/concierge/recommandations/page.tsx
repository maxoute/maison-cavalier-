import { staffContext, residentsForStaff, check } from '@/lib/operations/server';
import { categories } from '@/lib/operations/shared';
import { OperationForm } from '@/components/features/operation-form';
import { Field, ResidentSelect } from '@/components/features/operation-fields';
import { Input, Select } from '@/components/ui/input';
import { createRecommendation, shareRecommendation, updateRecommendation, setShareStatus } from '@/app/actions/operations';
import { formatEuros } from '@/lib/catalog';
import type { Recommendation, RecommendationShare } from '@/types';

const shareLabels: Record<string, string> = {
  proposee: 'Proposée', consultee: 'Consultée', reservee: 'Réservée', refusee: 'Refusée',
};
/** Suites possibles d'un partage — le cycle est aussi gardé en base. */
const nextStatuses: Record<string, string[]> = {
  proposee: ['consultee', 'refusee'], consultee: ['reservee', 'refusee'], reservee: [], refusee: [],
};

export default async function Page() {
  const { db, session } = await staffContext();
  const residents = await residentsForStaff();
  const results = await Promise.all([
    db.from('recommendations').select('*').eq('building_id', session.buildingId).order('is_partner', { ascending: false }).order('name'),
    db.from('recommendation_shares').select('*').eq('building_id', session.buildingId).order('created_at', { ascending: false }).limit(200),
  ]);
  results.forEach(r => check(r.error));
  const recommendations = (results[0].data ?? []) as Recommendation[];
  const shares = (results[1].data ?? []) as RecommendationShare[];
  const names = new Map(residents.map(r => [r.id, r.full_name]));
  const addresses = new Map(recommendations.map(r => [r.id, r.name]));

  const booked = shares.filter(share => share.status === 'reservee');
  const revenue = booked.reduce((sum, share) => sum + (share.booking_amount_cents ?? 0), 0);
  const commissions = booked.reduce((sum, share) => sum + (share.commission_cents ?? 0), 0);
  const partners = recommendations.filter(r => r.is_partner).length;
  const pending = shares.filter(share => nextStatuses[share.status].length > 0);

  return <div className="space-y-6 text-base">
    <header><h1 className="text-3xl">Nos recommandations</h1>
      <p className="text-grey mt-2">Bonnes adresses, partenaires affiliés et suivi des mises en relation. Partage WhatsApp simulé.</p>
    </header>

    <section className="grid gap-4 sm:grid-cols-4">
      {[
        { v: String(recommendations.length), l: 'adresses' },
        { v: String(partners), l: 'partenaires affiliés' },
        { v: `${booked.length}`, l: 'réservations suivies' },
        { v: formatEuros(commissions), l: 'commissions acquises' },
      ].map(({ v, l }) => <div key={l} className="rounded-lg border border-navy-3 bg-navy-2 p-4">
        <p className="text-2xl text-cream">{v}</p><p className="text-grey">{l}</p>
      </div>)}
    </section>
    <p className="text-grey">{formatEuros(revenue)} de réservations apportées aux partenaires depuis la loge.</p>

    <details className="border border-navy-3 rounded-lg p-4"><summary className="cursor-pointer">Ajouter une adresse</summary>
      <div className="mt-4 max-w-xl"><OperationForm action={createRecommendation} primary>
        <Field label="Nom" name="name" required maxLength={200} />
        <label className="block">Catégorie<Select name="category">{Object.entries(categories).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</Select></label>
        <Field label="Description" name="description" />
        <Field label="Adresse" name="address" />
        <Field label="Téléphone" name="phone" />
        <Field label="Site web" name="url" type="url" />
        <label className="flex items-start gap-2"><input className="mt-1" type="checkbox" name="is_partner" /><span>Partenaire affilié : Maison Cavalier perçoit une commission sur les réservations apportées.</span></label>
        <Field label="Taux de commission (%)" name="commission_rate" inputMode="decimal" maxLength={10} />
      </OperationForm></div>
    </details>

    {!recommendations.length && <p>Aucune adresse pour le moment.</p>}
    <div className="grid md:grid-cols-2 gap-4">{recommendations.map(r => {
      const own = shares.filter(share => share.recommendation_id === r.id);
      const ownBooked = own.filter(share => share.status === 'reservee');
      const ownCommission = ownBooked.reduce((sum, share) => sum + (share.commission_cents ?? 0), 0);
      return <article key={r.id} className="border border-navy-3 rounded-lg bg-navy-2 p-5 space-y-3">
        <p className="text-grey">{categories[r.category]}{r.is_active ? '' : ' · retirée du catalogue'}</p>
        <h2 className="text-2xl">{r.name}</h2>
        {r.is_partner && <p className="text-gold-light">Partenaire affilié · commission {String(r.commission_rate).replace('.', ',')} %</p>}
        {r.description && <p>{r.description}</p>}
        {r.address && <p>{r.address}</p>}
        {r.phone && <p>{r.phone}</p>}
        {r.url && /^https?:\/\//i.test(r.url) && <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline">Consulter le site</a>}
        <p className="text-grey">{own.length} partage(s) · {ownBooked.length} réservation(s) · {formatEuros(ownCommission)} de commission</p>
        <details><summary className="cursor-pointer">Affiliation et visibilité</summary>
          <div className="mt-3"><OperationForm action={updateRecommendation} submit="Enregistrer l’affiliation">
            <input type="hidden" name="id" value={r.id} />
            <label className="flex items-start gap-2"><input className="mt-1" type="checkbox" name="is_partner" defaultChecked={r.is_partner} /><span>Partenaire affilié</span></label>
            <label className="block">Taux de commission (%)<Input name="commission_rate" defaultValue={r.commission_rate === null ? '' : String(r.commission_rate).replace('.', ',')} inputMode="decimal" maxLength={10} /></label>
            <label className="flex items-start gap-2"><input className="mt-1" type="checkbox" name="is_active" defaultChecked={r.is_active} /><span>Proposée aux résidents</span></label>
          </OperationForm></div>
        </details>
        {r.is_active && <OperationForm action={shareRecommendation} submit="Recommander au résident">
          <input type="hidden" name="id" value={r.id} />
          <ResidentSelect residents={residents} />
        </OperationForm>}
      </article>;
    })}</div>

    <section className="space-y-4">
      <h2 className="text-2xl">Suivi des mises en relation</h2>
      <p className="text-grey">{pending.length === 0 ? 'Aucun partage en attente de suite.' : `${pending.length} partage(s) en attente de suite.`}</p>
      {/* Les partages clos restent affichés : c'est là que se lit le résultat
          d'une mise en relation, commission comprise. */}
      {shares.slice(0, 25).map(share => <article key={share.id} className="rounded-lg border border-navy-3 bg-navy-2 p-5 space-y-3">
        <h3 className="text-xl">{addresses.get(share.recommendation_id) ?? 'Adresse retirée'} → {names.get(share.resident_id) ?? 'Résident'}</h3>
        <p className="text-grey">{shareLabels[share.status]} · partagée le {new Date(share.created_at).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}</p>
        {share.status === 'reservee' && <p>Réservation de {formatEuros(share.booking_amount_cents ?? 0)} · commission {formatEuros(share.commission_cents ?? 0)}</p>}
        {share.feedback && <p>« {share.feedback} »</p>}
        {nextStatuses[share.status].length > 0 && <OperationForm action={setShareStatus} submit="Enregistrer le suivi">
          <input type="hidden" name="id" value={share.id} />
          <label className="block">Suite donnée<Select name="status" defaultValue={nextStatuses[share.status][0]}>
            {nextStatuses[share.status].map(status => <option key={status} value={status}>{shareLabels[status]}</option>)}
          </Select></label>
          <label className="block">Montant de la réservation en euros<Input name="amount" inputMode="decimal" maxLength={20} /></label>
          <label className="block">Retour du résident<Input name="feedback" maxLength={500} /></label>
          <p className="text-grey">Le montant n’est demandé que pour une réservation ; la commission est alors figée au taux du partenaire.</p>
        </OperationForm>}
      </article>)}
    </section>
  </div>;
}
