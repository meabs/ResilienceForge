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

export interface RootCauseAnalysis {
  status: 'healthy' | 'degraded' | 'failed';
  summary: string;
  primaryCause: { type: string; targetId: string; explanation: string; confidence: number } | null;
  contributingCauses: Array<{ type: string; targetId: string; explanation: string }>;
  causalChain: string[];
  evidence: string[];
  recommendedActions: Array<{ tool: string; arguments: Record<string, string>; reason: string }>;
  impact: RcaInput['impact'];
  tick: number;
  storeVersion: number;
}

export function analyseRootCause(input: RcaInput): RootCauseAnalysis {
  const causes: Array<{ type: string; targetId: string; explanation: string; score: number; tool: string; arguments: Record<string, string> }> = [];

  input.failedRegions.forEach((region) => causes.push({ type: 'region_failure', targetId: region, explanation: `${region} is unavailable, removing every workload replica placed in that region.`, score: 100, tool: 'restore_region', arguments: { region } }));
  input.failedZones.forEach((zone) => causes.push({ type: 'zone_failure', targetId: zone, explanation: `${zone} is unavailable, reducing capacity for services with replicas in that zone.`, score: 90, tool: 'restore_zone', arguments: { zone } }));
  input.killedComponents.forEach((component) => causes.push({ type: 'component_failure', targetId: component.id, explanation: `${component.name} is explicitly down.`, score: 95, tool: 'restore_component', arguments: { id: component.id } }));
  input.faults.forEach((fault) => {
    const severity = fault.dropoutPercent * 2 + Math.min(40, fault.latencyMs / 100);
    causes.push({
      type: fault.targetType === 'connection' ? 'connection_fault' : 'component_fault',
      targetId: fault.targetId,
      explanation: `${fault.targetName} has +${fault.latencyMs} ms latency and ${fault.dropoutPercent}% request dropout injected.`,
      score: 50 + severity,
      tool: 'clear_fault_profile',
      arguments: { targetId: fault.targetId },
    });
  });
  input.overloadedComponents.forEach((component) => causes.push({
    type: 'capacity_pressure',
    targetId: component.id,
    explanation: `${component.name} is at ${Math.round(component.utilisation * 100)}% utilisation with ${Math.round(component.overflowRps)} req/s overflow.`,
    score: 55 + Math.min(35, component.utilisation * 20 + component.overflowRps),
    tool: 'get_architecture',
    arguments: {},
  }));

  causes.sort((a, b) => b.score - a.score || a.targetId.localeCompare(b.targetId));
  const primary = causes[0];
  const failed = input.stressActive && !input.impact.sloPass;
  const status = failed ? 'failed' : causes.length ? 'degraded' : 'healthy';
  const summary = !primary
    ? 'No active failure or fault evidence is present; no root cause identified.'
    : `${primary.explanation}${failed ? ` The current SLO is failing: ${input.impact.breachReasons.join('; ') || 'live service targets are breached'}.` : ' The bench is degraded but current SLO evidence does not show a failure.'}`;

  return {
    status,
    summary,
    primaryCause: primary ? { type: primary.type, targetId: primary.targetId, explanation: primary.explanation, confidence: Math.min(0.99, Number((0.7 + Math.min(25, primary.score - (causes[1]?.score ?? 0)) / 100).toFixed(2))) } : null,
    contributingCauses: causes.slice(1).map(({ type, targetId, explanation }) => ({ type, targetId, explanation })),
    causalChain: primary ? [primary.explanation, ...input.impact.breachReasons, `Observed impact: ${(input.impact.availability * 100).toFixed(2)}% availability, ${Math.round(input.impact.latencyMs)} ms latency, ${(input.impact.errorRate * 100).toFixed(2)}% errors.`] : [],
    evidence: [
      ...input.failedRegions.map((region) => `Failed region: ${region}`),
      ...input.failedZones.map((zone) => `Failed zone: ${zone}`),
      ...input.killedComponents.map((component) => `Down component: ${component.id}`),
      ...input.faults.map((fault) => `Injected ${fault.targetType} fault: ${fault.targetId} (+${fault.latencyMs} ms, ${fault.dropoutPercent}% drop)`),
      ...input.overloadedComponents.map((component) => `Capacity pressure: ${component.id} at ${Math.round(component.utilisation * 100)}% utilisation, ${Math.round(component.overflowRps)} req/s overflow`),
    ],
    recommendedActions: causes.map((cause) => ({ tool: cause.tool, arguments: cause.arguments, reason: `Remove or inspect ${cause.type.replaceAll('_', ' ')} evidence at ${cause.targetId}.` })),
    impact: input.impact,
    tick: input.tick,
    storeVersion: input.storeVersion,
  };
}
