import assert from 'node:assert/strict';
import test from 'node:test';
import { analyseRootCause, type RcaInput } from './rca.ts';

const healthy: RcaInput = {
  tick: 12, storeVersion: 4, stressActive: true, failedZones: [], failedRegions: [], killedComponents: [], faults: [], overloadedComponents: [],
  impact: { availability: 1, latencyMs: 700, errorRate: 0, achievedRps: 180, sloPass: true, breachReasons: [] },
};

test('RCA does not invent a cause for a healthy bench', () => {
  const result = analyseRootCause(healthy);
  assert.equal(result.status, 'healthy');
  assert.equal(result.primaryCause, null);
  assert.deepEqual(result.recommendedActions, []);
});

test('RCA ranks an explicit component failure above an injected latency fault', () => {
  const result = analyseRootCause({ ...healthy, impact: { ...healthy.impact, sloPass: false, breachReasons: ['AVAILABILITY BELOW TARGET'] }, killedComponents: [{ id: 'api', name: 'API Gateway' }], faults: [{ targetId: 'api_db', targetName: 'API to database', targetType: 'connection', latencyMs: 200, dropoutPercent: 0 }] });
  assert.equal(result.status, 'failed');
  assert.equal(result.primaryCause?.targetId, 'api');
  assert.equal(result.recommendedActions[0].tool, 'restore_component');
  assert.deepEqual(result.recommendedActions[0].arguments, { id: 'api' });
  assert.equal(result.recommendedActions[0].kind, 'temporary_recovery');
  assert.match(result.recommendedActions[0].expectedEffect, /outage|failed|restore/i);
});

test('100% dropout is unreachable packet loss, not a failed component', () => {
  const result = analyseRootCause({
    ...healthy,
    killedComponents: [],
    faults: [{ targetId: 'vertex_rc', targetName: 'Vertex RC', targetType: 'component', latencyMs: 0, dropoutPercent: 100 }],
  });
  assert.equal(result.primaryCause?.type, 'component_fault');
  assert.match(result.primaryCause?.explanation ?? '', /unreachable/);
  assert.equal(result.recommendedActions[0].tool, 'clear_fault_profile');
});
