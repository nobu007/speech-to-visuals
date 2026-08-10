/**
 * @jest-environment node
 */
/**
 * Single-source guard for the SRT timestamp formatter (ms → "HH:MM:SS,mmm").
 *
 * THE BUG CLASS. Two copies of this formatter used to live in the repo:
 *   - `src/transcription/srt-generator.ts` → `formatTimestamp` (canonical),
 *   - `src/transcription/whisper-transcriber.ts` → a private `formatSrtTime`.
 * They drifted: when the canonical copy was hardened to clamp negative finite
 * timestamps to 0 (see `non-finite-timestamps.test.ts`), the whisper copy was
 * missed as a sibling. The unguarded copy emitted sign-bearing garbage
 * ("-1:-1:-1,-500") for negative inputs — a `WhisperTranscriber.generateSrt`
 * call on a segment whose start/end was a negative finite number produced an
 * invalid SRT document. This is the recurring "duplicate-formula
 * re-derivation / missed-sibling-site" class.
 *
 * THE FIX (consolidation, matching the escapeXml precedent in
 * animated-scene-renderer.ts): whisper-transcriber now imports `formatTimestamp`
 * from `./srt-generator` and emits no local copy. This guard pins that
 * invariant structurally so the duplicate cannot silently re-appear.
 *
 * WHY SOURCE-ANCHORED. The behavioral test in `non-finite-timestamps.test.ts`
 * proves the clamp WORKS today; it does not prove the consolidation REMAINS.
 * Re-introducing a private `formatSrtTime` would re-open the drift while
 * keeping the behavioral test green (the new copy could re-clamp). Reading the
 * source catches that direct edit. (See the "guard verified-only-behaviorally,
 * not source-anchored" lesson.)
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const whisperPath = resolve(here, '../transcription/whisper-transcriber.ts');
const srtGenPath = resolve(here, '../transcription/srt-generator.ts');
const whisperSrc = readFileSync(whisperPath, 'utf8');
const srtGenSrc = readFileSync(srtGenPath, 'utf8');

describe('SRT formatter single-source (consolidation) guard', () => {
  it('whisper-transcriber does NOT define its own SRT time formatter', () => {
    // The drifted copy was declared as `function formatSrtTime(ms: number)`.
    // A private ms→"HH:MM:SS,mmm" decomposition (the `/ 3600000` signature) is
    // the defect footprint; the canonical one must live ONLY in srt-generator.
    expect(whisperSrc).not.toMatch(/function\s+formatSrtTime\b/);
    expect(whisperSrc).not.toMatch(/\b3600000\b/);
  });

  it('whisper-transcriber imports the canonical formatTimestamp from srt-generator', () => {
    expect(whisperSrc).toMatch(/import\s*\{[^}]*\bformatTimestamp\b[^}]*\}\s*from\s*['"]\.\/srt-generator['"]/);
  });

  it('srt-generator remains the canonical exporter of formatTimestamp', () => {
    expect(srtGenSrc).toMatch(/export\s+function\s+formatTimestamp\b/);
  });

  it('mutation witness: reverting the consolidation re-introduces both defects', () => {
    // If someone pastes the old private formatter back in, BOTH of these
    // assertions flip red on the reverted source. Kept as documentation of the
    // RED state the two assertions above prevent.
    const reverted = whisperSrc
      .replace(
        /import\s*\{\s*formatTimestamp\s*\}\s*from\s*['"]\.\/srt-generator['"];\n/,
        '',
      )
      + '\nfunction formatSrtTime(ms: number): string {\n  return String(Math.floor(ms / 3600000));\n}\n';
    expect(reverted).toMatch(/function\s+formatSrtTime\b/);
    expect(reverted).toMatch(/\b3600000\b/);
  });
});
