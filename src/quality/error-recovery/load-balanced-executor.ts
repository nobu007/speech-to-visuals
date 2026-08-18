/**
 * Load-balanced request execution for the enhanced error-recovery system.
 *
 * Moved verbatim from enhanced-error-recovery.ts: dynamic capacity, the
 * priority request queue, load sampling (memory pressure via
 * heapUsageRatio), dynamic timeouts, and the composite resilience metrics.
 * Circuit-breaker state lives in CircuitBreakerRegistry; recent-error
 * counts are injected by the orchestrator (which owns errorHistory).
 */

import { logger } from '@stv/core/utils/logger';
import { getMemoryUsage } from '@stv/core/utils/memory-usage';
import { heapUsageRatio, safeMean } from '@stv/core/lib/metrics-utils';
import { errorRecoveryEventBus } from '../error-recovery-event-bus';
import { QualityGateError } from '@/pipeline/pipeline-errors';
import type { CircuitBreaker, CircuitBreakerRegistry } from './circuit-breaker';
import type { LoadBalancingConfig, LoadMetrics, ProcessingStage } from './types';

export class LoadBalancedExecutor {
  /** Recent load measurements (façade accessors and snapshots read this). */
  loadMetrics: LoadMetrics[] = [];
  readonly config: LoadBalancingConfig;
  dynamicCapacity: number;

  private readonly breakers: CircuitBreakerRegistry;
  /** Count of recorded errors within the last 5 minutes (owned upstream). */
  private readonly recentErrorCount: () => number;
  private activeRequests: Map<string, { promise: Promise<unknown>; startTime: number; stage?: ProcessingStage; priority: number }> = new Map();
  /** Pending queue (orchestrator compat layer + tests inspect/replace this). */
  requestQueue: Array<{ id: string; request: () => Promise<unknown>; priority: number; queuedAt: number; timeout: number; stage?: ProcessingStage }> = [];
  /** Request counters (orchestrator compat layer + tests read this). */
  requestStats: { completed: number; failed: number; avgResponseTime: number } = { completed: 0, failed: 0, avgResponseTime: 0 };
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(config: LoadBalancingConfig, breakers: CircuitBreakerRegistry, recentErrorCount: () => number) {
    this.config = config;
    this.breakers = breakers;
    this.recentErrorCount = recentErrorCount;
    this.dynamicCapacity = config.maxConcurrentRequests;
  }

  get activeRequestCount(): number {
    return this.activeRequests.size;
  }

  get queuedRequestCount(): number {
    return this.requestQueue.length;
  }

  /** Lifecycle hooks used by the orchestrator's destroy()/shutdown(). */
  beginShutdown(): void {
    this.isShuttingDown = true;
  }

  stop(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  clearActiveRequests(): void {
    this.activeRequests.clear();
  }

  clearQueue(): void {
    this.requestQueue = [];
  }

  destroy(): void {
    this.stop();
    this.clearQueue();
    this.clearActiveRequests();
  }

  /**
   * Enhanced load monitoring system with adaptive capacity management
   */
  start(): void {
    if (this.healthCheckTimer) return;

    this.healthCheckTimer = setInterval(() => {
      try {
        this.updateLoadMetrics();
        this.adjustDynamicCapacity();
        this.breakers.evaluate();
        this.cleanupExpiredQueuedRequests();
        this.processRequestQueue();
        this.updateRequestStats();
      } catch (err) {
        logger.error('[EnhancedErrorRecovery] Load monitoring tick failed:', err);
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Dynamically adjust capacity based on system performance
   */
  adjustDynamicCapacity(): void {
    if (!this.config.adaptiveCapacity) return;

    const currentMetrics = this.loadMetrics.slice(-5); // Last 5 measurements
    if (currentMetrics.length < 3) return;

    // safeMean (D2 exclusion semantics): loadMetrics entries are historically
    // NOT trusted — calculateAverageResponseTime() and the errorRecoverySpeed
    // block below both pre-filter the SAME loadMetrics.averageResponseTime
    // field against non-finite values. These three means read the sibling
    // fields of the same records, so they get the same exclusion instead of
    // the raw fold that a single corrupted entry would poison.
    const avgResponseTime = safeMean(currentMetrics.map((m) => m.averageResponseTime));
    const avgErrorRate = safeMean(currentMetrics.map((m) => m.errorRate));
    const avgMemoryPressure = safeMean(currentMetrics.map((m) => m.memoryPressure));

    // Calculate system health score
    const healthScore = (
      Math.max(0, 1 - avgResponseTime / 5000) * 0.4 +      // Response time factor
      Math.max(0, 1 - avgErrorRate * 10) * 0.3 +           // Error rate factor
      Math.max(0, 1 - avgMemoryPressure) * 0.3             // Memory pressure factor
    );

    // Adjust capacity based on health score
    const baseCapacity = this.config.maxConcurrentRequests;
    let targetCapacity = baseCapacity;

    if (healthScore > 0.8) {
      // System performing well - can increase capacity
      targetCapacity = Math.min(baseCapacity * 1.5, baseCapacity + 5);
    } else if (healthScore < 0.4) {
      // System under stress - reduce capacity
      targetCapacity = Math.max(baseCapacity * 0.6, 3);
    } else if (healthScore < 0.6) {
      // Moderate stress - slight reduction
      targetCapacity = Math.max(baseCapacity * 0.8, 5);
    }

    // Apply gradual adjustment to avoid oscillation
    const adjustmentFactor = 0.3; // 30% adjustment per cycle
    const newCapacity = Math.round(
      this.dynamicCapacity + (targetCapacity - this.dynamicCapacity) * adjustmentFactor
    );

    if (newCapacity !== this.dynamicCapacity) {
      const previousCapacity = this.dynamicCapacity;
      this.dynamicCapacity = newCapacity;
      errorRecoveryEventBus.emit('capacity:adjusted', {
        previousCapacity,
        newCapacity,
        healthScore,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Clean up expired queued requests
   */
  cleanupExpiredQueuedRequests(): void {
    const now = Date.now();
    const beforeCount = this.requestQueue.length;

    this.requestQueue = this.requestQueue.filter(queuedRequest => {
      const isExpired = (now - queuedRequest.queuedAt) > queuedRequest.timeout;
      return !isExpired;
    });

  }

  /**
   * Update request statistics for performance tracking
   */
  updateRequestStats(): void {
    const recentMetrics = this.loadMetrics.slice(-10);
    if (recentMetrics.length === 0) return;

    this.requestStats.avgResponseTime = safeMean(recentMetrics.map((m) => m.averageResponseTime));

    // Update completion statistics (would be enhanced with actual tracking)
    const currentLoad = this.activeRequests.size;
    const utilization = this.dynamicCapacity > 0 ? currentLoad / this.dynamicCapacity : 0;

    // Estimate statistics based on load patterns
    this.requestStats.completed += Math.floor(Math.max(0, this.dynamicCapacity - currentLoad));
    this.requestStats.failed += Math.floor(this.calculateRecentErrorRate() * 10);
  }

  /**
   * Enhanced load metrics with better tracking
   */
  updateLoadMetrics(): void {
    const now = Date.now();
    const memoryUsage = getMemoryUsage();

    const currentMetrics: LoadMetrics = {
      concurrentRequests: this.activeRequests.size,
      averageResponseTime: this.calculateAverageResponseTime(),
      responseTimeCount: 0,
      errorRate: this.calculateRecentErrorRate(),
      memoryPressure: heapUsageRatio(memoryUsage.heapUsed, memoryUsage.heapTotal),
      cpuUtilization: this.estimateCpuUsage(),
      timestamp: now
    };

    this.loadMetrics.push(currentMetrics);

    // Keep only recent metrics (last 200 measurements for better analysis)
    if (this.loadMetrics.length > 200) {
      this.loadMetrics = this.loadMetrics.slice(-200);
    }

    // Log capacity adjustments periodically
    if (this.loadMetrics.length % 20 === 0) {
      // periodic capacity adjustment
    }
  }

  /**
   * Calculate average response time from recent requests
   */
  private calculateAverageResponseTime(): number {
    if (this.loadMetrics.length === 0) return 0;

    const recentMetrics = this.loadMetrics
      .slice(-10)
      .filter(m => Number.isFinite(m.averageResponseTime) && m.averageResponseTime >= 0);
    if (recentMetrics.length === 0) return 0;
    // safeMean over the already-filtered valid entries — value-identical to
    // the fold below on the finite path, and defensive if the `>= 0` filter
    // ever loosens.
    return safeMean(recentMetrics.map((m) => m.averageResponseTime));
  }

  /**
   * Calculate recent error rate
   */
  private calculateRecentErrorRate(): number {
    // Injected by the orchestrator (errorHistory lives there): count of
    // recorded errors within the last 5 minutes.
    const recentErrors = this.recentErrorCount();
    const totalRecentRequests = Math.max(1, recentErrors + this.activeRequests.size);
    return recentErrors / totalRecentRequests;
  }

  /**
   * Estimate CPU usage (simplified approximation)
   */
  private estimateCpuUsage(): number {
    const loadFactor = this.activeRequests.size / (this.config.maxConcurrentRequests || 1);
    const errorFactor = this.calculateRecentErrorRate();
    return Math.min(1, loadFactor * 0.7 + errorFactor * 0.3);
  }


  /**
   * Enhanced queue processing with adaptive scheduling
   */
  async processRequestQueue(): Promise<void> {
    if (this.isShuttingDown) return;

    // Emit overflow event when queue exceeds capacity
    if (this.requestQueue.length > this.dynamicCapacity) {
      const oldest = this.requestQueue.reduce(
        (min, r) => Math.min(min, r.queuedAt), Infinity,
      );
      errorRecoveryEventBus.emit('queue:overflow', {
        queueLength: this.requestQueue.length,
        dynamicCapacity: this.dynamicCapacity,
        oldestQueuedAt: oldest === Infinity ? Date.now() : oldest,
        timestamp: Date.now(),
      });
    }

    while (
      this.requestQueue.length > 0 &&
      this.activeRequests.size < this.dynamicCapacity
    ) {
      // Advanced queue sorting: priority first, then age, then stage importance
      this.requestQueue.sort((a, b) => {
        const priorityDiff = b.priority - a.priority;
        if (Math.abs(priorityDiff) > 0.1) return priorityDiff;

        // If same priority, prefer older requests
        const ageDiff = a.queuedAt - b.queuedAt;
        if (Math.abs(ageDiff) > 5000) return ageDiff < 0 ? -1 : 1; // Older first

        // If similar age, prefer critical stages
        const stageImportance = this.getStageImportance(a.stage) - this.getStageImportance(b.stage);
        return stageImportance;
      });

      const queuedRequest = this.requestQueue.shift();
      if (!queuedRequest) break;

      // Enhanced execution with stage tracking
      this.executeWithLoadBalancing(
        queuedRequest.id,
        queuedRequest.request,
        queuedRequest.stage,
        queuedRequest.priority
      );
    }
  }

  /**
   * Get stage importance for queue prioritization
   */
  getStageImportance(stage?: ProcessingStage): number {
    const importance = {
      'transcription': 5,      // Most critical - foundation for everything
      'analysis': 4,           // High importance - affects all downstream
      'diagram_detection': 3,  // Important - core functionality
      'segmentation': 3,       // Important - content structure
      'layout_generation': 2,  // Medium - visual quality
      'animation': 1,          // Lower - enhancement
      'rendering': 2,          // Medium - final output
      'export': 1              // Lower - final step
    };
    return importance[stage || 'export'] || 0;
  }

  /**
   * Enhanced load balancing execution with adaptive features
   */
  async executeWithLoadBalancing<T>(
    requestId: string,
    operation: () => Promise<T>,
    stage?: ProcessingStage,
    priority: number = 5
  ): Promise<T> {
    // Check if we're at dynamic capacity
    if (this.activeRequests.size >= this.dynamicCapacity) {
      const queueTimeout = this.calculateDynamicQueueTimeout(priority);

      return new Promise((resolve, reject) => {
        this.requestQueue.push({
          id: requestId,
          request: async () => {
            try {
              const result = await this.executeWithLoadBalancing(requestId, operation, stage, priority);
              resolve(result);
            } catch (error) {
              reject(error);
            }
          },
          priority,
          queuedAt: Date.now(),
          timeout: queueTimeout,
          stage
        });
      });
    }

    // Check circuit breaker if stage is specified
    if (stage) {
      const breaker = this.breakers.all().get(stage);
      if (breaker?.state === 'open') {
        throw new QualityGateError('circuit-breaker', `${stage} is open - request rejected`);
      }
    }

    const startTime = performance.now();
    const dynamicTimeout = this.calculateDynamicTimeout(stage, priority);

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Request ${requestId} timed out after ${dynamicTimeout}ms`));
      }, dynamicTimeout);
    });

    try {

      const requestPromise = operation();

      // Enhanced request tracking
      this.activeRequests.set(requestId, {
        promise: requestPromise,
        startTime,
        stage,
        priority
      });

      const result = await Promise.race([requestPromise, timeoutPromise]);

      // Record success for circuit breaker
      if (stage) {
        const breaker = this.breakers.all().get(stage);
        if (breaker) {
          if (breaker.state === 'half-open') {
            breaker.successCount++;
          }
          breaker.failureCount = Math.max(0, breaker.failureCount - 1); // Gradually reduce failure count
        }
      }

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      // Enhanced success logging

      // Track success statistics
      this.requestStats.completed++;

      return result;

    } catch (error) {
      // Record failure for circuit breaker
      if (stage) {
        const breaker = this.breakers.all().get(stage);
        if (breaker) {
          breaker.recordFailure();
        }
        logger.warn(`[EnhancedErrorRecovery] Request ${requestId} failed at stage "${stage}":`, error);
      }

      // Track failure statistics
      this.requestStats.failed++;

      const responseTime = performance.now() - startTime;
      throw error;

    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      this.activeRequests.delete(requestId);

      // Update response time metrics
      const responseTime = performance.now() - startTime;
      this.updateResponseTimeMetrics(responseTime);
    }
  }

  /**
   * Calculate dynamic timeout based on stage and system load
   */
  calculateDynamicTimeout(stage?: ProcessingStage, priority: number = 5): number {
    if (!this.config.dynamicTimeoutAdjustment) {
      return this.config.requestTimeout;
    }

    let baseTimeout = this.config.requestTimeout;

    // Stage-specific timeout adjustments
    const stageMultipliers = {
      'transcription': 1.5,      // Audio processing can be slow
      'analysis': 1.2,           // Complex analysis needs time
      'diagram_detection': 1.0,  // Standard processing
      'segmentation': 0.8,       // Usually quick
      'layout_generation': 1.3,  // Complex layouts need time
      'animation': 1.1,          // Moderate processing
      'rendering': 1.4,          // Can be resource intensive
      'export': 0.9              // Usually quick final step
    };

    const stageMultiplier = stageMultipliers[stage || 'export'] || 1.0;
    baseTimeout *= stageMultiplier;

    // Priority adjustments (higher priority gets more time)
    const priorityMultiplier = 0.8 + (priority / 10) * 0.4; // Range: 0.8 to 1.2
    baseTimeout *= priorityMultiplier;

    // Load-based adjustments
    const loadFactor = this.dynamicCapacity > 0 ? this.activeRequests.size / this.dynamicCapacity : 0;
    const loadMultiplier = 1 + loadFactor * 0.3; // Up to 30% increase under load
    baseTimeout *= loadMultiplier;

    return Math.round(Math.max(5000, Math.min(120000, baseTimeout))); // 5s to 2min range
  }

  /**
   * Calculate dynamic queue timeout based on priority
   */
  calculateDynamicQueueTimeout(priority: number): number {
    const baseTimeout = this.config.queueTimeout;
    const priorityMultiplier = 0.5 + (priority / 10) * 1.0; // Range: 0.5 to 1.5
    return Math.round(baseTimeout * priorityMultiplier);
  }

  /**
   * Update response time metrics
   */
  updateResponseTimeMetrics(responseTime: number): void {
    // Reject non-finite or negative values — a single NaN permanently corrupts
    // the Welford running average (NaN propagates through all future updates).
    if (!Number.isFinite(responseTime) || responseTime < 0) return;
    if (this.loadMetrics.length > 0) {
      const latest = this.loadMetrics[this.loadMetrics.length - 1];
      latest.responseTimeCount += 1;
      // Welford's incremental mean — each observation gets equal weight
      latest.averageResponseTime =
        latest.averageResponseTime +
        (responseTime - latest.averageResponseTime) / latest.responseTimeCount;
    }
  }

  /**
   * Enhanced system resilience metrics for Iteration 23 with adaptive load balancing
   */
  getResilienceMetrics(): {
    loadHandling: number;
    circuitBreakerEffectiveness: number;
    errorRecoverySpeed: number;
    adaptiveCapacityScore: number;
    queueManagementScore: number;
    overallResilience: number;
    details: unknown;
  } {
    // Enhanced load handling with dynamic capacity consideration
    const currentLoad = this.dynamicCapacity > 0 ? this.activeRequests.size / this.dynamicCapacity : 0;
    const capacityUtilization = this.config.maxConcurrentRequests > 0
      ? this.dynamicCapacity / this.config.maxConcurrentRequests
      : 0;
    const loadHandling = Math.max(0, (1 - currentLoad) * 0.7 + capacityUtilization * 0.3);

    // Circuit breaker effectiveness with state consideration
    const circuitStates = Array.from(this.breakers.all().values());
    const openCircuits = circuitStates.filter(cb => cb.state === 'open').length;
    const halfOpenCircuits = circuitStates.filter(cb => cb.state === 'half-open').length;
    const totalCircuits = this.breakers.all().size;

    const circuitBreakerEffectiveness = totalCircuits > 0 ? Math.max(0,
      1 - (openCircuits * 1.0 + halfOpenCircuits * 0.3) / totalCircuits
    ) : 1;

    // Enhanced error recovery speed with recent performance trends
    // Filter non-finite values to prevent NaN/Infinity propagation from
    // any historically corrupted entries that bypassed the input guard.
    const recentMetrics = this.loadMetrics
      .slice(-10)
      .filter(m => Number.isFinite(m.averageResponseTime) && m.averageResponseTime >= 0);
    const avgResponseTime = safeMean(recentMetrics.map((m) => m.averageResponseTime));

    const targetResponseTime = 3000; // 3 second target for optimized system
    const errorRecoverySpeed = Number.isFinite(avgResponseTime)
      ? Math.max(0, 1 - (avgResponseTime / targetResponseTime))
      : 0;

    // New: Adaptive capacity score
    const capacityAdjustmentEffectiveness = this.config.adaptiveCapacity ?
      Math.min(1, capacityUtilization * 1.2) : 0.5; // Bonus for good capacity utilization
    const adaptiveCapacityScore = capacityAdjustmentEffectiveness;

    // New: Queue management effectiveness
    const queueLength = this.requestQueue.length;
    const queueCapacity = this.config.maxConcurrentRequests * 2; // 2x capacity as reasonable queue
    const queueEfficiency = queueCapacity > 0 ? Math.max(0, 1 - queueLength / queueCapacity) : 1;

    const successRate = this.requestStats.completed > 0 ?
      this.requestStats.completed / (this.requestStats.completed + this.requestStats.failed) : 0.5;

    const queueManagementScore = (queueEfficiency * 0.6 + successRate * 0.4);

    // Enhanced overall resilience calculation
    const overallResilience = (
      loadHandling * 0.25 +                    // Load handling (25%)
      circuitBreakerEffectiveness * 0.25 +     // Circuit breaker protection (25%)
      errorRecoverySpeed * 0.20 +              // Recovery speed (20%)
      adaptiveCapacityScore * 0.15 +           // Adaptive capacity (15%)
      queueManagementScore * 0.15              // Queue management (15%)
    );

    return {
      loadHandling,
      circuitBreakerEffectiveness,
      errorRecoverySpeed,
      adaptiveCapacityScore,
      queueManagementScore,
      overallResilience,
      details: {
        activeRequests: this.activeRequests.size,
        dynamicCapacity: this.dynamicCapacity,
        baseCapacity: this.config.maxConcurrentRequests,
        queuedRequests: this.requestQueue.length,
        openCircuits,
        halfOpenCircuits,
        totalCircuits,
        avgResponseTime: Math.round(avgResponseTime),
        errorRate: this.calculateRecentErrorRate(),
        completedRequests: this.requestStats.completed,
        failedRequests: this.requestStats.failed,
        successRate: Math.round(successRate * 100),
        capacityUtilization: Math.round(capacityUtilization * 100),
        loadUtilization: Math.round(currentLoad * 100)
      }
    };
  }

  /**
   * Initialize recovery strategies
   */
}
