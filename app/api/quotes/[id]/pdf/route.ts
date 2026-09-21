import { getSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { renderQuotePdf } from '@/lib/pdf/quote';
import { quoteLabels } from '@/lib/quotes';
import type { Quote } from '@/types';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new Response('Authentification requise.', { status: 401 });
  if (!['concierge', 'admin', 'super_admin'].includes(session.role)) return new Response('Accès refusé.', { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return new Response('Devis introuvable.', { status: 404 });
  const db = await createClient();
  const { data, error } = await db.from('quotes').select('*, residents!quotes_resident_tenant(full_name), buildings(name, address)')
    .eq('id', id).eq('building_id', session.buildingId).maybeSingle();
  if (error) return new Response('Document indisponible.', { status: 503 });
  if (!data) return new Response('Devis introuvable.', { status: 404 });
  const quote = data as unknown as Quote & { residents: { full_name: string } | null; buildings: { name: string; address: string } | null };
  if (quote.amount_cents == null || !quote.resident_id) return new Response('Complétez ce devis avant de générer son PDF.', { status: 409 });
  const snapshot = quote.document_snapshot;
  const bytes = await renderQuotePdf({
    reference: quote.id, createdAt: quote.created_at, statusLabel: quoteLabels[quote.status],
    buildingName: snapshot?.building_name ?? quote.buildings?.name ?? 'Maison Cavalier',
    buildingAddress: snapshot?.building_address ?? quote.buildings?.address ?? '',
    residentName: snapshot?.resident_name ?? quote.residents?.full_name ?? 'Résident',
    provider: snapshot?.provider ?? quote.provider, label: snapshot?.label ?? quote.label,
    amountCents: snapshot?.amount_cents ?? quote.amount_cents,
  });
  return new Response(new Uint8Array(bytes), { headers: {
    'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="devis-${id}.pdf"`,
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  } });
}
