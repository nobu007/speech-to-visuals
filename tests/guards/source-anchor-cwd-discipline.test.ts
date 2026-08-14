/**
 * @jest-environment node
 */
/**
 * Source-anchor cwd discipline — structural guard against cwd-relative
 * source reads in tests.
 *
 * RULE (codified here after the whisper-node chdir root-cause, 16ed9ccf):
 * a test that reads repo source files (source-anchor / mutation-pinning /
 * canon guards) MUST resolve paths from `import.meta.url`, never from
 * `process.cwd()`. Two independent reasons:
 *
 *   1. MODULE-LOAD SIDE EFFECTS MOVE THE WORKER. The whisper-node package
 *      runs `process.chdir()` at import time (see
 *      tests/__mocks__/whisper-node.ts for the full story), which permanently
 *      moves the jest worker's cwd into node_modules. Every suite scheduled
 *      later in that worker then resolves 'src/...' against the wrong root
 *      and fails with ENOENT — nondeterministically (4–84 failures depending
 *      on worker scheduling), destroying the full-suite quality-gate signal.
 *      Any OTHER dependency can acquire the same class of side effect; the
 *      mock only removes the one we know about.
 *   2. --maxWorkers>1 scheduling alone flakes cwd-relative reads (TC-302/313).
 *
 * A cwd anchor has a third failure mode that is WORSE than red: an
 * `existsSync` precondition that reads false under a moved cwd turns the
 * whole suite into silent `it.skip` (spine-manifest.test.ts did exactly this
 * before being anchored) — the guard looks green while covering nothing.
 *
 * Walk-up finders (`let dir = process.cwd(); while (...) dir = ..`) are NOT
 * flagged: they self-heal by walking up to a repo marker, so they survive a
 * moved cwd. Only the fragile forms are banned:
 *   (a) resolve/join/normalize(process.cwd(), ...) feeding a read
 *   (b) bare repo-relative read/glob literals: readFileSync('src/...'),
 *       globSync('src/**') — identical hazard, shorter spelling
 *   (c) a `const *ROOT* = process.cwd()` alias used as the anchor
 *
 * Escape hatch: append `// cwd-anchor-exempt:` to a line (with a reason) if
 * a test genuinely must observe the process cwd itself.
 *
 * RED-verified: each pattern (a)/(b)/(c) fails this suite when reintroduced
 * into any test file under src/ or tests/.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync, globSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Anchored to import.meta.url, not process.cwd() — this guard enforces that
// rule, so it must obey it.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SELF = 'tests/guards/source-anchor-cwd-discipline.test.ts';

const TEST_FILES = [
  ...(globSync('src/**/*.test.{ts,tsx}', { cwd: REPO_ROOT }) as string[]),
  ...(globSync('tests/**/*.test.{ts,tsx}', { cwd: REPO_ROOT }) as string[]),
];

/**
 * True if the line is comment-only (block-comment interior, JSDoc continuation,
 * or a `//` line). Comment lines are skipped instead of regex-stripped: a
 * naive block-comment strip eats comment delimiters that appear INSIDE string
 * literals — and test sources are full of recursive-glob strings whose
 * star-slash sequences would make the stripper silently corrupt the line.
 */
function isCommentLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

// (a) cwd fed into path building — `resolve(process.cwd(), 'src/...')` etc.
const CWD_PATH_BUILD = /(?:resolve|join|normalize|relative)\s*\(\s*process\.cwd\(\)/;
// (b) bare repo-relative read/glob literal — `readFileSync('src/...')`,
// `globSync('src/**')` (relative to an assumed cwd, hence equally fragile).
const BARE_RELATIVE_READ =
  /(?:readFileSync|readFile|existsSync|readdirSync|statSync|globSync|glob|require)\s*\(\s*['"`](?:src|specs|scripts|supabase|tests)\//;
// (c) a ROOT-named const aliased straight to cwd — no walk-up, no fallback.
const CWD_ROOT_ALIAS = /const\s+\w*(?:ROOT|root)\w*\s*=\s*process\.cwd\(\)\s*;/;
const EXEMPT = /\/\/\s*cwd-anchor-exempt:/;

describe('source-anchor cwd discipline (whisper-node chdir lesson, 16ed9ccf)', () => {
  it('found the test corpus (guard is not vacuously green)', () => {
    expect(TEST_FILES.length).toBeGreaterThan(100);
  });

  it('no test file anchors repo-source reads to process.cwd()', () => {
    const violations: string[] = [];
    for (const rel of TEST_FILES) {
      // This guard's own source contains the banned patterns as literals.
      if (rel === SELF) continue;
      const lines = readFileSync(join(REPO_ROOT, rel), 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (isCommentLine(line)) return;
        if (EXEMPT.test(line)) return;
        // A `{ cwd: <anchor> }` option (same line) makes the pattern
        // cwd-explicit — e.g. globSync('src/**', { cwd: REPO_ROOT }) is fine.
        if (/\{\s*cwd\s*:/.test(line)) return;
        if (CWD_PATH_BUILD.test(line) || BARE_RELATIVE_READ.test(line) || CWD_ROOT_ALIAS.test(line)) {
          violations.push(`${rel}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(violations).toEqual([]);
  });
});
