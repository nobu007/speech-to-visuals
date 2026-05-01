import { describe, it, expect } from '@jest/globals';
import { LayoutOptimizer } from '@/visualization/strategies/LayoutOptimizer';
import { DiagramLayout, PositionedNode, LayoutEdge } from '@/types/diagram';

const defaultConfig = {
  width: 1920,
  height: 1080,
  nodeWidth: 120,
  nodeHeight: 60,
  marginX: 40,
  marginY: 40,
  nodeSeparation: 20,
};

function makePositionedNodes(count: number): PositionedNode[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    label: `Node ${i}`,
    x: 100 + i * 200,
    y: 100,
    w: 120,
    h: 60,
  }));
}

function makeLayout(nodes: PositionedNode[], edges: LayoutEdge[] = []): DiagramLayout {
  return { nodes, edges };
}

describe('LayoutOptimizer', () => {
  const optimizer = new LayoutOptimizer(defaultConfig);

  describe('optimizeForDiagramType', () => {
    it('should return layout unchanged for unknown diagram types', async () => {
      const nodes = makePositionedNodes(3);
      const layout = makeLayout(nodes);
      const result = await optimizer.optimizeForDiagramType(layout, 'flow');
      expect(result.nodes).toEqual(nodes);
    });

    it('should optimize cycle layout by arranging nodes in a circle', async () => {
      const nodes = makePositionedNodes(4);
      const layout = makeLayout(nodes);
      const result = await optimizer.optimizeForDiagramType(layout, 'cycle');
      expect(result.nodes).toHaveLength(4);
      // All nodes should be repositioned around center
      result.nodes.forEach(n => {
        expect(n.x).toBeDefined();
        expect(n.y).toBeDefined();
      });
    });

    it('should optimize timeline layout for left-to-right progression', async () => {
      const nodes: PositionedNode[] = [
        { id: 'n0', label: 'A', x: 500, y: 100, w: 120, h: 60 },
        { id: 'n1', label: 'B', x: 200, y: 100, w: 120, h: 60 },
        { id: 'n2', label: 'C', x: 800, y: 100, w: 120, h: 60 },
      ];
      const layout = makeLayout(nodes);
      const result = await optimizer.optimizeForDiagramType(layout, 'timeline');
      // Should be sorted by x
      expect(result.nodes[0].x).toBeLessThan(result.nodes[1].x);
      expect(result.nodes[1].x).toBeLessThan(result.nodes[2].x);
      // All nodes should be vertically centered
      expect(result.nodes[0].y).toBe(result.nodes[1].y);
    });

    it('should optimize matrix layout in grid arrangement', async () => {
      const nodes = makePositionedNodes(6);
      const layout = makeLayout(nodes);
      const result = await optimizer.optimizeForDiagramType(layout, 'matrix');
      expect(result.nodes).toHaveLength(6);
      // Grid: ceil(sqrt(6)) = 3 cols
      // Second row should have higher y
      expect(result.nodes[3].y).toBeGreaterThan(result.nodes[2].y);
    });
  });

  describe('advancedOptimizations', () => {
    it('should apply advanced optimizations to tree layouts', async () => {
      const nodes: PositionedNode[] = [
        { id: 'root', label: 'Root', x: 500, y: 0, w: 120, h: 60 },
        { id: 'c1', label: 'Child 1', x: 300, y: 200, w: 120, h: 60 },
        { id: 'c2', label: 'Child 2', x: 700, y: 200, w: 120, h: 60 },
      ];
      const layout = makeLayout(nodes);
      const result = await optimizer.advancedOptimizations(layout, 'tree');
      expect(result.nodes).toHaveLength(3);
    });

    it('should apply advanced optimizations to cycle layouts', async () => {
      const nodes = makePositionedNodes(4);
      const layout = makeLayout(nodes);
      const result = await optimizer.advancedOptimizations(layout, 'cycle');
      expect(result.nodes).toHaveLength(4);
      // Nodes should be arranged in a circle
      const centerX = 1920 / 2;
      const centerY = 1080 / 2;
      result.nodes.forEach(n => {
        const dx = (n.x + n.w / 2) - centerX;
        const dy = (n.y + n.h / 2) - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(dist).toBeGreaterThan(0);
      });
    });

    it('should apply advanced optimizations to timeline layouts', async () => {
      const nodes = makePositionedNodes(3);
      const layout = makeLayout(nodes);
      const result = await optimizer.advancedOptimizations(layout, 'timeline');
      expect(result.nodes).toHaveLength(3);
      // Should be aligned horizontally
      const yValues = result.nodes.map(n => n.y);
      yValues.forEach(y => expect(y).toBeCloseTo(yValues[0], 1));
    });

    it('should apply advanced optimizations to matrix layouts', async () => {
      const nodes = makePositionedNodes(4);
      const layout = makeLayout(nodes);
      const result = await optimizer.advancedOptimizations(layout, 'matrix');
      expect(result.nodes).toHaveLength(4);
    });

    it('should handle unknown diagram type in advanced optimizations', async () => {
      const nodes = makePositionedNodes(3);
      const layout = makeLayout(nodes);
      const result = await optimizer.advancedOptimizations(layout, 'flow');
      expect(result.nodes).toHaveLength(3);
    });
  });

  describe('minimizeEdgeCrossings', () => {
    it('should recalculate edge points', async () => {
      const nodes: PositionedNode[] = [
        { id: 'n0', label: 'A', x: 100, y: 100, w: 120, h: 60 },
        { id: 'n1', label: 'B', x: 400, y: 100, w: 120, h: 60 },
      ];
      const edges: LayoutEdge[] = [
        { from: 'n0', to: 'n1', points: [{ x: 100, y: 130 }, { x: 400, y: 130 }], label: 'e1' },
      ];
      const layout = makeLayout(nodes, edges);
      const result = await optimizer.minimizeEdgeCrossings(layout);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].points).toHaveLength(2);
    });

    it('should handle horizontal connection (dx > dy)', async () => {
      const nodes: PositionedNode[] = [
        { id: 'n0', label: 'A', x: 100, y: 500, w: 120, h: 60 },
        { id: 'n1', label: 'B', x: 600, y: 520, w: 120, h: 60 },
      ];
      const edges: LayoutEdge[] = [
        { from: 'n0', to: 'n1', points: [], label: 'e1' },
      ];
      const layout = makeLayout(nodes, edges);
      const result = await optimizer.minimizeEdgeCrossings(layout);
      // Should connect horizontally (dx > dy)
      expect(result.edges[0].points).toHaveLength(2);
    });

    it('should handle vertical connection (dy > dx)', async () => {
      const nodes: PositionedNode[] = [
        { id: 'n0', label: 'A', x: 500, y: 100, w: 120, h: 60 },
        { id: 'n1', label: 'B', x: 520, y: 600, w: 120, h: 60 },
      ];
      const edges: LayoutEdge[] = [
        { from: 'n0', to: 'n1', points: [], label: 'e1' },
      ];
      const layout = makeLayout(nodes, edges);
      const result = await optimizer.minimizeEdgeCrossings(layout);
      expect(result.edges[0].points).toHaveLength(2);
    });

    it('should handle edges referencing non-existent nodes', async () => {
      const nodes: PositionedNode[] = [
        { id: 'n0', label: 'A', x: 100, y: 100, w: 120, h: 60 },
      ];
      const edges: LayoutEdge[] = [
        { from: 'n0', to: 'n999', points: [], label: 'e1' },
      ];
      const layout = makeLayout(nodes, edges);
      const result = await optimizer.minimizeEdgeCrossings(layout);
      expect(result.edges[0]).toEqual(edges[0]);
    });
  });

  describe('node importance spacing', () => {
    it('should scale spacing based on node importance', async () => {
      const nodes: PositionedNode[] = [
        { id: 'n0', label: 'A', x: 200, y: 200, w: 120, h: 60, meta: { importance: 1.0 } },
        { id: 'n1', label: 'B', x: 400, y: 200, w: 120, h: 60, meta: { importance: 0.0 } },
      ];
      const layout = makeLayout(nodes);
      const result = await optimizer.advancedOptimizations(layout, 'flow');
      expect(result.nodes).toHaveLength(2);
    });
  });
});
