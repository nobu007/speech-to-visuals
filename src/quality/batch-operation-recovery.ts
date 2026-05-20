/**
 * BatchOperationRecovery: Per-item error boundaries for batch pipeline stages.
 *
 * While EnhancedErrorRecovery handles stage-level failures, this module
 * provides fine-grained recovery when a stage processes multiple items
 * (e.g. generating layouts for N diagrams, preparing M scenes).
 * Individual item failures are isolated so that partial successes are
 * preserved instead of failing the entire stage.
 */

import { ErrorClassifier, type ClassifiedError } from './error-classifier';
import { logger } from '@/utils/logger';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Configuration for a single batch recovery run. */
export interface BatchRecoveryConfig {
  /** Maximum retries per item before using fallback. Default 2. */
  maxRetries: number;
  /** Base delay in ms for exponential backoff between retries. Default 200. */
  retryDelayMs: number;
  /** Multiplier applied to the delay after each attempt. Default 2. */
  backoffMultiplier: number;
  /** If true, items are processed concurrently up to `concurrency` at a time. Default false. */
  concurrent: boolean;
  /** Max parallel items when `concurrent` is true. Default 4. */
  concurrency: number;
  /** Stage label carried into classified errors and logs. */
  stage: string;
}

/** Outcome for a single item in the batch. */
export interface ItemResult<T> {
  /** Zero-based index of the item in the original input array. */
  index: number;
  /** Whether the item was processed successfully (possibly via fallback). */
  success: boolean;
  /** The output value — from primary op or fallback. Undefined on hard failure. */
  result?: T;
  /** True when the primary operation failed and the fallback was used instead. */
  fallbackUsed: boolean;
  /** Number of retry attempts before success or final failure. */
  attempts: number;
  /** Classified error when the item ultimately failed. */
  error?: ClassifiedError;
  /** Wall-clock time spent on this item (ms). */
  durationMs: number;
}

/** Aggregate result for the entire batch. */
export interface BatchResult<T> {
  /** Per-item outcomes, in the same order as the input. */
  items: ItemResult<T>[];
  /** Number of items that succeeded (including fallbacks). */
  succeeded: number;
  /** Number of items that failed even after retries/fallback. */
  failed: number;
  /** Total items processed. */
  total: number;
  /** Success rate 0-1 (succeeded / total). */
  successRate: number;
  /** Total wall-clock time for the batch (ms). */
  totalDurationMs: number;
  /** Stage label. */
  stage: string;
}

/** A function that processes a single item. */
export type ItemProcessor<Input, Output> = (item: Input, index: number) => Promise<Output>;

/** A function that produces a degraded but usable fallback output. */
export type FallbackProvider<Input, Output> = (item: Input, index: number, error: ClassifiedError) => Promise<Output | undefined>;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: Readonly<Omit<BatchRecoveryConfig, 'stage'>> = {
  maxRetries: 2,
  retryDelayMs: 200,
  backoffMultiplier: 2,
  concurrent: false,
  concurrency: 4,
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * BatchOperationRecovery wraps batch operations with per-item error boundaries,
 * automatic retry with exponential backoff, optional fallback, and detailed
 * result tracking.
 *
 * Usage:
 * ```ts
 * const recovery = new BatchOperationRecovery();
 * const result = await recovery.process(diagrams, generateLayout, fallbackLayout, {
 *   stage: 'layout_generation',
 *   maxRetries: 3,
 * });
 * // result.successRate === 0.8  → 4/5 layouts succeeded
 * ```
 */
export class BatchOperationRecovery {
  private readonly classifier = new ErrorClassifier();

  /**
   * Process a batch of items with per-item error recovery.
   *
   * @param items       Input items to process.
   * @param processor   Primary processing function for each item.
   * @param fallback    Optional fallback when the primary fails after all retries.
   * @param config      Configuration for retry behaviour and stage label.
   * @returns           A `BatchResult` with per-item details and aggregate stats.
   */
  async process<Input, Output>(
    items: Input[],
    processor: ItemProcessor<Input, Output>,
    fallback: FallbackProvider<Input, Output> | undefined,
    config: Partial<BatchRecoveryConfig> & { stage: string },
  ): Promise<BatchResult<Output>> {
    const fullConfig: BatchRecoveryConfig = { ...DEFAULT_CONFIG, ...config };
    const startTime = Date.now();

    let itemResults: ItemResult<Output>[];

    if (fullConfig.concurrent) {
      itemResults = await this.processConcurrently(items, processor, fallback, fullConfig);
    } else {
      itemResults = await this.processSequentially(items, processor, fallback, fullConfig);
    }

    const totalDurationMs = Date.now() - startTime;
    const succeeded = itemResults.filter((r) => r.success).length;
    const failed = itemResults.filter((r) => !r.success).length;

    const batchResult: BatchResult<Output> = {
      items: itemResults,
      succeeded,
      failed,
      total: items.length,
      successRate: items.length > 0 ? succeeded / items.length : 1,
      totalDurationMs,
      stage: fullConfig.stage,
    };

    logger.info(
      `[BatchRecovery] Stage=${fullConfig.stage} ` +
      `succeeded=${succeeded}/${items.length} ` +
      `failed=${failed} rate=${batchResult.successRate.toFixed(2)} ` +
      `duration=${totalDurationMs}ms`,
    );

    return batchResult;
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  private async processSequentially<Input, Output>(
    items: Input[],
    processor: ItemProcessor<Input, Output>,
    fallback: FallbackProvider<Input, Output> | undefined,
    config: BatchRecoveryConfig,
  ): Promise<ItemResult<Output>[]> {
    const results: ItemResult<Output>[] = [];
    for (let i = 0; i < items.length; i++) {
      results.push(await this.processItem(items[i], i, processor, fallback, config));
    }
    return results;
  }

  private async processConcurrently<Input, Output>(
    items: Input[],
    processor: ItemProcessor<Input, Output>,
    fallback: FallbackProvider<Input, Output> | undefined,
    config: BatchRecoveryConfig,
  ): Promise<ItemResult<Output>[]> {
    const results: ItemResult<Output>[] = new Array(items.length);
    // Process in chunks of `concurrency` to avoid unbounded parallelism
    for (let start = 0; start < items.length; start += config.concurrency) {
      const chunk = items.slice(start, start + config.concurrency);
      const chunkResults = await Promise.all(
        chunk.map((item, offset) =>
          this.processItem(item, start + offset, processor, fallback, config),
        ),
      );
      for (let j = 0; j < chunkResults.length; j++) {
        results[start + j] = chunkResults[j];
      }
    }
    return results;
  }

  private async processItem<Input, Output>(
    item: Input,
    index: number,
    processor: ItemProcessor<Input, Output>,
    fallback: FallbackProvider<Input, Output> | undefined,
    config: BatchRecoveryConfig,
  ): Promise<ItemResult<Output>> {
    const itemStart = Date.now();
    let lastError: Error | undefined;
    let attempts = 0;

    // Retry loop
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      attempts++;
      try {
        const result = await processor(item, index);
        return {
          index,
          success: true,
          result,
          fallbackUsed: false,
          attempts,
          durationMs: Date.now() - itemStart,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < config.maxRetries) {
          const delay = Math.min(
            config.retryDelayMs * Math.pow(config.backoffMultiplier, attempt),
            10_000, // hard cap at 10 s
          );
          await this.sleep(delay);
        }
      }
    }

    // Primary failed after all retries — try fallback
    if (fallback && lastError) {
      try {
        const classified = this.classifier.classify(lastError, { stage: config.stage });
        const fallbackResult = await fallback(item, index, classified);
        if (fallbackResult !== undefined) {
          return {
            index,
            success: true,
            result: fallbackResult,
            fallbackUsed: true,
            attempts,
            durationMs: Date.now() - itemStart,
          };
        }
      } catch (fallbackErr) {
        const fbError = fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr));
        logger.warn(
          `[BatchRecovery] Fallback also failed for item ${index} in stage ${config.stage}: ${fbError.message}`,
        );
      }
    }

    // Complete failure
    const classified = lastError
      ? this.classifier.classify(lastError, { stage: config.stage })
      : undefined;

    return {
      index,
      success: false,
      fallbackUsed: false,
      attempts,
      error: classified,
      durationMs: Date.now() - itemStart,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
