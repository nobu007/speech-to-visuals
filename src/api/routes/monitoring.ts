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
import { logger } from '../../utils/logger';

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

const DashboardQuerySchema = z.object({
  datasource: z
    .string()
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid datasource name: use only alphanumeric, dash, underscore')
    .optional(),
  refresh: z
    .string()
    .regex(/^\d+[smh]$/, 'Invalid refresh interval (e.g. 30s, 5m, 1h)')
    .optional(),
  prefix: z
    .string()
    .max(50)
    .regex(/^[a-zA-Z0-9_]*$/, 'Invalid metric prefix: use only alphanumeric and underscore')
    .optional(),
});

const AlertsQuerySchema = z.object({
  prefix: z
    .string()
    .max(50)
    .regex(/^[a-zA-Z0-9_]*$/, 'Invalid metric prefix: use only alphanumeric and underscore')
    .optional(),
});

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  if (statusCode >= 500) {
    logger.error(`[MonitoringRoute] ${code}: ${message}`);
  }
  const body: Record<string, unknown> = { success: false, error: { code, message } };
  if (details !== undefined) {
    body.error = { ...((body.error as Record<string, unknown>)), details };
  }
  res.status(statusCode).json(body);
}

/**
 * Wrap an async handler with a timeout. On timeout, responds with 503.
 * The timeout value defaults to 10s and can be overridden via MONITORING_TIMEOUT_MS.
 */
const MONITORING_TIMEOUT_MS = (() => {
  const raw = process.env.MONITORING_TIMEOUT_MS;
  if (!raw) return 10_000;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 10_000;
})();

type AsyncRouteHandler = (req: Request, res: Response) => Promise<unknown>;

function withTimeout(
  handler: AsyncRouteHandler,
  timeoutMs: number = MONITORING_TIMEOUT_MS,
) {
  return (req: Request, res: Response): void => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      sendError(res, 503, 'TIMEOUT', `Request exceeded ${timeoutMs}ms timeout`);
    }, timeoutMs);

    handler(req, res)
      .catch((error) => {
        if (timedOut) return;
        logger.error('[monitoring] Route handler error:', error);
        sendError(
          res,
          500,
          'INTERNAL_ERROR',
          error instanceof Error ? error.message : 'Unexpected error',
        );
      })
      .finally(() => {
        clearTimeout(timer);
      });
  };
}

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

export function createMonitoringRouter(dashboard?: PerformanceDashboard): Router {
  const router = Router();
  const monitoring = dashboard ?? globalDashboard;

  // GET /metrics - Current dashboard data
  router.get('/metrics', withTimeout(async (_req: Request, res: Response) => {
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
  }));

  // GET /cost - LLM cost and token usage metrics
  router.get('/cost', withTimeout(async (_req: Request, res: Response) => {
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
  }));

  // GET /trends - Performance trends over time
  router.get('/trends', (req: Request, res: Response) => {
    const parsed = TrendsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const details = parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message, code: i.code }));
      const msg = details[0]?.message ?? 'Invalid timespan parameter';
      return sendError(res, 400, 'VALIDATION_ERROR', msg, details);
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
    const parsed = DashboardQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const details = parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message, code: i.code }));
      const msg = details[0]?.message ?? 'Invalid query parameters';
      return sendError(res, 400, 'VALIDATION_ERROR', msg, details);
    }

    try {
      const { datasource, refresh, prefix } = parsed.data;
      const options: DashboardGenerateOptions = {};
      if (datasource) options.datasource = datasource;
      if (refresh) options.refresh = refresh;
      if (prefix) options.metricPrefix = prefix;
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
    const parsed = AlertsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const details = parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message, code: i.code }));
      const msg = details[0]?.message ?? 'Invalid query parameters';
      return sendError(res, 400, 'VALIDATION_ERROR', msg, details);
    }

    try {
      const options: AlertRulesOptions = {};
      if (parsed.data.prefix) options.metricPrefix = parsed.data.prefix;
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
