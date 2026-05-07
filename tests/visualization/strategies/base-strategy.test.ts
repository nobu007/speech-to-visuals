import { DefaultStrategyRegistry } from '@/visualization/strategies/base-strategy';
import { LayoutStrategy, StrategyLayoutResult } from '@/visualization/types';
import { NodeDatum, EdgeDatum, PositionedNode } from '@/types/diagram';
import { calculateCanvasSize, calculateMetrics } from '@/visualization/layout-engine-v2';

class MockStrategy implements LayoutStrategy {
  readonly name: string;
  readonly canEscapeLocalMinimum = true;
  constructor(name: string) { this.name = name; }
  apply(nodes: NodeDatum[], edges: EdgeDatum[]): StrategyLayoutResult {
    const positioned = nodes.map((n, i) => ({ ...n, x: i * 150, y: 0, width: n.width ?? 120, height: n.height ?? 60 }));
    const canvas = calculateCanvasSize(positioned);
    const metrics = calculateMetrics(positioned, []);
    return { nodes: positioned, edges: [], canvas, metrics };
  }
  estimateComplexity(nodes: NodeDatum[]): number { return nodes.length; }
}

describe('DefaultStrategyRegistry', () => {
  let registry: DefaultStrategyRegistry;

  beforeEach(() => {
    registry = new DefaultStrategyRegistry();
  });

  it('should register and retrieve strategies', () => {
    const strategy = new MockStrategy('flow');
    registry.register('flow', strategy);
    expect(registry.getStrategy('flow')).toBe(strategy);
  });

  it('should throw for unregistered type', () => {
    expect(() => registry.getStrategy('flow')).toThrow('No layout strategy registered for diagram type: flow');
  });

  it('should report hasStrategy correctly', () => {
    expect(registry.hasStrategy('flow')).toBe(false);
    registry.register('flow', new MockStrategy('flow'));
    expect(registry.hasStrategy('flow')).toBe(true);
  });

  it('should list all strategies', () => {
    registry.register('flow', new MockStrategy('flow'));
    registry.register('tree', new MockStrategy('tree'));
    const all = registry.getAllStrategies();
    expect(all.size).toBe(2);
    expect(all.has('flow')).toBe(true);
    expect(all.has('tree')).toBe(true);
  });

  it('should clear all strategies', () => {
    registry.register('flow', new MockStrategy('flow'));
    registry.clear();
    expect(registry.hasStrategy('flow')).toBe(false);
  });
});
