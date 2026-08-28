import type { ArchitectureId } from './data';

export interface AutoscalingPolicy {
  min: number;
  max: number;
  targetUtilPercent: number;
}

export interface TrafficSplits {
  regionPrimaryPercent: number;
  modelNewPercent: number;
}

const US_REGION_NODES = new Set(['cloud_run_us', 'app_us', 'cloud_sql_replica']);
const LLM_STABLE_PATH = new Set(['vertex_stable', 'memorystore']);

export function clampPercent(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function assignedTrafficShare(
  architectureId: ArchitectureId,
  nodeId: string,
  splits: TrafficSplits,
): number {
  if (architectureId === 'multi_region_saas') {
    if (nodeId === 'global_alb' || nodeId === 'memorystore') return 1;
    if (US_REGION_NODES.has(nodeId)) return (100 - splits.regionPrimaryPercent) / 100;
    return splits.regionPrimaryPercent / 100;
  }
  if (architectureId === 'llm_inference_serving') {
    if (nodeId === 'vertex_rc') return splits.modelNewPercent / 100;
    if (LLM_STABLE_PATH.has(nodeId)) return (100 - splits.modelNewPercent) / 100;
    if (nodeId === 'pubsub_overflow') return 0;
    return 1;
  }
  return 1;
}

export function desiredReplicas(
  demandRps: number,
  capacityPerReplica: number,
  policy: AutoscalingPolicy,
): number {
  const target = Math.min(90, Math.max(10, policy.targetUtilPercent)) / 100;
  const productive = Math.max(1, capacityPerReplica * target);
  const needed = Math.max(policy.min, Math.ceil(Math.max(0, demandRps) / productive));
  return Math.min(policy.max, needed);
}

export const LATENCY_ROUTING = {
  method: 'inverse_latency_weight' as const,
  shiftThresholdMs: 50,
  hysteresisMs: 25,
  unreachablePacketLossPercent: 100,
};

export interface LatencyPathScore {
  latencyMs: number;
  packetLossPercent: number;
  down: boolean;
  score: number;
}

export interface LatencyRoutingExplanation {
  enabled: boolean;
  method: typeof LATENCY_ROUTING.method;
  shiftThresholdMs: number;
  hysteresisMs: number;
  intended: TrafficSplits;
  effective: TrafficSplits;
  scores: {
    europe?: LatencyPathScore;
    us?: LatencyPathScore;
    stable?: LatencyPathScore;
    candidate?: LatencyPathScore;
  };
  shiftOccurred: boolean;
  noShiftReason: string | null;
  notes: string[];
}

function pathScore(latencyMs: number, packetLossPercent: number, down: boolean): LatencyPathScore {
  const unreachable = down || packetLossPercent >= LATENCY_ROUTING.unreachablePacketLossPercent;
  return {
    latencyMs,
    packetLossPercent,
    down: unreachable,
    score: unreachable ? 0 : 1 / Math.max(latencyMs, 1),
  };
}

export function latencyRouteShares(input: {
  primaryLatencyMs: number;
  secondaryLatencyMs: number;
  primaryDown: boolean;
  secondaryDown: boolean;
}): { primaryPercent: number; secondaryPercent: number } {
  const primaryWeight = input.primaryDown ? 0 : 1 / Math.max(input.primaryLatencyMs, 1);
  const secondaryWeight = input.secondaryDown ? 0 : 1 / Math.max(input.secondaryLatencyMs, 1);
  const total = primaryWeight + secondaryWeight;
  if (total <= 0) return { primaryPercent: 0, secondaryPercent: 0 };
  const primaryPercent = clampPercent((primaryWeight / total) * 100);
  return { primaryPercent, secondaryPercent: 100 - primaryPercent };
}

export function canaryShareWithLatencyGuard(input: {
  configuredNewPercent: number;
  stableLatencyMs: number;
  candidateLatencyMs: number;
  candidateDown: boolean;
}) {
  if (input.candidateDown) return 0;
  const configured = clampPercent(input.configuredNewPercent);
  const ratio = input.candidateLatencyMs / Math.max(input.stableLatencyMs, 1);
  if (ratio <= 1) return configured;
  return clampPercent(configured / ratio);
}

export function explainLatencyRouting(input: {
  architectureId: ArchitectureId;
  latencyBasedRouting: boolean;
  regionPrimaryPercent: number;
  modelNewPercent: number;
  europeDown: boolean;
  usDown: boolean;
  usExcluded: boolean;
  candidateDown: boolean;
  europeLatencyMs: number;
  usLatencyMs: number;
  europePacketLossPercent?: number;
  usPacketLossPercent?: number;
  stableLatencyMs: number;
  candidateLatencyMs: number;
  candidatePacketLossPercent?: number;
}): LatencyRoutingExplanation {
  const intended: TrafficSplits = {
    regionPrimaryPercent: clampPercent(input.regionPrimaryPercent),
    modelNewPercent: clampPercent(input.modelNewPercent),
  };
  const notes: string[] = [];
  if ((input.europePacketLossPercent ?? 0) > 0 || (input.usPacketLossPercent ?? 0) > 0 || (input.candidatePacketLossPercent ?? 0) > 0) {
    notes.push('packet_loss_does_not_change_latency_scores_until_unreachable');
  }

  if (!input.latencyBasedRouting) {
    return {
      enabled: false,
      method: LATENCY_ROUTING.method,
      shiftThresholdMs: LATENCY_ROUTING.shiftThresholdMs,
      hysteresisMs: LATENCY_ROUTING.hysteresisMs,
      intended,
      effective: intended,
      scores: {},
      shiftOccurred: false,
      noShiftReason: 'routing_disabled',
      notes,
    };
  }

  if (input.architectureId === 'multi_region_saas') {
    const europe = pathScore(input.europeLatencyMs, input.europePacketLossPercent ?? 0, input.europeDown);
    const us = pathScore(input.usLatencyMs, input.usPacketLossPercent ?? 0, input.usDown || input.usExcluded);
    const latencyDeltaMs = Math.abs(europe.latencyMs - us.latencyMs);
    const belowThreshold = !europe.down && !us.down && latencyDeltaMs < LATENCY_ROUTING.shiftThresholdMs;
    const routed = belowThreshold
      ? { primaryPercent: intended.regionPrimaryPercent, secondaryPercent: 100 - intended.regionPrimaryPercent }
      : latencyRouteShares({
        primaryLatencyMs: europe.latencyMs,
        secondaryLatencyMs: us.latencyMs,
        primaryDown: europe.down,
        secondaryDown: us.down,
      });
    const effective = { ...intended, regionPrimaryPercent: routed.primaryPercent };
    const shiftOccurred = effective.regionPrimaryPercent !== intended.regionPrimaryPercent;
    return {
      enabled: true,
      method: LATENCY_ROUTING.method,
      shiftThresholdMs: LATENCY_ROUTING.shiftThresholdMs,
      hysteresisMs: LATENCY_ROUTING.hysteresisMs,
      intended,
      effective,
      scores: { europe, us },
      shiftOccurred,
      noShiftReason: shiftOccurred ? null : belowThreshold ? 'latency_delta_below_threshold' : 'scores_keep_configured_split',
      notes,
    };
  }

  if (input.architectureId === 'llm_inference_serving') {
    const stable = pathScore(input.stableLatencyMs, 0, false);
    const candidate = pathScore(input.candidateLatencyMs, input.candidatePacketLossPercent ?? 0, input.candidateDown);
    const modelNewPercent = canaryShareWithLatencyGuard({
      configuredNewPercent: intended.modelNewPercent,
      stableLatencyMs: stable.latencyMs,
      candidateLatencyMs: candidate.latencyMs,
      candidateDown: candidate.down,
    });
    const effective = { ...intended, modelNewPercent };
    return {
      enabled: true,
      method: LATENCY_ROUTING.method,
      shiftThresholdMs: LATENCY_ROUTING.shiftThresholdMs,
      hysteresisMs: LATENCY_ROUTING.hysteresisMs,
      intended,
      effective,
      scores: { stable, candidate },
      shiftOccurred: effective.modelNewPercent !== intended.modelNewPercent,
      noShiftReason: effective.modelNewPercent === intended.modelNewPercent ? 'scores_keep_configured_split' : null,
      notes,
    };
  }

  return {
    enabled: true,
    method: LATENCY_ROUTING.method,
    shiftThresholdMs: LATENCY_ROUTING.shiftThresholdMs,
    hysteresisMs: LATENCY_ROUTING.hysteresisMs,
    intended,
    effective: intended,
    scores: {},
    shiftOccurred: false,
    noShiftReason: 'routing_not_applicable',
    notes,
  };
}

export function effectiveTrafficSplits(input: {
  architectureId: ArchitectureId;
  latencyBasedRouting: boolean;
  regionPrimaryPercent: number;
  modelNewPercent: number;
  europeDown: boolean;
  usDown: boolean;
  usExcluded: boolean;
  candidateDown: boolean;
  europeLatencyMs: number;
  usLatencyMs: number;
  europePacketLossPercent?: number;
  usPacketLossPercent?: number;
  stableLatencyMs: number;
  candidateLatencyMs: number;
  candidatePacketLossPercent?: number;
}): TrafficSplits {
  return explainLatencyRouting(input).effective;
}
