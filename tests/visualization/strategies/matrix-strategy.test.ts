import { describe, it, expect } from '@jest/globals';
import { MatrixStrategy } from '@/visualization/strategies/matrix-strategy';
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

describe('MatrixStrategy', () => {
  const strategy = new MatrixStrategy();

  it('should implement LayoutStrategy interface', () => {
    expect(strategy.name).toBe('matrix');
    expect(strategy.canEscapeLocalMinimum).toBe(false);
    expect(typeof strategy.apply).toBe('function');
    expect(typeof strategy.estimateComplexity).toBe('function');
  });

  it('should be usable as a LayoutStrategy', () => {
    const _s: LayoutStrategy = strategy;
    expect(_s.name).toBe('matrix');
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

  it('should place 9 nodes on a 3x3-ish grid', () => {
    const nodes = makeNodes(9);
    const result = strategy.apply(nodes, []);

    expect(result.nodes).toHaveLength(9);

    // 9 nodes with 16:9 aspect ratio:
    // columns = ceil(sqrt(9 * 16/9)) = ceil(sqrt(16)) = ceil(4) = 4
    // rows = ceil(9 / 4) = ceil(2.25) = 3
    // So 4 columns, 3 rows
    const columns = Math.max(1, Math.ceil(Math.sqrt(9 * (16 / 9))));
    const rows = Math.max(1, Math.ceil(9 / columns));

    // Verify nodes are placed in grid positions
    const xs = result.nodes.map((n) => n.x);
    const ys = result.nodes.map((n) => n.y);

    // There should be at most `columns` distinct X positions
    const uniqueXs = new Set(xs.map((x) => Math.round(x)));
    expect(uniqueXs.size).toBeLessThanOrEqual(columns);

    // There should be at most `rows` distinct Y positions
    const uniqueYs = new Set(ys.map((y) => Math.round(y)));
    expect(uniqueYs.size).toBeLessThanOrEqual(rows);
  });

  it('should have equal spacing between adjacent nodes in the same row', () => {
    const nodes = makeNodes(4);
    const result = strategy.apply(nodes, []);

    // With 4 nodes: columns = ceil(sqrt(4 * 16/9)) = ceil(sqrt(7.11)) = ceil(2.67) = 3
    // rows = ceil(4/3) = 2
    const columns = Math.max(1, Math.ceil(Math.sqrt(4 * (16 / 9))));

    // Get nodes in the first row (those with the smallest Y values)
    const sortedByY = [...result.nodes].sort((a, b) => a.y - b.y);
    const firstRowNodes = sortedByY.slice(0, Math.min(columns, 4));

    if (firstRowNodes.length >= 2) {
      const sortedByX = [...firstRowNodes].sort((a, b) => a.x - b.x);
      const spacing1 = sortedByX[1].x - sortedByX[0].x;

      for (let i = 2; i < sortedByX.length; i++) {
        const spacing = sortedByX[i].x - sortedByX[i - 1].x;
        expect(Math.abs(spacing - spacing1)).toBeLessThan(1); // Within 1px tolerance
      }
    }
  });

  it('should auto-calculate grid dimensions from node count', () => {
    // Test various node counts
    const testCounts = [1, 2, 4, 6, 9, 12, 16, 20];
    for (const count of testCounts) {
      const nodes = makeNodes(count);
      const result = strategy.apply(nodes, []);
      expect(result.nodes).toHaveLength(count);

      // All nodes should have valid positions
      for (const node of result.nodes) {
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeGreaterThanOrEqual(0);
        expect(node.width).toBeGreaterThan(0);
        expect(node.height).toBeGreaterThan(0);
      }
    }
  });

  it('should guarantee zero overlaps', () => {
    const nodes = makeNodes(16);
    const edges = makeEdges([
      ['n0', 'n1'],
      ['n2', 'n3'],
      ['n4', 'n5'],
    ]);
    const result = strategy.apply(nodes, edges);

    expect(result.metrics.overlapCount).toBe(0);
  });

  it('should guarantee zero overlaps for various node counts', () => {
    for (let count = 1; count <= 25; count++) {
      const nodes = makeNodes(count);
      const result = strategy.apply(nodes, []);
      expect(result.metrics.overlapCount).toBe(0);
    }
  });

  it('should build edges with valid points for connected nodes', () => {
    const nodes = makeNodes(4);
    const edges = makeEdges([
      ['n0', 'n1'],
      ['n2', 'n3'],
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
      ['n0', 'n99'], // n99 does not exist
    ]);
    const result = strategy.apply(nodes, edges);

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].points).toHaveLength(0);
  });

  it('should return O(n) complexity estimate', () => {
    const nodes = makeNodes(100);
    const complexity = strategy.estimateComplexity(nodes);
    expect(complexity).toBe(100);
  });

  it('should handle nodes with custom dimensions', () => {
    const nodes: NodeDatum[] = [
      { id: 'a', label: 'A', width: 200, height: 100 },
      { id: 'b', label: 'B', width: 150, height: 80 },
      { id: 'c', label: 'C', width: 180, height: 90 },
    ];
    const result = strategy.apply(nodes, []);

    expect(result.nodes[0].width).toBe(200);
    expect(result.nodes[0].height).toBe(100);
    expect(result.nodes[1].width).toBe(150);
    expect(result.nodes[1].height).toBe(80);
    expect(result.nodes[2].width).toBe(180);
    expect(result.nodes[2].height).toBe(90);

    // Still zero overlaps even with custom sizes
    expect(result.metrics.overlapCount).toBe(0);
  });

  it('should return a result with proper canvas and metrics structure', () => {
    const nodes = makeNodes(6);
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

  it('should center nodes within their grid cells', () => {
    const nodes = makeNodes(4);
    const result = strategy.apply(nodes, []);

    // All nodes should have x >= padding since they're centered in cells
    for (const node of result.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(80); // CANVAS_PADDING
      expect(node.y).toBeGreaterThanOrEqual(80);
    }
  });
});
