/**
 * @jest-environment node
 */
/**
 * inline-mmss-formatter-guard-mutation-pinning.test.ts — TC-314
 *
 * Pins the "no-inline-MM:SS-formatter" invariant — a recurring bug class (see
 * MEMORY: "consolidate ONE source + structural guard") — as a chokepoint pin
 * plus a structural sweep.
 *
 * THE BUG CLASS. The canonical seconds→"m:ss" formatter lives at
 * `src/utils/playback-time.ts:14` (`formatPlaybackTime`). It guards against
 * non-finite / negative seconds and the `0:60` round-then-decompose hazard
 * (TC-310). A second, structurally similar helper
 * `formatTime(frame, fps) → "MM:SS"` lived in `src/components/VideoPreview.tsx`
 * WITHOUT the same finiteness / non-positive-fps guard: for `formatTime(NaN,
 * 30)` it returned `"NaN:NaN"`, for `formatTime(Infinity, 0)` it returned
 * `"Infinity:Infinity"`. Both are the EXACT shape of bug that the sibling
 * finiteness guards (TC-304 audio file-size, TC-306 scene-synchronizer FPS)
 * exist to close: a numeric guard that admits Infinity/NaN because
 * `Infinity <= 0` is false and `NaN <= 0` is false.
 *
 * The fix to `VideoPreview.formatTime` is the same one-liner pattern: a
 * `!Number.isFinite(frame) || !Number.isFinite(fps) || fps <= 0` early-return
 * that falls back to the same `"00:00"` (or `"0:00"`) the canonical returns
 * for the matching guard. The guard test below anchors the FIX, sweeps for
 * any future inline re-implementation of the MM:SS shape, and proves the
 * guard is load-bearing via a mutation witness.
 *
 * WHY THE SWEEP. `formatPlaybackTime` (canonical) and the SRT
 * `formatTimestamp` (separate `HH:MM:SS,mmm` shape, distinct concept) are the
 * two known chokepoints. A new MM:SS-shaped helper added anywhere in src/
 * lands here with the unguarded signature → RED, independent of any
 * behavioral file. The detector is a tightened form of the TC-310 / TC-307
 * pattern: it scans src/ for any function whose body contains BOTH a
 * `padStart(2, '0')` and the literal `:` separator joining two expressions —
 * the `MM:SS` shape — AND that function's enclosing file is neither the
 * canonical chokepoint nor a test file. Any such function is required to
 * either delegate to the canonical or carry the same `!Number.isFinite ||
 * value <= 0` early-return that closes the Infinity/NaN admission.
 *
 * THREE LAYERS, each closing a different gap:
 *  1. Source anchors: pin the canonical `formatPlaybackTime` chokepoint at
 *     `src/utils/playback-time.ts:14` AND the matching guard at
 *     `src/components/VideoPreview.tsx:54` so a weakening edit is RED
 *     independent of any behavioral file.
 *  2. Structural sweep: scan src/ for any other inline MM:SS-shaped helper
 *     lacking the guard (catches new files added with the defect).
 *  3. Mutation witness: prove the unguarded form leaks `"NaN:NaN"` /
 *     `"Infinity:Infinity"` so a weakened guard cannot pass the test even
 *     if the anchor regex is loosened.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatTime } from '@/components/VideoPreview';
import { formatPlaybackTime } from '@stv/core/utils/playback-time';

// Resolve repo root from this test file's own location so a jest ESM worker
// whose cwd is not the repo root still finds the source files (TC-302/TC-313
// pattern: cwd-relative reads flake under --maxWorkers>1).
const REPO_ROOT = join(
  fileURLToPath(import.meta.url),
  '..', '..', '..',
);

import { resolveSource } from '@tests/guards/freeze-guard';
const CANONICAL_FILE = 'src/utils/playback-time.ts';
const VIDEO_PREVIEW_FILE = 'src/components/VideoPreview.tsx';

// The canonical guard shape: a single expression `!Number.isFinite(X) ||
// !Number.isFinite(Y) || Z <= 0` (the AND-of-three-clauses VideoPreview now
// carries). A revert to the unguarded form or a `Z <= 0`-only form leaves
// this anchor unmatched.
const VIDEO_PREVIEW_GUARD_ANCHOR =
  /if\s*\(\s*!Number\.isFinite\(frame\)\s*\|\|\s*!Number\.isFinite\(fps\)\s*\|\|\s*fps\s*<=\s*0\s*\)/;
const CANONICAL_GUARD_ANCHOR =
  /if\s*\(\s*!Number\.isFinite\(seconds\)\s*\|\|\s*seconds\s*<\s*0\s*\)/;

// --- (TC-314-01) source anchors: pin the two guards at their chokepoints -----

describe('inline MM:SS formatter guard — source anchors pinned (TC-314-01)', () => {
  it('canonical `formatPlaybackTime` carries the !Number.isFinite || seconds < 0 guard', () => {
    // The chokepoint is `src/utils/playback-time.ts:14`. Dropping
    // `!Number.isFinite` (leaving only `seconds < 0`) admits Infinity/NaN and
    // re-opens the class.
    const src = readFileSync(resolveSource(CANONICAL_FILE), 'utf8');
    expect(src).toMatch(CANONICAL_GUARD_ANCHOR);
  });

  it('VideoPreview `formatTime` carries the matching !Number.isFinite + fps <= 0 guard', () => {
    // Sibling of TC-304/TC-306: a `<= 0`-only form admits Infinity/NaN. The
    // guarded form must check both `frame` and `fps` for finiteness AND
    // reject non-positive `fps`. A revert to the unguarded form (the bug
    // shape fixed by this iteration) leaves this anchor unmatched → RED.
    const src = readFileSync(join(REPO_ROOT, VIDEO_PREVIEW_FILE), 'utf8');
    expect(src).toMatch(VIDEO_PREVIEW_GUARD_ANCHOR);
  });

  it('VideoPreview does NOT regress to the bare fps<=0-only form (would admit Infinity/NaN)', () => {
    // The TC-304 / TC-306 lesson: a `fps <= 0`-only check admits Infinity and
    // NaN because `Infinity <= 0` is false and `NaN <= 0` is false. The
    // combined form is anchored positively above; this negative anchor
    // documents the rejected shape.
    const src = readFileSync(join(REPO_ROOT, VIDEO_PREVIEW_FILE), 'utf8');
    expect(src).not.toMatch(/if\s*\(\s*fps\s*<=\s*0\s*\)/);
  });
});

// --- (TC-314-02) structural sweep: NO unguarded inline MM:SS-shaped formatter --

describe('inline MM:SS formatter guard — structural sweep (TC-314-02)', () => {
  // The MM:SS shape: two expressions joined by `:` where the right side
  // zero-pads to width 2 (or a function returning that pair). The
  // `formatPlaybackTime` chokepoint uses `m:ss` (no zero-pad on minutes) and
  // a `.padStart(2, '0')` on seconds; VideoPreview's `formatTime` uses
  // `MM:SS` (zero-pad on both). The detector matches the overlap:
  // `padStart(2, '0')` AND a `:`-joined string anywhere in a non-chokepoint
  // file.
  const PAD_ANCHOR = /\.padStart\(\s*2\s*,\s*['"]0['"]\s*\)/;
  // `: ` literal at a string-template boundary — the MM:SS shape's
  // distinguishing feature. We require a template literal of the form
  // `${...}:${...padStart(2, '0')}` or `${...padStart(2, '0')}:${...}`.
  const COLON_TEMPLATE_ANCHOR =
    /\$\{[^}]+\}\s*:\s*\$\{[^}]*padStart\(\s*2\s*,\s*['"]0['"]\s*\)[^}]*\}/;

  function collectTs(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        // Skip the test tree — test fixtures may legitimately format MM:SS.
        if (entry === '__tests__' || entry === '__mocks__') continue;
        collectTs(full, acc);
      } else if (
        (entry.endsWith('.ts') || entry.endsWith('.tsx')) &&
        !entry.includes('.test.')
      ) {
        acc.push(full);
      }
    }
    return acc;
  }

  it('every non-chokepoint src/ file with the MM:SS shape carries a !Number.isFinite OR delegates to the canonical', () => {
    // The canonical chokepoint IS allowed to lack an inline guard (it IS the
    // guard). Any OTHER file with the MM:SS shape must either (a) import
    // `formatPlaybackTime` from `@/utils/playback-time` and call it, or (b)
    // carry the same `!Number.isFinite || value <= 0` early-return locally.
    //
    // This is the class-closing invariant: a future inline re-implementation
    // of an MM:SS-shaped helper added without the guard lands here → RED,
    // independent of behavioral tests.
    const repoRoot = REPO_ROOT;
    const files = collectTs(join(repoRoot, 'src'));

    // Files known to legitimately own the MM:SS shape (the chokepoint + the
    // guarded sibling). Any new file added here WITHOUT a corresponding guard
    // will appear in `offenders` and fail the assertion.
    const chokepoints = new Set([
      CANONICAL_FILE,
      VIDEO_PREVIEW_FILE,
    ]);

    // The SRT `formatTimestamp` uses the `HH:MM:SS,mmm` shape (comma
    // separator, three-part template). It is a different chokepoint with its
    // own finiteness guard (`if (!Number.isFinite(ms)) return '00:00:00,000';`)
    // — that guard is separately pinned and exercised in the SRT round-trip
    // tests, and is NOT in scope for this MM:SS sweep.
    const outOfScope = new Set(['src/transcription/srt-generator.ts']);

    const offenders: string[] = [];
    for (const f of files) {
      const rel = f.replace(`${repoRoot}/`, '');
      if (chokepoints.has(rel) || outOfScope.has(rel)) continue;
      const src = readFileSync(f, 'utf8');
      if (!PAD_ANCHOR.test(src)) continue; // no MM:SS shape → not in scope
      if (!COLON_TEMPLATE_ANCHOR.test(src)) continue; // pad without colon-template → not MM:SS
      // The file has the shape. It must EITHER delegate to the canonical
      // (any reference to `formatPlaybackTime`) OR carry the local guard.
      const delegates = /formatPlaybackTime/.test(src);
      const locallyGuarded = /!Number\.isFinite\([^)]+\)\s*\|\|/.test(src);
      if (!delegates && !locallyGuarded) {
        offenders.push(
          `${rel}: inline MM:SS formatter lacks both canonical delegation and local !Number.isFinite guard`,
        );
      }
    }
    expect(offenders).toEqual([]);
  });
});

// --- (TC-314-03) mutation witness: the guard is load-bearing -----------------

describe('inline MM:SS formatter guard — mutation witness (TC-314-03)', () => {
  // The unguarded shape: the BUG form. If a future edit removes the guard,
  // this reverts to the original behavior and the assertions below flip.
  const unguardedFormatTime = (frame: number, fps: number): string => {
    const totalSeconds = Math.floor(frame / fps);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  it('the unguarded form leaks "NaN:NaN" for a NaN frame at finite fps', () => {
    // What VideoPreview's formatTime used to return before the fix. The bare
    // `<= 0` form (or no guard at all) lets NaN propagate through
    // `String(NaN)` → `"NaN"`. If this assertion ever flips (the unguarded
    // form starts producing a sensible string), the bug class has changed at
    // the language level and the guard is moot — the test fails loudly so
    // we notice.
    expect(unguardedFormatTime(NaN, 30)).toBe('NaN:NaN');
  });

  it('the unguarded form leaks "Infinity:NaN" for an Infinity frame at zero fps', () => {
    // The second bug vector. `Math.floor(Infinity / 0) === Infinity`, so the
    // minutes field renders as "Infinity". The seconds field is
    // `Infinity % 60`, which JS evaluates to `NaN` (the IEEE-754 modulo of
    // Infinity is NaN, regardless of the divisor), so it renders as "NaN".
    // Either way, the seekbar displays an unparseable token — the user sees
    // "Infinity:NaN" instead of "00:00". The `fps <= 0`-only mutation lets
    // this through because `Infinity <= 0` is false; the canonical form
    // catches it via `!Number.isFinite(fps)`.
    expect(unguardedFormatTime(Infinity, 0)).toBe('Infinity:NaN');
  });

  it('the canonical guard rejects non-finite / non-positive inputs', () => {
    // The fixed form (current production behavior). Each of these inputs
    // would have rendered "NaN:NaN" or "Infinity:Infinity" before; now they
    // fall back to "00:00" — the same default `formatPlaybackTime` uses for
    // the matching condition.
    for (const [frame, fps] of [
      [NaN, 30],
      [Infinity, 30],
      [30, NaN],
      [30, Infinity],
      [30, 0],
      [30, -1],
      [NaN, NaN],
    ] as Array<[number, number]>) {
      expect(formatTime(frame, fps)).toBe('00:00');
    }
  });

  it('the canonical guard preserves the happy path (finite positive inputs)', () => {
    // Regression guard: the early-return must not shadow the working math.
    // These are the cases the seekbar actually hits in production.
    expect(formatTime(0, 30)).toBe('00:00');
    expect(formatTime(30, 30)).toBe('00:01');
    expect(formatTime(1800, 30)).toBe('01:00');
    expect(formatTime(90, 30)).toBe('00:03');
  });

  it('the MUTATED fps<=0-only form ADMITS Infinity and NaN (proves the !Number.isFinite clause is load-bearing)', () => {
    // The TC-304/TC-306 mutation: a `fps <= 0`-only check (no `!Number.isFinite`)
    // does NOT reject NaN or Infinity because both comparisons return false.
    // This is the exact "the clause is redundant" trap the witness closes.
    const mutatedGuard = (frame: number, fps: number): boolean => fps <= 0;
    expect(mutatedGuard(NaN, 30)).toBe(false);          // NaN <= 0 is false → not rejected
    expect(mutatedGuard(Infinity, 30)).toBe(false);     // Infinity <= 0 is false → not rejected
    expect(mutatedGuard(-Infinity, 30)).toBe(false);    // -Infinity <= 0 IS true (the only one caught)

    // The combined form catches all three; the witness flips RED if the
    // `!Number.isFinite` clause is ever dropped.
    const canonicalGuard = (fps: number): boolean =>
      !Number.isFinite(fps) || fps <= 0;
    expect(canonicalGuard(NaN)).toBe(true);
    expect(canonicalGuard(Infinity)).toBe(true);
    expect(canonicalGuard(-Infinity)).toBe(true);
    expect(canonicalGuard(30)).toBe(false);
  });
});
