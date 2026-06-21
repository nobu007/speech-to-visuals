/**
 * Tests for error-classifier.ts
 * Covers: classification by message patterns, PipelineError pre-classification,
 * batch classification, statistics, and edge cases.
 */

import { jest } from '@jest/globals';

const { ErrorClassifier } = await import('../error-classifier');
import type { ErrorType, ClassifiedError } from '../error-classifier';

describe('ErrorClassifier', () => {
  let classifier: InstanceType<typeof ErrorClassifier>;

  beforeEach(() => {
    classifier = new ErrorClassifier();
  });

  // ---------------------------------------------------------------------------
  // Message-based classification (determineType)
  // ---------------------------------------------------------------------------

  describe('RENDERING_OOM detection', () => {
    it('should classify "out of memory" as RENDERING_OOM', () => {
      const result = classifier.classify(new Error('FATAL: out of memory'));
      expect(result.type).toBe('RENDERING_OOM');
      expect(result.severity).toBe('critical');
    });

    it('should classify "oom" as RENDERING_OOM', () => {
      const result = classifier.classify(new Error('Process killed (oom'));
      expect(result.type).toBe('RENDERING_OOM');
    });

    it('should classify "heap out of memory" as RENDERING_OOM', () => {
      const result = classifier.classify(new Error('JavaScript heap out of memory'));
      expect(result.type).toBe('RENDERING_OOM');
    });

    it('should classify "allocation failed" as RENDERING_OOM', () => {
      const result = classifier.classify(new Error('buffer allocation failed'));
      expect(result.type).toBe('RENDERING_OOM');
    });
  });

  describe('LLM_RATE_LIMITED detection', () => {
    it('should classify "rate limit" as LLM_RATE_LIMITED', () => {
      const result = classifier.classify(new Error('rate limit exceeded'));
      expect(result.type).toBe('LLM_RATE_LIMITED');
      expect(result.severity).toBe('medium');
      expect(result.recoverable).toBe(true);
    });

    it('should classify "quota exceeded" as LLM_RATE_LIMITED', () => {
      const result = classifier.classify(new Error('API quota exceeded'));
      expect(result.type).toBe('LLM_RATE_LIMITED');
    });

    it('should classify "too many requests" as LLM_RATE_LIMITED', () => {
      const result = classifier.classify(new Error('429 too many requests'));
      expect(result.type).toBe('LLM_RATE_LIMITED');
    });
  });

  describe('LLM_TIMEOUT detection', () => {
    it('should classify "llm timed out" as LLM_TIMEOUT', () => {
      const result = classifier.classify(new Error('llm timed out after 30000ms'));
      expect(result.type).toBe('LLM_TIMEOUT');
    });

    it('should classify "timed out llm" as LLM_TIMEOUT', () => {
      const result = classifier.classify(new Error('Request timed out: llm'));
      expect(result.type).toBe('LLM_TIMEOUT');
    });
  });

  describe('LLM_API_ERROR detection', () => {
    it('should classify "gemini" as LLM_API_ERROR', () => {
      const result = classifier.classify(new Error('gemini request failed'));
      expect(result.type).toBe('LLM_API_ERROR');
      expect(result.severity).toBe('high');
    });

    it('should classify "openai" as LLM_API_ERROR', () => {
      const result = classifier.classify(new Error('openai returned 500'));
      expect(result.type).toBe('LLM_API_ERROR');
    });

    it('should classify "api 503" as LLM_API_ERROR', () => {
      const result = classifier.classify(new Error('api returned 503 error'));
      expect(result.type).toBe('LLM_API_ERROR');
    });
  });

  describe('RENDERING_ERROR detection', () => {
    it('should classify "render failed" as RENDERING_ERROR', () => {
      const result = classifier.classify(new Error('render failed'));
      expect(result.type).toBe('RENDERING_ERROR');
    });

    it('should classify "video error" as RENDERING_ERROR', () => {
      const result = classifier.classify(new Error('video encoding error'));
      expect(result.type).toBe('RENDERING_ERROR');
    });

    it('should classify "frame failed" as RENDERING_ERROR', () => {
      const result = classifier.classify(new Error('frame 42 failed'));
      expect(result.type).toBe('RENDERING_ERROR');
    });
  });

  describe('NETWORK_ERROR detection', () => {
    it('should classify "network" as NETWORK_ERROR', () => {
      const result = classifier.classify(new Error('network unreachable'));
      expect(result.type).toBe('NETWORK_ERROR');
    });

    it('should classify "ECONNREFUSED" as NETWORK_ERROR', () => {
      const result = classifier.classify(new Error('ECONNREFUSED 127.0.0.1:8080'));
      expect(result.type).toBe('NETWORK_ERROR');
    });

    it('should classify "connection refused" as NETWORK_ERROR', () => {
      const result = classifier.classify(new Error('connection refused'));
      expect(result.type).toBe('NETWORK_ERROR');
    });
  });

  describe('STORAGE_ERROR detection', () => {
    it('should classify "no space left" as STORAGE_ERROR', () => {
      const result = classifier.classify(new Error('No space left on device'));
      expect(result.type).toBe('STORAGE_ERROR');
    });

    it('should classify "disk" as STORAGE_ERROR', () => {
      const result = classifier.classify(new Error('disk write error'));
      expect(result.type).toBe('STORAGE_ERROR');
    });

    it('should classify "I/O error" as STORAGE_ERROR', () => {
      const result = classifier.classify(new Error('I/O error during write'));
      expect(result.type).toBe('STORAGE_ERROR');
    });
  });

  describe('QUALITY_GATE_FAILED detection', () => {
    it('should classify "quality gate" as QUALITY_GATE_FAILED', () => {
      const result = classifier.classify(new Error('quality gate blocked output'));
      expect(result.type).toBe('QUALITY_GATE_FAILED');
    });

    it('should classify "below threshold" as QUALITY_GATE_FAILED', () => {
      const result = classifier.classify(new Error('Score 0.4 is below threshold'));
      expect(result.type).toBe('QUALITY_GATE_FAILED');
    });
  });

  describe('FILE_SIZE_EXCEEDED detection', () => {
    it('should classify "file size" as FILE_SIZE_EXCEEDED', () => {
      const result = classifier.classify(new Error('file size too large'));
      expect(result.type).toBe('FILE_SIZE_EXCEEDED');
    });

    it('should classify "size limit" as FILE_SIZE_EXCEEDED', () => {
      const result = classifier.classify(new Error('size limit exceeded'));
      expect(result.type).toBe('FILE_SIZE_EXCEEDED');
    });
  });

  describe('FILE_FORMAT_INVALID detection', () => {
    it('should classify "unsupported format" as FILE_FORMAT_INVALID', () => {
      const result = classifier.classify(new Error('unsupported format'));
      expect(result.type).toBe('FILE_FORMAT_INVALID');
    });

    it('should classify "invalid format" as FILE_FORMAT_INVALID', () => {
      const result = classifier.classify(new Error('invalid format'));
      expect(result.type).toBe('FILE_FORMAT_INVALID');
    });
  });

  describe('UNKNOWN fallback', () => {
    it('should classify unrecognized messages as UNKNOWN', () => {
      const result = classifier.classify(new Error('something completely random'));
      expect(result.type).toBe('UNKNOWN');
      expect(result.severity).toBe('low');
      expect(result.recoverable).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Classification priority ordering
  // ---------------------------------------------------------------------------

  describe('priority ordering', () => {
    it('should prioritize OOM over generic rendering errors', () => {
      const result = classifier.classify(new Error('render failed: out of memory'));
      expect(result.type).toBe('RENDERING_OOM');
    });

    it('should prioritize rate limit over generic LLM errors', () => {
      const result = classifier.classify(new Error('gemini API rate limit hit'));
      expect(result.type).toBe('LLM_RATE_LIMITED');
    });

    it('should prioritize storage over file size for disk space errors', () => {
      const result = classifier.classify(new Error('No space left for file size'));
      expect(result.type).toBe('STORAGE_ERROR');
    });
  });

  // ---------------------------------------------------------------------------
  // PipelineError pre-classification
  // ---------------------------------------------------------------------------

  describe('PipelineError pre-classification', () => {
    it('should use errorType from PipelineError-like objects', () => {
      const error = new Error('Some message') as Error & { errorType: ErrorType; stage: string };
      error.errorType = 'NETWORK_ERROR';
      error.stage = 'transcription';

      const result = classifier.classify(error);
      expect(result.type).toBe('NETWORK_ERROR');
      expect(result.stage).toBe('transcription');
    });

    it('should use stage from PipelineError when context stage is absent', () => {
      const error = new Error('msg') as Error & { errorType: ErrorType; stage: string };
      error.errorType = 'LLM_API_ERROR';
      error.stage = 'analysis';

      const result = classifier.classify(error);
      expect(result.stage).toBe('analysis');
    });

    it('should fall back to context.stage when PipelineError has no stage', () => {
      const error = new Error('msg') as Error & { errorType: ErrorType; stage?: string };
      error.errorType = 'RENDERING_ERROR';
      error.stage = undefined;

      const result = classifier.classify(error, { stage: 'render' });
      expect(result.stage).toBe('render');
    });
  });

  // ---------------------------------------------------------------------------
  // Context handling
  // ---------------------------------------------------------------------------

  describe('context handling', () => {
    it('should use context.stage for non-PipelineError', () => {
      const result = classifier.classify(new Error('some error'), { stage: 'pipeline' });
      expect(result.stage).toBe('pipeline');
    });

    it('should default to "unknown" stage when no context', () => {
      const result = classifier.classify(new Error('some error'));
      expect(result.stage).toBe('unknown');
    });
  });

  // ---------------------------------------------------------------------------
  // ClassifiedError structure
  // ---------------------------------------------------------------------------

  describe('ClassifiedError structure', () => {
    it('should include all required fields', () => {
      const originalError = new Error('test error');
      const result = classifier.classify(originalError);

      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('severity');
      expect(result).toHaveProperty('stage');
      expect(result).toHaveProperty('originalError');
      expect(result).toHaveProperty('userMessage');
      expect(result).toHaveProperty('recoverable');
      expect(result).toHaveProperty('suggestedAction');
      expect(result.originalError).toBe(originalError);
    });

    it('should have non-empty userMessage', () => {
      const result = classifier.classify(new Error('anything'));
      expect(result.userMessage.length).toBeGreaterThan(0);
    });

    it('should have non-empty suggestedAction', () => {
      const result = classifier.classify(new Error('anything'));
      expect(result.suggestedAction.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Batch classification
  // ---------------------------------------------------------------------------

  describe('classifyBatch', () => {
    it('should classify multiple errors', () => {
      const errors = [
        new Error('network timeout'),
        new Error('out of memory'),
        new Error('rate limit'),
      ];
      const results = classifier.classifyBatch(errors);
      expect(results).toHaveLength(3);
      expect(results[0].type).toBe('NETWORK_ERROR');
      expect(results[1].type).toBe('RENDERING_OOM');
      expect(results[2].type).toBe('LLM_RATE_LIMITED');
    });

    it('should handle empty array', () => {
      const results = classifier.classifyBatch([]);
      expect(results).toHaveLength(0);
    });

    it('should pass context to each classification', () => {
      const results = classifier.classifyBatch(
        [new Error('error1'), new Error('error2')],
        { stage: 'test-stage' }
      );
      expect(results[0].stage).toBe('test-stage');
      expect(results[1].stage).toBe('test-stage');
    });
  });

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  describe('getStatistics', () => {
    it('should return zero stats on fresh classifier', () => {
      const stats = classifier.getStatistics();
      expect(stats.total).toBe(0);
      expect(stats.mostCommonType).toBe('UNKNOWN');
    });

    it('should count types correctly', () => {
      classifier.classify(new Error('network error'));
      classifier.classify(new Error('connection refused'));
      classifier.classify(new Error('out of memory'));
      classifier.classify(new Error('random unknown thing'));

      const stats = classifier.getStatistics();
      expect(stats.total).toBe(4);
      expect(stats.byType.NETWORK_ERROR).toBe(2);
      expect(stats.byType.RENDERING_OOM).toBe(1);
      expect(stats.byType.UNKNOWN).toBe(1);
    });

    it('should find most common type', () => {
      classifier.classify(new Error('rate limit'));
      classifier.classify(new Error('rate limit exceeded'));
      classifier.classify(new Error('out of memory'));

      const stats = classifier.getStatistics();
      expect(stats.mostCommonType).toBe('LLM_RATE_LIMITED');
    });

    it('should handle tie in mostCommonType gracefully', () => {
      classifier.classify(new Error('network error'));
      classifier.classify(new Error('out of memory'));

      const stats = classifier.getStatistics();
      expect(stats.total).toBe(2);
      // Both have count 1, either could be "most common"
      expect(['NETWORK_ERROR', 'RENDERING_OOM']).toContain(stats.mostCommonType);
    });
  });

  // ---------------------------------------------------------------------------
  // Error profile correctness
  // ---------------------------------------------------------------------------

  describe('error profiles', () => {
    const testCases: Array<{ type: ErrorType; message: string; expectedSeverity: string; expectedRecoverable: boolean }> = [
      { type: 'FILE_FORMAT_INVALID', message: 'unsupported format', expectedSeverity: 'medium', expectedRecoverable: true },
      { type: 'FILE_SIZE_EXCEEDED', message: 'file size too large', expectedSeverity: 'medium', expectedRecoverable: true },
      { type: 'LLM_API_ERROR', message: 'gemini error', expectedSeverity: 'high', expectedRecoverable: true },
      { type: 'LLM_RATE_LIMITED', message: 'rate limit', expectedSeverity: 'medium', expectedRecoverable: true },
      { type: 'LLM_TIMEOUT', message: 'llm timed out', expectedSeverity: 'medium', expectedRecoverable: true },
      { type: 'RENDERING_ERROR', message: 'render failed', expectedSeverity: 'high', expectedRecoverable: true },
      { type: 'RENDERING_OOM', message: 'out of memory', expectedSeverity: 'critical', expectedRecoverable: true },
      { type: 'NETWORK_ERROR', message: 'network error', expectedSeverity: 'high', expectedRecoverable: true },
      { type: 'STORAGE_ERROR', message: 'no space left', expectedSeverity: 'high', expectedRecoverable: true },
      { type: 'QUALITY_GATE_FAILED', message: 'quality gate', expectedSeverity: 'high', expectedRecoverable: true },
      { type: 'UNKNOWN', message: 'totally unique error', expectedSeverity: 'low', expectedRecoverable: false },
    ];

    for (const tc of testCases) {
      it(`should have correct profile for ${tc.type}`, () => {
        const result = classifier.classify(new Error(tc.message));
        expect(result.type).toBe(tc.type);
        expect(result.severity).toBe(tc.expectedSeverity);
        expect(result.recoverable).toBe(tc.expectedRecoverable);
      });
    }
  });
});
