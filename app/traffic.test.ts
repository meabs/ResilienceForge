import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assignedTrafficShare,
  canaryShareWithLatencyGuard,
  desiredReplicas,
  effectiveTrafficSplits,
  latencyRouteShares,
} from './traffic.ts';

test('LLM canary starts with 20% on the release candidate and 80% on stable', () => {
  const splits = { regionPrimaryPercent: 50, modelNewPercent: 20 };
  assert.equal(assignedTrafficShare('llm_inference_serving', 'clients', splits), 1);
  assert.equal(assignedTrafficShare('llm_inference_serving', 'api_gateway', splits), 1);
  assert.equal(assignedTrafficShare('llm_inference_serving', 'cloud_run_router', splits), 1);
  assert.equal(assignedTrafficShare('llm_inference_serving', 'vertex_stable', splits), 0.8);
  assert.equal(assignedTrafficShare('llm_inference_serving', 'vertex_rc', splits), 0.2);
  assert.equal(assignedTrafficShare('llm_inference_serving', 'memorystore', splits), 0.8);
  assert.equal(assignedTrafficShare('llm_inference_serving', 'pubsub_overflow', splits), 0);
});

test('multi-region ALB keeps full traffic while regions take the configured split', () => {
  const splits = { regionPrimaryPercent: 50, modelNewPercent: 20 };
  assert.equal(assignedTrafficShare('multi_region_saas', 'global_alb', splits), 1);
  assert.equal(assignedTrafficShare('multi_region_saas', 'app_europe', splits), 0.5);
  assert.equal(assignedTrafficShare('multi_region_saas', 'app_us', splits), 0.5);
  assert.equal(assignedTrafficShare('multi_region_saas', 'memorystore', splits), 1);
});

test('checkout nodes all carry the full request path', () => {
  const splits = { regionPrimaryPercent: 50, modelNewPercent: 20 };
  assert.equal(assignedTrafficShare('event_driven_checkout', 'api_gateway', splits), 1);
  assert.equal(assignedTrafficShare('event_driven_checkout', 'pubsub_ordered', splits), 1);
  assert.equal(assignedTrafficShare('event_driven_checkout', 'cloud_sql', splits), 1);
});

test('autoscaling follows demand within min and max bounds', () => {
  assert.equal(desiredReplicas(36, 80, { min: 1, max: 8, targetUtilPercent: 70 }), 1);
  assert.equal(desiredReplicas(180, 80, { min: 1, max: 8, targetUtilPercent: 70 }), 4);
  assert.equal(desiredReplicas(180, 80, { min: 3, max: 3, targetUtilPercent: 70 }), 3);
  assert.equal(desiredReplicas(0, 80, { min: 2, max: 8, targetUtilPercent: 70 }), 2);
});

test('latency-based regional routing shifts away from a slow or down region', () => {
  assert.deepEqual(
    latencyRouteShares({ primaryLatencyMs: 260, secondaryLatencyMs: 260, primaryDown: false, secondaryDown: false }),
    { primaryPercent: 50, secondaryPercent: 50 },
  );
  assert.deepEqual(
    latencyRouteShares({ primaryLatencyMs: 260, secondaryLatencyMs: 800, primaryDown: false, secondaryDown: false }),
    { primaryPercent: 75, secondaryPercent: 25 },
  );
  assert.deepEqual(
    latencyRouteShares({ primaryLatencyMs: 260, secondaryLatencyMs: 260, primaryDown: false, secondaryDown: true }),
    { primaryPercent: 100, secondaryPercent: 0 },
  );
});

test('LLM latency guard keeps a healthy canary and sheds a slow or down candidate', () => {
  assert.equal(canaryShareWithLatencyGuard({
    configuredNewPercent: 20,
    stableLatencyMs: 350,
    candidateLatencyMs: 350,
    candidateDown: false,
  }), 20);
  assert.equal(canaryShareWithLatencyGuard({
    configuredNewPercent: 20,
    stableLatencyMs: 350,
    candidateLatencyMs: 1400,
    candidateDown: false,
  }), 5);
  assert.equal(canaryShareWithLatencyGuard({
    configuredNewPercent: 20,
    stableLatencyMs: 350,
    candidateLatencyMs: 350,
    candidateDown: true,
  }), 0);
});

test('latency routing is inert until enabled', () => {
  const off = effectiveTrafficSplits({
    architectureId: 'llm_inference_serving',
    latencyBasedRouting: false,
    regionPrimaryPercent: 50,
    modelNewPercent: 20,
    europeDown: false,
    usDown: true,
    usExcluded: false,
    candidateDown: true,
    europeLatencyMs: 260,
    usLatencyMs: 900,
    stableLatencyMs: 350,
    candidateLatencyMs: 1500,
  });
  assert.equal(off.modelNewPercent, 20);
  const on = effectiveTrafficSplits({ ...off, architectureId: 'llm_inference_serving', latencyBasedRouting: true, regionPrimaryPercent: 50, europeDown: false, usDown: true, usExcluded: false, candidateDown: true, europeLatencyMs: 260, usLatencyMs: 900, stableLatencyMs: 350, candidateLatencyMs: 1500 });
  assert.equal(on.modelNewPercent, 0);
});
