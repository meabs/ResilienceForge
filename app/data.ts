export type ArchitectureId =
  | 'event_driven_checkout'
  | 'multi_region_saas'
  | 'llm_inference_serving';

export type Region = 'europe-west2' | 'us-east4';
export type Health = 'healthy' | 'degraded' | 'down';
export type PinId =
  | 'keep_pubsub_ordering'
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
  platform: 'GCP';
  name: string;
  eyebrow: string;
  referenceSpec: string;
  referenceUrl: string;
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
    platform: 'GCP',
    name: 'Event-driven checkout',
    eyebrow: 'ORDER / EVENT / ORDERING KEY',
    referenceSpec: 'Pub/Sub ordering keys are limited to 1 MBps per key, with ordering guaranteed for the same key in the same region when enabled on the subscription.',
    referenceUrl: 'https://docs.cloud.google.com/pubsub/docs/ordering',
    job: 'Keep order events in sequence while demand arrives in bursts.',
    operatingShape: '10k requests/s · Pub/Sub ordering keys · europe-west2',
    failure: 'Ordering-key throughput ceiling',
    interrupt: 'Raise Peak RPS or change the budget while Pub/Sub remediation is in flight.',
    accent: 'orange',
    scenarioLabel: 'ORDER PIPELINE',
    defaultPeakRps: 10000,
    defaultBudget: 9400,
    defaultLatencyTarget: 650,
    defaultAvailabilityTarget: 0.999,
    nodes: [
      { id: 'web_client', kind: 'client', name: 'Web client', shortName: 'WEB', region: 'europe-west2', replicas: 1, capacityPerReplica: 30000, legalRemediations: [], x: 13, y: 45, accent: 'cyan' },
      { id: 'api_gateway', kind: 'gateway', name: 'API Gateway', shortName: 'API', region: 'europe-west2', replicas: 2, capacityPerReplica: 8000, legalRemediations: ['set_autoscaling'], x: 28, y: 45, accent: 'cyan' },
      { id: 'cloud_run_order', kind: 'service', name: 'Cloud Run / Order', shortName: 'RUN / ORDER', region: 'europe-west2', zone: 'a', replicas: 2, capacityPerReplica: 6500, legalRemediations: ['set_autoscaling'], x: 44, y: 45, accent: 'orange' },
      { id: 'pubsub_ordered', kind: 'queue', name: 'Pub/Sub ordered subscription', shortName: 'PUB/SUB', region: 'europe-west2', zone: 'b', replicas: 1, capacityPerReplica: 300, legalRemediations: ['set_ordering_key_parallelism', 'set_batching'], x: 62, y: 45, accent: 'orange' },
      { id: 'cloud_run_payment', kind: 'service', name: 'Cloud Run / Payment', shortName: 'RUN / PAY', region: 'europe-west2', zone: 'b', replicas: 2, capacityPerReplica: 6000, legalRemediations: ['set_autoscaling'], x: 82, y: 45, accent: 'acid' },
      { id: 'cloud_sql', kind: 'db', name: 'Cloud SQL for PostgreSQL', shortName: 'CLOUD SQL', region: 'europe-west2', zone: 'a', replicas: 1, capacityPerReplica: 12000, legalRemediations: ['add_read_replica', 'restore_component'], x: 44, y: 76, accent: 'violet' },
      { id: 'memorystore', kind: 'cache', name: 'Memorystore for Redis', shortName: 'MEMORYSTORE', region: 'europe-west2', zone: 'b', replicas: 1, capacityPerReplica: 18000, legalRemediations: ['set_autoscaling'], x: 62, y: 76, accent: 'cyan' },
    ],
    edges: [
      { id: 'checkout-client-api', from: 'web_client', to: 'api_gateway', kind: 'sync', points: '90,300 190,300' },
      { id: 'checkout-api-order', from: 'api_gateway', to: 'cloud_run_order', kind: 'sync', points: '250,300 390,300' },
      { id: 'checkout-order-pubsub', from: 'cloud_run_order', to: 'pubsub_ordered', kind: 'async', points: '450,300 600,300' },
      { id: 'checkout-pubsub-payment', from: 'pubsub_ordered', to: 'cloud_run_payment', kind: 'async', points: '660,300 810,300' },
      { id: 'checkout-order-db', from: 'cloud_run_order', to: 'cloud_sql', kind: 'sync', points: '420,340 420,465' },
      { id: 'checkout-order-cache', from: 'cloud_run_order', to: 'memorystore', kind: 'sync', points: '460,340 635,465' },
    ],
  },
  {
    id: 'multi_region_saas',
    platform: 'GCP',
    name: 'Multi-region SaaS',
    eyebrow: 'ACTIVE / ACTIVE / CLOUD RUN',
    referenceSpec: 'Cloud Run services are regional; a global external Application Load Balancer with regional serverless NEGs can route traffic across regions, with health checks enabling failover away from an unhealthy service.',
    referenceUrl: 'https://docs.cloud.google.com/run/docs/multiple-regions?hl=en',
    job: 'Keep a service available when a whole region disappears.',
    operatingShape: '50 / 50 traffic · Cloud Run in two regions · 99.95% SLO',
    failure: 'Regional Cloud Run loss and traffic rebalance',
    interrupt: 'Move the primary traffic allocation while the surviving Cloud Run service scales.',
    accent: 'cyan',
    scenarioLabel: 'REGION PAIR',
    defaultPeakRps: 4200,
    defaultBudget: 11800,
    defaultLatencyTarget: 420,
    defaultAvailabilityTarget: 0.9995,
    nodes: [
      { id: 'global_alb', kind: 'edge', name: 'Global external ALB', shortName: 'GLOBAL ALB', region: 'europe-west2', replicas: 1, capacityPerReplica: 20000, legalRemediations: ['set_region_traffic_split'], x: 14, y: 45, accent: 'cyan' },
      { id: 'cloud_run_europe', kind: 'gateway', name: 'Cloud Run ingress / europe-west2', shortName: 'RUN / EU', region: 'europe-west2', replicas: 2, capacityPerReplica: 2100, legalRemediations: ['set_autoscaling'], x: 31, y: 30, accent: 'cyan' },
      { id: 'cloud_run_us', kind: 'gateway', name: 'Cloud Run ingress / us-east4', shortName: 'RUN / US', region: 'us-east4', replicas: 2, capacityPerReplica: 2100, legalRemediations: ['set_autoscaling'], x: 31, y: 64, accent: 'cyan' },
      { id: 'app_europe', kind: 'service', name: 'Cloud Run app / europe-west2', shortName: 'APP / EU', region: 'europe-west2', replicas: 2, capacityPerReplica: 1900, legalRemediations: ['set_autoscaling'], x: 52, y: 30, accent: 'acid' },
      { id: 'app_us', kind: 'service', name: 'Cloud Run app / us-east4', shortName: 'APP / US', region: 'us-east4', replicas: 2, capacityPerReplica: 1900, legalRemediations: ['set_autoscaling'], x: 52, y: 64, accent: 'acid' },
      { id: 'cloud_sql_primary', kind: 'db', name: 'Cloud SQL primary', shortName: 'SQL / EU', region: 'europe-west2', zone: 'a', replicas: 1, capacityPerReplica: 12000, legalRemediations: ['restore_component'], x: 74, y: 30, accent: 'violet' },
      { id: 'cloud_sql_replica', kind: 'db', name: 'Cloud SQL cross-region replica', shortName: 'SQL / US', region: 'us-east4', zone: 'a', replicas: 1, capacityPerReplica: 12000, legalRemediations: ['restore_component'], x: 74, y: 64, accent: 'violet' },
      { id: 'memorystore', kind: 'cache', name: 'Memorystore for Redis', shortName: 'MEMORYSTORE', region: 'europe-west2', replicas: 2, capacityPerReplica: 12000, legalRemediations: [], x: 86, y: 47, accent: 'orange' },
    ],
    edges: [
      { id: 'region-alb-europe', from: 'global_alb', to: 'cloud_run_europe', kind: 'sync', points: '105,300 280,195' },
      { id: 'region-alb-us', from: 'global_alb', to: 'cloud_run_us', kind: 'sync', points: '105,300 280,405' },
      { id: 'region-ingress-app-europe', from: 'cloud_run_europe', to: 'app_europe', kind: 'sync', points: '340,195 510,195' },
      { id: 'region-ingress-app-us', from: 'cloud_run_us', to: 'app_us', kind: 'sync', points: '340,405 510,405' },
      { id: 'region-app-sql-europe', from: 'app_europe', to: 'cloud_sql_primary', kind: 'sync', points: '570,195 755,195' },
      { id: 'region-app-sql-us', from: 'app_us', to: 'cloud_sql_replica', kind: 'sync', points: '570,405 755,405' },
      { id: 'region-sql-cache-europe', from: 'cloud_sql_primary', to: 'memorystore', kind: 'async', points: '820,215 900,300' },
      { id: 'region-sql-cache-us', from: 'cloud_sql_replica', to: 'memorystore', kind: 'async', points: '820,385 900,300' },
    ],
  },
  {
    id: 'llm_inference_serving',
    platform: 'GCP',
    name: 'LLM inference serving',
    eyebrow: 'RELEASE / SPLIT / VERTEX AI',
    referenceSpec: 'Vertex AI endpoint traffic splits map deployed models to percentages that must total 100; private endpoints do not support traffic splitting.',
    referenceUrl: 'https://docs.cloud.google.com/vertex-ai/docs/reference/rpc/google.cloud.aiplatform.v1',
    job: 'Ramp a release candidate without losing time-to-first-token.',
    operatingShape: '80 / 20 model split · Vertex AI endpoints · overflow watched',
    failure: 'Vertex AI release endpoint saturation and overflow',
    interrupt: 'Change Vertex AI release traffic while the candidate is stabilising.',
    accent: 'acid',
    scenarioLabel: 'MODEL RAMP',
    defaultPeakRps: 180,
    defaultBudget: 15200,
    defaultLatencyTarget: 900,
    defaultAvailabilityTarget: 0.998,
    nodes: [
      { id: 'clients', kind: 'client', name: 'Clients', shortName: 'CLIENTS', region: 'europe-west2', replicas: 1, capacityPerReplica: 1000, legalRemediations: [], x: 13, y: 45, accent: 'cyan' },
      { id: 'api_gateway', kind: 'gateway', name: 'API Gateway', shortName: 'API', region: 'europe-west2', replicas: 2, capacityPerReplica: 220, legalRemediations: ['set_autoscaling'], x: 29, y: 45, accent: 'cyan' },
      { id: 'cloud_run_router', kind: 'service', name: 'Cloud Run / Model router', shortName: 'RUN / ROUTER', region: 'europe-west2', replicas: 2, capacityPerReplica: 220, legalRemediations: ['set_autoscaling'], x: 45, y: 45, accent: 'orange' },
      { id: 'vertex_stable', kind: 'gpu', name: 'Vertex AI endpoint / stable', shortName: 'VERTEX / STABLE', region: 'europe-west2', replicas: 2, capacityPerReplica: 120, legalRemediations: ['set_autoscaling', 'set_batching'], x: 64, y: 28, accent: 'cyan' },
      { id: 'vertex_rc', kind: 'gpu', name: 'Vertex AI endpoint / release candidate', shortName: 'VERTEX / RC', region: 'europe-west2', replicas: 1, capacityPerReplica: 80, legalRemediations: ['set_autoscaling', 'set_batching', 'set_model_traffic_split'], x: 64, y: 63, accent: 'acid' },
      { id: 'memorystore', kind: 'cache', name: 'Memorystore for Redis / KV cache', shortName: 'MEMORYSTORE', region: 'europe-west2', replicas: 2, capacityPerReplica: 350, legalRemediations: ['set_autoscaling'], x: 84, y: 28, accent: 'violet' },
      { id: 'pubsub_overflow', kind: 'queue', name: 'Pub/Sub overflow subscription', shortName: 'PUB/SUB', region: 'europe-west2', replicas: 1, capacityPerReplica: 1000, legalRemediations: ['set_batching'], x: 84, y: 63, accent: 'orange' },
    ],
    edges: [
      { id: 'llm-client-api', from: 'clients', to: 'api_gateway', kind: 'sync', points: '100,300 260,300' },
      { id: 'llm-api-router', from: 'api_gateway', to: 'cloud_run_router', kind: 'sync', points: '320,300 430,300' },
      { id: 'llm-router-stable', from: 'cloud_run_router', to: 'vertex_stable', kind: 'sync', points: '490,280 630,185' },
      { id: 'llm-router-rc', from: 'cloud_run_router', to: 'vertex_rc', kind: 'sync', points: '490,320 630,390' },
      { id: 'llm-stable-cache', from: 'vertex_stable', to: 'memorystore', kind: 'async', points: '690,185 840,185' },
      { id: 'llm-rc-overflow', from: 'vertex_rc', to: 'pubsub_overflow', kind: 'async', points: '690,390 840,390' },
    ],
  },
];

export const getArchitecture = (id: string | undefined) =>
  architectures.find((architecture) => architecture.id === id) ?? architectures[0];

export const limits = {
  checkoutStandardUnbatched: { id: 'pubsub-ordered-key-standard', sourceType: 'model_assumption', value: 300, unit: 'events/s', sourceDate: '2026-08-27', notes: 'Synthetic GCP ordering-key bench model based on a 3.3 KB event profile.' },
  checkoutHighThroughputUnbatched: { id: 'pubsub-ordered-key-parallel', sourceType: 'model_assumption', value: 4500, unit: 'events/s', sourceDate: '2026-08-27', notes: 'Synthetic 15-key parallelism model; the provider constraint remains 1 MBps per ordering key.' },
  gpuOldPerReplica: { id: 'vertex-ai-stable-capacity', sourceType: 'model_assumption', value: 120, unit: 'inference/s', sourceDate: '2026-08-27', notes: 'Synthetic Vertex AI serving model.' },
  gpuNewPerReplica: { id: 'vertex-ai-release-capacity', sourceType: 'model_assumption', value: 80, unit: 'inference/s', sourceDate: '2026-08-27', notes: 'Synthetic Vertex AI serving model.' },
} as const;

export const prices = {
  baseline: { provider: 'gcp', region: 'europe-west2', unit: 'GBP/month', gbpEstimate: 4200, sourceDate: '2026-08-27', assumptions: ['Curated public list-price estimate', 'Synthetic Cloud Run / Cloud SQL / Vertex AI mix'] },
} as const;
