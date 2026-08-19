import { FlowchartStrategy } from '@/visualization/strategies/flowchart-strategy';
import { NodeDatum, EdgeDatum } from '@stv/core/types/diagram';

function makeNodes(count: number): NodeDatum[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    label: `Node ${i}`,
  }));
}

describe('FlowchartStrategy (LayoutStrategy)', () => {
  const strategy = new FlowchartStrategy();

  it('should have correct name and canEscapeLocalMinimum', () => {
    expect(strategy.name).toBe('flowchart');
    expect(strategy.canEscapeLocalMinimum).toBe(true);
  });

  it('should implement LayoutStrategy interface', () => {
    expect(typeof strategy.apply).toBe('function');
    expect(typeof strategy.estimateComplexity).toBe('function');
  });

  it('should return empty result for zero nodes', () => {
    const result = strategy.apply([], []);
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
    expect(result.canvas.width).toBeGreaterThan(0);
    expect(result.metrics.overlapCount).toBe(0);
  });

  it('should position a single node', () => {
    const result = strategy.apply([{ id: 'a', label: 'A' }], []);
    expect(result.nodes).toHaveLength(1);
    expect(typeof result.nodes[0].x).toBe('number');
    expect(typeof result.nodes[0].y).toBe('number');
  });

  it('should position nodes in top-to-bottom order', () => {
    const nodes: NodeDatum[] = [
      { id: 'start', label: 'Start' },
      { id: 'process', label: 'Process' },
      { id: 'end', label: 'End' },
    ];
    const edges: EdgeDatum[] = [
      { from: 'start', to: 'process' },
      { from: 'process', to: 'end' },
    ];

    const result = strategy.apply(nodes, edges);
    const startNode = result.nodes.find((n) => n.id === 'start')!;
    const endNode = result.nodes.find((n) => n.id === 'end')!;

    expect(startNode.y + startNode.height! / 2).toBeLessThan(endNode.y + endNode.height! / 2);
  });

  it('should generate edge points for connected nodes', () => {
    const nodes: NodeDatum[] = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];
    const edges: EdgeDatum[] = [{ from: 'a', to: 'b', label: 'connects' }];

    const result = strategy.apply(nodes, edges);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].points.length).toBeGreaterThanOrEqual(2);
    expect(result.edges[0].label).toBe('connects');
  });

  it('should handle 20 nodes', () => {
    const nodes = makeNodes(20);
    const edges: EdgeDatum[] = Array.from({ length: 19 }, (_, i) => ({
      from: `n${i}`,
      to: `n${i + 1}`,
    }));

    const result = strategy.apply(nodes, edges);
    expect(result.nodes).toHaveLength(20);
    result.nodes.forEach((node) => {
      expect(typeof node.x).toBe('number');
      expect(isNaN(node.x)).toBe(false);
    });
  });

  it('should return non-zero complexity estimate', () => {
    expect(strategy.estimateComplexity(makeNodes(5))).toBeGreaterThan(0);
  });
});
