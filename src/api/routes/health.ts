import { Router, type Request, type Response } from 'express';
import { healthCheckService } from '../../monitoring/health-check-service';
import { logger } from '../../utils/logger';

export const healthRouter = Router();

const HTTP_STATUS: Record<string, number> = {
  healthy: 200,
  degraded: 200,
  unhealthy: 503,
};

/**
 * GET /health — full component-level health check
 */
healthRouter.get('/health', async (_req: Request, res: Response) => {
  try {
    const result = await healthCheckService.performHealthCheck();
    const httpStatus = HTTP_STATUS[result.status] ?? 503;
    res.status(httpStatus).json({
      success: result.status !== 'unhealthy',
      data: {
        status: result.status,
        uptime: result.uptime,
        checks: result.checks,
        recommendations: result.recommendations,
        timestamp: new Date(result.timestamp).toISOString(),
      },
    });
  } catch (error) {
    logger.error('[health] Health check failed:', error);
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Health check failed',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /health/live — Kubernetes-style liveness probe
 * Returns 200 if the process is responsive, 503 otherwise.
 */
healthRouter.get('/health/live', async (_req: Request, res: Response) => {
  const probe = await healthCheckService.checkLiveness();
  res.status(probe.alive ? 200 : 503).json({
    success: probe.alive,
    data: { alive: probe.alive, reason: probe.reason },
  });
});

/**
 * GET /health/ready — Kubernetes-style readiness probe
 * Returns 200 if the system can accept traffic, 503 otherwise.
 */
healthRouter.get('/health/ready', async (_req: Request, res: Response) => {
  const probe = await healthCheckService.checkReadiness();
  res.status(probe.ready ? 200 : 503).json({
    success: probe.ready,
    data: { ready: probe.ready, reason: probe.reason },
  });
});
