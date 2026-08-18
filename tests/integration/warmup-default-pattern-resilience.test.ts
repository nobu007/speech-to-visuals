/**
 * Phase 50: Default Warmup Pattern Failure Resilience Integration Tests
 *
 * REQ-128: Default warmup patterns (multi-language) with unreachable backend
 * REQ-129: Default warmup through startup → health chain
 * REQ-130: Warmup stats immutability and consistency
 *
 * Validates the multi-language default warmup patterns (8 patterns: 5 EN + 3 JA)
 * through the full pipeline: CacheWarmupManager → startup-warmup → health endpoint.
 *
 * Previous phases used custom warmup patterns. This phase specifically tests
 * the default pattern set, validating that the multi-language detection
 * feature (4 locales: en, ja, etc.) works correctly under failure conditions.
 */

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { CacheWarmupManager } from '../../src/optimization/cache-warmup';
import { LLMCache } from '../../src/analysis/llm-cache';
import { PerformanceDashboard } from '../../src/monitoring/performance-dashboard';
import { createMonitoringRouter } from '../../src/api/routes/monitoring';
import {
  triggerStartupWarmup,
  getWarmupStatus,
  resetWarmupStatus,
} from '../../src/api/startup-warmup';
import type { LLMService } from '../../src/analysis/llm-service';

// Suppress logger noise during tests
jest.mock('@stv/core/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp(dashboard?: PerformanceDashboard) {
  const app = express();
  const dash = dashboard ?? new PerformanceDashboard();
  app.use(express.json());
  app.use('/api/v1/monitoring', createMonitoringRouter(dash));
  return { app, dashboard: dash };
}

function networkError(code: string, message: string): Error {
  const err = new Error(`${code} ${message}`);
  (err as NodeJS.ErrnoException).code = code;
  return err;
}

function createWiredService(
  enabled: boolean,
  resolver: (text: string) => Promise<string>,
  useDefaultPatterns = true,
) {
  const cache = new LLMCache<string>({ maxSize: 50, ttlMinutes: 60, enableSemantic: false });
  const warmupManager = new CacheWarmupManager<string>(cache, { coldStartThreshold: 1 });

  // If using default patterns, don't call setWarmupPatterns — warmupIfCold
  // will use getDefaultPatterns() automatically
  if (!useDefaultPatterns) {
    warmupManager.setWarmupPatterns([
      { text: 'custom pattern', category: 'test', language: 'en' },
    ]);
  }

  const service = {
    isEnabled: jest.fn().mockReturnValue(enabled),
    warmupCache: jest.fn().mockImplementation(async () => {
      return warmupManager.warmupIfCold(resolver);
    }),
    getCacheWarmupStats: jest.fn().mockImplementation(() => warmupManager.getWarmupStats()),
  } as unknown as LLMService;

  return { service, cache, warmupManager };
}

// ---------------------------------------------------------------------------
// REQ-128: Default warmup patterns (multi-language) with unreachable backend
// ---------------------------------------------------------------------------

describe('Phase 50 — REQ-128: Default warmup patterns with unreachable backend', () => {
  let cache: LLMCache<string>;
  let warmupManager: CacheWarmupManager<string>;

  beforeEach(() => {
    cache = new LLMCache<string>({ maxSize: 50, ttlMinutes: 60, enableSemantic: false });
    warmupManager = new CacheWarmupManager<string>(cache, { coldStartThreshold: 1 });
    resetWarmupStatus();
  });

  test('TC-128-01: all 8 default patterns fail when backend is unreachable', async () => {
    // Don't set custom patterns — let it use defaults (5 EN + 3 JA)
    const resolver = async (_text: string): Promise<string> => {
      throw networkError('ECONNREFUSED', 'cache.redis.internal:6379');
    };

    const result = await warmupManager.warmupIfCold(resolver);

    // warmupIfCold returns true (warmup was executed)
    expect(result).toBe(true);

    const stats = warmupManager.getWarmupStats();
    // Default has 8 patterns (5 English + 3 Japanese)
    expect(stats.totalPatternsProcessed).toBe(8);
    expect(stats.totalSuccesses).toBe(0);
    expect(stats.totalFailures).toBe(8);
    expect(stats.totalWarmups).toBe(1);
  });

  test('TC-128-02: partial failure — Japanese patterns succeed, English fail', async () => {
    const resolver = async (text: string): Promise<string> => {
      // Simulate backend that only handles Japanese queries
      const hasJapanese = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(text);
      if (hasJapanese) {
        return `result: ${text.substring(0, 20)}...`;
      }
      throw networkError('ECONNREFUSED', 'English backend unavailable');
    };

    const result = await warmupManager.warmupIfCold(resolver);
    expect(result).toBe(true);

    const stats = warmupManager.getWarmupStats();
    // 3 Japanese patterns succeed, 5 English patterns fail
    expect(stats.totalPatternsProcessed).toBe(8);
    expect(stats.totalSuccesses).toBe(3);
    expect(stats.totalFailures).toBe(5);
  });

  test('TC-128-03: partial failure — only tutorial category succeeds', async () => {
    const resolver = async (text: string): Promise<string> => {
      // Only tutorial-related patterns succeed
      const isTutorial = text.includes('basic concepts') || text.includes('基本的な概念');
      if (isTutorial) {
        return `resolved: ${text.substring(0, 30)}`;
      }
      throw networkError('ETIMEDOUT', 'category backend timeout');
    };

    const result = await warmupManager.warmupIfCold(resolver);
    expect(result).toBe(true);

    const stats = warmupManager.getWarmupStats();
    // 2 tutorial patterns (EN + JA), rest fail
    expect(stats.totalSuccesses).toBe(2);
    expect(stats.totalFailures).toBe(6);
  });

  test('TC-128-04: default patterns are used when no custom patterns set', async () => {
    const defaultPatterns = warmupManager.getDefaultPatterns();
    expect(defaultPatterns.length).toBe(8);

    // Verify language distribution
    const enPatterns = defaultPatterns.filter(p => p.language === 'en');
    const jaPatterns = defaultPatterns.filter(p => p.language === 'ja');
    expect(enPatterns.length).toBe(5);
    expect(jaPatterns.length).toBe(3);

    // Verify category diversity
    const categories = new Set(defaultPatterns.map(p => p.category));
    expect(categories.size).toBeGreaterThanOrEqual(4); // tutorial, algorithm, architecture, workflow, research
  });

  test('TC-128-05: already-cached patterns are counted as successes without resolver call', async () => {
    // Pre-populate cache with some default pattern entries
    const defaultPatterns = warmupManager.getDefaultPatterns();
    cache.set(defaultPatterns[0].text, 'pre-cached result');
    cache.set(defaultPatterns[1].text, 'pre-cached result');

    let resolverCallCount = 0;
    const resolver = async (text: string): Promise<string> => {
      resolverCallCount++;
      return `resolved: ${text.substring(0, 20)}`;
    };

    // Use warmup() directly to bypass cold-start check
    // (warmupIfCold would skip because cache has 2 entries ≥ threshold 1)
    const result = await warmupManager.warmup(defaultPatterns, resolver);

    // All 8 patterns should be "successful" (2 pre-cached + 6 resolved)
    expect(result.successCount).toBe(8);
    expect(result.failureCount).toBe(0);
    // Resolver was only called for patterns NOT already cached
    expect(resolverCallCount).toBe(6);

    const stats = warmupManager.getWarmupStats();
    expect(stats.totalSuccesses).toBe(8);
    expect(stats.totalFailures).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// REQ-129: Default warmup through startup → health chain
// ---------------------------------------------------------------------------

describe('Phase 50 — REQ-129: Default warmup through startup → health chain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetWarmupStatus();
  });

  test('TC-129-01: default pattern warmup failure reflected in health endpoint', async () => {
    const { service, warmupManager } = createWiredService(
      true,
      async (_text: string) => {
        throw networkError('ECONNREFUSED', 'redis:6379');
      },
    );

    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 80));

    const { app, dashboard } = createApp();
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.status).toBe(200);
    // warmupIfCold resolved true, but all patterns failed
    expect(response.body.data.cacheWarmup.status).toBe('completed');
    // Default: 8 patterns processed
    expect(response.body.data.cacheWarmup.patternsProcessed).toBe(8);
    // Overall health unaffected by warmup failure
    expect(response.body.data.status).toBe('healthy');

    // Verify all 8 patterns failed via warmupManager stats
    const stats = warmupManager.getWarmupStats();
    expect(stats.totalFailures).toBe(8);
    expect(stats.totalSuccesses).toBe(0);

    dashboard.destroy();
  });

  test('TC-129-02: default pattern warmup success reflected in health endpoint', async () => {
    const { service, cache } = createWiredService(
      true,
      async (text: string) => `resolved: ${text.substring(0, 20)}`,
    );

    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 80));

    const { app, dashboard } = createApp();
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.status).toBe(200);
    expect(response.body.data.cacheWarmup.status).toBe('completed');
    expect(response.body.data.cacheWarmup.patternsProcessed).toBe(8);

    // All default patterns should now be cached
    const defaultPatterns = service.getCacheWarmupStats();
    expect(defaultPatterns.totalSuccesses).toBe(8);
    expect(defaultPatterns.totalFailures).toBe(0);

    // Cache should have entries
    const cacheStats = cache.getStats();
    expect(cacheStats.validEntries).toBe(8);

    dashboard.destroy();
  });

  test('TC-129-03: mixed success with default patterns shows completed', async () => {
    const { service, warmupManager } = createWiredService(
      true,
      async (text: string) => {
        // Only Japanese patterns succeed
        const hasJapanese = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(text);
        if (hasJapanese) return `result: ${text.substring(0, 15)}`;
        throw networkError('ETIMEDOUT', 'timeout');
      },
    );

    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 80));

    const { app, dashboard } = createApp();
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.status).toBe(200);
    expect(response.body.data.cacheWarmup.status).toBe('completed');
    expect(response.body.data.cacheWarmup.patternsProcessed).toBe(8);

    // Stats show 3 successes (JA) and 5 failures (EN)
    const stats = warmupManager.getWarmupStats();
    expect(stats.totalSuccesses).toBe(3);
    expect(stats.totalFailures).toBe(5);

    dashboard.destroy();
  });
});

// ---------------------------------------------------------------------------
// REQ-130: Warmup stats immutability and consistency
// ---------------------------------------------------------------------------

describe('Phase 50 — REQ-130: Warmup stats immutability and consistency', () => {
  let cache: LLMCache<string>;
  let warmupManager: CacheWarmupManager<string>;

  beforeEach(() => {
    cache = new LLMCache<string>({ maxSize: 50, ttlMinutes: 60, enableSemantic: false });
    warmupManager = new CacheWarmupManager<string>(cache, { coldStartThreshold: 1 });
    resetWarmupStatus();
  });

  test('TC-130-01: getWarmupStats returns a copy — mutations do not affect internal state', async () => {
    const resolver = async (text: string): Promise<string> => `result: ${text}`;
    await warmupManager.warmupIfCold(resolver);

    const stats1 = warmupManager.getWarmupStats();
    stats1.totalWarmups = 999; // Mutate the returned object
    stats1.totalFailures = 999;

    const stats2 = warmupManager.getWarmupStats();
    expect(stats2.totalWarmups).toBe(1); // Not affected by mutation
    expect(stats2.totalFailures).toBe(0);
  });

  test('TC-130-02: stats are consistent across multiple warmup cycles with failures', async () => {
    const patterns = [
      { text: 'cycle query a', category: 'test', language: 'en' },
      { text: 'cycle query b', category: 'test', language: 'en' },
      { text: 'サイクルクエリ', category: 'test', language: 'ja' },
    ];
    warmupManager.setWarmupPatterns(patterns);

    // Cycle 1: all fail
    await warmupManager.warmup(patterns, async () => {
      throw networkError('ECONNREFUSED', 'down');
    });

    const stats1 = warmupManager.getWarmupStats();
    expect(stats1.totalWarmups).toBe(1);
    expect(stats1.totalFailures).toBe(3);
    expect(stats1.totalSuccesses).toBe(0);

    // Cycle 2: partial success
    cache.clear(); // Reset cold-start detection
    await warmupManager.warmup(patterns, async (text: string) => {
      if (text === 'cycle query b') throw networkError('ETIMEDOUT', 'timeout');
      return `ok: ${text}`;
    });

    const stats2 = warmupManager.getWarmupStats();
    expect(stats2.totalWarmups).toBe(2);
    expect(stats2.totalSuccesses).toBe(2); // 2 new successes
    expect(stats2.totalFailures).toBe(4); // 3 from cycle 1 + 1 from cycle 2
    expect(stats2.totalPatternsProcessed).toBe(6); // 3 + 3

    // Cycle 3: all succeed
    cache.clear();
    await warmupManager.warmup(patterns, async (text: string) => `ok: ${text}`);

    const stats3 = warmupManager.getWarmupStats();
    expect(stats3.totalWarmups).toBe(3);
    expect(stats3.totalSuccesses).toBe(5); // 0 + 2 + 3
    expect(stats3.totalFailures).toBe(4); // 3 + 1 + 0
    expect(stats3.totalPatternsProcessed).toBe(9); // 3 + 3 + 3
  });

  test('TC-130-03: getDefaultPatterns returns a copy — mutations do not affect defaults', () => {
    const patterns1 = warmupManager.getDefaultPatterns();
    const originalLength = patterns1.length;
    patterns1.push({ text: 'injected', category: 'hack', language: 'en' });

    const patterns2 = warmupManager.getDefaultPatterns();
    expect(patterns2.length).toBe(originalLength);
    expect(patterns2.every(p => p.text !== 'injected')).toBe(true);
  });

  test('TC-130-04: warmup status info returned by getWarmupStatus is a snapshot', async () => {
    const { service } = createWiredService(
      true,
      async (text: string) => `result: ${text.substring(0, 10)}`,
    );

    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 80));

    const s1 = getWarmupStatus();
    const s2 = getWarmupStatus();

    // Both snapshots should have the same values but be different objects
    expect(s1).toEqual(s2);
    expect(s1).not.toBe(s2);

    // Mutating one doesn't affect the other
    (s1 as Record<string, unknown>).status = 'mutated';
    expect(getWarmupStatus().status).toBe('completed');
  });
});
