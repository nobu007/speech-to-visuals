/**
 * Quality Monitoring System
 * Iteration 67 Phase B2 - カスタムインストラクション準拠
 *
 * 目的: システム品質をリアルタイムで監視し、問題を早期発見
 */

export interface QualityMetrics {
  // Performance Metrics
  performance: {
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
  };

  // System Health
  system: {
    memoryUsage: number;
    cpuUsage: number;
    uptime: number;
    activeConnections: number;
  };

  // Business Metrics
  business: {
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    successRate: number;
  };

  // Quality Scores
  quality: {
    overall: number; // 0-100
    performance: number; // 0-100
    reliability: number; // 0-100
    security: number; // 0-100
  };
}

export interface QualityThresholds {
  performance: {
    maxAvgResponseTime: number; // ms
    maxP95ResponseTime: number; // ms
    maxErrorRate: number; // percentage
    minRequestsPerSecond: number;
  };

  system: {
    maxMemoryUsage: number; // MB
    maxCpuUsage: number; // percentage
  };

  business: {
    minSuccessRate: number; // percentage
  };
}

export interface QualityAlert {
  level: 'info' | 'warning' | 'critical';
  category: 'performance' | 'system' | 'business' | 'security';
  message: string;
  metric: string;
  actualValue: number;
  thresholdValue: number;
  timestamp: Date;
}

export class QualityMonitor {
  private metrics: QualityMetrics;
  private thresholds: QualityThresholds;
  private alerts: QualityAlert[] = [];
  private responseTimeSamples: number[] = [];
  private maxSamples = 1000;

  constructor(thresholds?: Partial<QualityThresholds>) {
    this.metrics = this.initializeMetrics();
    this.thresholds = {
      performance: {
        maxAvgResponseTime: 100,
        maxP95ResponseTime: 200,
        maxErrorRate: 1.0,
        minRequestsPerSecond: 1,
        ...thresholds?.performance
      },
      system: {
        maxMemoryUsage: 512,
        maxCpuUsage: 80,
        ...thresholds?.system
      },
      business: {
        minSuccessRate: 95,
        ...thresholds?.business
      }
    };
  }

  private initializeMetrics(): QualityMetrics {
    return {
      performance: {
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        requestsPerSecond: 0,
        errorRate: 0
      },
      system: {
        memoryUsage: 0,
        cpuUsage: 0,
        uptime: 0,
        activeConnections: 0
      },
      business: {
        totalJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        successRate: 100
      },
      quality: {
        overall: 100,
        performance: 100,
        reliability: 100,
        security: 100
      }
    };
  }

  /**
   * Record a response time sample
   */
  recordResponseTime(time: number): void {
    this.responseTimeSamples.push(time);

    // Keep only recent samples
    if (this.responseTimeSamples.length > this.maxSamples) {
      this.responseTimeSamples.shift();
    }

    this.updatePerformanceMetrics();
  }

  /**
   * Record a job completion
   */
  recordJobCompletion(success: boolean): void {
    this.metrics.business.totalJobs++;

    if (success) {
      this.metrics.business.completedJobs++;
    } else {
      this.metrics.business.failedJobs++;
    }

    this.updateBusinessMetrics();
  }

  /**
   * Update system metrics
   */
  updateSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    this.metrics.system.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB
    this.metrics.system.uptime = process.uptime();

    // CPU usage would require external library, simplified here
    this.metrics.system.cpuUsage = 0;

    this.checkSystemThresholds();
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    if (this.responseTimeSamples.length === 0) return;

    const sorted = [...this.responseTimeSamples].sort((a, b) => a - b);

    this.metrics.performance.avgResponseTime =
      sorted.reduce((a, b) => a + b, 0) / sorted.length;

    this.metrics.performance.p95ResponseTime =
      sorted[Math.floor(sorted.length * 0.95)] || 0;

    this.metrics.performance.p99ResponseTime =
      sorted[Math.floor(sorted.length * 0.99)] || 0;

    this.checkPerformanceThresholds();
    this.updateQualityScores();
  }

  /**
   * Update business metrics
   */
  private updateBusinessMetrics(): void {
    if (this.metrics.business.totalJobs > 0) {
      this.metrics.business.successRate =
        (this.metrics.business.completedJobs / this.metrics.business.totalJobs) * 100;
    }

    this.checkBusinessThresholds();
    this.updateQualityScores();
  }

  /**
   * Check performance thresholds and create alerts
   */
  private checkPerformanceThresholds(): void {
    const perf = this.metrics.performance;
    const thresh = this.thresholds.performance;

    if (perf.avgResponseTime > thresh.maxAvgResponseTime) {
      this.createAlert({
        level: 'warning',
        category: 'performance',
        message: 'Average response time exceeds threshold',
        metric: 'avgResponseTime',
        actualValue: perf.avgResponseTime,
        thresholdValue: thresh.maxAvgResponseTime,
        timestamp: new Date()
      });
    }

    if (perf.p95ResponseTime > thresh.maxP95ResponseTime) {
      this.createAlert({
        level: 'critical',
        category: 'performance',
        message: 'P95 response time exceeds threshold',
        metric: 'p95ResponseTime',
        actualValue: perf.p95ResponseTime,
        thresholdValue: thresh.maxP95ResponseTime,
        timestamp: new Date()
      });
    }

    if (perf.errorRate > thresh.maxErrorRate) {
      this.createAlert({
        level: 'critical',
        category: 'performance',
        message: 'Error rate exceeds threshold',
        metric: 'errorRate',
        actualValue: perf.errorRate,
        thresholdValue: thresh.maxErrorRate,
        timestamp: new Date()
      });
    }
  }

  /**
   * Check system thresholds
   */
  private checkSystemThresholds(): void {
    const sys = this.metrics.system;
    const thresh = this.thresholds.system;

    if (sys.memoryUsage > thresh.maxMemoryUsage) {
      this.createAlert({
        level: 'warning',
        category: 'system',
        message: 'Memory usage exceeds threshold',
        metric: 'memoryUsage',
        actualValue: sys.memoryUsage,
        thresholdValue: thresh.maxMemoryUsage,
        timestamp: new Date()
      });
    }

    if (sys.cpuUsage > thresh.maxCpuUsage) {
      this.createAlert({
        level: 'critical',
        category: 'system',
        message: 'CPU usage exceeds threshold',
        metric: 'cpuUsage',
        actualValue: sys.cpuUsage,
        thresholdValue: thresh.maxCpuUsage,
        timestamp: new Date()
      });
    }
  }

  /**
   * Check business thresholds
   */
  private checkBusinessThresholds(): void {
    const biz = this.metrics.business;
    const thresh = this.thresholds.business;

    if (biz.successRate < thresh.minSuccessRate) {
      this.createAlert({
        level: 'critical',
        category: 'business',
        message: 'Job success rate below threshold',
        metric: 'successRate',
        actualValue: biz.successRate,
        thresholdValue: thresh.minSuccessRate,
        timestamp: new Date()
      });
    }
  }

  /**
   * Create an alert
   */
  private createAlert(alert: QualityAlert): void {
    // Avoid duplicate alerts (same metric within 1 minute)
    const recentAlert = this.alerts.find(
      a =>
        a.metric === alert.metric &&
        Date.now() - a.timestamp.getTime() < 60000
    );

    if (!recentAlert) {
      this.alerts.push(alert);
      console.warn(`[Quality Alert] ${alert.level.toUpperCase()}: ${alert.message}`);
      console.warn(`  Metric: ${alert.metric}`);
      console.warn(`  Actual: ${alert.actualValue.toFixed(2)}`);
      console.warn(`  Threshold: ${alert.thresholdValue.toFixed(2)}`);
    }
  }

  /**
   * Update overall quality scores
   */
  private updateQualityScores(): void {
    // Performance score (based on response time and error rate)
    const perfScore = this.calculatePerformanceScore();
    this.metrics.quality.performance = perfScore;

    // Reliability score (based on success rate)
    const reliabilityScore = this.calculateReliabilityScore();
    this.metrics.quality.reliability = reliabilityScore;

    // Overall score (weighted average)
    this.metrics.quality.overall = Math.round(
      perfScore * 0.4 +
      reliabilityScore * 0.4 +
      this.metrics.quality.security * 0.2
    );
  }

  /**
   * Calculate performance score
   */
  private calculatePerformanceScore(): number {
    const perf = this.metrics.performance;
    const thresh = this.thresholds.performance;

    let score = 100;

    // Deduct points for response time
    const rtRatio = perf.avgResponseTime / thresh.maxAvgResponseTime;
    if (rtRatio > 1) {
      score -= Math.min(40, (rtRatio - 1) * 40);
    }

    // Deduct points for error rate
    const errRatio = perf.errorRate / thresh.maxErrorRate;
    if (errRatio > 1) {
      score -= Math.min(40, (errRatio - 1) * 40);
    }

    return Math.max(0, Math.round(score));
  }

  /**
   * Calculate reliability score
   */
  private calculateReliabilityScore(): number {
    const successRate = this.metrics.business.successRate;
    const thresh = this.thresholds.business.minSuccessRate;

    if (successRate >= thresh) {
      return 100;
    }

    // Linear scale from 0 to 100 based on success rate
    return Math.round((successRate / thresh) * 100);
  }

  /**
   * Get current metrics
   */
  getMetrics(): QualityMetrics {
    this.updateSystemMetrics();
    return { ...this.metrics };
  }

  /**
   * Get recent alerts
   */
  getAlerts(limit: number = 10): QualityAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Get quality report
   */
  getQualityReport(): {
    metrics: QualityMetrics;
    alerts: QualityAlert[];
    thresholds: QualityThresholds;
    status: 'healthy' | 'degraded' | 'critical';
  } {
    this.updateSystemMetrics();

    const criticalAlerts = this.alerts.filter(a => a.level === 'critical').length;
    const warningAlerts = this.alerts.filter(a => a.level === 'warning').length;

    let status: 'healthy' | 'degraded' | 'critical';
    if (criticalAlerts > 0) {
      status = 'critical';
    } else if (warningAlerts > 0) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      metrics: this.metrics,
      alerts: this.getAlerts(),
      thresholds: this.thresholds,
      status
    };
  }

  /**
   * Clear old alerts
   */
  clearOldAlerts(maxAge: number = 3600000): void {
    const cutoff = Date.now() - maxAge;
    this.alerts = this.alerts.filter(
      a => a.timestamp.getTime() > cutoff
    );
  }

  /**
   * Print quality report to console
   */
  printReport(): void {
    const report = this.getQualityReport();

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 Quality Monitoring Report');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log(`🏥 Status: ${report.status.toUpperCase()}`);
    console.log(`📈 Overall Quality Score: ${report.metrics.quality.overall}/100\n`);

    console.log('Performance Metrics:');
    console.log(`  Avg Response Time: ${report.metrics.performance.avgResponseTime.toFixed(2)}ms`);
    console.log(`  P95 Response Time: ${report.metrics.performance.p95ResponseTime.toFixed(2)}ms`);
    console.log(`  Error Rate: ${report.metrics.performance.errorRate.toFixed(2)}%`);
    console.log(`  Quality Score: ${report.metrics.quality.performance}/100\n`);

    console.log('System Metrics:');
    console.log(`  Memory Usage: ${report.metrics.system.memoryUsage.toFixed(2)} MB`);
    console.log(`  Uptime: ${report.metrics.system.uptime.toFixed(0)}s\n`);

    console.log('Business Metrics:');
    console.log(`  Total Jobs: ${report.metrics.business.totalJobs}`);
    console.log(`  Completed: ${report.metrics.business.completedJobs}`);
    console.log(`  Failed: ${report.metrics.business.failedJobs}`);
    console.log(`  Success Rate: ${report.metrics.business.successRate.toFixed(2)}%`);
    console.log(`  Quality Score: ${report.metrics.quality.reliability}/100\n`);

    if (report.alerts.length > 0) {
      console.log(`⚠️  Recent Alerts (${report.alerts.length}):`);
      report.alerts.forEach(alert => {
        const icon = alert.level === 'critical' ? '🔴' : '🟡';
        console.log(`  ${icon} [${alert.category}] ${alert.message}`);
      });
      console.log();
    }

    console.log('═══════════════════════════════════════════════════════════════\n');
  }
}

// Singleton instance
export const qualityMonitor = new QualityMonitor();
