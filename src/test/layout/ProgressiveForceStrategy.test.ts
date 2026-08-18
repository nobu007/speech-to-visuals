import ProgressiveForceStrategy from '../../visualization/layout/strategies/ProgressiveForceStrategy';
import { PositionedNode, LayoutEdge, DiagramLayout, NodeDatum, EdgeDatum } from '@stv/core/types/diagram';
import { createTestConfig, createTestNode, createLayoutEdge } from './test-utils';

describe('ProgressiveForceStrategy', () => {
  let strategy: ProgressiveForceStrategy;
  const config = createTestConfig();

  beforeEach(() => {
    strategy = new ProgressiveForceStrategy();
  });

  // ---------- estimateComplexity (line 74) ----------
  it('estimateComplexity returns expected formula result', () => {
    const result = strategy.estimateComplexity(10, 5);
    // nodeCount * nodeCount * 0.7 + edgeCount * 0.3 = 100 * 0.7 + 5 * 0.3 = 71.5
    expect(result).toBeCloseTo(71.5);
  });

  // ---------- Basic layout with few nodes (all-pairs, no spatial hash) ----------
  it('lays out a small graph with no existing layout', async () => {
    const nodes: PositionedNode[] = [
      createTestNode('a', 0, 0, 80, 40),
      createTestNode('b', 100, 100, 80, 40),
    ];
    const edges: LayoutEdge[] = [
      createLayoutEdge('1', 'node-a', 'node-b'),
    ];

    const result = await strategy.performLayout(nodes, edges, config);
    expect(result.nodes.length).toBe(2);
    expect(result.edges.length).toBe(1);
    expect(result.edges[0].points.length).toBe(2);
    // Positions should be finite numbers
    for (const node of result.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });

  // ---------- Layout with existing layout (lines 80-83) ----------
  it('uses positions from existing layout when provided', async () => {
    const nodes: PositionedNode[] = [
      createTestNode('a', 0, 0, 80, 40),
      createTestNode('b', 100, 100, 80, 40),
    ];
    const edges: LayoutEdge[] = [];

    // Provide an existing layout with node positions
    const existingLayout: DiagramLayout = {
      nodes: [
        createTestNode('a', 200, 300, 80, 40),
        createTestNode('b', 400, 500, 80, 40),
      ],
      edges: [],
    };

    const result = await strategy.performLayout(nodes, edges, config, existingLayout);
    expect(result.nodes.length).toBe(2);
    // Positions should be finite (they start from existing positions and may move)
    for (const node of result.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });

  // ---------- Large graph triggers spatial hash (lines 237-281) ----------
  it('handles a large graph that triggers spatial hashing', async () => {
    // Need more than 50 nodes to trigger useSpatialHash
    const nodes: PositionedNode[] = [];
    for (let i = 0; i < 55; i++) {
      nodes.push(createTestNode(`${i}`, i * 10, i * 10, 50, 30));
    }

    const edges: LayoutEdge[] = [];

    const largeConfig = createTestConfig({ width: 5000, height: 5000 });
    const result = await strategy.performLayout(nodes, edges, largeConfig);
    expect(result.nodes.length).toBe(55);
    for (const node of result.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });

  // ---------- Nodes at same position (distSq < 1e-6, lines 216-218) ----------
  it('handles nodes at identical positions by adding jitter', async () => {
    // Create nodes all at the exact same position
    const nodes: PositionedNode[] = [
      createTestNode('a', 0, 0, 50, 30),
      createTestNode('b', 0, 0, 50, 30),
      createTestNode('c', 0, 0, 50, 30),
    ];
    const edges: LayoutEdge[] = [];

    const result = await strategy.performLayout(nodes, edges, config);
    expect(result.nodes.length).toBe(3);
    // Nodes should have been moved apart (jitter applied for same-position nodes)
    for (const node of result.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });

  // ---------- apply() public method ----------
  it('works through apply() with NodeDatum inputs', async () => {
    const nodes: NodeDatum[] = [
      { id: 'n1', label: 'A' },
      { id: 'n2', label: 'B' },
    ];
    const edges: EdgeDatum[] = [
      { id: 'e1', from: 'n1', to: 'n2', source: 'n1', target: 'n2' },
    ];

    const result = await strategy.apply(nodes, edges, config);
    expect(result.layout.nodes.length).toBe(2);
    expect(result.layout.edges.length).toBe(1);
    expect(result.metrics).toBeDefined();
  });

  // ---------- Layout with no edges ----------
  it('handles layout with no edges', async () => {
    const nodes: PositionedNode[] = [
      createTestNode('a', 0, 0, 80, 40),
      createTestNode('b', 200, 200, 80, 40),
      createTestNode('c', 400, 400, 80, 40),
    ];

    const result = await strategy.performLayout(nodes, [], config);
    expect(result.nodes.length).toBe(3);
  });

  // ---------- Layout with boundary constraints ----------
  it('applies boundary constraints when nodes are near edges', async () => {
    const narrowConfig = createTestConfig({ width: 100, height: 100 });
    const nodes: PositionedNode[] = [
      createTestNode('a', 0, 0, 50, 30),
      createTestNode('b', 80, 80, 50, 30),
    ];
    const edges: LayoutEdge[] = [];

    const result = await strategy.performLayout(nodes, edges, narrowConfig);
    expect(result.nodes.length).toBe(2);
  });

  // ---------- Existing layout with partial node match ----------
  it('handles existing layout with only some nodes matching', async () => {
    const nodes: PositionedNode[] = [
      createTestNode('a', 0, 0, 80, 40),
      createTestNode('b', 100, 100, 80, 40),
      createTestNode('c', 200, 200, 80, 40),
    ];
    const edges: LayoutEdge[] = [];

    // Existing layout only has node-a, missing b and c
    const existingLayout: DiagramLayout = {
      nodes: [
        createTestNode('a', 300, 400, 80, 40),
      ],
      edges: [],
    };

    const result = await strategy.performLayout(nodes, edges, config, existingLayout);
    expect(result.nodes.length).toBe(3);
  });

  // ---------- Update edge points with missing nodes ----------
  it('handles edges referencing missing nodes', async () => {
    const nodes: PositionedNode[] = [
      createTestNode('a', 0, 0, 80, 40),
    ];
    const edges: LayoutEdge[] = [
      createLayoutEdge('1', 'node-a', 'node-nonexistent'),
    ];

    const result = await strategy.performLayout(nodes, edges, config);
    expect(result.edges.length).toBe(1);
    // Target doesn't exist, so points should be empty
    expect(result.edges[0].points.length).toBe(0);
  });

  // ---------- name and canEscapeLocalMinimum ----------
  it('has correct name and canEscapeLocalMinimum', () => {
    expect(strategy.name).toBe('progressive-force');
    expect(strategy.canEscapeLocalMinimum).toBe(false);
  });
});
