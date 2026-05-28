/**
 * REQ-161: Quality Module Typed Error Classification Tests
 *
 * Validates that the new typed errors introduced in the quality module
 * (REQ-160: enhanced-error-recovery, pipeline-run-recovery-tracker,
 * regression-detector) are correctly classified by ErrorClassifier and
 * propagate through the recovery chain.
 */

import { ErrorClassifier } from '@/quality/error-classifier';
import {
  QualityGateError,
  PipelineConfigError,
} from '@/pipeline/pipeline-errors';

describe('REQ-161: Quality module typed error classification', () => {
  let classifier: ErrorClassifier;

  beforeEach(() => {
    classifier = new ErrorClassifier();
  });

  // ─── TC-161-01: ErrorClassifier accurately classifies quality module typed errors ──

  describe('TC-161-01: quality module typed errors classified accurately', () => {
    it('classifies circuit-breaker QualityGateError as QUALITY_GATE_FAILED', () => {
      const err = new QualityGateError(
        'circuit-breaker',
        'transcription is open - request rejected',
      );
      const classified = classifier.classify(err);

      expect(classified.type).toBe('QUALITY_GATE_FAILED');
      expect(classified.stage).toBe('quality_gate');
      expect(classified.severity).toBe('high');
      expect(classified.recoverable).toBe(true);
      expect(classified.originalError).toBe(err);
    });

    it('classifies cache-recovery QualityGateError as QUALITY_GATE_FAILED', () => {
      const err = new QualityGateError(
        'cache-recovery',
        'No suitable cached content found',
      );
      const classified = classifier.classify(err);

      expect(classified.type).toBe('QUALITY_GATE_FAILED');
      expect(classified.stage).toBe('quality_gate');
    });

    it('classifies regression-baseline QualityGateError as QUALITY_GATE_FAILED', () => {
      const err = new QualityGateError(
        'regression-baseline',
        'No baseline available. Run establishBaseline() first.',
      );
      const classified = classifier.classify(err);

      expect(classified.type).toBe('QUALITY_GATE_FAILED');
      expect(classified.stage).toBe('quality_gate');
    });

    it('classifies regression-metrics QualityGateError as QUALITY_GATE_FAILED', () => {
      const err = new QualityGateError(
        'regression-metrics',
        'No current metrics available. Run system first.',
      );
      const classified = classifier.classify(err);

      expect(classified.type).toBe('QUALITY_GATE_FAILED');
      expect(classified.stage).toBe('quality_gate');
    });

    it('classifies PipelineConfigError for active run collision as FILE_FORMAT_INVALID', () => {
      const err = new PipelineConfigError(
        'runId',
        'Cannot start run "run-2": run "run-1" is still active. Finalize it first.',
      );
      const classified = classifier.classify(err);

      expect(classified.type).toBe('FILE_FORMAT_INVALID');
      expect(classified.stage).toBe('configuration');
      expect(classified.recoverable).toBe(true);
    });

    it('classifies PipelineConfigError for no active run as FILE_FORMAT_INVALID', () => {
      const err = new PipelineConfigError(
        'activeRun',
        'No active run. Call startRun() first.',
      );
      const classified = classifier.classify(err);

      expect(classified.type).toBe('FILE_FORMAT_INVALID');
      expect(classified.stage).toBe('configuration');
    });

    it('classifies PipelineConfigError for maxAgeMs validation as FILE_FORMAT_INVALID', () => {
      const err = new PipelineConfigError(
        'maxAgeMs',
        'maxAgeMs must be non-negative',
      );
      const classified = classifier.classify(err);

      expect(classified.type).toBe('FILE_FORMAT_INVALID');
      expect(classified.stage).toBe('configuration');
    });

    it('tracks all quality module typed errors in statistics', () => {
      classifier.classify(
        new QualityGateError('circuit-breaker', 'open'),
      );
      classifier.classify(
        new QualityGateError('regression-baseline', 'no baseline'),
      );
      classifier.classify(
        new PipelineConfigError('runId', 'collision'),
      );

      const stats = classifier.getStatistics();

      expect(stats.total).toBe(3);
      expect(stats.byType['QUALITY_GATE_FAILED']).toBe(2);
      expect(stats.byType['FILE_FORMAT_INVALID']).toBe(1);
      expect(stats.mostCommonType).toBe('QUALITY_GATE_FAILED');
    });
  });

  // ─── TC-161-02: Round-trip through recovery chain ────────────────────────────

  describe('TC-161-02: typed errors propagate through pipeline recovery chain', () => {
    it('throw → classify round-trip preserves error metadata', () => {
      let caught: Error | undefined;
      try {
        throw new QualityGateError(
          'circuit-breaker',
          'transcription is open - request rejected',
        );
      } catch (err) {
        caught = err as Error;
      }

      expect(caught).toBeDefined();
      const classified = classifier.classify(caught!);

      expect(classified.type).toBe('QUALITY_GATE_FAILED');
      expect(classified.stage).toBe('quality_gate');
      expect(classified.originalError).toBe(caught);
      // Verify gateName is preserved on the original error
      expect((classified.originalError as QualityGateError).gateName).toBe(
        'circuit-breaker',
      );
    });

    it('mixed typed errors classify correctly in batch', () => {
      const errors = [
        new QualityGateError('circuit-breaker', 'open'),
        new PipelineConfigError('maxAgeMs', 'must be non-negative'),
        new QualityGateError('regression-metrics', 'no metrics'),
        new PipelineConfigError('activeRun', 'no active run'),
      ];

      const classified = classifier.classifyBatch(errors);

      expect(classified).toHaveLength(4);
      expect(classified[0].type).toBe('QUALITY_GATE_FAILED');
      expect(classified[1].type).toBe('FILE_FORMAT_INVALID');
      expect(classified[2].type).toBe('QUALITY_GATE_FAILED');
      expect(classified[3].type).toBe('FILE_FORMAT_INVALID');
    });

    it('typed error from regression detector propagates gate name', () => {
      let caught: Error | undefined;
      try {
        throw new QualityGateError(
          'regression-baseline',
          'No metrics available to establish baseline. Run system first.',
        );
      } catch (err) {
        caught = err as Error;
      }

      const classified = classifier.classify(caught!);
      const original = classified.originalError as QualityGateError;

      expect(original.gateName).toBe('regression-baseline');
      expect(original.reason).toContain('No metrics');
    });

    it('typed error from tracker propagates parameter name', () => {
      let caught: Error | undefined;
      try {
        throw new PipelineConfigError(
          'runId',
          'Cannot start run "new": run "old" is still active.',
        );
      } catch (err) {
        caught = err as Error;
      }

      const classified = classifier.classify(caught!);
      const original = classified.originalError as PipelineConfigError;

      expect(original.parameter).toBe('runId');
      expect(original.context).toHaveProperty('parameter', 'runId');
    });
  });
});
