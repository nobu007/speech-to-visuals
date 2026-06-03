/**
 * TASK-0189: Error Type Propagation E2E Test
 *
 * Validates that Phase 75's REQ-195 error type propagation fix works
 * end-to-end through the full error stack:
 *
 *   PipelineError (errorType) → ErrorClassifier (classify) → retryWithBackoff (recoverable check)
 *
 * Scenarios:
 * 1. LLM_RATE_LIMITED: recoverable → retries 3x → succeeds
 * 2. NETWORK_ERROR: recoverable → retries → succeeds
 * 3. UNKNOWN: non-recoverable → immediate throw (no retry)
 * 4. Mixed: PipelineError subclasses preserve errorType through classification
 */

import { jest } from '@jest/globals';
import { retryWithBackoff } from '@/pipeline/retry';
import { ErrorClassifier } from '@/quality/error-classifier';
import type { ClassifiedError, ErrorType } from '@/quality/error-classifier';
import {
  PipelineError,
  TranscriptionError,
  RenderingError,
  QualityGateError,
} from '@/pipeline/pipeline-errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a flaky async function that fails `failCount` times then succeeds. */
function flakyStage<T>(failCount: number, errorFactory: () => Error, successValue: T) {
  let calls = 0;
  const fn = jest.fn(async (): Promise<T> => {
    calls++;
    if (calls <= failCount) {
      throw errorFactory();
    }
    return successValue;
  });
  return fn;
}

/** Creates an always-failing async function. */
function alwaysFail(errorFactory: () => Error) {
  return jest.fn(async (): Promise<never> => {
    throw errorFactory();
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('TASK-0189: Error type propagation E2E', () => {
  let classifier: ErrorClassifier;

  beforeEach(() => {
    classifier = new ErrorClassifier();
  });

  // -----------------------------------------------------------------------
  // 1. LLM_RATE_LIMITED: recoverable → retries → succeeds
  // -----------------------------------------------------------------------
  describe('LLM_RATE_LIMITED propagation', () => {
    it('retries on LLM_RATE_LIMITED PipelineError and eventually succeeds', async () => {
      const fn = flakyStage(
        2,
        () => new PipelineError('Rate limit exceeded', 'LLM_RATE_LIMITED', 'analysis'),
        'recovered',
      );

      const { result, attempts } = await retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelayMs: 1,
        backoffFactor: 1,
        label: 'test-rate-limited',
      });

      expect(result).toBe('recovered');
      expect(attempts).toBe(2);
      expect(fn).toHaveBeenCalledTimes(3); // 2 fails + 1 success
    });

    it('classifies LLM_RATE_LIMITED as recoverable', () => {
      const err = new PipelineError('Rate limit hit', 'LLM_RATE_LIMITED', 'analysis');
      const classified = classifier.classify(err);

      expect(classified.type).toBe('LLM_RATE_LIMITED');
      expect(classified.recoverable).toBe(true);
      expect(classified.stage).toBe('analysis');
    });
  });

  // -----------------------------------------------------------------------
  // 2. NETWORK_ERROR: recoverable → retries → succeeds
  // -----------------------------------------------------------------------
  describe('NETWORK_ERROR propagation', () => {
    it('retries on NETWORK_ERROR PipelineError and eventually succeeds', async () => {
      const fn = flakyStage(
        1,
        () => new PipelineError('Connection refused', 'NETWORK_ERROR', 'transcription'),
        'connected',
      );

      const { result, attempts } = await retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelayMs: 1,
        backoffFactor: 1,
        label: 'test-network',
      });

      expect(result).toBe('connected');
      expect(attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(2); // 1 fail + 1 success
    });

    it('classifies NETWORK_ERROR as recoverable', () => {
      const err = new PipelineError('Network unreachable', 'NETWORK_ERROR', 'api');
      const classified = classifier.classify(err);

      expect(classified.type).toBe('NETWORK_ERROR');
      expect(classified.recoverable).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 3. UNKNOWN: non-recoverable → immediate throw (no retry)
  // -----------------------------------------------------------------------
  describe('UNKNOWN non-recoverable propagation', () => {
    it('does NOT retry on UNKNOWN error type (non-recoverable)', async () => {
      const fn = alwaysFail(
        () => new PipelineError('Something unexpected', 'UNKNOWN', 'pipeline'),
      );

      await expect(
        retryWithBackoff(fn, {
          maxRetries: 3,
          baseDelayMs: 1,
          backoffFactor: 1,
          label: 'test-unknown',
        }),
      ).rejects.toThrow('Something unexpected');

      // Should only be called once — no retries for non-recoverable
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('classifies generic Error as UNKNOWN with recoverable=false', () => {
      const err = new Error('Some random error that matches no pattern');
      const classified = classifier.classify(err);

      expect(classified.type).toBe('UNKNOWN');
      expect(classified.recoverable).toBe(false);
    });

    it('does NOT retry plain generic Error (classified as UNKNOWN)', async () => {
      const fn = alwaysFail(() => new Error('random failure xyz'));

      await expect(
        retryWithBackoff(fn, {
          maxRetries: 3,
          baseDelayMs: 1,
          label: 'test-generic-error',
        }),
      ).rejects.toThrow('random failure xyz');

      // Only called once because UNKNOWN is non-recoverable
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // 4. PipelineError subclasses preserve errorType through classification
  // -----------------------------------------------------------------------
  describe('PipelineError subclass type preservation', () => {
    it('TranscriptionError → LLM_API_ERROR (recoverable)', () => {
      const err = new TranscriptionError('Whisper failed');
      const classified = classifier.classify(err);

      expect(classified.type).toBe('LLM_API_ERROR');
      expect(classified.recoverable).toBe(true);
      expect(classified.stage).toBe('transcription');
    });

    it('RenderingError → RENDERING_ERROR (recoverable)', () => {
      const err = new RenderingError('Frame encoding failed');
      const classified = classifier.classify(err);

      expect(classified.type).toBe('RENDERING_ERROR');
      expect(classified.recoverable).toBe(true);
      expect(classified.stage).toBe('rendering');
    });

    it('QualityGateError → QUALITY_GATE_FAILED (recoverable)', () => {
      const err = new QualityGateError('overlap-check', 'Overlap detected at 12%');
      const classified = classifier.classify(err);

      expect(classified.type).toBe('QUALITY_GATE_FAILED');
      expect(classified.recoverable).toBe(true);
      expect(classified.stage).toBe('quality_gate');
    });

    it('retryWithBackoff retries TranscriptionError (recoverable)', async () => {
      const fn = flakyStage(
        1,
        () => new TranscriptionError('Temporary Whisper failure'),
        'transcribed',
      );

      const { result, attempts } = await retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelayMs: 1,
        backoffFactor: 1,
        label: 'test-transcription',
      });

      expect(result).toBe('transcribed');
      expect(attempts).toBe(1);
    });

    it('retryWithBackoff retries RenderingError (recoverable)', async () => {
      const fn = flakyStage(
        2,
        () => new RenderingError('GPU OOM during frame render'),
        'rendered',
      );

      const { result, attempts } = await retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelayMs: 1,
        backoffFactor: 1,
        label: 'test-rendering',
      });

      expect(result).toBe('rendered');
      expect(attempts).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // 5. Full stack: PipelineError → classify → retry decision round-trip
  // -----------------------------------------------------------------------
  describe('Full error stack round-trip', () => {
    it('exhausts retries for recoverable error that never succeeds', async () => {
      const fn = alwaysFail(
        () => new PipelineError('LLM service unavailable', 'LLM_API_ERROR', 'analysis'),
      );

      await expect(
        retryWithBackoff(fn, {
          maxRetries: 2,
          baseDelayMs: 1,
          backoffFactor: 1,
          label: 'test-exhaust',
        }),
      ).rejects.toThrow('LLM service unavailable');

      // 1 initial + 2 retries = 3 total calls
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('classifies batch of mixed errors correctly', () => {
      const errors = [
        new PipelineError('Rate limit', 'LLM_RATE_LIMITED', 'analysis'),
        new Error('network connection reset'),
        new PipelineError('Unknown', 'UNKNOWN', 'pipeline'),
        new RenderingError('Frame 42 failed'),
      ];

      const classified: ClassifiedError[] = classifier.classifyBatch(errors);

      expect(classified[0].type).toBe('LLM_RATE_LIMITED');
      expect(classified[0].recoverable).toBe(true);

      expect(classified[1].type).toBe('NETWORK_ERROR');
      expect(classified[1].recoverable).toBe(true);

      expect(classified[2].type).toBe('UNKNOWN');
      expect(classified[2].recoverable).toBe(false);

      expect(classified[3].type).toBe('RENDERING_ERROR');
      expect(classified[3].recoverable).toBe(true);
    });

    it('classifier statistics reflect all classifications', () => {
      const errors = [
        new PipelineError('Rate limit', 'LLM_RATE_LIMITED', 'a'),
        new PipelineError('Rate limit', 'LLM_RATE_LIMITED', 'b'),
        new RenderingError('fail'),
      ];
      classifier.classifyBatch(errors);

      const stats = classifier.getStatistics();
      expect(stats.total).toBe(3);
      expect(stats.byType['LLM_RATE_LIMITED']).toBe(2);
      expect(stats.byType['RENDERING_ERROR']).toBe(1);
      expect(stats.mostCommonType).toBe('LLM_RATE_LIMITED');
    });
  });
});
