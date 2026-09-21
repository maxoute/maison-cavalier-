import { staffContext, residentsForStaff, check } from '@/lib/operations/server';
import { categories } from '@/lib/operations/shared';
import { OperationForm } from '@/components/features/operation-form';
import { Field, ResidentSelect } from '@/components/features/operation-fields';
import { Select } from '@/components/ui/input';
import { createRecommendation, shareRecommendation } from '@/app/actions/operations';
import type { Recommendation } from '@/types';
export default async function Page() {
  const { db, session } = await staffContext();
  const residents = await residentsForStaff();
  const results = await Promise.all([db.from('recommendations').select('*').eq('building_id', session.buildingId).eq('is_active', true).order('name'), db.from('recommendation_shares').select('recommendation_id, created_at').eq('building_id', session.buildingId)]);
  results.forEach(r => check(r.error));
  const recommendations = (results[0].data ?? []) as Recommendation[];
  const shares = results[1].data ?? [];
  return <div className="space-y-6 text-base"><header><h1 className="text-3xl">Nos recommandations</h1><p className="text-grey mt-2">Bonnes adresses et prestataires de confiance · Partage WhatsApp simulé.</p></header>
    <details className="border border-navy-3 rounded-lg p-4"><summary className="cursor-pointer">Ajouter une adresse</summary><div className="mt-4 max-w-xl"><OperationForm action={createRecommendation} primary><Field label="Nom" name="name" required maxLength={200} /><label className="block">Catégorie<Select name="category">{Object.entries(categories).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</Select></label><Field label="Description" name="description" /><Field label="Adresse" name="address" /><Field label="Téléphone" name="phone" /><Field label="Site web" name="url" type="url" /></OperationForm></div></details>
    {!recommendations.length && <p>Aucune adresse pour le moment.</p>}
    <div className="grid md:grid-cols-2 gap-4">{recommendations.map(r => <article key={r.id} className="border border-navy-3 rounded-lg bg-navy-2 p-5 space-y-3"><p className="text-grey">{categories[r.category]}</p><h2 className="text-2xl">{r.name}</h2><p>{r.description}</p><p>{r.address}</p><p>{r.phone}</p>{r.url && /^https?:\/\//i.test(r.url) && <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline">Consulter le site</a>}<p className="text-grey">{shares.filter(s => s.recommendation_id === r.id).length} partage(s) enregistré(s)</p><OperationForm action={shareRecommendation} submit="Recommander au résident"><input type="hidden" name="id" value={r.id} /><ResidentSelect residents={residents} /></OperationForm></article>)}</div>
  </div>;
}
