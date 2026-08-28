export interface RcaFault {
  targetId: string;
  targetName: string;
  targetType: 'component' | 'connection';
  latencyMs: number;
  dropoutPercent: number;
}

export interface RcaInput {
  tick: number;
  storeVersion: number;
  stressActive: boolean;
  failedZones: string[];
  failedRegions: string[];
  killedComponents: Array<{ id: string; name: string }>;
  faults: RcaFault[];
  overloadedComponents: Array<{ id: string; name: string; utilisation: number; overflowRps: number }>;
  impact: {
    availability: number;
    latencyMs: number;
    errorRate: number;
    achievedRps: number;
    sloPass: boolean;
    breachReasons: string[];
  };
}

export type RecoveryKind = 'temporary_recovery' | 'resilience_improvement' | 'diagnostic';

export interface RecommendedAction {
  tool: string;
  arguments: Record<string, string>;
  reason: string;
  expectedEffect: string;
  prerequisites: string[];
  tradeOffs: string[];
  kind: RecoveryKind;
}

export interface RootCauseAnalysis {
  status: 'healthy' | 'degraded' | 'failed';
  summary: string;
  primaryCause: { type: string; targetId: string; explanation: string; confidence: number } | null;
  contributingCauses: Array<{ type: string; targetId: string; explanation: string }>;
  causalChain: string[];
  evidence: string[];
  recommendedActions: RecommendedAction[];
  impact: RcaInput['impact'];
  tick: number;
  storeVersion: number;
}

function recoveryFor(cause: { type: string; targetId: string; tool: string; arguments: Record<string, string> }): RecommendedAction {
  const catalog: Record<string, Omit<RecommendedAction, 'tool' | 'arguments' | 'reason'>> = {
    region_failure: {
      expectedEffect: 'Restore regional replicas and resume serving the traffic still assigned to that region.',
      prerequisites: ['Confirm the human has not pinned no_second_region.', 'Re-read storeVersion before mutating.'],
      tradeOffs: ['Restored region may still be empty of demand until traffic is shifted back.', 'Does not by itself add capacity in the surviving region.'],
      kind: 'temporary_recovery',
    },
    zone_failure: {
      expectedEffect: 'Return the failed availability zone and its placed replicas to service.',
      prerequisites: ['Re-read live replica placement.', 'Use the current storeVersion.'],
      tradeOffs: ['Restoring a zone does not change traffic split or autoscaling bounds.'],
      kind: 'temporary_recovery',
    },
    component_failure: {
      expectedEffect: 'Mark the component failed→healthy and restore served throughput on its paths.',
      prerequisites: ['The component must have been failed with fail_component.', 'Use restore_component, not clear_fault_profile.'],
      tradeOffs: ['Does not clear injected latency/dropout on other targets.', 'Does not add replicas.'],
      kind: 'temporary_recovery',
    },
    component_fault: {
      expectedEffect: 'Remove injected latency and dropout so the component is reachable again.',
      prerequisites: ['This is packet-loss/latency injection, not an outage. Use fail_component for a hard down.'],
      tradeOffs: ['Clearing the fault does not change traffic split or replica count.'],
      kind: 'temporary_recovery',
    },
    connection_fault: {
      expectedEffect: 'Clear injected loss or delay on the connection so packets traverse that edge again.',
      prerequisites: ['Confirm the endpoints themselves are not failed.'],
      tradeOffs: ['Does not restore a failed endpoint behind the connection.'],
      kind: 'temporary_recovery',
    },
    capacity_pressure: {
      expectedEffect: 'Inspect live demand/capacity; typical follow-up is set_autoscaling or a safer traffic split.',
      prerequisites: ['Read get_bench_snapshot before mutating.', 'Respect budget_hard if pinned.'],
      tradeOffs: ['Scaling raises the public list-price estimate.', 'Shifting traffic may saturate the surviving path.'],
      kind: 'resilience_improvement',
    },
  };
  const meta = catalog[cause.type] ?? {
    expectedEffect: 'Inspect the named evidence before mutating.',
    prerequisites: ['Call get_bench_snapshot for a consistent tick.'],
    tradeOffs: [],
    kind: 'diagnostic' as const,
  };
  return {
    tool: cause.tool,
    arguments: cause.arguments,
    reason: `Remove or inspect ${cause.type.replaceAll('_', ' ')} evidence at ${cause.targetId}.`,
    ...meta,
  };
}

export function analyseRootCause(input: RcaInput): RootCauseAnalysis {
  const causes: Array<{ type: string; targetId: string; explanation: string; score: number; tool: string; arguments: Record<string, string> }> = [];

  input.failedRegions.forEach((region) => causes.push({ type: 'region_failure', targetId: region, explanation: `${region} is unavailable, removing every workload replica placed in that region.`, score: 100, tool: 'restore_region', arguments: { region } }));
  input.failedZones.forEach((zone) => causes.push({ type: 'zone_failure', targetId: zone, explanation: `${zone} is unavailable, reducing capacity for services with replicas in that zone.`, score: 90, tool: 'restore_zone', arguments: { zone } }));
  input.killedComponents.forEach((component) => causes.push({ type: 'component_failure', targetId: component.id, explanation: `${component.name} is explicitly failed via fail_component, which is an outage rather than packet loss.`, score: 95, tool: 'restore_component', arguments: { id: component.id } }));
  input.faults.forEach((fault) => {
    const severity = fault.dropoutPercent * 2 + Math.min(40, fault.latencyMs / 100);
    const unreachable = fault.dropoutPercent >= 100;
    causes.push({
      type: fault.targetType === 'connection' ? 'connection_fault' : 'component_fault',
      targetId: fault.targetId,
      explanation: unreachable
        ? `${fault.targetName} is unreachable from 100% injected dropout; the component is not marked failed.`
        : `${fault.targetName} has +${fault.latencyMs} ms latency and ${fault.dropoutPercent}% request dropout injected.`,
      score: 50 + severity + (unreachable ? 15 : 0),
      tool: 'clear_fault_profile',
      arguments: { targetId: fault.targetId },
    });
  });
  input.overloadedComponents.forEach((component) => causes.push({
    type: 'capacity_pressure',
    targetId: component.id,
    explanation: `${component.name} is at ${Math.round(component.utilisation * 100)}% utilisation with ${Math.round(component.overflowRps)} req/s overflow.`,
    score: 55 + Math.min(35, component.utilisation * 20 + component.overflowRps),
    tool: 'set_autoscaling',
    arguments: { id: component.id },
  }));

  causes.sort((a, b) => b.score - a.score || a.targetId.localeCompare(b.targetId));
  const primary = causes[0];
  const failed = input.stressActive && !input.impact.sloPass;
  const status = failed ? 'failed' : causes.length ? 'degraded' : 'healthy';
  const summary = !primary
    ? 'No active failure or fault evidence is present; no root cause identified.'
    : `${primary.explanation}${failed ? ` Bench SLO is failing: ${input.impact.breachReasons.join('; ') || 'live service targets are breached'}.` : ' The bench is degraded; SLO evidence does not show a bench-level failure.'}`;

  return {
    status,
    summary,
    primaryCause: primary ? { type: primary.type, targetId: primary.targetId, explanation: primary.explanation, confidence: Math.min(0.99, Number((0.7 + Math.min(25, primary.score - (causes[1]?.score ?? 0)) / 100).toFixed(2))) } : null,
    contributingCauses: causes.slice(1).map(({ type, targetId, explanation }) => ({ type, targetId, explanation })),
    causalChain: primary ? [primary.explanation, ...input.impact.breachReasons, `Observed impact: ${(input.impact.availability * 100).toFixed(2)}% availability, ${Math.round(input.impact.latencyMs)} ms latency, ${(input.impact.errorRate * 100).toFixed(2)}% errors.`] : [],
    evidence: [
      ...input.failedRegions.map((region) => `Failed region: ${region}`),
      ...input.failedZones.map((zone) => `Failed zone: ${zone}`),
      ...input.killedComponents.map((component) => `Failed component: ${component.id}`),
      ...input.faults.map((fault) => `Injected ${fault.targetType} fault: ${fault.targetId} (+${fault.latencyMs} ms, ${fault.dropoutPercent}% drop${fault.dropoutPercent >= 100 ? ', unreachable' : ''})`),
      ...input.overloadedComponents.map((component) => `Capacity pressure: ${component.id} at ${Math.round(component.utilisation * 100)}% utilisation, ${Math.round(component.overflowRps)} req/s overflow`),
    ],
    recommendedActions: causes.map((cause) => recoveryFor(cause)),
    impact: input.impact,
    tick: input.tick,
    storeVersion: input.storeVersion,
  };
}
