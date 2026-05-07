import { TimelineStrategy } from '@/visualization/strategies/timeline-strategy';
import { LayoutStrategy, StrategyLayoutResult } from '@/visualization/types';
import { NodeDatum, EdgeDatum, PositionedNode } from '@/types/diagram';

function makeNodes(count: number): NodeDatum[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    label: `Node ${i}`,
  }));
}

function makeEdges(pairs: [string, string][]): EdgeDatum[] {
  return pairs.map(([from, to]) => ({ from, to }));
}

describe('TimelineStrategy', () => {
  const strategy = new TimelineStrategy();

  it('should implement LayoutStrategy interface', () => {
    expect(strategy.name).toBe('timeline');
    expect(strategy.canEscapeLocalMinimum).toBe(true);
    expect(typeof strategy.apply).toBe('function');
    expect(typeof strategy.estimateComplexity).toBe('function');
  });

  it('should be usable as a LayoutStrategy', () => {
    const _s: LayoutStrategy = strategy;
    expect(_s.name).toBe('timeline');
  });

  it('should handle empty graph', () => {
    const result = strategy.apply([], []);
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
    expect(result.canvas.width).toBeGreaterThan(0);
    expect(result.canvas.height).toBeGreaterThan(0);
    expect(result.metrics.overlapCount).toBe(0);
    expect(result.metrics.edgeCrossings).toBe(0);
  });

  it('should handle single node', () => {
    const nodes = makeNodes(1);
    const result = strategy.apply(nodes, []);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].x).toBeGreaterThanOrEqual(0);
    expect(result.nodes[0].y).toBeGreaterThanOrEqual(0);
    expect(result.nodes[0].width).toBeGreaterThan(0);
    expect(result.nodes[0].height).toBeGreaterThan(0);
    expect(result.metrics.overlapCount).toBe(0);
  });

  it('should position nodes in chronological order (earlier nodes have smaller Y)', () => {
    const nodes = makeNodes(5);
    const edges = makeEdges([
      ['n0', 'n1'],
      ['n1', 'n2'],
      ['n2', 'n3'],
      ['n3', 'n4'],
    ]);
    const result = strategy.apply(nodes, edges);

    // Earlier nodes should have smaller Y values
    for (let i = 1; i < result.nodes.length; i++) {
      const prev = result.nodes.find((n) => n.id === `n${i - 1}`);
      const curr = result.nodes.find((n) => n.id === `n${i}`);
      expect(prev).toBeDefined();
      expect(curr).toBeDefined();
      expect(prev!.y).toBeLessThan(curr!.y);
    }
  });

  it('should fix Y coordinates based on timeline order', () => {
    const nodes = makeNodes(4);
    const edges = makeEdges([
      ['n0', 'n1'],
      ['n1', 'n2'],
      ['n2', 'n3'],
    ]);
    const result = strategy.apply(nodes, edges);

    // Y should be evenly spaced
    const ys = result.nodes.map((n) => n.y).sort((a, b) => a - b);
    if (ys.length > 2) {
      const spacing = ys[1] - ys[0];
      for (let i = 2; i < ys.length; i++) {
        expect(ys[i] - ys[i - 1]).toBeCloseTo(spacing, -1);
      }
    }
  });

  it('should not have X coordinate overlaps after layout', () => {
    const nodes = makeNodes(6);
    const edges = makeEdges([
      ['n0', 'n1'],
      ['n1', 'n2'],
      ['n2', 'n3'],
      ['n3', 'n4'],
      ['n4', 'n5'],
    ]);
    const result = strategy.apply(nodes, edges);

    expect(result.metrics.overlapCount).toBe(0);
  });

  it('should use index order as fallback when no edges are provided', () => {
    const nodes = makeNodes(4);
    const result = strategy.apply(nodes, []);

    // All nodes should be present, ordered by index
    expect(result.nodes).toHaveLength(4);
    const ids = result.nodes.map((n) => n.id);
    for (let i = 0; i < 4; i++) {
      expect(ids).toContain(`n${i}`);
    }

    // Y should be in order
    for (let i = 1; i < result.nodes.length; i++) {
      expect(result.nodes[i].y).toBeGreaterThan(result.nodes[i - 1].y);
    }
  });

  it('should build edges with valid points for connected nodes', () => {
    const nodes = makeNodes(3);
    const edges = makeEdges([
      ['n0', 'n1'],
      ['n1', 'n2'],
    ]);
    const result = strategy.apply(nodes, edges);

    expect(result.edges).toHaveLength(2);
    for (const edge of result.edges) {
      expect(edge.points).toHaveLength(2);
      expect(edge.points[0].x).toBeGreaterThanOrEqual(0);
      expect(edge.points[0].y).toBeGreaterThanOrEqual(0);
      expect(edge.points[1].x).toBeGreaterThanOrEqual(0);
      expect(edge.points[1].y).toBeGreaterThanOrEqual(0);
    }
  });

  it('should handle edges referencing non-existent nodes gracefully', () => {
    const nodes = makeNodes(2);
    const edges = makeEdges([
      ['n0', 'n1'],
      ['n1', 'n99'], // n99 does not exist
    ]);
    const result = strategy.apply(nodes, edges);

    expect(result.edges).toHaveLength(2);
    // The edge to n99 should have empty points
    const brokenEdge = result.edges.find((e) => e.to === 'n99');
    expect(brokenEdge).toBeDefined();
    expect(brokenEdge!.points).toHaveLength(0);
  });

  it('should return correct estimateComplexity', () => {
    const nodes = makeNodes(10);
    const complexity = strategy.estimateComplexity(nodes);
    expect(complexity).toBeGreaterThan(0);
    // Should be roughly O(n^2) due to force-directed iterations
    expect(complexity).toBeGreaterThan(nodes.length);
  });

  it('should handle nodes with custom dimensions', () => {
    const nodes: NodeDatum[] = [
      { id: 'a', label: 'A', width: 200, height: 100 },
      { id: 'b', label: 'B', width: 150, height: 80 },
    ];
    const result = strategy.apply(nodes, []);
    expect(result.nodes[0].width).toBe(200);
    expect(result.nodes[0].height).toBe(100);
    expect(result.nodes[1].width).toBe(150);
    expect(result.nodes[1].height).toBe(80);
  });

  it('should resolve overlaps via grid-snap fallback for many overlapping nodes', () => {
    // Create many nodes at similar conceptual levels to stress the overlap resolver
    const nodes = Array.from({ length: 20 }, (_, i) => ({
      id: `node-${i}`,
      label: `Node ${i}`,
    }));
    // Create a mostly-linear chain so they'll be placed at similar Y values
    const edges = makeEdges(
      Array.from({ length: 19 }, (_, i) => [`node-${i}`, `node-${i + 1}`] as [string, string]),
    );
    const result = strategy.apply(nodes, edges);

    // All nodes should be positioned
    expect(result.nodes).toHaveLength(20);

    // After grid-snap, there should be zero or minimal overlaps
    expect(result.metrics.overlapCount).toBe(0);
  });

  it('should return a result with proper canvas and metrics structure', () => {
    const nodes = makeNodes(3);
    const result = strategy.apply(nodes, []);

    expect(result.canvas).toHaveProperty('width');
    expect(result.canvas).toHaveProperty('height');
    expect(result.canvas.width).toBeGreaterThan(0);
    expect(result.canvas.height).toBeGreaterThan(0);

    expect(result.metrics).toHaveProperty('overlapCount');
    expect(result.metrics).toHaveProperty('edgeCrossings');
    expect(result.metrics).toHaveProperty('aspectRatio');
    expect(typeof result.metrics.aspectRatio).toBe('number');
  });
});
