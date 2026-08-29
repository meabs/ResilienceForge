import type { ArchitectureId, EdgeDefinition, NodeDefinition } from './data';

/** Matches `.graph-node` width / height in globals.css. Same % space as frames and lanes. */
export const NODE_WIDTH_PCT = 15.2;
export const NODE_HEIGHT_PCT = 18;
export const STAGE_MIN_WIDTH = 880;
export const FRAME_HEADER_PCT = 6;
export const MIN_CARD_GAP_PCT = 2.5;

const HALF_W = NODE_WIDTH_PCT / 2;
const HALF_H = NODE_HEIGHT_PCT / 2;
const ALIGN_EPS = 2.4;

export interface GraphPoint {
  x: number;
  y: number;
}

export interface PercentBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ConnectionGeometry {
  start: GraphPoint;
  end: GraphPoint;
  points: GraphPoint[];
}

export interface TopologyLane {
  key: string;
  label: string;
  start: number;
  end: number;
  top: number;
  height: number;
}

export interface TopologyGrid {
  columns: number[];
  rows: Record<string, number>;
  lanes: TopologyLane[];
  regionBox: PercentBox;
  globalStrip?: PercentBox;
  stackedRegions?: Record<string, PercentBox>;
}

const PIPE_COLUMNS = [14, 32, 50, 68, 86];
const REGIONAL_BOX: PercentBox = { left: 3, top: 12, width: 94, height: 78 };
const REGIONAL_LANES_BAND = { top: 12, height: 78 };

export const topologyGrids: Record<ArchitectureId, TopologyGrid> = {
  event_driven_checkout: {
    columns: PIPE_COLUMNS,
    rows: { flow: 44, state: 74 },
    regionBox: REGIONAL_BOX,
    lanes: [
      { key: 'ingress', label: 'Edge / Ingress', start: 5, end: 41, ...REGIONAL_LANES_BAND },
      { key: 'order', label: 'Order / Event', start: 41, end: 77, ...REGIONAL_LANES_BAND },
      { key: 'payment', label: 'Payment / State', start: 77, end: 97, ...REGIONAL_LANES_BAND },
    ],
  },
  multi_region_saas: {
    columns: [12, 33, 51, 69, 87],
    rows: { upper: 33, mid: 54, lower: 75 },
    regionBox: { left: 24, top: 12, width: 73, height: 78 },
    globalStrip: { left: 3, top: 12, width: 19, height: 78 },
    stackedRegions: {
      'europe-west2': { left: 24, top: 12, width: 73, height: 37 },
      'us-east4': { left: 24, top: 51, width: 73, height: 39 },
    },
    lanes: [
      { key: 'ingress', label: 'Ingress', start: 24, end: 42, ...REGIONAL_LANES_BAND },
      { key: 'app', label: 'Application', start: 42, end: 60, ...REGIONAL_LANES_BAND },
      { key: 'state', label: 'State', start: 60, end: 97, ...REGIONAL_LANES_BAND },
    ],
  },
  llm_inference_serving: {
    columns: PIPE_COLUMNS,
    rows: { upper: 31, mid: 54, lower: 77 },
    regionBox: REGIONAL_BOX,
    lanes: [
      { key: 'ingress', label: 'Edge / Ingress', start: 5, end: 41, ...REGIONAL_LANES_BAND },
      { key: 'router', label: 'Routing', start: 41, end: 59, ...REGIONAL_LANES_BAND },
      { key: 'serve', label: 'Vertex / Serving', start: 59, end: 97, ...REGIONAL_LANES_BAND },
    ],
  },
};

export function graphPoint(node: Pick<NodeDefinition, 'x' | 'y'>): GraphPoint {
  return { x: node.x, y: node.y };
}

export function nodeBox(node: Pick<NodeDefinition, 'x' | 'y'>) {
  return {
    left: node.x - HALF_W,
    right: node.x + HALF_W,
    top: node.y - HALF_H,
    bottom: node.y + HALF_H,
  };
}

export function percentBoxStyle(box: PercentBox) {
  return {
    left: `${box.left}%`,
    top: `${box.top}%`,
    width: `${box.width}%`,
    height: `${box.height}%`,
  };
}

export function boxContainsCard(box: PercentBox, node: Pick<NodeDefinition, 'x' | 'y'>, headerPct = FRAME_HEADER_PCT) {
  const card = nodeBox(node);
  return (
    card.left >= box.left + 0.4 &&
    card.right <= box.left + box.width - 0.4 &&
    card.top >= box.top + headerPct &&
    card.bottom <= box.top + box.height - 0.4
  );
}

function almostEqual(a: number, b: number) {
  return Math.abs(a - b) < ALIGN_EPS;
}

function verticalHitsBox(x: number, y1: number, y2: number, node: Pick<NodeDefinition, 'x' | 'y'>) {
  const box = nodeBox(node);
  const lo = Math.min(y1, y2);
  const hi = Math.max(y1, y2);
  return x >= box.left && x <= box.right && hi >= box.top && lo <= box.bottom;
}

function horizontalHitsBox(y: number, x1: number, x2: number, node: Pick<NodeDefinition, 'x' | 'y'>) {
  const box = nodeBox(node);
  const lo = Math.min(x1, x2);
  const hi = Math.max(x1, x2);
  return y >= box.top && y <= box.bottom && hi >= box.left && lo <= box.right;
}

function othersFor(edge: EdgeDefinition, nodes: Map<string, NodeDefinition>) {
  return [...nodes.values()].filter((node) => node.id !== edge.from && node.id !== edge.to);
}

function horizontalVariants(from: GraphPoint, to: GraphPoint): GraphPoint[][] {
  const dirX = Math.sign(to.x - from.x) || 1;
  const start = { x: from.x + dirX * HALF_W, y: from.y };
  const end = { x: to.x - dirX * HALF_W, y: to.y };
  if (almostEqual(start.y, end.y)) return [[start, end]];
  return [0.5, 0.28, 0.72].map((t) => {
    const midX = start.x + (end.x - start.x) * t;
    return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
  });
}

function verticalVariants(from: GraphPoint, to: GraphPoint): GraphPoint[][] {
  const dirY = Math.sign(to.y - from.y) || 1;
  const start = { x: from.x, y: from.y + dirY * HALF_H };
  const end = { x: to.x, y: to.y - dirY * HALF_H };
  if (almostEqual(start.x, end.x)) return [[start, end]];
  return [0.5, 0.28, 0.72].map((t) => {
    const midY = start.y + (end.y - start.y) * t;
    return [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end];
  });
}

function routeConflicts(points: GraphPoint[], others: Pick<NodeDefinition, 'x' | 'y'>[]) {
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index];
    const b = points[index + 1];
    const vertical = almostEqual(a.x, b.x);
    const hits = others.some((node) => (vertical ? verticalHitsBox(a.x, a.y, b.y, node) : horizontalHitsBox(a.y, a.x, b.x, node)));
    if (hits) return true;
  }
  return false;
}

export function connectionGeometry(edge: EdgeDefinition, nodes: Map<string, NodeDefinition>): ConnectionGeometry | null {
  const fromNode = nodes.get(edge.from);
  const toNode = nodes.get(edge.to);
  if (!fromNode || !toNode) return null;

  const from = graphPoint(fromNode);
  const to = graphPoint(toNode);
  const others = othersFor(edge, nodes);
  const preferHorizontal = almostEqual(from.y, to.y) || Math.abs(to.x - from.x) >= Math.abs(to.y - from.y);
  const candidates = preferHorizontal
    ? [...horizontalVariants(from, to), ...verticalVariants(from, to)]
    : [...verticalVariants(from, to), ...horizontalVariants(from, to)];
  const points = candidates.find((route) => !routeConflicts(route, others)) ?? candidates[0];

  return { start: points[0], end: points[points.length - 1], points };
}

export function connectionPath(edge: EdgeDefinition, nodes: Map<string, NodeDefinition>) {
  const geometry = connectionGeometry(edge, nodes);
  if (!geometry) return '';
  return geometry.points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${(point.x * 10).toFixed(1)} ${(point.y * 6).toFixed(1)}`)
    .join(' ');
}

export function thumbnailEdgePath(edge: EdgeDefinition, nodes: Map<string, NodeDefinition>) {
  const fromNode = nodes.get(edge.from);
  const toNode = nodes.get(edge.to);
  if (!fromNode || !toNode) return '';
  const from = graphPoint(fromNode);
  const to = graphPoint(toNode);
  if (almostEqual(from.y, to.y) || almostEqual(from.x, to.x)) {
    return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} L ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
  }
  const others = othersFor(edge, nodes);
  const mids = [0.5, 0.32, 0.68, 0.22, 0.78].map((t) => from.x + (to.x - from.x) * t);
  const midX = mids.find((x) =>
    !others.some((node) => Math.abs(node.x - x) < ALIGN_EPS && Math.min(from.y, to.y) - ALIGN_EPS <= node.y && node.y <= Math.max(from.y, to.y) + ALIGN_EPS),
  ) ?? mids[0];
  return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} L ${midX.toFixed(1)} ${from.y.toFixed(1)} L ${midX.toFixed(1)} ${to.y.toFixed(1)} L ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}

export function frameForNode(architectureId: ArchitectureId, node: Pick<NodeDefinition, 'id' | 'x' | 'y' | 'region'>) {
  const grid = topologyGrids[architectureId];
  if (architectureId === 'multi_region_saas') {
    if (node.id === 'global_alb') return grid.globalStrip ?? grid.regionBox;
    return grid.stackedRegions?.[node.region ?? ''] ?? grid.regionBox;
  }
  return grid.regionBox;
}
