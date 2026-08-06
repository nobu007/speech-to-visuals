/**
 * Bug being prevented: `LayoutAutoOptimizer.adjustParams` applied a "low
 * balance → ×1.2 spacing" boost and a "high crossing → ×1.15 spacing" boost
 * that both read from the ORIGINAL `params` and wrote to `newParams`. When
 * both fired, the second overwrote the first, so the balance boost was
 * silently lost (and the result could even be SMALLER than balance alone).
 * The comment "also increase spacing" shows cumulative intent.
 *
 * Extracted into the pure `adjustLayoutParams` helper for direct testing.
 */
import { describe, it, expect } from '@jest/globals';
import { adjustLayoutParams, type LayoutParams } from '../layout-auto-optimizer';

const base: LayoutParams = {
  nodeSpacing: 50,
  rankSeparation: 80,
  nodeWidthScale: 1.0,
  nodeHeightScale: 1.0,
};
const GOOD = { balanceValue: 0.9, crossingValue: 0.9, overflowValue: 0.9 };

describe('adjustLayoutParams — spacing boosts compound, not overwrite', () => {
  it('applies the balance ×1.2 boost when only balance is low', () => {
    const r = adjustLayoutParams(base, { ...GOOD, balanceValue: 0.3 });
    expect(r.nodeSpacing).toBe(60); // round(50 * 1.2)
    expect(r.rankSeparation).toBe(96); // round(80 * 1.2)
  });

  it('applies the crossing ×1.15 boost when only crossing is low', () => {
    const r = adjustLayoutParams(base, { ...GOOD, crossingValue: 0.3 });
    expect(r.nodeSpacing).toBe(57); // Math.round(50 * 1.15) = 57 (float)
  });

  it('compounds both boosts when balance AND crossing are low (not overwrite)', () => {
    // balance first → 60, crossing compounds on that → round(60 * 1.15) = 69.
    // The bug read from the original 50 → round(50 * 1.15) = 58, which is even
    // SMALLER than the balance-only boost (60): the balance fix was discarded.
    const r = adjustLayoutParams(base, { ...GOOD, balanceValue: 0.3, crossingValue: 0.3 });
    expect(r.nodeSpacing).toBe(69);
    expect(r.nodeSpacing).toBeGreaterThan(60); // must exceed the balance-only boost
  });

  it('scales nodes down when overflow is low', () => {
    const r = adjustLayoutParams(base, { ...GOOD, overflowValue: 0.3 });
    expect(r.nodeWidthScale).toBeCloseTo(0.9);
    expect(r.nodeHeightScale).toBeCloseTo(0.9);
  });

  it('leaves params unchanged when all scores are good', () => {
    const r = adjustLayoutParams(base, GOOD);
    expect(r).toEqual(base);
  });
});
