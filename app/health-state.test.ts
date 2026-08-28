import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyEffectiveHealth, healthLabel, isOutage } from './health-state.ts';

test('100% dropout is unreachable rather than degraded or failed', () => {
  assert.equal(classifyEffectiveHealth({
    topologyHealth: 'healthy',
    dropoutPercent: 100,
    latencyMs: 0,
    utilisation: 0.2,
    stressActive: true,
  }), 'unreachable');
  assert.equal(healthLabel('unreachable'), 'UNREACH');
  assert.equal(isOutage('unreachable'), true);
  assert.equal(isOutage('failed'), true);
  assert.equal(isOutage('degraded'), false);
});

test('fail_component topology health stays failed even with dropout', () => {
  assert.equal(classifyEffectiveHealth({
    topologyHealth: 'failed',
    dropoutPercent: 100,
    latencyMs: 200,
    utilisation: 0,
    stressActive: true,
  }), 'failed');
});

test('replacing lost replicas recovers node health during an active stress run', () => {
  assert.equal(classifyEffectiveHealth({
    topologyHealth: 'degraded',
    dropoutPercent: 0,
    latencyMs: 0,
    utilisation: 0.9,
    stressActive: true,
  }), 'degraded');
  assert.equal(classifyEffectiveHealth({
    topologyHealth: 'healthy',
    dropoutPercent: 0,
    latencyMs: 0,
    utilisation: 0.15,
    stressActive: true,
  }), 'healthy');
});
