/**
 * Measured-only producer for `ExtendedPipelineMetrics.memoryUsage` (REQ-387).
 *
 * REQ-383/386 made the quality legs read `result.metrics?.memoryUsage` (bytes)
 * measured-only — but no pipeline ever POPULATED the field, so both legs were
 * permanently excluded and the contract sat dead. This module is the value
 * computation behind MainPipeline's producer wiring: the peak observed heap
 * usage in BYTES across a run's samples, or `null` when nothing was measured.
 *
 * Pure over its inputs (samples + the live reading) so the unmeasured branch —
 * which cannot be reproduced against a real Node backend that always reports a
 * positive heap — is exhaustively testable without module mocks.
 */

/**
 * Peak of the positive finite `samples` and `liveReading`, in bytes verbatim
 * (no MB conversion — `ExtendedPipelineMetrics.memoryUsage` documents bytes;
 * the REQ-386 consumer performs its own bytes→MB division).
 *
 * Returns `null` when NO usable reading exists. Zero is NOT usable: stv-core's
 * `getMemoryUsage()` returns `{heapUsed: 0}` when the runtime exposes no
 * memory API, so a 0 there means "unmeasured", not a real reading (a live
 * heap is never 0 bytes). Publishing `memoryUsage: 0` would hand REQ-386's
 * `assessMemoryUsage` a finite "0 bytes = excellent" always-pass — reopening
 * the fabricated-leg door the measured-only contract closed. Same
 * `heapUsed > 0` discipline as MainPipeline.initializePerformanceMonitoring.
 */
export function peakHeapUsedBytes(
  samples: Iterable<number>,
  liveReading: number | null,
): number | null {
  let peak: number | null = null;

  const consider = (value: number): void => {
    if (Number.isFinite(value) && value > 0 && (peak === null || value > peak)) {
      peak = value;
    }
  };

  for (const sample of samples) {
    consider(sample);
  }
  if (liveReading !== null) {
    consider(liveReading);
  }

  return peak;
}
