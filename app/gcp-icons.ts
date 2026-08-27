import type { NodeKind } from './data';

const iconByKind: Record<NodeKind, string> = {
  client: '/gcp-icons/web-mobile.svg',
  edge: '/gcp-icons/networking.svg',
  gateway: '/gcp-icons/integration.svg',
  service: '/gcp-icons/serverless.svg',
  queue: '/gcp-icons/integration.svg',
  db: '/gcp-icons/databases.svg',
  cache: '/gcp-icons/databases.svg',
  gpu: '/gcp-icons/ai-ml.svg',
};

export function gcpIconFor(kind: NodeKind) {
  return iconByKind[kind];
}
