/**
 * TASK-0143: Parallel Layout Executor (REQ-097)
 *
 * Executes layout generation for multiple diagrams in parallel
 * with configurable concurrency limits, per-item timeout, and optional retry support.
 */

import { retryWithBackoff, type RetryWithBackoffOptions } from './retry';

/** Configuration for parallel layout execution */
export interface ParallelLayoutConfig {
  maxConcurrency: number; // default: 3
  timeoutMs: number;      // default: 30000
  /** Retry options applied to each individual item operation */
  retryOptions?: RetryWithBackoffOptions;
}

const DEFAULT_LAYOUT_CONFIG: ParallelLayoutConfig = {
  maxConcurrency: 3,
  timeoutMs: 30000,
};

/**
 * Race a promise against a timeout.  The timer is cleaned up via
 * `.finally()` so no dangling reference remains regardless of outcome.
 */
function raceWithTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    // Don't keep the event loop alive solely for the timeout timer.
    if (timer && typeof timer.unref === 'function') timer.unref();
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

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

  const taskFn = async (diagram: T, index: number) => {
    const label = `layout:${index}`;

    const execPromise = fullConfig.retryOptions
      ? retryWithBackoff(() => layoutFn(diagram, index), {
          ...fullConfig.retryOptions,
          label: fullConfig.retryOptions.label ?? label,
        }).then(r => r.result)
      : layoutFn(diagram, index);

    return raceWithTimeout(execPromise, fullConfig.timeoutMs, label);
  };

  return runWithConcurrency(diagrams, fullConfig.maxConcurrency, taskFn);
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
  retryOptions?: RetryWithBackoffOptions,
): Promise<R[]> {
  if (layouts.length === 0) return [];

  const taskFn = retryOptions
    ? async (layout: T, index: number) => {
        const { result } = await retryWithBackoff(
          () => prepareFn(layout, index),
          { ...retryOptions, label: retryOptions.label ?? `scene-prep:${index}` },
        );
        return result;
      }
    : prepareFn;

  return runWithConcurrency(layouts, maxConcurrency, taskFn);
}
