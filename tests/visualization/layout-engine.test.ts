import { DiagramType, NodeDatum, EdgeDatum, PositionedNode } from '@/types/diagram';
import { LayoutEngineV2, calculateCanvasSize, calculateMetrics } from '@/visualization/layout-engine-v2';
import { DefaultStrategyRegistry } from '@/visualization/strategies/base-strategy';
import { LayoutStrategy, StrategyLayoutResult } from '@/visualization/types';
import dagre from '@dagrejs/dagre';

// Helper to create a simple test strategy
class TestStrategy implements LayoutStrategy {
  readonly name: string;
  readonly canEscapeLocalMinimum = true;

  constructor(name: string) {
    this.name = name;
  }

  apply(nodes: NodeDatum[], edges: EdgeDatum[]): StrategyLayoutResult {
    const positioned: PositionedNode[] = nodes.map((n, i) => ({
      ...n,
      x: i * 150,
      y: 0,
      width: n.width ?? 120,
      height: n.height ?? 60,
    }));

    const layoutEdges = edges.map(e => ({
      from: e.from,
      to: e.to,
      points: [],
      label: e.label,
    }));

    const canvas = calculateCanvasSize(positioned);
    const metrics = calculateMetrics(positioned, layoutEdges);

    return { nodes: positioned, edges: layoutEdges, canvas, metrics };
  }

  estimateComplexity(nodes: NodeDatum[]): number {
    return nodes.length;
  }
}

describe('LayoutEngineV2 (TASK-0023)', () => {
  let engine: LayoutEngineV2;

  beforeEach(() => {
    engine = new LayoutEngineV2();
  });

  describe('Strategy selection', () => {
    it('should select correct strategy for flow type', () => {
      const strategy = new TestStrategy('flow');
      engine.registerStrategy('flow', strategy);
      const result = engine.layout('flow',
        [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
        [{ from: 'a', to: 'b' }]
      );
      expect(result.nodes).toHaveLength(2);
    });

    it('should select correct strategy for each diagram type', () => {
      const types: DiagramType[] = ['flow', 'tree', 'timeline', 'matrix', 'cycle'];
      for (const type of types) {
        const strategy = new TestStrategy(type);
        engine.registerStrategy(type, strategy);
        const result = engine.layout(type,
          [{ id: 'a', label: 'A' }],
          []
        );
        expect(result.nodes).toHaveLength(1);
      }
    });

    it('should throw for unregistered diagram type', () => {
      expect(() => engine.layout('flow',
        [{ id: 'a', label: 'A' }],
        []
      )).toThrow('No layout strategy registered');
    });
  });

  describe('Canvas size calculation', () => {
    it('should return default canvas for empty nodes', () => {
      const canvas = calculateCanvasSize([]);
      expect(canvas.width).toBe(1920);
      expect(canvas.height).toBe(1080);
    });

    it('should fit all nodes within canvas', () => {
      const nodes: PositionedNode[] = [
        { id: '1', label: 'A', x: 0, y: 0, width: 100, height: 50 },
        { id: '2', label: 'B', x: 500, y: 300, width: 100, height: 50 },
      ];
      const canvas = calculateCanvasSize(nodes);
      expect(canvas.width).toBeGreaterThan(0);
      expect(canvas.height).toBeGreaterThan(0);
    });

    it('should maintain 16:9 aspect ratio', () => {
      const nodes: PositionedNode[] = [
        { id: '1', label: 'A', x: 0, y: 0, width: 100, height: 50 },
        { id: '2', label: 'B', x: 500, y: 300, width: 100, height: 50 },
      ];
      const canvas = calculateCanvasSize(nodes);
      const ratio = canvas.width / canvas.height;
      expect(ratio).toBeCloseTo(16 / 9, 0);
    });

    it('should handle single node', () => {
      const nodes: PositionedNode[] = [
        { id: '1', label: 'A', x: 100, y: 100, width: 120, height: 60 },
      ];
      const canvas = calculateCanvasSize(nodes);
      expect(canvas.width).toBeGreaterThan(0);
      expect(canvas.height).toBeGreaterThan(0);
    });
  });

  describe('LayoutResult format', () => {
    it('should include nodes, edges, canvas, and metrics', () => {
      engine.registerStrategy('flow', new TestStrategy('flow'));
      const result = engine.layout('flow',
        [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
        [{ from: 'a', to: 'b' }]
      );
      expect(result).toHaveProperty('nodes');
      expect(result).toHaveProperty('edges');
      expect(result).toHaveProperty('canvas');
      expect(result).toHaveProperty('metrics');
      expect(result.metrics.overlapCount).toBeDefined();
      expect(typeof result.metrics.overlapCount).toBe('number');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty graph', () => {
      const result = engine.layout('flow', [], []);
      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
      expect(result.canvas.width).toBe(1920);
      expect(result.canvas.height).toBe(1080);
      expect(result.metrics.overlapCount).toBe(0);
    });

    it('should handle single node graph', () => {
      engine.registerStrategy('flow', new TestStrategy('flow'));
      const result = engine.layout('flow',
        [{ id: 'a', label: 'A' }],
        []
      );
      expect(result.nodes).toHaveLength(1);
      expect(result.metrics.overlapCount).toBe(0);
    });
  });
});

describe('DefaultStrategyRegistry (TASK-0023)', () => {
  let registry: DefaultStrategyRegistry;

  beforeEach(() => {
    registry = new DefaultStrategyRegistry();
  });

  it('should register and retrieve strategy by diagram type', () => {
    const strategy = new TestStrategy('flow');
    registry.register('flow', strategy);
    const retrieved = registry.getStrategy('flow');
    expect(retrieved.name).toBe('flow');
  });

  it('should throw for unregistered diagram type', () => {
    expect(() => registry.getStrategy('flow')).toThrow('No layout strategy registered');
  });

  it('should report hasStrategy correctly', () => {
    expect(registry.hasStrategy('flow')).toBe(false);
    registry.register('flow', new TestStrategy('flow'));
    expect(registry.hasStrategy('flow')).toBe(true);
  });

  it('should overwrite strategy for same type', () => {
    registry.register('flow', new TestStrategy('flow-v1'));
    registry.register('flow', new TestStrategy('flow-v2'));
    const strategy = registry.getStrategy('flow');
    expect(strategy.name).toBe('flow-v2');
  });

  it('should return all registered strategies', () => {
    registry.register('flow', new TestStrategy('flow'));
    registry.register('tree', new TestStrategy('tree'));
    const all = registry.getAllStrategies();
    expect(all.size).toBe(2);
  });
});
