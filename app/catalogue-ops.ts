import { architectures, getArchitecture, type ArchitectureId } from './data.ts';

export const CATALOGUE_SESSION = 'catalogue';
export const SITE_SESSION = 'resilience-forge';

export type SiteRoute =
  | { view: 'catalogue' }
  | { view: 'bench'; architectureId: string };

export function routeFromPath(pathname: string): SiteRoute {
  const path = (pathname.split('?')[0] ?? '/').replace(/\/+$/, '') || '/';
  const match = path.match(/^\/bench\/([^/]+)$/);
  if (match?.[1]) return { view: 'bench', architectureId: decodeURIComponent(match[1]) };
  return { view: 'catalogue' };
}

export function navigateSite(href: string) {
  if (typeof window === 'undefined') return href;
  const url = new URL(href, window.location.origin);
  if (url.origin !== window.location.origin) {
    window.location.assign(url.href);
    return url.href;
  }
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.pushState({}, '', next);
  window.dispatchEvent(new PopStateEvent('popstate'));
  return url.pathname;
}

const ALIASES: Record<string, ArchitectureId> = {
  a: 'event_driven_checkout',
  checkout: 'event_driven_checkout',
  order: 'event_driven_checkout',
  pubsub: 'event_driven_checkout',
  ordering: 'event_driven_checkout',
  'event driven checkout': 'event_driven_checkout',
  'event-driven checkout': 'event_driven_checkout',
  b: 'multi_region_saas',
  saas: 'multi_region_saas',
  'multi region': 'multi_region_saas',
  'multi-region': 'multi_region_saas',
  'multi region saas': 'multi_region_saas',
  c: 'llm_inference_serving',
  llm: 'llm_inference_serving',
  inference: 'llm_inference_serving',
  vertex: 'llm_inference_serving',
  canary: 'llm_inference_serving',
  'llm inference': 'llm_inference_serving',
};

export function catalogueCards() {
  return architectures.map((architecture) => ({
    id: architecture.id,
    name: architecture.name,
    job: architecture.job,
    failure: architecture.failure,
    operatingShape: architecture.operatingShape,
    benchHref: `/bench/${architecture.id}`,
  }));
}

export function resolveCatalogueSelection(query: string | undefined) {
  const raw = (query ?? '').trim().toLowerCase().replaceAll('_', ' ').replace(/\s+/g, ' ');
  if (!raw) return undefined;
  const asId = raw.replaceAll(' ', '_').replaceAll('-', '_');
  const byId = getArchitecture(asId);
  if (byId) return byId;
  const aliased = ALIASES[raw] ?? ALIASES[asId.replaceAll('_', ' ')];
  if (aliased) return getArchitecture(aliased);
  return architectures.find((architecture) => architecture.name.toLowerCase() === raw);
}

export function loadArchitectureHref(id: ArchitectureId) {
  return `/bench/${id}`;
}
