export interface RcaFault {
  targetId: string;
  targetName: string;
  targetType: 'component' | 'connection';
  latencyMs: number;
  dropoutPercent: number;
  regions?: string[];
}

export interface RcaConstraints {
  unavailableTargets?: string[];
  prohibitedActions?: string[];
}

export interface RcaNode {
  id: string;
  name: string;
  region: string;
  kind: string;
  capacityPerReplica: number;
  replicas: number;
  utilisation: number;
  overflowRps: number;
  legalRemediations: string[];
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
    sloStatus?: 'not_tested' | 'passing' | 'failing';
    breachReasons: string[];
  };
  constraints?: RcaConstraints;
  architectureId?: string;
  peakRps?: number;
  configuredPrimaryPercent?: number;
  nodes?: RcaNode[];
}

export type RecoveryKind = 'temporary_recovery' | 'resilience_improvement' | 'diagnostic';

export interface RecommendedAction {
  tool: string;
  arguments: Record<string, unknown>;
  reason: string;
  expectedEffect: string;
  prerequisites: string[];
  tradeOffs: string[];
  kind: RecoveryKind;
}

export interface RemediationPlanPayload {
  steps: Array<{ op: string; args: Record<string, string | number | boolean> }>;
  rationale: string;
}

export interface RootCauseAnalysis {
  status: 'healthy' | 'degraded' | 'failed';
  summary: string;
  primaryCause: { type: string; targetId: string; explanation: string; confidence: number } | null;
  contributingCauses: Array<{ type: string; targetId: string; explanation: string }>;
  causalChain: string[];
  evidence: string[];
  recommendedActions: RecommendedAction[];
  remediationPlan: RemediationPlanPayload | null;
  impact: RcaInput['impact'];
  tick: number;
  storeVersion: number;
}

type Cause = { type: string; targetId: string; explanation: string; score: number; tool: string; arguments: Record<string, string | number | boolean>; regions: string[] };

function recoveryFor(cause: Cause): RecommendedAction {
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
      tradeOffs: ['Restoring a zone does not change traffic split or autoscaling bounds.', 'Autoscaled services already place replacement replicas in surviving zones.'],
      kind: 'temporary_recovery',
    },
    component_failure: {
      expectedEffect: 'Mark the component failed→healthy and restore served throughput on its paths.',
      prerequisites: ['The component must have been failed with fail_component.', 'Use restore_component, not clear_fault_profile.'],
      tradeOffs: ['Does not clear injected latency/dropout on other targets.', 'Does not add replicas.'],
      kind: 'temporary_recovery',
    },
    component_fault: {
      expectedEffect: 'Remove injected latency and packet loss so the component is reachable again.',
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

function unavailableSet(constraints?: RcaConstraints) {
  return new Set((constraints?.unavailableTargets ?? []).map((item) => item.trim()).filter(Boolean));
}

function prohibitedSet(constraints?: RcaConstraints) {
  return new Set((constraints?.prohibitedActions ?? []).map((item) => item.trim()).filter(Boolean));
}

function targetBlocked(cause: Cause, unavailable: Set<string>) {
  if (unavailable.has(cause.targetId) || unavailable.has(cause.tool)) return true;
  return cause.regions.some((region) => unavailable.has(region));
}

function survivingRegion(unavailable: Set<string>, failedRegions: string[]) {
  const blocked = new Set([...unavailable, ...failedRegions]);
  if (blocked.has('europe-west2') && !unavailable.has('us-east4')) return 'us-east4';
  if (blocked.has('us-east4') && !unavailable.has('europe-west2')) return 'europe-west2';
  return undefined;
}

function scaleArgs(node: RcaNode, peakRps: number, storeVersion: number) {
  const needed = Math.max(node.replicas, Math.ceil(Math.max(peakRps, 1) / Math.max(node.capacityPerReplica * 0.7, 1)));
  const min = Math.min(32, Math.max(1, needed));
  return { id: node.id, min, max: Math.min(32, Math.max(min, needed + 2)), expectedVersion: storeVersion };
}

export function compoundRecoveryPlan(input: RcaInput): RemediationPlanPayload | null {
  const unavailable = unavailableSet(input.constraints);
  const prohibited = prohibitedSet(input.constraints);
  if (input.architectureId !== 'multi_region_saas') return null;
  const west2Blocked = unavailable.has('europe-west2') || input.failedRegions.includes('europe-west2');
  if (!west2Blocked) return null;
  const surviving = survivingRegion(unavailable, input.failedRegions);
  if (surviving !== 'us-east4') return null;
  if (prohibited.has('set_autoscaling') || prohibited.has('set_region_traffic_split') || prohibited.has('apply_remediation_plan')) return null;
  const nodes = (input.nodes ?? []).filter((node) => node.region === 'us-east4' && (node.kind === 'gateway' || node.kind === 'service') && node.legalRemediations.includes('set_autoscaling'));
  if (nodes.length === 0) return null;
  const peakRps = input.peakRps ?? 4200;
  const steps = [
    ...nodes.map((node) => ({ op: 'set_autoscaling', args: scaleArgs(node, peakRps, input.storeVersion) })),
    { op: 'set_region_traffic_split', args: { primaryPercent: 0, expectedVersion: input.storeVersion } },
  ];
  return {
    steps,
    rationale: 'West2 cannot be restored or cleared. Scale us-east4 ingress and application capacity, then shift traffic away from europe-west2 before the surviving path saturates.',
  };
}

export function analyseRootCause(input: RcaInput): RootCauseAnalysis {
  const unavailable = unavailableSet(input.constraints);
  const prohibited = prohibitedSet(input.constraints);
  const causes: Cause[] = [];
  const nodeRegion = new Map((input.nodes ?? []).map((node) => [node.id, node.region]));

  input.failedRegions.forEach((region) => causes.push({ type: 'region_failure', targetId: region, explanation: `${region} is unavailable, removing every workload replica placed in that region.`, score: 100, tool: 'restore_region', arguments: { region }, regions: [region] }));
  input.failedZones.forEach((zone) => causes.push({ type: 'zone_failure', targetId: zone, explanation: `${zone} is unavailable, reducing capacity for services with replicas in that zone.`, score: 90, tool: 'restore_zone', arguments: { zone }, regions: [zone.replace(/-[a-z]$/, '')] }));
  input.killedComponents.forEach((component) => causes.push({ type: 'component_failure', targetId: component.id, explanation: `${component.name} is explicitly failed via fail_component, which is an outage rather than packet loss.`, score: 95, tool: 'restore_component', arguments: { id: component.id }, regions: nodeRegion.get(component.id) ? [nodeRegion.get(component.id)!] : [] }));
  input.faults.forEach((fault) => {
    const severity = fault.dropoutPercent * 2 + Math.min(40, fault.latencyMs / 100);
    const unreachable = fault.dropoutPercent >= 100;
    causes.push({
      type: fault.targetType === 'connection' ? 'connection_fault' : 'component_fault',
      targetId: fault.targetId,
      explanation: unreachable
        ? `${fault.targetName} is unreachable from 100% injected packet loss; the component is not marked failed.`
        : `${fault.targetName} has +${fault.latencyMs} ms latency and ${fault.dropoutPercent}% packet loss injected.`,
      score: 50 + severity + (unreachable ? 15 : 0),
      tool: 'clear_fault_profile',
      arguments: { targetId: fault.targetId },
      regions: fault.regions ?? (nodeRegion.get(fault.targetId) ? [nodeRegion.get(fault.targetId)!] : []),
    });
  });
  input.overloadedComponents.forEach((component) => causes.push({
    type: 'capacity_pressure',
    targetId: component.id,
    explanation: `${component.name} is at ${Math.round(component.utilisation * 100)}% utilisation with ${Math.round(component.overflowRps)} req/s overflow.`,
    score: 55 + Math.min(35, component.utilisation * 20 + component.overflowRps),
    tool: 'set_autoscaling',
    arguments: { id: component.id },
    regions: nodeRegion.get(component.id) ? [nodeRegion.get(component.id)!] : [],
  }));

  const legalCauses = causes.filter((cause) => !prohibited.has(cause.tool) && !targetBlocked(cause, unavailable));
  legalCauses.sort((a, b) => b.score - a.score || a.targetId.localeCompare(b.targetId));
  const ranked = legalCauses.length ? legalCauses : [];
  const failed = input.stressActive && (input.impact.sloStatus === 'failing' || (!input.impact.sloPass && input.impact.sloStatus !== 'not_tested'));
  const status = failed ? 'failed' : causes.length ? 'degraded' : 'healthy';
  const summary = !causes[0]
    ? 'No active failure or fault evidence is present; no root cause identified.'
    : `${(ranked[0] ?? causes[0]).explanation}${failed ? ` Bench SLO is failing: ${input.impact.breachReasons.join('; ') || 'live service targets are breached'}.` : ' The bench is degraded; SLO evidence does not show a bench-level failure.'}`;

  const remediationPlan = compoundRecoveryPlan(input);
  const recommendedActions = ranked.map((cause) => recoveryFor(cause));
  if (remediationPlan && !prohibited.has('apply_remediation_plan')) {
    recommendedActions.unshift({
      tool: 'apply_remediation_plan',
      arguments: { expectedVersion: input.storeVersion, steps: remediationPlan.steps },
      reason: remediationPlan.rationale,
      expectedEffect: 'Scale the surviving region, then shift traffic in one atomic version bump so the remaining path is not overloaded.',
      prerequisites: ['Preview with preview_change using the returned remediationPlan.steps.', 'Use the current storeVersion as expectedVersion on every step.'],
      tradeOffs: ['Scaling raises the public list-price estimate.', 'Primary-region traffic goes to 0 until West2 is available again.'],
      kind: 'resilience_improvement',
    });
  }

  const evidencePrimary = [...causes].sort((a, b) => b.score - a.score || a.targetId.localeCompare(b.targetId))[0];

  return {
    status: causes.length === 0 ? 'healthy' : status,
    summary,
    primaryCause: (ranked[0] ?? (causes.length ? evidencePrimary : null))
      ? {
        type: (ranked[0] ?? evidencePrimary).type,
        targetId: (ranked[0] ?? evidencePrimary).targetId,
        explanation: (ranked[0] ?? evidencePrimary).explanation,
        confidence: Math.min(0.99, Number((0.7 + Math.min(25, (ranked[0] ?? evidencePrimary).score - ((ranked[1] ?? causes[1])?.score ?? 0)) / 100).toFixed(2))),
      }
      : null,
    contributingCauses: (ranked.length ? ranked.slice(1) : causes.slice(1)).map(({ type, targetId, explanation }) => ({ type, targetId, explanation })),
    causalChain: evidencePrimary ? [evidencePrimary.explanation, ...input.impact.breachReasons, `Observed impact: ${(input.impact.availability * 100).toFixed(2)}% availability, ${Math.round(input.impact.latencyMs)} ms latency, ${(input.impact.errorRate * 100).toFixed(2)}% errors.`] : [],
    evidence: [
      ...input.failedRegions.map((region) => `Failed region: ${region}`),
      ...input.failedZones.map((zone) => `Failed zone: ${zone}`),
      ...input.killedComponents.map((component) => `Failed component: ${component.id}`),
      ...input.faults.map((fault) => `Injected ${fault.targetType} fault: ${fault.targetId} (+${fault.latencyMs} ms, ${fault.dropoutPercent}% packet loss${fault.dropoutPercent >= 100 ? ', unreachable' : ''})`),
      ...input.overloadedComponents.map((component) => `Capacity pressure: ${component.id} at ${Math.round(component.utilisation * 100)}% utilisation, ${Math.round(component.overflowRps)} req/s overflow`),
    ],
    recommendedActions,
    remediationPlan,
    impact: input.impact,
    tick: input.tick,
    storeVersion: input.storeVersion,
  };
}
