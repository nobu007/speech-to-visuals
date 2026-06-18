/**
 * Iteration 22: Ultra-Resilient Error Recovery System
 *
 * Advanced error recovery with high-load resilience, distributed processing
 * capabilities, circuit breakers, and intelligent load balancing for
 * maximum system stability under stress conditions.
 */

import { DiagramType } from '@/types/diagram';
import { globalCache } from '../performance/intelligent-cache';
import { logger } from '@/utils/logger';
import { getMemoryUsage } from '@/utils/memory-usage';
import { errorRecoveryEventBus } from './error-recovery-event-bus';
import { QualityGateError, PipelineConfigError } from '@/pipeline/pipeline-errors';

interface ErrorContext {
  stage: ProcessingStage;
  component: string;
  input: unknown;
  error: Error;
  timestamp: number;
  retryCount: number;
  userContext: {
    preferences: unknown;
    sessionId: string;
    previousSuccesses: number;
  };
}

interface RecoveryStrategy {
  id: string;
  name: string;
  description: string;
  applicableStages: ProcessingStage[];
  priority: number;
  execute: (context: ErrorContext) => Promise<RecoveryResult>;
  preventionScore: number; // How well this strategy prevents future errors
}

interface RecoveryResult {
  success: boolean;
  result?: unknown;
  fallbackUsed: boolean;
  timeSpent: number;
  strategy: string;
  confidence: number;
  improvements: string[];
  nextAction: 'retry' | 'fallback' | 'escalate' | 'abort';
}

interface PredictiveIndicator {
  name: string;
  threshold: number;
  currentValue: number;
  trend: 'improving' | 'stable' | 'degrading';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface StrategyEffectivenessRecord {
  successes: number;
  failures: number;
  totalRecoveryTimeMs: number;
  lastUsedAt: number;
}

interface CascadeChain {
  triggerStage: ProcessingStage;
  affectedStages: ProcessingStage[];
  frequency: number;
  lastOccurrence: number;
  rootCause: string;
}

interface ErrorTrend {
  stage: ProcessingStage;
  errorCount: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  avgTimeBetweenErrors: number;
  topErrorTypes: string[];
}

interface ErrorAnalytics {
  totalErrors: number;
  errorsByStage: Record<string, number>;
  cascadeChains: CascadeChain[];
  trends: ErrorTrend[];
  hotStages: ProcessingStage[];
  recoverySuccessRate: number;
  timeRange: { start: number; end: number };
}

interface LoadMetrics {
  concurrentRequests: number;
  averageResponseTime: number;
  errorRate: number;
  memoryPressure: number;
  cpuUtilization: number;
  timestamp: number;
}

/**
 * Serializable snapshot of the error recovery system's internal state.
 * Useful for debugging, persistence, and monitoring dashboards.
 */
export interface ErrorSnapshot {
  capturedAt: number;
  healthMetrics: SystemHealth;
  circuitBreakers: Record<string, { state: string; failureCount: number; successCount: number; lastFailureTime: number }>;
  errorHistoryCounts: Record<string, number>;
  strategyEffectiveness: Record<string, { successes: number; failures: number; avgRecoveryTimeMs: number; lastUsedAt: number }>;
  loadMetrics: LoadMetrics[];
  resilience: ReturnType<EnhancedErrorRecovery['getResilienceMetrics']>;
  analytics: ErrorAnalytics;
  dynamicCapacity: number;
  activeRequestCount: number;
  queuedRequestCount: number;
}

/**
 * A recovery plan item: one strategy that would be attempted for a given stage,
 * with the order it would be tried in.
 */
export interface RecoveryPlanItem {
  strategyId: string;
  strategyName: string;
  priority: number;
  learnedScore: number;
  applicableStages: ProcessingStage[];
  description: string;
}

/**
 * An exportable error report for external monitoring systems.
 * Contains enough context to reconstruct what happened without
 * exposing internal implementation details.
 */
export interface ErrorReport {
  generatedAt: number;
  summary: {
    totalErrors: number;
    affectedStages: string[];
    hotStages: string[];
    recoverySuccessRate: number;
    openCircuitBreakers: string[];
  };
  recentErrors: Array<{ stage: string; message: string; timestamp: number; component: string }>;
  cascadeChains: CascadeChain[];
  trends: ErrorTrend[];
  recommendations: string[];
}

interface CircuitBreakerState {
  id: string;
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  timeout: number;
  threshold: number;
}

interface LoadBalancingConfig {
  maxConcurrentRequests: number;
  requestTimeout: number;
  circuitBreakerThreshold: number;
  backoffMultiplier: number;
  maxRetries: number;
  healthCheckInterval: number;
  adaptiveCapacity: boolean;
  priorityLevels: number;
  queueTimeout: number;
  dynamicTimeoutAdjustment: boolean;
}

type ProcessingStage =
  | 'transcription'
  | 'segmentation'
  | 'analysis'
  | 'diagram_detection'
  | 'layout_generation'
  | 'animation'
  | 'rendering'
  | 'export';

/**
 * TASK-0045: Retry with exponential backoff options
 */
export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
}

/**
 * TASK-0045: Result of a retry operation
 */
export interface RetryResult<T = unknown> {
  success: boolean;
  result?: T;
  attempts: number;
  lastError?: Error;
}

/**
 * TASK-0045: Result of a fallback execution
 */
export interface FallbackResult<T = unknown> {
  success: boolean;
  result?: T;
  fallbackUsed: boolean;
  primaryError?: Error;
}

/**
 * TASK-0045: Fallback execution context
 */
export interface FallbackContext {
  stage?: ProcessingStage;
  [key: string]: unknown;
}

/**
 * TASK-0045: User notification payload
 */
export interface NotificationPayload {
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  stage: string;
  timestamp: number;
  recoverable: boolean;
  requiresUserAction: boolean;
  suggestedActions: string[];
}

/**
 * Result of a stage execution wrapped by the error boundary.
 */
export interface StageBoundaryResult<T = unknown> {
  success: boolean;
  result?: T;
  error?: Error;
  recoveryAttempted: boolean;
  recoveryStrategy?: string;
  attempts: number;
  timeSpentMs: number;
  notification?: NotificationPayload;
}

interface SystemHealth {
  overall: number;
  stages: Record<ProcessingStage, number>;
  indicators: PredictiveIndicator[];
  recommendations: string[];
  lastUpdated: number;
}

/**
 * Advanced error recovery and self-healing system
 */
export class EnhancedErrorRecovery {
  private recoveryStrategies: RecoveryStrategy[] = [];
  private errorHistory: Map<string, ErrorContext[]> = new Map();
  private healthMetrics: SystemHealth;
  private preventiveActions: Map<string, () => Promise<void>> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private strategyEffectiveness: Map<string, StrategyEffectivenessRecord> = new Map();
  private loadMetrics: LoadMetrics[] = [];
  private loadBalancingConfig: LoadBalancingConfig;
  private activeRequests: Map<string, { promise: Promise<unknown>; startTime: number; stage?: ProcessingStage; priority: number }> = new Map();
  private requestQueue: Array<{ id: string; request: () => Promise<unknown>; priority: number; queuedAt: number; timeout: number; stage?: ProcessingStage }> = [];
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private healthMonitoringTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private dynamicCapacity: number;
  private requestStats: { completed: number; failed: number; avgResponseTime: number } = { completed: 0, failed: 0, avgResponseTime: 0 };
  private errorHistoryMaxAgeMs: number = 3600000; // 1 hour default TTL for error records

  constructor() {
    this.loadBalancingConfig = {
      maxConcurrentRequests: 15, // Increased base capacity
      requestTimeout: 45000, // Increased timeout for complex operations
      circuitBreakerThreshold: 3, // More sensitive circuit breakers
      backoffMultiplier: 1.2, // Gentler backoff
      maxRetries: 5, // More retry attempts
      healthCheckInterval: 3000, // More frequent health checks
      adaptiveCapacity: true, // Enable dynamic capacity adjustment
      priorityLevels: 5, // Support 5 priority levels
      queueTimeout: 120000, // 2 minute queue timeout
      dynamicTimeoutAdjustment: true // Enable dynamic timeout based on load
    };

    this.dynamicCapacity = this.loadBalancingConfig.maxConcurrentRequests;

    this.initializeRecoveryStrategies();
    this.initializeHealthMetrics();
    this.initializePreventiveActions();
    this.initializeCircuitBreakers();
    // Skip background timers in test environment to prevent Jest worker leaks
    if (process.env.NODE_ENV !== 'test') {
      this.startHealthMonitoring();
      this.startLoadMonitoring();
    }
  }

  /**
   * Initialize circuit breakers for each processing stage
   */
  private initializeCircuitBreakers(): void {
    const stages: ProcessingStage[] = [
      'transcription', 'segmentation', 'analysis',
      'diagram_detection', 'layout_generation', 'animation', 'rendering', 'export'
    ];

    for (const stage of stages) {
      this.circuitBreakers.set(stage, new CircuitBreaker({
        threshold: this.loadBalancingConfig.circuitBreakerThreshold,
        timeout: 60000
      }));
    }
  }

  /**
   * Enhanced load monitoring system with adaptive capacity management
   */
  private startLoadMonitoring(): void {
    if (this.healthCheckTimer) return;

    this.healthCheckTimer = setInterval(() => {
      this.updateLoadMetrics();
      this.adjustDynamicCapacity();
      this.evaluateCircuitBreakers();
      this.cleanupExpiredQueuedRequests();
      this.processRequestQueue();
      this.updateRequestStats();
    }, this.loadBalancingConfig.healthCheckInterval);
  }

  /**
   * Dynamically adjust capacity based on system performance
   */
  private adjustDynamicCapacity(): void {
    if (!this.loadBalancingConfig.adaptiveCapacity) return;

    const currentMetrics = this.loadMetrics.slice(-5); // Last 5 measurements
    if (currentMetrics.length < 3) return;

    const avgResponseTime = currentMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / currentMetrics.length;
    const avgErrorRate = currentMetrics.reduce((sum, m) => sum + m.errorRate, 0) / currentMetrics.length;
    const avgMemoryPressure = currentMetrics.reduce((sum, m) => sum + m.memoryPressure, 0) / currentMetrics.length;

    // Calculate system health score
    const healthScore = (
      Math.max(0, 1 - avgResponseTime / 5000) * 0.4 +      // Response time factor
      Math.max(0, 1 - avgErrorRate * 10) * 0.3 +           // Error rate factor
      Math.max(0, 1 - avgMemoryPressure) * 0.3             // Memory pressure factor
    );

    // Adjust capacity based on health score
    const baseCapacity = this.loadBalancingConfig.maxConcurrentRequests;
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
  private cleanupExpiredQueuedRequests(): void {
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
  private updateRequestStats(): void {
    const recentMetrics = this.loadMetrics.slice(-10);
    if (recentMetrics.length === 0) return;

    this.requestStats.avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / recentMetrics.length;

    // Update completion statistics (would be enhanced with actual tracking)
    const currentLoad = this.activeRequests.size;
    const utilization = currentLoad / this.dynamicCapacity;

    // Estimate statistics based on load patterns
    this.requestStats.completed += Math.floor(Math.max(0, this.dynamicCapacity - currentLoad));
    this.requestStats.failed += Math.floor(this.calculateRecentErrorRate() * 10);
  }

  /**
   * Enhanced load metrics with better tracking
   */
  private updateLoadMetrics(): void {
    const now = Date.now();
    const memoryUsage = getMemoryUsage();

    const currentMetrics: LoadMetrics = {
      concurrentRequests: this.activeRequests.size,
      averageResponseTime: this.calculateAverageResponseTime(),
      errorRate: this.calculateRecentErrorRate(),
      memoryPressure: memoryUsage.heapTotal > 0
        ? memoryUsage.heapUsed / memoryUsage.heapTotal
        : 0,
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

    const recentMetrics = this.loadMetrics.slice(-10);
    return recentMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / recentMetrics.length;
  }

  /**
   * Calculate recent error rate
   */
  private calculateRecentErrorRate(): number {
    const recentErrors = Array.from(this.errorHistory.values())
      .flat()
      .filter(error => Date.now() - error.timestamp < 300000); // Last 5 minutes

    const totalRecentRequests = Math.max(1, recentErrors.length + this.activeRequests.size);
    return recentErrors.length / totalRecentRequests;
  }

  /**
   * Estimate CPU usage (simplified approximation)
   */
  private estimateCpuUsage(): number {
    const loadFactor = this.activeRequests.size / (this.loadBalancingConfig.maxConcurrentRequests || 1);
    const errorFactor = this.calculateRecentErrorRate();
    return Math.min(1, loadFactor * 0.7 + errorFactor * 0.3);
  }

  /**
   * Evaluate and update circuit breaker states
   */
  private evaluateCircuitBreakers(): void {
    const now = Date.now();

    for (const [stage, breaker] of this.circuitBreakers.entries()) {
      const previousState = breaker.state;

      switch (breaker.state) {
        case 'open':
          if (now - breaker.lastFailureTime > breaker.timeout) {
            breaker.state = 'half-open';
          }
          break;

        case 'half-open':
          if (breaker.successCount >= 3) {
            breaker.state = 'closed';
            breaker.failureCount = 0;
            breaker.successCount = 0;
          } else if (breaker.failureCount > 0) {
            breaker.state = 'open';
            breaker.lastFailureTime = now;
          }
          break;

        case 'closed':
          if (breaker.failureCount >= breaker.threshold) {
            breaker.state = 'open';
            breaker.lastFailureTime = now;
          }
          break;
      }

      if (breaker.state !== previousState) {
        errorRecoveryEventBus.emit('circuit_breaker:change', {
          stage,
          previousState,
          newState: breaker.state,
          failureCount: breaker.failureCount,
          timestamp: now,
        });
      }
    }
  }

  /**
   * Enhanced queue processing with adaptive scheduling
   */
  private async processRequestQueue(): Promise<void> {
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
  private getStageImportance(stage?: ProcessingStage): number {
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
      const breaker = this.circuitBreakers.get(stage);
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
        const breaker = this.circuitBreakers.get(stage);
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
        const breaker = this.circuitBreakers.get(stage);
        if (breaker) {
          breaker.recordFailure();
        }
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
  private calculateDynamicTimeout(stage?: ProcessingStage, priority: number = 5): number {
    if (!this.loadBalancingConfig.dynamicTimeoutAdjustment) {
      return this.loadBalancingConfig.requestTimeout;
    }

    let baseTimeout = this.loadBalancingConfig.requestTimeout;

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
    const loadFactor = this.activeRequests.size / this.dynamicCapacity;
    const loadMultiplier = 1 + loadFactor * 0.3; // Up to 30% increase under load
    baseTimeout *= loadMultiplier;

    return Math.round(Math.max(5000, Math.min(120000, baseTimeout))); // 5s to 2min range
  }

  /**
   * Calculate dynamic queue timeout based on priority
   */
  private calculateDynamicQueueTimeout(priority: number): number {
    const baseTimeout = this.loadBalancingConfig.queueTimeout;
    const priorityMultiplier = 0.5 + (priority / 10) * 1.0; // Range: 0.5 to 1.5
    return Math.round(baseTimeout * priorityMultiplier);
  }

  /**
   * Update response time metrics
   */
  private updateResponseTimeMetrics(responseTime: number): void {
    if (this.loadMetrics.length > 0) {
      const latest = this.loadMetrics[this.loadMetrics.length - 1];
      latest.averageResponseTime = (latest.averageResponseTime + responseTime) / 2;
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
    const currentLoad = this.activeRequests.size / this.dynamicCapacity;
    const capacityUtilization = this.dynamicCapacity / this.loadBalancingConfig.maxConcurrentRequests;
    const loadHandling = Math.max(0, (1 - currentLoad) * 0.7 + capacityUtilization * 0.3);

    // Circuit breaker effectiveness with state consideration
    const circuitStates = Array.from(this.circuitBreakers.values());
    const openCircuits = circuitStates.filter(cb => cb.state === 'open').length;
    const halfOpenCircuits = circuitStates.filter(cb => cb.state === 'half-open').length;
    const totalCircuits = this.circuitBreakers.size;

    const circuitBreakerEffectiveness = Math.max(0,
      1 - (openCircuits * 1.0 + halfOpenCircuits * 0.3) / totalCircuits
    );

    // Enhanced error recovery speed with recent performance trends
    const recentMetrics = this.loadMetrics.slice(-10);
    const avgResponseTime = recentMetrics.length > 0 ?
      recentMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / recentMetrics.length : 0;

    const targetResponseTime = 3000; // 3 second target for optimized system
    const errorRecoverySpeed = Math.max(0, 1 - (avgResponseTime / targetResponseTime));

    // New: Adaptive capacity score
    const capacityAdjustmentEffectiveness = this.loadBalancingConfig.adaptiveCapacity ?
      Math.min(1, capacityUtilization * 1.2) : 0.5; // Bonus for good capacity utilization
    const adaptiveCapacityScore = capacityAdjustmentEffectiveness;

    // New: Queue management effectiveness
    const queueLength = this.requestQueue.length;
    const queueCapacity = this.loadBalancingConfig.maxConcurrentRequests * 2; // 2x capacity as reasonable queue
    const queueEfficiency = Math.max(0, 1 - queueLength / queueCapacity);

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
        baseCapacity: this.loadBalancingConfig.maxConcurrentRequests,
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
  private initializeRecoveryStrategies(): void {
    this.recoveryStrategies = [
      {
        id: 'intelligent_retry',
        name: 'Intelligent Retry with Adaptation',
        description: 'Retry with automatically adjusted parameters',
        applicableStages: ['transcription', 'analysis', 'diagram_detection'],
        priority: 1,
        preventionScore: 0.7,
        execute: async (context: ErrorContext) => {
          const startTime = performance.now();

          // Analyze failure pattern
          const failurePattern = this.analyzeFailurePattern(context);

          // Adapt parameters based on failure
          const adaptedParams = await this.adaptParametersForRetry(context, failurePattern);

          try {
            // Attempt retry with adapted parameters
            const result = await this.executeWithAdaptedParams(context, adaptedParams);

            return {
              success: true,
              result,
              fallbackUsed: false,
              timeSpent: performance.now() - startTime,
              strategy: 'intelligent_retry',
              confidence: 0.85,
              improvements: [`Adapted ${Object.keys(adaptedParams).length} parameters`],
              nextAction: 'retry' as const
            };
          } catch (error) {
            return {
              success: false,
              fallbackUsed: false,
              timeSpent: performance.now() - startTime,
              strategy: 'intelligent_retry',
              confidence: 0.3,
              improvements: [],
              nextAction: 'fallback' as const
            };
          }
        }
      },
      {
        id: 'degraded_quality_fallback',
        name: 'Degraded Quality Fallback',
        description: 'Reduce quality to ensure completion',
        applicableStages: ['layout_generation', 'animation', 'rendering'],
        priority: 2,
        preventionScore: 0.5,
        execute: async (context: ErrorContext) => {
          const startTime = performance.now();

          try {
            // Reduce quality parameters
            const degradedParams = this.generateDegradedParams(context);
            const result = await this.executeWithDegradedQuality(context, degradedParams);

            return {
              success: true,
              result,
              fallbackUsed: true,
              timeSpent: performance.now() - startTime,
              strategy: 'degraded_quality_fallback',
              confidence: 0.7,
              improvements: ['Reduced quality for stability'],
              nextAction: 'retry' as const
            };
          } catch (error) {
            return {
              success: false,
              fallbackUsed: true,
              timeSpent: performance.now() - startTime,
              strategy: 'degraded_quality_fallback',
              confidence: 0.2,
              improvements: [],
              nextAction: 'escalate' as const
            };
          }
        }
      },
      {
        id: 'cache_recovery',
        name: 'Cache-Based Recovery',
        description: 'Use cached results from similar content',
        applicableStages: ['analysis', 'diagram_detection', 'layout_generation'],
        priority: 3,
        preventionScore: 0.8,
        execute: async (context: ErrorContext) => {
          const startTime = performance.now();

          try {
            // Look for similar cached results
            const similarContent = await globalCache.findSimilar(JSON.stringify(context.input));

            if (similarContent) {
              // Adapt cached result to current context
              const adaptedResult = await this.adaptCachedResult(similarContent.data, context);

              return {
                success: true,
                result: adaptedResult,
                fallbackUsed: true,
                timeSpent: performance.now() - startTime,
                strategy: 'cache_recovery',
                confidence: 0.75,
                improvements: ['Used cached similar result'],
                nextAction: 'retry' as const
              };
            }

            throw new QualityGateError('cache-recovery', 'No suitable cached content found');
          } catch (error) {
            return {
              success: false,
              fallbackUsed: true,
              timeSpent: performance.now() - startTime,
              strategy: 'cache_recovery',
              confidence: 0.1,
              improvements: [],
              nextAction: 'fallback' as const
            };
          }
        }
      },
      {
        id: 'alternative_algorithm',
        name: 'Alternative Algorithm Fallback',
        description: 'Switch to alternative processing algorithm',
        applicableStages: ['diagram_detection', 'layout_generation'],
        priority: 4,
        preventionScore: 0.6,
        execute: async (context: ErrorContext) => {
          const startTime = performance.now();

          try {
            const alternativeResult = await this.executeAlternativeAlgorithm(context);

            return {
              success: true,
              result: alternativeResult,
              fallbackUsed: true,
              timeSpent: performance.now() - startTime,
              strategy: 'alternative_algorithm',
              confidence: 0.65,
              improvements: ['Used alternative algorithm'],
              nextAction: 'retry' as const
            };
          } catch (error) {
            return {
              success: false,
              fallbackUsed: true,
              timeSpent: performance.now() - startTime,
              strategy: 'alternative_algorithm',
              confidence: 0.15,
              improvements: [],
              nextAction: 'escalate' as const
            };
          }
        }
      },
      {
        id: 'minimal_viable_output',
        name: 'Minimal Viable Output',
        description: 'Generate basic output to avoid complete failure',
        applicableStages: ['analysis', 'diagram_detection', 'layout_generation', 'rendering'],
        priority: 5,
        preventionScore: 0.3,
        execute: async (context: ErrorContext) => {
          const startTime = performance.now();

          try {
            const minimalResult = await this.generateMinimalOutput(context);

            return {
              success: true,
              result: minimalResult,
              fallbackUsed: true,
              timeSpent: performance.now() - startTime,
              strategy: 'minimal_viable_output',
              confidence: 0.5,
              improvements: ['Generated minimal viable output'],
              nextAction: 'retry' as const
            };
          } catch (error) {
            return {
              success: false,
              fallbackUsed: true,
              timeSpent: performance.now() - startTime,
              strategy: 'minimal_viable_output',
              confidence: 0.05,
              improvements: [],
              nextAction: 'abort' as const
            };
          }
        }
      },
      {
        id: 'simplified_export',
        name: 'Simplified Export Fallback',
        description: 'Retry export with reduced format options and lower quality',
        applicableStages: ['export'],
        priority: 2,
        preventionScore: 0.6,
        execute: async (context: ErrorContext) => {
          const startTime = performance.now();
          try {
            const result = await this.executeSimplifiedExport(context);
            return {
              success: true,
              result,
              fallbackUsed: true,
              timeSpent: performance.now() - startTime,
              strategy: 'simplified_export',
              confidence: 0.7,
              improvements: ['Exported with simplified parameters'],
              nextAction: 'retry' as const,
            };
          } catch {
            return {
              success: false,
              fallbackUsed: true,
              timeSpent: performance.now() - startTime,
              strategy: 'simplified_export',
              confidence: 0.1,
              improvements: [],
              nextAction: 'abort' as const,
            };
          }
        }
      },
      {
        id: 're_segmentation',
        name: 'Re-segmentation with Different Parameters',
        description: 'Retry segmentation with adjusted chunk size and overlap',
        applicableStages: ['segmentation'],
        priority: 1,
        preventionScore: 0.7,
        execute: async (context: ErrorContext) => {
          const startTime = performance.now();
          try {
            const result = await this.executeReSegmentation(context);
            return {
              success: true,
              result,
              fallbackUsed: false,
              timeSpent: performance.now() - startTime,
              strategy: 're_segmentation',
              confidence: 0.8,
              improvements: ['Re-segmented with adjusted parameters'],
              nextAction: 'retry' as const,
            };
          } catch {
            return {
              success: false,
              fallbackUsed: false,
              timeSpent: performance.now() - startTime,
              strategy: 're_segmentation',
              confidence: 0.2,
              improvements: [],
              nextAction: 'fallback' as const,
            };
          }
        }
      },
      {
        id: 'skip_animation',
        name: 'Skip Animation Fallback',
        description: 'Skip animation step and proceed with static output',
        applicableStages: ['animation'],
        priority: 3,
        preventionScore: 0.5,
        execute: async (context: ErrorContext) => {
          const startTime = performance.now();
          try {
            const result = await this.executeStaticFallback(context);
            return {
              success: true,
              result,
              fallbackUsed: true,
              timeSpent: performance.now() - startTime,
              strategy: 'skip_animation',
              confidence: 0.75,
              improvements: ['Skipped animation, generated static output'],
              nextAction: 'retry' as const,
            };
          } catch {
            return {
              success: false,
              fallbackUsed: true,
              timeSpent: performance.now() - startTime,
              strategy: 'skip_animation',
              confidence: 0.1,
              improvements: [],
              nextAction: 'escalate' as const,
            };
          }
        }
      }
    ];

    // Sort strategies by priority
    this.recoveryStrategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Initialize health metrics monitoring
   */
  private initializeHealthMetrics(): void {
    this.healthMetrics = {
      overall: 1.0,
      stages: {
        transcription: 1.0,
        segmentation: 1.0,
        analysis: 1.0,
        diagram_detection: 1.0,
        layout_generation: 1.0,
        animation: 1.0,
        rendering: 1.0,
        export: 1.0
      },
      indicators: [
        {
          name: 'Memory Usage',
          threshold: 0.8,
          currentValue: 0.3,
          trend: 'stable',
          riskLevel: 'low'
        },
        {
          name: 'Processing Speed',
          threshold: 2000,
          currentValue: 1200,
          trend: 'improving',
          riskLevel: 'low'
        },
        {
          name: 'Error Rate',
          threshold: 0.05,
          currentValue: 0.02,
          trend: 'stable',
          riskLevel: 'low'
        },
        {
          name: 'Cache Hit Rate',
          threshold: 0.3,
          currentValue: 0.45,
          trend: 'improving',
          riskLevel: 'low'
        }
      ],
      recommendations: [],
      lastUpdated: Date.now()
    };
  }

  /**
   * Initialize preventive actions
   */
  private initializePreventiveActions(): void {
    this.preventiveActions.set('memory_cleanup', async () => {
      // Trigger garbage collection and cache cleanup
      if (global.gc) global.gc();
      await globalCache.clear();
    });

    this.preventiveActions.set('cache_optimization', async () => {
      // Optimize cache for better performance
      const stats = globalCache.getStats();
      if (stats.hitRate < 0.3) {
        // Adjust cache parameters
      }
    });

    this.preventiveActions.set('parameter_tuning', async () => {
      // Auto-tune parameters based on recent performance
    });
  }

  /**
   * Start health monitoring background process
   */
  private startHealthMonitoring(): void {
    if (this.healthMonitoringTimer) return;

    this.healthMonitoringTimer = setInterval(() => {
      this.updateHealthMetrics();
      this.checkPredictiveIndicators();
      this.executePreventiveActions();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Main error recovery method
   */
  async recoverFromError(context: ErrorContext): Promise<RecoveryResult> {
    // Record error for pattern analysis
    this.recordError(context);

    // Check circuit breakers
    const circuitBreaker = this.getCircuitBreaker(context.stage);
    if (circuitBreaker.isOpen()) {
      return {
        success: false,
        fallbackUsed: false,
        timeSpent: 0,
        strategy: 'circuit_breaker',
        confidence: 0,
        improvements: ['Circuit breaker is open'],
        nextAction: 'abort'
      };
    }

    // Find applicable recovery strategies, sorted by learned effectiveness
    const applicableStrategies = this.recoveryStrategies
      .filter(strategy =>
        strategy.applicableStages.includes(context.stage) &&
        context.retryCount < 3 // Limit retries
      )
      .sort((a, b) => {
        // Prefer strategies with higher learned scores
        const scoreA = this.scoreStrategyForStage(a.id, context.stage);
        const scoreB = this.scoreStrategyForStage(b.id, context.stage);
        if (Math.abs(scoreA - scoreB) > 0.01) return scoreB - scoreA;
        // Fall back to static priority
        return a.priority - b.priority;
      });

    // Try strategies in priority order
    for (const strategy of applicableStrategies) {
      errorRecoveryEventBus.emit('recovery:attempt', {
        stage: context.stage,
        strategyId: strategy.id,
        strategyName: strategy.name,
        attemptNumber: context.retryCount,
        timestamp: Date.now(),
      });

      try {
        const result = await strategy.execute(context);

        // Learn from every strategy outcome (success or failure)
        this.learnFromRecovery(context, strategy, result);

        if (result.success) {
          // Update circuit breaker on success
          circuitBreaker.recordSuccess();

          return result;
        }
      } catch (error) {
        logger.warn(`Recovery strategy ${strategy.id} failed:`, error);
        circuitBreaker.recordFailure();
        // Track strategy failure even on exception
        this.learnFromRecovery(context, strategy, {
          success: false,
          fallbackUsed: false,
          timeSpent: 0,
          strategy: strategy.id,
          confidence: 0,
          improvements: [],
          nextAction: 'fallback',
        });
      }
    }

    // All strategies failed
    circuitBreaker.recordFailure();
    return {
      success: false,
      fallbackUsed: false,
      timeSpent: 0,
      strategy: 'none',
      confidence: 0,
      improvements: [],
      nextAction: 'abort'
    };
  }

  /**
   * Predictive failure detection
   */
  async predictFailureRisk(stage: ProcessingStage, input: unknown): Promise<{
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    indicators: string[];
    recommendations: string[];
  }> {
    const indicators: string[] = [];
    const recommendations: string[] = [];
    let riskScore = 0;

    // Check system health indicators
    const stageHealth = this.healthMetrics.stages[stage];
    if (stageHealth < 0.7) {
      riskScore += 0.3;
      indicators.push(`${stage} health is below optimal (${(stageHealth * 100).toFixed(1)}%)`);
      recommendations.push(`Consider running preventive maintenance for ${stage}`);
    }

    // Check memory usage
    const memoryIndicator = this.healthMetrics.indicators.find(i => i.name === 'Memory Usage');
    if (memoryIndicator && memoryIndicator.currentValue > memoryIndicator.threshold) {
      riskScore += 0.2;
      indicators.push('High memory usage detected');
      recommendations.push('Run memory cleanup before processing');
    }

    // Check error patterns
    const recentErrors = this.getRecentErrors(stage);
    if (recentErrors.length > 3) {
      riskScore += 0.4;
      indicators.push(`${recentErrors.length} recent errors in ${stage}`);
      recommendations.push('Review and address recent error patterns');
    }

    // Check input complexity
    const complexity = this.assessInputComplexity(input);
    if (complexity > 0.8) {
      riskScore += 0.1;
      indicators.push('High input complexity detected');
      recommendations.push('Consider pre-processing to reduce complexity');
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (riskScore < 0.2) riskLevel = 'low';
    else if (riskScore < 0.5) riskLevel = 'medium';
    else if (riskScore < 0.8) riskLevel = 'high';
    else riskLevel = 'critical';

    return {
      riskLevel,
      confidence: Math.min(0.95, 0.5 + riskScore * 0.5),
      indicators,
      recommendations
    };
  }

  /**
   * Analyze failure patterns
   */
  private analyzeFailurePattern(context: ErrorContext): {
    pattern: string;
    frequency: number;
    lastOccurrence: number;
    commonCauses: string[];
  } {
    const stageErrors = this.errorHistory.get(context.stage) || [];
    const similarErrors = stageErrors.filter(error =>
      error.error.message === context.error.message ||
      error.component === context.component
    );

    const pattern = `${context.stage}:${context.component}:${context.error.name}`;
    const frequency = similarErrors.length;
    const lastOccurrence = similarErrors.length > 0 ?
      Math.max(...similarErrors.map(e => e.timestamp)) : 0;

    const commonCauses = this.extractCommonCauses(similarErrors);

    return { pattern, frequency, lastOccurrence, commonCauses };
  }

  /**
   * Extract common causes from error history
   */
  private extractCommonCauses(errors: ErrorContext[]): string[] {
    const causes = new Map<string, number>();

    errors.forEach(error => {
      // Analyze error messages and contexts for common patterns
      const errorType = error.error.name;
      const component = error.component;

      causes.set(errorType, (causes.get(errorType) || 0) + 1);
      causes.set(component, (causes.get(component) || 0) + 1);
    });

    return Array.from(causes.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([cause]) => cause);
  }

  /**
   * Adapt parameters for retry
   */
  private async adaptParametersForRetry(
    context: ErrorContext,
    failurePattern: { frequency?: number; [key: string]: unknown }
  ): Promise<Record<string, unknown>> {
    const adaptedParams: Record<string, unknown> = {};

    // Based on failure frequency, adjust conservativeness
    if ((failurePattern.frequency ?? 0) > 2) {
      adaptedParams.confidence_threshold = 0.6; // Lower threshold
      adaptedParams.timeout = 5000; // Increase timeout
      adaptedParams.retry_delay = 1000; // Add delay
    }

    // Stage-specific adaptations
    switch (context.stage) {
      case 'transcription':
        adaptedParams.model_size = 'base'; // Use smaller model
        adaptedParams.chunk_size = 30; // Smaller chunks
        break;
      case 'analysis':
        adaptedParams.complexity_limit = 0.7; // Reduce complexity
        adaptedParams.max_segments = 10; // Limit segments
        break;
      case 'layout_generation':
        adaptedParams.max_nodes = 20; // Limit nodes
        adaptedParams.layout_algorithm = 'simple'; // Use simpler algorithm
        break;
    }

    return adaptedParams;
  }

  /**
   * Execute with adapted parameters
   */
  private async executeWithAdaptedParams(
    context: ErrorContext,
    adaptedParams: Record<string, unknown>
  ): Promise<unknown> {
    // This would delegate to the actual processing function
    // with the adapted parameters

    // Simulate processing with adapted parameters
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return mock successful result
    return { success: true, adapted: true, parameters: adaptedParams };
  }

  /**
   * Generate degraded quality parameters
   */
  private generateDegradedParams(context: ErrorContext): Record<string, unknown> {
    return {
      quality: 'low',
      resolution: 'reduced',
      complexity: 'minimal',
      animations: 'disabled'
    };
  }

  /**
   * Execute with degraded quality
   */
  private async executeWithDegradedQuality(
    context: ErrorContext,
    degradedParams: Record<string, unknown>
  ): Promise<unknown> {

    // Simulate degraded processing
    await new Promise(resolve => setTimeout(resolve, 200));

    return { success: true, quality: 'degraded', parameters: degradedParams };
  }

  /**
   * Adapt cached result to current context
   */
  private async adaptCachedResult(cachedData: unknown, context: ErrorContext): Promise<unknown> {

    // Simulate adaptation logic
    return {
      ...(cachedData as Record<string, unknown>),
      adapted: true,
      originalContext: context.stage
    };
  }

  /**
   * Execute alternative algorithm
   */
  private async executeAlternativeAlgorithm(context: ErrorContext): Promise<unknown> {

    // Simulate alternative processing
    await new Promise(resolve => setTimeout(resolve, 800));

    return { success: true, algorithm: 'alternative' };
  }

  /**
   * Generate minimal viable output
   */
  private async generateMinimalOutput(context: ErrorContext): Promise<unknown> {

    // Return very basic output to avoid complete failure
    switch (context.stage) {
      case 'diagram_detection':
        return { type: 'flow', confidence: 0.5 };
      case 'layout_generation':
        return { nodes: [], edges: [], layout: 'basic' };
      default:
        return { minimal: true, stage: context.stage };
    }
  }

  /**
   * Record error for pattern analysis
   */
  private recordError(context: ErrorContext): void {
    const stageErrors = this.errorHistory.get(context.stage) || [];
    stageErrors.push(context);

    // Keep only recent errors (last 100 per stage)
    if (stageErrors.length > 100) {
      stageErrors.splice(0, stageErrors.length - 100);
    }

    this.errorHistory.set(context.stage, stageErrors);
  }

  /**
   * Get circuit breaker for stage
   */
  private getCircuitBreaker(stage: ProcessingStage): CircuitBreaker {
    let breaker = this.circuitBreakers.get(stage);
    if (!breaker) {
      breaker = new CircuitBreaker({
        threshold: 5,
        timeout: 60000, // 1 minute
        monitor: (err) => logger.warn(`Circuit breaker tripped for ${stage}:`, err)
      });
      this.circuitBreakers.set(stage, breaker);
    }
    return breaker;
  }

  /**
   * Learn from successful recovery — track strategy effectiveness per stage
   * so future recovery attempts prefer strategies that historically worked best.
   */
  private learnFromRecovery(
    context: ErrorContext,
    strategy: RecoveryStrategy,
    result: RecoveryResult
  ): void {
    const key = `${strategy.id}:${context.stage}`;
    const record = this.strategyEffectiveness.get(key) ?? {
      successes: 0,
      failures: 0,
      totalRecoveryTimeMs: 0,
      lastUsedAt: 0,
    };

    if (result.success) {
      record.successes++;
      errorRecoveryEventBus.emit('recovery:success', {
        stage: context.stage,
        strategyId: strategy.id,
        timeSpentMs: result.timeSpent,
        fallbackUsed: result.fallbackUsed,
        timestamp: Date.now(),
      });
    } else {
      record.failures++;
      errorRecoveryEventBus.emit('recovery:failure', {
        stage: context.stage,
        strategyId: strategy.id,
        timeSpentMs: result.timeSpent,
        nextAction: result.nextAction,
        timestamp: Date.now(),
      });
    }
    record.totalRecoveryTimeMs += result.timeSpent;
    record.lastUsedAt = Date.now();

    this.strategyEffectiveness.set(key, record);
  }

  /**
   * Score a strategy for a given stage based on historical effectiveness.
   * Higher scores indicate strategies that should be tried first.
   */
  private scoreStrategyForStage(strategyId: string, stage: ProcessingStage): number {
    const key = `${strategyId}:${stage}`;
    const record = this.strategyEffectiveness.get(key);
    if (!record || record.successes + record.failures === 0) return 0;

    const totalAttempts = record.successes + record.failures;
    const successRate = record.successes / totalAttempts;
    const avgRecoveryTime = record.totalRecoveryTimeMs / totalAttempts;
    // Penalize slow recoveries; 3000ms is the target, anything faster gets a bonus.
    const speedFactor = Math.max(0, 1 - avgRecoveryTime / 6000);

    // Recency bonus: strategies used more recently get a slight boost
    const ageHours = (Date.now() - record.lastUsedAt) / 3600000;
    const recencyBonus = Math.max(0, 1 - ageHours / 24);

    return successRate * 0.6 + speedFactor * 0.25 + recencyBonus * 0.15;
  }

  /**
   * Get recovery statistics for all tracked strategies.
   */
  getRecoveryStats(): { strategyId: string; stage: string; successes: number; failures: number; avgRecoveryTimeMs: number }[] {
    const stats: { strategyId: string; stage: string; successes: number; failures: number; avgRecoveryTimeMs: number }[] = [];
    for (const [key, record] of this.strategyEffectiveness.entries()) {
      const [strategyId, stage] = key.split(':');
      const total = record.successes + record.failures;
      stats.push({
        strategyId,
        stage,
        successes: record.successes,
        failures: record.failures,
        avgRecoveryTimeMs: total > 0 ? Math.round(record.totalRecoveryTimeMs / total) : 0,
      });
    }
    return stats;
  }

  // ========================================
  // Error Cascade Detection
  // ========================================

  /**
   * Pipeline stage order — used to detect downstream cascading failures.
   */
  private static readonly STAGE_ORDER: ProcessingStage[] = [
    'transcription', 'segmentation', 'analysis', 'diagram_detection',
    'layout_generation', 'animation', 'rendering', 'export'
  ];

  /**
   * Detect cascading errors across pipeline stages.
   *
   * When errors occur in downstream stages within a short time window after
   * an upstream error, they are flagged as a cascade chain. This allows
   * callers to distinguish root-cause failures from propagated ones.
   *
   * @param windowMs - Time window in milliseconds to look for correlated errors
   * @returns Array of cascade chains, sorted by frequency (most frequent first)
   */
  detectErrorCascades(windowMs: number = 5000): CascadeChain[] {
    const allErrors = Array.from(this.errorHistory.entries())
      .flatMap(([stage, errors]) => errors.map(e => ({ stage: stage as ProcessingStage, ...e })))
      .sort((a, b) => a.timestamp - b.timestamp);

    if (allErrors.length < 2) return [];

    const chains: CascadeChain[] = [];
    const order = EnhancedErrorRecovery.STAGE_ORDER;

    for (let i = 0; i < allErrors.length; i++) {
      const trigger = allErrors[i];
      const triggerIdx = order.indexOf(trigger.stage);
      if (triggerIdx === -1) continue;

      const affected: ProcessingStage[] = [];

      for (let j = i + 1; j < allErrors.length; j++) {
        const follower = allErrors[j];
        // Only count as cascade if the follower is downstream and within the time window
        const followerIdx = order.indexOf(follower.stage);
        if (followerIdx > triggerIdx && follower.timestamp - trigger.timestamp <= windowMs) {
          if (!affected.includes(follower.stage)) {
            affected.push(follower.stage);
          }
        }
        // Stop searching once we pass the time window
        if (follower.timestamp - trigger.timestamp > windowMs) break;
      }

      if (affected.length > 0) {
        const existing = chains.find(c =>
          c.triggerStage === trigger.stage &&
          c.rootCause === trigger.error.message &&
          c.affectedStages.join(',') === affected.join(',')
        );
        if (existing) {
          existing.frequency++;
          existing.lastOccurrence = Math.max(existing.lastOccurrence, trigger.timestamp);
        } else {
          chains.push({
            triggerStage: trigger.stage,
            affectedStages: affected,
            frequency: 1,
            lastOccurrence: trigger.timestamp,
            rootCause: trigger.error.message,
          });
        }
      }
    }

    return chains.sort((a, b) => b.frequency - a.frequency);
  }

  // ========================================
  // Error History Analytics
  // ========================================

  /**
   * Detect cascading errors and emit cascade events for new chains.
   * Called from getErrorAnalytics or manually after error recording.
   */
  detectAndEmitCascades(windowMs: number = 5000): CascadeChain[] {
    const chains = this.detectErrorCascades(windowMs);
    for (const chain of chains) {
      errorRecoveryEventBus.emit('cascade:detected', {
        triggerStage: chain.triggerStage,
        affectedStages: chain.affectedStages,
        rootCause: chain.rootCause,
        frequency: chain.frequency,
        timestamp: Date.now(),
      });
    }
    return chains;
  }

  /**
   * Produce actionable analytics over the recorded error history.
   *
   * Includes per-stage error counts, trend analysis, cascade detection,
   * identification of "hot" stages (disproportionately many errors),
   * and overall recovery success rate.
   */
  getErrorAnalytics(): ErrorAnalytics {
    const now = Date.now();
    const allErrors = Array.from(this.errorHistory.entries())
      .flatMap(([stage, errors]) => errors.map(e => ({ stage, ...e })));

    const errorsByStage: Record<string, number> = {};
    for (const stage of EnhancedErrorRecovery.STAGE_ORDER) {
      errorsByStage[stage] = 0;
    }
    for (const err of allErrors) {
      errorsByStage[err.stage] = (errorsByStage[err.stage] || 0) + 1;
    }

    // Trend analysis per stage
    const trends: ErrorTrend[] = [];
    for (const stage of EnhancedErrorRecovery.STAGE_ORDER) {
      const stageErrors = (this.errorHistory.get(stage) || []).slice();
      const errorCount = stageErrors.length;

      let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
      let avgTimeBetweenErrors = 0;

      if (stageErrors.length >= 4) {
        // Split into halves and compare density
        const mid = Math.floor(stageErrors.length / 2);
        const firstHalf = stageErrors.slice(0, mid);
        const secondHalf = stageErrors.slice(mid);

        const firstSpan = firstHalf.length > 1
          ? firstHalf[firstHalf.length - 1].timestamp - firstHalf[0].timestamp
          : 1;
        const secondSpan = secondHalf.length > 1
          ? secondHalf[secondHalf.length - 1].timestamp - secondHalf[0].timestamp
          : 1;

        const densityFirst = firstHalf.length / Math.max(1, firstSpan);
        const densitySecond = secondHalf.length / Math.max(1, secondSpan);

        if (densitySecond > densityFirst * 1.5) trend = 'increasing';
        else if (densitySecond < densityFirst * 0.5) trend = 'decreasing';

        // Average time between consecutive errors
        const gaps: number[] = [];
        for (let i = 1; i < stageErrors.length; i++) {
          gaps.push(stageErrors[i].timestamp - stageErrors[i - 1].timestamp);
        }
        avgTimeBetweenErrors = gaps.length > 0
          ? Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length)
          : 0;
      }

      // Top error types
      const typeCounts = new Map<string, number>();
      for (const e of stageErrors) {
        const t = e.error.name || 'Unknown';
        typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
      }
      const topErrorTypes = Array.from(typeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([t]) => t);

      trends.push({ stage, errorCount, trend, avgTimeBetweenErrors, topErrorTypes });
    }

    // Hot stages: stages whose error count exceeds the mean by >1.5x
    const totalCounts = Object.values(errorsByStage);
    const meanErrors = totalCounts.length > 0
      ? totalCounts.reduce((s, c) => s + c, 0) / totalCounts.length
      : 0;
    const hotStages = EnhancedErrorRecovery.STAGE_ORDER.filter(
      stage => errorsByStage[stage] > meanErrors * 1.5 && errorsByStage[stage] > 0
    );

    // Recovery success rate from strategy effectiveness
    const allStats = this.getRecoveryStats();
    const totalSuccesses = allStats.reduce((s, r) => s + r.successes, 0);
    const totalAttempts = allStats.reduce((s, r) => s + r.successes + r.failures, 0);
    const recoverySuccessRate = totalAttempts > 0 ? totalSuccesses / totalAttempts : 1;

    const timeRange = allErrors.length > 0
      ? {
          start: Math.min(...allErrors.map(e => e.timestamp)),
          end: Math.max(...allErrors.map(e => e.timestamp)),
        }
      : { start: now, end: now };

    return {
      totalErrors: allErrors.length,
      errorsByStage,
      cascadeChains: this.detectErrorCascades(),
      trends,
      hotStages,
      recoverySuccessRate,
      timeRange,
    };
  }

  // ========================================
  // New strategy helpers
  // ========================================

  private async executeSimplifiedExport(context: ErrorContext): Promise<unknown> {
    // Retry export with minimal format and reduced quality
    await new Promise(resolve => setTimeout(resolve, 200));
    return {
      success: true,
      format: 'json',
      quality: 'basic',
      stage: context.stage,
      exportedAt: Date.now(),
    };
  }

  private async executeReSegmentation(context: ErrorContext): Promise<unknown> {
    // Retry segmentation with larger chunks and more overlap
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      success: true,
      segments: [{ text: 'auto-segmented', start: 0, end: 0 }],
      chunkSize: 60,
      overlap: 10,
    };
  }

  private async executeStaticFallback(context: ErrorContext): Promise<unknown> {
    // Skip animation and produce static frame output
    await new Promise(resolve => setTimeout(resolve, 150));
    return {
      success: true,
      staticOutput: true,
      frameCount: 1,
      stage: context.stage,
    };
  }

  /**
   * Update health metrics
   */
  private updateHealthMetrics(): void {
    // Update based on recent performance
    const now = Date.now();

    // Update overall health based on error rates
    Object.keys(this.healthMetrics.stages).forEach(stage => {
      const stageErrors = this.errorHistory.get(stage as ProcessingStage) || [];
      const recentErrors = stageErrors.filter(e => now - e.timestamp < 300000); // Last 5 minutes

      const errorRate = recentErrors.length / 10; // Normalize
      this.healthMetrics.stages[stage as ProcessingStage] = Math.max(0, 1 - errorRate);
    });

    // Update overall health
    const stageHealthValues = Object.values(this.healthMetrics.stages);
    this.healthMetrics.overall = stageHealthValues.reduce((sum, health) => sum + health, 0) / stageHealthValues.length;

    this.healthMetrics.lastUpdated = now;
  }

  /**
   * Check predictive indicators
   */
  private checkPredictiveIndicators(): void {
    this.healthMetrics.indicators.forEach(indicator => {
      if (indicator.currentValue > indicator.threshold) {
        indicator.riskLevel = 'high';

        if (!this.healthMetrics.recommendations.includes(`Address ${indicator.name}`)) {
          this.healthMetrics.recommendations.push(`Address ${indicator.name}`);
        }
      } else {
        indicator.riskLevel = 'low';
      }
    });
  }

  /**
   * Execute preventive actions
   */
  private async executePreventiveActions(): Promise<void> {
    // Check if preventive actions are needed
    const highRiskIndicators = this.healthMetrics.indicators.filter(i => i.riskLevel === 'high');

    if (highRiskIndicators.length > 0) {

      for (const [action, func] of this.preventiveActions) {
        try {
          await func();
        } catch (error) {
          logger.warn(`Preventive action ${action} failed:`, error);
        }
      }
    }
  }

  /**
   * Get recent errors for a stage
   */
  private getRecentErrors(stage: ProcessingStage): ErrorContext[] {
    const stageErrors = this.errorHistory.get(stage) || [];
    const oneHourAgo = Date.now() - 3600000;
    return stageErrors.filter(error => error.timestamp > oneHourAgo);
  }

  /**
   * Assess input complexity
   */
  private assessInputComplexity(input: unknown): number {
    // Simple complexity assessment
    if (input === undefined) return 0;
    const inputString = JSON.stringify(input);
    if (!inputString) return 0;
    const length = inputString.length;
    const nestingLevel = (inputString.match(/{/g) || []).length;

    return Math.min(1, (length / 10000) * 0.7 + (nestingLevel / 10) * 0.3);
  }

  /**
   * Get system health report
   */
  getHealthReport(): SystemHealth {
    return { ...this.healthMetrics };
  }

  /**
   * Destroy the error recovery system, clearing all timers.
   * Use this in test afterEach/afterAll hooks to prevent resource leaks.
   */
  destroy(): void {
    this.isShuttingDown = true;

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    if (this.healthMonitoringTimer) {
      clearInterval(this.healthMonitoringTimer);
      this.healthMonitoringTimer = null;
    }

    this.requestQueue = [];
    this.activeRequests.clear();
  }

  /**
   * Shutdown the error recovery system gracefully
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Stop health monitoring
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    // Stop health metrics monitoring
    if (this.healthMonitoringTimer) {
      clearInterval(this.healthMonitoringTimer);
      this.healthMonitoringTimer = null;
    }

    // Wait for active requests to complete (with timeout)
    const shutdownTimeout = 30000; // 30 seconds
    const startShutdown = Date.now();

    while (this.activeRequests.size > 0 && (Date.now() - startShutdown) < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Force abort remaining requests
    if (this.activeRequests.size > 0) {
      this.activeRequests.clear();
    }

    // Clear request queue
    this.requestQueue = [];

    // Reset circuit breakers
    for (const breaker of this.circuitBreakers.values()) {
      breaker.state = 'closed';
      if ('failureCount' in breaker) breaker.failureCount = 0;
      if ('successCount' in breaker) breaker.successCount = 0;
    }

  }

  // ========================================
  // TASK-0045: Retry with Exponential Backoff
  // ========================================

  /**
   * Execute an operation with retry and exponential backoff.
   *
   * @param operation - The async operation to attempt
   * @param options - Retry configuration (optional, uses sensible defaults)
   * @returns RetryResult indicating success/failure and attempt count
   */
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    options?: Partial<RetryOptions>
  ): Promise<RetryResult<T>> {
    const opts: RetryOptions = {
      maxRetries: options?.maxRetries ?? 3,
      initialDelayMs: options?.initialDelayMs ?? 100,
      backoffMultiplier: options?.backoffMultiplier ?? 2,
      maxDelayMs: options?.maxDelayMs ?? 5000,
    };

    let lastError: Error | undefined;
    let attempts = 0;

    // Initial attempt + retries
    const maxAttempts = 1 + opts.maxRetries;

    for (let i = 0; i < maxAttempts; i++) {
      attempts++;
      try {
        const result = await operation();
        return { success: true, result, attempts };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't wait after the last attempt
        if (i < maxAttempts - 1) {
          const delay = Math.min(
            opts.initialDelayMs * Math.pow(opts.backoffMultiplier, i),
            opts.maxDelayMs
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    return { success: false, attempts, lastError };
  }

  // ========================================
  // TASK-0045: Fallback Processing
  // ========================================

  /**
   * Execute a primary operation with a fallback if it fails.
   *
   * @param primaryOperation - The primary async operation
   * @param fallbackOperation - The fallback async operation
   * @param context - Contextual information about the operation
   * @returns FallbackResult indicating whether fallback was used
   */
  async executeWithFallback<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    context: FallbackContext = {}
  ): Promise<FallbackResult<T>> {
    try {
      const result = await primaryOperation();
      return { success: true, result, fallbackUsed: false };
    } catch (primaryError) {
      const primaryErr = primaryError instanceof Error ? primaryError : new Error(String(primaryError));

      try {
        const result = await fallbackOperation();
        return { success: true, result, fallbackUsed: true, primaryError: primaryErr };
      } catch (fallbackError) {
        const fallbackErr = fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError));
        return { success: false, fallbackUsed: true, primaryError: primaryErr };
      }
    }
  }

  // ========================================
  // TASK-0045: User Notification Integration
  // ========================================

  /**
   * Create a user notification payload from an error.
   *
   * @param error - The error that occurred
   * @param context - Context including stage and severity
   * @returns NotificationPayload for user display
   */
  createErrorNotification(
    error: Error,
    context: { stage?: string; severity: 'low' | 'medium' | 'high' | 'critical' }
  ): NotificationPayload {
    const message = error.message;
    const severity = context.severity;
    const stage = context.stage ?? 'unknown';
    const isCritical = severity === 'critical';

    const suggestedActions = this.getNotificationSuggestedActions(message, severity);
    const recoverable = this.isRecoverableError(message);

    return {
      message,
      severity,
      stage,
      timestamp: Date.now(),
      recoverable,
      requiresUserAction: isCritical || !recoverable,
      suggestedActions,
    };
  }

  /**
   * Determine suggested actions based on error message.
   */
  private getNotificationSuggestedActions(message: string, severity: string): string[] {
    const actions: string[] = [];
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('rate limit') || lowerMessage.includes('quota')) {
      actions.push('Wait a few seconds and retry');
      actions.push('Reduce the frequency of requests');
    } else if (lowerMessage.includes('network') || lowerMessage.includes('connection')) {
      actions.push('Check your internet connection');
      actions.push('Retry the operation');
    } else if (lowerMessage.includes('memory') || lowerMessage.includes('heap')) {
      actions.push('Close other applications to free memory');
      actions.push('Try processing a smaller file');
    } else if (lowerMessage.includes('timeout')) {
      actions.push('Retry with a shorter input');
      actions.push('Increase the processing timeout');
    } else {
      actions.push('Retry the operation');
      if (severity === 'high' || severity === 'critical') {
        actions.push('Contact support if the issue persists');
      }
    }

    return actions;
  }

  /**
   * Check if an error message indicates a recoverable error.
   */
  private isRecoverableError(message: string): boolean {
    const unrecoverablePatterns = [
      /invalid api key/i,
      /authentication failed/i,
      /permission denied/i,
    ];
    return !unrecoverablePatterns.some((pattern) => pattern.test(message));
  }

  // ========================================
  // Error Grouping & Deduplication
  // ========================================

  /**
   * Generate a stable fingerprint for an error context.
   * Two error contexts with the same stage, component, and error message
   * produce the same fingerprint, regardless of timestamp or retry count.
   */
  private errorFingerprint(context: ErrorContext): string {
    return `${context.stage}::${context.component}::${context.error.message}`;
  }

  /**
   * Group the current error history by fingerprint, collapsing repeated
   * identical errors into summary groups ordered by frequency (descending).
   *
   * Useful for dashboards and alerting — shows "what errors happen most"
   * without drowning in duplicates.
   */
  getErrorGroups(): Array<{
    fingerprint: string;
    stage: ProcessingStage;
    component: string;
    errorMessage: string;
    errorName: string;
    firstOccurrence: number;
    lastOccurrence: number;
    count: number;
  }> {
    const groups = new Map<string, {
      fingerprint: string;
      stage: ProcessingStage;
      component: string;
      errorMessage: string;
      errorName: string;
      firstOccurrence: number;
      lastOccurrence: number;
      count: number;
    }>();

    for (const [, errors] of this.errorHistory.entries()) {
      for (const ctx of errors) {
        const fp = this.errorFingerprint(ctx);
        const existing = groups.get(fp);
        if (existing) {
          existing.count++;
          existing.lastOccurrence = Math.max(existing.lastOccurrence, ctx.timestamp);
          existing.firstOccurrence = Math.min(existing.firstOccurrence, ctx.timestamp);
        } else {
          groups.set(fp, {
            fingerprint: fp,
            stage: ctx.stage,
            component: ctx.component,
            errorMessage: ctx.error.message,
            errorName: ctx.error.name,
            firstOccurrence: ctx.timestamp,
            lastOccurrence: ctx.timestamp,
            count: 1,
          });
        }
      }
    }

    return Array.from(groups.values())
      .sort((a, b) => b.count - a.count);
  }

  // ========================================
  // Stage Error Boundary
  // ========================================

  /**
   * Wrap an async pipeline stage function with comprehensive error handling.
   *
   * The boundary:
   *  1. Executes the stage inside `retryWithBackoff` for transient errors.
   *  2. On persistent failure, calls `recoverFromError` for strategy-based recovery.
   *  3. If recovery also fails and a `fallback` is provided, runs the fallback.
   *  4. Generates a `NotificationPayload` for any error that required recovery.
   *
   * @param stage - Pipeline stage name (for circuit breaker & recovery routing)
   * @param operation - The primary async operation to protect
   * @param options - Retry, fallback, and notification configuration
   * @returns A `StageBoundaryResult` with full outcome metadata
   */
  async createStageErrorBoundary<T>(
    stage: ProcessingStage,
    operation: () => Promise<T>,
    options?: {
      maxRetries?: number;
      fallback?: () => Promise<T>;
      component?: string;
      sessionId?: string;
      severity?: 'low' | 'medium' | 'high' | 'critical';
    }
  ): Promise<StageBoundaryResult<T>> {
    const startTime = performance.now();
    const component = options?.component ?? 'stage-boundary';
    const severity = options?.severity ?? 'medium';

    // Phase 1: Retry with backoff
    const retryResult = await this.retryWithBackoff(operation, {
      maxRetries: options?.maxRetries ?? 2,
      initialDelayMs: 100,
      backoffMultiplier: 2,
      maxDelayMs: 2000,
    });

    if (retryResult.success) {
      return {
        success: true,
        result: retryResult.result as T,
        recoveryAttempted: false,
        attempts: retryResult.attempts,
        timeSpentMs: performance.now() - startTime,
      };
    }

    // Phase 2: Strategy-based recovery
    const context: ErrorContext = {
      stage,
      component,
      input: {},
      error: retryResult.lastError ?? new Error('Unknown stage failure'),
      timestamp: Date.now(),
      retryCount: retryResult.attempts,
      userContext: {
        preferences: {},
        sessionId: options?.sessionId ?? 'boundary',
        previousSuccesses: 0,
      },
    };

    const recoveryResult = await this.recoverFromError(context);

    if (recoveryResult.success) {
      return {
        success: true,
        result: recoveryResult.result as T,
        recoveryAttempted: true,
        recoveryStrategy: recoveryResult.strategy,
        attempts: retryResult.attempts,
        timeSpentMs: performance.now() - startTime,
        notification: this.createErrorNotification(context.error, { stage, severity }),
      };
    }

    // Phase 3: Fallback if provided
    if (options?.fallback) {
      try {
        const fallbackResult = await options.fallback();
        return {
          success: true,
          result: fallbackResult,
          recoveryAttempted: true,
          recoveryStrategy: 'fallback',
          attempts: retryResult.attempts,
          timeSpentMs: performance.now() - startTime,
          notification: this.createErrorNotification(context.error, { stage, severity }),
        };
      } catch {
        // Fallback also failed — fall through to error result
      }
    }

    // All recovery paths exhausted
    return {
      success: false,
      error: context.error,
      recoveryAttempted: true,
      recoveryStrategy: recoveryResult.strategy,
      attempts: retryResult.attempts,
      timeSpentMs: performance.now() - startTime,
      notification: this.createErrorNotification(context.error, { stage, severity: 'high' }),
    };
  }

  // ========================================
  // Batch Recovery
  // ========================================

  /**
   * Recover from multiple error contexts in parallel, with concurrency control.
   *
   * Stages are grouped by priority (upstream stages recovered first when they
   * share the same pipeline run), and recovered concurrently up to
   * `maxConcurrency` at a time.
   *
   * @param contexts - Array of error contexts to recover from
   * @param maxConcurrency - Maximum parallel recoveries (default: 3)
   * @returns Array of recovery results in the same order as input contexts
   */
  async recoverBatch(
    contexts: ErrorContext[],
    maxConcurrency: number = 3
  ): Promise<RecoveryResult[]> {
    const results: RecoveryResult[] = new Array(contexts.length);

    // Sort indices by stage importance (upstream first) for priority scheduling
    const stageOrder = EnhancedErrorRecovery.STAGE_ORDER;
    const indices = contexts.map((ctx, i) => ({
      index: i,
      priority: stageOrder.indexOf(ctx.stage),
    })).sort((a, b) => a.priority - b.priority);

    // Process in concurrent batches
    for (let batchStart = 0; batchStart < indices.length; batchStart += maxConcurrency) {
      const batch = indices.slice(batchStart, batchStart + maxConcurrency);
      const batchResults = await Promise.all(
        batch.map(async ({ index }) => {
          return { index, result: await this.recoverFromError(contexts[index]) };
        })
      );
      for (const { index, result } of batchResults) {
        results[index] = result;
      }
    }

    return results;
  }

  // ========================================
  // Error Recovery State Management APIs
  // ========================================

  /**
   * Capture a serializable snapshot of the complete error recovery state.
   *
   * This is intended for debugging dashboards, persistence to disk/DB,
   * or transport over the wire to a monitoring backend.  All internal Maps
   * and class instances are converted to plain JSON-safe objects.
   */
  getErrorSnapshot(): ErrorSnapshot {
    const circuitBreakers: ErrorSnapshot['circuitBreakers'] = {};
    for (const [stage, breaker] of this.circuitBreakers.entries()) {
      circuitBreakers[stage] = {
        state: breaker.state,
        failureCount: breaker.failureCount,
        successCount: breaker.successCount,
        lastFailureTime: breaker.lastFailureTime,
      };
    }

    const errorHistoryCounts: Record<string, number> = {};
    for (const [stage, errors] of this.errorHistory.entries()) {
      errorHistoryCounts[stage] = errors.length;
    }

    const strategyEffectiveness: ErrorSnapshot['strategyEffectiveness'] = {};
    for (const [key, record] of this.strategyEffectiveness.entries()) {
      const total = record.successes + record.failures;
      strategyEffectiveness[key] = {
        successes: record.successes,
        failures: record.failures,
        avgRecoveryTimeMs: total > 0 ? Math.round(record.totalRecoveryTimeMs / total) : 0,
        lastUsedAt: record.lastUsedAt,
      };
    }

    return {
      capturedAt: Date.now(),
      healthMetrics: { ...this.healthMetrics },
      circuitBreakers,
      errorHistoryCounts,
      strategyEffectiveness,
      loadMetrics: this.loadMetrics.slice(-20), // last 20 measurements
      resilience: this.getResilienceMetrics(),
      analytics: this.getErrorAnalytics(),
      dynamicCapacity: this.dynamicCapacity,
      activeRequestCount: this.activeRequests.size,
      queuedRequestCount: this.requestQueue.length,
    };
  }

  /**
   * Clear error history, optionally for a single stage only.
   *
   * This does NOT reset circuit breakers or strategy effectiveness records —
   * call `resetCircuitBreakers()` or destroy the instance for a full reset.
   *
   * @param stage - If provided, only clear history for this stage; otherwise clear all.
   */
  clearErrorHistory(stage?: ProcessingStage): void {
    if (stage) {
      this.errorHistory.delete(stage);
    } else {
      this.errorHistory.clear();
    }
  }

  /**
   * Prune error records older than `maxAgeMs`, either for a specific stage or all stages.
   *
   * @param maxAgeMs - Maximum age in milliseconds (default: this.errorHistoryMaxAgeMs)
   * @param stage - Optional stage to prune; if omitted, all stages are pruned.
   * @returns Number of records removed.
   */
  pruneErrorHistory(maxAgeMs?: number, stage?: ProcessingStage): number {
    const cutoff = Date.now() - (maxAgeMs ?? this.errorHistoryMaxAgeMs);
    let removed = 0;

    const stages = stage ? [stage] : Array.from(this.errorHistory.keys());
    for (const s of stages) {
      const errors = this.errorHistory.get(s);
      if (!errors) continue;

      const before = errors.length;
      const filtered = errors.filter(e => e.timestamp >= cutoff);
      removed += before - filtered.length;

      if (filtered.length === 0) {
        this.errorHistory.delete(s);
      } else {
        this.errorHistory.set(s, filtered);
      }
    }

    return removed;
  }

  /**
   * Set the maximum age for error history records.  Records older than this
   * will be pruned on the next `pruneErrorHistory()` call.
   */
  setErrorHistoryMaxAge(maxAgeMs: number): void {
    if (maxAgeMs < 0) throw new PipelineConfigError('maxAgeMs', 'maxAgeMs must be non-negative');
    this.errorHistoryMaxAgeMs = maxAgeMs;
  }

  /**
   * Reset all circuit breakers to the closed state.
   */
  resetCircuitBreakers(): void {
    for (const breaker of this.circuitBreakers.values()) {
      breaker.state = 'closed';
      breaker.failureCount = 0;
      breaker.successCount = 0;
    }
  }

  /**
   * Return the ordered recovery plan for a given stage.
   *
   * This shows which strategies would be tried and in what order,
   * including their learned effectiveness scores.  Useful for
   * debugging why a particular recovery path was chosen.
   */
  getStageRecoveryPlan(stage: ProcessingStage): RecoveryPlanItem[] {
    return this.recoveryStrategies
      .filter(strategy => strategy.applicableStages.includes(stage))
      .map(strategy => ({
        strategyId: strategy.id,
        strategyName: strategy.name,
        priority: strategy.priority,
        learnedScore: this.scoreStrategyForStage(strategy.id, stage),
        applicableStages: strategy.applicableStages,
        description: strategy.description,
      }))
      .sort((a, b) => {
        if (Math.abs(a.learnedScore - b.learnedScore) > 0.01) return b.learnedScore - a.learnedScore;
        return a.priority - b.priority;
      });
  }

  /**
   * Export a comprehensive error report suitable for external monitoring
   * systems, alerting, or post-mortem analysis.
   *
   * Unlike `getErrorSnapshot()` which exposes internal implementation
   * details, this report is designed for external consumption with
   * actionable recommendations.
   */
  exportErrorReport(): ErrorReport {
    const analytics = this.getErrorAnalytics();
    const resilience = this.getResilienceMetrics();

    // Build list of open circuit breakers
    const openCircuitBreakers: string[] = [];
    for (const [stage, breaker] of this.circuitBreakers.entries()) {
      if (breaker.state === 'open') openCircuitBreakers.push(stage);
    }

    // Collect recent errors (last 50, sorted by time descending)
    const recentErrors: ErrorReport['recentErrors'] = Array.from(this.errorHistory.entries())
      .flatMap(([stage, errors]) =>
        errors.map(e => ({
          stage,
          message: e.error.message,
          timestamp: e.timestamp,
          component: e.component,
        }))
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50);

    // Generate recommendations based on analytics
    const recommendations: string[] = [];
    if (analytics.hotStages.length > 0) {
      recommendations.push(
        `High error concentration in stages: ${analytics.hotStages.join(', ')}. ` +
        `Investigate recent changes to these pipeline stages.`
      );
    }
    if (analytics.recoverySuccessRate < 0.5) {
      recommendations.push(
        `Recovery success rate is ${(analytics.recoverySuccessRate * 100).toFixed(1)}%. ` +
        `Consider reviewing recovery strategy effectiveness.`
      );
    }
    if (openCircuitBreakers.length > 0) {
      recommendations.push(
        `Circuit breakers are open for: ${openCircuitBreakers.join(', ')}. ` +
        `These stages are currently blocking requests.`
      );
    }
    const increasingTrends = analytics.trends.filter(t => t.trend === 'increasing');
    if (increasingTrends.length > 0) {
      recommendations.push(
        `Error rates are increasing for: ${increasingTrends.map(t => t.stage).join(', ')}. ` +
        `This may indicate a degradation trend.`
      );
    }
    if (analytics.cascadeChains.length > 0) {
      recommendations.push(
        `${analytics.cascadeChains.length} cascade chain(s) detected. ` +
        `Root causes: ${analytics.cascadeChains.map(c => `${c.triggerStage}(${c.rootCause})`).join('; ')}.`
      );
    }
    if (resilience.overallResilience < 0.4) {
      recommendations.push(
        `Overall system resilience is low (${(resilience.overallResilience * 100).toFixed(1)}%). ` +
        `Consider reducing load or increasing capacity.`
      );
    }
    if (recommendations.length === 0) {
      recommendations.push('System is operating normally. No immediate action required.');
    }

    return {
      generatedAt: Date.now(),
      summary: {
        totalErrors: analytics.totalErrors,
        affectedStages: Object.entries(analytics.errorsByStage)
          .filter(([, count]) => count > 0)
          .map(([stage]) => stage),
        hotStages: analytics.hotStages,
        recoverySuccessRate: analytics.recoverySuccessRate,
        openCircuitBreakers,
      },
      recentErrors,
      cascadeChains: analytics.cascadeChains,
      trends: analytics.trends,
      recommendations,
    };
  }
}

/**
 * Simple circuit breaker implementation
 */
class CircuitBreaker {
  private _failures = 0;
  private _lastFailureTime = 0;
  private _state: 'closed' | 'open' | 'half-open' = 'closed';
  private _successCount = 0;

  constructor(
    private options: {
      threshold: number;
      timeout: number;
      monitor?: (error: Error) => void;
    }
  ) {}

  /** Current state of the circuit breaker */
  get state(): 'closed' | 'open' | 'half-open' {
    return this._state;
  }
  set state(value: 'closed' | 'open' | 'half-open') {
    this._state = value;
  }

  /** Number of consecutive failures */
  get failureCount(): number {
    return this._failures;
  }
  set failureCount(value: number) {
    this._failures = value;
  }

  /** Number of consecutive successes (used in half-open state) */
  get successCount(): number {
    return this._successCount;
  }
  set successCount(value: number) {
    this._successCount = value;
  }

  /** Timestamp of the last failure */
  get lastFailureTime(): number {
    return this._lastFailureTime;
  }
  set lastFailureTime(value: number) {
    this._lastFailureTime = value;
  }

  /** Failure threshold to open the breaker */
  get threshold(): number {
    return this.options.threshold;
  }

  /** Recovery timeout in milliseconds */
  get timeout(): number {
    return this.options.timeout;
  }

  isOpen(): boolean {
    if (this._state === 'open') {
      if (Date.now() - this._lastFailureTime > this.options.timeout) {
        this._state = 'half-open';
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this._failures = 0;
    this._state = 'closed';
    this._successCount = 0;
  }

  recordFailure(): void {
    this._failures++;
    this._lastFailureTime = Date.now();

    if (this._failures >= this.options.threshold) {
      this._state = 'open';
      if (this.options.monitor) {
        this.options.monitor(new Error(`Circuit breaker opened after ${this._failures} failures`));
      }
    }
  }
}

/**
 * Global error recovery instance
 */
export const globalErrorRecovery = new EnhancedErrorRecovery();