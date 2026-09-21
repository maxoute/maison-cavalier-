import { staffContext, residentsForStaff, check } from '@/lib/operations/server';
import { parcelLabels, pressingLabels } from '@/lib/operations/shared';
import { createParcel, createPressing, advanceOperation } from '@/app/actions/operations';
import { OperationForm } from './operation-form';
import { Field, ResidentSelect } from './operation-fields';
import { ServiceSchedule } from './service-schedule';
import type { Parcel, PressingOrder } from '@/types';

export async function ServiceRegister({ kind }: { kind: 'parcels' | 'pressing_orders' }) {
  const { db, session, now } = await staffContext();
  const residents = await residentsForStaff();
  const { data, error } = await db.from(kind).select('*').eq('building_id', session.buildingId).order('created_at', { ascending: false });
  check(error);
  const rows = (data ?? []) as (Parcel | PressingOrder)[];
  const parcel = kind === 'parcels';
  const labels = parcel ? parcelLabels : pressingLabels;
  const active = rows.filter(row => !['remis', 'retourne', 'livre'].includes(row.status));
  const names = new Map(residents.map(r => [r.id, r.full_name]));
  return <div className="space-y-6 text-base">
    <header><h1 className="text-3xl">{parcel ? 'Gestion des colis' : 'Pressing'}</h1><p className="text-grey mt-2">{active.length} en cours · {rows.length} au total. Notifications en mode simulation.</p></header>
    <details className="rounded-lg border border-navy-3 p-4"><summary className="cursor-pointer text-cream">{parcel ? 'Réceptionner un colis' : 'Nouvelle collecte'}</summary>
      <div className="mt-4 max-w-xl"><OperationForm action={parcel ? createParcel : createPressing} primary>
        <ResidentSelect residents={residents} />
        {parcel ? <><Field label="Transporteur" name="carrier" /><Field label="Code de suivi (saisie ou lecteur de codes)" name="tracking_code" required maxLength={200} /><Field label="Emplacement en loge" name="storage_location" /><Field label="Livraison prévue (heure UTC)" name="scheduled_delivery_at" type="datetime-local" /></> : <><Field label="Prestataire" name="provider" required /><Field label="Articles confiés" name="items" required /><Field label="Nombre de pièces" name="quantity" type="number" min={1} max={1000} defaultValue={1} required /><Field label="Retour prévu (heure UTC)" name="expected_return_at" type="datetime-local" /></>}
        <Field label="Notes" name="notes" />
      </OperationForm></div>
    </details>
    <ServiceSchedule now={now} operations={active.map(row => ({
      id: row.id,
      resident: names.get(row.resident_id) ?? 'Résident',
      deadline: 'scheduled_delivery_at' in row ? row.scheduled_delivery_at : row.expected_return_at,
      status: labels[row.status],
    }))} />
    {!rows.length && <p className="text-grey">Aucun {parcel ? 'colis' : 'pressing'} enregistré.</p>}
    <div className="grid gap-4 md:grid-cols-2">{rows.map(row => {
      const deadline = 'scheduled_delivery_at' in row ? row.scheduled_delivery_at : row.expected_return_at;
      const done = ['remis', 'retourne', 'livre'].includes(row.status);
      return <article key={row.id} id={`operation-${row.id}`} className="scroll-mt-6 rounded-lg border border-navy-3 bg-navy-2 p-5 space-y-3">
        <div className="flex justify-between gap-3"><h2 className="text-xl">{names.get(row.resident_id) ?? 'Résident'}</h2><span>{labels[row.status]}</span></div>
        {'tracking_code' in row ? <p>{row.carrier || 'Transporteur non renseigné'} · {row.tracking_code}<br />{row.storage_location}</p> : <p>{row.provider} · {row.item_count} pièce(s)<br />{row.items.map(i => `${i.quantity} × ${i.label}`).join(', ')}</p>}
        <p className="text-grey">Enregistré le {new Date(row.created_at).toLocaleString('fr-FR', { timeZone: 'UTC' })} UTC</p>
        {deadline && <p className={!done && new Date(deadline).getTime() < now ? 'text-red' : 'text-cream'}>Prévu : {new Date(deadline).toLocaleString('fr-FR', { timeZone: 'UTC' })} UTC</p>}
        {row.notes && <p>{row.notes}</p>}
        {!done && <OperationForm action={advanceOperation} submit="Étape suivante"><input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={row.id} /><input type="hidden" name="status" value={row.status} /></OperationForm>}
      </article>;
    })}</div>
  </div>;
}
