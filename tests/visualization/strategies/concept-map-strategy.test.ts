import { ConceptMapLayoutStrategy } from '@/visualization/strategies/ConceptMapLayoutStrategy';
import { NodeDatum, EdgeDatum } from '@/types/diagram';
import { LayoutConfig } from '@/visualization/types';

describe('ConceptMapLayoutStrategy', () => {
  let strategy: ConceptMapLayoutStrategy;
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
    rankSeparation: 50,
  };

  beforeEach(() => {
    strategy = new ConceptMapLayoutStrategy();
  });

  describe('ILayoutStrategy interface compliance', () => {
    it('should have name "conceptmap"', () => {
      expect(strategy.name).toBe('conceptmap');
    });

    it('should implement supports()', () => {
      expect(typeof strategy.supports).toBe('function');
    });

    it('should implement generateLayout()', () => {
      expect(typeof strategy.generateLayout).toBe('function');
    });
  });

  describe('supports()', () => {
    it('should return true for "conceptmap" diagram type', () => {
      expect(strategy.supports('conceptmap')).toBe(true);
    });

    it('should return true for "mindmap" diagram type', () => {
      expect(strategy.supports('mindmap')).toBe(true);
    });

    it('should return true for "general" diagram type', () => {
      expect(strategy.supports('general')).toBe(true);
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

    it('should return false for "comparison" diagram type', () => {
      expect(strategy.supports('comparison')).toBe(false);
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
  });

  describe('generateLayout() - empty graph', () => {
    it('should return empty nodes and edges for no input', async () => {
      const result = await strategy.generateLayout([], [], defaultConfig);

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });
  });

  describe('generateLayout() - single node', () => {
    it('should position a single node centered in the canvas', async () => {
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

  describe('generateLayout() - grid layout for multiple nodes', () => {
    it('should position 9 nodes in a 3x3 grid', async () => {
      const nodes: NodeDatum[] = Array.from({ length: 9 }, (_, i) => ({
        id: `concept-${i}`,
        label: `Concept ${i}`,
      }));
      const edges: EdgeDatum[] = [];

      const result = await strategy.generateLayout(nodes, edges, defaultConfig);

      expect(result.nodes).toHaveLength(9);

      // All nodes should have valid positions
      result.nodes.forEach((node) => {
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
        expect(typeof node.w).toBe('number');
        expect(typeof node.h).toBe('number');
      });

      // Verify grid distribution: no two nodes should have the exact same position
      const positions = result.nodes.map((n) => `${n.x},${n.y}`);
      const uniquePositions = new Set(positions);
      expect(uniquePositions.size).toBe(9);
    });
  });

  describe('generateLayout() - edges', () => {
    it('should generate straight-line edges between connected nodes', async () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ];
      const edges: EdgeDatum[] = [
        { from: 'a', to: 'b', label: 'relates' },
        { from: 'b', to: 'c', label: 'leads to' },
      ];

      const result = await strategy.generateLayout(nodes, edges, defaultConfig);

      expect(result.edges).toHaveLength(2);
      expect(result.edges[0].points.length).toBeGreaterThanOrEqual(2);
      expect(result.edges[0].label).toBe('relates');
      expect(result.edges[1].label).toBe('leads to');
    });

    it('should handle edges referencing missing nodes gracefully', async () => {
      const nodes: NodeDatum[] = [{ id: 'a', label: 'A' }];
      const edges: EdgeDatum[] = [{ from: 'a', to: 'nonexistent' }];

      const result = await strategy.generateLayout(nodes, edges, defaultConfig);

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].points).toEqual([]);
    });
  });

  describe('generateLayout() for each supported diagram type', () => {
    it('should produce valid layout for "conceptmap" type nodes', async () => {
      const nodes: NodeDatum[] = [
        { id: 'c1', label: 'Concept 1' },
        { id: 'c2', label: 'Concept 2' },
        { id: 'c3', label: 'Concept 3' },
        { id: 'c4', label: 'Concept 4' },
      ];
      const edges: EdgeDatum[] = [
        { from: 'c1', to: 'c2' },
        { from: 'c2', to: 'c3' },
        { from: 'c3', to: 'c4' },
      ];

      const result = await strategy.generateLayout(nodes, edges, defaultConfig);

      expect(result.nodes).toHaveLength(4);
      expect(result.edges).toHaveLength(3);
      result.nodes.forEach((node) => {
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
      });
    });

    it('should produce valid layout for "mindmap" type nodes', async () => {
      const nodes: NodeDatum[] = [
        { id: 'center', label: 'Central Idea' },
        { id: 'b1', label: 'Branch 1' },
        { id: 'b2', label: 'Branch 2' },
        { id: 'b3', label: 'Branch 3' },
        { id: 'b4', label: 'Branch 4' },
      ];
      const edges: EdgeDatum[] = [
        { from: 'center', to: 'b1' },
        { from: 'center', to: 'b2' },
        { from: 'center', to: 'b3' },
        { from: 'center', to: 'b4' },
      ];

      const result = await strategy.generateLayout(nodes, edges, defaultConfig);

      expect(result.nodes).toHaveLength(5);
      expect(result.edges).toHaveLength(4);
      result.nodes.forEach((node) => {
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
      });
    });

    it('should produce valid layout for "general" type nodes', async () => {
      const nodes: NodeDatum[] = [
        { id: 'g1', label: 'Item 1' },
        { id: 'g2', label: 'Item 2' },
      ];
      const edges: EdgeDatum[] = [{ from: 'g1', to: 'g2' }];

      const result = await strategy.generateLayout(nodes, edges, defaultConfig);

      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      result.nodes.forEach((node) => {
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
      });
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
    it('should return concept map-specific defaults', () => {
      const defaults = strategy.getStrategyDefaults!();

      expect(defaults.nodeSeparation).toBe(50);
      expect(defaults.marginX).toBe(50);
      expect(defaults.marginY).toBe(50);
    });
  });
});
