/**
 * Production Health Check Service
 * Phase 20: Production Excellence
 *
 * Provides comprehensive health checks for production deployment
 * Implements readiness probes, liveness probes, and detailed diagnostics
 */

import { realTimeMonitor, PerformanceSnapshot } from './real-time-performance-monitor';
import { ERROR_RATE_WARNING_THRESHOLD, ERROR_RATE_CRITICAL_THRESHOLD } from './error-rate-thresholds';
import { globalCache } from '@/performance/intelligent-cache';
import { roundTo, heapUsagePercent, bytesToMb } from '@stv/core/lib/metrics-utils';
import { getMemoryUsage } from '@stv/core/utils/memory-usage';
import { logger } from '@stv/core/utils/logger';

/**
 * Interval at which {@link HealthCheckService} refreshes its cached health
 * snapshot in `startPeriodicHealthChecks`. Exported so consumers that derive
 * timing FROM that cached snapshot (e.g. useAdminAnalytics computes
 * `nextDueAt = lastCheckedAt + HEALTH_CHECK_INTERVAL_MS`) read the SAME value
 * rather than re-hard-coding `10000` behind a "// matches" comment — the
 * producer/consumer desync trap where changing this interval would silently
 * make the dashboard's "next check due" countdown wrong.
 */
export const HEALTH_CHECK_INTERVAL_MS = 10_000;

/**
 * Type guard predicate for backend-supplied numeric metrics.
 *
 * Every `checkXxxHealth` method gates its downstream threshold comparisons
 * (`x > 0.95`, `usagePercent < 70`, etc.) on a finite numeric input. Without
 * this guard, `undefined > 0.95` and `NaN < 70` both evaluate to FALSE, which
 * silently routes missing/non-finite fields into the `else` branch — the
 * fabricated "unhealthy: NaN% success rate" / "critical: NaN% memory usage"
 * verdicts that REQ-347/348/349/350/351 routed to a `degraded` "monitoring
 * unavailable" return instead.
 *
 * Returning `value is number` narrows the call-site so the same expression
 * can be used in compound conditions (`!isFiniteMetric(a) || !isFiniteMetric(b)`)
 * without re-checking the type before the arithmetic.
 *
 * NOTE: `checkMemoryHealth` intentionally uses `typeof !== 'number'` alone
 * (no `Number.isFinite`) because its backend contract is "either BOTH heapUsed
 * and heapTotal are present numbers, or treat as unavailable" — the browser
 * path omits BOTH fields wholesale (memory-usage.test.ts:73), so the NaN case
 * is unreachable through that channel. Adding the finite check here would
 * widen the contract beyond what the existing tests pin.
 */
function isFiniteMetric(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Names of components checked during a health check. */
type ComponentName = 'memory' | 'cache' | 'pipeline' | 'llm' | 'errorRecovery' | 'performance';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  uptime: number;
  checks: Record<ComponentName, ComponentHealth>;
  metrics: PerformanceSnapshot;
  recommendations: string[];
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  latency?: number;
  lastChecked: number;
  details?: Record<string, unknown>;
}

export interface ReadinessProbe {
  ready: boolean;
  reason?: string;
}

export interface LivenessProbe {
  alive: boolean;
  reason?: string;
}

class HealthCheckService {
  private startTime: number = Date.now();
  private lastHealthCheck: HealthCheckResult | null = null;
  private componentHealthCache: Map<ComponentName, ComponentHealth> = new Map();
  private readonly HEALTH_CACHE_TTL_MS = 5000; // 5 seconds
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Skip background intervals in test environment to prevent Jest worker leaks.
    // JEST_WORKER_ID is set by Jest regardless of NODE_ENV overrides in tests.
    if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
      this.startPeriodicHealthChecks();
    }
  }

  /**
   * Stop periodic health checks and clean up resources.
   * Call this on shutdown or in afterAll() to prevent interval leaks.
   */
  public destroy(): void {
    if (this.healthCheckInterval !== null) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Perform comprehensive health check
   */
  public async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checks = {} as Record<ComponentName, ComponentHealth>;

    // Check all system components
    checks.memory = await this.checkMemoryHealth();
    checks.cache = await this.checkCacheHealth();
    checks.pipeline = await this.checkPipelineHealth();
    checks.llm = await this.checkLLMHealth();
    checks.errorRecovery = await this.checkErrorRecoveryHealth();
    checks.performance = await this.checkPerformanceHealth();

    // Determine overall status
    const statuses = Object.values(checks).map(c => c.status);
    const status = this.calculateOverallStatus(statuses);

    // Get performance metrics
    let metrics: PerformanceSnapshot;
    try {
      metrics = realTimeMonitor.getSnapshot();
    } catch (error) {
      logger.error('[HealthCheck] Failed to get performance snapshot for metrics:', error);
      // Fallback: construct minimal metrics so health check still succeeds
      metrics = {
        timestamp: Date.now(),
        uptime: 0,
        system: { cpuUsagePercent: 0, memoryUsageMB: 0, memoryUsagePercent: 0, heapUsedMB: 0, heapTotalMB: 0 },
        pipeline: { totalRequests: 0, successRate: 0, avgProcessingTime: 0, p95ProcessingTime: 0, p99ProcessingTime: 0, activeRequests: 0 },
        llm: { totalRequests: 0, cacheHitRate: 0, flashUsagePercent: 0, proUsagePercent: 0, avgFlashResponseTime: 0, avgProResponseTime: 0, estimatedCostSavings: 0 },
        errors: { totalErrors: 0, errorRate: 0, recoverySuccessRate: 0, recentErrors: [] },
        quality: { transcriptionAccuracy: 0, layoutOverlapRate: 0, avgSceneQuality: 0 },
      };
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(checks, metrics);

    const result: HealthCheckResult = {
      status,
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      checks,
      metrics,
      recommendations
    };

    this.lastHealthCheck = result;
    return result;
  }

  /**
   * Check memory health
   */
  private async checkMemoryHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();

    let memoryUsage;
    try {
      memoryUsage = getMemoryUsage();
    } catch (err) {
      logger?.warn?.(`[HealthCheck] Memory health check failed: ${(err as Error).message}`, err as Error);
      return {
        status: 'degraded',
        message: `Memory monitoring unavailable: ${(err as Error).message}`,
        latency: Date.now() - startTime,
        lastChecked: Date.now(),
      };
    }
    // Phase-145 (REQ-334) only guarded rss/external (`?? Number.NaN`) and
    // left heapUsed/heapTotal as plain reads. The browser path of
    // @stv/core/utils/memory-usage is documented to omit ALL fields
    // (memory-usage.test.ts line 73), so an omitted backend now feeds
    // `undefined` straight into bytesToMb / heapUsagePercent — the result
    // is NaN, and `NaN < 70` is FALSE, which accidentally routes every
    // missing-field case through the `else` branch and reports "unhealthy"
    // ("Memory usage is critical (NaN%)"). Mirror the catch block's
    // fail-loud contract so consumers see the real reason instead of a
    // fabricated critical state (REQ-347, see specs/speech-to-visuals/
    // tasks/TASK-0243.md §義務 A).
    if (typeof memoryUsage.heapUsed !== 'number' || typeof memoryUsage.heapTotal !== 'number') {
      const heapUsedType =
        memoryUsage.heapUsed === undefined ? 'undefined' : typeof memoryUsage.heapUsed;
      const heapTotalType =
        memoryUsage.heapTotal === undefined ? 'undefined' : typeof memoryUsage.heapTotal;
      logger?.warn?.(
        `[HealthCheck] Memory health check unavailable: backend omitted fields ` +
          `(heapUsed=${heapUsedType}, heapTotal=${heapTotalType})`
      );
      return {
        status: 'degraded',
        message: 'Memory monitoring unavailable: backend omitted heapUsed/heapTotal',
        latency: Date.now() - startTime,
        lastChecked: Date.now(),
      };
    }
    const heapUsedMB = bytesToMb(memoryUsage.heapUsed);
    const heapTotalMB = bytesToMb(memoryUsage.heapTotal);
    const usagePercent = heapUsagePercent(memoryUsage.heapUsed, memoryUsage.heapTotal);

    let status: 'healthy' | 'degraded' | 'unhealthy';
    let message: string;

    if (usagePercent < 70) {
      status = 'healthy';
      message = `Memory usage is healthy (${usagePercent.toFixed(1)}%)`;
    } else if (usagePercent < 90) {
      status = 'degraded';
      message = `Memory usage is elevated (${usagePercent.toFixed(1)}%)`;
    } else {
      status = 'unhealthy';
      message = `Memory usage is critical (${usagePercent.toFixed(1)}%)`;
    }

    return {
      status,
      message,
      latency: Date.now() - startTime,
      lastChecked: Date.now(),
      details: {
        heapUsedMB: roundTo(heapUsedMB, 2),
        heapTotalMB: roundTo(heapTotalMB, 2),
        usagePercent: roundTo(usagePercent, 2),
        // rss/external are optional on MemoryMetrics (the browser path omits
        // them). The old `!` fed `undefined` straight into bytesToMb where
        // `undefined / (1024 * 1024)` is already NaN — `?? Number.NaN`
        // formalizes that identical outcome; `?? 0` would fabricate a
        // healthy-looking "0 MiB" reading (Phase 145, REQ-334).
        rss: roundTo(bytesToMb(memoryUsage.rss ?? Number.NaN), 2),
        external: roundTo(bytesToMb(memoryUsage.external ?? Number.NaN), 2)
      }
    };
  }

  /**
   * Check cache health
   */
  private async checkCacheHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();

    let stats: Awaited<ReturnType<typeof globalCache.getStats>>;
    try {
      stats = globalCache.getStats();
    } catch (error) {
      logger.warn('[HealthCheck] Cache health check failed:', error);
      return {
        status: 'degraded',
        message: 'Cache backend unreachable',
        latency: Date.now() - startTime,
        lastChecked: Date.now(),
      };
    }

    // REQ-348 (MW-023, Phase 157): Phase 142's `intelligent-cache` self-referential
    // formula fix (commit 2428e472) closed the *updater* path, but `getStats()` still
    // returns a stats object whose `totalHits`/`totalMisses` may be undefined when the
    // count fields were never populated, forcing the fallback `stats.hitRate *
    // stats.totalEntries`. The compound formula `totalHits/(totalHits+totalMisses) || 0`
    // then collapses two distinct silent-corruption paths into a fabricated
    // "Cache is ineffective (0% hit rate)" status that fires the unhealthy branch:
    //   (1) `stats.hitRate === undefined`/`stats.totalEntries === undefined`
    //       → `Math.round(undefined * N)` = NaN → `NaN / NaN` = NaN → `|| 0` → 0%.
    //   (2) `stats.hitRate === NaN` (broken backend returning a non-finite rate)
    //       → `Math.round(NaN * N)` = NaN → same downstream collapse.
    // Either way the upstream dashboard sees a fabricated `unhealthy` "Cache is
    // ineffective" message and `generateRecommendations` emits "CRITICAL: Cache is
    // ineffective - review caching strategy" for an UNKNOWN observation window.
    // Mirror `checkMemoryHealth`'s fail-loud contract (MW-022) so the real reason
    // (non-finite or omitted metrics) is visible instead of a fabricated critical.
    if (!isFiniteMetric(stats.hitRate) || !isFiniteMetric(stats.totalEntries)) {
      logger?.warn?.(
        `[HealthCheck] Cache health check unavailable: backend returned non-finite or omitted metrics ` +
          `(hitRate=${typeof stats.hitRate === 'number' ? stats.hitRate : 'undefined'}, ` +
          `totalEntries=${typeof stats.totalEntries === 'number' ? stats.totalEntries : 'undefined'})`
      );
      return {
        status: 'degraded',
        message: 'Cache monitoring unavailable: backend returned non-finite or omitted metrics',
        latency: Date.now() - startTime,
        lastChecked: Date.now(),
      };
    }

    const totalHits = stats.totalHits ?? Math.round(stats.hitRate * stats.totalEntries);
    const totalMisses = stats.totalMisses ?? Math.round((1 - stats.hitRate) * stats.totalEntries);
    const hitRate = totalHits / (totalHits + totalMisses) || 0;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    let message: string;

    if (hitRate > 0.5) {
      status = 'healthy';
      message = `Cache is performing well (${(hitRate * 100).toFixed(1)}% hit rate)`;
    } else if (hitRate > 0.2) {
      status = 'degraded';
      message = `Cache efficiency is below optimal (${(hitRate * 100).toFixed(1)}% hit rate)`;
    } else {
      status = 'unhealthy';
      message = `Cache is ineffective (${(hitRate * 100).toFixed(1)}% hit rate)`;
    }

    return {
      status,
      message,
      latency: Date.now() - startTime,
      lastChecked: Date.now(),
      details: {
        currentSize: stats.currentSize ?? stats.totalEntries,
        maxSize: stats.maxSize ?? -1,
        hitRate: roundTo(hitRate, 3),
        totalHits,
        totalMisses,
        evictions: stats.evictions ?? stats.evictionCount
      }
    };
  }

  /**
   * Check pipeline health
   */
  private async checkPipelineHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();

    let snapshot: PerformanceSnapshot;
    try {
      snapshot = realTimeMonitor.getSnapshot();
    } catch (error) {
      logger.warn('[HealthCheck] Pipeline health check failed:', error);
      return {
        status: 'degraded',
        message: 'Pipeline metrics unavailable',
        latency: Date.now() - startTime,
        lastChecked: Date.now(),
      };
    }

    const successRate = snapshot.pipeline.successRate;
    const activeRequests = snapshot.pipeline.activeRequests;
    const avgProcessingTime = snapshot.pipeline.avgProcessingTime;

    // REQ-349 (MW-024, Phase 158): `realTimeMonitor.getSnapshot()` may omit
    // `successRate` / `avgProcessingTime` (browser-shape fields can be
    // undefined) or return non-finite values when the pipeline backend's
    // internal state trips. Without this guard, undefined fed into
    // `successRate > 0.95` is `false` AND `NaN < 60000` is `false`, routing
    // every missing-field case to the `else` branch and the fabricated
    // "Pipeline is experiencing issues (NaN% success rate)" verdict that
    // `generateRecommendations` escalates to a CRITICAL recommendation for an
    // UNKNOWN observation window. Mirror `checkMemoryHealth`'s (REQ-347) and
    // `checkCacheHealth`'s (REQ-348) fail-loud contract so the upstream
    // dashboard sees the real reason instead of a fabricated unhealthy.
    if (!isFiniteMetric(successRate) || !isFiniteMetric(avgProcessingTime)) {
      const successRateType =
        successRate === undefined ? 'undefined' : typeof successRate;
      const avgProcessingTimeType =
        avgProcessingTime === undefined ? 'undefined' : typeof avgProcessingTime;
      logger?.warn?.(
        `[HealthCheck] Pipeline health check unavailable: backend omitted fields ` +
          `(successRate=${successRateType}, avgProcessingTime=${avgProcessingTimeType})`
      );
      return {
        status: 'degraded',
        message: 'Pipeline monitoring unavailable: backend omitted successRate/avgProcessingTime',
        latency: Date.now() - startTime,
        lastChecked: Date.now(),
      };
    }

    let status: 'healthy' | 'degraded' | 'unhealthy';
    let message: string;

    if (successRate > 0.95 && avgProcessingTime < 60000) {
      status = 'healthy';
      message = `Pipeline is operating normally (${(successRate * 100).toFixed(1)}% success rate)`;
    } else if (successRate > 0.80 && avgProcessingTime < 120000) {
      status = 'degraded';
      message = `Pipeline performance is degraded (${(successRate * 100).toFixed(1)}% success rate)`;
    } else {
      status = 'unhealthy';
      message = `Pipeline is experiencing issues (${(successRate * 100).toFixed(1)}% success rate)`;
    }

    return {
      status,
      message,
      latency: Date.now() - startTime,
      lastChecked: Date.now(),
      details: {
        totalRequests: snapshot.pipeline.totalRequests,
        successRate: roundTo(successRate, 3),
        avgProcessingTime: Math.round(avgProcessingTime),
        p95ProcessingTime: snapshot.pipeline.p95ProcessingTime,
        activeRequests
      }
    };
  }

  /**
   * Check LLM integration health
   */
  private async checkLLMHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();

    let snapshot: PerformanceSnapshot;
    try {
      snapshot = realTimeMonitor.getSnapshot();
    } catch (error) {
      logger.warn('[HealthCheck] LLM health check failed:', error);
      return {
        status: 'degraded',
        message: 'LLM metrics unavailable',
        latency: Date.now() - startTime,
        lastChecked: Date.now(),
      };
    }

    // REQ-350 (MW-025, Phase 159): Phase 142's `intelligent-cache` self-referential
    // formula fix closed the *updater* path, but `realTimeMonitor.getSnapshot().llm`
    // can still return non-finite (NaN) or omitted `cacheHitRate` when the LLM
    // backend's metrics stream drops the field. The downstream comparison
    //   `cacheHitRate > 0.4` / `cacheHitRate > 0.2`
    // evaluates to FALSE for both `undefined` and `NaN`, so the call collides
    // into the `else` branch and reports `unhealthy` "LLM integration may have
    // issues (NaN% cache hit rate)" — the upstream dashboard sees a fabricated
    // critical for an UNKNOWN observation window and `generateRecommendations`
    // emits a CRITICAL recommendation for an absent signal. Mirror
    // `checkMemoryHealth`'s (REQ-347) / `checkCacheHealth`'s (REQ-348) /
    // `checkPipelineHealth`'s (REQ-349) fail-loud contract so the real reason
    // (non-finite or omitted metrics) is visible instead of a fabricated critical.
    const cacheHitRate = snapshot.llm.cacheHitRate;
    const totalRequests = snapshot.llm.totalRequests;

    if (!isFiniteMetric(cacheHitRate)) {
      logger?.warn?.(
        `[HealthCheck] LLM health check unavailable: backend omitted/non-finite metrics ` +
          `(cacheHitRate=${typeof cacheHitRate === 'number' ? cacheHitRate : 'undefined'})`
      );
      return {
        status: 'degraded',
        message: 'LLM integration unavailable: backend omitted/non-finite cacheHitRate',
        latency: Date.now() - startTime,
        lastChecked: Date.now(),
      };
    }

    let status: 'healthy' | 'degraded' | 'unhealthy';
    let message: string;

    if (cacheHitRate > 0.4 || totalRequests === 0) {
      status = 'healthy';
      message = `LLM integration is healthy (${(cacheHitRate * 100).toFixed(1)}% cache hit rate)`;
    } else if (cacheHitRate > 0.2) {
      status = 'degraded';
      message = `LLM cache efficiency is below optimal (${(cacheHitRate * 100).toFixed(1)}% cache hit rate)`;
    } else {
      status = 'unhealthy';
      message = `LLM integration may have issues (${(cacheHitRate * 100).toFixed(1)}% cache hit rate)`;
    }

    return {
      status,
      message,
      latency: Date.now() - startTime,
      lastChecked: Date.now(),
      details: {
        totalRequests,
        cacheHitRate: roundTo(cacheHitRate, 3),
        flashUsagePercent: snapshot.llm.flashUsagePercent,
        proUsagePercent: snapshot.llm.proUsagePercent,
        avgFlashResponseTime: snapshot.llm.avgFlashResponseTime,
        avgProResponseTime: snapshot.llm.avgProResponseTime
      }
    };
  }

  /**
   * Check error recovery health
   */
  private async checkErrorRecoveryHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();

    let snapshot: PerformanceSnapshot;
    try {
      snapshot = realTimeMonitor.getSnapshot();
    } catch (error) {
      logger.warn('[HealthCheck] Error recovery health check failed:', error);
      return {
        status: 'degraded',
        message: 'Error recovery metrics unavailable',
        latency: Date.now() - startTime,
        lastChecked: Date.now(),
      };
    }

    const errorRate = snapshot.errors.errorRate;
    const recoveryRate = snapshot.errors.recoverySuccessRate;

    // REQ-351 (MW-027, Phase 161): the last unguarded metric read in this
    // service. `realTimeMonitor.getSnapshot().errors` can return non-finite
    // (NaN) or omitted `errorRate` / `recoverySuccessRate` when the error
    // backend's metrics stream drops the fields. Both threshold chains
    //   `errorRate < WARNING && recoveryRate > 0.80`
    //   `errorRate < CRITICAL || recoveryRate > 0.50`
    // evaluate their NaN/undefined operands to FALSE, so a dropped field
    // collides into the `else if` / `else` branches and reports a fabricated
    // "Error recovery is degraded/failing (NaN.0% ...)" verdict — the upstream
    // dashboard sees a degraded/unhealthy call with an unparsable NaN rate and
    // `generateRecommendations` acts on an absent signal. Mirror the
    // REQ-347/348/349/350 fail-loud contract so the real reason (non-finite or
    // omitted metrics) is visible instead of a fabricated verdict.
    if (!isFiniteMetric(errorRate) || !isFiniteMetric(recoveryRate)) {
      const errorRateType = errorRate === undefined ? 'undefined' : typeof errorRate;
      const recoveryRateType =
        recoveryRate === undefined ? 'undefined' : typeof recoveryRate;
      logger?.warn?.(
        `[HealthCheck] Error recovery health check unavailable: backend omitted fields ` +
          `(errorRate=${errorRateType}, recoverySuccessRate=${recoveryRateType})`
      );
      return {
        status: 'degraded',
        message:
          'Error recovery unavailable: backend omitted/non-finite errorRate/recoverySuccessRate',
        latency: Date.now() - startTime,
        lastChecked: Date.now(),
      };
    }

    let status: 'healthy' | 'degraded' | 'unhealthy';
    let message: string;

    if (errorRate < ERROR_RATE_WARNING_THRESHOLD && recoveryRate > 0.80) {
      status = 'healthy';
      message = `Error recovery is functioning well (${(errorRate * 100).toFixed(1)}% error rate, ${(recoveryRate * 100).toFixed(1)}% recovery rate)`;
    } else if (errorRate < ERROR_RATE_CRITICAL_THRESHOLD || recoveryRate > 0.50) {
      status = 'degraded';
      message = `Error recovery is degraded (${(errorRate * 100).toFixed(1)}% error rate, ${(recoveryRate * 100).toFixed(1)}% recovery rate)`;
    } else {
      status = 'unhealthy';
      message = `Error recovery is failing (${(errorRate * 100).toFixed(1)}% error rate, ${(recoveryRate * 100).toFixed(1)}% recovery rate)`;
    }

    return {
      status,
      message,
      latency: Date.now() - startTime,
      lastChecked: Date.now(),
      details: {
        totalErrors: snapshot.errors.totalErrors,
        errorRate: roundTo(errorRate, 3),
        recoverySuccessRate: roundTo(recoveryRate, 3),
        recentErrors: snapshot.errors.recentErrors.slice(0, 5)
      }
    };
  }

  /**
   * Check overall performance health
   */
  private async checkPerformanceHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();

    let trends: Array<{ metric: string; trend: string; changePercent: number }>;
    try {
      trends = realTimeMonitor.analyzeTrends();
    } catch (error) {
      logger.warn('[HealthCheck] Performance health check failed:', error);
      return {
        status: 'degraded',
        message: 'Performance trend analysis unavailable',
        latency: Date.now() - startTime,
        lastChecked: Date.now(),
      };
    }

    const degradingTrends = trends.filter(t => t.trend === 'degrading');
    const improvingTrends = trends.filter(t => t.trend === 'improving');

    let status: 'healthy' | 'degraded' | 'unhealthy';
    let message: string;

    if (degradingTrends.length === 0) {
      status = 'healthy';
      message = `Performance trends are positive (${improvingTrends.length} improving trends)`;
    } else if (degradingTrends.length <= 2) {
      status = 'degraded';
      message = `Some performance metrics are degrading (${degradingTrends.length} degrading trends)`;
    } else {
      status = 'unhealthy';
      message = `Multiple performance metrics are degrading (${degradingTrends.length} degrading trends)`;
    }

    return {
      status,
      message,
      latency: Date.now() - startTime,
      lastChecked: Date.now(),
      details: {
        totalTrends: trends.length,
        improvingTrends: improvingTrends.length,
        degradingTrends: degradingTrends.length,
        stableTrends: trends.filter(t => t.trend === 'stable').length,
        trendSummary: trends.map(t => ({
          metric: t.metric,
          trend: t.trend,
          changePercent: t.changePercent
        }))
      }
    };
  }

  /**
   * Calculate overall system status
   */
  private calculateOverallStatus(statuses: Array<'healthy' | 'degraded' | 'unhealthy'>): 'healthy' | 'degraded' | 'unhealthy' {
    if (statuses.some(s => s === 'unhealthy')) {
      return 'unhealthy';
    }
    if (statuses.some(s => s === 'degraded')) {
      return 'degraded';
    }
    return 'healthy';
  }

  /**
   * Generate recommendations based on health checks
   */
  private generateRecommendations(
    checks: Record<ComponentName, ComponentHealth>,
    metrics: PerformanceSnapshot
  ): string[] {
    const recommendations: string[] = [];

    // Memory recommendations
    if (checks.memory.status === 'degraded' || checks.memory.status === 'unhealthy') {
      recommendations.push('Consider increasing memory allocation or implementing memory optimization');
      // REQ-352 (MW-028, Phase 162): the checkXxxHealth guards (REQ-347~351)
      // close the *verdict* path, but this recommendation gate reads the SAME
      // snapshot that carries the browser-path omission REQ-347 documented:
      // `getSnapshot().system.memoryUsagePercent` is NaN when the memory
      // backend omits heapUsed/heapTotal, and `NaN > 85` is FALSE — the
      // CRITICAL escalation is then silently suppressed, indistinguishable
      // from "not high". Surface an explicit unavailable note instead so the
      // operator sees that criticality was NOT assessed (same fail-loud
      // contract, applied to the recommendation layer).
      if (isFiniteMetric(metrics.system.memoryUsagePercent)) {
        if (metrics.system.memoryUsagePercent > 85) {
          recommendations.push('CRITICAL: Memory usage is very high - immediate action required');
        }
      } else {
        logger?.warn?.(
          `[HealthCheck] memoryUsagePercent is non-finite ` +
            `(${typeof metrics.system.memoryUsagePercent === 'number' ? metrics.system.memoryUsagePercent : 'undefined'})` +
            ` - memory criticality could not be assessed`
        );
        recommendations.push(
          'WARNING: Memory usage metric unavailable - criticality could not be assessed'
        );
      }
    }

    // Cache recommendations
    if (checks.cache.status === 'degraded') {
      recommendations.push('Optimize cache configuration: increase size or adjust TTL settings');
    } else if (checks.cache.status === 'unhealthy') {
      recommendations.push('CRITICAL: Cache is ineffective - review caching strategy');
    }

    // Pipeline recommendations
    if (checks.pipeline.status === 'degraded') {
      recommendations.push('Pipeline performance degraded - consider optimizing processing stages');
      // REQ-353 (MW-029, Phase 162): same FALSE-fication pattern as REQ-352 —
      // `undefined/NaN > 10` is FALSE, so the horizontal-scaling advice is
      // silently suppressed for an absent signal instead of being reported as
      // unassessed. Mirror the fail-loud note contract.
      if (isFiniteMetric(metrics.pipeline.activeRequests)) {
        if (metrics.pipeline.activeRequests > 10) {
          recommendations.push('High number of active requests - consider horizontal scaling');
        }
      } else {
        logger?.warn?.(
          `[HealthCheck] activeRequests is non-finite ` +
            `(${typeof metrics.pipeline.activeRequests === 'number' ? metrics.pipeline.activeRequests : 'undefined'})` +
            ` - scaling headroom could not be assessed`
        );
        recommendations.push(
          'WARNING: Active-request count unavailable - scaling headroom could not be assessed'
        );
      }
    } else if (checks.pipeline.status === 'unhealthy') {
      recommendations.push('CRITICAL: Pipeline experiencing severe issues - immediate investigation required');
    }

    // LLM recommendations
    if (checks.llm.status === 'degraded') {
      recommendations.push('LLM cache efficiency low - review cache invalidation patterns');
    } else if (checks.llm.status === 'unhealthy') {
      recommendations.push('LLM integration issues detected - check API connectivity and quotas');
    }

    // Error recovery recommendations
    if (checks.errorRecovery.status === 'degraded') {
      recommendations.push('Error rate elevated - review recent errors and improve error handling');
    } else if (checks.errorRecovery.status === 'unhealthy') {
      recommendations.push('CRITICAL: High error rate with low recovery - system stability at risk');
    }

    // Performance trend recommendations
    if (checks.performance.status === 'degraded') {
      recommendations.push('Performance trends show degradation - monitor closely and optimize bottlenecks');
    } else if (checks.performance.status === 'unhealthy') {
      recommendations.push('CRITICAL: Multiple performance metrics degrading - comprehensive optimization needed');
    }

    // If everything is healthy
    if (recommendations.length === 0) {
      recommendations.push('System is operating optimally - continue monitoring');
    }

    return recommendations;
  }

  /**
   * Kubernetes-style readiness probe
   * Returns true if system is ready to accept requests
   */
  public async checkReadiness(): Promise<ReadinessProbe> {
    try {
      const health = this.lastHealthCheck || await this.performHealthCheck();

      // System is ready if not unhealthy
      const ready = health.status !== 'unhealthy';

      return {
        ready,
        reason: ready
          ? 'System is ready to accept requests'
          : `System is unhealthy: ${Object.entries(health.checks)
              .filter(([, check]) => check.status === 'unhealthy')
              .map(([name]) => name)
              .join(', ')}`
      };
    } catch (error) {
      return {
        ready: false,
        reason: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Kubernetes-style liveness probe
   * Returns true if system is alive (even if degraded)
   */
  public async checkLiveness(): Promise<LivenessProbe> {
    try {
      // Check if basic system functions are responsive
      const startTime = Date.now();
      const memoryUsage = getMemoryUsage();
      const latency = Date.now() - startTime;

      // REQ-354 (MW-030, Phase 162): the memory sanity conjunct
      // `heapUsed > 0` FALSE-fies on the SAME browser-path omission REQ-347
      // documented (backend omits heapUsed) and on non-finite values — the
      // probe then reports alive=false with a LATENCY reason even though the
      // measured latency was fine, fabricating a dead verdict (a restart
      // trigger for GET /health/live) out of a missing metric. Treat an
      // unavailable memory metric as "sanity check skipped" (latency remains
      // the responsiveness signal) and name the real condition in the reason.
      const memoryMetricAvailable =
        typeof memoryUsage.heapUsed === 'number' && Number.isFinite(memoryUsage.heapUsed);
      const alive = latency < 1000 && (!memoryMetricAvailable || memoryUsage.heapUsed > 0);

      return {
        alive,
        reason: alive
          ? memoryMetricAvailable
            ? 'System is responsive'
            : 'System is responsive (memory metric unavailable: backend omitted/non-finite heapUsed)'
          : latency >= 1000
            ? `System responsiveness issue (latency: ${latency}ms)`
            : `Memory sanity check failed (heapUsed=${memoryUsage.heapUsed})`
      };
    } catch (error) {
      return {
        alive: false,
        reason: `Liveness check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get cached health check result
   */
  public getCachedHealth(): HealthCheckResult | null {
    return this.lastHealthCheck;
  }

  /**
   * Start periodic health checks
   */
  private startPeriodicHealthChecks(): void {
    // Refresh every HEALTH_CHECK_INTERVAL_MS (10s). This export is the single
    // source of truth — useAdminAnalytics derives `nextDueAt` from the same
    // constant so the producer (here) and consumer never drift apart.
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('[HealthCheck] Periodic health check failed:', error);
      }
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  /**
   * Get system uptime in milliseconds
   */
  public getUptime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get system uptime as human-readable string
   */
  public getUptimeString(): string {
    const uptime = this.getUptime();
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

// Global singleton instance
export const healthCheckService = new HealthCheckService();

// Export class for testing and custom instantiation
export { HealthCheckService };
