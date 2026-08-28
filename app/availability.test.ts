import assert from 'node:assert/strict';
import test from 'node:test';
import { availableReplicaCount, replicaHealth, replicaPlacements } from './availability.ts';

test('zonal failure removes only replicas placed in that availability zone', () => {
  const placements = ['europe-west2-a', 'europe-west2-b', 'europe-west2-a'];
  assert.equal(availableReplicaCount(placements, ['europe-west2-a']), 1);
  assert.equal(replicaHealth(3, 1), 'degraded');
});

test('service is failed only when no placed replica survives', () => {
  const placements = ['europe-west2-a', 'europe-west2-b'];
  assert.equal(availableReplicaCount(placements, ['europe-west2-a', 'europe-west2-b']), 0);
  assert.equal(replicaHealth(2, 0), 'failed');
});

test('manual replica spread keeps static zone placement when a zone fails', () => {
  const placements = replicaPlacements({
    replicaCount: 3,
    declaredZones: ['europe-west2-a', 'europe-west2-b', 'europe-west2-a'],
    regionZones: ['europe-west2-a', 'europe-west2-b'],
    failedZones: ['europe-west2-b'],
  });
  assert.deepEqual(placements, ['europe-west2-a', 'europe-west2-b', 'europe-west2-a']);
  assert.equal(availableReplicaCount(placements, ['europe-west2-b']), 2);
});

test('autoscaling places replacement replicas only in surviving zones', () => {
  const placements = replicaPlacements({
    replicaCount: 3,
    declaredZones: ['europe-west2-a', 'europe-west2-b', 'europe-west2-a'],
    regionZones: ['europe-west2-a', 'europe-west2-b'],
    failedZones: ['europe-west2-b'],
    zoneAware: true,
  });
  assert.deepEqual(placements, ['europe-west2-a', 'europe-west2-a', 'europe-west2-a']);
  assert.equal(availableReplicaCount(placements, ['europe-west2-b']), 3);
  assert.equal(replicaHealth(3, 3), 'healthy');
});

test('autoscaling cannot invent a zone when every declared zone is failed', () => {
  const placements = replicaPlacements({
    replicaCount: 3,
    declaredZones: ['europe-west2-a', 'europe-west2-b'],
    regionZones: ['europe-west2-a', 'europe-west2-b'],
    failedZones: ['europe-west2-a', 'europe-west2-b'],
    zoneAware: true,
  });
  assert.deepEqual(placements, ['europe-west2-a', 'europe-west2-b', 'europe-west2-a']);
  assert.equal(availableReplicaCount(placements, ['europe-west2-a', 'europe-west2-b']), 0);
});

test('autoscaled health recovers once live replicas meet the serving target', () => {
  assert.equal(replicaHealth(3, 2, 3), 'degraded');
  assert.equal(replicaHealth(3, 3, 3), 'healthy');
  assert.equal(replicaHealth(8, 4, 3), 'healthy');
});
