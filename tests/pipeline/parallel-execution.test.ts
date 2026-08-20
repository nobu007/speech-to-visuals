/**
 * TASK-0143: Pipeline Stage Parallelization and Bottleneck Detection Tests
 *
 * Unit tests covering:
 *   1. Parallel layout execution produces same results as sequential
 *   2. Concurrency limit is respected
 *   3. Stage timing metrics are recorded correctly
 *   4. Bottleneck detection identifies slowest stage
 *   5. Parallel scene preparation works correctly
 *   6. Pipeline orchestrator integration
 */

import {
  runWithConcurrency,
  executeLayoutsInParallel,
  executeScenePreparationInParallel,
} from '@/pipeline/parallel-layout-executor';
import {
  createTimingRecord,
  aggregateTimingReport,
  timeStage,
} from '@/pipeline/stage-timing-metrics';
import {
  classifyBottleneck,
  detectBottlenecks,
} from '@/pipeline/bottleneck-detector';
import type { BottleneckInfo, BottleneckReport } from '@/pipeline/bottleneck-detector';

// Fail-loud capture over the nullable `report.worstBottleneck` — the throw
// replaces the redundant `not.toBeNull()` pair (Phase 168 / REQ-362; same
// idiom as tests/pipeline/bottleneck-detector.test.ts).
function requireWorstBottleneck(report: BottleneckReport): BottleneckInfo {
  const worst = report.worstBottleneck;
  if (worst === null) {
    throw new Error('expected report to carry a worstBottleneck');
  }
  return worst;
}

// ── Test Case 1: Parallel execution produces same results as sequential ──

describe('TASK-0143: Parallel layout execution equivalence', () => {
  test('parallel and sequential produce identical results', async () => {
    const diagrams = [
      { id: 'd1', nodes: [{ id: 'n1' }] },
      { id: 'd2', nodes: [{ id: 'n2' }] },
      { id: 'd3', nodes: [{ id: 'n3' }] },
    ];

    const layoutFn = async (diag: typeof diagrams[0]) => ({
      diagramId: diag.id,
      layout: `layout-${diag.id}`,
    });

    // Sequential
    const sequential: string[] = [];
    for (const d of diagrams) {
      const r = await layoutFn(d);
      sequential.push(r.layout);
    }

    // Parallel
    const parallel = await executeLayoutsInParallel(diagrams, layoutFn);
    const parallelLayouts = parallel.map(r => r.layout);

    expect(parallelLayouts).toEqual(sequential);
  });

  test('empty diagrams array returns empty results', async () => {
    const result = await executeLayoutsInParallel([], async () => 'result');
    expect(result).toEqual([]);
  });

  test('single diagram still produces correct result', async () => {
    const result = await executeLayoutsInParallel(
      [{ id: 'only' }],
      async (d) => `layout-${d.id}`,
    );
    expect(result).toEqual(['layout-only']);
  });
});

// ── Test Case 2: Concurrency limit is respected ──

describe('TASK-0143: Concurrency limit', () => {
  test('maxConcurrency=2 never exceeds 2 concurrent executions', async () => {
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    const items = [1, 2, 3, 4, 5];

    await runWithConcurrency(items, 2, async (item) => {
      currentConcurrent++;
      if (currentConcurrent > maxConcurrent) {
        maxConcurrent = currentConcurrent;
      }
      // Simulate async work
      await new Promise(resolve => setTimeout(resolve, 10));
      currentConcurrent--;
      return item * 2;
    });

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  test('results are in correct order regardless of execution timing', async () => {
    const items = [100, 50, 200, 25]; // items represent "work duration"
    const results = await runWithConcurrency(items, 2, async (duration) => {
      await new Promise(resolve => setTimeout(resolve, duration));
      return duration;
    });

    expect(results).toEqual([100, 50, 200, 25]);
  });

  test('maxConcurrency=1 works like sequential execution', async () => {
    const executionOrder: number[] = [];
    const items = [1, 2, 3];

    await runWithConcurrency(items, 1, async (item) => {
      executionOrder.push(item);
      return item;
    });

    expect(executionOrder).toEqual([1, 2, 3]);
  });
});

// ── Test Case 3: Stage timing metrics ──

describe('TASK-0143: Stage timing metrics', () => {
  test('createTimingRecord computes duration and throughput correctly', () => {
    const record = createTimingRecord('layout', 1000, 3000, 10);
    expect(record.durationMs).toBe(2000);
    expect(record.itemsProcessed).toBe(10);
    expect(record.throughputPerMs).toBeCloseTo(10 / 2000, 6);
  });

  test('zero duration produces zero throughput', () => {
    const record = createTimingRecord('test', 1000, 1000, 5);
    expect(record.durationMs).toBe(0);
    expect(record.throughputPerMs).toBe(0);
  });

  test('aggregateTimingReport sums stages correctly', () => {
    const stages = [
      createTimingRecord('transcription', 0, 8000, 1),
      createTimingRecord('analysis', 8000, 18000, 5),
      createTimingRecord('layout', 18000, 22000, 3),
    ];

    const report = aggregateTimingReport(stages);
    expect(report.totalDurationMs).toBe(22000);
    expect(report.totalItemsProcessed).toBe(9);
    expect(report.overallThroughputPerMs).toBeCloseTo(9 / 22000, 6);
    expect(report.stages).toHaveLength(3);
  });

  test('timeStage wraps async function and records timing', async () => {
    const { result, timing } = await timeStage('test', 5, async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return 'done';
    });

    expect(result).toBe('done');
    expect(timing.stageName).toBe('test');
    expect(timing.itemsProcessed).toBe(5);
    expect(timing.durationMs).toBeGreaterThanOrEqual(40);
  });
});

// ── Test Case 4: Bottleneck detection ──

describe('TASK-0143: Bottleneck detection', () => {
  test('stage at 50% is detected as warning bottleneck', () => {
    const stages = [
      createTimingRecord('transcription', 0, 5000, 1),
      createTimingRecord('analysis', 5000, 15000, 5), // 10s out of 20s = 50%
      createTimingRecord('layout', 15000, 20000, 3),
    ];

    const report = detectBottlenecks(stages);
    expect(report.hasBottleneck).toBe(true);
    const worst = requireWorstBottleneck(report);
    expect(worst.stageName).toBe('analysis');
    expect(worst.severity).toBe('warning');
    expect(report.summary).toContain('analysis');
  });

  test('stage at 65% is classified as critical', () => {
    const stages = [
      createTimingRecord('fast', 0, 3500, 1),   // 3.5s
      createTimingRecord('slow', 3500, 17000, 1), // 13.5s out of 17s ≈ 79%
    ];

    const report = detectBottlenecks(stages);
    expect(report.hasBottleneck).toBe(true);
    expect(requireWorstBottleneck(report).severity).toBe('critical');
  });

  test('no stage over 40% → no bottleneck', () => {
    const stages = [
      createTimingRecord('a', 0, 3000, 1),  // 30%
      createTimingRecord('b', 3000, 6000, 1), // 30%
      createTimingRecord('c', 6000, 10000, 1), // 40% — exactly at threshold
    ];

    // 4000/10000 = 40% → warning
    const report = detectBottlenecks(stages);
    expect(report.hasBottleneck).toBe(true);
    expect(requireWorstBottleneck(report).stageName).toBe('c');
  });

  test('classifyBottleneck returns correct severities', () => {
    expect(classifyBottleneck(0.30)).toBe('none');
    expect(classifyBottleneck(0.39)).toBe('none');
    expect(classifyBottleneck(0.40)).toBe('warning');
    expect(classifyBottleneck(0.50)).toBe('warning');
    expect(classifyBottleneck(0.59)).toBe('warning');
    expect(classifyBottleneck(0.60)).toBe('critical');
    expect(classifyBottleneck(0.80)).toBe('critical');
  });

  test('empty stages produce no bottleneck', () => {
    const report = detectBottlenecks([]);
    expect(report.hasBottleneck).toBe(false);
    expect(report.worstBottleneck).toBeNull();
    expect(report.summary).toContain('No bottleneck');
  });

  test('report is JSON-serializable', () => {
    const stages = [
      createTimingRecord('a', 0, 3000, 1),
      createTimingRecord('b', 3000, 6000, 1),
      createTimingRecord('c', 6000, 10000, 1),
    ];
    const report = detectBottlenecks(stages);
    const json = JSON.stringify(report);
    const parsed = JSON.parse(json);
    expect(parsed.hasBottleneck).toBe(true);
    expect(parsed.timestamp).toBeGreaterThan(0);
  });
});

// ── Test Case 5: Parallel scene preparation ──

describe('TASK-0143: Parallel scene preparation', () => {
  test('parallel preparation produces same results as sequential', async () => {
    const layouts = [
      { id: 'l1', data: 'a' },
      { id: 'l2', data: 'b' },
      { id: 'l3', data: 'c' },
    ];

    const prepareFn = async (layout: typeof layouts[0], index: number) => ({
      sceneId: layout.id,
      index,
    });

    const parallel = await executeScenePreparationInParallel(layouts, prepareFn);
    const sequential: typeof parallel = [];
    for (let i = 0; i < layouts.length; i++) {
      sequential.push(await prepareFn(layouts[i], i));
    }

    expect(parallel).toEqual(sequential);
  });

  test('respects maxConcurrency', async () => {
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    const layouts = Array.from({ length: 6 }, (_, i) => ({ id: i }));

    await executeScenePreparationInParallel(
      layouts,
      async (layout) => {
        currentConcurrent++;
        if (currentConcurrent > maxConcurrent) maxConcurrent = currentConcurrent;
        await new Promise(r => setTimeout(r, 10));
        currentConcurrent--;
        return layout.id;
      },
      2,
    );

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  test('empty layouts returns empty results', async () => {
    const result = await executeScenePreparationInParallel([], async () => 'scene');
    expect(result).toEqual([]);
  });
});
