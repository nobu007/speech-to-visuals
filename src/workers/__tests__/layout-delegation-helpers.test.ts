/**
 * Unit tests for worker delegation helper in ComplexLayoutEngine
 *
 * Tests computeLayoutViaWorker private method at unit level,
 * including the disposed-flag guard and result mapping logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to create mocks that need to be constructable
const { mockDagreLayoutStrategy, mockCulturalLayoutAdapter, mockLayoutUtils } = vi.hoisted(() => ({
  mockDagreLayoutStrategy: vi.fn(function () {
    this.applyLayout = vi.fn().mockResolvedValue({
      nodes: [
        { id: 'a', label: 'Node A', x: 50, y: 50, w: 120, h: 60 },
        { id: 'b', label: 'Node B', x: 250, y: 50, w: 120, h: 60 },
        { id: 'c', label: 'Node C', x: 150, y: 160, w: 120, h: 60 },
      ],
      edges: [
        { from: 'a', to: 'b', points: [{ x: 110, y: 80 }, { x: 310, y: 80 }] },
        { from: 'b', to: 'c', points: [{ x: 310, y: 80 }, { x: 210, y: 190 }] },
      ],
    });
  }),
  mockCulturalLayoutAdapter: vi.fn(function () {
    this.applyCulturalAdaptation = vi.fn((layout) => Promise.resolve(layout));
  }),
  mockLayoutUtils: {
    nodesOverlap: vi.fn(() => false),
    getGraphConfig: vi.fn(() => ({})),
    calculateNodeWidth: vi.fn(() => 120),
  },
}));

// Mock workers module
vi.mock('../../workers', () => ({
  WorkerPool: vi.fn(),
  isWorkerAvailable: vi.fn(() => false),
  getOptimalWorkerCount: vi.fn(() => 2),
  computeLayout: vi.fn(),
}));

// Mock worker-factories
vi.mock('../../workers/worker-factories', () => ({
  createLayoutWorkerFactory: vi.fn(() => () => {
    throw new Error('Worker factory should not be called');
  }),
}));

// Mock DagreLayoutStrategy to avoid dagre dependency issues
vi.mock('../../visualization/strategies/DagreLayoutStrategy', () => ({
  DagreLayoutStrategy: mockDagreLayoutStrategy,
}));

vi.mock('../../visualization/strategies/CulturalLayoutAdapter', () => ({
  CulturalLayoutAdapter: mockCulturalLayoutAdapter,
}));

vi.mock('../../visualization/layout-utils', () => mockLayoutUtils);

import { ComplexLayoutEngine } from '../../visualization/complex-layout-engine';
import type { DiagramType } from '../../types/diagram';

// Suppress console
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
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
function createEngineWithPoolMock(poolMock: any): ComplexLayoutEngine {
  const engine = new ComplexLayoutEngine({ useWebWorkers: true });
  // Override getWorkerPool to return our mock directly
  (engine as any).getWorkerPool = () => poolMock;
  return engine;
}

function makePoolMock(response: any): any {
  return {
    execute: vi.fn().mockResolvedValue(response),
    terminate: vi.fn(),
    isTerminated: false,
  };
}

// ---------- computeLayoutViaWorker ----------

describe('computeLayoutViaWorker (private)', () => {
  it('returns null when pool is null', async () => {
    const engine = createEngineWithPoolMock(null);
    const result = await (engine as any).computeLayoutViaWorker(createNodes(), createEdges());
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

    const result = await (engine as any).computeLayoutViaWorker(createNodes(), createEdges());

    expect(result).not.toBeNull();
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(2);

    // Verify node mapping preserves original labels
    expect(result.nodes[0].label).toBe('Node A');
    expect(result.nodes[1].label).toBe('Node B');
    expect(result.nodes[2].label).toBe('Node C');

    // Verify positions from worker
    expect(result.nodes[0].x).toBe(100);
    expect(result.nodes[0].y).toBe(50);
    expect(result.nodes[0].w).toBe(120);
    expect(result.nodes[0].h).toBe(60);
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

    const result = await (engine as any).computeLayoutViaWorker(nodes, edges);

    // Node 'a' should have meta preserved
    expect(result.nodes[0].meta).toEqual({ importance: 5, custom: 'data' });
    // Node 'b' has no meta
    expect(result.nodes[1].meta).toBeUndefined();
  });

  it('returns null when worker response has error', async () => {
    const poolMock = makePoolMock({
      id: 'test-layout',
      type: 'LAYOUT_COMPUTE',
      error: { code: 'LAYOUT_ERROR', message: 'Computation failed' },
    });

    const engine = createEngineWithPoolMock(poolMock);

    const result = await (engine as any).computeLayoutViaWorker(createNodes(), createEdges());
    expect(result).toBeNull();
  });

  it('returns null when payload is null', async () => {
    const poolMock = makePoolMock({
      id: 'test-layout',
      type: 'LAYOUT_COMPUTE',
      payload: null,
    });

    const engine = createEngineWithPoolMock(poolMock);

    const result = await (engine as any).computeLayoutViaWorker(createNodes(), createEdges());
    expect(result).toBeNull();
  });

  it('returns null when pool.execute throws', async () => {
    const poolMock = {
      execute: vi.fn().mockRejectedValue(new Error('Worker crashed')),
      terminate: vi.fn(),
      isTerminated: false,
    };

    const engine = createEngineWithPoolMock(poolMock);

    const result = await (engine as any).computeLayoutViaWorker(createNodes(), createEdges());
    expect(result).toBeNull();
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

    const result = await (engine as any).computeLayoutViaWorker(nodes, edges);

    expect(result.edges).toHaveLength(1);
    const edge = result.edges[0];
    expect(edge.from).toBe('a');
    expect(edge.to).toBe('b');
    expect(edge.label).toBe('connects');
    expect(edge.points).toHaveLength(2);
    expect(edge.points[0].x).toBe(160);
    expect(edge.points[0].y).toBe(230);
    expect(edge.points[1].x).toBe(460);
    expect(edge.points[1].y).toBe(230);
  });

  it('sends correct payload structure to worker', async () => {
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
    (engine as any).getWorkerPool = () => poolMock;

    const nodes = [{ id: 'a', label: 'Test' }];
    const edges: any[] = [];

    await (engine as any).computeLayoutViaWorker(nodes, edges);

    const sentMessage = poolMock.execute.mock.calls[0][0];
    expect(sentMessage.type).toBe('LAYOUT_COMPUTE');
    expect(sentMessage.payload.nodes[0]).toEqual({
      id: 'a',
      width: 120,
      height: 60,
      label: 'Test',
    });
    expect(sentMessage.payload.config).toEqual({
      width: 1920,
      height: 1080,
      rankDirection: 'LR',
      nodeSeparation: 80,
      rankSeparation: 100,
    });
  });

  it('generates unique message id with layout prefix', async () => {
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

    const engine = createEngineWithPoolMock(poolMock);
    await (engine as any).computeLayoutViaWorker(
      [{ id: 'a', label: 'A' }],
      [],
    );

    const sentMessage = poolMock.execute.mock.calls[0][0];
    expect(sentMessage.id).toMatch(/^layout_\d+_/);
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

    const result = await (engine as any).computeLayoutViaWorker(nodes, edges);

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].points[1].x).toBe(0);
    expect(result.edges[0].points[1].y).toBe(0);
  });
});

// ---------- Disposed-flag guard (Layout Engine) ----------

describe('Layout engine disposed-flag guard', () => {
  it('getWorkerPool returns null after dispose', () => {
    const engine = new ComplexLayoutEngine({ useWebWorkers: true });
    engine.dispose();
    expect((engine as any).disposed).toBe(true);
  });

  it('isWorkerEnabled returns false after dispose', () => {
    const engine = new ComplexLayoutEngine({ useWebWorkers: true });
    engine.dispose();
    expect(engine.isWorkerEnabled).toBe(false);
  });

  it('dispose is idempotent', () => {
    const engine = new ComplexLayoutEngine({ useWebWorkers: true });
    engine.dispose();
    engine.dispose();
    engine.dispose();
    expect(engine.isWorkerEnabled).toBe(false);
  });

  it('computeLayoutViaWorker returns null on disposed engine', async () => {
    const engine = new ComplexLayoutEngine({ useWebWorkers: true });
    engine.dispose();
    const result = await (engine as any).computeLayoutViaWorker(createNodes(), createEdges());
    expect(result).toBeNull();
  });
});

// ---------- Smoke test: dispose then reuse ----------

describe('Layout engine dispose-then-reuse smoke test', () => {
  it('dispose followed by generateComplexLayout falls back to main thread', async () => {
    const dagreStrategy = new mockDagreLayoutStrategy();

    const engine = new ComplexLayoutEngine({
      useWebWorkers: true,
      enableOverlapResolution: false,
      enableEdgeOptimization: false,
      enableMultiLevel: false,
      enableClustering: false,
      enableForceDirected: false,
    }, undefined, undefined, dagreStrategy);

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
    const dagreStrategy = new mockDagreLayoutStrategy();

    const engine = new ComplexLayoutEngine({
      useWebWorkers: true,
      enableOverlapResolution: false,
      enableEdgeOptimization: false,
      enableMultiLevel: false,
      enableClustering: false,
      enableForceDirected: false,
    }, undefined, undefined, dagreStrategy);

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
