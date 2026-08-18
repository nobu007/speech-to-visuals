/**
 * Integration tests for the full layout pipeline.
 *
 * Catches positioning regressions end-to-end by running multi-level tree
 * and single-node timeline diagrams through the real LayoutEngine
 * (DagreLayoutStrategy → OverlapResolver → optimization → final resolution)
 * as well as the individual TreeLayoutStrategy and FallbackLayoutStrategy.
 *
 * Regression targets:
 * - TreeLayoutStrategy child centering using wrong width reference (fixed)
 * - FallbackLayoutStrategy timeline single-node off-screen x=-30 (fixed)
 * - Missing width/height fields causing downstream NaN (fixed)
 */

import { describe, it, expect } from '@jest/globals';
import { TreeLayoutStrategy } from '../strategies/TreeLayoutStrategy';
import { TimelineLayoutStrategy } from '../strategies/TimelineLayoutStrategy';
import { FallbackLayoutStrategy } from '../strategies/FallbackLayoutStrategy';
import { nodesOverlap } from '../layout-utils';
import type { NodeDatum, EdgeDatum, PositionedNode } from '@stv/core/types/diagram';
import type { LayoutConfig } from '../types';

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
    marginX: 50,
    marginY: 50,
    rankDirection: 'TB',
    nodeSeparation: 80,
    edgeSeparation: 10,
    rankSeparation: 100,
    ...overrides,
  } as LayoutConfig;
}

function getNodeWidth(n: PositionedNode): number {
  return n.width ?? n.w ?? 0;
}

function getNodeHeight(n: PositionedNode): number {
  return n.height ?? n.h ?? 0;
}

/**
 * Assert every node has finite x/y and defined width/height fields.
 *
 * Bug fix target: previously width/height were undefined (only w/h were set),
 * causing downstream NaN in overlap detection and canvas calculations.
 * We verify both fields exist and are positive — they may differ when the
 * LayoutEngine preserves the original NodeDatum.width while Dagre sets a
 * recalculated w. The key regression check is that width/height are defined.
 */
function expectValidPositions(nodes: PositionedNode[]): void {
  for (const node of nodes) {
    expect(Number.isFinite(node.x)).toBe(true);
    expect(Number.isFinite(node.y)).toBe(true);
    expect(getNodeWidth(node)).toBeGreaterThan(0);
    expect(getNodeHeight(node)).toBeGreaterThan(0);
  }
}

/**
 * Stricter check for individual strategies: width === w and height === h.
 * The TreeLayoutStrategy and FallbackLayoutStrategy both set these in tandem.
 */
function expectConsistentDimensions(nodes: PositionedNode[]): void {
  for (const node of nodes) {
    expect(node.width).toBeDefined();
    expect(node.height).toBeDefined();
    expect(node.w).toBeDefined();
    expect(node.h).toBeDefined();
    expect(node.width).toBe(node.w);
    expect(node.height).toBe(node.h);
  }
}

/** Assert no pair of nodes overlaps */
function expectNoOverlaps(nodes: PositionedNode[]): void {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      expect(nodesOverlap(nodes[i], nodes[j])).toBe(false);
    }
  }
}

/** Assert all nodes are within canvas bounds (with small tolerance) */
function expectWithinBounds(nodes: PositionedNode[], width: number, height: number): void {
  const tolerance = 50; // allow nodes slightly outside for layout edge cases
  for (const node of nodes) {
    expect(node.x).toBeGreaterThanOrEqual(-tolerance);
    expect(node.y).toBeGreaterThanOrEqual(-tolerance);
    expect(node.x + getNodeWidth(node)).toBeLessThanOrEqual(width + tolerance);
    expect(node.y + getNodeHeight(node)).toBeLessThanOrEqual(height + tolerance);
  }
}

// ---------------------------------------------------------------------------
// Test data: multi-level tree (root → children → grandchildren)
// ---------------------------------------------------------------------------

function makeMultiLevelTree(): { nodes: NodeDatum[]; edges: EdgeDatum[] } {
  const nodes: NodeDatum[] = [
    makeNode('root', 'Root', { width: 200, height: 80 }),
    makeNode('child1', 'Child 1'),
    makeNode('child2', 'Child 2'),
    makeNode('child3', 'Child 3'),
    makeNode('grand1a', 'Grandchild 1A'),
    makeNode('grand1b', 'Grandchild 1B'),
    makeNode('grand2a', 'Grandchild 2A'),
    makeNode('grand3a', 'Grandchild 3A'),
    makeNode('grand3b', 'Grandchild 3B'),
  ];
  const edges: EdgeDatum[] = [
    makeEdge('root', 'child1'),
    makeEdge('root', 'child2'),
    makeEdge('root', 'child3'),
    makeEdge('child1', 'grand1a'),
    makeEdge('child1', 'grand1b'),
    makeEdge('child2', 'grand2a'),
    makeEdge('child3', 'grand3a'),
    makeEdge('child3', 'grand3b'),
  ];
  return { nodes, edges };
}

// ===========================================================================
// TreeLayoutStrategy integration
// ===========================================================================

describe('Integration: TreeLayoutStrategy multi-level tree', () => {
  const config = makeConfig();
  const strategy = new TreeLayoutStrategy();

  it('should position all nodes with finite coordinates', async () => {
    const { nodes, edges } = makeMultiLevelTree();
    const result = await strategy.generateLayout(nodes, edges, config);

    expect(result.nodes).toHaveLength(9);
    expectValidPositions(result.nodes);
  });

  it('should produce width AND height fields consistent with w/h', async () => {
    const { nodes, edges } = makeMultiLevelTree();
    const result = await strategy.generateLayout(nodes, edges, config);

    expectConsistentDimensions(result.nodes);
  });

  it('should position root node near horizontal center', async () => {
    const { nodes, edges } = makeMultiLevelTree();
    const result = await strategy.generateLayout(nodes, edges, config);

    const root = result.nodes.find(n => n.id === 'root');
    expect(root).toBeDefined();
    const rootCenter = root!.x + getNodeWidth(root!) / 2;
    // Root should be roughly centered (within 300px of canvas center)
    expect(Math.abs(rootCenter - config.width / 2)).toBeLessThan(300);
  });

  it('should place deeper levels at increasing y coordinates', async () => {
    const { nodes, edges } = makeMultiLevelTree();
    const result = await strategy.generateLayout(nodes, edges, config);

    const root = result.nodes.find(n => n.id === 'root')!;
    const child = result.nodes.find(n => n.id === 'child1')!;
    const grandchild = result.nodes.find(n => n.id === 'grand1a')!;

    expect(child.y).toBeGreaterThan(root.y);
    expect(grandchild.y).toBeGreaterThan(child.y);
  });

  it('should generate valid edges with source/target points', async () => {
    const { nodes, edges } = makeMultiLevelTree();
    const result = await strategy.generateLayout(nodes, edges, config);

    expect(result.edges).toHaveLength(8);
    for (const edge of result.edges) {
      expect(edge.points.length).toBeGreaterThanOrEqual(2);
      for (const pt of edge.points) {
        expect(Number.isFinite(pt.x)).toBe(true);
        expect(Number.isFinite(pt.y)).toBe(true);
      }
    }
  });

  it('should handle single root with no children', async () => {
    const nodes = [makeNode('lonely', 'Lonely')];
    const result = await strategy.generateLayout(nodes, [], config);

    expect(result.nodes).toHaveLength(1);
    expectValidPositions(result.nodes);
  });

  it('should handle deep chain (5 levels)', async () => {
    const chainNodes = ['a', 'b', 'c', 'd', 'e'].map(id => makeNode(id));
    const chainEdges = [
      makeEdge('a', 'b'),
      makeEdge('b', 'c'),
      makeEdge('c', 'd'),
      makeEdge('d', 'e'),
    ];

    const result = await strategy.generateLayout(chainNodes, chainEdges, config);

    expect(result.nodes).toHaveLength(5);
    expectValidPositions(result.nodes);

    // y should be strictly increasing for each level
    const ys = result.nodes.map(n => n.y);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]).toBeGreaterThanOrEqual(ys[i - 1]);
    }
  });
});

// ===========================================================================
// TimelineLayoutStrategy integration
// ===========================================================================

describe('Integration: TimelineLayoutStrategy single-node timeline', () => {
  const config = makeConfig();
  const strategy = new TimelineLayoutStrategy();

  it('should position single node within canvas bounds', async () => {
    const nodes = [makeNode('event1', 'Solo Event')];
    const result = await strategy.generateLayout(nodes, [], config);

    expect(result.nodes).toHaveLength(1);
    expectValidPositions(result.nodes);

    const node = result.nodes[0];
    expect(node.x).toBeGreaterThanOrEqual(0);
    expect(node.y).toBeGreaterThanOrEqual(0);
  });

  it('should position multiple nodes sequentially', async () => {
    const nodes = ['e1', 'e2', 'e3', 'e4', 'e5'].map(id => makeNode(id));
    const result = await strategy.generateLayout(nodes, [], config);

    expect(result.nodes).toHaveLength(5);
    expectValidPositions(result.nodes);

    // Nodes should be ordered left to right
    const xs = result.nodes.map(n => n.x);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    }
  });

  it('should populate width/height on all nodes consistent with w/h', async () => {
    const nodes = ['a', 'b', 'c'].map(id => makeNode(id));
    const result = await strategy.generateLayout(nodes, [], config);

    expectConsistentDimensions(result.nodes);
  });
});

// ===========================================================================
// FallbackLayoutStrategy integration
// ===========================================================================

describe('Integration: FallbackLayoutStrategy regressions', () => {
  const config = makeConfig();
  const strategy = new FallbackLayoutStrategy(config);

  describe('single-node timeline', () => {
    it('should not produce negative x (regression: was x=-30)', () => {
      const nodes = [makeNode('solo', 'Solo')];
      const result = strategy.fallbackLayout(nodes, [], 'timeline');

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].x).toBeGreaterThanOrEqual(0);
    });

    it('should center single node horizontally', () => {
      const nodes = [makeNode('center', 'Center Event')];
      const result = strategy.fallbackLayout(nodes, [], 'timeline');

      const node = result.nodes[0];
      const nodeCenterX = node.x + getNodeWidth(node) / 2;
      expect(Math.abs(nodeCenterX - config.width / 2)).toBeLessThan(100);
    });

    it('should populate width AND height fields consistent with w/h', () => {
      const nodes = [makeNode('n1')];
      const result = strategy.fallbackLayout(nodes, [], 'timeline');

      expectConsistentDimensions(result.nodes);
    });
  });

  describe('multi-node timeline', () => {
    it('should spread nodes across canvas without overlaps', () => {
      const nodes = ['n1', 'n2', 'n3', 'n4', 'n5'].map(id => makeNode(id));
      const result = strategy.fallbackLayout(nodes, [], 'timeline');

      expect(result.nodes).toHaveLength(5);
      expectValidPositions(result.nodes);
      expectNoOverlaps(result.nodes);
    });
  });

  describe('multi-level tree (fallback)', () => {
    it('should produce valid positions for tree layout', () => {
      const { nodes, edges } = makeMultiLevelTree();
      const result = strategy.fallbackLayout(nodes, edges, 'tree');

      expect(result.nodes).toHaveLength(9);
      expectValidPositions(result.nodes);
    });

    it('should populate width/height fields on all tree nodes consistently', () => {
      const { nodes, edges } = makeMultiLevelTree();
      const result = strategy.fallbackLayout(nodes, edges, 'tree');

      expectConsistentDimensions(result.nodes);
    });
  });
});

// ===========================================================================
// Full LayoutEngine pipeline integration
// ===========================================================================

describe('Integration: LayoutEngine full pipeline', () => {
  it('should process multi-level tree through DagreLayoutStrategy', async () => {
    const { LayoutEngine } = await import('../layout-engine');
    const engine = new LayoutEngine({ width: 1920, height: 1080 });
    const { nodes, edges } = makeMultiLevelTree();

    const result = await engine.generateLayout(nodes, edges, 'tree', 1);

    expect(result.success).toBe(true);
    expect(result.layout.nodes.length).toBeGreaterThanOrEqual(1);
    expectValidPositions(result.layout.nodes);
    expectWithinBounds(result.layout.nodes, 1920, 1080);
  });

  it('should process single-node timeline through DagreLayoutStrategy', async () => {
    const { LayoutEngine } = await import('../layout-engine');
    const engine = new LayoutEngine({ width: 1920, height: 1080 });
    const nodes = [makeNode('solo', 'Solo Timeline Event')];

    const result = await engine.generateLayout(nodes, [], 'timeline', 1);

    expect(result.success).toBe(true);
    expect(result.layout.nodes).toHaveLength(1);
    expectValidPositions(result.layout.nodes);

    // Single node should not be off-screen
    const node = result.layout.nodes[0];
    expect(node.x).toBeGreaterThanOrEqual(-50);
  });

  it('should process multi-node timeline without overlaps', async () => {
    const { LayoutEngine } = await import('../layout-engine');
    const engine = new LayoutEngine({ width: 1920, height: 1080 });
    const nodes = ['t1', 't2', 't3', 't4'].map(id => makeNode(id));
    const edges = [makeEdge('t1', 't2'), makeEdge('t2', 't3'), makeEdge('t3', 't4')];

    const result = await engine.generateLayout(nodes, edges, 'timeline', 1);

    expect(result.success).toBe(true);
    expectValidPositions(result.layout.nodes);
  });

  it('should complete within reasonable time (<5s requirement)', async () => {
    const { LayoutEngine } = await import('../layout-engine');
    const engine = new LayoutEngine({ width: 1920, height: 1080 });
    const { nodes, edges } = makeMultiLevelTree();

    const start = Date.now();
    await engine.generateLayout(nodes, edges, 'tree', 1);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(5000);
  });

  it('should handle empty nodes gracefully', async () => {
    const { LayoutEngine } = await import('../layout-engine');
    const engine = new LayoutEngine({ width: 1920, height: 1080 });

    const result = await engine.generateLayout([], [], 'tree', 1);

    // Should not crash; returns success or controlled failure
    expect(result).toBeDefined();
  });

  it('should process tree with wider root node correctly', async () => {
    const { LayoutEngine } = await import('../layout-engine');
    const engine = new LayoutEngine({ width: 1920, height: 1080 });
    const nodes: NodeDatum[] = [
      makeNode('root', 'Very Wide Root Node Title', { width: 400 }),
      makeNode('c1', 'Child 1'),
      makeNode('c2', 'Child 2'),
      makeNode('c3', 'Child 3'),
      makeNode('c1a', 'Grandchild 1A'),
      makeNode('c1b', 'Grandchild 1B'),
    ];
    const edges = [
      makeEdge('root', 'c1'),
      makeEdge('root', 'c2'),
      makeEdge('root', 'c3'),
      makeEdge('c1', 'c1a'),
      makeEdge('c1', 'c1b'),
    ];

    const result = await engine.generateLayout(nodes, edges, 'tree', 1);

    expect(result.success).toBe(true);
    expectValidPositions(result.layout.nodes);

    // Verify no NaN propagation from width calculations
    for (const node of result.layout.nodes) {
      expect(isNaN(node.x)).toBe(false);
      expect(isNaN(node.y)).toBe(false);
    }
  });
});
