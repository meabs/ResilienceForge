'use client';

/* Native anchors are intentional: the Sites Vinext runtime's Link prefetch path breaks internal navigation. */
/* eslint-disable @next/next/no-html-link-for-pages */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import {
  architectures,
  getArchitecture,
  type ArchitectureDefinition,
  type ArchitectureId,
  type EdgeDefinition,
  type Health,
  type NodeDefinition,
  type PinId,
  type Region,
  type ZoneId,
} from './data';
import { availableReplicaCount, replicaHealth } from './availability';
import { aggregateFaultImpact, normalizeFault, type FaultProfile } from './faults';
import { registerWebMcpTools, type ToolRegistration } from './webmcp';
import { evaluateSlo, releaseEndpointReasons } from './slo';
import { analyseRootCause, type RootCauseAnalysis } from './rca';
import { gcpTopologyFrame } from './gcp-layout';
import { gcpIconFor } from './gcp-icons';
import { connectionGeometry, connectionPath, type GraphPoint } from './topology-layout';

type Source = 'ui' | 'webmcp' | 'sim';

interface NodeMetric {
  demandRps: number;
  servedRps: number;
  baseServedRps: number;
  capacity: number;
  utilisation: number;
  queueDepth?: number;
  overflowRps?: number;
  ttftMs?: number;
  effectiveHealth: Health;
  provisionedReplicas: number;
  availableReplicas: number;
  replicaZones: ZoneId[];
  injectedLatencyMs: number;
  dropoutPercent: number;
  dropoutRps: number;
  capacityModel?: {
    concurrency: number;
    serviceTimeMs: number;
    schedulingEfficiency: number;
    batchGain: number;
    reserveRps: number;
  };
}

interface EdgeMetric {
  rps: number;
  droppedRps: number;
  health: Health;
  injectedLatencyMs: number;
  dropoutPercent: number;
}

interface SimResult {
  tick: number;
  availability: number;
  p95Ms: number;
  errorRate: number;
  rpsAchieved: number;
  costGbpMonth: number;
  sloPass: boolean;
  breachReasons: string[];
}

interface FdrEntry {
  ts: string;
  source: Source;
  op: string;
  args: Record<string, unknown>;
  beforeVersion: number;
  afterVersion: number;
  resultCode: string;
}

interface State {
  architectureId: ArchitectureId;
  version: number;
  tick: number;
  peakRps: number;
  budget: number;
  availabilityTarget: number;
  latencyTarget: number;
  pins: PinId[];
  running: boolean;
  stressActive: boolean;
  orderingKeyShards: number;
  pubsubBatch: number;
  regionPrimaryPercent: number;
  modelNewPercent: number;
  failedRegions: Region[];
  failedZones: ZoneId[];
  killedNodes: string[];
  readReplicaAdded: boolean;
  replicaOverrides: Record<string, number>;
  batching: Record<string, { maxBatch: number; waitMs: number }>;
  faults: Record<string, FaultProfile>;
  nodeMetrics: Record<string, NodeMetric>;
  edgeMetrics: Record<string, EdgeMetric>;
  sim: SimResult;
  log: FdrEntry[];
  lastMutation?: { source: Source; op: string; tick: number; targetId?: string };
}

interface DomainResult {
  ok: boolean;
  code: string;
  message?: string;
  currentVersion: number;
  [key: string]: unknown;
}

type CommandFn = (state: State) => { state: State; result: DomainResult };

const accentClass = {
  orange: 'accent-orange',
  cyan: 'accent-cyan',
  acid: 'accent-acid',
  violet: 'accent-violet',
} as const;

const sourceClass = {
  ui: 'source-ui',
  webmcp: 'source-webmcp',
  sim: 'source-sim',
} as const;

function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits }).format(value);
}

function formatPercent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

function compactArgs(args: Record<string, unknown>) {
  const text = JSON.stringify(args);
  return text === '{}' ? '{}' : text.length > 78 ? `${text.slice(0, 75)}...}` : text;
}

function simulationTime(tick: number) {
  const totalSeconds = Math.max(0, Math.round(tick * 0.5));
  const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function defaultReplicas(architecture: ArchitectureDefinition) {
  return Object.fromEntries(architecture.nodes.map((node) => [node.id, node.replicas]));
}

type SavedControls = Pick<State, 'peakRps' | 'budget' | 'regionPrimaryPercent' | 'modelNewPercent' | 'pins'>;

function loadSavedControls(architectureId: string): Partial<SavedControls> | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`resilience-forge:controls:${architectureId}`);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<SavedControls>;
    if (saved.pins) {
      saved.pins = saved.pins.map((pin) => pin === ('keep_fifo_ordering' as PinId) ? 'keep_pubsub_ordering' : pin);
    }
    return saved;
  } catch {
    return null;
  }
}

function createInitialState(architecture: ArchitectureDefinition, saved?: Partial<SavedControls> | null): State {
  const state = {
    architectureId: architecture.id,
    version: 1,
    tick: 0,
    peakRps: saved?.peakRps ?? architecture.defaultPeakRps,
    budget: saved?.budget ?? architecture.defaultBudget,
    availabilityTarget: architecture.defaultAvailabilityTarget,
    latencyTarget: architecture.defaultLatencyTarget,
    pins: saved?.pins ?? [],
    running: false,
    stressActive: false,
    orderingKeyShards: 1,
    pubsubBatch: 1,
    regionPrimaryPercent: saved?.regionPrimaryPercent ?? 50,
    modelNewPercent: saved?.modelNewPercent ?? (architecture.id === 'llm_inference_serving' ? 100 : 20),
    failedRegions: [],
    failedZones: [],
    killedNodes: [],
    readReplicaAdded: false,
    replicaOverrides: defaultReplicas(architecture),
    batching: {},
    faults: {},
    nodeMetrics: {},
    edgeMetrics: {},
    sim: {
      tick: 0,
      availability: 1,
      p95Ms: 0,
      errorRate: 0,
      rpsAchieved: 0,
      costGbpMonth: 0,
      sloPass: false,
      breachReasons: ['SLO NOT TESTED'],
    },
    log: [
      {
        ts: '00:00:00',
        source: 'ui',
        op: 'load_architecture',
        args: { id: architecture.id },
        beforeVersion: 0,
        afterVersion: 1,
        resultCode: 'OK',
      },
    ],
  } satisfies State;
  return applyMetrics(state, architecture);
}

function replicasFor(state: State, node: NodeDefinition) {
  return state.replicaOverrides[node.id] ?? node.replicas;
}

function zonesForRegion(region: Region): ZoneId[] {
  return region === 'europe-west2' ? ['europe-west2-a', 'europe-west2-b'] : ['us-east4-a', 'us-east4-b'];
}

function zonesForArchitecture(architecture: ArchitectureDefinition) {
  return Array.from(new Set(architecture.nodes.flatMap((node) => node.replicaZones ?? [])));
}

function gcpResourceProfile(architecture: ArchitectureDefinition, node: NodeDefinition) {
  const product = node.kind === 'client' ? 'External clients'
    : node.kind === 'edge' ? 'Cloud Load Balancing + Cloud Armor'
      : node.kind === 'gateway' ? architecture.id === 'multi_region_saas' ? 'Cloud Run ingress + serverless NEG' : 'API Gateway'
        : node.kind === 'service' ? 'Cloud Run'
          : node.kind === 'queue' ? 'Pub/Sub'
            : node.kind === 'db' ? 'Cloud SQL for PostgreSQL'
              : node.kind === 'cache' ? 'Memorystore for Redis'
                : 'Vertex AI Endpoint';
  const scope = node.kind === 'edge' || node.kind === 'client' ? 'global'
    : node.replicaZones?.length ? `${node.region} / ${new Set(node.replicaZones).size}-zone`
      : `${node.region} / managed regional`;
  const plane = node.kind === 'client' || node.kind === 'edge' || node.kind === 'gateway' ? 'edge / ingress'
    : node.kind === 'service' || node.kind === 'gpu' ? 'compute / serving'
      : node.kind === 'queue' ? 'messaging / delivery'
        : 'state / data';
  return { product, scope, plane };
}

function replicaPlacementsFor(state: State, node: NodeDefinition) {
  const replicas = replicasFor(state, node);
  if (!node.replicaZones?.length) return [];
  if (replicas <= node.replicaZones.length) return node.replicaZones.slice(0, replicas);
  const spread = zonesForRegion(node.region);
  return Array.from({ length: replicas }, (_, index) => node.replicaZones?.[index] ?? spread[index % spread.length]);
}

function activeReplicasFor(state: State, node: NodeDefinition) {
  const replicas = replicasFor(state, node);
  const placements = replicaPlacementsFor(state, node);
  return placements.length ? availableReplicaCount(placements, state.failedZones) : replicas;
}

function nodeHealth(state: State, node: NodeDefinition): Health {
  if (state.killedNodes.includes(node.id)) return 'down';
  if (state.failedRegions.includes(node.region)) return 'down';
  const provisioned = replicasFor(state, node);
  const available = activeReplicasFor(state, node);
  return replicaHealth(provisioned, available);
}

function inferenceCapacity(node: NodeDefinition, replicas: number, batch: number) {
  const profile = node.capacityModel;
  const batchGain = 1 + Math.min(batch - 1, 9) * 0.08;
  if (!profile) return { capacity: replicas * node.capacityPerReplica * batchGain, batchGain };
  const perReplica = profile.concurrency * (1000 / profile.serviceTimeMs) * profile.schedulingEfficiency;
  return { capacity: replicas * perReplica * batchGain, batchGain };
}

function addEdgeMetrics(
  state: State,
  architecture: ArchitectureDefinition,
  nodeMetrics: Record<string, NodeMetric>,
) {
  const edgeMetrics: Record<string, EdgeMetric> = {};
  for (const edge of architecture.edges) {
    const from = nodeMetrics[edge.from];
    const to = nodeMetrics[edge.to];
    const fault = state.faults[edge.id] ?? { latencyMs: 0, dropoutPercent: 0 };
    const baseRps = Math.min(from?.servedRps ?? 0, to?.demandRps ?? 0);
    const faultDroppedRps = baseRps * fault.dropoutPercent / 100;
    const rps = Math.max(0, baseRps - faultDroppedRps);
    const droppedRps = Math.max(0, (to?.demandRps ?? 0) - (to?.servedRps ?? 0)) + faultDroppedRps;
    const health: Health =
      from?.effectiveHealth === 'down' || to?.effectiveHealth === 'down'
        ? 'down'
        : fault.latencyMs > 0 || fault.dropoutPercent > 0 || state.stressActive && (droppedRps > 0 || (to?.utilisation ?? 0) > 0.9)
          ? 'degraded'
          : 'healthy';
    edgeMetrics[edge.id] = { rps, droppedRps, health, injectedLatencyMs: fault.latencyMs, dropoutPercent: fault.dropoutPercent };
  }
  return edgeMetrics;
}

function applyMetrics(state: State, architecture: ArchitectureDefinition): State {
  const nodeMetrics: Record<string, NodeMetric> = {};
  let availability = 1;
  let p95Ms = 260;
  let rpsAchieved = state.peakRps;
  let errorRate = 0;
  let cost = 4200 + Object.values(state.replicaOverrides).reduce((sum, value) => sum + value * 95, 0);
  const breachReasons: string[] = [];

  for (const node of architecture.nodes) {
    const health = nodeHealth(state, node);
    const provisionedReplicas = replicasFor(state, node);
    const replicas = activeReplicasFor(state, node);
    const replicaZones = replicaPlacementsFor(state, node);
    let capacity = replicas * node.capacityPerReplica;
    let demand = state.peakRps;
    let served = state.peakRps;
    let queueDepth = 0;
    let overflowRps = 0;
    let ttftMs: number | undefined;
    const fault = state.faults[node.id] ?? { latencyMs: 0, dropoutPercent: 0 };

    if (architecture.id === 'event_driven_checkout' && node.id === 'pubsub_ordered') {
      capacity = Math.min(300 * state.orderingKeyShards * state.pubsubBatch, 45000);
      if (state.stressActive) {
        served = Math.min(demand, capacity);
        overflowRps = Math.max(0, demand - served);
        queueDepth = Math.round(overflowRps * (state.tick + 1) * 0.45);
        if (overflowRps > 0) {
          breachReasons.push('PUB/SUB CAPACITY');
          p95Ms = Math.max(p95Ms, Math.round(220 + (overflowRps / Math.max(demand, 1)) * 1100));
        }
      }
      cost += state.orderingKeyShards > 1 ? 650 : 0;
    }

    if (architecture.id === 'event_driven_checkout' && node.id === 'cloud_sql' && health === 'down') {
      if (state.readReplicaAdded) {
        capacity = 8000;
      } else if (state.stressActive) {
        served = Math.min(served, state.peakRps * 0.18);
        breachReasons.push('PRIMARY DB DOWN');
      }
    }

    if (architecture.id === 'multi_region_saas') {
      const isPrimary = node.region === 'europe-west2';
      const assignedShare = isPrimary ? state.regionPrimaryPercent / 100 : 1 - state.regionPrimaryPercent / 100;
      demand = state.peakRps * assignedShare;
      if (state.stressActive || state.failedRegions.length > 0) {
        if (health === 'down' || state.pins.includes('no_second_region') && !isPrimary) {
          served = 0;
        } else {
          served = Math.min(demand, capacity);
        }
        overflowRps = Math.max(0, demand - served);
        if (overflowRps > 0) breachReasons.push(isPrimary ? 'PRIMARY CAPACITY' : 'REGION TRAFFIC LOST');
      }
      if (health === 'down') served = 0;
    }

    if (architecture.id === 'llm_inference_serving' && (node.id === 'vertex_stable' || node.id === 'vertex_rc')) {
      const isNew = node.id === 'vertex_rc';
      const share = isNew ? state.modelNewPercent / 100 : 1 - state.modelNewPercent / 100;
      demand = state.peakRps * share;
      const batch = state.batching[node.id]?.maxBatch ?? 1;
      const inference = inferenceCapacity(node, replicas, batch);
      capacity = inference.capacity;
      if (state.stressActive) {
        served = Math.min(demand, capacity);
        overflowRps = Math.max(0, demand - served);
        const utilisation = demand / Math.max(capacity, 1);
        ttftMs = utilisation < 0.7 ? 350 : utilisation <= 0.9 ? 700 : utilisation <= 1 ? 1500 : 3000;
        if (state.batching[node.id]) ttftMs += state.batching[node.id].waitMs;
        if (isNew) breachReasons.push(...releaseEndpointReasons(utilisation, overflowRps));
        p95Ms = Math.max(p95Ms, ttftMs);
      } else {
        ttftMs = 350;
      }
    }

    if (health === 'down') served = 0;
    const baseServedRps = served;
    const dropoutRps = baseServedRps * fault.dropoutPercent / 100;
    served = Math.max(0, baseServedRps - dropoutRps);
    const activeDemand = state.stressActive ? demand : 0;
    const activeServed = state.stressActive ? served : 0;
    const utilisation = activeDemand > 0 ? Math.min(1.5, activeDemand / Math.max(capacity, 1)) : 0;
    const effectiveHealth: Health =
      health === 'down' ? 'down' : health === 'degraded' || fault.latencyMs > 0 || fault.dropoutPercent > 0 || state.stressActive && utilisation > 0.9 ? 'degraded' : 'healthy';

    nodeMetrics[node.id] = {
      demandRps: activeDemand,
      servedRps: activeServed,
      baseServedRps: state.stressActive ? baseServedRps : 0,
      capacity,
      utilisation,
      queueDepth: queueDepth || undefined,
      overflowRps: overflowRps || undefined,
      ttftMs,
      effectiveHealth,
      provisionedReplicas,
      availableReplicas: health === 'down' ? 0 : replicas,
      replicaZones,
      injectedLatencyMs: fault.latencyMs,
      dropoutPercent: fault.dropoutPercent,
      dropoutRps: state.stressActive ? dropoutRps : 0,
      capacityModel: node.capacityModel ? {
        concurrency: node.capacityModel.concurrency,
        serviceTimeMs: node.capacityModel.serviceTimeMs,
        schedulingEfficiency: node.capacityModel.schedulingEfficiency,
        batchGain: architecture.id === 'llm_inference_serving' ? inferenceCapacity(node, replicas, state.batching[node.id]?.maxBatch ?? 1).batchGain : 1,
        reserveRps: capacity * node.capacityModel.reservePercent / 100,
      } : undefined,
    };
  }

  if (architecture.id === 'event_driven_checkout') {
    const queue = nodeMetrics.pubsub_ordered;
    const db = nodeMetrics.cloud_sql;
    rpsAchieved = Math.min(queue?.baseServedRps ?? state.peakRps, db?.baseServedRps ?? state.peakRps);
    if (state.stressActive && queue?.overflowRps) {
      availability = rpsAchieved / Math.max(state.peakRps, 1);
      errorRate = 1 - availability;
    }
    if (db?.effectiveHealth === 'down' && !state.readReplicaAdded) {
      availability = Math.min(availability, 0.18);
      errorRate = 1 - availability;
    }
  } else if (architecture.id === 'multi_region_saas') {
    const regionA = nodeMetrics.app_europe;
    const regionB = nodeMetrics.app_us;
    rpsAchieved = (regionA?.baseServedRps ?? 0) + (regionB?.baseServedRps ?? 0);
    if (state.stressActive || state.failedRegions.length > 0) {
      availability = rpsAchieved / Math.max(state.peakRps, 1);
      errorRate = 1 - availability;
      const maxUtil = Math.max(regionA?.utilisation ?? 0, regionB?.utilisation ?? 0);
      p95Ms = maxUtil > 1 ? 860 : maxUtil > 0.9 ? 560 : 260;
    }
  } else {
    const oldPool = nodeMetrics.vertex_stable;
    const newPool = nodeMetrics.vertex_rc;
    rpsAchieved = (oldPool?.baseServedRps ?? 0) + (newPool?.baseServedRps ?? 0);
    if (state.stressActive) {
      availability = rpsAchieved / Math.max(state.peakRps, 1);
      errorRate = 1 - availability;
      p95Ms = Math.max(oldPool?.ttftMs ?? 350, newPool?.ttftMs ?? 350);
    }
    cost += (state.batching.vertex_rc?.maxBatch ?? 1) > 1 ? 560 : 0;
  }

  if (state.failedRegions.length > 0 && architecture.id === 'multi_region_saas') {
    breachReasons.push('REGION FAILURE');
  }
  const edgeMetrics = addEdgeMetrics(state, architecture, nodeMetrics);
  if (state.stressActive) {
    const weightedFaults = [
      ...architecture.nodes.flatMap((node) => {
        const fault = state.faults[node.id];
        const metric = nodeMetrics[node.id];
        if (!fault || !metric || fault.latencyMs === 0 && fault.dropoutPercent === 0) return [];
        const isNonCriticalLlmSupport = architecture.id === 'llm_inference_serving' && ['memorystore', 'pubsub_overflow'].includes(node.id);
        const trafficShare = isNonCriticalLlmSupport ? 0 : Math.min(1, metric.demandRps / Math.max(state.peakRps, 1));
        return [{ ...fault, trafficShare }];
      }),
      ...architecture.edges.flatMap((edge) => {
        const fault = state.faults[edge.id];
        const downstream = nodeMetrics[edge.to];
        if (!fault || !downstream || fault.latencyMs === 0 && fault.dropoutPercent === 0) return [];
        return [{ ...fault, trafficShare: Math.min(1, downstream.demandRps / Math.max(state.peakRps, 1)) }];
      }),
    ];
    const faultImpact = aggregateFaultImpact(weightedFaults);
    availability = Math.max(0, Math.min(1, availability * faultImpact.availabilityMultiplier));
    rpsAchieved = Math.max(0, rpsAchieved * faultImpact.availabilityMultiplier);
    p95Ms += Math.round(faultImpact.latencyMs);
    errorRate = 1 - availability;
    if (faultImpact.latencyMs > 0 && p95Ms > state.latencyTarget) breachReasons.push('INJECTED LATENCY');
    if (faultImpact.availabilityMultiplier < 1 && availability < state.availabilityTarget) breachReasons.push('INJECTED DROPOUT');
  }
  if (state.stressActive && cost > state.budget) breachReasons.push('BUDGET LIMIT');
  if (!state.stressActive) breachReasons.push('SLO NOT TESTED');

  const sloPass = evaluateSlo({
    stressActive: state.stressActive,
    availability,
    availabilityTarget: state.availabilityTarget,
    latencyMs: p95Ms,
    latencyTargetMs: state.latencyTarget,
    errorRate,
    cost,
    budget: state.budget,
    breachReasons,
  });

  return {
    ...state,
    nodeMetrics,
    edgeMetrics,
    sim: {
      tick: state.tick,
      availability,
      p95Ms,
      errorRate,
      rpsAchieved,
      costGbpMonth: cost,
      sloPass,
      breachReasons: Array.from(new Set(breachReasons)),
    },
  };
}

function appendLog(state: State, entry: Omit<FdrEntry, 'ts'>) {
  return [...state.log, { ...entry, ts: simulationTime(state.tick) }].slice(-30);
}

function mutate(
  current: State,
  source: Source,
  op: string,
  args: Record<string, unknown>,
  mutator: (state: State) => { state: State; result?: Partial<DomainResult> },
  expectedVersion?: number,
): { state: State; result: DomainResult } {
  if (expectedVersion !== undefined && expectedVersion !== current.version) {
    const log = appendLog(current, {
      source,
      op,
      args,
      beforeVersion: current.version,
      afterVersion: current.version,
      resultCode: 'STALE_STATE',
    });
    return {
      state: { ...current, log },
      result: {
        ok: false,
        code: 'STALE_STATE',
        expectedVersion,
        currentVersion: current.version,
      },
    };
  }
  const outcome = mutator(current);
  if (outcome.result?.ok === false) {
    const log = appendLog(current, {
      source,
      op,
      args,
      beforeVersion: current.version,
      afterVersion: current.version,
      resultCode: String(outcome.result.code ?? 'REJECTED'),
    });
    return {
      state: { ...current, log },
      result: {
        ok: false,
        code: String(outcome.result.code ?? 'REJECTED'),
        message: outcome.result.message,
        currentVersion: current.version,
      },
    };
  }
  const nextVersion = current.version + 1;
  const nextState = {
    ...outcome.state,
    version: nextVersion,
    lastMutation: { source, op, tick: current.tick, targetId: typeof args.targetId === 'string' ? args.targetId : typeof args.id === 'string' ? args.id : typeof args.zone === 'string' ? args.zone : typeof args.region === 'string' ? args.region : undefined },
    log: appendLog(outcome.state, {
      source,
      op,
      args,
      beforeVersion: current.version,
      afterVersion: nextVersion,
      resultCode: 'OK',
    }),
  };
  return {
    state: nextState,
    result: { ok: true, code: 'OK', currentVersion: nextVersion, ...outcome.result },
  };
}

function readResult(current: State, source: Source, op: string, args: Record<string, unknown>, payload: Record<string, unknown>) {
  const log = appendLog(current, {
    source,
    op,
    args,
    beforeVersion: current.version,
    afterVersion: current.version,
    resultCode: 'OK',
  });
  return {
    state: { ...current, log },
    result: { ok: true, code: 'OK', currentVersion: current.version, ...payload },
  };
}

function pinLabel(pin: PinId) {
  return {
    keep_pubsub_ordering: 'Keep Pub/Sub ordering keys',
    no_second_region: 'No second region',
    keep_old_model: 'Keep old model',
    budget_hard: 'Budget hard',
  }[pin];
}

function toolInputSchema(properties: Record<string, unknown>, required: string[] = []) {
  return { type: 'object', properties, required, additionalProperties: false };
}

function nodeIdProperty(architecture: ArchitectureDefinition) {
  return { type: 'string', enum: architecture.nodes.map((node) => node.id) };
}

function benchGuideFor(architecture: ArchitectureDefinition) {
  const common = {
    signatureLoop: [
      'Human selects reference from Catalogue — no WebMCP tool can load a reference.',
      'Human configures scenario controls and pins on the Bench.',
      'Agent discovers site tools, reads semantic state, runs stress or failure.',
      'Agent begins legal remediation with expectedVersion from the latest read.',
      'Human may change ordinary controls at any time while the agent is operating.',
      'Stale agent mutations return STALE_STATE; agent re-reads and adapts.',
    ],
    errorCodes: {
      STALE_STATE: 'Mutation used an outdated expectedVersion after human or simulation changed state.',
      PINNED_NO_SECOND_REGION: 'Traffic to secondary region blocked while no_second_region pin is active.',
      PINNED_KEEP_OLD_MODEL: '100% new-model split blocked while keep_old_model pin is active.',
      PINNED_KEEP_PUBSUB_ORDERING: 'Unordered replacement blocked while keep_pubsub_ordering pin is active.',
      PINNED_BUDGET: 'Change would exceed budget_hard pin.',
    },
    pins: ['keep_pubsub_ordering', 'no_second_region', 'keep_old_model', 'budget_hard'],
  };

  if (architecture.id === 'event_driven_checkout') {
    return {
      ...common,
      architectureId: architecture.id,
      distinctiveFailure: 'Pub/Sub ordering-key throughput ceiling jams the queue at high ordered-event load.',
      ordinaryHumanControls: ['peakRps', 'budgetGbp'],
      remediationPaths: [
        'set_ordering_key_parallelism to spread ordering keys',
        'set_batching with higher maxBatch within model limits',
        'set_autoscaling on Cloud Run services',
        'add_read_replica for zonal failure path',
      ],
      stressTool: 'run_stress_test',
    };
  }

  if (architecture.id === 'multi_region_saas') {
    return {
      ...common,
      architectureId: architecture.id,
      distinctiveFailure: 'Regional failure with traffic still routed to the dead region causes visible loss.',
      ordinaryHumanControls: ['primaryTrafficPercent', 'peakRps', 'budgetGbp'],
      remediationPaths: [
        'set_region_traffic_split to shift traffic to surviving region',
        'set_autoscaling on surviving regional Cloud Run service',
        'fail_region / restore_region for controlled regional tests',
      ],
      stressTool: 'run_stress_test',
    };
  }

  return {
    ...common,
    architectureId: architecture.id,
    distinctiveFailure: 'Vertex AI GPU saturation on new model path raises TTFT and overflow.',
    ordinaryHumanControls: ['newModelPercent', 'peakRps', 'budgetGbp'],
    remediationPaths: [
      'set_model_traffic_split to a safe share',
      'set_autoscaling on Vertex AI endpoints',
      'set_batching to trade wait time for throughput',
    ],
    stressTool: 'run_stress_test',
  };
}

const READ_ONLY_TOOLS = new Set([
  'get_bench_guide',
  'get_architecture',
  'get_scenario',
  'get_live_metrics',
  'get_root_cause_analysis',
  'get_constraints',
]);

function annotateTools(tools: ToolRegistration[]): ToolRegistration[] {
  return tools.map((tool) => ({
    ...tool,
    annotations: { readOnlyHint: READ_ONLY_TOOLS.has(tool.name) },
  }));
}

function rootCauseFor(architecture: ArchitectureDefinition, state: State): RootCauseAnalysis {
  const nodeNames = new Map(architecture.nodes.map((node) => [node.id, node.name]));
  const edgeNames = new Map(architecture.edges.map((edge) => [edge.id, `${nodeNames.get(edge.from) ?? edge.from} → ${nodeNames.get(edge.to) ?? edge.to}`]));
  return analyseRootCause({
    tick: state.tick,
    storeVersion: state.version,
    stressActive: state.stressActive,
    failedZones: state.failedZones,
    failedRegions: state.failedRegions,
    killedComponents: state.killedNodes.map((id) => ({ id, name: nodeNames.get(id) ?? id })),
    faults: Object.entries(state.faults).map(([targetId, fault]) => ({ targetId, targetName: nodeNames.get(targetId) ?? edgeNames.get(targetId) ?? targetId, targetType: edgeNames.has(targetId) ? 'connection' : 'component', ...fault })),
    overloadedComponents: architecture.nodes.flatMap((node) => {
      const metric = state.nodeMetrics[node.id];
      return metric && (metric.utilisation >= 1 || (metric.overflowRps ?? 0) > 0) ? [{ id: node.id, name: node.name, utilisation: metric.utilisation, overflowRps: metric.overflowRps ?? 0 }] : [];
    }),
    impact: { availability: state.sim.availability, latencyMs: state.sim.p95Ms, errorRate: state.sim.errorRate, achievedRps: state.sim.rpsAchieved, sloPass: state.sim.sloPass, breachReasons: state.sim.breachReasons },
  });
}

function makeTools(
  architecture: ArchitectureDefinition,
  getState: () => State,
  invoke: (op: string, args: Record<string, unknown>, expectedVersion?: number) => DomainResult,
  read: (op: string, args: Record<string, unknown>, payload: Record<string, unknown>) => DomainResult,
): ToolRegistration[] {
  const tools: ToolRegistration[] = [
    {
      name: 'get_bench_guide',
      description: 'Read the signature human-agent loop, valid remediation paths, pin semantics, and error codes for this bench.',
      inputSchema: toolInputSchema({}),
      execute: () => read('get_bench_guide', {}, { guide: benchGuideFor(architecture), storeVersion: getState().version }),
    },
    {
      name: 'get_architecture',
      description: 'Read the current semantic topology, health, failures, exclusions, and store version.',
      inputSchema: toolInputSchema({}),
      execute: () => {
        const state = getState();
        const result = read('get_architecture', {}, {
          architectureId: architecture.id,
          platform: architecture.platform,
          referenceSpec: architecture.referenceSpec,
          referenceUrl: architecture.referenceUrl,
          nodes: architecture.nodes.map((node) => ({
            id: node.id,
            name: node.name,
            kind: node.kind,
            region: node.region,
            replicaZones: replicaPlacementsFor(state, node),
            provisionedReplicas: replicasFor(state, node),
            availableReplicas: activeReplicasFor(state, node),
            gcp: gcpResourceProfile(architecture, node),
            fault: state.faults[node.id] ?? null,
            health: state.nodeMetrics[node.id]?.effectiveHealth ?? 'healthy',
          })),
          edges: architecture.edges.map((edge) => ({ ...edge, fault: state.faults[edge.id] ?? null })),
          failedRegions: state.failedRegions,
          failedZones: state.failedZones,
          excludedRegions: state.pins.includes('no_second_region') ? ['us-east4'] : [],
          storeVersion: state.version,
        });
        return result;
      },
    },
    {
      name: 'get_scenario',
      description: 'Read current human scenario controls, targets, pins, and store version.',
      inputSchema: toolInputSchema({}),
      execute: () => {
        const state = getState();
        return read('get_scenario', {}, {
          architectureId: architecture.id,
          platform: architecture.platform,
          referenceSpec: architecture.referenceSpec,
          referenceUrl: architecture.referenceUrl,
          peakRps: state.peakRps,
          budgetGbp: state.budget,
          availabilityTarget: state.availabilityTarget,
          latencyTargetMs: state.latencyTarget,
          pins: state.pins,
          activeFaults: state.faults,
          primaryTrafficPercent: architecture.id === 'multi_region_saas' ? state.regionPrimaryPercent : undefined,
          newModelPercent: architecture.id === 'llm_inference_serving' ? state.modelNewPercent : undefined,
          storeVersion: state.version,
        });
      },
    },
    {
      name: 'get_live_metrics',
      description: 'Read demand, served throughput, capacity, utilisation, headroom, queue or overflow, TTFT, and factual observations.',
      inputSchema: toolInputSchema({}),
      execute: () => {
        const state = getState();
        const observations = architecture.nodes.flatMap((node) => {
          const metric = state.nodeMetrics[node.id];
          if (!metric) return [];
          const items: Record<string, unknown>[] = [];
          if (metric.utilisation > 1) items.push({ code: 'CAPACITY_BREACH', nodeId: node.id, demand: metric.demandRps, capacity: metric.capacity, unit: 'req/s' });
          if ((metric.queueDepth ?? 0) > 0 || (metric.overflowRps ?? 0) > 0) items.push({ code: 'QUEUE_PRESSURE', nodeId: node.id, depth: metric.queueDepth ?? 0, overflow: metric.overflowRps ?? 0, unit: 'req/s' });
          if (metric.injectedLatencyMs > 0 || metric.dropoutPercent > 0) items.push({ code: 'INJECTED_FAULT', nodeId: node.id, latencyMs: metric.injectedLatencyMs, dropoutPercent: metric.dropoutPercent, dropoutRps: metric.dropoutRps });
          return items;
        });
        return read('get_live_metrics', {}, {
          sim: state.sim,
          nodeMetrics: Object.fromEntries(Object.entries(state.nodeMetrics).map(([id, metric]) => [id, { ...metric, headroom: Math.max(0, metric.capacity - metric.demandRps) }])),
          edgeMetrics: state.edgeMetrics,
          observations,
          storeVersion: state.version,
        });
      },
    },
    {
      name: 'get_root_cause_analysis',
      description: 'Explain the current failure using live topology, fault, capacity, SLO, and Flight Data Recorder evidence. This tool is read-only and returns recovery actions supported by the bench.',
      inputSchema: toolInputSchema({}),
      execute: () => {
        const state = getState();
        return read('get_root_cause_analysis', {}, { analysis: rootCauseFor(architecture, state) });
      },
    },
    {
      name: 'get_constraints',
      description: 'Read applicable provider-limit and model-assumption records with source dates and provenance.',
      inputSchema: toolInputSchema({}),
      execute: () => read('get_constraints', {}, {
        provider: architecture.platform,
        constraints: architecture.id === 'event_driven_checkout'
          ? [
              { id: 'pubsub-ordering-key-throughput', sourceType: 'provider_limit', metric: 'Publisher throughput per ordering key', value: 1, unit: 'MB/s', sourceDate: '2026-08-27', sourceUrl: 'https://docs.cloud.google.com/pubsub/docs/quotas', notes: 'Google documents a 1 MBps publishing limit for each ordering key.' },
              { id: 'pubsub-ordering-key-scope', sourceType: 'provider_behavior', metric: 'Ordering guarantee', value: 'same key / same region / ordering enabled', unit: 'configuration', sourceDate: '2026-08-27', sourceUrl: 'https://docs.cloud.google.com/pubsub/docs/ordering', notes: 'Related messages must use the same key and publish region.' },
              { id: 'pubsub-bench-event-rate', sourceType: 'model_assumption', metric: 'Bench ordered events', value: 300, unit: 'events/s/key', sourceDate: '2026-08-27', notes: 'Synthetic 3.3 KB event profile used to make the provider limit interactive.' },
            ]
          : architecture.id === 'llm_inference_serving'
            ? [
                { id: 'vertex-ai-traffic-split', sourceType: 'provider_behavior', metric: 'Endpoint traffic split', value: 100, unit: '% total', sourceDate: '2026-08-27', sourceUrl: 'https://docs.cloud.google.com/vertex-ai/docs/reference/rpc/google.cloud.aiplatform.v1', notes: 'Deployed-model percentages must add up to 100.' },
                { id: 'api-gateway-payload-size', sourceType: 'provider_limit', metric: 'API Gateway request / response size', value: 32, unit: 'MB', sourceDate: '2026-08-27', sourceUrl: 'https://docs.cloud.google.com/api-gateway/docs/quotas', notes: 'Streaming is not supported through API Gateway.' },
                { id: 'vertex-ai-stable-capacity', sourceType: 'model_assumption', metric: 'Vertex AI stable endpoint capacity', value: 120, unit: 'inference/s/replica', sourceDate: '2026-08-27', notes: 'Synthetic serving capacity; verify against the selected model and machine type.' },
                { id: 'vertex-ai-release-capacity', sourceType: 'model_assumption', metric: 'Vertex AI release endpoint capacity', value: 80, unit: 'inference/s/replica', sourceDate: '2026-08-27', notes: 'Synthetic serving capacity; verify against the selected model and machine type.' },
              ]
            : [
                { id: 'cloud-run-concurrency', sourceType: 'provider_limit', metric: 'Maximum concurrency per instance', value: 1000, unit: 'concurrent requests', sourceDate: '2026-08-27', sourceUrl: 'https://docs.cloud.google.com/run/docs/configuring', notes: 'The benchmark capacity is still a workload assumption, not a direct RPS conversion.' },
                { id: 'cloud-run-request-timeout', sourceType: 'provider_limit', metric: 'Maximum request timeout', value: 60, unit: 'minutes', sourceDate: '2026-08-27', sourceUrl: 'https://docs.cloud.google.com/run/docs/configuring/request-timeout' },
                { id: 'cloud-sql-cross-region-replica', sourceType: 'provider_behavior', metric: 'Cross-region replication', value: 'asynchronous', unit: 'replication mode', sourceDate: '2026-08-27', sourceUrl: 'https://docs.cloud.google.com/sql/docs/postgres/intro-to-cloud-sql-disaster-recovery?hl=en', notes: 'Promotion is intentional; regional failover can have non-zero RPO.' },
                { id: 'memorystore-standard-ha', sourceType: 'provider_behavior', metric: 'Memorystore Standard Tier', value: 99.9, unit: '% availability SLA', sourceDate: '2026-08-27', sourceUrl: 'https://docs.cloud.google.com/memorystore/docs/redis/memorystore-for-redis-overview', notes: 'Cross-zone replication and automatic failover; up to five read replicas when enabled.' },
              ],
        publicListPriceEstimate: { gbpMonth: stateFor(getState()).sim.costGbpMonth, sourceDate: '2026-08-27', assumptions: ['Curated estimate', 'Synthetic replica mix'] },
        storeVersion: getState().version,
      }),
    },
    {
      name: 'set_peak_rps',
      description: 'Set peak load demand in requests per second for the current scenario.',
      inputSchema: toolInputSchema({ peakRps: { type: 'number' }, expectedVersion: { type: 'number' } }, ['peakRps', 'expectedVersion']),
      execute: (input) => invoke('set_peak_rps', { peakRps: Number(input.peakRps) }, Number(input.expectedVersion)),
    },
    {
      name: 'set_budget',
      description: 'Set the monthly budget constraint in GBP for the current scenario.',
      inputSchema: toolInputSchema({ budget: { type: 'number' }, expectedVersion: { type: 'number' } }, ['budget', 'expectedVersion']),
      execute: (input) => invoke('set_budget', { budget: Number(input.budget) }, Number(input.expectedVersion)),
    },
    {
      name: 'run_stress_test',
      description: 'Start the deterministic stress or failure path for the loaded reference.',
      inputSchema: toolInputSchema({ expectedVersion: { type: 'number' } }, ['expectedVersion']),
      execute: (input) => invoke('run_stress_test', { trafficMultiplier: 1 }, Number(input.expectedVersion)),
    },
    {
      name: 'restore_component',
      description: 'Restore a runtime component that was killed or failed.',
      inputSchema: toolInputSchema({ id: nodeIdProperty(architecture), expectedVersion: { type: 'number' } }, ['id', 'expectedVersion']),
      execute: (input) => invoke('restore_component', { id: String(input.id) }, Number(input.expectedVersion)),
    },
    {
      name: 'fail_zone',
      description: 'Fail one configured availability zone while leaving the topology and surviving replicas visible.',
      inputSchema: toolInputSchema({ zone: { type: 'string', enum: zonesForArchitecture(architecture) }, expectedVersion: { type: 'number' } }, ['zone', 'expectedVersion']),
      execute: (input) => invoke('fail_zone', { zone: String(input.zone) }, Number(input.expectedVersion)),
    },
    {
      name: 'restore_zone',
      description: 'Restore one failed availability zone and its placed replicas.',
      inputSchema: toolInputSchema({ zone: { type: 'string', enum: zonesForArchitecture(architecture) }, expectedVersion: { type: 'number' } }, ['zone', 'expectedVersion']),
      execute: (input) => invoke('restore_zone', { zone: String(input.zone) }, Number(input.expectedVersion)),
    },
    {
      name: 'set_fault_profile',
      description: 'Inject deterministic latency and request dropout at any declared component or connection in this architecture.',
      inputSchema: toolInputSchema({ targetId: { type: 'string', enum: [...architecture.nodes.map((node) => node.id), ...architecture.edges.map((edge) => edge.id)] }, latencyMs: { type: 'number', minimum: 0, maximum: 30000 }, dropoutPercent: { type: 'number', minimum: 0, maximum: 100 }, expectedVersion: { type: 'number' } }, ['targetId', 'latencyMs', 'dropoutPercent', 'expectedVersion']),
      execute: (input) => invoke('set_fault_profile', { targetId: String(input.targetId), latencyMs: Number(input.latencyMs), dropoutPercent: Number(input.dropoutPercent) }, Number(input.expectedVersion)),
    },
    {
      name: 'clear_fault_profile',
      description: 'Clear injected latency and dropout from one component or connection.',
      inputSchema: toolInputSchema({ targetId: { type: 'string', enum: [...architecture.nodes.map((node) => node.id), ...architecture.edges.map((edge) => edge.id)] }, expectedVersion: { type: 'number' } }, ['targetId', 'expectedVersion']),
      execute: (input) => invoke('clear_fault_profile', { targetId: String(input.targetId) }, Number(input.expectedVersion)),
    },
    {
      name: 'clear_all_faults',
      description: 'Clear every injected latency and dropout profile while preserving load, scaling, traffic split, pins, and zone state.',
      inputSchema: toolInputSchema({ expectedVersion: { type: 'number' } }, ['expectedVersion']),
      execute: (input) => invoke('clear_all_faults', {}, Number(input.expectedVersion)),
    },
  ];

  if (architecture.id === 'event_driven_checkout') {
    tools.push(
      {
        name: 'set_autoscaling',
        description: 'Change a declared service replica count within the loaded reference.',
        inputSchema: toolInputSchema({ id: nodeIdProperty(architecture), min: { type: 'number' }, max: { type: 'number' }, expectedVersion: { type: 'number' } }, ['id', 'min', 'max', 'expectedVersion']),
        execute: (input) => invoke('set_autoscaling', { id: String(input.id), min: Number(input.min), max: Number(input.max) }, Number(input.expectedVersion)),
      },
      {
        name: 'set_ordering_key_parallelism',
        description: 'Set the number of Pub/Sub ordering keys used to spread ordered work while retaining per-key ordering.',
        inputSchema: toolInputSchema({ id: nodeIdProperty(architecture), orderingKeyShards: { type: 'number' }, expectedVersion: { type: 'number' } }, ['id', 'orderingKeyShards', 'expectedVersion']),
        execute: (input) => invoke('set_ordering_key_parallelism', { id: String(input.id), orderingKeyShards: Number(input.orderingKeyShards) }, Number(input.expectedVersion)),
      },
      {
        name: 'set_batching',
        description: 'Configure Pub/Sub batching within the declared GCP model limits.',
        inputSchema: toolInputSchema({ id: nodeIdProperty(architecture), maxBatch: { type: 'number' }, waitMs: { type: 'number' }, expectedVersion: { type: 'number' } }, ['id', 'maxBatch', 'waitMs', 'expectedVersion']),
        execute: (input) => invoke('set_batching', { id: String(input.id), maxBatch: Number(input.maxBatch), waitMs: Number(input.waitMs) }, Number(input.expectedVersion)),
      },
      {
        name: 'add_read_replica',
        description: 'Add a same-region Cloud SQL read replica for the zonal failure path.',
        inputSchema: toolInputSchema({ id: nodeIdProperty(architecture), expectedVersion: { type: 'number' } }, ['id', 'expectedVersion']),
        execute: (input) => invoke('add_read_replica', { id: String(input.id) }, Number(input.expectedVersion)),
      },
    );
  }

  if (architecture.id === 'multi_region_saas') {
    tools.push(
      {
        name: 'fail_region',
        description: 'Fail one configured region while keeping its reference topology visible.',
        inputSchema: toolInputSchema({ region: { type: 'string', enum: ['europe-west2', 'us-east4'] }, expectedVersion: { type: 'number' } }, ['region', 'expectedVersion']),
        execute: (input) => invoke('fail_region', { region: String(input.region) }, Number(input.expectedVersion)),
      },
      {
        name: 'restore_region',
        description: 'Restore one failed region and its placed services.',
        inputSchema: toolInputSchema({ region: { type: 'string', enum: ['europe-west2', 'us-east4'] }, expectedVersion: { type: 'number' } }, ['region', 'expectedVersion']),
        execute: (input) => invoke('restore_region', { region: String(input.region) }, Number(input.expectedVersion)),
      },
      {
        name: 'set_region_traffic_split',
        description: 'Set the primary-region traffic allocation.',
        inputSchema: toolInputSchema({ primaryPercent: { type: 'number' }, expectedVersion: { type: 'number' } }, ['primaryPercent', 'expectedVersion']),
        execute: (input) => invoke('set_region_traffic_split', { primaryPercent: Number(input.primaryPercent) }, Number(input.expectedVersion)),
      },
      {
        name: 'set_autoscaling',
        description: 'Scale a surviving regional Cloud Run service within the reference.',
        inputSchema: toolInputSchema({ id: nodeIdProperty(architecture), min: { type: 'number' }, max: { type: 'number' }, expectedVersion: { type: 'number' } }, ['id', 'min', 'max', 'expectedVersion']),
        execute: (input) => invoke('set_autoscaling', { id: String(input.id), min: Number(input.min), max: Number(input.max) }, Number(input.expectedVersion)),
      },
    );
  }

  if (architecture.id === 'llm_inference_serving') {
    tools.push(
      {
        name: 'set_model_traffic_split',
        description: 'Set the release-candidate share of model traffic.',
        inputSchema: toolInputSchema({ newModelPercent: { type: 'number' }, expectedVersion: { type: 'number' } }, ['newModelPercent', 'expectedVersion']),
        execute: (input) => invoke('set_model_traffic_split', { newModelPercent: Number(input.newModelPercent) }, Number(input.expectedVersion)),
      },
      {
        name: 'set_autoscaling',
        description: 'Scale one of the Vertex AI serving endpoints within the reference.',
        inputSchema: toolInputSchema({ id: nodeIdProperty(architecture), min: { type: 'number' }, max: { type: 'number' }, expectedVersion: { type: 'number' } }, ['id', 'min', 'max', 'expectedVersion']),
        execute: (input) => invoke('set_autoscaling', { id: String(input.id), min: Number(input.min), max: Number(input.max) }, Number(input.expectedVersion)),
      },
      {
        name: 'set_batching',
        description: 'Configure deterministic Vertex AI batching and wait time.',
        inputSchema: toolInputSchema({ id: nodeIdProperty(architecture), maxBatch: { type: 'number' }, waitMs: { type: 'number' }, expectedVersion: { type: 'number' } }, ['id', 'maxBatch', 'waitMs', 'expectedVersion']),
        execute: (input) => invoke('set_batching', { id: String(input.id), maxBatch: Number(input.maxBatch), waitMs: Number(input.waitMs) }, Number(input.expectedVersion)),
      },
    );
  }
  return annotateTools(tools);
}

function stateFor(state: State) {
  return state;
}

function runCommandFor(
  current: State,
  architecture: ArchitectureDefinition,
  source: Source,
  op: string,
  args: Record<string, unknown>,
  expectedVersion?: number,
): { state: State; result: DomainResult } {
  const command: CommandFn = (state) => {
    if (op === 'run_stress_test') {
      if (state.running) return { state, result: { ok: false, code: 'ALREADY_RUNNING', currentVersion: state.version } };
      const next = { ...state, running: true, stressActive: true };
      if (architecture.id === 'multi_region_saas' && state.failedRegions.length === 0) next.failedRegions = ['us-east4'];
      if (architecture.id === 'llm_inference_serving') next.modelNewPercent = Math.max(next.modelNewPercent, 80);
      return { state: applyMetrics(next, architecture), result: {} };
    }
    if (op === 'stop_stress_test') return { state: { ...state, running: false }, result: {} };
    if (op === 'set_peak_rps') {
      const peakRps = Math.max(1, Math.round(Number(args.peakRps)));
      return { state: applyMetrics({ ...state, peakRps }, architecture), result: { peakRps } };
    }
    if (op === 'set_budget') {
      const budget = Math.max(1000, Math.round(Number(args.budget)));
      return { state: applyMetrics({ ...state, budget }, architecture), result: { budgetGbp: budget } };
    }
    if (op === 'set_region_traffic_split') {
      if (state.pins.includes('no_second_region') && Number(args.primaryPercent) < 100) return { state, result: { ok: false, code: 'PINNED_NO_SECOND_REGION', message: 'Secondary region is excluded by a pinned human constraint.' } };
      const regionPrimaryPercent = Math.min(100, Math.max(0, Math.round(Number(args.primaryPercent))));
      return { state: applyMetrics({ ...state, regionPrimaryPercent }, architecture), result: { primaryPercent: regionPrimaryPercent } };
    }
    if (op === 'set_model_traffic_split') {
      const modelNewPercent = Math.min(100, Math.max(0, Math.round(Number(args.newModelPercent))));
      if (state.pins.includes('keep_old_model') && modelNewPercent >= 100) return { state, result: { ok: false, code: 'PINNED_KEEP_OLD_MODEL', message: 'The old model must retain non-zero traffic.' } };
      return { state: applyMetrics({ ...state, modelNewPercent }, architecture), result: { newModelPercent: modelNewPercent } };
    }
    if (op === 'set_pin') {
      const pin = args.pin as PinId;
      const enabled = Boolean(args.enabled);
      const pins = enabled ? Array.from(new Set([...state.pins, pin])) : state.pins.filter((item) => item !== pin);
      const next: State = { ...state, pins };
      if (pin === 'keep_old_model' && enabled && next.modelNewPercent >= 100) next.modelNewPercent = 80;
      return { state: applyMetrics(next, architecture), result: { pin, enabled } };
    }
    if (op === 'fail_region') {
      const region = args.region as Region;
      if (state.pins.includes('no_second_region') && region === 'us-east4') return { state, result: { ok: false, code: 'PINNED_NO_SECOND_REGION', message: 'Secondary region is already excluded by a pinned human constraint.' } };
      return { state: applyMetrics({ ...state, failedRegions: Array.from(new Set([...state.failedRegions, region])), running: true, stressActive: true }, architecture), result: { region } };
    }
    if (op === 'restore_region') {
      const region = args.region as Region;
      return { state: applyMetrics({ ...state, failedRegions: state.failedRegions.filter((item) => item !== region) }, architecture), result: { region } };
    }
    if (op === 'fail_zone') {
      const zone = args.zone as ZoneId;
      if (!zonesForArchitecture(architecture).includes(zone)) return { state, result: { ok: false, code: 'UNKNOWN_ZONE', message: `Unknown availability zone ${zone}.` } };
      return { state: applyMetrics({ ...state, failedZones: Array.from(new Set([...state.failedZones, zone])), running: true, stressActive: true }, architecture), result: { zone } };
    }
    if (op === 'restore_zone') {
      const zone = args.zone as ZoneId;
      return { state: applyMetrics({ ...state, failedZones: state.failedZones.filter((item) => item !== zone) }, architecture), result: { zone } };
    }
    if (op === 'set_fault_profile') {
      const targetId = String(args.targetId);
      const validTarget = architecture.nodes.some((node) => node.id === targetId) || architecture.edges.some((edge) => edge.id === targetId);
      if (!validTarget) return { state, result: { ok: false, code: 'UNKNOWN_FAULT_TARGET', message: `Unknown component or connection ${targetId}.` } };
      const fault = normalizeFault(Number(args.latencyMs), Number(args.dropoutPercent));
      const faults = fault.latencyMs === 0 && fault.dropoutPercent === 0
        ? Object.fromEntries(Object.entries(state.faults).filter(([id]) => id !== targetId))
        : { ...state.faults, [targetId]: fault };
      return { state: applyMetrics({ ...state, faults, running: true, stressActive: true }, architecture), result: { targetId, ...fault } };
    }
    if (op === 'clear_fault_profile') {
      const targetId = String(args.targetId);
      const faults = Object.fromEntries(Object.entries(state.faults).filter(([id]) => id !== targetId));
      return { state: applyMetrics({ ...state, faults }, architecture), result: { targetId } };
    }
    if (op === 'clear_all_faults') {
      return { state: applyMetrics({ ...state, faults: {} }, architecture), result: { cleared: Object.keys(state.faults).length } };
    }
    if (op === 'kill_component') {
      const id = String(args.id);
      if (!architecture.nodes.some((node) => node.id === id)) return { state, result: { ok: false, code: 'UNKNOWN_NODE', message: `Unknown node ${id}.` } };
      return { state: applyMetrics({ ...state, killedNodes: Array.from(new Set([...state.killedNodes, id])), running: true, stressActive: true }, architecture), result: { id } };
    }
    if (op === 'restore_component') {
      const id = String(args.id);
      return { state: applyMetrics({ ...state, killedNodes: state.killedNodes.filter((item) => item !== id), failedRegions: state.failedRegions.filter((region) => !architecture.nodes.some((node) => node.id === id && node.region === region)) }, architecture), result: { id } };
    }
    if (op === 'set_ordering_key_parallelism') {
      const id = String(args.id);
      if (id !== 'pubsub_ordered') return { state, result: { ok: false, code: 'ILLEGAL_MOVE', message: 'Ordering-key parallelism is only legal for the ordered Pub/Sub subscription.' } };
      const orderingKeyShards = Math.min(15, Math.max(1, Math.round(Number(args.orderingKeyShards))));
      return { state: applyMetrics({ ...state, orderingKeyShards }, architecture), result: { orderingKeyShards } };
    }
    if (op === 'set_batching') {
      const id = String(args.id);
      const maxBatch = Math.min(10, Math.max(1, Math.round(Number(args.maxBatch))));
      const waitMs = Math.min(100, Math.max(0, Math.round(Number(args.waitMs))));
      if (!architecture.nodes.some((node) => node.id === id)) return { state, result: { ok: false, code: 'UNKNOWN_NODE', message: `Unknown node ${id}.` } };
      return { state: applyMetrics({ ...state, pubsubBatch: id === 'pubsub_ordered' ? maxBatch : state.pubsubBatch, batching: { ...state.batching, [id]: { maxBatch, waitMs } } }, architecture), result: { id, maxBatch, waitMs } };
    }
    if (op === 'add_read_replica') {
      if (state.pins.includes('no_second_region')) return { state, result: {} };
      return { state: applyMetrics({ ...state, readReplicaAdded: true }, architecture), result: { id: args.id } };
    }
    if (op === 'set_autoscaling') {
      const id = String(args.id);
      const node = architecture.nodes.find((item) => item.id === id);
      if (!node) return { state, result: { ok: false, code: 'UNKNOWN_NODE', message: `Unknown node ${id}.` } };
      const min = Math.max(1, Math.round(Number(args.min)));
      const max = Math.max(min, Math.round(Number(args.max)));
      const replicas = Math.min(max, Math.max(min, state.replicaOverrides[id] ?? node.replicas));
      const next = applyMetrics({ ...state, replicaOverrides: { ...state.replicaOverrides, [id]: replicas } }, architecture);
      if (state.pins.includes('budget_hard') && next.sim.costGbpMonth > state.budget) return { state, result: { ok: false, code: 'PINNED_BUDGET', message: 'This change exceeds the human budget limit.' } };
      return { state: next, result: { id, min, max, replicas } };
    }
    return { state, result: { ok: false, code: 'ILLEGAL_MOVE', message: `Unknown command ${op}.` } };
  };
  return mutate(current, source, op, args, command, expectedVersion);
}

function TopologyThumbnail({ architecture }: { architecture: ArchitectureDefinition }) {
  const mode = architecture.id;
  const iconKinds = mode === 'event_driven_checkout'
    ? ['client', 'gateway', 'service', 'queue', 'service']
    : mode === 'multi_region_saas'
      ? ['edge', 'gateway', 'service', 'db', 'cache']
      : ['client', 'gateway', 'service', 'gpu', 'gpu'];
  return (
    <div className={`topology-thumbnail ${mode}`} aria-label={`${architecture.name} topology thumbnail`}>
      <div className="thumbnail-gcp-icons" aria-hidden="true">
        {iconKinds.map((kind, index) => <img key={`${kind}-${index}`} src={gcpIconFor(kind as NodeDefinition['kind'])} alt="" />)}
      </div>
      <svg viewBox="0 0 320 108" role="img" aria-hidden="true">
        {mode === 'event_driven_checkout' && (
          <>
            <path d="M22 54H82M104 54H145M167 54H210M232 54H294M145 66L120 91M167 66L205 91" />
            <circle cx="22" cy="54" r="8" /><circle cx="93" cy="54" r="8" /><circle cx="156" cy="54" r="11" /><circle cx="221" cy="54" r="11" /><circle cx="298" cy="54" r="8" />
            <rect x="108" y="84" width="25" height="12" rx="2" /><rect x="193" y="84" width="25" height="12" rx="2" />
          </>
        )}
        {mode === 'multi_region_saas' && (
          <>
            <path d="M28 54L88 29M28 54L88 79M110 29H170M110 79H170M192 29H248M192 79H248M265 29L296 54M265 79L296 54" />
            <circle cx="28" cy="54" r="9" /><circle cx="99" cy="29" r="8" /><circle cx="99" cy="79" r="8" /><circle cx="181" cy="29" r="8" /><circle cx="181" cy="79" r="8" /><rect x="250" y="20" width="25" height="18" rx="2" /><rect x="250" y="70" width="25" height="18" rx="2" /><circle cx="300" cy="54" r="9" />
          </>
        )}
        {mode === 'llm_inference_serving' && (
          <>
            <path d="M22 54H86M108 54H150M172 54L220 29M172 54L220 79M242 29H300M242 79H300" />
            <circle cx="22" cy="54" r="8" /><circle cx="97" cy="54" r="8" /><circle cx="161" cy="54" r="11" /><rect x="220" y="18" width="25" height="21" rx="2" /><rect x="220" y="68" width="25" height="21" rx="2" /><circle cx="300" cy="29" r="8" /><circle cx="300" cy="79" r="8" />
          </>
        )}
      </svg>
      <div className="thumb-key"><span className="thumb-line" /> <span>reference topology</span></div>
    </div>
  );
}

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>;
}

function SiteToolsLamp({ status, count = 0 }: { status: 'off' | 'green' | 'amber' | 'red'; count?: number }) {
  const label = status === 'green' ? `${count} tools registered` : status === 'amber' ? 'WebMCP unavailable' : status === 'red' ? 'WebMCP registration error' : 'SITE TOOLS off on Catalogue';
  return <span className={`site-tools-lamp ${status}`} title={label}><span className="lamp-dot" aria-hidden="true" /> <span>SITE TOOLS</span><b>{status === 'off' ? 'OFF' : status === 'green' ? 'LIVE' : status.toUpperCase()}</b></span>;
}

function CatalogueView() {
  return (
    <main className="app-shell catalogue-shell">
      <header className="topbar">
      <a href="/" className="brand-lockup" aria-label="Resilience Forge Catalogue"><BrandMark /><span><b>RESILIENCE FORGE</b><small>REFERENCE ARCHITECTURE BENCH</small></span></a>
        <div className="topbar-status"><span className="topbar-note">human selects the reference</span><SiteToolsLamp status="off" /></div>
      </header>

      <section className="catalogue-hero">
        <div className="hero-copy">
          <p className="eyebrow">CATALOGUE / GCP REFERENCES / ONE LIVE TRUTH</p>
          <h1>Pick a reference.<br /><span>Stress the truth.</span></h1>
          <p className="hero-description">Choose a known architecture, load it onto the bench, and make its trade-offs visible before implementation. A browser agent can operate the tools once you decide what the system is allowed to be.</p>
        </div>
        <div className="thesis-rail" aria-label="Product thesis">
          <span className="rail-mark" />
          <div><b>Human</b><span>sets the reference and constraints.</span></div>
          <div><b>Bench</b><span>turns pressure into live evidence.</span></div>
          <div><b>WebMCP</b><span>operates the same state semantically.</span></div>
        </div>
      </section>

      <section className="catalogue-grid" aria-label="Reference architectures">
        {architectures.map((architecture) => (
          <article className={`reference-card ${accentClass[architecture.accent]}`} key={architecture.id}>
            <div className="card-topline"><span className="card-type">{architecture.platform} REFERENCE / {architecture.scenarioLabel}</span><span className="card-index" aria-hidden="true">{architecture.id === 'event_driven_checkout' ? 'A' : architecture.id === 'multi_region_saas' ? 'B' : 'C'}</span></div>
            <TopologyThumbnail architecture={architecture} />
            <div className="reference-card-body">
              <h2>{architecture.name}</h2>
              <p className="card-job">{architecture.job}</p>
              <dl className="reference-facts">
                <div><dt>Operating shape</dt><dd>{architecture.operatingShape}</dd></div>
                <div><dt>GCP specification</dt><dd><a className="reference-link" href={architecture.referenceUrl} target="_blank" rel="noreferrer">{architecture.referenceSpec}<span aria-hidden="true">↗</span></a></dd></div>
                <div><dt>Distinctive failure</dt><dd>{architecture.failure}</dd></div>
                <div><dt>Human interrupt</dt><dd>{architecture.interrupt}</dd></div>
              </dl>
              <a className="load-button" href={`/bench/${architecture.id}`}><span>Load onto bench</span><span className="button-mark" aria-hidden="true" /></a>
            </div>
          </article>
        ))}
      </section>

      <footer className="catalogue-footer"><span>SIMULATION / SYNTHETIC MODEL</span><span>Public list-price estimates · not production sizing proof</span><span>v3.1 / 2026-08-27</span></footer>
    </main>
  );
}

function healthLabel(health: Health) {
  return health === 'healthy' ? 'OK' : health === 'degraded' ? 'WARN' : 'DOWN';
}

function zoneShortLabel(zone: ZoneId) {
  return zone.endsWith('-a') ? 'AZ A' : 'AZ B';
}

function edgeState(edge: EdgeDefinition, state: State) {
  return state.edgeMetrics[edge.id]?.health ?? 'healthy';
}

function signalColor(health: Health) {
  return health === 'down' ? 0xe35b63 : health === 'degraded' ? 0xff8b24 : 0x63d5e5;
}

function signalOpacity(health: Health) {
  return health === 'down' ? 0.12 : health === 'degraded' ? 0.72 : 0.38;
}

function createSignalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.16, 'rgba(255,255,255,.82)');
  gradient.addColorStop(0.42, 'rgba(255,255,255,.18)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function TopologySignalField({ architecture, state }: { architecture: ArchitectureDefinition; state: State }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const sceneApiRef = useRef<{ update: (nextState: State) => void; render: () => void } | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      mount.dataset.fallback = 'true';
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 3;
    const nodeMap = new Map(architecture.nodes.map((node) => [node.id, node]));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const packetGeometry = new THREE.SphereGeometry(0.018, 8, 8);
    const anchorGeometry = new THREE.RingGeometry(0.014, 0.02, 16);
    const signalTexture = createSignalTexture();
    const entries = architecture.edges.flatMap((edge, index) => {
      const geometry = connectionGeometry(edge, nodeMap);
      if (!geometry) return [];
      const toWorld = (point: GraphPoint) => new THREE.Vector3(point.x / 50 - 1, 1 - point.y / 50, 0);
      const worldPoints = geometry.points.map(toWorld);
      const curve = new THREE.CurvePath<THREE.Vector3>();
      worldPoints.slice(1).forEach((point, index) => {
        curve.add(new THREE.LineCurve3(worldPoints[index], point));
      });
      const lineMaterial = new THREE.LineBasicMaterial({ color: signalColor('healthy'), transparent: true, opacity: 0.38 });
      const glowMaterial = new THREE.LineBasicMaterial({ color: signalColor('healthy'), transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending });
      const sampled = curve.getSpacedPoints(40);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(sampled), lineMaterial);
      const glow = new THREE.Line(new THREE.BufferGeometry().setFromPoints(sampled), glowMaterial);
      const packets = [0, 1].map(() => {
        const material = new THREE.MeshBasicMaterial({ color: signalColor('healthy'), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
        const packet = new THREE.Mesh(packetGeometry, material);
        const glowMaterial = new THREE.SpriteMaterial({ map: signalTexture, color: signalColor('healthy'), transparent: true, opacity: 0.34, depthWrite: false, blending: THREE.AdditiveBlending });
        const glow = new THREE.Sprite(glowMaterial);
        glow.scale.setScalar(0.12);
        packet.position.copy(curve.getPoint(0.1));
        glow.position.copy(packet.position);
        packet.position.z = 0.02;
        glow.position.z = 0.015;
        return { mesh: packet, material, glow, glowMaterial };
      });
      line.position.z = -0.01;
      glow.position.z = -0.02;
      scene.add(glow, line, ...packets.flatMap((packet) => [packet.glow, packet.mesh]));
      return { edge, index, curve, line, glow, lineMaterial, glowMaterial, packets };
    });

    const anchors = architecture.nodes.map((node) => {
      const material = new THREE.MeshBasicMaterial({ color: signalColor('healthy'), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const anchor = new THREE.Mesh(anchorGeometry, material);
      anchor.position.set(node.x / 50 - 1, 1 - node.y / 50, -0.015);
      scene.add(anchor);
      return { node, anchor, material };
    });

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      renderer.render(scene, camera);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    const update = (nextState: State) => {
      const elapsed = performance.now() / 1000;
      entries.forEach((entry) => {
        const health = edgeState(entry.edge, nextState);
        const color = signalColor(health);
        entry.lineMaterial.color.setHex(color);
        entry.glowMaterial.color.setHex(color);
        entry.lineMaterial.opacity = signalOpacity(health);
        const failurePulse = reducedMotion ? 1 : 0.72 + (Math.sin(elapsed * 6 + entry.index) + 1) * 0.22;
        entry.glowMaterial.opacity = health === 'down' ? 0.08 * failurePulse : health === 'degraded' ? 0.34 * failurePulse : 0.08;
        entry.packets.forEach((packet, packetIndex) => {
          packet.material.color.setHex(color);
          packet.glowMaterial.color.setHex(color);
          packet.mesh.visible = health !== 'down' && !reducedMotion;
          packet.glow.visible = packet.mesh.visible;
          if (packet.mesh.visible) {
            const speed = health === 'degraded' ? 0.32 : 0.14;
            const progress = (elapsed * speed + packetIndex * 0.29 + entry.index * 0.07) % 1;
            packet.mesh.position.copy(entry.curve.getPoint(progress));
            packet.glow.position.copy(packet.mesh.position);
            packet.glow.scale.setScalar((health === 'degraded' ? 0.18 : 0.1) + Math.sin(elapsed * (health === 'degraded' ? 8 : 4) + packetIndex) * 0.035);
            packet.mesh.position.z = 0.02;
            packet.glow.position.z = 0.015;
          }
        });
      });

      anchors.forEach(({ node, anchor, material }, index) => {
        const health = nextState.nodeMetrics[node.id]?.effectiveHealth ?? 'healthy';
        material.color.setHex(signalColor(health));
        material.opacity = health === 'down' ? 0.48 : health === 'degraded' ? 0.72 : 0.3;
        const pulse = reducedMotion ? 1 : health === 'healthy' ? 1 + Math.sin(elapsed * 1.6 + index * 0.7) * 0.16 : 1.25 + Math.sin(elapsed * 5.4 + index * 0.7) * 0.38;
        anchor.scale.setScalar(pulse);
      });
    };

    const render = () => renderer.render(scene, camera);
    sceneApiRef.current = { update, render };
    update(stateRef.current);
    resize();

    let animationFrame = 0;
    const animate = () => {
      update(stateRef.current);
      render();
      animationFrame = requestAnimationFrame(animate);
    };
    if (!reducedMotion) animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      sceneApiRef.current = null;
      entries.forEach((entry) => {
        entry.lineMaterial.dispose();
        entry.glowMaterial.dispose();
        entry.line.geometry.dispose();
        entry.glow.geometry.dispose();
        entry.packets.forEach((packet) => packet.material.dispose());
        entry.packets.forEach((packet) => packet.glowMaterial.dispose());
      });
      anchors.forEach(({ material }) => material.dispose());
      packetGeometry.dispose();
      anchorGeometry.dispose();
      signalTexture?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [architecture]);

  useEffect(() => {
    stateRef.current = state;
    sceneApiRef.current?.update(state);
    sceneApiRef.current?.render();
  }, [state]);

  return <div ref={mountRef} className="topology-signal-field" aria-hidden="true" />;
}

function TopologyCanvas({ architecture, state, selectedNodeId, onSelectNode, invoke }: { architecture: ArchitectureDefinition; state: State; selectedNodeId: string | null; onSelectNode: (id: string) => void; invoke: (op: string, args: Record<string, unknown>) => DomainResult }) {
  const selectedNode = architecture.nodes.find((node) => node.id === selectedNodeId);
  const nodeMap = useMemo(() => new Map(architecture.nodes.map((node) => [node.id, node])), [architecture.nodes]);
  const topologyFrame = useMemo(
    () => gcpTopologyFrame(architecture, state.failedZones, state.failedRegions, state.pins),
    [architecture, state.failedRegions, state.failedZones, state.pins],
  );
  const hasActiveFailure = state.failedZones.length > 0 || state.failedRegions.length > 0 || state.killedNodes.length > 0 || Object.keys(state.faults).length > 0 || (state.stressActive && !state.sim.sloPass);
  useEffect(() => {
    if (!selectedNode) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onSelectNode('');
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onSelectNode, selectedNode]);
  return (
    <div className="topology-workbench">
      <div className={`graph-board ${architecture.id} ${hasActiveFailure ? 'failure-active' : ''}`} tabIndex={0} aria-label="Architecture topology. Scroll horizontally if the diagram extends beyond the view.">
      <div className="graph-board-meta"><span>LIVE PROJECTION / {architecture.eyebrow}</span><span className="graph-meta-right"><i className="pulse-ring" />{state.running ? 'SIM RUNNING' : 'BENCH READY'} / TICK {String(state.tick).padStart(3, '0')}</span><span className="graph-scroll-hint">scroll topology</span></div>
      <div className="graph-stage">
      {hasActiveFailure && <div className="failure-propagation" aria-hidden="true"><span>FAILURE PROPAGATION</span></div>}
      <div className={`gcp-topology-frame gcp-topology-${topologyFrame.layout}`} aria-label="GCP deployment topology">
        {topologyFrame.layout === 'pair' && (
          <div className="gcp-global-strip">
            <span className="gcp-frame-label">{topologyFrame.globalLabel}</span>
            <small>{topologyFrame.globalSublabel}</small>
          </div>
        )}
        <div className="gcp-region-stack">
          {topologyFrame.regions.map((region) => (
            <div className={`${region.className} ${region.failed ? 'failed' : ''}`} key={region.key}>
              <div className="gcp-region-header">
                <div>
                  <span>{region.label}</span>
                  <small>{region.sublabel}</small>
                </div>
                <div className="gcp-zone-chips">
                  {region.zones.map((zone) => (
                    <i className={`${zone.className} ${zone.failed ? 'failed' : ''}`} key={zone.key} title={zone.sublabel}>{zone.label}</i>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {topologyFrame.layout === 'regional' && (
        <div className="topology-lanes" aria-hidden="true">
          {topologyFrame.lanes.map((lane) => (
            <div className="topology-lane" key={lane.key} style={{ left: `${lane.start}%`, width: `${lane.end - lane.start}%` }}>
              <span>{lane.label}</span>
            </div>
          ))}
        </div>
      )}
      <TopologySignalField architecture={architecture} state={state} />
      <svg className="graph-edges" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
        <defs><marker id={`edge-arrow-${architecture.id}`} markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" /></marker></defs>
        {architecture.edges.map((edge) => {
          const stateClass = edgeState(edge, state);
          return <path key={edge.id} d={connectionPath(edge, nodeMap)} className={`graph-edge edge-${stateClass} edge-${edge.kind} ${state.lastMutation?.targetId === edge.id ? `mutation-${state.lastMutation.source}` : ''}`} markerEnd={`url(#edge-arrow-${architecture.id})`} />;
        })}
      </svg>
      {architecture.nodes.map((node) => {
        const metric = state.nodeMetrics[node.id];
        const health = metric?.effectiveHealth ?? 'healthy';
        const isSelected = node.id === selectedNodeId;
        return (
          <button key={node.id} className={`graph-node node-${health} ${accentClass[node.accent]} ${isSelected ? 'selected' : ''} ${state.faults[node.id] ? 'fault-active' : ''} ${state.lastMutation?.targetId === node.id ? `mutation-${state.lastMutation.source}` : ''}`} style={{ left: `${node.x}%`, top: `${node.y}%` }} onClick={() => onSelectNode(isSelected ? '' : node.id)} aria-expanded={isSelected} aria-label={`Inspect ${node.name}, ${healthLabel(health)}`}>
            <span className="node-top"><img src={gcpIconFor(node.kind)} alt="" className="gcp-node-icon" /><span className="health-pip" data-state={healthLabel(health)} /> <span>{node.shortName}</span></span>
            <strong>{node.name}</strong>
            {metric?.replicaZones.length ? <span className="replica-spread" aria-label={`${metric.availableReplicas} of ${metric.provisionedReplicas} replicas available`}>{metric.replicaZones.map((zone, index) => <i key={`${zone}-${index}`} className={state.failedZones.includes(zone) ? 'failed' : ''} title={`${zone} replica ${index + 1}`}><span>{zoneShortLabel(zone)}</span></i>)}</span> : null}
            {state.faults[node.id] ? <span className="fault-mark">FAULT · +{state.faults[node.id].latencyMs} ms · {state.faults[node.id].dropoutPercent}% drop</span> : null}
            <span className="node-stats"><span>{metric ? `${formatNumber(metric.utilisation * 100, 0)}%` : '--'} util</span><span>{healthLabel(health)}</span></span>
          </button>
        );
      })}
      <div className="graph-legend"><span><i className="legend-swatch sparse" />healthy flow</span><span><i className="legend-swatch dense" />failure propagation</span><span><i className="legend-swatch signal" />live signal field</span><span><i className="legend-swatch down" />down / excluded</span></div>
      </div>
      </div>
      {selectedNode && <NodeInspector architecture={architecture} node={selectedNode} metric={state.nodeMetrics[selectedNode.id]} state={state} invoke={invoke} onClose={() => onSelectNode('')} />}
    </div>
  );
}

function NodeInspector({ architecture, node, metric, state, invoke, onClose }: { architecture: ArchitectureDefinition; node: NodeDefinition; metric?: NodeMetric; state: State; invoke: (op: string, args: Record<string, unknown>) => DomainResult; onClose: () => void }) {
  const resource = gcpResourceProfile(architecture, node);
  const fault = state.faults[node.id];
  return (
    <aside className="node-inspector" aria-label={`${node.name} inspector`}>
      <div className="inspector-head"><div><span className="eyebrow">NODE INSPECTOR</span><h3>{node.name}</h3></div><button className="icon-button" onClick={onClose} aria-label="Close inspector"><span className="close-mark" aria-hidden="true" /></button></div>
      <dl><div><dt>GCP product</dt><dd>{resource.product}</dd></div><div><dt>Service plane</dt><dd>{resource.plane}</dd></div><div><dt>Scope</dt><dd>{resource.scope}</dd></div><div><dt>Replica spread</dt><dd>{metric?.replicaZones.length ? metric.replicaZones.map(zoneShortLabel).join(' · ') : 'provider managed'}</dd></div><div><dt>Replicas available</dt><dd>{metric ? `${metric.availableReplicas} / ${metric.provisionedReplicas}` : state.replicaOverrides[node.id] ?? node.replicas}</dd></div><div><dt>Health</dt><dd>{metric?.effectiveHealth ? healthLabel(metric.effectiveHealth) : 'OK'}</dd></div><div><dt>Demand / served</dt><dd>{metric ? `${formatNumber(metric.demandRps)} / ${formatNumber(metric.servedRps)} req/s` : '--'}</dd></div><div><dt>Capacity / headroom</dt><dd>{metric ? `${formatNumber(metric.capacity)} / ${formatNumber(Math.max(0, metric.capacity - metric.demandRps))}` : '--'}</dd></div></dl>
      {metric?.queueDepth !== undefined && <p className="inspector-note">Queue depth <b>{formatNumber(metric.queueDepth)}</b> · overflow <b>{formatNumber(metric.overflowRps ?? 0)} req/s</b></p>}
      {metric?.ttftMs !== undefined && <p className="inspector-note">TTFT <b>{formatNumber(metric.ttftMs)} ms</b> · model assumption</p>}
      {metric?.capacityModel && <div className="capacity-equation" aria-label="Capacity model"><span>Capacity model</span><code>{state.replicaOverrides[node.id] ?? node.replicas} replicas × {metric.capacityModel.concurrency} concurrent × 1,000/{metric.capacityModel.serviceTimeMs} ms × {formatNumber(metric.capacityModel.schedulingEfficiency * 100)}% scheduler × {formatNumber(metric.capacityModel.batchGain, 2)} batch</code><small>{formatNumber(metric.capacityModel.reserveRps)} req/s operational reserve shown separately from available headroom.</small></div>}
      <div className={`fault-readout ${fault ? 'active' : ''}`}><span>Injected fault profile</span><code>{fault ? `+${fault.latencyMs} ms latency · ${fault.dropoutPercent}% dropout` : 'none'}</code><small>WebMCP target: {node.id}</small></div>
      <div className="fault-presets" aria-label="Fault injection presets"><button onClick={() => invoke('set_fault_profile', { targetId: node.id, latencyMs: 200, dropoutPercent: fault?.dropoutPercent ?? 0 })}>Inject +200 ms</button><button onClick={() => invoke('set_fault_profile', { targetId: node.id, latencyMs: fault?.latencyMs ?? 0, dropoutPercent: 5 })}>Inject 5% drop</button><button disabled={!fault} onClick={() => invoke('clear_fault_profile', { targetId: node.id })}>Clear fault</button></div>
      <p className="inspector-source">limits / model assumption / 2026-08-27</p>
    </aside>
  );
}

function MetricStrip({ state, architecture }: { state: State; architecture: ArchitectureDefinition }) {
  const metrics = [
    { label: 'Availability', value: state.stressActive ? formatPercent(state.sim.availability, 2) : '—', status: state.sim.availability >= state.availabilityTarget ? 'good' : state.stressActive ? 'bad' : 'neutral' },
    { label: architecture.id === 'llm_inference_serving' ? 'TTFT' : 'P95 latency', value: state.stressActive ? `${formatNumber(state.sim.p95Ms)} ms` : '—', status: state.sim.p95Ms <= state.latencyTarget && state.stressActive ? 'good' : state.stressActive ? 'bad' : 'neutral' },
    { label: architecture.id === 'llm_inference_serving' ? 'Overflow' : 'Error rate', value: architecture.id === 'llm_inference_serving' ? `${formatNumber(state.nodeMetrics.vertex_rc?.overflowRps ?? 0)} /s` : state.stressActive ? formatPercent(state.sim.errorRate, 1) : '—', status: state.sim.errorRate === 0 && state.stressActive ? 'good' : state.stressActive ? 'bad' : 'neutral' },
    { label: 'Achieved RPS', value: state.stressActive ? formatNumber(state.sim.rpsAchieved) : '—', status: 'neutral' },
    { label: 'Public list-price estimate', value: `£${formatNumber(state.sim.costGbpMonth)}`, status: state.sim.costGbpMonth <= state.budget ? 'good' : 'bad' },
    { label: 'SLO', value: state.sim.sloPass ? 'PASS' : state.stressActive ? 'FAIL' : 'NOT TESTED', status: state.sim.sloPass ? 'good' : state.stressActive ? 'bad' : 'neutral' },
  ];
  return <section className="metric-strip" aria-label="Live gauges">{metrics.map((metric) => <div className={`metric-cell ${metric.status}`} key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></div>)}</section>;
}

function RangeControl({ label, value, min, max, step, suffix, onChange }: { label: string; value: number; min: number; max: number; step: number; suffix?: string; onChange: (value: number) => void }) {
  return <label className="range-control"><span className="range-label"><span>{label}</span><b>{formatNumber(value)}{suffix}</b></span><input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function ScenarioRail({ architecture, state, toolStatus, toolCount, invoke }: { architecture: ArchitectureDefinition; state: State; toolStatus: 'off' | 'green' | 'amber' | 'red'; toolCount: number; invoke: (op: string, args: Record<string, unknown>) => DomainResult }) {
  const stressLabel = architecture.id === 'event_driven_checkout' ? 'Run Pub/Sub stress' : architecture.id === 'multi_region_saas' ? 'Fail us-east4' : 'Ramp Vertex AI endpoint';
  const scenarioMetric = architecture.id === 'event_driven_checkout'
    ? { label: 'Ordering-key pressure', value: `${formatNumber(state.nodeMetrics.pubsub_ordered?.queueDepth ?? 0)} depth`, note: `${formatNumber(state.nodeMetrics.pubsub_ordered?.capacity ?? 0)} events/s model` }
    : architecture.id === 'multi_region_saas'
      ? { label: 'Traffic split', value: `${state.regionPrimaryPercent} / ${100 - state.regionPrimaryPercent}`, note: 'primary / secondary' }
      : { label: 'Release endpoint', value: `${formatNumber((state.nodeMetrics.vertex_rc?.utilisation ?? 0) * 100, 0)}% util`, note: `${formatNumber(state.nodeMetrics.vertex_rc?.ttftMs ?? 350)} ms TTFT` };
  const pins: PinId[] = architecture.id === 'event_driven_checkout' ? ['keep_pubsub_ordering', 'budget_hard'] : architecture.id === 'multi_region_saas' ? ['no_second_region', 'budget_hard'] : ['keep_old_model', 'budget_hard'];
  const availabilityZones = zonesForArchitecture(architecture);
  const activeFaults = Object.entries(state.faults);
  const rca = rootCauseFor(architecture, state);
  return (
    <aside className="scenario-rail">
      <section className="rail-section rail-heading"><div><p className="eyebrow">SCENARIO / {architecture.scenarioLabel}</p><h2>{architecture.name}</h2></div><span className="shared-state-mark">v{state.version}</span></section>
      <section className="rail-section rail-live"><div className="section-title"><span>Live controls</span><span className="human-chip">HUMAN / OPEN</span></div><p>These controls stay usable while SITE TOOLS is operating.</p><button className={`stress-button ${state.running ? 'running' : ''}`} onClick={() => state.running ? invoke('stop_stress_test', {}) : invoke('run_stress_test', { trafficMultiplier: 1 })}>{state.running ? 'Stop stress test' : stressLabel}<span className="button-mark" aria-hidden="true" /></button>
        <RangeControl label="Peak load" value={state.peakRps} min={architecture.id === 'llm_inference_serving' ? 60 : 1000} max={architecture.id === 'event_driven_checkout' ? 18000 : architecture.id === 'multi_region_saas' ? 9000 : 500} step={architecture.id === 'event_driven_checkout' ? 500 : architecture.id === 'llm_inference_serving' ? 10 : 50} suffix=" req/s" onChange={(value) => invoke('set_peak_rps', { peakRps: value })} />
        <RangeControl label="Monthly budget" value={state.budget} min={3000} max={22000} step={100} suffix=" GBP" onChange={(value) => invoke('set_budget', { budget: value })} />
        {architecture.id === 'multi_region_saas' && <RangeControl label="Primary traffic allocation" value={state.regionPrimaryPercent} min={0} max={100} step={5} suffix="%" onChange={(value) => invoke('set_region_traffic_split', { primaryPercent: value })} />}
        {architecture.id === 'llm_inference_serving' && <RangeControl label="New model traffic" value={state.modelNewPercent} min={0} max={100} step={5} suffix="%" onChange={(value) => invoke('set_model_traffic_split', { newModelPercent: value })} />}
      </section>
      <section className="rail-section rail-zones"><div className="section-title"><span>Availability zones</span><span className="pin-count">{state.failedZones.length} failed</span></div><p>Fail one zone to remove only the replicas placed there. Surviving replicas keep serving at reduced capacity.</p><div className="zone-controls">{availabilityZones.map((zone) => { const failed = state.failedZones.includes(zone); return <button key={zone} className={failed ? 'failed' : ''} onClick={() => invoke(failed ? 'restore_zone' : 'fail_zone', { zone })}><span><b>{zoneShortLabel(zone)}</b><small>{zone}</small></span><strong>{failed ? 'RESTORE' : 'FAIL ZONE'}</strong></button>; })}</div></section>
      <section className="rail-section rail-faults"><div className="section-title"><span>Fault injection</span><span className={activeFaults.length ? 'readout-status bad' : 'pin-count'}>{activeFaults.length} active</span></div><p>WebMCP can target any component or connection with latency and request dropout. Effects are traffic-weighted and recorded in the FDR.</p>{activeFaults.length ? <div className="fault-list">{activeFaults.map(([targetId, fault]) => <div key={targetId}><code>{targetId}</code><span>+{formatNumber(fault.latencyMs)} ms · {formatNumber(fault.dropoutPercent, 2)}% drop</span></div>)}<button onClick={() => invoke('clear_all_faults', {})}>Clear all injected faults</button></div> : <div className="fault-empty"><span>NO ACTIVE FAULTS</span><small>Tools: set_fault_profile · clear_fault_profile</small></div>}</section>
      <section className="rail-section rail-pins"><div className="section-title"><span>Human pins</span><span className="pin-count">{state.pins.length} active</span></div><p>Constraints are domain invariants. The graph stays visible when a region or model is excluded.</p><div className="pin-list">{pins.map((pin) => <button key={pin} className={`pin-stamp ${state.pins.includes(pin) ? 'active' : ''}`} onClick={() => invoke('set_pin', { pin, enabled: !state.pins.includes(pin) })}><span className="pin-hole" />{pinLabel(pin)}<span className="pin-state">{state.pins.includes(pin) ? 'ON' : 'OFF'}</span></button>)}</div></section>
      <section className="rail-section rail-readout"><div className="section-title"><span>Bench readout</span><span className={`readout-status ${state.sim.sloPass ? 'good' : state.stressActive ? 'bad' : 'neutral'}`}>{state.sim.sloPass ? 'SLO PASS' : state.stressActive ? 'SLO FAIL' : 'NOT TESTED'}</span></div><div className="scenario-readout"><span>{scenarioMetric.label}</span><strong>{scenarioMetric.value}</strong><small>{scenarioMetric.note}</small></div><div className="breach-list">{state.sim.breachReasons.map((reason) => <span key={reason}>{reason}</span>)}</div></section>
      <section className={`rail-section rail-rca rca-${rca.status}`}><div className="section-title"><span>Root cause analysis</span><span className={`readout-status ${rca.status === 'healthy' ? 'good' : 'bad'}`}>{rca.status}</span></div><p>{rca.summary}</p>{rca.primaryCause && <div className="rca-primary"><span>PRIMARY / {Math.round(rca.primaryCause.confidence * 100)}% CONFIDENCE</span><code>{rca.primaryCause.targetId}</code><small>Ask WebMCP: get_root_cause_analysis</small></div>}</section>
      <section className="rail-section rail-reference"><div className="section-title"><span>GCP reference</span><a className="reference-link rail-reference-link" href={architecture.referenceUrl} target="_blank" rel="noreferrer">Official spec ↗</a></div><p>{architecture.referenceSpec}</p></section>
      <section className="rail-section rail-tools"><div className="section-title"><span>Tool surface</span><SiteToolsLamp status={toolStatus} count={toolCount} /></div><p>{toolStatus === 'green' ? `${toolCount} architecture-specific tools registered.` : toolStatus === 'amber' ? 'Browser tools unavailable. The bench remains fully runnable.' : toolStatus === 'red' ? 'Registration needs attention.' : 'Registering on Bench.'}</p><div className="tool-note"><span className="tool-rail-mark" />same store / same version / same truth</div></section>
      <section className="rail-section provenance"><span>Model boundary</span><p>Simulation values are inspectable model assumptions. Pricing is a public list-price estimate, not a bill.</p><small>Snapshot / 2026-08-27</small></section>
    </aside>
  );
}

function FdrTicker({ entries }: { entries: FdrEntry[] }) {
  const visible = entries.slice(-7);
  return <footer className="fdr-ticker" aria-live="polite"><div className="fdr-label"><span className="fdr-signal" /> <b>FDR</b><small>FLIGHT DATA RECORDER</small></div><div className="fdr-entries">{visible.map((entry, index) => <div className={`fdr-entry ${index === visible.length - 1 ? 'latest' : ''}`} key={`${entry.ts}-${entry.op}-${index}`}><span className={`fdr-source ${sourceClass[entry.source]}`}>{entry.source}</span><span className="fdr-time">{entry.ts}</span><code>{entry.op} {compactArgs(entry.args)}</code><span className="fdr-version">v{entry.beforeVersion}&gt;{entry.afterVersion}</span><b className={`fdr-code code-${entry.resultCode.toLowerCase()}`}>{entry.resultCode}</b></div>)}</div></footer>;
}

declare global {
  interface Window {
    resilienceForge?: {
      invoke: (op: string, args: Record<string, unknown>, expectedVersion?: number) => DomainResult;
      getState: () => State;
    };
  }
}

function BenchView({ architectureId }: { architectureId: string }) {
  const architecture = getArchitecture(architectureId);
  const [state, setState] = useState<State>(() => createInitialState(architecture, loadSavedControls(architecture.id)));
  const stateRef = useRef(state);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [toolStatus, setToolStatus] = useState<'off' | 'green' | 'amber' | 'red'>('amber');
  const [toolCount, setToolCount] = useState(0);
  const commit = useCallback((next: State) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const invoke = useCallback((op: string, args: Record<string, unknown>, expectedVersion?: number, source: Source = 'ui') => {
    const outcome = runCommandFor(stateRef.current, architecture, source, op, args, expectedVersion);
    const next = applyMetrics(outcome.state, architecture);
    commit(next);
    return outcome.result;
  }, [architecture, commit]);

  const read = useCallback((op: string, args: Record<string, unknown>, payload: Record<string, unknown>) => {
    const outcome = readResult(stateRef.current, 'webmcp', op, args, payload);
    commit(outcome.state);
    return outcome.result;
  }, [commit]);

  useEffect(() => {
    try {
      localStorage.setItem('resilience-forge:last-reference', architecture.id);
      localStorage.setItem(`resilience-forge:controls:${architecture.id}`, JSON.stringify({ peakRps: state.peakRps, budget: state.budget, regionPrimaryPercent: state.regionPrimaryPercent, modelNewPercent: state.modelNewPercent, pins: state.pins }));
    } catch {
      // Local persistence is a convenience only.
    }
  }, [architecture.id, state.budget, state.modelNewPercent, state.peakRps, state.pins, state.regionPrimaryPercent]);

  useEffect(() => {
    window.resilienceForge = {
      invoke: (op, args, expectedVersion) => invoke(op, args, expectedVersion, 'webmcp'),
      getState: () => stateRef.current,
    };
    return () => {
      delete window.resilienceForge;
    };
  }, [invoke]);

  useEffect(() => {
    if (!state.running) return;
    const timer = window.setInterval(() => {
      const current = stateRef.current;
      const advanced = applyMetrics({ ...current, tick: current.tick + 1 }, architecture);
      const shouldLog = advanced.tick % 4 === 0;
      const next = shouldLog ? { ...advanced, log: appendLog(advanced, { source: 'sim', op: 'tick', args: { tick: advanced.tick }, beforeVersion: advanced.version, afterVersion: advanced.version, resultCode: 'OK' }) } : advanced;
      commit(next);
    }, 500);
    return () => window.clearInterval(timer);
  }, [architecture, commit, state.running]);

  useEffect(() => {
    const controller = new AbortController();
    const tools = makeTools(
      architecture,
      () => stateRef.current,
      (op, args, expectedVersion) => invoke(op, args, expectedVersion, 'webmcp'),
      read,
    );
    registerWebMcpTools(tools, controller.signal)
      .then((result) => {
        if (result.supported) {
          setToolStatus('green');
          setToolCount(result.count);
        } else {
          setToolStatus('amber');
          setToolCount(0);
        }
      })
      .catch(() => setToolStatus('red'));
    return () => controller.abort();
  }, [architecture, invoke, read]);

  const selectedNode = useMemo(() => architecture.nodes.find((node) => node.id === selectedNodeId), [architecture.nodes, selectedNodeId]);
  return (
    <main className="app-shell bench-shell">
      <header className="topbar bench-topbar"><a href="/" className="back-link"><span className="back-mark" aria-hidden="true" />Catalogue</a><div className="bench-title"><BrandMark /><span><b>RESILIENCE FORGE</b><small>{architecture.platform} / {architecture.name.toUpperCase()} / LIVE BENCH</small></span></div><div className="topbar-status"><span className="version-readout">SHARED STATE / v{state.version}</span><SiteToolsLamp status={toolStatus} count={toolCount} /></div></header>
      <div className="bench-layout">
        <section className="bench-canvas-column"><div className="bench-intro"><div><p className="eyebrow">LIVE BENCH / {architecture.platform} / {architecture.scenarioLabel}</p><h1>{architecture.name}</h1><p>{architecture.job}</p></div><div className="bench-stamp"><span>{architecture.platform} REFERENCE</span><strong>{architecture.id}</strong><small>human-loaded / externally operable</small></div></div><div className="canvas-panel"><TopologyCanvas architecture={architecture} state={state} selectedNodeId={selectedNodeId} onSelectNode={(id) => setSelectedNodeId(id || null)} invoke={invoke} /></div><MetricStrip state={state} architecture={architecture} /><div className="proof-band"><div><strong>One bench. Two operators. No silent overwrite.</strong><p>Change a normal control while tools are active. The version moves, the stale write is rejected, and the next legal move has to read the new state.</p></div><div className="proof-mark"><span className="proof-square" /><span>live controls stay open</span></div></div></section>
        <ScenarioRail architecture={architecture} state={state} toolStatus={toolStatus} toolCount={toolCount} invoke={invoke} />
      </div>
      <FdrTicker entries={state.log} />
      {selectedNode && <span className="sr-only">{selectedNode.name} selected</span>}
    </main>
  );
}

export default function ResilienceForge({ view, architectureId }: { view: 'catalogue' | 'bench'; architectureId?: string }) {
  const benchId = architectureId ?? 'event_driven_checkout';
  return view === 'bench' ? <BenchView key={benchId} architectureId={benchId} /> : <CatalogueView />;
}
