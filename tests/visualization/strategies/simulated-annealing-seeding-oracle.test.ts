/**
 * Determinism + quality oracle for SimulatedAnnealingStrategy seeding
 * (round 17, architecture.md D3).
 *
 * All six stochastic sites in this strategy share ONE rng stream:
 * initial-placement fallback, node selection, perturbation deltas and the
 * Metropolis acceptance draw. Partial seeding is FORBIDDEN — the acceptance
 * draw feeds updateNodeTemperatures, i.e. the cooling schedule, so a mixed
 * seeded/unseeded stream breaks reproducibility in a way no single-site fix
 * restores (this is why the whole file is seeded in one commit).
 *
 * A seeded PRNG is deterministic including CALL ORDER: runAnnealing's control
 * flow (temperature loop → iterationsPerTemp → select → perturb → accept) must
 * not be reordered, or positions legitimately change. Assertions are
 * run-to-run determinism, not golden pins.
 */
import { SimulatedAnnealingStrategy } from '@/visualization/layout/strategies/SimulatedAnnealingStrategy';
import { LayoutConfig } from '@/visualization/types';
import { NodeDatum, EdgeDatum, PositionedNode } from '@stv/core/types/diagram';

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

async function runOnce(prefix: string): Promise<PositionedNode[]> {
  const { nodes, edges } = makeTopology(prefix);
  const strategy = new SimulatedAnnealingStrategy();
  const result = await strategy.apply(nodes, edges, CONFIG);
  return result.layout.nodes
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((n) => ({ id: n.id, label: n.label, x: n.x, y: n.y })) as PositionedNode[];
}

describe('SimulatedAnnealingStrategy — fully seeded (round 17)', () => {
  test('same input twice → identical positions (determinism oracle)', async () => {
    expect(await runOnce('')).toEqual(await runOnce(''));
  });

  test('fresh instance vs reused instance → identical positions (no stale rng on this)', async () => {
    // The strategy object is reused across diagrams in the resolver chain; a
    // rng stored on `this` would leak the previous diagram's sequence.
    const { nodes: nodes1, edges: edges1 } = makeTopology('a:');
    const { nodes: nodes2, edges: edges2 } = makeTopology('b:');
    const reused = new SimulatedAnnealingStrategy();
    await reused.apply(nodes1, edges1, CONFIG);
    const secondRun = (await reused.apply(nodes2, edges2, CONFIG)).layout.nodes;

    const fresh = new SimulatedAnnealingStrategy();
    const freshRun = (await fresh.apply(nodes2, edges2, CONFIG)).layout.nodes;

    expect(secondRun).toEqual(freshRun);
  });

  test.each(['v1:', 'v2:', 'v3:'])(
    'seed variant %s keeps every node finite and inside the canvas (quality guard)',
    async (prefix) => {
      const { nodes, edges } = makeTopology(prefix);
      const strategy = new SimulatedAnnealingStrategy();
      const result = await strategy.apply(nodes, edges, CONFIG);

      expect(result.layout.nodes).toHaveLength(nodes.length);
      for (const node of result.layout.nodes) {
        expect(Number.isFinite(node.x)).toBe(true);
        expect(Number.isFinite(node.y)).toBe(true);
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeGreaterThanOrEqual(0);
        // SA centers nodes (x is the center) and applies boundary constraints
        // with padding 10 against the configured canvas.
        expect(node.x).toBeLessThanOrEqual(CONFIG.width);
        expect(node.y).toBeLessThanOrEqual(CONFIG.height);
      }
    },
  );
});
