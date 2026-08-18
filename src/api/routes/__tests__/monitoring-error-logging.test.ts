/**
 * Tests verifying that monitoring REST API routes log server errors (5xx)
 * via logger.error before sending the HTTP error response.
 *
 * Previously, all 9 catch blocks in monitoring.ts called sendError() without
 * logging, meaning server-side errors were invisible in production logs.
 * This test suite verifies the fix: sendError now calls logger.error for
 * status >= 500.
 */

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createMonitoringRouter } from '../monitoring';
import { PerformanceDashboard } from '../../../monitoring/performance-dashboard';
import { logger } from '@stv/core/utils/logger';

describe('Monitoring API Error Logging', () => {
  let errorSpy: jest.SpiedFunction<typeof logger.error>;

  beforeEach(() => {
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  function createApp(dashboard?: PerformanceDashboard) {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/monitoring', createMonitoringRouter(dashboard));
    return app;
  }

  /**
   * Create a dashboard stub where every method throws, simulating
   * internal failures.
   */
  function createThrowingDashboard(): PerformanceDashboard {
    const dash = Object.create(PerformanceDashboard.prototype) as PerformanceDashboard;
    jest.spyOn(dash, 'getDashboardData').mockImplementation(() => {
      throw new Error('Dashboard internal failure');
    });
    jest.spyOn(dash, 'getCostMetrics').mockImplementation(() => {
      throw new Error('Cost metrics failure');
    });
    jest.spyOn(dash, 'getPerformanceTrends').mockImplementation(() => {
      throw new Error('Trends computation failure');
    });
    return dash;
  }

  test('GET /metrics should log error when dashboard throws', async () => {
    const dashboard = createThrowingDashboard();
    const app = createApp(dashboard);

    const response = await request(app).get('/api/v1/monitoring/metrics');

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('METRICS_ERROR');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('METRICS_ERROR'),
    );
  });

  test('GET /cost should log error when dashboard throws', async () => {
    const dashboard = createThrowingDashboard();
    const app = createApp(dashboard);

    const response = await request(app).get('/api/v1/monitoring/cost');

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('COST_ERROR');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('COST_ERROR'),
    );
  });

  test('GET /trends should log error when dashboard throws', async () => {
    const dashboard = createThrowingDashboard();
    const app = createApp(dashboard);

    const response = await request(app).get('/api/v1/monitoring/trends');

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('TRENDS_ERROR');
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  test('GET /health should log error when dashboard throws', async () => {
    const dashboard = createThrowingDashboard();
    const app = createApp(dashboard);

    const response = await request(app).get('/api/v1/monitoring/health');

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('HEALTH_ERROR');
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  test('GET /trends should NOT log error for 400 validation errors', async () => {
    const dashboard = new PerformanceDashboard();
    const app = createApp(dashboard);

    const response = await request(app).get('/api/v1/monitoring/trends?timespan=abc');

    expect(response.status).toBe(400);
    expect(errorSpy).not.toHaveBeenCalled();

    dashboard.destroy();
  });
});
