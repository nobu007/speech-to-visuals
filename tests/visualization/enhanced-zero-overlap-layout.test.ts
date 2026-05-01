import { describe, it, expect } from '@jest/globals';
import { ZeroOverlapLayoutEngine } from '@/visualization/enhanced-zero-overlap-layout';
import { NodeDatum, EdgeDatum } from '@/types/diagram';

function makeNodes(count: number): NodeDatum[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    label: `Node ${i}`,
  }));
}

function makeEdges(pairs: [string, string][]): EdgeDatum[] {
  return pairs.map(([from, to]) => ({ from, to }));
}

describe('ZeroOverlapLayoutEngine', () => {
  const engine = new ZeroOverlapLayoutEngine();

  describe('flowchart layout', () => {
    it('should generate layout for flowchart type', async () => {
      const nodes = makeNodes(5);
      const edges = makeEdges([['n0', 'n1'], ['n1', 'n2'], ['n2', 'n3'], ['n3', 'n4']]);

      const result = await engine.generateZeroOverlapLayout('flowchart', nodes, edges);

      expect(result).toBeDefined();
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.qualityMetrics).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('tree layout', () => {
    it('should generate layout for tree type', async () => {
      const nodes = makeNodes(4);
      const edges = makeEdges([['n0', 'n1'], ['n0', 'n2'], ['n2', 'n3']]);

      const result = await engine.generateZeroOverlapLayout('tree', nodes, edges);

      expect(result).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();
    });
  });

  describe('timeline layout', () => {
    it('should generate layout for timeline type', async () => {
      const nodes = makeNodes(4);
      const edges = makeEdges([['n0', 'n1'], ['n1', 'n2'], ['n2', 'n3']]);

      const result = await engine.generateZeroOverlapLayout('timeline', nodes, edges);

      expect(result).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();
    });
  });

  describe('comparison layout', () => {
    it('should generate layout for comparison type', async () => {
      const nodes = makeNodes(4);
      const edges = makeEdges([['n0', 'n1'], ['n2', 'n3']]);

      const result = await engine.generateZeroOverlapLayout('comparison', nodes, edges);

      expect(result).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();
    });
  });

  describe('network layout', () => {
    it('should generate layout for network type', async () => {
      const nodes = makeNodes(5);
      const edges = makeEdges([['n0', 'n1'], ['n1', 'n2'], ['n2', 'n0'], ['n3', 'n4']]);

      const result = await engine.generateZeroOverlapLayout('network', nodes, edges);

      expect(result).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();
    });
  });

  describe('default (concept map) layout', () => {
    it('should generate layout for unknown diagram types', async () => {
      const nodes = makeNodes(3);
      const edges = makeEdges([['n0', 'n1'], ['n1', 'n2']]);

      const result = await engine.generateZeroOverlapLayout('unknown' as any, nodes, edges);

      expect(result).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();
    });
  });

  describe('empty graph', () => {
    it('should handle empty nodes', async () => {
      const result = await engine.generateZeroOverlapLayout('flowchart', [], []);

      expect(result.nodes).toHaveLength(0);
      expect(result.success).toBe(true);
    });
  });

  describe('single node', () => {
    it('should handle single node', async () => {
      const nodes = makeNodes(1);
      const result = await engine.generateZeroOverlapLayout('flowchart', nodes, []);

      expect(result).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();
    });
  });

  describe('custom configuration', () => {
    it('should accept custom configuration', async () => {
      const customEngine = new ZeroOverlapLayoutEngine({
        canvasWidth: 800,
        canvasHeight: 600,
        collisionResolutionStrategy: 'grid_snap',
      });
      const nodes = makeNodes(3);
      const result = await customEngine.generateZeroOverlapLayout('flowchart', nodes, []);

      expect(result).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();
    });
  });

  describe('quality metrics', () => {
    it('should return quality metrics', async () => {
      const nodes = makeNodes(4);
      const edges = makeEdges([['n0', 'n1'], ['n1', 'n2'], ['n2', 'n3']]);
      const result = await engine.generateZeroOverlapLayout('flowchart', nodes, edges);

      expect(result.qualityMetrics).toHaveProperty('overlapCount');
      expect(result.qualityMetrics).toHaveProperty('edgeCrossings');
      expect(result.qualityMetrics).toHaveProperty('canvasUtilization');
      expect(result.qualityMetrics).toHaveProperty('aestheticScore');
      expect(result.warnings).toBeDefined();
      expect(result.optimizationSteps).toBeGreaterThanOrEqual(0);
    });
  });
});
