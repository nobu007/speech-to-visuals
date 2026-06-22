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

  // POST /metrics/reset — Reset all metrics (admin operation)
  router.post('/metrics/reset', (_req: Request, res: Response) => {
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
