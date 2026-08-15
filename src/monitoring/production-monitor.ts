/**
 * Phase 36: Production Monitoring System
 *
 * Real-time health monitoring for production deployment
 * Implements autonomous quality tracking and alerting based on
 * Custom Instructions Section 9.2 (Continuous Improvement Metrics)
 *
 * Features:
 * - Real-time health checks
 * - Performance degradation detection
 * - Automatic alerting for threshold violations
 * - Historical trend analysis
 * - Self-healing recommendations
 */

import { QualityMonitor, QualityMetrics, QualityReport } from '../pipeline/quality-monitor';
import { ERROR_RATE_WARNING_THRESHOLD, ERROR_RATE_CRITICAL_THRESHOLD } from './error-rate-thresholds';
import { computePercentiles, safeMean } from '@/lib/metrics-utils';
import * as fs from 'fs';
import * as path from 'path';

export interface HealthCheckResult {
  timestamp: Date;
  status: 'healthy' | 'degraded' | 'critical' | 'unknown';
  components: {
    transcription: ComponentHealth;
    analysis: ComponentHealth;
    visualization: ComponentHealth;
    rendering: ComponentHealth;
  };
  alerts: Alert[];
  recommendations: string[];
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'critical' | 'unknown';
  metrics: {
    successRate: number; // 0-1
    averageLatency: number; // ms
    errorRate: number; // 0-1
  };
  lastError?: string;
  lastSuccess?: Date;
}

export interface Alert {
  severity: 'critical' | 'warning' | 'info';
  component: string;
  message: string;
  metric: string;
  threshold: number;
  actual: number;
  timestamp: Date;
  actionRequired: string;
}

export interface ProductionMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageProcessingTime: number;
  p95ProcessingTime: number;
  p99ProcessingTime: number;
  errorsByType: Map<string, number>;
  componentMetrics: {
    transcription: ComponentMetrics;
    analysis: ComponentMetrics;
    visualization: ComponentMetrics;
    rendering: ComponentMetrics;
  };
}

export interface ComponentMetrics {
  requests: number;
  successes: number;
  failures: number;
  averageLatency: number;
  p95Latency: number;
  errors: Array<{ timestamp: Date; error: string }>;
}

/**
 * ProductionMonitor - Autonomous production health monitoring
 *
 * Continuously monitors system health and provides actionable insights
 * Based on Custom Instructions Section 5.1 (Quality Metrics)
 */
export class ProductionMonitor {
  private static instance: ProductionMonitor;
  private qualityMonitor: QualityMonitor;

  private metrics: ProductionMetrics;
  private healthHistory: HealthCheckResult[] = [];
  private processingTimes: number[] = [];
  private maxHistorySize = 1000;
  /**
   * Per-component count of latencies actually folded into
   * `componentMetrics.averageLatency`. The incremental mean must NOT divide
   * by `successes`: `recordSuccess` is a public API taking a caller-supplied
   * number, and a non-finite latency is excluded from the mean (D2) while the
   * request still counts as a success. It also cannot reuse the running mean
   * after a non-finite sample — `NaN * n = NaN` poisons the accumulator
   * PERMANENTLY (the rolling mean never recovers, even after later finite
   * samples), so exclusion is tracked by an explicit per-component count.
   */
  private readonly componentLatencyCounts = new Map<string, number>();

  // Thresholds from Custom Instructions Section 5.1
  private readonly thresholds = {
    crashRate: 0.1, // Max 10% crash rate
    successRate: 0.9, // Min 90% success rate
    averageLatency: 60000, // Max 60s average processing time
    p95Latency: 90000, // Max 90s for 95th percentile
    errorRateWarning: ERROR_RATE_WARNING_THRESHOLD, // Warning at 5% error rate
    errorRateCritical: ERROR_RATE_CRITICAL_THRESHOLD, // Critical at 15% error rate
  };

  private constructor() {
    this.qualityMonitor = QualityMonitor.getInstance();
    this.metrics = this.initializeMetrics();
  }

  static getInstance(): ProductionMonitor {
    if (!ProductionMonitor.instance) {
      ProductionMonitor.instance = new ProductionMonitor();
    }
    return ProductionMonitor.instance;
  }

  private initializeMetrics(): ProductionMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageProcessingTime: 0,
      p95ProcessingTime: 0,
      p99ProcessingTime: 0,
      errorsByType: new Map(),
      componentMetrics: {
        transcription: this.initializeComponentMetrics(),
        analysis: this.initializeComponentMetrics(),
        visualization: this.initializeComponentMetrics(),
        rendering: this.initializeComponentMetrics(),
      },
    };
  }

  private initializeComponentMetrics(): ComponentMetrics {
    return {
      requests: 0,
      successes: 0,
      failures: 0,
      averageLatency: 0,
      p95Latency: 0,
      errors: [],
    };
  }

  /**
   * Record successful pipeline execution
   */
  recordSuccess(
    component: 'transcription' | 'analysis' | 'visualization' | 'rendering',
    latency: number
  ): void {
    this.metrics.totalRequests++;
    this.metrics.successfulRequests++;
    this.processingTimes.push(latency);

    // Update component metrics
    const compMetrics = this.metrics.componentMetrics[component];
    compMetrics.requests++;
    compMetrics.successes++;
    if (Number.isFinite(latency)) {
      const latencyCount = (this.componentLatencyCounts.get(component) ?? 0) + 1;
      this.componentLatencyCounts.set(component, latencyCount);
      compMetrics.averageLatency =
        (compMetrics.averageLatency * (latencyCount - 1) + latency) / latencyCount;
    }

    // Keep processing times bounded
    if (this.processingTimes.length > this.maxHistorySize) {
      this.processingTimes.shift();
    }

    this.updateAggregateMetrics();
  }

  /**
   * Record pipeline failure
   */
  recordFailure(
    component: 'transcription' | 'analysis' | 'visualization' | 'rendering',
    error: string,
    latency: number = 0
  ): void {
    this.metrics.totalRequests++;
    this.metrics.failedRequests++;

    // Track error types
    const errorType = this.categorizeError(error);
    this.metrics.errorsByType.set(
      errorType,
      (this.metrics.errorsByType.get(errorType) || 0) + 1
    );

    // Update component metrics
    const compMetrics = this.metrics.componentMetrics[component];
    compMetrics.requests++;
    compMetrics.failures++;
    compMetrics.errors.push({ timestamp: new Date(), error });

    // Keep error history bounded
    if (compMetrics.errors.length > 100) {
      compMetrics.errors.shift();
    }

    this.updateAggregateMetrics();
  }

  private categorizeError(error: string): string {
    if (error.includes('timeout') || error.includes('ETIMEDOUT')) {
      return 'timeout';
    } else if (error.includes('API') || error.includes('quota')) {
      return 'api_error';
    } else if (error.includes('memory') || error.includes('OOM')) {
      return 'memory_error';
    } else if (error.includes('permission') || error.includes('EACCES')) {
      return 'permission_error';
    } else {
      return 'unknown_error';
    }
  }

  private updateAggregateMetrics(): void {
    if (this.processingTimes.length === 0) return;

    // safeMean (D2 exclusion): a non-finite latency leaves the population
    // instead of poisoning the mean. The raw fold divided by array length —
    // one NaN made averageProcessingTime NaN, which then flowed into the
    // health-check comparisons as false-y (silently "healthy").
    this.metrics.averageProcessingTime = safeMean(this.processingTimes);

    // Canonical floor-rank percentiles — the same computePercentiles the
    // pipeline/http/export collectors already delegate to. This was the last
    // hand-rolled floor-rank twin, and the inline shape had silently drifted
    // from the canonical one (no index clamp, `|| 0` falsy fallback that
    // coerced a NaN percentile to a fast-looking 0). Non-finite samples are
    // excluded before ranking; value-identical to the old form on finite
    // samples (floor(n·f) ≤ n−1 for every fraction < 1, so the canonical
    // clamp never binds).
    const sorted = this.processingTimes
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => a - b);
    const { p95, p99 } = computePercentiles(sorted);
    this.metrics.p95ProcessingTime = p95;
    this.metrics.p99ProcessingTime = p99;
  }

  /**
   * Perform comprehensive health check
   */
  performHealthCheck(): HealthCheckResult {
    const alerts: Alert[] = [];
    const recommendations: string[] = [];

    // Check each component
    const components = {
      transcription: this.checkComponentHealth('transcription'),
      analysis: this.checkComponentHealth('analysis'),
      visualization: this.checkComponentHealth('visualization'),
      rendering: this.checkComponentHealth('rendering'),
    };

    // Generate alerts
    Object.values(components).forEach(comp => {
      if (comp.status === 'critical') {
        alerts.push({
          severity: 'critical',
          component: comp.name,
          message: `${comp.name} component is in critical state`,
          metric: 'errorRate',
          threshold: this.thresholds.errorRateCritical,
          actual: comp.metrics.errorRate,
          timestamp: new Date(),
          actionRequired: `Immediate investigation required. Check ${comp.name} logs and restart if necessary.`,
        });
      } else if (comp.status === 'degraded') {
        alerts.push({
          severity: 'warning',
          component: comp.name,
          message: `${comp.name} component performance degraded`,
          metric: 'errorRate',
          threshold: this.thresholds.errorRateWarning,
          actual: comp.metrics.errorRate,
          timestamp: new Date(),
          actionRequired: `Monitor closely. Consider scaling ${comp.name} resources.`,
        });
      }
    });

    // Check overall success rate
    const successRate = this.metrics.totalRequests > 0
      ? this.metrics.successfulRequests / this.metrics.totalRequests
      : 1;

    if (successRate < this.thresholds.successRate) {
      alerts.push({
        severity: 'critical',
        component: 'system',
        message: 'Overall success rate below threshold',
        metric: 'successRate',
        threshold: this.thresholds.successRate,
        actual: successRate,
        timestamp: new Date(),
        actionRequired: 'Review error logs and identify root cause. May require rollback.',
      });
    }

    // Check processing time
    if (this.metrics.averageProcessingTime > this.thresholds.averageLatency) {
      alerts.push({
        severity: 'warning',
        component: 'system',
        message: 'Average processing time exceeds threshold',
        metric: 'averageLatency',
        threshold: this.thresholds.averageLatency,
        actual: this.metrics.averageProcessingTime,
        timestamp: new Date(),
        actionRequired: 'Optimize slow components or increase resource allocation.',
      });
    }

    // Generate recommendations
    recommendations.push(...this.generateRecommendations(components, alerts));

    // Determine overall status
    const status = this.determineOverallStatus(components, alerts);

    const result: HealthCheckResult = {
      timestamp: new Date(),
      status,
      components,
      alerts,
      recommendations,
    };

    this.healthHistory.push(result);
    if (this.healthHistory.length > 100) {
      this.healthHistory.shift();
    }

    return result;
  }

  private checkComponentHealth(
    component: 'transcription' | 'analysis' | 'visualization' | 'rendering'
  ): ComponentHealth {
    const metrics = this.metrics.componentMetrics[component];

    const successRate = metrics.requests > 0
      ? metrics.successes / metrics.requests
      : 1;

    const errorRate = 1 - successRate;

    let status: ComponentHealth['status'];
    if (errorRate >= this.thresholds.errorRateCritical) {
      status = 'critical';
    } else if (errorRate >= this.thresholds.errorRateWarning) {
      status = 'degraded';
    } else if (metrics.requests > 0) {
      status = 'healthy';
    } else {
      status = 'unknown';
    }

    return {
      name: component,
      status,
      metrics: {
        successRate,
        averageLatency: metrics.averageLatency,
        errorRate,
      },
      lastError: metrics.errors[metrics.errors.length - 1]?.error,
      lastSuccess: metrics.successes > 0 ? new Date() : undefined,
    };
  }

  private determineOverallStatus(
    components: Record<string, ComponentHealth>,
    alerts: Alert[]
  ): HealthCheckResult['status'] {
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    const degradedComponents = Object.values(components).filter(c => c.status === 'degraded');
    const criticalComponents = Object.values(components).filter(c => c.status === 'critical');

    if (criticalAlerts.length > 0 || criticalComponents.length > 0) {
      return 'critical';
    } else if (degradedComponents.length > 0) {
      return 'degraded';
    } else if (this.metrics.totalRequests === 0) {
      return 'unknown';
    } else {
      return 'healthy';
    }
  }

  private generateRecommendations(
    components: Record<string, ComponentHealth>,
    alerts: Alert[]
  ): string[] {
    const recommendations: string[] = [];

    // Component-specific recommendations
    if (components.transcription.status === 'degraded') {
      recommendations.push('Consider using faster Whisper model or increase timeout settings');
    }

    if (components.analysis.status === 'degraded') {
      recommendations.push('Switch from Gemini Pro to Flash model for faster processing');
      recommendations.push('Enable aggressive caching for frequently analyzed content');
    }

    if (components.rendering.status === 'degraded') {
      recommendations.push('Reduce video quality settings or use parallel rendering');
    }

    // Error type recommendations
    const timeoutErrors = this.metrics.errorsByType.get('timeout') || 0;
    if (timeoutErrors > 5) {
      recommendations.push(`${timeoutErrors} timeout errors detected. Increase timeout thresholds or optimize processing.`);
    }

    const apiErrors = this.metrics.errorsByType.get('api_error') || 0;
    if (apiErrors > 3) {
      recommendations.push(`${apiErrors} API errors detected. Check API quota and rate limits.`);
    }

    // General recommendations
    if (this.metrics.totalRequests === 0) {
      recommendations.push('No requests processed yet. System status unknown.');
    } else if (alerts.length === 0) {
      recommendations.push('System healthy. Continue monitoring for trends.');
    }

    return recommendations;
  }

  /**
   * Get current production metrics
   */
  getMetrics(): ProductionMetrics {
    return { ...this.metrics };
  }

  /**
   * Export metrics for monitoring dashboard
   */
  exportMetrics(): string {
    const metrics = this.getMetrics();
    const successRate = metrics.totalRequests > 0
      ? ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)
      : 'N/A';

    let output = '\n';
    output += '╔════════════════════════════════════════════════════════════════╗\n';
    output += '║              📊 PRODUCTION METRICS REPORT                     ║\n';
    output += '╚════════════════════════════════════════════════════════════════╝\n\n';

    output += `📈 Overall Metrics:\n`;
    output += `   Total Requests: ${metrics.totalRequests}\n`;
    output += `   Successful: ${metrics.successfulRequests}\n`;
    output += `   Failed: ${metrics.failedRequests}\n`;
    output += `   Success Rate: ${successRate}%\n`;
    output += `   Avg Processing Time: ${(metrics.averageProcessingTime / 1000).toFixed(2)}s\n`;
    output += `   P95 Processing Time: ${(metrics.p95ProcessingTime / 1000).toFixed(2)}s\n`;
    output += `   P99 Processing Time: ${(metrics.p99ProcessingTime / 1000).toFixed(2)}s\n\n`;

    output += `🔧 Component Metrics:\n`;
    Object.entries(metrics.componentMetrics).forEach(([name, compMetrics]) => {
      const rate = compMetrics.requests > 0
        ? ((compMetrics.successes / compMetrics.requests) * 100).toFixed(1)
        : 'N/A';
      output += `   ${name}:\n`;
      output += `     Requests: ${compMetrics.requests}\n`;
      output += `     Success Rate: ${rate}%\n`;
      output += `     Avg Latency: ${(compMetrics.averageLatency / 1000).toFixed(2)}s\n`;
      output += `     Recent Errors: ${compMetrics.errors.slice(-3).length}\n`;
    });

    output += `\n⚠️  Error Distribution:\n`;
    if (metrics.errorsByType.size === 0) {
      output += `   No errors recorded\n`;
    } else {
      metrics.errorsByType.forEach((count, type) => {
        output += `   ${type}: ${count}\n`;
      });
    }

    output += '\n' + '='.repeat(70) + '\n';

    return output;
  }

  /**
   * Save metrics to file for historical analysis
   */
  async saveMetricsToFile(outputPath: string): Promise<void> {
    const data = {
      timestamp: new Date().toISOString(),
      metrics: this.getMetrics(),
      healthHistory: this.healthHistory.slice(-10), // Last 10 health checks
    };

    await fs.promises.writeFile(
      outputPath,
      JSON.stringify(data, null, 2),
      'utf-8'
    );

  }

  /**
   * Reset metrics (for testing or new deployment)
   */
  reset(): void {
    this.metrics = this.initializeMetrics();
    this.healthHistory = [];
    this.processingTimes = [];
    // Without this the incremental component means would divide by stale
    // counts against the zeroed accumulators after a reset.
    this.componentLatencyCounts.clear();
  }
}

/**
 * Convenience function to get global monitor instance
 */
export function getProductionMonitor(): ProductionMonitor {
  return ProductionMonitor.getInstance();
}

/**
 * Format health check result for display
 */
export function formatHealthCheck(result: HealthCheckResult): string {
  const statusIcon =
    result.status === 'healthy' ? '✅' :
    result.status === 'degraded' ? '⚠️' :
    result.status === 'critical' ? '🔴' : '❓';

  let output = '\n';
  output += '╔════════════════════════════════════════════════════════════════╗\n';
  output += '║              🏥 SYSTEM HEALTH CHECK REPORT                    ║\n';
  output += '╚════════════════════════════════════════════════════════════════╝\n\n';

  output += `${statusIcon} Overall Status: ${result.status.toUpperCase()}\n`;
  output += `⏰ Timestamp: ${result.timestamp.toISOString()}\n\n`;

  output += `📊 Component Health:\n`;
  Object.values(result.components).forEach(comp => {
    const icon =
      comp.status === 'healthy' ? '✅' :
      comp.status === 'degraded' ? '⚠️' :
      comp.status === 'critical' ? '🔴' : '❓';

    output += `   ${icon} ${comp.name}:\n`;
    output += `      Success Rate: ${(comp.metrics.successRate * 100).toFixed(1)}%\n`;
    output += `      Avg Latency: ${(comp.metrics.averageLatency / 1000).toFixed(2)}s\n`;
    output += `      Error Rate: ${(comp.metrics.errorRate * 100).toFixed(1)}%\n`;
    if (comp.lastError) {
      output += `      Last Error: ${comp.lastError.substring(0, 50)}...\n`;
    }
  });

  if (result.alerts.length > 0) {
    output += `\n🚨 Active Alerts:\n`;
    result.alerts.forEach(alert => {
      const icon = alert.severity === 'critical' ? '🔴' : '⚠️';
      output += `   ${icon} [${alert.severity.toUpperCase()}] ${alert.message}\n`;
      output += `      Component: ${alert.component}\n`;
      output += `      Metric: ${alert.metric} (${alert.actual.toFixed(2)} vs threshold ${alert.threshold.toFixed(2)})\n`;
      output += `      Action: ${alert.actionRequired}\n\n`;
    });
  }

  if (result.recommendations.length > 0) {
    output += `💡 Recommendations:\n`;
    result.recommendations.forEach(rec => {
      output += `   • ${rec}\n`;
    });
  }

  output += '\n' + '='.repeat(70) + '\n';

  return output;
}
