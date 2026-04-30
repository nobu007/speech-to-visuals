import { describe, it, expect } from '@jest/globals';
import { NetworkLayoutStrategy } from '@/visualization/strategies/NetworkLayoutStrategy';
import { NodeDatum, EdgeDatum } from '@/types/diagram';
import { LayoutConfig } from '@/visualization/types';

describe('NetworkLayoutStrategy', () => {
  let strategy: NetworkLayoutStrategy;
  const defaultConfig: LayoutConfig = {
    width: 1920,
    height: 1080,
    nodeWidth: 120,
    nodeHeight: 60,
    marginX: 40,
    marginY: 40,
    rankDirection: 'TB',
    nodeSeparation: 60,
    edgeSeparation: 10,
    rankSeparation: 50,
  };

  beforeEach(() => {
    strategy = new NetworkLayoutStrategy();
  });

  describe('ILayoutStrategy interface compliance', () => {
    it('should have name "network"', () => {
      expect(strategy.name).toBe('network');
    });

    it('should implement supports()', () => {
      expect(typeof strategy.supports).toBe('function');
    });

    it('should implement generateLayout()', () => {
      expect(typeof strategy.generateLayout).toBe('function');
    });
  });

  describe('supports()', () => {
    it('should return true for "network" diagram type', () => {
      expect(strategy.supports('network')).toBe(true);
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

  describe('generateLayout() - 20 nodes with 3-phase force-directed output', () => {
    it('should position all 20 nodes with valid coordinates', async () => {
      const nodes: NodeDatum[] = Array.from({ length: 20 }, (_, i) => ({
        id: `node-${i}`,
        label: `Node ${i}`,
      }));
      const edges: EdgeDatum[] = [
        { from: 'node-0', to: 'node-1' },
        { from: 'node-1', to: 'node-2' },
        { from: 'node-2', to: 'node-3' },
        { from: 'node-3', to: 'node-4' },
        { from: 'node-5', to: 'node-10' },
        { from: 'node-6', to: 'node-11' },
        { from: 'node-7', to: 'node-12' },
        { from: 'node-0', to: 'node-19' },
      ];

      const result = await strategy.generateLayout(nodes, edges, defaultConfig);

      expect(result.nodes).toHaveLength(20);
      expect(result.edges).toHaveLength(8);

      // All nodes should have valid positions (3-phase force-directed applied)
      result.nodes.forEach((node) => {
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
        expect(typeof node.w).toBe('number');
        expect(typeof node.h).toBe('number');
        expect(isNaN(node.x)).toBe(false);
        expect(isNaN(node.y)).toBe(false);
      });

      // All edges should have 2 points (source center, target center)
      result.edges.forEach((edge) => {
        expect(edge.points.length).toBeGreaterThanOrEqual(2);
        edge.points.forEach((point) => {
          expect(typeof point.x).toBe('number');
          expect(typeof point.y).toBe('number');
        });
      });
    });

    it('should keep all nodes within canvas bounds', async () => {
      const nodes: NodeDatum[] = Array.from({ length: 20 }, (_, i) => ({
        id: `node-${i}`,
        label: `Node ${i}`,
      }));
      const edges: EdgeDatum[] = [];

      const result = await strategy.generateLayout(nodes, edges, defaultConfig);

      result.nodes.forEach((node) => {
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeGreaterThanOrEqual(0);
        expect(node.x + (node.w || 0)).toBeLessThanOrEqual(defaultConfig.width);
        expect(node.y + (node.h || 0)).toBeLessThanOrEqual(defaultConfig.height);
      });
    });
  });

  describe('generateLayout() - edges', () => {
    it('should generate edge points connecting node centers', async () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ];
      const edges: EdgeDatum[] = [{ from: 'a', to: 'b', label: 'connects' }];

      const result = await strategy.generateLayout(nodes, edges, defaultConfig);

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].points.length).toBeGreaterThanOrEqual(2);
      expect(result.edges[0].label).toBe('connects');

      // Points should be within canvas
      result.edges[0].points.forEach((point) => {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle edges referencing missing nodes gracefully', async () => {
      const nodes: NodeDatum[] = [{ id: 'a', label: 'A' }];
      const edges: EdgeDatum[] = [{ from: 'a', to: 'nonexistent' }];

      const result = await strategy.generateLayout(nodes, edges, defaultConfig);

      expect(result.edges).toHaveLength(1);
      // Should produce an edge with empty points for missing target
      expect(result.edges[0].points).toEqual([]);
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
    it('should return network-specific defaults', () => {
      const defaults = strategy.getStrategyDefaults!();

      expect(defaults.nodeSeparation).toBe(60);
      expect(defaults.marginX).toBe(40);
      expect(defaults.marginY).toBe(40);
    });
  });
});
