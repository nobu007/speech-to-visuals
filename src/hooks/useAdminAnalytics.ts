/**
 * useAdminAnalytics — React hook for unified admin monitoring dashboard.
 *
 * Polls HealthCheckService, ProductionMonitor, and RealTimePerformanceMonitor
 * at a configurable interval and exposes reactive state for dashboard rendering.
 * Displays scheduling metadata (nextDueAt, lastResult) alongside metrics.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  healthCheckService,
  type HealthCheckResult,
} from '@/monitoring/health-check-service';
import {
  getProductionMonitor,
  type ProductionMetrics,
  type HealthCheckResult as ProdHealthResult,
} from '@/monitoring/production-monitor';
import {
  realTimeMonitor,
  type PerformanceSnapshot,
} from '@/monitoring/real-time-performance-monitor';
import {
  continuousLearner,
  type LearningStatus,
} from '@/framework/continuous-learner';

export interface UseAdminAnalyticsOptions {
  /** Polling interval in milliseconds (default: 10000) */
  intervalMs?: number;
  /** Auto-start polling (default: true) */
  autoStart?: boolean;
}

export interface AdminAnalyticsSnapshot {
  /** Last health check result from HealthCheckService */
  healthCheck: HealthCheckResult | null;
  /** Estimated next health-check time (ms epoch) */
  nextDueAt: number | null;
  /** Last health-check timestamp (ms epoch) */
  lastCheckedAt: number | null;
  /** Production monitor metrics */
  productionMetrics: ProductionMetrics | null;
  /** Production monitor health check (includes alerts & recommendations) */
  productionHealth: ProdHealthResult | null;
  /** Real-time performance snapshot */
  performanceSnapshot: PerformanceSnapshot | null;
  /** Performance trend analysis */
  trends: Array<{ metric: string; trend: string; changePercent: number }>;
  /** System uptime in ms */
  uptime: number;
  /** ContinuousLearner scheduling status */
  learningStatus: LearningStatus;
  /** Learning report summary */
  learningReport: {
    totalDataPoints: number;
    detectedPatterns: number;
    optimizationStrategies: number;
    systemInsights: number;
    recentOptimizations: string[];
    learningVelocity: number;
  };
  /** Detected learning patterns for display */
  detectedPatterns: Array<{
    pattern: string;
    confidence: number;
    improvementSuggestion: string;
    expectedGain: number;
    validationCount: number;
  }>;
  /** System insights for display */
  systemInsights: Array<{
    type: string;
    description: string;
    confidence: number;
    actionable: boolean;
    recommendation: string;
  }>;
}

export interface UseAdminAnalyticsReturn {
  /** Current analytics snapshot */
  snapshot: AdminAnalyticsSnapshot;
  /** True while polling is active */
  isPolling: boolean;
  /** Manually fetch latest snapshot */
  refresh: () => void;
  /** Start polling */
  start: () => void;
  /** Stop polling */
  stop: () => void;
}

const HEALTH_CHECK_INTERVAL_MS = 10_000; // matches HealthCheckService internal interval

function collectSnapshot(): AdminAnalyticsSnapshot {
  const healthCheck = healthCheckService.getCachedHealth();
  const lastCheckedAt = healthCheck?.timestamp ?? null;
  const nextDueAt = lastCheckedAt !== null
    ? lastCheckedAt + HEALTH_CHECK_INTERVAL_MS
    : null;

  const productionMonitor = getProductionMonitor();
  const productionMetrics = productionMonitor.getMetrics();
  const productionHealth = productionMonitor.performHealthCheck();

  let performanceSnapshot: PerformanceSnapshot | null = null;
  let trends: Array<{ metric: string; trend: string; changePercent: number }> = [];
  try {
    performanceSnapshot = realTimeMonitor.getSnapshot();
    trends = realTimeMonitor.analyzeTrends();
  } catch {
    // Monitor may not be available in all environments
  }

  const learningStatus = continuousLearner.getLearningStatus();
  const learningReport = continuousLearner.getLearningReport();
  const detectedPatterns = continuousLearner.getDetectedPatterns().map(p => ({
    pattern: p.pattern,
    confidence: p.confidence,
    improvementSuggestion: p.improvementSuggestion,
    expectedGain: p.expectedGain,
    validationCount: p.validationCount,
  }));
  const systemInsights = continuousLearner.getSystemInsights().map(i => ({
    type: i.type,
    description: i.description,
    confidence: i.confidence,
    actionable: i.actionable,
    recommendation: i.recommendation,
  }));

  return {
    healthCheck,
    nextDueAt,
    lastCheckedAt,
    productionMetrics,
    productionHealth,
    performanceSnapshot,
    trends,
    uptime: healthCheckService.getUptime(),
    learningStatus,
    learningReport,
    detectedPatterns,
    systemInsights,
  };
}

const EMPTY_SNAPSHOT: AdminAnalyticsSnapshot = {
  healthCheck: null,
  nextDueAt: null,
  lastCheckedAt: null,
  productionMetrics: null,
  productionHealth: null,
  performanceSnapshot: null,
  trends: [],
  uptime: 0,
  learningStatus: {
    isRunning: false,
    iteration: 0,
    intervalMs: 60_000,
    nextAnalysisAt: null,
    lastAnalysisAt: null,
    lastAnalysisSuccess: false,
  },
  learningReport: {
    totalDataPoints: 0,
    detectedPatterns: 0,
    optimizationStrategies: 0,
    systemInsights: 0,
    recentOptimizations: [],
    learningVelocity: 0,
  },
  detectedPatterns: [],
  systemInsights: [],
};

export function useAdminAnalytics(
  options: UseAdminAnalyticsOptions = {},
): UseAdminAnalyticsReturn {
  const { intervalMs = 10_000, autoStart = true } = options;

  const [snapshot, setSnapshot] = useState<AdminAnalyticsSnapshot>(EMPTY_SNAPSHOT);
  const [isPolling, setIsPolling] = useState(autoStart);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => {
    try {
      setSnapshot(collectSnapshot());
    } catch {
      // Keep last snapshot on collection error
    }
  }, []);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const start = useCallback(() => {
    if (intervalRef.current) return; // Already running
    refresh();
    intervalRef.current = setInterval(refresh, intervalMs);
    setIsPolling(true);
  }, [intervalMs, refresh]);

  useEffect(() => {
    if (autoStart) {
      start();
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoStart, start]);

  return { snapshot, isPolling, refresh, start, stop };
}
