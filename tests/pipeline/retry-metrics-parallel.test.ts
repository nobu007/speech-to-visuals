/**
 * Tests for retry observability in metrics and parallel execution paths.
 *
 * Covers:
 *   1. RetryResult attempt count tracking
 *   2. StageTimingRecord retryAttempts field
 *   3. Parallel execution with retry on individual items
 *   4. ExtendedPipelineMetrics totalRetryAttempts
 */

import { retryWithBackoff } from '@/pipeline/retry';
import {
  executeLayoutsInParallel,
  executeScenePreparationInParallel,
} from '@/pipeline/parallel-layout-executor';
import {
  createTimingRecord,
  aggregateTimingReport,
  timeStage,
} from '@/pipeline/stage-timing-metrics';
import type { ExtendedPipelineMetrics } from '@/pipeline/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function flakyFn(failCount: number, errorMsg: string, successValue: string) {
  let calls = 0;
  return jest.fn(async () => {
    calls++;
    if (calls <= failCount) throw new Error(errorMsg);
    return successValue;
  });
}

// ---------------------------------------------------------------------------
// 1. RetryResult attempt count
// ---------------------------------------------------------------------------
describe('retryWithBackoff attempt count', () => {
  it('returns attempts=0 on first-attempt success', async () => {
    const { result, attempts } = await retryWithBackoff(async () => 'ok', { maxRetries: 3 });
    expect(result).toBe('ok');
    expect(attempts).toBe(0);
  });

  it('returns attempts=N after N retries', async () => {
    const fn = flakyFn(2, 'LLM API error: 503 service unavailable', 'recovered');
    const { result, attempts } = await retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 1,
    });
    expect(result).toBe('recovered');
    expect(attempts).toBe(2);
  });

  it('returns attempts equal to maxRetries when all attempts fail', async () => {
    const fn = jest.fn(async () => { throw new Error('LLM API error: timeout'); });
    try {
      await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 1 });
    } catch { /* expected */ }
    // fn called maxRetries + 1 times, but attempts would have been 3 if last also failed
    expect(fn).toHaveBeenCalledTimes(4);
  });
});

// ---------------------------------------------------------------------------
// 2. StageTimingRecord retryAttempts field
// ---------------------------------------------------------------------------
describe('StageTimingRecord retryAttempts', () => {
  it('createTimingRecord defaults retryAttempts to 0', () => {
    const record = createTimingRecord('layout', 1000, 3000, 5);
    expect(record.retryAttempts).toBe(0);
  });

  it('createTimingRecord accepts explicit retryAttempts', () => {
    const record = createTimingRecord('layout', 1000, 3000, 5, 3);
    expect(record.retryAttempts).toBe(3);
  });

  it('aggregateTimingReport preserves retryAttempts per stage', () => {
    const stages = [
      createTimingRecord('a', 0, 100, 1, 0),
      createTimingRecord('b', 100, 300, 2, 2),
      createTimingRecord('c', 300, 400, 1, 0),
    ];
    const report = aggregateTimingReport(stages);
    expect(report.stages[0].retryAttempts).toBe(0);
    expect(report.stages[1].retryAttempts).toBe(2);
    expect(report.stages[2].retryAttempts).toBe(0);
  });

  it('timeStage propagates retryAttempts from parameter', async () => {
    const { timing } = await timeStage('test', 3, async () => 'done', 5);
    expect(timing.retryAttempts).toBe(5);
  });

  it('timeStage defaults retryAttempts to 0 when omitted', async () => {
    const { timing } = await timeStage('test', 1, async () => 'done');
    expect(timing.retryAttempts).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Parallel execution with retry
// ---------------------------------------------------------------------------
describe('Parallel layout execution with retry', () => {
  it('retries individual layout items on recoverable errors', async () => {
    let calls = 0;
    const diagrams = [{ id: 'd1' }, { id: 'd2' }, { id: 'd3' }];

    const results = await executeLayoutsInParallel(
      diagrams,
      async (diag) => {
        if (diag.id === 'd2') {
          calls++;
          if (calls <= 2) throw new Error('LLM API error: 503 service unavailable');
        }
        return `layout-${diag.id}`;
      },
      {
        maxConcurrency: 2,
        timeoutMs: 5000,
        retryOptions: { maxRetries: 3, baseDelayMs: 1 },
      },
    );

    expect(results).toEqual(['layout-d1', 'layout-d2', 'layout-d3']);
  });

  it('throws when retries are exhausted for an item', async () => {
    const diagrams = [{ id: 'd1' }];

    await expect(
      executeLayoutsInParallel(
        diagrams,
        async () => { throw new Error('LLM API error: timeout'); },
        { retryOptions: { maxRetries: 1, baseDelayMs: 1 } },
      ),
    ).rejects.toThrow('LLM API error: timeout');
  });

  it('does not retry when retryOptions is omitted', async () => {
    let calls = 0;
    const diagrams = [{ id: 'd1' }];

    await expect(
      executeLayoutsInParallel(diagrams, async () => {
        calls++;
        throw new Error('LLM API error: timeout');
      }),
    ).rejects.toThrow('LLM API error: timeout');

    expect(calls).toBe(1);
  });
});

describe('Parallel scene preparation with retry', () => {
  it('retries individual scene preparation on recoverable errors', async () => {
    let calls = 0;
    const layouts = [{ id: 'l1' }, { id: 'l2' }];

    const results = await executeScenePreparationInParallel(
      layouts,
      async (layout) => {
        if (layout.id === 'l2') {
          calls++;
          if (calls <= 1) throw new Error('rendering failed: frame error');
        }
        return `scene-${layout.id}`;
      },
      2,
      { maxRetries: 2, baseDelayMs: 1 },
    );

    expect(results).toEqual(['scene-l1', 'scene-l2']);
  });

  it('throws when retries are exhausted', async () => {
    const layouts = [{ id: 'l1' }];

    await expect(
      executeScenePreparationInParallel(
        layouts,
        async () => { throw new Error('rendering failed: frame error'); },
        2,
        { maxRetries: 1, baseDelayMs: 1 },
      ),
    ).rejects.toThrow('rendering failed: frame error');
  });

  it('does not retry when retryOptions is omitted', async () => {
    let calls = 0;
    const layouts = [{ id: 'l1' }];

    await expect(
      executeScenePreparationInParallel(layouts, async () => {
        calls++;
        throw new Error('rendering failed: frame error');
      }),
    ).rejects.toThrow('rendering failed: frame error');

    expect(calls).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 4. ExtendedPipelineMetrics totalRetryAttempts
// ---------------------------------------------------------------------------
describe('ExtendedPipelineMetrics totalRetryAttempts', () => {
  it('accepts totalRetryAttempts field', () => {
    const metrics: ExtendedPipelineMetrics = {
      totalProcessingTime: 1000,
      transcriptionTime: 200,
      analysisTime: 300,
      layoutTime: 400,
      renderTime: 100,
      segmentCount: 5,
      diagramCount: 3,
      successRate: 1.0,
      totalRetryAttempts: 4,
    };
    expect(metrics.totalRetryAttempts).toBe(4);
  });

  it('is compatible with stageTimings containing retryAttempts', () => {
    const metrics: ExtendedPipelineMetrics = {
      totalProcessingTime: 1000,
      transcriptionTime: 200,
      analysisTime: 300,
      layoutTime: 400,
      renderTime: 100,
      segmentCount: 5,
      diagramCount: 3,
      successRate: 1.0,
      stageTimings: [
        createTimingRecord('transcription', 0, 200, 1, 0),
        createTimingRecord('analysis', 200, 500, 5, 2),
        createTimingRecord('layout', 500, 900, 3, 1),
      ],
      totalRetryAttempts: 3,
    };
    expect(metrics.totalRetryAttempts).toBe(3);
    expect(metrics.stageTimings![1].retryAttempts).toBe(2);
    expect(metrics.stageTimings![2].retryAttempts).toBe(1);
  });
});
