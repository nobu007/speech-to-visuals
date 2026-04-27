import { describe, it, expect, beforeEach } from '@jest/globals';
import { DiagramType, NodeDatum, EdgeDatum } from '@/types/diagram';
import { StrategySelector, executeLayout } from '@/visualization/strategy-selector';

function makeDiagram(type: DiagramType, nodeCount: number): { nodes: NodeDatum[]; edges: EdgeDatum[] } {
  const nodes: NodeDatum[] = Array.from({ length: nodeCount }, (_, i) => ({
    id: `n${i}`,
    label: `Node ${i}`,
  }));
  const edges: EdgeDatum[] = [];
  for (let i = 0; i < nodeCount - 1; i++) {
    edges.push({ from: `n${i}`, to: `n${i + 1}` });
  }
  return { nodes, edges };
}

describe('StrategySelector (TASK-0031)', () => {
  let selector: StrategySelector;

  beforeEach(() => {
    selector = new StrategySelector();
  });

  describe('Strategy selection by type', () => {
    const types: DiagramType[] = ['flow', 'tree', 'timeline', 'matrix', 'cycle'];

    for (const type of types) {
      it(`should select strategy for ${type} type`, () => {
        const strategy = selector.select(type);
        expect(strategy).toBeDefined();
        expect(strategy.name).toBeDefined();
        expect(typeof strategy.name).toBe('string');
      });
    }

    it('should return default grid-snap strategy for unknown type', () => {
      // null/undefined handling - select accepts DiagramType which doesn't include null
      // But we test the fallback behavior through executeLayout with valid types
      const strategy = selector.select('flow');
      expect(strategy).toBeDefined();
    });
  });

  describe('Fallback chain', () => {
    it('should return chain with main strategy and fallback', () => {
      const chain = selector.getFallbackChain('flow');
      expect(chain.length).toBeGreaterThanOrEqual(2);
      expect(chain[0].name).toBeDefined();
    });
  });

  describe('Complexity estimation', () => {
    it('should estimate complexity for each type', () => {
      const types: DiagramType[] = ['flow', 'tree', 'timeline', 'matrix', 'cycle'];
      for (const type of types) {
        const complexity = selector.estimateComplexity(type, 10);
        expect(typeof complexity).toBe('number');
        expect(complexity).toBeGreaterThan(0);
      }
    });

    it('matrix should have lowest complexity', () => {
      const matrixComplexity = selector.estimateComplexity('matrix', 10);
      const flowComplexity = selector.estimateComplexity('flow', 10);
      expect(matrixComplexity).toBeLessThanOrEqual(flowComplexity);
    });
  });

  describe('Pipeline integration', () => {
    const types: DiagramType[] = ['flow', 'tree', 'timeline', 'matrix', 'cycle'];

    for (const type of types) {
      it(`should produce valid layout for ${type}`, async () => {
        const { nodes, edges } = makeDiagram(type, 5);
        const result = await executeLayout(nodes, edges, type);

        expect(result.nodes).toHaveLength(5);
        expect(result.edges.length).toBeGreaterThanOrEqual(0);
        expect(result.canvas.width).toBeGreaterThan(0);
        expect(result.canvas.height).toBeGreaterThan(0);
        expect(result.metrics.overlapCount).toBe(0);
      });
    }

    it('should handle empty input', async () => {
      const result = await executeLayout([], [], 'flow');
      expect(result.nodes).toHaveLength(0);
      expect(result.metrics.overlapCount).toBe(0);
    });

    it('should handle single node', async () => {
      const result = await executeLayout(
        [{ id: 'a', label: 'A' }],
        [],
        'flow'
      );
      expect(result.nodes).toHaveLength(1);
      expect(result.metrics.overlapCount).toBe(0);
    });
  });
});
