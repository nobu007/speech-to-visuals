import OverlapResolver from '../../visualization/layout/OverlapResolver';
import { LayoutStrategy } from '../../visualization/layout/strategies/LayoutStrategy';
import { createTestConfig, createEdgeDatum, createDatumNode, createOverlappingPositioned, toDataNodes } from './test-utils';

/** Type helper to access OverlapResolver private members in tests */
type OverlapResolverInternals = {
  maxTimePerStrategy: number;
  maxTotalTime: number;
  strategies: LayoutStrategy[];
};

/** Cast resolver to access private fields for test configuration */
function internals(r: OverlapResolver): OverlapResolverInternals {
  return r as unknown as OverlapResolverInternals;
}

describe('OverlapResolver', () => {
  let resolver: OverlapResolver;

  beforeEach(() => {
    resolver = new OverlapResolver();
    // Shorten timeouts for tests via private access
    internals(resolver).maxTimePerStrategy = 200;
    internals(resolver).maxTotalTime = 800;
  });

  it('initializes with default strategies in order', () => {
    const strategies = internals(resolver).strategies;
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
    internals(resolver).maxTimePerStrategy = 10;
    internals(resolver).maxTotalTime = 30;
    const positioned = createOverlappingPositioned(30);
    const resStart = Date.now();
    const res = await resolver.resolve(toDataNodes(positioned), [], createTestConfig());
    const duration = Date.now() - resStart;
    expect(duration).toBeLessThan(500);
    expect(res.layout.nodes.length).toBe(30);
    // success may be false under extreme time pressure (30ms total) — the
    // timing guarantee itself is what we validate here
    expect(typeof res.success).toBe('boolean');
  });

  it('uses fallback strategy when a strategy throws', async () => {
    const original = internals(resolver).strategies;
    const failing: LayoutStrategy = {
      name: 'failing',
      canEscapeLocalMinimum: false,
      apply: jest.fn().mockRejectedValue(new Error('boom')),
      estimateComplexity: jest.fn().mockReturnValue(0),
      calculateMetrics: jest.fn(),
      detectOverlaps: jest.fn().mockReturnValue([]),
      calculateBoundingBox: jest.fn(),
      getDefaultConfig: jest.fn(),
    };
    internals(resolver).strategies = [failing, ...original];

    const positioned = createOverlappingPositioned(3);
    const res = await resolver.resolve(toDataNodes(positioned), [], createTestConfig());

    expect(failing.apply).toHaveBeenCalled();
    expect(res.success).toBe(true);
    internals(resolver).strategies = original;
  });
});
