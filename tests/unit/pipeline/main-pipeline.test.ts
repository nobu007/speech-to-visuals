/**
 * Unit tests for MainPipeline (src/pipeline/main-pipeline.ts)
 *
 * Covers constructor defaults, public accessors, and the five key private
 * helper methods accessed via `(instance as PrivatePipelineAccess).methodName()`.
 */

import { createHash } from 'crypto';
import { MainPipeline } from '@/pipeline/main-pipeline';
import { realTimeMonitor } from '@/monitoring/real-time-performance-monitor';
import { PipelineConfig, PipelineInput, PipelineResult } from '@/pipeline/types';
import { DISCLOSED_PLACEHOLDER_TRANSCRIPTION_ACCURACY } from '@/pipeline/quality-estimators';
import { TranscriptionPipeline } from '@/transcription';
import type { ChainOutcome } from '@/quality/recovery-strategy-chain';
import type { SceneGraph } from '@stv/core/types/diagram';

/**
 * Typed interface for accessing MainPipeline private members in tests.
 * Mirrors the private field and method signatures from main-pipeline.ts
 * so that `(pipeline as unknown as PrivatePipelineAccess)` is fully typed without `any`.
 */
interface PrivatePipelineAccess {
  // Private fields
  iteration: number;

  // Private methods
  optimizeSceneTiming(scenes: SceneGraph[]): void;
  createFallbackLayout(
    nodes: Record<string, unknown>[],
    edges: Record<string, unknown>[],
  ): { nodes: Array<Record<string, unknown> & { x: number; y: number; w: number; h: number }>; edges: Array<Record<string, unknown> & { points: Array<{ x: number; y: number }> }> };
  analyzeErrorPattern(error: Error, stageName: string): string;
  selectRecoveryStrategy(errorPattern: string, stageName: string): string;
  generateCacheKey(input: PipelineInput): Promise<string>;
  buildQualityMetrics(
    result: PipelineResult,
    renderTime: number,
  ): {
    transcriptionAccuracy: number;
    sceneSegmentationF1: number;
    layoutOverlap: number;
    renderTime: number;
    memoryUsage: number;
    timestamp: Date;
  };
}

// ---------- Module mocks (hoisted) ----------

jest.mock('@/transcription', () => ({
  TranscriptionPipeline: jest.fn().mockImplementation(() => ({
    transcribe: jest.fn(),
    nextIteration: jest.fn(),
  })),
}));

jest.mock('@/analysis', () => ({
  SceneSegmenter: jest.fn().mockImplementation(() => ({
    segment: jest.fn(),
    nextIteration: jest.fn(),
  })),
  DiagramDetector: jest.fn().mockImplementation(() => ({
    analyze: jest.fn(),
    nextIteration: jest.fn(),
  })),
  // main-pipeline sources these from the barrel; mirror canonical values.
  DEFAULT_MIN_SEGMENT_LENGTH_MS: 3000,
  DEFAULT_MAX_SEGMENT_LENGTH_MS: 15000,
}));

jest.mock('@/visualization', () => ({
  LayoutEngine: jest.fn().mockImplementation(() => ({
    generateLayout: jest.fn(),
  })),
}));

jest.mock('@/quality', () => ({
  qualityMonitor: {
    assessPipelineQuality: jest.fn().mockResolvedValue({ overallScore: 0.8 }),
    nextIteration: jest.fn(),
  },
}));

jest.mock('@/quality/enhanced-error-recovery', () => ({
  globalErrorRecovery: {
    executeWithLoadBalancing: jest.fn((id: string, fn: () => unknown) => fn()),
    recoverFromError: jest.fn().mockResolvedValue({ success: false }),
  },
}));

jest.mock('@/performance/intelligent-cache', () => ({
  globalCache: {
    get: jest.fn().mockResolvedValue(null),
    store: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/optimization/smart-parameter-tuner', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@/optimization/adaptive-content-processor', () => ({
  adaptiveContentProcessor: {},
}));

jest.mock('@/framework/recursive-custom-instructions', () => ({
  RecursiveCustomInstructionsFramework: jest.fn().mockImplementation(() => ({
    startCycle: jest.fn().mockResolvedValue(undefined),
    evaluateIteration: jest.fn().mockResolvedValue({
      shouldIterate: false,
      shouldAdvancePhase: false,
      shouldCommit: false,
    }),
    handleIterationFailure: jest.fn().mockResolvedValue(undefined),
    recordStageSuccess: jest.fn().mockResolvedValue(undefined),
    recordStageFailure: jest.fn().mockResolvedValue(undefined),
    recordQualityIssue: jest.fn().mockResolvedValue(undefined),
    prepareNextIteration: jest.fn().mockResolvedValue(undefined),
    advanceToPhase: jest.fn().mockResolvedValue(undefined),
    commitIteration: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@/framework/iteration-logger', () => ({
  globalIterationLogger: {
    appendIteration: jest.fn().mockResolvedValue(undefined),
    calculateImprovementTrends: jest
      .fn()
      .mockResolvedValue({ recommendations: [] }),
  },
}));

jest.mock('@stv/core/utils/memory-usage', () => ({
  getHeapUsed: jest.fn().mockReturnValue(0),
  getMemoryUsage: jest.fn().mockReturnValue({ heapUsed: 0, heapTotal: 0 }),
}));

jest.mock('@stv/core/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/pipeline/retry', () => ({
  retryWithBackoff: jest
    .fn()
    .mockImplementation(async (fn: () => unknown) => ({
      result: await fn(),
      attempts: 0,
    })),
}));

// ---------- Helpers ----------

/** Build a minimal SceneGraph-like object for timing tests. */
function makeScene(
  overrides: Partial<{
    type: string;
    nodes: unknown[];
    edges: unknown[];
    startMs: number;
    durationMs: number;
    summary: string;
    keyphrases: string[];
  }> = {},
) {
  return {
    type: 'flow' as const,
    nodes: [] as unknown[],
    edges: [] as unknown[],
    summary: 'test scene',
    keyphrases: [],
    startMs: 0,
    durationMs: 5000,
    ...overrides,
  };
}

// ---------- Tests ----------

describe('MainPipeline', () => {
  // ------------------------------------------------------------------
  // Constructor & public accessors
  // ------------------------------------------------------------------

  describe('constructor', () => {
    it('creates instance with default config', () => {
      const pipeline = new MainPipeline();
      const config = pipeline.getConfig();

      expect(config.transcription.model).toBe('base');
      expect(config.transcription.language).toBe('en');
      expect(config.analysis.minSegmentLengthMs).toBe(3000);
      expect(config.analysis.maxSegmentLengthMs).toBe(15000);
      expect(config.analysis.confidenceThreshold).toBe(0.7);
      expect(config.layout.width).toBe(1920);
      expect(config.layout.height).toBe(1080);
      expect(config.layout.nodeWidth).toBe(120);
      expect(config.layout.nodeHeight).toBe(60);
      expect(config.output.fps).toBe(30);
      expect(config.output.videoDuration).toBe(60);
      expect(config.output.includeAudio).toBe(true);
    });

    it('merges custom config over defaults', () => {
      const pipeline = new MainPipeline({
        transcription: { model: 'large', language: 'ja' },
        analysis: { confidenceThreshold: 0.9 },
        layout: { nodeWidth: 200 },
        output: { fps: 60 },
      } as Partial<PipelineConfig>);
      const config = pipeline.getConfig();

      // Overridden values
      expect(config.transcription.model).toBe('large');
      expect(config.transcription.language).toBe('ja');
      expect(config.analysis.confidenceThreshold).toBe(0.9);
      expect(config.layout.nodeWidth).toBe(200);
      expect(config.output.fps).toBe(60);

      // Unchanged defaults
      expect(config.analysis.minSegmentLengthMs).toBe(3000);
      expect(config.layout.height).toBe(1080);
      expect(config.output.includeAudio).toBe(true);
    });
  });

  describe('nextIteration', () => {
    it('increments iteration counter', () => {
      const pipeline = new MainPipeline();
      // Access private iteration field via typed interface
      const iterBefore = (pipeline as unknown as PrivatePipelineAccess).iteration;

      pipeline.nextIteration();

      const iterAfter = (pipeline as unknown as PrivatePipelineAccess).iteration;
      expect(iterAfter).toBe(iterBefore + 1);
    });

    it('merges config updates', () => {
      const pipeline = new MainPipeline();
      pipeline.nextIteration({
        transcription: { model: 'small' },
      } as Partial<PipelineConfig>);

      const config = pipeline.getConfig();
      expect(config.transcription.model).toBe('small');
    });
  });

  describe('getLastRunStages', () => {
    it('returns empty array initially', () => {
      const pipeline = new MainPipeline();
      expect(pipeline.getLastRunStages()).toEqual([]);
    });
  });

  describe('generatePerformanceReport', () => {
    it('returns performance tracker data', () => {
      const pipeline = new MainPipeline();
      const report = pipeline.generatePerformanceReport();

      expect(report).toHaveProperty('overallPerformance');
      expect(report).toHaveProperty('stageBreakdown');
      expect(report).toHaveProperty('bottlenecks');
      expect(report).toHaveProperty('improvements');
      expect(report).toHaveProperty('recommendations');
      expect(report.stageBreakdown).toBeInstanceOf(Map);
      expect(report.bottlenecks).toBeInstanceOf(Map);
      expect(Array.isArray(report.improvements)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });
  });

  // ------------------------------------------------------------------
  // Private method: optimizeSceneTiming
  // ------------------------------------------------------------------

  describe('optimizeSceneTiming', () => {
    it('enforces minimum duration of 2000ms', () => {
      const pipeline = new MainPipeline();
      const scenes = [makeScene({ durationMs: 500 })] as SceneGraph[];

      (pipeline as unknown as PrivatePipelineAccess).optimizeSceneTiming(scenes);

      expect(scenes[0].durationMs).toBe(2000);
    });

    it('enforces maximum duration of 15000ms', () => {
      const pipeline = new MainPipeline();
      const scenes = [makeScene({ durationMs: 30000 })] as SceneGraph[];

      (pipeline as unknown as PrivatePipelineAccess).optimizeSceneTiming(scenes);

      expect(scenes[0].durationMs).toBe(15000);
    });

    it('prevents start time overlaps', () => {
      const pipeline = new MainPipeline();
      const scenes = [
        makeScene({ startMs: 0, durationMs: 5000 }),
        makeScene({ startMs: 3000, durationMs: 5000 }), // overlaps with first
      ] as SceneGraph[];

      (pipeline as unknown as PrivatePipelineAccess).optimizeSceneTiming(scenes);

      // Second scene should be pushed to start after first ends
      expect(scenes[1].startMs).toBeGreaterThanOrEqual(
        scenes[0].startMs + scenes[0].durationMs,
      );
    });

    it('handles empty scenes array without error', () => {
      const pipeline = new MainPipeline();
      const scenes: SceneGraph[] = [];

      expect(() => (pipeline as unknown as PrivatePipelineAccess).optimizeSceneTiming(scenes)).not.toThrow();
    });

    it('handles single scene without modification (when within bounds)', () => {
      const pipeline = new MainPipeline();
      const scenes = [makeScene({ startMs: 0, durationMs: 5000 })] as SceneGraph[];

      (pipeline as unknown as PrivatePipelineAccess).optimizeSceneTiming(scenes);

      expect(scenes[0].durationMs).toBe(5000);
      expect(scenes[0].startMs).toBe(0);
    });
  });

  // ------------------------------------------------------------------
  // Private method: createFallbackLayout
  // ------------------------------------------------------------------

  describe('createFallbackLayout', () => {
    it('creates grid layout from nodes', () => {
      const pipeline = new MainPipeline();
      const nodes = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
        { id: 'd', label: 'D' },
      ];
      const edges = [{ from: 'a', to: 'b' }];

      const layout = (pipeline as unknown as PrivatePipelineAccess).createFallbackLayout(nodes, edges);

      // 2x2 grid: first row indices 0,1 → column offsets; second row 2,3
      expect(layout.nodes).toHaveLength(4);
      expect(layout.nodes[0].x).toBe(100 + (0 % 3) * 200);
      expect(layout.nodes[0].y).toBe(100 + Math.floor(0 / 3) * 150);
      expect(layout.nodes[1].x).toBe(100 + (1 % 3) * 200);
      expect(layout.nodes[1].y).toBe(100);
      expect(layout.nodes[2].x).toBe(100 + (2 % 3) * 200);
      expect(layout.nodes[2].y).toBe(100);
      expect(layout.nodes[3].x).toBe(100); // index 3 % 3 = 0 → wraps to next row
      expect(layout.nodes[3].y).toBe(100 + 150); // floor(3/3)=1

      // Node dimensions from config defaults
      expect(layout.nodes[0].w).toBe(120);
      expect(layout.nodes[0].h).toBe(60);
    });

    it('creates edges with points arrays', () => {
      const pipeline = new MainPipeline();
      const nodes = [{ id: 'a' }];
      const edges = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ];

      const layout = (pipeline as unknown as PrivatePipelineAccess).createFallbackLayout(nodes, edges);

      expect(layout.edges).toHaveLength(2);
      for (const edge of layout.edges) {
        expect(edge.points).toBeDefined();
        expect(edge.points).toHaveLength(2);
      }
    });

    it('handles empty arrays', () => {
      const pipeline = new MainPipeline();
      const layout = (pipeline as unknown as PrivatePipelineAccess).createFallbackLayout([], []);

      expect(layout.nodes).toEqual([]);
      expect(layout.edges).toEqual([]);
    });
  });

  // ------------------------------------------------------------------
  // Private method: analyzeErrorPattern
  // ------------------------------------------------------------------

  describe('analyzeErrorPattern', () => {
    it('detects timeout pattern', () => {
      const pipeline = new MainPipeline();
      const result = (pipeline as unknown as PrivatePipelineAccess).analyzeErrorPattern(
        new Error('operation timeout exceeded'),
        'transcription',
      );
      expect(result).toBe('timeout');
    });

    it('detects memory pattern', () => {
      const pipeline = new MainPipeline();
      const result = (pipeline as unknown as PrivatePipelineAccess).analyzeErrorPattern(
        new Error('out of memory during processing'),
        'analysis',
      );
      expect(result).toBe('memory');
    });

    it('detects network pattern', () => {
      const pipeline = new MainPipeline();
      const result = (pipeline as unknown as PrivatePipelineAccess).analyzeErrorPattern(
        new Error('connection refused by server'),
        'layout',
      );
      expect(result).toBe('network');
    });

    it('detects format pattern', () => {
      const pipeline = new MainPipeline();
      const result = (pipeline as unknown as PrivatePipelineAccess).analyzeErrorPattern(
        new Error('invalid format in input data'),
        'preparation',
      );
      expect(result).toBe('format');
    });

    it('returns unknown for unrecognized patterns', () => {
      const pipeline = new MainPipeline();
      const result = (pipeline as unknown as PrivatePipelineAccess).analyzeErrorPattern(
        new Error('something completely unexpected'),
        'transcription',
      );
      expect(result).toBe('unknown');
    });
  });

  // ------------------------------------------------------------------
  // Private method: selectRecoveryStrategy
  // ------------------------------------------------------------------

  describe('selectRecoveryStrategy', () => {
    it('maps timeout to increase_timeout', () => {
      const pipeline = new MainPipeline();
      expect(
        (pipeline as unknown as PrivatePipelineAccess).selectRecoveryStrategy('timeout', 'transcription'),
      ).toBe('increase_timeout');
    });

    it('maps memory to optimize_memory', () => {
      const pipeline = new MainPipeline();
      expect(
        (pipeline as unknown as PrivatePipelineAccess).selectRecoveryStrategy('memory', 'analysis'),
      ).toBe('optimize_memory');
    });

    it('maps network to retry_with_backoff', () => {
      const pipeline = new MainPipeline();
      expect(
        (pipeline as unknown as PrivatePipelineAccess).selectRecoveryStrategy('network', 'layout'),
      ).toBe('retry_with_backoff');
    });

    it('maps format to fallback_processing', () => {
      const pipeline = new MainPipeline();
      expect(
        (pipeline as unknown as PrivatePipelineAccess).selectRecoveryStrategy('format', 'preparation'),
      ).toBe('fallback_processing');
    });

    it('defaults to generic_retry for unknown pattern', () => {
      const pipeline = new MainPipeline();
      expect(
        (pipeline as unknown as PrivatePipelineAccess).selectRecoveryStrategy('bizarre_error', 'any'),
      ).toBe('generic_retry');
    });
  });

  // ------------------------------------------------------------------
  // Private method: generateCacheKey
  // ------------------------------------------------------------------

  describe('generateCacheKey', () => {
    // Helper: a File-like with a real arrayBuffer() so the content hash is
    // exercised (a plain {name,size} cast would have no bytes to hash).
    const mockAudioFile = (name: string, contents: string): File => {
      const bytes = new TextEncoder().encode(contents);
      const ab = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      );
      return {
        name,
        size: bytes.byteLength,
        arrayBuffer: async () => ab,
      } as unknown as File;
    };

    it('generates a content-derived key for File input', async () => {
      const pipeline = new MainPipeline();
      const contents = 'audio-payload-A';
      const bytes = new TextEncoder().encode(contents);
      const expectedHash = createHash('sha256')
        .update(bytes)
        .digest('hex')
        .slice(0, 16);

      const key = await (pipeline as unknown as PrivatePipelineAccess).generateCacheKey({
        audioFile: mockAudioFile('audio.wav', contents),
      });

      expect(key).toBe(`transcription:${expectedHash}:base`);
    });

    it('generates a path-derived key for string input', async () => {
      const pipeline = new MainPipeline();

      const key = await (pipeline as unknown as PrivatePipelineAccess).generateCacheKey({
        audioFile: '/path/to/recording.mp3',
      });

      expect(key).toBe('transcription:path:/path/to/recording.mp3:base');
    });

    // Regression (metadata-vs-content keying class): the OLD key was
    // `transcription-${name}-${size}-${model}`, so two distinct uploads sharing
    // a name + byte-size collapsed onto one slot and the second file's
    // transcription returned the FIRST file's cached result. globalCache stores
    // this string as `sourceContent`, so its hash-collision guard compared
    // identical metadata strings and passed. The key must now be injective on
    // CONTENT — the 4th keying layer of the class that recurred in
    // GeminiAnalyzer (f6d5dc43), LLMCache (f172f017) and ContentAnalyzer
    // (0501c548).
    it('distinct-content File objects with identical name+size get DISTINCT keys', async () => {
      const pipeline = new MainPipeline();
      // Same name, same byte-length, DIFFERENT bytes.
      const keyA = await (pipeline as unknown as PrivatePipelineAccess).generateCacheKey({
        audioFile: mockAudioFile('clip.wav', 'AAAAAAAAAA'),
      });
      const keyB = await (pipeline as unknown as PrivatePipelineAccess).generateCacheKey({
        audioFile: mockAudioFile('clip.wav', 'BBBBBBBBBB'),
      });
      expect(keyA).not.toBe(keyB);
    });

    it('same-content File objects (different names) share a key (correct cache hit)', async () => {
      const pipeline = new MainPipeline();
      const keyA = await (pipeline as unknown as PrivatePipelineAccess).generateCacheKey({
        audioFile: mockAudioFile('take-1.wav', 'identical-audio'),
      });
      const keyB = await (pipeline as unknown as PrivatePipelineAccess).generateCacheKey({
        audioFile: mockAudioFile('take-2.wav', 'identical-audio'),
      });
      expect(keyA).toBe(keyB);
    });
  });

  // ------------------------------------------------------------------
  // Private method: buildQualityMetrics — derive metrics from PipelineResult.
  // Regression net: the OLD implementation read stage-output fields that NO
  // producer populates — `transcription.accuracy`, `analysis.segmentationScore`,
  // and `layout.overlapCount` read off a layout ARRAY (which has no such
  // property). Every value was undefined → sanitizeFinite fallbacks 0.85 / 0.75
  // / 0, which EQUAL the framework quality thresholds exactly, so three of four
  // gates were permanently "green" and the self-improvement loop never iterated
  // on real transcription / segmentation / overlap quality. The fix derives
  // metrics from the actual PipelineResult via the canonical estimators shared
  // with FrameworkIntegratedPipeline.
  // ------------------------------------------------------------------

  describe('buildQualityMetrics', () => {
    // Minimal scene/result fixtures. Only the fields the estimators read matter
    // (success, scenes.length, duration, scene.layout.nodes); the rest are
    // stubbed and cast to satisfy the SceneGraph / PipelineResult types.
    const scene = (overrides: Record<string, unknown> = {}): SceneGraph =>
      ({
        type: 'diagram',
        nodes: [],
        edges: [],
        startMs: 0,
        durationMs: 5000,
        summary: '',
        keyphrases: [],
        ...overrides,
      } as unknown as SceneGraph);

    const result = (overrides: Partial<PipelineResult> = {}): PipelineResult =>
      ({
        success: true,
        scenes: [],
        audioUrl: '',
        duration: 10000,
        processingTime: 1000,
        stages: [],
        ...overrides,
      } as PipelineResult);

    it('derives metrics from the real PipelineResult, NOT the dead-field defaults 0.85/0.75', () => {
      // This fixture carries NO accuracy / segmentationScore / overlapCount
      // fields — exactly what real producers emit. The OLD code returned the
      // all-undefined fallbacks 0.85 / 0.75 / 0 for it; the estimators must now
      // return real values that differ from those stale, threshold-equaling
      // defaults.
      const pipeline = new MainPipeline();
      const metrics = (pipeline as unknown as PrivatePipelineAccess).buildQualityMetrics(
        result({ scenes: [scene(), scene(), scene()] }),
        1000,
      );
      // success + ≥1 scene → 0.90 (NOT the dead-field default 0.85)
      expect(metrics.transcriptionAccuracy).toBe(0.90);
      // 3 scenes (2-10 band) + 10000/3≈3333ms avg (2-15s band) → 1.0 (NOT 0.75)
      expect(metrics.sceneSegmentationF1).toBe(1.0);
      // scenes without layout.nodes → 0 overlaps, honestly computed
      expect(metrics.layoutOverlap).toBe(0);
    });

    it('a FAILED run yields transcriptionAccuracy 0 — gate now FIRES (old: 0.85, silently passed)', () => {
      const pipeline = new MainPipeline();
      const metrics = (pipeline as unknown as PrivatePipelineAccess).buildQualityMetrics(
        result({ success: false, scenes: [scene()] }),
        1000,
      );
      expect(metrics.transcriptionAccuracy).toBe(0); // < threshold 0.85 → iterate
      expect(metrics.sceneSegmentationF1).toBe(0); // < threshold 0.75 → iterate
    });

    it('a successful run with NO scenes yields transcriptionAccuracy 0.50', () => {
      const pipeline = new MainPipeline();
      const metrics = (pipeline as unknown as PrivatePipelineAccess).buildQualityMetrics(
        result({ scenes: [] }),
        1000,
      );
      expect(metrics.transcriptionAccuracy).toBe(0.50);
    });

    // ------------------------------------------------------------------
    // REQ-430 (AX-3 / D-3): disclosed-placeholder penalty wiring — TC-423-01.
    // buildQualityMetrics must consult the transcriber's recovery outcome
    // (getRecoveryOutcome — the single-source terminal state) and feed the
    // canonical estimator; a run that fell all the way to the disclosed
    // placeholder can no longer aggregate 0.90 transcriptionAccuracy.
    // ------------------------------------------------------------------
    /** Minimal ChainOutcome fixture pinned to one winning step. */
    const recoveryOutcomeAt = (winningStepId: string | null): ChainOutcome =>
      ({
        success: winningStepId !== null,
        winningStepId,
        fallbackUsed: winningStepId === 'disclosed-placeholder',
        confidence: 0,
        stepsAttempted: 3,
        stepsSkipped: 0,
        trace: [],
        totalDurationMs: 0,
        stage: 'transcription',
      }) as ChainOutcome;

    it('REQ-430 TC-423-01: a placeholder-terminated recovery chain yields the penalized accuracy (< 0.85 gate)', () => {
      const pipeline = new MainPipeline();
      jest
        .spyOn(
          (pipeline as unknown as { transcriber: TranscriptionPipeline }).transcriber,
          'getRecoveryOutcome',
        )
        .mockReturnValue(recoveryOutcomeAt('disclosed-placeholder'));
      const metrics = (pipeline as unknown as PrivatePipelineAccess).buildQualityMetrics(
        result({ scenes: [scene()] }),
        1000,
      );
      expect(metrics.transcriptionAccuracy).toBe(DISCLOSED_PLACEHOLDER_TRANSCRIPTION_ACCURACY);
      expect(metrics.transcriptionAccuracy).toBeLessThan(0.85);
    });

    it('REQ-430 TC-423-03: a real whisper-inference terminal outcome keeps the 0.90 success value', () => {
      const pipeline = new MainPipeline();
      jest
        .spyOn(
          (pipeline as unknown as { transcriber: TranscriptionPipeline }).transcriber,
          'getRecoveryOutcome',
        )
        .mockReturnValue(recoveryOutcomeAt('whisper-inference'));
      const metrics = (pipeline as unknown as PrivatePipelineAccess).buildQualityMetrics(
        result({ scenes: [scene()] }),
        1000,
      );
      expect(metrics.transcriptionAccuracy).toBe(0.90);
    });

    it('REQ-430 TC-423-03: a null recovery outcome (no transcribe() yet) keeps the 0.90 success value', () => {
      const pipeline = new MainPipeline();
      jest
        .spyOn(
          (pipeline as unknown as { transcriber: TranscriptionPipeline }).transcriber,
          'getRecoveryOutcome',
        )
        .mockReturnValue(null);
      const metrics = (pipeline as unknown as PrivatePipelineAccess).buildQualityMetrics(
        result({ scenes: [scene()] }),
        1000,
      );
      expect(metrics.transcriptionAccuracy).toBe(0.90);
    });

    it('real layout overlaps are COUNTED — gate now FIRES (old: always 0)', () => {
      const pipeline = new MainPipeline();
      const metrics = (pipeline as unknown as PrivatePipelineAccess).buildQualityMetrics(
        result({
          scenes: [
            scene({
              layout: {
                // a and b overlap; c is isolated → exactly 1 overlapping pair
                nodes: [
                  { id: 'a', x: 0, y: 0, width: 100, height: 50 },
                  { id: 'b', x: 50, y: 25, width: 100, height: 50 },
                  { id: 'c', x: 500, y: 500, width: 100, height: 50 },
                ],
                edges: [],
              },
            }),
          ],
        }),
        1000,
      );
      expect(metrics.layoutOverlap).toBe(1); // > threshold 0 → iterate
    });

    it('keeps a legit worst-case 0 and passes through renderTime/memoryUsage/timestamp', () => {
      const pipeline = new MainPipeline();
      const metrics = (pipeline as unknown as PrivatePipelineAccess).buildQualityMetrics(
        result({ success: false, scenes: [] }),
        4242,
      );
      // A failed run with no scenes: every quality axis is the worst-case 0,
      // which must reach evaluateIteration unmasked (NOT erased to a fallback).
      expect(metrics.transcriptionAccuracy).toBe(0);
      expect(metrics.sceneSegmentationF1).toBe(0);
      expect(metrics.layoutOverlap).toBe(0);
      expect(metrics.renderTime).toBe(4242);
      expect(Number.isFinite(metrics.memoryUsage)).toBe(true);
      expect(metrics.timestamp).toBeInstanceOf(Date);
    });

    // ── REQ-373: buildQualityMetrics REPORTS the measured overlap count to
    // the real-time monitor — the producer behind
    // snapshot.quality.layoutOverlapRate (REQ-372). Wired at the measurement
    // site (the countLayoutOverlaps scan over the run's actual scenes), so
    // the eq-0 zero-tolerance blocker gate verdicts on a REAL reading.
    it('reports (measuredScenes, measured overlap count) to the real-time monitor (REQ-373)', () => {
      const rtpmSpy = jest.spyOn(realTimeMonitor, 'recordPipelineQuality');
      const pipeline = new MainPipeline();
      (pipeline as unknown as PrivatePipelineAccess).buildQualityMetrics(
        result({
          scenes: [
            scene({
              layout: {
                // a and b overlap; c is isolated → exactly 1 overlapping pair
                nodes: [
                  { id: 'a', x: 0, y: 0, width: 100, height: 50 },
                  { id: 'b', x: 50, y: 25, width: 100, height: 50 },
                  { id: 'c', x: 500, y: 500, width: 100, height: 50 },
                ],
                edges: [],
              },
            }),
          ],
        }),
        1000,
      );

      // 1 scene scanned, 1 overlapping pair found.
      expect(rtpmSpy).toHaveBeenCalledWith(1, 1);
      rtpmSpy.mockRestore();
    });

    it('a 0-scene result reports a degenerate reading — the monitor publishes null, not a vacuous 0', () => {
      const rtpmSpy = jest.spyOn(realTimeMonitor, 'recordPipelineQuality');
      const pipeline = new MainPipeline();
      (pipeline as unknown as PrivatePipelineAccess).buildQualityMetrics(
        result({ scenes: [] }),
        1000,
      );

      // measuredScenes 0: the scan ran over nothing, so the monitor-side
      // derivation (REQ-372) keeps layoutOverlapRate null — the report is
      // still made (last report wins), but it cannot pass the eq-0 gate.
      expect(rtpmSpy).toHaveBeenCalledWith(0, 0);
      rtpmSpy.mockRestore();
    });
  });
});
