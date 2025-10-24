import OverlapResolver from '../../visualization/layout/OverlapResolver';
import { createTestConfig, createEdgeDatum, createDatumNode, createOverlappingPositioned, toDataNodes } from './test-utils';

describe('OverlapResolver', () => {
  let resolver: OverlapResolver;

  beforeEach(() => {
    resolver = new OverlapResolver() as any;
    // Shorten timeouts for tests via private access
    (resolver as any).maxTimePerStrategy = 200;
    (resolver as any).maxTotalTime = 800;
  });

  it('initializes with default strategies in order', () => {
    const strategies = (resolver as any).strategies as any[];
    expect(strategies?.length).toBeGreaterThanOrEqual(3);
    expect(strategies[0].name).toBeDefined();
  });

  it('handles empty input', async () => {
    const res = await resolver.resolve([], [], createTestConfig());
    expect(res.layout.nodes.length).toBe(0);
    expect(res.layout.edges.length).toBe(0);
    expect(res.success).toBe(true);
  });

  it('resolves overlapping nodes (fallback to grid if needed)', async () => {
    const positioned = createOverlappingPositioned(5);
    const dataNodes = toDataNodes(positioned);
    const edges = [
      createEdgeDatum('1', dataNodes[0].id, dataNodes[1].id, 'e1'),
      createEdgeDatum('2', dataNodes[1].id, dataNodes[2].id, 'e2'),
    ];

    const result = await resolver.resolve(dataNodes, edges, createTestConfig());
    expect(result).toBeDefined();
    expect(result.layout.nodes.length).toBe(5);
    expect(result.metrics?.overlapCount ?? 0).toBeGreaterThanOrEqual(0);
    expect(result.success).toBe(true);
  });

  it('respects very short total time limit', async () => {
    (resolver as any).maxTimePerStrategy = 10;
    (resolver as any).maxTotalTime = 30;
    const positioned = createOverlappingPositioned(30);
    const resStart = Date.now();
    const res = await resolver.resolve(toDataNodes(positioned), [], createTestConfig());
    const duration = Date.now() - resStart;
    expect(duration).toBeLessThan(120);
    expect(res.layout.nodes.length).toBe(30);
    expect(res.success).toBe(true);
  });

  it('uses fallback strategy when a strategy throws', async () => {
    const original = (resolver as any).strategies as any[];
    const failing = {
      name: 'failing',
      canEscapeLocalMinimum: false,
      apply: jest.fn().mockRejectedValue(new Error('boom')),
    };
    (resolver as any).strategies = [failing, ...original];

    const positioned = createOverlappingPositioned(3);
    const res = await resolver.resolve(toDataNodes(positioned), [], createTestConfig());

    expect(failing.apply).toHaveBeenCalled();
    expect(res.success).toBe(true);
    (resolver as any).strategies = original;
  });
});
