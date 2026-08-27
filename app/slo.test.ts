import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateSlo, releaseEndpointReasons } from './slo.ts';

test('100% release traffic passes when three replicas serve 180 req/s below capacity', () => {
  const reasons = releaseEndpointReasons(0.75, 0);
  assert.deepEqual(reasons, []);
  assert.equal(evaluateSlo({
    stressActive: true,
    availability: 1,
    availabilityTarget: 0.998,
    latencyMs: 700,
    latencyTargetMs: 900,
    errorRate: 0,
    cost: 5435,
    budget: 15200,
    breachReasons: reasons,
  }), true);
});

test('release endpoint fails only when capacity telemetry reports saturation', () => {
  assert.deepEqual(releaseEndpointReasons(1, 0), ['RELEASE ENDPOINT SATURATED']);
  assert.deepEqual(releaseEndpointReasons(1.1, 20), ['VERTEX AI OVERFLOW']);
});
