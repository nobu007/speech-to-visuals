/**
 * Pipeline retry with exponential backoff, driven by ErrorClassifier.
 *
 * The ErrorClassifier.classify() → classified.recoverable check determines
 * whether a failed operation is worth retrying. Non-recoverable errors
 * (UNKNOWN type, auth failures, etc.) propagate immediately.
 */

import { ErrorClassifier } from '@/quality/error-classifier';
import { logger } from '@stv/core/utils/logger';

export interface RetryWithBackoffOptions {
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in ms before the first retry (default: 500) */
  baseDelayMs?: number;
  /** Multiplier applied to the delay after each attempt (default: 2) */
  backoffFactor?: number;
  /** Upper bound on delay between retries in ms (default: 10000) */
  maxDelayMs?: number;
  /** Optional label used in log messages */
  label?: string;
}

/** Result of retryWithBackoff including attempt metadata */
export interface RetryResult<T> {
  /** The successful return value of fn */
  result: T;
  /** Number of retries that occurred (0 = succeeded on first attempt) */
  attempts: number;
}

const DEFAULT_OPTIONS: Required<Omit<RetryWithBackoffOptions, 'label'>> = {
  maxRetries: 3,
  baseDelayMs: 500,
  backoffFactor: 2,
  maxDelayMs: 10_000,
};

/**
 * Execute `fn` with automatic retry on recoverable errors.
 *
 * Uses a shared ErrorClassifier instance to decide retry eligibility.
 * Returns a RetryResult with the fn result and retry attempt count.
 * Throws the last error when all retries are exhausted or the error is non-recoverable.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: RetryWithBackoffOptions,
): Promise<RetryResult<T>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const classifier = new ErrorClassifier();
  const label = opts.label ?? 'operation';

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const result = await fn();
      return { result, attempts: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Classify to determine recoverability
      const classified = classifier.classify(lastError);

      if (!classified.recoverable) {
        logger.warn(
          `[retry:${label}] Non-recoverable ${classified.type} error on attempt ${attempt + 1}, giving up`,
        );
        throw lastError;
      }

      // All retries exhausted
      if (attempt >= opts.maxRetries) {
        logger.warn(
          `[retry:${label}] Exhausted ${opts.maxRetries} retries for ${classified.type} error`,
        );
        throw lastError;
      }

      const delay = Math.min(
        opts.baseDelayMs * Math.pow(opts.backoffFactor, attempt),
        opts.maxDelayMs,
      );

      logger.info(
        `[retry:${label}] Recoverable ${classified.type} error on attempt ${attempt + 1}, retrying in ${delay}ms`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Unreachable, but satisfies TypeScript
  throw lastError;
}
