import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPlanSteps, parseRemediationSteps } from './bench-ops.ts';
import { pinRejection } from './pins.ts';

test('plan parser rejects empty, oversized, nested, and malformed steps', () => {
  assert.equal(parseRemediationSteps([]).ok, false);
  assert.equal(parseRemediationSteps(undefined).ok, false);
  assert.equal(parseRemediationSteps(Array.from({ length: 9 }, () => ({ op: 'set_peak_rps', args: {} }))).ok, false);
  assert.equal(parseRemediationSteps([{ op: 'apply_remediation_plan', args: {} }]).ok, false);
  assert.equal(parseRemediationSteps([{ op: 'get_bench_snapshot' }]).ok, false);
  assert.equal(parseRemediationSteps([{ op: 'get_decision_log' }]).ok, false);
  assert.equal(parseRemediationSteps([{ op: 'set_peak_rps', args: [] }]).ok, false);
});

test('plan parser accepts a compound remediation', () => {
  const parsed = parseRemediationSteps([
    { op: 'set_region_traffic_split', args: { primaryPercent: 100 } },
    { op: 'set_autoscaling', args: { id: 'app_europe', min: 2, max: 8 } },
  ]);
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.steps.length, 2);
});

test('applyPlanSteps is all-or-nothing', () => {
  const applied: string[] = [];
  const failed = applyPlanSteps(0, [{ op: 'ok', args: {} }, { op: 'fail', args: {} }], (state, op) => {
    applied.push(op);
    if (op === 'fail') return { state, result: { ok: false as const, code: 'PINNED_BUDGET', message: 'budget' } };
    return { state: state + 1, result: { ok: true as const } };
  });
  assert.equal(failed.ok, false);
  if (!failed.ok) {
    assert.equal(failed.failedIndex, 1);
    assert.equal(failed.code, 'PINNED_BUDGET');
  }
  assert.deepEqual(applied, ['ok', 'fail']);

  const passed = applyPlanSteps(10, [{ op: 'a', args: {} }, { op: 'b', args: {} }], (state) => ({
    state: state + 1,
    result: { ok: true as const },
  }));
  assert.equal(passed.ok, true);
  if (passed.ok) assert.equal(passed.state, 12);
});

test('apply_remediation_plan cannot bypass a pinned traffic split', () => {
  const parsed = parseRemediationSteps([
    { op: 'set_autoscaling', args: { id: 'app_us', min: 4, max: 8 } },
    { op: 'set_region_traffic_split', args: { primaryPercent: 0 } },
  ]);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const pins = ['no_second_region'] as const;
  const result = applyPlanSteps({}, parsed.steps, (state, op, args) => {
    const pinned = pinRejection([...pins], op, args);
    if (pinned) return { state, result: pinned };
    return { state, result: { ok: true as const } };
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.failedOp, 'set_region_traffic_split');
    assert.equal(result.code, 'PINNED_NO_SECOND_REGION');
  }
});
