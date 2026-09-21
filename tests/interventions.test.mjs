import test from 'node:test';
import assert from 'node:assert/strict';
import { interventionMetrics } from '../lib/interventions.ts';

test('indicateurs du jour : borne UTC, historiques sans horaire et incidents résolus', () => {
  const requests = [
    { id: '1', service: 'pressing', status: 'termine', started_at: '2026-09-17T08:00:00Z', completed_at: '2026-09-17T09:00:00Z' },
    { id: '2', service: 'pressing', status: 'termine', started_at: '2026-09-17T08:00:00Z', completed_at: '2026-09-17T10:00:00Z' },
    { id: '3', service: 'colis', status: 'termine', started_at: null, completed_at: null },
    { id: '4', service: 'colis', status: 'termine', started_at: '2026-09-16T20:00:00Z', completed_at: '2026-09-16T23:59:59Z' },
    { id: '5', service: 'colis', status: 'en_cours', started_at: '2026-09-17T09:00:00Z', completed_at: null },
  ];
  const incidents = [{ request_id: '1', resolved_at: '2026-09-17T08:45:00Z' }, { request_id: '5', resolved_at: null }];
  const metrics = interventionMetrics(requests, incidents, Date.parse('2026-09-17T12:00:00Z'));
  assert.equal(metrics.active, 1);
  assert.equal(metrics.closedToday, 2);
  assert.equal(metrics.firstPassPercent, 50);
  assert.equal(metrics.openIncidents, 1);
  assert.deepEqual(metrics.durations, { pressing: { totalMs: 10_800_000, count: 2 } });
  assert.equal(interventionMetrics([], [], Date.now()).firstPassPercent, null);
});
