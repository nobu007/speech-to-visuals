/**
 * RED-verified seeding oracle for layout/OverlapResolver.initializeNodes
 * (round 17).
 *
 * The full resolve() chain is outcome-deterministic even with an unseeded
 * initializeNodes: for these graph shapes every strategy result still shows
 * overlaps, so the chain always falls through to the (deterministic)
 * GridSnapStrategy, whose quantized output masks the random start positions.
 * An end-to-end determinism test therefore CANNOT go RED for this file.
 *
 * Instead the strategy modules are mocked with identity strategies that echo
 * their input positions back and report zero overlaps (making the chain break
 * after the first strategy). resolve()'s output then exposes exactly what
 * initializeNodes produced — the missing/absent-position fallback that used
 * Math.random. Uses unstable_mockModule (jest.mock is a no-op in ESM).
 */
import { jest } from '@jest/globals';
import type { LayoutResult } from '@/visualization/types';
import type { NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';

/** Identity strategy: echo input nodes, claim a perfect zero-overlap result. */
function createIdentityStrategy(name: string) {
  return class {
    readonly name = name;
    async apply(
      nodes: PositionedNode[],
      edges: LayoutEdge[],
    ): Promise<LayoutResult> {
      const minX = nodes.length ? Math.min(...nodes.map((n) => n.x)) : 0;
      const minY = nodes.length ? Math.min(...nodes.map((n) => n.y)) : 0;
      const maxX = nodes.length
        ? Math.max(...nodes.map((n) => n.x + (n.width ?? 120)))
        : 0;
      const maxY = nodes.length
        ? Math.max(...nodes.map((n) => n.y + (n.height ?? 60)))
        : 0;
      return {
        layout: { nodes, edges },
        bounds: { width: maxX - minX, height: maxY - minY, minX, minY, maxX, maxY },
        processingTime: 0,
        success: true,
        metrics: {
          overlapCount: 0,
          edgeCrossings: 0,
          totalArea: (maxX - minX) * (maxY - minY),
          nodeSpacing: 0,
          layoutBalance: 1,
        },
      };
    }
  };
}

jest.unstable_mockModule(
  '@/visualization/layout/strategies/ProgressiveForceStrategy',
  () => ({ __esModule: true, default: createIdentityStrategy('progressive-force') }),
);
jest.unstable_mockModule(
  '@/visualization/layout/strategies/SimulatedAnnealingStrategy',
  () => ({ __esModule: true, default: createIdentityStrategy('simulated-annealing') }),
);
jest.unstable_mockModule(
  '@/visualization/layout/strategies/GridSnapStrategy',
  () => ({ __esModule: true, default: createIdentityStrategy('grid-snap') }),
);

type OverlapResolverClass = import('@/visualization/layout/OverlapResolver').OverlapResolver;
let OverlapResolver: typeof OverlapResolverClass;

beforeAll(async () => {
  const mod = await import('@/visualization/layout/OverlapResolver');
  OverlapResolver = mod.OverlapResolver;
});

const CONFIG = {
  width: 1920,
  height: 1080,
  nodeWidth: 120,
  nodeHeight: 60,
  marginX: 50,
  marginY: 50,
  rankDirection: 'TB' as const,
  nodeSeparation: 50,
  edgeSeparation: 10,
  rankSeparation: 50,
};

function graph(prefix: string, count = 6): { nodes: NodeDatum[]; edges: EdgeDatum[] } {
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

async function resolveOnce(prefix: string): Promise<PositionedNode[]> {
  const { nodes, edges } = graph(prefix);
  const result = await new OverlapResolver().resolve(
    nodes as unknown as NodeDatum[],
    edges,
    CONFIG,
  );
  return result.layout.nodes
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((n) => ({ id: n.id, x: n.x, y: n.y }));
}

describe('layout/OverlapResolver — seeded missing-node fallback (round 17)', () => {
  test('same input twice → identical initial positions (determinism oracle)', async () => {
    expect(await resolveOnce('')).toEqual(await resolveOnce(''));
  });

  test.each(['v1:', 'v2:', 'v3:'])(
    'seed variant %s places every node at a finite position (quality guard)',
    async (prefix) => {
      const positions = await resolveOnce(prefix);
      expect(positions).toHaveLength(6);
      for (const n of positions) {
        expect(Number.isFinite(n.x)).toBe(true);
        expect(Number.isFinite(n.y)).toBe(true);
      }
    },
  );
});
