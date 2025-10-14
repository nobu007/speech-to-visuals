/**
 * Performance Monitoring Dashboard for Claude Code Excellence
 * 🔄 Real-time performance tracking and optimization for Audio-to-Diagram Pipeline
 * Provides comprehensive monitoring, alerting, and automatic optimization
 */

interface PerformanceMetrics {
  timestamp: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  processing: {
    transcriptionTime: number;
    analysisTime: number;
    layoutTime: number;
    renderTime: number;
    totalTime: number;
    // Phase 14: Parallel processing metrics
    parallelScenes?: number;
    parallelBatches?: number;
    parallelSpeedup?: number; // Ratio of sequential to parallel time
  };
  cache: {
    hitRate: number;
    efficiency: number;
    memoryUsage: number;
    size: number;
  };
  throughput: {
    requestsPerSecond: number;
    avgResponseTime: number;
    concurrentRequests: number;
  };
  quality: {
    successRate: number;
    errorRate: number;
    accuracyScore: number;
  };
  // Phase 14: Optimization metrics
  optimization?: {
    llmConcurrency: number;
    videoConcurrency: number;
    enabledOptimizations: string[];
    performanceGain: number; // Percentage improvement
  };
}

interface Alert {
  id: string;
  timestamp: number;
  level: 'info' | 'warning' | 'error' | 'critical';
  category: 'memory' | 'performance' | 'cache' | 'quality' | 'system';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  recommendation: string;
}

interface PerformanceThresholds {
  memory: {
    heapUsedMB: number;
    memoryLeakDetection: number;
  };
  processing: {
    maxTranscriptionTime: number;
    maxAnalysisTime: number;
    maxLayoutTime: number;
    maxTotalTime: number;
  };
  cache: {
    minHitRate: number;
    minEfficiency: number;
  };
  quality: {
    minSuccessRate: number;
    maxErrorRate: number;
  };
}

/**
 * Real-time Performance Monitoring Dashboard
 */
export class PerformanceDashboard {
  private metrics: PerformanceMetrics[] = [];
  private alerts: Alert[] = [];
  private thresholds: PerformanceThresholds;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertCallbacks: Array<(alert: Alert) => void> = [];
  private optimizationCallbacks: Array<() => Promise<void>> = [];

  // Real-time tracking
  private currentRequests = 0;
  private totalRequests = 0;
  private successfulRequests = 0;
  private startTime = Date.now();
  private lastOptimization = Date.now();

  constructor(thresholds: Partial<PerformanceThresholds> = {}) {
    this.thresholds = {
      memory: {
        heapUsedMB: 256,
        memoryLeakDetection: 1.5, // 50% increase detection
        ...thresholds.memory
      },
      processing: {
        maxTranscriptionTime: 15000, // 15 seconds
        maxAnalysisTime: 5000,       // 5 seconds
        maxLayoutTime: 3000,         // 3 seconds
        maxTotalTime: 30000,         // 30 seconds
        ...thresholds.processing
      },
      cache: {
        minHitRate: 0.7,     // 70% minimum hit rate
        minEfficiency: 0.8,   // 80% minimum efficiency
        ...thresholds.cache
      },
      quality: {
        minSuccessRate: 0.95, // 95% minimum success rate
        maxErrorRate: 0.05,   // 5% maximum error rate
        ...thresholds.quality
      }
    };

    console.log('📊 Performance Dashboard initialized with Claude Code excellence standards');
    this.startMonitoring();
  }

  /**
   * 🚀 Start real-time monitoring
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Monitor every 5 seconds for real-time updates
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.analyzePerformance();
      this.checkThresholds();
      this.autoOptimize();
    }, 5000);

    console.log('🔄 Real-time performance monitoring started');
  }

  /**
   * 🛑 Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log('⏹️ Performance monitoring stopped');
  }

  /**
   * 📊 Collect current performance metrics
   */
  private collectMetrics(): void {
    const now = Date.now();
    const uptime = now - this.startTime;

    // Memory metrics
    const memoryUsage = process.memoryUsage();

    // Calculate throughput
    const requestsPerSecond = this.totalRequests / (uptime / 1000);

    // Get cache metrics (would integrate with actual cache)
    const cacheMetrics = this.getCacheMetrics();

    const metrics: PerformanceMetrics = {
      timestamp: now,
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss
      },
      processing: {
        transcriptionTime: 0, // Will be updated by pipeline
        analysisTime: 0,
        layoutTime: 0,
        renderTime: 0,
        totalTime: 0
      },
      cache: cacheMetrics,
      throughput: {
        requestsPerSecond,
        avgResponseTime: this.calculateAvgResponseTime(),
        concurrentRequests: this.currentRequests
      },
      quality: {
        successRate: this.totalRequests > 0 ? this.successfulRequests / this.totalRequests : 1,
        errorRate: this.totalRequests > 0 ? (this.totalRequests - this.successfulRequests) / this.totalRequests : 0,
        accuracyScore: 0.95 // Would be calculated from actual results
      }
    };

    this.metrics.push(metrics);

    // Keep only last 1000 metrics (about 83 minutes at 5-second intervals)
    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }
  }

  /**
   * 📈 Analyze performance trends
   */
  private analyzePerformance(): void {
    if (this.metrics.length < 2) return;

    const current = this.metrics[this.metrics.length - 1];
    const previous = this.metrics[this.metrics.length - 2];

    // Memory trend analysis
    const memoryIncrease = (current.memory.heapUsed - previous.memory.heapUsed) / previous.memory.heapUsed;

    if (memoryIncrease > 0.1) { // 10% increase
      this.createAlert('warning', 'memory', 'Rapid memory increase detected',
        'memoryIncrease', memoryIncrease * 100, 10,
        'Monitor for memory leaks and consider garbage collection');
    }

    // Performance degradation analysis
    if (this.metrics.length >= 10) {
      const recent = this.metrics.slice(-10);
      const avgRecentResponseTime = recent.reduce((sum, m) => sum + m.throughput.avgResponseTime, 0) / recent.length;

      const earlier = this.metrics.slice(-20, -10);
      const avgEarlierResponseTime = earlier.reduce((sum, m) => sum + m.throughput.avgResponseTime, 0) / earlier.length;

      if (avgRecentResponseTime > avgEarlierResponseTime * 1.2) {
        this.createAlert('warning', 'performance', 'Performance degradation detected',
          'responseTime', avgRecentResponseTime, avgEarlierResponseTime,
          'Consider optimizing pipeline or increasing resources');
      }
    }
  }

  /**
   * 🚨 Check performance thresholds
   */
  private checkThresholds(): void {
    if (this.metrics.length === 0) return;

    const current = this.metrics[this.metrics.length - 1];

    // Memory thresholds
    const heapUsedMB = current.memory.heapUsed / (1024 * 1024);
    if (heapUsedMB > this.thresholds.memory.heapUsedMB) {
      this.createAlert('error', 'memory', 'High memory usage detected',
        'heapUsedMB', heapUsedMB, this.thresholds.memory.heapUsedMB,
        'Reduce memory usage or increase memory limits');
    }

    // Processing time thresholds
    if (current.processing.totalTime > this.thresholds.processing.maxTotalTime) {
      this.createAlert('warning', 'performance', 'Slow processing detected',
        'totalTime', current.processing.totalTime, this.thresholds.processing.maxTotalTime,
        'Optimize pipeline stages or increase parallel processing');
    }

    // Cache performance thresholds
    if (current.cache.hitRate < this.thresholds.cache.minHitRate) {
      this.createAlert('warning', 'cache', 'Low cache hit rate',
        'hitRate', current.cache.hitRate, this.thresholds.cache.minHitRate,
        'Optimize cache strategy or increase cache size');
    }

    // Quality thresholds
    if (current.quality.successRate < this.thresholds.quality.minSuccessRate) {
      this.createAlert('error', 'quality', 'Low success rate detected',
        'successRate', current.quality.successRate, this.thresholds.quality.minSuccessRate,
        'Investigate and fix pipeline failures');
    }
  }

  /**
   * 🚨 Create performance alert
   */
  private createAlert(
    level: Alert['level'],
    category: Alert['category'],
    message: string,
    metric: string,
    value: number,
    threshold: number,
    recommendation: string
  ): void {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      level,
      category,
      message,
      metric,
      value,
      threshold,
      recommendation
    };

    this.alerts.push(alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }

    // Notify alert callbacks
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Alert callback error:', error);
      }
    });

    console.log(`🚨 [${level.toUpperCase()}] ${category}: ${message} (${value.toFixed(2)} vs ${threshold})`);
  }

  /**
   * ⚡ Auto-optimization based on performance data
   */
  private async autoOptimize(): Promise<void> {
    const now = Date.now();

    // Only optimize every 30 seconds to avoid thrashing
    if (now - this.lastOptimization < 30000) return;

    if (this.shouldOptimize()) {
      this.lastOptimization = now;

      console.log('⚡ Auto-optimization triggered');

      // Trigger optimization callbacks
      for (const callback of this.optimizationCallbacks) {
        try {
          await callback();
        } catch (error) {
          console.error('Optimization callback error:', error);
        }
      }

      // Built-in optimizations
      await this.performBuiltInOptimizations();
    }
  }

  /**
   * 🎯 Determine if optimization should be triggered
   */
  private shouldOptimize(): boolean {
    if (this.metrics.length < 5) return false;

    const recent = this.metrics.slice(-5);
    const avgMetrics = this.calculateAverageMetrics(recent);

    // Optimize if any critical threshold is exceeded
    return (
      avgMetrics.memory.heapUsed / (1024 * 1024) > this.thresholds.memory.heapUsedMB * 0.8 ||
      avgMetrics.processing.totalTime > this.thresholds.processing.maxTotalTime * 0.8 ||
      avgMetrics.cache.hitRate < this.thresholds.cache.minHitRate ||
      avgMetrics.quality.successRate < this.thresholds.quality.minSuccessRate
    );
  }

  /**
   * 🔧 Perform built-in optimizations
   */
  private async performBuiltInOptimizations(): Promise<void> {
    const current = this.metrics[this.metrics.length - 1];

    // Memory optimization
    if (current.memory.heapUsed / (1024 * 1024) > this.thresholds.memory.heapUsedMB * 0.8) {
      if (global.gc) {
        global.gc();
        console.log('🧹 Forced garbage collection');
      }
    }

    // Cache optimization would happen here
    // Pipeline optimization would happen here

    console.log('⚡ Built-in optimizations completed');
  }

  /**
   * 📊 Calculate average metrics from array
   */
  private calculateAverageMetrics(metrics: PerformanceMetrics[]): PerformanceMetrics {
    if (metrics.length === 0) throw new Error('No metrics to average');

    const avg = metrics.reduce((acc, metric) => ({
      timestamp: metric.timestamp,
      memory: {
        heapUsed: acc.memory.heapUsed + metric.memory.heapUsed,
        heapTotal: acc.memory.heapTotal + metric.memory.heapTotal,
        external: acc.memory.external + metric.memory.external,
        rss: acc.memory.rss + metric.memory.rss
      },
      processing: {
        transcriptionTime: acc.processing.transcriptionTime + metric.processing.transcriptionTime,
        analysisTime: acc.processing.analysisTime + metric.processing.analysisTime,
        layoutTime: acc.processing.layoutTime + metric.processing.layoutTime,
        renderTime: acc.processing.renderTime + metric.processing.renderTime,
        totalTime: acc.processing.totalTime + metric.processing.totalTime
      },
      cache: {
        hitRate: acc.cache.hitRate + metric.cache.hitRate,
        efficiency: acc.cache.efficiency + metric.cache.efficiency,
        memoryUsage: acc.cache.memoryUsage + metric.cache.memoryUsage,
        size: acc.cache.size + metric.cache.size
      },
      throughput: {
        requestsPerSecond: acc.throughput.requestsPerSecond + metric.throughput.requestsPerSecond,
        avgResponseTime: acc.throughput.avgResponseTime + metric.throughput.avgResponseTime,
        concurrentRequests: acc.throughput.concurrentRequests + metric.throughput.concurrentRequests
      },
      quality: {
        successRate: acc.quality.successRate + metric.quality.successRate,
        errorRate: acc.quality.errorRate + metric.quality.errorRate,
        accuracyScore: acc.quality.accuracyScore + metric.quality.accuracyScore
      }
    }), {
      timestamp: 0,
      memory: { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 },
      processing: { transcriptionTime: 0, analysisTime: 0, layoutTime: 0, renderTime: 0, totalTime: 0 },
      cache: { hitRate: 0, efficiency: 0, memoryUsage: 0, size: 0 },
      throughput: { requestsPerSecond: 0, avgResponseTime: 0, concurrentRequests: 0 },
      quality: { successRate: 0, errorRate: 0, accuracyScore: 0 }
    });

    const count = metrics.length;
    return {
      timestamp: avg.timestamp,
      memory: {
        heapUsed: avg.memory.heapUsed / count,
        heapTotal: avg.memory.heapTotal / count,
        external: avg.memory.external / count,
        rss: avg.memory.rss / count
      },
      processing: {
        transcriptionTime: avg.processing.transcriptionTime / count,
        analysisTime: avg.processing.analysisTime / count,
        layoutTime: avg.processing.layoutTime / count,
        renderTime: avg.processing.renderTime / count,
        totalTime: avg.processing.totalTime / count
      },
      cache: {
        hitRate: avg.cache.hitRate / count,
        efficiency: avg.cache.efficiency / count,
        memoryUsage: avg.cache.memoryUsage / count,
        size: avg.cache.size / count
      },
      throughput: {
        requestsPerSecond: avg.throughput.requestsPerSecond / count,
        avgResponseTime: avg.throughput.avgResponseTime / count,
        concurrentRequests: avg.throughput.concurrentRequests / count
      },
      quality: {
        successRate: avg.quality.successRate / count,
        errorRate: avg.quality.errorRate / count,
        accuracyScore: avg.quality.accuracyScore / count
      }
    };
  }

  /**
   * 📊 Get cache metrics (placeholder for actual implementation)
   */
  private getCacheMetrics(): { hitRate: number; efficiency: number; memoryUsage: number; size: number } {
    // This would integrate with the actual cache system
    return {
      hitRate: 0.85,
      efficiency: 0.9,
      memoryUsage: 50 * 1024 * 1024, // 50MB
      size: 500
    };
  }

  /**
   * ⏱️ Calculate average response time
   */
  private calculateAvgResponseTime(): number {
    if (this.metrics.length < 5) return 0;

    const recent = this.metrics.slice(-5);
    return recent.reduce((sum, m) => sum + m.processing.totalTime, 0) / recent.length;
  }

  /**
   * 📈 Track request start
   */
  requestStart(): string {
    this.currentRequests++;
    this.totalRequests++;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return requestId;
  }

  /**
   * 📉 Track request completion
   */
  requestComplete(requestId: string, success: boolean, processingTimes?: {
    transcriptionTime?: number;
    analysisTime?: number;
    layoutTime?: number;
    renderTime?: number;
  }): void {
    this.currentRequests = Math.max(0, this.currentRequests - 1);

    if (success) {
      this.successfulRequests++;
    }

    // Update processing times in latest metrics if available
    if (processingTimes && this.metrics.length > 0) {
      const latest = this.metrics[this.metrics.length - 1];
      latest.processing = {
        transcriptionTime: processingTimes.transcriptionTime || 0,
        analysisTime: processingTimes.analysisTime || 0,
        layoutTime: processingTimes.layoutTime || 0,
        renderTime: processingTimes.renderTime || 0,
        totalTime: (processingTimes.transcriptionTime || 0) +
                  (processingTimes.analysisTime || 0) +
                  (processingTimes.layoutTime || 0) +
                  (processingTimes.renderTime || 0)
      };
    }
  }

  /**
   * 🔔 Register alert callback
   */
  onAlert(callback: (alert: Alert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * ⚡ Register optimization callback
   */
  onOptimization(callback: () => Promise<void>): void {
    this.optimizationCallbacks.push(callback);
  }

  /**
   * 📊 Get current dashboard data
   */
  getDashboardData(): {
    currentMetrics: PerformanceMetrics | null;
    recentMetrics: PerformanceMetrics[];
    activeAlerts: Alert[];
    summary: {
      uptime: number;
      totalRequests: number;
      successRate: number;
      avgResponseTime: number;
      memoryUsage: string;
      cacheHitRate: number;
    };
  } {
    const current = this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
    const recent = this.metrics.slice(-20); // Last 20 data points
    const activeAlerts = this.alerts.filter(alert =>
      Date.now() - alert.timestamp < 60000 // Active for 1 minute
    );

    const uptime = Date.now() - this.startTime;
    const avgResponseTime = this.calculateAvgResponseTime();
    const memoryUsage = current ?
      `${(current.memory.heapUsed / (1024 * 1024)).toFixed(1)}MB` : '0MB';

    return {
      currentMetrics: current,
      recentMetrics: recent,
      activeAlerts,
      summary: {
        uptime,
        totalRequests: this.totalRequests,
        successRate: this.totalRequests > 0 ? this.successfulRequests / this.totalRequests : 1,
        avgResponseTime,
        memoryUsage,
        cacheHitRate: current?.cache.hitRate || 0
      }
    };
  }

  /**
   * 📈 Get performance trends
   */
  getPerformanceTrends(timespan: number = 300000): { // Default 5 minutes
    memory: number[];
    responseTime: number[];
    cacheHitRate: number[];
    successRate: number[];
    timestamps: number[];
  } {
    const cutoff = Date.now() - timespan;
    const relevant = this.metrics.filter(m => m.timestamp >= cutoff);

    return {
      memory: relevant.map(m => m.memory.heapUsed / (1024 * 1024)),
      responseTime: relevant.map(m => m.processing.totalTime),
      cacheHitRate: relevant.map(m => m.cache.hitRate),
      successRate: relevant.map(m => m.quality.successRate),
      timestamps: relevant.map(m => m.timestamp)
    };
  }

  /**
   * 🧹 Cleanup and destroy
   */
  destroy(): void {
    this.stopMonitoring();
    this.metrics = [];
    this.alerts = [];
    this.alertCallbacks = [];
    this.optimizationCallbacks = [];
    console.log('🧹 Performance Dashboard destroyed');
  }
}

// Global dashboard instance
export const globalDashboard = new PerformanceDashboard();

export default PerformanceDashboard;