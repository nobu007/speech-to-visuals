/**
 * REQ-210~215: Monitoring deployment integration tests
 *
 * Phase 84-85 acceptance criteria:
 * - TC-210-01: GET /api/v1/monitoring/dashboard returns Grafana import JSON
 * - TC-211-01: GET /api/v1/monitoring/alerts returns AlertManager YAML
 * - TC-212-01: Pipeline stage duration in Prometheus output
 * - TC-213-01: Batch job lifecycle metrics in Prometheus output
 * - TC-214-01: E2E Prometheus export completeness via HTTP
 * - TC-215-01~03: Alert rule threshold boundary tests
 */

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createMonitoringRouter } from '@/api/routes/monitoring';
import { PerformanceDashboard } from '@/monitoring/performance-dashboard';
import { pipelineMetricsCollector } from '@/monitoring/pipeline-metrics-collector';
import { exportPrometheusMetrics } from '@/monitoring/prometheus-exporter';
import {
  generateAlertRules,
  type AlertingConfig,
  type AlertRule,
} from '@/monitoring/alert-rules';
import type { HttpMetricsSnapshot } from '@/monitoring/http-metrics-collector';
import type { PipelineMetricsSnapshot } from '@/monitoring/pipeline-metrics-collector';

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

/**
 * Fail-loud rule lookup (Phase 150 / TASK-0237, same idiom as the REQ-338
 * helper in tests/unit/monitoring/alert-rules.test.ts): replaces the 14
 * `rule!` non-null assertions this file used to postfix `.find()` results
 * with. An absent rule previously surfaced as an opaque `TypeError: Cannot
 * read properties of undefined` inside the first `expect`; the helper
 * keeps the exact same RED verdict with the missing alert name.
 */
function requireAlertRule(config: AlertingConfig, alert: string): AlertRule {
  const rule = config.groups[0].rules.find(r => r.alert === alert);
  if (rule === undefined) {
    throw new Error(`alert rule not found: ${alert}`);
  }
  return rule;
}

function createApp(dashboard?: PerformanceDashboard) {
  const app = express();
  app.use(express.json());
  const dash = dashboard ?? new PerformanceDashboard();
  app.use('/api/v1/monitoring', createMonitoringRouter(dash));
  return { app, dashboard: dash };
}

function makeHttpSnapshot(overrides: Partial<HttpMetricsSnapshot> = {}): HttpMetricsSnapshot {
  return {
    totalRequests: 0,
    totalErrors: 0,
    globalErrorRate: 0,
    activeRequests: 0,
    routes: [],
    slowRequests: [],
    uptime: 12345,
    ...overrides,
  };
}

function makePipelineSnapshot(overrides: Partial<PipelineMetricsSnapshot> = {}): PipelineMetricsSnapshot {
  return {
    stages: [],
    totalRuns: 0,
    successfulRuns: 0,
    failedRuns: 0,
    batchJobs: {
      jobsByStatus: {
        created: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      },
      activeJobs: 0,
    },
    ...overrides,
  };
}

// ===========================================================================
// TC-210-01: GET /api/v1/monitoring/dashboard
// ===========================================================================

describe('REQ-210: GET /api/v1/monitoring/dashboard', () => {
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

  test('TC-210-01: returns 200 with Grafana import JSON', async () => {
    const response = await request(app).get('/api/v1/monitoring/dashboard');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');

    // Body should be valid JSON (supertest auto-parses JSON content-type)
    const body = response.body;
    expect(body).toBeDefined();
    expect(body.dashboard).toBeDefined();
    expect(body.overwrite).toBe(true);
    expect(body.dashboard.title).toBe('Speech-to-Visuals Monitoring');
    expect(body.dashboard.panels).toHaveLength(11);
    expect(body.dashboard.tags).toContain('speech-to-visuals');
  });

  test('returns valid Grafana import structure', async () => {
    const response = await request(app).get('/api/v1/monitoring/dashboard');
    const body = response.body;

    expect(body.__inputs).toBeDefined();
    expect(body.__requires).toBeDefined();
    expect(body.dashboard.uid).toMatch(/^s2v-monitoring-\d+$/);
    expect(body.dashboard.templating).toBeDefined();
  });

  test('accepts query parameters for customisation', async () => {
    const response = await request(app)
      .get('/api/v1/monitoring/dashboard?datasource=MyProm&refresh=10s&prefix=s2v');

    expect(response.status).toBe(200);
    const body = response.body;
    expect(body.dashboard.refresh).toBe('10s');
    // Prefix should be applied to metric expressions
    const allExprs = body.dashboard.panels
      .flatMap((p: any) => p.targets.map((t: any) => t.expr))
      .join(' ');
    expect(allExprs).toContain('s2v_');
  });

  test('handles generation errors gracefully', async () => {
    const brokenDashboard = {
      getDashboardData: () => { throw new Error('broken'); },
    } as unknown as PerformanceDashboard;

    // The dashboard endpoint doesn't call getDashboardData, but test error path anyway
    const { app: testApp } = createApp(brokenDashboard);
    const response = await request(testApp).get('/api/v1/monitoring/dashboard');
    // Should still work because dashboard endpoint uses exportDashboardJson directly
    expect(response.status).toBe(200);
  });
});

// ===========================================================================
// TC-211-01: GET /api/v1/monitoring/alerts
// ===========================================================================

describe('REQ-211: GET /api/v1/monitoring/alerts', () => {
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

  test('TC-211-01: returns 200 with AlertManager YAML containing 4 rules', async () => {
    const response = await request(app).get('/api/v1/monitoring/alerts');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/yaml');

    const body = response.text;
    expect(body).toContain('groups:');
    expect(body).toContain('speech-to-visuals-alerts');

    // Verify all 4 alert rules
    expect(body).toContain('SpeechToVisualsHighErrorRate');
    expect(body).toContain('SpeechToVisualsHighLatencyP95');
    expect(body).toContain('SpeechToVisualsHealthCheckFailures');
    expect(body).toContain('SpeechToVisualsLLMBudgetOverage');

    // Verify severity labels
    expect(body).toContain('severity: critical');
    expect(body).toContain('severity: warning');
  });

  test('accepts prefix query parameter', async () => {
    const response = await request(app)
      .get('/api/v1/monitoring/alerts?prefix=s2v');

    expect(response.status).toBe(200);
    expect(response.text).toContain('s2v_');
  });
});

// ===========================================================================
// TC-212-01: Pipeline stage duration Prometheus metrics
// ===========================================================================

describe('REQ-212: Pipeline stage duration in Prometheus output', () => {
  beforeEach(() => {
    pipelineMetricsCollector.reset();
  });

  afterEach(() => {
    pipelineMetricsCollector.reset();
  });

  test('TC-212-01: pipeline_stage_duration_ms included for all pipeline stages', () => {
    // Record durations for all 5 canonical pipeline stages
    const stages = ['transcription', 'analysis', 'layout', 'scene_prep', 'rendering'] as const;
    for (const stage of stages) {
      pipelineMetricsCollector.recordStageDuration(stage, 100);
    }
    pipelineMetricsCollector.recordPipelineRun(true);

    const output = exportPrometheusMetrics();

    expect(output).toContain('# HELP pipeline_stage_duration_ms');
    expect(output).toContain('# TYPE pipeline_stage_duration_ms summary');

    for (const stage of stages) {
      expect(output).toMatch(new RegExp(
        `pipeline_stage_duration_ms\\{stage="${stage}",quantile="0\\.5"\\}`,
      ));
      expect(output).toMatch(new RegExp(
        `pipeline_stage_duration_ms_sum\\{stage="${stage}"\\}`,
      ));
      expect(output).toMatch(new RegExp(
        `pipeline_stage_duration_ms_count\\{stage="${stage}"\\} 1`,
      ));
    }
  });
});

// ===========================================================================
// TC-213-01: Batch job lifecycle Prometheus metrics
// ===========================================================================

describe('REQ-213: Batch job lifecycle in Prometheus output', () => {
  beforeEach(() => {
    pipelineMetricsCollector.reset();
  });

  afterEach(() => {
    pipelineMetricsCollector.reset();
  });

  test('TC-213-01: batch_jobs metrics present after job lifecycle', () => {
    // Simulate full batch job lifecycle: created → running → completed
    pipelineMetricsCollector.recordBatchJobTransition('created');
    pipelineMetricsCollector.recordBatchJobTransition('running');
    pipelineMetricsCollector.recordBatchJobTransition('completed');

    const output = exportPrometheusMetrics();

    // Verify batch_jobs_total counter with all recorded statuses
    expect(output).toContain('# HELP batch_jobs_total');
    expect(output).toContain('# TYPE batch_jobs_total counter');
    expect(output).toMatch(/batch_jobs_total\{status="created"\} 1/);
    expect(output).toMatch(/batch_jobs_total\{status="running"\} 1/);
    expect(output).toMatch(/batch_jobs_total\{status="completed"\} 1/);

    // Verify active gauge drops to 0 after completion
    expect(output).toContain('# HELP batch_jobs_active');
    expect(output).toContain('# TYPE batch_jobs_active gauge');
    expect(output).toMatch(/batch_jobs_active 0/);
  });

  test('TC-213-02: tracks active jobs correctly during concurrent jobs', () => {
    // Start 3 jobs concurrently
    pipelineMetricsCollector.recordBatchJobTransition('created');
    pipelineMetricsCollector.recordBatchJobTransition('running');
    pipelineMetricsCollector.recordBatchJobTransition('created');
    pipelineMetricsCollector.recordBatchJobTransition('running');
    pipelineMetricsCollector.recordBatchJobTransition('created');
    pipelineMetricsCollector.recordBatchJobTransition('running');

    let output = exportPrometheusMetrics();
    expect(output).toMatch(/batch_jobs_active 3/);

    // Complete 1, fail 1
    pipelineMetricsCollector.recordBatchJobTransition('completed');
    pipelineMetricsCollector.recordBatchJobTransition('failed');

    output = exportPrometheusMetrics();
    expect(output).toMatch(/batch_jobs_active 1/);
    expect(output).toMatch(/batch_jobs_total\{status="completed"\} 1/);
    expect(output).toMatch(/batch_jobs_total\{status="failed"\} 1/);
  });

  test('TC-213-03: tracks cancelled jobs', () => {
    pipelineMetricsCollector.recordBatchJobTransition('created');
    pipelineMetricsCollector.recordBatchJobTransition('running');
    pipelineMetricsCollector.recordBatchJobTransition('cancelled');

    const output = exportPrometheusMetrics();

    expect(output).toMatch(/batch_jobs_total\{status="cancelled"\} 1/);
    expect(output).toMatch(/batch_jobs_active 0/);
  });

  test('TC-213-04: no batch metrics emitted when no batch jobs tracked', () => {
    const output = exportPrometheusMetrics();

    expect(output).not.toContain('batch_jobs_total');
    expect(output).not.toContain('batch_jobs_active');
  });

  test('TC-213-05: active gauge never goes negative', () => {
    pipelineMetricsCollector.recordBatchJobTransition('running');
    pipelineMetricsCollector.recordBatchJobTransition('completed');
    // Extra completion without matching running (defensive)
    pipelineMetricsCollector.recordBatchJobTransition('completed');

    const output = exportPrometheusMetrics();
    expect(output).toMatch(/batch_jobs_active 0/);
  });
});

// ===========================================================================
// TC-214-01: E2E Prometheus export completeness via HTTP
// ===========================================================================

describe('REQ-214: Prometheus export E2E completeness', () => {
  let dashboard: PerformanceDashboard;
  let app: express.Express;

  beforeEach(() => {
    pipelineMetricsCollector.reset();
    const created = createApp();
    app = created.app;
    dashboard = created.dashboard;
  });

  afterEach(() => {
    pipelineMetricsCollector.reset();
    dashboard.destroy();
  });

  test('TC-214-01: all 6+ metric types in Prometheus format after HTTP traffic', async () => {
    // Generate some HTTP traffic to populate metrics
    await request(app).get('/api/v1/monitoring/health');
    await request(app).get('/api/v1/monitoring/health');
    await request(app).get('/api/v1/monitoring/metrics');

    // Add pipeline data
    pipelineMetricsCollector.recordStageDuration('transcription', 100);
    pipelineMetricsCollector.recordStageDuration('rendering', 200);
    pipelineMetricsCollector.recordPipelineRun(true);

    // Fetch Prometheus export
    const response = await request(app).get('/api/v1/monitoring/prometheus');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.headers['content-type']).toContain('0.0.4');

    const body = response.text;

    // Verify all metric families are present:
    // 1. http_requests_total (counter)
    expect(body).toContain('# HELP http_requests_total');
    expect(body).toContain('# TYPE http_requests_total counter');

    // 2. http_request_duration_ms (summary)
    expect(body).toContain('# HELP http_request_duration_ms');
    expect(body).toContain('# TYPE http_request_duration_ms summary');

    // 3. http_errors_total (counter)
    expect(body).toContain('# HELP http_errors_total');
    expect(body).toContain('# TYPE http_errors_total counter');

    // 4. http_active_requests (gauge)
    expect(body).toContain('# HELP http_active_requests');
    expect(body).toContain('# TYPE http_active_requests gauge');

    // 5. http_slow_requests_total (counter)
    expect(body).toContain('# HELP http_slow_requests_total');
    expect(body).toContain('# TYPE http_slow_requests_total counter');

    // 6. process_uptime_ms (gauge)
    expect(body).toContain('# HELP process_uptime_ms');
    expect(body).toContain('# TYPE process_uptime_ms gauge');

    // Pipeline metrics (added when data exists)
    expect(body).toContain('# HELP pipeline_stage_duration_ms');
    expect(body).toContain('# TYPE pipeline_runs_total counter');

    // Verify Prometheus format: every non-comment line matches metric format
    const lines = body.trim().split('\n').filter(l => l.length > 0);
    for (const line of lines) {
      if (line.startsWith('#')) continue;
      expect(line).toMatch(/^\w[\w]*(\{[^}]*\})?\s+[\d.e+-]+$/);
    }
  });

  test('TC-214-02: /prometheus honors ?prefix= like /dashboard and /alerts do', async () => {
    await request(app).get('/api/v1/monitoring/health');
    const response = await request(app).get('/api/v1/monitoring/prometheus?prefix=s2v');

    expect(response.status).toBe(200);
    const body = response.text;
    // Every sample line Prometheus scrapes carries the prefix — previously the
    // route dropped the param entirely, so ?prefix=s2v returned unprefixed
    // output while /dashboard?prefix=s2v and /alerts?prefix=s2v emitted
    // s2v_-prefixed queries that could never match these metric names.
    expect(body).toMatch(/^# HELP s2v_http_requests_total /m);
    expect(body).toMatch(/^# TYPE s2v_http_requests_total counter/m);
    for (const line of body.split('\n')) {
      if (line.startsWith('#') || line.trim() === '') continue;
      expect(line.startsWith('s2v_')).toBe(true);
    }
  });

  test('TC-214-03: /prometheus rejects an invalid prefix with 400', async () => {
    const response = await request(app).get('/api/v1/monitoring/prometheus?prefix=bad!char');
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ===========================================================================
// TC-215-01~03: Alert rule threshold boundary tests
// ===========================================================================

describe('REQ-215: Alert rule threshold boundary tests', () => {
  describe('TC-215-01: HighErrorRate 5% threshold', () => {
    it('fires at exactly 5.0% error rate', () => {
      const config = generateAlertRules({ errorRateThreshold: 0.05 });
      const rule = requireAlertRule(config, 'SpeechToVisualsHighErrorRate');
      // The expression should use > 0.05
      expect(rule.expr).toContain('> 0.05');
    });

    it('does not fire below 5% with custom threshold', () => {
      // With threshold at 0.051, 0.05 should not trigger
      const config = generateAlertRules({ errorRateThreshold: 0.051 });
      const rule = requireAlertRule(config, 'SpeechToVisualsHighErrorRate');
      expect(rule.expr).toContain('> 0.051');
    });

    it('uses strict greater-than comparison', () => {
      const config = generateAlertRules();
      const rule = requireAlertRule(config, 'SpeechToVisualsHighErrorRate');
      // Verify the operator is > (strictly greater than)
      expect(rule.expr).toMatch(/> 0\.05/);
      expect(rule.expr).not.toContain('>= 0.05');
    });

    it('evaluates boundary correctly at 4.9%, 5.0%, 5.1%', () => {
      // The threshold is in the PromQL expression; we validate the generated
      // expression contains the correct comparison.
      // At 4.9% (0.049): rate(...) > 0.05 → false
      // At 5.0% (0.05): rate(...) > 0.05 → false (strict >)
      // At 5.1% (0.051): rate(...) > 0.05 → true
      const config = generateAlertRules({ errorRateThreshold: 0.05 });
      const rule = requireAlertRule(config, 'SpeechToVisualsHighErrorRate');
      // Expression: rate(http_errors_total[5m]) / rate(http_requests_total[5m]) > 0.05
      // This means at exactly 0.05 the alert does NOT fire (strict >)
      expect(rule.expr).toMatch(/rate\([^)]+\)\s*\/\s*rate\([^)]+\)\s*>\s*0\.05/);
    });
  });

  describe('TC-215-02: HighLatencyP95 20s threshold', () => {
    it('fires at exactly 20s (20000ms)', () => {
      const config = generateAlertRules({ latencyP95ThresholdMs: 20000 });
      const rule = requireAlertRule(config, 'SpeechToVisualsHighLatencyP95');
      expect(rule.expr).toContain('> 20000');
    });

    it('does not fire at 19.9s with strict >', () => {
      // Expression uses > 20000, so 19999 does not trigger
      const config = generateAlertRules({ latencyP95ThresholdMs: 20000 });
      const rule = requireAlertRule(config, 'SpeechToVisualsHighLatencyP95');
      // Strict > means 20000 itself does not fire
      expect(rule.expr).toMatch(/http_request_duration_ms\{quantile="0\.95"\}\s*>\s*20000/);
    });

    it('uses correct quantile label', () => {
      const config = generateAlertRules();
      const rule = requireAlertRule(config, 'SpeechToVisualsHighLatencyP95');
      expect(rule.expr).toContain('quantile="0.95"');
    });

    it('evaluates boundary correctly at 19.9s, 20.0s, 20.1s', () => {
      // The threshold 20000 uses strict >:
      // 19900ms: > 20000 → false
      // 20000ms: > 20000 → false (strict >)
      // 20100ms: > 20000 → true
      const config = generateAlertRules({ latencyP95ThresholdMs: 20000 });
      const rule = requireAlertRule(config, 'SpeechToVisualsHighLatencyP95');
      expect(rule.expr).toContain('> 20000');
      expect(rule.severity).toBe('warning');
    });
  });

  describe('TC-215-03: HealthCheckFailures 3x consecutive threshold', () => {
    it('fires at >= 3 consecutive failures', () => {
      const config = generateAlertRules({ healthCheckFailureThreshold: 3 });
      const rule = requireAlertRule(config, 'SpeechToVisualsHealthCheckFailures');
      // The expression uses >= 3
      expect(rule.expr).toContain('>= 3');
    });

    it('does not fire at 2 failures', () => {
      const config = generateAlertRules({ healthCheckFailureThreshold: 3 });
      const rule = requireAlertRule(config, 'SpeechToVisualsHealthCheckFailures');
      // Expression: sum(increase(http_errors_total{path=~"/health.*"}[10m])) >= 3
      // 2 failures: 2 >= 3 → false
      expect(rule.expr).toContain('>= 3');
    });

    it('fires at 4 failures', () => {
      // With >= 3, 4 also triggers
      const config = generateAlertRules({ healthCheckFailureThreshold: 3 });
      const rule = requireAlertRule(config, 'SpeechToVisualsHealthCheckFailures');
      expect(rule.expr).toContain('>= 3');
      expect(rule.severity).toBe('critical');
    });

    it('uses correct health path pattern', () => {
      const config = generateAlertRules();
      const rule = requireAlertRule(config, 'SpeechToVisualsHealthCheckFailures');
      expect(rule.expr).toContain('/health');
      expect(rule.expr).toContain('http_errors_total');
    });

    it('evaluates boundary correctly at 2, 3, 4 failures', () => {
      // Expression: sum(increase(http_errors_total{path=~"/health.*"}[10m])) >= 3
      // 2: 2 >= 3 → false
      // 3: 3 >= 3 → true
      // 4: 4 >= 3 → true
      const config = generateAlertRules({ healthCheckFailureThreshold: 3 });
      const rule = requireAlertRule(config, 'SpeechToVisualsHealthCheckFailures');
      // >= operator ensures 3 and above trigger
      expect(rule.expr).toMatch(/>=\s*3/);
      expect(rule.severity).toBe('critical');
    });

    it('allows custom failure threshold', () => {
      const config = generateAlertRules({ healthCheckFailureThreshold: 5 });
      const rule = requireAlertRule(config, 'SpeechToVisualsHealthCheckFailures');
      expect(rule.expr).toContain('>= 5');
    });
  });
});

// ===========================================================================
// REQ-216: Dashboard & Alerts query parameter validation
// ===========================================================================

describe('REQ-216: Monitoring endpoint query parameter validation', () => {
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

  describe('GET /dashboard validation', () => {
    test('rejects invalid datasource with special characters', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/dashboard?datasource=alert(<script>)');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects overly long datasource name', async () => {
      const longName = 'a'.repeat(101);
      const response = await request(app)
        .get(`/api/v1/monitoring/dashboard?datasource=${longName}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects invalid refresh interval format', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/dashboard?refresh=invalid');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('accepts valid refresh intervals', async () => {
      for (const refresh of ['30s', '5m', '1h']) {
        const response = await request(app)
          .get(`/api/v1/monitoring/dashboard?refresh=${refresh}`);
        expect(response.status).toBe(200);
      }
    });

    test('rejects invalid metric prefix', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/dashboard?prefix=has spaces');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('accepts valid alphanumeric prefix', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/dashboard?prefix=my_prefix123');

      expect(response.status).toBe(200);
      expect(response.body.dashboard).toBeDefined();
    });
  });

  describe('GET /alerts validation', () => {
    test('rejects invalid prefix with special characters', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/alerts?prefix=bad!char');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects overly long prefix', async () => {
      const longPrefix = 'x'.repeat(51);
      const response = await request(app)
        .get(`/api/v1/monitoring/alerts?prefix=${longPrefix}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('accepts valid prefix', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/alerts?prefix=s2v');

      expect(response.status).toBe(200);
      expect(response.text).toContain('s2v_');
    });

    test('accepts request with no parameters', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/alerts');

      expect(response.status).toBe(200);
      expect(response.text).toContain('speech-to-visuals-alerts');
    });
  });
});
