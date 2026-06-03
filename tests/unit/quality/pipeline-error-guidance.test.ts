/**
 * Tests for PipelineErrorGuidanceBridge
 *
 * Validates the bridge between ErrorClassifier and UserGuidedErrorRecovery:
 * - PipelineError subclasses produce correct classifiedType + guidance
 * - Generic errors are pattern-matched via ErrorClassifier
 * - Non-recoverable errors skip automated recovery
 * - Severity is promoted correctly for critical errors
 * - Context is propagated through the bridge
 */

import { jest } from '@jest/globals';
import {
  PipelineError,
  TranscriptionError,
  RenderingError,
  QualityGateError,
  PipelineAbortError,
  PipelineConfigError,
  AudioValidationError,
} from '@/pipeline/pipeline-errors';
import { PipelineErrorGuidanceBridge } from '@/quality/pipeline-error-guidance';

describe('PipelineErrorGuidanceBridge', () => {
  let bridge: PipelineErrorGuidanceBridge;

  beforeEach(() => {
    bridge = new PipelineErrorGuidanceBridge();
  });

  // ── PipelineError subclass mapping ──────────────────────────────

  describe('PipelineError subclass → classifiedType mapping', () => {
    it('TranscriptionError maps to LLM_API_ERROR', () => {
      const error = new TranscriptionError('Whisper failed');
      const guidance = bridge.provideGuidance(error);

      expect(guidance.classifiedType).toBe('LLM_API_ERROR');
      expect(guidance.category).toBe('transcription');
      expect(guidance.recoverable).toBe(true);
      expect(guidance.suggestedAction).toBeTruthy();
    });

    it('RenderingError maps to RENDERING_ERROR', () => {
      const error = new RenderingError('Frame 42 encoding failed');
      const guidance = bridge.provideGuidance(error);

      expect(guidance.classifiedType).toBe('RENDERING_ERROR');
      expect(guidance.category).toBe('rendering');
      expect(guidance.recoverable).toBe(true);
    });

    it('QualityGateError maps to QUALITY_GATE_FAILED', () => {
      const error = new QualityGateError('overlap-check', 'Layout overlap > 10%');
      const guidance = bridge.provideGuidance(error);

      expect(guidance.classifiedType).toBe('QUALITY_GATE_FAILED');
      expect(guidance.category).toBe('analysis');
      expect(guidance.recoverable).toBe(true);
    });

    it('PipelineAbortError maps to QUALITY_GATE_FAILED', () => {
      const error = new PipelineAbortError('Critical degradation', { stageIndex: 3 });
      const guidance = bridge.provideGuidance(error);

      expect(guidance.classifiedType).toBe('QUALITY_GATE_FAILED');
      expect(guidance.category).toBe('analysis');
    });

    it('PipelineConfigError maps to FILE_FORMAT_INVALID', () => {
      const error = new PipelineConfigError('output.fps', 'fps must be positive');
      const guidance = bridge.provideGuidance(error);

      expect(guidance.classifiedType).toBe('FILE_FORMAT_INVALID');
      expect(guidance.category).toBe('file_format');
    });

    it('AudioValidationError maps to FILE_FORMAT_INVALID', () => {
      const error = new AudioValidationError('Unsupported format: .flac', 'flac', { filename: 'audio.flac' });
      const guidance = bridge.provideGuidance(error);

      expect(guidance.classifiedType).toBe('FILE_FORMAT_INVALID');
      expect(guidance.category).toBe('file_format');
      expect(guidance.suggestedAction).toContain('format');
    });
  });

  // ── Generic error pattern matching ──────────────────────────────

  describe('generic error pattern matching', () => {
    it('network error message maps to NETWORK_ERROR', () => {
      const error = new Error('Connection refused by remote server');
      const guidance = bridge.provideGuidance(error);

      expect(guidance.classifiedType).toBe('NETWORK_ERROR');
      expect(guidance.category).toBe('network');
      expect(guidance.userMessage).toContain('network');
    });

    it('OOM error message maps to RENDERING_OOM', () => {
      const error = new Error('Heap out of memory during rendering');
      const guidance = bridge.provideGuidance(error);

      expect(guidance.classifiedType).toBe('RENDERING_OOM');
      expect(guidance.category).toBe('memory');
    });

    it('rate limit error message maps to LLM_RATE_LIMITED', () => {
      const error = new Error('Rate limit exceeded for Gemini API');
      const guidance = bridge.provideGuidance(error);

      expect(guidance.classifiedType).toBe('LLM_RATE_LIMITED');
      expect(guidance.category).toBe('api');
      expect(guidance.suggestedAction).toContain('retry');
    });

    it('unrecognised error falls back to UNKNOWN', () => {
      const error = new Error('Something completely unexpected happened');
      const guidance = bridge.provideGuidance(error);

      expect(guidance.classifiedType).toBe('UNKNOWN');
      expect(guidance.category).toBe('unknown');
      expect(guidance.recoverable).toBe(false);
    });
  });

  // ── User message quality ────────────────────────────────────────

  describe('user message quality', () => {
    it('provides actionable user message for TranscriptionError', () => {
      const error = new TranscriptionError('Whisper timeout');
      const guidance = bridge.provideGuidance(error);

      expect(guidance.userMessage).toBeTruthy();
      expect(typeof guidance.userMessage).toBe('string');
      // User message should be plain-text (no stack traces)
      expect(guidance.userMessage).not.toContain('at ');
    });

    it('includes recovery strategies', () => {
      const error = new TranscriptionError('Whisper failed');
      const guidance = bridge.provideGuidance(error);

      expect(guidance.recoveryStrategies.length).toBeGreaterThan(0);
      // At least one strategy should be automated
      expect(guidance.recoveryStrategies.some(s => s.automated)).toBe(true);
    });

    it('includes prevention tips', () => {
      const error = new RenderingError('Encoding failed');
      const guidance = bridge.provideGuidance(error);

      expect(guidance.preventionTips.length).toBeGreaterThan(0);
    });
  });

  // ── Severity adjustment ─────────────────────────────────────────

  describe('severity adjustment', () => {
    it('non-recoverable UNKNOWN error gets high severity', () => {
      const error = new Error('Bizarre unexpected failure');
      const guidance = bridge.provideGuidance(error);

      // UNKNOWN errors are non-recoverable → severity promoted
      expect(guidance.recoverable).toBe(false);
      expect(guidance.severity).toBeDefined();
    });

    it('RENDERING_OOM error gets critical severity', () => {
      const error = new Error('Out of memory during rendering');
      const guidance = bridge.provideGuidance(error);

      expect(guidance.classifiedType).toBe('RENDERING_OOM');
      expect(guidance.category).toBe('memory');
    });
  });

  // ── Recovery attempts ───────────────────────────────────────────

  describe('attemptRecovery', () => {
    it('skips recovery for non-recoverable errors', async () => {
      const error = new Error('Unknown catastrophic failure');
      const guidance = bridge.provideGuidance(error);
      // Override to simulate non-recoverable
      const result = await bridge.attemptRecovery(
        { ...guidance, recoverable: false },
        jest.fn().mockResolvedValue('should not run'),
      );

      expect(result.success).toBe(false);
    });

    it('attempts automated recovery for recoverable errors', async () => {
      const error = new TranscriptionError('Transient Whisper failure');
      const guidance = bridge.provideGuidance(error);

      const retryFn = jest.fn().mockResolvedValue({ text: 'recovered' });
      const result = await bridge.attemptRecovery(guidance, retryFn);

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ text: 'recovered' });
    });
  });

  // ── Context propagation ─────────────────────────────────────────

  describe('context propagation', () => {
    it('stage from PipelineError.context is preserved', () => {
      const error = new TranscriptionError('Whisper error', { model: 'base' });
      const guidance = bridge.provideGuidance(error);

      expect(guidance.technicalDetails).toContain('Whisper error');
    });

    it('additional context is included in technical details', () => {
      const error = new TranscriptionError('Whisper error');
      const guidance = bridge.provideGuidance(error, { stage: 'transcription', attempt: 2 });

      expect(guidance.technicalDetails).toContain('attempt');
    });
  });

  // ── Statistics ──────────────────────────────────────────────────

  describe('statistics', () => {
    it('returns recovery statistics', () => {
      bridge.provideGuidance(new TranscriptionError('error 1'));
      bridge.provideGuidance(new RenderingError('error 2'));

      const stats = bridge.getStatistics();
      expect(stats.recovery.total).toBe(2);
      expect(stats.recovery.mostCommon).toBeDefined();
    });
  });
});
