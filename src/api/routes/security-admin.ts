/**
 * Phase 201: Export Guard Admin Dashboard API
 *
 * REST endpoints for security guard metrics management:
 * - GET  /metrics           - JSON snapshot of rejection metrics
 * - GET  /metrics/prometheus - Prometheus text exposition format
 * - POST /metrics/reset      - Reset all collected metrics (admin)
 * - GET  /threat-level       - Current threat assessment summary
 */

import { Router, Request, Response } from 'express';
import {
  securityMetricsCollector,
  type SecurityRejectionSnapshot,
} from '../../export/security-metrics-collector';
import { logger } from '../../utils/logger';

/**
 * Admin token for destructive operations (metrics reset).
 * Set via ADMIN_TOKEN env var. If not configured, reset is refused.
 */
function getAdminToken(): string | null {
  return process.env.ADMIN_TOKEN || null;
}

/**
 * Middleware that requires a valid admin token for destructive operations.
 * The token is checked against the ADMIN_TOKEN environment variable.
 * If ADMIN_TOKEN is not set, the endpoint is disabled (403).
 */
function requireAdminToken(req: Request, res: Response, next: () => void): void {
  const expectedToken = getAdminToken();
  if (!expectedToken) {
    logger.warn('[SecurityAdmin] /metrics/reset attempted without ADMIN_TOKEN configured');
    res.status(403).json({
      success: false,
      error: {
        code: 'ADMIN_NOT_CONFIGURED',
        message: 'Admin operations require ADMIN_TOKEN environment variable to be set',
      },
    });
    return;
  }

  const authHeader = req.headers['authorization'] || '';
  const providedToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : (req.headers['x-admin-token'] as string) || '';

  // Use timing-safe comparison to prevent token enumeration
  if (providedToken.length !== expectedToken.length) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid admin token' },
    });
    return;
  }

  let diff = 0;
  for (let i = 0; i < providedToken.length; i++) {
    diff |= providedToken.charCodeAt(i) ^ expectedToken.charCodeAt(i);
  }
  if (diff !== 0) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid admin token' },
    });
    return;
  }

  next();
}

export interface ThreatAssessment {
  level: 'clear' | 'elevated' | 'critical';
  totalRejections: number;
  highSeverityCount: number;
  topAttackPattern: string | null;
  activeLayers: number;
  assessedAt: string;
}

function assessThreat(snapshot: SecurityRejectionSnapshot): ThreatAssessment {
  const { totalRejections, bySeverity, byLayer, byPattern } = snapshot;
  const highSeverityCount = bySeverity.high ?? 0;
  const activeLayers = Object.values(byLayer).filter(c => c > 0).length;
  const topAttackPattern = byPattern.length > 0 ? byPattern[0].pattern : null;

  let level: ThreatAssessment['level'] = 'clear';
  if (totalRejections > 0) {
    if (highSeverityCount >= 10 || totalRejections >= 50) {
      level = 'critical';
    } else if (highSeverityCount > 0 || totalRejections >= 10) {
      level = 'elevated';
    }
  }

  return {
    level,
    totalRejections,
    highSeverityCount,
    topAttackPattern,
    activeLayers,
    assessedAt: new Date().toISOString(),
  };
}

export function createSecurityAdminRouter(): Router {
  const router = Router();

  // GET /metrics — JSON snapshot
  router.get('/metrics', (_req: Request, res: Response) => {
    const snapshot = securityMetricsCollector.getSnapshot();
    res.status(200).json({ success: true, metrics: snapshot });
  });

  // GET /metrics/prometheus — Prometheus text exposition format
  router.get('/metrics/prometheus', (_req: Request, res: Response) => {
    const text = securityMetricsCollector.toPrometheusText();
    res.status(200).set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8').send(text);
  });

  // POST /metrics/reset — Reset all metrics (admin operation, requires token)
  router.post('/metrics/reset', requireAdminToken, (_req: Request, res: Response) => {
    securityMetricsCollector.reset();
    const snapshot = securityMetricsCollector.getSnapshot();
    res.status(200).json({ success: true, message: 'Metrics reset complete', metrics: snapshot });
  });

  // GET /threat-level — Current threat assessment
  router.get('/threat-level', (_req: Request, res: Response) => {
    const snapshot = securityMetricsCollector.getSnapshot();
    const assessment = assessThreat(snapshot);
    res.status(200).json({ success: true, assessment });
  });

  return router;
}
