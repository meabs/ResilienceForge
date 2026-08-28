export interface ScenarioDefaults {
  peakRps: number;
  budget: number;
  regionPrimaryPercent: number;
  modelNewPercent: number;
}

export interface OperationalScenario {
  running: boolean;
  stressActive: boolean;
  tick: number;
  peakRps: number;
  budget: number;
  regionPrimaryPercent: number;
  modelNewPercent: number;
  latencyBasedRouting: boolean;
  autoscaling: Record<string, unknown>;
  failedRegions: string[];
  failedZones: string[];
  killedNodes: string[];
  readReplicaAdded: boolean;
  replicaOverrides: Record<string, number>;
  batching: Record<string, unknown>;
  orderingKeyShards: number;
  pubsubBatch: number;
  faults: Record<string, unknown>;
}

export function withStressStopped<T extends { running: boolean; stressActive: boolean }>(state: T): T {
  return { ...state, running: false, stressActive: false };
}

export function withScenarioReset<T extends OperationalScenario>(
  state: T,
  defaults: ScenarioDefaults & { replicaOverrides: Record<string, number> },
): T {
  return {
    ...state,
    running: false,
    stressActive: false,
    tick: 0,
    peakRps: defaults.peakRps,
    budget: defaults.budget,
    regionPrimaryPercent: defaults.regionPrimaryPercent,
    modelNewPercent: defaults.modelNewPercent,
    latencyBasedRouting: false,
    autoscaling: {},
    failedRegions: [],
    failedZones: [],
    killedNodes: [],
    readReplicaAdded: false,
    replicaOverrides: { ...defaults.replicaOverrides },
    batching: {},
    orderingKeyShards: 1,
    pubsubBatch: 1,
    faults: {},
  };
}

export function benchShowsFailure(state: {
  failedZones: string[];
  failedRegions: string[];
  killedNodes: string[];
  faults: Record<string, unknown>;
  running?: boolean;
  stressActive: boolean;
  sloPass: boolean;
}) {
  return state.failedZones.length > 0
    || state.failedRegions.length > 0
    || state.killedNodes.length > 0
    || Object.keys(state.faults).length > 0
    || (state.stressActive && !state.sloPass);
}
