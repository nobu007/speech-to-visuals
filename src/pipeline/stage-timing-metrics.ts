/**
 * TASK-0143: Stage Timing Metrics (REQ-097)
 *
 * Records per-stage execution timing for the pipeline.
 * Tracks start/end time, duration, items processed, and throughput.
 */

/** Timing data for a single pipeline stage execution */
export interface StageTimingRecord {
  stageName: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  itemsProcessed: number;
  throughputPerMs: number;
  /** Number of retry attempts that occurred during this stage (0 = no retries) */
  retryAttempts?: number;
}

/** Full timing report across all stages */
export interface StageTimingReport {
  timestamp: number;
  stages: StageTimingRecord[];
  totalDurationMs: number;
  totalItemsProcessed: number;
  overallThroughputPerMs: number;
}

/**
 * Create a StageTimingRecord from raw measurements.
 */
export function createTimingRecord(
  stageName: string,
  startTime: number,
  endTime: number,
  itemsProcessed: number,
  retryAttempts: number = 0,
): StageTimingRecord {
  const durationMs = endTime - startTime;
  return {
    stageName,
    startTime,
    endTime,
    durationMs,
    itemsProcessed,
    throughputPerMs: durationMs > 0 ? itemsProcessed / durationMs : 0,
    retryAttempts,
  };
}

/**
 * Aggregate multiple timing records into a full report.
 */
export function aggregateTimingReport(stages: StageTimingRecord[]): StageTimingReport {
  const totalDurationMs = stages.reduce((s, r) => s + r.durationMs, 0);
  const totalItemsProcessed = stages.reduce((s, r) => s + r.itemsProcessed, 0);
  return {
    timestamp: Date.now(),
    stages,
    totalDurationMs,
    totalItemsProcessed,
    overallThroughputPerMs: totalDurationMs > 0 ? totalItemsProcessed / totalDurationMs : 0,
  };
}

/**
 * Helper to time an async stage execution.
 * Wraps the stage function and records timing automatically.
 */
export async function timeStage<T>(
  stageName: string,
  itemsCount: number,
  stageFn: () => Promise<T>,
  retryAttempts?: number,
): Promise<{ result: T; timing: StageTimingRecord }> {
  const startTime = Date.now();
  const result = await stageFn();
  const endTime = Date.now();
  const timing = createTimingRecord(stageName, startTime, endTime, itemsCount, retryAttempts ?? 0);
  return { result, timing };
}
