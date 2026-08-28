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
  stableLatencyMs: number;
  candidateLatencyMs: number;
}): TrafficSplits {
  const configured: TrafficSplits = {
    regionPrimaryPercent: clampPercent(input.regionPrimaryPercent),
    modelNewPercent: clampPercent(input.modelNewPercent),
  };
  if (!input.latencyBasedRouting) return configured;

  if (input.architectureId === 'multi_region_saas') {
    const routed = latencyRouteShares({
      primaryLatencyMs: input.europeLatencyMs,
      secondaryLatencyMs: input.usLatencyMs,
      primaryDown: input.europeDown,
      secondaryDown: input.usDown || input.usExcluded,
    });
    return { ...configured, regionPrimaryPercent: routed.primaryPercent };
  }

  if (input.architectureId === 'llm_inference_serving') {
    return {
      ...configured,
      modelNewPercent: canaryShareWithLatencyGuard({
        configuredNewPercent: configured.modelNewPercent,
        stableLatencyMs: input.stableLatencyMs,
        candidateLatencyMs: input.candidateLatencyMs,
        candidateDown: input.candidateDown,
      }),
    };
  }

  return configured;
}
