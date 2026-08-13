import { describe, expect, it } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

/**
 * STRUCTURAL GUARD for sanitizeFinite single-source.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * MAINTENANCE NOTE (REQ-202): When src/utils/guards.ts is modified — adding
 * a new canonical helper, renaming sanitizeFinite, or changing its
 * signature — this guard's CLOSED-SET list (SITES below) AND the
 * COERCION_PATTERN regex MUST be updated in the SAME commit. Otherwise:
 *   • A rename will leave SITES pointing to the old helper name, and the
 *     "imports" assertion will false-positive against the new helper.
 *   • A new value-coercion helper added to guards.ts MUST be excluded from
 *     the sweep by adding it to the COERCION_PATTERN_EXCLUDE_FILES set,
 *     otherwise the guard will false-positive on the canonical helper
 *     implementation itself.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The `Number.isFinite(x) ? x : default` value-coercion pattern was previously
 * inlined at multiple sites across `pipeline/` and `monitoring/`. Each
 * independent copy can silently drift (different default values, swapped
 * operands, dropped `typeof` guard). The canonical sanitizeFinite lives in
 * src/utils/guards.ts and is the SINGLE SOURCE OF TRUTH — its contract is
 * tested in src/utils/__tests__/guards.test.ts and must NOT be re-described
 * here (REQ-403).
 *
 * Detection scope (REQ-204): ONLY value-coercion ternaries of the shape
 *   `Number.isFinite(<id>) ? <id> : <default>`
 * are forbidden. The following are deliberately EXCLUDED:
 *   • Boolean operand guards such as `Number.isFinite(x) && x > 0`
 *     (semantic = validation gate, not value coercion)
 *   • The canonical helper itself in src/utils/guards.ts (CLOSED-SET below)
 *   • `expect(Number.isFinite(...))` style assertions in tests
 *   • Lines beginning with `if`, `while`, `return`, `&&`, `||` whose
 *     `Number.isFinite(...)` is a CONDITION, not a value source
 *
 * Future layer batches (REQ-401): when the next iteration migrates an
 * additional layer (visualization, analysis, remotion, storage, …), append
 * the migrated file to SITES below in the SAME commit that does the
 * migration.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

// CLOSED-SET (REQ-203): every former inline value-coercion site that has been
// migrated to the canonical sanitizeFinite helper. Each entry is asserted to:
//   (a) import sanitizeFinite from '@/utils/guards'
//   (b) NOT contain a leftover `Number.isFinite(x) ? x : default` ternary.
// Future batches MUST extend this list (see MAINTENANCE NOTE above).
const SITES = [
  'src/pipeline/performance-baseline.ts',
  'src/pipeline/bottleneck-detector.ts',
  'src/monitoring/pipeline-metrics-collector.ts',
];

// Files where the inline pattern is intentionally present (canonical helper
// implementation + unit tests that exercise the bare formula).
const COERCION_PATTERN_EXCLUDE_FILES = new Set([
  'src/utils/guards.ts',
  'src/utils/__tests__/guards.test.ts',
  // This guard test itself quotes the forbidden shape inside its regex
  // literals and explanatory comments — exclude to prevent self-match.
  path.relative(REPO_ROOT, fileURLToPath(new URL('.', import.meta.url))) +
    'sanitize-finite-single-source.test.ts',
]);

// Detects `Number.isFinite(<id>) ? <id> : <default>` value coercion.
// The negative lookbehind `(?<![&|])` skips lines where the call is the
// operand of `&&` or `||` (condition guards, not value coercion).
const COERCION_PATTERN = /(?<![&|])Number\.isFinite\(\s*(\w+)\s*\)\s*\?\s*\1\s*:\s*[^?)]+\)/g;

function stripComments(src: string): string {
  return src
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('sanitizeFinite — every migrated site uses the canonical helper and does not re-inline', () => {
  for (const rel of SITES) {
    it(`${rel} imports sanitizeFinite and does not re-inline the coercion ternary`, () => {
      const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8');
      expect(src).toContain("from '@/utils/guards'");
      expect(src).toMatch(/\bsanitizeFinite\b/);
      const code = stripComments(src);
      expect(code).not.toMatch(COERCION_PATTERN);
    });
  }
});

describe('sanitizeFinite — guards.ts remains the single source of truth', () => {
  it('guards.ts is the only file allowed to define sanitizeFinite', () => {
    const guardsSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/utils/guards.ts'), 'utf-8');
    expect(guardsSrc).toMatch(/export function sanitizeFinite\b/);
    expect(guardsSrc).toMatch(/Number\.isFinite/);
  });

  it('no other src/ file re-defines sanitizeFinite', () => {
    const dirs = ['src'];
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (['node_modules', 'dist', 'coverage'].includes(entry.name)) continue;
          walk(full);
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
          const rel = path.relative(REPO_ROOT, full);
          if (COERCION_PATTERN_EXCLUDE_FILES.has(rel)) continue;
          const src = fs.readFileSync(full, 'utf-8');
          if (/export\s+function\s+sanitizeFinite\b/.test(src)) {
            found.push(rel);
          }
        }
      }
    };
    for (const d of dirs) walk(path.join(REPO_ROOT, d));
    expect(found).toEqual([]);
  });
});
