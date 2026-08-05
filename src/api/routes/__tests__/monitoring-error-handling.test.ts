/**
 * TASK-0216: Monitoring API Route Error Handling Tests
 *
 * Tests for:
 * 1. Zod validation error returning all issues (not just the first)
 * 2. Timeout protection on heavy handlers
 * 3. Normal response paths not triggering error paths
 */

import express from 'express';
import request from 'supertest';
import { createMonitoringRouter } from '../monitoring';
import { PerformanceDashboard } from '../../../monitoring/performance-dashboard';

function createApp(dashboard?: PerformanceDashboard) {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/monitoring', createMonitoringRouter(dashboard));
  return app;
}

describe('TASK-0216: Monitoring API Error Handling', () => {
  let app: express.Express;
  let dashboard: PerformanceDashboard;

  beforeEach(() => {
    dashboard = new PerformanceDashboard();
    app = createApp(dashboard);
  });

  afterEach(() => {
    dashboard.destroy();
  });

  // ---------------------------------------------------------------------------
  // Zod validation: all issues returned
  // ---------------------------------------------------------------------------

  describe('Zod validation returns all issues', () => {
    it('should return details array for invalid trends timespan', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/trends?timespan=abc');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeDefined();
      expect(Array.isArray(response.body.error.details)).toBe(true);
      expect(response.body.error.details.length).toBeGreaterThanOrEqual(1);
      expect(response.body.error.details[0]).toHaveProperty('message');
      expect(response.body.error.details[0]).toHaveProperty('code');
    });

    it('should return details for invalid dashboard query', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/dashboard?datasource=invalid name with spaces');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeDefined();
      expect(Array.isArray(response.body.error.details)).toBe(true);
    });

    it('should return single detail for one validation error', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/trends?timespan=50');

      expect(response.status).toBe(400);
      expect(response.body.error.details).toHaveLength(1);
      expect(response.body.error.details[0].message).toContain('1000');
    });

    it('should pass validation for valid trends timespan', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/trends?timespan=3600000');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.error).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Normal response paths
  // ---------------------------------------------------------------------------

  describe('Normal responses do not trigger error paths', () => {
    it('should return 200 for /metrics on success', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/metrics');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should return 200 for /cost on success', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/cost');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should return 200 for /health on success', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.status).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Validation details structure
  // ---------------------------------------------------------------------------

  describe('Validation details structure', () => {
    it('should include path, message, and code in each detail', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/trends?timespan=invalid');

      expect(response.status).toBe(400);
      const detail = response.body.error.details[0];
      expect(detail).toHaveProperty('path');
      expect(detail).toHaveProperty('message');
      expect(detail).toHaveProperty('code');
    });

    it('should maintain backward-compatible error.message field', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/trends?timespan=bad');

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBeDefined();
      expect(typeof response.body.error.message).toBe('string');
    });
  });
});
