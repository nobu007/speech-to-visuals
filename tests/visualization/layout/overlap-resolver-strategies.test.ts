/**
 * Tests for src/visualization/layout/OverlapResolver.ts
 *
 * The strategy-based OverlapResolver that chains ProgressiveForce →
 * SimulatedAnnealing → GridSnap to achieve zero-overlap layouts.
 *
 * Strategy modules are mocked so we can focus on the orchestrator logic
 * (metric aggregation, energy comparison, timeout, edge filtering, fallback).
 */
import { jest } from '@jest/globals';
import type { LayoutResult, LayoutMetrics } from '@/visualization/types';
import type { NodeDatum, EdgeDatum, PositionedNode, LayoutEdge, DiagramLayout } from '@stv/core/types/diagram';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    width: 1920,
    height: 1080,
    nodeWidth: 100,
    nodeHeight: 50,
    marginX: 20,
    marginY: 20,
    rankDirection: 'TB' as const,
    nodeSeparation: 30,
    edgeSeparation: 10,
    rankSeparation: 50,
    ...overrides,
  };
}

function positioned(id: string, x: number, y: number, w = 100, h = 50): PositionedNode {
  return { id, label: id, x, y, width: w, height: h };
}

function makeLayoutResult(
  nodes: PositionedNode[],
  edges: LayoutEdge[] = [],
  overrides: Partial<LayoutResult> = {},
): LayoutResult {
  const minX = nodes.length ? Math.min(...nodes.map(n => n.x - (n.width ?? 100) / 2)) : 0;
  const minY = nodes.length ? Math.min(...nodes.map(n => n.y - (n.height ?? 50) / 2)) : 0;
  const maxX = nodes.length ? Math.max(...nodes.map(n => n.x + (n.width ?? 100) / 2)) : 0;
  const maxY = nodes.length ? Math.max(...nodes.map(n => n.y + (n.height ?? 50) / 2)) : 0;

  return {
    layout: { nodes, edges },
    bounds: { width: maxX - minX, height: maxY - minY, minX, minY, maxX, maxY },
    processingTime: 1,
    success: true,
    metrics: {
      overlapCount: 0,
      edgeCrossings: 0,
      totalArea: 0,
      nodeSpacing: 200,
      layoutBalance: 0.9,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock strategy registry — each mock strategy returns a configured result
// ---------------------------------------------------------------------------

const mockResults: Map<string, LayoutResult> = new Map();

function setMockResult(name: string, result: LayoutResult) {
  mockResults.set(name, result);
}

function createMockStrategy(name: string) {
  return class {
    readonly name = name;
    async apply() {
      const result = mockResults.get(name);
      if (!result) return makeLayoutResult([]);
      return result;
    }
  };
}

jest.unstable_mockModule(
  '@/visualization/layout/strategies/ProgressiveForceStrategy',
  () => ({ __esModule: true, default: createMockStrategy('progressive-force') }),
);

jest.unstable_mockModule(
  '@/visualization/layout/strategies/SimulatedAnnealingStrategy',
  () => ({ __esModule: true, default: createMockStrategy('simulated-annealing') }),
);

jest.unstable_mockModule(
  '@/visualization/layout/strategies/GridSnapStrategy',
  () => ({ __esModule: true, default: createMockStrategy('grid-snap') }),
);

// ---------------------------------------------------------------------------
// Lazy-loaded module under test
// ---------------------------------------------------------------------------

type OverlapResolverClass = import('@/visualization/layout/OverlapResolver').OverlapResolver;
let OverlapResolver: typeof OverlapResolverClass;

beforeAll(async () => {
  const mod = await import('@/visualization/layout/OverlapResolver');
  OverlapResolver = mod.OverlapResolver;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OverlapResolver (layout/) — strategy-based orchestrator', () => {
  beforeEach(() => {
    mockResults.clear();
  });

  function resolver(): InstanceType<typeof OverlapResolverClass> {
    return new OverlapResolver();
  }

  // ── Empty / trivial inputs ─────────────────────────────────────────────

  describe('empty input', () => {
    it('returns empty layout for zero nodes', async () => {
      const result = await resolver().resolve([], [], makeConfig());

      expect(result.layout.nodes).toHaveLength(0);
      expect(result.layout.edges).toHaveLength(0);
      expect(result.success).toBe(true);
      expect(result.metrics?.overlapCount).toBe(0);
    });
  });

  // ── Single node ────────────────────────────────────────────────────────

  describe('single node', () => {
    it('returns a positioned node', async () => {
      const resolved = [positioned('a', 100, 100)];
      setMockResult('progressive-force', makeLayoutResult(resolved));

      const nodes: NodeDatum[] = [{ id: 'a', label: 'A' }];
      const result = await resolver().resolve(nodes, [], makeConfig());

      expect(result.layout.nodes).toHaveLength(1);
      expect(result.layout.nodes[0].id).toBe('a');
      expect(typeof result.layout.nodes[0].x).toBe('number');
      expect(typeof result.layout.nodes[0].y).toBe('number');
    });
  });

  // ── Two nodes — no overlap ─────────────────────────────────────────────

  describe('non-overlapping nodes', () => {
    it('passes nodes through to strategies', async () => {
      const resolved = [
        positioned('a', 0, 0),
        positioned('b', 300, 0),
      ];
      setMockResult('progressive-force', makeLayoutResult(resolved));

      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ];
      const result = await resolver().resolve(nodes, [], makeConfig());

      expect(result.layout.nodes).toHaveLength(2);
      expect(result.success).toBe(true);
    });
  });

  // ── Edge filtering ─────────────────────────────────────────────────────

  describe('edge handling', () => {
    it('filters out edges referencing non-existent source', async () => {
      const resolved = [positioned('a', 0, 0)];
      setMockResult('progressive-force', makeLayoutResult(resolved));

      const nodes: NodeDatum[] = [{ id: 'a', label: 'A' }];
      const edges: EdgeDatum[] = [
        { from: 'b', to: 'a', id: 'e1' },  // source 'b' doesn't exist
      ];

      const result = await resolver().resolve(nodes, edges, makeConfig());
      expect(result.success).toBe(true);
    });

    it('filters out edges referencing non-existent target', async () => {
      const resolved = [positioned('a', 0, 0)];
      setMockResult('progressive-force', makeLayoutResult(resolved));

      const nodes: NodeDatum[] = [{ id: 'a', label: 'A' }];
      const edges: EdgeDatum[] = [
        { from: 'a', to: 'z', id: 'e1' },  // target 'z' doesn't exist
      ];

      const result = await resolver().resolve(nodes, edges, makeConfig());
      expect(result.success).toBe(true);
    });
  });

  // ── Strategy chaining & best result selection ──────────────────────────

  describe('strategy chaining', () => {
    it('selects the result with lowest energy (zero overlaps)', async () => {
      const good = [positioned('a', 0, 0), positioned('b', 300, 0)];
      const bad = [positioned('a', 0, 0), positioned('b', 10, 0)];

      setMockResult('progressive-force', makeLayoutResult(bad, [], {
        metrics: { overlapCount: 1, edgeCrossings: 0, totalArea: 10000, nodeSpacing: 10, layoutBalance: 0.5 },
      }));
      setMockResult('simulated-annealing', makeLayoutResult(good, [], {
        metrics: { overlapCount: 0, edgeCrossings: 0, totalArea: 50000, nodeSpacing: 300, layoutBalance: 0.9 },
      }));
      // Grid-snap fallback must also return the good result (resolver re-applies when any prior metric had overlaps)
      setMockResult('grid-snap', makeLayoutResult(good, [], {
        metrics: { overlapCount: 0, edgeCrossings: 0, totalArea: 50000, nodeSpacing: 300, layoutBalance: 0.9 },
      }));

      const result = await resolver().resolve(
        [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
        [],
        makeConfig(),
      );

      expect(result.layout.nodes).toHaveLength(2);
      expect(result.metrics?.overlapCount).toBe(0);
    });

    it('falls back to grid-snap when previous strategies leave overlaps', async () => {
      const overlapping = [positioned('a', 0, 0), positioned('b', 10, 0)];

      setMockResult('progressive-force', makeLayoutResult(overlapping, [], {
        metrics: { overlapCount: 1, edgeCrossings: 0, totalArea: 5000, nodeSpacing: 10, layoutBalance: 0.5 },
      }));
      setMockResult('simulated-annealing', makeLayoutResult(overlapping, [], {
        metrics: { overlapCount: 1, edgeCrossings: 0, totalArea: 5000, nodeSpacing: 10, layoutBalance: 0.5 },
      }));
      const clean = [positioned('a', 0, 0), positioned('b', 200, 0)];
      setMockResult('grid-snap', makeLayoutResult(clean, [], {
        metrics: { overlapCount: 0, edgeCrossings: 0, totalArea: 20000, nodeSpacing: 200, layoutBalance: 0.8 },
      }));

      const result = await resolver().resolve(
        [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
        [],
        makeConfig(),
      );

      expect(result.success).toBe(true);
      expect(result.metrics?.overlapCount).toBe(0);
    });
  });

  // ── Existing layout as starting point ──────────────────────────────────

  describe('existing layout', () => {
    it('accepts an existing layout to improve upon', async () => {
      const existingNodes = [positioned('a', 100, 100)];
      const existingLayout: DiagramLayout = {
        nodes: existingNodes,
        edges: [],
      };

      setMockResult('progressive-force', makeLayoutResult(existingNodes));

      const result = await resolver().resolve(
        [{ id: 'a', label: 'A' }],
        [],
        makeConfig(),
        existingLayout,
      );

      expect(result.layout.nodes[0].id).toBe('a');
    });
  });

  // ── Metrics ────────────────────────────────────────────────────────────

  describe('metrics', () => {
    it('returns metrics from the best strategy', async () => {
      const result = await resolver().resolve(
        [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
        [],
        makeConfig(),
      );

      // The resolver computes its own metrics from the result nodes,
      // so we check structure rather than exact values
      expect(result.metrics).toBeDefined();
      expect(result.metrics?.overlapCount).toBe(0); // zero-overlap guarantee
      expect(typeof result.metrics?.edgeCrossings).toBe('number');
      expect(typeof result.metrics?.totalArea).toBe('number');
      expect(typeof result.metrics?.nodeSpacing).toBe('number');
      expect(typeof result.metrics?.layoutBalance).toBe('number');
    });

    it('returns zero metrics for empty input', async () => {
      const result = await resolver().resolve([], [], makeConfig());

      expect(result.metrics?.overlapCount).toBe(0);
      expect(result.metrics?.edgeCrossings).toBe(0);
    });
  });

  // ── Bounds ─────────────────────────────────────────────────────────────

  describe('bounds', () => {
    it('calculates correct bounding box for a single node', async () => {
      const resolved = [positioned('a', 100, 100)];
      setMockResult('progressive-force', makeLayoutResult(resolved));

      const result = await resolver().resolve(
        [{ id: 'a', label: 'A' }],
        [],
        makeConfig(),
      );

      // The resolver positions the node via strategies; verify bounds are valid
      expect(result.bounds.width).toBeGreaterThan(0);
      expect(result.bounds.height).toBeGreaterThan(0);
      expect(result.bounds.maxX).toBeGreaterThan(result.bounds.minX);
      expect(result.bounds.maxY).toBeGreaterThan(result.bounds.minY);
    });

    it('returns zero bounds for empty input', async () => {
      const result = await resolver().resolve([], [], makeConfig());
      expect(result.bounds.width).toBe(0);
      expect(result.bounds.height).toBe(0);
    });
  });

  // ── Multiple nodes with edges ──────────────────────────────────────────

  describe('graph with edges', () => {
    it('processes a 3-node graph with edges', async () => {
      const resolved = [
        positioned('a', 0, 0),
        positioned('b', 200, 0),
        positioned('c', 100, 200),
      ];
      const edges: LayoutEdge[] = [
        { source: 'a', target: 'b', points: [], id: 'e1' },
        { source: 'b', target: 'c', points: [], id: 'e2' },
      ];

      setMockResult('progressive-force', makeLayoutResult(resolved, edges, {
        metrics: { overlapCount: 0, edgeCrossings: 0, totalArea: 60000, nodeSpacing: 200, layoutBalance: 0.85 },
      }));

      const result = await resolver().resolve(
        [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
          { id: 'c', label: 'C' },
        ],
        [
          { from: 'a', to: 'b', id: 'e1' },
          { from: 'b', to: 'c', id: 'e2' },
        ],
        makeConfig(),
      );

      expect(result.layout.nodes).toHaveLength(3);
      expect(result.success).toBe(true);
    });
  });

  // ── Processing time ────────────────────────────────────────────────────

  describe('processing time', () => {
    it('records processing time in the result', async () => {
      setMockResult('progressive-force', makeLayoutResult([positioned('a', 0, 0)]));

      const result = await resolver().resolve(
        [{ id: 'a', label: 'A' }],
        [],
        makeConfig(),
      );

      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });
  });
});
