/**
 * @jest-environment jsdom
 */

/**
 * useExportGuardMetrics hook tests
 *
 * Verifies the React hook correctly wraps SecurityMetricsCollector,
 * providing reactive state updates.
 */

import { renderHook, act } from '@testing-library/react';
import { useExportGuardMetrics } from '../useExportGuardMetrics';
import { securityMetricsCollector } from '@/export/security-metrics-collector';

// Helper to trigger a rejection
function triggerRejection() {
  securityMetricsCollector.recordRejection(
    'content-validator',
    'high',
    'test-pattern',
  );
}

describe('useExportGuardMetrics', () => {
  beforeEach(() => {
    securityMetricsCollector.reset();
  });

  afterEach(() => {
    securityMetricsCollector.reset();
  });

  it('returns initial snapshot', () => {
    const { result } = renderHook(() =>
      useExportGuardMetrics({ autoStart: false }),
    );

    expect(result.current.metrics.totalRejections).toBe(0);
    expect(result.current.metrics.byLayer['content-validator']).toBe(0);
    expect(result.current.metrics.bySeverity.high).toBe(0);
  });

  it('refresh picks up new rejections', () => {
    const { result } = renderHook(() =>
      useExportGuardMetrics({ autoStart: false }),
    );

    expect(result.current.metrics.totalRejections).toBe(0);

    act(() => {
      triggerRejection();
    });

    // Manually refresh
    act(() => {
      result.current.refresh();
    });

    expect(result.current.metrics.totalRejections).toBe(1);
    expect(result.current.metrics.byLayer['content-validator']).toBe(1);
    expect(result.current.metrics.bySeverity.high).toBe(1);
    expect(result.current.metrics.byPattern[0]?.pattern).toBe('test-pattern');
  });

  it('reset clears all metrics', () => {
    const { result } = renderHook(() =>
      useExportGuardMetrics({ autoStart: false }),
    );

    act(() => {
      triggerRejection();
      result.current.refresh();
    });

    expect(result.current.metrics.totalRejections).toBe(1);

    act(() => {
      result.current.reset();
    });

    expect(result.current.metrics.totalRejections).toBe(0);
  });

  it('start/stop controls polling', () => {
    const { result } = renderHook(() =>
      useExportGuardMetrics({ autoStart: false }),
    );

    expect(result.current.isPolling).toBe(false);

    act(() => {
      result.current.start();
    });

    expect(result.current.isPolling).toBe(true);

    act(() => {
      result.current.stop();
    });

    expect(result.current.isPolling).toBe(false);
  });

  it('generates Prometheus text export', () => {
    const { result } = renderHook(() =>
      useExportGuardMetrics({ autoStart: false }),
    );

    act(() => {
      securityMetricsCollector.recordRejection(
        'strict-mode-block',
        'high',
        'script-tag',
      );
      result.current.refresh();
    });

    expect(result.current.prometheusText).toContain('security_guard_rejections_total');
    expect(result.current.prometheusText).toContain('script-tag');
    expect(result.current.prometheusText).toContain('strict-mode-block');
  });

  it('autoStart defaults to true', () => {
    const { result } = renderHook(() => useExportGuardMetrics());

    expect(result.current.isPolling).toBe(true);

    // Clean up
    act(() => {
      result.current.stop();
    });
  });
});
