import assert from 'node:assert/strict';
import test from 'node:test';
import { formatFdrCopy, formatFdrLine, isRejectedCode, visibleFdrEntries } from './fdr.ts';

const ui = { ts: '00:00:01', source: 'ui', op: 'set_peak_rps', args: { peakRps: 15000 }, beforeVersion: 4, afterVersion: 5, resultCode: 'OK' };
const stale = { ts: '00:00:02', source: 'webmcp', op: 'set_batching', args: { expectedVersion: 4 }, beforeVersion: 5, afterVersion: 5, resultCode: 'STALE_STATE' };
const tick = { ts: '00:00:03', source: 'sim', op: 'tick', args: { tick: 12 }, beforeVersion: 5, afterVersion: 5, resultCode: 'OK' };

test('visible FDR drops sim ticks and keeps the last 30 operator events', () => {
  const filled = Array.from({ length: 40 }, (_, index) => ({ ...ui, op: `op_${index}` }));
  const visible = visibleFdrEntries([...filled, tick, stale]);
  assert.equal(visible.length, 30);
  assert.equal(visible[0].op, 'op_11');
  assert.equal(visible.at(-1)?.resultCode, 'STALE_STATE');
  assert.equal(visible.some((entry) => entry.op === 'tick'), false);
});

test('copy text matches the judge-readable FDR line format', () => {
  assert.equal(formatFdrLine(stale), '00:00:02 webmcp set_batching {"expectedVersion":4} v5>5 STALE_STATE');
  assert.match(formatFdrCopy([ui, stale]), /v4>5 OK\n.*STALE_STATE$/);
  assert.equal(isRejectedCode('STALE_STATE'), true);
  assert.equal(isRejectedCode('PINNED_KEEP_PUBSUB_ORDERING'), true);
  assert.equal(isRejectedCode('OK'), false);
});
