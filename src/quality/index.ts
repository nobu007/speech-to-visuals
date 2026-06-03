export { QualityMonitor, qualityMonitor } from './quality-monitor';
export type {
  QualityMetrics,
  QualityAssessment,
  QualityThresholds,
  IterationComparison
} from './quality-monitor';

// TASK-0045: Error Classification and Recovery
export { ErrorClassifier } from './error-classifier';
export type {
  ErrorType,
  ErrorSeverity,
  ClassifiedError,
  ClassifyContext,
  ClassificationStatistics,
} from './error-classifier';

export { EnhancedErrorRecovery, globalErrorRecovery } from './enhanced-error-recovery';
export type {
  RetryOptions,
  RetryResult,
  FallbackResult,
  FallbackContext,
  NotificationPayload,
  ErrorSnapshot,
  RecoveryPlanItem,
  ErrorReport,
} from './enhanced-error-recovery';

export { UserGuidedErrorRecovery, userGuidedErrorRecovery } from './user-guided-error-recovery';
export type {
  ErrorCategory,
  ErrorGuidance,
  RecoveryStrategy,
} from './user-guided-error-recovery';

export { ErrorRecoveryEventBus, errorRecoveryEventBus } from './error-recovery-event-bus';
export type {
  ErrorRecoveryEventMap,
  ErrorRecoveryEventType,
  CircuitBreakerEvent,
  RecoveryAttemptEvent,
  RecoverySuccessEvent,
  RecoveryFailureEvent,
  CapacityAdjustedEvent,
  StageDegradedEvent,
  CascadeDetectedEvent,
  QueueOverflowEvent,
  CircuitBreakerState,
} from './error-recovery-event-bus';

export { ErrorRecoveryMonitor } from './error-recovery-monitor';
export type {
  MonitorConfig,
  MonitorHealthStatus,
} from './error-recovery-monitor';

export { BatchOperationRecovery } from './batch-operation-recovery';
export type {
  BatchRecoveryConfig,
  ItemResult,
  BatchResult,
} from './batch-operation-recovery';

export { ErrorRecoveryHealthTracker } from './error-recovery-health-tracker';
export type {
  HealthAssessment,
  StageHealthScore,
} from './error-recovery-health-tracker';

export { PipelineErrorGuidanceBridge, pipelineErrorGuidance } from './pipeline-error-guidance';
export type { PipelineErrorGuidance } from './pipeline-error-guidance';

export { PipelineRunRecoveryTracker } from './pipeline-run-recovery-tracker';
export type {
  RecoveryStage,
  DegradationLevel,
  StageRecoveryRecord,
  RunRecoveryConfig,
  RecoveryRecommendation,
  RunRecoveryReport,
  RunStateSnapshot,
} from './pipeline-run-recovery-tracker';