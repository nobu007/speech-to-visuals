/**
 * Unit tests for SimplePipeline (src/pipeline/simple-pipeline.ts)
 *
 * Covers: constructor, getCapabilities, getProgressiveMetrics,
 * and the private calculateQualityScore method accessed via internals() helper.
 */

import { SimplePipeline, simplePipeline } from '@/pipeline/simple-pipeline';
import type { SceneGraph } from '@stv/core/types/diagram';

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
        } as SceneGraph,
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
        { type: 'flow', nodes: [], edges: [], confidence: 1.0 } as SceneGraph,
        { type: 'flow', nodes: [], edges: [], confidence: 1.0 } as SceneGraph,
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
        { type: 'flow', nodes: [], edges: [] } as SceneGraph,
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
        { type: 'flow', nodes: [], edges: [], confidence: 0.6 } as SceneGraph,
        { type: 'flow', nodes: [], edges: [], confidence: 0.8 } as SceneGraph,
        { type: 'flow', nodes: [], edges: [], confidence: 1.0 } as SceneGraph,
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
        { type: 'flow', nodes: [], edges: [], confidence: 0.9 } as SceneGraph,
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
