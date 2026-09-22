import { managerContext } from '@/lib/admin/server';
import {
  financeCsv, financeExportLines, monthRange, parseMonthParam,
  type BuildingRow, type RequestRow, type ServiceRateRow,
} from '@/lib/finance';
import { getSession } from '@/lib/session';

/**
 * Export comptable du mois (PRD §6.3.5) : une ligne par service terminé,
 * au format attendu par Excel FR. La session est celle du cookie, la lecture
 * passe par le client RLS — jamais la clé service-role — et le fichier ne
 * contient aucune donnée nominative de résident.
 */
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response('Authentification requise.', { status: 401 });
  if (!['admin', 'super_admin'].includes(session.role)) {
    return new Response('Accès refusé.', { status: 403 });
  }

  const month = parseMonthParam(new URL(request.url).searchParams.get('mois') ?? undefined);
  const { db, buildingId } = await managerContext();
  // Le super-admin exporte le parc consolidé, l'admin son seul immeuble.
  const consolidated = session.role === 'super_admin';
  const { start, end } = monthRange(month);

  const requestQuery = db.from('service_requests')
    .select('building_id, service, status, amount_cents, completed_at, created_at')
    .eq('status', 'termine')
    .lt('created_at', end)
    .or(`completed_at.gte.${start},created_at.gte.${start}`);
  const serviceQuery = db.from('building_services').select('building_id, service, commission_rate');

  const [requestRows, serviceRows, buildingRows] = await Promise.all([
    consolidated ? requestQuery : requestQuery.eq('building_id', buildingId),
    consolidated ? serviceQuery : serviceQuery.eq('building_id', buildingId),
    db.from('buildings').select('id, name'),
  ]);

  if (requestRows.error || serviceRows.error || buildingRows.error) {
    return new Response('Export momentanément indisponible.', { status: 503 });
  }

  const lines = financeExportLines({
    month,
    requests: (requestRows.data ?? []) as RequestRow[],
    services: (serviceRows.data ?? []) as ServiceRateRow[],
    buildings: (buildingRows.data ?? []) as BuildingRow[],
  });

  return new Response(financeCsv(lines), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="maison-cavalier-finance-${month}.csv"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
