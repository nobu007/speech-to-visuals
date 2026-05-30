import { GeneralStrategy } from '@/visualization/strategies/general-strategy';
import { NodeDatum, EdgeDatum } from '@/types/diagram';

function makeNodes(count: number): NodeDatum[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    label: `Node ${i}`,
  }));
}

describe('GeneralStrategy (LayoutStrategy)', () => {
  const strategy = new GeneralStrategy();

  it('should have correct name and canEscapeLocalMinimum', () => {
    expect(strategy.name).toBe('general');
    expect(strategy.canEscapeLocalMinimum).toBe(false);
  });

  it('should implement LayoutStrategy interface', () => {
    expect(typeof strategy.apply).toBe('function');
    expect(typeof strategy.estimateComplexity).toBe('function');
  });

  it('should return empty result for zero nodes', () => {
    const result = strategy.apply([], []);
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
    expect(result.metrics.overlapCount).toBe(0);
  });

  it('should position a single node', () => {
    const result = strategy.apply([{ id: 'a', label: 'A' }], []);
    expect(result.nodes).toHaveLength(1);
    expect(typeof result.nodes[0].x).toBe('number');
    expect(typeof result.nodes[0].y).toBe('number');
  });

  it('should position all nodes with valid coordinates', () => {
    const nodes = makeNodes(12);
    const result = strategy.apply(nodes, []);

    expect(result.nodes).toHaveLength(12);
    result.nodes.forEach((node) => {
      expect(typeof node.x).toBe('number');
      expect(typeof node.y).toBe('number');
      expect(isNaN(node.x)).toBe(false);
      expect(isNaN(node.y)).toBe(false);
    });
  });

  it('should place most-connected node first (highest priority)', () => {
    const nodes: NodeDatum[] = [
      { id: 'hub', label: 'Hub' },
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
      { id: 'd', label: 'D' },
    ];
    const edges: EdgeDatum[] = [
      { from: 'hub', to: 'a' },
      { from: 'hub', to: 'b' },
      { from: 'hub', to: 'c' },
      { from: 'hub', to: 'd' },
    ];

    const result = strategy.apply(nodes, edges);

    // Hub (degree 4) should be the first node in the result
    expect(result.nodes[0].id).toBe('hub');
  });

  it('should generate edge points', () => {
    const nodes: NodeDatum[] = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];
    const edges: EdgeDatum[] = [{ from: 'a', to: 'b', label: 'link' }];

    const result = strategy.apply(nodes, edges);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].points).toHaveLength(2);
    expect(result.edges[0].label).toBe('link');
  });

  it('should produce zero overlaps for grid layout', () => {
    const nodes = makeNodes(16);
    const result = strategy.apply(nodes, []);
    expect(result.metrics.overlapCount).toBe(0);
  });

  it('should return non-zero complexity estimate', () => {
    expect(strategy.estimateComplexity(makeNodes(5))).toBeGreaterThan(0);
  });
});
