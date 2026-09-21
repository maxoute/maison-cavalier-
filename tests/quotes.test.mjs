import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuoteAmount, quoteMetrics } from '../lib/quotes.ts';
import { renderQuotePdf } from '../lib/pdf/quote.ts';
import { PDFDocument } from 'pdf-lib';

test('montants en centimes sans arrondi flottant et sans dépassement SQL integer', () => {
  assert.equal(parseQuoteAmount('19,99'), 1999);
  assert.equal(parseQuoteAmount('0.29'), 29);
  assert.equal(parseQuoteAmount('21474836.47'), 2147483647);
  for (const value of ['-1', '1.005', '1e3', '21474836.48', 'NaN', '']) assert.throws(() => parseQuoteAmount(value));
});

test('conversion et délai moyen excluent les refus et dates historiques inconnues', () => {
  const metrics = quoteMetrics([
    { status: 'en_attente', amount_cents: 1900 },
    { status: 'envoye', amount_cents: 2000 },
    { status: 'accepte', sent_at: '2026-09-17T10:00:00Z', decided_at: '2026-09-17T12:00:00Z' },
    { status: 'accepte', sent_at: null, decided_at: null },
    { status: 'refuse', sent_at: '2026-09-17T10:00:00Z', decided_at: '2026-09-17T20:00:00Z' },
  ]);
  assert.equal(metrics.pendingCount, 2);
  assert.equal(metrics.pendingCents, 3900);
  assert.equal(metrics.acceptancePercent, 67);
  assert.equal(metrics.averageAcceptanceHours, 2);
  assert.equal(quoteMetrics([]).acceptancePercent, null);
});

test('PDF : polices françaises embarquées et pagination des longues prestations', async () => {
  const input = { reference: '00000000-0000-0000-0000-000000000001', createdAt: '2026-09-17T10:00:00Z', statusLabel: 'Envoyé', buildingName: 'Résidence Élysée', buildingAddress: '12, avenue de l’Opéra — Paris', residentName: 'Élodie Cœur', provider: 'Atelier François', label: 'Nettoyage d’un manteau en cachemire.', amountCents: 1999 };
  const normal = await PDFDocument.load(await renderQuotePdf(input));
  assert.equal(normal.getPageCount(), 1);
  assert.match(normal.getTitle(), /Devis Maison Cavalier/);
  const long = await PDFDocument.load(await renderQuotePdf({ ...input, label: 'Réparation détaillée avec contrôle qualité. '.repeat(95) + 'A'.repeat(150) }));
  assert.ok(long.getPageCount() > 1);
});
