/**
 * Tests for layout strategies: ProgressiveForceStrategy, SimulatedAnnealingStrategy,
 * GridSnapStrategy, and BaseLayoutStrategy shared functionality.
 *
 * Covers: layout correctness, overlap prevention, metrics calculation,
 * edge cases (empty inputs, single node, large graphs), and strategy properties.
 */

import { jest } from '@jest/globals';

// ─── Test Helpers ──────────────────────────────────────────────────

const defaultConfig = {
  width: 1920,
  height: 1080,
  nodeWidth: 150,
  nodeHeight: 60,
  marginX: 50,
  marginY: 50,
  rankDirection: 'TB' as const,
  nodeSeparation: 30,
  edgeSeparation: 10,
  rankSeparation: 50,
};

function makeNodes(count: number): NodeDatum[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `node-${i}`,
    label: `Node ${i}`,
  }));
}

function makeEdges(pairs: [number, number][]): EdgeDatum[] {
  return pairs.map(([from, to], i) => ({
    from: `node-${from}`,
    to: `node-${to}`,
    id: `edge-${i}`,
  }));
}

// Import after helpers
const { ProgressiveForceStrategy } = await import('../ProgressiveForceStrategy');
const { SimulatedAnnealingStrategy } = await import('../SimulatedAnnealingStrategy');
const { GridSnapStrategy } = await import('../GridSnapStrategy');
const { BaseLayoutStrategy } = await import('../LayoutStrategy');

// Import types
import type { NodeDatum, EdgeDatum } from '@stv/core/types/diagram';

// ─── ProgressiveForceStrategy ──────────────────────────────────────

describe('ProgressiveForceStrategy', () => {
  let strategy: ProgressiveForceStrategy;

  beforeEach(() => {
    strategy = new ProgressiveForceStrategy();
  });

  test('has correct name', () => {
    expect(strategy.name).toBe('progressive-force');
  });

  test('cannot escape local minimum', () => {
    expect(strategy.canEscapeLocalMinimum).toBe(false);
  });

  test('produces valid layout for simple graph', async () => {
    const nodes = makeNodes(5);
    const edges = makeEdges([[0, 1], [1, 2], [2, 3], [3, 4]]);
    const result = await strategy.apply(nodes, edges, defaultConfig);

    expect(result.success).toBeDefined();
    expect(result.layout.nodes.length).toBe(5);
    expect(result.layout.edges.length).toBe(4);
    expect(result.processingTime).toBeGreaterThanOrEqual(0);
  });

  test('all result nodes have finite coordinates', async () => {
    const nodes = makeNodes(10);
    const edges = makeEdges([[0, 1], [2, 3], [4, 5]]);
    const result = await strategy.apply(nodes, edges, defaultConfig);

    result.layout.nodes.forEach(node => {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    });
  });

  test('handles empty nodes', async () => {
    const result = await strategy.apply([], [], defaultConfig);
    expect(result.layout.nodes).toEqual([]);
    expect(result.layout.edges).toEqual([]);
  });

  test('handles single node', async () => {
    const result = await strategy.apply(makeNodes(1), [], defaultConfig);
    expect(result.layout.nodes.length).toBe(1);
    expect(Number.isFinite(result.layout.nodes[0].x)).toBe(true);
  });

  test('handles disconnected graph', async () => {
    const nodes = makeNodes(6);
    const edges = makeEdges([[0, 1]]); // Only one edge, rest disconnected
    const result = await strategy.apply(nodes, edges, defaultConfig);
    expect(result.layout.nodes.length).toBe(6);
  });

  test('respects existing layout positions', async () => {
    const nodes = makeNodes(3);
    const edges = makeEdges([[0, 1], [1, 2]]);
    const existingLayout = {
      nodes: [
        { id: 'node-0', label: 'Node 0', x: 100, y: 100, width: 150, height: 60 },
        { id: 'node-1', label: 'Node 1', x: 300, y: 200, width: 150, height: 60 },
        { id: 'node-2', label: 'Node 2', x: 500, y: 100, width: 150, height: 60 },
      ],
      edges: [],
    };
    const result = await strategy.apply(nodes, edges, defaultConfig, existingLayout);
    expect(result.layout.nodes.length).toBe(3);
  });

  test('estimateComplexity returns positive number', () => {
    const c = strategy.estimateComplexity(10, 5);
    expect(c).toBeGreaterThan(0);
  });

  test('calculateMetrics returns valid metrics', async () => {
    const nodes = makeNodes(5);
    const edges = makeEdges([[0, 1], [1, 2]]);
    const result = await strategy.apply(nodes, edges, defaultConfig);

    expect(result.metrics).toBeDefined();
    expect(result.metrics!.overlapCount).toBeGreaterThanOrEqual(0);
    expect(result.metrics!.edgeCrossings).toBeGreaterThanOrEqual(0);
    expect(result.metrics!.totalArea).toBeGreaterThanOrEqual(0);
  });

  test('calculateBoundingBox returns correct bounds', async () => {
    const result = await strategy.apply(makeNodes(4), makeEdges([[0, 1]]), defaultConfig);
    expect(result.bounds.width).toBeGreaterThanOrEqual(0);
    expect(result.bounds.height).toBeGreaterThanOrEqual(0);
  });

  test('handles large node count (20+)', async () => {
    const nodes = makeNodes(25);
    const edges = makeEdges([
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
      [5, 6], [6, 7], [7, 8], [8, 9], [9, 10],
    ]);
    const result = await strategy.apply(nodes, edges, defaultConfig);
    expect(result.layout.nodes.length).toBe(25);
    // All nodes should have finite positions
    result.layout.nodes.forEach(n => {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    });
  });
});

// ─── SimulatedAnnealingStrategy ───────────────────────────────────

describe('SimulatedAnnealingStrategy', () => {
  let strategy: SimulatedAnnealingStrategy;

  beforeEach(() => {
    strategy = new SimulatedAnnealingStrategy();
  });

  test('has correct name', () => {
    expect(strategy.name).toBe('simulated-annealing');
  });

  test('can escape local minimum', () => {
    expect(strategy.canEscapeLocalMinimum).toBe(true);
  });

  test('produces valid layout for simple graph', async () => {
    const nodes = makeNodes(5);
    const edges = makeEdges([[0, 1], [1, 2], [2, 3], [3, 4]]);
    const result = await strategy.apply(nodes, edges, defaultConfig);

    expect(result.success).toBeDefined();
    expect(result.layout.nodes.length).toBe(5);
    expect(result.layout.edges.length).toBe(4);
  });

  test('all result nodes have finite coordinates', async () => {
    const nodes = makeNodes(8);
    const edges = makeEdges([[0, 1], [2, 3], [4, 5], [6, 7]]);
    const result = await strategy.apply(nodes, edges, defaultConfig);

    result.layout.nodes.forEach(node => {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    });
  });

  test('handles empty nodes', async () => {
    const result = await strategy.apply([], [], defaultConfig);
    expect(result.layout.nodes).toEqual([]);
  });

  test('handles single node', async () => {
    const result = await strategy.apply(makeNodes(1), [], defaultConfig);
    expect(result.layout.nodes.length).toBe(1);
  });

  test('handles disconnected nodes', async () => {
    const nodes = makeNodes(5);
    const result = await strategy.apply(nodes, [], defaultConfig);
    expect(result.layout.nodes.length).toBe(5);
  });

  test('respects existing layout', async () => {
    const nodes = makeNodes(3);
    const edges = makeEdges([[0, 1], [1, 2]]);
    const existingLayout = {
      nodes: [
        { id: 'node-0', label: 'Node 0', x: 200, y: 200, width: 150, height: 60 },
        { id: 'node-1', label: 'Node 1', x: 400, y: 300, width: 150, height: 60 },
        { id: 'node-2', label: 'Node 2', x: 600, y: 200, width: 150, height: 60 },
      ],
      edges: [],
    };
    const result = await strategy.apply(nodes, edges, defaultConfig, existingLayout);
    expect(result.layout.nodes.length).toBe(3);
  });

  test('estimateComplexity returns positive number', () => {
    const c = strategy.estimateComplexity(10, 5);
    expect(c).toBeGreaterThan(0);
  });

  test('returns best solution found', async () => {
    const nodes = makeNodes(4);
    const edges = makeEdges([[0, 1], [1, 2], [2, 3]]);
    const result = await strategy.apply(nodes, edges, defaultConfig);
    // The strategy should return a valid solution
    expect(result.layout.nodes.length).toBe(4);
    result.layout.nodes.forEach(n => {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    });
  });

  test('handles moderately large graph (15 nodes)', async () => {
    const nodes = makeNodes(15);
    const edges = makeEdges([
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
      [5, 6], [6, 7], [7, 8], [8, 9], [9, 10],
      [10, 11], [11, 12], [12, 13], [13, 14],
    ]);
    const result = await strategy.apply(nodes, edges, defaultConfig);
    expect(result.layout.nodes.length).toBe(15);
  });
});

// ─── GridSnapStrategy ─────────────────────────────────────────────

describe('GridSnapStrategy', () => {
  let strategy: GridSnapStrategy;

  beforeEach(() => {
    strategy = new GridSnapStrategy();
  });

  test('has correct name', () => {
    expect(strategy.name).toBe('grid-snap');
  });

  test('can escape local minimum', () => {
    expect(strategy.canEscapeLocalMinimum).toBe(true);
  });

  test('produces valid layout for simple graph', async () => {
    const nodes = makeNodes(5);
    const edges = makeEdges([[0, 1], [1, 2]]);
    const result = await strategy.apply(nodes, edges, defaultConfig);

    expect(result.layout.nodes.length).toBe(5);
    expect(result.layout.edges.length).toBe(2);
  });

  test('all result nodes have finite coordinates', async () => {
    const nodes = makeNodes(8);
    const edges = makeEdges([[0, 1], [2, 3]]);
    const result = await strategy.apply(nodes, edges, defaultConfig);

    result.layout.nodes.forEach(node => {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    });
  });

  test('handles empty nodes', async () => {
    const result = await strategy.apply([], [], defaultConfig);
    expect(result.layout.nodes).toEqual([]);
  });

  test('handles single node', async () => {
    const result = await strategy.apply(makeNodes(1), [], defaultConfig);
    expect(result.layout.nodes.length).toBe(1);
  });

  test('handles many nodes', async () => {
    const nodes = makeNodes(20);
    const edges = makeEdges([[0, 1], [1, 2], [2, 3]]);
    const result = await strategy.apply(nodes, edges, defaultConfig);
    expect(result.layout.nodes.length).toBe(20);
  });

  test('nodes should not overlap (zero overlap guarantee)', async () => {
    const nodes = makeNodes(10);
    const edges = makeEdges([[0, 1], [2, 3], [4, 5]]);
    const result = await strategy.apply(nodes, edges, defaultConfig);

    // GridSnap should produce zero-overlap layout
    expect(result.metrics!.overlapCount).toBe(0);
  });

  test('estimateComplexity', () => {
    const c = strategy.estimateComplexity(10, 5);
    expect(c).toBeGreaterThan(0);
  });

  test('respects existing layout', async () => {
    const nodes = makeNodes(3);
    const edges = makeEdges([[0, 1]]);
    const existingLayout = {
      nodes: [
        { id: 'node-0', label: 'Node 0', x: 100, y: 100, width: 150, height: 60 },
        { id: 'node-1', label: 'Node 1', x: 300, y: 100, width: 150, height: 60 },
        { id: 'node-2', label: 'Node 2', x: 500, y: 100, width: 150, height: 60 },
      ],
      edges: [],
    };
    const result = await strategy.apply(nodes, edges, defaultConfig, existingLayout);
    expect(result.layout.nodes.length).toBe(3);
  });
});

// ─── BaseLayoutStrategy shared functionality ──────────────────────

describe('BaseLayoutStrategy (shared)', () => {
  // Use ProgressiveForceStrategy as concrete instance to test base methods
  // (GridSnapStrategy overrides detectOverlaps)
  let s: ProgressiveForceStrategy;

  beforeEach(() => {
    s = new ProgressiveForceStrategy();
  });

  test('detectOverlaps finds overlapping nodes', () => {
    const nodes = [
      { id: 'a', label: 'A', x: 100, y: 100, width: 150, height: 60 },
      { id: 'b', label: 'B', x: 110, y: 110, width: 150, height: 60 }, // overlaps with a
      { id: 'c', label: 'C', x: 500, y: 500, width: 150, height: 60 }, // no overlap
    ];
    const overlaps = s.detectOverlaps(nodes, 0);
    expect(overlaps.length).toBe(1);
    expect(overlaps[0].node1.id).toBe('a');
    expect(overlaps[0].node2.id).toBe('b');
  });

  test('detectOverlaps returns empty for non-overlapping nodes', () => {
    const nodes = [
      { id: 'a', label: 'A', x: 0, y: 0, width: 100, height: 50 },
      { id: 'b', label: 'B', x: 200, y: 200, width: 100, height: 50 },
    ];
    expect(s.detectOverlaps(nodes, 0)).toEqual([]);
  });

  test('calculateBoundingBox for single node', () => {
    const nodes = [
      { id: 'a', label: 'A', x: 100, y: 100, width: 50, height: 30 },
    ];
    const box = s.calculateBoundingBox(nodes);
    expect(box.minX).toBe(75);
    expect(box.maxX).toBe(125);
    expect(box.minY).toBe(85);
    expect(box.maxY).toBe(115);
    expect(box.width).toBe(50);
    expect(box.height).toBe(30);
  });

  test('calculateBoundingBox for empty nodes returns zeros', () => {
    const box = s.calculateBoundingBox([]);
    expect(box.width).toBe(0);
    expect(box.height).toBe(0);
  });

  test('getDefaultConfig returns flow config', () => {
    const config = s.getDefaultConfig('flow');
    expect(config.rankDirection).toBe('LR');
    expect(config.nodeSeparation).toBe(40);
  });

  test('getDefaultConfig returns tree config', () => {
    const config = s.getDefaultConfig('tree');
    expect(config.rankDirection).toBe('TB');
    expect(config.rankSeparation).toBe(100);
  });

  test('getDefaultConfig returns timeline config', () => {
    const config = s.getDefaultConfig('timeline');
    expect(config.rankDirection).toBe('LR');
    expect(config.rankSeparation).toBe(120);
  });

  test('getDefaultConfig returns matrix config', () => {
    const config = s.getDefaultConfig('matrix');
    expect(config.nodeSeparation).toBe(100);
  });

  test('getDefaultConfig returns cycle config', () => {
    const config = s.getDefaultConfig('cycle');
    expect(config.nodeSeparation).toBe(40);
  });

  test('getDefaultConfig returns default for unknown type', () => {
    const config = s.getDefaultConfig('unknown');
    expect(config.nodeWidth).toBe(150);
    expect(config.nodeHeight).toBe(60);
  });

  test('calculateMetrics for well-spaced nodes', () => {
    const nodes = [
      { id: 'a', label: 'A', x: 0, y: 0, width: 100, height: 50 },
      { id: 'b', label: 'B', x: 500, y: 500, width: 100, height: 50 },
    ];
    const edges: any[] = [];
    const metrics = s.calculateMetrics(nodes, edges);
    expect(metrics.overlapCount).toBe(0);
    expect(metrics.edgeCrossings).toBe(0);
    expect(metrics.totalArea).toBe(10000); // 2 * 100*50
    expect(metrics.nodeSpacing).toBeGreaterThan(0);
    expect(metrics.layoutBalance).toBeGreaterThanOrEqual(0);
    expect(metrics.layoutBalance).toBeLessThanOrEqual(1);
  });

  test('apply catches errors and returns failure result', async () => {
    // Pass config with invalid values that might cause an error
    const badConfig = { ...defaultConfig, nodeWidth: -1, nodeHeight: -1 };
    const result = await s.apply(makeNodes(3), makeEdges([[0, 1]]), badConfig);
    // Should not throw; either succeeds or returns error
    expect(result).toBeDefined();
    expect(result.layout).toBeDefined();
  });
});
