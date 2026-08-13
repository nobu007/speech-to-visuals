/**
 * Finiteness contract for HttpMetricsCollector ingestion chokepoint.
 *
 * recordRequest(durationMs) feeds the per-route `sumMs` accumulator and the
 * `latencies` buffer that the snapshot derives aggregates from:
 *   • sumMs / count        → avgMs            (getSnapshot)
 *   • [...latencies].sort  → computePercentiles p50/p95/p99 (getSnapshot)
 *   • durationMs bounds    → minMs / maxMs
 *
 * A single non-finite sample (NaN / ±Infinity) is sticky through +, /, sort
 * and Math.round, so it contaminates every published route aggregate that the
 * monitoring dashboard / Prometheus exporter consume. Same leak class as the
 * recordStageDuration guard (pipeline-metrics-collector) and the
 * RealTimePerformanceMonitor ingestion guard — the sibling chokepoint in this
 * same monitoring module. Verified by feeding NaN / ±∞ at ingestion and
 * asserting finite aggregate OUTPUT.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { HttpMetricsCollector } from '../http-metrics-collector';

describe('HttpMetricsCollector — non-finite ingestion must not leak into aggregates', () => {
  let collector: HttpMetricsCollector;

  beforeEach(() => {
    collector = new HttpMetricsCollector();
  });

  const routeOf = (snap: ReturnType<HttpMetricsCollector['getSnapshot']>) =>
    snap.routes.find(r => r.path === '/api/leak')!;

  it('keeps avgMs finite when a durationMs sample is NaN', () => {
    collector.recordRequest('GET', '/api/leak', 200, 10);
    collector.recordRequest('GET', '/api/leak', 200, NaN); // poisoned sample
    collector.recordRequest('GET', '/api/leak', 200, 30);

    const route = routeOf(collector.getSnapshot());
    expect(Number.isFinite(route.avgMs)).toBe(true);
    expect(route.avgMs).toBeGreaterThan(0);
  });

  it('keeps avgMs finite when a durationMs sample is +Infinity', () => {
    collector.recordRequest('GET', '/api/leak', 200, 10);
    collector.recordRequest('GET', '/api/leak', 200, Infinity);

    const route = routeOf(collector.getSnapshot());
    expect(Number.isFinite(route.avgMs)).toBe(true);
  });

  it('keeps p95/p99 percentiles finite when a latency sample is NaN', () => {
    for (let i = 1; i <= 20; i++) {
      collector.recordRequest('GET', '/api/leak', 200, i === 10 ? NaN : i * 10);
    }

    const route = routeOf(collector.getSnapshot());
    expect(Number.isFinite(route.percentiles.p95)).toBe(true);
    expect(Number.isFinite(route.percentiles.p99)).toBe(true);
  });

  it('keeps minMs/maxMs finite when a durationMs sample is ±Infinity', () => {
    collector.recordRequest('GET', '/api/leak', 200, 10);
    collector.recordRequest('GET', '/api/leak', 200, Infinity);
    collector.recordRequest('GET', '/api/leak', 200, -Infinity);

    const route = routeOf(collector.getSnapshot());
    expect(Number.isFinite(route.minMs)).toBe(true);
    expect(Number.isFinite(route.maxMs)).toBe(true);
  });
});
