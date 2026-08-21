/**
 * Count-or-null percent-change helper (REQ-375 / REQ-378 b).
 *
 * Phase 177 までは `@stv/core/lib/metrics-utils` の companion として
 * `changePercentOrNull` を import していたが、pin 先の v1.0.7 はこの export を
 * 持たない（実体は node_modules 手パッチで、fresh install で消滅する —
 * make-run R5 grounding 不成立の直接原因）。依存先 helper の正規化は
 * vendoring か version bump のみが許されるため、同一契約を in-repo に vendor した。
 *
 * Semantics are the null-returning mirror of `@stv/core` `percentChange`:
 * `baseline === 0` and non-finite baseline both mean "no meaningful
 * percentage", and instead of the legacy fabricated `0` they surface as
 * `null` so the caller can distinguish "unmeasured" from
 * "measured-and-stable" — the count-or-null contract REQ-375 applied to
 * QualityMetrics and REQ-378 (b) applied to the regression comparison.
 *
 * `current` is intentionally unguarded (mirroring the upstream sink guard):
 * a non-finite MEASUREMENT legitimately signals an unbounded change and must
 * not be silently rewritten into a "stable" null/0 verdict.
 */

/**
 * Percentage change from `baseline` to `current` using the canonical
 * abs-denominator formula, or `null` when the baseline admits no meaningful
 * percentage (`0` or non-finite).
 *
 * Returns `((current - baseline) / |baseline|) * 100` — the absolute-value
 * denominator keeps the sign stable for negative baselines (a −20 → −10
 * change is +50%, not the −50% a bare division would report).
 */
export function changePercentOrNull(current: number, baseline: number): number | null {
  // A zero baseline is NOT a "stable 0% change" verdict — the division is
  // undefined, so the comparison is unmeasured and must surface as `null`.
  if (baseline === 0) return null;
  // Non-finite baseline → no meaningful percentage (null, NOT a fabricated
  // 0). A poisoned baseline whose magnitude is `1e400` survives JSON.parse
  // as Infinity; the legacy `0` return silently classified the metric
  // "stable" and disabled the regression gate with no warning.
  if (!Number.isFinite(baseline)) return null;
  return ((current - baseline) / Math.abs(baseline)) * 100;
}
