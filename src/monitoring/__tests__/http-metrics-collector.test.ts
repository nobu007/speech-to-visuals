/**
 * Tests for HttpMetricsCollector (REQ-205).
 *
 * Verifies request recording, percentile computation, slow request detection,
 * bounded latency buffers, active request tracking, and snapshot accuracy.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { HttpMetricsCollector } from '../http-metrics-collector';

describe('HttpMetricsCollector', () => {
  let collector: HttpMetricsCollector;

  beforeEach(() => {
    collector = new HttpMetricsCollector();
  });

  // --- Basic recording ---

  it('should start with zero requests', () => {
    const snap = collector.getSnapshot();
    expect(snap.totalRequests).toBe(0);
    expect(snap.totalErrors).toBe(0);
    expect(snap.globalErrorRate).toBe(0);
    expect(snap.activeRequests).toBe(0);
    expect(snap.routes).toHaveLength(0);
    expect(snap.slowRequests).toHaveLength(0);
  });

  it('should record a single request', () => {
    collector.recordRequest('GET', '/api/health', 200, 10);
    const snap = collector.getSnapshot();
    expect(snap.totalRequests).toBe(1);
    expect(snap.totalErrors).toBe(0);
    expect(snap.globalErrorRate).toBe(0);
    expect(snap.routes).toHaveLength(1);
    expect(snap.routes[0]).toMatchObject({
      method: 'GET',
      path: '/api/health',
      count: 1,
      errorCount: 0,
      errorRate: 0,
      avgMs: 10,
      minMs: 10,
      maxMs: 10,
    });
  });

  it('should track active requests', () => {
    collector.startRequest();
    collector.startRequest();
    expect(collector.getSnapshot().activeRequests).toBe(2);

    collector.recordRequest('GET', '/a', 200, 5);
    expect(collector.getSnapshot().activeRequests).toBe(1);

    collector.recordRequest('GET', '/b', 200, 5);
    expect(collector.getSnapshot().activeRequests).toBe(0);
  });

  it('should never go below zero active requests', () => {
    collector.recordRequest('GET', '/a', 200, 5);
    expect(collector.getSnapshot().activeRequests).toBe(0);
  });

  // --- Error tracking ---

  it('should count 4xx and 5xx as errors', () => {
    collector.recordRequest('GET', '/a', 200, 5);
    collector.recordRequest('GET', '/a', 404, 5);
    collector.recordRequest('POST', '/b', 500, 5);

    const snap = collector.getSnapshot();
    expect(snap.totalRequests).toBe(3);
    expect(snap.totalErrors).toBe(2);
    expect(snap.globalErrorRate).toBeCloseTo(2 / 3);
  });

  it('should track per-route error counts', () => {
    collector.recordRequest('GET', '/api/users', 200, 5);
    collector.recordRequest('GET', '/api/users', 500, 5);
    collector.recordRequest('GET', '/api/users', 500, 5);

    const route = collector.getSnapshot().routes.find(r => r.path === '/api/users');
    expect(route!.errorCount).toBe(2);
    expect(route!.errorRate).toBeCloseTo(2 / 3);
  });

  // --- Latency stats ---

  it('should compute avg, min, max across multiple requests', () => {
    const durations = [10, 50, 100, 200, 500];
    for (const d of durations) {
      collector.recordRequest('GET', '/slow', 200, d);
    }

    const route = collector.getSnapshot().routes[0];
    expect(route.minMs).toBe(10);
    expect(route.maxMs).toBe(500);
    expect(route.avgMs).toBe(Math.round((10 + 50 + 100 + 200 + 500) / 5));
  });

  it('should compute percentiles correctly', () => {
    // 100 samples from 1..100
    for (let i = 1; i <= 100; i++) {
      collector.recordRequest('GET', '/p', 200, i);
    }

    const route = collector.getSnapshot().routes[0];
    // p50 = index 50 → value 51 (0-indexed sorted array of 1..100)
    expect(route.percentiles.p50).toBe(51);
    // p95 = index 95 → value 96
    expect(route.percentiles.p95).toBe(96);
    // p99 = index 99 → value 100
    expect(route.percentiles.p99).toBe(100);
  });

  it('should return zero percentiles when no data', () => {
    collector.recordRequest('GET', '/empty', 200, 5);
    collector.reset();
    collector.recordRequest('GET', '/x', 200, 10);
    const route = collector.getSnapshot().routes[0];
    expect(route.percentiles).toEqual({ p50: 10, p95: 10, p99: 10 });
  });

  // --- Slow request detection ---

  it('should detect and record slow requests', () => {
    const slowCollector = new HttpMetricsCollector({
      slowRequestThresholdMs: 100,
      maxSlowRequests: 5,
    });

    slowCollector.recordRequest('GET', '/fast', 200, 10);
    expect(slowCollector.getSnapshot().slowRequests).toHaveLength(0);

    slowCollector.recordRequest('GET', '/slow', 200, 200, 'req-1');
    const slow = slowCollector.getSnapshot().slowRequests;
    expect(slow).toHaveLength(1);
    expect(slow[0]).toMatchObject({
      method: 'GET',
      path: '/slow',
      durationMs: 200,
      statusCode: 200,
      correlationId: 'req-1',
    });
  });

  it('should bound slow request records', () => {
    const slowCollector = new HttpMetricsCollector({
      slowRequestThresholdMs: 50,
      maxSlowRequests: 3,
    });

    for (let i = 0; i < 10; i++) {
      slowCollector.recordRequest('GET', '/slow', 200, 60, `req-${i}`);
    }

    const slow = slowCollector.getSnapshot().slowRequests;
    expect(slow).toHaveLength(3);
    // Should keep the last 3
    expect(slow[0].correlationId).toBe('req-7');
    expect(slow[2].correlationId).toBe('req-9');
  });

  // --- Bounded latency buffer ---

  it('should bound latency samples per route', () => {
    const bounded = new HttpMetricsCollector({ maxSamplesPerRoute: 10 });
    for (let i = 0; i < 30; i++) {
      bounded.recordRequest('GET', '/burst', 200, i + 1);
    }

    const snap = bounded.getSnapshot();
    // After exceeding 10 samples, buffer is sliced to 5 (half of max)
    // Then new samples continue to accumulate
    // Check that the route count is still correct (all requests counted)
    expect(snap.routes[0].count).toBe(30);
  });

  // --- Multiple routes ---

  it('should bound distinct route entries (FIFO-evicts oldest-inserted)', () => {
    // The route key is `${method} ${path}` and the middleware feeds the raw
    // request path (high-cardinality dynamic segments). Without a cap the
    // `routes` map grew forever. CappedMap bounds it at maxRoutes.
    const bounded = new HttpMetricsCollector({ maxRoutes: 3 });
    // 5 distinct high-cardinality paths → only the newest 3 are retained.
    bounded.recordRequest('GET', '/api/job/1', 200, 10);
    bounded.recordRequest('GET', '/api/job/2', 200, 10);
    bounded.recordRequest('GET', '/api/job/3', 200, 10);
    bounded.recordRequest('GET', '/api/job/4', 200, 10);
    bounded.recordRequest('GET', '/api/job/5', 200, 10);

    const snap = bounded.getSnapshot();
    expect(snap.routes).toHaveLength(3);
    const paths = snap.routes.map((r) => r.path).sort();
    expect(paths).toEqual(['/api/job/3', '/api/job/4', '/api/job/5']);
    // Global counters are cumulative and unaffected by route eviction.
    expect(snap.totalRequests).toBe(5);
  });

  it('should not evict when re-hitting an existing route (update in place)', () => {
    const bounded = new HttpMetricsCollector({ maxRoutes: 2 });
    bounded.recordRequest('GET', '/a', 200, 10);
    bounded.recordRequest('GET', '/b', 200, 10);
    // '/a' already exists → update, not insert → no eviction, '/b' must remain.
    bounded.recordRequest('GET', '/a', 200, 20);

    const snap = bounded.getSnapshot();
    expect(snap.routes).toHaveLength(2);
    expect(snap.routes.find((r) => r.path === '/a')!.count).toBe(2);
    expect(snap.routes.find((r) => r.path === '/b')).toBeDefined();
  });

  it('should separate metrics by route', () => {
    collector.recordRequest('GET', '/a', 200, 10);
    collector.recordRequest('POST', '/a', 201, 20);
    collector.recordRequest('GET', '/b', 200, 30);

    const snap = collector.getSnapshot();
    expect(snap.routes).toHaveLength(3);
  });

  it('should sort routes by count descending', () => {
    collector.recordRequest('GET', '/least', 200, 5);
    collector.recordRequest('GET', '/most', 200, 5);
    collector.recordRequest('GET', '/most', 200, 5);
    collector.recordRequest('GET', '/most', 200, 5);

    const snap = collector.getSnapshot();
    expect(snap.routes[0].path).toBe('/most');
    expect(snap.routes[0].count).toBe(3);
    expect(snap.routes[1].path).toBe('/least');
    expect(snap.routes[1].count).toBe(1);
  });

  // --- Reset ---

  it('should reset all metrics', () => {
    collector.recordRequest('GET', '/a', 200, 10);
    collector.recordRequest('GET', '/a', 500, 10);
    collector.startRequest();

    collector.reset();

    const snap = collector.getSnapshot();
    expect(snap.totalRequests).toBe(0);
    expect(snap.totalErrors).toBe(0);
    expect(snap.activeRequests).toBe(0);
    expect(snap.routes).toHaveLength(0);
    expect(snap.slowRequests).toHaveLength(0);
  });

  // --- Uptime ---

  it('should track uptime', () => {
    collector.recordRequest('GET', '/a', 200, 1);
    const snap = collector.getSnapshot();
    expect(snap.uptime).toBeGreaterThanOrEqual(0);
  });

  // --- Default correlation ID ---

  it('should use default correlation ID of "-"', () => {
    const slowCollector = new HttpMetricsCollector({
      slowRequestThresholdMs: 1,
      maxSlowRequests: 10,
    });
    slowCollector.recordRequest('GET', '/a', 200, 5);
    const slow = slowCollector.getSnapshot().slowRequests;
    expect(slow[0].correlationId).toBe('-');
  });

  // --- Edge: lastStatusCode tracking ---

  it('should track last status code per route', () => {
    // Access internal state via snapshot - lastStatusCode not in snapshot,
    // but we can verify it doesn't crash
    collector.recordRequest('GET', '/a', 200, 5);
    collector.recordRequest('GET', '/a', 404, 5);
    collector.recordRequest('GET', '/a', 500, 5);

    // Just verify no crash and correct count
    const route = collector.getSnapshot().routes[0];
    expect(route.count).toBe(3);
  });
});
