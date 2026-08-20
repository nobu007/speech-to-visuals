import { ComparisonStrategy } from '@/visualization/strategies/comparison-strategy';
import { NodeDatum, EdgeDatum } from '@stv/core/types/diagram';

function makeNodes(count: number): NodeDatum[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    label: `Item ${i}`,
  }));
}

describe('ComparisonStrategy (LayoutStrategy)', () => {
  const strategy = new ComparisonStrategy();

  it('should have correct name and canEscapeLocalMinimum', () => {
    expect(strategy.name).toBe('comparison');
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

  it('should split 8 nodes into two columns', () => {
    const nodes = makeNodes(8);
    const result = strategy.apply(nodes, []);

    const centerX = 1920 / 2;
    const leftColumn = result.nodes.filter((n) => n.x + (n.width ?? Number.NaN) / 2 < centerX);
    const rightColumn = result.nodes.filter((n) => n.x + (n.width ?? Number.NaN) / 2 >= centerX);

    expect(leftColumn).toHaveLength(4);
    expect(rightColumn).toHaveLength(4);
  });

  it('should split 5 nodes as 3 left + 2 right', () => {
    const nodes = makeNodes(5);
    const result = strategy.apply(nodes, []);

    const centerX = 1920 / 2;
    const leftColumn = result.nodes.filter((n) => n.x + (n.width ?? Number.NaN) / 2 < centerX);
    const rightColumn = result.nodes.filter((n) => n.x + (n.width ?? Number.NaN) / 2 >= centerX);

    expect(leftColumn).toHaveLength(3);
    expect(rightColumn).toHaveLength(2);
  });

  it('should generate horizontal edge points for left-to-right connections', () => {
    const nodes: NodeDatum[] = [
      { id: 'left-1', label: 'L1' },
      { id: 'left-2', label: 'L2' },
      { id: 'right-1', label: 'R1' },
      { id: 'right-2', label: 'R2' },
    ];
    const edges: EdgeDatum[] = [{ from: 'left-1', to: 'right-1', label: 'compare' }];

    const result = strategy.apply(nodes, edges);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].points.length).toBeGreaterThanOrEqual(2);
    expect(result.edges[0].label).toBe('compare');
  });

  it('should produce zero overlaps', () => {
    const nodes = makeNodes(10);
    const result = strategy.apply(nodes, []);
    expect(result.metrics.overlapCount).toBe(0);
  });

  it('should return non-zero complexity estimate', () => {
    expect(strategy.estimateComplexity(makeNodes(5))).toBeGreaterThan(0);
  });
});
