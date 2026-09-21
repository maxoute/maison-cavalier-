import { RequestBoard } from '@/components/features/request-board';
import { OperationForm } from '@/components/features/operation-form';
import { Field, ResidentSelect } from '@/components/features/operation-fields';
import { Select, Textarea } from '@/components/ui/input';
import { createRequest } from '@/app/actions/requests';
import { requestsForStaff } from '@/lib/operations/requests';
import { residentsForStaff, check } from '@/lib/operations/server';
import { serviceLabels } from '@/lib/requests';
import type { ServiceType } from '@/types';

export default async function ConciergeDashboard() {
  const { db, session, now, requests } = await requestsForStaff();
  const residents = await residentsForStaff();
  const { data: building, error } = await db.from('buildings').select('enabled_services').eq('id', session.buildingId).single();
  check(error);
  const services = (building?.enabled_services ?? []) as ServiceType[];
  return <div className="space-y-6">
    <h1 className="text-3xl">Demandes</h1>
    <details className="rounded-lg border border-navy-3 p-4">
      <summary className="cursor-pointer text-base">Nouvelle demande</summary>
      <div className="mt-4 max-w-xl"><OperationForm action={createRequest} primary submit="Créer la demande">
        <ResidentSelect residents={residents} />
        <label className="block space-y-1"><span>Service</span><Select name="service" required defaultValue=""><option value="" disabled>Choisir un service</option>{services.map(service => <option key={service} value={service}>{serviceLabels[service]}</option>)}</Select></label>
        <label className="block space-y-1"><span>Priorité</span><Select name="priority" defaultValue="normale"><option value="normale">Normale</option><option value="urgente">Urgente</option></Select></label>
        <label className="block space-y-1"><span>Description</span><Textarea name="description" required maxLength={4000} rows={3} /></label>
        <Field label="Échéance SLA (heure UTC)" name="sla_deadline" type="datetime-local" />
      </OperationForm></div>
    </details>
    <RequestBoard key={session.buildingId} buildingId={session.buildingId} requests={requests} initialNow={now} />
  </div>;
}
