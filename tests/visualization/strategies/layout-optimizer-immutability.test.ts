/**
 * Regression tests: LayoutOptimizer must not mutate input node objects.
 *
 * Bug: optimizeCycleLayout / optimizeTimelineLayout / optimizeMatrixLayout /
 *      improveTreeSymmetry all used [...array] (shallow copy) then mutated
 *      shared node references via `node.x = ...`.
 *
 * Fix: Each method now returns new node objects via `.map(spread)`.
 */
import { LayoutOptimizer } from '@/visualization/strategies/LayoutOptimizer';
import type { PositionedNode, DiagramLayout, LayoutEdge } from '@stv/core/types/diagram';

const config = {
  width: 1000,
  height: 800,
  nodeWidth: 120,
  nodeHeight: 60,
  marginX: 50,
  marginY: 50,
  nodeSeparation: 20,
  edgeSeparation: 10,
  rankSeparation: 50,
  rankDirection: 'TB' as const,
};

function snapshot(nodes: PositionedNode[]): PositionedNode[] {
  return nodes.map(n => ({ ...n, meta: n.meta ? { ...n.meta } : undefined }));
}

function makeNodes(count: number): PositionedNode[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    label: `Node ${i}`,
    x: 100 + i * 200,
    y: 100 + (i % 3) * 150,
    w: 120,
    h: 60,
  }));
}

function makeLayout(nodes: PositionedNode[], edges: LayoutEdge[] = []): DiagramLayout {
  return { nodes, edges };
}

describe('LayoutOptimizer input immutability', () => {
  let optimizer: LayoutOptimizer;

  beforeEach(() => {
    optimizer = new LayoutOptimizer(config);
  });

  describe('optimizeForDiagramType', () => {
    it('does not mutate input nodes for cycle layout', async () => {
      const nodes = makeNodes(5);
      const original = snapshot(nodes);
      const layout = makeLayout(nodes);

      await optimizer.optimizeForDiagramType(layout, 'cycle');

      expect(nodes.map(n => ({ x: n.x, y: n.y }))).toEqual(original.map(n => ({ x: n.x, y: n.y })));
    });

    it('does not mutate input nodes for timeline layout', async () => {
      const nodes = makeNodes(4);
      const original = snapshot(nodes);
      const layout = makeLayout(nodes);

      await optimizer.optimizeForDiagramType(layout, 'timeline');

      expect(nodes.map(n => ({ x: n.x, y: n.y }))).toEqual(original.map(n => ({ x: n.x, y: n.y })));
    });

    it('does not mutate input nodes for matrix layout', async () => {
      const nodes = makeNodes(6);
      const original = snapshot(nodes);
      const layout = makeLayout(nodes);

      await optimizer.optimizeForDiagramType(layout, 'matrix');

      expect(nodes.map(n => ({ x: n.x, y: n.y }))).toEqual(original.map(n => ({ x: n.x, y: n.y })));
    });
  });

  describe('advancedOptimizations', () => {
    it('does not mutate input nodes for tree layout (improveTreeSymmetry)', async () => {
      const nodes: PositionedNode[] = [
        { id: 'root', label: 'Root', x: 500, y: 0, w: 120, h: 60 },
        { id: 'c1', label: 'Child 1', x: 300, y: 200, w: 120, h: 60 },
        { id: 'c2', label: 'Child 2', x: 700, y: 200, w: 120, h: 60 },
      ];
      const original = snapshot(nodes);
      const layout = makeLayout(nodes);

      await optimizer.advancedOptimizations(layout, 'tree');

      expect(nodes.map(n => ({ x: n.x, y: n.y }))).toEqual(original.map(n => ({ x: n.x, y: n.y })));
    });

    it('does not mutate input nodes for cycle layout (improveCycleBalance)', async () => {
      const nodes = makeNodes(5);
      const original = snapshot(nodes);
      const layout = makeLayout(nodes);

      await optimizer.advancedOptimizations(layout, 'cycle');

      expect(nodes.map(n => ({ x: n.x, y: n.y }))).toEqual(original.map(n => ({ x: n.x, y: n.y })));
    });

    it('does not mutate input nodes for timeline layout (improveTimelineAlignment)', async () => {
      const nodes = makeNodes(4);
      const original = snapshot(nodes);
      const layout = makeLayout(nodes);

      await optimizer.advancedOptimizations(layout, 'timeline');

      expect(nodes.map(n => ({ x: n.x, y: n.y }))).toEqual(original.map(n => ({ x: n.x, y: n.y })));
    });

    it('does not mutate input nodes for matrix layout (improveMatrixGrid)', async () => {
      const nodes = makeNodes(6);
      const original = snapshot(nodes);
      const layout = makeLayout(nodes);

      await optimizer.advancedOptimizations(layout, 'matrix');

      expect(nodes.map(n => ({ x: n.x, y: n.y }))).toEqual(original.map(n => ({ x: n.x, y: n.y })));
    });
  });

  describe('still produces correct results', () => {
    it('cycle layout arranges nodes in a circle', async () => {
      const nodes = makeNodes(4);
      const layout = makeLayout(nodes);

      const result = await optimizer.optimizeForDiagramType(layout, 'cycle');

      const cx = config.width / 2;
      const cy = config.height / 2;
      const expectedRadius = Math.min(config.width, config.height) * 0.3;

      result.nodes.forEach((n, i) => {
        const angle = (2 * Math.PI * i) / 4;
        const expectedX = cx + expectedRadius * Math.cos(angle) - n.w / 2;
        const expectedY = cy + expectedRadius * Math.sin(angle) - n.h / 2;
        expect(n.x).toBeCloseTo(expectedX, 5);
        expect(n.y).toBeCloseTo(expectedY, 5);
      });
    });

    it('timeline layout produces left-to-right progression', async () => {
      const nodes: PositionedNode[] = [
        { id: 'n0', label: 'C', x: 800, y: 100, w: 120, h: 60 },
        { id: 'n1', label: 'A', x: 100, y: 100, w: 120, h: 60 },
        { id: 'n2', label: 'B', x: 500, y: 100, w: 120, h: 60 },
      ];
      const layout = makeLayout(nodes);

      const result = await optimizer.optimizeForDiagramType(layout, 'timeline');

      expect(result.nodes[0].id).toBe('n1');
      expect(result.nodes[2].id).toBe('n0');
      expect(result.nodes[0].x).toBeLessThan(result.nodes[1].x);
      expect(result.nodes[1].x).toBeLessThan(result.nodes[2].x);
    });

    it('matrix layout produces grid arrangement', async () => {
      const nodes = makeNodes(6);
      const layout = makeLayout(nodes);

      const result = await optimizer.optimizeForDiagramType(layout, 'matrix');

      const gridSize = Math.ceil(Math.sqrt(6));
      expect(result.nodes[0].y).toBeLessThan(result.nodes[gridSize].y);
    });

    it('empty nodes returns empty layout', async () => {
      const layout = makeLayout([]);

      const result = await optimizer.optimizeForDiagramType(layout, 'cycle');

      expect(result.nodes).toHaveLength(0);
    });
  });
});
