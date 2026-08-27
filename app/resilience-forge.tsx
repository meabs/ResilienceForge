'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import Link from 'next/link';
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
} from './data';
import { registerWebMcpTools, type ToolRegistration } from './webmcp';

type Source = 'ui' | 'webmcp' | 'sim';
type FifoMode = 'standard' | 'high_throughput';

interface NodeMetric {
  demandRps: number;
  servedRps: number;
  capacity: number;
  utilisation: number;
  queueDepth?: number;
  overflowRps?: number;
  ttftMs?: number;
  effectiveHealth: Health;
}

interface EdgeMetric {
  rps: number;
  droppedRps: number;
  health: Health;
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
  fifoMode: FifoMode;
  fifoBatch: number;
  regionPrimaryPercent: number;
  modelNewPercent: number;
  failedRegions: Region[];
  failedZones: Array<'a' | 'b'>;
  killedNodes: string[];
  readReplicaAdded: boolean;
  replicaOverrides: Record<string, number>;
  batching: Record<string, { maxBatch: number; waitMs: number }>;
  nodeMetrics: Record<string, NodeMetric>;
  edgeMetrics: Record<string, EdgeMetric>;
  sim: SimResult;
  log: FdrEntry[];
  lastMutation?: { source: Source; op: string; tick: number };
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

function createInitialState(architecture: ArchitectureDefinition): State {
  const state = {
    architectureId: architecture.id,
    version: 1,
    tick: 0,
    peakRps: architecture.defaultPeakRps,
    budget: architecture.defaultBudget,
    availabilityTarget: architecture.defaultAvailabilityTarget,
    latencyTarget: architecture.defaultLatencyTarget,
    pins: [],
    running: false,
    stressActive: false,
    fifoMode: 'standard' as FifoMode,
    fifoBatch: 1,
    regionPrimaryPercent: 50,
    modelNewPercent: 20,
    failedRegions: [],
    failedZones: [],
    killedNodes: [],
    readReplicaAdded: false,
    replicaOverrides: defaultReplicas(architecture),
    batching: {},
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

function nodeHealth(state: State, node: NodeDefinition): Health {
  if (state.killedNodes.includes(node.id)) return 'down';
  if (state.failedRegions.includes(node.region)) return 'down';
  if (node.zone && state.failedZones.includes(node.zone)) return 'down';
  return 'healthy';
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
    const rps = Math.min(from?.servedRps ?? 0, to?.demandRps ?? 0);
    const droppedRps = Math.max(0, (to?.demandRps ?? 0) - (to?.servedRps ?? 0));
    const health: Health =
      from?.effectiveHealth === 'down' || to?.effectiveHealth === 'down'
        ? 'down'
        : state.stressActive && (droppedRps > 0 || (to?.utilisation ?? 0) > 0.9)
          ? 'degraded'
          : 'healthy';
    edgeMetrics[edge.id] = { rps, droppedRps, health };
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
    const replicas = replicasFor(state, node);
    let capacity = replicas * node.capacityPerReplica;
    let demand = state.peakRps;
    let served = state.peakRps;
    let queueDepth = 0;
    let overflowRps = 0;
    let ttftMs: number | undefined;

    if (architecture.id === 'event_driven_checkout' && node.id === 'sqs_fifo') {
      const unit = state.fifoMode === 'standard' ? 300 : 4500;
      capacity = Math.min(unit * state.fifoBatch, state.fifoMode === 'standard' ? 3000 : 45000);
      if (state.stressActive) {
        served = Math.min(demand, capacity);
        overflowRps = Math.max(0, demand - served);
        queueDepth = Math.round(overflowRps * (state.tick + 1) * 0.45);
        if (overflowRps > 0) {
          breachReasons.push('FIFO CAPACITY');
          p95Ms = Math.max(p95Ms, Math.round(220 + (overflowRps / Math.max(demand, 1)) * 1100));
        }
      }
      cost += state.fifoMode === 'high_throughput' ? 650 : 0;
    }

    if (architecture.id === 'event_driven_checkout' && node.id === 'postgres_primary' && health === 'down') {
      if (state.readReplicaAdded) {
        capacity = 8000;
      } else if (state.stressActive) {
        served = Math.min(served, state.peakRps * 0.18);
        breachReasons.push('PRIMARY DB DOWN');
      }
    }

    if (architecture.id === 'multi_region_saas') {
      const isPrimary = node.region === 'eu-west-2';
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

    if (architecture.id === 'llm_inference_serving' && (node.id === 'gpu_old' || node.id === 'gpu_new')) {
      const isNew = node.id === 'gpu_new';
      const share = isNew ? state.modelNewPercent / 100 : 1 - state.modelNewPercent / 100;
      demand = state.peakRps * share;
      const batch = state.batching[node.id]?.maxBatch ?? 1;
      capacity = replicas * node.capacityPerReplica * (1 + Math.min(batch - 1, 9) * 0.08);
      if (state.stressActive) {
        served = Math.min(demand, capacity);
        overflowRps = Math.max(0, demand - served);
        const utilisation = demand / Math.max(capacity, 1);
        ttftMs = utilisation < 0.7 ? 350 : utilisation <= 0.9 ? 700 : utilisation <= 1 ? 1500 : 3000;
        if (state.batching[node.id]) ttftMs += state.batching[node.id].waitMs;
        if (isNew && overflowRps > 0) breachReasons.push('NEW GPU OVERFLOW');
        p95Ms = Math.max(p95Ms, ttftMs);
      } else {
        ttftMs = 350;
      }
      if (isNew && state.modelNewPercent > 55 && state.stressActive) breachReasons.push('RELEASE GPU SATURATED');
    }

    if (health === 'down') served = 0;
    const activeDemand = state.stressActive ? demand : 0;
    const activeServed = state.stressActive ? served : 0;
    const utilisation = activeDemand > 0 ? Math.min(1.5, activeDemand / Math.max(capacity, 1)) : 0;
    const effectiveHealth: Health =
      health === 'down' ? 'down' : state.stressActive && utilisation > 1 ? 'degraded' : state.stressActive && utilisation > 0.9 ? 'degraded' : 'healthy';

    nodeMetrics[node.id] = {
      demandRps: activeDemand,
      servedRps: activeServed,
      capacity,
      utilisation,
      queueDepth: queueDepth || undefined,
      overflowRps: overflowRps || undefined,
      ttftMs,
      effectiveHealth,
    };
  }

  if (architecture.id === 'event_driven_checkout') {
    const queue = nodeMetrics.sqs_fifo;
    const db = nodeMetrics.postgres_primary;
    rpsAchieved = Math.min(queue?.servedRps ?? state.peakRps, db?.servedRps ?? state.peakRps);
    if (state.stressActive && queue?.overflowRps) {
      availability = rpsAchieved / Math.max(state.peakRps, 1);
      errorRate = 1 - availability;
    }
    if (db?.effectiveHealth === 'down' && !state.readReplicaAdded) {
      availability = Math.min(availability, 0.18);
      errorRate = 1 - availability;
    }
  } else if (architecture.id === 'multi_region_saas') {
    const regionA = nodeMetrics.app_a;
    const regionB = nodeMetrics.app_b;
    rpsAchieved = (regionA?.servedRps ?? 0) + (regionB?.servedRps ?? 0);
    if (state.stressActive || state.failedRegions.length > 0) {
      availability = rpsAchieved / Math.max(state.peakRps, 1);
      errorRate = 1 - availability;
      const maxUtil = Math.max(regionA?.utilisation ?? 0, regionB?.utilisation ?? 0);
      p95Ms = maxUtil > 1 ? 860 : maxUtil > 0.9 ? 560 : 260;
    }
  } else {
    const oldPool = nodeMetrics.gpu_old;
    const newPool = nodeMetrics.gpu_new;
    rpsAchieved = (oldPool?.servedRps ?? 0) + (newPool?.servedRps ?? 0);
    if (state.stressActive) {
      availability = rpsAchieved / Math.max(state.peakRps, 1);
      errorRate = 1 - availability;
      p95Ms = Math.max(oldPool?.ttftMs ?? 350, newPool?.ttftMs ?? 350);
    }
    cost += (state.batching.gpu_new?.maxBatch ?? 1) > 1 ? 560 : 0;
  }

  if (state.failedRegions.length > 0 && architecture.id === 'multi_region_saas') {
    breachReasons.push('REGION FAILURE');
  }
  if (state.stressActive && cost > state.budget) breachReasons.push('BUDGET LIMIT');
  if (!state.stressActive) breachReasons.push('SLO NOT TESTED');

  const sloPass =
    state.stressActive &&
    availability >= state.availabilityTarget &&
    p95Ms <= state.latencyTarget &&
    errorRate <= 1 - state.availabilityTarget &&
    cost <= state.budget &&
    breachReasons.length === 0;

  const edgeMetrics = addEdgeMetrics(state, architecture, nodeMetrics);
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
    lastMutation: { source, op, tick: current.tick },
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
    keep_fifo_ordering: 'Keep FIFO ordering',
    no_second_region: 'No second region',
    keep_old_model: 'Keep old model',
    budget_hard: 'Budget hard',
  }[pin];
}

function toolInputSchema(properties: Record<string, unknown>, required: string[] = []) {
  return { type: 'object', properties, required, additionalProperties: false };
}

function makeTools(
  architecture: ArchitectureDefinition,
  getState: () => State,
  invoke: (op: string, args: Record<string, unknown>, expectedVersion?: number) => DomainResult,
  read: (op: string, args: Record<string, unknown>, payload: Record<string, unknown>) => DomainResult,
): ToolRegistration[] {
  const tools: ToolRegistration[] = [
    {
      name: 'get_architecture',
      description: 'Read the current semantic topology, health, failures, exclusions, and store version.',
      inputSchema: toolInputSchema({}),
      execute: () => {
        const state = getState();
        const result = read('get_architecture', {}, {
          architectureId: architecture.id,
          nodes: architecture.nodes.map((node) => ({
            id: node.id,
            name: node.name,
            kind: node.kind,
            region: node.region,
            health: state.nodeMetrics[node.id]?.effectiveHealth ?? 'healthy',
          })),
          edges: architecture.edges,
          failedRegions: state.failedRegions,
          failedZones: state.failedZones,
          excludedRegions: state.pins.includes('no_second_region') ? ['us-east-1'] : [],
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
          peakRps: state.peakRps,
          budgetGbp: state.budget,
          availabilityTarget: state.availabilityTarget,
          latencyTargetMs: state.latencyTarget,
          pins: state.pins,
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
      name: 'get_constraints',
      description: 'Read applicable provider-limit and model-assumption records with source dates and provenance.',
      inputSchema: toolInputSchema({}),
      execute: () => read('get_constraints', {}, {
        constraints: architecture.id === 'event_driven_checkout'
          ? [
              { id: 'sqs-fifo-standard-unbatched', sourceType: 'model_assumption', metric: 'FIFO operations', value: 300, unit: 'operations/s', sourceDate: '2026-08-27', notes: 'Curated London bench model.' },
              { id: 'sqs-fifo-high-throughput-unbatched', sourceType: 'model_assumption', metric: 'FIFO operations', value: 4500, unit: 'operations/s', sourceDate: '2026-08-27', notes: 'Curated London bench model.' },
            ]
          : architecture.id === 'llm_inference_serving'
            ? [
                { id: 'gpu-old-capacity', sourceType: 'model_assumption', metric: 'stable model capacity', value: 120, unit: 'inference/s/replica', sourceDate: '2026-08-27' },
                { id: 'gpu-new-capacity', sourceType: 'model_assumption', metric: 'release candidate capacity', value: 80, unit: 'inference/s/replica', sourceDate: '2026-08-27' },
              ]
            : [{ id: 'regional-capacity', sourceType: 'model_assumption', metric: 'app capacity', value: 1900, unit: 'requests/s/replica', sourceDate: '2026-08-27' }],
        publicListPriceEstimate: { gbpMonth: stateFor(getState()).sim.costGbpMonth, sourceDate: '2026-08-27', assumptions: ['Curated estimate', 'Synthetic replica mix'] },
        storeVersion: getState().version,
      }),
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
      inputSchema: toolInputSchema({ id: { type: 'string' }, expectedVersion: { type: 'number' } }, ['id', 'expectedVersion']),
      execute: (input) => invoke('restore_component', { id: String(input.id) }, Number(input.expectedVersion)),
    },
  ];

  if (architecture.id === 'event_driven_checkout') {
    tools.push(
      {
        name: 'fail_zone',
        description: 'Fail a zonal runtime slice without deleting its reference nodes.',
        inputSchema: toolInputSchema({ zone: { type: 'string', enum: ['a', 'b'] }, expectedVersion: { type: 'number' } }, ['zone', 'expectedVersion']),
        execute: (input) => invoke('fail_zone', { zone: String(input.zone) }, Number(input.expectedVersion)),
      },
      {
        name: 'set_autoscaling',
        description: 'Change a declared service replica count within the loaded reference.',
        inputSchema: toolInputSchema({ id: { type: 'string' }, min: { type: 'number' }, max: { type: 'number' }, expectedVersion: { type: 'number' } }, ['id', 'min', 'max', 'expectedVersion']),
        execute: (input) => invoke('set_autoscaling', { id: String(input.id), min: Number(input.min), max: Number(input.max) }, Number(input.expectedVersion)),
      },
      {
        name: 'enable_high_throughput',
        description: 'Enable high-throughput FIFO mode while retaining ordered semantics.',
        inputSchema: toolInputSchema({ id: { type: 'string' }, enabled: { type: 'boolean' }, expectedVersion: { type: 'number' } }, ['id', 'enabled', 'expectedVersion']),
        execute: (input) => invoke('enable_high_throughput', { id: String(input.id), enabled: Boolean(input.enabled) }, Number(input.expectedVersion)),
      },
      {
        name: 'set_batching',
        description: 'Configure FIFO batching within the declared model limits.',
        inputSchema: toolInputSchema({ id: { type: 'string' }, maxBatch: { type: 'number' }, waitMs: { type: 'number' }, expectedVersion: { type: 'number' } }, ['id', 'maxBatch', 'waitMs', 'expectedVersion']),
        execute: (input) => invoke('set_batching', { id: String(input.id), maxBatch: Number(input.maxBatch), waitMs: Number(input.waitMs) }, Number(input.expectedVersion)),
      },
      {
        name: 'add_read_replica',
        description: 'Add a same-region read replica for the zonal failure path.',
        inputSchema: toolInputSchema({ id: { type: 'string' }, expectedVersion: { type: 'number' } }, ['id', 'expectedVersion']),
        execute: (input) => invoke('add_read_replica', { id: String(input.id) }, Number(input.expectedVersion)),
      },
    );
  }

  if (architecture.id === 'multi_region_saas') {
    tools.push(
      {
        name: 'fail_region',
        description: 'Fail one configured region while keeping its reference topology visible.',
        inputSchema: toolInputSchema({ region: { type: 'string', enum: ['eu-west-2', 'us-east-1'] }, expectedVersion: { type: 'number' } }, ['region', 'expectedVersion']),
        execute: (input) => invoke('fail_region', { region: String(input.region) }, Number(input.expectedVersion)),
      },
      {
        name: 'set_region_traffic_split',
        description: 'Set the primary-region traffic allocation.',
        inputSchema: toolInputSchema({ primaryPercent: { type: 'number' }, expectedVersion: { type: 'number' } }, ['primaryPercent', 'expectedVersion']),
        execute: (input) => invoke('set_region_traffic_split', { primaryPercent: Number(input.primaryPercent) }, Number(input.expectedVersion)),
      },
      {
        name: 'set_autoscaling',
        description: 'Scale a surviving regional gateway or app within the reference.',
        inputSchema: toolInputSchema({ id: { type: 'string' }, min: { type: 'number' }, max: { type: 'number' }, expectedVersion: { type: 'number' } }, ['id', 'min', 'max', 'expectedVersion']),
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
        description: 'Scale one of the GPU pools within the reference.',
        inputSchema: toolInputSchema({ id: { type: 'string' }, min: { type: 'number' }, max: { type: 'number' }, expectedVersion: { type: 'number' } }, ['id', 'min', 'max', 'expectedVersion']),
        execute: (input) => invoke('set_autoscaling', { id: String(input.id), min: Number(input.min), max: Number(input.max) }, Number(input.expectedVersion)),
      },
      {
        name: 'set_batching',
        description: 'Configure deterministic GPU batching and wait time.',
        inputSchema: toolInputSchema({ id: { type: 'string' }, maxBatch: { type: 'number' }, waitMs: { type: 'number' }, expectedVersion: { type: 'number' } }, ['id', 'maxBatch', 'waitMs', 'expectedVersion']),
        execute: (input) => invoke('set_batching', { id: String(input.id), maxBatch: Number(input.maxBatch), waitMs: Number(input.waitMs) }, Number(input.expectedVersion)),
      },
    );
  }
  return tools;
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
      if (architecture.id === 'multi_region_saas' && state.failedRegions.length === 0) next.failedRegions = ['us-east-1'];
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
      if (state.pins.includes('no_second_region') && region === 'us-east-1') return { state, result: { ok: false, code: 'PINNED_NO_SECOND_REGION', message: 'Secondary region is already excluded by a pinned human constraint.' } };
      return { state: applyMetrics({ ...state, failedRegions: Array.from(new Set([...state.failedRegions, region])), running: true, stressActive: true }, architecture), result: { region } };
    }
    if (op === 'fail_zone') {
      const zone = args.zone as 'a' | 'b';
      return { state: applyMetrics({ ...state, failedZones: Array.from(new Set([...state.failedZones, zone])), running: true, stressActive: true }, architecture), result: { zone } };
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
    if (op === 'enable_high_throughput') {
      const id = String(args.id);
      if (id !== 'sqs_fifo') return { state, result: { ok: false, code: 'ILLEGAL_MOVE', message: 'High-throughput mode is only legal for the FIFO queue.' } };
      const fifoMode = Boolean(args.enabled) ? 'high_throughput' : 'standard';
      return { state: applyMetrics({ ...state, fifoMode }, architecture), result: { fifoMode } };
    }
    if (op === 'set_batching') {
      const id = String(args.id);
      const maxBatch = Math.min(10, Math.max(1, Math.round(Number(args.maxBatch))));
      const waitMs = Math.min(100, Math.max(0, Math.round(Number(args.waitMs))));
      if (!architecture.nodes.some((node) => node.id === id)) return { state, result: { ok: false, code: 'UNKNOWN_NODE', message: `Unknown node ${id}.` } };
      return { state: applyMetrics({ ...state, fifoBatch: id === 'sqs_fifo' ? maxBatch : state.fifoBatch, batching: { ...state.batching, [id]: { maxBatch, waitMs } } }, architecture), result: { id, maxBatch, waitMs } };
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
  return (
    <div className={`topology-thumbnail ${mode}`} aria-label={`${architecture.name} topology thumbnail`}>
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
      <Link href="/" className="brand-lockup" aria-label="Resilience Forge Catalogue"><BrandMark /><span><b>RESILIENCE FORGE</b><small>REFERENCE ARCHITECTURE BENCH</small></span></Link>
        <div className="topbar-status"><span className="topbar-note">human selects the reference</span><SiteToolsLamp status="off" /></div>
      </header>

      <section className="catalogue-hero">
        <div className="hero-copy">
          <p className="eyebrow">CATALOGUE / THREE REFERENCES / ONE LIVE TRUTH</p>
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
            <div className="card-topline"><span className="card-type">REFERENCE / {architecture.scenarioLabel}</span><span className="card-index" aria-hidden="true">{architecture.id === 'event_driven_checkout' ? 'A' : architecture.id === 'multi_region_saas' ? 'B' : 'C'}</span></div>
            <TopologyThumbnail architecture={architecture} />
            <div className="reference-card-body">
              <h2>{architecture.name}</h2>
              <p className="card-job">{architecture.job}</p>
              <dl className="reference-facts">
                <div><dt>Operating shape</dt><dd>{architecture.operatingShape}</dd></div>
                <div><dt>Distinctive failure</dt><dd>{architecture.failure}</dd></div>
                <div><dt>Human interrupt</dt><dd>{architecture.interrupt}</dd></div>
              </dl>
              <Link className="load-button" href={`/bench/${architecture.id}`}><span>Load onto bench</span><span className="button-mark" aria-hidden="true" /></Link>
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

function edgeState(edge: EdgeDefinition, state: State) {
  return state.edgeMetrics[edge.id]?.health ?? 'healthy';
}

function TopologyCanvas({ architecture, state, selectedNodeId, onSelectNode }: { architecture: ArchitectureDefinition; state: State; selectedNodeId: string | null; onSelectNode: (id: string) => void }) {
  const selectedNode = architecture.nodes.find((node) => node.id === selectedNodeId);
  return (
    <div className={`graph-board ${architecture.id}`}>
      <div className="graph-board-meta"><span>LIVE PROJECTION / {architecture.eyebrow}</span><span className="graph-meta-right"><i className="pulse-ring" />{state.running ? 'SIM RUNNING' : 'BENCH READY'} / TICK {String(state.tick).padStart(3, '0')}</span></div>
      {architecture.id === 'multi_region_saas' && <><div className={`region-zone region-a ${state.failedRegions.includes('eu-west-2') ? 'failed' : ''}`}><span>EU-WEST-2 / PRIMARY</span></div><div className={`region-zone region-b ${state.failedRegions.includes('us-east-1') || state.pins.includes('no_second_region') ? 'failed' : ''}`}><span>US-EAST-1 / SECONDARY</span></div></>}
      <svg className="graph-edges" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
        <defs><marker id="edge-arrow" markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" /></marker></defs>
        {architecture.edges.map((edge) => {
          const stateClass = edgeState(edge, state);
          return <polyline key={edge.id} points={edge.points} className={`graph-edge edge-${stateClass} edge-${edge.kind}`} markerEnd="url(#edge-arrow)" />;
        })}
      </svg>
      {architecture.edges.map((edge) => {
        const status = edgeState(edge, state);
        return <span key={`${edge.id}-packet`} className={`edge-packets packets-${status} packets-${edge.kind}`} style={{ offsetPath: `path('M ${edge.points.replaceAll(' ', ' L ')}')` } as CSSProperties} aria-hidden="true"><i /><i /><i /></span>;
      })}
      {architecture.nodes.map((node) => {
        const metric = state.nodeMetrics[node.id];
        const health = metric?.effectiveHealth ?? 'healthy';
        const isSelected = node.id === selectedNodeId;
        return (
          <button key={node.id} className={`graph-node node-${health} ${accentClass[node.accent]} ${isSelected ? 'selected' : ''} ${state.lastMutation?.op.includes(node.id) ? `mutation-${state.lastMutation.source}` : ''}`} style={{ left: `${node.x}%`, top: `${node.y}%` }} onClick={() => onSelectNode(node.id)} aria-label={`Inspect ${node.name}, ${healthLabel(health)}`}>
            <span className="node-top"><span className="health-pip" data-state={healthLabel(health)} /> <span>{node.shortName}</span></span>
            <strong>{node.name}</strong>
            <span className="node-stats"><span>{metric ? `${formatNumber(metric.utilisation * 100, 0)}%` : '--'} util</span><span>{healthLabel(health)}</span></span>
          </button>
        );
      })}
      {selectedNode && <NodeInspector node={selectedNode} metric={state.nodeMetrics[selectedNode.id]} state={state} onClose={() => onSelectNode('')} />}
      <div className="graph-legend"><span><i className="legend-swatch sparse" />healthy flow</span><span><i className="legend-swatch dense" />saturated flow</span><span><i className="legend-swatch down" />down / excluded</span></div>
    </div>
  );
}

function NodeInspector({ node, metric, state, onClose }: { node: NodeDefinition; metric?: NodeMetric; state: State; onClose: () => void }) {
  return (
    <div className="node-inspector" role="dialog" aria-label={`${node.name} inspector`}>
      <div className="inspector-head"><div><span className="eyebrow">NODE INSPECTOR</span><h3>{node.name}</h3></div><button className="icon-button" onClick={onClose} aria-label="Close inspector"><span className="close-mark" aria-hidden="true" /></button></div>
      <dl><div><dt>Kind</dt><dd>{node.kind}</dd></div><div><dt>Region / zone</dt><dd>{node.region}{node.zone ? ` / ${node.zone}` : ''}</dd></div><div><dt>Replicas</dt><dd>{state.replicaOverrides[node.id] ?? node.replicas}</dd></div><div><dt>Health</dt><dd>{metric?.effectiveHealth ? healthLabel(metric.effectiveHealth) : 'OK'}</dd></div><div><dt>Demand / served</dt><dd>{metric ? `${formatNumber(metric.demandRps)} / ${formatNumber(metric.servedRps)} req/s` : '--'}</dd></div><div><dt>Capacity / headroom</dt><dd>{metric ? `${formatNumber(metric.capacity)} / ${formatNumber(Math.max(0, metric.capacity - metric.demandRps))}` : '--'}</dd></div></dl>
      {metric?.queueDepth !== undefined && <p className="inspector-note">Queue depth <b>{formatNumber(metric.queueDepth)}</b> · overflow <b>{formatNumber(metric.overflowRps ?? 0)} req/s</b></p>}
      {metric?.ttftMs !== undefined && <p className="inspector-note">TTFT <b>{formatNumber(metric.ttftMs)} ms</b> · model assumption</p>}
      <p className="inspector-source">limits / model assumption / 2026-08-27</p>
    </div>
  );
}

function MetricStrip({ state, architecture }: { state: State; architecture: ArchitectureDefinition }) {
  const metrics = [
    { label: 'Availability', value: state.stressActive ? formatPercent(state.sim.availability, 2) : '—', status: state.sim.availability >= state.availabilityTarget ? 'good' : state.stressActive ? 'bad' : 'neutral' },
    { label: architecture.id === 'llm_inference_serving' ? 'TTFT' : 'P95 latency', value: state.stressActive ? `${formatNumber(state.sim.p95Ms)} ms` : '—', status: state.sim.p95Ms <= state.latencyTarget && state.stressActive ? 'good' : state.stressActive ? 'bad' : 'neutral' },
    { label: architecture.id === 'llm_inference_serving' ? 'Overflow' : 'Error rate', value: architecture.id === 'llm_inference_serving' ? `${formatNumber(state.nodeMetrics.gpu_new?.overflowRps ?? 0)} /s` : state.stressActive ? formatPercent(state.sim.errorRate, 1) : '—', status: state.sim.errorRate === 0 && state.stressActive ? 'good' : state.stressActive ? 'bad' : 'neutral' },
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
  const stressLabel = architecture.id === 'event_driven_checkout' ? 'Run FIFO stress' : architecture.id === 'multi_region_saas' ? 'Fail us-east-1' : 'Ramp new model';
  const scenarioMetric = architecture.id === 'event_driven_checkout'
    ? { label: 'Queue pressure', value: `${formatNumber(state.nodeMetrics.sqs_fifo?.queueDepth ?? 0)} depth`, note: `${formatNumber(state.nodeMetrics.sqs_fifo?.capacity ?? 0)} msg/s cap` }
    : architecture.id === 'multi_region_saas'
      ? { label: 'Traffic split', value: `${state.regionPrimaryPercent} / ${100 - state.regionPrimaryPercent}`, note: 'primary / secondary' }
      : { label: 'New GPU', value: `${formatNumber((state.nodeMetrics.gpu_new?.utilisation ?? 0) * 100, 0)}% util`, note: `${formatNumber(state.nodeMetrics.gpu_new?.ttftMs ?? 350)} ms TTFT` };
  const pins: PinId[] = architecture.id === 'event_driven_checkout' ? ['keep_fifo_ordering', 'budget_hard'] : architecture.id === 'multi_region_saas' ? ['no_second_region', 'budget_hard'] : ['keep_old_model', 'budget_hard'];
  return (
    <aside className="scenario-rail">
      <section className="rail-section rail-heading"><div><p className="eyebrow">SCENARIO / {architecture.scenarioLabel}</p><h2>{architecture.name}</h2></div><span className="shared-state-mark">v{state.version}</span></section>
      <section className="rail-section rail-live"><div className="section-title"><span>Live controls</span><span className="human-chip">HUMAN / OPEN</span></div><p>These controls stay usable while SITE TOOLS is operating.</p><button className={`stress-button ${state.running ? 'running' : ''}`} onClick={() => state.running ? invoke('stop_stress_test', {}) : invoke('run_stress_test', { trafficMultiplier: 1 })}>{state.running ? 'Stop stress test' : stressLabel}<span className="button-mark" aria-hidden="true" /></button>
        <RangeControl label="Peak load" value={state.peakRps} min={architecture.id === 'llm_inference_serving' ? 60 : 1000} max={architecture.id === 'event_driven_checkout' ? 18000 : architecture.id === 'multi_region_saas' ? 9000 : 500} step={architecture.id === 'event_driven_checkout' ? 500 : 50} suffix=" req/s" onChange={(value) => invoke('set_peak_rps', { peakRps: value })} />
        <RangeControl label="Monthly budget" value={state.budget} min={3000} max={22000} step={100} suffix=" GBP" onChange={(value) => invoke('set_budget', { budget: value })} />
        {architecture.id === 'multi_region_saas' && <RangeControl label="Primary traffic allocation" value={state.regionPrimaryPercent} min={0} max={100} step={5} suffix="%" onChange={(value) => invoke('set_region_traffic_split', { primaryPercent: value })} />}
        {architecture.id === 'llm_inference_serving' && <RangeControl label="New model traffic" value={state.modelNewPercent} min={0} max={100} step={5} suffix="%" onChange={(value) => invoke('set_model_traffic_split', { newModelPercent: value })} />}
      </section>
      <section className="rail-section rail-pins"><div className="section-title"><span>Human pins</span><span className="pin-count">{state.pins.length} active</span></div><p>Constraints are domain invariants. The graph stays visible when a region or model is excluded.</p><div className="pin-list">{pins.map((pin) => <button key={pin} className={`pin-stamp ${state.pins.includes(pin) ? 'active' : ''}`} onClick={() => invoke('set_pin', { pin, enabled: !state.pins.includes(pin) })}><span className="pin-hole" />{pinLabel(pin)}<span className="pin-state">{state.pins.includes(pin) ? 'ON' : 'OFF'}</span></button>)}</div></section>
      <section className="rail-section rail-readout"><div className="section-title"><span>Bench readout</span><span className={`readout-status ${state.sim.sloPass ? 'good' : state.stressActive ? 'bad' : 'neutral'}`}>{state.sim.sloPass ? 'SLO PASS' : state.stressActive ? 'SLO FAIL' : 'NOT TESTED'}</span></div><div className="scenario-readout"><span>{scenarioMetric.label}</span><strong>{scenarioMetric.value}</strong><small>{scenarioMetric.note}</small></div><div className="breach-list">{state.sim.breachReasons.map((reason) => <span key={reason}>{reason}</span>)}</div></section>
      <section className="rail-section rail-tools"><div className="section-title"><span>Tool surface</span><SiteToolsLamp status={toolStatus} count={toolCount} /></div><p>{toolStatus === 'green' ? `${toolCount} architecture-specific tools registered.` : toolStatus === 'amber' ? 'Browser tools unavailable. The bench remains fully runnable.' : toolStatus === 'red' ? 'Registration needs attention.' : 'Registering on Bench.'}</p><div className="tool-note"><span className="tool-rail-mark" />same store / same version / same truth</div></section>
      <section className="rail-section provenance"><span>Model boundary</span><p>Simulation values are inspectable model assumptions. Pricing is a public list-price estimate, not a bill.</p><small>Snapshot / 2026-08-27</small></section>
    </aside>
  );
}

function FdrTicker({ entries }: { entries: FdrEntry[] }) {
  const visible = entries.slice(-7);
  return <footer className="fdr-ticker" aria-live="polite"><div className="fdr-label"><span className="fdr-signal" /> <b>FDR</b><small>FLIGHT DATA RECORDER</small></div><div className="fdr-entries">{visible.map((entry, index) => <div className={`fdr-entry ${index === visible.length - 1 ? 'latest' : ''}`} key={`${entry.ts}-${entry.op}-${index}`}><span className={`fdr-source ${sourceClass[entry.source]}`}>{entry.source}</span><span className="fdr-time">{entry.ts}</span><code>{entry.op} {compactArgs(entry.args)}</code><span className="fdr-version">v{entry.beforeVersion}&gt;{entry.afterVersion}</span><b className={`fdr-code code-${entry.resultCode.toLowerCase()}`}>{entry.resultCode}</b></div>)}</div></footer>;
}

function BenchView({ architectureId }: { architectureId: string }) {
  const architecture = getArchitecture(architectureId);
  const [state, setState] = useState<State>(() => createInitialState(architecture));
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
    try {
      const raw = localStorage.getItem(`resilience-forge:controls:${architecture.id}`);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<State>;
      const next = applyMetrics({ ...stateRef.current, peakRps: saved.peakRps ?? stateRef.current.peakRps, budget: saved.budget ?? stateRef.current.budget, regionPrimaryPercent: saved.regionPrimaryPercent ?? stateRef.current.regionPrimaryPercent, modelNewPercent: saved.modelNewPercent ?? stateRef.current.modelNewPercent, pins: saved.pins ?? stateRef.current.pins }, architecture);
      commit(next);
    } catch {
      // Ignore malformed local preferences.
    }
  }, [architecture, commit]);

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
      <header className="topbar bench-topbar"><Link href="/" className="back-link"><span className="back-mark" aria-hidden="true" />Catalogue</Link><div className="bench-title"><BrandMark /><span><b>RESILIENCE FORGE</b><small>{architecture.name.toUpperCase()} / LIVE BENCH</small></span></div><div className="topbar-status"><span className="version-readout">SHARED STATE / v{state.version}</span><SiteToolsLamp status={toolStatus} count={toolCount} /></div></header>
      <div className="bench-layout">
        <section className="bench-canvas-column"><div className="bench-intro"><div><p className="eyebrow">LIVE BENCH / {architecture.scenarioLabel}</p><h1>{architecture.name}</h1><p>{architecture.job}</p></div><div className="bench-stamp"><span>REFERENCE</span><strong>{architecture.id}</strong><small>human-loaded / externally operable</small></div></div><div className="canvas-panel"><TopologyCanvas architecture={architecture} state={state} selectedNodeId={selectedNodeId} onSelectNode={(id) => setSelectedNodeId(id || null)} /></div><MetricStrip state={state} architecture={architecture} /><div className="proof-band"><div><strong>One bench. Two operators. No silent overwrite.</strong><p>Change a normal control while tools are active. The version moves, the stale write is rejected, and the next legal move has to read the new state.</p></div><div className="proof-mark"><span className="proof-square" /><span>live controls stay open</span></div></div></section>
        <ScenarioRail architecture={architecture} state={state} toolStatus={toolStatus} toolCount={toolCount} invoke={invoke} />
      </div>
      <FdrTicker entries={state.log} />
      {selectedNode && <span className="sr-only">{selectedNode.name} selected</span>}
    </main>
  );
}

export default function ResilienceForge({ view, architectureId }: { view: 'catalogue' | 'bench'; architectureId?: string }) {
  return view === 'bench' ? <BenchView architectureId={architectureId ?? 'event_driven_checkout'} /> : <CatalogueView />;
}
