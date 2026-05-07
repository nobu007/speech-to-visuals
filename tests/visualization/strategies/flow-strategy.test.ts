import { FlowStrategy, flowStrategy } from '@/visualization/strategies/flow-strategy';
import { NodeDatum, EdgeDatum } from '@/types/diagram';
import { LayoutStrategy, StrategyLayoutResult } from '@/visualization/types';

describe('FlowStrategy', () => {
  describe('LayoutStrategy interface compliance', () => {
    it('should have name "flow"', () => {
      expect(flowStrategy.name).toBe('flow');
    });

    it('should have canEscapeLocalMinimum = true', () => {
      expect(flowStrategy.canEscapeLocalMinimum).toBe(true);
    });

    it('should implement estimateComplexity', () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ];
      const complexity = flowStrategy.estimateComplexity(nodes);
      expect(typeof complexity).toBe('number');
      expect(complexity).toBe(9); // n*n = 3*3
    });

    it('should satisfy LayoutStrategy interface', () => {
      const strategy: LayoutStrategy = flowStrategy;
      expect(strategy.name).toBe('flow');
      expect(strategy.canEscapeLocalMinimum).toBe(true);
      expect(typeof strategy.estimateComplexity).toBe('function');
      expect(typeof strategy.apply).toBe('function');
    });
  });

  describe('empty graph', () => {
    it('should return empty result with default canvas for no nodes', () => {
      const result = flowStrategy.apply([], []);

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
      expect(result.canvas.width).toBe(1920);
      expect(result.canvas.height).toBe(1080);
      expect(result.metrics.overlapCount).toBe(0);
      expect(result.metrics.edgeCrossings).toBe(0);
      expect(result.metrics.aspectRatio).toBeCloseTo(16 / 9, 2);
    });
  });

  describe('single node', () => {
    it('should position a single node correctly', () => {
      const nodes: NodeDatum[] = [{ id: 'a', label: 'A' }];
      const edges: EdgeDatum[] = [];

      const result = flowStrategy.apply(nodes, edges);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('a');
      expect(result.nodes[0].width).toBe(120);
      expect(result.nodes[0].height).toBe(60);
      expect(typeof result.nodes[0].x).toBe('number');
      expect(typeof result.nodes[0].y).toBe('number');
      expect(result.edges).toHaveLength(0);
      expect(result.metrics.overlapCount).toBe(0);
    });
  });

  describe('linear left-to-right flow', () => {
    it('should position nodes in left-to-right order', () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ];
      const edges: EdgeDatum[] = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ];

      const result = flowStrategy.apply(nodes, edges);

      const nodeA = result.nodes.find((n) => n.id === 'a')!;
      const nodeB = result.nodes.find((n) => n.id === 'b')!;
      const nodeC = result.nodes.find((n) => n.id === 'c')!;

      // In LR layout, node A should be to the left of B, which should be to the left of C
      // Using center coordinates (x + width/2)
      const centerA = nodeA.x + nodeA.width / 2;
      const centerB = nodeB.x + nodeB.width / 2;
      const centerC = nodeC.x + nodeC.width / 2;

      expect(centerA).toBeLessThan(centerB);
      expect(centerB).toBeLessThan(centerC);
    });

    it('should produce valid StrategyLayoutResult', () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ];
      const edges: EdgeDatum[] = [{ from: 'a', to: 'b' }];

      const result = flowStrategy.apply(nodes, edges);

      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      expect(result.canvas).toHaveProperty('width');
      expect(result.canvas).toHaveProperty('height');
      expect(result.metrics).toHaveProperty('overlapCount');
      expect(result.metrics).toHaveProperty('edgeCrossings');
      expect(result.metrics).toHaveProperty('aspectRatio');
    });
  });

  describe('start nodes (no incoming edges)', () => {
    it('should position start nodes on the left', () => {
      const nodes: NodeDatum[] = [
        { id: 'start', label: 'Start' },
        { id: 'process', label: 'Process' },
        { id: 'end', label: 'End' },
      ];
      const edges: EdgeDatum[] = [
        { from: 'start', to: 'process' },
        { from: 'process', to: 'end' },
      ];

      const result = flowStrategy.apply(nodes, edges);

      const startNode = result.nodes.find((n) => n.id === 'start')!;
      const processNode = result.nodes.find((n) => n.id === 'process')!;
      const endNode = result.nodes.find((n) => n.id === 'end')!;

      const startCenter = startNode.x + startNode.width / 2;
      const processCenter = processNode.x + processNode.width / 2;
      const endCenter = endNode.x + endNode.width / 2;

      // Start node should be leftmost
      expect(startCenter).toBeLessThan(processCenter);
      expect(startCenter).toBeLessThan(endCenter);
    });

    it('should position multiple start nodes to the left of downstream nodes', () => {
      const nodes: NodeDatum[] = [
        { id: 's1', label: 'Start 1' },
        { id: 's2', label: 'Start 2' },
        { id: 'merge', label: 'Merge' },
      ];
      const edges: EdgeDatum[] = [
        { from: 's1', to: 'merge' },
        { from: 's2', to: 'merge' },
      ];

      const result = flowStrategy.apply(nodes, edges);

      const s1 = result.nodes.find((n) => n.id === 's1')!;
      const s2 = result.nodes.find((n) => n.id === 's2')!;
      const merge = result.nodes.find((n) => n.id === 'merge')!;

      const s1Center = s1.x + s1.width / 2;
      const s2Center = s2.x + s2.width / 2;
      const mergeCenter = merge.x + merge.width / 2;

      expect(s1Center).toBeLessThan(mergeCenter);
      expect(s2Center).toBeLessThan(mergeCenter);
    });
  });

  describe('edges with points', () => {
    it('should include edge points in the result', () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ];
      const edges: EdgeDatum[] = [{ from: 'a', to: 'b', label: 'connects' }];

      const result = flowStrategy.apply(nodes, edges);

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].points.length).toBeGreaterThanOrEqual(2);
      expect(result.edges[0].label).toBe('connects');
    });
  });

  describe('custom node dimensions', () => {
    it('should respect custom width and height', () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A', width: 200, height: 100 },
        { id: 'b', label: 'B', width: 150, height: 80 },
      ];
      const edges: EdgeDatum[] = [{ from: 'a', to: 'b' }];

      const result = flowStrategy.apply(nodes, edges);

      const nodeA = result.nodes.find((n) => n.id === 'a')!;
      const nodeB = result.nodes.find((n) => n.id === 'b')!;

      expect(nodeA.width).toBe(200);
      expect(nodeA.height).toBe(100);
      expect(nodeB.width).toBe(150);
      expect(nodeB.height).toBe(80);
    });
  });

  describe('edge with id field', () => {
    it('should pass edge id through to the result', () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ];
      const edges: EdgeDatum[] = [{ from: 'a', to: 'b', id: 'edge-1' }];

      const result = flowStrategy.apply(nodes, edges);

      expect(result.edges[0].id).toBe('edge-1');
    });
  });

  describe('disconnected graph', () => {
    it('should handle nodes with no edges', () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ];
      const result = flowStrategy.apply(nodes, []);

      expect(result.nodes).toHaveLength(3);
      expect(result.edges).toHaveLength(0);
      expect(result.metrics.overlapCount).toBe(0);
    });
  });

  describe('many overlapping nodes (triggers gridSnapFallback)', () => {
    it('should use grid snap fallback when dagre produces overlaps', () => {
      // Create many nodes with large widths that will likely overlap
      const nodes: NodeDatum[] = Array.from({ length: 20 }, (_, i) => ({
        id: `n${i}`,
        label: `Node ${i}`,
        width: 500,
        height: 300,
      }));
      const edges: EdgeDatum[] = Array.from({ length: 19 }, (_, i) => ({
        from: `n${i}`,
        to: `n${i + 1}`,
      }));

      const result = flowStrategy.apply(nodes, edges);

      expect(result.nodes).toHaveLength(20);
      expect(result.edges).toHaveLength(19);
      expect(result.canvas).toHaveProperty('width');
      expect(result.metrics).toHaveProperty('overlapCount');
    });
  });

  describe('cyclic graph', () => {
    it('should handle cycles in the graph', () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ];
      const edges: EdgeDatum[] = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'a' },
      ];

      const result = flowStrategy.apply(nodes, edges);
      expect(result.nodes).toHaveLength(3);
      expect(result.edges).toHaveLength(3);
    });
  });
});
