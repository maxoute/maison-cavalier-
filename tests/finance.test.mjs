import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFinanceReport, completedOfMonth, currentMonth, financeCsv, financeExportLines,
  isMonthKey, lastMonths, monthKey, monthRange, monthShortLabel, monthStartIso, parseMonthParam, quoteDate,
  requestDate, shareDate, shiftMonth,
} from '../lib/finance.ts';

const marly = '11111111-1111-1111-1111-111111111111';
const segur = '22222222-2222-2222-2222-222222222222';

const buildings = [
  { id: marly, name: 'Le Marly' },
  { id: segur, name: 'Villa Ségur' },
];
const services = [
  { building_id: marly, service: 'chauffeur', commission_rate: 15 },
  { building_id: marly, service: 'pressing', commission_rate: 20 },
  { building_id: marly, service: 'colis', commission_rate: 0 },
  { building_id: segur, service: 'chauffeur', commission_rate: 10 },
];

function request(overrides) {
  return {
    building_id: marly, service: 'chauffeur', status: 'termine', amount_cents: 10_000,
    completed_at: null, created_at: '2026-09-10T09:00:00Z', ...overrides,
  };
}

test('le mois est celui de Paris, pas celui du serveur', () => {
  // 30 septembre 22h30 UTC = 1er octobre 00h30 à Paris.
  assert.equal(monthKey('2026-09-30T22:30:00Z'), '2026-10');
  assert.equal(monthKey('2026-09-30T21:30:00Z'), '2026-09');
  // 31 décembre 23h30 UTC = 1er janvier 00h30 à Paris.
  assert.equal(monthKey('2026-12-31T23:30:00Z'), '2027-01');
  assert.equal(currentMonth('2026-09-22T13:54:00Z'), '2026-09');
  assert.throws(() => monthKey('pas une date'), /Date invalide/);
});

test('les bornes du mois sont des instants UTC, heure d’été comprise', () => {
  // Septembre : Paris est à UTC+2 (heure d'été).
  assert.equal(monthStartIso('2026-09'), '2026-08-31T22:00:00.000Z');
  // Janvier : Paris est à UTC+1.
  assert.equal(monthStartIso('2026-01'), '2025-12-31T23:00:00.000Z');
  // Le mois du changement d'heure reste d'un seul tenant.
  assert.deepEqual(monthRange('2026-10'), {
    start: '2026-09-30T22:00:00.000Z', end: '2026-10-31T23:00:00.000Z',
  });
  // Le libellé d'axe reste celui du mois demandé, pas du fuseau du serveur.
  assert.equal(monthShortLabel('2026-09'), 'sept.');
  assert.equal(monthShortLabel('2026-01'), 'janv.');
});

test('la navigation entre mois ne dérive pas au passage d’année', () => {
  assert.equal(shiftMonth('2026-09', 1), '2026-10');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-09', -12), '2025-09');
  assert.deepEqual(lastMonths('2026-02', 4), ['2025-11', '2025-12', '2026-01', '2026-02']);
  assert.deepEqual(lastMonths('2026-02', 1), ['2026-02']);
});

test('le paramètre ?mois= est validé et jamais projeté dans le futur', () => {
  const now = '2026-09-22T13:54:00Z';
  assert.equal(parseMonthParam('2026-07', now), '2026-07');
  assert.equal(parseMonthParam('2026-09', now), '2026-09');
  assert.equal(parseMonthParam('2026-10', now), '2026-09'); // futur refusé
  assert.equal(parseMonthParam(undefined, now), '2026-09');
  assert.equal(parseMonthParam('2026-13', now), '2026-09');
  assert.equal(parseMonthParam("2026-09'; drop table", now), '2026-09');
  assert.equal(parseMonthParam(['2026-08', '2026-07'], now), '2026-08');
  assert.equal(isMonthKey('2026-00'), false);
  assert.equal(isMonthKey('2026-9'), false);
});

test('la date d’effet retombe sur la création quand la clôture n’est pas horodatée', () => {
  assert.equal(requestDate({ completed_at: '2026-09-12T10:00:00Z', created_at: '2026-08-30T10:00:00Z' }), '2026-09-12T10:00:00Z');
  assert.equal(requestDate({ completed_at: null, created_at: '2026-08-30T10:00:00Z' }), '2026-08-30T10:00:00Z');
  assert.equal(quoteDate({ decided_at: null, sent_at: '2026-09-02T08:00:00Z', created_at: '2026-08-01T08:00:00Z' }), '2026-09-02T08:00:00Z');
  assert.equal(quoteDate({ decided_at: null, sent_at: null, created_at: '2026-08-01T08:00:00Z' }), '2026-08-01T08:00:00Z');
  assert.equal(shareDate({ status_changed_at: null, created_at: '2026-07-04T08:00:00Z' }), '2026-07-04T08:00:00Z');
});

test('seules les demandes terminées du mois entrent dans la période', () => {
  const requests = [
    request({ created_at: '2026-09-01T06:00:00Z' }),
    request({ status: 'en_cours', created_at: '2026-09-02T06:00:00Z' }),
    request({ created_at: '2026-08-15T06:00:00Z' }),
    // Créée en août, clôturée en septembre : elle compte en septembre.
    request({ created_at: '2026-08-28T06:00:00Z', completed_at: '2026-09-03T06:00:00Z' }),
    // Clôturée le 1er octobre heure de Paris malgré un horodatage UTC de septembre.
    request({ created_at: '2026-09-28T06:00:00Z', completed_at: '2026-09-30T22:30:00Z' }),
  ];
  assert.equal(completedOfMonth(requests, '2026-09').length, 2);
  assert.equal(completedOfMonth(requests, '2026-08').length, 1);
  assert.equal(completedOfMonth(requests, '2026-10').length, 1);
});

test('la commission suit le taux du catalogue de chaque immeuble', () => {
  const report = buildFinanceReport({
    month: '2026-09',
    buildings,
    services,
    requests: [
      request({ service: 'chauffeur', amount_cents: 10_000 }), // Marly 15 % -> 1500
      request({ service: 'pressing', amount_cents: 2_499 }),   // Marly 20 % -> 500
      request({ service: 'colis', amount_cents: 5_000 }),      // Marly 0 %  -> 0
      request({ building_id: segur, service: 'chauffeur', amount_cents: 20_000 }), // 10 % -> 2000
      // Service hors catalogue de l'immeuble : taux 0, jamais NaN.
      request({ building_id: segur, service: 'billetterie', amount_cents: 1_000 }),
      request({ status: 'nouveau', amount_cents: 99_999 }),
      // Montant non relevé : la ligne est comptée, le revenu reste nul.
      request({ building_id: segur, service: 'billetterie', amount_cents: null }),
    ],
  });
  assert.equal(report.revenueCents, 10_000 + 2_499 + 5_000 + 20_000 + 1_000);
  assert.equal(report.commissionCents, 1_500 + 500 + 0 + 2_000 + 0);
  assert.equal(report.payoutCents, report.revenueCents - report.commissionCents);
  assert.equal(report.completedRequests, 6);
  // La somme des lignes par service retombe sur le KPI de tête.
  assert.equal(report.services.reduce((s, l) => s + l.revenueCents, 0), report.revenueCents);
  assert.equal(report.services.reduce((s, l) => s + l.commissionCents, 0), report.commissionCents);
  const chauffeur = report.services.find(line => line.service === 'chauffeur');
  assert.equal(chauffeur.count, 2);
  assert.equal(chauffeur.revenueCents, 30_000);
  // Taux effectif moyen de deux immeubles à 15 % et 10 % sur 10 000 / 20 000.
  assert.ok(Math.abs(chauffeur.rate - 11.6667) < 0.001);
  // Un service sans demande terminée ne pollue pas le tableau.
  assert.equal(report.services.some(line => line.service === 'personal_shopper'), false);
});

test('affiliations et devis acceptés sont comptés sur leur mois d’effet', () => {
  const report = buildFinanceReport({
    month: '2026-09', buildings, services,
    requests: [],
    shares: [
      { building_id: marly, status: 'reservee', commission_cents: 4_000, status_changed_at: '2026-09-04T10:00:00Z', created_at: '2026-08-01T10:00:00Z' },
      { building_id: marly, status: 'reservee', commission_cents: 1_500, status_changed_at: null, created_at: '2026-09-06T10:00:00Z' },
      { building_id: marly, status: 'reservee', commission_cents: 9_900, status_changed_at: '2026-08-04T10:00:00Z', created_at: '2026-08-01T10:00:00Z' },
      { building_id: marly, status: 'consultee', commission_cents: null, status_changed_at: '2026-09-04T10:00:00Z', created_at: '2026-09-01T10:00:00Z' },
    ],
    quotes: [
      { building_id: marly, status: 'accepte', amount_cents: 120_000, decided_at: '2026-09-09T10:00:00Z', sent_at: '2026-09-08T10:00:00Z', created_at: '2026-09-07T10:00:00Z' },
      { building_id: marly, status: 'accepte', amount_cents: 30_000, decided_at: null, sent_at: null, created_at: '2026-09-11T10:00:00Z' },
      { building_id: marly, status: 'accepte', amount_cents: 80_000, decided_at: '2026-07-11T10:00:00Z', sent_at: null, created_at: '2026-07-10T10:00:00Z' },
      { building_id: marly, status: 'refuse', amount_cents: 50_000, decided_at: '2026-09-11T10:00:00Z', sent_at: null, created_at: '2026-09-10T10:00:00Z' },
    ],
  });
  assert.equal(report.affiliationCents, 5_500);
  assert.deepEqual(report.acceptedQuotes, { count: 2, amountCents: 150_000 });
});

test('la tendance couvre les six derniers mois, trous compris', () => {
  const report = buildFinanceReport({
    month: '2026-09', buildings, services,
    requests: [
      request({ created_at: '2026-09-02T06:00:00Z', amount_cents: 10_000 }),
      request({ created_at: '2026-07-02T06:00:00Z', amount_cents: 20_000 }),
      request({ created_at: '2026-01-02T06:00:00Z', amount_cents: 99_000 }), // hors fenêtre
    ],
  });
  assert.deepEqual(report.trend.map(point => point.month), ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
  assert.deepEqual(report.trend.map(point => point.revenueCents), [0, 0, 0, 20_000, 0, 10_000]);
  assert.deepEqual(report.trend.map(point => point.commissionCents), [0, 0, 0, 3_000, 0, 1_500]);
  assert.equal(buildFinanceReport({ month: '2026-09', services, requests: [], trendLength: 3 }).trend.length, 3);
});

test('le tableau par immeuble classe par revenus et compte les demandes ouvertes', () => {
  const report = buildFinanceReport({
    month: '2026-09', buildings, services,
    requests: [
      request({ amount_cents: 10_000 }),
      request({ building_id: segur, amount_cents: 20_000 }),
      request({ building_id: segur, status: 'nouveau', amount_cents: 7_000 }),
      request({ status: 'en_cours', amount_cents: 7_000 }),
      request({ status: 'en_attente', amount_cents: 7_000 }),
    ],
  });
  assert.deepEqual(report.buildings.map(line => line.name), ['Villa Ségur', 'Le Marly']);
  assert.deepEqual(report.buildings.map(line => line.openRequests), [1, 2]);
  // Les demandes ouvertes peuvent être lues à part : elles priment alors.
  const withOpen = buildFinanceReport({
    month: '2026-09', buildings, services, requests: [],
    openRequests: [{ building_id: marly }, { building_id: marly }, { building_id: segur }],
  });
  assert.deepEqual(withOpen.buildings.map(line => [line.name, line.openRequests]),
    [['Le Marly', 2], ['Villa Ségur', 1]]);
  assert.deepEqual(report.buildings.map(line => line.revenueCents), [20_000, 10_000]);
  assert.deepEqual(report.buildings.map(line => line.commissionCents), [2_000, 1_500]);
  assert.equal(report.buildings.reduce((s, l) => s + l.revenueCents, 0), report.revenueCents);
});

test('l’export CSV est lisible par Excel FR et ne cite aucun résident', () => {
  const lines = financeExportLines({
    month: '2026-09', buildings, services,
    requests: [
      request({ building_id: segur, amount_cents: 20_000, created_at: '2026-09-12T08:30:00Z' }),
      request({ amount_cents: 2_499, service: 'pressing', created_at: '2026-09-02T08:30:00Z' }),
      request({ status: 'en_cours', amount_cents: 9_999, created_at: '2026-09-03T08:30:00Z' }),
    ],
  });
  assert.deepEqual(lines.map(line => line.serviceLabel), ['Pressing', 'Chauffeur']);
  assert.deepEqual(lines.map(line => line.commissionCents), [500, 2_000]);

  const csv = financeCsv(lines);
  assert.ok(csv.startsWith('﻿'), 'BOM UTF-8 attendu');
  const rows = csv.slice(1).trimEnd().split('\r\n');
  assert.equal(rows[0], 'Immeuble;Date;Service;Montant (EUR);Taux de commission (%);Commission (EUR)');
  assert.equal(rows[1], 'Le Marly;02/09/2026 10:30;Pressing;24,99;20,00;5,00');
  assert.equal(rows[2], 'Villa Ségur;12/09/2026 10:30;Chauffeur;200,00;10,00;20,00');
  assert.equal(rows[3], 'Total;;;224,99;;25,00');
  assert.equal(rows.length, 4);

  // Un nom d'immeuble contenant le séparateur reste sur une seule colonne.
  const risky = financeCsv([{ ...lines[0], buildingName: 'Le "Marly"; 8e' }]);
  assert.ok(risky.includes('"Le ""Marly""; 8e";'));
});
