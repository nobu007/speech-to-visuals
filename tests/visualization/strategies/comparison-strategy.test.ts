import { ComparisonLayoutStrategy } from '@/visualization/strategies/ComparisonLayoutStrategy';
import { NodeDatum, EdgeDatum } from '@/types/diagram';
import { LayoutConfig } from '@/visualization/types';

describe('ComparisonLayoutStrategy', () => {
  let strategy: ComparisonLayoutStrategy;
  const defaultConfig: LayoutConfig = {
    width: 1920,
    height: 1080,
    nodeWidth: 120,
    nodeHeight: 60,
    marginX: 80,
    marginY: 50,
    rankDirection: 'TB',
    nodeSeparation: 70,
    edgeSeparation: 10,
    rankSeparation: 50,
  };

  beforeEach(() => {
    strategy = new ComparisonLayoutStrategy();
  });

  describe('ILayoutStrategy interface compliance', () => {
    it('should have name "comparison"', () => {
      expect(strategy.name).toBe('comparison');
    });

    it('should implement supports()', () => {
      expect(typeof strategy.supports).toBe('function');
    });

    it('should implement generateLayout()', () => {
      expect(typeof strategy.generateLayout).toBe('function');
    });
  });

  describe('supports()', () => {
    it('should return true for "comparison" diagram type', () => {
      expect(strategy.supports('comparison')).toBe(true);
    });

    it('should return false for "flow" diagram type', () => {
      expect(strategy.supports('flow')).toBe(false);
    });

    it('should return false for "flowchart" diagram type', () => {
      expect(strategy.supports('flowchart')).toBe(false);
    });

    it('should return false for "tree" diagram type', () => {
      expect(strategy.supports('tree')).toBe(false);
    });

    it('should return false for "network" diagram type', () => {
      expect(strategy.supports('network')).toBe(false);
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
    it('should return empty result for no input', async () => {
      const result = await strategy.generateLayout([], [], defaultConfig);

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });
  });

  describe('generateLayout() - single node', () => {
    it('should position a single node in the left column', async () => {
      const nodes: NodeDatum[] = [{ id: 'a', label: 'A' }];
      const edges: EdgeDatum[] = [];

      const result = await strategy.generateLayout(nodes, edges, defaultConfig);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('a');
      expect(typeof result.nodes[0].x).toBe('number');
      expect(typeof result.nodes[0].y).toBe('number');
      expect(result.nodes[0].w).toBeDefined();
      expect(result.nodes[0].h).toBeDefined();
    });
  });

  describe('generateLayout() - 8 nodes (2-column layout)', () => {
    it('should split 8 nodes into two columns of 4', async () => {
      const nodes: NodeDatum[] = Array.from({ length: 8 }, (_, i) => ({
        id: `item-${i}`,
        label: `Item ${i}`,
      }));
      const edges: EdgeDatum[] = [];

      const result = await strategy.generateLayout(nodes, edges, defaultConfig);

      expect(result.nodes).toHaveLength(8);

      // Left column center is at 25% of width, right column at 75%
      const leftThreshold = defaultConfig.width * 0.5;
      const leftColumn = result.nodes.filter(
        (n) => n.x + (n.w || 120) / 2 < leftThreshold
      );
      const rightColumn = result.nodes.filter(
        (n) => n.x + (n.w || 120) / 2 >= leftThreshold
      );

      // 8 nodes split: ceil(8/2) = 4 left, 4 right
      expect(leftColumn).toHaveLength(4);
      expect(rightColumn).toHaveLength(4);
    });

    it('should have all nodes with valid positions', async () => {
      const nodes: NodeDatum[] = Array.from({ length: 8 }, (_, i) => ({
        id: `item-${i}`,
        label: `Item ${i}`,
      }));

      const result = await strategy.generateLayout(nodes, [], defaultConfig);

      result.nodes.forEach((node) => {
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
        expect(typeof node.w).toBe('number');
        expect(typeof node.h).toBe('number');
        expect(isNaN(node.x)).toBe(false);
        expect(isNaN(node.y)).toBe(false);
      });
    });
  });

  describe('generateLayout() - odd number of nodes', () => {
    it('should split 5 nodes with 3 in left column and 2 in right column', async () => {
      const nodes: NodeDatum[] = Array.from({ length: 5 }, (_, i) => ({
        id: `item-${i}`,
        label: `Item ${i}`,
      }));

      const result = await strategy.generateLayout(nodes, [], defaultConfig);

      expect(result.nodes).toHaveLength(5);

      const leftThreshold = defaultConfig.width * 0.5;
      const leftColumn = result.nodes.filter(
        (n) => n.x + (n.w || 120) / 2 < leftThreshold
      );
      const rightColumn = result.nodes.filter(
        (n) => n.x + (n.w || 120) / 2 >= leftThreshold
      );

      // ceil(5/2) = 3 left, 2 right
      expect(leftColumn).toHaveLength(3);
      expect(rightColumn).toHaveLength(2);
    });
  });

  describe('generateLayout() - edges with horizontal connections', () => {
    it('should generate edge points for left-to-right connections', async () => {
      const nodes: NodeDatum[] = [
        { id: 'left-1', label: 'Left 1' },
        { id: 'left-2', label: 'Left 2' },
        { id: 'right-1', label: 'Right 1' },
        { id: 'right-2', label: 'Right 2' },
      ];
      const edges: EdgeDatum[] = [
        { from: 'left-1', to: 'right-1', label: 'compare' },
      ];

      const result = await strategy.generateLayout(nodes, edges, defaultConfig);

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].points.length).toBeGreaterThanOrEqual(2);
      expect(result.edges[0].label).toBe('compare');
    });
  });

  describe('validateInputs()', () => {
    it('should return false for empty nodes', () => {
      expect(strategy.validateInputs!([], [])).toBe(false);
    });

    it('should return true for valid nodes and edges', () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ];
      const edges: EdgeDatum[] = [{ from: 'a', to: 'b' }];
      expect(strategy.validateInputs!(nodes, edges)).toBe(true);
    });

    it('should return false for duplicate node IDs', () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'a', label: 'A2' },
      ];
      expect(strategy.validateInputs!(nodes, [])).toBe(false);
    });

    it('should return false for edges referencing non-existent nodes', () => {
      const nodes: NodeDatum[] = [{ id: 'a', label: 'A' }];
      const edges: EdgeDatum[] = [{ from: 'a', to: 'z' }];
      expect(strategy.validateInputs!(nodes, edges)).toBe(false);
    });
  });

  describe('getStrategyDefaults()', () => {
    it('should return comparison-specific defaults', () => {
      const defaults = strategy.getStrategyDefaults!();

      expect(defaults.nodeSeparation).toBe(70);
      expect(defaults.marginX).toBe(80);
      expect(defaults.marginY).toBe(50);
    });
  });
});
