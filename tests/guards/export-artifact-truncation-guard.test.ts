/**
 * @jest-environment node
 */
/**
 * Export artifact byte-truncation — structural guard (INV-EXP-003).
 *
 * The compressVideo fixed-ratio byte-slice (low 0.9 / medium 0.7 / high 0.5 /
 * maximum 0.3) "compressed" by cutting the artifact's tail. It corrupted
 * every format at once: binary formats kept their head magic bytes — passing
 * REQ-225 verification — while losing trailer atoms/chunks, and text formats
 * (json-lottie / svg-animated / interactive-html) stopped parsing
 * mid-document and failed verification for a legitimate setting. The fix
 * (session-259 parked E2) removed the slice entirely and discloses the
 * skipped re-encode in warnings instead.
 *
 * The unit legs in src/export/__tests__/enhanced-export-engine.test.ts pin
 * the behavior through the public API, but they only cover the path they
 * exercise. A sibling "compression" helper re-introducing the same idiom —
 * this repo's recurring missed-sibling-site class — would stay green there.
 * This guard sweeps ALL src/export implementation files for the idiom's
 * shape: a byte container truncated at a fixed ratio of its own
 * `.length`/`byteLength` via `.slice(0, …)` / `.subarray(0, …)`.
 *
 * The dead idiom's citation inside compressVideo's comment reads
 * `data.slice(0, Math.floor(len * ratio))` — `len`, not `<x>.length` — so
 * requiring `.length` inside the floor keeps that historical quote green
 * while any LIVE re-introduction (which must read the receiver's own length
 * to shrink it) REDs.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync, globSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Anchored to import.meta.url, not process.cwd(): a jest worker's cwd can be
// moved by a module-load side effect (whisper-node chdir — see
// tests/__mocks__/whisper-node.ts) or differ under --maxWorkers>1 (TC-302/313);
// cwd-relative source reads then flake with ENOENT.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const exportImplFiles = globSync('src/export/**/*.ts', { cwd: REPO_ROOT }).filter(
  (rel) => !rel.includes('__tests__') && !/\.test\./.test(rel)
);

// Fixed-ratio byte truncation: `<bytes>.slice(0, Math.floor(<x>.length * r))`
// (or the subarray twin). The receiver reads its own extent via `.length` OR
// `.byteLength` — Uint8Array exposes both, and a `subarray(0,
// Math.floor(data.byteLength * r))` re-introduction sailed past a `.length`-
// only regex (verified RED-matrix below), so both suffixes are in the shape.
// `Math.trunc` joins `Math.floor` as the same idiom family.
//
// Known blind spots (deliberate, not silent): bitwise truncation —
// `slice(0, (buf.length * r) | 0)` / `>> 2` — drops the `Math.<fn>(` wrapper
// the shape keys on and is NOT detected. The unit legs (verifier + artifact
// store oracles) remain the behavioral backstop for any shape this census
// misses; this guard only needs to catch the missed-sibling-site class.
//
// Statistical array splits (`values.slice(0, Math.floor(values.length / 2))`
// in continuous-learner etc.) are the same textual shape, which is exactly why
// this guard is scoped to src/export — the artifact-owning tree — rather than
// all of src/.
const RATIO_BYTE_TRUNCATION =
  /\.(?:slice|subarray)\(\s*0\s*,\s*Math\.(?:floor|trunc)\([^)]*\.(?:length|byteLength)/;

describe('export artifact byte-truncation guard (INV-EXP-003)', () => {
  it('no src/export implementation file truncates a byte container by fixed ratio', () => {
    const offenders: string[] = [];
    for (const rel of exportImplFiles) {
      const src = readFileSync(resolve(REPO_ROOT, rel), 'utf8');
      if (RATIO_BYTE_TRUNCATION.test(src)) {
        offenders.push(rel);
      }
    }
    // Fail as a census, not per-file: one offender or ten, the RED output
    // names every site in a single run.
    expect(offenders).toEqual([]);
  });

  it('the idiom shape matches byteLength/trunc receivers and spares the dead citation', () => {
    // Pin the census regex's detection contract so it cannot silently
    // re-narrow (a `.length`-only shape left a `data.byteLength` receiver's
    // re-introduction green — the blind spot this leg exists to lock shut).
    expect(
      RATIO_BYTE_TRUNCATION.test(
        'return data.subarray(0, Math.floor(data.byteLength * ratio));'
      )
    ).toBe(true);
    expect(
      RATIO_BYTE_TRUNCATION.test('b.slice(0, Math.floor(b.length * 0.7));')
    ).toBe(true);
    expect(
      RATIO_BYTE_TRUNCATION.test('b.slice(0, Math.trunc(b.byteLength * 0.7));')
    ).toBe(true);
    // The historical citation inside compressVideo's comment reads
    // `len`, not `<x>.length` — it must stay off the census (green).
    expect(
      RATIO_BYTE_TRUNCATION.test('`data.slice(0, Math.floor(len * ratio))`')
    ).toBe(false);
  });

  it('the census actually sweeps the export tree (not vacuously green)', () => {
    // If globSync ever silently matches nothing (path rename, cwd drift) the
    // guard above would pass with zero files read. Pin a floor on the file
    // count so a vacuous sweep is its own failure.
    expect(exportImplFiles.length).toBeGreaterThan(10);
    expect(exportImplFiles).toContain('src/export/enhanced-export-engine.ts');
  });
});
