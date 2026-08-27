/**
 * @jest-environment node
 */
/**
 * Git merge-conflict-marker sweep — structural guard (INV-TEST-008).
 *
 * The 20260827-170455 implement run repaired a main-RED landing: a chore
 * (make-run) commit (cd2427ce) swept in a mw-091 guard test file whose
 * merge conflict was never resolved — six `<<<<<<<`/`=======`/`>>>>>>>`
 * markers (TS1185 parse errors) sat on main until the guards baseline run
 * caught them (session-286). tsc had actually failed on that file, but the
 * markers also land in shapes tsc ACCEPTS: inside a template literal, inside
 * a comment, or in non-TS surfaces (specs/*.md, docs/**, *.yml) that no
 * compiler ever reads. That silent-carrier class had no dedicated detector —
 * this sweep is it, front-lining the landing BEFORE the push, not after.
 *
 * Contract (git's exact emission shapes — nothing looser):
 *   - `<<<<<<<` / `>>>>>>>` / `|||||||` are exactly 7 chars at COLUMN 0
 *     (git never indents markers) followed by a space+label (or EOL);
 *   - `=======` is exactly 7 `=` spanning the whole line, and is only an
 *     offender in CODE files — a setext `=======` underline in prose (.md)
 *     is legitimate typography, and a real hunk always carries its
 *     START/END pair, which ARE caught in every file type.
 *
 * Near-misses are deliberately spared (6/8-char runs, `<<<` heredoc-ish
 * operators, indented example markers in prose/comments) — the detection
 * pin below freezes that boundary so the census cannot silently re-widen
 * into prose false positives or re-narrow past git's shapes.
 *
 * Scope mirrors the freeze-guard convention: this repo's working tree only
 * (src/ + tests/ + specs/ + docs/). The installed @stv/core package is core
 * CI's own surface — a marker inside node_modules is not this repo's drift.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '@tests/guards/freeze-guard';

const SWEEP_ROOTS = ['src', 'tests', 'specs', 'docs'] as const;
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'coverage',
  'worktrees',
  'archive',
]);
const SWEEP_EXT = /\.(?:ts|tsx|js|jsx|cjs|mjs|md|ya?ml|json)$/;
// The SEP marker's file scope (see header): code files only, prose exempt.
const CODE_EXT = /\.(?:ts|tsx|js|jsx|cjs|mjs|json|ya?ml)$/;

// git's conflict hunk delimiters: exactly 7 chars at column 0, then a space
// + ref label (git always writes one) — a bare EOL is accepted as the
// strictest possible tail so a hand-trimmed label cannot slip through.
const CONFLICT_START = /^<{7}(?: |$)/;
const CONFLICT_END = /^>{7}(?: |$)/;
// diff3's common-base marker (present only under conflictStyle=diff3, but a
// marker that arrives is a marker that arrived).
const CONFLICT_BASE = /^\|{7}(?: |$)/;
// The mid-hunk separator: a full line of EXACTLY 7 `=`. 8+ equals or any
// flanking character is prose/code, never git.
const CONFLICT_SEP = /^={7}$/;

/** Repo-relative walk of every sweepable file, including test files. */
function walkSweepFiles(dirRel: string, acc: string[] = []): string[] {
  const absDir = join(REPO_ROOT, dirRel);
  for (const entry of readdirSync(absDir)) {
    const rel = `${dirRel}/${entry}`;
    if (statSync(join(absDir, entry)).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) walkSweepFiles(rel, acc);
    } else if (SWEEP_EXT.test(rel)) {
      acc.push(rel);
    }
  }
  return acc;
}

const sweptFiles = SWEEP_ROOTS.flatMap((root) => walkSweepFiles(root));

/** `rel:line: content` for every conflict-marker line found (empty = clean). */
function conflictOffenders(): string[] {
  const offenders: string[] = [];
  for (const rel of sweptFiles) {
    const sepApplies = CODE_EXT.test(rel);
    readFileSync(join(REPO_ROOT, rel), 'utf8')
      .split('\n')
      .forEach((line, i) => {
        const hit =
          CONFLICT_START.test(line) ||
          CONFLICT_END.test(line) ||
          CONFLICT_BASE.test(line) ||
          (sepApplies && CONFLICT_SEP.test(line));
        if (hit) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
  }
  return offenders;
}

describe('git conflict-marker sweep guard (INV-TEST-008)', () => {
  it('no swept file carries a git conflict marker at column 0', () => {
    // Fail as a census: one offender or ten, the RED output names every
    // site in a single run — the make-run sweep-in class lands whole
    // conflict hunks, so the first hit is rarely the only one.
    expect(conflictOffenders()).toEqual([]);
  });

  it('the detection shapes catch git emissions and spare the near-misses', () => {
    // Pin the census regexes' detection contract (session-239 lesson: a
    // shape only exercised through live data has no contract). Every leg
    // here is a marker sample at column 0 or a near-miss that must stay
    // green — the boundary is the contract, both directions.
    for (const marker of [CONFLICT_START, CONFLICT_END, CONFLICT_BASE]) {
      expect(marker.test('<<<<<<< HEAD')).toBe(marker === CONFLICT_START);
      expect(marker.test('>>>>>>> feature/c2-rle')).toBe(
        marker === CONFLICT_END,
      );
      expect(marker.test('||||||| merged common ancestors')).toBe(
        marker === CONFLICT_BASE,
      );
      // Bare EOL tail: a hand-trimmed label is still a hunk edge.
      expect(marker.test('<<<<<<<')).toBe(marker === CONFLICT_START);
      // 6-char runs and heredoc-ish operators are never git markers.
      expect(marker.test('<<<<<< HEAD')).toBe(false);
      expect(marker.test('<<< EOF')).toBe(false);
      // Indented: git writes markers at column 0 — an indented one is a
      // prose/example quote (like the samples in THIS file's tests), not a
      // live conflict.
      expect(marker.test('  <<<<<<< HEAD')).toBe(false);
    }
    // SEP is exactly 7 equals, whole line.
    expect(CONFLICT_SEP.test('=======')).toBe(true);
    expect(CONFLICT_SEP.test('========')).toBe(false); // 8 = setext/typo
    expect(CONFLICT_SEP.test('===')).toBe(false);
    expect(CONFLICT_SEP.test('======= tail')).toBe(false); // flanked
  });

  it('the SEP marker scopes to code files — prose keeps only the hunk edges', () => {
    // A markdown setext underline of exactly 7 `=` is legitimate typography;
    // charging it would make docs edits flaky REDs. A real conflict in .md
    // still REDs through its START/END pair (which sweep every file type).
    const isCode = (rel: string) => CODE_EXT.test(rel);
    expect(isCode('specs/speech-to-visuals/architecture.md')).toBe(false);
    expect(isCode('src/export/enhanced-export-engine.ts')).toBe(true);
    expect(isCode('jest.config.cjs')).toBe(true);
    expect(isCode('.concept/invariants.yml')).toBe(true);
  });

  it('the census actually sweeps the trees that were hit (not vacuously green)', () => {
    // If the walk ever silently matched nothing (root rename, SKIP_DIRS
    // over-broadening), the census above would pass over zero files. Pin a
    // floor plus one sentinel per root — sentinels are the surfaces of the
    // 20260827 incident class: the guard test file the markers landed in,
    // the src tree, and the uncompiled spec/doc surfaces tsc never reads.
    expect(sweptFiles.length).toBeGreaterThanOrEqual(1000);
    expect(sweptFiles).toContain('tests/guards/mw-091-ledger-integrity.test.ts');
    expect(sweptFiles).toContain('src/export/enhanced-export-engine.ts');
    expect(sweptFiles).toContain('specs/speech-to-visuals/architecture.md');
    expect(sweptFiles).toContain('docs/architecture/QUALITY_METRICS.md');
  });
});
