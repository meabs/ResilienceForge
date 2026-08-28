import type { WeightedFault } from './faults';

export type MeasurementKind = 'instantaneous' | 'traffic_weighted' | 'projected' | 'rolling';

export interface MeasurementSemantics {
  clock: 'deterministic_sim';
  tickHz: 2;
  sample: MeasurementKind;
  latencyAggregation: MeasurementKind;
  availabilityAggregation: MeasurementKind;
  utilisation: 'instantaneous_demand_over_capacity';
  notes: string[];
}

export interface FaultContribution {
  targetId: string;
  latencyMs: number;
  dropoutPercent: number;
  trafficShare: number;
  contributedLatencyMs: number;
  contributedDropoutShare: number;
  explanation: string;
}

export function measurementSemantics(stressActive: boolean): MeasurementSemantics {
  return {
    clock: 'deterministic_sim',
    tickHz: 2,
    sample: stressActive ? 'instantaneous' : 'projected',
    latencyAggregation: 'traffic_weighted',
    availabilityAggregation: 'traffic_weighted',
    utilisation: 'instantaneous_demand_over_capacity',
    notes: [
      'Node demand, served throughput, and utilisation are instantaneous samples on the current simulation tick.',
      'System latency and availability apply injected faults in proportion to the traffic share of the affected path.',
      'When the bench is not under stress, flow values are the projected routing assignment at the configured peak load.',
      'There is no rolling window: each tick replaces the previous sample.',
    ],
  };
}

export function explainFaultContributions(faults: Array<WeightedFault & { targetId: string }>): FaultContribution[] {
  return faults.map((fault) => {
    const share = Math.min(1, Math.max(0, fault.trafficShare));
    const contributedLatencyMs = fault.latencyMs * share;
    const contributedDropoutShare = fault.dropoutPercent / 100 * share;
    const percent = Math.round(share * 100);
    return {
      targetId: fault.targetId,
      latencyMs: fault.latencyMs,
      dropoutPercent: fault.dropoutPercent,
      trafficShare: share,
      contributedLatencyMs,
      contributedDropoutShare,
      explanation: `+${fault.latencyMs} ms on a path carrying ${percent}% of traffic contributes +${contributedLatencyMs} ms to the traffic-weighted system latency model.`,
    };
  });
}
