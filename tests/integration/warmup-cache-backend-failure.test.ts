/**
 * Phase 46: Warmup Cache Backend Unreachable Integration Tests
 *
 * End-to-end integration tests using real CacheWarmupManager + LLMCache
 * with failing resolvers to validate the warmup failure path:
 *
 * - Full warmup pipeline failure (all patterns fail)
 * - Partial pattern failures (some succeed, some fail)
 * - Various network error types (ECONNREFUSED, ENOTFOUND, ETIMEDOUT, EPIPE)
 * - Non-Error rejections in the resolver
 * - Warmup failure recovery (retry succeeds after initial failure)
 * - End-to-end: CacheWarmupManager → startup-warmup → health endpoint
 */

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { CacheWarmupManager, WarmupPattern } from '../../src/optimization/cache-warmup';
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
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp() {
  const app = express();
  const dashboard = new PerformanceDashboard();
  app.use(express.json());
  app.use('/api/v1/monitoring', createMonitoringRouter(dashboard));
  return { app, dashboard };
}

/** Create an LLMService mock that delegates warmupCache to a real CacheWarmupManager */
function createWiredService(
  enabled: boolean,
  resolver: (text: string) => Promise<string>,
  warmupPatterns?: WarmupPattern[],
) {
  const cache = new LLMCache<string>({ maxSize: 50, ttlMinutes: 60 });
  const warmupManager = new CacheWarmupManager<string>(cache, { coldStartThreshold: 1 });

  if (warmupPatterns) {
    warmupManager.setWarmupPatterns(warmupPatterns);
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

function networkError(code: string, message: string): Error {
  const err = new Error(`${code} ${message}`);
  (err as NodeJS.ErrnoException).code = code;
  return err;
}

// ---------------------------------------------------------------------------
// REQ-116: CacheWarmupManager with Failing Resolver
// ---------------------------------------------------------------------------

describe('Phase 46 — REQ-116: CacheWarmupManager with unreachable backend', () => {
  let cache: LLMCache<string>;
  let warmupManager: CacheWarmupManager<string>;

  beforeEach(() => {
    cache = new LLMCache<string>({ maxSize: 50, ttlMinutes: 60, enableSemantic: false });
    warmupManager = new CacheWarmupManager<string>(cache, { coldStartThreshold: 1 });
    resetWarmupStatus();
  });

  test('TC-116-01: all patterns fail when resolver always throws ECONNREFUSED', async () => {
    const patterns: WarmupPattern[] = [
      { text: 'query one', category: 'test', language: 'en' },
      { text: 'query two', category: 'test', language: 'en' },
      { text: 'query three', category: 'test', language: 'en' },
    ];
    warmupManager.setWarmupPatterns(patterns);

    const resolver = async (_text: string): Promise<string> => {
      throw networkError('ECONNREFUSED', '127.0.0.1:6379');
    };

    const result = await warmupManager.warmupIfCold(resolver);

    // warmupIfCold returns true (warmup was executed)
    expect(result).toBe(true);

    // But the warmup stats show all failures
    const stats = warmupManager.getWarmupStats();
    expect(stats.totalWarmups).toBe(1);
    expect(stats.totalPatternsProcessed).toBe(3);
    expect(stats.totalSuccesses).toBe(0);
    expect(stats.totalFailures).toBe(3);
  });

  test('TC-116-02: partial pattern failures — some resolve, some reject', async () => {
    const patterns: WarmupPattern[] = [
      { text: 'good query', category: 'test', language: 'en' },
      { text: 'bad query', category: 'test', language: 'en' },
      { text: 'another good', category: 'test', language: 'en' },
    ];
    warmupManager.setWarmupPatterns(patterns);

    const resolver = async (text: string): Promise<string> => {
      if (text === 'bad query') {
        throw networkError('ETIMEDOUT', 'Connection timed out after 30000ms');
      }
      return `result: ${text}`;
    };

    const result = await warmupManager.warmupIfCold(resolver);
    expect(result).toBe(true);

    const stats = warmupManager.getWarmupStats();
    expect(stats.totalPatternsProcessed).toBe(3);
    expect(stats.totalSuccesses).toBe(2);
    expect(stats.totalFailures).toBe(1);

    // Successfully resolved patterns should be cached
    expect(cache.get('good query')).toBe('result: good query');
    expect(cache.get('another good')).toBe('result: another good');
    // Failed pattern should NOT be cached
    expect(cache.get('bad query')).toBeNull();
  });

  test('TC-116-03: resolver throws ENOTFOUND (DNS resolution failure)', async () => {
    const patterns: WarmupPattern[] = [
      { text: 'dns fail query', category: 'test', language: 'en' },
    ];
    warmupManager.setWarmupPatterns(patterns);

    const resolver = async (_text: string): Promise<string> => {
      throw networkError('ENOTFOUND', 'cache-backend.internal');
    };

    const result = await warmupManager.warmupIfCold(resolver);
    expect(result).toBe(true);

    const stats = warmupManager.getWarmupStats();
    expect(stats.totalFailures).toBe(1);
    expect(stats.totalSuccesses).toBe(0);
  });

  test('TC-116-04: resolver throws EPIPE (broken pipe)', async () => {
    const patterns: WarmupPattern[] = [
      { text: 'pipe fail query', category: 'test', language: 'en' },
    ];
    warmupManager.setWarmupPatterns(patterns);

    const resolver = async (_text: string): Promise<string> => {
      throw networkError('EPIPE', 'broken pipe');
    };

    const result = await warmupManager.warmupIfCold(resolver);
    expect(result).toBe(true);

    const stats = warmupManager.getWarmupStats();
    expect(stats.totalFailures).toBe(1);
  });

  test('TC-116-05: resolver rejects with non-Error (string)', async () => {
    const patterns: WarmupPattern[] = [
      { text: 'string rejection', category: 'test', language: 'en' },
    ];
    warmupManager.setWarmupPatterns(patterns);

    const resolver = async (_text: string): Promise<string> => {
      throw 'cache backend gone'; // eslint-disable-line no-throw-literal
    };

    // CacheWarmupManager catches non-Error exceptions gracefully
    const result = await warmupManager.warmupIfCold(resolver);
    expect(result).toBe(true);

    const stats = warmupManager.getWarmupStats();
    expect(stats.totalFailures).toBe(1);
  });

  test('TC-116-06: warmup failure recovery — retry succeeds after initial failure', async () => {
    const patterns: WarmupPattern[] = [
      { text: 'recovery query', category: 'test', language: 'en' },
    ];
    warmupManager.setWarmupPatterns(patterns);

    // First attempt: resolver fails
    let callCount = 0;
    const failingResolver = async (_text: string): Promise<string> => {
      callCount++;
      throw networkError('ECONNREFUSED', 'backend down');
    };

    const firstResult = await warmupManager.warmup(patterns, failingResolver);
    expect(firstResult.failureCount).toBe(1);
    expect(firstResult.successCount).toBe(0);

    // Second attempt: resolver succeeds (simulating backend recovery)
    const successResolver = async (text: string): Promise<string> => `result: ${text}`;
    const secondResult = await warmupManager.warmup(patterns, successResolver);
    expect(secondResult.successCount).toBe(1);
    expect(secondResult.failureCount).toBe(0);

    // Cumulative stats reflect both attempts
    const stats = warmupManager.getWarmupStats();
    expect(stats.totalWarmups).toBe(2);
    expect(stats.totalSuccesses).toBe(1);
    expect(stats.totalFailures).toBe(1);

    // Cached entry is now available
    expect(cache.get('recovery query')).toBe('result: recovery query');
  });

  test('TC-116-07: warmup with mixed error types across patterns', async () => {
    const patterns: WarmupPattern[] = [
      { text: 'econnrefused', category: 'test', language: 'en' },
      { text: 'etimedout', category: 'test', language: 'en' },
      { text: 'enotfound', category: 'test', language: 'en' },
      { text: 'epipe', category: 'test', language: 'en' },
      { text: 'generic error', category: 'test', language: 'en' },
    ];
    warmupManager.setWarmupPatterns(patterns);

    const resolver = async (text: string): Promise<string> => {
      const errorMap: Record<string, string> = {
        econnrefused: 'ECONNREFUSED',
        etimedout: 'ETIMEDOUT',
        enotfound: 'ENOTFOUND',
        epipe: 'EPIPE',
      };
      const code = errorMap[text];
      if (code) throw networkError(code, `${code} error`);
      throw new Error('generic failure');
    };

    const result = await warmupManager.warmupIfCold(resolver);
    expect(result).toBe(true);

    const stats = warmupManager.getWarmupStats();
    expect(stats.totalFailures).toBe(5);
    expect(stats.totalSuccesses).toBe(0);
    // Cache should remain empty
    expect(cache.getStats().validEntries).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// REQ-117: End-to-End: CacheWarmupManager → startup-warmup → health endpoint
// ---------------------------------------------------------------------------

describe('Phase 46 — REQ-117: E2E warmup failure through health endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetWarmupStatus();
  });

  test('TC-117-01: real CacheWarmupManager failure reflected in health endpoint', async () => {
    const { service } = createWiredService(
      true,
      async (_text: string) => {
        throw networkError('ECONNREFUSED', '127.0.0.1:6379');
      },
      [{ text: 'test query', category: 'test', language: 'en' }],
    );

    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 50));

    const { app, dashboard } = createApp();
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.status).toBe(200);
    expect(response.body.data.cacheWarmup.status).toBe('completed');
    // warmupIfCold resolved true (warmup was attempted), but patterns failed
    expect(response.body.data.cacheWarmup.patternsProcessed).toBe(1);
    // Overall health should still be healthy (warmup failure is non-fatal)
    expect(response.body.data.status).toBe('healthy');
    dashboard.destroy();
  });

  test('TC-117-02: partial failure through full pipeline reflected in health endpoint', async () => {
    const patterns: WarmupPattern[] = [
      { text: 'success query', category: 'test', language: 'en' },
      { text: 'fail query', category: 'test', language: 'en' },
      { text: 'another success', category: 'test', language: 'en' },
    ];

    const { service } = createWiredService(
      true,
      async (text: string) => {
        if (text === 'fail query') throw networkError('ETIMEDOUT', 'timeout');
        return `result: ${text}`;
      },
      patterns,
    );

    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 50));

    const { app, dashboard } = createApp();
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.status).toBe(200);
    expect(response.body.data.cacheWarmup.status).toBe('completed');
    expect(response.body.data.cacheWarmup.patternsProcessed).toBe(3);
    dashboard.destroy();
  });

  test('TC-117-03: warmup resolves false (cache already warm) through health endpoint', async () => {
    const { service, cache } = createWiredService(
      true,
      async (text: string) => `result: ${text}`,
      [{ text: 'test query', category: 'test', language: 'en' }],
    );

    // Pre-fill cache beyond cold-start threshold (threshold is 1)
    cache.set('pre-existing', 'data');

    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 50));

    const { app, dashboard } = createApp();
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.status).toBe(200);
    // warmupIfCold returned false (skipped because cache was warm)
    expect(response.body.data.cacheWarmup.status).toBe('skipped');
    dashboard.destroy();
  });
});

// ---------------------------------------------------------------------------
// REQ-118: Cascading Failure Resilience in Health Endpoint
// ---------------------------------------------------------------------------

describe('Phase 46 — REQ-118: Cascading failure resilience in health endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetWarmupStatus();
  });

  test('TC-118-01: getCacheWarmupStats throws after warmupCache resolves', async () => {
    // Simulate warmup succeeding but stats call throwing
    const service = {
      isEnabled: jest.fn().mockReturnValue(true),
      warmupCache: jest.fn().mockResolvedValue(true),
      getCacheWarmupStats: jest.fn().mockImplementation(() => {
        throw new Error('stats backend unreachable');
      }),
    } as unknown as LLMService;

    // triggerStartupWarmup calls warmupCache then getCacheWarmupStats
    expect(() => triggerStartupWarmup(service)).not.toThrow();

    await new Promise((r) => setTimeout(r, 50));

    // Status should be 'failed' because getCacheWarmupStats threw
    const status = getWarmupStatus();
    expect(status.status).toBe('failed');
    expect(status.error).toContain('stats backend unreachable');
  });

  test('TC-118-02: health endpoint remains stable when warmup status is failed', async () => {
    const service = {
      isEnabled: jest.fn().mockReturnValue(true),
      warmupCache: jest.fn().mockRejectedValue(new Error('total backend failure')),
      getCacheWarmupStats: jest.fn().mockReturnValue({ totalPatternsProcessed: 0 }),
    } as unknown as LLMService;

    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 50));

    const { app, dashboard } = createApp();

    // Health endpoint should still respond normally
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.cacheWarmup.status).toBe('failed');
    expect(response.body.data.cacheWarmup.error).toContain('total backend failure');
    // All standard health fields should be present
    expect(response.body.data.status).toBeDefined();
    expect(response.body.data.timestamp).toBeDefined();
    expect(response.body.data.uptime).toBeDefined();
    expect(response.body.data.totalRequests).toBeDefined();
    expect(response.body.data.successRate).toBeDefined();
    expect(response.body.data.memoryUsage).toBeDefined();
    expect(response.body.data.cacheHitRate).toBeDefined();
    expect(response.body.data.activeAlerts).toBeDefined();
    dashboard.destroy();
  });

  test('TC-118-03: multiple sequential warmup triggers — last result wins', async () => {
    // First: fail
    const failingService = {
      isEnabled: jest.fn().mockReturnValue(true),
      warmupCache: jest.fn().mockRejectedValue(new Error('first attempt failed')),
      getCacheWarmupStats: jest.fn().mockReturnValue({ totalPatternsProcessed: 0 }),
    } as unknown as LLMService;

    triggerStartupWarmup(failingService);
    await new Promise((r) => setTimeout(r, 50));
    expect(getWarmupStatus().status).toBe('failed');

    // Second: succeed (reset status first)
    resetWarmupStatus();
    const successService = {
      isEnabled: jest.fn().mockReturnValue(true),
      warmupCache: jest.fn().mockResolvedValue(true),
      getCacheWarmupStats: jest.fn().mockReturnValue({ totalPatternsProcessed: 5 }),
    } as unknown as LLMService;

    triggerStartupWarmup(successService);
    await new Promise((r) => setTimeout(r, 50));
    expect(getWarmupStatus().status).toBe('completed');
    expect(getWarmupStatus().patternsProcessed).toBe(5);

    // Health endpoint reflects the latest state
    const { app, dashboard } = createApp();
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.body.data.cacheWarmup.status).toBe('completed');
    expect(response.body.data.cacheWarmup.patternsProcessed).toBe(5);
    dashboard.destroy();
  });

  test('TC-118-04: health endpoint remains stable when warmup status transitions rapidly', async () => {
    const { app, dashboard } = createApp();

    // Fire multiple warmup triggers rapidly
    const services = [
      { isEnabled: jest.fn().mockReturnValue(true), warmupCache: jest.fn().mockResolvedValue(true), getCacheWarmupStats: jest.fn().mockReturnValue({ totalPatternsProcessed: 3 }) },
      { isEnabled: jest.fn().mockReturnValue(false), warmupCache: jest.fn(), getCacheWarmupStats: jest.fn().mockReturnValue({ totalPatternsProcessed: 0 }) },
      { isEnabled: jest.fn().mockReturnValue(true), warmupCache: jest.fn().mockRejectedValue(new Error('boom')), getCacheWarmupStats: jest.fn().mockReturnValue({ totalPatternsProcessed: 0 }) },
    ] as unknown as LLMService[];

    for (const svc of services) {
      resetWarmupStatus();
      triggerStartupWarmup(svc);
    }

    await new Promise((r) => setTimeout(r, 100));

    // The health endpoint should still work
    const response = await request(app).get('/api/v1/monitoring/health');
    expect(response.status).toBe(200);
    expect(response.body.data.cacheWarmup.status).toBeDefined();
    dashboard.destroy();
  });
});
