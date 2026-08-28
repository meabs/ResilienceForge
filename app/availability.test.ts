import assert from 'node:assert/strict';
import test from 'node:test';
import { availableReplicaCount, replicaHealth } from './availability.ts';

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
