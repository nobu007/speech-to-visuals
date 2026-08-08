/**
 * Structural source-coupling guard for the ms↔frame conversion functions.
 *
 * `msToFrame` and `frameToMs` live in exactly ONE place:
 * `src/remotion/scene-synchronizer.ts`. They were previously re-defined as
 * independent local copies in `KeyphraseOverlay.tsx` and `srt-parser.ts`
 * (`msToFrame` only). The three copies used the SAME `Math.round((ms/1000)*fps)`
 * core, so they coincided on the happy path (ms > 0, fps > 0), but the local
 * copies diverged from the canonical one in two edge regimes:
 *   - `fps <= 0`: the canonical `msToFrame` falls back to `DEFAULT_FPS` (30);
 *     the local copies used `Math.max(fps, 1)` → a 30× shorter frame count.
 *   - negative `ms`: the canonical `msToFrame` clamps to 0; the local copies
 *     returned a negative frame.
 * Coincident-on-the-happy-path duplicates drift silently: edit the rounding in
 * one copy and the SRT captions / keyphrase overlays / scene-sync frames
 * disagree about identical timestamps. This test guards the COUPLING at the
 * source-text level so a frozen local copy can never reappear — a fourth
 * instance cannot be reintroduced without also touching this allowlist.
 *
 * Sibling guard: `default-fps-coupling.test.ts` pins the `DEFAULT_FPS = 30`
 * literal this same canonical module owns.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { msToFrame, frameToMs, DEFAULT_FPS } from '../scene-synchronizer';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** The canonical definition file — the one place these functions may be defined. */
const CANONICAL_FILE = path.join('src', 'remotion', 'scene-synchronizer.ts');

/** A `function msToFrame(` / `function frameToMs(` declaration, exported or not. */
const FRAME_CONVERTER_DEF = /\bfunction\s+(msToFrame|frameToMs)\s*\(/;

/**
 * An arrow/const re-definition, e.g. `const msToFrame = (...)`, that would
 * shadow the canonical export. (The current codebase uses `function` forms, but
 * a future refactor must not slip one past in arrow form either.)
 */
const FRAME_CONVERTER_ARROW = /\b(?:const|let|var)\s+(msToFrame|frameToMs)\s*=/;

function getAllProductionSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'coverage', '__tests__'].includes(entry.name)) continue;
      results.push(...getAllProductionSourceFiles(fullPath));
    } else if (entry.name.match(/\.(ts|tsx)$/)) {
      if (entry.name.includes('.test.') || entry.name.includes('.spec.')) continue;
      results.push(fullPath);
    }
  }
  return results;
}

describe('frame conversion (msToFrame / frameToMs) is single-sourced', () => {
  test('canonical module exports both converters', () => {
    expect(typeof msToFrame).toBe('function');
    expect(typeof frameToMs).toBe('function');
    // Pin the canonical behavior the dedup relies on: fps<=0 falls back to the
    // default rather than the local `Math.max(fps,1)` form.
    expect(msToFrame(1000, 0)).toBe(DEFAULT_FPS);
    expect(msToFrame(-100, DEFAULT_FPS)).toBe(0);
  });

  test('no production source re-defines msToFrame or frameToMs outside scene-synchronizer', () => {
    const projectRoot = path.resolve(__dirname, '../../../');
    const srcDir = path.join(projectRoot, 'src');
    expect(fs.existsSync(srcDir)).toBe(true);

    const files = getAllProductionSourceFiles(srcDir);
    expect(files.length).toBeGreaterThan(50); // sanity check

    const redefinitions: { file: string; line: number; content: string }[] = [];

    for (const file of files) {
      const rel = path.relative(projectRoot, file);
      if (rel === CANONICAL_FILE) continue; // the one allowed definition site
      const lines = fs.readFileSync(file, 'utf-8').split('\n');
      lines.forEach((line, idx) => {
        if (FRAME_CONVERTER_DEF.test(line) || FRAME_CONVERTER_ARROW.test(line)) {
          redefinitions.push({ file: rel, line: idx + 1, content: line.trim() });
        }
      });
    }

    expect(redefinitions).toEqual([]);
  });
});
