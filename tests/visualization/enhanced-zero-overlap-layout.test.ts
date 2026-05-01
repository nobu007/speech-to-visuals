import { describe, test, expect } from '@jest/globals';
import { ZeroOverlapLayoutEngine } from '@/visualization/enhanced-zero-overlap-layout';
import { NodeDatum, EdgeDatum, DiagramType } from '@/types/diagram';

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
    test('should generate layout for flowchart type', async () => {
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
      test('should generate layout for tree type', async () => {
      const nodes = makeNodes(4);
      const edges = makeEdges([['n0', 'n1'], ['n0', 'n2'], ['n2', 'n3']]);

      const result = await engine.generateZeroOverlapLayout('tree', nodes, edges);

      expect(result).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();
    });
  });

  describe('timeline layout', () => {
      test('should generate layout for timeline type', async () => {
      const nodes = makeNodes(4);
      const edges = makeEdges([['n0', 'n1'], ['n1', 'n2'], ['n2', 'n3']]);

      const result = await engine.generateZeroOverlapLayout('timeline', nodes, edges);

      expect(result).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();
    });
  });

  describe('comparison layout', () => {
      test('should generate layout for comparison type', async () => {
      const nodes = makeNodes(4);
      const edges = makeEdges([['n0', 'n1'], ['n2', 'n3']]);

      const result = await engine.generateZeroOverlapLayout('comparison', nodes, edges);

      expect(result).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();
    });
  });

  describe('network layout', () => {
      test('should generate layout for network type', async () => {
      const nodes = makeNodes(5);
      const edges = makeEdges([['n0', 'n1'], ['n1', 'n2'], ['n2', 'n0'], ['n3', 'n4']]);

      const result = await engine.generateZeroOverlapLayout('network', nodes, edges);

      expect(result).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();
    });
  });

  describe('default (concept map) layout', () => {
      test('should generate layout for unknown diagram types', async () => {
      const nodes = makeNodes(3);
      const edges = makeEdges([['n0', 'n1'], ['n1', 'n2']]);

      const result = await engine.generateZeroOverlapLayout('unknown' as DiagramType, nodes, edges);

      expect(result).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();
    });
  });

  describe('empty graph', () => {
      test('should handle empty nodes', async () => {
      const result = await engine.generateZeroOverlapLayout('flowchart', [], []);

      expect(result.nodes).toHaveLength(0);
      expect(result.success).toBe(true);
    });
  });

  describe('single node', () => {
      test('should handle single node', async () => {
      const nodes = makeNodes(1);
      const result = await engine.generateZeroOverlapLayout('flowchart', nodes, []);

      expect(result).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();
    });
  });

  describe('custom configuration', () => {
      test('should accept custom configuration', async () => {
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
      test('should return quality metrics', async () => {
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

  describe('property naming convention (w/h)', () => {
    const layoutTypes: DiagramType[] = ['timeline', 'comparison', 'network', 'conceptmap'];

    layoutTypes.forEach(layoutType => {
      test(`should use w/h properties (not width/height) for ${layoutType} layout nodes`, async () => {
        const nodes = makeNodes(4);
        const edges = makeEdges([['n0', 'n1'], ['n1', 'n2'], ['n2', 'n3']]);
        const result = await engine.generateZeroOverlapLayout(layoutType, nodes, edges);

        expect(result.nodes.length).toBeGreaterThan(0);
        result.nodes.forEach(node => {
          // Key assertion: w and h properties must be present (TASK-0094 property naming fix)
          expect(node).toHaveProperty('w');
          expect(node).toHaveProperty('h');
          expect(typeof node.w).toBe('number');
          expect(typeof node.h).toBe('number');
        });
      });
    });

    test('should not throw runtime errors when reading node dimensions via w/h', async () => {
      const nodes = makeNodes(5);
      const edges = makeEdges([['n0', 'n1'], ['n1', 'n2'], ['n2', 'n3'], ['n3', 'n4']]);

      for (const type of layoutTypes) {
        const result = await engine.generateZeroOverlapLayout(type, nodes, edges);
        // No "Cannot read properties of undefined" errors when accessing w/h
        result.nodes.forEach(node => {
          const w = node.w;
          const h = node.h;
          expect(typeof w).toBe('number');
          expect(typeof h).toBe('number');
        });
      }
    });
  });
});
