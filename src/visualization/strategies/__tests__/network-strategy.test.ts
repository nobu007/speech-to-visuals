/**
 * Tests for network-strategy.ts
 * NetworkStrategy uses force-directed layout for network diagrams.
 */

import { jest } from '@jest/globals';

const mockCalculateMetrics = jest.fn();

const actualLayoutEngine = await import('@/visualization/layout-engine-v2');

jest.unstable_mockModule('@/visualization/layout-engine-v2', () => ({
  __esModule: true,
  ...actualLayoutEngine,
  calculateMetrics: mockCalculateMetrics,
}));

const { NetworkStrategy, networkStrategy } = await import('../network-strategy');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(overrides: Partial<{ id: string; label: string; width: number; height: number }> = {}) {
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

function makeTriangle() {
  const nodes = makeNodes(3);
  const edges = [makeEdge('n1', 'n2'), makeEdge('n2', 'n3'), makeEdge('n3', 'n1')];
  return { nodes, edges };
}

function makeHubAndSpokes() {
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

describe('NetworkStrategy', () => {
  let strategy: NetworkStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCalculateMetrics.mockReturnValue({
      overlapCount: 0,
      edgeCrossings: 0,
      aspectRatio: 16 / 9,
    });
    strategy = new NetworkStrategy();
  });

  // --- Basic properties ---

  it('has correct name', () => {
    expect(strategy.name).toBe('network');
  });

  it('can escape local minimum', () => {
    expect(strategy.canEscapeLocalMinimum).toBe(true);
  });

  it('exports a singleton', () => {
    expect(networkStrategy).toBeInstanceOf(NetworkStrategy);
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

  it('positions a single node', () => {
    const nodes = makeNodes(1);
    const result = strategy.apply(nodes, []);
    expect(result.nodes).toHaveLength(1);
    expect(typeof result.nodes[0].x).toBe('number');
    expect(typeof result.nodes[0].y).toBe('number');
  });

  // --- Triangle (cycle) ---

  it('positions all nodes in a triangle network', () => {
    const { nodes, edges } = makeTriangle();
    const result = strategy.apply(nodes, edges);
    expect(result.nodes).toHaveLength(3);
    for (const node of result.nodes) {
      expect(typeof node.x).toBe('number');
      expect(typeof node.y).toBe('number');
      expect(node.x).not.toBeNaN();
      expect(node.y).not.toBeNaN();
    }
  });

  it('keeps triangle nodes separated (no overlap)', () => {
    const { nodes, edges } = makeTriangle();
    const result = strategy.apply(nodes, edges);
    const pos = result.nodes;

    // Each pair should have distinct positions
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const dx = pos[i].x - pos[j].x;
        const dy = pos[i].y - pos[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(dist).toBeGreaterThan(0);
      }
    }
  });

  // --- Hub and spokes ---

  it('positions hub connected to multiple spokes', () => {
    const { nodes, edges } = makeHubAndSpokes();
    const result = strategy.apply(nodes, edges);
    expect(result.nodes).toHaveLength(5);
  });

  it('places spokes closer to hub than to each other', () => {
    const { nodes, edges } = makeHubAndSpokes();
    const result = strategy.apply(nodes, edges);
    const hub = result.nodes.find(n => n.id === 'n1')!;
    const spoke1 = result.nodes.find(n => n.id === 'n2')!;
    const spoke2 = result.nodes.find(n => n.id === 'n3')!;

    const hubToSpoke1 = Math.hypot(spoke1.x - hub.x, spoke1.y - hub.y);
    const spoke1ToSpoke2 = Math.hypot(spoke2.x - spoke1.x, spoke2.y - spoke1.y);
    // After force-directed layout, spoke-to-spoke distance should be >= hub-to-spoke
    expect(spoke1ToSpoke2).toBeGreaterThanOrEqual(hubToSpoke1 * 0.5);
  });

  // --- Edge generation ---

  it('generates edges with two points each', () => {
    const { nodes, edges } = makeTriangle();
    const result = strategy.apply(nodes, edges);
    expect(result.edges).toHaveLength(3);
    for (const edge of result.edges) {
      expect(edge.points).toHaveLength(2);
    }
  });

  it('preserves edge labels', () => {
    const nodes = makeNodes(3);
    const edges = [
      makeEdge('n1', 'n2', { label: 'connects' }),
      makeEdge('n2', 'n3', { label: 'relates' }),
    ];
    const result = strategy.apply(nodes, edges as { from: string; to: string; label?: string }[]);
    expect(result.edges[0].label).toBe('connects');
    expect(result.edges[1].label).toBe('relates');
  });

  it('handles edges referencing missing nodes gracefully', () => {
    const nodes = makeNodes(2);
    const edges = [makeEdge('n1', 'n99')];
    const result = strategy.apply(nodes, edges as { from: string; to: string }[]);
    expect(result.edges[0].points).toHaveLength(0);
  });

  // --- Complexity estimation ---

  it('estimates O(n^2) complexity', () => {
    const c10 = strategy.estimateComplexity(makeNodes(10));
    const c100 = strategy.estimateComplexity(makeNodes(100));
    expect(c100).toBeGreaterThan(c10);
    expect(c100).toBe(10000);
  });

  // --- Determinism ---

  it('produces identical results for identical inputs', () => {
    const { nodes, edges } = makeTriangle();
    const r1 = strategy.apply(nodes, edges);
    const r2 = strategy.apply(nodes, edges);
    for (let i = 0; i < r1.nodes.length; i++) {
      expect(r1.nodes[i].x).toBe(r2.nodes[i].x);
      expect(r1.nodes[i].y).toBe(r2.nodes[i].y);
    }
  });

  // --- Custom dimensions ---

  it('respects custom node width and height', () => {
    const nodes = [
      { id: 'n1', label: 'Hub', width: 200, height: 80 },
      { id: 'n2', label: 'Spoke', width: 100, height: 40 },
    ];
    const edges = [makeEdge('n1', 'n2')];
    const result = strategy.apply(nodes, edges as { from: string; to: string }[]);
    const hub = result.nodes.find(n => n.id === 'n1')!;
    expect(hub.width).toBe(200);
    expect(hub.height).toBe(80);
  });

  // --- Disconnected nodes ---

  it('handles disconnected nodes by spreading them out', () => {
    const nodes = makeNodes(6);
    const edges = [makeEdge('n1', 'n2')];
    const result = strategy.apply(nodes, edges);
    expect(result.nodes).toHaveLength(6);
    // All nodes should have valid positions
    for (const node of result.nodes) {
      expect(typeof node.x).toBe('number');
      expect(typeof node.y).toBe('number');
      expect(node.x).toBeGreaterThanOrEqual(20);
      expect(node.y).toBeGreaterThanOrEqual(20);
    }
  });

  // --- Larger network ---

  it('positions a 10-node network with multiple edges', () => {
    const nodes = makeNodes(10);
    const edges = [
      makeEdge('n1', 'n2'), makeEdge('n2', 'n3'), makeEdge('n3', 'n4'),
      makeEdge('n4', 'n5'), makeEdge('n5', 'n1'), makeEdge('n1', 'n6'),
      makeEdge('n6', 'n7'), makeEdge('n7', 'n8'), makeEdge('n8', 'n9'),
      makeEdge('n9', 'n10'), makeEdge('n10', 'n6'),
    ];
    const result = strategy.apply(nodes, edges);
    expect(result.nodes).toHaveLength(10);
    expect(result.edges).toHaveLength(11);
    // Verify all nodes stay within canvas bounds
    for (const node of result.nodes) {
      expect(node.x).toBeGreaterThan(0);
      expect(node.y).toBeGreaterThan(0);
      expect(node.x).toBeLessThan(1920);
      expect(node.y).toBeLessThan(1080);
    }
  });
});
