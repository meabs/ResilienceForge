export type ArchitectureId =
  | 'event_driven_checkout'
  | 'multi_region_saas'
  | 'llm_inference_serving';

export type Region = 'eu-west-2' | 'us-east-1';
export type Health = 'healthy' | 'degraded' | 'down';
export type PinId =
  | 'keep_fifo_ordering'
  | 'no_second_region'
  | 'keep_old_model'
  | 'budget_hard';
export type NodeKind =
  | 'client'
  | 'edge'
  | 'gateway'
  | 'service'
  | 'queue'
  | 'db'
  | 'cache'
  | 'gpu';

export interface NodeDefinition {
  id: string;
  kind: NodeKind;
  name: string;
  shortName: string;
  region: Region;
  zone?: 'a' | 'b';
  replicas: number;
  capacityPerReplica: number;
  legalRemediations: string[];
  x: number;
  y: number;
  accent: 'orange' | 'acid' | 'cyan' | 'violet';
}

export interface EdgeDefinition {
  id: string;
  from: string;
  to: string;
  kind: 'sync' | 'async';
  points: string;
}

export interface ArchitectureDefinition {
  id: ArchitectureId;
  name: string;
  eyebrow: string;
  job: string;
  operatingShape: string;
  failure: string;
  interrupt: string;
  accent: 'orange' | 'cyan' | 'acid';
  scenarioLabel: string;
  defaultPeakRps: number;
  defaultBudget: number;
  defaultLatencyTarget: number;
  defaultAvailabilityTarget: number;
  nodes: NodeDefinition[];
  edges: EdgeDefinition[];
}

export const architectures: ArchitectureDefinition[] = [
  {
    id: 'event_driven_checkout',
    name: 'Event-driven checkout',
    eyebrow: 'ORDER / EVENT / FIFO',
    job: 'Keep order events in sequence while demand arrives in bursts.',
    operatingShape: '10k requests/s · ordered events · London',
    failure: 'FIFO throughput ceiling',
    interrupt: 'Raise Peak RPS or change the budget while remediation is in flight.',
    accent: 'orange',
    scenarioLabel: 'ORDER PIPELINE',
    defaultPeakRps: 10000,
    defaultBudget: 9400,
    defaultLatencyTarget: 650,
    defaultAvailabilityTarget: 0.999,
    nodes: [
      { id: 'web_client', kind: 'client', name: 'Web client', shortName: 'WEB', region: 'eu-west-2', replicas: 1, capacityPerReplica: 30000, legalRemediations: [], x: 13, y: 45, accent: 'cyan' },
      { id: 'api_gateway', kind: 'gateway', name: 'API gateway', shortName: 'API', region: 'eu-west-2', replicas: 2, capacityPerReplica: 8000, legalRemediations: ['set_autoscaling'], x: 28, y: 45, accent: 'cyan' },
      { id: 'order_service', kind: 'service', name: 'Order service', shortName: 'ORDER', region: 'eu-west-2', zone: 'a', replicas: 2, capacityPerReplica: 6500, legalRemediations: ['set_autoscaling'], x: 44, y: 45, accent: 'orange' },
      { id: 'sqs_fifo', kind: 'queue', name: 'SQS FIFO', shortName: 'FIFO', region: 'eu-west-2', zone: 'b', replicas: 1, capacityPerReplica: 300, legalRemediations: ['enable_high_throughput', 'set_batching'], x: 62, y: 45, accent: 'orange' },
      { id: 'payment_service', kind: 'service', name: 'Payment service', shortName: 'PAY', region: 'eu-west-2', zone: 'b', replicas: 2, capacityPerReplica: 6000, legalRemediations: ['set_autoscaling'], x: 82, y: 45, accent: 'acid' },
      { id: 'postgres_primary', kind: 'db', name: 'Postgres primary', shortName: 'DB', region: 'eu-west-2', zone: 'a', replicas: 1, capacityPerReplica: 12000, legalRemediations: ['add_read_replica', 'restore_component'], x: 44, y: 76, accent: 'violet' },
      { id: 'redis', kind: 'cache', name: 'Redis cache', shortName: 'CACHE', region: 'eu-west-2', zone: 'b', replicas: 1, capacityPerReplica: 18000, legalRemediations: ['set_autoscaling'], x: 62, y: 76, accent: 'cyan' },
    ],
    edges: [
      { id: 'checkout-client-api', from: 'web_client', to: 'api_gateway', kind: 'sync', points: '90,300 190,300' },
      { id: 'checkout-api-order', from: 'api_gateway', to: 'order_service', kind: 'sync', points: '250,300 390,300' },
      { id: 'checkout-order-fifo', from: 'order_service', to: 'sqs_fifo', kind: 'async', points: '450,300 600,300' },
      { id: 'checkout-fifo-payment', from: 'sqs_fifo', to: 'payment_service', kind: 'async', points: '660,300 810,300' },
      { id: 'checkout-order-db', from: 'order_service', to: 'postgres_primary', kind: 'sync', points: '420,340 420,465' },
      { id: 'checkout-order-cache', from: 'order_service', to: 'redis', kind: 'sync', points: '460,340 635,465' },
    ],
  },
  {
    id: 'multi_region_saas',
    name: 'Multi-region SaaS',
    eyebrow: 'ACTIVE / ACTIVE / REGION',
    job: 'Keep a service available when a whole region disappears.',
    operatingShape: '50 / 50 traffic · active-active · 99.95% SLO',
    failure: 'Regional loss and traffic rebalance',
    interrupt: 'Move the primary traffic allocation while the surviving region scales.',
    accent: 'cyan',
    scenarioLabel: 'REGION PAIR',
    defaultPeakRps: 4200,
    defaultBudget: 11800,
    defaultLatencyTarget: 420,
    defaultAvailabilityTarget: 0.9995,
    nodes: [
      { id: 'edge', kind: 'edge', name: 'Global edge', shortName: 'EDGE', region: 'eu-west-2', replicas: 1, capacityPerReplica: 20000, legalRemediations: ['set_region_traffic_split'], x: 14, y: 45, accent: 'cyan' },
      { id: 'gateway_a', kind: 'gateway', name: 'Gateway A', shortName: 'GW-A', region: 'eu-west-2', replicas: 2, capacityPerReplica: 2100, legalRemediations: ['set_autoscaling'], x: 31, y: 30, accent: 'cyan' },
      { id: 'gateway_b', kind: 'gateway', name: 'Gateway B', shortName: 'GW-B', region: 'us-east-1', replicas: 2, capacityPerReplica: 2100, legalRemediations: ['set_autoscaling'], x: 31, y: 64, accent: 'cyan' },
      { id: 'app_a', kind: 'service', name: 'App A', shortName: 'APP-A', region: 'eu-west-2', replicas: 2, capacityPerReplica: 1900, legalRemediations: ['set_autoscaling'], x: 52, y: 30, accent: 'acid' },
      { id: 'app_b', kind: 'service', name: 'App B', shortName: 'APP-B', region: 'us-east-1', replicas: 2, capacityPerReplica: 1900, legalRemediations: ['set_autoscaling'], x: 52, y: 64, accent: 'acid' },
      { id: 'postgres_primary', kind: 'db', name: 'Postgres primary', shortName: 'DB-A', region: 'eu-west-2', zone: 'a', replicas: 1, capacityPerReplica: 12000, legalRemediations: ['restore_component'], x: 74, y: 30, accent: 'violet' },
      { id: 'postgres_replica', kind: 'db', name: 'Postgres replica', shortName: 'DB-B', region: 'us-east-1', zone: 'a', replicas: 1, capacityPerReplica: 12000, legalRemediations: ['restore_component'], x: 74, y: 64, accent: 'violet' },
      { id: 'redis_global', kind: 'cache', name: 'Redis global', shortName: 'CACHE', region: 'eu-west-2', replicas: 2, capacityPerReplica: 12000, legalRemediations: [], x: 86, y: 47, accent: 'orange' },
    ],
    edges: [
      { id: 'region-edge-a', from: 'edge', to: 'gateway_a', kind: 'sync', points: '105,300 280,195' },
      { id: 'region-edge-b', from: 'edge', to: 'gateway_b', kind: 'sync', points: '105,300 280,405' },
      { id: 'region-gateway-app-a', from: 'gateway_a', to: 'app_a', kind: 'sync', points: '340,195 510,195' },
      { id: 'region-gateway-app-b', from: 'gateway_b', to: 'app_b', kind: 'sync', points: '340,405 510,405' },
      { id: 'region-app-db-a', from: 'app_a', to: 'postgres_primary', kind: 'sync', points: '570,195 755,195' },
      { id: 'region-app-db-b', from: 'app_b', to: 'postgres_replica', kind: 'sync', points: '570,405 755,405' },
      { id: 'region-db-cache', from: 'postgres_primary', to: 'redis_global', kind: 'async', points: '820,215 900,300' },
      { id: 'region-replica-cache', from: 'postgres_replica', to: 'redis_global', kind: 'async', points: '820,385 900,300' },
    ],
  },
  {
    id: 'llm_inference_serving',
    name: 'LLM inference serving',
    eyebrow: 'RELEASE / SPLIT / TTFT',
    job: 'Ramp a release candidate without losing time-to-first-token.',
    operatingShape: '80 / 20 model split · GPU pools · overflow watched',
    failure: 'New-model GPU saturation and overflow',
    interrupt: 'Change New model traffic while the release candidate is stabilising.',
    accent: 'acid',
    scenarioLabel: 'MODEL RAMP',
    defaultPeakRps: 180,
    defaultBudget: 15200,
    defaultLatencyTarget: 900,
    defaultAvailabilityTarget: 0.998,
    nodes: [
      { id: 'clients', kind: 'client', name: 'Clients', shortName: 'CLIENTS', region: 'eu-west-2', replicas: 1, capacityPerReplica: 1000, legalRemediations: [], x: 13, y: 45, accent: 'cyan' },
      { id: 'api_gateway', kind: 'gateway', name: 'API gateway', shortName: 'API', region: 'eu-west-2', replicas: 2, capacityPerReplica: 220, legalRemediations: ['set_autoscaling'], x: 29, y: 45, accent: 'cyan' },
      { id: 'router', kind: 'service', name: 'Model router', shortName: 'ROUTER', region: 'eu-west-2', replicas: 2, capacityPerReplica: 220, legalRemediations: ['set_autoscaling'], x: 45, y: 45, accent: 'orange' },
      { id: 'gpu_old', kind: 'gpu', name: 'Stable model pool', shortName: 'OLD / STABLE', region: 'eu-west-2', replicas: 2, capacityPerReplica: 120, legalRemediations: ['set_autoscaling', 'set_batching'], x: 64, y: 28, accent: 'cyan' },
      { id: 'gpu_new', kind: 'gpu', name: 'Release candidate pool', shortName: 'NEW / RC', region: 'eu-west-2', replicas: 1, capacityPerReplica: 80, legalRemediations: ['set_autoscaling', 'set_batching', 'set_model_traffic_split'], x: 64, y: 63, accent: 'acid' },
      { id: 'kv_cache', kind: 'cache', name: 'KV cache', shortName: 'KV CACHE', region: 'eu-west-2', replicas: 2, capacityPerReplica: 350, legalRemediations: ['set_autoscaling'], x: 84, y: 28, accent: 'violet' },
      { id: 'overflow_queue', kind: 'queue', name: 'Overflow queue', shortName: 'OVERFLOW', region: 'eu-west-2', replicas: 1, capacityPerReplica: 1000, legalRemediations: ['set_batching'], x: 84, y: 63, accent: 'orange' },
    ],
    edges: [
      { id: 'llm-client-api', from: 'clients', to: 'api_gateway', kind: 'sync', points: '100,300 260,300' },
      { id: 'llm-api-router', from: 'api_gateway', to: 'router', kind: 'sync', points: '320,300 430,300' },
      { id: 'llm-router-old', from: 'router', to: 'gpu_old', kind: 'sync', points: '490,280 630,185' },
      { id: 'llm-router-new', from: 'router', to: 'gpu_new', kind: 'sync', points: '490,320 630,390' },
      { id: 'llm-old-cache', from: 'gpu_old', to: 'kv_cache', kind: 'async', points: '690,185 840,185' },
      { id: 'llm-new-overflow', from: 'gpu_new', to: 'overflow_queue', kind: 'async', points: '690,390 840,390' },
    ],
  },
];

export const getArchitecture = (id: string | undefined) =>
  architectures.find((architecture) => architecture.id === id) ?? architectures[0];

export const limits = {
  checkoutStandardUnbatched: { id: 'sqs-fifo-standard-unbatched', sourceType: 'model_assumption', value: 300, unit: 'operations/s', sourceDate: '2026-08-27', notes: 'Curated London bench model.' },
  checkoutHighThroughputUnbatched: { id: 'sqs-fifo-high-throughput-unbatched', sourceType: 'model_assumption', value: 4500, unit: 'operations/s', sourceDate: '2026-08-27', notes: 'Curated London bench model.' },
  gpuOldPerReplica: { id: 'gpu-old-capacity', sourceType: 'model_assumption', value: 120, unit: 'inference/s', sourceDate: '2026-08-27', notes: 'Synthetic serving model.' },
  gpuNewPerReplica: { id: 'gpu-new-capacity', sourceType: 'model_assumption', value: 80, unit: 'inference/s', sourceDate: '2026-08-27', notes: 'Synthetic serving model.' },
} as const;

export const prices = {
  baseline: { provider: 'aws', region: 'eu-west-2', unit: 'GBP/month', gbpEstimate: 4200, sourceDate: '2026-08-27', assumptions: ['Curated public list-price estimate', 'Synthetic replica mix'] },
} as const;
