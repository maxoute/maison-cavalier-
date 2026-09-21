import { getSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { check } from '@/lib/operations/server';
import { OperationForm } from './operation-form';
import { Field } from './operation-fields';
import { Textarea } from '@/components/ui/input';
import { receiveBuildingQuote, emailBuildingQuote } from '@/app/actions/building-documents';

export async function BuildingDocuments() {
  const session = await getSession();
  if (!session || !['syndic', 'concierge', 'admin', 'super_admin'].includes(session.role)) throw new Error('Accès refusé.');
  const staff = session.role !== 'syndic';
  const db = await createClient();
  const { data, error } = await db.from('building_documents').select('*').eq('building_id', session.buildingId).order('created_at', { ascending: false });
  check(error);
  const deliveries = staff ? await db.from('building_document_deliveries').select('document_id, recipient, created_at, simulated').eq('building_id', session.buildingId).order('created_at', { ascending: false }) : null;
  if (deliveries) check(deliveries.error);
  return <div className="space-y-6 text-base"><header><h1 className="text-3xl">Devis de l’immeuble</h1><p className="text-grey mt-2">Documents partagés avec le syndic pour les parties communes.</p></header>
    {staff && <details className="rounded-lg border border-navy-3 p-4"><summary className="cursor-pointer">Enregistrer un devis reçu par email</summary><div className="mt-4 max-w-xl space-y-4"><p className="text-grey">Réception automatique non connectée : recopiez les informations du devis reçu. Ce contenu sera visible par le syndic ; réservez cet espace aux parties communes.</p><OperationForm action={receiveBuildingQuote} primary><Field label="Objet du devis" name="title" required maxLength={200} /><Field label="Prestataire" name="provider" required maxLength={200} /><Field label="Email de l’expéditeur" name="email_from" type="email" required /><Field label="Référence unique du mail ou du devis" name="email_message_id" required maxLength={500} /><Field label="Montant en euros" name="amount" inputMode="decimal" /><label className="block">Contenu du devis<Textarea name="body" required maxLength={10000} rows={6} /></label></OperationForm></div></details>}
    {!data?.length && <p className="text-grey">Aucun devis partagé pour cet immeuble.</p>}
    {data?.map(doc => <article key={doc.id} className="border border-navy-3 rounded-lg bg-navy-2 p-5 space-y-3"><h2 className="text-2xl">{doc.title}</h2><p>{doc.provider} · {doc.amount_cents === null ? 'Montant à confirmer' : (doc.amount_cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</p><p className="text-grey">Enregistré le {new Date(doc.created_at).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}</p><p className="whitespace-pre-wrap break-words">{doc.body}</p>
      {staff && <details><summary className="cursor-pointer">Transmettre par email</summary><div className="mt-3 space-y-3"><OperationForm action={emailBuildingQuote} submit="Simuler l’envoi au syndic"><input type="hidden" name="id" value={doc.id} /><Field label="Email du syndic" name="email" type="email" required /></OperationForm>{deliveries?.data?.filter(d => d.document_id === doc.id).map((d, i) => <p key={i} className="text-grey">{d.simulated ? 'Envoi simulé' : 'Envoyé'} à {d.recipient} · {new Date(d.created_at).toLocaleString('fr-FR', { timeZone: 'UTC' })} UTC</p>)}</div></details>}
    </article>)}
  </div>;
}
