/**
 * Unit tests for MainPipeline (src/pipeline/main-pipeline.ts)
 *
 * Covers constructor defaults, public accessors, and the five key private
 * helper methods accessed via `(instance as PrivatePipelineAccess).methodName()`.
 */

import { MainPipeline } from '@/pipeline/main-pipeline';
import { PipelineConfig, PipelineInput } from '@/pipeline/types';
import type { SceneGraph } from '@/types/diagram';

/**
 * Typed interface for accessing MainPipeline private members in tests.
 * Mirrors the private field and method signatures from main-pipeline.ts
 * so that `(pipeline as PrivatePipelineAccess)` is fully typed without `any`.
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
  generateCacheKey(input: PipelineInput): string;
  buildQualityMetrics(
    transcription: Record<string, unknown>,
    analysis: Record<string, unknown>,
    layout: Record<string, unknown>,
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

jest.mock('@/utils/iteration-logger', () => ({
  globalIterationLogger: {
    appendIteration: jest.fn().mockResolvedValue(undefined),
    calculateImprovementTrends: jest
      .fn()
      .mockResolvedValue({ recommendations: [] }),
  },
}));

jest.mock('@/utils/memory-usage', () => ({
  getHeapUsed: jest.fn().mockReturnValue(0),
  getMemoryUsage: jest.fn().mockReturnValue({ heapUsed: 0, heapTotal: 0 }),
}));

jest.mock('@/utils/logger', () => ({
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
    nodes: [],
    edges: [],
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
      const iterBefore = (pipeline as PrivatePipelineAccess).iteration;

      pipeline.nextIteration();

      const iterAfter = (pipeline as PrivatePipelineAccess).iteration;
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
      const scenes = [makeScene({ durationMs: 500 })];

      (pipeline as PrivatePipelineAccess).optimizeSceneTiming(scenes);

      expect(scenes[0].durationMs).toBe(2000);
    });

    it('enforces maximum duration of 15000ms', () => {
      const pipeline = new MainPipeline();
      const scenes = [makeScene({ durationMs: 30000 })];

      (pipeline as PrivatePipelineAccess).optimizeSceneTiming(scenes);

      expect(scenes[0].durationMs).toBe(15000);
    });

    it('prevents start time overlaps', () => {
      const pipeline = new MainPipeline();
      const scenes = [
        makeScene({ startMs: 0, durationMs: 5000 }),
        makeScene({ startMs: 3000, durationMs: 5000 }), // overlaps with first
      ];

      (pipeline as PrivatePipelineAccess).optimizeSceneTiming(scenes);

      // Second scene should be pushed to start after first ends
      expect(scenes[1].startMs).toBeGreaterThanOrEqual(
        scenes[0].startMs + scenes[0].durationMs,
      );
    });

    it('handles empty scenes array without error', () => {
      const pipeline = new MainPipeline();
      const scenes: SceneGraph[] = [];

      expect(() => (pipeline as PrivatePipelineAccess).optimizeSceneTiming(scenes)).not.toThrow();
    });

    it('handles single scene without modification (when within bounds)', () => {
      const pipeline = new MainPipeline();
      const scenes = [makeScene({ startMs: 0, durationMs: 5000 })];

      (pipeline as PrivatePipelineAccess).optimizeSceneTiming(scenes);

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

      const layout = (pipeline as PrivatePipelineAccess).createFallbackLayout(nodes, edges);

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

      const layout = (pipeline as PrivatePipelineAccess).createFallbackLayout(nodes, edges);

      expect(layout.edges).toHaveLength(2);
      for (const edge of layout.edges) {
        expect(edge.points).toBeDefined();
        expect(edge.points).toHaveLength(2);
      }
    });

    it('handles empty arrays', () => {
      const pipeline = new MainPipeline();
      const layout = (pipeline as PrivatePipelineAccess).createFallbackLayout([], []);

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
      const result = (pipeline as PrivatePipelineAccess).analyzeErrorPattern(
        new Error('operation timeout exceeded'),
        'transcription',
      );
      expect(result).toBe('timeout');
    });

    it('detects memory pattern', () => {
      const pipeline = new MainPipeline();
      const result = (pipeline as PrivatePipelineAccess).analyzeErrorPattern(
        new Error('out of memory during processing'),
        'analysis',
      );
      expect(result).toBe('memory');
    });

    it('detects network pattern', () => {
      const pipeline = new MainPipeline();
      const result = (pipeline as PrivatePipelineAccess).analyzeErrorPattern(
        new Error('connection refused by server'),
        'layout',
      );
      expect(result).toBe('network');
    });

    it('detects format pattern', () => {
      const pipeline = new MainPipeline();
      const result = (pipeline as PrivatePipelineAccess).analyzeErrorPattern(
        new Error('invalid format in input data'),
        'preparation',
      );
      expect(result).toBe('format');
    });

    it('returns unknown for unrecognized patterns', () => {
      const pipeline = new MainPipeline();
      const result = (pipeline as PrivatePipelineAccess).analyzeErrorPattern(
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
        (pipeline as PrivatePipelineAccess).selectRecoveryStrategy('timeout', 'transcription'),
      ).toBe('increase_timeout');
    });

    it('maps memory to optimize_memory', () => {
      const pipeline = new MainPipeline();
      expect(
        (pipeline as PrivatePipelineAccess).selectRecoveryStrategy('memory', 'analysis'),
      ).toBe('optimize_memory');
    });

    it('maps network to retry_with_backoff', () => {
      const pipeline = new MainPipeline();
      expect(
        (pipeline as PrivatePipelineAccess).selectRecoveryStrategy('network', 'layout'),
      ).toBe('retry_with_backoff');
    });

    it('maps format to fallback_processing', () => {
      const pipeline = new MainPipeline();
      expect(
        (pipeline as PrivatePipelineAccess).selectRecoveryStrategy('format', 'preparation'),
      ).toBe('fallback_processing');
    });

    it('defaults to generic_retry for unknown pattern', () => {
      const pipeline = new MainPipeline();
      expect(
        (pipeline as PrivatePipelineAccess).selectRecoveryStrategy('bizarre_error', 'any'),
      ).toBe('generic_retry');
    });
  });

  // ------------------------------------------------------------------
  // Private method: generateCacheKey
  // ------------------------------------------------------------------

  describe('generateCacheKey', () => {
    it('generates key for File input', () => {
      const pipeline = new MainPipeline();
      const mockFile = { name: 'audio.wav', size: 10240 } as File;
      const input: PipelineInput = { audioFile: mockFile };

      const key = (pipeline as PrivatePipelineAccess).generateCacheKey(input);

      expect(key).toBe('transcription-audio.wav-10240-base');
    });

    it('generates key for string input', () => {
      const pipeline = new MainPipeline();
      const input: PipelineInput = { audioFile: '/path/to/recording.mp3' };

      const key = (pipeline as PrivatePipelineAccess).generateCacheKey(input);

      expect(key).toBe('transcription-/path/to/recording.mp3-base');
    });
  });

  // ------------------------------------------------------------------
  // Private method: buildQualityMetrics (legit-zero preservation)
  // Regression net: the OLD code used `value || fallback`, which erased a
  // legitimate 0 metric (0% accuracy, F1=0) to the fallback and fooled the
  // self-improvement loop into accepting a catastrophic run.
  // ------------------------------------------------------------------

  describe('buildQualityMetrics', () => {
    it('PRESERVES a legitimate 0 transcription accuracy (regression: was erased to 0.85)', () => {
      const pipeline = new MainPipeline();
      const metrics = (pipeline as PrivatePipelineAccess).buildQualityMetrics(
        { accuracy: 0 },
        {},
        {},
        1000,
      );
      expect(metrics.transcriptionAccuracy).toBe(0);
    });

    it('PRESERVES a legitimate 0 segmentation F1 (regression: was erased to 0.75)', () => {
      const pipeline = new MainPipeline();
      const metrics = (pipeline as PrivatePipelineAccess).buildQualityMetrics(
        {},
        { segmentationScore: 0 },
        {},
        1000,
      );
      expect(metrics.sceneSegmentationF1).toBe(0);
    });

    it('PRESERVES a legitimate 0 layout overlap count', () => {
      const pipeline = new MainPipeline();
      const metrics = (pipeline as PrivatePipelineAccess).buildQualityMetrics(
        {},
        {},
        { overlapCount: 0 },
        1000,
      );
      expect(metrics.layoutOverlap).toBe(0);
    });

    it('falls back to defaults when stage outputs are ABSENT (undefined)', () => {
      const pipeline = new MainPipeline();
      const metrics = (pipeline as PrivatePipelineAccess).buildQualityMetrics(
        {},
        {},
        {},
        1000,
      );
      expect(metrics.transcriptionAccuracy).toBe(0.85);
      expect(metrics.sceneSegmentationF1).toBe(0.75);
      expect(metrics.layoutOverlap).toBe(0);
    });

    it('falls back to defaults for NaN / non-number metric values', () => {
      const pipeline = new MainPipeline();
      const metrics = (pipeline as PrivatePipelineAccess).buildQualityMetrics(
        { accuracy: NaN },
        { segmentationScore: 'oops' },
        { overlapCount: undefined },
        1000,
      );
      expect(metrics.transcriptionAccuracy).toBe(0.85);
      expect(metrics.sceneSegmentationF1).toBe(0.75);
      expect(metrics.layoutOverlap).toBe(0);
    });

    it('keeps real non-zero metric values and passes through renderTime', () => {
      const pipeline = new MainPipeline();
      const metrics = (pipeline as PrivatePipelineAccess).buildQualityMetrics(
        { accuracy: 0.42 },
        { segmentationScore: 0.9 },
        { overlapCount: 3 },
        4242,
      );
      expect(metrics.transcriptionAccuracy).toBe(0.42);
      expect(metrics.sceneSegmentationF1).toBe(0.9);
      expect(metrics.layoutOverlap).toBe(3);
      expect(metrics.renderTime).toBe(4242);
    });
  });
});
