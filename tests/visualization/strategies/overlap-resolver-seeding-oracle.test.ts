/**
 * Determinism + quality oracle for the two OverlapResolver seeding fixes
 * (round 17).
 *
 * 1. src/visualization/strategies/OverlapResolver.ts — the
 *    handleIdenticalPositions DEFAULT branch (network/matrix/mindmap …)
 *    displaced coincident nodes along a Math.random() angle. flow/flowchart/
 *    timeline/tree branches were already deterministic (round-16 TC).
 *    Now: angle = rng() * 2π with rng = createLayoutRng(nodeIds), created
 *    per ensureZeroOverlaps call.
 *
 * 2. src/visualization/layout/OverlapResolver.ts — initializeNodes' missing
 *    /absent-position fallback placed nodes at Math.random() positions. Now
 *    drawn from the same seeded-rng pattern at the resolve() entry. Its
 *    determinism also depends on the strategy chain (progressive-force →
 *    simulated-annealing → grid-snap), all seeded as of this round.
 *
 * A seeded PRNG is deterministic including CALL ORDER — overlap-pair
 * iteration order must not be reordered.
 */
import { OverlapResolver as VizOverlapResolver } from '@/visualization/strategies/OverlapResolver';
import { OverlapResolver as LayoutOverlapResolver } from '@/visualization/layout/OverlapResolver';
import { nodesOverlap } from '@/visualization/layout-utils';
import { LayoutConfig } from '@/visualization/types';
import { NodeDatum, EdgeDatum, DiagramLayout, PositionedNode } from '@stv/core/types/diagram';

const CONFIG: LayoutConfig = {
  width: 1920,
  height: 1080,
  nodeWidth: 120,
  nodeHeight: 60,
  marginX: 50,
  marginY: 50,
  rankDirection: 'TB',
  nodeSeparation: 50,
  edgeSeparation: 10,
  rankSeparation: 50,
};

function coincidentPair(prefix: string): DiagramLayout {
  const node = (id: string): PositionedNode => ({
    id,
    label: id,
    x: 960,
    y: 540,
    width: 140,
    height: 70,
  });
  return { nodes: [node(`${prefix}a`), node(`${prefix}b`)], edges: [] };
}

async function resolveCoincident(prefix: string): Promise<Array<{ id: string; x: number; y: number }>> {
  const resolver = new VizOverlapResolver(CONFIG);
  const layout = await resolver.ensureZeroOverlaps(coincidentPair(prefix), 'network');
  return layout.nodes
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((n) => ({ id: n.id, x: n.x, y: n.y }));
}

function unpositionedGraph(prefix = '', count = 8): { nodes: NodeDatum[]; edges: EdgeDatum[] } {
  const nodes: NodeDatum[] = Array.from({ length: count }, (_, i) => ({
    id: `${prefix}n${i}`,
    label: `Node ${i}`,
  }));
  const edges: EdgeDatum[] = Array.from({ length: count - 1 }, (_, i) => ({
    from: `${prefix}n${i}`,
    to: `${prefix}n${i + 1}`,
  }));
  return { nodes, edges };
}

async function resolveGraph(prefix: string): Promise<Array<{ id: string; x: number; y: number }>> {
  const resolver = new LayoutOverlapResolver();
  const { nodes, edges } = unpositionedGraph(prefix);
  const result = await resolver.resolve(nodes, edges, CONFIG);
  return result.layout.nodes
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((n) => ({ id: n.id, x: n.x, y: n.y }));
}

describe('strategies/OverlapResolver — seeded identical-position displacement (round 17)', () => {
  test('same input twice → identical positions (determinism oracle, default branch)', async () => {
    expect(await resolveCoincident('')).toEqual(await resolveCoincident(''));
  });

  test.each(['v1:', 'v2:', 'v3:'])(
    'seed variant %s separates the coincident pair inside the canvas (quality guard)',
    async (prefix) => {
      const resolver = new VizOverlapResolver(CONFIG);
      const layout = await resolver.ensureZeroOverlaps(coincidentPair(prefix), 'network');
      const [a, b] = layout.nodes;

      expect(nodesOverlap(a, b)).toBe(false);
      for (const n of layout.nodes) {
        expect(Number.isFinite(n.x)).toBe(true);
        expect(Number.isFinite(n.y)).toBe(true);
        expect(n.x).toBeGreaterThanOrEqual(0);
        expect(n.y).toBeGreaterThanOrEqual(0);
      }
    },
  );
});

describe('layout/OverlapResolver — seeded missing-node fallback (round 17)', () => {
  test('same input twice → identical positions (determinism oracle, full strategy chain)', async () => {
    expect(await resolveGraph('')).toEqual(await resolveGraph(''));
  });

  test.each(['v1:', 'v2:', 'v3:'])(
    'seed variant %s resolves to finite positions for every node (quality guard)',
    async (prefix) => {
      const positions = await resolveGraph(prefix);
      expect(positions).toHaveLength(8);
      for (const n of positions) {
        expect(Number.isFinite(n.x)).toBe(true);
        expect(Number.isFinite(n.y)).toBe(true);
      }
    },
  );
});
