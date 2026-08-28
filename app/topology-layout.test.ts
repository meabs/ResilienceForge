import assert from 'node:assert/strict';
import test from 'node:test';
import { architectures } from './data.ts';
import {
  MIN_CARD_GAP_PCT,
  NODE_HEIGHT_PCT,
  NODE_WIDTH_PCT,
  STAGE_MIN_WIDTH,
  boxContainsCard,
  connectionGeometry,
  connectionPath,
  frameForNode,
  topologyGrids,
} from './topology-layout.ts';

function nodeMapFor(architectureId: string) {
  const architecture = architectures.find((item) => item.id === architectureId);
  assert.ok(architecture);
  return new Map(architecture.nodes.map((node) => [node.id, node]));
}

function isAxisAligned(path: string) {
  const commands = [...path.matchAll(/[ML]\s+(-?[\d.]+)\s+(-?[\d.]+)/g)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
  }));
  assert.ok(commands.length >= 2, path);
  for (let index = 1; index < commands.length; index += 1) {
    const prev = commands[index - 1];
    const next = commands[index];
    assert.ok(Math.abs(prev.x - next.x) < 0.2 || Math.abs(prev.y - next.y) < 0.2, path);
  }
}

test('every node sits on its architecture grid without overlapping', () => {
  for (const architecture of architectures) {
    const grid = topologyGrids[architecture.id];
    const xs = new Set(grid.columns);
    const ys = new Set(Object.values(grid.rows));
    const slots = new Set<string>();
    for (const node of architecture.nodes) {
      assert.equal(xs.has(node.x), true, `${architecture.id} ${node.id} x=${node.x}`);
      assert.equal(ys.has(node.y), true, `${architecture.id} ${node.id} y=${node.y}`);
      const slotKey = `${node.x},${node.y}`;
      assert.equal(slots.has(slotKey), false, `${architecture.id} duplicate slot ${slotKey}`);
      slots.add(slotKey);
    }
    for (let i = 0; i < architecture.nodes.length; i += 1) {
      for (let j = i + 1; j < architecture.nodes.length; j += 1) {
        const a = architecture.nodes[i];
        const b = architecture.nodes[j];
        const gapX = Math.abs(a.x - b.x) - NODE_WIDTH_PCT;
        const gapY = Math.abs(a.y - b.y) - NODE_HEIGHT_PCT;
        const overlap = gapX < 0 && gapY < 0;
        assert.equal(overlap, false, `${architecture.id} ${a.id} overlaps ${b.id}`);
        if (a.x !== b.x && a.y === b.y) {
          assert.ok(gapX >= MIN_CARD_GAP_PCT - 0.05, `${architecture.id} ${a.id}/${b.id} horizontal gap ${gapX}`);
        }
        if (a.y !== b.y && a.x === b.x) {
          assert.ok(gapY >= MIN_CARD_GAP_PCT - 0.05, `${architecture.id} ${a.id}/${b.id} vertical gap ${gapY}`);
        }
      }
    }
  }
});

test('cards sit inside the frames they belong to', () => {
  for (const architecture of architectures) {
    for (const node of architecture.nodes) {
      const box = frameForNode(architecture.id, node);
      assert.equal(boxContainsCard(box, node), true, `${architecture.id} ${node.id} escapes its frame`);
    }
  }
});

test('core columns share one pitch', () => {
  for (const [id, grid] of Object.entries(topologyGrids)) {
    const gaps = grid.columns.slice(1).map((x, index) => x - grid.columns[index]);
    const core = id === 'multi_region_saas' ? gaps.slice(1) : gaps;
    assert.ok(core.length > 0);
    for (const gap of core) assert.equal(gap, core[0], `${id} uneven pitch ${gaps.join(',')}`);
  }
});

test('edges dock with orthogonal paths', () => {
  for (const architecture of architectures) {
    const nodes = nodeMapFor(architecture.id);
    for (const edge of architecture.edges) {
      const path = connectionPath(edge, nodes);
      assert.equal(path.includes('Q '), false, path);
      assert.match(path, /^M /);
      isAxisAligned(path);
      const geometry = connectionGeometry(edge, nodes);
      assert.ok(geometry);
      assert.ok(geometry.points.length >= 2);
    }
  }
});

test('checkout keeps the request path on one horizon', () => {
  const architecture = architectures.find((item) => item.id === 'event_driven_checkout');
  assert.ok(architecture);
  const flow = ['web_client', 'api_gateway', 'cloud_run_order', 'pubsub_ordered', 'cloud_run_payment'].map((id) => architecture.nodes.find((node) => node.id === id));
  const y = flow[0]?.y;
  assert.ok(y !== undefined);
  for (const node of flow) assert.equal(node?.y, y);
  assert.equal(architecture.nodes.find((node) => node.id === 'cloud_sql')?.x, architecture.nodes.find((node) => node.id === 'cloud_run_order')?.x);
  assert.equal(architecture.nodes.find((node) => node.id === 'memorystore')?.x, architecture.nodes.find((node) => node.id === 'cloud_run_payment')?.x);
});

test('cards fit the minimum readable stage', () => {
  assert.ok(NODE_WIDTH_PCT * 5 < 100);
  assert.ok(STAGE_MIN_WIDTH * (NODE_WIDTH_PCT / 100) >= 110);
  for (const architecture of architectures) {
    for (const node of architecture.nodes) {
      assert.ok(node.x - NODE_WIDTH_PCT / 2 >= 0, `${node.id} overflows left`);
      assert.ok(node.x + NODE_WIDTH_PCT / 2 <= 100, `${node.id} overflows right`);
      assert.ok(node.y - NODE_HEIGHT_PCT / 2 >= 8, `${node.id} overflows top`);
      assert.ok(node.y + NODE_HEIGHT_PCT / 2 <= 96, `${node.id} overflows bottom`);
    }
  }
});
