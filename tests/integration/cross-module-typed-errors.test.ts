/**
 * Phase 65 Integration Tests: Cross-Module Typed Errors → ErrorClassifier
 *
 * REQ-171: MonitoringError, PipelineConfigError (used in env.ts,
 * supabase/client.ts, iteration-manager.ts), and PipelineError (used in
 * Index.tsx) round-trip through the ErrorClassifier with correct errorType,
 * stage, severity, and recoverability.
 *
 * Verifies that the newly typed error classes — now used in
 * performance-dashboard.ts, env.ts, supabase/client.ts,
 * iteration-manager.ts, and Index.tsx — are properly triaged by
 * the ErrorClassifier without regex fallback.
 */

import { jest } from '@jest/globals';
import type { ClassifiedError } from '@/quality/error-classifier';

// ---------- Imports ----------

let ErrorClassifier: typeof import('@/quality/error-classifier').ErrorClassifier;
let MonitoringError: typeof import('@/pipeline/pipeline-errors').MonitoringError;
let PipelineConfigError: typeof import('@/pipeline/pipeline-errors').PipelineConfigError;
let PipelineError: typeof import('@/pipeline/pipeline-errors').PipelineError;

beforeAll(async () => {
  const ecMod = await import('@/quality/error-classifier');
  ErrorClassifier = ecMod.ErrorClassifier;

  const peMod = await import('@/pipeline/pipeline-errors');
  MonitoringError = peMod.MonitoringError;
  PipelineConfigError = peMod.PipelineConfigError;
  PipelineError = peMod.PipelineError;
});

// ---------- REQ-171: Cross-Module Typed Errors → ErrorClassifier ----------

describe('REQ-171: Cross-module typed errors → ErrorClassifier integration', () => {
  let classifier: InstanceType<typeof ErrorClassifier>;

  beforeEach(() => {
    classifier = new ErrorClassifier();
  });

  function classifyThrownError(error: Error): ClassifiedError {
    let classified: ClassifiedError | undefined;
    try {
      throw error;
    } catch (err) {
      if (err instanceof Error) {
        classified = classifier.classify(err);
      }
    }
    expect(classified).toBeDefined();
    return classified!;
  }

  // --- MonitoringError (replaces raw throw in performance-dashboard.ts) ---

  describe('MonitoringError', () => {
    it('classifies MonitoringError with QUALITY_GATE_FAILED type', () => {
      const error = new MonitoringError('No metrics to average');
      const result = classifyThrownError(error);

      expect(result.type).toBe('QUALITY_GATE_FAILED');
      expect(result.stage).toBe('monitoring');
      expect(result.originalError).toBe(error);
      expect(result.recoverable).toBe(true);
    });

    it('preserves context metadata in MonitoringError', () => {
      const error = new MonitoringError('Dashboard data generation failed', {
        metricCount: 0,
        operation: 'calculateAverage',
      });
      const result = classifyThrownError(error);

      expect(result.type).toBe('QUALITY_GATE_FAILED');
      expect(result.stage).toBe('monitoring');
      expect((result.originalError as InstanceType<typeof MonitoringError>).context).toEqual({
        metricCount: 0,
        operation: 'calculateAverage',
      });
    });

    it('uses PipelineError name for instanceof check', () => {
      const error = new MonitoringError('test');
      expect(error).toBeInstanceOf(PipelineError);
      expect(error.name).toBe('MonitoringError');
      expect(error.errorType).toBe('QUALITY_GATE_FAILED');
      expect(error.stage).toBe('monitoring');
    });
  });

  // --- PipelineConfigError (used in env.ts, supabase/client.ts, iteration-manager.ts) ---

  describe('PipelineConfigError', () => {
    it('classifies env.ts configuration validation error', () => {
      const error = new PipelineConfigError(
        'env',
        'Configuration validation failed:\n  - port: must be a number',
      );
      const result = classifyThrownError(error);

      expect(result.type).toBe('FILE_FORMAT_INVALID');
      expect(result.stage).toBe('configuration');
      expect(result.originalError).toBe(error);
    });

    it('classifies supabase client missing credentials error', () => {
      const error = new PipelineConfigError(
        'supabase',
        'Supabase URL and Anon Key are required',
      );
      const result = classifyThrownError(error);

      expect(result.type).toBe('FILE_FORMAT_INVALID');
      expect(result.stage).toBe('configuration');
      expect(result.recoverable).toBe(true);
    });

    it('classifies iteration-manager unknown phase error', () => {
      const error = new PipelineConfigError('phaseName', 'Unknown phase: invalid-phase');
      const result = classifyThrownError(error);

      expect(result.type).toBe('FILE_FORMAT_INVALID');
      expect(result.stage).toBe('configuration');
    });

    it('preserves parameter metadata in PipelineConfigError', () => {
      const error = new PipelineConfigError('phaseName', 'Unknown phase: xyz');
      expect(error.parameter).toBe('phaseName');
      expect(error.name).toBe('PipelineConfigError');
      expect(error.errorType).toBe('FILE_FORMAT_INVALID');
    });
  });

  // --- PipelineError (used in Index.tsx for upload, transcription, scene gen) ---

  describe('PipelineError (UI-level errors)', () => {
    it('classifies upload error with STORAGE_ERROR type', () => {
      const error = new PipelineError(
        'ファイルのアップロードに失敗しました',
        'STORAGE_ERROR',
        'upload',
      );
      const result = classifyThrownError(error);

      expect(result.type).toBe('STORAGE_ERROR');
      expect(result.stage).toBe('upload');
      expect(result.originalError).toBe(error);
    });

    it('classifies transcription error with LLM_API_ERROR type', () => {
      const error = new PipelineError(
        '文字起こしに失敗しました',
        'LLM_API_ERROR',
        'transcription',
      );
      const result = classifyThrownError(error);

      expect(result.type).toBe('LLM_API_ERROR');
      expect(result.stage).toBe('transcription');
    });

    it('classifies scene generation error with RENDERING_ERROR type', () => {
      const error = new PipelineError(
        'シーン生成に失敗しました',
        'RENDERING_ERROR',
        'scene_generation',
      );
      const result = classifyThrownError(error);

      expect(result.type).toBe('RENDERING_ERROR');
      expect(result.stage).toBe('scene_generation');
    });

    it('preserves user-facing message in classified result', () => {
      const error = new PipelineError(
        'ファイルのアップロードに失敗しました',
        'STORAGE_ERROR',
        'upload',
      );
      const result = classifyThrownError(error);

      expect(result.userMessage).toBeTruthy();
      expect(result.suggestedAction).toBeTruthy();
    });
  });

  // --- Round-trip verification ---

  describe('ErrorClassifier statistics after cross-module errors', () => {
    it('tracks all cross-module error types in statistics', () => {
      // Classify one of each type
      classifier.classify(new MonitoringError('test'));
      classifier.classify(new PipelineConfigError('test', 'test'));
      classifier.classify(new PipelineError('test', 'STORAGE_ERROR', 'upload'));

      const stats = classifier.getStatistics();
      expect(stats.total).toBe(3);
      expect(stats.byType['QUALITY_GATE_FAILED']).toBe(1);
      expect(stats.byType['FILE_FORMAT_INVALID']).toBe(1);
      expect(stats.byType['STORAGE_ERROR']).toBe(1);
    });
  });
});
