/**
 * @jest-environment node
 */
/**
 * scene-synchronizer-sanitizeFinite-migration-pinning.test.ts
 *
 * Pins the consolidation of inline `Number.isFinite(scene.durationMs) ?
 * scene.durationMs : 0` patterns in `src/remotion/scene-synchronizer.ts` to
 * the canonical `sanitizeFinite(scene.durationMs)` helper from
 * `@/utils/guards`. Four call sites migrated: `getSceneBoundaries` (elapsed
 * accumulator), `getSceneStartTimes` (elapsed accumulator), `splitCaptionAtSceneBoundary`
 * (cumulative boundary builder), and `validateSceneCaptionSync`
 * (`reduce((sum, s) => sum + ...)` for total scene ms).
 *
 * THE BUG CLASS. The inline `Number.isFinite(x) ? x : 0` pattern is fragile:
 * - It expands noisily across accumulators (the 4 sites in scene-synchronizer
 *   show exactly that — three different shapes of "loop and add", all
 *   duplicating the same guard).
 * - Any future contributor copy-pasting a snippet from this file would
 *   bypass the centralized helper. A `sanitizeFinite` chokepoint in
 *   `@/utils/guards` makes the helper the single source of truth for
 *   "coerce a possibly-non-finite number to a finite default" semantics.
 * - The helper already exists with EXACT semantics (default 0 fallback,
 *   NaN/Infinity/non-number all guarded). No new helper is introduced —
 *   only the call sites are consolidated.
 *
 * WHY MUTATION PINNING. Layer 1 source-anchors ZERO remaining inline
 * `Number.isFinite(...durationMs) ? ...durationMs : 0` in
 * scene-synchronizer.ts and confirms `sanitizeFinite(scene.durationMs)` is
 * used at all four migrated sites. Layer 2 behavioral: a scene with
 * `durationMs = NaN` / `Infinity` / `-Infinity` / missing must accumulate
 * 0 (not NaN, not Infinity) — same behavior as before, but now locked to
 * the helper.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
  splitCaptionAtSceneBoundary,
  validateSceneCaptionSync,
  type SyncValidationResult,
} from '@/remotion/scene-synchronizer';

const GUARD_FILE = 'src/remotion/scene-synchronizer.ts';

// --- (1) source anchors: ZERO inline durationMs isFinite ternaries -------------

describe('scene-synchronizer durationMs sanitization — source anchors pinned', () => {
  const src = (): string => readFileSync(GUARD_FILE, 'utf8');

  it('does NOT contain the inline `Number.isFinite(...durationMs) ? ...durationMs : 0` ternary', () => {
    // The migrated sites must use sanitizeFinite; any reintroduction of the
    // inline ternary bypasses the chokepoint → RED.
    expect(src()).not.toMatch(/Number\.isFinite\([^)]*\.durationMs\)\s*\?\s*[^)]*\.durationMs\s*:\s*0/);
  });

  it('imports sanitizeFinite from @/utils/guards', () => {
    // The migration contract: scene-synchronizer depends on the canonical
    // helper. Removing the import (and rolling back to inline ternaries)
    // breaks this anchor → RED.
    expect(src()).toMatch(/import\s*\{\s*sanitizeFinite\s*\}\s*from\s*['"]@\/utils\/guards['"]/);
  });

  it('uses sanitizeFinite(scene.durationMs) at all four migrated sites', () => {
    // The four sites: getSceneBoundaries, getSceneStartTimes,
    // splitCaptionAtSceneBoundary, validateSceneCaptionSync.
    // Drop any one → match count < 4 → RED.
    const matches = src().match(/sanitizeFinite\([^)]*\.durationMs[^)]*\)/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(4);
  });
});

// --- (2) behavioral witness: NaN/Infinity durations do not poison accumulators --

describe('scene-synchronizer durationMs sanitization — behavioral witness', () => {
  it('splitCaptionAtSceneBoundary treats NaN/Infinity scene durations as 0 ms', () => {
    // Pre-migration, the inline ternary already dropped to 0 — the migration
    // must preserve this. Post-migration, sanitizeFinite provides the same
    // contract. If a regression reintroduces a non-zero fallthrough (or the
    // accumulator leaks NaN), the caption boundaries shift and the test fails.
    //
    // Caption spans 500ms–1500ms (1000ms wide). If a scene has Infinity
    // duration, the cumulative boundary after that scene would be Infinity,
    // pushing every subsequent boundary past caption.endMs → no internal
    // boundary matches → caption stays intact. If sanitizeFinite correctly
    // collapses Infinity to 0, the cumulative boundary stays finite, and the
    // caption is split at the FINITE scene boundary at 1000ms.
    const caption = {
      index: 1,
      startMs: 500,
      endMs: 1500,
      text: 'hello world',
      startFrame: 15,
      endFrame: 45,
    };
    const scenes = [
      { durationMs: 500 }, // ends at 500
      { durationMs: Number.POSITIVE_INFINITY }, // migrated: → 0 → next at 500
      { durationMs: 500 }, // ends at 1000
      { durationMs: 500 }, // ends at 1500
    ] as unknown as { durationMs: number }[];

    const segments = splitCaptionAtSceneBoundary(caption, scenes, 30);

    // Caption spans [500, 1500]. Finite boundary at 1000 splits it.
    // If migration is correct, exactly one split at 1000 → 2 segments.
    // If migration regresses (boundary = Infinity), no internal boundary
    // falls in (500, 1500) → caption stays intact (1 segment).
    expect(segments.length).toBe(2);
    expect(segments[0]).toMatchObject({ startMs: 500, endMs: 1000 });
    expect(segments[1]).toMatchObject({ startMs: 1000, endMs: 1500 });
  });

  it('validateSceneCaptionSync totalSceneMs treats NaN/Infinity as 0', () => {
    // The migrated reduce uses sanitizeFinite as the per-element guard.
    // A scene with durationMs=NaN must NOT poison totalSceneMs to NaN.
    const captions = [
      {
        index: 1,
        startMs: 0,
        endMs: 500,
        text: 'a',
        startFrame: 0,
        endFrame: 15,
      },
    ];
    const result: SyncValidationResult = validateSceneCaptionSync(
      [
        { durationMs: Number.NaN },
        { durationMs: Number.POSITIVE_INFINITY },
        { durationMs: 1000 },
      ] as unknown as { durationMs: number }[],
      captions,
      30
    );
    // Total scene ms = 0 + 0 + 1000 = 1000. caption.endMs = 500 ≤ 1000 → valid.
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });
});