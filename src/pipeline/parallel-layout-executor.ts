/**
 * TASK-0143: Parallel Layout Executor (REQ-097)
 *
 * Executes layout generation for multiple diagrams in parallel
 * with configurable concurrency limits.
 */

/** Configuration for parallel layout execution */
export interface ParallelLayoutConfig {
  maxConcurrency: number; // default: 3
  timeoutMs: number;      // default: 30000
}

const DEFAULT_LAYOUT_CONFIG: ParallelLayoutConfig = {
  maxConcurrency: 3,
  timeoutMs: 30000,
};

/**
 * Run an array of async tasks with a concurrency limiter.
 * Resolves when all tasks complete; preserves input order in results.
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  maxConcurrency: number,
  taskFn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await taskFn(items[index], index);
    }
  }

  const workerCount = Math.min(maxConcurrency, items.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Execute layout generation for multiple diagrams in parallel.
 *
 * @param diagrams - Array of diagram data objects
 * @param layoutFn - The function that computes a layout for a single diagram
 * @param config - Concurrency and timeout configuration
 * @returns Array of layout results in the same order as input
 */
export async function executeLayoutsInParallel<T, R>(
  diagrams: T[],
  layoutFn: (diagram: T, index: number) => Promise<R>,
  config: Partial<ParallelLayoutConfig> = {},
): Promise<R[]> {
  const fullConfig = { ...DEFAULT_LAYOUT_CONFIG, ...config };

  if (diagrams.length === 0) return [];

  return runWithConcurrency(diagrams, fullConfig.maxConcurrency, layoutFn);
}

/**
 * Execute scene preparation for multiple layouts in parallel.
 *
 * @param layouts - Array of layout data objects
 * @param prepareFn - The function that prepares a single scene
 * @param maxConcurrency - Maximum number of concurrent preparations
 * @returns Array of scene results in the same order as input
 */
export async function executeScenePreparationInParallel<T, R>(
  layouts: T[],
  prepareFn: (layout: T, index: number) => Promise<R>,
  maxConcurrency: number = 4,
): Promise<R[]> {
  if (layouts.length === 0) return [];

  return runWithConcurrency(layouts, maxConcurrency, prepareFn);
}
