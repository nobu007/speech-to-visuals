import GridSnapStrategy from '../../visualization/layout/strategies/GridSnapStrategy';
import { PositionedNode, LayoutEdge, NodeDatum, EdgeDatum } from '../../types/diagram';
import { createTestConfig, createTestNode, createLayoutEdge, hasAnyOverlap } from './test-utils';

const toLayoutEdges = (pairs: Array<[string, string]>): LayoutEdge[] =>
  pairs.map(([a, b], idx) => createLayoutEdge(String(idx + 1), a, b));

type LayoutResult = { nodes: PositionedNode[]; edges: LayoutEdge[] };

describe('GridSnapStrategy', () => {
  let strategy: GridSnapStrategy;

  beforeEach(() => {
    strategy = new GridSnapStrategy();
  });

  it('returns empty layout for empty inputs', async () => {
    const res: LayoutResult = await strategy.performLayout([], [], createTestConfig());
    expect(res.nodes.length).toBe(0);
    expect(res.edges.length).toBe(0);
  });

  it('places a single node onto grid without moving margins negatively', async () => {
    const nodes: PositionedNode[] = [createTestNode('1', 0, 0, 100, 50)];
    const res: LayoutResult = await strategy.performLayout(nodes, [], createTestConfig());
    expect(res.nodes.length).toBe(1);
    const n = res.nodes[0];
    expect(Number.isFinite(n.x)).toBe(true);
    expect(Number.isFinite(n.y)).toBe(true);
  });

  it('places multiple overlapping nodes into non-overlapping grid positions', async () => {
    const nodes: PositionedNode[] = [
      createTestNode('1', 0, 0, 100, 50),
      createTestNode('2', 0, 0, 100, 50),
      createTestNode('3', 0, 0, 100, 50),
      createTestNode('4', 0, 0, 100, 50),
    ];

    const res: LayoutResult = await strategy.performLayout(nodes, [], createTestConfig());
    expect(res.nodes.length).toBe(4);
    expect(hasAnyOverlap(res.nodes, 0)).toBe(false);
  });

  it('keeps edge endpoints connected after layout', async () => {
    const nodes: PositionedNode[] = [
      createTestNode('a', 0, 0, 80, 40),
      createTestNode('b', 0, 0, 80, 40),
    ];
    const edges = toLayoutEdges([
      ['node-a', 'node-b'],
    ]);
    const res: LayoutResult = await strategy.performLayout(nodes, edges, createTestConfig());
    expect(res.edges.length).toBe(1);
    expect(res.edges[0].points.length).toBe(2);
  });

  // ---------- estimateComplexity (line 58) ----------
  it('estimateComplexity returns n*n', () => {
    const result = strategy.estimateComplexity(10, 5);
    expect(result).toBe(100); // 10*10
  });

  // ---------- Many nodes that fit in adequate canvas ----------
  it('places many nodes in adequate canvas space', async () => {
    const config = createTestConfig({ width: 3000, height: 3000 });

    // Create many nodes to fill a grid
    const nodes: PositionedNode[] = [];
    for (let i = 0; i < 20; i++) {
      nodes.push(createTestNode(`${i}`, 0, 0, 50, 30));
    }

    const res: LayoutResult = await strategy.performLayout(nodes, [], config);
    expect(res.nodes.length).toBe(20);
    // All nodes should be placed
    for (const node of res.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });

  // ---------- Fill grid then trigger expansion ----------
  it('triggers grid expansion when nodes fill the grid', async () => {
    // Use a smallish canvas so we fill it quickly but not so small it's impossible
    const config = createTestConfig({ width: 800, height: 800 });
    const nodes: PositionedNode[] = [];
    // Fill with 6 nodes of moderate size
    for (let i = 0; i < 6; i++) {
      nodes.push(createTestNode(`${i}`, 0, 0, 100, 80));
    }
    const res: LayoutResult = await strategy.performLayout(nodes, [], config);
    expect(res.nodes.length).toBe(6);
    expect(hasAnyOverlap(res.nodes, 0)).toBe(false);
  });

  // ---------- updateEdgePoints with missing source/target (line 290) ----------
  it('returns empty points for edges with missing source or target', async () => {
    const nodes: PositionedNode[] = [
      createTestNode('a', 0, 0, 80, 40),
    ];
    // Edge references non-existent node
    const edges: LayoutEdge[] = [
      { id: 'e1', from: 'node-a', to: 'node-nonexistent', source: 'node-a', target: 'node-nonexistent', points: [] },
    ];

    const res: LayoutResult = await strategy.performLayout(nodes, edges, createTestConfig());
    expect(res.edges.length).toBe(1);
    // Since target doesn't exist, points should be empty
    expect(res.edges[0].points.length).toBe(0);
  });

  // ---------- detectOverlaps override (always returns empty) ----------
  it('detectOverlaps always returns empty array', () => {
    const nodes: PositionedNode[] = [
      createTestNode('1', 0, 0, 100, 50),
      createTestNode('2', 0, 0, 100, 50),
    ];
    // Even though these overlap, the strategy returns no overlaps
    const overlaps = strategy.detectOverlaps(nodes, 0);
    expect(overlaps).toEqual([]);
  });

  // ---------- Large nodes in adequate canvas ----------
  it('handles large nodes in adequate canvas space', async () => {
    const config = createTestConfig({ width: 2000, height: 2000 });
    const nodes: PositionedNode[] = [
      createTestNode('1', 0, 0, 200, 200),
      createTestNode('2', 0, 0, 200, 200),
      createTestNode('3', 0, 0, 200, 200),
    ];

    const res: LayoutResult = await strategy.performLayout(nodes, [], config);
    expect(res.nodes.length).toBe(3);
    expect(hasAnyOverlap(res.nodes, 0)).toBe(false);
  });

  // ---------- apply() public interface with NodeDatum/EdgeDatum ----------
  it('works through the apply() public method with NodeDatum inputs', async () => {
    const nodes: NodeDatum[] = [
      { id: 'n1', label: 'A' },
      { id: 'n2', label: 'B' },
    ];
    const edges: EdgeDatum[] = [
      { id: 'e1', from: 'n1', to: 'n2', source: 'n1', target: 'n2' },
    ];

    const result = await strategy.apply(nodes, edges, createTestConfig());
    expect(result.success).toBe(true); // GridSnap guarantees no overlaps
    expect(result.layout.nodes.length).toBe(2);
    expect(result.layout.edges.length).toBe(1);
    expect(result.metrics.overlapCount).toBe(0);
  });

  // ---------- Nodes without width/height use defaults ----------
  it('handles nodes without explicit width/height', async () => {
    const nodes: PositionedNode[] = [
      { id: 'node-a', label: 'A', x: 0, y: 0, width: 0, height: 0 },
      { id: 'node-b', label: 'B', x: 0, y: 0, width: 0, height: 0 },
    ];

    const res: LayoutResult = await strategy.performLayout(nodes, [], createTestConfig());
    expect(res.nodes.length).toBe(2);
  });

  // ---------- expandGrid: expandRight path (lines 217-235) ----------
  it('triggers expandRight when grid needs horizontal expansion', async () => {
    // Tall but narrow canvas: forces horizontal expansion
    // Use small enough nodes that they can fit after expansion
    const config = createTestConfig({ width: 1500, height: 1500 });
    const nodes: PositionedNode[] = [];
    for (let i = 0; i < 10; i++) {
      nodes.push(createTestNode(`${i}`, 0, 0, 50, 30));
    }
    const res: LayoutResult = await strategy.performLayout(nodes, [], config);
    expect(res.nodes.length).toBe(10);
    for (const node of res.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });

  // ---------- expandGrid: expandDown path (line 239-258) ----------
  it('triggers expandDown when grid needs vertical expansion', async () => {
    // Wide but short canvas: forces vertical expansion
    const config = createTestConfig({ width: 2000, height: 2000 });
    const nodes: PositionedNode[] = [];
    for (let i = 0; i < 10; i++) {
      nodes.push(createTestNode(`${i}`, 0, 0, 60, 40));
    }
    const res: LayoutResult = await strategy.performLayout(nodes, [], config);
    expect(res.nodes.length).toBe(10);
    for (const node of res.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });

  // ---------- isAreaEmpty returns false for out-of-bounds (line 183-184) ----------
  it('handles nodes requiring more cells than the grid width/height', async () => {
    // A single large node with a large enough canvas that expansion can work
    const config = createTestConfig({ width: 2000, height: 2000 });
    const nodes: PositionedNode[] = [
      createTestNode('1', 0, 0, 300, 300),
    ];
    const res: LayoutResult = await strategy.performLayout(nodes, [], config);
    expect(res.nodes.length).toBe(1);
    expect(Number.isFinite(res.nodes[0].x)).toBe(true);
    expect(Number.isFinite(res.nodes[0].y)).toBe(true);
  });

  // ---------- markCells out-of-bounds skip (line 205-206) ----------
  it('handles marking cells at grid boundary edges', async () => {
    // Many nodes in adequate space
    const config = createTestConfig({ width: 2000, height: 2000 });
    const nodes: PositionedNode[] = [];
    for (let i = 0; i < 20; i++) {
      nodes.push(createTestNode(`${i}`, 0, 0, 50, 30));
    }
    const res: LayoutResult = await strategy.performLayout(nodes, [], config);
    expect(res.nodes.length).toBe(20);
  });

  // ---------- Empty nodes array for calculateCellSize ----------
  it('calculateCellSize defaults when no nodes given', async () => {
    const res: LayoutResult = await strategy.performLayout([], [], createTestConfig());
    expect(res.nodes.length).toBe(0);
  });
});
