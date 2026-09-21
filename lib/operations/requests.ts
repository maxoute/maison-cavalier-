import 'server-only';
import { staffContext, check } from './server';
import type { BoardRequest } from '@/components/features/request-board';

export async function requestsForStaff() {
  const context = await staffContext();
  const requests: BoardRequest[] = [];
  // PostgREST limite chaque réponse : ne pas tronquer les compteurs au premier lot.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await context.db.from('service_requests')
      .select('*, residents!requests_resident_tenant(id, full_name)')
      .eq('building_id', context.session.buildingId)
      .order('created_at', { ascending: false }).order('id')
      .range(offset, offset + 499);
    check(error);
    const batch = (data ?? []) as unknown as BoardRequest[];
    requests.push(...batch);
    if (batch.length < 500) break;
  }
  return { ...context, requests };
}
