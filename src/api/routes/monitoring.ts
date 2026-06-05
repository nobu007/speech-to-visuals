/**
 * TASK-0146: Monitoring REST API Endpoints
 *
 * Exposes Phase 36 monitoring and cost data via REST API:
 * - GET /metrics  - Current dashboard metrics (PerformanceDashboard)
 * - GET /cost     - LLM cost metrics (token usage, budget)
 * - GET /trends   - Performance trends over configurable timespan
 * - GET /health   - Production health check (component status)
 * - GET /error-recovery - Error recovery telemetry (REQ-198, Phase 77)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  PerformanceDashboard,
  globalDashboard,
} from '../../monitoring/performance-dashboard';
import { getWarmupStatus } from '../startup-warmup';
import { recoveryTelemetryAggregator, type TelemetrySnapshot } from '../../quality/recovery-telemetry-aggregator';
import { httpMetricsCollector, type HttpMetricsSnapshot } from '../../monitoring/http-metrics-collector';
import { exportPrometheusMetrics, PROMETHEUS_CONTENT_TYPE } from '../../monitoring/prometheus-exporter';
import { exportDashboardJson, type DashboardGenerateOptions } from '../../monitoring/grafana-dashboard-model';
import { exportAlertRulesYaml, type AlertRulesOptions } from '../../monitoring/alert-rules';

// ---------------------------------------------------------------------------
// Zod validation schemas
// ---------------------------------------------------------------------------

const TrendsQuerySchema = z.object({
  timespan: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : 300000))
    .pipe(z.number().int().min(1000).max(86400000)),
});

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

function sendError(res: Response, statusCode: number, code: string, message: string): void {
  res.status(statusCode).json({ success: false, error: { code, message } });
}

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

export function createMonitoringRouter(dashboard?: PerformanceDashboard): Router {
  const router = Router();
  const monitoring = dashboard ?? globalDashboard;

  // GET /metrics - Current dashboard data
  router.get('/metrics', (_req: Request, res: Response) => {
    try {
      const data = monitoring.getDashboardData();
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return sendError(
        res,
        500,
        'METRICS_ERROR',
        error instanceof Error ? error.message : 'Failed to retrieve metrics',
      );
    }
  });

  // GET /cost - LLM cost and token usage metrics
  router.get('/cost', (_req: Request, res: Response) => {
    try {
      const data = monitoring.getCostMetrics();
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return sendError(
        res,
        500,
        'COST_ERROR',
        error instanceof Error ? error.message : 'Failed to retrieve cost metrics',
      );
    }
  });

  // GET /trends - Performance trends over time
  router.get('/trends', (req: Request, res: Response) => {
    const parsed = TrendsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid timespan parameter';
      return sendError(res, 400, 'VALIDATION_ERROR', msg);
    }

    try {
      const data = monitoring.getPerformanceTrends(parsed.data.timespan);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return sendError(
        res,
        500,
        'TRENDS_ERROR',
        error instanceof Error ? error.message : 'Failed to retrieve trends',
      );
    }
  });

  // GET /health - Production health check via PerformanceDashboard summary
  router.get('/health', (_req: Request, res: Response) => {
    try {
      const dashData = monitoring.getDashboardData();
      const health = {
        status: dashData.summary.successRate >= 0.95 ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: dashData.summary.uptime,
        totalRequests: dashData.summary.totalRequests,
        successRate: dashData.summary.successRate,
        avgResponseTime: dashData.summary.avgResponseTime,
        memoryUsage: dashData.summary.memoryUsage,
        cacheHitRate: dashData.summary.cacheHitRate,
        cacheWarmup: getWarmupStatus(),
        activeAlerts: dashData.activeAlerts,
      };
      return res.status(200).json({ success: true, data: health });
    } catch (error) {
      return sendError(
        res,
        500,
        'HEALTH_ERROR',
        error instanceof Error ? error.message : 'Failed to perform health check',
      );
    }
  });

  // GET /error-recovery - Error recovery telemetry (REQ-198)
  router.get('/error-recovery', (_req: Request, res: Response) => {
    try {
      const telemetry: TelemetrySnapshot = recoveryTelemetryAggregator.getSnapshot();
      return res.status(200).json({ success: true, data: telemetry });
    } catch (error) {
      return sendError(
        res,
        500,
        'ERROR_RECOVERY_TELEMETRY_ERROR',
        error instanceof Error ? error.message : 'Failed to retrieve error recovery telemetry',
      );
    }
  });

  // GET /http-metrics - Per-route HTTP request metrics (REQ-205)
  router.get('/http-metrics', (_req: Request, res: Response) => {
    try {
      const data: HttpMetricsSnapshot = httpMetricsCollector.getSnapshot();
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return sendError(
        res,
        500,
        'HTTP_METRICS_ERROR',
        error instanceof Error ? error.message : 'Failed to retrieve HTTP metrics',
      );
    }
  });

  // GET /prometheus - Prometheus exposition format metrics (REQ-206)
  router.get('/prometheus', (_req: Request, res: Response) => {
    try {
      const body = exportPrometheusMetrics();
      res.setHeader('Content-Type', PROMETHEUS_CONTENT_TYPE);
      return res.status(200).send(body);
    } catch (error) {
      return sendError(
        res,
        500,
        'PROMETHEUS_ERROR',
        error instanceof Error ? error.message : 'Failed to export Prometheus metrics',
      );
    }
  });

  // GET /dashboard - Grafana dashboard JSON config (REQ-210, Phase 84)
  router.get('/dashboard', (req: Request, res: Response) => {
    try {
      const options: DashboardGenerateOptions = {};
      if (typeof req.query.datasource === 'string') {
        options.datasource = req.query.datasource;
      }
      if (typeof req.query.refresh === 'string') {
        options.refresh = req.query.refresh;
      }
      if (typeof req.query.prefix === 'string') {
        options.metricPrefix = req.query.prefix;
      }
      const body = exportDashboardJson(options);
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(body);
    } catch (error) {
      return sendError(
        res,
        500,
        'DASHBOARD_ERROR',
        error instanceof Error ? error.message : 'Failed to export Grafana dashboard',
      );
    }
  });

  // GET /alerts - Prometheus alert rules YAML (REQ-211, Phase 84)
  router.get('/alerts', (req: Request, res: Response) => {
    try {
      const options: AlertRulesOptions = {};
      if (typeof req.query.prefix === 'string') {
        options.metricPrefix = req.query.prefix;
      }
      const body = exportAlertRulesYaml(options);
      res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
      return res.status(200).send(body);
    } catch (error) {
      return sendError(
        res,
        500,
        'ALERTS_ERROR',
        error instanceof Error ? error.message : 'Failed to export alert rules',
      );
    }
  });

  return router;
}
