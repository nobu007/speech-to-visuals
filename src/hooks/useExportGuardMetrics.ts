/**
 * useExportGuardMetrics — React hook for observing security guard rejection metrics.
 *
 * Polls SecurityMetricsCollector at a configurable interval and exposes reactive
 * state for dashboard rendering. This makes the defense-in-depth observability
 * layer accessible to end users via a UI component.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  securityMetricsCollector,
  type SecurityRejectionSnapshot,
} from '@/export/security-metrics-collector';

export interface UseExportGuardMetricsOptions {
  /** Polling interval in milliseconds (default: 5000) */
  intervalMs?: number;
  /** Auto-start polling (default: true) */
  autoStart?: boolean;
}

export interface UseExportGuardMetricsReturn {
  /** Current metrics snapshot */
  metrics: SecurityRejectionSnapshot;
  /** True while polling is active */
  isPolling: boolean;
  /** Manually fetch latest snapshot */
  refresh: () => void;
  /** Start polling */
  start: () => void;
  /** Stop polling */
  stop: () => void;
  /** Reset all collected metrics */
  reset: () => void;
  /** Prometheus text export */
  prometheusText: string;
}

export function useExportGuardMetrics(
  options: UseExportGuardMetricsOptions = {},
): UseExportGuardMetricsReturn {
  const { intervalMs = 5000, autoStart = true } = options;

  const [metrics, setMetrics] = useState<SecurityRejectionSnapshot>(
    () => securityMetricsCollector.getSnapshot(),
  );
  const [prometheusText, setPrometheusText] = useState<string>(
    () => securityMetricsCollector.toPrometheusText(),
  );
  const [isPolling, setIsPolling] = useState(autoStart);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => {
    setMetrics(securityMetricsCollector.getSnapshot());
    setPrometheusText(securityMetricsCollector.toPrometheusText());
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

  const reset = useCallback(() => {
    securityMetricsCollector.reset();
    refresh();
  }, [refresh]);

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

  return { metrics, isPolling, refresh, start, stop, reset, prometheusText };
}
