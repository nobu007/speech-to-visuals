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

  return router;
}
