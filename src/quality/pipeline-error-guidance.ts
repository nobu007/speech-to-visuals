/**
 * Pipeline Error Guidance Bridge
 *
 * Connects the structured ErrorClassifier / PipelineError system with
 * UserGuidedErrorRecovery so that every pipeline error automatically
 * produces actionable, user-friendly guidance.
 *
 * Guarantees:
 * - PipelineError subclasses carry errorType → mapped to specific guidance
 * - ClassifiedError recoverability drives automated vs manual strategy selection
 * - ErrorGuidance includes the classified type for UI rendering
 * - Context from PipelineError.context is propagated to guidance
 */

import { ErrorClassifier, type ClassifiedError, type ErrorType } from './error-classifier';
import {
  UserGuidedErrorRecovery,
  type ErrorCategory,
  type ErrorGuidance,
  type ErrorSeverity,
} from './user-guided-error-recovery';
// ---------- Public types ----------

export interface PipelineErrorGuidance extends ErrorGuidance {
  /** The ErrorType from ErrorClassifier (e.g. LLM_RATE_LIMITED). */
  classifiedType: ErrorType;
  /** Whether the error is classified as recoverable. */
  recoverable: boolean;
  /** Suggested action from ErrorClassifier. */
  suggestedAction: string;
}

// ---------- ErrorType → ErrorCategory mapping ----------

const ERROR_TYPE_TO_CATEGORY: Record<ErrorType, ErrorCategory> = {
  FILE_FORMAT_INVALID: 'file_format',
  FILE_SIZE_EXCEEDED: 'file_size',
  LLM_API_ERROR: 'transcription',
  LLM_RATE_LIMITED: 'api',
  LLM_TIMEOUT: 'timeout',
  RENDERING_ERROR: 'rendering',
  RENDERING_OOM: 'memory',
  NETWORK_ERROR: 'network',
  STORAGE_ERROR: 'unknown',
  QUALITY_GATE_FAILED: 'analysis',
  UNKNOWN: 'unknown',
};

// ---------- PipelineErrorGuidanceBridge ----------

export class PipelineErrorGuidanceBridge {
  private readonly classifier = new ErrorClassifier();
  private readonly userRecovery = new UserGuidedErrorRecovery();

  /**
   * Produce rich, actionable guidance from any error.
   *
   * If the error is a PipelineError the pre-classified errorType is used
   * directly (no regex guesswork). Otherwise ErrorClassifier pattern-matches
   * the message. Either way the result is fed into UserGuidedErrorRecovery
   * to get category-specific strategies and prevention tips.
   */
  provideGuidance(error: Error, context?: Record<string, unknown>): PipelineErrorGuidance {
    // 1. Classify via ErrorClassifier (respects PipelineError.errorType)
    const classified: ClassifiedError = this.classifier.classify(error, { stage: context?.stage as string | undefined });

    // 2. Map the ErrorType to the legacy ErrorCategory used by UserGuidedErrorRecovery
    const category = ERROR_TYPE_TO_CATEGORY[classified.type] ?? 'unknown';

    // 3. Get base guidance from UserGuidedErrorRecovery
    const baseGuidance = this.userRecovery.analyzeError(error, context);

    // 4. Override the user message with the classified one (more specific)
    const userMessage = classified.userMessage || baseGuidance.userMessage;

    // 5. Promote severity for non-recoverable errors
    const severity = this.adjustSeverity(classified, baseGuidance.severity);

    return {
      ...baseGuidance,
      category,
      severity,
      userMessage,
      classifiedType: classified.type,
      recoverable: classified.recoverable,
      suggestedAction: classified.suggestedAction,
    };
  }

  /**
   * Adjust severity: promote to at least 'high' for non-recoverable errors
   * since the user cannot automatically fix them.
   */
  private adjustSeverity(classified: ClassifiedError, baseSeverity: ErrorSeverity): ErrorSeverity {
    if (!classified.recoverable && baseSeverity !== 'critical') {
      return 'high';
    }
    return baseSeverity;
  }

  /**
   * Attempt automated recovery for the given guidance.
   * Only runs automated strategies; returns immediately for non-recoverable errors.
   */
  async attemptRecovery(
    guidance: PipelineErrorGuidance,
    retryFn: () => Promise<unknown>,
  ): Promise<{ success: boolean; result?: unknown; error?: Error }> {
    if (!guidance.recoverable) {
      return { success: false, error: guidance.error };
    }

    return this.userRecovery.attemptRecovery(guidance, retryFn);
  }

  /**
   * Get error statistics from both classifier and user recovery.
   */
  getStatistics(): {
    classification: ClassifiedError[];
    recovery: ReturnType<UserGuidedErrorRecovery['getErrorStatistics']>;
  } {
    // The classifier doesn't expose raw history, so we just expose recovery stats
    return {
      classification: [],
      recovery: this.userRecovery.getErrorStatistics(),
    };
  }
}

// Singleton for convenience
export const pipelineErrorGuidance = new PipelineErrorGuidanceBridge();
