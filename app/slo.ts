export interface SloInputs {
  stressActive: boolean;
  availability: number;
  availabilityTarget: number;
  latencyMs: number;
  latencyTargetMs: number;
  errorRate: number;
  cost: number;
  budget: number;
  breachReasons: string[];
}

export function releaseEndpointReasons(utilisation: number, overflowRps: number) {
  if (overflowRps > 0) return ['VERTEX AI OVERFLOW'];
  if (utilisation >= 1) return ['RELEASE ENDPOINT SATURATED'];
  return [];
}

export function evaluateSlo(input: SloInputs) {
  return input.stressActive
    && input.availability >= input.availabilityTarget
    && input.latencyMs <= input.latencyTargetMs
    && input.errorRate <= 1 - input.availabilityTarget
    && input.cost <= input.budget
    && input.breachReasons.length === 0;
}
