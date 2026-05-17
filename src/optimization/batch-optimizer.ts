/**
 * Batch Optimizer - Batch processing with parallel chunking
 * Splits work into chunks and processes them with configurable concurrency
 */

export interface BatchOptimizerOptions {
  /** Maximum number of chunks processed in parallel */
  concurrency: number;
  /** Number of items per chunk */
  chunkSize: number;
  /** Abort processing when any chunk fails */
  failFast?: boolean;
  /** Called after each item is processed with the current progress */
  onProgress?: (completed: number, total: number) => void;
  /** Optional AbortSignal to cancel in-flight processing */
  signal?: AbortSignal;
}

export interface BatchResult<T> {
  /** Successfully processed results in original order */
  results: T[];
  /** Index-positioned entries: null for success, Error for failures */
  errors: (Error | null)[];
  /** Total processing time in milliseconds */
  totalTimeMs: number;
  /** Number of items that succeeded */
  successCount: number;
  /** Number of items that failed */
  failureCount: number;
}

const DEFAULT_OPTIONS: BatchOptimizerOptions = {
  concurrency: 4,
  chunkSize: 50,
  failFast: false,
};

/**
 * Batch processing optimizer with parallel chunking.
 *
 * Splits an input array into chunks and processes them with bounded
 * concurrency, collecting results in original order.
 */
export class BatchOptimizer {
  private readonly options: BatchOptimizerOptions;

  constructor(options: Partial<BatchOptimizerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Process an array of items in parallel chunks.
   *
   * The processor function receives a single item and returns a result.
   * Items are split into chunks based on `chunkSize`, and up to
   * `concurrency` chunks are processed simultaneously.
   */
  async process<I, O>(
    items: I[],
    processor: (item: I, index: number) => Promise<O>
  ): Promise<BatchResult<O>> {
    const startTime = performance.now();
    const total = items.length;

    const results: O[] = new Array(total);
    const errors: (Error | null)[] = new Array(total).fill(null);
    let successCount = 0;
    let failureCount = 0;
    let completedCount = 0;

    if (total === 0) {
      return {
        results,
        errors,
        totalTimeMs: performance.now() - startTime,
        successCount: 0,
        failureCount: 0,
      };
    }

    // Build index ranges for each chunk
    const chunkRanges: { start: number; end: number }[] = [];
    for (let i = 0; i < total; i += this.options.chunkSize) {
      chunkRanges.push({
        start: i,
        end: Math.min(i + this.options.chunkSize, total),
      });
    }

    // Process chunks with bounded concurrency using sliding window
    const pending = new Set<Promise<void>>();

    for (const range of chunkRanges) {
      if (this.options.signal?.aborted) {
        break;
      }

      const chunkPromise = this.processChunk(
        items,
        range.start,
        range.end,
        processor,
        results,
        errors
      ).then(({ succeeded, failed }) => {
        successCount += succeeded;
        failureCount += failed;
        completedCount += range.end - range.start;
        this.options.onProgress?.(completedCount, total);
      });

      pending.add(chunkPromise);
      chunkPromise.then(
        () => { pending.delete(chunkPromise); },
        () => { pending.delete(chunkPromise); }
      );

      if (pending.size >= this.options.concurrency) {
        await Promise.race(pending);
      }
    }

    await Promise.allSettled(pending);

    return {
      results,
      errors,
      totalTimeMs: performance.now() - startTime,
      successCount,
      failureCount,
    };
  }

  private async processChunk<I, O>(
    items: I[],
    start: number,
    end: number,
    processor: (item: I, index: number) => Promise<O>,
    results: O[],
    errors: (Error | null)[]
  ): Promise<{ succeeded: number; failed: number }> {
    let succeeded = 0;
    let failed = 0;

    for (let i = start; i < end; i++) {
      if (this.options.signal?.aborted) {
        break;
      }
      try {
        results[i] = await processor(items[i], i);
        succeeded++;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        errors[i] = error;
        failed++;
        if (this.options.failFast) {
          throw error;
        }
      }
    }

    return { succeeded, failed };
  }
}

/**
 * Convenience function: process items in parallel batches with default settings.
 */
export async function batchProcess<I, O>(
  items: I[],
  processor: (item: I, index: number) => Promise<O>,
  options?: Partial<BatchOptimizerOptions>
): Promise<BatchResult<O>> {
  const optimizer = new BatchOptimizer(options);
  return optimizer.process(items, processor);
}
