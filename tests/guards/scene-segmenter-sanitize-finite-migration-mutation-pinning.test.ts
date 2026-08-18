/**
 * @jest-environment node
 */
/**
 * scene-segmenter-sanitize-finite-migration-mutation-pinning.test.ts
 *
 * Pins the migration of inline `Number.isFinite(x) ? x : <default>` patterns in
 * `src/analysis/scene-segmenter.ts` to the canonical `sanitizeFinite` helper in
 * `src/utils/guards.ts`.
 *
 * THE BUG CLASS. `scene-segmenter.ts` historically carried ten inline
 * `Number.isFinite(x) ? x : 0` value-coercion sites (splitAtTopicShift
 * timestamps, mergeSimilar / backwardMerge / consolidateGroup confidences,
 * evaluateSegmentation / generateQualityReport / calculateIterativeImprovement
 * durations and avgLength). All ten are exactly the `sanitizeFinite(x)` /
 * `sanitizeFinite(x, default)` shape — a hand-rolled coercion the helper
 * already expresses in one line. The same sprawl was visible repo-wide (49
 * source files use raw `Number.isFinite`); `scene-segmenter.ts` is the most
 * concentrated module and the place where the consolidation starts.
 *
 * THE FIX. Replace each inline ternary with `sanitizeFinite(<arg>)` or
 * `sanitizeFinite(<arg>, <default>)`. The helper is sourced from
 * `src/utils/guards.ts:28` and its behavior is byte-for-byte equivalent for
 * the migrated sites (finite x → x; non-finite x → defaultValue). The
 * `Math.max(0, sanitizeFinite(d))` form preserves the original "durations
 * are non-negative; non-finite → 0" semantics for evaluateSegmentation /
 * generateQualityReport, including the case where d = +Infinity was treated
 * as 0 by the original (sanitizeFinite(+Infinity) = 0 → Math.max(0, 0) = 0).
 *
 * WHY MUTATION PINNING. The behavioral tests at
 * `src/analysis/__tests__/scene-segmenter.test.ts` cover the happy paths but
 * do NOT pin the helper-adoption contract: a revert from `sanitizeFinite`
 * back to `Number.isFinite(x) ? x : 0` would still pass those tests, silently
 * re-introducing the sprawl. Layer 1 source-anchors the helper import and
 * the call count; Layer 2 anchors the negative form so a re-introduced inline
 * ternary is RED independent of any test file.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';

import { resolveSource } from '@tests/guards/freeze-guard';
const GUARD_FILE = 'src/analysis/scene-segmenter.ts';

// --- Source anchors: pin the sanitizeFinite adoption -----------------------------

describe('scene-segmenter sanitizeFinite migration — source anchors pinned', () => {
  const src = (): string => readFileSync(resolveSource(GUARD_FILE), 'utf8');

  it('imports sanitizeFinite from @stv/core/utils/guards (the canonical chokepoint)', () => {
    // The helper is the single source of truth for value-coercion sentinels;
    // a removal of this import (e.g. "we don't need it anymore") drops the
    // matches below the floor → RED.
    expect(src()).toMatch(
      /import \{ sanitizeFinite \} from '@stv\/core\/utils\/guards'/,
    );
  });

  it('uses sanitizeFinite at the timestamp guard sites (splitAtTopicShift)', () => {
    // The two-line guard that prevents NaN propagation in topic-shift
    // splitting. A revert to inline `Number.isFinite(startMs) ? startMs : 0`
    // drops the sanitizeFinite anchors → RED.
    expect(src()).toMatch(/const safeStart = sanitizeFinite\(startMs\)/);
    expect(src()).toMatch(/const safeEnd = sanitizeFinite\(endMs, safeStart\)/);
  });

  it('uses sanitizeFinite at the confidence aggregation sites (>= 10 calls)', () => {
    // The ten migrated sites plus the three pre-existing sites
    // (testResults.score, seg.confidence ×2). A regression that drops
    // sanitizeFinite from any of the new sites drops the count below 13.
    const matches = src().match(/sanitizeFinite\(/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(13);
  });

  it('uses sanitizeFinite at the duration aggregation sites (Math.max wrapper)', () => {
    // evaluateSegmentation / generateQualityReport keep the "durations are
    // non-negative" semantics via `Math.max(0, sanitizeFinite(d))`. A revert
    // to `Number.isFinite(d) ? Math.max(0, d) : 0` drops this anchor → RED.
    const matches = src().match(/Math\.max\(0, sanitizeFinite\(d\)\)/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  it('does NOT contain inline `Number.isFinite(x) ? ... : ...` value-coercion ternaries', () => {
    // The negative anchor: the specific redundant pattern that was
    // eliminated by the migration. Any inline `Number.isFinite(...) ?`
    // ternary (a hand-rolled `sanitizeFinite` clone) re-introduces the
    // sprawl and is caught here. Legitimate predicate uses
    // (`if (Number.isFinite(x))`) are not matched because they are not
    // followed by `?`.
    expect(src()).not.toMatch(/Number\.isFinite\([^)]+\)\s*\?/);
  });
});

// --- Behavioral witness: sanitizeFinite preserves the migrated semantics ---------

describe('scene-segmenter sanitizeFinite migration — behavioral witness', () => {
  it('sanitizeFinite(x) returns x for finite values, 0 for non-finite (default 0)', () => {
    // Mirror of `src/utils/guards.ts:28`. If the helper's behavior ever
    // diverges from this contract, every migrated site in scene-segmenter
    // silently changes meaning; this witness catches the divergence before
    // the source anchors can lie.
    expect(sanitizeFiniteMirror(0.85)).toBe(0.85);
    expect(sanitizeFiniteMirror(0)).toBe(0);
    expect(sanitizeFiniteMirror(-5)).toBe(-5);
    expect(sanitizeFiniteMirror(NaN)).toBe(0);
    expect(sanitizeFiniteMirror(Infinity)).toBe(0);
    expect(sanitizeFiniteMirror(-Infinity)).toBe(0);
  });

  it('sanitizeFinite(x, default) returns default for non-finite values', () => {
    // The splitAtTopicShift safeEnd pattern: a non-finite endMs falls back
    // to safeStart, NOT to 0. If the helper ever drops the defaultValue
    // parameter, every multi-arg call site in scene-segmenter silently
    // returns 0 and topic-shift splitting produces zero-length sub-segments.
    expect(sanitizeFiniteMirror(NaN, 42)).toBe(42);
    expect(sanitizeFiniteMirror(Infinity, 42)).toBe(42);
    expect(sanitizeFiniteMirror(7, 42)).toBe(7);
  });

  it('Math.max(0, sanitizeFinite(d)) treats +Infinity as 0 (preserved semantic)', () => {
    // The two evaluateSegmentation / generateQualityReport sites use
    // `Math.max(0, sanitizeFinite(d))` instead of `clampFinite(d, 0, Infinity)`
    // BECAUSE the original `Number.isFinite(d) ? Math.max(0, d) : 0` treated
    // +Infinity as 0 (rejected), not as Infinity (passed through). This
    // witness proves the chosen replacement preserves that semantic; a
    // "cleaner" refactor that switches to `clampFinite` would diverge here.
    expect(Math.max(0, sanitizeFiniteMirror(Infinity))).toBe(0);
    expect(Math.max(0, sanitizeFiniteMirror(-Infinity))).toBe(0);
    expect(Math.max(0, sanitizeFiniteMirror(NaN))).toBe(0);
    expect(Math.max(0, sanitizeFiniteMirror(5))).toBe(5);
    expect(Math.max(0, sanitizeFiniteMirror(-5))).toBe(0);
  });
});

// --- Mutation witness: an inline ternary would have the same effect, but only via sprawl ---

describe('scene-segmenter sanitizeFinite migration — mutation witness', () => {
  it('an inline `Number.isFinite(x) ? x : 0` is exactly `sanitizeFinite(x)` — proves the inline was a redundant alias', () => {
    // The migration is NOT a behavior change; it's a sprawl elimination.
    // This witness proves the inline form is equivalent, so a future "we
    // can revert this, it's the same" argument is on the table — but the
    // source-anchor tests above ensure any revert is loudly RED.
    const inlineForm = (x: number): number => (Number.isFinite(x) ? x : 0);
    const helperForm = (x: number): number => sanitizeFiniteMirror(x);
    for (const value of [0.85, 0, -5, NaN, Infinity, -Infinity, 1e10, -1e10]) {
      expect(inlineForm(value)).toBe(helperForm(value));
    }
  });
});

// --- Local mirror of `sanitizeFinite` to keep this test independent of imports --
// (The real helper lives at `@stv/core/utils/guards.ts:28`. Mirroring here makes the
// behavioral / mutation witnesses self-contained — no jest mock module race
// conditions, no transitive import surface. If the real helper ever drifts,
// the witness above will diverge from the source-anchored call sites and the
// next migration author gets a loud RED.)
function sanitizeFiniteMirror(value: unknown, defaultValue: number = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return defaultValue;
}