import { TreeStrategy, treeStrategy } from '@/visualization/strategies/tree-strategy';
import { NodeDatum, EdgeDatum } from '@stv/core/types/diagram';
import { LayoutStrategy, StrategyLayoutResult } from '@/visualization/types';

describe('TreeStrategy', () => {
  describe('LayoutStrategy interface compliance', () => {
    it('should have name "tree"', () => {
      expect(treeStrategy.name).toBe('tree');
    });

    it('should have canEscapeLocalMinimum = true', () => {
      expect(treeStrategy.canEscapeLocalMinimum).toBe(true);
    });

    it('should implement estimateComplexity', () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ];
      const complexity = treeStrategy.estimateComplexity(nodes);
      expect(typeof complexity).toBe('number');
      expect(complexity).toBe(9); // n*n = 3*3
    });

    it('should satisfy LayoutStrategy interface', () => {
      const strategy: LayoutStrategy = treeStrategy;
      expect(strategy.name).toBe('tree');
      expect(strategy.canEscapeLocalMinimum).toBe(true);
      expect(typeof strategy.estimateComplexity).toBe('function');
      expect(typeof strategy.apply).toBe('function');
    });
  });

  describe('empty graph', () => {
    it('should return empty result with default canvas for no nodes', () => {
      const result = treeStrategy.apply([], []);

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
      const nodes: NodeDatum[] = [{ id: 'root', label: 'Root' }];
      const edges: EdgeDatum[] = [];

      const result = treeStrategy.apply(nodes, edges);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('root');
      expect(result.nodes[0].width).toBe(120);
      expect(result.nodes[0].height).toBe(60);
      expect(typeof result.nodes[0].x).toBe('number');
      expect(typeof result.nodes[0].y).toBe('number');
      expect(result.edges).toHaveLength(0);
      expect(result.metrics.overlapCount).toBe(0);
    });
  });

  describe('root above children', () => {
    it('should position root node above its children (root.y < child.y)', () => {
      const nodes: NodeDatum[] = [
        { id: 'root', label: 'Root' },
        { id: 'child1', label: 'Child 1' },
        { id: 'child2', label: 'Child 2' },
      ];
      const edges: EdgeDatum[] = [
        { from: 'root', to: 'child1' },
        { from: 'root', to: 'child2' },
      ];

      const result = treeStrategy.apply(nodes, edges);

      const root = result.nodes.find((n) => n.id === 'root')!;
      const child1 = result.nodes.find((n) => n.id === 'child1')!;
      const child2 = result.nodes.find((n) => n.id === 'child2')!;

      // Root should be above children (using center coordinates)
      const rootCenterY = root.y + root.height / 2;
      const child1CenterY = child1.y + child1.height / 2;
      const child2CenterY = child2.y + child2.height / 2;

      expect(rootCenterY).toBeLessThan(child1CenterY);
      expect(rootCenterY).toBeLessThan(child2CenterY);
    });
  });

  describe('sibling nodes at same Y level', () => {
    it('should position sibling nodes at the same Y level', () => {
      const nodes: NodeDatum[] = [
        { id: 'root', label: 'Root' },
        { id: 'left', label: 'Left Child' },
        { id: 'right', label: 'Right Child' },
      ];
      const edges: EdgeDatum[] = [
        { from: 'root', to: 'left' },
        { from: 'root', to: 'right' },
      ];

      const result = treeStrategy.apply(nodes, edges);

      const left = result.nodes.find((n) => n.id === 'left')!;
      const right = result.nodes.find((n) => n.id === 'right')!;

      // Siblings should be at the same Y level (using center coordinates)
      const leftCenterY = left.y + left.height / 2;
      const rightCenterY = right.y + right.height / 2;

      expect(leftCenterY).toBeCloseTo(rightCenterY, 0);
    });
  });

  describe('multi-level tree', () => {
    it('should position grandchild below child', () => {
      const nodes: NodeDatum[] = [
        { id: 'root', label: 'Root' },
        { id: 'child', label: 'Child' },
        { id: 'grandchild', label: 'Grandchild' },
      ];
      const edges: EdgeDatum[] = [
        { from: 'root', to: 'child' },
        { from: 'child', to: 'grandchild' },
      ];

      const result = treeStrategy.apply(nodes, edges);

      const root = result.nodes.find((n) => n.id === 'root')!;
      const child = result.nodes.find((n) => n.id === 'child')!;
      const grandchild = result.nodes.find((n) => n.id === 'grandchild')!;

      const rootCenterY = root.y + root.height / 2;
      const childCenterY = child.y + child.height / 2;
      const grandchildCenterY = grandchild.y + grandchild.height / 2;

      expect(rootCenterY).toBeLessThan(childCenterY);
      expect(childCenterY).toBeLessThan(grandchildCenterY);
    });
  });

  describe('edges with points', () => {
    it('should include edge points in the result', () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ];
      const edges: EdgeDatum[] = [{ from: 'a', to: 'b', label: 'connects' }];

      const result = treeStrategy.apply(nodes, edges);

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].points.length).toBeGreaterThanOrEqual(2);
      expect(result.edges[0].label).toBe('connects');
    });
  });

  describe('valid StrategyLayoutResult', () => {
    it('should return a valid StrategyLayoutResult for a tree graph', () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
        { id: 'd', label: 'D' },
      ];
      const edges: EdgeDatum[] = [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'c' },
        { from: 'c', to: 'd' },
      ];

      const result = treeStrategy.apply(nodes, edges);

      expect(result.nodes).toHaveLength(4);
      expect(result.edges).toHaveLength(3);
      expect(result.canvas).toHaveProperty('width');
      expect(result.canvas).toHaveProperty('height');
      expect(result.metrics).toHaveProperty('overlapCount');
      expect(result.metrics).toHaveProperty('edgeCrossings');
      expect(result.metrics).toHaveProperty('aspectRatio');
    });
  });

  describe('custom node dimensions', () => {
    it('should respect custom width and height', () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A', width: 200, height: 100 },
        { id: 'b', label: 'B', width: 150, height: 80 },
      ];
      const edges: EdgeDatum[] = [{ from: 'a', to: 'b' }];

      const result = treeStrategy.apply(nodes, edges);

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

      const result = treeStrategy.apply(nodes, edges);

      expect(result.edges[0].id).toBe('edge-1');
    });
  });

  describe('disconnected nodes', () => {
    it('should handle nodes with no edges', () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ];
      const result = treeStrategy.apply(nodes, []);

      expect(result.nodes).toHaveLength(3);
      expect(result.edges).toHaveLength(0);
    });
  });

  describe('many overlapping nodes (triggers gridSnapFallback)', () => {
    it('should use grid snap fallback for large overlapping nodes', () => {
      // Create many nodes with large dimensions to force overlaps
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

      const result = treeStrategy.apply(nodes, edges);

      expect(result.nodes).toHaveLength(20);
      expect(result.edges).toHaveLength(19);
      expect(result.canvas).toHaveProperty('width');
    });
  });

  describe('cyclic tree', () => {
    it('should handle cycles in tree graph', () => {
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

      const result = treeStrategy.apply(nodes, edges);
      expect(result.nodes).toHaveLength(3);
      expect(result.edges).toHaveLength(3);
    });
  });
});
