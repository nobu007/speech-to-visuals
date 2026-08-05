/**
 * TASK-0045: Error Classifier
 *
 * Classifies errors into specific categories with severity,
 * recoverability, stage context, and suggested actions.
 */

// Forward declaration — avoid circular import by using dynamic check
type PipelineErrorLike = { errorType: ErrorType; stage: string };

/** Check if an error carries a pre-classified errorType (PipelineError instances). */
function isPipelineErrorLike(err: Error): err is Error & PipelineErrorLike {
  return 'errorType' in err && typeof (err as Record<string, unknown>).errorType === 'string';
}

export type ErrorType =
  | 'FILE_FORMAT_INVALID'
  | 'FILE_SIZE_EXCEEDED'
  | 'LLM_API_ERROR'
  | 'LLM_RATE_LIMITED'
  | 'LLM_TIMEOUT'
  | 'RENDERING_ERROR'
  | 'RENDERING_OOM'
  | 'NETWORK_ERROR'
  | 'STORAGE_ERROR'
  | 'QUALITY_GATE_FAILED'
  | 'UNKNOWN';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ClassifiedError {
  type: ErrorType;
  severity: ErrorSeverity;
  stage: string;
  originalError: Error;
  userMessage: string;
  recoverable: boolean;
  suggestedAction: string;
}

export interface ClassifyContext {
  stage?: string;
  [key: string]: unknown;
}

export interface ClassificationStatistics {
  total: number;
  byType: Record<ErrorType, number>;
  mostCommonType: ErrorType;
}

/**
 * Maps error types to their default severity, recoverability,
 * user message, and suggested action.
 */
const ALL_ERROR_TYPES: readonly ErrorType[] = [
  'FILE_FORMAT_INVALID', 'FILE_SIZE_EXCEEDED', 'LLM_API_ERROR', 'LLM_RATE_LIMITED',
  'LLM_TIMEOUT', 'RENDERING_ERROR', 'RENDERING_OOM', 'NETWORK_ERROR', 'STORAGE_ERROR',
  'QUALITY_GATE_FAILED', 'UNKNOWN',
];

function createEmptyByType(): Record<ErrorType, number> {
  const obj = {} as Record<ErrorType, number>;
  for (const t of ALL_ERROR_TYPES) obj[t] = 0;
  return obj;
}

const ERROR_PROFILES: Record<ErrorType, {
  severity: ErrorSeverity;
  recoverable: boolean;
  userMessage: string;
  suggestedAction: string;
}> = {
  FILE_FORMAT_INVALID: {
    severity: 'medium',
    recoverable: true,
    userMessage: 'The file format is not supported. Please use a compatible format (MP3, WAV, OGG, M4A).',
    suggestedAction: 'Convert the file to a supported audio format and try again.',
  },
  FILE_SIZE_EXCEEDED: {
    severity: 'medium',
    recoverable: true,
    userMessage: 'The file size exceeds the maximum allowed limit.',
    suggestedAction: 'Compress the file or split it into smaller parts.',
  },
  LLM_API_ERROR: {
    severity: 'high',
    recoverable: true,
    userMessage: 'An error occurred while communicating with the AI service.',
    suggestedAction: 'Retry the operation. If the problem persists, check API configuration.',
  },
  LLM_RATE_LIMITED: {
    severity: 'medium',
    recoverable: true,
    userMessage: 'The AI service rate limit has been exceeded.',
    suggestedAction: 'Wait a moment and retry. Consider reducing request frequency.',
  },
  LLM_TIMEOUT: {
    severity: 'medium',
    recoverable: true,
    userMessage: 'The AI service request timed out.',
    suggestedAction: 'Retry with a shorter input or increase the timeout setting.',
  },
  RENDERING_ERROR: {
    severity: 'high',
    recoverable: true,
    userMessage: 'An error occurred during video rendering.',
    suggestedAction: 'Try reducing video quality or complexity and retry.',
  },
  RENDERING_OOM: {
    severity: 'critical',
    recoverable: true,
    userMessage: 'Rendering failed due to insufficient memory.',
    suggestedAction: 'Free up system memory, reduce video resolution, or use the "fast" preset.',
  },
  NETWORK_ERROR: {
    severity: 'high',
    recoverable: true,
    userMessage: 'A network error occurred. Please check your internet connection.',
    suggestedAction: 'Check your network connection and retry.',
  },
  STORAGE_ERROR: {
    severity: 'high',
    recoverable: true,
    userMessage: 'A storage error occurred while reading or writing files.',
    suggestedAction: 'Check available disk space and file permissions.',
  },
  QUALITY_GATE_FAILED: {
    severity: 'high',
    recoverable: true,
    userMessage: 'The processing result did not meet quality standards.',
    suggestedAction: 'Review input quality and retry with adjusted settings.',
  },
  UNKNOWN: {
    severity: 'low',
    recoverable: false,
    userMessage: 'An unexpected error occurred.',
    suggestedAction: 'Try again or contact support if the problem persists.',
  },
};

/**
 * Pattern matching rules for error classification.
 * Evaluated in order; first match wins.
 */
interface ClassificationRule {
  type: ErrorType;
  match: (message: string) => boolean;
}

const CLASSIFICATION_RULES: ClassificationRule[] = [
  // OOM must be first to catch memory issues before generic errors
  {
    type: 'RENDERING_OOM',
    match: (msg) =>
      /out of memory|oom|heap out of memory|allocation failed/i.test(msg),
  },
  // Rate limit before generic LLM errors
  {
    type: 'LLM_RATE_LIMITED',
    match: (msg) =>
      /rate limit|quota (exceeded|reached)|too many requests/i.test(msg),
  },
  {
    type: 'LLM_TIMEOUT',
    match: (msg) =>
      /llm.*timed? ?out|timed? ?out.*llm/i.test(msg),
  },
  {
    type: 'LLM_API_ERROR',
    match: (msg) =>
      /llm|gemini|openai|gpt.*api|api.*(500|503|error|fail)/i.test(msg),
  },
  {
    type: 'RENDERING_ERROR',
    match: (msg) =>
      /render|video.*(fail|error)|frame.*(fail|error)/i.test(msg),
  },
  {
    type: 'NETWORK_ERROR',
    match: (msg) =>
      /network|connection.*(refused|reset|failed)|econnrefused|fetch.*fail/i.test(msg),
  },
  // Storage must come before file size (disk space vs file size)
  {
    type: 'STORAGE_ERROR',
    match: (msg) =>
      /storage|no space left|disk|write.*fail|read.*fail|i\/o error/i.test(msg),
  },
  {
    type: 'QUALITY_GATE_FAILED',
    match: (msg) =>
      /quality.*(gate|score|threshold|below|fail)|below.*threshold/i.test(msg),
  },
  // File size before file format (both mention "file")
  {
    type: 'FILE_SIZE_EXCEEDED',
    match: (msg) =>
      /file size|too large|size (limit|exceeds|exceeded|max)/i.test(msg),
  },
  {
    type: 'FILE_FORMAT_INVALID',
    match: (msg) =>
      /file.*(format|type)|unsupported|invalid format/i.test(msg),
  },
];

/**
 * ErrorClassifier classifies errors into typed categories with
 * severity, recoverability, and suggested actions.
 */
export class ErrorClassifier {
  private classificationHistory: ClassifiedError[] = [];

  /**
   * Classify a single error.
   */
  classify(error: Error, context?: ClassifyContext): ClassifiedError {
    const message = error.message;

    // Use pre-classified type from PipelineError when available (no regex guesswork)
    const type = isPipelineErrorLike(error)
      ? error.errorType
      : this.determineType(message);

    const profile = ERROR_PROFILES[type];
    const stage = isPipelineErrorLike(error)
      ? (error.stage ?? context?.stage ?? 'unknown')
      : (context?.stage ?? 'unknown');

    const classified: ClassifiedError = {
      type,
      severity: profile.severity,
      stage,
      originalError: error,
      userMessage: profile.userMessage,
      recoverable: profile.recoverable,
      suggestedAction: profile.suggestedAction,
    };

    this.classificationHistory.push(classified);
    return classified;
  }

  /**
   * Classify a batch of errors.
   */
  classifyBatch(errors: Error[], context?: ClassifyContext): ClassifiedError[] {
    return errors.map((error) => this.classify(error, context));
  }

  /**
   * Get classification statistics.
   */
  getStatistics(): ClassificationStatistics {
    const total = this.classificationHistory.length;
    const byType = createEmptyByType();

    for (const classified of this.classificationHistory) {
      byType[classified.type]++;
    }

    let mostCommonType: ErrorType = 'UNKNOWN';
    let maxCount = 0;
    for (const type of ALL_ERROR_TYPES) {
      if (byType[type] > maxCount) {
        maxCount = byType[type];
        mostCommonType = type;
      }
    }

    return { total, byType, mostCommonType };
  }

  /**
   * Determine the error type from the error message.
   */
  private determineType(message: string): ErrorType {
    for (const rule of CLASSIFICATION_RULES) {
      if (rule.match(message)) {
        return rule.type;
      }
    }
    return 'UNKNOWN';
  }
}
