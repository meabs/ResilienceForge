import type { ArchitectureId, EdgeDefinition, NodeDefinition } from './data';

/** Matches `.graph-node` width / min-height in globals.css. */
export const NODE_WIDTH_PCT = 13.2;
export const NODE_HEIGHT_PCT = 18;
export const STAGE_MIN_WIDTH = 880;

const HALF_W = NODE_WIDTH_PCT / 2;
const HALF_H = NODE_HEIGHT_PCT / 2;
const ALIGN_EPS = 2.4;

export interface GraphPoint {
  x: number;
  y: number;
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
}

export interface TopologyGrid {
  columns: number[];
  rows: Record<string, number>;
  lanes: TopologyLane[];
}

export const topologyGrids: Record<ArchitectureId, TopologyGrid> = {
  event_driven_checkout: {
    columns: [14, 32, 50, 68, 86],
    rows: { flow: 40, state: 71 },
    lanes: [
      { key: 'ingress', label: 'Edge / Ingress', start: 5, end: 41 },
      { key: 'order', label: 'Order / Event', start: 41, end: 77 },
      { key: 'payment', label: 'Payment / State', start: 77, end: 96 },
    ],
  },
  multi_region_saas: {
    columns: [11, 34, 54, 74, 91],
    rows: { mid: 51, upper: 32, lower: 72 },
    lanes: [
      { key: 'ingress', label: 'Ingress', start: 24, end: 44 },
      { key: 'app', label: 'Application', start: 44, end: 64 },
      { key: 'state', label: 'State', start: 64, end: 97 },
    ],
  },
  llm_inference_serving: {
    columns: [14, 32, 50, 68, 86],
    rows: { mid: 51, upper: 32, lower: 72 },
    lanes: [
      { key: 'ingress', label: 'Edge / Ingress', start: 5, end: 41 },
      { key: 'router', label: 'Routing', start: 41, end: 59 },
      { key: 'serve', label: 'Vertex / Serving', start: 59, end: 96 },
    ],
  },
};

export function graphPoint(node: Pick<NodeDefinition, 'x' | 'y'>): GraphPoint {
  return { x: node.x, y: node.y };
}

function almostEqual(a: number, b: number) {
  return Math.abs(a - b) < ALIGN_EPS;
}

function nodeBox(node: Pick<NodeDefinition, 'x' | 'y'>) {
  return {
    left: node.x - HALF_W,
    right: node.x + HALF_W,
    top: node.y - HALF_H,
    bottom: node.y + HALF_H,
  };
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

function horizontalRoute(from: GraphPoint, to: GraphPoint): GraphPoint[] {
  const dirX = Math.sign(to.x - from.x) || 1;
  const start = { x: from.x + dirX * HALF_W, y: from.y };
  const end = { x: to.x - dirX * HALF_W, y: to.y };
  if (almostEqual(start.y, end.y)) return [start, end];
  const midX = (start.x + end.x) / 2;
  return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
}

function verticalRoute(from: GraphPoint, to: GraphPoint): GraphPoint[] {
  const dirY = Math.sign(to.y - from.y) || 1;
  const start = { x: from.x, y: from.y + dirY * HALF_H };
  const end = { x: to.x, y: to.y - dirY * HALF_H };
  if (almostEqual(start.x, end.x)) return [start, end];
  const midY = (start.y + end.y) / 2;
  return [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end];
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
  const primary = preferHorizontal ? horizontalRoute(from, to) : verticalRoute(from, to);
  const fallback = preferHorizontal ? verticalRoute(from, to) : horizontalRoute(from, to);
  const points = routeConflicts(primary, others) && !routeConflicts(fallback, others) ? fallback : primary;

  return { start: points[0], end: points[points.length - 1], points };
}

export function connectionPath(edge: EdgeDefinition, nodes: Map<string, NodeDefinition>) {
  const geometry = connectionGeometry(edge, nodes);
  if (!geometry) return '';
  return geometry.points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${(point.x * 10).toFixed(1)} ${(point.y * 6).toFixed(1)}`)
    .join(' ');
}
