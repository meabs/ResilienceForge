import assert from 'node:assert/strict';
import test from 'node:test';
import { benchShowsFailure, withScenarioReset, withStressStopped } from './scenario-reset.ts';

const stressed = {
  running: true,
  stressActive: true,
  tick: 24,
  peakRps: 18000,
  budget: 8000,
  regionPrimaryPercent: 80,
  modelNewPercent: 80,
  latencyBasedRouting: true,
  autoscaling: { app_europe: { min: 1, max: 8 } },
  failedRegions: ['us-east4'],
  failedZones: ['europe-west2-a'],
  killedNodes: ['vertex_rc'],
  readReplicaAdded: true,
  replicaOverrides: { app_europe: 6 },
  batching: { vertex_rc: { maxBatch: 4 } },
  orderingKeyShards: 8,
  pubsubBatch: 4,
  faults: { vertex_rc: { latencyMs: 200, dropoutPercent: 0 } },
  sloPass: false,
  pins: ['budget_hard'],
};

test('stopping stress clears the overlay only when no outages remain', () => {
  const checkoutFailed = {
    failedZones: [] as string[],
    failedRegions: [] as string[],
    killedNodes: [] as string[],
    faults: {},
    running: true,
    stressActive: true,
    sloPass: false,
  };
  assert.equal(benchShowsFailure({ ...checkoutFailed, running: false }), true);
  const stopped = withStressStopped(checkoutFailed);
  assert.equal(stopped.running, false);
  assert.equal(stopped.stressActive, false);
  assert.equal(benchShowsFailure(stopped), false);
  assert.equal(benchShowsFailure({ ...withStressStopped(stressed), sloPass: false }), true);
});

test('scenario reset restores operational baseline without leftover failed UI state', () => {
  const reset = withScenarioReset(stressed, {
    peakRps: 10000,
    budget: 4200,
    regionPrimaryPercent: 50,
    modelNewPercent: 20,
    replicaOverrides: { app_europe: 2 },
  });
  assert.equal(reset.tick, 0);
  assert.equal(reset.running, false);
  assert.equal(reset.stressActive, false);
  assert.equal(reset.peakRps, 10000);
  assert.equal(reset.budget, 4200);
  assert.equal(reset.regionPrimaryPercent, 50);
  assert.equal(reset.modelNewPercent, 20);
  assert.equal(reset.latencyBasedRouting, false);
  assert.deepEqual(reset.autoscaling, {});
  assert.deepEqual(reset.failedRegions, []);
  assert.deepEqual(reset.failedZones, []);
  assert.deepEqual(reset.killedNodes, []);
  assert.deepEqual(reset.faults, {});
  assert.deepEqual(reset.replicaOverrides, { app_europe: 2 });
  assert.deepEqual(reset.pins, ['budget_hard']);
  assert.equal(benchShowsFailure({ ...reset, sloPass: false }), false);
});
