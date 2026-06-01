jest.mock('@/pipeline/main-pipeline', () => ({
  MainPipeline: jest.fn().mockImplementation(() => ({
    execute: jest.fn(),
    nextIteration: jest.fn(),
  })),
}));

jest.mock('@/pipeline/types', () => ({}));

jest.mock('@/utils/memory-usage', () => ({
  getHeapUsed: jest.fn().mockReturnValue(0),
}));

jest.mock('@/utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/framework/iteration-manager', () => ({
  IterationManager: jest.fn().mockImplementation(() => ({
    startIteration: jest.fn().mockResolvedValue(undefined),
    completeIteration: jest.fn().mockResolvedValue({}),
    evaluateSuccessCriteria: jest.fn().mockReturnValue({ allMet: true, criteria: [] }),
    shouldCommit: jest.fn().mockReturnValue(false),
    generateCommitMessage: jest.fn().mockReturnValue(''),
    determineRecoveryStrategy: jest.fn().mockReturnValue('retry'),
    getSummary: jest.fn().mockReturnValue({
      totalIterations: 0,
      successfulIterations: 0,
      failedIterations: 0,
      finalStatus: 'in_progress',
      insights: [],
    }),
    linkToImprovementEngine: jest.fn(),
  })),
  createIterationManager: jest.fn().mockReturnValue({
    startIteration: jest.fn().mockResolvedValue(undefined),
    completeIteration: jest.fn().mockResolvedValue({}),
    evaluateSuccessCriteria: jest.fn().mockReturnValue({ allMet: true, criteria: [] }),
    shouldCommit: jest.fn().mockReturnValue(false),
    generateCommitMessage: jest.fn().mockReturnValue(''),
    determineRecoveryStrategy: jest.fn().mockReturnValue('retry'),
    getSummary: jest.fn().mockReturnValue({
      totalIterations: 0,
      successfulIterations: 0,
      failedIterations: 0,
      finalStatus: 'in_progress',
      insights: [],
    }),
  }),
  DEVELOPMENT_CYCLES: {
    'MVP構築': { phase: 'MVP構築', maxIterations: 3 },
    '内容分析': { phase: '内容分析', maxIterations: 5 },
    '図解生成': { phase: '図解生成', maxIterations: 4 },
    '品質向上': { phase: '品質向上', maxIterations: 5 },
  },
}));

jest.mock('@/framework/auto-improvement-engine', () => ({
  AutoImprovementEngine: jest.fn().mockImplementation(() => ({
    analyzeMetrics: jest.fn().mockReturnValue({ needsImprovement: false }),
    calculateQualityScore: jest.fn().mockReturnValue(80),
    linkIterationManager: jest.fn(),
    runImprovementCycle: jest.fn().mockResolvedValue({ improved: false }),
    getImprovementHistory: jest.fn().mockReturnValue([]),
    generateReport: jest.fn().mockReturnValue(''),
  })),
  createAutoImprovementEngine: jest.fn().mockReturnValue({
    analyzeMetrics: jest.fn().mockReturnValue({ needsImprovement: false }),
    calculateQualityScore: jest.fn().mockReturnValue(80),
    linkIterationManager: jest.fn(),
    runImprovementCycle: jest.fn().mockResolvedValue({ improved: false }),
    getImprovementHistory: jest.fn().mockReturnValue([]),
    generateReport: jest.fn().mockReturnValue(''),
  }),
}));

import {
  FrameworkIntegratedPipeline,
  createFrameworkIntegratedPipeline,
} from '@/pipeline/framework-integrated-pipeline';
import { MainPipeline } from '@/pipeline/main-pipeline';
import { createIterationManager } from '@/framework/iteration-manager';
import { createAutoImprovementEngine } from '@/framework/auto-improvement-engine';
import type { PipelineResult } from '@/pipeline/types';

// Access mock functions via requireMock for ESM compatibility
const MockMainPipeline = jest.requireMock('@/pipeline/main-pipeline').MainPipeline as jest.Mock;
const MockCreateIterationManager = jest.requireMock('@/framework/iteration-manager').createIterationManager as jest.Mock;
const MockCreateAutoImprovementEngine = jest.requireMock('@/framework/auto-improvement-engine').createAutoImprovementEngine as jest.Mock;

/** Exposes the private estimation methods for testing. */
type PipelinePrivateMethods = {
  estimateTranscriptionAccuracy: (result: PipelineResult) => number;
  estimateSegmentationQuality: (result: PipelineResult) => number;
  estimateEntityExtractionQuality: (result: PipelineResult) => number;
  estimateRelationAccuracy: (result: PipelineResult) => number;
  detectLayoutOverlaps: (result: PipelineResult) => number;
};

function makeScene(overrides: Record<string, unknown> = {}) {
  return {
    type: 'diagram',
    nodes: [],
    edges: [],
    startMs: 0,
    durationMs: 5000,
    summary: '',
    keyphrases: [],
    ...overrides,
  };
}

function makeResult(overrides: Partial<PipelineResult> = {}): PipelineResult {
  return {
    success: true,
    scenes: [],
    audioUrl: '',
    duration: 10000,
    processingTime: 1000,
    stages: [],
    ...overrides,
  } as PipelineResult;
}

describe('FrameworkIntegratedPipeline', () => {
  let pipeline: FrameworkIntegratedPipeline;

  beforeEach(() => {
    jest.clearAllMocks();
    pipeline = new FrameworkIntegratedPipeline();
  });

  // ── Constructor ──────────────────────────────────────────────

  describe('constructor', () => {
    it('should create an instance with defaults', () => {
      const p = new FrameworkIntegratedPipeline();
      expect(p).toBeInstanceOf(FrameworkIntegratedPipeline);
      expect(MockMainPipeline).toHaveBeenCalledWith(undefined);
      expect(MockCreateAutoImprovementEngine).toHaveBeenCalledWith(undefined);
    });

    it('should pass config to MainPipeline', () => {
      const config = { maxRetries: 5 };
      const thresholds = { minScore: 90 };
      const p = new FrameworkIntegratedPipeline(config, thresholds);
      expect(MockMainPipeline).toHaveBeenCalledWith(config);
      expect(MockCreateAutoImprovementEngine).toHaveBeenCalledWith(thresholds);
    });
  });

  // ── setPhase / Iteration ─────────────────────────────────────

  describe('setPhase', () => {
    it('should create iteration manager for the given phase', () => {
      pipeline.setPhase('内容分析');
      expect(MockCreateIterationManager).toHaveBeenCalledWith('内容分析');
    });
  });

  describe('getIterationSummary', () => {
    it('should return undefined when no iterationManager exists', () => {
      const summary = pipeline.getIterationSummary();
      expect(summary).toBeUndefined();
    });
  });

  // ── Improvement Engine ───────────────────────────────────────

  describe('getImprovementHistory', () => {
    it('should return array from improvement engine', () => {
      const history = pipeline.getImprovementHistory();
      expect(Array.isArray(history)).toBe(true);
    });
  });

  // ── generateReport ───────────────────────────────────────────

  describe('generateReport', () => {
    it('should include phase name in report', () => {
      const report = pipeline.generateReport();
      expect(report).toContain('## Phase: MVP構築');
    });

    it('should include iteration summary when manager exists', () => {
      pipeline.setPhase('品質向上');
      const report = pipeline.generateReport();
      expect(report).toContain('## Iteration Summary');
      expect(report).toContain('Total Iterations:');
      expect(report).toContain('Successful:');
      expect(report).toContain('Failed:');
    });
  });

  // ── Factory ──────────────────────────────────────────────────

  describe('createFrameworkIntegratedPipeline', () => {
    it('should create a FrameworkIntegratedPipeline instance', () => {
      const p = createFrameworkIntegratedPipeline();
      expect(p).toBeInstanceOf(FrameworkIntegratedPipeline);
    });
  });

  // ── estimateTranscriptionAccuracy ────────────────────────────

  describe('estimateTranscriptionAccuracy', () => {
    it('should return 0 for failed result', () => {
      const result = makeResult({ success: false });
      expect((pipeline as unknown as PipelinePrivateMethods).estimateTranscriptionAccuracy(result)).toBe(0);
    });

    it('should return 0.90 for successful result with scenes', () => {
      const result = makeResult({
        success: true,
        scenes: [makeScene()],
      });
      expect((pipeline as unknown as PipelinePrivateMethods).estimateTranscriptionAccuracy(result)).toBeCloseTo(0.90);
    });

    it('should return 0.50 for successful result with empty scenes', () => {
      const result = makeResult({ success: true, scenes: [] });
      expect((pipeline as unknown as PipelinePrivateMethods).estimateTranscriptionAccuracy(result)).toBeCloseTo(0.50);
    });
  });

  // ── estimateSegmentationQuality ──────────────────────────────

  describe('estimateSegmentationQuality', () => {
    it('should return 0 for failed result', () => {
      const result = makeResult({ success: false });
      expect((pipeline as unknown as PipelinePrivateMethods).estimateSegmentationQuality(result)).toBe(0);
    });

    it('should return base score for single scene', () => {
      const result = makeResult({
        success: true,
        scenes: [makeScene()],
        duration: 5000,
      });
      // single scene => sceneCount=1 (no count bonus), avgDuration=5000 (within 2000-15000, gets bonus)
      // 0.7 + 0.15 = 0.85
      expect((pipeline as unknown as PipelinePrivateMethods).estimateSegmentationQuality(result)).toBeCloseTo(0.85);
    });

    it('should add bonus for 2-10 scenes', () => {
      const result = makeResult({
        success: true,
        scenes: Array.from({ length: 5 }, () => makeScene()),
        duration: 50000, // avg 10000 per scene => within range bonus
      });
      // 0.7 + 0.15 (scene count) + 0.15 (duration) = 1.0 (capped)
      expect((pipeline as unknown as PipelinePrivateMethods).estimateSegmentationQuality(result)).toBeCloseTo(1.0);
    });

    it('should add bonus for reasonable duration', () => {
      const result = makeResult({
        success: true,
        scenes: [makeScene()],
        duration: 5000, // avg 5000 => within 2000-15000
      });
      // 0.7 + 0.15 (duration) = 0.85
      const score = (pipeline as unknown as PipelinePrivateMethods).estimateSegmentationQuality(result);
      expect(score).toBeGreaterThan(0.7);
      expect(score).toBeCloseTo(0.85);
    });

    it('should cap score at 1.0', () => {
      const result = makeResult({
        success: true,
        scenes: Array.from({ length: 5 }, () => makeScene()),
        duration: 50000,
      });
      expect((pipeline as unknown as PipelinePrivateMethods).estimateSegmentationQuality(result)).toBeLessThanOrEqual(1.0);
    });
  });

  // ── estimateEntityExtractionQuality ──────────────────────────

  describe('estimateEntityExtractionQuality', () => {
    it('should return 0.90 for 2-10 avg nodes per scene', () => {
      const result = makeResult({
        success: true,
        scenes: [
          makeScene({ nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }),
          makeScene({ nodes: [{ id: 'd' }, { id: 'e' }] }),
        ],
      });
      expect((pipeline as unknown as PipelinePrivateMethods).estimateEntityExtractionQuality(result)).toBeCloseTo(0.90);
    });

    it('should return 0.70 for 1-2 avg nodes per scene', () => {
      const result = makeResult({
        success: true,
        scenes: [
          makeScene({ nodes: [{ id: 'a' }] }),
        ],
      });
      // avgNodesPerScene = 1 which is >= 1 and < 2
      expect((pipeline as unknown as PipelinePrivateMethods).estimateEntityExtractionQuality(result)).toBeCloseTo(0.70);
    });

    it('should return 0.50 for >10 or 0 avg nodes per scene', () => {
      const result = makeResult({
        success: true,
        scenes: [
          makeScene({
            nodes: Array.from({ length: 15 }, (_, i) => ({ id: `n${i}` })),
          }),
        ],
      });
      // avgNodesPerScene = 15 which is > 10
      expect((pipeline as unknown as PipelinePrivateMethods).estimateEntityExtractionQuality(result)).toBeCloseTo(0.50);
    });
  });

  // ── estimateRelationAccuracy ─────────────────────────────────

  describe('estimateRelationAccuracy', () => {
    it('should return 0.85 for scenes with edges', () => {
      const result = makeResult({
        success: true,
        scenes: [
          makeScene({ edges: [{ source: 'a', target: 'b' }] }),
        ],
      });
      // avgEdgesPerScene = 1 which is >= 1
      expect((pipeline as unknown as PipelinePrivateMethods).estimateRelationAccuracy(result)).toBeCloseTo(0.85);
    });

    it('should return 0.60 for scenes without edges', () => {
      const result = makeResult({
        success: true,
        scenes: [
          makeScene({ nodes: [{ id: 'a' }], edges: [] }),
        ],
      });
      // scenesWithEdges is empty, avgEdgesPerScene = 0
      expect((pipeline as unknown as PipelinePrivateMethods).estimateRelationAccuracy(result)).toBeCloseTo(0.60);
    });
  });

  // ── detectLayoutOverlaps ─────────────────────────────────────

  describe('detectLayoutOverlaps', () => {
    it('should return 0 for non-overlapping nodes', () => {
      const result = makeResult({
        success: true,
        scenes: [
          makeScene({
            layout: {
              nodes: [
                { id: 'a', x: 0, y: 0, width: 100, height: 50 },
                { id: 'b', x: 200, y: 200, width: 100, height: 50 },
              ],
              edges: [],
            },
          }),
        ],
      });
      expect((pipeline as unknown as PipelinePrivateMethods).detectLayoutOverlaps(result)).toBe(0);
    });

    it('should count overlapping pairs correctly', () => {
      const result = makeResult({
        success: true,
        scenes: [
          makeScene({
            layout: {
              nodes: [
                { id: 'a', x: 0, y: 0, width: 100, height: 50 },
                { id: 'b', x: 50, y: 25, width: 100, height: 50 },
                { id: 'c', x: 500, y: 500, width: 100, height: 50 },
              ],
              edges: [],
            },
          }),
        ],
      });
      // a and b overlap, c does not overlap with a or b => 1 overlap
      expect((pipeline as unknown as PipelinePrivateMethods).detectLayoutOverlaps(result)).toBe(1);
    });

    it('should handle scenes without layouts', () => {
      const result = makeResult({
        success: true,
        scenes: [
          makeScene(), // no layout property
          makeScene({ layout: undefined }),
        ],
      });
      expect((pipeline as unknown as PipelinePrivateMethods).detectLayoutOverlaps(result)).toBe(0);
    });

    it('should use w/h fallback when width/height not present', () => {
      const result = makeResult({
        success: true,
        scenes: [
          makeScene({
            layout: {
              nodes: [
                { id: 'a', x: 0, y: 0, w: 80, h: 40 },
                { id: 'b', x: 40, y: 20, w: 80, h: 40 },
              ],
              edges: [],
            },
          }),
        ],
      });
      // a and b overlap (no width/height, falls back to w/h)
      expect((pipeline as unknown as PipelinePrivateMethods).detectLayoutOverlaps(result)).toBe(1);
    });
  });
});
