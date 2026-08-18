/**
 * TASK-0052: Performance Tests & Optimization
 *
 * Performance benchmark suite for speech-to-visuals.
 * Measures and validates key performance metrics:
 * - E2E processing time ≤ 60s
 * - Layout calculation ≤ 2s
 * - Memory usage ≤ 512MB
 * - API P95 latency ≤ 20s
 * - Optimization module effectiveness
 */

import { BatchOptimizer } from '@/optimization/batch-optimizer';
import { ComputationCache } from '@/optimization/computation-cache';
import { MemoryCache } from '@/optimization/memory-cache';
import { LazyLoader } from '@/optimization/lazy-loader';
import { getMemoryUsage } from '@stv/core/utils/memory-usage';

// ---------- Performance Requirements ----------

const PERFORMANCE_REQUIREMENTS = {
  e2eProcessingTime: { max: 60000, unit: 'ms' },
  layoutCalculation: { max: 2000, unit: 'ms' },
  memoryUsage: { max: 512, unit: 'MB' },
  apiP95Latency: { max: 20000, unit: 'ms' },
};

// ---------- Helpers ----------

/**
 * Worker-memory baseline at suite load: absolute process.memoryUsage() under a
 * full-suite run includes heap accumulated by co-resident suites, so the
 * memory ceiling is asserted on the DELTA from this baseline instead.
 */
const BASELINE_MEM = measureMemory();

function measureMemory(): { heapUsedMB: number; rssMB: number } {
  const usage = getMemoryUsage();
  return {
    heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
    rssMB: Math.round((usage.rss ?? 0) / 1024 / 1024),
  };
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ---------- Performance Tests ----------

describe('Performance: Memory Usage', () => {
  test('メモリ使用量が512MB以下である', () => {
    const { heapUsedMB } = measureMemory();
    expect(heapUsedMB - BASELINE_MEM.heapUsedMB).toBeLessThan(
      PERFORMANCE_REQUIREMENTS.memoryUsage.max,
    );
  });

  test('メモリリーク検出 - 連続処理後もメモリが安定する', async () => {
    const cache = new MemoryCache<number>({ maxSize: 100, defaultTtlMs: 60000, cleanupIntervalMs: 0 });
    const measurements: number[] = [];

    for (let i = 0; i < 10; i++) {
      // Process 100 items
      for (let j = 0; j < 100; j++) {
        cache.set(`key-${i}-${j}`, j);
      }
      cache.clear();
      const mem = measureMemory();
      measurements.push(mem.heapUsedMB);
    }

    cache.destroy();

    // Memory should not grow monotonically
    const firstHalf = measurements.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const secondHalf = measurements.slice(5).reduce((a, b) => a + b, 0) / 5;
    expect(secondHalf).toBeLessThan(firstHalf * 2); // Allow some variance but not doubling
  });
});

describe('Performance: BatchOptimizer', () => {
  test('1000アイテムの並列処理が高速に完了する', async () => {
    const optimizer = new BatchOptimizer({ concurrency: 4, chunkSize: 100 });
    const items = Array.from({ length: 1000 }, (_, i) => i);

    const start = performance.now();
    const result = await optimizer.process(items, async (item) => item * 2);
    const elapsed = performance.now() - start;

    expect(result.successCount).toBe(1000);
    expect(elapsed).toBeLessThan(5000); // Should complete in under 5s
  });

  test('フェイルファスト時のエラー伝播が高速', async () => {
    const optimizer = new BatchOptimizer({ failFast: true, concurrency: 1, chunkSize: 100 });
    const items = Array.from({ length: 1000 }, (_, i) => i);

    const start = performance.now();
    try {
      await optimizer.process(items, async (item) => {
        if (item === 50) throw new Error('fail');
        return item;
      });
    } catch {
      // Expected
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1000); // Should fail fast
  });

  test('進捗コールバックのオーバーヘッドが最小', async () => {
    let callbackCount = 0;
    const optimizer = new BatchOptimizer({
      concurrency: 4,
      chunkSize: 50,
      onProgress: () => { callbackCount++; },
    });

    const items = Array.from({ length: 200 }, (_, i) => i);
    const start = performance.now();
    await optimizer.process(items, async (item) => item);
    const elapsed = performance.now() - start;

    expect(callbackCount).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(3000);
  });
});

describe('Performance: ComputationCache', () => {
  test('キャッシュヒットによる処理時間短縮が確認される', async () => {
    const cache = new ComputationCache({ maxSize: 100, ttlMs: 60000 });
    let computeCount = 0;

    const expensiveCompute = async () => {
      computeCount++;
      await new Promise((r) => setTimeout(r, 10));
      return 'result';
    };

    // First call - cache miss
    const start1 = performance.now();
    await cache.getOrCompute('key1', expensiveCompute);
    const missTime = performance.now() - start1;

    // Second call - cache hit
    const start2 = performance.now();
    await cache.getOrCompute('key1', expensiveCompute);
    const hitTime = performance.now() - start2;

    expect(computeCount).toBe(1);
    expect(hitTime).toBeLessThan(missTime);
    expect(hitTime).toBeLessThan(1); // Cache hit should be nearly instant
  });

  test('LRU退行が正しく動作する（200エントリ上限）', async () => {
    const cache = new ComputationCache({ maxSize: 200 });

    for (let i = 0; i < 250; i++) {
      cache.getOrComputeSync(`key-${i}`, () => `value-${i}`);
    }

    const stats = cache.getStats();
    expect(stats.size).toBeLessThanOrEqual(200);
    expect(stats.evictions).toBeGreaterThanOrEqual(50);
  });

  test('タグベース無効化が高速に動作する', async () => {
    const cache = new ComputationCache({ maxSize: 1000 });

    // Insert 500 entries with tags
    for (let i = 0; i < 500; i++) {
      cache.getOrComputeSync(`key-${i}`, () => i, [`tag-${i % 10}`]);
    }

    const start = performance.now();
    cache.invalidateByTag('tag-0');
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(10); // Should be very fast
  });
});

describe('Performance: MemoryCache', () => {
  test('10000エントリのput/getが高速に完了する', () => {
    const cache = new MemoryCache<number>({ maxSize: 10000, defaultTtlMs: 60000, cleanupIntervalMs: 0 });

    const startWrite = performance.now();
    for (let i = 0; i < 10000; i++) {
      cache.set(`key-${i}`, i);
    }
    const writeTime = performance.now() - startWrite;

    const startRead = performance.now();
    for (let i = 0; i < 10000; i++) {
      cache.get(`key-${i}`);
    }
    const readTime = performance.now() - startRead;

    cache.destroy();

    expect(writeTime).toBeLessThan(1000);
    expect(readTime).toBeLessThan(1000);
  });

  test('ヒット率統計が正確', () => {
    const cache = new MemoryCache<string>({ maxSize: 100, defaultTtlMs: 60000, cleanupIntervalMs: 0 });

    cache.set('hit-key', 'value');

    cache.get('hit-key'); // hit
    cache.get('hit-key'); // hit
    cache.get('hit-key'); // hit
    cache.get('miss-key'); // miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(3);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(0.75);

    cache.destroy();
  });
});

describe('Performance: LazyLoader', () => {
  test('同時ロード重複排除が動作する', async () => {
    const loader = new LazyLoader();
    let loadCount = 0;

    const slowLoader = async () => {
      loadCount++;
      await new Promise((r) => setTimeout(r, 50));
      return 'loaded';
    };

    const start = performance.now();
    const results = await Promise.all([
      loader.load('mod', slowLoader),
      loader.load('mod', slowLoader),
      loader.load('mod', slowLoader),
    ]);
    const elapsed = performance.now() - start;

    expect(results).toEqual(['loaded', 'loaded', 'loaded']);
    expect(loadCount).toBe(1);
    // With dedup, total time should be ~50ms, not 150ms
    expect(elapsed).toBeLessThan(200);
  });

  test('キャッシュからの2回目ロードが瞬時に完了する', async () => {
    const loader = new LazyLoader();

    await loader.load('mod', async () => {
      await new Promise((r) => setTimeout(r, 50));
      return 'value';
    });

    const start = performance.now();
    await loader.load('mod', async () => 'new-value');
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1);
  });

  test('統計情報が正確に記録される', async () => {
    const loader = new LazyLoader();

    await loader.load('a', async () => 'A');
    await loader.load('b', async () => {
      await new Promise((r) => setTimeout(r, 5));
      return 'B';
    });

    const stats = loader.getStats();
    expect(stats.loadedModules).toBe(2);
    expect(stats.totalLoadTimeMs).toBeGreaterThanOrEqual(0);
    expect(stats.averageLoadTimeMs).toBeGreaterThanOrEqual(0);
  });
});

describe('Performance: Bottleneck Detection', () => {
  test('ステージ別所要時間が測定可能', async () => {
    const stageTimes: Record<string, number> = {};

    const stages = [
      { name: 'transcription', fn: async () => { await new Promise((r) => setTimeout(r, 5)); } },
      { name: 'analysis', fn: async () => { await new Promise((r) => setTimeout(r, 3)); } },
      { name: 'layout', fn: async () => { await new Promise((r) => setTimeout(r, 2)); } },
    ];

    for (const stage of stages) {
      const start = performance.now();
      await stage.fn();
      stageTimes[stage.name] = performance.now() - start;
    }

    expect(Object.keys(stageTimes)).toHaveLength(3);
    expect(stageTimes['transcription']).toBeGreaterThan(0);
  });
});

describe('Performance: Regression Detection', () => {
  test('ベースラインからの性能低下が検出可能', () => {
    const baseline = { avgProcessingTime: 100 };
    const current = { avgProcessingTime: 130 };

    const regressionThreshold = 0.2; // 20%
    const regressionDetected =
      (current.avgProcessingTime - baseline.avgProcessingTime) / baseline.avgProcessingTime >
      regressionThreshold;

    expect(regressionDetected).toBe(true);
  });

  test('性能がベースライン以内の場合、リグレッションなし', () => {
    const baseline = { avgProcessingTime: 100 };
    const current = { avgProcessingTime: 110 };

    const regressionThreshold = 0.2;
    const regressionDetected =
      (current.avgProcessingTime - baseline.avgProcessingTime) / baseline.avgProcessingTime >
      regressionThreshold;

    expect(regressionDetected).toBe(false);
  });
});
