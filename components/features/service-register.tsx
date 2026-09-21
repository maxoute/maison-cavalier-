import { staffContext, residentsForStaff, check } from '@/lib/operations/server';
import { parcelLabels, pressingLabels } from '@/lib/operations/shared';
import { createParcel, createPressing, advanceOperation, uploadParcelPhoto, rescheduleParcel } from '@/app/actions/operations';
import { ParcelReminders } from './parcel-reminders';
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
  // Les preuves vivent dans un bucket privé : chaque photo est servie par une
  // URL signée de courte durée, jamais par un lien public.
  const photoPaths = rows.flatMap(row => ('photo_path' in row && row.photo_path ? [row.photo_path] : []));
  const photos = new Map<string, string>();
  if (photoPaths.length) {
    const signed = await db.storage.from('colis').createSignedUrls(photoPaths, 120);
    for (const entry of signed.data ?? []) if (entry.path && entry.signedUrl) photos.set(entry.path, entry.signedUrl);
  }
  const reminderDue = parcel ? rows.filter(row => 'received_at' in row && !row.reminder_sent_at
    && !['remis', 'retourne'].includes(row.status)
    && now - Date.parse(row.received_at) > 2 * 86_400_000).length : 0;
  return <div className="space-y-6 text-base">
    <header><h1 className="text-3xl">{parcel ? 'Gestion des colis' : 'Pressing'}</h1><p className="text-grey mt-2">{active.length} en cours · {rows.length} au total. Notifications en mode simulation.</p></header>
    {parcel && <section className="rounded-lg border border-navy-3 p-4"><ParcelReminders due={reminderDue} /></section>}
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
        {'photo_path' in row && <>
          {row.reminder_sent_at && <p className="text-grey">Rappel envoyé le {new Date(row.reminder_sent_at).toLocaleString('fr-FR', { timeZone: 'UTC' })} UTC</p>}
          {row.photo_path && photos.get(row.photo_path)
            // URL signée de courte durée sur un bucket privé : `next/image`
            // la mettrait en cache et demanderait d'autoriser l'hôte Supabase.
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={photos.get(row.photo_path)} alt={`Preuve de réception du colis de ${names.get(row.resident_id) ?? 'ce résident'}`} className="max-h-56 w-full rounded-lg border border-navy-3 object-contain" />
            : <p className="text-grey">Aucune preuve photo.</p>}
          <details><summary className="cursor-pointer">{row.photo_path ? 'Remplacer la photo' : 'Ajouter une photo'}</summary>
            <div className="mt-3"><OperationForm action={uploadParcelPhoto} submit="Enregistrer la photo">
              <input type="hidden" name="id" value={row.id} />
              <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" capture="environment" required aria-label="Photo du colis" className="block w-full text-cream file:mr-3 file:rounded-3xl file:border file:border-navy-3 file:bg-navy-2 file:px-4 file:py-2 file:text-cream" />
              <p className="text-grey">Depuis la tablette de la loge, le bouton ouvre directement l’appareil photo. JPEG, PNG ou WebP, 5 Mo maximum.</p>
            </OperationForm></div>
          </details>
          {!done && <details><summary className="cursor-pointer">Modifier le créneau de remise</summary>
            <div className="mt-3"><OperationForm action={rescheduleParcel} submit="Mettre à jour le créneau">
              <input type="hidden" name="id" value={row.id} />
              <Field label="Livraison prévue (heure UTC)" name="scheduled_delivery_at" type="datetime-local" defaultValue={row.scheduled_delivery_at ? row.scheduled_delivery_at.slice(0, 16) : ''} />
              <p className="text-grey">Laisser vide retire le colis du planning.</p>
            </OperationForm></div>
          </details>}
        </>}
        {!done && <OperationForm action={advanceOperation} submit="Étape suivante"><input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={row.id} /><input type="hidden" name="status" value={row.status} /></OperationForm>}
      </article>;
    })}</div>
  </div>;
}
