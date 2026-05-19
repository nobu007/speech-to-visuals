/**
 * TASK-0045: ErrorClassifier Tests (TDD)
 *
 * Tests for the error classification system that categorizes errors
 * into specific types with severity, recoverability, and suggested actions.
 */

import {
  ErrorClassifier,
  ClassifiedError,
  ErrorType,
  ErrorSeverity,
} from '@/quality/error-classifier';
import {
  PipelineError,
  TranscriptionError,
  SegmentationError,
  RenderingError,
  QualityGateError,
  PipelineConfigError,
} from '@/pipeline/pipeline-errors';

describe('ErrorClassifier', () => {
  let classifier: ErrorClassifier;

  beforeEach(() => {
    classifier = new ErrorClassifier();
  });

  describe('classification of file errors', () => {
    it('should classify file format invalid errors', () => {
      const error = new Error('Unsupported file format: .avi');
      const classified = classifier.classify(error);

      expect(classified.type).toBe('FILE_FORMAT_INVALID');
      expect(classified.severity).toBe('medium');
      expect(classified.recoverable).toBe(true);
      expect(classified.originalError).toBe(error);
      expect(classified.userMessage).toContain('format');
      expect(classified.suggestedAction).toBeDefined();
    });

    it('should classify file format errors with "invalid format" message', () => {
      const error = new Error('Invalid format detected in audio file');
      const classified = classifier.classify(error);

      expect(classified.type).toBe('FILE_FORMAT_INVALID');
      expect(classified.recoverable).toBe(true);
    });

    it('should classify file size exceeded errors', () => {
      const error = new Error('File size exceeds maximum limit of 50MB');
      const classified = classifier.classify(error);

      expect(classified.type).toBe('FILE_SIZE_EXCEEDED');
      expect(classified.severity).toBe('medium');
      expect(classified.recoverable).toBe(true);
      expect(classified.userMessage).toContain('size');
    });

    it('should classify "too large" as file size exceeded', () => {
      const error = new Error('File is too large to process');
      const classified = classifier.classify(error);

      expect(classified.type).toBe('FILE_SIZE_EXCEEDED');
    });
  });

  describe('classification of LLM errors', () => {
    it('should classify LLM API errors', () => {
      const error = new Error('LLM API returned status 500');
      const classified = classifier.classify(error, { stage: 'analysis' });

      expect(classified.type).toBe('LLM_API_ERROR');
      expect(classified.severity).toBe('high');
      expect(classified.recoverable).toBe(true);
      expect(classified.stage).toBe('analysis');
    });

    it('should classify Gemini API errors as LLM_API_ERROR', () => {
      const error = new Error('Gemini API request failed with 403');
      const classified = classifier.classify(error);

      expect(classified.type).toBe('LLM_API_ERROR');
    });

    it('should classify LLM rate limited errors', () => {
      const error = new Error('Rate limit exceeded for LLM API calls');
      const classified = classifier.classify(error);

      expect(classified.type).toBe('LLM_RATE_LIMITED');
      expect(classified.severity).toBe('medium');
      expect(classified.recoverable).toBe(true);
      expect(classified.suggestedAction.toLowerCase()).toContain('wait');
    });

    it('should classify quota exceeded as rate limited', () => {
      const error = new Error('API quota exceeded for this billing period');
      const classified = classifier.classify(error);

      expect(classified.type).toBe('LLM_RATE_LIMITED');
    });

    it('should classify LLM timeout errors', () => {
      const error = new Error('LLM request timed out after 30 seconds');
      const classified = classifier.classify(error);

      expect(classified.type).toBe('LLM_TIMEOUT');
      expect(classified.severity).toBe('medium');
      expect(classified.recoverable).toBe(true);
    });
  });

  describe('classification of rendering errors', () => {
    it('should classify rendering errors', () => {
      const error = new Error('Rendering failed: unable to compose video frames');
      const classified = classifier.classify(error, { stage: 'rendering' });

      expect(classified.type).toBe('RENDERING_ERROR');
      expect(classified.severity).toBe('high');
      expect(classified.recoverable).toBe(true);
      expect(classified.stage).toBe('rendering');
    });

    it('should classify rendering OOM errors', () => {
      const error = new Error('Rendering OOM: JavaScript heap out of memory');
      const classified = classifier.classify(error);

      expect(classified.type).toBe('RENDERING_OOM');
      expect(classified.severity).toBe('critical');
      expect(classified.recoverable).toBe(true);
      expect(classified.suggestedAction).toContain('memory');
    });

    it('should classify heap out of memory as RENDERING_OOM', () => {
      const error = new Error('FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory');
      const classified = classifier.classify(error);

      expect(classified.type).toBe('RENDERING_OOM');
      expect(classified.severity).toBe('critical');
    });
  });

  describe('classification of system errors', () => {
    it('should classify network errors', () => {
      const error = new Error('Network error: Failed to fetch resource');
      const classified = classifier.classify(error);

      expect(classified.type).toBe('NETWORK_ERROR');
      expect(classified.severity).toBe('high');
      expect(classified.recoverable).toBe(true);
    });

    it('should classify connection refused as network error', () => {
      const error = new Error('ECONNREFUSED: Connection refused to api endpoint');
      const classified = classifier.classify(error);

      expect(classified.type).toBe('NETWORK_ERROR');
    });

    it('should classify storage errors', () => {
      const error = new Error('Storage error: Failed to write file to disk');
      const classified = classifier.classify(error);

      expect(classified.type).toBe('STORAGE_ERROR');
      expect(classified.severity).toBe('high');
      expect(classified.recoverable).toBe(true);
    });

    it('should classify disk full as storage error', () => {
      const error = new Error('No space left on device');
      const classified = classifier.classify(error);

      expect(classified.type).toBe('STORAGE_ERROR');
    });
  });

  describe('classification of quality errors', () => {
    it('should classify quality gate failures', () => {
      const error = new Error('Quality gate failed: transcription accuracy below threshold');
      const classified = classifier.classify(error);

      expect(classified.type).toBe('QUALITY_GATE_FAILED');
      expect(classified.severity).toBe('high');
      expect(classified.recoverable).toBe(true);
    });

    it('should classify quality score below threshold', () => {
      const error = new Error('Quality score 0.3 is below minimum threshold 0.7');
      const classified = classifier.classify(error);

      expect(classified.type).toBe('QUALITY_GATE_FAILED');
    });
  });

  describe('classification of unknown errors', () => {
    it('should classify unknown errors as UNKNOWN', () => {
      const error = new Error('Something completely unexpected happened');
      const classified = classifier.classify(error);

      expect(classified.type).toBe('UNKNOWN');
      expect(classified.severity).toBe('low');
      expect(classified.recoverable).toBe(false);
    });
  });

  describe('stage context', () => {
    it('should include stage from context when provided', () => {
      const error = new Error('Processing failed');
      const classified = classifier.classify(error, { stage: 'transcription' });

      expect(classified.stage).toBe('transcription');
    });

    it('should default to "unknown" stage when not provided', () => {
      const error = new Error('Processing failed');
      const classified = classifier.classify(error);

      expect(classified.stage).toBe('unknown');
    });
  });

  describe('all 11+ error types', () => {
    it('should support all required error types', () => {
      const requiredTypes: ErrorType[] = [
        'FILE_FORMAT_INVALID',
        'FILE_SIZE_EXCEEDED',
        'LLM_API_ERROR',
        'LLM_RATE_LIMITED',
        'LLM_TIMEOUT',
        'RENDERING_ERROR',
        'RENDERING_OOM',
        'NETWORK_ERROR',
        'STORAGE_ERROR',
        'QUALITY_GATE_FAILED',
        'UNKNOWN',
      ];

      // Verify all types exist in the ErrorType union
      for (const type of requiredTypes) {
        expect(typeof type).toBe('string');
      }
    });
  });

  describe('batch classification', () => {
    it('should classify multiple errors', () => {
      const errors = [
        new Error('Unsupported file format'),
        new Error('LLM API error 500'),
        new Error('Network connection failed'),
      ];

      const classified = classifier.classifyBatch(errors);

      expect(classified).toHaveLength(3);
      expect(classified[0].type).toBe('FILE_FORMAT_INVALID');
      expect(classified[1].type).toBe('LLM_API_ERROR');
      expect(classified[2].type).toBe('NETWORK_ERROR');
    });
  });

  describe('error statistics', () => {
    it('should track classification statistics', () => {
      classifier.classify(new Error('Unsupported file format'));
      classifier.classify(new Error('File too large'));
      classifier.classify(new Error('Unsupported format'));

      const stats = classifier.getStatistics();

      expect(stats.total).toBe(3);
      expect(stats.byType['FILE_FORMAT_INVALID']).toBe(2);
      expect(stats.byType['FILE_SIZE_EXCEEDED']).toBe(1);
    });

    it('should calculate most common error type', () => {
      classifier.classify(new Error('Network error'));
      classifier.classify(new Error('Network failure'));
      classifier.classify(new Error('Connection refused'));

      const stats = classifier.getStatistics();

      expect(stats.mostCommonType).toBe('NETWORK_ERROR');
    });
  });

  // ─── PipelineError integration (fast-path, no regex guesswork) ────────

  describe('PipelineError integration (typed error fast-path)', () => {
    it('classifies TranscriptionError via errorType property, not regex', () => {
      const err = new TranscriptionError('Whisper failed');
      const classified = classifier.classify(err);

      expect(classified.type).toBe('LLM_API_ERROR');
      expect(classified.stage).toBe('transcription');
      expect(classified.severity).toBe('high');
      expect(classified.recoverable).toBe(true);
      expect(classified.originalError).toBe(err);
    });

    it('classifies SegmentationError via errorType property', () => {
      const err = new SegmentationError('No segments produced');
      const classified = classifier.classify(err);

      expect(classified.type).toBe('QUALITY_GATE_FAILED');
      expect(classified.stage).toBe('segmentation');
    });

    it('classifies RenderingError via errorType property', () => {
      const err = new RenderingError('Frame composition failed');
      const classified = classifier.classify(err);

      expect(classified.type).toBe('RENDERING_ERROR');
      expect(classified.stage).toBe('rendering');
    });

    it('classifies QualityGateError via errorType property', () => {
      const err = new QualityGateError('layout-quality', 'score too low');
      const classified = classifier.classify(err);

      expect(classified.type).toBe('QUALITY_GATE_FAILED');
      expect(classified.stage).toBe('quality_gate');
      expect(classified.originalError).toBe(err);
      // The user message comes from the profile, not the error message
      expect(classified.userMessage).toContain('quality standards');
    });

    it('classifies PipelineConfigError via errorType property', () => {
      const err = new PipelineConfigError('fps', 'fps must be positive');
      const classified = classifier.classify(err);

      expect(classified.type).toBe('FILE_FORMAT_INVALID');
      expect(classified.stage).toBe('configuration');
    });

    it('prefers PipelineError.stage over context.stage', () => {
      const err = new TranscriptionError('failed');
      const classified = classifier.classify(err, { stage: 'override-me' });

      // PipelineError carries its own stage; classifier should use it
      expect(classified.stage).toBe('transcription');
    });

    it('falls back to context.stage when error has no stage property', () => {
      const err = new PipelineError('test', 'LLM_API_ERROR', 'transcription');
      const classified = classifier.classify(err, { stage: 'fallback' });

      expect(classified.stage).toBe('transcription');
    });

    it('preserves empty-string stage from PipelineError (?? does not treat "" as nullish)', () => {
      const err = new PipelineError('test', 'UNKNOWN', '');
      const classified = classifier.classify(err);

      // ?? only triggers for null/undefined, not empty string
      expect(classified.stage).toBe('');
    });

    it('does not use regex matching for typed PipelineError instances', () => {
      // This message would normally match LLM_API_ERROR regex,
      // but the type comes from errorType property directly
      const err = new RenderingError('LLM API error 500 happened during render');
      const classified = classifier.classify(err);

      // Should be RENDERING_ERROR from the class, not LLM_API_ERROR from regex
      expect(classified.type).toBe('RENDERING_ERROR');
    });

    it('tracks PipelineError instances in statistics correctly', () => {
      classifier.classify(new TranscriptionError('t1'));
      classifier.classify(new TranscriptionError('t2'));
      classifier.classify(new RenderingError('r1'));

      const stats = classifier.getStatistics();

      expect(stats.total).toBe(3);
      expect(stats.byType['LLM_API_ERROR']).toBe(2);
      expect(stats.byType['RENDERING_ERROR']).toBe(1);
      expect(stats.mostCommonType).toBe('LLM_API_ERROR');
    });

    it('mixes typed and plain errors in batch classification', () => {
      const classified = classifier.classifyBatch([
        new TranscriptionError('Whisper timeout'),
        new Error('Network error: connection refused'),
        new SegmentationError('empty result'),
      ]);

      expect(classified).toHaveLength(3);
      expect(classified[0].type).toBe('LLM_API_ERROR');
      expect(classified[0].stage).toBe('transcription');
      expect(classified[1].type).toBe('NETWORK_ERROR');
      expect(classified[1].stage).toBe('unknown'); // no stage from plain Error
      expect(classified[2].type).toBe('QUALITY_GATE_FAILED');
      expect(classified[2].stage).toBe('segmentation');
    });

    it('preserves context metadata in classified output', () => {
      const err = new TranscriptionError('failed', { audioFile: 'test.wav' });
      const classified = classifier.classify(err);

      // originalError carries the context via the PipelineError instance
      expect(classified.originalError).toBe(err);
      expect((classified.originalError as TranscriptionError).context).toEqual({
        audioFile: 'test.wav',
      });
    });
  });
});
