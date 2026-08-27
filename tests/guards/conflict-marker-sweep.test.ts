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
 * Scope mirrors the freeze-guard convention: this repo's working tree only —
 * the four source trees (src/ + tests/ + specs/ + docs/), the .github/
 * workflows surface, and the root config files by explicit list below. The
 * installed @stv/core package is core CI's own surface — a marker inside
 * node_modules is not this repo's drift.
 */
import { describe, it, expect } from '@jest/globals';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '@tests/guards/freeze-guard';

const SWEEP_ROOTS = ['src', 'tests', 'specs', 'docs', '.github'] as const;
// Root config files are swept by explicit list, not by a walk: they sit at
// the repo root outside the four trees yet are the most merge-conflicted
// surfaces in practice (package.json especially). Their failure profiles
// differ, and RED-witnessing them showed the layering:
//   - .github/workflows/*.yml — genuinely silent: nothing local parses them,
//     GitHub Actions only rejects the marker AFTER the push (the exact
//     post-landing blind spot this guard front-lines);
//   - jest.config.cjs — a bare marker kills the runner before ANY guard can
//     run, but comment/template-literal-borne markers are silent carriers
//     node accepts (RED-verified: census is their only detector);
//   - package.json — any column-0 marker is invalid JSON, so npm/node fail
//     loudly on their own; swept for census uniformity (one offender list
//     naming every site) and scope honesty, not as sole detector.
// Every entry is existence-pinned below so a rename cannot silently drop it
// from scope. package-lock.json (16k+ generated lines) is deliberately NOT
// here: it is a machine-regenerated artifact whose conflicts fail loudly at
// `npm install`, never a silent carrier tsc/jest reads as config.
const SWEEP_ROOT_FILES = [
  'jest.config.cjs',
  'package.json',
  'eslint.config.js',
  'vite.config.ts',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  'tsconfig.test.json',
  'tailwind.config.ts',
  'postcss.config.js',
  'remotion.config.ts',
  'components.json',
] as const;
const SKIP_DIRS = new Set([
  'node_modules', // installed deps — @stv/core is core CI's surface, not drift
  'dist', // build output — regenerated, never a landing surface
  'coverage', // generated coverage reports
  'worktrees', // sibling worktrees of this repo (session-283/287 isolation parity)
  'archive', // .concept/archive frozen history — retained bytes, not living code
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

const sweptFiles = [
  ...SWEEP_ROOTS.flatMap((root) => walkSweepFiles(root)),
  ...SWEEP_ROOT_FILES,
];

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

  it('root config and CI-workflow surfaces are in scope — the post-push blind spot', () => {
    // The four trees stop at their edges: a marker landing in jest.config.cjs
    // or .github/workflows/ci.yml sits on surfaces no compiler reads AND
    // whose failure only shows at run time — for CI workflows, only after
    // the push this guard front-lines. Pin that they are actually swept
    // (list + disk existence, so a rename REDs instead of silently
    // narrowing), and pin the one deliberate exclusion (package-lock.json,
    // machine-regenerated) so it cannot be assumed swept either.
    for (const file of SWEEP_ROOT_FILES) {
      expect(existsSync(join(REPO_ROOT, file))).toBe(true);
      expect(sweptFiles).toContain(file);
    }
    expect(sweptFiles).toContain('.github/workflows/ci.yml');
    expect(sweptFiles).toContain('.github/workflows/infrastructure.yml');
    expect(sweptFiles).not.toContain('package-lock.json');
  });

  it('.github sweep coverage is structural — disk parity, not an enumeration', () => {
    // Eval follow-up (run 20260827-180028): the two named sentinels above pin
    // TODAY's workflows, but a workflow file added later has no per-file pin —
    // it is covered only by the walk, and a refactor that swapped the .github
    // walk for the same explicit-list pattern as SWEEP_ROOT_FILES would keep
    // both named sentinels green while every file the list forgot fell out of
    // scope. Parity against the directory itself is the self-maintaining form:
    // whatever `*.yml` files exist on disk under .github/workflows, ALL of
    // them must appear in the census — read straight from readdirSync, not
    // from the walk, so the leg sees the disk truth the walk could drift
    // from (the self-consistent-attribution trap this repo has already paid
    // for once). Scoped to workflows/ because that is the CI surface whose
    // markers only surface after the push; other .github files keep the
    // census floor plus the named sentinels.
    // RED-witnessed: with a third workflow on disk and the walk narrowed to
    // an explicit two-file list, this leg alone goes RED naming the unswept
    // file while the named-sentinel leg above stays green.
    const onDisk = readdirSync(join(REPO_ROOT, '.github/workflows'))
      .filter((name) => /\.(?:ya?ml)$/.test(name))
      .map((name) => `.github/workflows/${name}`);
    expect(onDisk.length).toBeGreaterThanOrEqual(2); // ci.yml + infrastructure.yml
    const unswept = onDisk.filter((rel) => !sweptFiles.includes(rel));
    expect(unswept).toEqual([]);
  });
});
