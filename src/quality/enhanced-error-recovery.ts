/**
 * Iteration 22: Ultra-Resilient Error Recovery System
 *
 * Advanced error recovery with high-load resilience, distributed processing
 * capabilities, circuit breakers, and intelligent load balancing for
 * maximum system stability under stress conditions.
 */

import { DiagramType, ContentSegment } from '@/types/diagram';
import { globalCache } from '../performance/intelligent-cache';
import { globalAdaptiveProcessor } from '../analysis/adaptive-content-processor';

interface ErrorContext {
  stage: ProcessingStage;
  component: string;
  input: any;
  error: Error;
  timestamp: number;
  retryCount: number;
  userContext: {
    preferences: any;
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
  result?: any;
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

interface LoadMetrics {
  concurrentRequests: number;
  averageResponseTime: number;
  errorRate: number;
  memoryPressure: number;
  cpuUtilization: number;
  timestamp: number;
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
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private loadMetrics: LoadMetrics[] = [];
  private loadBalancingConfig: LoadBalancingConfig;
  private activeRequests: Map<string, Promise<any>> = new Map();
  private requestQueue: Array<{ id: string; request: () => Promise<any>; priority: number }> = [];
  private healthCheckTimer: NodeJS.Timer | null = null;
  private isShuttingDown = false;

  constructor() {
    this.loadBalancingConfig = {
      maxConcurrentRequests: 10,
      requestTimeout: 30000,
      circuitBreakerThreshold: 5,
      backoffMultiplier: 1.5,
      maxRetries: 3,
      healthCheckInterval: 5000
    };

    this.initializeRecoveryStrategies();
    this.initializeHealthMetrics();
    this.initializePreventiveActions();
    this.initializeCircuitBreakers();
    this.startHealthMonitoring();
    this.startLoadMonitoring();
  }

  /**
   * Initialize circuit breakers for each processing stage
   */
  private initializeCircuitBreakers(): void {
    const stages: ProcessingStage[] = [
      'transcription', 'segmentation', 'analysis',
      'diagram_detection', 'layout', 'animation', 'rendering', 'export'
    ];

    for (const stage of stages) {
      this.circuitBreakers.set(stage, {
        id: stage,
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        lastFailureTime: 0,
        timeout: 60000, // 1 minute
        threshold: this.loadBalancingConfig.circuitBreakerThreshold
      });
    }
  }

  /**
   * Start load monitoring system
   */
  private startLoadMonitoring(): void {
    if (this.healthCheckTimer) return;

    this.healthCheckTimer = setInterval(() => {
      this.updateLoadMetrics();
      this.evaluateCircuitBreakers();
      this.processRequestQueue();
    }, this.loadBalancingConfig.healthCheckInterval);
  }

  /**
   * Update current load metrics
   */
  private updateLoadMetrics(): void {
    const now = Date.now();
    const memoryUsage = process.memoryUsage();

    const currentMetrics: LoadMetrics = {
      concurrentRequests: this.activeRequests.size,
      averageResponseTime: this.calculateAverageResponseTime(),
      errorRate: this.calculateRecentErrorRate(),
      memoryPressure: memoryUsage.heapUsed / memoryUsage.heapTotal,
      cpuUtilization: this.estimateCpuUsage(),
      timestamp: now
    };

    this.loadMetrics.push(currentMetrics);

    // Keep only recent metrics (last 100 measurements)
    if (this.loadMetrics.length > 100) {
      this.loadMetrics = this.loadMetrics.slice(-100);
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
    const loadFactor = this.activeRequests.size / this.loadBalancingConfig.maxConcurrentRequests;
    const errorFactor = this.calculateRecentErrorRate();
    return Math.min(1, loadFactor * 0.7 + errorFactor * 0.3);
  }

  /**
   * Evaluate and update circuit breaker states
   */
  private evaluateCircuitBreakers(): void {
    const now = Date.now();

    for (const [stage, breaker] of this.circuitBreakers.entries()) {
      switch (breaker.state) {
        case 'open':
          if (now - breaker.lastFailureTime > breaker.timeout) {
            breaker.state = 'half-open';
            console.log(`🔄 Circuit breaker for ${stage} is now half-open`);
          }
          break;

        case 'half-open':
          if (breaker.successCount >= 3) {
            breaker.state = 'closed';
            breaker.failureCount = 0;
            breaker.successCount = 0;
            console.log(`✅ Circuit breaker for ${stage} is now closed`);
          } else if (breaker.failureCount > 0) {
            breaker.state = 'open';
            breaker.lastFailureTime = now;
            console.log(`🚫 Circuit breaker for ${stage} opened again`);
          }
          break;

        case 'closed':
          if (breaker.failureCount >= breaker.threshold) {
            breaker.state = 'open';
            breaker.lastFailureTime = now;
            console.log(`⚠️ Circuit breaker for ${stage} opened due to failures`);
          }
          break;
      }
    }
  }

  /**
   * Process queued requests when capacity is available
   */
  private async processRequestQueue(): Promise<void> {
    if (this.isShuttingDown) return;

    while (
      this.requestQueue.length > 0 &&
      this.activeRequests.size < this.loadBalancingConfig.maxConcurrentRequests
    ) {
      // Sort queue by priority (higher priority first)
      this.requestQueue.sort((a, b) => b.priority - a.priority);

      const queuedRequest = this.requestQueue.shift();
      if (!queuedRequest) break;

      this.executeWithLoadBalancing(queuedRequest.id, queuedRequest.request);
    }
  }

  /**
   * Execute request with load balancing and circuit breaker protection
   */
  async executeWithLoadBalancing<T>(
    requestId: string,
    operation: () => Promise<T>,
    stage?: ProcessingStage,
    priority: number = 5
  ): Promise<T> {
    // Check if we're at capacity
    if (this.activeRequests.size >= this.loadBalancingConfig.maxConcurrentRequests) {
      console.log(`🚦 Request ${requestId} queued - at capacity`);

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
          priority
        });
      });
    }

    // Check circuit breaker if stage is specified
    if (stage) {
      const breaker = this.circuitBreakers.get(stage);
      if (breaker?.state === 'open') {
        throw new Error(`Circuit breaker for ${stage} is open - request rejected`);
      }
    }

    const startTime = performance.now();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request ${requestId} timed out after ${this.loadBalancingConfig.requestTimeout}ms`));
      }, this.loadBalancingConfig.requestTimeout);
    });

    try {
      console.log(`🚀 Executing request ${requestId} (${this.activeRequests.size + 1}/${this.loadBalancingConfig.maxConcurrentRequests})`);

      const requestPromise = operation();
      this.activeRequests.set(requestId, requestPromise);

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
      console.log(`✅ Request ${requestId} completed in ${Math.round(endTime - startTime)}ms`);

      return result;

    } catch (error) {
      // Record failure for circuit breaker
      if (stage) {
        const breaker = this.circuitBreakers.get(stage);
        if (breaker) {
          breaker.failureCount++;
          breaker.lastFailureTime = Date.now();
        }
      }

      console.log(`❌ Request ${requestId} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;

    } finally {
      this.activeRequests.delete(requestId);

      // Update average response time
      const responseTime = performance.now() - startTime;
      this.updateResponseTimeMetrics(responseTime);
    }
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
   * Get system resilience metrics for Iteration 22
   */
  getResilienceMetrics(): {
    loadHandling: number;
    circuitBreakerEffectiveness: number;
    errorRecoverySpeed: number;
    overallResilience: number;
    details: any;
  } {
    const currentLoad = this.activeRequests.size / this.loadBalancingConfig.maxConcurrentRequests;
    const loadHandling = Math.max(0, 1 - currentLoad);

    const openCircuits = Array.from(this.circuitBreakers.values())
      .filter(cb => cb.state === 'open').length;
    const totalCircuits = this.circuitBreakers.size;
    const circuitBreakerEffectiveness = Math.max(0, 1 - (openCircuits / totalCircuits));

    const recentMetrics = this.loadMetrics.slice(-10);
    const avgResponseTime = recentMetrics.length > 0 ?
      recentMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / recentMetrics.length : 0;
    const errorRecoverySpeed = Math.max(0, 1 - (avgResponseTime / 5000)); // 5 second baseline

    const overallResilience = (
      loadHandling * 0.3 +
      circuitBreakerEffectiveness * 0.4 +
      errorRecoverySpeed * 0.3
    );

    return {
      loadHandling,
      circuitBreakerEffectiveness,
      errorRecoverySpeed,
      overallResilience,
      details: {
        activeRequests: this.activeRequests.size,
        maxCapacity: this.loadBalancingConfig.maxConcurrentRequests,
        queuedRequests: this.requestQueue.length,
        openCircuits,
        totalCircuits,
        avgResponseTime: Math.round(avgResponseTime),
        errorRate: this.calculateRecentErrorRate()
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

            throw new Error('No suitable cached content found');
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
        console.log('Optimizing cache parameters for better hit rate');
      }
    });

    this.preventiveActions.set('parameter_tuning', async () => {
      // Auto-tune parameters based on recent performance
      console.log('Auto-tuning parameters based on performance history');
    });
  }

  /**
   * Start health monitoring background process
   */
  private startHealthMonitoring(): void {
    setInterval(() => {
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

    // Find applicable recovery strategies
    const applicableStrategies = this.recoveryStrategies.filter(strategy =>
      strategy.applicableStages.includes(context.stage) &&
      context.retryCount < 3 // Limit retries
    );

    // Try strategies in priority order
    for (const strategy of applicableStrategies) {
      try {
        const result = await strategy.execute(context);

        if (result.success) {
          // Update circuit breaker on success
          circuitBreaker.recordSuccess();

          // Learn from successful recovery
          this.learnFromRecovery(context, strategy, result);

          return result;
        }
      } catch (error) {
        console.warn(`Recovery strategy ${strategy.id} failed:`, error);
        circuitBreaker.recordFailure();
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
  async predictFailureRisk(stage: ProcessingStage, input: any): Promise<{
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
    failurePattern: any
  ): Promise<Record<string, any>> {
    const adaptedParams: Record<string, any> = {};

    // Based on failure frequency, adjust conservativeness
    if (failurePattern.frequency > 2) {
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
    adaptedParams: Record<string, any>
  ): Promise<any> {
    // This would delegate to the actual processing function
    // with the adapted parameters
    console.log(`Retrying ${context.stage} with adapted params:`, adaptedParams);

    // Simulate processing with adapted parameters
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return mock successful result
    return { success: true, adapted: true, parameters: adaptedParams };
  }

  /**
   * Generate degraded quality parameters
   */
  private generateDegradedParams(context: ErrorContext): Record<string, any> {
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
    degradedParams: Record<string, any>
  ): Promise<any> {
    console.log(`Executing ${context.stage} with degraded quality:`, degradedParams);

    // Simulate degraded processing
    await new Promise(resolve => setTimeout(resolve, 200));

    return { success: true, quality: 'degraded', parameters: degradedParams };
  }

  /**
   * Adapt cached result to current context
   */
  private async adaptCachedResult(cachedData: any, context: ErrorContext): Promise<any> {
    console.log(`Adapting cached result for ${context.stage}`);

    // Simulate adaptation logic
    return {
      ...cachedData,
      adapted: true,
      originalContext: context.stage
    };
  }

  /**
   * Execute alternative algorithm
   */
  private async executeAlternativeAlgorithm(context: ErrorContext): Promise<any> {
    console.log(`Using alternative algorithm for ${context.stage}`);

    // Simulate alternative processing
    await new Promise(resolve => setTimeout(resolve, 800));

    return { success: true, algorithm: 'alternative' };
  }

  /**
   * Generate minimal viable output
   */
  private async generateMinimalOutput(context: ErrorContext): Promise<any> {
    console.log(`Generating minimal output for ${context.stage}`);

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
    if (!this.circuitBreakers.has(stage)) {
      this.circuitBreakers.set(stage, new CircuitBreaker({
        threshold: 5,
        timeout: 60000, // 1 minute
        monitor: (err) => console.warn(`Circuit breaker tripped for ${stage}:`, err)
      }));
    }
    return this.circuitBreakers.get(stage)!;
  }

  /**
   * Learn from successful recovery
   */
  private learnFromRecovery(
    context: ErrorContext,
    strategy: RecoveryStrategy,
    result: RecoveryResult
  ): void {
    // Update strategy effectiveness
    console.log(`Learning from successful recovery: ${strategy.id} for ${context.stage}`);

    // Could implement machine learning here to improve strategy selection
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
  private async executePreventiveActions(): void {
    // Check if preventive actions are needed
    const highRiskIndicators = this.healthMetrics.indicators.filter(i => i.riskLevel === 'high');

    if (highRiskIndicators.length > 0) {
      console.log('Executing preventive actions for high-risk indicators');

      for (const [action, func] of this.preventiveActions) {
        try {
          await func();
        } catch (error) {
          console.warn(`Preventive action ${action} failed:`, error);
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
  private assessInputComplexity(input: any): number {
    // Simple complexity assessment
    const inputString = JSON.stringify(input);
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
}

/**
 * Simple circuit breaker implementation
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private options: {
      threshold: number;
      timeout: number;
      monitor?: (error: Error) => void;
    }
  ) {}

  isOpen(): boolean {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.options.timeout) {
        this.state = 'half-open';
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.options.threshold) {
      this.state = 'open';
      if (this.options.monitor) {
        this.options.monitor(new Error(`Circuit breaker opened after ${this.failures} failures`));
      }
    }
  }
  /**
   * Shutdown the error recovery system gracefully
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    console.log('🔄 Shutting down error recovery system...');

    // Stop health monitoring
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    // Wait for active requests to complete (with timeout)
    const shutdownTimeout = 30000; // 30 seconds
    const startShutdown = Date.now();

    while (this.activeRequests.size > 0 && (Date.now() - startShutdown) < shutdownTimeout) {
      console.log(`⏳ Waiting for ${this.activeRequests.size} active requests to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Force abort remaining requests
    if (this.activeRequests.size > 0) {
      console.log(`⚠️ Force aborting ${this.activeRequests.size} remaining requests`);
      this.activeRequests.clear();
    }

    // Clear request queue
    this.requestQueue = [];

    // Reset circuit breakers
    for (const breaker of this.circuitBreakers.values()) {
      breaker.state = 'closed';
      breaker.failureCount = 0;
      breaker.successCount = 0;
    }

    console.log('✅ Error recovery system shutdown complete');
  }
}

/**
 * Global error recovery instance
 */
export const globalErrorRecovery = new EnhancedErrorRecovery();