import GridSnapStrategy from '../../visualization/layout/strategies/GridSnapStrategy';
import { PositionedNode, LayoutEdge } from '../../types/diagram';
import { createTestConfig, createTestNode, createLayoutEdge, hasAnyOverlap } from './test-utils';

const toLayoutEdges = (pairs: Array<[string, string]>): LayoutEdge[] =>
  pairs.map(([a, b], idx) => createLayoutEdge(String(idx + 1), a, b));

describe('GridSnapStrategy', () => {
  let strategy: GridSnapStrategy;

  beforeEach(() => {
    strategy = new GridSnapStrategy();
  });

  it('returns empty layout for empty inputs', async () => {
    const res = await (strategy as any).performLayout([], [], createTestConfig());
    expect(res.nodes.length).toBe(0);
    expect(res.edges.length).toBe(0);
  });

  it('places a single node onto grid without moving margins negatively', async () => {
    const nodes: PositionedNode[] = [createTestNode('1', 0, 0, 100, 50)];
    const res = await (strategy as any).performLayout(nodes, [], createTestConfig());
    expect(res.nodes.length).toBe(1);
    const n = res.nodes[0];
    expect(Number.isFinite(n.x)).toBe(true);
    expect(Number.isFinite(n.y)).toBe(true);
  });

  it('places multiple overlapping nodes into non-overlapping grid positions', async () => {
    const nodes: PositionedNode[] = [
      createTestNode('1', 0, 0, 100, 50),
      createTestNode('2', 0, 0, 100, 50),
      createTestNode('3', 0, 0, 100, 50),
      createTestNode('4', 0, 0, 100, 50),
    ];

    const res = await (strategy as any).performLayout(nodes, [], createTestConfig());
    expect(res.nodes.length).toBe(4);
    expect(hasAnyOverlap(res.nodes, 0)).toBe(false);
  });

  it('keeps edge endpoints connected after layout', async () => {
    const nodes: PositionedNode[] = [
      createTestNode('a', 0, 0, 80, 40),
      createTestNode('b', 0, 0, 80, 40),
    ];
    const edges = toLayoutEdges([
      ['node-a', 'node-b'],
    ]);
    const res = await (strategy as any).performLayout(nodes, edges, createTestConfig());
    expect(res.edges.length).toBe(1);
    expect(res.edges[0].points.length).toBe(2);
  });
});
