import { jest, describe, it, expect, beforeAll } from '@jest/globals';
import type { SceneGraph, PipelineInput, PipelineResult } from '../types';
import type { QualityAssessment } from '@/quality/quality-monitor';

/**
 * REQ-387: MainPipeline is the PRODUCER of ExtendedPipelineMetrics.memoryUsage
 * (bytes, peak). REQ-383/386 made the quality legs read the field
 * measured-only — but until this producer existed no pipeline ever populated
 * it, so both legs were permanently excluded and the contract sat dead (the
 * steering gap this closes). These tests pin the wiring through the REAL
 * createSuccessResult path:
 *
 *   - snapshots seed the peak (max, bytes verbatim),
 *   - a measured live reading is produced even with no snapshots,
 *   - a no-memory-API runtime (stv-core {heapUsed: 0}) OMITS the field —
 *     publishing 0 would score "0 bytes = excellent" in REQ-386's rubric,
 *     reopening the fabricated-always-pass door,
 *   - feeding the produced result to QualityMonitor turns the formerly-dead
 *     REQ-383/386 legs LIVE (measured 512MB → memory leg scores 0.0 / 0.5 and
 *     the 💾 recommendation fires — previously impossible on a MainPipeline
 *     result).
 *
 * The bottom of the measurement chain (@stv/core/utils/memory-usage) is
 * unstable_mockModule'd so the no-API branch — impossible against a real Node
 * backend that always reports a positive heap — is deterministic. Both of the
 * module's names are mocked: the real REQ-358 memory-backend boundary (and
 * every other transitive consumer, e.g. real-time-performance-monitor) reads
 * getMemoryUsage, while MainPipeline also imports getHeapUsed (ESM
 * mock-completeness — same trap REQ-373 documented).
 */
const mockGetMemoryUsage = jest.fn<
  () => { heapUsed: number; heapTotal: number }
>();
const mockGetHeapUsed = jest.fn<() => number>();

jest.unstable_mockModule('@stv/core/utils/memory-usage', () => ({
  getMemoryUsage: mockGetMemoryUsage,
  getHeapUsed: mockGetHeapUsed,
}));

type PipelineLike = {
  createSuccessResult: (
    scenes: SceneGraph[],
    input: PipelineInput,
    totalTime: number,
  ) => PipelineResult;
  performanceTracker: { memorySnapshots: Map<string, number> };
};

type MainPipelineCtor = new (config?: Record<string, never>) => unknown;

const MB = 1024 * 1024;

describe('MainPipeline memoryUsage producer (REQ-387: measured-only, bytes, peak)', () => {
  let pipeline: PipelineLike;

  beforeAll(async () => {
    const { MainPipeline } = (await import('../main-pipeline')) as {
      MainPipeline: MainPipelineCtor;
    };
    pipeline = new MainPipeline({}) as PipelineLike;
  });

  function buildResult(): PipelineResult {
    return pipeline.createSuccessResult([], { audioFile: 'test.wav' }, 1234);
  }

  function seedSnapshots(values: Record<string, number>): void {
    for (const [key, value] of Object.entries(values)) {
      pipeline.performanceTracker.memorySnapshots.set(key, value);
    }
  }

  it('publishes the peak snapshot (bytes verbatim) when it exceeds the live reading', () => {
    mockGetMemoryUsage.mockReturnValue({ heapUsed: 64 * MB, heapTotal: 128 * MB });
    seedSnapshots({ initial: 50 * MB, layout: 512 * MB });

    const result = buildResult();

    // Live 64MB must NOT win over the 512MB snapshot: "peak process memory
    // usage" is what the run USED, not where it ended.
    expect(result.metrics?.memoryUsage).toBe(512 * MB);
  });

  it('produces a measured live reading even with zero snapshots', () => {
    mockGetMemoryUsage.mockReturnValue({ heapUsed: 42 * MB, heapTotal: 64 * MB });
    pipeline.performanceTracker.memorySnapshots.clear();

    const result = buildResult();

    expect(result.metrics?.memoryUsage).toBe(42 * MB);
  });

  it('OMITS the field on a no-memory-API runtime ({heapUsed: 0}) — 0 is unmeasured, not excellent', () => {
    // stv-core getMemoryUsage() returns {heapUsed: 0} when the runtime exposes
    // no memory API. The REQ-358 boundary keeps that 0 finite (a real reading
    // by its contract), so the LAST line of defense is this producer: the
    // field must be absent, never 0 — REQ-386 would otherwise score the run
    // "0 bytes = excellent" (+0.3 performanceScore) on every no-API runtime.
    mockGetMemoryUsage.mockReturnValue({ heapUsed: 0, heapTotal: 0 });
    pipeline.performanceTracker.memorySnapshots.clear();

    const result = buildResult();

    expect('memoryUsage' in (result.metrics ?? {})).toBe(false);
    expect(result.metrics?.memoryUsage).toBeUndefined();
  });

  it('feeds the REQ-386 memory leg LIVE: measured 512MB scores the leg 0.0 (performanceScore 0.7, not 1.0)', async () => {
    const { QualityMonitor } = await import('@/quality/quality-monitor');
    mockGetMemoryUsage.mockReturnValue({ heapUsed: 512 * MB, heapTotal: 768 * MB });
    pipeline.performanceTracker.memorySnapshots.clear();

    // 120s content in 10s → speed 1.0; success → 1.0; measured 512MB > 256MB
    // target → memory 0.0. Leg LIVE (in denominator):
    // performanceScore = (1.0*0.4 + 0.0*0.3 + 1.0*0.3) / 1.0 = 0.7.
    // Before REQ-387 the field never existed → leg excluded → 1.0 for the
    // same 512MB run.
    const result = pipeline.createSuccessResult(
      [],
      { audioFile: 'test.wav' },
      10000,
    );

    const assessment: QualityAssessment =
      await new QualityMonitor().assessPipelineQuality({
        ...result,
        duration: 120000,
      });

    expect(assessment.performanceScore).toBeCloseTo(0.7, 10);
  });

  it('feeds the REQ-383 memory leg LIVE: measured 512MB fires the 💾 optimization recommendation', async () => {
    const { QualityMonitor } = await import('@/quality/quality-monitor');
    mockGetMemoryUsage.mockReturnValue({ heapUsed: 512 * MB, heapTotal: 768 * MB });
    pipeline.performanceTracker.memorySnapshots.clear();

    const result = buildResult();

    const assessment = await new QualityMonitor().assessPipelineQuality(result);

    // iterationMetrics: processingTime 1.0 (1234ms < 30s), errorHandling 0
    // (no stages), outputQuality 0 (no outputPath), memoryUsage 0.5 (512MB ≥
    // 256MB gate) → (1.0 + 0 + 0 + 0.5) / 4 = 37.5% and — the point — the
    // 💾 recommendation fires off a MEASURED reading. On every pre-REQ-387
    // MainPipeline result this branch was unreachable (field never present).
    const scoreMsg = assessment.improvements.find(i =>
      i.includes('Iteration Quality Score'),
    );
    expect(scoreMsg).toContain('37.5%');
    expect(assessment.recommendations.some(r => r.includes('💾'))).toBe(true);
  });

  it('a measured 128MB run keeps both legs live and healthy (memory leg 1.0, no 💾 recommendation)', async () => {
    const { QualityMonitor } = await import('@/quality/quality-monitor');
    mockGetMemoryUsage.mockReturnValue({ heapUsed: 128 * MB, heapTotal: 256 * MB });
    pipeline.performanceTracker.memorySnapshots.clear();

    const result = pipeline.createSuccessResult(
      [],
      { audioFile: 'test.wav' },
      10000,
    );

    // 120s in 10s → speed 1.0; 128MB ≤ 128MB (= 256/2) → memory 1.0; success
    // 1.0 → performanceScore 1.0 WITH the leg in the denominator (the same
    // run with the leg excluded would also be 1.0 — this pin guards the
    // healthy side against regressing into a fabricated 0 score).
    const assessment = await new QualityMonitor().assessPipelineQuality({
      ...result,
      duration: 120000,
    });

    expect(assessment.performanceScore).toBeCloseTo(1, 10);
    expect(assessment.recommendations.some(r => r.includes('💾'))).toBe(false);
  });
});
