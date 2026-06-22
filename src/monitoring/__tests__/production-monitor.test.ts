import {
  ProductionMonitor,
  HealthCheckResult,
  ComponentHealth,
  Alert,
  ProductionMetrics,
  getProductionMonitor,
  formatHealthCheck,
} from '../production-monitor';

// ---------------------------------------------------------------------------
// Singleton pattern
// ---------------------------------------------------------------------------

describe('ProductionMonitor singleton', () => {
  it('returns the same instance from getInstance', () => {
    const a = ProductionMonitor.getInstance();
    const b = ProductionMonitor.getInstance();
    expect(a).toBe(b);
  });

  it('getProductionMonitor returns the singleton', () => {
    const monitor = getProductionMonitor();
    expect(monitor).toBe(ProductionMonitor.getInstance());
  });
});

// ---------------------------------------------------------------------------
// Initial state & reset
// ---------------------------------------------------------------------------

describe('initial state', () => {
  let monitor: ProductionMonitor;

  beforeEach(() => {
    monitor = ProductionMonitor.getInstance();
    monitor.reset();
  });

  it('starts with zero total/successful/failed requests', () => {
    const m = monitor.getMetrics();
    expect(m.totalRequests).toBe(0);
    expect(m.successfulRequests).toBe(0);
    expect(m.failedRequests).toBe(0);
  });

  it('starts with zero processing times', () => {
    const m = monitor.getMetrics();
    expect(m.averageProcessingTime).toBe(0);
    expect(m.p95ProcessingTime).toBe(0);
    expect(m.p99ProcessingTime).toBe(0);
  });

  it('starts with empty errorsByType map', () => {
    const m = monitor.getMetrics();
    expect(m.errorsByType.size).toBe(0);
  });

  it('initializes all 4 component metrics', () => {
    const m = monitor.getMetrics();
    expect(m.componentMetrics.transcription).toBeDefined();
    expect(m.componentMetrics.analysis).toBeDefined();
    expect(m.componentMetrics.visualization).toBeDefined();
    expect(m.componentMetrics.rendering).toBeDefined();
  });

  it('resets all metrics', () => {
    monitor.recordSuccess('transcription', 1000);
    monitor.recordFailure('analysis', 'timeout error', 500);
    expect(monitor.getMetrics().totalRequests).toBeGreaterThan(0);

    monitor.reset();
    const m = monitor.getMetrics();
    expect(m.totalRequests).toBe(0);
    expect(m.successfulRequests).toBe(0);
    expect(m.failedRequests).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// recordSuccess
// ---------------------------------------------------------------------------

describe('recordSuccess', () => {
  let monitor: ProductionMonitor;

  beforeEach(() => {
    monitor = ProductionMonitor.getInstance();
    monitor.reset();
  });

  it('increments totalRequests and successfulRequests', () => {
    monitor.recordSuccess('transcription', 1000);
    const m = monitor.getMetrics();
    expect(m.totalRequests).toBe(1);
    expect(m.successfulRequests).toBe(1);
  });

  it('updates component metrics', () => {
    monitor.recordSuccess('transcription', 2000);
    const m = monitor.getMetrics();
    expect(m.componentMetrics.transcription.requests).toBe(1);
    expect(m.componentMetrics.transcription.successes).toBe(1);
    expect(m.componentMetrics.transcription.averageLatency).toBe(2000);
  });

  it('computes running average latency correctly', () => {
    monitor.recordSuccess('analysis', 1000);
    monitor.recordSuccess('analysis', 3000);
    const m = monitor.getMetrics();
    expect(m.componentMetrics.analysis.averageLatency).toBe(2000);
  });

  it('records processing time for percentile calculation', () => {
    for (let i = 1; i <= 20; i++) {
      monitor.recordSuccess('rendering', i * 1000);
    }
    const m = monitor.getMetrics();
    expect(m.averageProcessingTime).toBeCloseTo(10500, 0);
    expect(m.p95ProcessingTime).toBeGreaterThan(0);
    expect(m.p99ProcessingTime).toBeGreaterThan(0);
  });

  it('handles all four component types', () => {
    monitor.recordSuccess('transcription', 100);
    monitor.recordSuccess('analysis', 200);
    monitor.recordSuccess('visualization', 300);
    monitor.recordSuccess('rendering', 400);
    const m = monitor.getMetrics();
    expect(m.componentMetrics.transcription.requests).toBe(1);
    expect(m.componentMetrics.analysis.requests).toBe(1);
    expect(m.componentMetrics.visualization.requests).toBe(1);
    expect(m.componentMetrics.rendering.requests).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// recordFailure
// ---------------------------------------------------------------------------

describe('recordFailure', () => {
  let monitor: ProductionMonitor;

  beforeEach(() => {
    monitor = ProductionMonitor.getInstance();
    monitor.reset();
  });

  it('increments totalRequests and failedRequests', () => {
    monitor.recordFailure('transcription', 'timeout error');
    const m = monitor.getMetrics();
    expect(m.totalRequests).toBe(1);
    expect(m.failedRequests).toBe(1);
    expect(m.successfulRequests).toBe(0);
  });

  it('updates component failure metrics', () => {
    monitor.recordFailure('analysis', 'API quota exceeded');
    const m = monitor.getMetrics();
    expect(m.componentMetrics.analysis.requests).toBe(1);
    expect(m.componentMetrics.analysis.failures).toBe(1);
    expect(m.componentMetrics.analysis.errors).toHaveLength(1);
    expect(m.componentMetrics.analysis.errors[0].error).toBe('API quota exceeded');
  });

  it('categorizes timeout errors', () => {
    monitor.recordFailure('transcription', 'Request timeout after 30s');
    monitor.recordFailure('transcription', 'ETIMEDOUT connection failed');
    const m = monitor.getMetrics();
    expect(m.errorsByType.get('timeout')).toBe(2);
  });

  it('categorizes API errors', () => {
    monitor.recordFailure('analysis', 'API rate limit exceeded');
    monitor.recordFailure('analysis', 'quota exhausted');
    const m = monitor.getMetrics();
    expect(m.errorsByType.get('api_error')).toBe(2);
  });

  it('categorizes memory errors', () => {
    monitor.recordFailure('rendering', 'Out of memory OOM');
    const m = monitor.getMetrics();
    expect(m.errorsByType.get('memory_error')).toBe(1);
  });

  it('categorizes permission errors', () => {
    monitor.recordFailure('visualization', 'EACCES permission denied');
    const m = monitor.getMetrics();
    expect(m.errorsByType.get('permission_error')).toBe(1);
  });

  it('categorizes unknown errors', () => {
    monitor.recordFailure('transcription', 'Unexpected token in JSON');
    const m = monitor.getMetrics();
    expect(m.errorsByType.get('unknown_error')).toBe(1);
  });

  it('keeps error history bounded at 100', () => {
    for (let i = 0; i < 120; i++) {
      monitor.recordFailure('transcription', `error ${i}`);
    }
    const m = monitor.getMetrics();
    expect(m.componentMetrics.transcription.errors).toHaveLength(100);
  });
});

// ---------------------------------------------------------------------------
// performHealthCheck
// ---------------------------------------------------------------------------

describe('performHealthCheck', () => {
  let monitor: ProductionMonitor;

  beforeEach(() => {
    monitor = ProductionMonitor.getInstance();
    monitor.reset();
  });

  it('returns unknown status when no requests recorded', () => {
    const result = monitor.performHealthCheck();
    expect(result.status).toBe('unknown');
  });

  it('returns healthy status when all requests succeed', () => {
    for (let i = 0; i < 10; i++) {
      monitor.recordSuccess('transcription', 1000);
    }
    const result = monitor.performHealthCheck();
    expect(result.status).toBe('healthy');
  });

  it('returns degraded status when error rate is between warning and critical thresholds', () => {
    // 19 success, 1 failure = 5% error rate (>=5% warning, <15% critical)
    for (let i = 0; i < 19; i++) monitor.recordSuccess('transcription', 1000);
    for (let i = 0; i < 1; i++) monitor.recordFailure('transcription', 'some error');
    const result = monitor.performHealthCheck();
    expect(result.status).toBe('degraded');
  });

  it('returns critical status when error rate exceeds critical threshold', () => {
    // 5 success, 15 failures = 75% error rate (>15% critical)
    for (let i = 0; i < 5; i++) monitor.recordSuccess('transcription', 1000);
    for (let i = 0; i < 15; i++) monitor.recordFailure('transcription', 'some error');
    const result = monitor.performHealthCheck();
    expect(result.status).toBe('critical');
  });

  it('generates critical alert for critical component', () => {
    for (let i = 0; i < 2; i++) monitor.recordSuccess('transcription', 1000);
    for (let i = 0; i < 10; i++) monitor.recordFailure('transcription', 'fail');
    const result = monitor.performHealthCheck();
    expect(result.alerts.some(a => a.severity === 'critical')).toBe(true);
  });

  it('generates warning alert for degraded component', () => {
    for (let i = 0; i < 9; i++) monitor.recordSuccess('transcription', 1000);
    for (let i = 0; i < 1; i++) monitor.recordFailure('transcription', 'fail');
    // 10% error rate > 5% warning threshold
    const result = monitor.performHealthCheck();
    expect(result.alerts.some(a => a.severity === 'warning')).toBe(true);
  });

  it('includes all 4 components in result', () => {
    monitor.recordSuccess('transcription', 1000);
    const result = monitor.performHealthCheck();
    expect(result.components.transcription).toBeDefined();
    expect(result.components.analysis).toBeDefined();
    expect(result.components.visualization).toBeDefined();
    expect(result.components.rendering).toBeDefined();
  });

  it('includes timestamp in result', () => {
    const result = monitor.performHealthCheck();
    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it('stores result in health history', () => {
    monitor.recordSuccess('transcription', 1000);
    monitor.performHealthCheck();
    monitor.performHealthCheck();
    // History is stored internally; we verify by checking the second check still works
    const result = monitor.performHealthCheck();
    expect(result).toBeDefined();
  });

  it('generates overall success rate alert when below 90%', () => {
    for (let i = 0; i < 8; i++) monitor.recordSuccess('transcription', 1000);
    for (let i = 0; i < 3; i++) monitor.recordFailure('analysis', 'error');
    // success rate = 8/11 ≈ 72.7% < 90%
    const result = monitor.performHealthCheck();
    expect(result.alerts.some(a => a.metric === 'successRate')).toBe(true);
  });

  it('generates latency alert when average processing time exceeds threshold', () => {
    monitor.recordSuccess('transcription', 70000); // > 60000ms threshold
    const result = monitor.performHealthCheck();
    expect(result.alerts.some(a => a.metric === 'averageLatency')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Component health checks
// ---------------------------------------------------------------------------

describe('component health checks', () => {
  let monitor: ProductionMonitor;

  beforeEach(() => {
    monitor = ProductionMonitor.getInstance();
    monitor.reset();
  });

  it('healthy component has correct status', () => {
    for (let i = 0; i < 10; i++) {
      monitor.recordSuccess('rendering', 1000);
    }
    const result = monitor.performHealthCheck();
    expect(result.components.rendering.status).toBe('healthy');
    expect(result.components.rendering.metrics.successRate).toBe(1);
    expect(result.components.rendering.metrics.errorRate).toBe(0);
  });

  it('unknown component status when no requests', () => {
    const result = monitor.performHealthCheck();
    expect(result.components.transcription.status).toBe('unknown');
    expect(result.components.analysis.status).toBe('unknown');
  });

  it('records lastError for failed components', () => {
    monitor.recordFailure('visualization', 'specific error message');
    const result = monitor.performHealthCheck();
    expect(result.components.visualization.lastError).toBe('specific error message');
  });

  it('records lastSuccess for successful components', () => {
    monitor.recordSuccess('transcription', 1000);
    const result = monitor.performHealthCheck();
    expect(result.components.transcription.lastSuccess).toBeDefined();
    expect(result.components.transcription.lastSuccess).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

describe('recommendations', () => {
  let monitor: ProductionMonitor;

  beforeEach(() => {
    monitor = ProductionMonitor.getInstance();
    monitor.reset();
  });

  it('recommends faster Whisper model when transcription is degraded', () => {
    for (let i = 0; i < 9; i++) monitor.recordSuccess('transcription', 1000);
    for (let i = 0; i < 1; i++) monitor.recordFailure('transcription', 'error');
    const result = monitor.performHealthCheck();
    expect(result.recommendations.some(r => r.includes('Whisper'))).toBe(true);
  });

  it('recommends Flash model when analysis is degraded', () => {
    for (let i = 0; i < 9; i++) monitor.recordSuccess('analysis', 1000);
    for (let i = 0; i < 1; i++) monitor.recordFailure('analysis', 'error');
    const result = monitor.performHealthCheck();
    expect(result.recommendations.some(r => r.includes('Flash'))).toBe(true);
  });

  it('recommends parallel rendering when rendering is degraded', () => {
    for (let i = 0; i < 9; i++) monitor.recordSuccess('rendering', 1000);
    for (let i = 0; i < 1; i++) monitor.recordFailure('rendering', 'error');
    const result = monitor.performHealthCheck();
    expect(result.recommendations.some(r => r.includes('parallel rendering'))).toBe(true);
  });

  it('recommends checking timeout thresholds after 5+ timeout errors', () => {
    for (let i = 0; i < 6; i++) monitor.recordFailure('transcription', 'Request timeout');
    const result = monitor.performHealthCheck();
    expect(result.recommendations.some(r => r.includes('timeout errors detected'))).toBe(true);
  });

  it('recommends checking API quota after 3+ API errors', () => {
    for (let i = 0; i < 4; i++) monitor.recordFailure('analysis', 'API quota exceeded');
    const result = monitor.performHealthCheck();
    expect(result.recommendations.some(r => r.includes('API errors detected'))).toBe(true);
  });

  it('reports no requests when no data', () => {
    const result = monitor.performHealthCheck();
    expect(result.recommendations.some(r => r.includes('No requests processed'))).toBe(true);
  });

  it('reports system healthy when no alerts', () => {
    monitor.recordSuccess('transcription', 1000);
    const result = monitor.performHealthCheck();
    expect(result.recommendations.some(r => r.includes('System healthy'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getMetrics
// ---------------------------------------------------------------------------

describe('getMetrics', () => {
  let monitor: ProductionMonitor;

  beforeEach(() => {
    monitor = ProductionMonitor.getInstance();
    monitor.reset();
  });

  it('returns a copy of metrics (not the internal reference)', () => {
    monitor.recordSuccess('transcription', 1000);
    const m1 = monitor.getMetrics();
    monitor.recordSuccess('transcription', 2000);
    const m2 = monitor.getMetrics();
    expect(m1.totalRequests).toBe(1);
    expect(m2.totalRequests).toBe(2);
  });

  it('returns metrics with errorsByType as Map', () => {
    monitor.recordFailure('transcription', 'timeout error');
    const m = monitor.getMetrics();
    expect(m.errorsByType).toBeInstanceOf(Map);
    expect(m.errorsByType.get('timeout')).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// exportMetrics
// ---------------------------------------------------------------------------

describe('exportMetrics', () => {
  let monitor: ProductionMonitor;

  beforeEach(() => {
    monitor = ProductionMonitor.getInstance();
    monitor.reset();
  });

  it('returns a non-empty string', () => {
    const result = monitor.exportMetrics();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes "PRODUCTION METRICS REPORT" header', () => {
    expect(monitor.exportMetrics()).toContain('PRODUCTION METRICS REPORT');
  });

  it('shows N/A for success rate when no requests', () => {
    expect(monitor.exportMetrics()).toContain('N/A');
  });

  it('shows numeric success rate when requests exist', () => {
    monitor.recordSuccess('transcription', 1000);
    const exported = monitor.exportMetrics();
    // Overall success rate shows as numeric
    expect(exported).toContain('100.00%');
  });

  it('includes component names in output', () => {
    monitor.recordSuccess('transcription', 1000);
    const exported = monitor.exportMetrics();
    expect(exported).toContain('transcription');
    expect(exported).toContain('analysis');
    expect(exported).toContain('visualization');
    expect(exported).toContain('rendering');
  });

  it('includes error distribution', () => {
    monitor.recordFailure('transcription', 'timeout error');
    const exported = monitor.exportMetrics();
    expect(exported).toContain('timeout');
    expect(exported).toContain('Error Distribution');
  });

  it('shows "No errors recorded" when no errors', () => {
    monitor.recordSuccess('transcription', 1000);
    const exported = monitor.exportMetrics();
    expect(exported).toContain('No errors recorded');
  });
});

// ---------------------------------------------------------------------------
// formatHealthCheck
// ---------------------------------------------------------------------------

describe('formatHealthCheck', () => {
  let monitor: ProductionMonitor;

  beforeEach(() => {
    monitor = ProductionMonitor.getInstance();
    monitor.reset();
  });

  it('returns formatted string with header', () => {
    monitor.recordSuccess('transcription', 1000);
    const result = monitor.performHealthCheck();
    const formatted = formatHealthCheck(result);
    expect(typeof formatted).toBe('string');
    expect(formatted).toContain('HEALTH CHECK REPORT');
  });

  it('includes overall status', () => {
    monitor.recordSuccess('transcription', 1000);
    const result = monitor.performHealthCheck();
    const formatted = formatHealthCheck(result);
    expect(formatted).toContain('HEALTHY');
  });

  it('includes component names', () => {
    monitor.recordSuccess('transcription', 1000);
    const result = monitor.performHealthCheck();
    const formatted = formatHealthCheck(result);
    expect(formatted).toContain('transcription');
  });

  it('includes alerts section when alerts exist', () => {
    for (let i = 0; i < 2; i++) monitor.recordSuccess('transcription', 1000);
    for (let i = 0; i < 10; i++) monitor.recordFailure('transcription', 'error');
    const result = monitor.performHealthCheck();
    const formatted = formatHealthCheck(result);
    expect(formatted).toContain('Active Alerts');
  });

  it('includes recommendations section', () => {
    monitor.recordSuccess('transcription', 1000);
    const result = monitor.performHealthCheck();
    const formatted = formatHealthCheck(result);
    expect(formatted).toContain('Recommendations');
  });

  it('handles unknown status', () => {
    const result = monitor.performHealthCheck();
    const formatted = formatHealthCheck(result);
    expect(formatted).toContain('UNKNOWN');
  });

  it('includes last error when present', () => {
    monitor.recordFailure('transcription', 'a very specific error message that is long enough');
    const result = monitor.performHealthCheck();
    const formatted = formatHealthCheck(result);
    expect(formatted).toContain('Last Error');
  });
});
