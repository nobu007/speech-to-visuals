/**
 * Phase 49: Monitoring Health Endpoint Degraded Status Tests
 *
 * REQ-125: Health endpoint degraded status during warmup failure
 * REQ-126: Health endpoint active alerts during warmup transitions
 * REQ-127: Health endpoint successRate boundary behavior
 *
 * Validates that the monitoring /health endpoint correctly reports:
 * - "degraded" when successRate drops below 0.95 (independent of warmup state)
 * - Active alerts alongside warmup status
 * - Boundary behavior at successRate = 0.95
 *
 * Previous phases (45-48) tested warmup state transitions and cache backend
 * failures with healthy dashboards (100% success rate). This phase tests
 * the interaction between degraded dashboard metrics and warmup status.
 */

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
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

/**
 * Populate a PerformanceDashboard with request history that yields a specific
 * success rate. Uses real requestStart/requestComplete calls.
 *
 * @param successRatio - e.g. 0.9 means 90% of requests succeeded
 * @param total        - total number of requests to simulate
 */
function seedRequests(dash: PerformanceDashboard, successRatio: number, total: number) {
  const successes = Math.round(total * successRatio);
  for (let i = 0; i < total; i++) {
    const id = dash.requestStart();
    dash.requestComplete(id, i < successes);
  }
}

function createMockService(
  enabled: boolean,
  warmupResult: 'resolve-true' | 'resolve-false' | 'reject-error' | 'hang',
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
    case 'hang':
      (service.warmupCache as jest.Mock).mockReturnValue(new Promise(() => {}));
      break;
  }

  return service;
}

// ---------------------------------------------------------------------------
// REQ-125: Health endpoint degraded status during warmup failure
// ---------------------------------------------------------------------------

describe('Phase 49 — REQ-125: Health endpoint degraded status during warmup failure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetWarmupStatus();
  });

  test('TC-125-01: degraded status with partial request failures and warmup pending', async () => {
    const dashboard = new PerformanceDashboard();
    // 16 successes / 20 total = 0.80 < 0.95 → degraded
    seedRequests(dashboard, 0.80, 20);

    const { app } = createApp(dashboard);
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('degraded');
    expect(response.body.data.successRate).toBeCloseTo(0.80, 1);
    // Warmup is pending (never triggered)
    expect(response.body.data.cacheWarmup.status).toBe('pending');
    // All standard health fields present
    expect(response.body.data.timestamp).toBeDefined();
    expect(response.body.data.uptime).toBeDefined();
    expect(response.body.data.totalRequests).toBe(20);
    expect(response.body.data.memoryUsage).toBeDefined();
    expect(response.body.data.cacheHitRate).toBeDefined();
    expect(response.body.data.activeAlerts).toBeDefined();

    dashboard.destroy();
  });

  test('TC-125-02: degraded status with partial request failures and warmup failed', async () => {
    const dashboard = new PerformanceDashboard();
    // 18 successes / 20 total = 0.90 < 0.95 → degraded
    seedRequests(dashboard, 0.90, 20);

    const service = createMockService(true, 'reject-error', 'ECONNREFUSED backend:6379');
    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 50));

    const { app } = createApp(dashboard);
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('degraded');
    expect(response.body.data.successRate).toBeCloseTo(0.90, 1);
    // Warmup failed but did not affect overall status
    expect(response.body.data.cacheWarmup.status).toBe('failed');
    expect(response.body.data.cacheWarmup.error).toContain('ECONNREFUSED');
    // Overall status is degraded due to successRate, not warmup
    expect(response.body.data.status).toBe('degraded');

    dashboard.destroy();
  });

  test('TC-125-03: health endpoint status is driven by successRate, not warmup outcome', async () => {
    const dashboard = new PerformanceDashboard();
    // 0.90 → degraded
    seedRequests(dashboard, 0.90, 20);

    // Succeed warmup — status should still be degraded
    const service = createMockService(true, 'resolve-true');
    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 50));

    const { app } = createApp(dashboard);
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.body.data.status).toBe('degraded');
    expect(response.body.data.successRate).toBeLessThan(0.95);
    // Warmup succeeded, but dashboard is still degraded
    expect(response.body.data.cacheWarmup.status).toBe('completed');

    dashboard.destroy();
  });

  test('TC-125-04: degraded status persists across multiple health requests', async () => {
    const dashboard = new PerformanceDashboard();
    seedRequests(dashboard, 0.90, 20);

    const { app } = createApp(dashboard);

    // First request
    const r1 = await request(app).get('/api/v1/monitoring/health');
    expect(r1.body.data.status).toBe('degraded');

    // Second request — same state
    const r2 = await request(app).get('/api/v1/monitoring/health');
    expect(r2.body.data.status).toBe('degraded');
    expect(r2.body.data.successRate).toBeCloseTo(0.90, 1);

    // Third request after warmup failure
    resetWarmupStatus();
    const service = createMockService(true, 'reject-error', 'backend down');
    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 50));

    const r3 = await request(app).get('/api/v1/monitoring/health');
    expect(r3.body.data.status).toBe('degraded');
    expect(r3.body.data.cacheWarmup.status).toBe('failed');

    dashboard.destroy();
  });
});

// ---------------------------------------------------------------------------
// REQ-126: Health endpoint active alerts during warmup transitions
// ---------------------------------------------------------------------------

describe('Phase 49 — REQ-126: Health endpoint active alerts during warmup transitions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetWarmupStatus();
  });

  test('TC-126-01: active alerts present in health response with warmup failure', async () => {
    const alert = {
      id: 'alert-1',
      timestamp: Date.now(),
      level: 'error' as const,
      category: 'quality' as const,
      message: 'Low success rate detected',
      metric: 'successRate',
      value: 0.50,
      threshold: 0.9,
      recommendation: 'Investigate pipeline failures',
    };

    const mockDashboard = {
      getDashboardData: () => ({
        currentMetrics: null,
        recentMetrics: [],
        activeAlerts: [alert],
        summary: {
          uptime: 5000,
          totalRequests: 10,
          successRate: 0.90,
          avgResponseTime: 500,
          memoryUsage: '128MB',
          cacheHitRate: 0.5,
        },
      }),
      getCostMetrics: () => ({}),
      getPerformanceTrends: () => ({ memory: [], responseTime: [], cacheHitRate: [], successRate: [], timestamps: [] }),
    } as unknown as PerformanceDashboard;

    const service = createMockService(true, 'reject-error', 'cache backend unreachable');
    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 50));

    const { app } = createApp(mockDashboard);
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.status).toBe(200);
    expect(response.body.data.activeAlerts).toHaveLength(1);
    expect(response.body.data.activeAlerts[0].message).toBe('Low success rate detected');
    expect(response.body.data.activeAlerts[0].level).toBe('error');
    expect(response.body.data.cacheWarmup.status).toBe('failed');
    // Both degraded metrics and warmup failure are present
    expect(response.body.data.status).toBe('degraded');
  });

  test('TC-126-02: active alerts with degraded status and failed warmup', async () => {
    const alerts = [
      {
        id: 'alert-mem',
        timestamp: Date.now(),
        level: 'warning' as const,
        category: 'memory' as const,
        message: 'High memory usage',
        metric: 'heapUsedMB',
        value: 450,
        threshold: 500,
        recommendation: 'Reduce memory usage',
      },
      {
        id: 'alert-perf',
        timestamp: Date.now(),
        level: 'error' as const,
        category: 'performance' as const,
        message: 'Slow processing detected',
        metric: 'totalTime',
        value: 65000,
        threshold: 60000,
        recommendation: 'Optimize pipeline',
      },
    ];

    const mockDashboard = {
      getDashboardData: () => ({
        currentMetrics: null,
        recentMetrics: [],
        activeAlerts: alerts,
        summary: {
          uptime: 10000,
          totalRequests: 50,
          successRate: 0.88,
          avgResponseTime: 1200,
          memoryUsage: '450MB',
          cacheHitRate: 0.3,
        },
      }),
      getCostMetrics: () => ({}),
      getPerformanceTrends: () => ({ memory: [], responseTime: [], cacheHitRate: [], successRate: [], timestamps: [] }),
    } as unknown as PerformanceDashboard;

    const service = createMockService(true, 'reject-error', 'ETIMEDOUT connection timed out');
    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 50));

    const { app } = createApp(mockDashboard);
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('degraded');
    expect(response.body.data.activeAlerts).toHaveLength(2);
    expect(response.body.data.cacheWarmup.status).toBe('failed');
    expect(response.body.data.cacheWarmup.error).toContain('ETIMEDOUT');
  });

  test('TC-126-03: empty alerts array when no alerts triggered', async () => {
    const dashboard = new PerformanceDashboard();
    // Fresh dashboard has no alerts
    const { app } = createApp(dashboard);
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.status).toBe(200);
    expect(response.body.data.activeAlerts).toEqual([]);
    expect(response.body.data.status).toBe('healthy');

    dashboard.destroy();
  });
});

// ---------------------------------------------------------------------------
// REQ-127: Health endpoint successRate boundary behavior
// ---------------------------------------------------------------------------

describe('Phase 49 — REQ-127: Health endpoint successRate boundary behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetWarmupStatus();
  });

  test('TC-127-01: reports healthy when successRate is exactly 0.95', async () => {
    const dashboard = new PerformanceDashboard();
    // 19 successes / 20 total = 0.95 → healthy (>= 0.95)
    seedRequests(dashboard, 0.95, 20);

    const { app } = createApp(dashboard);
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('healthy');
    expect(response.body.data.successRate).toBeCloseTo(0.95, 2);

    dashboard.destroy();
  });

  test('TC-127-02: reports degraded when successRate is 0.94 (just below threshold)', async () => {
    const dashboard = new PerformanceDashboard();
    // To get exactly 0.94: need a ratio that's just below 0.95
    // 17 successes / 18 total ≈ 0.944 → degraded
    seedRequests(dashboard, 17 / 18, 18);

    const { app } = createApp(dashboard);
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('degraded');
    expect(response.body.data.successRate).toBeLessThan(0.95);

    dashboard.destroy();
  });

  test('TC-127-03: reports healthy with zero requests (default 1.0 rate)', async () => {
    const dashboard = new PerformanceDashboard();
    // Fresh dashboard: 0 requests → successRate = 1.0

    const { app } = createApp(dashboard);
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.body.data.status).toBe('healthy');
    expect(response.body.data.successRate).toBe(1);
    expect(response.body.data.totalRequests).toBe(0);

    dashboard.destroy();
  });

  test('TC-127-04: boundary behavior is consistent regardless of warmup state', async () => {
    // Test all warmup states with the same degraded successRate
    const warmupScenarios: Array<{
      name: string;
      setup: () => void;
      expectedWarmupStatus: string;
    }> = [
      {
        name: 'pending warmup',
        setup: () => { /* don't trigger warmup */ },
        expectedWarmupStatus: 'pending',
      },
      {
        name: 'completed warmup',
        setup: () => {
          const svc = createMockService(true, 'resolve-true');
          triggerStartupWarmup(svc);
        },
        expectedWarmupStatus: 'completed',
      },
      {
        name: 'failed warmup',
        setup: () => {
          const svc = createMockService(true, 'reject-error', 'cache error');
          triggerStartupWarmup(svc);
        },
        expectedWarmupStatus: 'failed',
      },
      {
        name: 'skipped warmup',
        setup: () => {
          const svc = createMockService(false, 'resolve-true');
          triggerStartupWarmup(svc);
        },
        expectedWarmupStatus: 'skipped',
      },
    ];

    for (const scenario of warmupScenarios) {
      resetWarmupStatus();
      const dashboard = new PerformanceDashboard();
      // 90% success rate → degraded
      seedRequests(dashboard, 0.90, 20);

      scenario.setup();
      await new Promise((r) => setTimeout(r, 50));

      const { app } = createApp(dashboard);
      const response = await request(app).get('/api/v1/monitoring/health');

      expect(response.body.data.status).toBe('degraded');
      expect(response.body.data.successRate).toBeLessThan(0.95);
      expect(response.body.data.cacheWarmup.status).toBe(scenario.expectedWarmupStatus);

      dashboard.destroy();
    }
  });
});
