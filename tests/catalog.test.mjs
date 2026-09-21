import test from 'node:test';
import assert from 'node:assert/strict';
import { commissionCents, formatSla, formatTariff, isPricingUnit, parseEuros, parseRate, slaDeadline } from '../lib/catalog.ts';

test('les tarifs saisis en euros deviennent des centimes, virgule ou point', () => {
  assert.equal(parseEuros('12,50'), 1250);
  assert.equal(parseEuros('12.5'), 1250);
  assert.equal(parseEuros('0'), 0);
  assert.equal(parseEuros('1 234,05'), 123405);
  for (const value of ['-1', '12,555', 'abc', '', '12€', '1e3', '12345678']) {
    assert.throws(() => parseEuros(value), /Tarif invalide/);
  }
});

test('la commission reste un pourcentage borné à 100', () => {
  assert.equal(parseRate('15'), 15);
  assert.equal(parseRate('12,5'), 12.5);
  assert.equal(parseRate('0'), 0);
  assert.equal(parseRate('100'), 100);
  assert.throws(() => parseRate('101'), /100/);
  for (const value of ['-5', '1,255', 'quinze', '']) assert.throws(() => parseRate(value));
});

test('la commission est arrondie au centime et ne dérive pas du montant', () => {
  assert.equal(commissionCents(10_000, 15), 1500);
  assert.equal(commissionCents(2_499, 12.5), 312); // 312,375 centimes
  assert.equal(commissionCents(0, 20), 0);
  assert.equal(commissionCents(5_000, 0), 0);
});

test('les tarifs et engagements restent lisibles en loge', () => {
  assert.equal(formatTariff(0, 'fixe'), 'Offert');
  assert.equal(formatTariff(250, 'km').replace(/ | /g, ' '), '2,50 € / km');
  assert.equal(formatSla(null), 'Aucun engagement');
  assert.equal(formatSla(45), '45 min');
  assert.equal(formatSla(90), '1 h 30');
  assert.equal(formatSla(1440), '24 h');
  assert.equal(isPricingUnit('constructor'), false);
});

test('l’échéance SLA par défaut découle du catalogue, en UTC', () => {
  const now = Date.parse('2026-09-21T08:00:00Z');
  assert.equal(slaDeadline(30, now), '2026-09-21T08:30:00.000Z');
  assert.equal(slaDeadline(1440, now), '2026-09-22T08:00:00.000Z');
  assert.equal(slaDeadline(null, now), null);
});
