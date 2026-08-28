export const MAX_REMEDIATION_STEPS = 8;

export const NESTED_OR_READ_OPS = new Set([
  'apply_remediation_plan',
  'preview_change',
  'get_webmcp_status',
  'get_bench_guide',
  'get_architecture',
  'get_scenario',
  'get_live_metrics',
  'get_root_cause_analysis',
  'get_constraints',
  'get_bench_snapshot',
  'get_decision_log',
]);

export interface PlanStep {
  op: string;
  args: Record<string, unknown>;
}

export type PlanParseResult =
  | { ok: true; steps: PlanStep[] }
  | { ok: false; code: string; message: string };

export function parseRemediationSteps(raw: unknown): PlanParseResult {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, code: 'PLAN_EMPTY', message: 'apply_remediation_plan requires a non-empty steps array.' };
  }
  if (raw.length > MAX_REMEDIATION_STEPS) {
    return { ok: false, code: 'PLAN_TOO_LARGE', message: `A plan may contain at most ${MAX_REMEDIATION_STEPS} steps.` };
  }
  const steps: PlanStep[] = [];
  for (const [index, item] of raw.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, code: 'PLAN_INVALID_STEP', message: `Step ${index} must be an object with op and optional args.` };
    }
    const record = item as { op?: unknown; args?: unknown };
    if (typeof record.op !== 'string' || !record.op) {
      return { ok: false, code: 'PLAN_INVALID_STEP', message: `Step ${index} is missing op.` };
    }
    if (NESTED_OR_READ_OPS.has(record.op)) {
      return { ok: false, code: 'PLAN_NESTED', message: `${record.op} cannot run inside apply_remediation_plan.` };
    }
    if (record.args !== undefined && (typeof record.args !== 'object' || Array.isArray(record.args) || record.args === null)) {
      return { ok: false, code: 'PLAN_INVALID_STEP', message: `Step ${index} args must be an object.` };
    }
    steps.push({ op: record.op, args: (record.args as Record<string, unknown> | undefined) ?? {} });
  }
  return { ok: true, steps };
}

export function applyPlanSteps<TState, TResult extends { ok?: boolean; code?: string; message?: string }>(
  state: TState,
  steps: PlanStep[],
  apply: (state: TState, op: string, args: Record<string, unknown>) => { state: TState; result: TResult },
): { ok: true; state: TState; stepResults: TResult[] } | { ok: false; code: string; message: string; failedIndex: number; failedOp: string; result: TResult } {
  let working = state;
  const stepResults: TResult[] = [];
  for (const [index, step] of steps.entries()) {
    const outcome = apply(working, step.op, step.args);
    if (outcome.result.ok === false) {
      return {
        ok: false,
        code: String(outcome.result.code ?? 'PLAN_STEP_FAILED'),
        message: outcome.result.message ?? `Step ${index} (${step.op}) was rejected.`,
        failedIndex: index,
        failedOp: step.op,
        result: outcome.result,
      };
    }
    working = outcome.state;
    stepResults.push(outcome.result);
  }
  return { ok: true, state: working, stepResults };
}
