/**
 * Tests for tree-strategy.ts
 * TreeStrategy uses dagre with TB (top-to-bottom) rank direction.
 */

import { TreeStrategy, treeStrategy } from '../tree-strategy';
import { NodeDatum, EdgeDatum } from '@/types/diagram';
import * as layoutEngineV2 from '@/visualization/layout-engine-v2';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(overrides: Partial<NodeDatum> = {}): NodeDatum {
  return {
    id: 'n1',
    label: 'Node 1',
    ...overrides,
  };
}

function makeNodes(count: number): NodeDatum[] {
  return Array.from({ length: count }, (_, i) =>
    makeNode({ id: `n${i + 1}`, label: `Node ${i + 1}` }),
  );
}

function makeEdge(from: string, to: string, overrides: Partial<EdgeDatum> = {}): EdgeDatum {
  return { from, to, ...overrides };
}

/** Build a simple linear chain: n1 -> n2 -> n3 -> ... */
function makeChain(count: number): { nodes: NodeDatum[]; edges: EdgeDatum[] } {
  const nodes = makeNodes(count);
  const edges: EdgeDatum[] = [];
  for (let i = 0; i < count - 1; i++) {
    edges.push(makeEdge(`n${i + 1}`, `n${i + 2}`));
  }
  return { nodes, edges };
}

/** Build a tree: root -> children -> grandchildren */
function makeTree(): { nodes: NodeDatum[]; edges: EdgeDatum[] } {
  const nodes = makeNodes(7);
  // root: n1
  // children: n2, n3
  // grandchildren: n4, n5, n6, n7
  const edges = [
    makeEdge('n1', 'n2'),
    makeEdge('n1', 'n3'),
    makeEdge('n2', 'n4'),
    makeEdge('n2', 'n5'),
    makeEdge('n3', 'n6'),
    makeEdge('n3', 'n7'),
  ];
  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TreeStrategy', () => {
  let strategy: TreeStrategy;

  beforeEach(() => {
    strategy = new TreeStrategy();
  });

  // ---- Properties ----

  describe('properties', () => {
    it('should have name "tree"', () => {
      expect(strategy.name).toBe('tree');
    });

    it('should have canEscapeLocalMinimum true', () => {
      expect(strategy.canEscapeLocalMinimum).toBe(true);
    });
  });

  // ---- apply() ----

  describe('apply()', () => {
    it('should return empty result for empty nodes array', () => {
      const result = strategy.apply([], []);
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
      expect(result.canvas).toEqual({ width: 1920, height: 1080 });
      expect(result.metrics.overlapCount).toBe(0);
      expect(result.metrics.edgeCrossings).toBe(0);
      expect(result.metrics.aspectRatio).toBeCloseTo(16 / 9, 2);
    });

    it('should lay out a single node without edges', () => {
      const nodes = [makeNode()];
      const result = strategy.apply(nodes, []);

      expect(result.nodes).toHaveLength(1);
      expect(result.edges).toHaveLength(0);

      const positioned = result.nodes[0];
      expect(positioned.id).toBe('n1');
      expect(typeof positioned.x).toBe('number');
      expect(typeof positioned.y).toBe('number');
      expect(positioned.width).toBe(120);
      expect(positioned.height).toBe(60);
    });

    it('should lay out multiple nodes in a chain with increasing y (TB direction)', () => {
      const { nodes, edges } = makeChain(4);
      const result = strategy.apply(nodes, edges);

      expect(result.nodes).toHaveLength(4);
      expect(result.edges).toHaveLength(3);

      for (const node of result.nodes) {
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
        expect(node.width).toBe(120);
        expect(node.height).toBe(60);
      }

      // In TB layout, successive chain nodes should have increasing y
      const sorted = [...result.nodes].sort((a, b) => a.y - b.y);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].y).toBeGreaterThan(sorted[i - 1].y);
      }
    });

    it('should lay out a tree structure with root at the top', () => {
      const { nodes, edges } = makeTree();
      const result = strategy.apply(nodes, edges);

      expect(result.nodes).toHaveLength(7);
      expect(result.edges).toHaveLength(6);

      // Root (n1) should have the smallest y
      const root = result.nodes.find((n) => n.id === 'n1')!;
      const children = result.nodes.filter((n) => ['n2', 'n3'].includes(n.id));
      const grandchildren = result.nodes.filter((n) =>
        ['n4', 'n5', 'n6', 'n7'].includes(n.id),
      );

      for (const child of children) {
        expect(child.y).toBeGreaterThan(root.y);
      }
      for (const gc of grandchildren) {
        expect(gc.y).toBeGreaterThan(root.y);
      }
    });

    it('should produce layout edges with points arrays', () => {
      const { nodes, edges } = makeChain(3);
      const result = strategy.apply(nodes, edges);

      for (const edge of result.edges) {
        expect(edge.points).toBeDefined();
        expect(Array.isArray(edge.points)).toBe(true);
        expect(edge.points.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('should preserve edge labels and ids', () => {
      const nodes = makeNodes(2);
      const edges: EdgeDatum[] = [
        makeEdge('n1', 'n2', { label: 'child', id: 'e1' }),
      ];
      const result = strategy.apply(nodes, edges);

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].label).toBe('child');
      expect(result.edges[0].id).toBe('e1');
    });

    it('should use custom node dimensions when provided', () => {
      const nodes: NodeDatum[] = [
        makeNode({ id: 'n1', label: 'Big', width: 200, height: 100 }),
        makeNode({ id: 'n2', label: 'Small' }),
      ];
      const edges = [makeEdge('n1', 'n2')];
      const result = strategy.apply(nodes, edges);

      const big = result.nodes.find((n) => n.id === 'n1')!;
      expect(big.width).toBe(200);
      expect(big.height).toBe(100);

      const small = result.nodes.find((n) => n.id === 'n2')!;
      expect(small.width).toBe(120);
      expect(small.height).toBe(60);
    });

    it('should return valid canvas dimensions', () => {
      const { nodes, edges } = makeTree();
      const result = strategy.apply(nodes, edges);

      expect(result.canvas.width).toBeGreaterThan(0);
      expect(result.canvas.height).toBeGreaterThan(0);
    });

    it('should return valid metrics', () => {
      const { nodes, edges } = makeTree();
      const result = strategy.apply(nodes, edges);

      expect(typeof result.metrics.overlapCount).toBe('number');
      expect(typeof result.metrics.edgeCrossings).toBe('number');
      expect(typeof result.metrics.aspectRatio).toBe('number');
      expect(result.metrics.aspectRatio).toBeGreaterThan(0);
    });

    it('should handle many nodes (potential gridSnapFallback path)', () => {
      const count = 20;
      const nodes = makeNodes(count);
      const edges: EdgeDatum[] = [];
      // Dense connections to potentially trigger overlap -> gridSnapFallback
      for (let i = 0; i < 5; i++) {
        for (let j = 5; j < count; j++) {
          edges.push(makeEdge(`n${i + 1}`, `n${j + 1}`));
        }
      }

      const result = strategy.apply(nodes, edges);

      expect(result.nodes).toHaveLength(count);
      expect(result.edges).toHaveLength(edges.length);

      for (const node of result.nodes) {
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
        expect(isNaN(node.x)).toBe(false);
        expect(isNaN(node.y)).toBe(false);
      }

      for (const edge of result.edges) {
        expect(edge.points.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('should handle disconnected nodes (no edges)', () => {
      const nodes = makeNodes(5);
      const result = strategy.apply(nodes, []);

      expect(result.nodes).toHaveLength(5);
      expect(result.edges).toHaveLength(0);

      for (const node of result.nodes) {
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
      }
    });

    it('should handle diamond-shaped graph', () => {
      const nodes = makeNodes(4);
      const edges = [
        makeEdge('n1', 'n2'),
        makeEdge('n1', 'n3'),
        makeEdge('n2', 'n4'),
        makeEdge('n3', 'n4'),
      ];
      const result = strategy.apply(nodes, edges);

      expect(result.nodes).toHaveLength(4);
      expect(result.edges).toHaveLength(4);
    });

    it('should handle a wide tree with many siblings', () => {
      // root -> n2, n3, n4, n5, n6, n7, n8, n9, n10
      const nodes = makeNodes(10);
      const edges: EdgeDatum[] = [];
      for (let i = 1; i < 10; i++) {
        edges.push(makeEdge('n1', `n${i + 1}`));
      }
      const result = strategy.apply(nodes, edges);

      expect(result.nodes).toHaveLength(10);
      expect(result.edges).toHaveLength(9);

      // Root should be above all children
      const root = result.nodes.find((n) => n.id === 'n1')!;
      for (let i = 2; i <= 10; i++) {
        const child = result.nodes.find((n) => n.id === `n${i}`)!;
        expect(child.y).toBeGreaterThan(root.y);
      }
    });
  });

  // ---- estimateComplexity() ----

  describe('estimateComplexity()', () => {
    it('should return 0 for empty array', () => {
      expect(strategy.estimateComplexity([])).toBe(0);
    });

    it('should return 1 for single node', () => {
      expect(strategy.estimateComplexity([makeNode()])).toBe(1);
    });

    it('should return n^2 for n nodes', () => {
      const nodes = makeNodes(5);
      expect(strategy.estimateComplexity(nodes)).toBe(25);
    });

    it('should grow quadratically', () => {
      const n3 = makeNodes(3);
      const n6 = makeNodes(6);
      expect(strategy.estimateComplexity(n6)).toBe(
        strategy.estimateComplexity(n3) * 4,
      );
    });
  });

  // ---- gridSnapFallback (via forced overlap) ----

  describe('gridSnapFallback()', () => {
    let metricsSpy: jest.SpyInstance;

    afterEach(() => {
      if (metricsSpy) metricsSpy.mockRestore();
    });

    /** Mock calculateMetrics to return overlapCount > 0, triggering gridSnapFallback. */
    function forceOverlap() {
      metricsSpy = jest.spyOn(layoutEngineV2, 'calculateMetrics').mockReturnValue({
        overlapCount: 5,
        edgeCrossings: 0,
        aspectRatio: 16 / 9,
      });
    }

    it('should be triggered when dagre produces overlapping nodes', () => {
      const { nodes, edges } = makeChain(4);
      forceOverlap();

      const result = strategy.apply(nodes, edges);

      expect(result.nodes).toHaveLength(4);
      expect(result.edges).toHaveLength(3);

      for (const node of result.nodes) {
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
        expect(isNaN(node.x)).toBe(false);
        expect(isNaN(node.y)).toBe(false);
      }
    });

    it('should place tree nodes in level-based grid positions', () => {
      const { nodes, edges } = makeTree();
      forceOverlap();

      const result = strategy.apply(nodes, edges);

      expect(result.nodes).toHaveLength(7);
      // Root (n1) should be at level 0 (smallest y)
      const root = result.nodes.find((n) => n.id === 'n1')!;
      const children = result.nodes.filter((n) => ['n2', 'n3'].includes(n.id));
      const grandchildren = result.nodes.filter((n) =>
        ['n4', 'n5', 'n6', 'n7'].includes(n.id),
      );

      // In tree fallback, children should be below root
      for (const child of children) {
        expect(child.y).toBeGreaterThan(root.y);
      }
      for (const gc of grandchildren) {
        expect(gc.y).toBeGreaterThan(root.y);
      }
    });

    it('should produce edges with correct from/to and points', () => {
      const nodes = makeNodes(3);
      const edges = [makeEdge('n1', 'n2'), makeEdge('n2', 'n3')];
      forceOverlap();

      const result = strategy.apply(nodes, edges);

      expect(result.edges).toHaveLength(2);
      for (const edge of result.edges) {
        expect(edge.points).toBeDefined();
        expect(edge.points.length).toBeGreaterThanOrEqual(2);
        expect(typeof edge.points[0].x).toBe('number');
        expect(typeof edge.points[0].y).toBe('number');
      }
    });

    it('should handle nodes without edges in fallback (all become roots)', () => {
      const nodes = makeNodes(5);
      forceOverlap();

      const result = strategy.apply(nodes, []);

      expect(result.nodes).toHaveLength(5);
      expect(result.edges).toHaveLength(0);
      for (const node of result.nodes) {
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
      }
    });

    it('should preserve custom node dimensions in fallback', () => {
      const nodes: NodeDatum[] = [
        makeNode({ id: 'n1', width: 200, height: 100 }),
        makeNode({ id: 'n2', width: 80, height: 40 }),
      ];
      const edges = [makeEdge('n1', 'n2')];
      forceOverlap();

      const result = strategy.apply(nodes, edges);

      const n1 = result.nodes.find((n) => n.id === 'n1')!;
      expect(n1.width).toBe(200);
      expect(n1.height).toBe(100);

      const n2 = result.nodes.find((n) => n.id === 'n2')!;
      expect(n2.width).toBe(80);
      expect(n2.height).toBe(40);
    });

    it('should handle cyclic graphs in fallback (unvisited nodes get level 0)', () => {
      // Cycle: n1 -> n2 -> n3 -> n1
      const nodes = makeNodes(3);
      const edges = [makeEdge('n1', 'n2'), makeEdge('n2', 'n3'), makeEdge('n3', 'n1')];
      forceOverlap();

      const result = strategy.apply(nodes, edges);

      expect(result.nodes).toHaveLength(3);
      expect(result.edges).toHaveLength(3);
      for (const node of result.nodes) {
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
      }
    });

    it('should return valid canvas and metrics from fallback', () => {
      const nodes = makeNodes(4);
      const edges = [makeEdge('n1', 'n2'), makeEdge('n2', 'n3'), makeEdge('n3', 'n4')];
      forceOverlap();

      const result = strategy.apply(nodes, edges);

      expect(result.canvas.width).toBeGreaterThan(0);
      expect(result.canvas.height).toBeGreaterThan(0);
      expect(typeof result.metrics.overlapCount).toBe('number');
      expect(typeof result.metrics.aspectRatio).toBe('number');
    });

    it('should handle a wide tree (many siblings) in fallback', () => {
      const nodes = makeNodes(10);
      const edges: EdgeDatum[] = [];
      for (let i = 1; i < 10; i++) {
        edges.push(makeEdge('n1', `n${i + 1}`));
      }
      forceOverlap();

      const result = strategy.apply(nodes, edges);

      expect(result.nodes).toHaveLength(10);
      expect(result.edges).toHaveLength(9);

      // Root should be above all children
      const root = result.nodes.find((n) => n.id === 'n1')!;
      for (let i = 2; i <= 10; i++) {
        const child = result.nodes.find((n) => n.id === `n${i}`)!;
        expect(child.y).toBeGreaterThan(root.y);
      }
    });
  });

  // ---- Singleton export ----

  describe('singleton export', () => {
    it('treeStrategy should be an instance of TreeStrategy', () => {
      expect(treeStrategy).toBeInstanceOf(TreeStrategy);
    });

    it('treeStrategy should have the correct name', () => {
      expect(treeStrategy.name).toBe('tree');
    });
  });
});
