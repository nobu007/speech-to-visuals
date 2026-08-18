/**
 * Shared type definitions for the enhanced error-recovery system.
 *
 * Extracted verbatim from enhanced-error-recovery.ts (Iteration 22) so the
 * orchestrator, circuit-breaker registry, load-balanced executor, recovery
 * strategies, and notification helpers share one canonical set of shapes.
 * The façade module (enhanced-error-recovery.ts) re-exports the subset that
 * was historically public, so the external API is unchanged.
 */

export interface ErrorContext {
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

export interface RecoveryStrategy {
  id: string;
  name: string;
  description: string;
  applicableStages: ProcessingStage[];
  priority: number;
  execute: (context: ErrorContext) => Promise<RecoveryResult>;
  preventionScore: number; // How well this strategy prevents future errors
}

export interface RecoveryResult {
  success: boolean;
  result?: unknown;
  fallbackUsed: boolean;
  timeSpent: number;
  strategy: string;
  confidence: number;
  improvements: string[];
  nextAction: 'retry' | 'fallback' | 'escalate' | 'abort';
}

export interface PredictiveIndicator {
  name: string;
  threshold: number;
  currentValue: number;
  trend: 'improving' | 'stable' | 'degrading';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface StrategyEffectivenessRecord {
  successes: number;
  failures: number;
  totalRecoveryTimeMs: number;
  lastUsedAt: number;
}

export interface CascadeChain {
  triggerStage: ProcessingStage;
  affectedStages: ProcessingStage[];
  frequency: number;
  lastOccurrence: number;
  rootCause: string;
}

export interface ErrorTrend {
  stage: ProcessingStage;
  errorCount: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  avgTimeBetweenErrors: number;
  topErrorTypes: string[];
}

export interface ErrorAnalytics {
  totalErrors: number;
  errorsByStage: Record<string, number>;
  cascadeChains: CascadeChain[];
  trends: ErrorTrend[];
  hotStages: ProcessingStage[];
  recoverySuccessRate: number;
  timeRange: { start: number; end: number };
}

export interface LoadMetrics {
  concurrentRequests: number;
  averageResponseTime: number;
  responseTimeCount: number;
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
  resilience: ReturnType<import('./load-balanced-executor').LoadBalancedExecutor['getResilienceMetrics']>;
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

export interface CircuitBreakerState {
  id: string;
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  timeout: number;
  threshold: number;
}

export interface LoadBalancingConfig {
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

export type ProcessingStage =
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

export interface SystemHealth {
  overall: number;
  stages: Record<ProcessingStage, number>;
  indicators: PredictiveIndicator[];
  recommendations: string[];
  lastUpdated: number;
}

/**
 * Advanced error recovery and self-healing system
 */
