import assert from 'node:assert/strict';
import test from 'node:test';
import { isUnorderedPubSubAttempt, pinRejection } from './pins.ts';

test('unordered Pub/Sub attempts are detected from shards, flags, and mode', () => {
  assert.equal(isUnorderedPubSubAttempt({ orderingKeyShards: 0 }), true);
  assert.equal(isUnorderedPubSubAttempt({ unordered: true, orderingKeyShards: 8 }), true);
  assert.equal(isUnorderedPubSubAttempt({ ordered: false }), true);
  assert.equal(isUnorderedPubSubAttempt({ mode: 'unordered' }), true);
  assert.equal(isUnorderedPubSubAttempt({ orderingKeyShards: 8 }), false);
});

test('keep_pubsub_ordering rejects unordered replacement and allows ordered spreading', () => {
  const pinned = pinRejection(['keep_pubsub_ordering'], 'set_ordering_key_parallelism', { id: 'pubsub_ordered', orderingKeyShards: 0 });
  assert.equal(pinned?.code, 'PINNED_KEEP_PUBSUB_ORDERING');
  const spread = pinRejection(['keep_pubsub_ordering'], 'set_ordering_key_parallelism', { id: 'pubsub_ordered', orderingKeyShards: 8 });
  assert.equal(spread, null);
  const unpinned = pinRejection([], 'set_ordering_key_parallelism', { unordered: true });
  assert.equal(unpinned, null);
});

test('no_second_region does not block a same-region read replica', () => {
  assert.equal(pinRejection(['no_second_region'], 'add_read_replica', { id: 'cloud_sql' }), null);
});

test('existing region and model pins still reject illegal routing', () => {
  assert.equal(pinRejection(['no_second_region'], 'set_region_traffic_split', { primaryPercent: 60 })?.code, 'PINNED_NO_SECOND_REGION');
  assert.equal(pinRejection(['keep_old_model'], 'set_model_traffic_split', { newModelPercent: 100 })?.code, 'PINNED_KEEP_OLD_MODEL');
});
