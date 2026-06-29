import { SimulatedAnnealingStrategy } from '../SimulatedAnnealingStrategy';
import { PositionedNode, LayoutEdge, NodeDatum, EdgeDatum, DiagramLayout } from '@/types/diagram';
import { LayoutConfig } from '../../../types';

describe('SimulatedAnnealingStrategy', () => {
  let strategy: SimulatedAnnealingStrategy;
  const baseConfig: LayoutConfig = {
    width: 800,
    height: 600,
    nodeWidth: 120,
    nodeHeight: 60,
    marginX: 40,
    marginY: 40,
    rankDirection: 'TB',
    nodeSeparation: 30,
    edgeSeparation: 10,
    rankSeparation: 50,
  };

  const makeNode = (id: string, x = 0, y = 0, width = 120, height = 60): PositionedNode => ({
    id,
    label: `Node-${id}`,
    x,
    y,
    width,
    height,
  });

  const makeEdge = (source: string, target: string): LayoutEdge => ({
    id: `${source}-${target}`,
    source,
    target,
    from: source,
    to: target,
    points: [],
  });

  beforeEach(() => {
    strategy = new SimulatedAnnealingStrategy();
  });

  describe('properties', () => {
    it('should have name "simulated-annealing"', () => {
      expect(strategy.name).toBe('simulated-annealing');
    });

    it('should have canEscapeLocalMinimum = true', () => {
      expect(strategy.canEscapeLocalMinimum).toBe(true);
    });
  });

  describe('estimateComplexity', () => {
    it('should return positive value for valid input', () => {
      const complexity = strategy.estimateComplexity(10, 5);
      expect(complexity).toBeGreaterThan(0);
    });

    it('should scale with node and edge count', () => {
      const small = strategy.estimateComplexity(5, 2);
      const large = strategy.estimateComplexity(50, 20);
      expect(large).toBeGreaterThan(small);
    });

    it('should handle zero nodes and edges', () => {
      const complexity = strategy.estimateComplexity(0, 0);
      expect(complexity).toBe(0);
    });
  });

  describe('performLayout (via apply)', () => {
    it('should produce valid layout for simple graph', async () => {
      const nodes: NodeDatum[] = [
        { id: 'A', label: 'A' },
        { id: 'B', label: 'B' },
      ];
      const edges: EdgeDatum[] = [
        { id: 'e1', source: 'A', target: 'B', from: 'A', to: 'B' },
      ];

      const result = await strategy.apply(nodes, edges, baseConfig);

      expect(result.layout.nodes).toHaveLength(2);
      expect(result.layout.edges).toHaveLength(1);
      expect(result.success).toBe(true);
    });

    it('should position nodes within canvas bounds', async () => {
      const nodes: NodeDatum[] = [
        { id: 'A', label: 'A' },
        { id: 'B', label: 'B' },
        { id: 'C', label: 'C' },
      ];
      const edges: EdgeDatum[] = [];

      const result = await strategy.apply(nodes, edges, baseConfig);

      for (const node of result.layout.nodes) {
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.x).toBeLessThanOrEqual(baseConfig.width);
        expect(node.y).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeLessThanOrEqual(baseConfig.height);
      }
    });

    it('should handle single node', async () => {
      const nodes: NodeDatum[] = [{ id: 'A', label: 'A' }];
      const edges: EdgeDatum[] = [];

      const result = await strategy.apply(nodes, edges, baseConfig);

      expect(result.layout.nodes).toHaveLength(1);
      expect(result.layout.nodes[0].id).toBe('A');
    });

    it('should handle empty nodes', async () => {
      const nodes: NodeDatum[] = [];
      const edges: EdgeDatum[] = [];

      const result = await strategy.apply(nodes, edges, baseConfig);

      expect(result.layout.nodes).toHaveLength(0);
      expect(result.layout.edges).toHaveLength(0);
    });

    it('should produce edge points after layout', async () => {
      const nodes: NodeDatum[] = [
        { id: 'A', label: 'A' },
        { id: 'B', label: 'B' },
      ];
      const edges: EdgeDatum[] = [
        { id: 'e1', source: 'A', target: 'B', from: 'A', to: 'B' },
      ];

      const result = await strategy.apply(nodes, edges, baseConfig);

      expect(result.layout.edges[0].points).toHaveLength(2);
      expect(result.layout.edges[0].points[0]).toHaveProperty('x');
      expect(result.layout.edges[0].points[0]).toHaveProperty('y');
      expect(result.layout.edges[0].points[1]).toHaveProperty('x');
      expect(result.layout.edges[0].points[1]).toHaveProperty('y');
    });

    it('should return empty points for edge with missing node', async () => {
      const nodes: NodeDatum[] = [{ id: 'A', label: 'A' }];
      const edges: EdgeDatum[] = [
        { id: 'e1', source: 'A', target: 'X', from: 'A', to: 'X' },
      ];

      const result = await strategy.apply(nodes, edges, baseConfig);

      expect(result.layout.edges[0].points).toHaveLength(0);
    });

    it('should use existing layout positions when provided', async () => {
      const nodes: NodeDatum[] = [
        { id: 'A', label: 'A' },
        { id: 'B', label: 'B' },
      ];
      const edges: EdgeDatum[] = [
        { id: 'e1', source: 'A', target: 'B', from: 'A', to: 'B' },
      ];
      const existingLayout: DiagramLayout = {
        nodes: [
          makeNode('A', 100, 100),
          makeNode('B', 300, 300),
        ],
        edges: [],
      };

      const result = await strategy.apply(nodes, edges, baseConfig, existingLayout);

      expect(result.layout.nodes).toHaveLength(2);
    });

    it('should handle larger graph with multiple nodes and edges', async () => {
      const nodes: NodeDatum[] = ['A', 'B', 'C', 'D', 'E'].map(id => ({ id, label: id }));
      const edges: EdgeDatum[] = [
        { id: 'e1', source: 'A', target: 'B', from: 'A', to: 'B' },
        { id: 'e2', source: 'B', target: 'C', from: 'B', to: 'C' },
        { id: 'e3', source: 'C', target: 'D', from: 'C', to: 'D' },
        { id: 'e4', source: 'D', target: 'E', from: 'D', to: 'E' },
        { id: 'e5', source: 'A', target: 'E', from: 'A', to: 'E' },
      ];

      const result = await strategy.apply(nodes, edges, baseConfig);

      expect(result.layout.nodes).toHaveLength(5);
      expect(result.layout.edges).toHaveLength(5);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('overlap avoidance', () => {
    it('should reduce overlaps compared to initial random placement', async () => {
      const nodes: NodeDatum[] = ['A', 'B', 'C', 'D'].map(id => ({ id, label: id }));
      const edges: EdgeDatum[] = [];

      const result = await strategy.apply(nodes, edges, baseConfig);

      // After annealing, there should be zero overlaps
      expect(result.metrics.overlapCount).toBe(0);
    });

    it('should produce zero-overlap layout for non-overlapping nodes', async () => {
      const nodes: NodeDatum[] = ['A', 'B', 'C', 'D', 'E', 'F'].map(id => ({ id, label: id }));
      const edges: EdgeDatum[] = [
        { id: 'e1', source: 'A', target: 'B', from: 'A', to: 'B' },
        { id: 'e2', source: 'C', target: 'D', from: 'C', to: 'D' },
        { id: 'e3', source: 'E', target: 'F', from: 'E', to: 'F' },
      ];

      const result = await strategy.apply(nodes, edges, baseConfig);

      expect(result.metrics.overlapCount).toBe(0);
    });
  });

  describe('metrics calculation (inherited from BaseLayoutStrategy)', () => {
    it('should calculate bounding box correctly', async () => {
      const nodes: NodeDatum[] = [
        { id: 'A', label: 'A' },
        { id: 'B', label: 'B' },
      ];
      const edges: EdgeDatum[] = [];

      const result = await strategy.apply(nodes, edges, baseConfig);

      expect(result.bounds.width).toBeGreaterThanOrEqual(0);
      expect(result.bounds.height).toBeGreaterThanOrEqual(0);
    });

    it('should include processingTime', async () => {
      const nodes: NodeDatum[] = [{ id: 'A', label: 'A' }];
      const result = await strategy.apply(nodes, [], baseConfig);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should include metrics with all required fields', async () => {
      const nodes: NodeDatum[] = [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }];
      const edges: EdgeDatum[] = [
        { id: 'e1', source: 'A', target: 'B', from: 'A', to: 'B' },
      ];

      const result = await strategy.apply(nodes, edges, baseConfig);

      expect(result.metrics).toHaveProperty('overlapCount');
      expect(result.metrics).toHaveProperty('edgeCrossings');
      expect(result.metrics).toHaveProperty('totalArea');
      expect(result.metrics).toHaveProperty('nodeSpacing');
      expect(result.metrics).toHaveProperty('layoutBalance');
    });
  });

  describe('getDefaultConfig (inherited)', () => {
    it('should return flow config for "flow" type', () => {
      const config = strategy.getDefaultConfig('flow');
      expect(config.rankDirection).toBe('LR');
    });

    it('should return tree config for "tree" type', () => {
      const config = strategy.getDefaultConfig('tree');
      expect(config.rankDirection).toBe('TB');
    });

    it('should return default config for unknown type', () => {
      const config = strategy.getDefaultConfig('unknown');
      expect(config.nodeWidth).toBe(150);
      expect(config.nodeHeight).toBe(60);
    });
  });

  describe('detectOverlaps (inherited)', () => {
    it('should detect overlapping nodes', () => {
      const nodes: PositionedNode[] = [
        makeNode('A', 100, 100, 120, 60),
        makeNode('B', 110, 110, 120, 60),
      ];
      const overlaps = strategy.detectOverlaps(nodes, 0);
      expect(overlaps).toHaveLength(1);
    });

    it('should return empty for non-overlapping nodes', () => {
      const nodes: PositionedNode[] = [
        makeNode('A', 0, 0, 120, 60),
        makeNode('B', 500, 500, 120, 60),
      ];
      const overlaps = strategy.detectOverlaps(nodes, 0);
      expect(overlaps).toHaveLength(0);
    });

    it('should respect padding parameter', () => {
      const nodes: PositionedNode[] = [
        makeNode('A', 100, 100, 120, 60),
        makeNode('B', 250, 100, 120, 60),
      ];
      // Without padding, these shouldn't overlap (gap = 10)
      expect(strategy.detectOverlaps(nodes, 0)).toHaveLength(0);
      // Gap is 30px; with padding >= 31 they should "overlap"
      expect(strategy.detectOverlaps(nodes, 40)).toHaveLength(1);
    });
  });

  describe('calculateBoundingBox (inherited)', () => {
    it('should return zero bounds for empty nodes', () => {
      const bounds = strategy.calculateBoundingBox([]);
      expect(bounds.width).toBe(0);
      expect(bounds.height).toBe(0);
    });

    it('should calculate correct bounds for multiple nodes', () => {
      const nodes: PositionedNode[] = [
        makeNode('A', 0, 0, 100, 50),
        makeNode('B', 200, 200, 100, 50),
      ];
      const bounds = strategy.calculateBoundingBox(nodes);
      expect(bounds.minX).toBe(-50);
      expect(bounds.maxX).toBe(250);
      expect(bounds.minY).toBe(-25);
      expect(bounds.maxY).toBe(225);
      expect(bounds.width).toBe(300);
      expect(bounds.height).toBe(250);
    });
  });

  describe('calculateMetrics (inherited)', () => {
    it('should return Infinity nodeSpacing for single node', () => {
      const nodes: PositionedNode[] = [makeNode('A', 0, 0)];
      const edges: LayoutEdge[] = [];
      const metrics = strategy.calculateMetrics(nodes, edges);
      expect(metrics.nodeSpacing).toBe(Infinity);
    });

    it('should calculate total area correctly', () => {
      const nodes: PositionedNode[] = [
        makeNode('A', 0, 0, 100, 50),
        makeNode('B', 200, 200, 120, 60),
      ];
      const edges: LayoutEdge[] = [];
      const metrics = strategy.calculateMetrics(nodes, edges);
      expect(metrics.totalArea).toBe(100 * 50 + 120 * 60);
    });

    it('should detect edge crossings', () => {
      const nodes: PositionedNode[] = [
        makeNode('A', 0, 0),
        makeNode('B', 200, 200),
        makeNode('C', 200, 0),
        makeNode('D', 0, 200),
      ];
      const edges: LayoutEdge[] = [
        makeEdge('A', 'B'),
        makeEdge('C', 'D'),
      ];
      const metrics = strategy.calculateMetrics(nodes, edges);
      expect(metrics.edgeCrossings).toBeGreaterThanOrEqual(1);
    });
  });

  describe('error handling', () => {
    it('should handle nodes with undefined width/height gracefully', async () => {
      const nodes: NodeDatum[] = [
        { id: 'A', label: 'A' },
      ];
      const result = await strategy.apply(nodes, [], baseConfig);
      expect(result.layout.nodes).toHaveLength(1);
    });

    it('should handle disconnected graph', async () => {
      const nodes: NodeDatum[] = ['A', 'B', 'C'].map(id => ({ id, label: id }));
      const edges: EdgeDatum[] = [];
      const result = await strategy.apply(nodes, edges, baseConfig);
      expect(result.layout.nodes).toHaveLength(3);
      expect(result.metrics.overlapCount).toBe(0);
    });
  });

  describe('w/h property fallback in overlap detection', () => {
    it('should detect overlaps when nodes use w/h instead of width/height', () => {
      const nodes = [
        { id: 'A', label: 'A', x: 100, y: 100, w: 120, h: 60 },
        { id: 'B', label: 'B', x: 110, y: 110, w: 120, h: 60 },
      ] as PositionedNode[];
      const overlaps = strategy.detectOverlaps(nodes, 0);
      expect(overlaps).toHaveLength(1);
    });

    it('should detect zero overlaps for distant nodes using w/h', () => {
      const nodes = [
        { id: 'A', label: 'A', x: 0, y: 0, w: 100, h: 50 },
        { id: 'B', label: 'B', x: 500, y: 500, w: 100, h: 50 },
      ] as PositionedNode[];
      const overlaps = strategy.detectOverlaps(nodes, 0);
      expect(overlaps).toHaveLength(0);
    });

    it('should produce zero-overlap layout for nodes with only w/h properties', async () => {
      const nodes: NodeDatum[] = [
        { id: 'A', label: 'A' },
        { id: 'B', label: 'B' },
        { id: 'C', label: 'C' },
        { id: 'D', label: 'D' },
      ];
      const edges: EdgeDatum[] = [
        { id: 'e1', source: 'A', target: 'B', from: 'A', to: 'B' },
        { id: 'e2', source: 'C', target: 'D', from: 'C', to: 'D' },
      ];

      const result = await strategy.apply(nodes, edges, baseConfig);
      expect(result.metrics.overlapCount).toBe(0);
    });

    it('should not produce NaN positions for nodes without any dimension properties', async () => {
      const nodes: NodeDatum[] = [
        { id: 'A', label: 'A' },
        { id: 'B', label: 'B' },
      ];
      const edges: EdgeDatum[] = [];

      const result = await strategy.apply(nodes, edges, baseConfig);

      for (const node of result.layout.nodes) {
        expect(isNaN(node.x)).toBe(false);
        expect(isNaN(node.y)).toBe(false);
      }
    });

    it('should not freeze when config dimensions are zero', async () => {
      const nodes: NodeDatum[] = [
        { id: 'A', label: 'A' },
        { id: 'B', label: 'B' },
      ];
      const edges: EdgeDatum[] = [];
      const zeroDimConfig: LayoutConfig = {
        ...baseConfig,
        width: 0,
        height: 0,
      };

      // Should complete without hanging or producing NaN
      const result = await strategy.apply(nodes, edges, zeroDimConfig);
      expect(result.layout.nodes).toHaveLength(2);

      for (const node of result.layout.nodes) {
        expect(isNaN(node.x)).toBe(false);
        expect(isNaN(node.y)).toBe(false);
      }
    });
  });
});
