import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildingSeed,
  etaMinutesFromProgress,
  fleetAt,
  headingDegrees,
  LODGE,
  MockDriverPositionProvider,
  pathLength,
  phaseAt,
  pointAtDistance,
  remainingPath,
  simulatedLatencyMs,
  streetLabel,
} from '../lib/drivers/mock-provider.ts';
import { getDriverProvider, isDriverFeedLive } from '../lib/drivers/index.ts';

const BUILDING = '11111111-1111-1111-1111-111111111111';
const square = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
];

test('la longueur d’une polyligne est la somme de ses segments', () => {
  assert.equal(pathLength(square), 200);
  assert.equal(pathLength([{ x: 3, y: 4 }]), 0);
  assert.equal(pathLength([]), 0);
  assert.equal(pathLength([{ x: 0, y: 0 }, { x: 3, y: 4 }]), 5);
});

test('le cap se lit dans le repère écran : 0 = nord, 90 = est', () => {
  assert.equal(headingDegrees({ x: 0, y: 0 }, { x: 0, y: -10 }), 0);
  assert.equal(headingDegrees({ x: 0, y: 0 }, { x: 10, y: 0 }), 90);
  assert.equal(headingDegrees({ x: 0, y: 0 }, { x: 0, y: 10 }), 180);
  assert.equal(headingDegrees({ x: 0, y: 0 }, { x: -10, y: 0 }), 270);
});

test('l’interpolation suit la rue empruntée et ne dépasse pas le terminus', () => {
  assert.deepEqual(pointAtDistance(square, 0), { x: 0, y: 0, heading: 90 });
  assert.deepEqual(pointAtDistance(square, 50), { x: 50, y: 0, heading: 90 });
  assert.deepEqual(pointAtDistance(square, 100), { x: 100, y: 0, heading: 90 });
  assert.deepEqual(pointAtDistance(square, 150), { x: 100, y: 50, heading: 180 });
  // Bornage aux deux extrémités : jamais hors itinéraire.
  assert.deepEqual(pointAtDistance(square, 9_999), { x: 100, y: 100, heading: 180 });
  assert.deepEqual(pointAtDistance(square, -50), { x: 0, y: 0, heading: 90 });
});

test('l’itinéraire restant part de la position courante et finit au terminus', () => {
  const rest = remainingPath(square, 50);
  assert.deepEqual(rest[0], { x: 50, y: 0 });
  assert.deepEqual(rest[rest.length - 1], { x: 100, y: 100 });
  assert.equal(rest.length, 3);
  // Le point déjà dépassé disparaît du tracé.
  const late = remainingPath(square, 150);
  assert.deepEqual(late, [{ x: 100, y: 50 }, { x: 100, y: 100 }]);
  assert.ok(remainingPath(square, 200).length >= 2);
});

test('l’ETA décroît avec l’avancement sans jamais annoncer 0 min', () => {
  assert.equal(etaMinutesFromProgress(0, 42), 42);
  assert.equal(etaMinutesFromProgress(0.5, 42), 21);
  assert.equal(etaMinutesFromProgress(0.99, 42), 1);
  assert.equal(etaMinutesFromProgress(1, 42), 1);
  assert.equal(etaMinutesFromProgress(2, 42), 1);
});

test('le cycle alterne trajet et pause au terminus', () => {
  const legs = [
    { origin: 'A', destination: 'B', resident: null, path: square, travelMs: 10_000, etaMinutes: 10 },
    { origin: 'B', destination: 'A', resident: null, path: square, travelMs: 20_000, etaMinutes: 5 },
  ];
  assert.deepEqual(phaseAt(0, legs, 5_000), { legIndex: 0, progress: 0, moving: true, waitedMs: 0 });
  assert.deepEqual(phaseAt(5_000, legs, 5_000), { legIndex: 0, progress: 0.5, moving: true, waitedMs: 0 });
  assert.deepEqual(phaseAt(12_000, legs, 5_000), { legIndex: 0, progress: 1, moving: false, waitedMs: 2_000 });
  assert.equal(phaseAt(20_000, legs, 5_000).legIndex, 1);
  assert.equal(phaseAt(20_000, legs, 5_000).moving, true);
  // Le cycle boucle : 40 s = durée totale (10 + 5 + 20 + 5).
  assert.deepEqual(phaseAt(40_000, legs, 5_000), phaseAt(0, legs, 5_000));
  assert.deepEqual(phaseAt(-40_000, legs, 5_000), phaseAt(0, legs, 5_000));
  assert.equal(phaseAt(1_000, [], 5_000).moving, false);
});

test('la voie de l’immeuble se lit dans son adresse', () => {
  assert.equal(streetLabel('12 avenue Montaigne, 75008 Paris'), 'Avenue Montaigne');
  assert.equal(streetLabel('4 Avenue de Ségur, 75007 Paris'), 'Avenue de Ségur');
  assert.equal(streetLabel('22 rue Nansouty, 75014 Paris'), 'Rue Nansouty');
  assert.equal(streetLabel('3 boulevard Malesherbes, 75008 Paris'), 'Boulevard Malesherbes');
  assert.equal(streetLabel('Résidence sans voie'), null);
  assert.equal(streetLabel(null), null);
});

test('la flotte simulée est déterministe et propre à l’immeuble', () => {
  assert.deepEqual(fleetAt(BUILDING, 7_000), fleetAt(BUILDING, 7_000));
  assert.notEqual(buildingSeed(BUILDING), buildingSeed('22222222-2222-2222-2222-222222222222'));
  const here = fleetAt(BUILDING, 7_000);
  const elsewhere = fleetAt('22222222-2222-2222-2222-222222222222', 7_000);
  const moving = (snapshot) => snapshot.drivers.filter((d) => d.status === 'en_mouvement');
  assert.ok(moving(here).length > 0, 'au moins un chauffeur roule');
  assert.notDeepEqual(
    moving(here).map((d) => d.position),
    moving(elsewhere).map((d) => d.position),
  );
});

test('la flotte tient les statuts du PRD : loge, hors ligne, en course', () => {
  const { drivers } = fleetAt(BUILDING, 3_000);
  assert.equal(drivers.length, 4);
  assert.equal(drivers.filter((d) => d.status === 'hors_ligne').length, 1);
  assert.ok(drivers.some((d) => d.note?.startsWith('À la loge')));
  const offline = drivers.find((d) => d.status === 'hors_ligne');
  assert.equal(offline.trip, null);
  assert.equal(offline.route.length, 0);
  for (const driver of drivers) {
    assert.ok(driver.lastUpdate <= 3_000, 'aucun point GPS venu du futur');
    if (driver.status === 'en_mouvement') {
      assert.ok(driver.trip && driver.trip.etaMinutes >= 1);
      assert.ok(driver.route.length >= 2);
      assert.equal(driver.trip.etaAt, 3_000 + driver.trip.etaMinutes * 60_000);
    } else {
      assert.equal(driver.trip, null);
    }
  }
});

test('les chauffeurs en course avancent, le chauffeur hors ligne ne bouge pas', () => {
  const before = fleetAt(BUILDING, 4_000);
  const after = fleetAt(BUILDING, 7_000);
  const byId = (snapshot, id) => snapshot.drivers.find((d) => d.id === id);
  for (const driver of before.drivers.filter((d) => d.status === 'en_mouvement')) {
    const later = byId(after, driver.id);
    if (later.status !== 'en_mouvement') continue;
    assert.notDeepEqual(later.position, driver.position, `${driver.id} devrait avoir bougé`);
  }
  assert.deepEqual(byId(after, 'david').position, byId(before, 'david').position);
  assert.deepEqual(byId(after, 'sofiane').position, byId(before, 'sofiane').position);
  // Le chauffeur de permanence attend au pied de l'immeuble.
  assert.ok(Math.hypot(byId(after, 'sofiane').position.x - LODGE.x, byId(after, 'sofiane').position.y - LODGE.y) < 60);
});

test('la latence simulée reste sous la seconde exigée par le PRD', () => {
  for (let elapsed = 0; elapsed <= 120_000; elapsed += 1_000) {
    const latency = simulatedLatencyMs(elapsed, buildingSeed(BUILDING));
    assert.ok(latency > 0 && latency < 1_000, `latence hors cible : ${latency}`);
    assert.equal(fleetAt(BUILDING, elapsed).latencyMs, latency);
  }
});

test('l’abonnement pousse un état immédiatement puis se coupe proprement', async () => {
  const provider = new MockDriverPositionProvider(20);
  const seen = [];
  const stop = provider.subscribe(BUILDING, (snapshot) => seen.push(snapshot));
  assert.equal(seen.length, 1, 'premier point servi sans attendre le tick');
  await new Promise((resolve) => setTimeout(resolve, 70));
  assert.ok(seen.length >= 3, `flux trop lent : ${seen.length} points`);
  stop();
  const count = seen.length;
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(seen.length, count, 'le flux continue après désabonnement');
});

test('sans jeton Mapbox, la Live Map tourne sur le simulateur', () => {
  assert.equal(process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '', '');
  assert.equal(getDriverProvider().name, 'mock');
  assert.equal(isDriverFeedLive(), false);
  assert.equal(getDriverProvider().snapshot(BUILDING, 0).drivers.length, 4);
});
