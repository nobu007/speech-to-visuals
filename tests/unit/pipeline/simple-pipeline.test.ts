/**
 * Unit tests for SimplePipeline (src/pipeline/simple-pipeline.ts)
 *
 * Covers: constructor, getCapabilities, getProgressiveMetrics,
 * and the private calculateQualityScore method accessed via internals() helper.
 */

import { SimplePipeline, simplePipeline } from '@/pipeline/simple-pipeline';
import { getQualityMonitor } from '@/pipeline/quality-monitor';
import { realTimeMonitor } from '@/monitoring/real-time-performance-monitor';
import { continuousLearner } from '@/framework/continuous-learner';
import { DISCLOSED_PLACEHOLDER_TRANSCRIPTION_ACCURACY } from '@/pipeline/quality-estimators';
import type { ChainOutcome } from '@/quality/recovery-strategy-chain';
import type { SceneGraph } from '@stv/core/types/diagram';

/** Minimal ChainOutcome fixture pinned to one winning step (REQ-430 wiring legs). */
function recoveryOutcomeAt(winningStepId: string | null): ChainOutcome {
  return {
    success: winningStepId !== null,
    winningStepId,
    fallbackUsed: winningStepId === 'disclosed-placeholder',
    confidence: 0,
    stepsAttempted: 3,
    stepsSkipped: 0,
    trace: [],
    totalDurationMs: 0,
    stage: 'transcription',
  };
}

// ---------------------------------------------------------------------------
// Mocks – must come before the import above is evaluated by ts-jest
// ---------------------------------------------------------------------------

jest.mock('@/transcription', () => ({
  TranscriptionPipeline: jest.fn().mockImplementation(() => ({
    transcribe: jest.fn(),
    updateConfig: jest.fn(),
  })),
}));

jest.mock('@/analysis', () => ({
  SceneSegmenter: jest.fn().mockImplementation(() => ({
    segment: jest.fn(),
  })),
  DiagramDetector: jest.fn().mockImplementation(() => ({
    analyze: jest.fn(),
  })),
}));

jest.mock('@/visualization', () => ({
  LayoutEngine: jest.fn().mockImplementation(() => ({
    generateLayout: jest.fn(),
  })),
}));

jest.mock('@/visualization/enhanced-zero-overlap-layout', () => ({
  EnhancedZeroOverlapLayoutEngine: jest.fn().mockImplementation(() => ({
    generateZeroOverlapLayout: jest.fn(),
  })),
}));

jest.mock('@/pipeline/video-generator', () => ({
  VideoGenerator: jest.fn().mockImplementation(() => ({
    generateVideo: jest.fn(),
  })),
}));

jest.mock('@/framework/continuous-learner', () => ({
  continuousLearner: {
    learnFromProcessingResult: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/pipeline/quality-monitor', () => ({
  getQualityMonitor: jest.fn().mockReturnValue({
    setPhaseIteration: jest.fn(),
    recordMetrics: jest.fn(),
    generateReport: jest.fn().mockReturnValue({ recommendations: [] }),
    logIteration: jest.fn(),
    getLatestMetrics: jest.fn().mockReturnValue({}),
  }),
  formatQualityReport: jest.fn().mockReturnValue(''),
}));

jest.mock('@stv/core/utils/memory-usage', () => ({
  getHeapUsed: jest.fn().mockReturnValue(0),
}));

jest.mock('@/quality/error-classifier', () => ({
  ErrorClassifier: jest.fn().mockImplementation(() => ({
    classify: jest.fn().mockReturnValue({
      type: 'unknown',
      severity: 'low',
      recoverable: true,
      userMessage: 'Test error',
      suggestedAction: 'Retry',
    }),
  })),
}));

jest.mock('@/pipeline/pipeline-errors', () => ({
  TranscriptionError: class extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'TranscriptionError';
    }
  },
  SegmentationError: class extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'SegmentationError';
    }
  },
}));

jest.mock('@/pipeline/retry', () => ({
  retryWithBackoff: jest.fn((fn: () => Promise<unknown>) =>
    fn().then((result: unknown) => ({ result, attempts: 0 })),
  ),
}));

jest.mock('@stv/core/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Types for accessing private members in tests
// ---------------------------------------------------------------------------

/** Parameter type for SimplePipeline.calculateQualityScore (private method). */
interface QualityScoreInput {
  transcript?: string;
  scenes?: SceneGraph[];
  processingTime: number;
  videoUrl?: string;
}

/** Shape of a single performance-history entry. */
interface PerformanceHistoryEntry {
  timestamp: string;
  processingTime: number;
  success: boolean;
  qualityScore?: number;
}

/** Exposes private members of SimplePipeline for test assertions. */
interface SimplePipelineInternals {
  calculateQualityScore(input: QualityScoreInput): number;
  performanceHistory: PerformanceHistoryEntry[];
}

/** Type assertion helper to access private members without `any`. */
function internals(p: SimplePipeline): SimplePipelineInternals {
  return p as unknown as SimplePipelineInternals;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a fresh SimplePipeline instance (no shared state). */
function createPipeline(): SimplePipeline {
  return new SimplePipeline();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SimplePipeline', () => {
  // -----------------------------------------------------------------------
  // 1. Constructor
  // -----------------------------------------------------------------------

  describe('constructor', () => {
    it('creates an instance of SimplePipeline', () => {
      const pipeline = createPipeline();
      expect(pipeline).toBeInstanceOf(SimplePipeline);
    });

    it('exports a singleton instance', () => {
      expect(simplePipeline).toBeInstanceOf(SimplePipeline);
    });
  });

  // -----------------------------------------------------------------------
  // 2–4. getCapabilities
  // -----------------------------------------------------------------------

  describe('getCapabilities', () => {
    let pipeline: SimplePipeline;

    beforeEach(() => {
      pipeline = createPipeline();
    });

    it('returns expected top-level structure with transcription, analysis, visualization, progressiveEnhancement', () => {
      const caps = pipeline.getCapabilities();
      expect(caps).toHaveProperty('transcription');
      expect(caps).toHaveProperty('analysis');
      expect(caps).toHaveProperty('visualization');
      expect(caps).toHaveProperty('progressiveEnhancement');
    });

    it('includes supported formats in transcription', () => {
      const caps = pipeline.getCapabilities();
      expect(caps.transcription).toHaveProperty('supportedFormats');
      expect(Array.isArray(caps.transcription.supportedFormats)).toBe(true);
      expect(caps.transcription.supportedFormats).toContain('mp3');
      expect(caps.transcription.supportedFormats).toContain('wav');
    });
  });

  // -----------------------------------------------------------------------
  // 5–8. getProgressiveMetrics – initial state
  // -----------------------------------------------------------------------

  describe('getProgressiveMetrics (initial state)', () => {
    let pipeline: SimplePipeline;

    beforeEach(() => {
      pipeline = createPipeline();
    });

    it('returns object with expected keys', () => {
      const metrics = pipeline.getProgressiveMetrics();
      expect(metrics).toHaveProperty('iterationCount');
      expect(metrics).toHaveProperty('qualityMetrics');
      expect(metrics).toHaveProperty('performanceHistory');
      expect(metrics).toHaveProperty('averageQuality');
      expect(metrics).toHaveProperty('successRate');
    });

    it('has iterationCount 0 initially', () => {
      const metrics = pipeline.getProgressiveMetrics();
      expect(metrics.iterationCount).toBe(0);
    });

    it('has empty performanceHistory initially', () => {
      const metrics = pipeline.getProgressiveMetrics();
      expect(metrics.performanceHistory).toEqual([]);
    });

    it('has averageQuality 0 initially', () => {
      const metrics = pipeline.getProgressiveMetrics();
      expect(metrics.averageQuality).toBe(0);
    });

    it('has successRate 0 initially', () => {
      const metrics = pipeline.getProgressiveMetrics();
      expect(metrics.successRate).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // 9–18, 20. calculateQualityScore (private, accessed via internals())
  // -----------------------------------------------------------------------

  describe('calculateQualityScore (private)', () => {
    let pipeline: SimplePipeline;

    beforeEach(() => {
      pipeline = createPipeline();
    });

    it('returns 0 for empty result (no transcript, no scenes, no video, long processingTime)', () => {
      const score = internals(pipeline).calculateQualityScore({
        processingTime: 30_000, // 30 seconds
      });
      expect(score).toBe(0);
    });

    it('adds transcript quality proportionally', () => {
      // 50 chars => 50/100 = 0.5 => 0.5 * 30 = 15
      const score = internals(pipeline).calculateQualityScore({
        transcript: 'a'.repeat(50),
        processingTime: 30_000,
      });
      // performance score is 0 (>20s), no video, no scenes
      expect(score).toBeCloseTo(15, 1);
    });

    it('maxes transcript score at 30 for 100+ chars', () => {
      const score = internals(pipeline).calculateQualityScore({
        transcript: 'a'.repeat(200),
        processingTime: 30_000,
      });
      // performance score is 0, no video, no scenes => only transcript
      expect(score).toBeCloseTo(30, 1);
    });

    it('adds scene detection quality based on confidence', () => {
      const scenes: SceneGraph[] = [
        {
          type: 'flow',
          nodes: [],
          edges: [],
          confidence: 0.8,
        } as unknown as SceneGraph,
      ];
      const score = internals(pipeline).calculateQualityScore({
        scenes,
        processingTime: 30_000,
      });
      // avgConfidence = 0.8 => 0.8 * 30 = 24, performance = 0, no transcript/video
      expect(score).toBeCloseTo(24, 1);
    });

    it('adds performance score for fast processing', () => {
      // processingTime = 5000ms => 5s => 20 - 5 = 15
      const score = internals(pipeline).calculateQualityScore({
        processingTime: 5_000,
      });
      expect(score).toBeCloseTo(15, 1);
    });

    it('adds 0 for slow processing (>20s)', () => {
      // processingTime = 25000ms => 25s => max(0, 20 - 25) = 0
      const score = internals(pipeline).calculateQualityScore({
        processingTime: 25_000,
      });
      expect(score).toBe(0);
    });

    it('adds 20 for videoUrl presence', () => {
      const score = internals(pipeline).calculateQualityScore({
        processingTime: 30_000,
        videoUrl: 'https://example.com/video.mp4',
      });
      expect(score).toBeCloseTo(20, 1);
    });

    it('caps total at 100', () => {
      const scenes: SceneGraph[] = [
        { type: 'flow', nodes: [], edges: [], confidence: 1.0 } as unknown as SceneGraph,
        { type: 'flow', nodes: [], edges: [], confidence: 1.0 } as unknown as SceneGraph,
      ];
      const score = internals(pipeline).calculateQualityScore({
        transcript: 'a'.repeat(200),          // 30
        scenes,                                // 1.0 * 30 = 30
        processingTime: 0,                     // 20
        videoUrl: 'https://example.com/v.mp4', // 20
      });
      // 30 + 30 + 20 + 20 = 100, should be capped at 100
      expect(score).toBe(100);
    });

    it('handles missing scene confidence (defaults to 0)', () => {
      const scenes: SceneGraph[] = [
        { type: 'flow', nodes: [], edges: [] } as unknown as SceneGraph,
      ];
      const score = internals(pipeline).calculateQualityScore({
        scenes,
        processingTime: 30_000,
      });
      // avgConfidence = (0) / 1 = 0 => scene score = 0
      expect(score).toBe(0);
    });

    it('calculates average confidence correctly for multiple scenes', () => {
      const scenes: SceneGraph[] = [
        { type: 'flow', nodes: [], edges: [], confidence: 0.6 } as unknown as SceneGraph,
        { type: 'flow', nodes: [], edges: [], confidence: 0.8 } as unknown as SceneGraph,
        { type: 'flow', nodes: [], edges: [], confidence: 1.0 } as unknown as SceneGraph,
      ];
      const score = internals(pipeline).calculateQualityScore({
        scenes,
        processingTime: 30_000,
      });
      // avgConfidence = (0.6 + 0.8 + 1.0) / 3 = 0.8 => 0.8 * 30 = 24
      expect(score).toBeCloseTo(24, 1);
    });

    it('with all components gives high score', () => {
      const scenes: SceneGraph[] = [
        { type: 'flow', nodes: [], edges: [], confidence: 0.9 } as unknown as SceneGraph,
      ];
      const score = internals(pipeline).calculateQualityScore({
        transcript: 'a'.repeat(150),            // 30 (capped)
        scenes,                                  // 0.9 * 30 = 27
        processingTime: 1_000,                   // 20 - 1 = 19
        videoUrl: 'https://example.com/v.mp4',  // 20
      });
      // 30 + 27 + 19 + 20 = 96
      expect(score).toBeCloseTo(96, 1);
    });
  });

  // -----------------------------------------------------------------------
  // 19. Performance history tracking
  // -----------------------------------------------------------------------

  describe('performanceHistory', () => {
    it('starts empty after construction', () => {
      const pipeline = createPipeline();
      const history = internals(pipeline).performanceHistory;
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBe(0);
    });

    it('is capped at MAX_HISTORY (100 entries)', () => {
      const pipeline = createPipeline();

      // Push 101 entries to exceed the cap
      const history = internals(pipeline).performanceHistory;
      for (let i = 0; i < 101; i++) {
        history.push({
          timestamp: new Date().toISOString(),
          processingTime: 1000,
          success: true,
          qualityScore: 50,
        });
      }

      // Simulate the trim that happens in the process() method
      const MAX_HISTORY = (SimplePipeline as unknown as { MAX_HISTORY: number }).MAX_HISTORY;
      if (history.length > MAX_HISTORY) {
        internals(pipeline).performanceHistory = history.slice(-MAX_HISTORY);
      }

      expect(internals(pipeline).performanceHistory.length).toBe(100);
    });
  });
});

// ---------------------------------------------------------------------------
// Transcription config wiring (REQ-043)
//
// Sibling of the orchestrator→transcriber sync (REQ-041): SimplePipeline
// constructs the transcriber ONCE in its constructor with fixed defaults
// (`{ model: 'base' }`). `input.options.language` is advertised on the public
// SimplePipelineInput type but — without a sync before transcribe() — never
// reached the transcriber, making a user language override a silent no-op.
// These witnesses pin that the resolved language now reaches the transcriber
// before Stage 1 transcription.
// ---------------------------------------------------------------------------

describe('SimplePipeline — transcription language wiring (REQ-043)', () => {
  /** Grab the mocked transcriber instance off the pipeline to spy on updateConfig. */
  function getTranscription(p: SimplePipeline): { updateConfig: (...a: unknown[]) => void } {
    return (p as unknown as {
      transcription: { updateConfig: (...a: unknown[]) => void };
    }).transcription;
  }

  /** A minimal audio File sufficient to reach the transcription stage. */
  function audioFile(): File {
    return new File(['audio-bytes'], 'speech.wav', { type: 'audio/wav' });
  }

  it('syncs a user-provided options.language to the transcriber before transcribe', async () => {
    const pipeline = createPipeline();
    const updateSpy = jest.spyOn(getTranscription(pipeline), 'updateConfig');

    // process() resolves (with success:false) even when the mocked transcriber
    // returns no segments — the sync runs before transcribe(), so the spy is
    // invoked regardless of the downstream failure.
    await pipeline.process({ audioFile: audioFile(), options: { language: 'ja' } });

    // The transcriber must receive the user's language. Previously the
    // transcriber was constructed once with `{ model: 'base' }` and
    // options.language (advertised on SimplePipelineInput) was dead.
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ language: 'ja' }));
  });

  it('does not push a language override when the caller omits options.language', async () => {
    const pipeline = createPipeline();
    const updateSpy = jest.spyOn(getTranscription(pipeline), 'updateConfig');

    await pipeline.process({ audioFile: audioFile() });

    // No language override → the transcriber keeps its construction-time
    // default; updateConfig is not invoked for transcription at all.
    expect(updateSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Phase 27 quality-metrics delegation (Phase 172 / TASK-0258)
//
// The success-path recordMetrics values come from the canonical estimators in
// quality-estimators (single source shared with MainPipeline /
// FrameworkIntegratedPipeline), not inline constants. The previous fabricated
// trio — `transcript.length > 0 ? 0.9 : 0`, `scenes.length > 0 ? 0.85 : 0`,
// and the ASSERTED `layoutOverlap: 0` ("guaranteed by enhanced layout
// engine") — equal-or-exceeded every QualityMonitor threshold on each
// success, so three gates were permanently green. The witnesses below use
// fixtures where each canonical value DIFFERS from its fabricated
// predecessor, so re-injecting any one of the constants fails exactly one
// assertion (the MW-040 mutation set).
// ---------------------------------------------------------------------------

describe('SimplePipeline — Phase 27 quality metrics delegate to canonical estimators', () => {
  // This suite runs against the REAL collaborator modules (in this ESM setup
  // jest.mock cannot intercept imports), so the four stage collaborators are
  // stubbed per-run with jest.spyOn on the freshly constructed pipeline's own
  // instances — the same technique the REQ-043 wiring tests above use — and
  // the Phase 27 QualityMonitor singleton's recordMetrics is spied to observe
  // the exact payload process() reports.
  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Collaborator instance handles on the (freshly constructed) pipeline. */
  function collaborators(p: SimplePipeline): {
    transcription: { transcribe: (...a: unknown[]) => Promise<unknown> };
    segmenter: { segment: (...a: unknown[]) => Promise<unknown> };
    detector: { analyze: (...a: unknown[]) => Promise<unknown> };
    layoutEngine: { generateLayout: (...a: unknown[]) => Promise<unknown> };
  } {
    return p as unknown as ReturnType<typeof collaborators>;
  }

  /** Spy on the singleton QualityMonitor's recordMetrics (calls through). */
  function recordMetricsSpy(): jest.MockInstance<void, unknown[]> {
    const monitor = getQualityMonitor() as unknown as {
      recordMetrics: (...args: unknown[]) => void;
    };
    return jest.spyOn(monitor, 'recordMetrics');
  }

  /**
   * Spy on the real-time monitor singleton's recordPipelineQuality (calls
   * through) — the REQ-373 producer wiring target.
   */
  function recordPipelineQualitySpy(): jest.MockInstance<void, [number, number]> {
    return jest.spyOn(realTimeMonitor, 'recordPipelineQuality');
  }

  /** Drive process() through a full success path; returns the two spies. */
  async function runSuccessPath(fixture: {
    segmentTexts: string[];
    segmentMs: number;
    layoutNodes: Array<Record<string, unknown>>;
    /** Per-segment transcription confidences (default: uniform 0.9). */
    segmentConfidences?: number[];
    /** Confidence the segmenter stamps on each ContentSegment (default: none). */
    contentConfidence?: number;
    /**
     * REQ-430: stub the transcription collaborator's recovery outcome
     * (getRecoveryOutcome) instead of its real null default. Undefined →
     * no stub (pre-first-run state, no penalty).
     */
    transcriptionRecoveryOutcome?: ChainOutcome;
  }): Promise<{
    recordMetrics: jest.MockInstance<void, unknown[]>;
    recordPipelineQuality: jest.MockInstance<void, [number, number]>;
  }> {
    const pipeline = createPipeline();
    const cols = collaborators(pipeline);

    if (fixture.transcriptionRecoveryOutcome !== undefined) {
      jest
        .spyOn(
          cols.transcription as unknown as { getRecoveryOutcome: () => ChainOutcome | null },
          'getRecoveryOutcome',
        )
        .mockReturnValue(fixture.transcriptionRecoveryOutcome);
    }

    jest.spyOn(cols.transcription, 'transcribe').mockResolvedValue({
      success: true,
      segments: fixture.segmentTexts.map((text, i) => ({
        start: i * fixture.segmentMs,
        end: (i + 1) * fixture.segmentMs,
        text,
        // Raw pass-through when the fixture supplies confidences (an explicit
        // `undefined` entry STAYS undefined — the REQ-393 test proves the
        // estimator counts an unmeasured segment as 0); uniform 0.9 otherwise.
        confidence: fixture.segmentConfidences
          ? fixture.segmentConfidences[i]
          : 0.9,
      })),
    });
    jest.spyOn(cols.segmenter, 'segment').mockResolvedValue(
      fixture.segmentTexts.map((_, i) => ({
        startMs: i * fixture.segmentMs,
        endMs: (i + 1) * fixture.segmentMs,
        text: '',
        summary: '',
        keyphrases: [],
        ...(fixture.contentConfidence !== undefined
          ? { confidence: fixture.contentConfidence }
          : {}),
      })),
    );
    jest.spyOn(cols.detector, 'analyze').mockResolvedValue({
      type: 'flow',
      confidence: 0.8,
      nodes: [],
      edges: [],
      reasoning: 'fixture',
    });
    jest.spyOn(cols.layoutEngine, 'generateLayout').mockResolvedValue({
      success: true,
      layout: { nodes: fixture.layoutNodes, edges: [] },
      confidence: 0.8,
    });

    const spy = recordMetricsSpy();
    const rtpmSpy = recordPipelineQualitySpy();
    spy.mockClear();
    rtpmSpy.mockClear();
    await pipeline.process({ audioFile: audioFileFixture() });
    return { recordMetrics: spy, recordPipelineQuality: rtpmSpy };
  }

  /** Minimal audio File sufficient for process(). */
  function audioFileFixture(): File {
    return new File(['audio-bytes'], 'speech.wav', { type: 'audio/wav' });
  }

  /** The success-path recordMetrics payload (the one carrying accuracy). */
  function qualityPayload(spy: jest.MockInstance<void, unknown[]>): Record<string, unknown> {
    const call = spy.mock.calls
      .map((args: unknown[]) => args[0] as Record<string, unknown>)
      .find((metrics: Record<string, unknown>) => 'transcriptionAccuracy' in metrics);
    if (!call) throw new Error('success-path recordMetrics call not found');
    return call;
  }

  it('records measured values on a degenerate run (empty transcript, one long scene, overlapping layout)', async () => {
    const { recordMetrics: spy } = await runSuccessPath({
      // A single empty-text segment: transcript is '' (length 0) — the
      // fabricated `transcript.length > 0 ? 0.9 : 0` would record 0 here
      // even though the run produced a scene.
      segmentTexts: [''],
      // One 30s scene: misses BOTH segmentation bonuses (count < 2, avg
      // duration > 15000ms) → canonical 0.70, not the fabricated 0.85.
      segmentMs: 30_000,
      // One overlapping pair → 1 measured overlap, not the asserted
      // `layoutOverlap: 0`.
      layoutNodes: [
        { id: 'a', label: 'A', x: 0, y: 0, width: 100, height: 100 },
        { id: 'b', label: 'B', x: 50, y: 50, width: 100, height: 100 },
      ],
    });

    const payload = qualityPayload(spy);
    // Canonical estimateTranscriptionAccuracy: success + ≥1 scene → 0.90.
    expect(payload.transcriptionAccuracy).toBe(0.9);
    // Canonical estimateSegmentationQuality: base 0.70, both bonuses missed.
    expect(payload.sceneSegmentationF1).toBe(0.7);
    // Canonical countLayoutOverlaps over the produced scene: 1 pair.
    expect(payload.layoutOverlap).toBe(1);
  });

  it('records measured values on a healthy run (2 scenes × 2s, disjoint layouts)', async () => {
    const { recordMetrics: spy } = await runSuccessPath({
      segmentTexts: ['first segment text', 'second segment text'],
      segmentMs: 2000,
      layoutNodes: [
        { id: 'a', label: 'A', x: 0, y: 0, width: 100, height: 100 },
        { id: 'b', label: 'B', x: 1000, y: 1000, width: 100, height: 100 },
      ],
    });

    const payload = qualityPayload(spy);
    expect(payload.transcriptionAccuracy).toBe(0.9);
    // 2–10 scenes (+0.15) with 2s average duration (+0.15) → 1.0.
    expect(payload.sceneSegmentationF1).toBe(1);
    expect(payload.layoutOverlap).toBe(0);
  });

  // ── REQ-430 (AX-3 / D-3): disclosed-placeholder penalty on the SimplePipeline
  // aggregation path — TC-423-01/03. The success-path payload must reflect the
  // transcription recovery chain's terminal state via the canonical estimator;
  // a run that fell to the disclosed placeholder can no longer record 0.90.
  it('REQ-430 TC-423-01: a placeholder-terminated recovery chain records the penalized accuracy (< 0.85 gate)', async () => {
    const { recordMetrics: spy } = await runSuccessPath({
      segmentTexts: ['first segment text', 'second segment text'],
      segmentMs: 2000,
      layoutNodes: [],
      transcriptionRecoveryOutcome: recoveryOutcomeAt('disclosed-placeholder'),
    });
    const payload = qualityPayload(spy);
    expect(payload.transcriptionAccuracy).toBe(DISCLOSED_PLACEHOLDER_TRANSCRIPTION_ACCURACY);
    expect(payload.transcriptionAccuracy).toBeLessThan(0.85);
  });

  it('REQ-430 TC-423-03: a real whisper-inference terminal outcome keeps the 0.90 success value', async () => {
    const { recordMetrics: spy } = await runSuccessPath({
      segmentTexts: ['first segment text', 'second segment text'],
      segmentMs: 2000,
      layoutNodes: [],
      transcriptionRecoveryOutcome: recoveryOutcomeAt('whisper-inference'),
    });
    const payload = qualityPayload(spy);
    expect(payload.transcriptionAccuracy).toBe(0.9);
  });

  // ── REQ-373: the same measured overlap count is REPORTED to the real-time
  // monitor — the producer behind snapshot.quality.layoutOverlapRate
  // (REQ-372). The wiring sits at the measurement site (the
  // countLayoutOverlaps scan), NOT inside QualityMonitor.recordMetrics:
  // recordMetrics' other callers pass its DEFAULT `layoutOverlap: 0` for runs
  // that measured nothing, and bridging there would feed those unmeasured
  // zeros straight into the eq-0 zero-tolerance blocker gate.
  describe('real-time monitor wiring (REQ-373)', () => {
    it('reports (measuredScenes, measured overlap count) on the success path', async () => {
      const { recordPipelineQuality } = await runSuccessPath({
        segmentTexts: ['one segment text'],
        segmentMs: 2000,
        layoutNodes: [
          { id: 'a', label: 'A', x: 0, y: 0, width: 100, height: 100 },
          { id: 'b', label: 'B', x: 50, y: 50, width: 100, height: 100 },
        ],
      });

      // 1 scene scanned, 1 overlapping (a,b) pair found.
      expect(recordPipelineQuality).toHaveBeenCalledWith(1, 1);
    });

    it('reports a measured 0 for disjoint layouts (a real reading, not a default)', async () => {
      const { recordPipelineQuality } = await runSuccessPath({
        segmentTexts: ['first segment text', 'second segment text'],
        segmentMs: 2000,
        layoutNodes: [
          { id: 'a', label: 'A', x: 0, y: 0, width: 100, height: 100 },
          { id: 'b', label: 'B', x: 1000, y: 1000, width: 100, height: 100 },
        ],
      });

      expect(recordPipelineQuality).toHaveBeenCalledWith(2, 0);
    });

    it('does NOT report on the failure path — a failed run measured nothing', async () => {
      const pipeline = createPipeline();
      const cols = collaborators(pipeline);
      jest
        .spyOn(cols.transcription, 'transcribe')
        .mockRejectedValue(new Error('transcription failed'));

      const rtpmSpy = recordPipelineQualitySpy();
      const metricsSpy = recordMetricsSpy();
      rtpmSpy.mockClear();
      metricsSpy.mockClear();
      await pipeline.process({ audioFile: audioFileFixture() });

      // The failure path reports its fail-loud zeros to QualityMonitor but
      // must NOT fabricate a "measured 0 overlaps" reading for the RTPM gate.
      expect(rtpmSpy).not.toHaveBeenCalled();

      // REQ-375: the failure-path QualityMonitor record omits layoutOverlap
      // entirely, so the recordMetrics DEFAULT (null) applies — the run died
      // before measuring any layout. The previous asserted `layoutOverlap: 0`
      // here claimed a perfect overlap-free layout (and earned the +5
      // zero-overlap bonus) for a run that never scanned one.
      const failurePayload = metricsSpy.mock.calls
        .map((args: unknown[]) => args[0] as Record<string, unknown>)
        .find((metrics: Record<string, unknown>) => metrics.errorCount === 1);
      if (!failurePayload) throw new Error('failure-path recordMetrics call not found');
      expect(failurePayload.layoutOverlap).toBeUndefined();
      expect(getQualityMonitor().getLatestMetrics()?.layoutOverlap).toBeNull();
    });
  });

  // ── REQ-393: the continuousLearner stage legs carry MEASURED values, not
  // frozen bands. The learner's own contract gates on qualityScore < 0.85
  // (triggerCustomInstructionsImprovement) and feeds quality-degradation
  // detection, so a `? 0.9 : 0.3`-shaped leg makes those mechanisms see a
  // permanently satisfactory pipeline. Each leg now delegates to the
  // measurement the stage itself produced.
  describe('continuousLearner legs carry measured values (REQ-393)', () => {
    type Learner = { learnFromProcessingResult: (...args: unknown[]) => Promise<void> };

    /** Spy on the REAL learner singleton (jest.mock is a no-op here, ESM). */
    function learnerSpy(): jest.MockInstance<Promise<void>, unknown[]> {
      return jest.spyOn(
        (continuousLearner as unknown as Learner),
        'learnFromProcessingResult',
      );
    }

    /** The quality (5th arg) of a component's FIRST learner call. */
    function qualityFor(spy: jest.MockInstance<Promise<void>, unknown[]>, component: string): number {
      const call = spy.mock.calls.find((args: unknown[]) => args[0] === component);
      if (!call) throw new Error(`learnFromProcessingResult(${component}) not called`);
      return call[4] as number;
    }

    it('transcription leg = mean segment confidence (varied 0.6/0.8 → 0.7, not a frozen 0.9)', async () => {
      const spy = learnerSpy();
      await runSuccessPath({
        segmentTexts: ['first text', 'second text'],
        segmentMs: 2000,
        segmentConfidences: [0.6, 0.8],
        layoutNodes: [{ id: 'a', label: 'A', x: 0, y: 0, width: 100, height: 100 }],
      });
      expect(qualityFor(spy, 'transcription')).toBeCloseTo(0.7, 10);
      spy.mockRestore();
    });

    it('transcription leg counts an unmeasured segment as 0 (fail value drags the mean down)', async () => {
      const spy = learnerSpy();
      await runSuccessPath({
        segmentTexts: ['first text', 'second text'],
        segmentMs: 2000,
        // One measured 0.9 + one segment with NO confidence → mean 0.45.
        segmentConfidences: [0.9, undefined as unknown as number],
        layoutNodes: [{ id: 'a', label: 'A', x: 0, y: 0, width: 100, height: 100 }],
      });
      expect(qualityFor(spy, 'transcription')).toBeCloseTo(0.45, 10);
      spy.mockRestore();
    });

    it('segmentation leg = mean ContentSegment confidence (the segmenter’s own derivation)', async () => {
      const spy = learnerSpy();
      await runSuccessPath({
        segmentTexts: ['first text', 'second text'],
        segmentMs: 2000,
        contentConfidence: 0.75,
        layoutNodes: [{ id: 'a', label: 'A', x: 0, y: 0, width: 100, height: 100 }],
      });
      expect(qualityFor(spy, 'scene_segmentation')).toBeCloseTo(0.75, 10);
      spy.mockRestore();
    });

    it('diagram_pipeline leg = measured scene yield (2/2 segments → 1.0, not a frozen 0.9)', async () => {
      const spy = learnerSpy();
      await runSuccessPath({
        segmentTexts: ['first text', 'second text'],
        segmentMs: 2000,
        layoutNodes: [{ id: 'a', label: 'A', x: 0, y: 0, width: 100, height: 100 }],
      });
      expect(qualityFor(spy, 'diagram_pipeline')).toBe(1);
      spy.mockRestore();
    });

    it('layout leg = the layout engine’s own measured confidence (0.8 in → 0.8 out, no rescale floor)', async () => {
      const spy = learnerSpy();
      await runSuccessPath({
        segmentTexts: ['first text'],
        segmentMs: 2000,
        layoutNodes: [{ id: 'a', label: 'A', x: 0, y: 0, width: 100, height: 100 }],
      });
      // runSuccessPath pins layout confidence 0.8 via its generateLayout
      // stub; the measured pass-through publishes exactly that (the
      // eradicated `0.8 + conf*0.15` rescale would have published ~0.92).
      expect(qualityFor(spy, 'layout_generation')).toBe(0.8);
      spy.mockRestore();
    });
  });
});
