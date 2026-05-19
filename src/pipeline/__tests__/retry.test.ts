/**
 * Unit tests for src/pipeline/retry.ts — retryWithBackoff
 *
 * Uses short real delays (1-10ms) to keep tests fast without fake timers.
 */

import { retryWithBackoff } from '../retry';

describe('retryWithBackoff', () => {
  it('returns the result on first successful call', async () => {
    const fn = jest.fn().mockResolvedValue('ok');

    const result = await retryWithBackoff(fn);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on recoverable error and eventually succeeds', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('LLM API error: 503 service unavailable'))
      .mockResolvedValueOnce('recovered');

    const result = await retryWithBackoff(fn, {
      baseDelayMs: 1,
      backoffFactor: 2,
      maxRetries: 3,
    });

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws immediately on non-recoverable error', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('something completely unexpected'));

    await expect(
      retryWithBackoff(fn, { maxRetries: 5, baseDelayMs: 1 }),
    ).rejects.toThrow('something completely unexpected');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after exhausting all retries on recoverable errors', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('LLM API error: timeout'));

    await expect(
      retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 1, backoffFactor: 2 }),
    ).rejects.toThrow('LLM API error: timeout');

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('retries on storage errors (recoverable)', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('storage write failed: no space left'))
      .mockResolvedValueOnce('saved');

    const result = await retryWithBackoff(fn, { baseDelayMs: 1 });

    expect(result).toBe('saved');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on rendering errors (recoverable)', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('rendering failed: frame error'))
      .mockResolvedValueOnce('rendered');

    const result = await retryWithBackoff(fn, { baseDelayMs: 1 });

    expect(result).toBe('rendered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries the correct number of times with maxRetries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('LLM API error: internal error'));

    await expect(
      retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 1 }),
    ).rejects.toThrow('LLM API error: internal error');

    // initial + 3 retries = 4 total
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('handles non-Error throws by wrapping them as non-recoverable', async () => {
    // A bare string rejection has no pattern match → UNKNOWN → non-recoverable
    const fn = jest
      .fn()
      .mockRejectedValueOnce('string error')
      .mockResolvedValueOnce('ok');

    await expect(
      retryWithBackoff(fn, { baseDelayMs: 1 }),
    ).rejects.toThrow('string error');

    // UNKNOWN is non-recoverable → no retry
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on rate-limited errors', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('LLM rate limit exceeded, quota reached'))
      .mockResolvedValueOnce('ok');

    const result = await retryWithBackoff(fn, { baseDelayMs: 1 });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on quality gate failures', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('quality score below threshold'))
      .mockResolvedValueOnce('passed');

    const result = await retryWithBackoff(fn, { baseDelayMs: 1 });

    expect(result).toBe('passed');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('retryWithBackoff — delay timing', () => {
  let delays: number[];
  let originalSetTimeout: typeof setTimeout;

  beforeEach(() => {
    delays = [];
    originalSetTimeout = global.setTimeout;
    // Replace setTimeout to capture delays without actually waiting
    global.setTimeout = ((cb: (...args: unknown[]) => void, ms?: number) => {
      if (typeof ms === 'number' && ms > 0) {
        delays.push(ms);
      }
      // Execute immediately to keep tests fast
      return originalSetTimeout(cb, 0) as unknown as NodeJS.Timeout;
    }) as unknown as typeof setTimeout;
  });

  afterEach(() => {
    global.setTimeout = originalSetTimeout;
  });

  it('applies exponential backoff delays', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('network connection refused'))
      .mockRejectedValueOnce(new Error('network connection refused'))
      .mockResolvedValueOnce('ok');

    const result = await retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 100,
      backoffFactor: 3,
    });

    expect(result).toBe('ok');
    expect(delays).toEqual([100, 300]);
  });

  it('respects maxDelayMs cap', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('LLM rate limit exceeded'))
      .mockRejectedValueOnce(new Error('LLM rate limit exceeded'))
      .mockRejectedValueOnce(new Error('LLM rate limit exceeded'))
      .mockResolvedValueOnce('ok');

    const result = await retryWithBackoff(fn, {
      maxRetries: 4,
      baseDelayMs: 10,
      backoffFactor: 4,
      maxDelayMs: 15,
    });

    expect(result).toBe('ok');
    // 10*4^0=10, 10*4^1=40→capped 15, 10*4^2=160→capped 15
    expect(delays).toEqual([10, 15, 15]);
  });
});
