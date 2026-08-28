import assert from 'node:assert/strict';
import test from 'node:test';
import { getArchitecture } from './data.ts';

test('known architecture ids resolve', () => {
  assert.equal(getArchitecture('event_driven_checkout')?.id, 'event_driven_checkout');
  assert.equal(getArchitecture('multi_region_saas')?.id, 'multi_region_saas');
  assert.equal(getArchitecture('llm_inference_serving')?.id, 'llm_inference_serving');
});

test('unknown architecture ids do not silently load checkout', () => {
  assert.equal(getArchitecture('does_not_exist'), undefined);
  assert.equal(getArchitecture(undefined), undefined);
});
