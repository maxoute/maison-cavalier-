import type { Quote, QuoteStatus } from '@/types';

export const quoteLabels: Record<QuoteStatus, string> = { en_attente: 'En attente', envoye: 'Envoyé', accepte: 'Accepté', refuse: 'Refusé' };
export const quoteTransitions: Record<QuoteStatus, QuoteStatus[]> = { en_attente: ['envoye'], envoye: ['accepte', 'refuse'], accepte: [], refuse: [] };

export function parseQuoteAmount(value: string) {
  if (!/^\d{1,8}(?:[.,]\d{1,2})?$/.test(value.trim())) throw new Error('Montant invalide. Utilisez au maximum deux décimales.');
  const [euros, decimals = ''] = value.trim().replace(',', '.').split('.');
  const cents = Number(euros) * 100 + Number(decimals.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents > 2_147_483_647) throw new Error('Montant trop élevé.');
  return cents;
}

export function quoteMetrics(quotes: Quote[]) {
  const pending = quotes.filter(quote => ['en_attente', 'envoye'].includes(quote.status));
  const decided = quotes.filter(quote => ['accepte', 'refuse'].includes(quote.status));
  const accepted = decided.filter(quote => quote.status === 'accepte');
  const delays = accepted.filter(quote => quote.sent_at && quote.decided_at)
    .map(quote => Date.parse(quote.decided_at!) - Date.parse(quote.sent_at!)).filter(delay => Number.isFinite(delay) && delay >= 0);
  return {
    pendingCount: pending.length,
    pendingCents: pending.reduce((total, quote) => total + (quote.amount_cents ?? 0), 0),
    acceptancePercent: decided.length ? Math.round(accepted.length / decided.length * 100) : null,
    averageAcceptanceHours: delays.length ? delays.reduce((sum, delay) => sum + delay, 0) / delays.length / 3_600_000 : null,
  };
}
