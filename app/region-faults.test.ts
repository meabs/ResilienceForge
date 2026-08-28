import assert from 'node:assert/strict';
import test from 'node:test';
import { getArchitecture } from './data.ts';
import { regionalBoundaryTargets, resolveRegion } from './region-faults.ts';

test('region aliases resolve West2 and east4 without guessing an edge id', () => {
  assert.equal(resolveRegion('West2'), 'europe-west2');
  assert.equal(resolveRegion('europe-west2'), 'europe-west2');
  assert.equal(resolveRegion('east4'), 'us-east4');
  assert.equal(resolveRegion('not-a-region'), undefined);
});

test('multi-region West2 maps to the ALB regional boundary', () => {
  const saas = getArchitecture('multi_region_saas');
  assert.ok(saas);
  assert.deepEqual(regionalBoundaryTargets(saas, 'europe-west2'), ['region-alb-europe']);
  assert.deepEqual(regionalBoundaryTargets(saas, 'us-east4'), ['region-alb-us']);
});
