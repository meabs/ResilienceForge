import assert from 'node:assert/strict';
import test from 'node:test';
import { rampValues, stopConditionMet } from './ramp-fault.ts';

test('ramp values include start, steps, and ceiling', () => {
  assert.deepEqual(rampValues(0, 5, 15), [0, 5, 10, 15]);
  assert.deepEqual(rampValues(10, 5, 12), [10, 12]);
});

test('stop condition compares numeric and sloStatus readings', () => {
  assert.equal(stopConditionMet(0.94, 'lt', 0.95), true);
  assert.equal(stopConditionMet(0.96, 'lt', 0.95), false);
  assert.equal(stopConditionMet('failing', 'eq', 'failing'), true);
});
