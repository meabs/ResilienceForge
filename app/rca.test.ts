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
  assert.deepEqual(result.recommendedActions[0], { tool: 'restore_component', arguments: { id: 'api' }, reason: 'Remove or inspect component failure evidence at api.' });
});
