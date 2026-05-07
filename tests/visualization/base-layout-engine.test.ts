import { BaseLayoutEngine } from '@/visualization/base/BaseLayoutEngine';
import { NodeDatum, EdgeDatum, DiagramType, PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutConfig, LayoutResult } from '@/visualization/types';

// Concrete implementation for testing abstract class
class TestableLayoutEngine extends BaseLayoutEngine {
  protected getDefaultConfig(override: Partial<LayoutConfig>): LayoutConfig {
    return {
      width: 1920,
      height: 1080,
      nodeWidth: 120,
      nodeHeight: 60,
      marginX: 40,
      marginY: 40,
      nodeSeparation: 20,
      ...override,
    };
  }

  async generateLayout(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    diagramType: DiagramType,
    iteration?: number
  ): Promise<LayoutResult> {
    const positioned = nodes.map((n, i) => ({
      ...n,
      x: i * 150 + 50,
      y: 50,
      w: this.calculateNodeWidth(n),
      h: this.calculateNodeHeight(n),
    }));

    return {
      success: true,
      layout: {
        nodes: positioned,
        edges: this.generateAllEdges(edges, positioned),
      },
      bounds: this.calculateBounds(positioned),
      processingTime: 10,
      confidence: 1,
      iteration: iteration ?? 1,
    };
  }

  // Expose protected methods for testing
  public testCalculateCenterX() { return this.calculateCenterX(); }
  public testCalculateCenterY() { return this.calculateCenterY(); }
  public testCalculateCenter() { return this.calculateCenter(); }
  public testCalculateNodeWidth(node: NodeDatum) { return this.calculateNodeWidth(node); }
  public testCalculateNodeHeight(node: NodeDatum) { return this.calculateNodeHeight(node); }
  public testCalculateNodeCenter(node: PositionedNode) { return this.calculateNodeCenter(node); }
  public testCalculateDistance(p1: { x: number; y: number }, p2: { x: number; y: number }) { return this.calculateDistance(p1, p2); }
  public testCalculateNodeDistance(n1: PositionedNode, n2: PositionedNode) { return this.calculateNodeDistance(n1, n2); }
  public testCalculateBounds(nodes: PositionedNode[]) { return this.calculateBounds(nodes); }
  public testBoundsWithinCanvas(bounds: ReturnType<BaseLayoutEngine['calculateBounds']>) { return this.boundsWithinCanvas(bounds); }
  public testDetectAllOverlaps(nodes: PositionedNode[], spacing?: number) { return this.detectAllOverlaps(nodes, spacing); }
  public testCountOverlaps(nodes: PositionedNode[]) { return this.countOverlaps(nodes); }
  public testConstrainAllNodesToBounds(nodes: PositionedNode[], margin?: number) { return this.constrainAllNodesToBounds(nodes, margin); }
  public testGenerateAllEdges(edges: EdgeDatum[], nodes: PositionedNode[]) { return this.generateAllEdges(edges, nodes); }
}

describe('BaseLayoutEngine', () => {
  const engine = new TestableLayoutEngine();

  describe('constructor and config', () => {
    it('should create engine with default config', () => {
      expect(engine.getConfig().width).toBe(1920);
      expect(engine.getConfig().height).toBe(1080);
    });

    it('should create engine with custom config', () => {
      const custom = new TestableLayoutEngine({ width: 800, height: 600 });
      expect(custom.getConfig().width).toBe(800);
      expect(custom.getConfig().height).toBe(600);
    });

    it('should update config dynamically', () => {
      engine.updateConfig({ width: 2000 });
      expect(engine.getConfig().width).toBe(2000);
      // Reset
      engine.updateConfig({ width: 1920 });
    });

    it('should return a copy of config', () => {
      const config = engine.getConfig();
      config.width = 999;
      expect(engine.getConfig().width).toBe(1920);
    });
  });

  describe('center calculations', () => {
    it('should calculate center x', () => {
      expect(engine.testCalculateCenterX()).toBe(960);
    });

    it('should calculate center y', () => {
      expect(engine.testCalculateCenterY()).toBe(540);
    });

    it('should calculate center point', () => {
      const center = engine.testCalculateCenter();
      expect(center).toEqual({ x: 960, y: 540 });
    });
  });

  describe('node calculations', () => {
    it('should calculate node width based on label', () => {
      const node: NodeDatum = { id: 'a', label: 'Hello World' };
      const w = engine.testCalculateNodeWidth(node);
      expect(w).toBeGreaterThan(0);
    });

    it('should calculate node height', () => {
      const node: NodeDatum = { id: 'a', label: 'Hello' };
      const h = engine.testCalculateNodeHeight(node);
      expect(h).toBeGreaterThan(0);
    });

    it('should calculate node center', () => {
      const node: PositionedNode = { id: 'a', label: 'A', x: 100, y: 200, width: 120, height: 60 };
      const center = engine.testCalculateNodeCenter(node);
      expect(center).toEqual({ x: 160, y: 230 });
    });

    it('should calculate distance between two points', () => {
      const d = engine.testCalculateDistance({ x: 0, y: 0 }, { x: 3, y: 4 });
      expect(d).toBe(5);
    });

    it('should calculate distance between two nodes', () => {
      const n1: PositionedNode = { id: 'a', label: 'A', x: 0, y: 0, width: 120, height: 60 };
      const n2: PositionedNode = { id: 'b', label: 'B', x: 200, y: 0, width: 120, height: 60 };
      const d = engine.testCalculateNodeDistance(n1, n2);
      expect(d).toBeGreaterThan(0);
    });
  });

  describe('bounds calculations', () => {
    it('should calculate bounds for positioned nodes', () => {
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 100, y: 100, w: 120, h: 60 },
        { id: 'b', label: 'B', x: 300, y: 200, w: 120, h: 60 },
      ];
      const bounds = engine.testCalculateBounds(nodes);
      expect(bounds.minX).toBe(100);
      expect(bounds.minY).toBe(100);
      expect(bounds.maxX).toBe(420);
      expect(bounds.maxY).toBe(260);
      expect(bounds.width).toBe(320);
      expect(bounds.height).toBe(160);
    });

    it('should return zero bounds for empty array', () => {
      const bounds = engine.testCalculateBounds([]);
      expect(bounds).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 });
    });

    it('should check if bounds are within canvas', () => {
      const smallBounds = { minX: 0, minY: 0, maxX: 500, maxY: 300, width: 500, height: 300 };
      expect(engine.testBoundsWithinCanvas(smallBounds)).toBe(true);

      const largeBounds = { minX: 0, minY: 0, maxX: 2000, maxY: 1500, width: 2000, height: 1500 };
      expect(engine.testBoundsWithinCanvas(largeBounds)).toBe(false);
    });
  });

  describe('overlap detection', () => {
    it('should detect overlapping nodes', () => {
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 100, y: 100, w: 120, h: 60, width: 120, height: 60 },
        { id: 'b', label: 'B', x: 110, y: 110, w: 120, h: 60, width: 120, height: 60 },
      ];
      const overlaps = engine.testDetectAllOverlaps(nodes);
      expect(overlaps.length).toBeGreaterThan(0);
    });

    it('should not detect overlaps for well-separated nodes', () => {
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 100, y: 100, w: 120, h: 60, width: 120, height: 60 },
        { id: 'b', label: 'B', x: 500, y: 500, w: 120, h: 60, width: 120, height: 60 },
      ];
      const overlaps = engine.testDetectAllOverlaps(nodes);
      expect(overlaps).toHaveLength(0);
    });

    it('should count overlaps', () => {
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 100, y: 100, w: 120, h: 60, width: 120, height: 60 },
        { id: 'b', label: 'B', x: 110, y: 110, w: 120, h: 60, width: 120, height: 60 },
        { id: 'c', label: 'C', x: 120, y: 120, w: 120, h: 60, width: 120, height: 60 },
      ];
      const count = engine.testCountOverlaps(nodes);
      expect(count).toBeGreaterThan(0);
    });

    it('should respect custom spacing parameter', () => {
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 100, y: 100, w: 120, h: 60, width: 120, height: 60 },
        { id: 'b', label: 'B', x: 300, y: 100, w: 120, h: 60, width: 120, height: 60 },
      ];
      // With very large spacing, they should overlap
      const overlaps = engine.testDetectAllOverlaps(nodes, 500);
      expect(overlaps.length).toBeGreaterThan(0);
    });
  });

  describe('bounds constraints', () => {
    it('should constrain nodes to canvas bounds', () => {
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: -100, y: -50, w: 120, h: 60 },
      ];
      engine.testConstrainAllNodesToBounds(nodes);
      expect(nodes[0].x).toBeGreaterThan(0);
      expect(nodes[0].y).toBeGreaterThan(0);
    });

    it('should constrain nodes exceeding canvas width', () => {
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 1900, y: 500, w: 120, h: 60 },
      ];
      engine.testConstrainAllNodesToBounds(nodes);
      expect(nodes[0].x + nodes[0].w / 2).toBeLessThanOrEqual(1920);
    });
  });

  describe('edge generation', () => {
    it('should generate edges between positioned nodes', () => {
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 100, y: 100, w: 120, h: 60 },
        { id: 'b', label: 'B', x: 400, y: 100, w: 120, h: 60 },
      ];
      const edges: EdgeDatum[] = [{ from: 'a', to: 'b' }];
      const result = engine.testGenerateAllEdges(edges, nodes);
      expect(result).toHaveLength(1);
      expect(result[0].from).toBe('a');
      expect(result[0].to).toBe('b');
      expect(result[0].points.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle edges with missing nodes', () => {
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 100, y: 100, w: 120, h: 60 },
      ];
      const edges: EdgeDatum[] = [{ from: 'a', to: 'missing' }];
      const result = engine.testGenerateAllEdges(edges, nodes);
      expect(result).toHaveLength(1);
      expect(result[0].points).toEqual([]);
    });
  });

  describe('generateLayout (concrete implementation)', () => {
    it('should produce a valid layout result', async () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ];
      const edges: EdgeDatum[] = [{ from: 'a', to: 'b' }];
      const result = await engine.generateLayout(nodes, edges, 'flow');

      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(2);
      expect(result.layout.edges).toHaveLength(1);
      expect(result.bounds.width).toBeGreaterThan(0);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });
  });
});
