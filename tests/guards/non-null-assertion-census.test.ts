/**
 * Non-null-assertion census ratchet (Phase 141 / REQ-328).
 *
 * `02fa054a` silenced the strict-mode checker in the test tree by postfixing
 * `!` on optional fields — an assertion proves nothing about runtime presence,
 * it only suppresses the diagnostic (AI Hub steering on the VALUABLE prior
 * iteration). This guard turns the cleanup into a monotone ratchet:
 *
 *   - `src/visualization` production code is pinned at ZERO assertions
 *     (Phase 141 replaced all 67 with narrowing, `lookupEndpoint`, fail-loud
 *     accessors, or captured get-or-create — every replacement is
 *     behavior-preserving and the full visualization + guards suites stayed
 *     green through the rewrite).
 *   - the rest of `src` (93) and the `tests` tree (960) are pinned as
 *     UPPER BOUNDS: decreases are welcome, any new `!` fails the ratchet.
 *     New code must narrow (`if (x === undefined) …`), guard
 *     (`require…()` accessors), or use a typed helper instead.
 *
 * Matching rule (must stay identical to the one documented in
 * specs/speech-to-visuals/tasks/TASK-0226.md): a `!` immediately after an
 * identifier / `)` / `]`, NOT followed by `=`, and followed by a
 * code-continuation character (whitespace, punctuation, or EOL — this
 * excludes string-content bangs like `'visuals!'`). Comment-only lines are
 * skipped. `__tests__` / `__mocks__` directories are excluded from the src
 * bucket; the tests bucket is `tests/**` minus `__mocks__`.
 *
 * Mutation-verified (Phase 141): injecting `const v = queue.shift()!;` into
 * src/visualization/advanced-layouts.ts turns the visualization pin RED;
 * adding one `!` line anywhere else in src/tests turns the ratchet RED.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

const ASSERTION_RE = /[\w)\]]!(?!=)(?=[\s.,;:)\]}+*/?=<>&|{]|$)/;

/** Baseline measured 2026-08-19 (Phase 141, after src/visualization → 0). */
const PINNED = {
  'src/visualization (production)': 0,
  'src (production, excl. __tests__/__mocks__)': 93,
  'tests (excl. __mocks__)': 960,
} as const;

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === '__tests__' || entry === '__mocks__' || entry === 'node_modules' || entry === '.git') continue;
      walk(full, files);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

function countAssertions(rootRel: string): { count: number; hits: string[] } {
  const files = walk(join(REPO_ROOT, rootRel));
  const hits: string[] = [];
  for (const file of files) {
    const lines = readFileSync(file, 'utf-8').split('\n');
    lines.forEach((line, idx) => {
      const stripped = line.trim();
      if (stripped.startsWith('//') || stripped.startsWith('*') || stripped.startsWith('/*')) return;
      if (ASSERTION_RE.test(line)) {
        hits.push(`${file.replace(REPO_ROOT, '')}:${idx + 1}: ${stripped.slice(0, 80)}`);
      }
    });
  }
  return { count: hits.length, hits };
}

describe('non-null assertion census ratchet (REQ-328)', () => {
  const visualization = countAssertions('src/visualization');
  const srcTotal = countAssertions('src');
  const testsTotal = countAssertions('tests');

  it('src/visualization production code holds ZERO non-null assertions (exact)', () => {
    expect(visualization.hits).toEqual([]);
  });

  it('src production total (excl. __tests__/__mocks__) is at or below the ratchet', () => {
    expect(srcTotal.count).toBeLessThanOrEqual(PINNED['src (production, excl. __tests__/__mocks__)']);
  });

  it('tests tree total (excl. __mocks__) is at or below the ratchet', () => {
    expect(testsTotal.count).toBeLessThanOrEqual(PINNED['tests (excl. __mocks__)']);
  });

  it('census is not vacuous: the src remainder is real (visualization cleanup moved the needle)', () => {
    // 170 (pre-Phase-141 src total) − 67 (visualization) = 93; if a future
    // refactor drives the remainder down the ratchet pins above loosen only
    // by editing PINNED, so this liveness check just guards against a
    // scanner regression that would silently count nothing.
    expect(srcTotal.count).toBeGreaterThan(0);
    expect(testsTotal.count).toBeGreaterThan(0);
  });
});
