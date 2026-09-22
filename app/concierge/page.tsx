import { RequestBoard } from '@/components/features/request-board';
import { OperationForm } from '@/components/features/operation-form';
import { Field, ResidentSelect } from '@/components/features/operation-fields';
import { Disclosure } from '@/components/ui/disclosure';
import { PageHeader } from '@/components/ui/page-header';
import { Select, Textarea } from '@/components/ui/input';
import { createRequest } from '@/app/actions/requests';
import { requestsForStaff } from '@/lib/operations/requests';
import { residentsForStaff, checkRead } from '@/lib/operations/server';
import { formatSla } from '@/lib/catalog';
import { serviceLabels } from '@/lib/requests';
import type { ServiceType } from '@/types';

export default async function ConciergeDashboard() {
  const { db, session, now, requests } = await requestsForStaff();
  const residents = await residentsForStaff();
  const { data: catalog, error } = await db.from('building_services').select('service, enabled, sla_minutes').eq('building_id', session.buildingId);
  checkRead(error);
  const services = (catalog ?? []).filter(row => row.enabled) as { service: ServiceType; sla_minutes: number | null }[];
  const order: ServiceType[] = ['chauffeur', 'pressing', 'colis', 'billetterie', 'personal_shopper'];
  services.sort((a, b) => order.indexOf(a.service) - order.indexOf(b.service));
  return <div className="space-y-5 fade-up">
    <PageHeader title="Demandes" subtitle="Tableau de bord opérationnel en temps réel : Nouveau · En cours · En attente · Terminé. Le minuteur SLA passe au rouge dès le dépassement." />
    <Disclosure summary="Nouvelle demande" hint="Créée en loge ou reçue via WhatsApp">
      <div className="max-w-2xl"><OperationForm action={createRequest} primary submit="Créer la demande">
        <div className="grid gap-3 sm:grid-cols-2">
          <ResidentSelect residents={residents} />
          <label className="block space-y-1 text-[12.5px] text-ink"><span>Service</span><Select name="service" required defaultValue=""><option value="" disabled>Choisir un service</option>{services.map(row => <option key={row.service} value={row.service}>{serviceLabels[row.service]}{row.sla_minutes ? ` · SLA ${formatSla(row.sla_minutes)}` : ''}</option>)}</Select></label>
          <label className="block space-y-1 text-[12.5px] text-ink"><span>Priorité</span><Select name="priority" defaultValue="normale"><option value="normale">Normale</option><option value="urgente">Urgente</option></Select></label>
          <Field label="Montant facturé (€, optionnel)" name="amount" inputMode="decimal" placeholder="45,00" />
        </div>
        <label className="block space-y-1 text-[12.5px] text-ink"><span>Description</span><Textarea name="description" required maxLength={4000} rows={3} placeholder="Ex. Trajet Roissy CDG demain 7h, deux valises." /></label>
        <Field label="Échéance SLA (heure de Paris, sinon celle du catalogue)" name="sla_deadline" type="datetime-local" />
      </OperationForm></div>
    </Disclosure>
    <RequestBoard key={session.buildingId} buildingId={session.buildingId} requests={requests} initialNow={now} />
  </div>;
}
