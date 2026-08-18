import { FallbackLayoutStrategy } from '@/visualization/strategies/FallbackLayoutStrategy';
import { NodeDatum, EdgeDatum, DiagramType } from '@stv/core/types/diagram';

const defaultConfig = {
  width: 1920,
  height: 1080,
  nodeWidth: 120,
  nodeHeight: 60,
};

function makeNodes(count: number): NodeDatum[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    label: `Node ${i}`,
  }));
}

function makeEdges(pairs: [string, string][]): EdgeDatum[] {
  return pairs.map(([from, to]) => ({ from, to, label: `${from}-${to}` }));
}

describe('FallbackLayoutStrategy', () => {
  const strategy = new FallbackLayoutStrategy(defaultConfig);

  describe('flow layout', () => {
    it('should position nodes in vertical flow', () => {
      const nodes = makeNodes(3);
      const edges = makeEdges([['n0', 'n1'], ['n1', 'n2']]);
      const result = strategy.fallbackLayout(nodes, edges, 'flow');

      expect(result.nodes).toHaveLength(3);
      expect(result.edges).toHaveLength(2);
      // All nodes should have x, y, w, h
      result.nodes.forEach(n => {
        expect(n.x).toBeDefined();
        expect(n.y).toBeDefined();
        expect(n.w).toBe(200);
        expect(n.h).toBe(80);
      });
      // Nodes should be positioned vertically (same x, increasing y)
      expect(result.nodes[0].x).toBe(result.nodes[1].x);
      expect(result.nodes[0].y).toBeLessThan(result.nodes[1].y);
    });

    it('should generate edge points for connected nodes', () => {
      const nodes = makeNodes(2);
      const edges = makeEdges([['n0', 'n1']]);
      const result = strategy.fallbackLayout(nodes, edges, 'flow');

      expect(result.edges[0].points).toHaveLength(2);
      expect(result.edges[0].label).toBe('n0-n1');
    });

    it('should handle edges with missing nodes', () => {
      const nodes = makeNodes(1);
      const edges = makeEdges([['n0', 'n999']]);
      const result = strategy.fallbackLayout(nodes, edges, 'flow');

      expect(result.edges[0].points).toEqual([{ x: 0, y: 0 }, { x: 0, y: 0 }]);
    });
  });

  describe('tree layout', () => {
    it('should delegate to flow layout', () => {
      const nodes = makeNodes(2);
      const edges = makeEdges([['n0', 'n1']]);
      const result = strategy.fallbackLayout(nodes, edges, 'tree');

      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
    });
  });

  describe('timeline layout', () => {
    it('should position nodes horizontally', () => {
      const nodes = makeNodes(4);
      const edges = makeEdges([['n0', 'n1'], ['n1', 'n2'], ['n2', 'n3']]);
      const result = strategy.fallbackLayout(nodes, edges, 'timeline');

      expect(result.nodes).toHaveLength(4);
      // All nodes at same y
      expect(result.nodes[0].y).toBe(result.nodes[1].y);
      // X increases
      expect(result.nodes[0].x).toBeLessThan(result.nodes[1].x);
      expect(result.nodes[1].x).toBeLessThan(result.nodes[2].x);
    });

    it('should handle single node timeline', () => {
      const nodes = makeNodes(1);
      const result = strategy.fallbackLayout(nodes, [], 'timeline');
      expect(result.nodes).toHaveLength(1);
      expect(result.edges).toHaveLength(0);
    });

    it('should handle edges with missing nodes in timeline', () => {
      const nodes = makeNodes(1);
      const edges = makeEdges([['n999', 'n888']]);
      const result = strategy.fallbackLayout(nodes, edges, 'timeline');
      expect(result.edges[0].points).toEqual([{ x: 0, y: 0 }, { x: 0, y: 0 }]);
    });
  });

  describe('cycle layout', () => {
    it('should position nodes in a circle', () => {
      const nodes = makeNodes(5);
      const edges = makeEdges([['n0', 'n1'], ['n1', 'n2'], ['n2', 'n3'], ['n3', 'n4'], ['n4', 'n0']]);
      const result = strategy.fallbackLayout(nodes, edges, 'cycle');

      expect(result.nodes).toHaveLength(5);
      // Nodes should have different x,y positions
      const positions = result.nodes.map(n => `${n.x},${n.y}`);
      const uniquePositions = new Set(positions);
      expect(uniquePositions.size).toBe(5);
    });

    it('should handle edges with missing nodes in cycle', () => {
      const nodes = makeNodes(2);
      const edges = makeEdges([['n0', 'n999']]);
      const result = strategy.fallbackLayout(nodes, edges, 'cycle');
      expect(result.edges[0].points).toEqual([{ x: 0, y: 0 }, { x: 0, y: 0 }]);
    });
  });

  describe('matrix layout', () => {
    it('should position nodes in a grid', () => {
      const nodes = makeNodes(6);
      const result = strategy.fallbackLayout(nodes, [], 'matrix');

      expect(result.nodes).toHaveLength(6);
      // 6 nodes => ceil(sqrt(6)) = 3 cols
      // Row 0: nodes 0,1,2. Row 1: nodes 3,4,5
      expect(result.nodes[0].y).toBeLessThan(result.nodes[3].y);
    });

    it('should handle single node matrix', () => {
      const nodes = makeNodes(1);
      const result = strategy.fallbackLayout(nodes, [], 'matrix');
      expect(result.nodes).toHaveLength(1);
    });

    it('should handle edges with missing nodes in matrix', () => {
      const nodes = makeNodes(1);
      const edges = makeEdges([['n0', 'n999']]);
      const result = strategy.fallbackLayout(nodes, edges, 'matrix');
      expect(result.edges[0].points).toEqual([{ x: 0, y: 0 }, { x: 0, y: 0 }]);
    });
  });

  describe('default (grid) layout', () => {
    it('should fall back to grid for unknown diagram types', () => {
      const nodes = makeNodes(4);
      const result = strategy.fallbackLayout(nodes, [], 'unknown' as DiagramType);
      // Should use matrix layout (same as grid)
      expect(result.nodes).toHaveLength(4);
    });

    it('should handle empty nodes array', () => {
      const result = strategy.fallbackLayout([], [], 'flow');
      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });
  });
});
