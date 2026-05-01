import { describe, it, expect } from '@jest/globals';
import { CycleLayoutStrategy } from '@/visualization/strategies/cycle-strategy';
import { NodeDatum, EdgeDatum } from '@/types/diagram';
import { LayoutStrategy } from '@/visualization/types';

function makeNodes(count: number, overrides?: Partial<NodeDatum>[]): NodeDatum[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    label: `Node ${i}`,
    ...(overrides?.[i] ?? {}),
  }));
}

function makeEdges(pairs: [string, string][]): EdgeDatum[] {
  return pairs.map(([from, to], i) => ({ from, to, id: `e${i}` }));
}

describe('CycleLayoutStrategy', () => {
  const strategy = new CycleLayoutStrategy();

  it('should have correct name and canEscapeLocalMinimum', () => {
    expect(strategy.name).toBe('cycle');
    expect(strategy.canEscapeLocalMinimum).toBe(true);
  });

  it('should implement LayoutStrategy interface', () => {
    expect(strategy).toMatchObject({
      name: expect.any(String),
      canEscapeLocalMinimum: expect.any(Boolean),
    });
    expect(typeof strategy.apply).toBe('function');
    expect(typeof strategy.estimateComplexity).toBe('function');
  });

  it('should position 6 nodes on circle with equal angular spacing (60 degrees apart)', () => {
    const nodes = makeNodes(6);
    const result = strategy.apply(nodes, []);

    expect(result.nodes).toHaveLength(6);

    const centerX = 1920 / 2;
    const centerY = 1080 / 2;

    // Calculate expected radius
    const maxNodeWidth = 120;
    const maxNodeHeight = 60;
    const circumferenceNeeded = 6 * Math.max(maxNodeWidth, maxNodeHeight) * 1.2;
    const minRadius = circumferenceNeeded / (2 * Math.PI);
    const radius = Math.max(minRadius, 200);

    const angles: number[] = [];
    for (const node of result.nodes) {
      const dx = (node.x + node.width / 2) - centerX;
      const dy = (node.y + node.height / 2) - centerY;
      let angle = Math.atan2(dy, dx);
      if (angle < 0) angle += 2 * Math.PI;
      angles.push(angle);
    }

    // Verify angles are roughly 60 degrees (pi/3) apart
    const sortedAngles = [...angles].sort((a, b) => a - b);
    const angleStep = (2 * Math.PI) / 6;
    for (let i = 1; i < sortedAngles.length; i++) {
      const diff = sortedAngles[i] - sortedAngles[i - 1];
      expect(diff).toBeCloseTo(angleStep, 1);
    }

    // Verify nodes are approximately on circle
    for (const node of result.nodes) {
      const dx = (node.x + node.width / 2) - centerX;
      const dy = (node.y + node.height / 2) - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeCloseTo(radius, -1);
    }
  });

  it('should position nodes with equal angular spacing for various node counts', () => {
    for (const count of [2, 3, 5, 10, 20]) {
      const nodes = makeNodes(count);
      const result = strategy.apply(nodes, []);

      expect(result.nodes).toHaveLength(count);

      const centerX = 1920 / 2;
      const centerY = 1080 / 2;
      const expectedAngleStep = (2 * Math.PI) / count;

      const angles: number[] = result.nodes.map((node) => {
        const dx = (node.x + node.width / 2) - centerX;
        const dy = (node.y + node.height / 2) - centerY;
        let angle = Math.atan2(dy, dx);
        if (angle < 0) angle += 2 * Math.PI;
        return angle;
      });

      const sorted = [...angles].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        const diff = sorted[i] - sorted[i - 1];
        expect(diff).toBeCloseTo(expectedAngleStep, 1);
      }
    }
  });

  it('should create edge paths connecting nodes on circle', () => {
    const nodes = makeNodes(4);
    const edges = makeEdges([
      ['n0', 'n1'],
      ['n1', 'n2'],
      ['n2', 'n3'],
      ['n3', 'n0'],
    ]);
    const result = strategy.apply(nodes, edges);

    expect(result.edges).toHaveLength(4);

    for (const edge of result.edges) {
      expect(edge.points).toHaveLength(2);
      expect(edge.points[0]).toHaveProperty('x');
      expect(edge.points[0]).toHaveProperty('y');
      expect(edge.points[1]).toHaveProperty('x');
      expect(edge.points[1]).toHaveProperty('y');
    }

    // Verify first edge connects n0 center to n1 center
    const n0 = result.nodes.find((n) => n.id === 'n0')!;
    const n1 = result.nodes.find((n) => n.id === 'n1')!;
    const firstEdge = result.edges.find((e) => e.from === 'n0' && e.to === 'n1')!;
    expect(firstEdge.points[0].x).toBeCloseTo(n0.x + n0.width / 2, 1);
    expect(firstEdge.points[0].y).toBeCloseTo(n0.y + n0.height / 2, 1);
    expect(firstEdge.points[1].x).toBeCloseTo(n1.x + n1.width / 2, 1);
    expect(firstEdge.points[1].y).toBeCloseTo(n1.y + n1.height / 2, 1);
  });

  it('should apply force-directed fallback for overlapping large nodes', () => {
    // Create nodes with very large sizes that will overlap on a small circle
    const overrides: Partial<NodeDatum>[] = Array.from({ length: 10 }, () => ({
      width: 600,
      height: 400,
    }));
    const nodes = makeNodes(10, overrides);
    const result = strategy.apply(nodes, []);

    // The force-directed fallback should have resolved overlaps or reduced them
    // We verify the result still has 10 positioned nodes
    expect(result.nodes).toHaveLength(10);

    // All nodes should have their widths and heights preserved
    for (const node of result.nodes) {
      expect(node.width).toBe(600);
      expect(node.height).toBe(400);
    }
  });

  it('should handle empty graph', () => {
    const result = strategy.apply([], []);

    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
    expect(result.canvas.width).toBe(1920);
    expect(result.canvas.height).toBe(1080);
    expect(result.metrics.overlapCount).toBe(0);
    expect(result.metrics.edgeCrossings).toBe(0);
  });

  it('should handle single node', () => {
    const nodes = makeNodes(1);
    const result = strategy.apply(nodes, []);

    expect(result.nodes).toHaveLength(1);
    // Single node should be centered
    expect(result.nodes[0].x).toBeCloseTo(1920 / 2 - 60, 0);
    expect(result.nodes[0].y).toBeCloseTo(1080 / 2 - 30, 0);
    expect(result.nodes[0].width).toBe(120);
    expect(result.nodes[0].height).toBe(60);
  });

  it('should return valid metrics', () => {
    const nodes = makeNodes(5);
    const edges = makeEdges([
      ['n0', 'n1'],
      ['n2', 'n3'],
    ]);
    const result = strategy.apply(nodes, edges);

    expect(result.metrics).toHaveProperty('overlapCount');
    expect(result.metrics).toHaveProperty('edgeCrossings');
    expect(result.metrics).toHaveProperty('aspectRatio');
    expect(typeof result.metrics.overlapCount).toBe('number');
    expect(typeof result.metrics.edgeCrossings).toBe('number');
    expect(typeof result.metrics.aspectRatio).toBe('number');
  });

  it('should return a valid canvas', () => {
    const nodes = makeNodes(5);
    const result = strategy.apply(nodes, []);

    expect(result.canvas).toHaveProperty('width');
    expect(result.canvas).toHaveProperty('height');
    expect(result.canvas.width).toBeGreaterThan(0);
    expect(result.canvas.height).toBeGreaterThan(0);
  });

  it('should estimate complexity based on node count', () => {
    const nodes5 = makeNodes(5);
    const nodes10 = makeNodes(10);

    const complexity5 = strategy.estimateComplexity(nodes5);
    const complexity10 = strategy.estimateComplexity(nodes10);

    expect(complexity5).toBeGreaterThan(0);
    expect(complexity10).toBeGreaterThan(complexity5);
  });

  it('should preserve node ids and labels in result', () => {
    const nodes = makeNodes(4);
    const result = strategy.apply(nodes, []);

    for (let i = 0; i < 4; i++) {
      expect(result.nodes[i].id).toBe(`n${i}`);
      expect(result.nodes[i].label).toBe(`Node ${i}`);
    }
  });

  it('should handle edges with missing source or target', () => {
    const nodes = makeNodes(2);
    const edges: EdgeDatum[] = [
      { from: 'n0', to: 'n999' },
      { from: 'n888', to: 'n1' },
    ];
    const result = strategy.apply(nodes, edges);

    expect(result.edges).toHaveLength(2);
    expect(result.edges[0].points).toEqual([]);
    expect(result.edges[1].points).toEqual([]);
  });

  it('should handle edges with labels', () => {
    const nodes = makeNodes(2);
    const edges: EdgeDatum[] = [
      { from: 'n0', to: 'n1', label: 'connects' },
    ];
    const result = strategy.apply(nodes, edges);

    expect(result.edges[0].label).toBe('connects');
  });

  it('should handle custom node dimensions', () => {
    const overrides: Partial<NodeDatum>[] = [
      { width: 200, height: 100 },
      { width: 150, height: 80 },
    ];
    const nodes = makeNodes(2, overrides);
    const result = strategy.apply(nodes, []);

    expect(result.nodes[0].width).toBe(200);
    expect(result.nodes[0].height).toBe(100);
    expect(result.nodes[1].width).toBe(150);
    expect(result.nodes[1].height).toBe(80);
  });

  it('should handle nodes with no width/height using defaults', () => {
    const nodes: NodeDatum[] = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    const result = strategy.apply(nodes, []);
    expect(result.nodes[0].width).toBe(120);
    expect(result.nodes[0].height).toBe(60);
  });
});
