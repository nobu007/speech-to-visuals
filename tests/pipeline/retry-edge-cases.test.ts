/**
 * Edge-case tests for retryWithBackoff and ErrorClassifier.
 *
 * Covers configuration boundary values, non-Error throws, empty inputs,
 * and classification pattern priority that are not exercised by the
 * existing unit or integration test suites.
 */

import { retryWithBackoff } from '@/pipeline/retry';
import {
  ErrorClassifier,
  ClassifiedError,
} from '@/quality/error-classifier';

// ---------------------------------------------------------------------------
// retryWithBackoff — configuration edge cases
// ---------------------------------------------------------------------------

describe('retryWithBackoff edge cases', () => {
  it('maxRetries=0 tries exactly once and succeeds', async () => {
    const fn = jest.fn().mockResolvedValue('ok');

    const { result, attempts } = await retryWithBackoff(fn, {
      maxRetries: 0,
      baseDelayMs: 1,
    });

    expect(result).toBe('ok');
    expect(attempts).toBe(0);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('maxRetries=0 throws immediately on failure with no retry', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('LLM API error: timeout'));

    await expect(
      retryWithBackoff(fn, { maxRetries: 0, baseDelayMs: 1 }),
    ).rejects.toThrow('LLM API error: timeout');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('baseDelayMs=0 retries immediately (zero-delay backoff)', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('LLM API error: timeout'))
      .mockResolvedValueOnce('recovered');

    const { result, attempts } = await retryWithBackoff(fn, {
      maxRetries: 2,
      baseDelayMs: 0,
      backoffFactor: 2,
    });

    expect(result).toBe('recovered');
    expect(attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('backoffFactor=1 produces constant (linear) delays', async () => {
    const delays: number[] = [];
    const originalSetTimeout = global.setTimeout;

    global.setTimeout = ((cb: (...args: unknown[]) => void, ms?: number) => {
      if (typeof ms === 'number') delays.push(ms);
      return originalSetTimeout(cb, 0) as unknown as NodeJS.Timeout;
    }) as unknown as typeof setTimeout;

    try {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('network connection refused'))
        .mockRejectedValueOnce(new Error('network connection refused'))
        .mockResolvedValueOnce('ok');

      await retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelayMs: 50,
        backoffFactor: 1,
      });

      // 50*1^0=50, 50*1^1=50 → constant
      expect(delays).toEqual([50, 50]);
    } finally {
      global.setTimeout = originalSetTimeout;
    }
  });

  it('attempts count reflects number of retries, not total calls', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('LLM API error: timeout'))
      .mockRejectedValueOnce(new Error('LLM rate limit exceeded'))
      .mockResolvedValueOnce('ok');

    const { result, attempts } = await retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 1,
    });

    expect(result).toBe('ok');
    expect(attempts).toBe(2); // 2 retries, 3 total calls
    expect(fn).toHaveBeenCalledTimes(3);
  });

  // --- Non-Error throws ---

  it('wraps numeric throws as non-recoverable (UNKNOWN)', async () => {
    const fn = jest.fn().mockRejectedValueOnce(42).mockResolvedValueOnce('ok');

    await expect(
      retryWithBackoff(fn, { baseDelayMs: 1 }),
    ).rejects.toThrow('42');

    // UNKNOWN → non-recoverable → no retry
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('wraps object throws as non-recoverable (UNKNOWN)', async () => {
    const obj = { code: 'ERR_CUSTOM', detail: 'bad' };
    const fn = jest.fn().mockRejectedValueOnce(obj).mockResolvedValueOnce('ok');

    await expect(
      retryWithBackoff(fn, { baseDelayMs: 1 }),
    ).rejects.toThrow('[object Object]');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('wraps undefined throws as non-recoverable', async () => {
    const fn = jest.fn().mockRejectedValueOnce(undefined).mockResolvedValueOnce('ok');

    await expect(
      retryWithBackoff(fn, { baseDelayMs: 1 }),
    ).rejects.toThrow('undefined');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('wraps null throws as non-recoverable', async () => {
    const fn = jest.fn().mockRejectedValueOnce(null).mockResolvedValueOnce('ok');

    await expect(
      retryWithBackoff(fn, { baseDelayMs: 1 }),
    ).rejects.toThrow('null');

    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// ErrorClassifier — edge cases
// ---------------------------------------------------------------------------

describe('ErrorClassifier edge cases', () => {
  let classifier: ErrorClassifier;

  beforeEach(() => {
    classifier = new ErrorClassifier();
  });

  // --- classifyBatch ---

  it('classifyBatch with empty array returns empty array', () => {
    const result = classifier.classifyBatch([]);
    expect(result).toEqual([]);
  });

  it('classifyBatch with single error returns single-element array', () => {
    const result = classifier.classifyBatch([new Error('LLM API error')]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('LLM_API_ERROR');
  });

  // --- getStatistics on fresh / empty instance ---

  it('getStatistics on fresh instance returns zero stats with UNKNOWN as mostCommonType', () => {
    const stats = classifier.getStatistics();

    expect(stats.total).toBe(0);
    expect(stats.byType).toEqual({});
    expect(stats.mostCommonType).toBe('UNKNOWN');
  });

  // --- Classification history tracking ---

  it('classifications accumulate in history across classify and classifyBatch', () => {
    classifier.classify(new Error('LLM API error'));
    classifier.classifyBatch([
      new Error('network connection refused'),
      new Error('storage write failed'),
    ]);

    const stats = classifier.getStatistics();
    expect(stats.total).toBe(3);
    expect(stats.byType['LLM_API_ERROR']).toBe(1);
    expect(stats.byType['NETWORK_ERROR']).toBe(1);
    expect(stats.byType['STORAGE_ERROR']).toBe(1);
  });

  // --- Case insensitivity ---

  it('matches error patterns case-insensitively (LLM vs llm)', () => {
    const upper = classifier.classify(new Error('LLM API error'));
    const lower = classifier.classify(new Error('llm api error'));

    expect(upper.type).toBe('LLM_API_ERROR');
    expect(lower.type).toBe('LLM_API_ERROR');
    expect(upper.recoverable).toBe(lower.recoverable);
  });

  it('matches NETWORK_ERROR case-insensitively', () => {
    const mixed = classifier.classify(new Error('Network Connection Refused'));
    expect(mixed.type).toBe('NETWORK_ERROR');
  });

  // --- Overlapping pattern priority ---

  it('OOM pattern takes priority over generic rendering error', () => {
    const err = classifier.classify(
      new Error('rendering failed: JavaScript heap out of memory'),
    );
    // OOM rule is first in CLASSIFICATION_RULES, so it should win
    expect(err.type).toBe('RENDERING_OOM');
    expect(err.severity).toBe('critical');
  });

  it('rate-limit pattern takes priority over generic LLM error', () => {
    const err = classifier.classify(
      new Error('LLM API rate limit exceeded'),
    );
    expect(err.type).toBe('LLM_RATE_LIMITED');
    // Not LLM_API_ERROR
  });

  it('storage pattern takes priority over file-size pattern for disk messages', () => {
    const err = classifier.classify(
      new Error('no space left on device, file size too large'),
    );
    // STORAGE_ERROR rule comes before FILE_SIZE_EXCEEDED in CLASSIFICATION_RULES
    expect(err.type).toBe('STORAGE_ERROR');
  });

  // --- Error with empty message ---

  it('classifies error with empty message as UNKNOWN', () => {
    const err = classifier.classify(new Error(''));
    expect(err.type).toBe('UNKNOWN');
    expect(err.recoverable).toBe(false);
  });
});
