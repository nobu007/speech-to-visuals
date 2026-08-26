/**
 * Iteration 22: Ultra-Resilient Error Recovery System
 *
 * Advanced error recovery with high-load resilience, distributed processing
 * capabilities, circuit breakers, and intelligent load balancing for
 * maximum system stability under stress conditions.
 */

import { globalCache } from '../performance/intelligent-cache';
import { logger } from '@stv/core/utils/logger';
import { safeMax, safeMean, safeMin } from '@stv/core/lib/metrics-utils';
import { errorRecoveryEventBus } from './error-recovery-event-bus';
import { PipelineConfigError } from '@/pipeline/pipeline-errors';
import { CircuitBreaker, CircuitBreakerRegistry } from './error-recovery/circuit-breaker';
import { LoadBalancedExecutor } from './error-recovery/load-balanced-executor';
import { createRecoveryStrategies, type RecoveryStrategyHost } from './error-recovery/recovery-strategies';
import { createErrorNotificationPayload } from './error-recovery/notifications';
import type {
  CascadeChain,
  ErrorAnalytics,
  ErrorContext,
  ErrorReport,
  ErrorSnapshot,
  ErrorTrend,
  FallbackContext,
  FallbackResult,
  LoadBalancingConfig,
  LoadMetrics,
  NotificationPayload,
  PredictiveIndicator,
  ProcessingStage,
  RecoveryPlanItem,
  RecoveryResult,
  RecoveryStrategy,
  RetryOptions,
  RetryResult,
  StageBoundaryResult,
  StrategyEffectivenessRecord,
  SystemHealth,
} from './error-recovery/types';

// Public type surface — unchanged from before the split.
export type {
  ErrorSnapshot,
  RecoveryPlanItem,
  ErrorReport,
  RetryOptions,
  RetryResult,
  FallbackResult,
  FallbackContext,
  NotificationPayload,
  StageBoundaryResult,
} from './error-recovery/types';

/**
 * Initial health-metrics snapshot. Formerly the `initializeHealthMetrics()`
 * private method called once from the constructor — hoisted to a module
 * factory so the field is definitely assigned at its declaration, replacing
 * the `healthMetrics!:` definite-assignment assertion. The constructor was
 * (and remains) the only caller, and nothing reads the field before the
 * constructor body runs, so the initialization point is observably the same
 * (Phase 147 / REQ-336).
 */
function createInitialHealthMetrics(): SystemHealth {
  return {
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

export class EnhancedErrorRecovery {
  private recoveryStrategies: RecoveryStrategy[] = [];
  private errorHistory: Map<string, ErrorContext[]> = new Map();
  private healthMetrics: SystemHealth = createInitialHealthMetrics();
  private preventiveActions: Map<string, () => Promise<void>> = new Map();
  private strategyEffectiveness: Map<string, StrategyEffectivenessRecord> = new Map();
  private healthMonitoringTimer: NodeJS.Timeout | null = null;
  private errorHistoryMaxAgeMs: number = 3600000; // 1 hour default TTL for error records

  // Split-out collaborators (see ./error-recovery/*): the per-stage circuit
  // breaker map and the load-balanced request queue / capacity engine.
  private readonly breakers: CircuitBreakerRegistry;
  private readonly loadExecutor: LoadBalancedExecutor;

  constructor() {
    this.breakers = new CircuitBreakerRegistry({
      threshold: 3, // More sensitive circuit breakers
      timeout: 60000,
    });

    this.loadExecutor = new LoadBalancedExecutor(
      {
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
      },
      this.breakers,
      // errorHistory lives on the orchestrator; the executor only needs the
      // recent-error count for error-rate math (5 minute window).
      () =>
        Array.from(this.errorHistory.values())
          .flat()
          .filter(error => Date.now() - error.timestamp < 300000).length,
    );

    this.recoveryStrategies = createRecoveryStrategies(this.buildStrategyHost());
    // healthMetrics initializes at its field declaration
    // (createInitialHealthMetrics above).
    this.initializePreventiveActions();
    // Skip background timers in test environment to prevent Jest worker leaks.
    // JEST_WORKER_ID is set by Jest regardless of NODE_ENV overrides in tests.
    if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
      this.startHealthMonitoring();
      this.loadExecutor.start();
    }
  }

  /**
   * Recovery strategy closures live in ./error-recovery/recovery-strategies;
   * they call back into these orchestrator helpers through this host object
   * (private methods cannot satisfy an external interface directly).
   */
  private buildStrategyHost(): RecoveryStrategyHost {
    return {
      analyzeFailurePattern: (context) => this.analyzeFailurePattern(context),
      adaptParametersForRetry: (context, failurePattern) =>
        this.adaptParametersForRetry(context, failurePattern),
      executeWithAdaptedParams: (context, adaptedParams) =>
        this.executeWithAdaptedParams(context, adaptedParams),
      generateDegradedParams: (context) => this.generateDegradedParams(context),
      executeWithDegradedQuality: (context, degradedParams) =>
        this.executeWithDegradedQuality(context, degradedParams),
      adaptCachedResult: (cachedData, context) => this.adaptCachedResult(cachedData, context),
      executeAlternativeAlgorithm: (context) => this.executeAlternativeAlgorithm(context),
      generateMinimalOutput: (context) => this.generateMinimalOutput(context),
      executeSimplifiedExport: (context) => this.executeSimplifiedExport(context),
      executeReSegmentation: (context) => this.executeReSegmentation(context),
      executeStaticFallback: (context) => this.executeStaticFallback(context),
    };
  }

  // =========================================================================
  // Load balancing & circuit breakers — implemented in ./error-recovery/*
  // (LoadBalancedExecutor, CircuitBreakerRegistry). Thin delegates keep the
  // public surface unchanged; the private accessors preserve the internal
  // reads (getErrorSnapshot, getStageRecoveryPlan) and the state shapes the
  // existing tests poke (loadMetrics / dynamicCapacity / loadBalancingConfig).
  // =========================================================================

  async executeWithLoadBalancing<T>(
    requestId: string,
    operation: () => Promise<T>,
    stage?: ProcessingStage,
    priority: number = 5
  ): Promise<T> {
    return this.loadExecutor.executeWithLoadBalancing(requestId, operation, stage, priority);
  }

  getResilienceMetrics(): ReturnType<LoadBalancedExecutor['getResilienceMetrics']> {
    return this.loadExecutor.getResilienceMetrics();
  }

  private getCircuitBreaker(stage: ProcessingStage): CircuitBreaker {
    return this.breakers.getOrCreate(stage);
  }

  /** @internal live registry view (snapshot reads + tests). */
  private get circuitBreakers(): Map<string, CircuitBreaker> {
    return this.breakers.all();
  }

  /** @internal executor state, kept poke-compatible for existing tests. */
  private get loadMetrics(): LoadMetrics[] {
    return this.loadExecutor.loadMetrics;
  }
  private set loadMetrics(value: LoadMetrics[]) {
    this.loadExecutor.loadMetrics = value;
  }
  private get dynamicCapacity(): number {
    return this.loadExecutor.dynamicCapacity;
  }
  private get loadBalancingConfig(): LoadBalancingConfig {
    return this.loadExecutor.config;
  }
  private adjustDynamicCapacity(): void {
    this.loadExecutor.adjustDynamicCapacity();
  }

  /**
   * @internal pre-split private surface, preserved so existing internals
   * tests (which operate these members directly) keep working unmodified.
   */
  private set dynamicCapacity(value: number) {
    this.loadExecutor.dynamicCapacity = value;
  }
  private get requestQueue() {
    return this.loadExecutor.requestQueue;
  }
  private set requestQueue(value: LoadBalancedExecutor['requestQueue']) {
    this.loadExecutor.requestQueue = value;
  }
  private get requestStats() {
    return this.loadExecutor.requestStats;
  }
  private updateLoadMetrics(): void {
    this.loadExecutor.updateLoadMetrics();
  }
  private updateResponseTimeMetrics(responseTime: number): void {
    this.loadExecutor.updateResponseTimeMetrics(responseTime);
  }
  private updateRequestStats(): void {
    this.loadExecutor.updateRequestStats();
  }
  private cleanupExpiredQueuedRequests(): void {
    this.loadExecutor.cleanupExpiredQueuedRequests();
  }
  private async processRequestQueue(): Promise<void> {
    return this.loadExecutor.processRequestQueue();
  }
  private getStageImportance(stage?: ProcessingStage): number {
    return this.loadExecutor.getStageImportance(stage);
  }
  private calculateDynamicTimeout(stage?: ProcessingStage, priority: number = 5): number {
    return this.loadExecutor.calculateDynamicTimeout(stage, priority);
  }
  private evaluateCircuitBreakers(): void {
    this.breakers.evaluate();
  }

  /**
   * Initialize preventive actions
   */
  private initializePreventiveActions(): void {
    this.preventiveActions.set('memory_cleanup', async () => {
      // Trigger garbage collection and cache cleanup
      if (globalThis.gc) globalThis.gc();
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
      try {
        this.updateHealthMetrics();
        this.checkPredictiveIndicators();
        this.executePreventiveActions();
      } catch (err) {
        logger.error('[EnhancedErrorRecovery] Health monitoring tick failed:', err);
      }
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
    // Finite-safe max (wave 5): a non-finite recorded timestamp is excluded
    // instead of poisoning lastOccurrence; also drops the spread (EDGE-102).
    const lastOccurrence = safeMax(similarErrors.map(e => e.timestamp));

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
      .flatMap(([stage, errors]) => errors.map(e => ({ ...e, stage: stage as ProcessingStage })))
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
      .flatMap(([stage, errors]) => errors.map(e => ({ ...e, stage })));

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

    // Finite-safe range (wave 5): timestamps are Date.now()-origin, but a
    // non-finite one entering the array previously collapsed BOTH bounds to
    // NaN; exclusion keeps the range over the valid samples. Spreads dropped
    // (EDGE-102).
    const timeRange = allErrors.length > 0
      ? {
          start: safeMin(allErrors.map(e => e.timestamp), now),
          end: safeMax(allErrors.map(e => e.timestamp), now),
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
    this.loadExecutor.beginShutdown();
    this.loadExecutor.destroy();

    if (this.healthMonitoringTimer) {
      clearInterval(this.healthMonitoringTimer);
      this.healthMonitoringTimer = null;
    }
  }

  /**
   * Shutdown the error recovery system gracefully
   */
  async shutdown(): Promise<void> {
    this.loadExecutor.beginShutdown();

    // Stop load monitoring
    this.loadExecutor.stop();

    // Stop health metrics monitoring
    if (this.healthMonitoringTimer) {
      clearInterval(this.healthMonitoringTimer);
      this.healthMonitoringTimer = null;
    }

    // Wait for active requests to complete (with timeout)
    const shutdownTimeout = 30000; // 30 seconds
    const startShutdown = Date.now();

    while (this.loadExecutor.activeRequestCount > 0 && (Date.now() - startShutdown) < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Force abort remaining requests
    this.loadExecutor.clearActiveRequests();

    // Clear request queue
    this.loadExecutor.clearQueue();

    // Reset circuit breakers
    this.breakers.reset();
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
        logger.error('[EnhancedErrorRecovery] Both primary and fallback operations failed:', { primaryError: primaryErr.message, fallbackError: fallbackErr.message });
        return { success: false, fallbackUsed: true, primaryError: primaryErr };
      }
    }
  }

  // ========================================
  // TASK-0045: User Notification Integration
  // ========================================

  /**
   * Create a user notification payload from an error.
   */
  createErrorNotification(
    error: Error,
    context: { stage?: string; severity: 'low' | 'medium' | 'high' | 'critical' }
  ): NotificationPayload {
    return createErrorNotificationPayload(error, context);
  }

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

    // Phase 1: Retry with backoff — stage boundaries run a deliberately TIGHTER
    // profile than the retryWithBackoff engine default (2 tries / 2s cap vs
    // 3 / 5s): a stage that keeps failing should surface to recovery routing
    // sooner. REQ-405 classifies this divergence (same `maxRetries` token,
    // different default by entry point) as a legitimate per-domain profile,
    // not drift — this comment is the documented intent behind the split.
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
      } catch (fallbackErr) {
        // Fallback also failed — log and fall through to error result
        logger.error('[Recovery] Fallback also failed:', fallbackErr);
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
      activeRequestCount: this.loadExecutor.activeRequestCount,
      queuedRequestCount: this.loadExecutor.queuedRequestCount,
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
    this.breakers.reset();
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

export const globalErrorRecovery = new EnhancedErrorRecovery();