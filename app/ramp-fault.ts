export const MAX_RAMP_STEPS = 24;

export type RampMetric = 'latencyMs' | 'packetLossPercent';
export type RampStopMetric = 'availability' | 'p95Ms' | 'errorRate' | 'sloStatus' | 'effectivePrimaryPercent';
export type RampCompare = 'lt' | 'lte' | 'gt' | 'gte' | 'eq';

export interface RampStopCondition {
  metric: RampStopMetric;
  op: RampCompare;
  value: number | string;
}

export function rampValues(start: number, step: number, ceiling: number) {
  const direction = step === 0 ? 1 : Math.sign(step);
  const values: number[] = [];
  let value = start;
  while (values.length < MAX_RAMP_STEPS) {
    values.push(Number(value.toFixed(2)));
    if (direction > 0 ? value >= ceiling : value <= ceiling) break;
    const next = value + (step === 0 ? 1 : step);
    if (direction > 0 ? next > ceiling + 1e-9 : next < ceiling - 1e-9) {
      if (values[values.length - 1] !== ceiling) values.push(Number(ceiling.toFixed(2)));
      break;
    }
    value = next;
  }
  return values;
}

export function stopConditionMet(reading: number | string | undefined, op: RampCompare, value: number | string) {
  if (reading === undefined) return false;
  if (typeof reading === 'string' || typeof value === 'string') {
    const left = String(reading);
    const right = String(value);
    if (op === 'eq') return left === right;
    if (op === 'lt') return left < right;
    if (op === 'lte') return left <= right;
    if (op === 'gt') return left > right;
    return left >= right;
  }
  if (op === 'eq') return reading === value;
  if (op === 'lt') return reading < value;
  if (op === 'lte') return reading <= value;
  if (op === 'gt') return reading > value;
  return reading >= value;
}
