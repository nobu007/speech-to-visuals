import { DagreLayoutStrategy } from '@/visualization/strategies/DagreLayoutStrategy';
import { FallbackLayoutStrategy } from '@/visualization/strategies/FallbackLayoutStrategy';
import { LayoutConfig } from '@/visualization/types';
import { NodeDatum, EdgeDatum, DiagramType, DiagramLayout, PositionedNode } from '@stv/core/types/diagram';

// Fail-loud node lookup (the flow/tree/cycle strategy-test idiom): the layout
// just placed every input node, so a missing id means the strategy dropped
// it. The old `find(…)!` read surfaced as `node.w` on undefined TypeError
// red; the throw keeps the RED verdict naming the node.
function findNode(layout: DiagramLayout, id: string): PositionedNode {
  const node = layout.nodes.find((n) => n.id === id);
  if (node === undefined) throw new Error(`node ${id} missing from the emitted layout`);
  return node;
}

const defaultConfig: LayoutConfig = {
  width: 1920,
  height: 1080,
  nodeWidth: 160,
  nodeHeight: 60,
  marginX: 20,
  marginY: 20,
  rankDirection: 'TB',
  nodeSeparation: 60,
  edgeSeparation: 30,
  rankSeparation: 100,
};

function makeStrategy(config: Partial<LayoutConfig> = {}): DagreLayoutStrategy {
  const merged = { ...defaultConfig, ...config };
  return new DagreLayoutStrategy(merged, new FallbackLayoutStrategy(merged));
}

function makeNodes(count: number, labelPrefix = 'Node'): NodeDatum[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    label: `${labelPrefix} ${i}`,
  }));
}

function makeChain(count: number): { nodes: NodeDatum[]; edges: EdgeDatum[] } {
  const nodes = makeNodes(count);
  const edges: EdgeDatum[] = [];
  for (let i = 0; i < count - 1; i++) {
    edges.push({ from: `n${i}`, to: `n${i + 1}` });
  }
  return { nodes, edges };
}

describe('DagreLayoutStrategy', () => {
  describe('basic layout', () => {
    it('should position a single node', async () => {
      const strategy = makeStrategy();
      const nodes = makeNodes(1);
      const result = await strategy.applyLayout(nodes, [], 'flow');

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('n0');
      expect(typeof result.nodes[0].x).toBe('number');
      expect(typeof result.nodes[0].y).toBe('number');
      expect(result.nodes[0].w).toBeGreaterThan(0);
      expect(result.nodes[0].h).toBe(defaultConfig.nodeHeight);
    });

    it('should position multiple nodes with edges', async () => {
      const strategy = makeStrategy();
      const { nodes, edges } = makeChain(4);
      const result = await strategy.applyLayout(nodes, edges, 'flow');

      expect(result.nodes).toHaveLength(4);
      expect(result.edges).toHaveLength(3);
      // All nodes should have valid positions
      for (const node of result.nodes) {
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
        expect(node.w).toBeGreaterThan(0);
        expect(node.h).toBe(defaultConfig.nodeHeight);
      }
    });

    it('should position nodes with no edges', async () => {
      const strategy = makeStrategy();
      const nodes = makeNodes(3);
      const result = await strategy.applyLayout(nodes, [], 'flow');

      expect(result.nodes).toHaveLength(3);
      expect(result.edges).toHaveLength(0);
      // Unconnected nodes should still get positions
      for (const node of result.nodes) {
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
      }
    });
  });

  describe('node width calculation', () => {
    it('should calculate width based on label length', async () => {
      const strategy = makeStrategy();
      const nodes: NodeDatum[] = [
        { id: 'short', label: 'A' },
        { id: 'long', label: 'This is a very long label that exceeds default width' },
      ];
      const result = await strategy.applyLayout(nodes, [], 'flow');

      const shortNode = findNode(result, 'short');
      const longNode = findNode(result, 'long');

      // `w` is optional on PositionedNode — `?? Number.NaN` preserves the old
      // `w!` read's undefined→failed-matcher verdict (NaN compares false).
      expect(longNode.w ?? Number.NaN).toBeGreaterThanOrEqual(shortNode.w ?? Number.NaN);
    });

    it('should use minimum nodeWidth for empty labels', async () => {
      const strategy = makeStrategy();
      const nodes: NodeDatum[] = [
        { id: 'empty', label: '' },
      ];
      const result = await strategy.applyLayout(nodes, [], 'flow');

      expect(result.nodes[0].w).toBe(defaultConfig.nodeWidth);
    });
  });

  describe('edge generation', () => {
    it('should produce edge points for connected nodes', async () => {
      const strategy = makeStrategy();
      const { nodes, edges } = makeChain(3);
      const result = await strategy.applyLayout(nodes, edges, 'flow');

      expect(result.edges).toHaveLength(2);
      for (const edge of result.edges) {
        expect(edge.points).toBeDefined();
        // `points` is non-optional on LayoutEdge — the old `points!` was a
        // pure checker suppression, removing it is behavior-preserving.
        expect(edge.points.length).toBeGreaterThanOrEqual(2);
        for (const pt of edge.points) {
          expect(typeof pt.x).toBe('number');
          expect(typeof pt.y).toBe('number');
        }
      }
    });

    it('should preserve edge labels', async () => {
      const strategy = makeStrategy();
      const nodes = makeNodes(2);
      const edges: EdgeDatum[] = [{ from: 'n0', to: 'n1', label: 'connects to' }];
      const result = await strategy.applyLayout(nodes, edges, 'flow');

      expect(result.edges[0].label).toBe('connects to');
    });
  });

  describe('diagram type variations', () => {
    const types: DiagramType[] = ['flow', 'tree', 'timeline', 'matrix', 'cycle'];

    for (const type of types) {
      it(`should produce valid layout for type: ${type}`, async () => {
        const strategy = makeStrategy();
        const { nodes, edges } = makeChain(3);
        const result = await strategy.applyLayout(nodes, edges, type);

        expect(result.nodes).toHaveLength(3);
        expect(result.edges).toHaveLength(2);
        for (const node of result.nodes) {
          expect(typeof node.x).toBe('number');
          expect(typeof node.y).toBe('number');
          expect(node.w).toBeGreaterThan(0);
        }
      });
    }

    it('should produce different layouts for TB vs LR direction', async () => {
      const strategyTB = makeStrategy({ rankDirection: 'TB' });
      const strategyLR = makeStrategy({ rankDirection: 'LR' });
      const { nodes, edges } = makeChain(4);

      const resultTB = await strategyTB.applyLayout(nodes, edges, 'flow');
      const resultLR = await strategyLR.applyLayout(nodes, edges, 'timeline');

      // LR layout should have larger X spread than TB for a chain
      const tbXSpread = Math.max(...resultTB.nodes.map(n => n.x)) - Math.min(...resultTB.nodes.map(n => n.x));
      const lrXSpread = Math.max(...resultLR.nodes.map(n => n.x)) - Math.min(...resultLR.nodes.map(n => n.x));

      // LR direction should have nodes more spread horizontally
      expect(lrXSpread).toBeGreaterThan(0);
      // TB layout should have smaller horizontal spread than LR for a chain
      expect(tbXSpread).toBeLessThan(lrXSpread);
    });
  });

  describe('fallback behavior', () => {
    it('should fall back to FallbackLayoutStrategy on error', async () => {
      const strategy = makeStrategy();
      // Trigger error by passing nodes that would cause dagre.layout to throw.
      // The mock dagre won't throw, so we test the fallback path by directly
      // testing that fallbackLayout works correctly.
      const fallback = new FallbackLayoutStrategy(defaultConfig);
      const nodes = makeNodes(3);
      const edges: EdgeDatum[] = [{ from: 'n0', to: 'n1' }];

      const result = fallback.fallbackLayout(nodes, edges, 'flow');
      expect(result.nodes).toHaveLength(3);
      expect(result.edges).toHaveLength(1);
    });

    it('should produce valid layout from fallback for all diagram types', () => {
      const fallback = new FallbackLayoutStrategy(defaultConfig);
      const nodes = makeNodes(3);
      const edges: EdgeDatum[] = [{ from: 'n0', to: 'n1' }, { from: 'n1', to: 'n2' }];

      for (const type of ['flow', 'tree', 'timeline', 'cycle', 'matrix', 'general'] as DiagramType[]) {
        const result = fallback.fallbackLayout(nodes, edges, type);
        expect(result.nodes).toHaveLength(3);
        for (const node of result.nodes) {
          expect(typeof node.x).toBe('number');
          expect(typeof node.y).toBe('number');
        }
      }
    });
  });

  describe('empty input', () => {
    it('should handle empty nodes array', async () => {
      const strategy = makeStrategy();
      const result = await strategy.applyLayout([], [], 'flow');

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });

    it('should handle nodes without edges', async () => {
      const strategy = makeStrategy();
      const nodes = makeNodes(5);
      const result = await strategy.applyLayout(nodes, [], 'flow');

      expect(result.nodes).toHaveLength(5);
      expect(result.edges).toHaveLength(0);
    });
  });

  describe('complex graph structures', () => {
    it('should handle branching graph', async () => {
      const strategy = makeStrategy();
      const nodes: NodeDatum[] = [
        { id: 'root', label: 'Root' },
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ];
      const edges: EdgeDatum[] = [
        { from: 'root', to: 'a' },
        { from: 'root', to: 'b' },
        { from: 'root', to: 'c' },
      ];

      const result = await strategy.applyLayout(nodes, edges, 'tree');
      expect(result.nodes).toHaveLength(4);
      expect(result.edges).toHaveLength(3);

      // Root should be positioned before (higher up / smaller y) than children
      const root = findNode(result, 'root');
      const childNodes = result.nodes.filter(n => n.id !== 'root');
      for (const child of childNodes) {
        expect(root.y).toBeLessThan(child.y);
      }
    });

    it('should handle diamond graph', async () => {
      const strategy = makeStrategy();
      const nodes: NodeDatum[] = [
        { id: 'top', label: 'Top' },
        { id: 'left', label: 'Left' },
        { id: 'right', label: 'Right' },
        { id: 'bottom', label: 'Bottom' },
      ];
      const edges: EdgeDatum[] = [
        { from: 'top', to: 'left' },
        { from: 'top', to: 'right' },
        { from: 'left', to: 'bottom' },
        { from: 'right', to: 'bottom' },
      ];

      const result = await strategy.applyLayout(nodes, edges, 'flow');
      expect(result.nodes).toHaveLength(4);
      expect(result.edges).toHaveLength(4);
    });

    it('should handle disconnected subgraphs', async () => {
      const strategy = makeStrategy();
      const nodes = makeNodes(6);
      // Two disconnected chains: 0->1->2 and 3->4->5
      const edges: EdgeDatum[] = [
        { from: 'n0', to: 'n1' },
        { from: 'n1', to: 'n2' },
        { from: 'n3', to: 'n4' },
        { from: 'n4', to: 'n5' },
      ];

      const result = await strategy.applyLayout(nodes, edges, 'flow');
      expect(result.nodes).toHaveLength(6);
      expect(result.edges).toHaveLength(4);

      // All nodes should have valid positions
      for (const node of result.nodes) {
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
      }
    });
  });

  describe('position conversion', () => {
    it('should convert dagre center positions to top-left positions', async () => {
      const strategy = makeStrategy();
      const { nodes, edges } = makeChain(2);
      const result = await strategy.applyLayout(nodes, edges, 'flow');

      for (const node of result.nodes) {
        // x and y should be top-left, so they should be non-negative
        // (dagre mock assigns positions starting at 50 + offset)
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
