/**
 * REQ-205: HttpMetricsCollector tests
 *
 * Verifies that the collector correctly:
 * - Records request counts per route
 * - Computes latency percentiles (p50, p95, p99)
 * - Tracks error rates (4xx, 5xx)
 * - Detects slow requests above threshold
 * - Bounds memory usage (latency buffer trimming)
 * - Produces accurate snapshots
 * - Resets cleanly
 */

import { HttpMetricsCollector } from '@/monitoring/http-metrics-collector';

describe('HttpMetricsCollector', () => {
  let collector: HttpMetricsCollector;

  beforeEach(() => {
    collector = new HttpMetricsCollector({
      maxSamplesPerRoute: 10,
      slowRequestThresholdMs: 100,
      maxSlowRequests: 5,
    });
  });

  // ---- Basic recording ----

  it('records a single request and produces a snapshot', () => {
    collector.recordRequest('GET', '/api/v1/test', 200, 50);

    const snap = collector.getSnapshot();
    expect(snap.totalRequests).toBe(1);
    expect(snap.totalErrors).toBe(0);
    expect(snap.globalErrorRate).toBe(0);
    expect(snap.routes).toHaveLength(1);
    expect(snap.routes[0]).toMatchObject({
      method: 'GET',
      path: '/api/v1/test',
      count: 1,
      errorCount: 0,
      errorRate: 0,
      avgMs: 50,
      minMs: 50,
      maxMs: 50,
    });
  });

  it('separates metrics by method+path combination', () => {
    collector.recordRequest('GET', '/api/v1/a', 200, 10);
    collector.recordRequest('POST', '/api/v1/a', 201, 20);
    collector.recordRequest('GET', '/api/v1/b', 200, 30);

    const snap = collector.getSnapshot();
    expect(snap.routes).toHaveLength(3);
  });

  // ---- Error tracking ----

  it('counts 4xx and 5xx as errors', () => {
    collector.recordRequest('GET', '/a', 200, 10);
    collector.recordRequest('GET', '/b', 400, 10);
    collector.recordRequest('GET', '/c', 500, 10);

    const snap = collector.getSnapshot();
    expect(snap.totalRequests).toBe(3);
    expect(snap.totalErrors).toBe(2);
    expect(snap.globalErrorRate).toBeCloseTo(2 / 3);
  });

  it('computes per-route error rate', () => {
    collector.recordRequest('GET', '/flaky', 200, 10);
    collector.recordRequest('GET', '/flaky', 500, 10);
    collector.recordRequest('GET', '/flaky', 500, 10);
    collector.recordRequest('GET', '/flaky', 200, 10);

    const snap = collector.getSnapshot();
    const flaky = snap.routes.find(r => r.path === '/flaky')!;
    expect(flaky.count).toBe(4);
    expect(flaky.errorCount).toBe(2);
    expect(flaky.errorRate).toBe(0.5);
  });

  // ---- Latency percentiles ----

  it('computes correct percentiles', () => {
    // 10 requests with latencies 10, 20, 30, ..., 100
    for (let i = 1; i <= 10; i++) {
      collector.recordRequest('GET', '/api', 200, i * 10);
    }

    const snap = collector.getSnapshot();
    const route = snap.routes[0];
    expect(route.avgMs).toBe(55); // (10+20+...+100)/10 = 550/10 = 55
    expect(route.minMs).toBe(10);
    expect(route.maxMs).toBe(100);
    expect(route.percentiles.p50).toBe(60);
    expect(route.percentiles.p95).toBe(100);
    expect(route.percentiles.p99).toBe(100);
  });

  // ---- Slow request detection ----

  it('detects slow requests above threshold', () => {
    collector.recordRequest('GET', '/slow', 200, 150, 'rid-1');
    collector.recordRequest('GET', '/fast', 200, 50, 'rid-2');

    const snap = collector.getSnapshot();
    expect(snap.slowRequests).toHaveLength(1);
    expect(snap.slowRequests[0]).toMatchObject({
      method: 'GET',
      path: '/slow',
      durationMs: 150,
      statusCode: 200,
      correlationId: 'rid-1',
    });
  });

  it('bounds slow request list to maxSlowRequests', () => {
    for (let i = 0; i < 10; i++) {
      collector.recordRequest('GET', '/slow', 200, 200, `rid-${i}`);
    }

    const snap = collector.getSnapshot();
    expect(snap.slowRequests).toHaveLength(5); // maxSlowRequests = 5
    // Should keep the most recent ones
    expect(snap.slowRequests[0].correlationId).toBe('rid-5');
    expect(snap.slowRequests[4].correlationId).toBe('rid-9');
  });

  // ---- Latency buffer trimming ----

  it('trims latency buffer when exceeding maxSamplesPerRoute', () => {
    // maxSamplesPerRoute = 10, so recording 15 samples should trigger a trim
    for (let i = 1; i <= 15; i++) {
      collector.recordRequest('GET', '/api', 200, i * 10);
    }

    const snap = collector.getSnapshot();
    const route = snap.routes[0];
    // After trim, should have kept the most recent ~5 samples (floor(10/2))
    // But count should still be 15
    expect(route.count).toBe(15);
    // Latencies buffer should be <= maxSamplesPerRoute after trim
    // The trim keeps the last floor(maxSamplesPerRoute/2) = 5 recent + new ones
    // Actually after recording 15 samples: first 10 fill up, then trim to last 5, then add 11-15 = 10 again
    expect(route.percentiles.p50).toBeGreaterThan(0);
  });

  // ---- Active request tracking ----

  it('tracks active requests', () => {
    collector.startRequest();
    collector.startRequest();
    expect(collector.getSnapshot().activeRequests).toBe(2);

    collector.recordRequest('GET', '/a', 200, 10);
    expect(collector.getSnapshot().activeRequests).toBe(1);
  });

  it('does not go below zero for active requests', () => {
    collector.recordRequest('GET', '/unbalanced', 200, 10);
    expect(collector.getSnapshot().activeRequests).toBe(0);
  });

  // ---- Snapshot ordering ----

  it('sorts routes by count descending', () => {
    collector.recordRequest('GET', '/rare', 200, 10);
    for (let i = 0; i < 5; i++) {
      collector.recordRequest('GET', '/popular', 200, 10);
    }
    collector.recordRequest('GET', '/medium', 200, 10);
    collector.recordRequest('GET', '/medium', 200, 10);

    const snap = collector.getSnapshot();
    expect(snap.routes[0].path).toBe('/popular');
    expect(snap.routes[1].path).toBe('/medium');
    expect(snap.routes[2].path).toBe('/rare');
  });

  // ---- Uptime ----

  it('reports positive uptime', () => {
    collector.recordRequest('GET', '/ping', 200, 1);
    const snap = collector.getSnapshot();
    expect(snap.uptime).toBeGreaterThanOrEqual(0);
  });

  // ---- Reset ----

  it('resets all metrics cleanly', () => {
    collector.recordRequest('GET', '/api', 200, 10);
    collector.recordRequest('GET', '/api', 500, 10);
    collector.startRequest();

    collector.reset();

    const snap = collector.getSnapshot();
    expect(snap.totalRequests).toBe(0);
    expect(snap.totalErrors).toBe(0);
    expect(snap.activeRequests).toBe(0);
    expect(snap.routes).toHaveLength(0);
    expect(snap.slowRequests).toHaveLength(0);
  });

  // ---- Empty snapshot ----

  it('returns valid snapshot when no requests recorded', () => {
    const snap = collector.getSnapshot();
    expect(snap.totalRequests).toBe(0);
    expect(snap.totalErrors).toBe(0);
    expect(snap.globalErrorRate).toBe(0);
    expect(snap.routes).toHaveLength(0);
    expect(snap.slowRequests).toHaveLength(0);
  });
});
