export interface FaultProfile {
  latencyMs: number;
  dropoutPercent: number;
}

export interface WeightedFault extends FaultProfile {
  trafficShare: number;
}

export function normalizeFault(latencyMs: number, dropoutPercent: number): FaultProfile {
  return {
    latencyMs: Math.min(30_000, Math.max(0, Math.round(latencyMs))),
    dropoutPercent: Math.min(100, Math.max(0, Number(dropoutPercent.toFixed(2)))),
  };
}

export function aggregateFaultImpact(faults: WeightedFault[]) {
  return faults.reduce((impact, fault) => {
    const share = Math.min(1, Math.max(0, fault.trafficShare));
    const weightedDropout = fault.dropoutPercent / 100 * share;
    return {
      availabilityMultiplier: impact.availabilityMultiplier * (1 - weightedDropout),
      latencyMs: impact.latencyMs + fault.latencyMs * share,
    };
  }, { availabilityMultiplier: 1, latencyMs: 0 });
}
