import assert from 'node:assert/strict';
import test from 'node:test';
import { explainFaultContributions, measurementSemantics } from './measurement.ts';

test('traffic-weighted latency explains a 50/50 regional fault', () => {
  const [contribution] = explainFaultContributions([{ targetId: 'app_us', latencyMs: 200, dropoutPercent: 0, trafficShare: 0.5 }]);
  assert.equal(contribution.contributedLatencyMs, 100);
  assert.match(contribution.explanation, /50%/);
  assert.match(contribution.explanation, /\+100 ms/);
});

test('idle metrics are projected rather than rolling', () => {
  assert.equal(measurementSemantics(false).sample, 'projected');
  assert.equal(measurementSemantics(true).sample, 'instantaneous');
  assert.equal(measurementSemantics(true).latencyAggregation, 'traffic_weighted');
});
