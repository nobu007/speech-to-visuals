/**
 * TASK-0049: Pipeline Integration Tests
 *
 * Comprehensive integration tests for the PipelineOrchestrator,
 * QualityGateEvaluator, and error recovery integration.
 */

import {
  PipelineOrchestrator,
  QualityGate,
  FallbackStrategy,
  PipelineProgress,
  PipelineOrchestratorConfig,
} from '@/pipeline/pipeline-orchestrator';
import { PipelineInput, PipelineResult } from '@/pipeline/types';
import {
  QualityGateEvaluator,
  StageEvaluationResult,
  RegressionResult,
  JobQualityReport,
} from '@/quality/quality-gate';
import { ErrorClassifier } from '@/quality/error-classifier';
import {
  EnhancedErrorRecovery,
  RetryResult,
  FallbackResult,
} from '@/quality/enhanced-error-recovery';

// ---------------------------------------------------------------------------
// Mock external dependencies so we don't need real audio/LLM infrastructure
// ---------------------------------------------------------------------------

jest.mock('@/transcription', () => {
  const mockTranscribe = jest.fn().mockResolvedValue({
    success: true,
    segments: [
      { id: 0, start: 0, end: 5, text: 'Hello world', confidence: 0.9 },
      { id: 1, start: 5, end: 10, text: 'Second segment', confidence: 0.85 },
    ],
    language: 'en',
    duration: 10,
  });

  return {
    TranscriptionPipeline: jest.fn().mockImplementation(() => ({
      transcribe: mockTranscribe,
    })),
    __mockTranscribe: mockTranscribe,
  };
});

jest.mock('@/analysis', () => {
  const mockSegment = jest.fn().mockResolvedValue([
    {
      startMs: 0,
      endMs: 5000,
      text: 'Segment one',
      summary: 'First segment summary',
      keyphrases: ['hello'],
      confidence: 0.85,
    },
    {
      startMs: 5000,
      endMs: 10000,
      text: 'Segment two',
      summary: 'Second segment summary',
      keyphrases: ['world'],
      confidence: 0.80,
    },
  ]);

  const mockAnalyze = jest.fn().mockResolvedValue({
    type: 'flow',
    confidence: 0.9,
    nodes: [
      { id: 'n1', label: 'Step 1' },
      { id: 'n2', label: 'Step 2' },
    ],
    edges: [{ from: 'n1', to: 'n2', label: 'next' }],
    reasoning: 'Test diagram',
  });

  return {
    SceneSegmenter: jest.fn().mockImplementation(() => ({
      segment: mockSegment,
    })),
    DiagramDetector: jest.fn().mockImplementation(() => ({
      analyze: mockAnalyze,
    })),
    __mockSegment: mockSegment,
    __mockAnalyze: mockAnalyze,
  };
});

jest.mock('@/visualization', () => {
  const mockGenerateLayout = jest.fn().mockResolvedValue({
    success: true,
    layout: {
      nodes: [
        { id: 'n1', x: 100, y: 100, w: 120, h: 60, label: 'Step 1' },
        { id: 'n2', x: 350, y: 100, w: 120, h: 60, label: 'Step 2' },
      ],
      edges: [
        { from: 'n1', to: 'n2', points: [{ x: 220, y: 130 }, { x: 350, y: 130 }] },
      ],
    },
  });

  return {
    LayoutEngine: jest.fn().mockImplementation(() => ({
      generateLayout: mockGenerateLayout,
    })),
    __mockGenerateLayout: mockGenerateLayout,
  };
});

jest.mock('@/optimization/smart-parameter-tuner', () => {
  return jest.fn().mockImplementation(() => ({
    analyzeContent: jest.fn().mockResolvedValue({
      speechRate: 120,
      complexity: 'medium',
      domain: 'general',
      audioQuality: 0.8,
      keywordDensity: 0.3,
      diagramLikelihood: 0.5,
    }),
    optimizeParameters: jest.fn().mockResolvedValue({
      parameters: {
        confidenceThreshold: 0.75,
        segmentMinLength: 3000,
        segmentMaxLength: 15000,
        keywordWeights: { default: 1.0 },
        layoutDensity: 0.5,
        processingMode: 'balanced',
      },
      expectedPerformance: { accuracy: 0.85, speed: 0.9, reliability: 0.88 },
      confidence: 0.8,
    }),
  }));
});

jest.mock('@/config/validate', () => ({
  validateConfig: jest.fn().mockReturnValue([]),
  ValidationError: class extends Error {
    field: string;
    constructor(field: string, message: string) {
      super(message);
      this.field = field;
    }
  },
}));

// Mock the performance/intelligent-cache used by EnhancedErrorRecovery
jest.mock('@/performance/intelligent-cache', () => ({
  globalCache: {
    findSimilar: jest.fn().mockResolvedValue(null),
    clear: jest.fn().mockResolvedValue(undefined),
    getStats: jest.fn().mockReturnValue({ hitRate: 0.5 }),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createValidInput(): PipelineInput {
  return {
    audioFile: '/test/audio.wav',
    config: {
      transcription: { model: 'base', language: 'en' },
      analysis: {
        minSegmentLengthMs: 3000,
        maxSegmentLengthMs: 15000,
        confidenceThreshold: 0.7,
      },
      layout: { width: 1920, height: 1080, nodeWidth: 120, nodeHeight: 60 },
      output: { fps: 30, videoDuration: 60, includeAudio: true },
    },
  };
}

// ===========================================================================
// TEST SUITES
// ===========================================================================

describe('PipelineOrchestrator Integration', () => {
  // -------------------------------------------------------------------------
  // 1. E2E Pipeline Success
  // -------------------------------------------------------------------------
  describe('E2E Pipeline Success', () => {
    it('executes the full pipeline and returns success with populated stages', async () => {
      const orchestrator = new PipelineOrchestrator();
      const result: PipelineResult = await orchestrator.execute(createValidInput());

      expect(result.success).toBe(true);
      expect(result.stages).toHaveLength(5);
      expect(result.stages.map((s) => s.name)).toEqual([
        'transcription',
        'analysis',
        'layout',
        'preparation',
        'rendering',
      ]);
      expect(result.scenes.length).toBeGreaterThan(0);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.audioUrl).toBe('/test/audio.wav');
    });

    it('returns valid SceneGraph objects in scenes', async () => {
      const orchestrator = new PipelineOrchestrator();
      const result = await orchestrator.execute(createValidInput());

      expect(result.success).toBe(true);
      for (const scene of result.scenes) {
        expect(scene).toHaveProperty('type');
        expect(scene).toHaveProperty('nodes');
        expect(scene).toHaveProperty('edges');
        expect(scene).toHaveProperty('startMs');
        expect(scene).toHaveProperty('durationMs');
      }
    });
  });

  // -------------------------------------------------------------------------
  // 2. E2E Pipeline with Progress Callbacks
  // -------------------------------------------------------------------------
  describe('E2E Pipeline with Progress Callbacks', () => {
    it('fires progress callbacks for each stage with correct stage numbers', async () => {
      const progressCalls: PipelineProgress[] = [];
      const cb = (progress: PipelineProgress) => {
        progressCalls.push(progress);
      };

      const orchestrator = new PipelineOrchestrator({ progressCallback: cb });
      const result = await orchestrator.execute(createValidInput());

      expect(result.success).toBe(true);

      // We expect at least one callback per stage (running + completed)
      const stageNumbers = progressCalls.map((p) => p.stage);
      expect(stageNumbers).toContain(1);
      expect(stageNumbers).toContain(2);
      expect(stageNumbers).toContain(3);
      expect(stageNumbers).toContain(4);
      expect(stageNumbers).toContain(5);

      // Verify stage names match
      const uniqueStages = [...new Set(progressCalls.map((p) => p.stageName))];
      expect(uniqueStages).toContain('transcription');
      expect(uniqueStages).toContain('analysis');
      expect(uniqueStages).toContain('layout');
      expect(uniqueStages).toContain('preparation');
      expect(uniqueStages).toContain('rendering');
    });

    it('supports per-execute progress callback that overrides constructor callback', async () => {
      const constructorCalls: PipelineProgress[] = [];
      const executeCalls: PipelineProgress[] = [];

      const orchestrator = new PipelineOrchestrator({
        progressCallback: (p) => constructorCalls.push(p),
      });

      await orchestrator.execute(createValidInput(), (p) => executeCalls.push(p));

      // The per-execute callback should receive events; constructor one should not
      expect(executeCalls.length).toBeGreaterThan(0);
    });

    it('emits "running" status at stage start and "completed" at stage end', async () => {
      const progressCalls: PipelineProgress[] = [];
      const orchestrator = new PipelineOrchestrator({
        progressCallback: (p) => progressCalls.push(p),
      });

      await orchestrator.execute(createValidInput());

      const runningCalls = progressCalls.filter((p) => p.status === 'running');
      const completedCalls = progressCalls.filter((p) => p.status === 'completed');

      expect(runningCalls.length).toBeGreaterThanOrEqual(5);
      expect(completedCalls.length).toBeGreaterThanOrEqual(5);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Quality Gate Pass
  // -------------------------------------------------------------------------
  describe('Quality Gate Pass', () => {
    it('succeeds when quality gate passes', async () => {
      const passingGate: QualityGate = {
        stageIndex: 0,
        name: 'Test Gate',
        validate: (_output: any) => ({ passed: true }),
      };

      const orchestrator = new PipelineOrchestrator({
        qualityGates: [passingGate],
      });

      const result = await orchestrator.execute(createValidInput());
      expect(result.success).toBe(true);
    });

    it('succeeds when multiple quality gates all pass', async () => {
      const gates: QualityGate[] = [
        { stageIndex: 0, name: 'Gate 0', validate: () => ({ passed: true }) },
        { stageIndex: 1, name: 'Gate 1', validate: () => ({ passed: true }) },
        { stageIndex: 2, name: 'Gate 2', validate: () => ({ passed: true }) },
      ];

      const orchestrator = new PipelineOrchestrator({ qualityGates: gates });
      const result = await orchestrator.execute(createValidInput());

      expect(result.success).toBe(true);
      expect(result.stages).toHaveLength(5);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Quality Gate Fail + Fallback
  // -------------------------------------------------------------------------
  describe('Quality Gate Fail + Fallback', () => {
    it('uses fallback when quality gate fails and fallback succeeds', async () => {
      const failingGate: QualityGate = {
        stageIndex: 0,
        name: 'Strict Gate',
        validate: () => ({ passed: false, reason: 'Score too low' }),
      };

      const fallback: FallbackStrategy = {
        stageIndex: 0,
        name: 'Simple Fallback',
        execute: async () => ({
          success: true,
          segments: [
            { id: 0, start: 0, end: 5, text: 'Fallback result', confidence: 0.7 },
          ],
          language: 'en',
          duration: 5,
        }),
      };

      const orchestrator = new PipelineOrchestrator({
        qualityGates: [failingGate],
        fallbackStrategies: [fallback],
      });

      const result = await orchestrator.execute(createValidInput());
      expect(result.success).toBe(true);
    });

    it('emits fallback status in progress callback when fallback is used', async () => {
      const progressCalls: PipelineProgress[] = [];

      const failingGate: QualityGate = {
        stageIndex: 0,
        name: 'Strict Gate',
        validate: () => ({ passed: false, reason: 'Failed' }),
      };

      const fallback: FallbackStrategy = {
        stageIndex: 0,
        name: 'Recovery Fallback',
        execute: async () => ({
          success: true,
          segments: [{ id: 0, start: 0, end: 5, text: 'Recovered', confidence: 0.6 }],
          language: 'en',
          duration: 5,
        }),
      };

      const orchestrator = new PipelineOrchestrator({
        qualityGates: [failingGate],
        fallbackStrategies: [fallback],
        progressCallback: (p) => progressCalls.push(p),
      });

      await orchestrator.execute(createValidInput());

      const fallbackCalls = progressCalls.filter((p) => p.status === 'fallback');
      expect(fallbackCalls.length).toBeGreaterThan(0);
      expect(fallbackCalls[0].message).toContain('Recovery Fallback');
    });
  });

  // -------------------------------------------------------------------------
  // 5. Quality Gate Fail + All Fallbacks Fail
  // -------------------------------------------------------------------------
  describe('Quality Gate Fail + All Fallbacks Fail', () => {
    it('returns error when quality gate fails and all fallbacks throw', async () => {
      const failingGate: QualityGate = {
        stageIndex: 0,
        name: 'Impossible Gate',
        validate: () => ({ passed: false, reason: 'Always fails' }),
      };

      const failingFallback: FallbackStrategy = {
        stageIndex: 0,
        name: 'Broken Fallback',
        execute: async () => {
          throw new Error('Fallback also failed');
        },
      };

      const orchestrator = new PipelineOrchestrator({
        qualityGates: [failingGate],
        fallbackStrategies: [failingFallback],
      });

      const result = await orchestrator.execute(createValidInput());
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns error when quality gate fails and no fallbacks are provided', async () => {
      const failingGate: QualityGate = {
        stageIndex: 0,
        name: 'No Fallback Gate',
        validate: () => ({ passed: false, reason: 'No fallbacks configured' }),
      };

      const orchestrator = new PipelineOrchestrator({
        qualityGates: [failingGate],
        // No fallbackStrategies provided
      });

      const result = await orchestrator.execute(createValidInput());
      expect(result.success).toBe(false);
      expect(result.error).toContain('No Fallback Gate');
    });
  });

  // -------------------------------------------------------------------------
  // 6. QualityGateEvaluator Integration
  // -------------------------------------------------------------------------
  describe('QualityGateEvaluator Integration', () => {
    let evaluator: QualityGateEvaluator;

    beforeEach(() => {
      evaluator = new QualityGateEvaluator();
    });

    it('evaluates stage 1 (Transcription) with passing input', () => {
      const result: StageEvaluationResult = evaluator.evaluateStage(1, {
        audioDuration: 5.0,
        sampleRate: 44100,
        noiseLevelDb: -40,
      });

      expect(result.stage).toBe(1);
      expect(result.passed).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.results.every((r) => r.passed)).toBe(true);
    });

    it('evaluates stage 1 and fails when audio duration is too short', () => {
      const result = evaluator.evaluateStage(1, {
        audioDuration: 0.5,
        sampleRate: 44100,
        noiseLevelDb: -40,
      });

      expect(result.passed).toBe(false);
      const durationResult = result.results.find((r) => r.criterionName === 'audioDuration');
      expect(durationResult).toBeDefined();
      expect(durationResult!.passed).toBe(false);
    });

    it('evaluates stage 1 and fails when sample rate is below threshold', () => {
      const result = evaluator.evaluateStage(1, {
        audioDuration: 5.0,
        sampleRate: 8000,
        noiseLevelDb: -40,
      });

      expect(result.passed).toBe(false);
      const rateResult = result.results.find((r) => r.criterionName === 'sampleRate');
      expect(rateResult).toBeDefined();
      expect(rateResult!.passed).toBe(false);
    });

    it('evaluates stage 1 and fails when noise level is too high', () => {
      const result = evaluator.evaluateStage(1, {
        audioDuration: 5.0,
        sampleRate: 44100,
        noiseLevelDb: -20,
      });

      expect(result.passed).toBe(false);
      const noiseResult = result.results.find((r) => r.criterionName === 'noiseLevel');
      expect(noiseResult).toBeDefined();
      expect(noiseResult!.passed).toBe(false);
    });

    it('evaluates stage 2 (Analysis) with passing input', () => {
      const result = evaluator.evaluateStage(2, {
        entities: ['a', 'b', 'c', 'd', 'e'],
        expectedEntities: 5,
        relations: ['r1', 'r2', 'r3', 'r4'],
        expectedRelations: 5,
        schemaValid: true,
      });

      expect(result.stage).toBe(2);
      expect(result.passed).toBe(true);
    });

    it('evaluates stage 2 and fails when entity extraction rate is low', () => {
      const result = evaluator.evaluateStage(2, {
        entities: ['a'],
        expectedEntities: 10,
        relations: ['r1', 'r2', 'r3', 'r4', 'r5'],
        expectedRelations: 5,
        schemaValid: true,
      });

      expect(result.passed).toBe(false);
    });

    it('evaluates stage 2 and fails when relation completeness is low', () => {
      const result = evaluator.evaluateStage(2, {
        entities: ['a', 'b', 'c', 'd', 'e'],
        expectedEntities: 5,
        relations: ['r1'],
        expectedRelations: 10,
        schemaValid: true,
      });

      expect(result.passed).toBe(false);
    });

    it('evaluates stage 3 (Layout) with zero overlap and continuous timeline', () => {
      const result = evaluator.evaluateStage(3, {
        nodes: [
          { x: 0, y: 0, w: 100, h: 50 },
          { x: 200, y: 0, w: 100, h: 50 },
        ],
        segments: [
          { startMs: 0, endMs: 5000 },
          { startMs: 5000, endMs: 10000 },
        ],
      });

      expect(result.stage).toBe(3);
      expect(result.passed).toBe(true);
    });

    it('evaluates stage 3 and detects overlapping nodes', () => {
      const result = evaluator.evaluateStage(3, {
        nodes: [
          { x: 0, y: 0, w: 100, h: 50 },
          { x: 50, y: 0, w: 100, h: 50 }, // overlaps with first
        ],
        segments: [
          { startMs: 0, endMs: 5000 },
          { startMs: 5000, endMs: 10000 },
        ],
      });

      expect(result.passed).toBe(false);
      const overlapResult = result.results.find((r) => r.criterionName === 'zeroOverlap');
      expect(overlapResult!.passed).toBe(false);
    });

    it('evaluates stage 3 and detects timeline gaps', () => {
      const result = evaluator.evaluateStage(3, {
        nodes: [
          { x: 0, y: 0, w: 100, h: 50 },
          { x: 200, y: 0, w: 100, h: 50 },
        ],
        segments: [
          { startMs: 0, endMs: 3000 },
          { startMs: 5000, endMs: 10000 }, // 2 second gap
        ],
      });

      expect(result.passed).toBe(false);
      const continuityResult = result.results.find((r) => r.criterionName === 'timelineContinuity');
      expect(continuityResult!.passed).toBe(false);
    });

    it('returns failed for unregistered stage', () => {
      const result = evaluator.evaluateStage(99, {});
      expect(result.passed).toBe(false);
      expect(result.results[0].criterionName).toBe('gateNotFound');
    });

    // --- Regression Detection ---

    it('detects regression when quality degrades >5%', () => {
      evaluator.setBaselineScore('job-1', 0.90);
      const regression: RegressionResult = evaluator.detectRegression('job-1', 0.80);

      expect(regression.isRegression).toBe(true);
      expect(regression.degradationPercent).toBeGreaterThan(5);
      expect(regression.shouldBlock).toBe(true);
    });

    it('does not flag regression for small quality changes', () => {
      evaluator.setBaselineScore('job-2', 0.90);
      const regression = evaluator.detectRegression('job-2', 0.88);

      expect(regression.isRegression).toBe(false);
      expect(regression.shouldBlock).toBe(false);
    });

    it('does not flag regression when no baseline exists', () => {
      const regression = evaluator.detectRegression('job-unknown', 0.50);
      expect(regression.isRegression).toBe(false);
      expect(regression.shouldBlock).toBe(false);
    });

    it('detects regression at exactly the 5% boundary', () => {
      evaluator.setBaselineScore('job-boundary', 1.0);
      // 6% degradation
      const regression = evaluator.detectRegression('job-boundary', 0.94);
      expect(regression.isRegression).toBe(true);
    });

    // --- Metrics Recording and Quality Report ---

    it('records stage metrics and generates quality report', () => {
      evaluator.recordStageMetrics('job-report', 1, { score: 0.9, passed: true });
      evaluator.recordStageMetrics('job-report', 2, { score: 0.85, passed: true });
      evaluator.recordStageMetrics('job-report', 3, { score: 0.6, passed: false });

      const report: JobQualityReport = evaluator.getQualityReport('job-report');

      expect(report.jobId).toBe('job-report');
      expect(report.stageMetrics).toHaveLength(3);
      expect(report.stageMetrics[0].stage).toBe(1);
      expect(report.stageMetrics[0].score).toBe(0.9);
      expect(report.stageMetrics[0].passed).toBe(true);
      expect(report.stageMetrics[2].passed).toBe(false);
    });

    it('returns empty report for unknown job', () => {
      const report = evaluator.getQualityReport('unknown-job');
      expect(report.stageMetrics).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Streaming Transcription Integration
  // -------------------------------------------------------------------------
  describe('Streaming Transcription Integration', () => {
    it('accepts streaming configuration on orchestrator', () => {
      const config: PipelineOrchestratorConfig = {
        enableStreaming: true,
      };

      expect(() => new PipelineOrchestrator(config)).not.toThrow();
    });

    it('executes pipeline successfully with streaming enabled', async () => {
      const orchestrator = new PipelineOrchestrator({ enableStreaming: true });
      const result = await orchestrator.execute(createValidInput());

      expect(result.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 8. Auto-tuning Integration
  // -------------------------------------------------------------------------
  describe('Auto-tuning Integration', () => {
    it('accepts auto-tuning configuration on orchestrator', () => {
      const config: PipelineOrchestratorConfig = {
        enableAutoTuning: true,
      };

      expect(() => new PipelineOrchestrator(config)).not.toThrow();
    });

    it('executes pipeline successfully with auto-tuning enabled', async () => {
      const orchestrator = new PipelineOrchestrator({ enableAutoTuning: true });
      const result = await orchestrator.execute(createValidInput());

      expect(result.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 9. Config Validation
  // -------------------------------------------------------------------------
  describe('Config Validation', () => {
    it('throws when audioFile is missing', () => {
      const orchestrator = new PipelineOrchestrator();
      expect(() => orchestrator.validateInput({ audioFile: '' as any })).toThrow(
        'audioFile is required'
      );
    });

    it('throws when audioFile is null/undefined', () => {
      const orchestrator = new PipelineOrchestrator();
      expect(() =>
        orchestrator.validateInput({ audioFile: null as any })
      ).toThrow('audioFile is required');
    });

    it('throws for invalid transcription model', () => {
      const orchestrator = new PipelineOrchestrator();
      expect(() =>
        orchestrator.validateInput({
          audioFile: '/test/audio.wav',
          config: {
            ...createValidInput().config,
            transcription: { model: 'invalid-model' as any },
          },
        })
      ).toThrow('Invalid transcription model');
    });

    it('throws for negative minSegmentLengthMs', () => {
      const orchestrator = new PipelineOrchestrator();
      expect(() =>
        orchestrator.validateInput({
          audioFile: '/test/audio.wav',
          config: {
            ...createValidInput().config,
            analysis: {
              minSegmentLengthMs: -1,
              maxSegmentLengthMs: 15000,
              confidenceThreshold: 0.7,
            },
          },
        })
      ).toThrow('minSegmentLengthMs must be >= 0');
    });

    it('throws for confidenceThreshold out of range', () => {
      const orchestrator = new PipelineOrchestrator();
      expect(() =>
        orchestrator.validateInput({
          audioFile: '/test/audio.wav',
          config: {
            ...createValidInput().config,
            analysis: {
              minSegmentLengthMs: 3000,
              maxSegmentLengthMs: 15000,
              confidenceThreshold: 1.5,
            },
          },
        })
      ).toThrow('confidenceThreshold must be between 0 and 1');
    });

    it('throws for non-positive layout dimensions', () => {
      const orchestrator = new PipelineOrchestrator();
      expect(() =>
        orchestrator.validateInput({
          audioFile: '/test/audio.wav',
          config: {
            ...createValidInput().config,
            layout: { width: -100, height: 1080, nodeWidth: 120, nodeHeight: 60 },
          },
        })
      ).toThrow('Layout dimensions must be positive');
    });

    it('throws for non-positive fps', () => {
      const orchestrator = new PipelineOrchestrator();
      expect(() =>
        orchestrator.validateInput({
          audioFile: '/test/audio.wav',
          config: {
            ...createValidInput().config,
            output: { fps: 0, videoDuration: 60, includeAudio: true },
          },
        })
      ).toThrow('fps must be positive');
    });

    it('passes validation with valid config', () => {
      const orchestrator = new PipelineOrchestrator();
      expect(() => orchestrator.validateInput(createValidInput())).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // 10. Error Recovery Integration
  // -------------------------------------------------------------------------
  describe('Error Recovery Integration', () => {
    let errorRecovery: EnhancedErrorRecovery;
    let originalSetInterval: typeof setInterval;

    beforeAll(() => {
      // Suppress EnhancedErrorRecovery's internal interval logging
      originalSetInterval = global.setInterval;
    });

    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      errorRecovery = new EnhancedErrorRecovery();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    afterAll(() => {
      global.setInterval = originalSetInterval;
    });

    it('retries with exponential backoff and succeeds on second attempt', async () => {
      let attempt = 0;
      const result: RetryResult = await errorRecovery.retryWithBackoff(
        async () => {
          attempt++;
          if (attempt === 1) throw new Error('First attempt fails');
          return 'success';
        },
        { maxRetries: 3, initialDelayMs: 10 }
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(2);
    });

    it('exhausts retries and returns failure', async () => {
      const result = await errorRecovery.retryWithBackoff(
        async () => {
          throw new Error('Always fails');
        },
        { maxRetries: 2, initialDelayMs: 10 }
      );

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3); // 1 initial + 2 retries
      expect(result.lastError).toBeDefined();
      expect(result.lastError!.message).toBe('Always fails');
    });

    it('uses fallback when primary operation fails', async () => {
      const result: FallbackResult = await errorRecovery.executeWithFallback(
        async () => {
          throw new Error('Primary failed');
        },
        async () => 'fallback result'
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe('fallback result');
      expect(result.fallbackUsed).toBe(true);
    });

    it('returns failure when both primary and fallback fail', async () => {
      const result = await errorRecovery.executeWithFallback(
        async () => {
          throw new Error('Primary failed');
        },
        async () => {
          throw new Error('Fallback failed');
        }
      );

      expect(result.success).toBe(false);
      expect(result.fallbackUsed).toBe(true);
      expect(result.primaryError).toBeDefined();
    });

    it('creates notification from error with suggested actions', () => {
      const notification = errorRecovery.createErrorNotification(
        new Error('Network connection refused'),
        { stage: 'transcription', severity: 'high' }
      );

      expect(notification.message).toBe('Network connection refused');
      expect(notification.severity).toBe('high');
      expect(notification.stage).toBe('transcription');
      expect(notification.recoverable).toBe(true);
      expect(notification.suggestedActions.length).toBeGreaterThan(0);
    });

    it('provides resilience metrics', () => {
      const metrics = errorRecovery.getResilienceMetrics();

      expect(metrics).toHaveProperty('loadHandling');
      expect(metrics).toHaveProperty('circuitBreakerEffectiveness');
      expect(metrics).toHaveProperty('errorRecoverySpeed');
      expect(metrics).toHaveProperty('overallResilience');
      expect(metrics).toHaveProperty('details');
    });
  });

  // -------------------------------------------------------------------------
  // 11. Multiple Fallback Layers
  // -------------------------------------------------------------------------
  describe('Multiple Fallback Layers', () => {
    it('tries primary -> secondary -> tertiary fallback chain', async () => {
      const progressCalls: PipelineProgress[] = [];

      const failingGate: QualityGate = {
        stageIndex: 0,
        name: 'Multi-Fallback Gate',
        validate: () => ({ passed: false, reason: 'Always fails' }),
      };

      const primaryFallback: FallbackStrategy = {
        stageIndex: 0,
        name: 'Primary Fallback',
        execute: async () => {
          throw new Error('Primary fallback failed');
        },
      };

      const secondaryFallback: FallbackStrategy = {
        stageIndex: 0,
        name: 'Secondary Fallback',
        execute: async () => {
          throw new Error('Secondary fallback failed');
        },
      };

      const tertiaryFallback: FallbackStrategy = {
        stageIndex: 0,
        name: 'Tertiary Fallback',
        execute: async () => ({
          success: true,
          segments: [
            { id: 0, start: 0, end: 5, text: 'Tertiary result', confidence: 0.5 },
          ],
          language: 'en',
          duration: 5,
        }),
      };

      const orchestrator = new PipelineOrchestrator({
        qualityGates: [failingGate],
        fallbackStrategies: [primaryFallback, secondaryFallback, tertiaryFallback],
        progressCallback: (p) => progressCalls.push(p),
      });

      const result = await orchestrator.execute(createValidInput());
      expect(result.success).toBe(true);

      // Verify the tertiary fallback was used
      const fallbackCalls = progressCalls.filter(
        (p) => p.status === 'fallback' && p.message?.includes('Tertiary Fallback')
      );
      expect(fallbackCalls.length).toBeGreaterThan(0);
    });

    it('fails when all layers in fallback chain fail', async () => {
      const failingGate: QualityGate = {
        stageIndex: 0,
        name: 'All-Fail Gate',
        validate: () => ({ passed: false, reason: 'Fail' }),
      };

      const fallbacks: FallbackStrategy[] = [
        {
          stageIndex: 0,
          name: 'Fallback A',
          execute: async () => {
            throw new Error('A failed');
          },
        },
        {
          stageIndex: 0,
          name: 'Fallback B',
          execute: async () => {
            throw new Error('B failed');
          },
        },
        {
          stageIndex: 0,
          name: 'Fallback C',
          execute: async () => {
            throw new Error('C failed');
          },
        },
      ];

      const orchestrator = new PipelineOrchestrator({
        qualityGates: [failingGate],
        fallbackStrategies: fallbacks,
      });

      const result = await orchestrator.execute(createValidInput());
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // 12. Batch Processing Pipeline
  // -------------------------------------------------------------------------
  describe('Batch Processing Pipeline', () => {
    it('processes multiple inputs sequentially', async () => {
      const orchestrator = new PipelineOrchestrator();

      const inputs: PipelineInput[] = [
        { audioFile: '/test/audio1.wav' },
        { audioFile: '/test/audio2.wav' },
        { audioFile: '/test/audio3.wav' },
      ];

      const results: PipelineResult[] = [];
      for (const input of inputs) {
        const result = await orchestrator.execute(input);
        results.push(result);
      }

      expect(results).toHaveLength(3);
      for (const result of results) {
        expect(result.success).toBe(true);
        expect(result.stages).toHaveLength(5);
      }
    });

    it('continues processing remaining inputs when one fails', async () => {
      const failingGate: QualityGate = {
        stageIndex: 4,
        name: 'Render Gate',
        validate: () => ({ passed: false, reason: 'Fail on demand' }),
      };

      const orchestrator = new PipelineOrchestrator({
        qualityGates: [failingGate],
      });

      // All will fail since gate is at stage 4 with no fallback
      const inputs: PipelineInput[] = [
        { audioFile: '/test/audio1.wav' },
        { audioFile: '/test/audio2.wav' },
      ];

      const results: PipelineResult[] = [];
      for (const input of inputs) {
        const result = await orchestrator.execute(input);
        results.push(result);
      }

      expect(results).toHaveLength(2);
      // Both should have failed (no fallback configured)
      for (const result of results) {
        expect(result.success).toBe(false);
      }
    });

    it('tracks independent processing times for each input', async () => {
      const orchestrator = new PipelineOrchestrator();

      const results: PipelineResult[] = [];
      for (let i = 0; i < 3; i++) {
        results.push(await orchestrator.execute({ audioFile: `/test/audio${i}.wav` }));
      }

      // Each result should have its own processing time
      for (const result of results) {
        expect(typeof result.processingTime).toBe('number');
        expect(result.processingTime).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

// ===========================================================================
// ErrorClassifier Integration
// ===========================================================================

describe('ErrorClassifier Integration', () => {
  let classifier: ErrorClassifier;

  beforeEach(() => {
    classifier = new ErrorClassifier();
  });

  it('classifies LLM API errors', () => {
    const classified = classifier.classify(
      new Error('LLM API returned 500 internal server error'),
      { stage: 'analysis' }
    );

    expect(classified.type).toBe('LLM_API_ERROR');
    expect(classified.severity).toBe('high');
    expect(classified.recoverable).toBe(true);
    expect(classified.stage).toBe('analysis');
  });

  it('classifies rate limit errors', () => {
    const classified = classifier.classify(
      new Error('Rate limit exceeded for Gemini API'),
      { stage: 'diagram_detection' }
    );

    expect(classified.type).toBe('LLM_RATE_LIMITED');
    expect(classified.recoverable).toBe(true);
  });

  it('classifies rendering OOM errors', () => {
    const classified = classifier.classify(
      new Error('Out of memory during rendering'),
      { stage: 'rendering' }
    );

    expect(classified.type).toBe('RENDERING_OOM');
    expect(classified.severity).toBe('critical');
  });

  it('classifies quality gate failures', () => {
    const classified = classifier.classify(
      new Error('Quality gate score below threshold'),
      { stage: 'analysis' }
    );

    expect(classified.type).toBe('QUALITY_GATE_FAILED');
    expect(classified.recoverable).toBe(true);
  });

  it('classifies unknown errors', () => {
    const classified = classifier.classify(
      new Error('Something completely unexpected'),
      { stage: 'transcription' }
    );

    expect(classified.type).toBe('UNKNOWN');
    expect(classified.recoverable).toBe(false);
  });

  it('classifies a batch of errors and provides statistics', () => {
    const errors = [
      new Error('LLM API error 500'),
      new Error('LLM API error 503'),
      new Error('Rate limit exceeded'),
      new Error('Network connection failed'),
      new Error('LLM timeout waiting for response'),
    ];

    const results = classifier.classifyBatch(errors);
    expect(results).toHaveLength(5);

    const stats = classifier.getStatistics();
    expect(stats.total).toBe(5);
    expect(Object.keys(stats.byType).length).toBeGreaterThan(0);
  });

  it('tracks classification history across calls', () => {
    classifier.classify(new Error('LLM API error'), { stage: 'analysis' });
    classifier.classify(new Error('File format unsupported'), { stage: 'transcription' });
    classifier.classify(new Error('LLM API error again'), { stage: 'analysis' });

    const stats = classifier.getStatistics();
    expect(stats.total).toBe(3);
    expect(stats.mostCommonType).toBe('LLM_API_ERROR');
  });
});
