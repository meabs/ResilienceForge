import assert from 'node:assert/strict';
import test from 'node:test';
import { classifySlo, evaluateSlo, releaseEndpointReasons } from './slo.ts';

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

test('SLO is three-state: idle is not_tested, not a failure', () => {
  const idle = {
    stressActive: false,
    availability: 1,
    availabilityTarget: 0.9995,
    latencyMs: 260,
    latencyTargetMs: 420,
    errorRate: 0,
    cost: 5000,
    budget: 11800,
    breachReasons: [] as string[],
  };
  assert.equal(evaluateSlo(idle), false);
  assert.equal(classifySlo(idle), 'not_tested');
  assert.equal(classifySlo({ ...idle, stressActive: true }), 'passing');
  assert.equal(classifySlo({ ...idle, stressActive: true, availability: 0.9, breachReasons: ['AVAILABILITY BELOW TARGET'] }), 'failing');
});
