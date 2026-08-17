/**
 * Unit tests for worker delegation helper in ComplexLayoutEngine
 *
 * Tests computeLayoutViaWorker private method at unit level,
 * including the disposed-flag guard and result mapping logic.
 */

import { jest } from '@jest/globals';
import type { LayoutConfig } from '../../visualization/types';
import type { FallbackLayoutStrategy } from '../../visualization/strategies/FallbackLayoutStrategy';
import type { WorkerResponse, LayoutWorkerResult } from '../types';
import type { DiagramType } from '../../types/diagram';

// Mock workers module
jest.unstable_mockModule('@/workers', () => ({
  WorkerPool: jest.fn(),
  isWorkerAvailable: jest.fn(() => false),
  getOptimalWorkerCount: jest.fn(() => 2),
  computeLayout: jest.fn(),
}));

// Mock worker-factories
jest.unstable_mockModule('@/workers/worker-factories', () => ({
  createLayoutWorkerFactory: jest.fn(() => () => {
    throw new Error('Worker factory should not be called');
  }),
}));

// Mock DagreLayoutStrategy to avoid dagre dependency issues
jest.unstable_mockModule('@/visualization/strategies/DagreLayoutStrategy', () => ({
  DagreLayoutStrategy: jest.fn().mockImplementation(function (_config?: LayoutConfig, _fallback?: FallbackLayoutStrategy) {
    this.applyLayout = jest.fn().mockResolvedValue({
      nodes: [
        { id: 'a', label: 'Node A', x: 50, y: 50, w: 120, h: 60 },
        { id: 'b', label: 'Node B', x: 250, y: 50, w: 120, h: 60 },
        { id: 'c', label: 'Node C', x: 150, y: 160, w: 120, h: 60 },
      ],
      edges: [
        { from: 'a', to: 'b', points: [{ x: 110, y: 80 }, { x: 310, y: 80 }] },
        { from: 'b', to: 'c', points: [{ x: 310, y: 80 }, { x: 210, y: 190 }] },
      ],
    } as never);
  }),
}));

jest.unstable_mockModule('@/visualization/strategies/CulturalLayoutAdapter', () => ({
  CulturalLayoutAdapter: jest.fn().mockImplementation(function () {
    this.applyCulturalAdaptation = jest.fn((layout) => Promise.resolve(layout));
  }),
}));

jest.unstable_mockModule('@/visualization/layout-utils', () => ({
  nodesOverlap: jest.fn(() => false),
  getGraphConfig: jest.fn(() => ({})),
  calculateNodeWidth: jest.fn(() => 120),
  distance: jest.fn((dx: number, dy: number) => Math.sqrt(dx * dx + dy * dy)),
  // round 41: complex-layout-engine's bounds now import these — the ESM
  // mock must provide every named export the importer reads (link error
  // otherwise, jest-esm-mock-pattern). Faithful minimal shapes; defaults
  // are DEFAULT_NODE_WIDTH/HEIGHT (120/60).
  nodeExtentEdges: jest.fn((node: { x: number; y: number; width?: number; w?: number; height?: number; h?: number }, fallbackWidth = 120, fallbackHeight = 60) => ({
    left: node.x,
    top: node.y,
    right: node.x + (node.width ?? node.w ?? fallbackWidth),
    bottom: node.y + (node.height ?? node.h ?? fallbackHeight),
  })),
  foldNodeExtents: jest.fn((nodes: Array<Record<string, unknown>>, read: (n: Record<string, unknown>) => { left: number; top: number; right: number; bottom: number }) => {
    if (nodes.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of nodes) {
      const edges = read(node);
      minX = Math.min(minX, edges.left);
      minY = Math.min(minY, edges.top);
      maxX = Math.max(maxX, edges.right);
      maxY = Math.max(maxY, edges.bottom);
    }
    return { minX, minY, maxX, maxY };
  }),
  // round 45: complex-layout-engine's velocity clamp now imports this —
  // the ESM mock must provide every named export the importer reads
  // (link error otherwise, jest-esm-mock-pattern). Faithful shape.
  clampNodeCoordinate: jest.fn((value: number, canvasSize: number, nodeSize: number, margin = 0) =>
    Math.max(margin, Math.min(canvasSize - nodeSize - margin, value))),
  // round 47: complex-layout-engine's fallback edge points now read the
  // node box-center through this — faithful shape (per-axis fallbacks,
  // same defaults as the real calculateNodeCenter: 0/0).
  calculateNodeCenter: jest.fn((node: { x: number; y: number; width?: number; w?: number; height?: number; h?: number }, widthFallback = 0, heightFallback = 0) => ({
    x: node.x + ((node.width ?? node.w) ?? widthFallback) / 2,
    y: node.y + ((node.height ?? node.h) ?? heightFallback) / 2,
  })),
  // round 48: complex-layout-engine's cluster/ring placements now import
  // these — faithful shapes (the retired inline forms).
  ringAngle: jest.fn((index: number, count: number) => (2 * Math.PI * index) / count),
  pointOnCircle: jest.fn((centerX: number, centerY: number, angle: number, radius: number) => ({
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle),
  })),
}));

const { ComplexLayoutEngine } = await import('../../visualization/complex-layout-engine');
const { DagreLayoutStrategy } = await import('../../visualization/strategies/DagreLayoutStrategy');

// --- Test helper types ---

/** Minimal mock of a worker pool for testing delegation */
interface MockPool {
  execute: ReturnType<typeof jest.fn>;
  terminate: ReturnType<typeof jest.fn>;
  isTerminated: boolean;
}

/** Interface for accessing private members of ComplexLayoutEngine in tests */
interface LayoutEngineTestInternals {
  disposed: boolean;
  getWorkerPool: () => MockPool | null;
  computeLayoutViaWorker: (nodes: Array<Record<string, unknown>>, edges: Array<Record<string, unknown>>) => Promise<Record<string, unknown> | null>;
}

/** Cast engine to internal access interface for testing private members */
function testInternals(engine: ComplexLayoutEngine): LayoutEngineTestInternals {
  return engine as unknown as LayoutEngineTestInternals;
}

// Suppress console
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

const createNodes = () => [
  { id: 'a', label: 'Node A', meta: { importance: 1 } },
  { id: 'b', label: 'Node B', meta: { importance: 2 } },
  { id: 'c', label: 'Node C', meta: { importance: 1 } },
];

const createEdges = () => [
  { from: 'a', to: 'b', label: 'edge-ab' },
  { from: 'b', to: 'c', label: 'edge-bc' },
];

/**
 * Create an engine with a mock pool injected by overriding getWorkerPool.
 * This is necessary because getWorkerPool() checks isWorkerAvailable()
 * which returns false in the test environment.
 */
function createEngineWithPoolMock(poolMock: MockPool | null): ComplexLayoutEngine {
  const engine = new ComplexLayoutEngine({ useWebWorkers: true });
  // Override getWorkerPool to return our mock directly
  testInternals(engine).getWorkerPool = () => poolMock;
  return engine;
}

function makePoolMock(response: WorkerResponse<LayoutWorkerResult>): MockPool {
  return {
    execute: jest.fn().mockResolvedValue(response as never),
    terminate: jest.fn(),
    isTerminated: false,
  };
}

function createDisposeTestEngine(): ComplexLayoutEngine {
  const dagreStrategy = new DagreLayoutStrategy({} as LayoutConfig, {} as FallbackLayoutStrategy);
  return new ComplexLayoutEngine({
    useWebWorkers: true,
    enableOverlapResolution: false,
    enableEdgeOptimization: false,
    enableMultiLevel: false,
    enableClustering: false,
    enableForceDirected: false,
  }, undefined, undefined, dagreStrategy);
}

// ---------- computeLayoutViaWorker ----------

describe('computeLayoutViaWorker (private)', () => {
  it.each([
    ['pool is null', null],
    ['worker response has error', { id: 't', type: 'LAYOUT_COMPUTE' as const, error: { code: 'LAYOUT_ERROR', message: 'fail' } }],
    ['payload is null', { id: 't', type: 'LAYOUT_COMPUTE' as const, payload: null }],
  ] as const)('returns null when %s', async (_desc, poolResponse) => {
    const poolMock = poolResponse === null ? null : makePoolMock(poolResponse as WorkerResponse<LayoutWorkerResult>);
    const engine = createEngineWithPoolMock(poolMock);
    const result = await testInternals(engine).computeLayoutViaWorker(createNodes(), createEdges());
    expect(result).toBeNull();
  });

  it('returns null when pool.execute throws', async () => {
    const poolMock: MockPool = {
      execute: jest.fn().mockRejectedValue(new Error('Worker crashed') as never),
      terminate: jest.fn(),
      isTerminated: false,
    };
    const engine = createEngineWithPoolMock(poolMock);
    const result = await testInternals(engine).computeLayoutViaWorker(createNodes(), createEdges());
    expect(result).toBeNull();
  });

  it('returns DiagramLayout on successful worker execution', async () => {
    const poolMock = makePoolMock({
      id: 'test-layout',
      type: 'LAYOUT_COMPUTE',
      payload: {
        nodes: [
          { id: 'a', x: 100, y: 50, width: 120, height: 60 },
          { id: 'b', x: 300, y: 50, width: 120, height: 60 },
          { id: 'c', x: 200, y: 160, width: 120, height: 60 },
        ],
        edges: [{ source: 'a', target: 'b' }, { source: 'b', target: 'c' }],
        width: 500,
        height: 300,
      },
    });

    const engine = createEngineWithPoolMock(poolMock);

    const result = await testInternals(engine).computeLayoutViaWorker(createNodes(), createEdges());

    expect(result).not.toBeNull();
    expect(result!.nodes).toHaveLength(3);
    expect(result!.edges).toHaveLength(2);

    // Verify node mapping preserves original labels
    expect(result!.nodes[0].label).toBe('Node A');
    expect(result!.nodes[1].label).toBe('Node B');
    expect(result!.nodes[2].label).toBe('Node C');

    // Verify positions from worker
    expect(result!.nodes[0].x).toBe(100);
    expect(result!.nodes[0].y).toBe(50);
    expect(result!.nodes[0].w).toBe(120);
    expect(result!.nodes[0].h).toBe(60);
  });

  it('preserves meta from original nodes in worker result', async () => {
    const poolMock = makePoolMock({
      id: 'test-layout',
      type: 'LAYOUT_COMPUTE',
      payload: {
        nodes: [
          { id: 'a', x: 100, y: 50, width: 120, height: 60 },
          { id: 'b', x: 300, y: 50, width: 120, height: 60 },
        ],
        edges: [{ source: 'a', target: 'b' }],
        width: 500,
        height: 200,
      },
    });

    const engine = createEngineWithPoolMock(poolMock);

    const nodes = [
      { id: 'a', label: 'A', meta: { importance: 5, custom: 'data' } },
      { id: 'b', label: 'B' },
    ];
    const edges = [{ from: 'a', to: 'b' }];

    const result = await testInternals(engine).computeLayoutViaWorker(nodes, edges);

    // Node 'a' should have meta preserved
    expect(result!.nodes[0].meta).toEqual({ importance: 5, custom: 'data' });
    // Node 'b' has no meta
    expect(result!.nodes[1].meta).toBeUndefined();
  });

  it('computes edge points from node positions', async () => {
    const poolMock = makePoolMock({
      id: 'test-layout',
      type: 'LAYOUT_COMPUTE',
      payload: {
        nodes: [
          { id: 'a', x: 100, y: 200, width: 120, height: 60 },
          { id: 'b', x: 400, y: 200, width: 120, height: 60 },
        ],
        edges: [{ source: 'a', target: 'b' }],
        width: 600,
        height: 400,
      },
    });

    const engine = createEngineWithPoolMock(poolMock);

    const nodes = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];
    const edges = [{ from: 'a', to: 'b', label: 'connects' }];

    const result = await testInternals(engine).computeLayoutViaWorker(nodes, edges);

    expect(result!.edges).toHaveLength(1);
    const edge = result!.edges[0];
    expect(edge.from).toBe('a');
    expect(edge.to).toBe('b');
    expect(edge.label).toBe('connects');
    expect(edge.points).toHaveLength(2);
    expect(edge.points[0].x).toBe(160);
    expect(edge.points[0].y).toBe(230);
    expect(edge.points[1].x).toBe(460);
    expect(edge.points[1].y).toBe(230);
  });

  it('sends correct payload structure with layout-prefixed message id to worker', async () => {
    const poolMock = makePoolMock({
      id: 'test-layout',
      type: 'LAYOUT_COMPUTE',
      payload: {
        nodes: [{ id: 'a', x: 0, y: 0, width: 120, height: 60 }],
        edges: [],
        width: 1920,
        height: 1080,
      },
    });

    const engine = new ComplexLayoutEngine({
      useWebWorkers: true,
      nodeWidth: 120,
      nodeHeight: 60,
      width: 1920,
      height: 1080,
      rankDirection: 'LR',
      nodeSeparation: 80,
      rankSeparation: 100,
    });
    testInternals(engine).getWorkerPool = () => poolMock;

    await testInternals(engine).computeLayoutViaWorker(
      [{ id: 'a', label: 'Test' }],
      [],
    );
    // Round 17: the message id is DETERMINISTIC per node set (was
    // `layout_<Date.now()>_<random suffix>`, which leaked a timestamp +
    // entropy into output JSON). Same nodes → same id on every call.
    await testInternals(engine).computeLayoutViaWorker(
      [{ id: 'a', label: 'Test' }],
      [],
    );

    const first = poolMock.execute.mock.calls[0][0] as Record<string, unknown>;
    const second = poolMock.execute.mock.calls[1][0] as Record<string, unknown>;
    expect(first.type).toBe('LAYOUT_COMPUTE');
    expect(first.id).toMatch(/^layout_[0-9a-z]{1,7}$/);
    expect(second.id).toBe(first.id);
    const sentMessage = first;
    const payload = sentMessage.payload as Record<string, unknown>;
    expect((payload.nodes as Array<Record<string, unknown>>)[0]).toEqual({
      id: 'a',
      width: 120,
      height: 60,
      label: 'Test',
    });
    expect(payload.config).toEqual({
      width: 1920,
      height: 1080,
      rankDirection: 'LR',
      nodeSeparation: 80,
      rankSeparation: 100,
    });
  });

  it('handles unknown node ids gracefully in edge computation', async () => {
    const poolMock = makePoolMock({
      id: 'test-layout',
      type: 'LAYOUT_COMPUTE',
      payload: {
        nodes: [
          { id: 'a', x: 100, y: 100, width: 120, height: 60 },
        ],
        edges: [{ source: 'a', target: 'b' }],
        width: 500,
        height: 300,
      },
    });

    const engine = createEngineWithPoolMock(poolMock);

    const nodes = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];
    const edges = [{ from: 'a', to: 'b' }];

    const result = await testInternals(engine).computeLayoutViaWorker(nodes, edges);

    expect(result!.edges).toHaveLength(1);
    // Unknown node 'b' falls back to (0,0) position + default size offset (120/2, 60/2)
    expect(result!.edges[0].points[1].x).toBe(60);
    expect(result!.edges[0].points[1].y).toBe(30);
  });
});

// ---------- Disposed-flag guard (Layout Engine) ----------

describe('Layout engine disposed-flag guard', () => {
  it.each([
    ['getWorkerPool returns null after dispose', () => {
      const engine = new ComplexLayoutEngine({ useWebWorkers: true });
      engine.dispose();
      expect(testInternals(engine).disposed).toBe(true);
    }],
    ['isWorkerEnabled returns false after dispose', () => {
      const engine = new ComplexLayoutEngine({ useWebWorkers: true });
      engine.dispose();
      expect(engine.isWorkerEnabled).toBe(false);
    }],
    ['dispose is idempotent (3x)', () => {
      const engine = new ComplexLayoutEngine({ useWebWorkers: true });
      engine.dispose();
      engine.dispose();
      engine.dispose();
      expect(engine.isWorkerEnabled).toBe(false);
    }],
    ['computeLayoutViaWorker returns null on disposed engine', async () => {
      const engine = new ComplexLayoutEngine({ useWebWorkers: true });
      engine.dispose();
      const result = await testInternals(engine).computeLayoutViaWorker(createNodes(), createEdges());
      expect(result).toBeNull();
    }],
  ])('%s', (_desc, fn) => fn());
});

// ---------- Smoke test: dispose then reuse ----------

describe('Layout engine dispose-then-reuse smoke test', () => {
  it('dispose followed by generateComplexLayout falls back to main thread', async () => {
    const engine = createDisposeTestEngine();

    engine.dispose();
    expect(engine.isWorkerEnabled).toBe(false);

    const result = await engine.generateComplexLayout(
      createNodes(),
      createEdges(),
      'flowchart' as unknown as DiagramType,
    );

    expect(result).toBeDefined();
    expect(result.layout.nodes.length).toBe(3);
    expect(result.success).toBe(true);
  });

  it('double dispose then layout still works', async () => {
    const engine = createDisposeTestEngine();

    engine.dispose();
    engine.dispose();

    const result = await engine.generateComplexLayout(
      createNodes(),
      createEdges(),
      'flowchart' as unknown as DiagramType,
    );

    expect(result.layout.nodes.length).toBe(3);
  });
});

// ---------- isWorkerEnabled respects useWebWorkers config ----------

describe('Layout engine isWorkerEnabled config guard', () => {
  it('returns false when useWebWorkers is false (default)', () => {
    const engine = new ComplexLayoutEngine();
    expect(engine.isWorkerEnabled).toBe(false);
  });

  it('returns false when useWebWorkers is explicitly false', () => {
    const engine = new ComplexLayoutEngine({ useWebWorkers: false });
    expect(engine.isWorkerEnabled).toBe(false);
  });
});
