/**
 * REQ-205: HTTP Request Metrics Collector
 *
 * Aggregates per-route HTTP metrics for the speech-to-visuals API:
 * - Request counts by method+path
 * - Response latency percentiles (p50, p95, p99)
 * - Error rates by status code class (4xx, 5xx)
 * - Slow request detection and recording
 * - Active request tracking
 *
 * Designed as a lightweight in-memory collector with bounded memory usage.
 */

import { logger } from '@stv/core/utils/logger';
import { computePercentiles, type Percentiles } from '@stv/core/lib/metrics-utils';
import { CappedMap } from '@stv/core/lib/capped-map';
import { sanitizeFinite } from '@stv/core/utils/guards';

// Re-exported so the previously-local `Percentiles` type keeps its public path.
export type { Percentiles };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Prometheus-style HTTP status class ('1xx' … '5xx'). */
export type HttpStatusClass = '1xx' | '2xx' | '3xx' | '4xx' | '5xx';

/**
 * Canonical status-code → status-class classifier.
 *
 * Single source of truth for the class boundaries: the collector uses it to
 * bucket each request into `statusClassCounts`, and the Prometheus exporter
 * labels its samples from those counts. Before this existed as ONE def, the
 * exporter re-derived classes from `count`/`errorCount` arithmetic — a 404
 * storm rendered as `status_class="5xx"` (client errors indistinguishable
 * from server errors) and 3xx redirects folded into "2xx".
 */
export function statusCodeClass(code: number): HttpStatusClass {
  if (code < 200) return '1xx';
  if (code < 300) return '2xx';
  if (code < 400) return '3xx';
  if (code < 500) return '4xx';
  return '5xx';
}

/** Zeroed per-class counter, so every class key is always present. */
function zeroClassCounts(): Record<HttpStatusClass, number> {
  return { '1xx': 0, '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
}

export interface RouteMetrics {
  method: string;
  path: string;
  count: number;
  errorCount: number;
  /** Per-status-class request counts (4xx and 5xx kept distinct). */
  statusClassCounts: Record<HttpStatusClass, number>;
  lastStatusCode: number;
  latencies: number[]; // bounded circular buffer
  minMs: number;
  maxMs: number;
  sumMs: number;
}

export interface SlowRequest {
  method: string;
  path: string;
  durationMs: number;
  statusCode: number;
  timestamp: number;
  correlationId: string;
}

export interface RouteMetricsSnapshot {
  method: string;
  path: string;
  count: number;
  errorCount: number;
  /** Per-status-class request counts (4xx and 5xx kept distinct). */
  statusClassCounts: Record<HttpStatusClass, number>;
  errorRate: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  percentiles: Percentiles;
}

export interface HttpMetricsSnapshot {
  totalRequests: number;
  totalErrors: number;
  globalErrorRate: number;
  activeRequests: number;
  routes: RouteMetricsSnapshot[];
  slowRequests: SlowRequest[];
  uptime: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface HttpMetricsConfig {
  /** Max latency samples retained per route (default: 1000) */
  maxSamplesPerRoute: number;
  /** Requests slower than this (ms) are recorded as slow (default: 5000) */
  slowRequestThresholdMs: number;
  /** Max slow request records retained (default: 50) */
  maxSlowRequests: number;
  /**
   * Max distinct route entries retained (default: 1000).
   *
   * The route key is `${method} ${path}`, and the metrics middleware feeds the
   * RAW `req.path` — which carries high-cardinality dynamic segments
   * (`/api/batch/status/<jobId>`). Without a cap the `routes` map grew without
   * bound (one entry per distinct path ever seen). The `CappedMap` enforces this
   * ceiling on every insert, FIFO-evicting the oldest-inserted route, so memory
   * is bounded regardless of path cardinality.
   */
  maxRoutes: number;
}

const DEFAULT_CONFIG: HttpMetricsConfig = {
  maxSamplesPerRoute: 1000,
  slowRequestThresholdMs: 5000,
  maxSlowRequests: 50,
  maxRoutes: 1000,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function routeKey(method: string, path: string): string {
  return `${method} ${path}`;
}

// ---------------------------------------------------------------------------
// HttpMetricsCollector
// ---------------------------------------------------------------------------

export class HttpMetricsCollector {
  /**
   * Per-route metrics, keyed `${method} ${path}`. A `CappedMap` (not a plain
   * `Map`) so the entry count is structurally bounded: the key is the raw
   * request path, which is high-cardinality, and a plain `Map` grew without
   * limit. The cap (`config.maxRoutes`) FIFO-evicts the oldest-inserted route
   * on every new-key insert — the sibling arrays (`latencies`, `slowRequests`)
   * were always capped; the map itself was the missing-cap sibling.
   */
  private routes: CappedMap<string, RouteMetrics>;
  private slowRequests: SlowRequest[] = [];
  private activeRequests = 0;
  private totalRequests = 0;
  private totalErrors = 0;
  private startTime = Date.now();
  private readonly config: HttpMetricsConfig;

  constructor(config?: Partial<HttpMetricsConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.routes = new CappedMap<string, RouteMetrics>(this.config.maxRoutes);
  }

  // ---- Recording ----

  /** Called when a request starts. */
  startRequest(): void {
    this.activeRequests++;
  }

  /** Called when a request finishes. */
  recordRequest(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    correlationId: string = '-',
  ): void {
    // Ingestion chokepoint: durationMs feeds the per-route sumMs accumulator
    // (→ avgMs), the min/max bounds and the latencies buffer (→ percentiles)
    // that the snapshot publishes to the dashboard / Prometheus exporter. A
    // single NaN/±∞ sample is sticky through +, / and sort, contaminating every
    // route aggregate. Same leak class as recordStageDuration
    // (pipeline-metrics-collector) and RealTimePerformanceMonitor ingestion.
    durationMs = sanitizeFinite(durationMs);
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    this.totalRequests++;

    const isError = statusCode >= 400;
    if (isError) this.totalErrors++;

    // Per-route metrics
    const key = routeKey(method, path);
    let route = this.routes.get(key);
    if (!route) {
      route = {
        method,
        path,
        count: 0,
        errorCount: 0,
        statusClassCounts: zeroClassCounts(),
        lastStatusCode: 0,
        latencies: [],
        minMs: Infinity,
        maxMs: 0,
        sumMs: 0,
      };
      this.routes.set(key, route);
    }

    route.count++;
    route.statusClassCounts[statusCodeClass(statusCode)]++;
    route.lastStatusCode = statusCode;
    route.sumMs += durationMs;
    if (isError) route.errorCount++;
    if (durationMs < route.minMs) route.minMs = durationMs;
    if (durationMs > route.maxMs) route.maxMs = durationMs;

    // Bounded latency buffer
    route.latencies.push(durationMs);
    if (route.latencies.length > this.config.maxSamplesPerRoute) {
      route.latencies = route.latencies.slice(-Math.floor(this.config.maxSamplesPerRoute / 2));
    }

    // Slow request detection
    if (durationMs >= this.config.slowRequestThresholdMs) {
      logger.warn(
        `[http-metrics] Slow request: ${method} ${path} ${durationMs}ms (${statusCode}) rid=${correlationId}`,
      );
      this.slowRequests.push({
        method,
        path,
        durationMs,
        statusCode,
        timestamp: Date.now(),
        correlationId,
      });
      if (this.slowRequests.length > this.config.maxSlowRequests) {
        this.slowRequests = this.slowRequests.slice(-this.config.maxSlowRequests);
      }
    }
  }

  // ---- Snapshot ----

  getSnapshot(): HttpMetricsSnapshot {
    const routes: RouteMetricsSnapshot[] = [];
    for (const [, r] of this.routes) {
      const sorted = [...r.latencies].sort((a, b) => a - b);
      routes.push({
        method: r.method,
        path: r.path,
        count: r.count,
        errorCount: r.errorCount,
        statusClassCounts: { ...r.statusClassCounts },
        errorRate: r.count > 0 ? r.errorCount / r.count : 0,
        avgMs: r.count > 0 ? Math.round(r.sumMs / r.count) : 0,
        minMs: r.minMs === Infinity ? 0 : r.minMs,
        maxMs: r.maxMs,
        percentiles: computePercentiles(sorted),
      });
    }

    // Sort by count descending
    routes.sort((a, b) => b.count - a.count);

    return {
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      globalErrorRate: this.totalRequests > 0 ? this.totalErrors / this.totalRequests : 0,
      activeRequests: this.activeRequests,
      routes,
      slowRequests: [...this.slowRequests],
      uptime: Date.now() - this.startTime,
    };
  }

  /** Reset all collected metrics. Useful for testing. */
  reset(): void {
    this.routes.clear();
    this.slowRequests = [];
    this.activeRequests = 0;
    this.totalRequests = 0;
    this.totalErrors = 0;
    this.startTime = Date.now();
  }
}

// ---------------------------------------------------------------------------
// Global singleton
// ---------------------------------------------------------------------------

export const httpMetricsCollector = new HttpMetricsCollector();
