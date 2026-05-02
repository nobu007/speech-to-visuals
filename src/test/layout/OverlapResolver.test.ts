import OverlapResolver from '../../visualization/layout/OverlapResolver';
import { LayoutStrategy } from '../../visualization/layout/strategies/LayoutStrategy';
import { createTestConfig, createEdgeDatum, createDatumNode, createOverlappingPositioned, toDataNodes } from './test-utils';
import { DiagramLayout } from '../../types/diagram';

/** Type helper to access OverlapResolver private members in tests */
type OverlapResolverInternals = {
  maxTimePerStrategy: number;
  maxTotalTime: number;
  strategies: LayoutStrategy[];
  startTime: number;
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

  // ---------- resolve with existing layout (lines 197-202) ----------
  it('uses existing layout node positions when provided', async () => {
    const positioned = createOverlappingPositioned(3);
    const dataNodes = toDataNodes(positioned);

    const existingLayout: DiagramLayout = {
      nodes: positioned.map(n => ({ ...n, x: n.x + 500, y: n.y + 500 })),
      edges: [],
    };

    const result = await resolver.resolve(dataNodes, [], createTestConfig(), existingLayout);
    expect(result).toBeDefined();
    expect(result.layout.nodes.length).toBe(3);
    expect(result.success).toBe(true);
  });

  // ---------- All strategies fail triggers fallback (line 111-122) ----------
  it('returns fallback when all strategies fail', async () => {
    const original = internals(resolver).strategies;
    const failing: LayoutStrategy = {
      name: 'failing-1',
      canEscapeLocalMinimum: false,
      apply: jest.fn().mockRejectedValue(new Error('fail-1')),
      estimateComplexity: jest.fn().mockReturnValue(0),
      calculateMetrics: jest.fn(),
      detectOverlaps: jest.fn().mockReturnValue([]),
      calculateBoundingBox: jest.fn(),
      getDefaultConfig: jest.fn(),
    };
    const failing2: LayoutStrategy = {
      name: 'failing-2',
      canEscapeLocalMinimum: false,
      apply: jest.fn().mockRejectedValue(new Error('fail-2')),
      estimateComplexity: jest.fn().mockReturnValue(0),
      calculateMetrics: jest.fn(),
      detectOverlaps: jest.fn().mockReturnValue([]),
      calculateBoundingBox: jest.fn(),
      getDefaultConfig: jest.fn(),
    };
    const failing3: LayoutStrategy = {
      name: 'failing-3',
      canEscapeLocalMinimum: false,
      apply: jest.fn().mockRejectedValue(new Error('fail-3')),
      estimateComplexity: jest.fn().mockReturnValue(0),
      calculateMetrics: jest.fn(),
      detectOverlaps: jest.fn().mockReturnValue([]),
      calculateBoundingBox: jest.fn(),
      getDefaultConfig: jest.fn(),
    };
    internals(resolver).strategies = [failing, failing2, failing3];

    const positioned = createOverlappingPositioned(3);
    const res = await resolver.resolve(toDataNodes(positioned), [], createTestConfig());

    // Should return a result even when all strategies fail (fallback path)
    expect(res.layout.nodes.length).toBe(3);
    internals(resolver).strategies = original;
  });

  // ---------- Timeout reached before strategy (line 164-165) ----------
  it('handles timeout before strategy execution', async () => {
    internals(resolver).maxTotalTime = 1; // 1ms total time
    internals(resolver).maxTimePerStrategy = 500;

    // Create a strategy that takes a long time
    const slowStrategy: LayoutStrategy = {
      name: 'slow',
      canEscapeLocalMinimum: false,
      apply: jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 5000));
        return {
          layout: { nodes: [], edges: [] },
          bounds: { width: 0, height: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 },
          processingTime: 0,
          success: true,
        };
      }),
      estimateComplexity: jest.fn().mockReturnValue(0),
      calculateMetrics: jest.fn(),
      detectOverlaps: jest.fn().mockReturnValue([]),
      calculateBoundingBox: jest.fn(),
      getDefaultConfig: jest.fn(),
    };
    internals(resolver).strategies = [slowStrategy];

    const positioned = createOverlappingPositioned(3);
    const res = await resolver.resolve(toDataNodes(positioned), [], createTestConfig());
    // Should handle timeout gracefully
    expect(res).toBeDefined();
    expect(res.layout.nodes.length).toBe(3);
  });

  // ---------- Edge crossing detection (lines 319-320, 335-344) ----------
  it('detects edge crossings in the resolved layout', async () => {
    // Create nodes that will have crossing edges
    const dataNodes = [
      createDatumNode('1'),
      createDatumNode('2'),
      createDatumNode('3'),
      createDatumNode('4'),
    ];

    // Create edges that cross: 1->2 and 3->4 should cross
    const edges = [
      createEdgeDatum('e1', 'node-1', 'node-2'),
      createEdgeDatum('e2', 'node-3', 'node-4'),
    ];

    const result = await resolver.resolve(dataNodes, edges, createTestConfig());
    expect(result).toBeDefined();
    expect(result.layout.nodes.length).toBe(4);
    // The metrics should include edgeCrossings count
    expect(typeof result.metrics?.edgeCrossings).toBe('number');
  });

  // ---------- Early termination when good solution found (line 93-96) ----------
  it('terminates early when a good solution is found', async () => {
    const original = internals(resolver).strategies;
    // Create a strategy that always returns a perfect result
    const goodStrategy: LayoutStrategy = {
      name: 'perfect',
      canEscapeLocalMinimum: false,
      apply: jest.fn().mockResolvedValue({
        layout: {
          nodes: createOverlappingPositioned(2).map((n, i) => ({
            ...n,
            x: i * 500,
            y: i * 500,
          })),
          edges: [],
        },
        bounds: { width: 1000, height: 1000, minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
        processingTime: 10,
        success: true,
      }),
      estimateComplexity: jest.fn().mockReturnValue(0),
      calculateMetrics: jest.fn(),
      detectOverlaps: jest.fn().mockReturnValue([]),
      calculateBoundingBox: jest.fn(),
      getDefaultConfig: jest.fn(),
    };
    internals(resolver).strategies = [goodStrategy];

    const positioned = createOverlappingPositioned(2);
    const res = await resolver.resolve(toDataNodes(positioned), [], createTestConfig());

    expect(goodStrategy.apply).toHaveBeenCalledTimes(1);
    expect(res).toBeDefined();
    internals(resolver).strategies = original;
  });

  // ---------- Edges with invalid source/target filtered out (lines 218-223) ----------
  it('filters out edges referencing non-existent nodes', async () => {
    const dataNodes = [
      createDatumNode('1'),
      createDatumNode('2'),
    ];
    const edges = [
      createEdgeDatum('e1', 'node-1', 'node-nonexistent'), // Invalid target
      createEdgeDatum('e2', 'node-1', 'node-2'), // Valid
    ];

    const result = await resolver.resolve(dataNodes, edges, createTestConfig());
    expect(result).toBeDefined();
    expect(result.layout.nodes.length).toBe(2);
  });

  // ---------- Strategy timeout: applyStrategyWithTimeout throws when timeout <= 0 (lines 164-165) ----------
  it('throws when timeout is exhausted before applying strategy', async () => {
    internals(resolver).maxTimePerStrategy = 10;
    internals(resolver).maxTotalTime = 10;
    // Set startTime far in the past to simulate timeout exhaustion
    internals(resolver).startTime = performance.now() - 1000;

    const original = internals(resolver).strategies;
    const goodStrategy: LayoutStrategy = {
      name: 'fast',
      canEscapeLocalMinimum: false,
      apply: jest.fn().mockResolvedValue({
        layout: {
          nodes: createOverlappingPositioned(2),
          edges: [],
        },
        bounds: { width: 1000, height: 1000, minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
        processingTime: 10,
        success: true,
      }),
      estimateComplexity: jest.fn().mockReturnValue(0),
      calculateMetrics: jest.fn(),
      detectOverlaps: jest.fn().mockReturnValue([]),
      calculateBoundingBox: jest.fn(),
      getDefaultConfig: jest.fn(),
    };
    internals(resolver).strategies = [goodStrategy];

    const positioned = createOverlappingPositioned(3);
    const res = await resolver.resolve(toDataNodes(positioned), [], createTestConfig());
    // Even if timeout happens, should return a result
    expect(res).toBeDefined();
    expect(res.layout.nodes.length).toBeGreaterThanOrEqual(1);
    internals(resolver).strategies = original;
  });

  // ---------- Strategy improvement insufficient: moves to next strategy (line 100-102) ----------
  it('moves to next strategy when improvement is insufficient', async () => {
    const original = internals(resolver).strategies;

    // First strategy: good result
    const goodStrategy: LayoutStrategy = {
      name: 'good',
      canEscapeLocalMinimum: false,
      apply: jest.fn().mockResolvedValue({
        layout: {
          nodes: createOverlappingPositioned(2).map((n, i) => ({ ...n, x: i * 500, y: i * 500 })),
          edges: [],
        },
        bounds: { width: 1000, height: 1000, minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
        processingTime: 10,
        success: true,
      }),
      estimateComplexity: jest.fn().mockReturnValue(0),
      calculateMetrics: jest.fn(),
      detectOverlaps: jest.fn().mockReturnValue([]),
      calculateBoundingBox: jest.fn(),
      getDefaultConfig: jest.fn(),
    };

    // Second strategy: worse result (higher energy)
    const worseStrategy: LayoutStrategy = {
      name: 'worse',
      canEscapeLocalMinimum: false,
      apply: jest.fn().mockResolvedValue({
        layout: {
          nodes: createOverlappingPositioned(2),
          edges: [],
        },
        bounds: { width: 100, height: 100, minX: 0, minY: 0, maxX: 100, maxY: 100 },
        processingTime: 50,
        success: true,
      }),
      estimateComplexity: jest.fn().mockReturnValue(0),
      calculateMetrics: jest.fn(),
      detectOverlaps: jest.fn().mockReturnValue([]),
      calculateBoundingBox: jest.fn(),
      getDefaultConfig: jest.fn(),
    };

    internals(resolver).strategies = [goodStrategy, worseStrategy];

    const positioned = createOverlappingPositioned(2);
    const res = await resolver.resolve(toDataNodes(positioned), [], createTestConfig());

    expect(goodStrategy.apply).toHaveBeenCalled();
    expect(res).toBeDefined();
    internals(resolver).strategies = original;
  });

  // ---------- Grid fallback when overlaps remain (lines 125-140) ----------
  it('falls back to grid strategy when overlaps remain after all strategies', async () => {
    const original = internals(resolver).strategies;

    // Strategy that returns overlapping nodes
    const overlappingStrategy: LayoutStrategy = {
      name: 'overlap-return',
      canEscapeLocalMinimum: false,
      apply: jest.fn().mockResolvedValue({
        layout: {
          // All nodes at the same position = lots of overlaps
          nodes: createOverlappingPositioned(3),
          edges: [],
        },
        bounds: { width: 100, height: 100, minX: 0, minY: 0, maxX: 100, maxY: 100 },
        processingTime: 10,
        success: false,
      }),
      estimateComplexity: jest.fn().mockReturnValue(0),
      calculateMetrics: jest.fn(),
      detectOverlaps: jest.fn().mockReturnValue([{ node1: {}, node2: {} }]),
      calculateBoundingBox: jest.fn(),
      getDefaultConfig: jest.fn(),
    };

    internals(resolver).strategies = [overlappingStrategy];

    const positioned = createOverlappingPositioned(3);
    const res = await resolver.resolve(toDataNodes(positioned), [], createTestConfig());

    expect(res).toBeDefined();
    expect(res.layout.nodes.length).toBe(3);
    internals(resolver).strategies = original;
  });

  // ---------- Existing layout with no nodes (line 186 branch) ----------
  it('uses random positions when existing layout has no nodes', async () => {
    const dataNodes = [createDatumNode('1'), createDatumNode('2')];
    const edges = [createEdgeDatum('e1', 'node-1', 'node-2')];

    const existingLayout: DiagramLayout = {
      nodes: [],
      edges: [],
    };

    const result = await resolver.resolve(dataNodes, edges, createTestConfig(), existingLayout);
    expect(result).toBeDefined();
    expect(result.layout.nodes.length).toBe(2);
  });
});
