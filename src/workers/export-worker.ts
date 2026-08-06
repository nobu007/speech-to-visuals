/**
 * Export Worker - Handles CPU-intensive export rendering operations
 *
 * Processes export data preparation and frame computation off the main thread.
 * Actual Remotion rendering requires browser context and stays on main thread;
 * this worker handles the computationally heavy data transformations.
 */

import type {
  WorkerMessage,
  WorkerResponse,
  ExportWorkerPayload,
  ExportWorkerResult,
} from './types';

/**
 * Process export rendering data in worker context.
 * Extracted as a standalone function for testability.
 */
export function processExportPayload(
  payload: ExportWorkerPayload,
): ExportWorkerResult {
  const { format, data, options } = payload;

  // Validate input
  if (!data || typeof data !== 'object') {
    return {
      warnings: ['Invalid export data provided'],
    };
  }

  // Calculate frame count based on options (clamp to positive values)
  // Guard against non-numeric inputs (strings, objects) that would produce NaN
  const rawFps = Number(options.fps);
  const rawDuration = Number(options.duration);
  const rawAvgFrameSize = Number(options.avgFrameSize);
  const fps = Math.max(1, Number.isFinite(rawFps) && rawFps > 0 ? rawFps : 30);
  const duration = Math.max(0.1, Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 10);
  const totalFrames = Math.ceil(duration * fps);

  // Process scene data for rendering
  const sceneCount = Array.isArray(data.scenes) ? data.scenes.length : 0;
  const avgFrameSize = Number.isFinite(rawAvgFrameSize) && rawAvgFrameSize > 0 ? rawAvgFrameSize : 50000;
  const estimatedSize = totalFrames * avgFrameSize;

  // Prepare rendering metadata
  const warnings: string[] = [];

  if (totalFrames > 3000) {
    warnings.push(`Large frame count (${totalFrames}): consider reducing duration or fps`);
  }

  if (format === 'gif' && duration > 30) {
    warnings.push('GIF format for long durations produces very large files');
  }

  return {
    outputSize: estimatedSize,
    duration,
    warnings,
  };
}

// Worker message handler - runs inside Web Worker
const handler = (e: MessageEvent<WorkerMessage<ExportWorkerPayload>>): void => {
  const { id, type, payload } = e.data;

  try {
    const result = processExportPayload(payload);
    const response: WorkerResponse<ExportWorkerResult> = {
      id,
      type,
      payload: result,
    };
    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      id,
      type,
      error: {
        code: 'EXPORT_ERROR',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    };
    self.postMessage(response);
  }
};

// Register handler in Worker context (guarded for Node.js test env)
if (typeof self !== 'undefined' && typeof self.onmessage !== 'undefined') {
  self.onmessage = handler;
}
