/**
 * Determinism + quality oracle for ProgressiveForceStrategy seeding
 * (round 17).
 *
 * Four stochastic draw groups in this strategy share ONE rng stream:
 * the missing-node initial-placement fallback, the zero-distance escape
 * jitter (all-pairs and spatial variants), and escapeLocalMinimum. All are
 * replaced by createLayoutRng(ids.join('|')) created per performLayout call.
 *
 * The determinism case routes through an existingLayout that is missing one
 * node — that exercises the L86-87 fallback, the only draw guaranteed to fire
 * on every run (the zero-distance and escape jitter paths are conditional).
 *
 * A seeded PRNG is deterministic including CALL ORDER: the simulation loop
 * (forces → positions → energy → stability) must not be reordered.
 */
import { ProgressiveForceStrategy } from '@/visualization/layout/strategies/ProgressiveForceStrategy';
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

function makeTopology(prefix = '', count = 8): { nodes: NodeDatum[]; edges: EdgeDatum[] } {
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

/** Existing layout missing the LAST node → its fallback position draws rng. */
function partialLayout(prefix: string, count: number): DiagramLayout {
  const nodes: PositionedNode[] = Array.from({ length: count - 1 }, (_, i) => ({
    id: `${prefix}n${i}`,
    label: `Node ${i}`,
    x: 200 + i * 180,
    y: 540,
    width: 120,
    height: 60,
  }));
  return { nodes, edges: [] };
}

async function runOnce(prefix: string): Promise<Array<{ id: string; x: number; y: number }>> {
  const { nodes, edges } = makeTopology(prefix);
  const strategy = new ProgressiveForceStrategy();
  const result = await strategy.apply(nodes, edges, CONFIG, partialLayout(prefix, 8));
  return result.layout.nodes
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((n) => ({ id: n.id, x: n.x, y: n.y }));
}

describe('ProgressiveForceStrategy — fully seeded (round 17)', () => {
  test('same input twice → identical positions (determinism oracle)', async () => {
    expect(await runOnce('')).toEqual(await runOnce(''));
  });

  test('fresh instance vs reused instance → identical positions (no stale rng on this)', async () => {
    const reused = new ProgressiveForceStrategy();
    await reused.apply(makeTopology('a:').nodes, makeTopology('a:').edges, CONFIG, partialLayout('a:', 8));
    const secondRun = (
      await reused.apply(makeTopology('b:').nodes, makeTopology('b:').edges, CONFIG, partialLayout('b:', 8))
    ).layout.nodes;

    const fresh = new ProgressiveForceStrategy();
    const freshRun = (
      await fresh.apply(makeTopology('b:').nodes, makeTopology('b:').edges, CONFIG, partialLayout('b:', 8))
    ).layout.nodes;

    expect(secondRun).toEqual(freshRun);
  });

  test.each(['v1:', 'v2:', 'v3:'])(
    'seed variant %s keeps every node finite (quality guard)',
    async (prefix) => {
      const { nodes, edges } = makeTopology(prefix);
      const strategy = new ProgressiveForceStrategy();
      const result = await strategy.apply(nodes, edges, CONFIG, partialLayout(prefix, 8));

      expect(result.layout.nodes).toHaveLength(nodes.length);
      for (const node of result.layout.nodes) {
        expect(Number.isFinite(node.x)).toBe(true);
        expect(Number.isFinite(node.y)).toBe(true);
      }
    },
  );
});
