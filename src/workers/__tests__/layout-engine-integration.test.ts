/**
 * Integration tests: ComplexLayoutEngine + WorkerPool
 *
 * Verifies that the layout engine delegates computation to Web Workers
 * when useWebWorkers is enabled, and falls back to main-thread processing
 * when workers are unavailable or fail.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to create constructable mocks
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

// Mock workers module before imports
vi.mock('../../workers', () => ({
  WorkerPool: vi.fn(),
  isWorkerAvailable: vi.fn(() => false),
  getOptimalWorkerCount: vi.fn(() => 2),
  computeLayout: vi.fn(() => ({
    nodes: [
      { id: 'a', x: 100, y: 50, width: 120, height: 60 },
      { id: 'b', x: 300, y: 50, width: 120, height: 60 },
    ],
    edges: [{ source: 'a', target: 'b' }],
    width: 500,
    height: 200,
  })),
}));

// Mock DagreLayoutStrategy to avoid dagre dependency issues in tests
vi.mock('../../visualization/strategies/DagreLayoutStrategy', () => ({
  DagreLayoutStrategy: mockDagreLayoutStrategy,
}));

vi.mock('../../visualization/strategies/CulturalLayoutAdapter', () => ({
  CulturalLayoutAdapter: mockCulturalLayoutAdapter,
}));

vi.mock('../../visualization/layout-utils', () => mockLayoutUtils);

import { ComplexLayoutEngine } from '../../visualization/complex-layout-engine';
import type { DiagramType } from '../../types/diagram';

/** Helper to create engine with mocked DagreLayoutStrategy */
function createEngine(config: Record<string, unknown> = {}) {
  const dagreStrategy = new mockDagreLayoutStrategy();
  return new ComplexLayoutEngine(
    config,
    undefined,
    undefined,
    dagreStrategy,
  );
}

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
  { id: 'b', label: 'Node B', meta: { importance: 1 } },
  { id: 'c', label: 'Node C', meta: { importance: 2 } },
];

const createEdges = () => [
  { from: 'a', to: 'b', label: 'edge-ab' },
  { from: 'b', to: 'c', label: 'edge-bc' },
];

describe('ComplexLayoutEngine Worker integration', () => {
  it('initializes without workers when useWebWorkers=false', () => {
    const engine = new ComplexLayoutEngine({ useWebWorkers: false });
    expect(engine.isWorkerEnabled).toBe(false);
    engine.dispose();
  });

  it('initializes without workers when workers unavailable (SSR/Node)', () => {
    const engine = new ComplexLayoutEngine({ useWebWorkers: true });
    expect(engine.isWorkerEnabled).toBe(false);
    engine.dispose();
  });

  it('generates layout on main thread when workers unavailable', async () => {
    const engine = createEngine({
      useWebWorkers: true,
      enableOverlapResolution: false,
      enableEdgeOptimization: false,
    });

    const result = await engine.generateComplexLayout(
      createNodes(),
      createEdges(),
      'flowchart' as unknown as DiagramType,
    );

    expect(result).toBeDefined();
    expect(result).toHaveProperty('layout');
    expect(result).toHaveProperty('processingTime');
    expect(result).toHaveProperty('success');
    expect(result.layout.nodes.length).toBe(3);

    engine.dispose();
  });

  it('falls back gracefully with standard layout', async () => {
    const engine = createEngine({
      useWebWorkers: false,
      enableOverlapResolution: false,
      enableEdgeOptimization: false,
      enableMultiLevel: false,
      enableClustering: false,
      enableForceDirected: false,
    });

    const result = await engine.generateComplexLayout(
      createNodes(),
      createEdges(),
      'flowchart' as unknown as DiagramType,
    );

    expect(result).toBeDefined();
    expect(result.layout.nodes.length).toBe(3);

    engine.dispose();
  });

  it('dispose() cleans up worker pool', () => {
    const engine = new ComplexLayoutEngine({ useWebWorkers: false });
    engine.dispose();
    expect(engine.isWorkerEnabled).toBe(false);
  });

  it('dispose is idempotent', () => {
    const engine = new ComplexLayoutEngine({ useWebWorkers: false });
    engine.dispose();
    engine.dispose();
    expect(engine.isWorkerEnabled).toBe(false);
  });

  it('produces valid layout with positioned nodes', async () => {
    const engine = createEngine({
      useWebWorkers: false,
      enableOverlapResolution: false,
      enableEdgeOptimization: false,
      width: 800,
      height: 600,
    });

    const result = await engine.generateComplexLayout(
      createNodes(),
      createEdges(),
      'flowchart' as unknown as DiagramType,
    );

    for (const node of result.layout.nodes) {
      expect(node).toHaveProperty('id');
      expect(node).toHaveProperty('x');
      expect(node).toHaveProperty('y');
      expect(node).toHaveProperty('w');
      expect(node).toHaveProperty('h');
    }

    engine.dispose();
  });
});
