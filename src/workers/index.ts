/**
 * Web Workers Module - Public API
 *
 * Re-exports worker infrastructure types and utilities.
 */

export { WorkerPool } from './worker-pool';
export type {
  WorkerMessage,
  WorkerResponse,
  WorkerMessageType,
  WorkerError,
  ExportWorkerPayload,
  ExportWorkerResult,
  LayoutWorkerPayload,
  LayoutWorkerResult,
} from './types';

/**
 * Check if Web Workers are available in the current environment.
 * Returns false in SSR/Node.js environments.
 */
export function isWorkerAvailable(): boolean {
  return typeof Worker !== 'undefined';
}

/**
 * Get optimal worker count based on hardware concurrency.
 * Returns a safe default in environments where navigator is unavailable.
 */
export function getOptimalWorkerCount(maxCap = 4): number {
  if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
    return Math.min(navigator.hardwareConcurrency, maxCap);
  }
  return Math.min(2, maxCap);
}

// Re-export worker processing functions for testing and fallback
export { processExportPayload } from './export-worker';
export { computeLayout } from './layout-worker';
