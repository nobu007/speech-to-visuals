/**
 * Regression: ComplexLayoutEngine drops LayoutResult.confidence.
 *
 * LayoutEngine.generateLayout routes >=20-node diagrams to ComplexLayoutEngine,
 * which returns a LayoutResult WITHOUT `confidence` (the canonical
 * _logAndEvaluateLayout path is the only producer that sets it, via
 * calculateLayoutConfidence). Downstream SimplePipeline consumers then
 * default-mask the missing field — layoutQuality is a constant 0.8 for every
 * large diagram and scene.confidence can never drop below detection
 * confidence (simple-pipeline.ts:296 uses `|| 0`, :340 uses `?? 1`). Same DROPS
 * class as the scene.confidence fix (e0f269af), on the layout-producer side.
 *
 * The fix routes the complex result back through the shared confidence +
 * compliance evaluation so large diagrams get a real, quality-derived
 * confidence. Here ComplexLayoutEngine is mocked to return a confidence-less
 * result, isolating the LayoutEngine dispatch-layer responsibility.
 */
import { jest } from '@jest/globals';
import type { DiagramType } from '@stv/core/types/diagram';

const mockGenerateComplexLayout = jest.fn();

jest.unstable_mockModule('@/visualization/complex-layout-engine', () => {
  // Regular function so `this` is the constructed instance, matching how
  // LayoutEngine instantiates it via `new ComplexLayoutEngine(...)`.
  function MockComplexEngine(this: any) {
    this.generateComplexLayout = mockGenerateComplexLayout;
    this.dispose = jest.fn();
    this.isWorkerEnabled = false;
  }
  return { default: MockComplexEngine, ComplexLayoutEngine: MockComplexEngine };
});

const { LayoutEngine } = await import('@/visualization/layout-engine');

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockGenerateComplexLayout.mockReset();
});
afterEach(() => {
  jest.restoreAllMocks();
});

/** 20 input NodeDatum — just enough (ids) to trip the >=20-node complex dispatch. */
const inputNodes = Array.from({ length: 20 }, (_, i) => ({
  id: `n${i}`,
  label: `Node ${i}`,
  meta: { importance: 1 },
}));
const inputEdges = Array.from({ length: 19 }, (_, i) => ({
  from: `n${i}`,
  to: `n${i + 1}`,
  label: `e${i}`,
}));

/** Build the complex-engine LayoutResult shape. NOTE: no `confidence` — the bug. */
function complexResult(
  nodes: Array<{ id: string; x: number; y: number; w: number; h: number }>,
) {
  return {
    layout: {
      nodes,
      edges: inputEdges.map((e) => ({ from: e.from, to: e.to, points: [] })),
    },
    bounds: { width: 2000, height: 2000, minX: 0, minY: 0, maxX: 2000, maxY: 2000 },
    processingTime: 100,
    success: true,
  };
}

// Clean: nodes spread on a grid -> zero overlaps -> high confidence.
const cleanNodes = inputNodes.map((n, i) => ({
  id: n.id,
  x: (i % 5) * 400,
  y: Math.floor(i / 5) * 400,
  w: 120,
  h: 60,
}));
// Stacked: every node at the same point -> heavy overlaps -> low confidence.
const stackedNodes = inputNodes.map((n) => ({
  id: n.id,
  x: 0,
  y: 0,
  w: 120,
  h: 60,
}));

const callGenerate = (engine: InstanceType<typeof LayoutEngine>) =>
  engine.generateLayout(
    inputNodes as any,
    inputEdges as any,
    'flowchart' as unknown as DiagramType,
    1,
  );

describe('LayoutEngine complex-path confidence (LayoutResult.confidence DROPS)', () => {
  it('attaches a real confidence to >=20-node (complex) layouts', async () => {
    mockGenerateComplexLayout.mockResolvedValue(complexResult(cleanNodes));

    const engine = new LayoutEngine({ useWebWorkers: false });
    const result = await callGenerate(engine);

    expect(mockGenerateComplexLayout).toHaveBeenCalledTimes(1); // reached complex dispatch
    expect(result.success).toBe(true);
    expect(typeof result.confidence).toBe('number');
    expect(Number.isFinite(result.confidence)).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('confidence reflects actual layout quality, not a constant (overlaps lower it)', async () => {
    mockGenerateComplexLayout
      .mockResolvedValueOnce(complexResult(cleanNodes))
      .mockResolvedValueOnce(complexResult(stackedNodes));

    const engine = new LayoutEngine({ useWebWorkers: false });
    const clean = await callGenerate(engine);
    const stacked = await callGenerate(engine);

    expect(clean.confidence).toBeGreaterThan(stacked.confidence);
  });

  it('returns a failed complex result as-is (no confidence synthesis on failure)', async () => {
    const failed = {
      layout: { nodes: [], edges: [] },
      bounds: { width: 0, height: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 },
      processingTime: 50,
      success: false,
      error: 'boom',
    };
    mockGenerateComplexLayout.mockResolvedValue(failed);

    const engine = new LayoutEngine({ useWebWorkers: false });
    const result = await callGenerate(engine);

    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
  });
});
