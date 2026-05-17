/**
 * Phase 47: Warmup Zero-Success Resilience Integration Tests
 *
 * REQ-119: Health endpoint warmup completion with zero effective successes
 * REQ-120: Concurrent health requests during warmup transitions
 * REQ-121: Warmup retry after zero-success completion
 *
 * Validates that when warmupCache resolves true but all individual patterns
 * fail, the health endpoint remains stable and the overall system health
 * is unaffected. Also validates concurrent access resilience.
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
// REQ-119: Warmup completion with zero effective successes
// ---------------------------------------------------------------------------

describe('Phase 47 — REQ-119: Warmup completion with zero effective successes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetWarmupStatus();
  });

  test('TC-119-01: warmup reports completed when all patterns fail via resolver', async () => {
    // When warmupIfCold resolves true but all patterns fail,
    // triggerStartupWarmup reports "completed" with patternsProcessed count.
    // This documents the current behavior: operators cannot distinguish
    // between all-success and all-failure warmup from the status alone.
    const patterns: WarmupPattern[] = [
      { text: 'query-a', category: 'test', language: 'en' },
      { text: 'query-b', category: 'test', language: 'en' },
    ];

    const { service, warmupManager } = createWiredService(
      true,
      async (_text: string) => {
        throw networkError('ECONNREFUSED', 'backend down');
      },
      patterns,
    );

    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 50));

    const status = getWarmupStatus();
    // warmupIfCold returned true → status is "completed"
    expect(status.status).toBe('completed');
    expect(status.patternsProcessed).toBe(2);

    // But warmup stats show 0 successes
    const stats = warmupManager.getWarmupStats();
    expect(stats.totalSuccesses).toBe(0);
    expect(stats.totalFailures).toBe(2);
  });

  test('TC-119-02: health endpoint returns 200 with completed status when all patterns failed', async () => {
    const patterns: WarmupPattern[] = [
      { text: 'fail-1', category: 'test', language: 'en' },
      { text: 'fail-2', category: 'test', language: 'en' },
      { text: 'fail-3', category: 'test', language: 'en' },
    ];

    const { service } = createWiredService(
      true,
      async (_text: string) => {
        throw networkError('ETIMEDOUT', 'connection timed out');
      },
      patterns,
    );

    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 50));

    const { app, dashboard } = createApp();
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    // Status is "completed" even though 0 patterns succeeded
    expect(response.body.data.cacheWarmup.status).toBe('completed');
    expect(response.body.data.cacheWarmup.patternsProcessed).toBe(3);
    // Overall health is unaffected by warmup failure
    expect(response.body.data.status).toBe('healthy');
    // All standard health fields present
    expect(response.body.data.timestamp).toBeDefined();
    expect(response.body.data.uptime).toBeDefined();
    expect(response.body.data.totalRequests).toBeDefined();
    expect(response.body.data.successRate).toBeDefined();
    expect(response.body.data.memoryUsage).toBeDefined();
    expect(response.body.data.cacheHitRate).toBeDefined();
    expect(response.body.data.activeAlerts).toBeDefined();
    dashboard.destroy();
  });

  test('TC-119-03: partial success warmup shows completed with correct pattern count', async () => {
    const patterns: WarmupPattern[] = [
      { text: 'alpha-query', category: 'test', language: 'en' },
      { text: 'fail-query', category: 'test', language: 'en' },
      { text: 'beta-query', category: 'test', language: 'en' },
    ];

    const { service, cache, warmupManager } = createWiredService(
      true,
      async (text: string) => {
        if (text === 'fail-query') throw networkError('ECONNREFUSED', 'down');
        return `result: ${text}`;
      },
      patterns,
    );

    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 50));

    // Successful entries are cached, failed one is not
    expect(cache.get('alpha-query')).toBe('result: alpha-query');
    expect(cache.get('beta-query')).toBe('result: beta-query');
    expect(cache.get('fail-query')).toBeNull();

    const stats = warmupManager.getWarmupStats();
    expect(stats.totalSuccesses).toBe(2);
    expect(stats.totalFailures).toBe(1);

    // Health endpoint reflects completed status
    const { app, dashboard } = createApp();
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.body.data.cacheWarmup.status).toBe('completed');
    expect(response.body.data.cacheWarmup.patternsProcessed).toBe(3);
    dashboard.destroy();
  });

  test('TC-119-04: mixed network error types all result in completed status', async () => {
    const patterns: WarmupPattern[] = [
      { text: 'econnrefused', category: 'test', language: 'en' },
      { text: 'enotfound', category: 'test', language: 'en' },
      { text: 'epipe', category: 'test', language: 'en' },
      { text: 'etimedout', category: 'test', language: 'en' },
    ];

    const { service, warmupManager } = createWiredService(
      true,
      async (text: string) => {
        const errorMap: Record<string, string> = {
          econnrefused: 'ECONNREFUSED',
          enotfound: 'ENOTFOUND',
          epipe: 'EPIPE',
          etimedout: 'ETIMEDOUT',
        };
        throw networkError(errorMap[text] ?? 'EUNKNOWN', 'error');
      },
      patterns,
    );

    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 50));

    const status = getWarmupStatus();
    expect(status.status).toBe('completed');
    expect(status.patternsProcessed).toBe(4);

    const stats = warmupManager.getWarmupStats();
    expect(stats.totalFailures).toBe(4);
    expect(stats.totalSuccesses).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// REQ-120: Concurrent health requests during warmup transitions
// ---------------------------------------------------------------------------

describe('Phase 47 — REQ-120: Concurrent health requests during warmup transitions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetWarmupStatus();
  });

  test('TC-120-01: multiple concurrent health requests during pending warmup all return valid responses', async () => {
    const service = {
      isEnabled: jest.fn().mockReturnValue(true),
      warmupCache: jest.fn().mockReturnValue(new Promise(() => {})), // hangs forever
      getCacheWarmupStats: jest.fn().mockReturnValue({ totalPatternsProcessed: 0 }),
    } as unknown as LLMService;

    triggerStartupWarmup(service);

    const { app, dashboard } = createApp();

    // Fire 5 concurrent health requests while warmup is in-flight
    const responses = await Promise.all([
      request(app).get('/api/v1/monitoring/health'),
      request(app).get('/api/v1/monitoring/health'),
      request(app).get('/api/v1/monitoring/health'),
      request(app).get('/api/v1/monitoring/health'),
      request(app).get('/api/v1/monitoring/health'),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.cacheWarmup.status).toBe('pending');
      expect(response.body.data.status).toBe('healthy');
    }
    dashboard.destroy();
  });

  test('TC-120-02: health requests before, during, and after warmup all return consistent structure', async () => {
    const { app, dashboard } = createApp();

    // Before warmup: pending
    const before = await request(app).get('/api/v1/monitoring/health');
    expect(before.body.data.cacheWarmup.status).toBe('pending');

    // Trigger warmup that resolves quickly
    const service = {
      isEnabled: jest.fn().mockReturnValue(true),
      warmupCache: jest.fn().mockResolvedValue(true),
      getCacheWarmupStats: jest.fn().mockReturnValue({ totalPatternsProcessed: 5 }),
    } as unknown as LLMService;

    triggerStartupWarmup(service);

    // During: likely still pending (race condition, but endpoint should still work)
    const during = await request(app).get('/api/v1/monitoring/health');
    expect(during.status).toBe(200);
    expect(during.body.data).toBeDefined();

    // After: completed
    await new Promise((r) => setTimeout(r, 50));
    const after = await request(app).get('/api/v1/monitoring/health');
    expect(after.body.data.cacheWarmup.status).toBe('completed');

    // All responses have the same structure
    for (const response of [before, during, after]) {
      expect(response.body.data.status).toBeDefined();
      expect(response.body.data.timestamp).toBeDefined();
      expect(response.body.data.uptime).toBeDefined();
      expect(response.body.data.totalRequests).toBeDefined();
      expect(response.body.data.successRate).toBeDefined();
      expect(response.body.data.memoryUsage).toBeDefined();
      expect(response.body.data.cacheHitRate).toBeDefined();
      expect(response.body.data.cacheWarmup).toBeDefined();
      expect(response.body.data.activeAlerts).toBeDefined();
    }
    dashboard.destroy();
  });

  test('TC-120-03: health endpoint remains responsive after rapid warmup reset cycles', async () => {
    const { app, dashboard } = createApp();

    // Rapidly cycle through warmup states
    for (let i = 0; i < 5; i++) {
      resetWarmupStatus();

      const service = {
        isEnabled: jest.fn().mockReturnValue(true),
        warmupCache: jest.fn().mockResolvedValue(i % 2 === 0),
        getCacheWarmupStats: jest.fn().mockReturnValue({ totalPatternsProcessed: i }),
      } as unknown as LLMService;

      triggerStartupWarmup(service);
    }

    await new Promise((r) => setTimeout(r, 100));

    const response = await request(app).get('/api/v1/monitoring/health');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.cacheWarmup.status).toBeDefined();
    dashboard.destroy();
  });
});

// ---------------------------------------------------------------------------
// REQ-121: Warmup retry after zero-success completion
// ---------------------------------------------------------------------------

describe('Phase 47 — REQ-121: Warmup retry after zero-success completion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetWarmupStatus();
  });

  test('TC-121-01: retry warmup after zero-success completion succeeds', async () => {
    const patterns: WarmupPattern[] = [
      { text: 'retry-query', category: 'test', language: 'en' },
    ];

    // First attempt: all fail
    const { service: failService, warmupManager } = createWiredService(
      true,
      async (_text: string) => {
        throw networkError('ECONNREFUSED', 'backend down');
      },
      patterns,
    );

    triggerStartupWarmup(failService);
    await new Promise((r) => setTimeout(r, 50));

    expect(getWarmupStatus().status).toBe('completed');
    expect(warmupManager.getWarmupStats().totalFailures).toBe(1);

    // Reset for retry
    resetWarmupStatus();

    // Second attempt: succeeds
    const successService = {
      isEnabled: jest.fn().mockReturnValue(true),
      warmupCache: jest.fn().mockImplementation(async () => {
        return warmupManager.warmupIfCold(async (text: string) => `result: ${text}`);
      }),
      getCacheWarmupStats: jest.fn().mockImplementation(() => warmupManager.getWarmupStats()),
    } as unknown as LLMService;

    triggerStartupWarmup(successService);
    await new Promise((r) => setTimeout(r, 50));

    // Now completed with success
    expect(getWarmupStatus().status).toBe('completed');

    // Cumulative stats reflect both attempts
    const stats = warmupManager.getWarmupStats();
    expect(stats.totalWarmups).toBe(2);
    expect(stats.totalFailures).toBe(1); // from first attempt
    expect(stats.totalSuccesses).toBe(1); // from second attempt
  });

  test('TC-121-02: health endpoint reflects recovery after retry', async () => {
    const patterns: WarmupPattern[] = [
      { text: 'recovery-query', category: 'test', language: 'en' },
    ];

    // First: fail
    const { service: failService, warmupManager } = createWiredService(
      true,
      async (_text: string) => {
        throw networkError('ETIMEDOUT', 'timeout');
      },
      patterns,
    );

    triggerStartupWarmup(failService);
    await new Promise((r) => setTimeout(r, 50));

    // Verify health during failed state
    const { app, dashboard } = createApp();
    let response = await request(app).get('/api/v1/monitoring/health');
    expect(response.body.data.cacheWarmup.status).toBe('completed');
    expect(response.body.data.cacheWarmup.patternsProcessed).toBe(1);
    // Overall health unaffected
    expect(response.body.data.status).toBe('healthy');

    // Reset and retry with success
    resetWarmupStatus();
    const successService = {
      isEnabled: jest.fn().mockReturnValue(true),
      warmupCache: jest.fn().mockImplementation(async () => {
        return warmupManager.warmupIfCold(async (text: string) => `result: ${text}`);
      }),
      getCacheWarmupStats: jest.fn().mockImplementation(() => warmupManager.getWarmupStats()),
    } as unknown as LLMService;

    triggerStartupWarmup(successService);
    await new Promise((r) => setTimeout(r, 50));

    // Health endpoint now shows recovery
    response = await request(app).get('/api/v1/monitoring/health');
    expect(response.body.data.cacheWarmup.status).toBe('completed');
    expect(response.body.data.status).toBe('healthy');
    dashboard.destroy();
  });

  test('TC-121-03: warmup stats accumulate correctly across multiple attempts', async () => {
    const patterns: WarmupPattern[] = [
      { text: 'p1', category: 'test', language: 'en' },
      { text: 'p2', category: 'test', language: 'en' },
      { text: 'p3', category: 'test', language: 'en' },
    ];

    let callCount = 0;
    const { service, cache, warmupManager } = createWiredService(
      true,
      async (text: string) => {
        callCount++;
        if (text === 'p2') throw networkError('ECONNREFUSED', 'down');
        return `result: ${text}`;
      },
      patterns,
    );

    // First warmup: 2 successes, 1 failure
    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 50));

    expect(warmupManager.getWarmupStats().totalSuccesses).toBe(2);
    expect(warmupManager.getWarmupStats().totalFailures).toBe(1);

    // Clear cache so next warmupIfCold actually runs (otherwise isColdStart = false)
    cache.clear();

    // Reset and warmup again
    resetWarmupStatus();
    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 50));

    // Cumulative: 4 successes, 2 failures (pattern p2 always fails)
    const stats = warmupManager.getWarmupStats();
    expect(stats.totalWarmups).toBe(2);
    expect(stats.totalSuccesses).toBe(4);
    expect(stats.totalFailures).toBe(2);
  });
});
