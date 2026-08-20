/**
 * Memory-backend boundary — the SINGLE source-side contract over
 * `@stv/core/utils/memory-usage` (REQ-358, Phase 166).
 *
 * Phase 157–162 (REQ-347~354) routed the same failure signal — the memory
 * backend omitting or non-finitely drifting on heap fields — through three
 * separate HealthCheckService consumer layers, each with its own
 * isFiniteMetric/typeof guard. Multi-layer fail-loud was correct as a
 * stopgap, but it cannot prevent the SAME missing signal from re-appearing
 * in the next consumer (adaptive-quality-gates read `snapshot.system`
 * unguarded: `null < 85` silently PASSED the critical Memory Usage gate, and
 * `null.toFixed(2)` crashed `evaluateGates` outright).
 *
 * This module is the root fix: ONE boundary with the output contract
 *
 *   every field is EITHER a finite number OR explicit null —
 *   never undefined, never NaN, never ±Infinity.
 *
 * `null` means "the runtime exposes no memory API (or the backend returned a
 * non-finite value)". A backend zero-fallback (`{ heapUsed: 0, heapTotal: 0 }`)
 * is a REAL finite reading and stays a number — unavailability and a zero
 * reading are different facts and must not be conflated. The contract is
 * machine-verified in ONE place (tests/unit/monitoring/
 * memory-backend-contract.test.ts); consumers branch on `=== null`.
 *
 * All monitoring-side derivations (heap-ratio percent, MB conversion) live
 * here too, so the heap-usage-canon / bytes-to-mb-canon guards anchor the
 * canonical `heapUsagePercent`/`bytesToMb` calls at exactly this file.
 */

import { getMemoryUsage } from '@stv/core/utils/memory-usage';
import { heapUsagePercent, bytesToMb, roundTo } from '@stv/core/lib/metrics-utils';

/**
 * A memory reading under the REQ-358 contract. Every field is finite-or-null;
 * null = "no reading available" (backend omitted the field or returned a
 * non-finite value).
 */
export interface MemoryBackendReading {
  /** Used heap in bytes, or null when unmeasured. */
  heapUsed: number | null;
  /** Total heap in bytes, or null when unmeasured. */
  heapTotal: number | null;
  /** Resident set in bytes, or null when unmeasured (browser paths omit it). */
  rss: number | null;
  /** External memory in bytes, or null when unmeasured (browser paths omit it). */
  external: number | null;
}

/** Map a backend-supplied value onto the contract: finite number or null. */
function finiteOrNull(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Read the memory backend under the finite-or-null contract. Never throws on
 * malformed backend output; a backend that omits or poisons a field yields
 * `null` for that field only.
 */
export function readMemoryBackend(): MemoryBackendReading {
  const raw = getMemoryUsage();
  return {
    heapUsed: finiteOrNull(raw.heapUsed),
    heapTotal: finiteOrNull(raw.heapTotal),
    rss: finiteOrNull(raw.rss),
    external: finiteOrNull(raw.external),
  };
}

/**
 * Heap-usage percent under the contract: the canonical `heapUsagePercent`
 * (×100 of `heapUsageRatio`, zero-division-guarded) when BOTH sides are
 * finite readings; `null` when either side is unmeasured. Never fabricated:
 * returning 0 for an unmeasured pair would read as "healthy" to the 70/90
 * health thresholds and silently pass the 85% Memory Usage quality gate.
 *
 * Note: a measured `{heapUsed: 0, heapTotal: 0}` (the stv-core zero-fallback
 * reading) is NOT null — `heapUsageRatio` guards the division and returns 0.
 */
export function heapUsagePercentOrNull(reading: MemoryBackendReading): number | null {
  if (reading.heapUsed === null || reading.heapTotal === null) return null;
  return heapUsagePercent(reading.heapUsed, reading.heapTotal);
}

/**
 * `heapUsagePercentOrNull` with call-site rounding (same rounding policy as
 * every other published monitoring metric: 2 decimals at the publisher).
 */
export function heapUsagePercentRoundedOrNull(
  reading: MemoryBackendReading,
  decimals: number,
): number | null {
  const percent = heapUsagePercentOrNull(reading);
  return percent === null ? null : roundTo(percent, decimals);
}

/**
 * Byte count → rounded binary MB under the contract: canonical `bytesToMb`
 * (+ call-site rounding, per the bytes-to-mb canon) for a finite reading;
 * `null` when unmeasured.
 */
export function mbRoundedOrNull(bytes: number | null, decimals: number): number | null {
  if (bytes === null) return null;
  return roundTo(bytesToMb(bytes), decimals);
}
