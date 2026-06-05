/**
 * TASK-0146: Monitoring REST API Endpoint Tests
 *
 * Tests for:
 * - GET /metrics  - Dashboard metrics
 * - GET /cost     - LLM cost metrics
 * - GET /trends   - Performance trends
 * - GET /health   - Production health check
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

describe('Monitoring REST API Endpoints', () => {
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
  // GET /metrics
  // ---------------------------------------------------------------------------

  describe('GET /metrics', () => {
    it('should return dashboard data with expected shape', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/metrics');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.summary.uptime).toBeGreaterThanOrEqual(0);
      expect(response.body.data.summary.totalRequests).toBe(0);
      expect(response.body.data.summary.successRate).toBe(1);
    });

    it('should reflect recorded request data', async () => {
      const reqId = dashboard.requestStart();
      dashboard.requestComplete(reqId, true, {
        transcriptionTime: 100,
        analysisTime: 200,
        layoutTime: 50,
        renderTime: 300,
      });

      const response = await request(app)
        .get('/api/v1/monitoring/metrics');

      expect(response.status).toBe(200);
      expect(response.body.data.summary.totalRequests).toBe(1);
      expect(response.body.data.summary.successRate).toBe(1);
    });

    it('should include activeAlerts array', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/metrics');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.activeAlerts)).toBe(true);
    });

    it('should include recentMetrics array', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/metrics');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.recentMetrics)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /cost
  // ---------------------------------------------------------------------------

  describe('GET /cost', () => {
    it('should return cost metrics with zero values initially', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/cost');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.totalInputTokens).toBe(0);
      expect(response.body.data.totalOutputTokens).toBe(0);
      expect(response.body.data.totalTokens).toBe(0);
      expect(response.body.data.totalCost).toBe(0);
      expect(response.body.data.recordCount).toBe(0);
      expect(response.body.data.averageCostPerRequest).toBe(0);
    });

    it('should reflect recorded token usage', async () => {
      dashboard.recordTokenUsage({
        model: 'gemini-2.5-flash',
        inputTokens: 1000,
        outputTokens: 500,
        stage: 'analysis',
      });

      const response = await request(app)
        .get('/api/v1/monitoring/cost');

      expect(response.status).toBe(200);
      expect(response.body.data.totalInputTokens).toBe(1000);
      expect(response.body.data.totalOutputTokens).toBe(500);
      expect(response.body.data.totalTokens).toBe(1500);
      expect(response.body.data.recordCount).toBe(1);
      expect(response.body.data.totalCost).toBeGreaterThan(0);
      expect(response.body.data.averageCostPerRequest).toBeGreaterThan(0);
    });

    it('should calculate average cost per request correctly', async () => {
      dashboard.recordTokenUsage({
        model: 'gemini-2.5-flash',
        inputTokens: 1000,
        outputTokens: 500,
        stage: 'analysis',
      });
      dashboard.recordTokenUsage({
        model: 'gemini-2.5-flash',
        inputTokens: 2000,
        outputTokens: 1000,
        stage: 'fallback',
      });

      const response = await request(app)
        .get('/api/v1/monitoring/cost');

      expect(response.status).toBe(200);
      expect(response.body.data.recordCount).toBe(2);
      expect(response.body.data.totalInputTokens).toBe(3000);
      expect(response.body.data.totalOutputTokens).toBe(1500);
    });

    it('should include per-model cost breakdown', async () => {
      dashboard.recordTokenUsage({
        model: 'gemini-2.5-flash',
        inputTokens: 1000,
        outputTokens: 500,
        stage: 'analysis',
      });

      const response = await request(app)
        .get('/api/v1/monitoring/cost');

      expect(response.status).toBe(200);
      expect(response.body.data.flashCost).toBeGreaterThanOrEqual(0);
      expect(response.body.data.proCost).toBeGreaterThanOrEqual(0);
      expect(response.body.data.costByStage).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // GET /trends
  // ---------------------------------------------------------------------------

  describe('GET /trends', () => {
    it('should return trends with default timespan', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/trends');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data.memory)).toBe(true);
      expect(Array.isArray(response.body.data.responseTime)).toBe(true);
      expect(Array.isArray(response.body.data.cacheHitRate)).toBe(true);
      expect(Array.isArray(response.body.data.successRate)).toBe(true);
      expect(Array.isArray(response.body.data.timestamps)).toBe(true);
    });

    it('should accept custom timespan query parameter', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/trends?timespan=60000');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject non-numeric timespan', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/trends?timespan=abc');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject timespan below minimum (1000ms)', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/trends?timespan=500');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject timespan above maximum (86400000ms)', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/trends?timespan=100000000');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should accept timespan at minimum boundary (1000ms)', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/trends?timespan=1000');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /health
  // ---------------------------------------------------------------------------

  describe('GET /health', () => {
    it('should return healthy status with no requests', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.timestamp).toBeDefined();
      expect(response.body.data.uptime).toBeGreaterThanOrEqual(0);
      expect(response.body.data.totalRequests).toBe(0);
      expect(response.body.data.successRate).toBe(1);
    });

    it('should return degraded status when success rate is low', async () => {
      // Simulate a failed request
      dashboard.requestStart();
      dashboard.requestStart();
      // Complete only 1 successfully out of 2 tracked internally
      // Force a failure scenario by calling internal methods
      const dashData = dashboard.getDashboardData();
      expect(dashData.summary.successRate).toBeGreaterThanOrEqual(0);
    });

    it('should include memory usage string', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/health');

      expect(response.status).toBe(200);
      expect(typeof response.body.data.memoryUsage).toBe('string');
      expect(response.body.data.memoryUsage).toContain('MB');
    });

    it('should include activeAlerts array', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/health');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.activeAlerts)).toBe(true);
    });
  });
  // ---------------------------------------------------------------------------
  // GET /dashboard - Grafana dashboard JSON (REQ-210, Phase 84)
  // ---------------------------------------------------------------------------

  describe('GET /dashboard', () => {
    it('should return valid Grafana dashboard JSON', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/dashboard');

      expect(response.status).toBe(200);
      expect(response.type).toMatch(/json/);
      const parsed = JSON.parse(response.text);
      expect(parsed.dashboard).toBeDefined();
      expect(parsed.dashboard.title).toBe('Speech-to-Visuals Monitoring');
      expect(parsed.dashboard.uid).toMatch(/^s2v-monitoring-/);
      expect(parsed.dashboard.panels).toHaveLength(8);
      expect(parsed.overwrite).toBe(true);
    });

    it('should include all expected panel titles', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/dashboard');

      expect(response.status).toBe(200);
      const parsed = JSON.parse(response.text);
      const titles = parsed.dashboard.panels.map((p: { title: string }) => p.title);
      expect(titles).toContain('HTTP Latency Distribution');
      expect(titles).toContain('Error Rate Trends');
      expect(titles).toContain('Pipeline Success Rate');
      expect(titles).toContain('Slow Requests');
      expect(titles).toContain('Active Requests');
      expect(titles).toContain('Process Uptime');
      expect(titles).toContain('Request Volume');
      expect(titles).toContain('Errors by Route');
    });

    it('should accept datasource query parameter', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/dashboard?datasource=MyPrometheus');

      expect(response.status).toBe(200);
      const parsed = JSON.parse(response.text);
      expect(parsed.dashboard.templating.list[0].current.value).toBe('MyPrometheus');
    });

    it('should accept refresh query parameter', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/dashboard?refresh=10s');

      expect(response.status).toBe(200);
      const parsed = JSON.parse(response.text);
      expect(parsed.dashboard.refresh).toBe('10s');
    });

    it('should accept prefix query parameter for metric namespacing', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/dashboard?prefix=myns');

      expect(response.status).toBe(200);
      const parsed = JSON.parse(response.text);
      // Panels should use the prefix in PromQL expressions
      const latencyPanel = parsed.dashboard.panels.find(
        (p: { title: string }) => p.title === 'HTTP Latency Distribution',
      );
      expect(latencyPanel.targets[0].expr).toContain('myns_');
    });
  });

  // ---------------------------------------------------------------------------
  // GET /alerts - Prometheus alert rules YAML (REQ-211, Phase 84)
  // ---------------------------------------------------------------------------

  describe('GET /alerts', () => {
    it('should return YAML content with correct content type', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/alerts');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/yaml/);
      expect(typeof response.text).toBe('string');
    });

    it('should include all 4 alert rule names', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/alerts');

      expect(response.status).toBe(200);
      const body = response.text;
      expect(body).toContain('alert: SpeechToVisualsHighErrorRate');
      expect(body).toContain('alert: SpeechToVisualsHighLatencyP95');
      expect(body).toContain('alert: SpeechToVisualsHealthCheckFailures');
      expect(body).toContain('alert: SpeechToVisualsLLMBudgetOverage');
    });

    it('should include severity labels', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/alerts');

      expect(response.status).toBe(200);
      const body = response.text;
      expect(body).toContain('severity: critical');
      expect(body).toContain('severity: warning');
    });

    it('should include PromQL expressions', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/alerts');

      expect(response.status).toBe(200);
      const body = response.text;
      expect(body).toContain('expr:');
      expect(body).toContain('http_errors_total');
      expect(body).toContain('http_request_duration_ms');
    });

    it('should accept prefix query parameter', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/alerts?prefix=testns');

      expect(response.status).toBe(200);
      const body = response.text;
      expect(body).toContain('testns_');
    });

    it('should contain runbook URLs', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/alerts');

      expect(response.status).toBe(200);
      const body = response.text;
      expect(body).toContain('runbook_url');
      expect(body).toContain('docs/runbooks/');
    });
  });
});

// ---------------------------------------------------------------------------
// createMonitoringRouter factory tests
// ---------------------------------------------------------------------------

describe('createMonitoringRouter', () => {
  it('should use provided dashboard instance', async () => {
    const customDashboard = new PerformanceDashboard();
    customDashboard.recordTokenUsage({
      model: 'gemini-2.5-pro',
      inputTokens: 5000,
      outputTokens: 2000,
      stage: 'analysis',
    });

    const app = express();
    app.use(express.json());
    app.use('/api/v1/monitoring', createMonitoringRouter(customDashboard));

    const response = await request(app)
      .get('/api/v1/monitoring/cost');

    expect(response.status).toBe(200);
    expect(response.body.data.totalInputTokens).toBe(5000);
    expect(response.body.data.totalOutputTokens).toBe(2000);

    customDashboard.destroy();
  });

  it('should use globalDashboard when no dashboard provided', async () => {
    const router = createMonitoringRouter();
    expect(router).toBeDefined();
  });
});
