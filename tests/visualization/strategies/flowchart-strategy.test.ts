import { FlowchartLayoutStrategy } from '@/visualization/strategies/FlowchartLayoutStrategy';
import { NodeDatum, EdgeDatum, PositionedNode } from '@stv/core/types/diagram';
import { LayoutConfig } from '@/visualization/types';

/** Fail-loud node capture (same idiom as the flow/tree/cycle strategy
 *  suites): a missing node is a layout drift the test must report by id,
 *  not a TypeError on `startNode.y`. */
function findNode(result: { nodes: PositionedNode[] }, id: string): PositionedNode {
  const found = result.nodes.find((n) => n.id === id);
  if (found === undefined) {
    throw new Error(`node '${id}' not found in layout result`);
  }
  return found;
}

describe('FlowchartLayoutStrategy', () => {
  let strategy: FlowchartLayoutStrategy;
  const defaultConfig: LayoutConfig = {
    width: 1920,
    height: 1080,
    nodeWidth: 120,
    nodeHeight: 60,
    marginX: 50,
    marginY: 50,
    rankDirection: 'TB',
    nodeSeparation: 50,
    edgeSeparation: 10,
    rankSeparation: 70,
  };

  beforeEach(() => {
    strategy = new FlowchartLayoutStrategy();
  });

  describe('ILayoutStrategy interface compliance', () => {
    it('should have name "flowchart"', () => {
      expect(strategy.name).toBe('flowchart');
    });

    it('should implement supports()', () => {
      expect(typeof strategy.supports).toBe('function');
    });

    it('should implement generateLayout()', () => {
      expect(typeof strategy.generateLayout).toBe('function');
    });
  });

  describe('supports()', () => {
    it('should return true for "flowchart" diagram type', () => {
      expect(strategy.supports('flowchart')).toBe(true);
    });

    it('should return true for "flow" diagram type', () => {
      expect(strategy.supports('flow')).toBe(true);
    });

    it('should return false for "tree" diagram type', () => {
      expect(strategy.supports('tree')).toBe(false);
    });

    it('should return false for "network" diagram type', () => {
      expect(strategy.supports('network')).toBe(false);
    });

    it('should return false for "comparison" diagram type', () => {
      expect(strategy.supports('comparison')).toBe(false);
    });

    it('should return false for "conceptmap" diagram type', () => {
      expect(strategy.supports('conceptmap')).toBe(false);
    });

    it('should return false for "timeline" diagram type', () => {
      expect(strategy.supports('timeline')).toBe(false);
    });

    it('should return false for "matrix" diagram type', () => {
      expect(strategy.supports('matrix')).toBe(false);
    });

    it('should return false for "cycle" diagram type', () => {
      expect(strategy.supports('cycle')).toBe(false);
    });

    it('should return false for "mindmap" diagram type', () => {
      expect(strategy.supports('mindmap')).toBe(false);
    });

    it('should return false for "general" diagram type', () => {
      expect(strategy.supports('general')).toBe(false);
    });
  });

  describe('generateLayout() - empty graph', () => {
    it('should return empty nodes and edges for no input', async () => {
      const result = await strategy.generateLayout([], [], defaultConfig);

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });
  });

  describe('generateLayout() - single node', () => {
    it('should position a single node with valid coordinates', async () => {
      const nodes: NodeDatum[] = [{ id: 'a', label: 'A' }];
      const edges: EdgeDatum[] = [];

      const result = await strategy.generateLayout(nodes, edges, defaultConfig);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('a');
      expect(typeof result.nodes[0].x).toBe('number');
      expect(typeof result.nodes[0].y).toBe('number');
      expect(result.nodes[0].w).toBeDefined();
      expect(result.nodes[0].h).toBeDefined();
      expect(result.edges).toHaveLength(0);
    });
  });

  describe('generateLayout() - 10 nodes', () => {
    it('should position 10 nodes in a top-to-bottom flow', async () => {
      const nodes: NodeDatum[] = Array.from({ length: 10 }, (_, i) => ({
        id: `node-${i}`,
        label: `Node ${i}`,
      }));
      const edges: EdgeDatum[] = Array.from({ length: 9 }, (_, i) => ({
        from: `node-${i}`,
        to: `node-${i + 1}`,
      }));

      const result = await strategy.generateLayout(nodes, edges, defaultConfig);

      expect(result.nodes).toHaveLength(10);
      expect(result.edges).toHaveLength(9);

      // All nodes should have valid positions
      result.nodes.forEach((node) => {
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
        expect(typeof node.w).toBe('number');
        expect(typeof node.h).toBe('number');
      });

      // All edges should have at least 2 points
      result.edges.forEach((edge) => {
        expect(edge.points.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('generateLayout() - 50 nodes', () => {
    it('should handle a large graph of 50 nodes', async () => {
      const nodes: NodeDatum[] = Array.from({ length: 50 }, (_, i) => ({
        id: `n${i}`,
        label: `Node ${i}`,
      }));
      const edges: EdgeDatum[] = Array.from({ length: 49 }, (_, i) => ({
        from: `n${i}`,
        to: `n${i + 1}`,
      }));

      const result = await strategy.generateLayout(nodes, edges, defaultConfig);

      expect(result.nodes).toHaveLength(50);
      expect(result.edges).toHaveLength(49);

      // Verify all nodes get positions
      result.nodes.forEach((node) => {
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
        expect(isNaN(node.x)).toBe(false);
        expect(isNaN(node.y)).toBe(false);
      });
    });
  });

  describe('generateLayout() - top-to-bottom ordering', () => {
    it('should position nodes in a hierarchical top-to-bottom order', async () => {
      const nodes: NodeDatum[] = [
        { id: 'start', label: 'Start' },
        { id: 'process', label: 'Process' },
        { id: 'end', label: 'End' },
      ];
      const edges: EdgeDatum[] = [
        { from: 'start', to: 'process' },
        { from: 'process', to: 'end' },
      ];

      const result = await strategy.generateLayout(nodes, edges, defaultConfig);

      const startNode = findNode(result, 'start');
      const processNode = findNode(result, 'process');
      const endNode = findNode(result, 'end');

      // In TB layout, start node center-y should be above (less than) end node
      const startY = startNode.y + (startNode.h || 60) / 2;
      const endY = endNode.y + (endNode.h || 60) / 2;

      expect(startY).toBeLessThan(endY);
    });
  });

  describe('generateLayout() - edges with points', () => {
    it('should include edge points for connected nodes', async () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ];
      const edges: EdgeDatum[] = [{ from: 'a', to: 'b', label: 'connects' }];

      const result = await strategy.generateLayout(nodes, edges, defaultConfig);

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].points.length).toBeGreaterThanOrEqual(2);
      expect(result.edges[0].label).toBe('connects');
    });
  });

  describe('validateInputs()', () => {
    it('should return false for empty nodes', () => {
      expect(strategy.validateInputs([], [])).toBe(false);
    });

    it('should return true for valid nodes and edges', () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ];
      const edges: EdgeDatum[] = [{ from: 'a', to: 'b' }];
      expect(strategy.validateInputs(nodes, edges)).toBe(true);
    });

    it('should return false for duplicate node IDs', () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'a', label: 'A2' },
      ];
      expect(strategy.validateInputs(nodes, [])).toBe(false);
    });

    it('should return false for edges referencing non-existent nodes', () => {
      const nodes: NodeDatum[] = [{ id: 'a', label: 'A' }];
      const edges: EdgeDatum[] = [{ from: 'a', to: 'z' }];
      expect(strategy.validateInputs(nodes, edges)).toBe(false);
    });
  });

  describe('generateLayout() - dangling-edge hardening', () => {
    // Regression: dagre auto-creates phantom nodes for edge endpoints not in the
    // input node set, corrupting layout positions and emitting edges to
    // non-existent nodes. Edges MUST be filtered to the node-id set before
    // g.setEdge (mirrors flowchart-strategy.ts / enhanced-zero-overlap-layout.ts).
    it('drops edges whose endpoints are not in the node set (no phantom dagre nodes)', async () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ];
      const edges: EdgeDatum[] = [
        { from: 'a', to: 'b', label: 'valid' },
        // Both endpoints below reference ids NOT in `nodes`. Without filtering,
        // dagre silently creates phantom nodes for 'ghost'/'ghost2'.
        { from: 'b', to: 'ghost', label: 'dangling-target' },
        { from: 'ghost2', to: 'c', label: 'dangling-source' },
      ];

      const result = await strategy.generateLayout(nodes, edges, defaultConfig);

      // Only the three real nodes are laid out — no phantom 'ghost'/'ghost2'.
      expect(result.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c']);
      // Only the valid edge survives.
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].from).toBe('a');
      expect(result.edges[0].to).toBe('b');
      // Real-node positions stay finite (phantom positions must not corrupt them).
      for (const n of result.nodes) {
        expect(Number.isFinite(n.x)).toBe(true);
        expect(Number.isFinite(n.y)).toBe(true);
      }
    });
  });

  describe('getStrategyDefaults()', () => {
    it('should return flowchart-specific defaults', () => {
      const defaults = strategy.getStrategyDefaults();

      expect(defaults.rankDirection).toBe('TB');
      expect(defaults.rankSeparation).toBe(70);
      expect(defaults.nodeSeparation).toBe(50);
      expect(defaults.marginX).toBe(50);
      expect(defaults.marginY).toBe(50);
    });
  });
});
