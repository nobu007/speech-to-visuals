/**
 * REQ-100: Monitoring REST API Endpoint Unit Tests
 *
 * Dedicated unit tests for the monitoring router endpoints:
 * - GET /metrics  — current dashboard data
 * - GET /cost     — LLM cost metrics
 * - GET /trends   — performance trends with query validation
 * - GET /health   — production health check with warmup status
 *
 * Validates response shapes, error handling, Zod query validation,
 * and integration with PerformanceDashboard and warmup status.
 */

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { PerformanceDashboard } from '@/monitoring/performance-dashboard';
import { createMonitoringRouter } from '@/api/routes/monitoring';
import {
  getWarmupStatus,
  resetWarmupStatus,
  triggerStartupWarmup,
} from '@/api/startup-warmup';
import type { LLMService } from '@/analysis/llm-service';

// Suppress logger noise during tests
jest.mock('@/utils/logger', () => ({
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
  app.use(express.json());
  const dash = dashboard ?? new PerformanceDashboard();
  app.use('/api/v1/monitoring', createMonitoringRouter(dash));
  return { app, dashboard: dash };
}

function createMockService(
  enabled: boolean,
  warmupResult: 'resolve-true' | 'resolve-false' | 'reject-error',
) {
  const service = {
    isEnabled: jest.fn().mockReturnValue(enabled),
    warmupCache: jest.fn(),
    getCacheWarmupStats: jest.fn().mockReturnValue({ totalPatternsProcessed: 5 }),
  } as unknown as LLMService;

  switch (warmupResult) {
    case 'resolve-true':
      (service.warmupCache as jest.Mock).mockResolvedValue(true);
      break;
    case 'resolve-false':
      (service.warmupCache as jest.Mock).mockResolvedValue(false);
      break;
    case 'reject-error':
      (service.warmupCache as jest.Mock).mockRejectedValue(new Error('test error'));
      break;
  }

  return service;
}

// ===========================================================================
// GET /metrics
// ===========================================================================

describe('REQ-100: GET /api/v1/monitoring/metrics', () => {
  let dashboard: PerformanceDashboard;
  let app: express.Express;

  beforeEach(() => {
    const created = createApp();
    app = created.app;
    dashboard = created.dashboard;
  });

  afterEach(() => {
    dashboard.destroy();
  });

  test('should return 200 with dashboard data', async () => {
    const response = await request(app).get('/api/v1/monitoring/metrics');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.currentMetrics).toBeDefined();
    expect(response.body.data.recentMetrics).toBeDefined();
    expect(response.body.data.activeAlerts).toBeDefined();
    expect(response.body.data.summary).toBeDefined();
  });

  test('should include summary fields', async () => {
    const response = await request(app).get('/api/v1/monitoring/metrics');

    const summary = response.body.data.summary;
    expect(summary.uptime).toBeDefined();
    expect(typeof summary.uptime).toBe('number');
    expect(summary.totalRequests).toBeDefined();
    expect(typeof summary.totalRequests).toBe('number');
    expect(summary.successRate).toBeDefined();
    expect(typeof summary.successRate).toBe('number');
    expect(summary.avgResponseTime).toBeDefined();
    expect(summary.memoryUsage).toBeDefined();
    expect(typeof summary.memoryUsage).toBe('string');
    expect(summary.cacheHitRate).toBeDefined();
    expect(typeof summary.cacheHitRate).toBe('number');
  });

  test('should use custom dashboard when provided', async () => {
    const customDashboard = new PerformanceDashboard();
    customDashboard.recordTokenUsage({
      model: 'gemini-2.5-flash',
      inputTokens: 100,
      outputTokens: 50,
      stage: 'analysis',
    });

    const { app, dashboard: dash } = createApp(customDashboard);
    const response = await request(app).get('/api/v1/monitoring/metrics');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    dash.destroy();
  });

  test('should handle dashboard errors gracefully', async () => {
    // Create a dashboard that throws on getDashboardData
    const brokenDashboard = {
      getDashboardData: () => { throw new Error('dashboard broken'); },
    } as unknown as PerformanceDashboard;

    const { app: testApp } = createApp(brokenDashboard);
    const response = await request(testApp).get('/api/v1/monitoring/metrics');

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('METRICS_ERROR');
    expect(response.body.error.message).toContain('dashboard broken');
  });
});

// ===========================================================================
// GET /cost
// ===========================================================================

describe('REQ-100: GET /api/v1/monitoring/cost', () => {
  let dashboard: PerformanceDashboard;
  let app: express.Express;

  beforeEach(() => {
    const created = createApp();
    app = created.app;
    dashboard = created.dashboard;
  });

  afterEach(() => {
    dashboard.destroy();
  });

  test('should return 200 with cost metrics', async () => {
    const response = await request(app).get('/api/v1/monitoring/cost');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
  });

  test('should include cost fields when token usage recorded', async () => {
    dashboard.recordTokenUsage({
      model: 'gemini-2.5-flash',
      inputTokens: 500,
      outputTokens: 200,
      stage: 'analysis',
    });

    const response = await request(app).get('/api/v1/monitoring/cost');

    expect(response.status).toBe(200);
    expect(response.body.data.totalInputTokens).toBe(500);
    expect(response.body.data.totalOutputTokens).toBe(200);
    expect(response.body.data.totalTokens).toBe(700);
    expect(response.body.data.recordCount).toBe(1);
    expect(typeof response.body.data.averageCostPerRequest).toBe('number');
  });

  test('should return zero cost when no token usage recorded', async () => {
    const response = await request(app).get('/api/v1/monitoring/cost');

    expect(response.status).toBe(200);
    expect(response.body.data.totalInputTokens).toBe(0);
    expect(response.body.data.totalOutputTokens).toBe(0);
    expect(response.body.data.totalTokens).toBe(0);
    expect(response.body.data.recordCount).toBe(0);
    expect(response.body.data.averageCostPerRequest).toBe(0);
  });

  test('should handle cost metric errors gracefully', async () => {
    const brokenDashboard = {
      getCostMetrics: () => { throw new Error('cost backend error'); },
    } as unknown as PerformanceDashboard;

    const { app: testApp } = createApp(brokenDashboard);
    const response = await request(testApp).get('/api/v1/monitoring/cost');

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('COST_ERROR');
  });
});

// ===========================================================================
// GET /trends
// ===========================================================================

describe('REQ-100: GET /api/v1/monitoring/trends', () => {
  let dashboard: PerformanceDashboard;
  let app: express.Express;

  beforeEach(() => {
    const created = createApp();
    app = created.app;
    dashboard = created.dashboard;
  });

  afterEach(() => {
    dashboard.destroy();
  });

  test('should return 200 with default timespan (5 min)', async () => {
    const response = await request(app).get('/api/v1/monitoring/trends');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.memory).toBeDefined();
    expect(response.body.data.responseTime).toBeDefined();
    expect(response.body.data.cacheHitRate).toBeDefined();
    expect(response.body.data.successRate).toBeDefined();
    expect(response.body.data.timestamps).toBeDefined();
  });

  test('should accept custom timespan query parameter', async () => {
    const response = await request(app).get('/api/v1/monitoring/trends?timespan=60000');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.memory)).toBe(true);
    expect(Array.isArray(response.body.data.timestamps)).toBe(true);
  });

  test('should reject non-numeric timespan', async () => {
    const response = await request(app).get('/api/v1/monitoring/trends?timespan=abc');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should reject timespan below minimum (1000ms)', async () => {
    const response = await request(app).get('/api/v1/monitoring/trends?timespan=500');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should reject timespan above maximum (86400000ms)', async () => {
    const response = await request(app).get('/api/v1/monitoring/trends?timespan=99999999');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should handle trends errors gracefully', async () => {
    const brokenDashboard = {
      getPerformanceTrends: () => { throw new Error('trends error'); },
    } as unknown as PerformanceDashboard;

    const { app: testApp } = createApp(brokenDashboard);
    const response = await request(testApp).get('/api/v1/monitoring/trends?timespan=60000');

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('TRENDS_ERROR');
  });
});

// ===========================================================================
// GET /health
// ===========================================================================

describe('REQ-100: GET /api/v1/monitoring/health', () => {
  let dashboard: PerformanceDashboard;
  let app: express.Express;

  beforeEach(() => {
    const created = createApp();
    app = created.app;
    dashboard = created.dashboard;
    resetWarmupStatus();
  });

  afterEach(() => {
    dashboard.destroy();
    resetWarmupStatus();
  });

  test('should return 200 with health data', async () => {
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
  });

  test('should include all required health fields', async () => {
    const response = await request(app).get('/api/v1/monitoring/health');

    const data = response.body.data;
    expect(data.status).toBeDefined();
    expect(data.timestamp).toBeDefined();
    expect(data.uptime).toBeDefined();
    expect(data.totalRequests).toBeDefined();
    expect(data.successRate).toBeDefined();
    expect(data.avgResponseTime).toBeDefined();
    expect(data.memoryUsage).toBeDefined();
    expect(data.cacheHitRate).toBeDefined();
    expect(data.cacheWarmup).toBeDefined();
    expect(data.activeAlerts).toBeDefined();
  });

  test('should report healthy when successRate >= 0.95', async () => {
    // New dashboard has 100% success rate (1.0)
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.body.data.status).toBe('healthy');
    expect(response.body.data.successRate).toBeGreaterThanOrEqual(0.95);
  });

  test('should include cacheWarmup status field', async () => {
    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.body.data.cacheWarmup).toBeDefined();
    expect(response.body.data.cacheWarmup.status).toBe('pending');
  });

  test('should reflect completed warmup status', async () => {
    const service = createMockService(true, 'resolve-true');
    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 50));

    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.body.data.cacheWarmup.status).toBe('completed');
    expect(response.body.data.cacheWarmup.patternsProcessed).toBe(5);
  });

  test('should reflect skipped warmup status', async () => {
    const service = createMockService(false, 'resolve-true');
    triggerStartupWarmup(service);

    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.body.data.cacheWarmup.status).toBe('skipped');
  });

  test('should reflect failed warmup status', async () => {
    const service = createMockService(true, 'reject-error');
    triggerStartupWarmup(service);
    await new Promise((r) => setTimeout(r, 50));

    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.body.data.cacheWarmup.status).toBe('failed');
    expect(response.body.data.cacheWarmup.error).toContain('test error');
  });

  test('should handle health check errors gracefully', async () => {
    const brokenDashboard = {
      getDashboardData: () => { throw new Error('health check failure'); },
    } as unknown as PerformanceDashboard;

    const { app: testApp } = createApp(brokenDashboard);
    const response = await request(testApp).get('/api/v1/monitoring/health');

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('HEALTH_ERROR');
    expect(response.body.error.message).toContain('health check failure');
  });
});
