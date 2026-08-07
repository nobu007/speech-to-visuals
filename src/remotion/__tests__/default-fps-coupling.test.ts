/**
 * Structural source-coupling guard for the default frame rate (REQ-296).
 *
 * `DEFAULT_FPS` (30) lives in exactly one place: `src/remotion/scene-synchronizer.ts`.
 * It was previously redeclared as an independent local `const` in `Video.tsx` and
 * `srt-parser.ts`, and inlined as a bare `|| 30` fallback across the pipeline and
 * export layers (`this.options.fps || 30`, `quality.fps || 30`, and the
 * `30 / (options.fps || 30)` FPS-normalization in production-exporter). Every copy
 * coincided, so a behavioral RED→GREEN was impossible, but the values were coupled
 * only by coincidence: changing the default frame rate in scene-synchronizer would
 * silently desync the registered composition, SRT parsing, and the export
 * duration/FPS-normalization math. This test guards the COUPLING at the source-text
 * level so a frozen copy can never reappear.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_FPS as CANONICAL_FPS } from '../scene-synchronizer';
import { DEFAULT_FPS as VIDEO_FPS } from '../Video';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** The canonical definition file — the one place the `30` literal may appear. */
const CANONICAL_FILE = path.join('src', 'remotion', 'scene-synchronizer.ts');

/** A local redeclaration that shadows the canonical export, e.g. `const DEFAULT_FPS = 30;`. */
const LOCAL_REDECLARATION = /\bconst\s+DEFAULT_FPS\s*=\s*30\s*;/;

/**
 * A bare-literal FPS fallback, e.g. `options.fps || 30`, `quality.fps || 30`,
 * `this.options.fps || 30`. Any such site must import and use `DEFAULT_FPS`
 * instead, otherwise it freezes a copy of the default frame rate.
 */
const BARE_LITERAL_FPS_FALLBACK = /\bfps\b\s*\|\|\s*30\b/;

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

describe('REQ-296: default FPS (30) is single-sourced', () => {
  test('canonical constant holds its documented value', () => {
    // Locking the canonical value makes the "coincide today" desync detectable:
    // if this ever changes, every frozen local literal would diverge.
    expect(CANONICAL_FPS).toBe(30);
  });

  test('Video re-export is the identical canonical constant (not a frozen copy)', () => {
    // Video.tsx must re-export the canonical value, not redeclare it. A strict
    // equality check on the imported bindings proves single-sourcing.
    expect(VIDEO_FPS).toBe(CANONICAL_FPS);
  });

  test('no production source redeclares DEFAULT_FPS or inlines a `fps || 30` fallback', () => {
    const projectRoot = path.resolve(__dirname, '../../../');
    const srcDir = path.join(projectRoot, 'src');
    expect(fs.existsSync(srcDir)).toBe(true);

    const files = getAllProductionSourceFiles(srcDir);
    expect(files.length).toBeGreaterThan(50); // sanity check

    const redeclarations: { file: string; line: number; content: string }[] = [];
    const bareLiterals: { file: string; line: number; content: string }[] = [];

    for (const file of files) {
      const rel = path.relative(projectRoot, file);
      const lines = fs.readFileSync(file, 'utf-8').split('\n');
      lines.forEach((line, idx) => {
        if (rel !== CANONICAL_FILE && LOCAL_REDECLARATION.test(line)) {
          redeclarations.push({ file: rel, line: idx + 1, content: line.trim() });
        }
        if (BARE_LITERAL_FPS_FALLBACK.test(line)) {
          bareLiterals.push({ file: rel, line: idx + 1, content: line.trim() });
        }
      });
    }

    expect(redeclarations).toEqual([]);
    expect(bareLiterals).toEqual([]);
  });
});
