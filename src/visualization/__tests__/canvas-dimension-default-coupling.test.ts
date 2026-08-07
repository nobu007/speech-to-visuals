/**
 * Structural source-coupling guard for canvas-dimension defaults (REQ-293).
 *
 * `DEFAULT_CANVAS_WIDTH` (1920) / `DEFAULT_CANVAS_HEIGHT` (1080) are the single
 * source of truth in `src/visualization/canvas-dimensions.ts`. They were
 * previously redeclared as local `const` in 13 visualization modules
 * (canvas-calculator, layout-engine-v2, and every layout strategy). Behavioral
 * RED→GREEN is impossible because every redeclaration coincided with the
 * canonical value (the latent-coincident desync pattern) — so this test guards
 * the COUPLING at the source-text level: no production module other than the
 * canonical file may redeclare these constants. A frozen local copy would
 * silently desync the moment the canonical value changes.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from '../canvas-dimensions';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** The canonical definition file — the one place these literals may appear. */
const CANONICAL_FILE = path.join('src', 'visualization', 'canvas-dimensions.ts');

/**
 * A local redeclaration that shadows the canonical export, e.g.
 * `const DEFAULT_CANVAS_WIDTH = 1920;`. Prevents per-module drift.
 */
const LOCAL_REDECLARATION =
  /\bconst\s+DEFAULT_CANVAS_(?:WIDTH|HEIGHT)\s*=\s*(?:1920|1080)\s*;/;

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

describe('REQ-293: canvas-dimension defaults are single-sourced', () => {
  test('canonical constants hold their documented values', () => {
    // Locking the canonical values makes the "coincide today" desync detectable:
    // if these ever change, every frozen local literal would diverge.
    expect(DEFAULT_CANVAS_WIDTH).toBe(1920);
    expect(DEFAULT_CANVAS_HEIGHT).toBe(1080);
  });

  test('no production source redeclares the canvas-dimension constants', () => {
    const projectRoot = path.resolve(__dirname, '../../../');
    const srcDir = path.join(projectRoot, 'src');
    expect(fs.existsSync(srcDir)).toBe(true);

    const files = getAllProductionSourceFiles(srcDir);
    expect(files.length).toBeGreaterThan(50); // sanity check

    const violations: { file: string; line: number; content: string }[] = [];

    for (const file of files) {
      const rel = path.relative(projectRoot, file);
      // The canonical definition file is the single allowed home for these literals.
      if (rel === CANONICAL_FILE) continue;

      const lines = fs.readFileSync(file, 'utf-8').split('\n');
      lines.forEach((line, idx) => {
        if (LOCAL_REDECLARATION.test(line)) {
          violations.push({ file: rel, line: idx + 1, content: line.trim() });
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
