/**
 * Tests for ErrorClassifier (src/quality/error-classifier.ts)
 */

import { ErrorClassifier } from '@/quality/error-classifier';

describe('ErrorClassifier', () => {
  let classifier: ErrorClassifier;

  beforeEach(() => {
    classifier = new ErrorClassifier();
  });

  // ── Pattern-based classification ──────────────────────────────────

  describe('classify by error message patterns', () => {
    test('classifies OOM errors before generic rendering errors', () => {
      const result = classifier.classify(new Error('Out of memory during rendering'));
      expect(result.type).toBe('RENDERING_OOM');
      expect(result.severity).toBe('critical');
      expect(result.recoverable).toBe(true);
    });

    test('classifies heap allocation failure as OOM', () => {
      const result = classifier.classify(new Error('FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory'));
      expect(result.type).toBe('RENDERING_OOM');
    });

    test('classifies rate limit errors before generic LLM errors', () => {
      const result = classifier.classify(new Error('Rate limit exceeded for Gemini API'));
      expect(result.type).toBe('LLM_RATE_LIMITED');
      expect(result.severity).toBe('medium');
    });

    test('classifies quota exceeded as rate limited', () => {
      const result = classifier.classify(new Error('quota reached for this account'));
      expect(result.type).toBe('LLM_RATE_LIMITED');
    });

    test('classifies too many requests as rate limited', () => {
      const result = classifier.classify(new Error('Too many requests in the last minute'));
      expect(result.type).toBe('LLM_RATE_LIMITED');
    });

    test('classifies LLM timeout errors', () => {
      const result = classifier.classify(new Error('LLM request timed out after 30s'));
      expect(result.type).toBe('LLM_TIMEOUT');
    });

    test('classifies generic LLM API errors', () => {
      const result = classifier.classify(new Error('Gemini API returned 503'));
      expect(result.type).toBe('LLM_API_ERROR');
      expect(result.severity).toBe('high');
    });

    test('classifies OpenAI errors as LLM API errors', () => {
      const result = classifier.classify(new Error('openai service unavailable'));
      expect(result.type).toBe('LLM_API_ERROR');
    });

    test('classifies rendering errors', () => {
      const result = classifier.classify(new Error('render failed: frame timeout'));
      expect(result.type).toBe('RENDERING_ERROR');
    });

    test('classifies video rendering errors', () => {
      const result = classifier.classify(new Error('video encoding error during export'));
      expect(result.type).toBe('RENDERING_ERROR');
    });

    test('classifies network errors', () => {
      const result = classifier.classify(new Error('ECONNREFUSED: connection refused'));
      expect(result.type).toBe('NETWORK_ERROR');
    });

    test('classifies fetch failure as network error', () => {
      const result = classifier.classify(new Error('fetch failed: network error'));
      expect(result.type).toBe('NETWORK_ERROR');
    });

    test('classifies storage errors', () => {
      const result = classifier.classify(new Error('No space left on device'));
      expect(result.type).toBe('STORAGE_ERROR');
    });

    test('classifies I/O errors as storage errors', () => {
      const result = classifier.classify(new Error('I/O error writing to disk'));
      expect(result.type).toBe('STORAGE_ERROR');
    });

    test('classifies quality gate failures', () => {
      const result = classifier.classify(new Error('quality score below threshold'));
      expect(result.type).toBe('QUALITY_GATE_FAILED');
    });

    test('classifies file size exceeded errors', () => {
      const result = classifier.classify(new Error('File size exceeds maximum allowed'));
      expect(result.type).toBe('FILE_SIZE_EXCEEDED');
    });

    test('classifies file format invalid errors', () => {
      const result = classifier.classify(new Error('unsupported file type: .exe'));
      expect(result.type).toBe('FILE_FORMAT_INVALID');
    });

    test('classifies unknown errors as UNKNOWN', () => {
      const result = classifier.classify(new Error('something completely unexpected'));
      expect(result.type).toBe('UNKNOWN');
      expect(result.severity).toBe('low');
      expect(result.recoverable).toBe(false);
    });
  });

  // ── PipelineError pre-classified objects ───────────────────────────

  describe('pre-classified PipelineError', () => {
    test('uses pre-classified errorType from PipelineError', () => {
      const error = new Error('some message') as Error & { errorType: string; stage: string };
      error.errorType = 'NETWORK_ERROR';
      error.stage = 'transcription';
      const result = classifier.classify(error);
      expect(result.type).toBe('NETWORK_ERROR');
      expect(result.stage).toBe('transcription');
    });
  });

  // ── Context ────────────────────────────────────────────────────────

  describe('context', () => {
    test('uses context stage when error has no stage', () => {
      const result = classifier.classify(new Error('unknown'), { stage: 'rendering' });
      expect(result.stage).toBe('rendering');
    });

    test('defaults stage to unknown', () => {
      const result = classifier.classify(new Error('mystery'));
      expect(result.stage).toBe('unknown');
    });
  });

  // ── Classified error structure ─────────────────────────────────────

  describe('classified error structure', () => {
    test('includes all required fields', () => {
      const result = classifier.classify(new Error('LLM API error 500'));
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('severity');
      expect(result).toHaveProperty('stage');
      expect(result).toHaveProperty('originalError');
      expect(result).toHaveProperty('userMessage');
      expect(result).toHaveProperty('recoverable');
      expect(result).toHaveProperty('suggestedAction');
      expect(result.originalError.message).toBe('LLM API error 500');
    });

    test('userMessage is human-readable', () => {
      const result = classifier.classify(new Error('rate limit hit'));
      expect(typeof result.userMessage).toBe('string');
      expect(result.userMessage.length).toBeGreaterThan(0);
    });
  });

  // ── classifyBatch ──────────────────────────────────────────────────

  describe('classifyBatch', () => {
    test('classifies multiple errors at once', () => {
      const errors = [
        new Error('LLM timeout'),
        new Error('Out of memory'),
        new Error('file format invalid'),
      ];
      const results = classifier.classifyBatch(errors);
      expect(results).toHaveLength(3);
      expect(results[0].type).toBe('LLM_TIMEOUT');
      expect(results[1].type).toBe('RENDERING_OOM');
      expect(results[2].type).toBe('FILE_FORMAT_INVALID');
    });

    test('passes context to each classification', () => {
      const results = classifier.classifyBatch(
        [new Error('mystery'), new Error('also mystery')],
        { stage: 'analysis' },
      );
      expect(results.every(r => r.stage === 'analysis')).toBe(true);
    });
  });

  // ── getStatistics ──────────────────────────────────────────────────

  describe('getStatistics', () => {
    test('returns empty stats for no classifications', () => {
      const stats = classifier.getStatistics();
      expect(stats.total).toBe(0);
      // byType is initialized with all ErrorType keys set to 0 by createEmptyByType()
      expect(Object.keys(stats.byType).length).toBeGreaterThan(0);
      expect(stats.total).toBe(0);
      expect(stats.mostCommonType).toBe('UNKNOWN');
    });

    test('tracks classification counts by type', () => {
      classifier.classify(new Error('LLM API error'));
      classifier.classify(new Error('another LLM API error'));
      classifier.classify(new Error('Out of memory'));
      const stats = classifier.getStatistics();
      expect(stats.total).toBe(3);
      expect(stats.byType.LLM_API_ERROR).toBe(2);
      expect(stats.byType.RENDERING_OOM).toBe(1);
    });

    test('identifies most common type', () => {
      classifier.classify(new Error('LLM timeout'));
      classifier.classify(new Error('LLM API error'));
      classifier.classify(new Error('LLM API error'));
      const stats = classifier.getStatistics();
      expect(stats.mostCommonType).toBe('LLM_API_ERROR');
    });

    test('accumulates across classify and classifyBatch', () => {
      classifier.classify(new Error('network error'));
      classifier.classifyBatch([new Error('storage error'), new Error('network failure')]);
      const stats = classifier.getStatistics();
      expect(stats.total).toBe(3);
      expect(stats.byType.NETWORK_ERROR).toBe(2);
      expect(stats.byType.STORAGE_ERROR).toBe(1);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────

  describe('edge cases', () => {
    test('handles empty error message', () => {
      const result = classifier.classify(new Error(''));
      expect(result.type).toBe('UNKNOWN');
    });

    test('case-insensitive pattern matching', () => {
      const result = classifier.classify(new Error('OUT OF MEMORY'));
      expect(result.type).toBe('RENDERING_OOM');
    });

    test('disk space error before file size', () => {
      // "No space left on device" contains "file" substrings potentially
      const result = classifier.classify(new Error('disk write failed'));
      expect(result.type).toBe('STORAGE_ERROR');
    });
  });
});
