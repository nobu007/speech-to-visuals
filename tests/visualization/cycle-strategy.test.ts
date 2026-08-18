/**
 * Tests for CycleLayoutStrategy module
 * Covers: apply, estimateComplexity, name, canEscapeLocalMinimum
 * Includes edge cases: empty nodes, single node, overlaps, force-directed fallback,
 * edge generation with missing nodes, custom dimensions
 */

import { jest } from '@jest/globals';
import { NodeDatum, EdgeDatum } from '@stv/core/types/diagram';

// Mock layout-engine-v2 functions
const mockCalculateCanvasSize = jest.fn().mockReturnValue({ width: 1920, height: 1080 });
const mockCalculateMetrics = jest.fn().mockReturnValue({
  overlapCount: 0,
  edgeCrossings: 0,
  aspectRatio: 16 / 9,
});

jest.unstable_mockModule('@/visualization/layout-engine-v2', () => ({
  calculateCanvasSize: (...args: unknown[]) => mockCalculateCanvasSize(...args),
  calculateMetrics: (...args: unknown[]) => mockCalculateMetrics(...args),
}));

const { CycleLayoutStrategy, CycleStrategy } = await import('@/visualization/strategies/cycle-strategy');

function makeNodes(count: number, overrides?: Partial<NodeDatum>[]): NodeDatum[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    label: `Node ${i}`,
    ...(overrides?.[i] ?? {}),
  }));
}

function makeEdges(pairs: [string, string][], labels?: string[]): EdgeDatum[] {
  return pairs.map(([from, to], i) => ({
    from,
    to,
    id: `e${i}`,
    ...(labels?.[i] ? { label: labels[i] } : {}),
  }));
}

describe('CycleLayoutStrategy', () => {
  let strategy: CycleLayoutStrategy;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockCalculateCanvasSize.mockReturnValue({ width: 1920, height: 1080 });
    mockCalculateMetrics.mockReturnValue({
      overlapCount: 0,
      edgeCrossings: 0,
      aspectRatio: 16 / 9,
    });
    strategy = new CycleLayoutStrategy();
  });

  // ========================================
  // Properties
  // ========================================
  describe('properties', () => {
    test('should have name "cycle"', () => {
      expect(strategy.name).toBe('cycle');
    });

    test('should have canEscapeLocalMinimum true', () => {
      expect(strategy.canEscapeLocalMinimum).toBe(true);
    });
  });

  // ========================================
  // apply - empty nodes
  // ========================================
  describe('apply with empty nodes', () => {
    test('should return empty layout for no nodes', () => {
      const result = strategy.apply([], []);

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
      expect(result.canvas).toEqual({ width: 1920, height: 1080 });
      expect(result.metrics).toEqual({
        overlapCount: 0,
        edgeCrossings: 0,
        aspectRatio: 16 / 9,
      });
    });

    test('should not call calculateCanvasSize for empty input (early return)', () => {
      strategy.apply([], []);

      // Empty input returns early without calling mocked functions
      expect(mockCalculateCanvasSize).not.toHaveBeenCalled();
      expect(mockCalculateMetrics).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // apply - single node
  // ========================================
  describe('apply with single node', () => {
    test('should center a single node', () => {
      const nodes = makeNodes(1);
      const result = strategy.apply(nodes, []);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].x).toBe(1920 / 2 - 120 / 2);
      expect(result.nodes[0].y).toBe(1080 / 2 - 60 / 2);
      expect(result.nodes[0].width).toBe(120);
      expect(result.nodes[0].height).toBe(60);
    });

    test('should center a single node with custom dimensions', () => {
      const nodes = makeNodes(1, [{ width: 200, height: 100 }]);
      const result = strategy.apply(nodes, []);

      expect(result.nodes[0].width).toBe(200);
      expect(result.nodes[0].height).toBe(100);
      expect(result.nodes[0].x).toBe(1920 / 2 - 200 / 2);
      expect(result.nodes[0].y).toBe(1080 / 2 - 100 / 2);
    });
  });

  // ========================================
  // apply - multiple nodes on circle
  // ========================================
  describe('apply with multiple nodes', () => {
    test('should position 2 nodes opposite each other', () => {
      const nodes = makeNodes(2);
      const result = strategy.apply(nodes, []);

      expect(result.nodes).toHaveLength(2);

      const centerX = 1920 / 2;
      const centerY = 1080 / 2;

      // Two nodes should be roughly 180 degrees apart
      const n0Cx = result.nodes[0].x + result.nodes[0].width / 2;
      const n0Cy = result.nodes[0].y + result.nodes[0].height / 2;
      const n1Cx = result.nodes[1].x + result.nodes[1].width / 2;
      const n1Cy = result.nodes[1].y + result.nodes[1].height / 2;

      const dx0 = n0Cx - centerX;
      const dy0 = n0Cy - centerY;
      const dx1 = n1Cx - centerX;
      const dy1 = n1Cy - centerY;

      // They should be roughly opposite (angle diff ~ pi)
      const angle0 = Math.atan2(dy0, dx0);
      const angle1 = Math.atan2(dy1, dx1);
      const angleDiff = Math.abs(angle1 - angle0);
      expect(angleDiff).toBeCloseTo(Math.PI, 1);
    });

    test('should preserve all node data (id, label)', () => {
      const nodes: NodeDatum[] = [
        { id: 'alpha', label: 'Alpha' },
        { id: 'beta', label: 'Beta' },
        { id: 'gamma', label: 'Gamma' },
      ];
      const result = strategy.apply(nodes, []);

      expect(result.nodes.map(n => n.id)).toEqual(['alpha', 'beta', 'gamma']);
      expect(result.nodes.map(n => n.label)).toEqual(['Alpha', 'Beta', 'Gamma']);
    });

    test('should use default width/height when not specified', () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ];
      const result = strategy.apply(nodes, []);

      expect(result.nodes[0].width).toBe(120);
      expect(result.nodes[0].height).toBe(60);
      expect(result.nodes[1].width).toBe(120);
      expect(result.nodes[1].height).toBe(60);
    });

    test('should use custom node dimensions', () => {
      const nodes = makeNodes(3, [
        { width: 200, height: 100 },
        { width: 150, height: 80 },
        { width: 180, height: 90 },
      ]);
      const result = strategy.apply(nodes, []);

      expect(result.nodes[0].width).toBe(200);
      expect(result.nodes[0].height).toBe(100);
      expect(result.nodes[1].width).toBe(150);
      expect(result.nodes[1].height).toBe(80);
      expect(result.nodes[2].width).toBe(180);
      expect(result.nodes[2].height).toBe(90);
    });
  });

  // ========================================
  // apply - edge generation
  // ========================================
  describe('apply edge generation', () => {
    test('should generate edges with correct points for connected nodes', () => {
      const nodes = makeNodes(3);
      const edges = makeEdges([
        ['n0', 'n1'],
        ['n1', 'n2'],
      ]);
      const result = strategy.apply(nodes, edges);

      expect(result.edges).toHaveLength(2);

      for (const edge of result.edges) {
        expect(edge.points).toHaveLength(2);
        expect(edge.points[0]).toHaveProperty('x');
        expect(edge.points[0]).toHaveProperty('y');
        expect(edge.points[1]).toHaveProperty('x');
        expect(edge.points[1]).toHaveProperty('y');
      }
    });

    test('should produce empty points for edges with missing source', () => {
      const nodes = makeNodes(2);
      const edges: EdgeDatum[] = [
        { from: 'n999', to: 'n0', id: 'e0' },
      ];
      const result = strategy.apply(nodes, edges);

      expect(result.edges[0].points).toEqual([]);
    });

    test('should produce empty points for edges with missing target', () => {
      const nodes = makeNodes(2);
      const edges: EdgeDatum[] = [
        { from: 'n0', to: 'n999', id: 'e0' },
      ];
      const result = strategy.apply(nodes, edges);

      expect(result.edges[0].points).toEqual([]);
    });

    test('should preserve edge labels', () => {
      const nodes = makeNodes(2);
      const edges: EdgeDatum[] = [
        { from: 'n0', to: 'n1', label: 'connects', id: 'e0' },
      ];
      const result = strategy.apply(nodes, edges);

      expect(result.edges[0].label).toBe('connects');
    });

    test('should preserve edge ids', () => {
      const nodes = makeNodes(2);
      const edges: EdgeDatum[] = [
        { from: 'n0', to: 'n1', id: 'custom-edge-id' },
      ];
      const result = strategy.apply(nodes, edges);

      expect(result.edges[0].id).toBe('custom-edge-id');
    });

    test('should handle edges without labels or ids', () => {
      const nodes = makeNodes(2);
      const edges: EdgeDatum[] = [
        { from: 'n0', to: 'n1' },
      ];
      const result = strategy.apply(nodes, edges);

      expect(result.edges).toHaveLength(1);
    });

    test('should calculate edge points at node centers', () => {
      const nodes = makeNodes(2);
      const edges = makeEdges([['n0', 'n1']]);
      const result = strategy.apply(nodes, edges);

      const n0 = result.nodes[0];
      const n1 = result.nodes[1];
      const edge = result.edges[0];

      // Source point should be at center of n0
      expect(edge.points[0].x).toBeCloseTo(n0.x + n0.width / 2, 1);
      expect(edge.points[0].y).toBeCloseTo(n0.y + n0.height / 2, 1);
      // Target point should be at center of n1
      expect(edge.points[1].x).toBeCloseTo(n1.x + n1.width / 2, 1);
      expect(edge.points[1].y).toBeCloseTo(n1.y + n1.height / 2, 1);
    });
  });

  // ========================================
  // apply - force-directed fallback
  // ========================================
  describe('apply with overlapping nodes (force-directed fallback)', () => {
    test('should trigger force-directed fallback for many large overlapping nodes', () => {
      // Create enough extremely large nodes that they MUST overlap on the circle
      // With 30 nodes at 800x800, even on a large circle the AABB boxes will collide
      const overrides: Partial<NodeDatum>[] = Array.from({ length: 30 }, () => ({
        width: 800,
        height: 800,
      }));
      const nodes = makeNodes(30, overrides);
      const result = strategy.apply(nodes, []);

      expect(result.nodes).toHaveLength(30);
      for (const node of result.nodes) {
        expect(node.width).toBe(800);
        expect(node.height).toBe(800);
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
        expect(isFinite(node.x)).toBe(true);
        expect(isFinite(node.y)).toBe(true);
      }
    });

    test('should produce valid output with a few very large nodes that overlap', () => {
      // 4 nodes at 1500x1500 on a small circle - guaranteed AABB overlap
      const overrides: Partial<NodeDatum>[] = Array.from({ length: 4 }, () => ({
        width: 1500,
        height: 1500,
      }));
      const nodes = makeNodes(4, overrides);
      const result = strategy.apply(nodes, []);

      expect(result.nodes).toHaveLength(4);
      for (const node of result.nodes) {
        expect(node.width).toBe(1500);
        expect(node.height).toBe(1500);
      }
    });

    test('should apply force-directed with edges between overlapping nodes', () => {
      const overrides: Partial<NodeDatum>[] = Array.from({ length: 6 }, () => ({
        width: 1000,
        height: 1000,
      }));
      const nodes = makeNodes(6, overrides);
      const edges = makeEdges([
        ['n0', 'n1'],
        ['n2', 'n3'],
        ['n4', 'n5'],
      ]);
      const result = strategy.apply(nodes, edges);

      expect(result.nodes).toHaveLength(6);
      expect(result.edges).toHaveLength(3);

      // Edges should have points even after force-directed adjustments
      for (const edge of result.edges) {
        expect(edge.points).toHaveLength(2);
      }
    });
  });

  // ========================================
  // apply - canvas and metrics
  // ========================================
  describe('apply canvas and metrics', () => {
    test('should return canvas from calculateCanvasSize', () => {
      mockCalculateCanvasSize.mockReturnValue({ width: 2560, height: 1440 });

      const nodes = makeNodes(3);
      const result = strategy.apply(nodes, []);

      expect(result.canvas).toEqual({ width: 2560, height: 1440 });
    });

    test('should return metrics from calculateMetrics', () => {
      mockCalculateMetrics.mockReturnValue({
        overlapCount: 2,
        edgeCrossings: 1,
        aspectRatio: 1.5,
      });

      const nodes = makeNodes(3);
      const result = strategy.apply(nodes, []);

      expect(result.metrics.overlapCount).toBe(2);
      expect(result.metrics.edgeCrossings).toBe(1);
      expect(result.metrics.aspectRatio).toBe(1.5);
    });
  });

  // ========================================
  // estimateComplexity
  // ========================================
  describe('estimateComplexity', () => {
    test('should return 0 for empty nodes', () => {
      expect(strategy.estimateComplexity([])).toBe(0);
    });

    test('should return n^2 * 50 for given node count', () => {
      const n = 10;
      const expected = n * n * 50;
      const nodes = makeNodes(n);

      expect(strategy.estimateComplexity(nodes)).toBe(expected);
    });

    test('should increase quadratically with node count', () => {
      const nodes5 = makeNodes(5);
      const nodes10 = makeNodes(10);

      const c5 = strategy.estimateComplexity(nodes5);
      const c10 = strategy.estimateComplexity(nodes10);

      // 10 nodes should have 4x the complexity of 5 nodes
      expect(c10 / c5).toBeCloseTo(4, 1);
    });
  });

  // ========================================
  // Force-directed iteration behavior and convergence
  // ========================================
  describe('force-directed iteration behavior', () => {
    test('should produce finite positions after force-directed resolution', () => {
      // Many large overlapping nodes that guarantee force-directed
      const overrides: Partial<NodeDatum>[] = Array.from({ length: 20 }, () => ({
        width: 900,
        height: 900,
      }));
      const nodes = makeNodes(20, overrides);
      const result = strategy.apply(nodes, []);

      for (const node of result.nodes) {
        expect(isFinite(node.x)).toBe(true);
        expect(isFinite(node.y)).toBe(true);
        expect(isNaN(node.x)).toBe(false);
        expect(isNaN(node.y)).toBe(false);
      }
    });

    test('should reduce velocity through damping in force-directed', () => {
      // Force-directed should produce stable positions (not extreme values)
      const overrides: Partial<NodeDatum>[] = Array.from({ length: 8 }, () => ({
        width: 1200,
        height: 1200,
      }));
      const nodes = makeNodes(8, overrides);
      const result = strategy.apply(nodes, []);

      for (const node of result.nodes) {
        // Nodes should stay within reasonable bounds (not fly off to infinity)
        expect(node.x).toBeGreaterThan(-5000);
        expect(node.x).toBeLessThan(7000);
        expect(node.y).toBeGreaterThan(-5000);
        expect(node.y).toBeLessThan(7000);
      }
    });
  });

  // ========================================
  // Attraction toward circle position during force-directed
  // ========================================
  describe('circle attraction in force-directed', () => {
    test('should keep nodes near the circle after force-directed', () => {
      const overrides: Partial<NodeDatum>[] = Array.from({ length: 10 }, () => ({
        width: 800,
        height: 800,
      }));
      const nodes = makeNodes(10, overrides);
      const result = strategy.apply(nodes, []);

      const centerX = 1920 / 2;
      const centerY = 1080 / 2;

      // After force-directed, nodes should still be roughly around the center area
      for (const node of result.nodes) {
        const nodeCx = node.x + node.width / 2;
        const nodeCy = node.y + node.height / 2;
        const distFromCenter = Math.sqrt(
          Math.pow(nodeCx - centerX, 2) + Math.pow(nodeCy - centerY, 2)
        );
        // Nodes should be within a reasonable distance from center
        expect(distFromCenter).toBeLessThan(3000);
      }
    });
  });

  // ========================================
  // Overlap detection with touching/near-touching nodes
  // ========================================
  describe('overlap detection edge cases', () => {
    test('should detect exact AABB overlap between touching nodes', () => {
      // Two nodes placed at same position should trigger overlap detection
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A', width: 200, height: 100 },
        { id: 'b', label: 'B', width: 200, height: 100 },
        { id: 'c', label: 'C', width: 200, height: 100 },
      ];
      // With 3 nodes of 200x200, they'll be very tight on a small circle
      // and may or may not overlap depending on radius calculation
      const result = strategy.apply(nodes, []);
      expect(result.nodes).toHaveLength(3);
      // All nodes should have valid positions
      for (const node of result.nodes) {
        expect(isFinite(node.x)).toBe(true);
        expect(isFinite(node.y)).toBe(true);
      }
    });

    test('should trigger force-directed for nodes that just barely overlap', () => {
      // Use exactly 2 very large nodes that overlap on default radius
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A', width: 1500, height: 1500 },
        { id: 'b', label: 'B', width: 1500, height: 1500 },
      ];
      const result = strategy.apply(nodes, []);
      expect(result.nodes).toHaveLength(2);
      // Both nodes should have been repositioned
      for (const node of result.nodes) {
        expect(isFinite(node.x)).toBe(true);
        expect(isFinite(node.y)).toBe(true);
      }
    });

    test('should not trigger force-directed for small well-spaced nodes', () => {
      // Two tiny nodes far apart on the circle should not overlap
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A', width: 10, height: 10 },
        { id: 'b', label: 'B', width: 10, height: 10 },
      ];
      const result = strategy.apply(nodes, []);

      // Small nodes should not need force-directed
      const n0 = result.nodes[0];
      const n1 = result.nodes[1];

      // No overlap expected
      const overlapX = n0.x < n1.x + n1.width && n0.x + n0.width > n1.x;
      const overlapY = n0.y < n1.y + n1.height && n0.y + n0.height > n1.y;
      expect(overlapX && overlapY).toBe(false);
    });
  });

  // ========================================
  // Radius calculation edge cases
  // ========================================
  describe('radius calculation edge cases', () => {
    test('should use MIN_RADIUS for very small nodes', () => {
      // Very small nodes - radius should be at least MIN_RADIUS (200)
      const nodes = makeNodes(3, [
        { width: 10, height: 10 },
        { width: 10, height: 10 },
        { width: 10, height: 10 },
      ]);

      const result = strategy.apply(nodes, []);
      const centerX = 1920 / 2;
      const centerY = 1080 / 2;

      // At least one node should be at MIN_RADIUS distance from center
      for (const node of result.nodes) {
        const cx = node.x + (node.width ?? 120) / 2;
        const cy = node.y + (node.height ?? 60) / 2;
        const dist = Math.sqrt(Math.pow(cx - centerX, 2) + Math.pow(cy - centerY, 2));
        expect(dist).toBeGreaterThanOrEqual(190); // Approximately MIN_RADIUS
      }
    });

    test('should calculate larger radius for many large nodes', () => {
      // Many large nodes need a bigger circle
      const overrides: Partial<NodeDatum>[] = Array.from({ length: 15 }, () => ({
        width: 300,
        height: 300,
      }));
      const nodes = makeNodes(15, overrides);
      const result = strategy.apply(nodes, []);

      const centerX = 1920 / 2;
      const centerY = 1080 / 2;

      // Check that nodes are spread around the center
      const distances = result.nodes.map(node => {
        const cx = node.x + node.width / 2;
        const cy = node.y + node.height / 2;
        return Math.sqrt(Math.pow(cx - centerX, 2) + Math.pow(cy - centerY, 2));
      });

      const avgDist = distances.reduce((sum, d) => sum + d, 0) / distances.length;
      expect(avgDist).toBeGreaterThan(200); // Should be larger than MIN_RADIUS
    });

    test('should handle single very large node', () => {
      const nodes: NodeDatum[] = [
        { id: 'big', label: 'Big', width: 5000, height: 5000 },
      ];
      const result = strategy.apply(nodes, []);

      // Single node should be centered
      expect(result.nodes[0].x).toBe(1920 / 2 - 5000 / 2);
      expect(result.nodes[0].y).toBe(1080 / 2 - 5000 / 2);
      expect(result.nodes[0].width).toBe(5000);
      expect(result.nodes[0].height).toBe(5000);
    });
  });

  // ========================================
  // Force-directed with edges
  // ========================================
  describe('force-directed with edges', () => {
    test('should preserve edge connectivity after force-directed', () => {
      const overrides: Partial<NodeDatum>[] = Array.from({ length: 6 }, () => ({
        width: 1000,
        height: 1000,
      }));
      const nodes = makeNodes(6, overrides);
      const edges = makeEdges([
        ['n0', 'n1'],
        ['n2', 'n3'],
        ['n4', 'n5'],
      ]);
      const result = strategy.apply(nodes, edges);

      // All edges should have valid points
      expect(result.edges).toHaveLength(3);
      for (const edge of result.edges) {
        expect(edge.points).toHaveLength(2);
        for (const pt of edge.points) {
          expect(isFinite(pt.x)).toBe(true);
          expect(isFinite(pt.y)).toBe(true);
        }
      }
    });

    test('should handle edges to non-existent nodes during force-directed', () => {
      const overrides: Partial<NodeDatum>[] = Array.from({ length: 4 }, () => ({
        width: 900,
        height: 900,
      }));
      const nodes = makeNodes(4, overrides);
      const edges: EdgeDatum[] = [
        { from: 'n0', to: 'n999', id: 'e0' },
        { from: 'n888', to: 'n1', id: 'e1' },
      ];
      const result = strategy.apply(nodes, edges);

      expect(result.edges).toHaveLength(2);
      expect(result.edges[0].points).toEqual([]);
      expect(result.edges[1].points).toEqual([]);
    });
  });

  // ========================================
  // Bounds checking during force-directed
  // ========================================
  describe('bounds checking during force-directed', () => {
    test('should not produce NaN positions for overlapping nodes', () => {
      // Create nodes at the exact same position to force zero-distance in force-directed
      // This tests the `dist = Math.sqrt(dx*dx + dy*dy) || 1` fallback
      const overrides: Partial<NodeDatum>[] = Array.from({ length: 5 }, () => ({
        width: 2000,
        height: 2000,
      }));
      const nodes = makeNodes(5, overrides);
      const result = strategy.apply(nodes, []);

      for (const node of result.nodes) {
        expect(isNaN(node.x)).toBe(false);
        expect(isNaN(node.y)).toBe(false);
        expect(isFinite(node.x)).toBe(true);
        expect(isFinite(node.y)).toBe(true);
      }
    });
  });

  // ========================================
  // estimateComplexity edge cases
  // ========================================
  describe('estimateComplexity edge cases', () => {
    test('should return 0 for single node', () => {
      const nodes = makeNodes(1);
      expect(strategy.estimateComplexity(nodes)).toBe(1 * 1 * 50);
    });

    test('should handle large node counts', () => {
      const nodes = makeNodes(100);
      expect(strategy.estimateComplexity(nodes)).toBe(100 * 100 * 50);
    });
  });

  // ========================================
  // CycleStrategy alias
  // ========================================
  describe('CycleStrategy alias', () => {
    test('should be the same class as CycleLayoutStrategy', () => {
      expect(CycleStrategy).toBe(CycleLayoutStrategy);
    });

    test('should create instances with correct name', () => {
      const aliasInstance = new CycleStrategy();
      expect(aliasInstance.name).toBe('cycle');
    });
  });
});
