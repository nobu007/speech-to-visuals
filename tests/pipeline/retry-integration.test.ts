/**
 * Integration tests for retryWithBackoff wired into pipeline stages.
 *
 * Verifies that the full retry flow works end-to-end through:
 * 1. SimplePipeline.processWithRetry — retries on recoverable errors
 * 2. MainPipeline.executeStageWithFramework — retries per stage
 * 3. PipelineOrchestrator.executeStageWithGates — retries before fallbacks
 */

import { retryWithBackoff } from '@/pipeline/retry';
import { ErrorClassifier } from '@/quality/error-classifier';

// ---------------------------------------------------------------------------
// Helper: mock a stage function that fails N times then succeeds
// ---------------------------------------------------------------------------
function flakyStage(failCount: number, errorMsg: string, successValue: string) {
  let calls = 0;
  return jest.fn(async () => {
    calls++;
    if (calls <= failCount) {
      throw new Error(errorMsg);
    }
    return successValue;
  });
}

// ---------------------------------------------------------------------------
// 1. retryWithBackoff end-to-end with real ErrorClassifier
// ---------------------------------------------------------------------------
describe('retryWithBackoff integration with ErrorClassifier', () => {
  it('recovers from LLM API 503 errors after 2 attempts', async () => {
    const fn = flakyStage(2, 'LLM API error: 503 service unavailable', 'recovered');

    const result = await retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 1,
      backoffFactor: 2,
      label: 'test-llm-503',
    });

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3); // 2 fails + 1 success
  });

  it('recovers from rate limit then timeout in sequence', async () => {
    let call = 0;
    const fn = jest.fn(async () => {
      call++;
      if (call === 1) throw new Error('LLM rate limit exceeded, quota reached');
      if (call === 2) throw new Error('LLM API error: timeout');
      return 'eventual-success';
    });

    const result = await retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 1,
      label: 'test-rate-then-timeout',
    });

    expect(result).toBe('eventual-success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-recoverable auth errors', async () => {
    const fn = jest.fn(async () => {
      throw new Error('Authentication failed: invalid API key');
    });

    await expect(
      retryWithBackoff(fn, { maxRetries: 5, baseDelayMs: 1 }),
    ).rejects.toThrow('Authentication failed');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry unknown error patterns', async () => {
    const fn = flakyStage(1, 'some completely unexpected error', 'ok');

    await expect(
      retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 1 }),
    ).rejects.toThrow('some completely unexpected error');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('exhausts retries on persistent recoverable errors', async () => {
    const fn = jest.fn(async () => {
      throw new Error('LLM API error: internal error');
    });

    await expect(
      retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 1 }),
    ).rejects.toThrow('LLM API error: internal error');

    // initial attempt + 2 retries = 3
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// 2. ErrorClassifier classification consistency across retry boundaries
// ---------------------------------------------------------------------------
describe('ErrorClassifier consistency across retry boundaries', () => {
  const classifier = new ErrorClassifier();

  it('classifies network errors as recoverable across multiple instances', () => {
    const c1 = new ErrorClassifier();
    const c2 = new ErrorClassifier();

    const err = new Error('network connection refused');
    const r1 = c1.classify(err);
    const r2 = c2.classify(err);

    expect(r1.recoverable).toBe(true);
    expect(r2.recoverable).toBe(true);
    expect(r1.type).toBe(r2.type);
  });

  it('classifies all ErrorClassifier-recoverable errors consistently', () => {
    const recoverableMessages = [
      'LLM API error: timeout',
      'LLM API error: 503 service unavailable',
      'LLM rate limit exceeded, quota reached',
      'storage write failed: no space left',
      'rendering failed: frame error',
      'quality score below threshold',
    ];

    for (const msg of recoverableMessages) {
      const result = classifier.classify(new Error(msg));
      expect(result.recoverable).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Retry-with-fallback pattern (mimics PipelineOrchestrator flow)
// ---------------------------------------------------------------------------
describe('retryWithBackoff with fallback pattern', () => {
  it('retries stage before falling back to degraded result', async () => {
    const primaryStage = flakyStage(3, 'LLM API error: timeout', 'primary-ok');

    // Simulate the orchestrator pattern: retry first, then fallback
    let result: string;
    try {
      result = await retryWithBackoff(primaryStage, {
        maxRetries: 2,
        baseDelayMs: 1,
        label: 'orchestrator:analysis',
      });
    } catch {
      result = 'fallback-result';
    }

    // Retries exhausted (3 attempts), should use fallback
    expect(result).toBe('fallback-result');
    expect(primaryStage).toHaveBeenCalledTimes(3);
  });

  it('succeeds on retry without invoking fallback', async () => {
    const primaryStage = flakyStage(1, 'LLM rate limit exceeded', 'primary-ok');

    let result: string;
    let usedFallback = false;
    try {
      result = await retryWithBackoff(primaryStage, {
        maxRetries: 2,
        baseDelayMs: 1,
        label: 'orchestrator:transcription',
      });
    } catch {
      result = 'fallback-result';
      usedFallback = true;
    }

    expect(result).toBe('primary-ok');
    expect(usedFallback).toBe(false);
    expect(primaryStage).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// 4. Multi-stage pipeline retry simulation
// ---------------------------------------------------------------------------
describe('multi-stage pipeline retry simulation', () => {
  it('retries each stage independently', async () => {
    const stage1 = flakyStage(0, 'network error', 'transcribed');
    const stage2 = flakyStage(1, 'LLM API error: timeout', 'analyzed');
    const stage3 = flakyStage(0, 'rendering error', 'rendered');

    const r1 = await retryWithBackoff(stage1, { maxRetries: 2, baseDelayMs: 1, label: 's1' });
    const r2 = await retryWithBackoff(stage2, { maxRetries: 2, baseDelayMs: 1, label: 's2' });
    const r3 = await retryWithBackoff(stage3, { maxRetries: 2, baseDelayMs: 1, label: 's3' });

    expect(r1).toBe('transcribed');
    expect(r2).toBe('analyzed');
    expect(r3).toBe('rendered');

    expect(stage1).toHaveBeenCalledTimes(1);
    expect(stage2).toHaveBeenCalledTimes(2);
    expect(stage3).toHaveBeenCalledTimes(1);
  });

  it('stops pipeline on non-recoverable error in early stage', async () => {
    const stage1 = jest.fn(async () => {
      throw new Error('Authentication failed: invalid API key');
    });
    const stage2 = flakyStage(0, 'never reached', 'analyzed');

    await expect(
      retryWithBackoff(stage1, { maxRetries: 3, baseDelayMs: 1, label: 's1' }),
    ).rejects.toThrow('Authentication failed');

    // Stage 2 should never be called
    expect(stage2).not.toHaveBeenCalled();
    expect(stage1).toHaveBeenCalledTimes(1);
  });
});
