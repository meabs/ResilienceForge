import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateFaultImpact, normalizeFault, readFaultAmounts } from './faults.ts';

test('fault inputs are clamped to safe deterministic bounds', () => {
  assert.deepEqual(normalizeFault(45_000, -7), { latencyMs: 30_000, dropoutPercent: 0 });
  assert.deepEqual(normalizeFault(-1, 140), { latencyMs: 0, dropoutPercent: 100 });
});

test('dropout on one half of a regional split has weighted system impact', () => {
  const impact = aggregateFaultImpact([{ latencyMs: 200, dropoutPercent: 20, trafficShare: 0.5 }]);
  assert.equal(impact.availabilityMultiplier, 0.9);
  assert.equal(impact.latencyMs, 100);
});

test('faults on serial full-traffic components compound', () => {
  const impact = aggregateFaultImpact([
    { latencyMs: 100, dropoutPercent: 10, trafficShare: 1 },
    { latencyMs: 50, dropoutPercent: 5, trafficShare: 1 },
  ]);
  assert.equal(impact.availabilityMultiplier, 0.855);
  assert.equal(impact.latencyMs, 150);
});

test('packetLossPercent is the explicit unit alias for dropout', () => {
  assert.deepEqual(readFaultAmounts({ latencyMs: 200, packetLossPercent: 5 }), { latencyMs: 200, dropoutPercent: 5 });
  assert.deepEqual(readFaultAmounts({ latencyMs: 0, dropoutPercent: 8 }), { latencyMs: 0, dropoutPercent: 8 });
  assert.deepEqual(readFaultAmounts({ packetLossPercent: 5 }, { latencyMs: 200, dropoutPercent: 0 }), { latencyMs: 200, dropoutPercent: 5 });
});
