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

    // Process chunks with bounded concurrency
    const executing: Promise<void>[] = [];

    for (const range of chunkRanges) {
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

      executing.push(chunkPromise);

      if (executing.length >= this.options.concurrency) {
        await Promise.race(executing);
        // Remove settled promises
        for (let i = executing.length - 1; i >= 0; i--) {
          // Re-check by attempting to see if settled (already resolved promises resolve immediately)
          // We use a simple approach: await all settled ones in order
        }
        // Simpler: just await one and compact
        const settled = await Promise.allSettled(executing);
        const stillRunning: Promise<void>[] = [];
        for (let i = 0; i < settled.length; i++) {
          if (settled[i].status === 'pending') {
            stillRunning.push(executing[i]);
          }
        }
        executing.length = 0;
        executing.push(...stillRunning);
      }
    }

    await Promise.all(executing);

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
