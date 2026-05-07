import { executeLayout, StrategySelector } from '@/visualization/strategy-selector';
import { NodeDatum, EdgeDatum, DiagramType } from '@/types/diagram';

describe('executeLayout', () => {
  it('should execute layout for flow diagrams', async () => {
    const nodes: NodeDatum[] = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    const edges: EdgeDatum[] = [{ from: 'a', to: 'b' }];

    const result = await executeLayout(nodes, edges, 'flow');

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.canvas).toHaveProperty('width');
    expect(result.metrics).toHaveProperty('overlapCount');
  });

  it('should execute layout for tree diagrams', async () => {
    const nodes: NodeDatum[] = [
      { id: 'root', label: 'Root' },
      { id: 'child', label: 'Child' },
    ];
    const edges: EdgeDatum[] = [{ from: 'root', to: 'child' }];

    const result = await executeLayout(nodes, edges, 'tree');

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
  });

  it('should execute layout for timeline diagrams', async () => {
    const nodes: NodeDatum[] = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    const edges: EdgeDatum[] = [{ from: 'a', to: 'b' }];

    const result = await executeLayout(nodes, edges, 'timeline');
    expect(result.nodes).toHaveLength(2);
  });

  it('should execute layout for matrix diagrams', async () => {
    const nodes: NodeDatum[] = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    const edges: EdgeDatum[] = [{ from: 'a', to: 'b' }];

    const result = await executeLayout(nodes, edges, 'matrix');
    expect(result.nodes).toHaveLength(2);
  });

  it('should execute layout for cycle diagrams', async () => {
    const nodes: NodeDatum[] = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    const edges: EdgeDatum[] = [{ from: 'a', to: 'b' }];

    const result = await executeLayout(nodes, edges, 'cycle');
    expect(result.nodes).toHaveLength(2);
  });

  it('should handle empty nodes', async () => {
    const result = await executeLayout([], [], 'flow');
    expect(result.nodes).toHaveLength(0);
  });

  it('should use fallback for unknown diagram types', async () => {
    const nodes: NodeDatum[] = [{ id: 'a', label: 'A' }];
    const result = await executeLayout(nodes, [], 'unknown' as DiagramType);
    expect(result.nodes).toHaveLength(1);
  });
});

describe('StrategySelector', () => {
  it('should select registered strategy', () => {
    const selector = new StrategySelector();
    const strategy = selector.select('flow');
    expect(strategy.name).toBe('flow');
  });

  it('should use fallback for unknown types', () => {
    const selector = new StrategySelector();
    const strategy = selector.select('unknown' as DiagramType);
    expect(strategy.name).toBe('grid-snap-fallback');
  });

  it('should return fallback chain', () => {
    const selector = new StrategySelector();
    const chain = selector.getFallbackChain('flow');
    expect(chain).toHaveLength(2);
    expect(chain[0].name).toBe('flow');
    expect(chain[1].name).toBe('grid-snap-fallback');
  });

  it('should estimate complexity', () => {
    const selector = new StrategySelector();
    const complexity = selector.estimateComplexity('flow', 5);
    expect(typeof complexity).toBe('number');
    expect(complexity).toBeGreaterThan(0);
  });

  it('should return registry', () => {
    const selector = new StrategySelector();
    const registry = selector.getRegistry();
    expect(registry).toBeDefined();
  });
});
