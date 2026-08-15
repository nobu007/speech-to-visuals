/**
 * Layout OUTCOME oracle for the shared force-directed engines (round-15 follow-up).
 *
 * 0531aa4f single-sourced the multi-phase force-directed schedule AND changed
 * the convergence predicate to include the i=0 check, so both engines now exit
 * phases one interval earlier when a phase starts overlap-free. The pin tests
 * (tests/guards/force-directed-params-single-source.test.ts) assert ITERATION
 * COUNTS, not layout results — this suite closes that gap by asserting the
 * rendered outcome on real diagram topologies:
 *
 *   1. zero pairwise overlap, verified by an INDEPENDENT oracle
 *      (layout-utils `nodesOverlap`), not the engine's own metric;
 *   2. every node finite and inside the canvas;
 *   3. determinism — same input twice must produce identical positions
 *      (guards against an unseeded PRNG sneaking back into force steps).
 *
 * If a legitimate layout change moves positions, these assertions still hold;
 * they only fail when the earlier phase exit regresses overlap quality,
 * pushes nodes off-canvas, or breaks determinism.
 */
import { ZeroOverlapLayoutEngine } from '@/visualization/enhanced-zero-overlap-layout';
import { NetworkLayoutStrategy } from '@/visualization/strategies/NetworkLayoutStrategy';
import { nodesOverlap } from '@/visualization/layout-utils';
import { getNodeWidth, getNodeHeight } from '@/visualization/node-dimensions';
import { NodeDatum, EdgeDatum, DiagramType, PositionedNode } from '@/types/diagram';
import { LayoutConfig } from '@/visualization/types';

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
/** Bounds tolerance: dagre/floating-point may graze the edge by sub-pixels. */
const BOUNDS_EPSILON = 1;

function makeNodes(count: number): NodeDatum[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    label: `Node ${i}`,
  }));
}

function makeEdges(pairs: [string, string][]): EdgeDatum[] {
  return pairs.map(([from, to]) => ({ from, to }));
}

/** Independent overlap oracle: count overlapping node pairs, engine-agnostic. */
function countOverlappingPairs(nodes: PositionedNode[]): number {
  let overlaps = 0;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodesOverlap(nodes[i], nodes[j])) {
        overlaps++;
      }
    }
  }
  return overlaps;
}

function assertFiniteInBounds(nodes: PositionedNode[]): void {
  for (const node of nodes) {
    expect(Number.isFinite(node.x)).toBe(true);
    expect(Number.isFinite(node.y)).toBe(true);
    const w = getNodeWidth(node, 0);
    const h = getNodeHeight(node, 0);
    expect(node.x).toBeGreaterThanOrEqual(-BOUNDS_EPSILON);
    expect(node.y).toBeGreaterThanOrEqual(-BOUNDS_EPSILON);
    expect(node.x + w).toBeLessThanOrEqual(CANVAS_WIDTH + BOUNDS_EPSILON);
    expect(node.y + h).toBeLessThanOrEqual(CANVAS_HEIGHT + BOUNDS_EPSILON);
  }
}

interface Topology {
  name: string;
  diagramType: DiagramType;
  nodes: NodeDatum[];
  edges: EdgeDatum[];
}

function chain(count: number): [string, string][] {
  return Array.from({ length: count - 1 }, (_, i) => [`n${i}`, `n${i + 1}`] as [string, string]);
}

const TOPOLOGIES: Topology[] = [
  {
    name: 'flowchart chain (8 nodes, linear)',
    diagramType: 'flowchart',
    nodes: makeNodes(8),
    edges: makeEdges(chain(8)),
  },
  {
    name: 'tree (3 levels, 10 nodes)',
    diagramType: 'tree',
    nodes: makeNodes(10),
    edges: makeEdges([
      ['n0', 'n1'], ['n0', 'n2'], ['n0', 'n3'],
      ['n1', 'n4'], ['n1', 'n5'],
      ['n2', 'n6'], ['n2', 'n7'],
      ['n3', 'n8'], ['n3', 'n9'],
    ]),
  },
  {
    name: 'network (12 nodes, dense mixed edges)',
    diagramType: 'network',
    nodes: makeNodes(12),
    edges: makeEdges([
      ...chain(12),
      ['n0', 'n5'], ['n2', 'n8'], ['n4', 'n10'], ['n6', 'n11'],
      ['n1', 'n7'], ['n3', 'n9'], ['n0', 'n11'],
    ]),
  },
  {
    name: 'cycle (8-node ring plus chords)',
    diagramType: 'cycle',
    nodes: makeNodes(8),
    edges: makeEdges([
      ...chain(8),
      ['n7', 'n0'],
      ['n0', 'n3'], ['n2', 'n5'], ['n4', 'n7'],
    ]),
  },
];

describe('force-directed layout outcome oracle (post-0531aa4f)', () => {
  describe.each(TOPOLOGIES)('$name — ZeroOverlapLayoutEngine', (topology) => {
    test('produces a zero-overlap layout (independent oracle)', async () => {
      const engine = new ZeroOverlapLayoutEngine();

      const result = await engine.generateZeroOverlapLayout(
        topology.diagramType,
        topology.nodes,
        topology.edges
      );

      // Engine-reported outcome …
      expect(result.success).toBe(true);
      expect(result.qualityMetrics.overlapCount).toBe(0);
      expect(result.nodes).toHaveLength(topology.nodes.length);

      // … confirmed by an oracle that does not share the engine's code path.
      expect(countOverlappingPairs(result.nodes)).toBe(0);
    });

    test('every node is finite and inside the canvas', async () => {
      const engine = new ZeroOverlapLayoutEngine();
      const result = await engine.generateZeroOverlapLayout(
        topology.diagramType,
        topology.nodes,
        topology.edges
      );

      assertFiniteInBounds(result.nodes);
    });

    test('is deterministic across runs (same input → identical positions)', async () => {
      const run = async () => {
        const engine = new ZeroOverlapLayoutEngine();
        const result = await engine.generateZeroOverlapLayout(
          topology.diagramType,
          topology.nodes,
          topology.edges
        );
        return result.nodes
          .slice()
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((n) => ({ id: n.id, x: n.x, y: n.y }));
      };

      expect(await run()).toEqual(await run());
    });
  });

  describe('NetworkLayoutStrategy — network topology', () => {
    const config: LayoutConfig = {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      nodeWidth: 120,
      nodeHeight: 60,
      marginX: 50,
      marginY: 50,
      rankDirection: 'TB',
      nodeSeparation: 50,
      edgeSeparation: 10,
      rankSeparation: 50,
    };

    test('force-directed refinement leaves zero overlapping pairs (independent oracle)', async () => {
      const strategy = new NetworkLayoutStrategy();
      const topology = TOPOLOGIES.find((t) => t.diagramType === 'network')!;

      const output = await strategy.generateLayout(topology.nodes, topology.edges, config);

      expect(output.nodes).toHaveLength(topology.nodes.length);
      expect(countOverlappingPairs(output.nodes)).toBe(0);
      assertFiniteInBounds(output.nodes);
    });

    test('is deterministic across runs', async () => {
      const strategy = new NetworkLayoutStrategy();
      const topology = TOPOLOGIES.find((t) => t.diagramType === 'network')!;
      const run = async () =>
        (await strategy.generateLayout(topology.nodes, topology.edges, config))
          .nodes
          .slice()
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((n) => ({ id: n.id, x: n.x, y: n.y }));

      expect(await run()).toEqual(await run());
    });
  });
});
