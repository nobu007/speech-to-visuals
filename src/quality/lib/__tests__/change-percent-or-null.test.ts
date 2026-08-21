/**
 * Tests for change-percent-or-null.ts (REQ-378 b vendored helper).
 *
 * The helper is the null-returning mirror of `@stv/core` `percentChange`:
 * the contract legs pinned here are exactly the ones the regression
 * detector's `warnings` path rides on — a zero or non-finite baseline must
 * surface as `null` (unmeasured), never as a fabricated `0` that silently
 * classifies the metric "stable".
 *
 * These legs were previously exercised only through the hand-patched
 * node_modules copy that fresh installs wipe (make-run R5), so the vendored
 * file gets its own pinned suite to keep the contract reproducible from
 * `npm ci` alone.
 */

import { describe, it, expect } from '@jest/globals';
import { changePercentOrNull } from '../change-percent-or-null';

describe('changePercentOrNull', () => {
  it('returns null for a zero baseline (unmeasured, not stable-0%)', () => {
    expect(changePercentOrNull(5, 0)).toBeNull();
    expect(changePercentOrNull(0, 0)).toBeNull();
  });

  it('returns null for a non-finite baseline', () => {
    expect(changePercentOrNull(5, Infinity)).toBeNull();
    expect(changePercentOrNull(5, -Infinity)).toBeNull();
    expect(changePercentOrNull(5, NaN)).toBeNull();
  });

  it('computes the canonical abs-denominator formula', () => {
    expect(changePercentOrNull(150, 100)).toBe(50);
    expect(changePercentOrNull(50, 100)).toBe(-50);
    expect(changePercentOrNull(100, 100)).toBe(0);
    // Negative baseline: −20 → −10 is +50%, not −50% (bare-division hazard).
    expect(changePercentOrNull(-10, -20)).toBe(50);
  });

  it('leaves a non-finite CURRENT unguarded (unbounded change, not null)', () => {
    // Mirror of the upstream sink-guard asymmetry: a non-finite measurement
    // legitimately signals a large change and must not be rewritten into a
    // "stable" null. Compare with a finite baseline so only `current` varies.
    expect(changePercentOrNull(Infinity, 100)).toBe(Infinity);
    expect(changePercentOrNull(NaN, 100)).toBeNaN();
  });
});
