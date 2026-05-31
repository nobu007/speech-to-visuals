/**
 * Tests for mindmap-strategy.ts
 * MindMapStrategy uses radial layout with center root and radiating branches.
 */

import { jest } from '@jest/globals';

const mockCalculateMetrics = jest.fn();

const actualLayoutEngine = await import('@/visualization/layout-engine-v2');

jest.unstable_mockModule('@/visualization/layout-engine-v2', () => ({
  __esModule: true,
  ...actualLayoutEngine,
  calculateMetrics: mockCalculateMetrics,
}));

const { MindMapStrategy, mindmapStrategy } = await import('../mindmap-strategy');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(overrides: Partial<{ id: string; label: string }> = {}): { id: string; label: string } {
  return { id: 'n1', label: 'Node 1', ...overrides };
}

function makeNodes(count: number): { id: string; label: string; width?: number; height?: number }[] {
  return Array.from({ length: count }, (_, i) =>
    makeNode({ id: `n${i + 1}`, label: `Node ${i + 1}` }) as { id: string; label: string; width?: number; height?: number },
  );
}

function makeEdge(from: string, to: string, overrides: Record<string, unknown> = {}): { from: string; to: string; [key: string]: unknown } {
  return { from, to, ...overrides };
}

/** Build a simple star: root -> n2, n3, n4 (3 branches) */
function makeStar() {
  const nodes = makeNodes(4);
  const edges = [
    makeEdge('n1', 'n2'),
    makeEdge('n1', 'n3'),
    makeEdge('n1', 'n4'),
  ];
  return { nodes, edges };
}

/** Build a mind map: root -> branch1, branch2 -> sub-branches */
function makeMindMap() {
  const nodes = makeNodes(7);
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

describe('MindMapStrategy', () => {
  let strategy: MindMapStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCalculateMetrics.mockReturnValue({
      overlapCount: 0,
      edgeCrossings: 0,
      aspectRatio: 16 / 9,
    });
    strategy = new MindMapStrategy();
  });

  // --- Basic properties ---

  it('has correct name', () => {
    expect(strategy.name).toBe('mindmap');
  });

  it('can escape local minimum', () => {
    expect(strategy.canEscapeLocalMinimum).toBe(true);
  });

  it('exports a singleton', () => {
    expect(mindmapStrategy).toBeInstanceOf(MindMapStrategy);
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

  it('positions a single node centered', () => {
    const nodes = makeNodes(1);
    const result = strategy.apply(nodes, []);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].x).toBeGreaterThan(0);
    expect(result.nodes[0].y).toBeGreaterThan(0);
  });

  // --- Star layout ---

  it('positions root node near canvas center for star layout', () => {
    const { nodes, edges } = makeStar();
    const result = strategy.apply(nodes, edges);
    expect(result.nodes).toHaveLength(4);

    // Root should be roughly centered
    const root = result.nodes.find(n => n.id === 'n1')!;
    expect(root).toBeDefined();
    expect(root.x).toBeGreaterThan(500);
    expect(root.x).toBeLessThan(1500);
    expect(root.y).toBeGreaterThan(200);
    expect(root.y).toBeLessThan(900);
  });

  it('positions branch nodes away from center', () => {
    const { nodes, edges } = makeStar();
    const result = strategy.apply(nodes, edges);

    const root = result.nodes.find(n => n.id === 'n1')!;
    const branch1 = result.nodes.find(n => n.id === 'n2')!;
    const branch2 = result.nodes.find(n => n.id === 'n3')!;

    // Branches should be further from center than root
    const rootDist = Math.hypot(root.x - 960, root.y - 540);
    const b1Dist = Math.hypot(branch1.x - 960, branch1.y - 540);
    const b2Dist = Math.hypot(branch2.x - 960, branch2.y - 540);

    expect(b1Dist).toBeGreaterThan(rootDist);
    expect(b2Dist).toBeGreaterThan(rootDist);
  });

  // --- Mind map with sub-branches ---

  it('positions all nodes in mind map with sub-branches', () => {
    const { nodes, edges } = makeMindMap();
    const result = strategy.apply(nodes, edges);

    expect(result.nodes).toHaveLength(7);

    // All nodes should have valid positions
    for (const node of result.nodes) {
      expect(typeof node.x).toBe('number');
      expect(typeof node.y).toBe('number');
      expect(node.x).not.toBeNaN();
      expect(node.y).not.toBeNaN();
    }
  });

  it('positions sub-branches further from center than their parents', () => {
    const { nodes, edges } = makeMindMap();
    const result = strategy.apply(nodes, edges);

    const cx = 960, cy = 540; // Approximate center
    const branch1 = result.nodes.find(n => n.id === 'n2')!;
    const subBranch = result.nodes.find(n => n.id === 'n4')!;

    const parentDist = Math.hypot(branch1.x - cx, branch1.y - cy);
    const childDist = Math.hypot(subBranch.x - cx, subBranch.y - cy);

    expect(childDist).toBeGreaterThan(parentDist);
  });

  // --- Edge generation ---

  it('generates edges with two points each', () => {
    const { nodes, edges } = makeStar();
    const result = strategy.apply(nodes, edges);

    expect(result.edges).toHaveLength(3);
    for (const edge of result.edges) {
      expect(edge.points).toHaveLength(2);
      expect(edge.points[0].x).toBeGreaterThan(0);
      expect(edge.points[0].y).toBeGreaterThan(0);
      expect(edge.points[1].x).toBeGreaterThan(0);
      expect(edge.points[1].y).toBeGreaterThan(0);
    }
  });

  it('preserves edge labels', () => {
    const nodes = makeNodes(3);
    const edges = [
      makeEdge('n1', 'n2', { label: 'connects to' }),
      makeEdge('n1', 'n3', { label: 'relates to' }),
    ];
    const result = strategy.apply(nodes, edges as { from: string; to: string; label?: string }[]);

    expect(result.edges[0].label).toBe('connects to');
    expect(result.edges[1].label).toBe('relates to');
  });

  // --- Complexity estimation ---

  it('estimates complexity as O(n log n)', () => {
    const nodes10 = makeNodes(10);
    const nodes100 = makeNodes(100);
    const c10 = strategy.estimateComplexity(nodes10);
    const c100 = strategy.estimateComplexity(nodes100);

    expect(c100).toBeGreaterThan(c10);
    expect(strategy.estimateComplexity(makeNodes(1))).toBeGreaterThanOrEqual(0);
  });

  // --- Root detection ---

  it('picks the highest-degree node as root', () => {
    const nodes = makeNodes(4);
    // n2 has the most connections (3 edges)
    const edges = [
      makeEdge('n2', 'n1'),
      makeEdge('n2', 'n3'),
      makeEdge('n2', 'n4'),
    ];
    const result = strategy.apply(nodes, edges);

    // Root (n2) should be near center
    const root = result.nodes.find(n => n.id === 'n2')!;
    expect(root.x).toBeGreaterThan(500);
    expect(root.x).toBeLessThan(1500);
  });

  // --- Disconnected nodes ---

  it('handles disconnected nodes gracefully', () => {
    const nodes = makeNodes(5);
    const edges = [makeEdge('n1', 'n2')];
    const result = strategy.apply(nodes, edges);

    expect(result.nodes).toHaveLength(5);
    for (const node of result.nodes) {
      expect(typeof node.x).toBe('number');
      expect(typeof node.y).toBe('number');
    }
  });

  // --- Nodes with custom dimensions ---

  it('respects custom node width and height', () => {
    // importance 1/3 gives scale=1.0 (MIN_SCALE + (MAX_SCALE-MIN_SCALE)*1/3 = 0.75+0.75/3 = 1.0)
    const nodes = [
      { id: 'n1', label: 'Root', width: 200, height: 80, meta: { importance: 1/3 } },
      { id: 'n2', label: 'Child', width: 150, height: 40, meta: { importance: 1/3 } },
    ];
    const edges = [makeEdge('n1', 'n2')];
    const result = strategy.apply(nodes, edges as { from: string; to: string }[]);

    const root = result.nodes.find(n => n.id === 'n1')!;
    expect(root.width).toBe(200);
    expect(root.height).toBe(80);
  });
});
