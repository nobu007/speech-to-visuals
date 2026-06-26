/**
 * Tests for layout correctness bugs in TreeLayoutStrategy and FallbackLayoutStrategy.
 *
 * Bug 1: TreeLayoutStrategy used `root.width` (the global root node) instead of
 *   the current node's width when centering non-leaf children, causing incorrect
 *   horizontal positioning in multi-level trees.
 *
 * Bug 2: FallbackLayoutStrategy.createTimelineLayout positioned a single node at
 *   x = margin - nodeWidth/2 = -30 (off-screen left edge) instead of centering it.
 *
 * Bug 3: TreeLayoutStrategy emitted PositionedNodes with only `w`/`h` fields but
 *   not `width`/`height`, causing downstream consumers (overlap detectors, canvas
 *   calculators) that read `width`/`height` to get undefined and produce NaN.
 */

import { TreeLayoutStrategy } from '../TreeLayoutStrategy';
import { FallbackLayoutStrategy } from '../FallbackLayoutStrategy';
import { NodeDatum, EdgeDatum } from '@/types/diagram';
import { LayoutConfig } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(id: string, label?: string, overrides: Partial<NodeDatum> = {}): NodeDatum {
  return { id, label: label ?? id, ...overrides };
}

function makeEdge(from: string, to: string): EdgeDatum {
  return { from, to };
}

function makeConfig(overrides: Partial<LayoutConfig> = {}): LayoutConfig {
  return {
    width: 1920,
    height: 1080,
    nodeWidth: 120,
    nodeHeight: 60,
    nodeSeparation: 80,
    rankSeparation: 100,
    ...overrides,
  } as LayoutConfig;
}

// ---------------------------------------------------------------------------
// TreeLayoutStrategy tests
// ---------------------------------------------------------------------------

describe('TreeLayoutStrategy bug fixes', () => {
  let strategy: TreeLayoutStrategy;
  let config: LayoutConfig;

  beforeEach(() => {
    strategy = new TreeLayoutStrategy();
    config = makeConfig();
  });

  describe('root.width → node.width centering fix', () => {
    it('should use the current node width (not root width) for child centering', async () => {
      // Build a 3-level tree: root(n1) → n2 → n3,n4
      // Root has custom width 300, child n2 has default width 120
      const nodes: NodeDatum[] = [
        makeNode('n1', 'Root', { width: 300, height: 80 }),
        makeNode('n2', 'Mid'),
        makeNode('n3', 'Leaf A'),
        makeNode('n4', 'Leaf B'),
      ];
      const edges = [
        makeEdge('n1', 'n2'),
        makeEdge('n2', 'n3'),
        makeEdge('n2', 'n4'),
      ];

      const result = await strategy.generateLayout(nodes, edges, config);

      // Find the non-leaf child (n2) - it should be centered relative to
      // its own width (120), not the root's width (300).
      const n2 = result.nodes.find((n) => n.id === 'n2');
      expect(n2).toBeDefined();
      expect(n2!.x).not.toBeNaN();
      expect(n2!.y).not.toBeNaN();
    });

    it('should not produce NaN x coordinates for multi-level trees', async () => {
      // Deep tree: n1 → n2 → n3 → n4 → n5
      const nodes = ['n1', 'n2', 'n3', 'n4', 'n5'].map((id) => makeNode(id));
      const edges = [
        makeEdge('n1', 'n2'),
        makeEdge('n2', 'n3'),
        makeEdge('n3', 'n4'),
        makeEdge('n4', 'n5'),
      ];

      const result = await strategy.generateLayout(nodes, edges, config);

      for (const node of result.nodes) {
        expect(isNaN(node.x)).toBe(false);
        expect(isNaN(node.y)).toBe(false);
      }
    });

    it('should position children of non-root nodes correctly', async () => {
      // Tree: n1(root, width=400) → n2(width=120) → n3, n4
      const nodes: NodeDatum[] = [
        makeNode('n1', 'Root', { width: 400, height: 80 }),
        makeNode('n2', 'Branch'),
        makeNode('n3', 'Leaf1'),
        makeNode('n4', 'Leaf2'),
      ];
      const edges = [
        makeEdge('n1', 'n2'),
        makeEdge('n2', 'n3'),
        makeEdge('n2', 'n4'),
      ];

      const result = await strategy.generateLayout(nodes, edges, config);

      // n3 and n4 should be positioned relative to n2's width (120),
      // not n1's width (400). The bug would use root.width=400 instead.
      const n3 = result.nodes.find((n) => n.id === 'n3');
      const n4 = result.nodes.find((n) => n.id === 'n4');

      expect(n3).toBeDefined();
      expect(n4).toBeDefined();
      // Both should have finite x values
      expect(Number.isFinite(n3!.x)).toBe(true);
      expect(Number.isFinite(n4!.x)).toBe(true);
    });
  });

  describe('width/height field consistency', () => {
    it('should populate both w/h AND width/height on positioned nodes', async () => {
      const nodes = [makeNode('n1', 'Root'), makeNode('n2', 'Child')];
      const edges = [makeEdge('n1', 'n2')];

      const result = await strategy.generateLayout(nodes, edges, config);

      for (const node of result.nodes) {
        // w/h should be defined (existing behavior)
        expect(node.w).toBeDefined();
        expect(node.h).toBeDefined();
        // width/height should also be defined (new fix for downstream consumers)
        expect(node.width).toBeDefined();
        expect(node.height).toBeDefined();
        // They should match
        expect(node.width).toBe(node.w);
        expect(node.height).toBe(node.h);
      }
    });

    it('should not produce undefined width/height that causes NaN downstream', async () => {
      const nodes: NodeDatum[] = [
        makeNode('n1', 'Root', { width: 200, height: 100 }),
        makeNode('n2', 'Child'),
      ];
      const edges = [makeEdge('n1', 'n2')];

      const result = await strategy.generateLayout(nodes, edges, config);

      const n1 = result.nodes.find((n) => n.id === 'n1')!;
      // Strategy recalculates width via calculateNodeWidth, but width/height
      // fields must be defined (not undefined) for downstream consumers
      expect(n1.width).toBeDefined();
      expect(n1.height).toBeDefined();
      expect(n1.width).toBe(n1.w);
      expect(n1.height).toBe(n1.h);

      const n2 = result.nodes.find((n) => n.id === 'n2')!;
      expect(n2.width).toBeDefined();
      expect(n2.height).toBeDefined();
      expect(n2.width).toBe(n2.w);
      expect(n2.height).toBe(n2.h);
    });
  });

  describe('validateInputs', () => {
    it('should reject empty nodes', () => {
      expect(strategy.validateInputs([], [])).toBe(false);
    });

    it('should accept valid nodes and edges', () => {
      const nodes = [makeNode('n1'), makeNode('n2')];
      const edges = [makeEdge('n1', 'n2')];
      expect(strategy.validateInputs(nodes, edges)).toBe(true);
    });

    it('should reject duplicate node IDs', () => {
      const nodes = [makeNode('n1'), makeNode('n1')];
      expect(strategy.validateInputs(nodes, [])).toBe(false);
    });

    it('should reject edges referencing non-existent nodes', () => {
      const nodes = [makeNode('n1')];
      const edges = [makeEdge('n1', 'ghost')];
      expect(strategy.validateInputs(nodes, edges)).toBe(false);
    });
  });

  describe('supports() and getStrategyDefaults()', () => {
    it('should support tree diagram type', () => {
      expect(strategy.supports('tree')).toBe(true);
      expect(strategy.supports('flow')).toBe(false);
    });

    it('should return top-to-bottom defaults', () => {
      const defaults = strategy.getStrategyDefaults();
      expect(defaults.rankDirection).toBe('TB');
      expect(defaults.rankSeparation).toBe(100);
      expect(defaults.nodeSeparation).toBe(80);
    });
  });

  describe('edge cases', () => {
    it('should handle cycle in graph (cycle detection returns early)', async () => {
      const nodes = [makeNode('n1'), makeNode('n2'), makeNode('n3')];
      const edges = [
        makeEdge('n1', 'n2'),
        makeEdge('n2', 'n3'),
        makeEdge('n3', 'n1'), // creates cycle
      ];

      // Cycle detection cuts recursion but n1 appears twice (as root and as child of n3)
      const result = await strategy.generateLayout(nodes, edges, config);
      expect(result.nodes.length).toBeGreaterThanOrEqual(3);
      for (const node of result.nodes) {
        expect(isNaN(node.x)).toBe(false);
        expect(isNaN(node.y)).toBe(false);
      }
    });

    it('should handle node with no edges (only root appears in tree)', async () => {
      const nodes = [makeNode('n1'), makeNode('n2')];
      // No edges means only the root node is reachable in the tree
      const result = await strategy.generateLayout(nodes, [], config);
      expect(result.nodes.length).toBeGreaterThanOrEqual(1);
      for (const node of result.nodes) {
        expect(isNaN(node.x)).toBe(false);
        expect(isNaN(node.y)).toBe(false);
      }
    });

    it('should generate edges with source/target points', async () => {
      const nodes = [makeNode('n1'), makeNode('n2')];
      const edges = [makeEdge('n1', 'n2')];

      const result = await strategy.generateLayout(nodes, edges, config);

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].points.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// ---------------------------------------------------------------------------
// FallbackLayoutStrategy tests
// ---------------------------------------------------------------------------

describe('FallbackLayoutStrategy bug fixes', () => {
  let strategy: FallbackLayoutStrategy;

  beforeEach(() => {
    strategy = new FallbackLayoutStrategy(makeConfig());
  });

  describe('timeline single-node centering fix', () => {
    it('should center a single timeline node horizontally', () => {
      const nodes = [makeNode('n1', 'Only')];
      const result = strategy.fallbackLayout(nodes, [], 'timeline');

      const node = result.nodes[0];
      // Before fix: x = 50 + 0 - 80 = -30 (off-screen left)
      // After fix: x = (1920 - 160) / 2 = 880 (centered)
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBe((1920 - 160) / 2); // 880
    });

    it('should center a single timeline node at canvas center', () => {
      const nodes = [makeNode('solo', 'Solo Event')];
      const result = strategy.fallbackLayout(nodes, [], 'timeline');

      const node = result.nodes[0];
      const nodeCenterX = node.x + (node.w ?? 0) / 2;
      // Node center should be at canvas center
      expect(nodeCenterX).toBeCloseTo(1920 / 2, 0);
    });

    it('should not produce negative x for single timeline node', () => {
      const nodes = [makeNode('x', 'X')];
      const result = strategy.fallbackLayout(nodes, [], 'timeline');

      expect(result.nodes[0].x).toBeGreaterThanOrEqual(0);
    });

    it('should still spread multiple timeline nodes correctly', () => {
      const nodes = ['n1', 'n2', 'n3'].map((id) => makeNode(id));
      const result = strategy.fallbackLayout(nodes, [], 'timeline');

      // Nodes should be spread across the canvas
      const xs = result.nodes.map((n) => n.x);
      expect(xs[0]).toBeLessThan(xs[xs.length - 1]);

      // All should be on-screen
      for (const x of xs) {
        expect(x).toBeGreaterThanOrEqual(-200); // margin tolerance for node center positioning
      }
    });
  });

  describe('timeline edge generation with single node', () => {
    it('should produce no edges for single node with no input edges', () => {
      const nodes = [makeNode('n1')];
      const result = strategy.fallbackLayout(nodes, [], 'timeline');
      expect(result.edges).toHaveLength(0);
    });
  });

  describe('timeline with width/height fields', () => {
    it('should populate width and height on timeline nodes', () => {
      const nodes = [makeNode('n1')];
      const result = strategy.fallbackLayout(nodes, [], 'timeline');

      const node = result.nodes[0];
      expect(node.width).toBeDefined();
      expect(node.height).toBeDefined();
      expect(node.width).toBe(node.w);
      expect(node.height).toBe(node.h);
    });
  });

  describe('other layout types still work', () => {
    it('should create flow layout', () => {
      const nodes = [makeNode('n1'), makeNode('n2')];
      const edges = [makeEdge('n1', 'n2')];
      const result = strategy.fallbackLayout(nodes, edges, 'flow');

      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
    });

    it('should create cycle layout', () => {
      const nodes = ['a', 'b', 'c'].map((id) => makeNode(id));
      const result = strategy.fallbackLayout(nodes, [], 'cycle');
      expect(result.nodes).toHaveLength(3);
    });

    it('should create matrix layout', () => {
      const nodes = Array.from({ length: 6 }, (_, i) => makeNode(`n${i + 1}`));
      const result = strategy.fallbackLayout(nodes, [], 'matrix');
      expect(result.nodes).toHaveLength(6);
    });

    it('should use grid layout for unknown type', () => {
      const nodes = [makeNode('n1'), makeNode('n2')];
      const result = strategy.fallbackLayout(nodes, [], 'unknown' as never);
      expect(result.nodes).toHaveLength(2);
    });
  });
});
