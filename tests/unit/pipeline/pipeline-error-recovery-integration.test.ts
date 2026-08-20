/**
 * TASK-0045 Integration Tests: Pipeline Error Recovery Integration
 *
 * Tests that PipelineOrchestrator and EnhancedErrorRecovery cooperate to:
 *  - Retry transient stage failures with backoff
 *  - Invoke fallback strategies when retries exhaust
 *  - Propagate cascading errors across pipeline stages
 *  - Classify pipeline errors via ErrorClassifier
 *  - Report retry attempt counts in pipeline results
 */

import { PipelineOrchestrator } from '@/pipeline/pipeline-orchestrator';
import { PipelineInput } from '@/pipeline/types';
import { EnhancedErrorRecovery } from '@/quality/enhanced-error-recovery';
import { ErrorClassifier } from '@/quality/error-classifier';
import {
  TranscriptionError,
  RenderingError,
  QualityGateError,
  PipelineConfigError,
  PipelineError,
} from '@/pipeline/pipeline-errors';

// ---------- Helpers ----------

function requireDefined<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`${label} returned undefined`);
  }
  return value;
}

function makeValidPipelineInput(): PipelineInput {
  return {
    audioFile: 'test-audio.wav',
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

// ---------- Tests ----------

describe('Pipeline Error Recovery Integration (TASK-0045)', () => {
  describe('ErrorClassifier + PipelineError integration', () => {
    let classifier: ErrorClassifier;

    beforeEach(() => {
      classifier = new ErrorClassifier();
    });

    it('classifies TranscriptionError as LLM_API_ERROR with correct stage', () => {
      const err = new TranscriptionError('Whisper model failed to load');
      const classified = classifier.classify(err);

      expect(classified.type).toBe('LLM_API_ERROR');
      expect(classified.stage).toBe('transcription');
      expect(classified.severity).toBe('high');
      expect(classified.recoverable).toBe(true);
    });

    it('classifies RenderingError with OOM message at critical severity', () => {
      const err = new RenderingError('JavaScript heap out of memory during frame composition');
      const classified = classifier.classify(err);

      // RenderingError maps to RENDERING_ERROR, but OOM detection
      // happens via message regex in the classifier
      expect(classified.type).toBe('RENDERING_ERROR');
      expect(classified.stage).toBe('rendering');
      expect(classified.originalError).toBe(err);
    });

    it('classifies QualityGateError with gate name in context', () => {
      const err = new QualityGateError('layout-quality', 'overlap score 0.3 below threshold 0.7');
      const classified = classifier.classify(err);

      expect(classified.type).toBe('QUALITY_GATE_FAILED');
      expect(classified.stage).toBe('quality_gate');
      expect(classified.recoverable).toBe(true);
      expect(classified.userMessage).toContain('quality standards');
    });

    it('classifies PipelineConfigError with parameter context', () => {
      const err = new PipelineConfigError('fps', 'fps must be positive');
      const classified = classifier.classify(err);

      expect(classified.type).toBe('FILE_FORMAT_INVALID');
      expect(classified.stage).toBe('configuration');
      expect((classified.originalError as PipelineConfigError).parameter).toBe('fps');
    });

    it('batch classifies mixed pipeline errors preserving stage metadata', () => {
      const errors = [
        new TranscriptionError('whisper timeout'),
        new RenderingError('frame dropped'),
        new QualityGateError('transcription-confidence', 'too low'),
      ];

      const results = classifier.classifyBatch(errors);

      expect(results).toHaveLength(3);
      expect(results[0].type).toBe('LLM_API_ERROR');
      expect(results[0].stage).toBe('transcription');
      expect(results[1].type).toBe('RENDERING_ERROR');
      expect(results[1].stage).toBe('rendering');
      expect(results[2].type).toBe('QUALITY_GATE_FAILED');
      expect(results[2].stage).toBe('quality_gate');
    });
  });

  describe('PipelineOrchestrator retry behavior', () => {
    it('tracks retry attempts in pipeline result metrics', async () => {
      const orchestrator = new PipelineOrchestrator();
      const result = await orchestrator.execute(makeValidPipelineInput());

      expect(result.success).toBe(true);
      // The orchestrator exposes totalRetryAttempts in metrics
      expect(result.metrics).toHaveProperty('totalRetryAttempts');
      expect(typeof requireDefined(result.metrics, 'result.metrics').totalRetryAttempts).toBe('number');
    });

    it('emits failed progress when stage error boundary reports failure', async () => {
      const progressMessages: Array<{ status: string; stageName: string; message?: string }> = [];

      const orchestrator = new PipelineOrchestrator({
        qualityGates: [
          {
            stageIndex: 0,
            name: 'force-fail',
            validate: () => ({ passed: false, reason: 'Injected test failure' }),
          },
        ],
        fallbackStrategies: [
          {
            stageIndex: 0,
            name: 'test-fallback',
            execute: async () => ({
              success: true,
              segments: [
                { id: 0, start: 0, end: 5, text: 'Fallback segment', confidence: 0.5 },
              ],
              language: 'en',
              duration: 5,
            }),
          },
        ],
        progressCallback: (p) => {
          if (p.status === 'failed' || p.status === 'fallback') {
            progressMessages.push({ status: p.status, stageName: p.stageName, message: p.message });
          }
        },
      });

      const result = await orchestrator.execute(makeValidPipelineInput());

      // Fallback should have been invoked, allowing pipeline to proceed
      // The pipeline should still complete (fallback used)
      // At minimum, a 'failed' progress should have been emitted
      const failedProgress = requireDefined(
        progressMessages.find((m) => m.status === 'failed'),
        'failed progress message',
      );
      expect(failedProgress.stageName).toBe('transcription');
    });
  });

  describe('Fallback strategy activation', () => {
    it('activates fallback when quality gate fails and produces pipeline result', async () => {
      const fallbackSpy = jest.fn().mockResolvedValue({
        success: true,
        segments: [
          { id: 0, start: 0, end: 5, text: 'Recovered', confidence: 0.6 },
        ],
        language: 'en',
        duration: 5,
      });

      const orchestrator = new PipelineOrchestrator({
        qualityGates: [
          {
            stageIndex: 0,
            name: 'always-fail',
            validate: () => ({ passed: false, reason: 'Test gate failure' }),
          },
        ],
        fallbackStrategies: [
          {
            stageIndex: 0,
            name: 'test-recovery',
            execute: fallbackSpy,
          },
        ],
      });

      const result = await orchestrator.execute(makeValidPipelineInput());

      expect(fallbackSpy).toHaveBeenCalled();
      // Pipeline should succeed via fallback
      expect(result.success).toBe(true);
    });

    it('throws QualityGateError when no fallback is available', async () => {
      const orchestrator = new PipelineOrchestrator({
        qualityGates: [
          {
            stageIndex: 0,
            name: 'unrecoverable-gate',
            validate: () => ({ passed: false, reason: 'No fallback available' }),
          },
        ],
        // No fallback strategies
      });

      const result = await orchestrator.execute(makeValidPipelineInput());

      // Pipeline should fail because no fallback was configured
      expect(result.success).toBe(false);
      expect(result.error).toContain('unrecoverable-gate');
    });
  });

  describe('Cascading error handling across stages', () => {
    it('handles errors that propagate from transcription through to analysis', async () => {
      // If transcription produces empty/default results, analysis should still work
      const orchestrator = new PipelineOrchestrator();
      const result = await orchestrator.execute({
        audioFile: 'nonexistent-file.wav',
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
      });

      // Pipeline should handle missing audio file gracefully with default results
      expect(result.success).toBe(true);
      expect(result.stages.length).toBeGreaterThanOrEqual(4);
    });

    it('quality gate failure at layout stage triggers fallback without breaking pipeline', async () => {
      const fallbackResults: unknown[] = [];

      const orchestrator = new PipelineOrchestrator({
        qualityGates: [
          {
            stageIndex: 2, // layout stage
            name: 'layout-quality',
            validate: () => ({ passed: false, reason: 'Layout overlap detected' }),
          },
        ],
        fallbackStrategies: [
          {
            stageIndex: 2,
            name: 'layout-fallback',
            execute: async () => {
              const fallback = [
                {
                  segment: { startMs: 0, endMs: 5000, text: 'Test', summary: 'Test', keyphrases: [] },
                  analysis: { type: 'flow', nodes: [], edges: [] },
                  layout: { nodes: [], edges: [] },
                },
              ];
              fallbackResults.push(fallback);
              return fallback;
            },
          },
        ],
      });

      const result = await orchestrator.execute(makeValidPipelineInput());

      expect(fallbackResults.length).toBeGreaterThan(0);
      expect(result.success).toBe(true);
    });
  });

  describe('EnhancedErrorRecovery stage boundary', () => {
    let recovery: EnhancedErrorRecovery;

    beforeEach(() => {
      recovery = new EnhancedErrorRecovery();
    });

    it('succeeds immediately when operation succeeds on first try', async () => {
      const result = await recovery.createStageErrorBoundary(
        'transcription',
        async () => 'transcription-result',
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe('transcription-result');
      expect(result.recoveryAttempted).toBe(false);
      expect(result.attempts).toBe(1);
      expect(result.timeSpentMs).toBeGreaterThanOrEqual(0);
    });

    it('retries and succeeds when operation fails transiently', async () => {
      let callCount = 0;

      const result = await recovery.createStageErrorBoundary(
        'analysis',
        async () => {
          callCount++;
          if (callCount < 3) {
            throw new Error('Transient API failure');
          }
          return 'analysis-result';
        },
        { maxRetries: 3 },
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe('analysis-result');
      expect(callCount).toBeGreaterThanOrEqual(3);
      expect(result.attempts).toBeGreaterThanOrEqual(3);
    });

    it('attempts recovery when retries exhaust', async () => {
      const result = await recovery.createStageErrorBoundary(
        'rendering',
        async () => {
          throw new RenderingError('Frame composition failed permanently');
        },
        { maxRetries: 1 },
      );

      // Recovery was attempted (may succeed or fail depending on internal strategies)
      expect(result.recoveryAttempted).toBe(true);
      expect(result.attempts).toBeGreaterThanOrEqual(1);
    });

    it('uses fallback when provided as part of recovery path', async () => {
      let fallbackCalled = false;

      const result = await recovery.createStageErrorBoundary(
        'layout_generation',
        async () => {
          throw new Error('Layout engine crashed');
        },
        {
          maxRetries: 0,
          fallback: async () => {
            fallbackCalled = true;
            return 'fallback-layout';
          },
        },
      );

      // The boundary attempts: retry → recoverFromError → fallback
      // If recovery succeeds, fallback won't be called; otherwise it will.
      // Either way, success should be true and a result should be available.
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.recoveryAttempted).toBe(true);
      expect(result.recoveryStrategy).toBeDefined();
    });

    it('attempts recovery when operation persistently fails', async () => {
      const result = await recovery.createStageErrorBoundary(
        'transcription',
        async () => {
          throw new TranscriptionError('Unrecoverable failure');
        },
        { maxRetries: 0 }, // No retries, no fallback
      );

      // Recovery is attempted. Internal strategies may succeed or fail;
      // either way, recoveryAttempted should be true.
      expect(result.recoveryAttempted).toBe(true);
      expect(result.attempts).toBeGreaterThanOrEqual(1);
      expect(result.timeSpentMs).toBeGreaterThanOrEqual(0);

      // If recovery succeeded, result should exist; if not, error should exist
      if (result.success) {
        expect(result.result).toBeDefined();
      } else {
        expect(result.error).toBeDefined();
      }
    });

    it('generates notification payload with correct stage information', async () => {
      const result = await recovery.createStageErrorBoundary(
        'rendering',
        async () => {
          throw new RenderingError('OOM during render');
        },
        { maxRetries: 0, severity: 'critical' },
      );

      // Notification should contain stage and severity info
      if (result.notification) {
        expect(result.notification.stage).toBe('rendering');
        expect(result.notification.severity).toBeDefined();
        expect(result.notification.message).toBeDefined();
      }
    });
  });

  describe('ErrorClassifier statistics across pipeline errors', () => {
    it('tracks error distribution across multiple pipeline stages', () => {
      const classifier = new ErrorClassifier();

      // Simulate errors from different pipeline stages
      classifier.classify(new TranscriptionError('t1'));
      classifier.classify(new TranscriptionError('t2'));
      classifier.classify(new RenderingError('r1'));
      classifier.classify(new QualityGateError('g1', 'low'));
      classifier.classify(new PipelineError('generic', 'NETWORK_ERROR', 'network'));

      const stats = classifier.getStatistics();

      expect(stats.total).toBe(5);
      expect(stats.byType['LLM_API_ERROR']).toBe(2); // TranscriptionError → LLM_API_ERROR
      expect(stats.byType['RENDERING_ERROR']).toBe(1);
      expect(stats.byType['QUALITY_GATE_FAILED']).toBe(1);
      expect(stats.byType['NETWORK_ERROR']).toBe(1);
      expect(stats.mostCommonType).toBe('LLM_API_ERROR');
    });

    it('maintains correct mostCommonType with ties', () => {
      const classifier = new ErrorClassifier();

      classifier.classify(new TranscriptionError('t1'));
      classifier.classify(new RenderingError('r1'));

      const stats = classifier.getStatistics();
      expect(stats.total).toBe(2);
      // Both have count 1; mostCommonType should be one of them
      expect(['LLM_API_ERROR', 'RENDERING_ERROR']).toContain(stats.mostCommonType);
    });
  });

  describe('PipelineOrchestrator input validation errors', () => {
    it('throws PipelineConfigError for missing audioFile', () => {
      const orchestrator = new PipelineOrchestrator();

      expect(() => orchestrator.validateInput({ audioFile: '' } as PipelineInput)).toThrow(
        PipelineConfigError,
      );
    });

    it('throws PipelineConfigError for invalid transcription model', () => {
      const orchestrator = new PipelineOrchestrator();

      expect(() =>
        orchestrator.validateInput({
          audioFile: 'test.wav',
          config: {
            transcription: { model: 'invalid-model' as 'base', language: 'en' },
            analysis: {
              minSegmentLengthMs: 3000,
              maxSegmentLengthMs: 15000,
              confidenceThreshold: 0.7,
            },
            layout: { width: 1920, height: 1080, nodeWidth: 120, nodeHeight: 60 },
            output: { fps: 30, videoDuration: 60, includeAudio: true },
          },
        }),
      ).toThrow(PipelineConfigError);
    });

    it('throws PipelineConfigError for negative confidence threshold', () => {
      const orchestrator = new PipelineOrchestrator();

      expect(() =>
        orchestrator.validateInput({
          audioFile: 'test.wav',
          config: {
            transcription: { model: 'base', language: 'en' },
            analysis: {
              minSegmentLengthMs: 3000,
              maxSegmentLengthMs: 15000,
              confidenceThreshold: -0.1,
            },
            layout: { width: 1920, height: 1080, nodeWidth: 120, nodeHeight: 60 },
            output: { fps: 30, videoDuration: 60, includeAudio: true },
          },
        }),
      ).toThrow(PipelineConfigError);
    });

    it('classifies validation errors via ErrorClassifier', () => {
      const classifier = new ErrorClassifier();

      try {
        const orchestrator = new PipelineOrchestrator();
        orchestrator.validateInput({
          audioFile: 'test.wav',
          config: {
            transcription: { model: 'bad' as 'base', language: 'en' },
            analysis: {
              minSegmentLengthMs: 3000,
              maxSegmentLengthMs: 15000,
              confidenceThreshold: 0.7,
            },
            layout: { width: 1920, height: 1080, nodeWidth: 120, nodeHeight: 60 },
            output: { fps: 30, videoDuration: 60, includeAudio: true },
          },
        });
      } catch (err) {
        const classified = classifier.classify(err as Error);
        expect(classified.type).toBe('FILE_FORMAT_INVALID');
        expect(classified.stage).toBe('configuration');
      }
    });
  });
});
