/**
 * TASK-0019: Retry Strategy with Exponential Backoff and Jitter
 *
 * Provides configurable retry logic for LLM API calls:
 * - Exponential backoff: baseDelay * 2^attempt
 * - Jitter: random delay up to 50% of backoff to prevent thundering herd
 * - Max retries: 3 by default
 * - Retryable error detection: 429, 500, 502, 503, network errors
 * - Non-retryable: 400, 401, 403, 404
 */

import { logger } from '@stv/core/utils/logger';

export interface RetryOptions {
  maxRetries?: number;   // default: 3
  baseDelay?: number;    // default: 1000ms
  maxDelay?: number;     // default: 10000ms
}

export interface RetryAttempt {
  attempt: number;
  delay: number;
  error: unknown;
  timestamp: number;
}

/**
 * Canonical LLM-call retry defaults (single source, round 9).
 * Consumers that need "the default" (llm-service `||` fallback, gemini-analyzer
 * explicit override, fallback-chain constructor fallback) MUST import this —
 * re-typing 3/1000/10000 at a consumer re-freezes the family (guarded by the
 * frozen-literal registry rule 'analysis retry defaults …').
 * The pipeline-layer retry system (src/pipeline/retry.ts, ErrorClassifier-driven,
 * 500ms base) is a different concept and keeps its own defaults.
 */
export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
};

/**
 * Retryable HTTP status codes
 */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503]);

/**
 * Non-retryable HTTP status codes
 */
const NON_RETRYABLE_STATUS_CODES = new Set([400, 401, 403, 404]);

/**
 * Calculate exponential backoff delay without jitter
 * Formula: baseDelay * 2^attempt, capped at maxDelay
 */
export function calculateBackoff(
  attempt: number,
  baseDelay: number = DEFAULT_RETRY_OPTIONS.baseDelay,
  maxDelay: number = DEFAULT_RETRY_OPTIONS.maxDelay
): number {
  const delay = baseDelay * Math.pow(2, attempt);
  return Math.min(delay, maxDelay);
}

/**
 * Generate random jitter value
 * @param maxMs Maximum jitter in milliseconds (should be <= 50% of backoff)
 * @param seededRandom Optional seeded random for deterministic tests
 */
export function generateJitter(maxMs: number, seededRandom?: () => number): number {
  const random = seededRandom || Math.random;
  return Math.floor(random() * maxMs);
}

/**
 * Calculate backoff with jitter
 * Jitter is up to 50% of the calculated backoff
 */
export function calculateBackoffWithJitter(
  attempt: number,
  baseDelay: number = DEFAULT_RETRY_OPTIONS.baseDelay,
  maxDelay: number = DEFAULT_RETRY_OPTIONS.maxDelay,
  seededRandom?: () => number
): number {
  const backoff = calculateBackoff(attempt, baseDelay, maxDelay);
  const jitterMax = Math.floor(backoff * 0.5);
  const jitter = generateJitter(jitterMax, seededRandom);
  return Math.min(backoff + jitter, maxDelay);
}

/**
 * Determine if an error is retryable
 */
export function isRetryable(error: unknown): boolean {
  if (error == null) return false;

  // Check for status code property
  const err = error as Record<string, unknown>;

  if (typeof err.status === 'number') {
    if (NON_RETRYABLE_STATUS_CODES.has(err.status)) return false;
    if (RETRYABLE_STATUS_CODES.has(err.status)) return true;
  }

  if (typeof err.statusCode === 'number') {
    if (NON_RETRYABLE_STATUS_CODES.has(err.statusCode)) return false;
    if (RETRYABLE_STATUS_CODES.has(err.statusCode)) return true;
  }

  // Check for network errors
  if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
    return true;
  }

  // Check for error message patterns
  if (typeof err.message === 'string') {
    const msg = (err.message as string).toLowerCase();
    if (msg.includes('rate limit') || msg.includes('timeout') || msg.includes('network')) {
      return true;
    }
  }

  // Default: not retryable for unknown errors
  return false;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic
 * Retries up to maxRetries times on retryable errors with exponential backoff + jitter
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const log: RetryAttempt[] = [];
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      lastError = error;

      // Don't retry if error is not retryable or we've exhausted retries
      if (!isRetryable(error) || attempt >= opts.maxRetries) {
        throw error;
      }

      const delay = calculateBackoffWithJitter(attempt, opts.baseDelay, opts.maxDelay);
      log.push({
        attempt: attempt + 1,
        delay,
        error,
        timestamp: Date.now(),
      });

      logger.warn(
        `[RetryStrategy] Attempt ${attempt + 1}/${opts.maxRetries} failed, ` +
        `retrying in ${delay}ms...`,
        error instanceof Error ? error.message : String(error)
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * RetryStrategy class for managing retry configurations
 */
export class RetryStrategy {
  private options: Required<RetryOptions>;

  constructor(options?: RetryOptions) {
    this.options = { ...DEFAULT_RETRY_OPTIONS, ...options };
  }

  calculateBackoff(attempt: number): number {
    return calculateBackoff(attempt, this.options.baseDelay, this.options.maxDelay);
  }

  calculateBackoffWithJitter(attempt: number, seededRandom?: () => number): number {
    return calculateBackoffWithJitter(
      attempt,
      this.options.baseDelay,
      this.options.maxDelay,
      seededRandom
    );
  }

  async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    return executeWithRetry(fn, this.options);
  }

  getOptions(): Required<RetryOptions> {
    return { ...this.options };
  }
}
