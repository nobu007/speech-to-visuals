/**
 * Phase 45: Warmup Failure Resilience Integration Tests
 *
 * REQ-113: Monitoring health endpoint warmup failure tests (4 tests)
 * REQ-114: Cache backend unreachable integration tests (3 tests)
 * REQ-115: Warmup state transition monitoring tests (4 tests)
 *
 * Validates the fire-and-forget resilience of startup cache warmup:
 * - Warmup failures never propagate or block server startup
 * - Health endpoint correctly reports all warmup states
 * - Overall health status is independent of warmup outcome
 */

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import type { LLMService } from '../../src/analysis/llm-service';
import { PerformanceDashboard } from '../../src/monitoring/performance-dashboard';
import { createMonitoringRouter } from '../../src/api/routes/monitoring';
import {
  triggerStartupWarmup,
  getWarmupStatus,
  resetWarmupStatus,
} from '../../src/api/startup-warmup';

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

function createApp() {
  const app = express();
  const dashboard = new PerformanceDashboard();
  app.use(express.json());
  app.use('/api/v1/monitoring', createMonitoringRouter(dashboard));
  return { app, dashboard };
}

function createMockService(
  enabled: boolean,
  warmupResult: 'resolve-true' | 'resolve-false' | 'reject-error' | 'reject-string' | 'hang',
  errorMessage = 'error',
) {
  const service = {
    isEnabled: jest.fn().mockReturnValue(enabled),
    warmupCache: jest.fn(),
    getCacheWarmupStats: jest.fn().mockReturnValue({ totalPatternsProcessed: 8 }),
  } as unknown as LLMService;

  switch (warmupResult) {
    case 'resolve-true':
      (service.warmupCache as jest.Mock).mockResolvedValue(true);
      break;
    case 'resolve-false':
      (service.warmupCache as jest.Mock).mockResolvedValue(false);
      break;
    case 'reject-error':
      (service.warmupCache as jest.Mock).mockRejectedValue(new Error(errorMessage));
      break;
    case 'reject-string':
      (service.warmupCache as jest.Mock).mockRejectedValue(errorMessage);
      break;
    case 'hang':
      (service.warmupCache as jest.Mock).mockReturnValue(new Promise(() => {}));
      break;
  }

  return service;
}

// ---------------------------------------------------------------------------
// REQ-113: Monitoring Health Endpoint Warmup Failure Tests
// ---------------------------------------------------------------------------

describe('Phase 45 — REQ-113: Monitoring health endpoint warmup failure tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetWarmupStatus();
  });

  test('TC-113-01: should return failed warmup status in health response', async () => {
    const service = createMockService(true, 'reject-error', 'ECONNREFUSED 127.0.0.1:6379');
    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 50));

    const { app, dashboard } = createApp();
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.status).toBe(200);
    expect(response.body.data.cacheWarmup.status).toBe('failed');
    expect(response.body.data.cacheWarmup.error).toContain('ECONNREFUSED');
    expect(response.body.data.cacheWarmup.timestamp).toBeDefined();
    dashboard.destroy();
  });

  test('TC-113-02: warmup failure should not degrade overall health status', async () => {
    const service = createMockService(true, 'reject-error', 'cache error');
    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 50));

    const { app, dashboard } = createApp();
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.status).toBe(200);
    // Health status is based on successRate (1.0 = healthy), NOT warmup state
    expect(response.body.data.status).toBe('healthy');
    expect(response.body.data.cacheWarmup.status).toBe('failed');
    dashboard.destroy();
  });

  test('TC-113-E01: should return pending warmup status in health response', async () => {
    // Initial state is pending — no warmup triggered
    const { app, dashboard } = createApp();
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.status).toBe(200);
    expect(response.body.data.cacheWarmup.status).toBe('pending');
    expect(response.body.data.cacheWarmup.error).toBeUndefined();
    dashboard.destroy();
  });

  test('TC-113-E02: should return skipped warmup status in health response', async () => {
    const service = createMockService(false, 'resolve-true');
    triggerStartupWarmup(service);

    const { app, dashboard } = createApp();
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.status).toBe(200);
    expect(response.body.data.cacheWarmup.status).toBe('skipped');
    dashboard.destroy();
  });
});

// ---------------------------------------------------------------------------
// REQ-114: Cache Backend Unreachable Integration Tests
// ---------------------------------------------------------------------------

describe('Phase 45 — REQ-114: Cache backend unreachable integration tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetWarmupStatus();
  });

  test('TC-114-01: ECONNREFUSED error handling', async () => {
    const service = createMockService(true, 'reject-error', 'ECONNREFUSED 127.0.0.1:6379');

    // triggerStartupWarmup must NOT throw (fire-and-forget)
    expect(() => triggerStartupWarmup(service)).not.toThrow();

    await new Promise((r) => setTimeout(r, 50));

    const status = getWarmupStatus();
    expect(status.status).toBe('failed');
    expect(status.error).toContain('ECONNREFUSED');
  });

  test('TC-114-02: request timeout error handling', async () => {
    const service = createMockService(true, 'reject-error', 'request timeout');

    expect(() => triggerStartupWarmup(service)).not.toThrow();

    await new Promise((r) => setTimeout(r, 50));

    const status = getWarmupStatus();
    expect(status.status).toBe('failed');
    expect(status.error).toContain('timeout');
  });

  test('TC-114-E01: non-Error rejection (string) handling', async () => {
    const service = createMockService(true, 'reject-string', 'unknown failure');

    expect(() => triggerStartupWarmup(service)).not.toThrow();

    await new Promise((r) => setTimeout(r, 50));

    const status = getWarmupStatus();
    expect(status.status).toBe('failed');
    expect(status.error).toContain('unknown failure');
  });
});

// ---------------------------------------------------------------------------
// REQ-115: Warmup State Transition Monitoring Tests
// ---------------------------------------------------------------------------

describe('Phase 45 — REQ-115: Warmup state transition monitoring tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetWarmupStatus();
  });

  test('TC-115-01: pending → completed transition reflected in health endpoint', async () => {
    const service = createMockService(true, 'resolve-true');
    triggerStartupWarmup(service);

    // Initially pending
    expect(getWarmupStatus().status).toBe('pending');

    await new Promise((r) => setTimeout(r, 50));

    const { app, dashboard } = createApp();
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.body.data.cacheWarmup.status).toBe('completed');
    expect(response.body.data.cacheWarmup.patternsProcessed).toBe(8);
    dashboard.destroy();
  });

  test('TC-115-02: pending → skipped (cache already warm) transition in health endpoint', async () => {
    const service = createMockService(true, 'resolve-false');
    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 50));

    const { app, dashboard } = createApp();
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.body.data.cacheWarmup.status).toBe('skipped');
    expect(response.body.data.cacheWarmup.timestamp).toBeDefined();
    dashboard.destroy();
  });

  test('TC-115-03: pending → failed transition reflected in health endpoint', async () => {
    const service = createMockService(true, 'reject-error', 'connection refused');
    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 50));

    const { app, dashboard } = createApp();
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.body.data.cacheWarmup.status).toBe('failed');
    expect(response.body.data.cacheWarmup.error).toBe('connection refused');
    dashboard.destroy();
  });

  test('TC-115-B01: in-flight warmup shows pending in health endpoint', async () => {
    const service = createMockService(true, 'hang');
    triggerStartupWarmup(service);

    const { app, dashboard } = createApp();
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.body.data.cacheWarmup.status).toBe('pending');
    dashboard.destroy();
  });
});
