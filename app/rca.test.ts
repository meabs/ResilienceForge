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
  assert.ok(Number.isFinite(result.primaryCause?.confidence ?? NaN));
});

test('RCA skips prohibited recoveries and returns a combined surviving-region plan', () => {
  const result = analyseRootCause({
    ...healthy,
    architectureId: 'multi_region_saas',
    peakRps: 4200,
    storeVersion: 9,
    configuredPrimaryPercent: 50,
    failedRegions: [],
    faults: [{ targetId: 'region-alb-europe', targetName: 'ALB → europe-west2', targetType: 'connection', latencyMs: 0, dropoutPercent: 40, regions: ['europe-west2'] }],
    overloadedComponents: [{ id: 'app_us', name: 'Cloud Run app / us-east4', utilisation: 1.1, overflowRps: 80 }],
    constraints: { unavailableTargets: ['europe-west2'], prohibitedActions: ['clear_fault_profile'] },
    nodes: [
      { id: 'cloud_run_us', name: 'Cloud Run ingress / us-east4', region: 'us-east4', kind: 'gateway', capacityPerReplica: 2100, replicas: 2, utilisation: 0.9, overflowRps: 0, legalRemediations: ['set_autoscaling'] },
      { id: 'app_us', name: 'Cloud Run app / us-east4', region: 'us-east4', kind: 'service', capacityPerReplica: 1900, replicas: 2, utilisation: 1.1, overflowRps: 80, legalRemediations: ['set_autoscaling'] },
    ],
    impact: { ...healthy.impact, sloPass: false, sloStatus: 'failing', breachReasons: ['INJECTED DROPOUT'] },
  });
  assert.equal(result.recommendedActions.some((action) => action.tool === 'clear_fault_profile'), false);
  assert.equal(result.recommendedActions[0].tool, 'apply_remediation_plan');
  assert.ok(result.remediationPlan);
  assert.deepEqual(result.recommendedActions[0].arguments.steps, result.remediationPlan?.steps);
  assert.deepEqual(result.remediationPlan?.steps.map((step) => step.op), ['set_autoscaling', 'set_autoscaling', 'set_region_traffic_split']);
  assert.equal(result.remediationPlan?.steps.at(-1)?.args.primaryPercent, 0);
});
