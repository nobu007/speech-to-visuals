/**
 * Phase 201: Export Guard Admin Dashboard API Tests
 *
 * Tests for security guard metrics management endpoints:
 * - GET  /metrics           - JSON snapshot
 * - GET  /metrics/prometheus - Prometheus text format
 * - POST /metrics/reset      - Reset metrics
 * - GET  /threat-level       - Threat assessment
 */
import express from 'express';
import request from 'supertest';
import { createSecurityAdminRouter } from '../security-admin';
import { securityMetricsCollector } from '../../../export/security-metrics-collector';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/security', createSecurityAdminRouter());
  return app;
}

describe('Phase 201: Security Guard Admin API', () => {
  let app: express.Express;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    securityMetricsCollector.reset();
  });

  afterEach(() => {
    securityMetricsCollector.reset();
  });

  // -------------------------------------------------------------------------
  // GET /metrics
  // -------------------------------------------------------------------------

  describe('GET /api/v1/security/metrics', () => {
    it('should return empty metrics snapshot', async () => {
      const res = await request(app).get('/api/v1/security/metrics');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.metrics.totalRejections).toBe(0);
      expect(res.body.metrics.byLayer).toBeDefined();
      expect(res.body.metrics.bySeverity).toBeDefined();
      expect(res.body.metrics.byPattern).toEqual([]);
    });

    it('should reflect recorded rejections', async () => {
      securityMetricsCollector.recordRejection('content-validator', 'high', 'script-tag');

      const res = await request(app).get('/api/v1/security/metrics');

      expect(res.status).toBe(200);
      expect(res.body.metrics.totalRejections).toBe(1);
      expect(res.body.metrics.byLayer['content-validator']).toBe(1);
      expect(res.body.metrics.bySeverity.high).toBe(1);
      expect(res.body.metrics.byPattern).toHaveLength(1);
      expect(res.body.metrics.byPattern[0].pattern).toBe('script-tag');
    });

    it('should include matrix breakdown', async () => {
      securityMetricsCollector.recordRejection('content-validator', 'high', 'xss');
      securityMetricsCollector.recordRejection('strict-mode-block', 'medium', 'event-handler');

      const res = await request(app).get('/api/v1/security/metrics');

      expect(res.status).toBe(200);
      expect(res.body.metrics.matrix['content-validator'].high).toBe(1);
      expect(res.body.metrics.matrix['strict-mode-block'].medium).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // GET /metrics/prometheus
  // -------------------------------------------------------------------------

  describe('GET /api/v1/security/metrics/prometheus', () => {
    it('should return Prometheus text format with correct content type', async () => {
      const res = await request(app).get('/api/v1/security/metrics/prometheus');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.text).toContain('# HELP security_guard_rejections_total');
      expect(res.text).toContain('# TYPE security_guard_rejections_total counter');
    });

    it('should include rejection entries for recorded findings', async () => {
      securityMetricsCollector.recordRejection('escape-function', 'high', 'script-tag');

      const res = await request(app).get('/api/v1/security/metrics/prometheus');

      expect(res.status).toBe(200);
      expect(res.text).toContain('security_guard_rejections_total');
      expect(res.text).toContain('layer="escape-function"');
      expect(res.text).toContain('severity="high"');
      expect(res.text).toContain('pattern="script-tag"');
    });

    it('should include per-layer gauge metrics', async () => {
      securityMetricsCollector.recordRejection('content-validator', 'high', 'test');

      const res = await request(app).get('/api/v1/security/metrics/prometheus');

      expect(res.text).toContain('security_guard_rejections_by_layer');
      expect(res.text).toContain('layer="content-validator"');
    });

    it('should include per-severity gauge metrics', async () => {
      securityMetricsCollector.recordRejection('content-validator', 'medium', 'test');

      const res = await request(app).get('/api/v1/security/metrics/prometheus');

      expect(res.text).toContain('security_guard_rejections_by_severity');
      expect(res.text).toContain('severity="medium"');
    });
  });

  // -------------------------------------------------------------------------
  // POST /metrics/reset (admin token protected)
  // -------------------------------------------------------------------------

  describe('POST /api/v1/security/metrics/reset', () => {
    const TEST_TOKEN = 'test-admin-token-abc123';

    beforeEach(() => {
      process.env.ADMIN_TOKEN = TEST_TOKEN;
    });

    afterEach(() => {
      delete process.env.ADMIN_TOKEN;
    });

    it('should reject reset without Authorization header (401)', async () => {
      const res = await request(app).post('/api/v1/security/metrics/reset');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject reset with wrong token (401)', async () => {
      const res = await request(app)
        .post('/api/v1/security/metrics/reset')
        .set('Authorization', 'Bearer wrong-token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject reset with malformed Authorization header (401)', async () => {
      const res = await request(app)
        .post('/api/v1/security/metrics/reset')
        .set('Authorization', 'NotBearer test-admin-token-abc123');

      expect(res.status).toBe(401);
    });

    it('should accept reset with valid Bearer token', async () => {
      securityMetricsCollector.recordRejection('content-validator', 'high', 'script-tag');

      const res = await request(app)
        .post('/api/v1/security/metrics/reset')
        .set('Authorization', `Bearer ${TEST_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('reset');
      expect(res.body.metrics.totalRejections).toBe(0);
    });

    it('should accept reset with valid X-Admin-Token header', async () => {
      securityMetricsCollector.recordRejection('content-validator', 'high', 'test1');

      const res = await request(app)
        .post('/api/v1/security/metrics/reset')
        .set('X-Admin-Token', TEST_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.metrics.totalRejections).toBe(0);
    });

    it('should return zeroed snapshot after reset', async () => {
      securityMetricsCollector.recordRejection('content-validator', 'high', 'test1');
      securityMetricsCollector.recordRejection('content-validator', 'high', 'test2');

      const res = await request(app)
        .post('/api/v1/security/metrics/reset')
        .set('Authorization', `Bearer ${TEST_TOKEN}`);

      expect(res.body.metrics.totalRejections).toBe(0);
      expect(res.body.metrics.byPattern).toEqual([]);
      expect(res.body.metrics.byLayer['content-validator']).toBe(0);
    });

    it('should be idempotent (reset on empty metrics)', async () => {
      const res = await request(app)
        .post('/api/v1/security/metrics/reset')
        .set('Authorization', `Bearer ${TEST_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.metrics.totalRejections).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // POST /metrics/reset — ADMIN_TOKEN not configured
  // -------------------------------------------------------------------------

  describe('POST /api/v1/security/metrics/reset without ADMIN_TOKEN', () => {
    it('should refuse reset (403) when ADMIN_TOKEN is not set', async () => {
      delete process.env.ADMIN_TOKEN;

      const res = await request(app)
        .post('/api/v1/security/metrics/reset')
        .set('Authorization', 'Bearer any-token');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ADMIN_NOT_CONFIGURED');
    });

    it('should refuse reset even without any auth attempt (403)', async () => {
      delete process.env.ADMIN_TOKEN;

      const res = await request(app).post('/api/v1/security/metrics/reset');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ADMIN_NOT_CONFIGURED');
    });
  });

  // -------------------------------------------------------------------------
  // GET /threat-level
  // -------------------------------------------------------------------------

  describe('GET /api/v1/security/threat-level', () => {
    it('should return clear level when no rejections', async () => {
      const res = await request(app).get('/api/v1/security/threat-level');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.assessment.level).toBe('clear');
      expect(res.body.assessment.totalRejections).toBe(0);
      expect(res.body.assessment.highSeverityCount).toBe(0);
      expect(res.body.assessment.topAttackPattern).toBeNull();
      expect(res.body.assessment.activeLayers).toBe(0);
      expect(res.body.assessment.assessedAt).toBeDefined();
    });

    it('should return elevated level for moderate high-severity rejections', async () => {
      securityMetricsCollector.recordRejection('content-validator', 'high', 'script-tag');

      const res = await request(app).get('/api/v1/security/threat-level');

      expect(res.body.assessment.level).toBe('elevated');
      expect(res.body.assessment.totalRejections).toBe(1);
      expect(res.body.assessment.highSeverityCount).toBe(1);
      expect(res.body.assessment.topAttackPattern).toBe('script-tag');
      expect(res.body.assessment.activeLayers).toBe(1);
    });

    it('should return critical level for many high-severity rejections', async () => {
      for (let i = 0; i < 10; i++) {
        securityMetricsCollector.recordRejection('content-validator', 'high', `pattern-${i}`);
      }

      const res = await request(app).get('/api/v1/security/threat-level');

      expect(res.body.assessment.level).toBe('critical');
      expect(res.body.assessment.highSeverityCount).toBe(10);
    });

    it('should return critical level for high total rejections even if medium only', async () => {
      for (let i = 0; i < 50; i++) {
        securityMetricsCollector.recordRejection('content-validator', 'medium', `pattern-${i}`);
      }

      const res = await request(app).get('/api/v1/security/threat-level');

      expect(res.body.assessment.level).toBe('critical');
      expect(res.body.assessment.totalRejections).toBe(50);
      expect(res.body.assessment.highSeverityCount).toBe(0);
    });

    it('should return elevated for 10+ total rejections with no high severity', async () => {
      for (let i = 0; i < 10; i++) {
        securityMetricsCollector.recordRejection('content-validator', 'medium', `pattern-${i}`);
      }

      const res = await request(app).get('/api/v1/security/threat-level');

      expect(res.body.assessment.level).toBe('elevated');
    });

    it('should count active defense layers correctly', async () => {
      securityMetricsCollector.recordRejection('content-validator', 'high', 'test1');
      securityMetricsCollector.recordRejection('escape-function', 'medium', 'test2');
      securityMetricsCollector.recordRejection('strict-mode-block', 'high', 'test3');

      const res = await request(app).get('/api/v1/security/threat-level');

      expect(res.body.assessment.activeLayers).toBe(3);
    });

    it('should identify top attack pattern by count', async () => {
      securityMetricsCollector.recordRejection('content-validator', 'high', 'script-tag');
      securityMetricsCollector.recordRejection('content-validator', 'high', 'script-tag');
      securityMetricsCollector.recordRejection('content-validator', 'high', 'event-handler');

      const res = await request(app).get('/api/v1/security/threat-level');

      expect(res.body.assessment.topAttackPattern).toBe('script-tag');
    });

    it('should include ISO timestamp', async () => {
      const res = await request(app).get('/api/v1/security/threat-level');

      const timestamp = new Date(res.body.assessment.assessedAt);
      expect(timestamp.getTime()).not.toBeNaN();
    });
  });
});
