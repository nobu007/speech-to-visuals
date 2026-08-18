/**
 * @jest-environment node
 */
/**
 * audio-filesize-finiteness-guard-mutation-pinning.test.ts — TC-304
 *
 * Pins the API-boundary file-size finiteness guard at
 * `src/utils/audio-validation.ts` (commit 9b3847c0) against silent regression.
 *
 * THE BUG CLASS. `validateAudioFileMetadata` runs at the API boundary on a
 * caller-supplied `{ name, size }` payload. `size` reaches it from
 * `JSON.parse` of the request body, so `JSON.parse('{"size":1e400}')` yields
 * `Infinity` and `JSON.parse('{"size":"x"})`-shaped coercion can yield `NaN`.
 * A plain `size < 0` check does NOT catch either (Infinity < 0 is false;
 * NaN < 0 is false), so without the `!Number.isFinite` clause an attacker can
 * submit `{"size": -1e400}` or `{"size": -100}` and sail past validation into
 * the pipeline, where a non-finite byte count corrupts every downstream size
 * comparison, cache key, and Content-Length header. This is the same
 * boundary-numeric vector the LLM sanitizer closes for model output.
 *
 * THE GUARD (two sibling sites that the source comment says "mirror" each
 * other):
 *   - file size:   `if (!Number.isFinite(meta.size) || meta.size < 0)`
 *   - duration:    `if (!Number.isFinite(durationSeconds) || durationSeconds < 0)`
 *
 * WHY MUTATION PINNING + a behavioral witness. The 9b3847c0 size guard has
 * NO behavioral test — neither tests/utils/audio-validation.test.ts nor
 * tests/unit/utils/audio-validation.test.ts exercises `size: Infinity`,
 * `size: NaN`, or a negative size for `validateAudioFileMetadata` (both files
 * cover those vectors only for `validateAudioDuration`). The guard is verified
 * solely by the commit message and the in-source comment. Layer 1 pins the
 * two source sites so a weakening edit is RED independent of any test file;
 * Layer 2 supplies the missing behavioral witness AND proves the mutated
 * logical form (dropping `!Number.isFinite`) leaks Infinity.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { validateAudioFileMetadata } from '@stv/core/utils/audio-validation';

import { resolveSource } from '@tests/guards/freeze-guard';
const GUARD_FILE = 'src/utils/audio-validation.ts';

// --- (TC-304-01) source anchors: pin the two finiteness branches ---------------

describe('Audio file-size finiteness guard — source anchors pinned (TC-304-01)', () => {
  const src = (): string => readFileSync(resolveSource(GUARD_FILE), 'utf8');

  it('validateAudioFileMetadata rejects non-finite OR negative size', () => {
    // Dropping `!Number.isFinite(...)` (leaving only `meta.size < 0`), or
    // weakening to `=== 0` / `<= 0`, leaves this anchor unmatched → RED.
    expect(src()).toMatch(/!Number\.isFinite\(meta\.size\) \|\| meta\.size < 0/);
  });

  it('validateAudioDuration mirrors the same finiteness guard for duration', () => {
    // The sibling site the size guard's comment says it mirrors. A drift that
    // weakens one but not the other (e.g. "duration is always clamped
    // upstream so drop the check") is caught here.
    expect(src()).toMatch(
      /!Number\.isFinite\(durationSeconds\) \|\| durationSeconds < 0/,
    );
  });

  it('the size guard runs only when size is present (undefined = unknown, not invalid)', () => {
    // `meta.size !== undefined` gating preserves the legitimate "size
    // unknown" server-side path. Collapsing this to an unconditional check
    // would break the `validateAudioFileMetadata({ name })` contract.
    expect(src()).toMatch(/if \(meta\.size !== undefined\)/);
  });
});

// --- (TC-304-02) behavioral witness: non-finite / negative sizes are rejected --

describe('Audio file-size finiteness guard — behavioral witness (TC-304-02)', () => {
  const validMeta = { name: 'speech.mp3' };

  it('rejects Infinity size (JSON.parse("1e400") vector)', () => {
    const result = validateAudioFileMetadata({ ...validMeta, size: Infinity });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Invalid file size'))).toBe(true);
  });

  it('rejects NaN size', () => {
    const result = validateAudioFileMetadata({ ...validMeta, size: NaN });
    expect(result.valid).toBe(false);
  });

  it('rejects negative size', () => {
    const result = validateAudioFileMetadata({ ...validMeta, size: -100 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('-100'))).toBe(true);
  });

  it('accepts a finite positive size below the limit', () => {
    const result = validateAudioFileMetadata({ ...validMeta, size: 1024 });
    expect(result.valid).toBe(true);
  });
});

// --- (TC-304-03) mutation witness: the !Number.isFinite clause is load-bearing --

describe('Audio file-size finiteness guard — mutation witness (TC-304-03)', () => {
  it('a size<0-only check (the mutated form) leaks Infinity and NaN', () => {
    // This is the BUG shape — what the guard defends against. If this
    // assertion ever flips (a bare `< 0` becomes sufficient to reject
    // Infinity), the `!Number.isFinite` clause has become redundant and the
    // guard can be safely simplified; the test fails loudly so we notice.
    const inf = Infinity;
    const nan = NaN;

    // Correct guard form: rejects both.
    const correct = (x: number): boolean => !Number.isFinite(x) || x < 0;
    expect(correct(inf)).toBe(true);
    expect(correct(nan)).toBe(true);

    // Mutated form (drop !Number.isFinite): Infinity and NaN slip through.
    const mutated = (x: number): boolean => x < 0;
    expect(mutated(inf)).toBe(false); // Infinity < 0 is false → NOT rejected
    expect(mutated(nan)).toBe(false); // NaN < 0 is false → NOT rejected
  });
});
