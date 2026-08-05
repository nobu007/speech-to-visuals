/**
 * Tests: Monitoring route — withTimeout error paths and
 * error-recovery / http-metrics / prometheus endpoint error handling.
 *
 * Coverage gaps addressed:
 * - /error-recovery: success and 500 error path
 * - /http-metrics: success and 500 error path
 * - TrendsQuerySchema: boundary values (1000ms min, 86400000ms max)
 * - DashboardQuerySchema: Zod issue details in validation error
 * - AlertsQuerySchema: Zod issue details in validation error
 */

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createMonitoringRouter } from '@/api/routes/monitoring';
import { PerformanceDashboard } from '@/monitoring/performance-dashboard';

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

// ---------------------------------------------------------------------------
// GET /error-recovery
// ---------------------------------------------------------------------------

describe('GET /api/v1/monitoring/error-recovery', () => {
  test('returns 200 with telemetry snapshot on success', async () => {
    const { app, dashboard } = createApp();
    const response = await request(app).get('/api/v1/monitoring/error-recovery');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    // TelemetrySnapshot fields
    expect(response.body.data.capturedAt).toBeDefined();
    expect(response.body.data.windowMs).toBeDefined();
    expect(response.body.data.totalEvents).toBeDefined();
    expect(response.body.data.overallSuccessRate).toBeDefined();
    expect(response.body.data.stages).toBeDefined();
    expect(response.body.data.degraded).toBeDefined();

    dashboard.destroy();
  });

  test('returns 500 ERROR_RECOVERY_TELEMETRY_ERROR when aggregator throws', async () => {
    const { recoveryTelemetryAggregator } = await import('@/quality/recovery-telemetry-aggregator');
    const spy = jest.spyOn(recoveryTelemetryAggregator, 'getSnapshot')
      .mockImplementation(() => { throw new Error('aggregator crash'); });

    const { app, dashboard } = createApp();
    const response = await request(app).get('/api/v1/monitoring/error-recovery');

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('ERROR_RECOVERY_TELEMETRY_ERROR');
    expect(response.body.error.message).toContain('aggregator crash');

    spy.mockRestore();
    dashboard.destroy();
  });
});

// ---------------------------------------------------------------------------
// GET /http-metrics
// ---------------------------------------------------------------------------

describe('GET /api/v1/monitoring/http-metrics', () => {
  test('returns 200 with HTTP metrics snapshot on success', async () => {
    const { app, dashboard } = createApp();
    const response = await request(app).get('/api/v1/monitoring/http-metrics');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.totalRequests).toBeDefined();
    expect(typeof response.body.data.totalRequests).toBe('number');

    dashboard.destroy();
  });

  test('returns 500 HTTP_METRICS_ERROR when collector throws', async () => {
    const { httpMetricsCollector } = await import('@/monitoring/http-metrics-collector');
    const spy = jest.spyOn(httpMetricsCollector, 'getSnapshot')
      .mockImplementation(() => { throw new Error('collector crash'); });

    const { app, dashboard } = createApp();
    const response = await request(app).get('/api/v1/monitoring/http-metrics');

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('HTTP_METRICS_ERROR');
    expect(response.body.error.message).toContain('collector crash');

    spy.mockRestore();
    dashboard.destroy();
  });
});

// ---------------------------------------------------------------------------
// GET /prometheus
// ---------------------------------------------------------------------------

describe('GET /api/v1/monitoring/prometheus', () => {
  test('returns 200 with Prometheus text format on success', async () => {
    const { app, dashboard } = createApp();
    const response = await request(app).get('/api/v1/monitoring/prometheus');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.text).toContain('# HELP');

    dashboard.destroy();
  });
});

// ---------------------------------------------------------------------------
// TrendsQuerySchema boundary tests
// ---------------------------------------------------------------------------

describe('TrendsQuerySchema boundary: timespan validation', () => {
  test('accepts timespan at exact minimum boundary (1000ms)', async () => {
    const { app, dashboard } = createApp();
    const response = await request(app).get('/api/v1/monitoring/trends?timespan=1000');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    dashboard.destroy();
  });

  test('accepts timespan at exact maximum boundary (86400000ms = 24h)', async () => {
    const { app, dashboard } = createApp();
    const response = await request(app).get('/api/v1/monitoring/trends?timespan=86400000');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    dashboard.destroy();
  });

  test('rejects timespan just below minimum (999ms)', async () => {
    const { app, dashboard } = createApp();
    const response = await request(app).get('/api/v1/monitoring/trends?timespan=999');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');

    dashboard.destroy();
  });

  test('rejects timespan just above maximum (86400001ms)', async () => {
    const { app, dashboard } = createApp();
    const response = await request(app).get('/api/v1/monitoring/trends?timespan=86400001');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');

    dashboard.destroy();
  });

  test('includes Zod issue details in validation error response', async () => {
    const { app, dashboard } = createApp();
    const response = await request(app).get('/api/v1/monitoring/trends?timespan=500');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toBeDefined();
    expect(Array.isArray(response.body.error.details)).toBe(true);
    expect(response.body.error.details.length).toBeGreaterThan(0);
    const detail = response.body.error.details[0];
    expect(detail.path).toBeDefined();
    expect(detail.message).toBeDefined();
    expect(detail.code).toBeDefined();

    dashboard.destroy();
  });
});

// ---------------------------------------------------------------------------
// DashboardQuerySchema: Zod issue details
// ---------------------------------------------------------------------------

describe('DashboardQuerySchema: validation error includes structured details', () => {
  test('includes details array with path/message/code for bad datasource', async () => {
    const { app, dashboard } = createApp();
    const response = await request(app)
      .get('/api/v1/monitoring/dashboard?datasource=bad!chars');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toBeDefined();
    expect(Array.isArray(response.body.error.details)).toBe(true);
    expect(response.body.error.details.length).toBeGreaterThan(0);
    const detail = response.body.error.details[0];
    expect(detail.path).toBeDefined();
    expect(detail.message).toBeDefined();
    expect(detail.code).toBeDefined();

    dashboard.destroy();
  });

  test('includes details for invalid refresh format', async () => {
    const { app, dashboard } = createApp();
    const response = await request(app)
      .get('/api/v1/monitoring/dashboard?refresh=not-a-duration');

    expect(response.status).toBe(400);
    expect(response.body.error.details).toBeDefined();
    expect(response.body.error.details.length).toBeGreaterThan(0);

    dashboard.destroy();
  });

  test('includes details for overly long prefix', async () => {
    const { app, dashboard } = createApp();
    const longPrefix = 'x'.repeat(51);
    const response = await request(app)
      .get(`/api/v1/monitoring/dashboard?prefix=${longPrefix}`);

    expect(response.status).toBe(400);
    expect(response.body.error.details).toBeDefined();
    expect(response.body.error.details.length).toBeGreaterThan(0);

    dashboard.destroy();
  });
});

// ---------------------------------------------------------------------------
// AlertsQuerySchema: Zod issue details
// ---------------------------------------------------------------------------

describe('AlertsQuerySchema: validation error includes structured details', () => {
  test('includes details array with path/message/code for bad prefix', async () => {
    const { app, dashboard } = createApp();
    const response = await request(app)
      .get('/api/v1/monitoring/alerts?prefix=bad prefix');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toBeDefined();
    expect(Array.isArray(response.body.error.details)).toBe(true);
    expect(response.body.error.details.length).toBeGreaterThan(0);

    dashboard.destroy();
  });
});

// ---------------------------------------------------------------------------
// withTimeout handler error path (via /metrics)
// ---------------------------------------------------------------------------

describe('withTimeout error handling via /metrics', () => {
  test('returns 500 METRICS_ERROR when dashboard throws synchronously', async () => {
    const brokenDashboard = {
      getDashboardData: () => { throw new Error('sync crash'); },
    } as unknown as PerformanceDashboard;

    const { app, dashboard: dash } = createApp(brokenDashboard);
    const response = await request(app).get('/api/v1/monitoring/metrics');

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('METRICS_ERROR');
    expect(response.body.error.message).toContain('sync crash');

    dash.destroy?.();
  });

  test('returns 500 COST_ERROR when getCostMetrics throws synchronously', async () => {
    const brokenDashboard = {
      getCostMetrics: () => { throw new Error('cost backend down'); },
    } as unknown as PerformanceDashboard;

    const { app, dashboard: dash } = createApp(brokenDashboard);
    const response = await request(app).get('/api/v1/monitoring/cost');

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('COST_ERROR');
    expect(response.body.error.message).toContain('cost backend down');

    dash.destroy?.();
  });
});
