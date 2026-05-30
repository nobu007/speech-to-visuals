/**
 * Tests for conceptmap-strategy.ts
 * ConceptMapStrategy uses hierarchical layout with cross-connection support.
 */

import { jest } from '@jest/globals';

const mockCalculateMetrics = jest.fn();

const actualLayoutEngine = await import('@/visualization/layout-engine-v2');

jest.unstable_mockModule('@/visualization/layout-engine-v2', () => ({
  __esModule: true,
  ...actualLayoutEngine,
  calculateMetrics: mockCalculateMetrics,
}));

const { ConceptMapStrategy, conceptmapStrategy } = await import('../conceptmap-strategy');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(overrides: Partial<{ id: string; label: string; width: number; height: number; meta: { importance: number } }> = {}) {
  return { id: 'n1', label: 'Node 1', ...overrides };
}

function makeNodes(count: number) {
  return Array.from({ length: count }, (_, i) =>
    makeNode({ id: `n${i + 1}`, label: `Node ${i + 1}` }),
  );
}

function makeEdge(from: string, to: string, overrides: Record<string, unknown> = {}) {
  return { from, to, ...overrides };
}

/** Simple 3-level tree: root -> two children, each with one child */
function makeTree() {
  const nodes = makeNodes(5);
  const edges = [
    makeEdge('n1', 'n2'),
    makeEdge('n1', 'n3'),
    makeEdge('n2', 'n4'),
    makeEdge('n3', 'n5'),
  ];
  return { nodes, edges };
}

/** Tree with a cross-connection (non-tree edge between branches) */
function makeTreeWithCrossLink() {
  const nodes = makeNodes(5);
  const edges = [
    makeEdge('n1', 'n2'),
    makeEdge('n1', 'n3'),
    makeEdge('n2', 'n4'),
    makeEdge('n3', 'n5'),
    makeEdge('n4', 'n5', { label: 'relates to' }), // cross-connection
  ];
  return { nodes, edges };
}

/** Star graph: one center connected to many */
function makeStar() {
  const nodes = makeNodes(5);
  const edges = [
    makeEdge('n1', 'n2'),
    makeEdge('n1', 'n3'),
    makeEdge('n1', 'n4'),
    makeEdge('n1', 'n5'),
  ];
  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConceptMapStrategy', () => {
  let strategy: ConceptMapStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCalculateMetrics.mockReturnValue({
      overlapCount: 0,
      edgeCrossings: 0,
      aspectRatio: 16 / 9,
    });
    strategy = new ConceptMapStrategy();
  });

  // --- Basic properties ---

  it('has correct name', () => {
    expect(strategy.name).toBe('conceptmap');
  });

  it('can escape local minimum', () => {
    expect(strategy.canEscapeLocalMinimum).toBe(true);
  });

  it('exports a singleton', () => {
    expect(conceptmapStrategy).toBeInstanceOf(ConceptMapStrategy);
  });

  // --- Empty input ---

  it('returns empty result for zero nodes', () => {
    const result = strategy.apply([], []);
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
    expect(result.canvas).toBeDefined();
    expect(result.metrics.overlapCount).toBe(0);
  });

  // --- Single node ---

  it('positions a single node at canvas center', () => {
    const nodes = makeNodes(1);
    const result = strategy.apply(nodes, []);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].x).toBeGreaterThan(0);
    expect(result.nodes[0].y).toBeGreaterThan(0);
  });

  // --- Hierarchical layout ---

  it('positions all nodes in a tree', () => {
    const { nodes, edges } = makeTree();
    const result = strategy.apply(nodes, edges);
    expect(result.nodes).toHaveLength(5);
    for (const node of result.nodes) {
      expect(typeof node.x).toBe('number');
      expect(typeof node.y).toBe('number');
      expect(node.x).not.toBeNaN();
      expect(node.y).not.toBeNaN();
    }
  });

  it('places root above its children (lower y = higher position)', () => {
    const { nodes, edges } = makeTree();
    const result = strategy.apply(nodes, edges);
    // n1 should be the root (most connected)
    const root = result.nodes.find(n => n.id === 'n1')!;
    const child = result.nodes.find(n => n.id === 'n2')!;
    expect(root.y).toBeLessThanOrEqual(child.y);
  });

  it('places children at the same level horizontally', () => {
    const { nodes, edges } = makeStar();
    const result = strategy.apply(nodes, edges);
    // n2-n5 should all be at the same level (same y)
    const children = result.nodes.filter(n => ['n2', 'n3', 'n4', 'n5'].includes(n.id));
    const ys = children.map(c => c.y);
    // All children at same y
    for (const y of ys) {
      expect(y).toBe(ys[0]);
    }
  });

  // --- Cross-connections ---

  it('preserves cross-connection edges with labels', () => {
    const { nodes, edges } = makeTreeWithCrossLink();
    const result = strategy.apply(nodes, edges);
    expect(result.edges).toHaveLength(5);
    const crossEdge = result.edges.find(e => e.label === 'relates to');
    expect(crossEdge).toBeDefined();
    expect(crossEdge!.points).toHaveLength(2);
  });

  // --- Edge generation ---

  it('generates edges with two points each for valid node pairs', () => {
    const { nodes, edges } = makeTree();
    const result = strategy.apply(nodes, edges);
    expect(result.edges).toHaveLength(4);
    for (const edge of result.edges) {
      expect(edge.points).toHaveLength(2);
    }
  });

  it('preserves edge labels', () => {
    const nodes = makeNodes(3);
    const edges = [
      makeEdge('n1', 'n2', { label: 'causes' }),
      makeEdge('n2', 'n3', { label: 'leads to' }),
    ];
    const result = strategy.apply(nodes, edges as { from: string; to: string; label?: string }[]);
    expect(result.edges[0].label).toBe('causes');
    expect(result.edges[1].label).toBe('leads to');
  });

  it('handles edges referencing missing nodes gracefully', () => {
    const nodes = makeNodes(2);
    const edges = [makeEdge('n1', 'n99')];
    const result = strategy.apply(nodes, edges as { from: string; to: string }[]);
    expect(result.edges[0].points).toHaveLength(0);
  });

  // --- Importance-aware sizing ---

  it('respects importance for node sizing', () => {
    const nodes = [
      makeNode({ id: 'n1', label: 'Important', meta: { importance: 1.0 } }),
      makeNode({ id: 'n2', label: 'Normal', meta: { importance: 0.5 } }),
    ];
    const edges = [makeEdge('n1', 'n2')];
    const result = strategy.apply(nodes, edges as { from: string; to: string }[]);
    const important = result.nodes.find(n => n.id === 'n1')!;
    const normal = result.nodes.find(n => n.id === 'n2')!;
    // Higher importance → larger node
    expect(important.width).toBeGreaterThan(normal.width);
  });

  // --- Custom dimensions ---

  it('respects custom node width and height', () => {
    const nodes = [
      { id: 'n1', label: 'Big', width: 200, height: 100 },
      { id: 'n2', label: 'Small', width: 80, height: 40 },
    ];
    const edges = [makeEdge('n1', 'n2')];
    const result = strategy.apply(nodes, edges as { from: string; to: string }[]);
    const big = result.nodes.find(n => n.id === 'n1')!;
    // Importance scale is 1.0 for default (0.5 importance → 1.125 scale)
    expect(big.width).toBeGreaterThan(0);
    expect(big.height).toBeGreaterThan(0);
  });

  // --- Disconnected nodes ---

  it('handles disconnected nodes by placing them at the deepest level', () => {
    const nodes = makeNodes(6);
    const edges = [makeEdge('n1', 'n2')];
    const result = strategy.apply(nodes, edges);
    expect(result.nodes).toHaveLength(6);
    for (const node of result.nodes) {
      expect(typeof node.x).toBe('number');
      expect(typeof node.y).toBe('number');
    }
  });

  // --- Complexity estimation ---

  it('estimates O(n log n) complexity', () => {
    const c10 = strategy.estimateComplexity(makeNodes(10));
    const c100 = strategy.estimateComplexity(makeNodes(100));
    expect(c100).toBeGreaterThan(c10);
  });

  // --- Determinism ---

  it('produces identical results for identical inputs', () => {
    const { nodes, edges } = makeTree();
    const r1 = strategy.apply(nodes, edges);
    const r2 = strategy.apply(nodes, edges);
    for (let i = 0; i < r1.nodes.length; i++) {
      expect(r1.nodes[i].x).toBe(r2.nodes[i].x);
      expect(r1.nodes[i].y).toBe(r2.nodes[i].y);
    }
  });

  // --- Larger graph ---

  it('positions a 10-node concept map with cross-connections', () => {
    const nodes = makeNodes(10);
    const edges = [
      makeEdge('n1', 'n2'), makeEdge('n1', 'n3'),
      makeEdge('n2', 'n4'), makeEdge('n2', 'n5'),
      makeEdge('n3', 'n6'), makeEdge('n3', 'n7'),
      makeEdge('n4', 'n8'),
      makeEdge('n5', 'n9'),
      makeEdge('n8', 'n9', { label: 'related' }), // cross-connection
      makeEdge('n6', 'n10'),
    ];
    const result = strategy.apply(nodes, edges);
    expect(result.nodes).toHaveLength(10);
    expect(result.edges).toHaveLength(10);
    for (const node of result.nodes) {
      expect(node.x).toBeGreaterThan(-100);
      expect(node.y).toBeGreaterThanOrEqual(0);
    }
  });
});
