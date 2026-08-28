import type { ArchitectureDefinition, ArchitectureId, Region } from './data.ts';

const REGION_ALIASES: Record<string, Region> = {
  'europe-west2': 'europe-west2',
  'europe west2': 'europe-west2',
  europewest2: 'europe-west2',
  west2: 'europe-west2',
  'west-2': 'europe-west2',
  eu: 'europe-west2',
  europe: 'europe-west2',
  'us-east4': 'us-east4',
  'us east4': 'us-east4',
  east4: 'us-east4',
  'east-4': 'us-east4',
  us: 'us-east4',
};

const REGIONAL_BOUNDARIES: Record<ArchitectureId, Partial<Record<Region, string[]>>> = {
  event_driven_checkout: { 'europe-west2': ['checkout-client-api'] },
  multi_region_saas: {
    'europe-west2': ['region-alb-europe'],
    'us-east4': ['region-alb-us'],
  },
  llm_inference_serving: { 'europe-west2': ['llm-client-api'] },
};

export function resolveRegion(query: string | undefined): Region | undefined {
  const raw = (query ?? '').trim().toLowerCase().replaceAll('_', '-').replace(/\s+/g, ' ');
  if (!raw) return undefined;
  return REGION_ALIASES[raw] ?? REGION_ALIASES[raw.replaceAll(' ', '-')] ?? REGION_ALIASES[raw.replaceAll('-', '')];
}

export function regionalBoundaryTargets(architecture: ArchitectureDefinition, region: Region) {
  const targetIds = REGIONAL_BOUNDARIES[architecture.id][region] ?? [];
  const known = new Set([...architecture.nodes.map((node) => node.id), ...architecture.edges.map((edge) => edge.id)]);
  return targetIds.filter((id) => known.has(id));
}

export function regionForTarget(architecture: ArchitectureDefinition, targetId: string): Region | undefined {
  const node = architecture.nodes.find((item) => item.id === targetId);
  if (node) return node.region;
  const mapped = Object.entries(REGIONAL_BOUNDARIES[architecture.id]).find(([, ids]) => ids?.includes(targetId));
  if (mapped) return mapped[0] as Region;
  const edge = architecture.edges.find((item) => item.id === targetId);
  if (!edge) return undefined;
  return architecture.nodes.find((item) => item.id === edge.to)?.region;
}
