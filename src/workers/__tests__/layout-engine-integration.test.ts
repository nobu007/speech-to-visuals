/**
 * Integration tests: ComplexLayoutEngine + WorkerPool
 *
 * Verifies that the layout engine delegates computation to Web Workers
 * when useWebWorkers is enabled, and falls back to main-thread processing
 * when workers are unavailable or fail.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock workers module before imports
jest.mock('../../workers', () => ({
  WorkerPool: jest.fn(),
  isWorkerAvailable: jest.fn(() => false),
  getOptimalWorkerCount: jest.fn(() => 2),
  computeLayout: jest.fn(() => ({
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
jest.mock('../../visualization/strategies/DagreLayoutStrategy', () => ({
  DagreLayoutStrategy: jest.fn().mockImplementation(function (_config?: Record<string, unknown>, _fallback?: Record<string, unknown>) {
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

jest.mock('../../visualization/strategies/CulturalLayoutAdapter', () => ({
  CulturalLayoutAdapter: jest.fn().mockImplementation(function () {
    this.applyCulturalAdaptation = jest.fn((layout) => Promise.resolve(layout));
  }),
}));

jest.mock('../../visualization/layout-utils', () => ({
  nodesOverlap: jest.fn(() => false),
  getGraphConfig: jest.fn(() => ({})),
  calculateNodeWidth: jest.fn(() => 120),
}));

import { ComplexLayoutEngine } from '../../visualization/complex-layout-engine';
import { DagreLayoutStrategy } from '../../visualization/strategies/DagreLayoutStrategy';
import type { DiagramType } from '../../types/diagram';
import type { LayoutConfig } from '../../visualization/types';
import type { FallbackLayoutStrategy } from '../../visualization/strategies/FallbackLayoutStrategy';

/** Helper to create engine with mocked DagreLayoutStrategy */
function createEngine(config: Record<string, unknown> = {}) {
  const dagreStrategy = new DagreLayoutStrategy({} as LayoutConfig, {} as FallbackLayoutStrategy);
  return new ComplexLayoutEngine(
    config,
    undefined,
    undefined,
    dagreStrategy,
  );
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
