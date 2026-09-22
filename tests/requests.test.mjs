import test from 'node:test';
import assert from 'node:assert/strict';
import { requestSla, requestTransitions, isRequestStatus, isServiceType } from '../lib/requests.ts';
import { parseUtcDateTime } from '../lib/operations/dates.ts';

test('SLA : dépassement dès la première seconde, y compris une demande non urgente', () => {
  const now = Date.parse('2026-09-17T10:00:00Z');
  const late = requestSla('2026-09-17T09:59:59Z', 'en_cours', now);
  assert.equal(late.late, true);
  assert.equal(late.label, 'SLA dépassé de 1 min');
  assert.equal(requestSla('2026-09-17T10:00:01Z', 'nouveau', now).late, false);
  assert.equal(requestSla('2026-09-17T09:00:00Z', 'termine', now), null);
  assert.equal(requestSla(null, 'en_cours', now), null);
  assert.equal(requestSla('invalid', 'en_cours', now), null);
});

test('la clôture exige une prise en charge et une demande clôturée ne se rouvre pas', () => {
  assert.equal(requestTransitions.nouveau.includes('termine'), false);
  assert.equal(requestTransitions.en_attente.includes('termine'), false);
  assert.equal(requestTransitions.en_cours.includes('termine'), true);
  assert.deepEqual(requestTransitions.termine, []);
  assert.equal(isRequestStatus('toString'), false);
  assert.equal(isServiceType('__proto__'), false);
});

test('les horaires UTC ne dépendent pas du fuseau du serveur', () => {
  const oldTimezone = process.env.TZ;
  try {
    process.env.TZ = 'America/Los_Angeles';
    assert.equal(parseUtcDateTime('2026-09-17T10:30'), '2026-09-17T10:30:00.000Z');
    assert.equal(parseUtcDateTime('2028-02-29T23:59:59'), '2028-02-29T23:59:59.000Z');
    for (const value of ['2026-02-29T10:00', '2026-09-31T10:00', '2026-09-17T24:00', '2026-09-17T10:30+02:00', '']) {
      assert.throws(() => parseUtcDateTime(value), /Date invalide/);
    }
  } finally {
    if (oldTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = oldTimezone;
  }
});

test('les horaires de loge sont saisis en heure de Paris et stockés en UTC', async () => {
  const { parseParisDateTime } = await import('../lib/operations/dates.ts');
  assert.equal(parseParisDateTime('2026-09-17T10:30'), '2026-09-17T08:30:00.000Z'); // été : UTC+2
  assert.equal(parseParisDateTime('2026-01-17T10:30'), '2026-01-17T09:30:00.000Z'); // hiver : UTC+1
  assert.throws(() => parseParisDateTime('2026-02-30T10:00'), /Date invalide/);
});

test('le libellé SLA est humanisé', () => {
  const now = Date.parse('2026-09-17T10:00:00Z');
  assert.equal(requestSla('2026-09-17T08:55:00Z', 'en_cours', now).label, 'SLA dépassé de 1 h 05');
  assert.equal(requestSla('2026-09-19T10:00:00Z', 'nouveau', now).label, 'SLA : 2 j restantes');
});
