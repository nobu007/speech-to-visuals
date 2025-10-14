/**
 * Production Health Check Service
 * Phase 20: Production Excellence
 *
 * Provides comprehensive health checks for production deployment
 * Implements readiness probes, liveness probes, and detailed diagnostics
 */

import { realTimeMonitor, PerformanceSnapshot } from './real-time-performance-monitor';
import { globalCache } from '@/performance/intelligent-cache';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  uptime: number;
  checks: {
    [key: string]: ComponentHealth;
  };
  metrics: PerformanceSnapshot;
  recommendations: string[];
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  latency?: number;
  lastChecked: number;
  details?: Record<string, any>;
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
  private componentHealthCache: Map<string, ComponentHealth> = new Map();
  private readonly HEALTH_CACHE_TTL_MS = 5000; // 5 seconds

  constructor() {
    // Start periodic health checks
    this.startPeriodicHealthChecks();
  }

  /**
   * Perform comprehensive health check
   */
  public async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checks: { [key: string]: ComponentHealth } = {};

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
    const metrics = realTimeMonitor.getSnapshot();

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
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
    const usagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

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
        heapUsedMB: Math.round(heapUsedMB * 100) / 100,
        heapTotalMB: Math.round(heapTotalMB * 100) / 100,
        usagePercent: Math.round(usagePercent * 100) / 100,
        rss: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
        external: Math.round((memoryUsage.external / 1024 / 1024) * 100) / 100
      }
    };
  }

  /**
   * Check cache health
   */
  private async checkCacheHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    const stats = globalCache.getStats();

    const hitRate = stats.totalHits / (stats.totalHits + stats.totalMisses) || 0;

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
        currentSize: stats.currentSize,
        maxSize: stats.maxSize,
        hitRate: Math.round(hitRate * 1000) / 1000,
        totalHits: stats.totalHits,
        totalMisses: stats.totalMisses,
        evictions: stats.evictions
      }
    };
  }

  /**
   * Check pipeline health
   */
  private async checkPipelineHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    const snapshot = realTimeMonitor.getSnapshot();

    const successRate = snapshot.pipeline.successRate;
    const activeRequests = snapshot.pipeline.activeRequests;
    const avgProcessingTime = snapshot.pipeline.avgProcessingTime;

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
        successRate: Math.round(successRate * 1000) / 1000,
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
    const snapshot = realTimeMonitor.getSnapshot();

    const cacheHitRate = snapshot.llm.cacheHitRate;
    const totalRequests = snapshot.llm.totalRequests;

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
        cacheHitRate: Math.round(cacheHitRate * 1000) / 1000,
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
    const snapshot = realTimeMonitor.getSnapshot();

    const errorRate = snapshot.errors.errorRate;
    const recoveryRate = snapshot.errors.recoverySuccessRate;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    let message: string;

    if (errorRate < 0.05 && recoveryRate > 0.80) {
      status = 'healthy';
      message = `Error recovery is functioning well (${(errorRate * 100).toFixed(1)}% error rate, ${(recoveryRate * 100).toFixed(1)}% recovery rate)`;
    } else if (errorRate < 0.15 || recoveryRate > 0.50) {
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
        errorRate: Math.round(errorRate * 1000) / 1000,
        recoverySuccessRate: Math.round(recoveryRate * 1000) / 1000,
        recentErrors: snapshot.errors.recentErrors.slice(0, 5)
      }
    };
  }

  /**
   * Check overall performance health
   */
  private async checkPerformanceHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    const trends = realTimeMonitor.analyzeTrends();

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
    checks: { [key: string]: ComponentHealth },
    metrics: PerformanceSnapshot
  ): string[] {
    const recommendations: string[] = [];

    // Memory recommendations
    if (checks.memory.status === 'degraded' || checks.memory.status === 'unhealthy') {
      recommendations.push('Consider increasing memory allocation or implementing memory optimization');
      if (metrics.system.memoryUsagePercent > 85) {
        recommendations.push('CRITICAL: Memory usage is very high - immediate action required');
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
      if (metrics.pipeline.activeRequests > 10) {
        recommendations.push('High number of active requests - consider horizontal scaling');
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
      const memoryUsage = process.memoryUsage();
      const latency = Date.now() - startTime;

      // System is alive if it can respond within reasonable time
      const alive = latency < 1000 && memoryUsage.heapUsed > 0;

      return {
        alive,
        reason: alive
          ? 'System is responsive'
          : `System responsiveness issue (latency: ${latency}ms)`
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
    // Perform health check every 10 seconds
    setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('[HealthCheck] Periodic health check failed:', error);
      }
    }, 10000);
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

// Export types
export type { HealthCheckService };
