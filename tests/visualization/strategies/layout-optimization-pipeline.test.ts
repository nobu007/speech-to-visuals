import { LayoutOptimizationPipeline } from '@/visualization/strategies/LayoutOptimizationPipeline';
import { LayoutOptimizer } from '@/visualization/strategies/LayoutOptimizer';
import { DiagramLayout, PositionedNode } from '@/types/diagram';

const defaultConfig = {
  width: 1920,
  height: 1080,
  nodeWidth: 120,
  nodeHeight: 60,
  marginX: 40,
  marginY: 40,
  nodeSeparation: 20,
};

function makeNodes(count: number): PositionedNode[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    label: `Node ${i}`,
    x: 100 + i * 200,
    y: 100,
    w: 120,
    h: 60,
  }));
}

function makeLayout(nodes: PositionedNode[]): DiagramLayout {
  return { nodes, edges: [] };
}

describe('LayoutOptimizationPipeline', () => {
  const optimizer = new LayoutOptimizer(defaultConfig);
  const pipeline = new LayoutOptimizationPipeline(optimizer);

  describe('iteration 1 (no optimizations)', () => {
    it('should return layout unchanged at iteration 1', async () => {
      const nodes = makeNodes(3);
      const layout = makeLayout(nodes);
      const result = await pipeline.applyOptimizations(layout, 'flow', 1);
      expect(result.nodes).toEqual(nodes);
    });
  });

  describe('iteration 2 (type-specific optimizations)', () => {
    it('should apply cycle-specific optimizations at iteration 2', async () => {
      const nodes = makeNodes(4);
      const layout = makeLayout(nodes);
      const result = await pipeline.applyOptimizations(layout, 'cycle', 2);
      expect(result.nodes).toHaveLength(4);
    });

    it('should apply timeline-specific optimizations at iteration 2', async () => {
      const nodes = makeNodes(3);
      const layout = makeLayout(nodes);
      const result = await pipeline.applyOptimizations(layout, 'timeline', 2);
      expect(result.nodes).toHaveLength(3);
    });

    it('should return unchanged for unknown type at iteration 2', async () => {
      const nodes = makeNodes(3);
      const layout = makeLayout(nodes);
      const result = await pipeline.applyOptimizations(layout, 'flow', 2);
      expect(result.nodes).toHaveLength(3);
    });
  });

  describe('iteration 3+ (advanced optimizations)', () => {
    it('should apply advanced optimizations at iteration 3', async () => {
      const nodes = makeNodes(3);
      const layout = makeLayout(nodes);
      const result = await pipeline.applyOptimizations(layout, 'tree', 3);
      expect(result.nodes).toHaveLength(3);
    });

    it('should apply both type-specific and advanced optimizations at iteration 5', async () => {
      const nodes = makeNodes(4);
      const layout = makeLayout(nodes);
      const result = await pipeline.applyOptimizations(layout, 'matrix', 5);
      expect(result.nodes).toHaveLength(4);
    });
  });
});
