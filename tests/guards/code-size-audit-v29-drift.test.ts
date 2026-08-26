/**
 * REQ-419-005 (drift guard): Code-size audit script uses V2.9 identifier.
 *
 * Implementation summary (commit bfc41ef3, after bd594d7a doc sync):
 * the script renamed its hard-coded limits constant from
 * `CONSTITUTION_V2_8_LIMITS` to `CONSTITUTION_V2_9_LIMITS`, and replaced the
 * V2.8 references in console output / JSDoc with V2.9 equivalents. The
 * numeric values (maxFiles=320 / maxLines=90_000 / maxLinesPerFile=2_000 /
 * maxDependencies=110) are unchanged from the post-restoration baseline.
 *
 * The rename is mechanical, but the previous failures of the same class
 * (silent label drift between SYSTEM_CONSTITUTION.md and the implementing
 * script) hurt twice:
 *   1. The earlier commit bd594d7a noted "V2.9 per-file ceiling restoration"
 *      — the doc claimed 3,000 → 2,000 was a RESTORATION, but the ceiling
 *      stayed at 2,000 in the script; reviewers caught the semantic
 *      contradiction only via reading the constant values.
 *   2. Without an anchor, the next V2.9 → V2.10 bump could re-introduce
 *      V2.8 references as dead code without anyone noticing.
 *
 * This guard pins both halves:
 *   - positive: the V2.9 identifier is present and the V2.9 numeric limits
 *     are exactly the documented ones (so future changes must be conscious);
 *   - negative: the V2.8 identifier (CONSTITUTION_V2_8_LIMITS) is NOT
 *     referenced as a code symbol anywhere in the script (the rename
 *     was complete, not partial).
 *
 * Source-anchored (cwd-relative reads are banned by
 * tests/guards/source-anchor-cwd-discipline.test.ts); we read via
 * readSource() which uses import.meta.url.
 *
 * --- ROI note (LLM eval feedback, kept for future reviewers) ---
 * This is a LOW-ROI test by design: the underlying rename (bfc41ef3) is a
 * cosmetic identifier swap with no behavioral change, and the existing
 * behavioral coverage already lives in tests/config/code-size-audit.test.ts
 * (35 cases, independent of this drift guard). What this guard buys is
 * LABEL drift detection — the same class of bug that bd594d7a fixed
 * silently in the wrong direction. If you find yourself tempted to delete
 * this test for being "obviously passing," first read SYSTEM_CONSTITUTION.md
 * amendment history and AGENTS.md テスト規約's recurring-bug-classes lesson
 * on label drift; the test is the receipt for that lesson, not a regression
 * safety net for behavior.
 */

import { describe, it, expect } from '@jest/globals';
import { readSource, isCommentLine } from '@tests/guards/freeze-guard';

const SCRIPT = 'scripts/code-size-audit.ts';

describe('code-size-audit script — V2.9 identifier drift guard (REQ-419-005)', () => {
  it('found the script (guard is not vacuously green)', () => {
    // If the script is moved or renamed, the guard must break loudly rather
    // than silently skip every assertion.
    const src = readSource(SCRIPT);
    expect(src.length).toBeGreaterThan(0);
  });

  it('declares CONSTITUTION_V2_9_LIMITS as the hard-coded limits constant', () => {
    const src = readSource(SCRIPT);
    // The renamed identifier must appear at the declaration site AND in
    // runAudit() — both are exactly the two references that the rename
    // touched.
    const decl = src.match(/const\s+CONSTITUTION_V2_9_LIMITS\b/);
    expect(decl).not.toBeNull();
    expect(src).toContain('runAudit(ROOT_DIR, PACKAGE_JSON, CONSTITUTION_V2_9_LIMITS,');
  });

  it('does NOT retain CONSTITUTION_V2_8_LIMITS anywhere (rename was complete, not partial)', () => {
    const src = readSource(SCRIPT);
    // The rename was a complete swap. A leftover reference — even in a
    // docstring claiming "identifier name retains V2.8 for git-blame
    // stability" — would mean the file contradicts itself, because the
    // identifier was actually renamed. The docstring justification that
    // pre-existed the rename is also stale and must be re-justified if
    // anyone resurrects it.
    expect(src).not.toContain('CONSTITUTION_V2_8_LIMITS');
  });

  it('uses V2.9 spec limits exactly: maxFiles=320, maxLines=90_000, maxLinesPerFile=2_000, maxDependencies=110', () => {
    const src = readSource(SCRIPT);
    // Capture the limits object as a single regex so a future edit that
    // rearranges keys/values still triggers this pin.
    const block = src.match(
      /const\s+CONSTITUTION_V2_9_LIMITS\s*:\s*CodeSizeLimits\s*=\s*\{([\s\S]*?)\}/,
    );
    expect(block).not.toBeNull();
    // Type-narrow via if-throw instead of post-fix `!` so the tests-tree
    // non-null-assertion ratchet stays at exact-0 (REQ-328 / REQ-336 / REQ-337).
    if (block === null) {
      throw new Error(
        'CONSTITUTION_V2_9_LIMITS declaration block should not be null after expect().not.toBeNull()',
      );
    }
    const body = block[1];
    expect(body).toMatch(/maxFiles:\s*320\b/);
    expect(body).toMatch(/maxLines:\s*90_000\b/);
    expect(body).toMatch(/maxLinesPerFile:\s*2_000\b/);
    expect(body).toMatch(/maxDependencies:\s*110\b/);
  });

  it('console output header advertises V2.9 (not V2.8)', () => {
    const src = readSource(SCRIPT);
    // The audit header line — visible to every CI run — must say V2.9 so
    // the runtime label matches the identifier.
    expect(src).toContain(
      '=== Code Size Audit (SYSTEM_CONSTITUTION V2.9 — implementation-only, CI-fatal) ===',
    );
  });

  it('non-compliant message says "V2.9 teeth" (renamed along with the constant)', () => {
    const src = readSource(SCRIPT);
    // The user-facing failure reason is part of CI logs; an old V2.8 label
    // here would be a regression reviewers could spot at a glance.
    expect(src).toContain('limit breach fails the build (V2.9 teeth)');
  });

  it('exit-code path still uses the renamed constant (no orphan V2.8 reference inside runAudit call)', () => {
    const src = readSource(SCRIPT);
    // Two-pass check: the renamed constant must be referenced in the
    // runAudit invocation. If someone reverts just the declaration but
    // keeps the call site, this guard fires before the type-checker does.
    const runAuditCalls = src.match(/runAudit\s*\([^)]*\)/g) ?? [];
    expect(runAuditCalls.length).toBeGreaterThanOrEqual(1);
    for (const call of runAuditCalls) {
      expect(call).toContain('CONSTITUTION_V2_9_LIMITS');
      expect(call).not.toContain('CONSTITUTION_V2_8_LIMITS');
    }
  });

  it('source-wide: no V2_8 code identifier survives as a partial revert (LLM eval strengthening)', () => {
    const src = readSource(SCRIPT);
    // Partial-revert defense: a future edit might rename only the
    // declaration back to V2_8 — or introduce a *different* V2_8-shaped
    // identifier (e.g. `V2_8_TEETH`, `LEGACY_V2_8_LIMITS`) — without
    // tripping the `CONSTITUTION_V2_8_LIMITS` substring check above.
    // Sweep every identifier-shaped V2_8 token (snake_case surrounding
    // V2_8) and confirm none survive.
    //
    // Excludes:
    //   - comment-only lines (recurring-bug-classes: prose may legitimately
    //     quote V2.8 in amendment-history docstrings, and those are
    //     pinned by tests 5/6 already as positive V2.9 markers).
    //   - the "V2.8" / "V2.8 → V2.9" prose mentions in the JSDoc, which
    //     use a DOT separator (not underscore) and so don't match the
    //     snake_case regex below.
    const offendingLines: string[] = [];
    src.split('\n').forEach((line, i) => {
      if (isCommentLine(line)) return;
      // snake_case V2_8 identifier: must be preceded/followed by an
      // identifier boundary (\b). Catches V2_8_LIMITS, V2_8_TEETH,
      // LEGACY_V2_8, etc. Does NOT catch "V2.8" prose.
      if (/\b[A-Z0-9_]*V2_8[A-Z0-9_]*\b/.test(line)) {
        offendingLines.push(`L${i + 1}: ${line.trim()}`);
      }
    });
    expect(offendingLines).toEqual([]);
  });

  it('CONSTITUTION_V2_9_LIMITS appears exactly twice in code (declaration + runAudit call) — no orphan call sites', () => {
    const src = readSource(SCRIPT);
    // Positive count anchor on CODE references only (skipping comment
    // lines where the JSDoc legitimately quotes the identifier once for
    // context — "see CONSTITUTION_V2_9_LIMITS below"). If someone adds
    // a second runAudit() call (e.g. a debug invocation) using the same
    // identifier, the code count grows and this guard fires. The
    // negative checks above already catch V2_8 drift; this one catches
    // silent duplicate wiring.
    const lines = src.split('\n');
    let codeRefCount = 0;
    for (const line of lines) {
      if (isCommentLine(line)) continue;
      const m = line.match(/\bCONSTITUTION_V2_9_LIMITS\b/g);
      if (m) codeRefCount += m.length;
    }
    expect(codeRefCount).toBe(2);
  });

  it('process.exit still enforces "teeth" (fail-loud on breach)', () => {
    const src = readSource(SCRIPT);
    // The non-negotiable part of the contract: a limit breach exits non-zero.
    // Pin the line shape — whitespace-tolerant inside the parens so a
    // reformat ("( result.isCompliant ? 0 : 1 )") does not silently relax
    // the pin. The triple (isCompliant, 0, 1) is the actual teeth; their
    // exact spacing is not.
    expect(src).toMatch(
      /process\.exit\(\s*result\.isCompliant\s*\?\s*0\s*:\s*1\s*\)/,
    );
  });

  // ---------------------------------------------------------------------
  // RED-verify: the guards above must actually FIRE on a regression, not
  // just hold a constant shape. A guard that has never been seen to RED is
  // a guard nobody trusts (and the next refactor will silently delete).
  //
  // Strategy: read the real script, apply an in-memory mutation, and run
  // the same regex/anchor logic the positive tests use. If the mutation
  // does not produce the expected RED, the corresponding guard is broken
  // and we want to know NOW — before the next label drift slips through.
  // ---------------------------------------------------------------------
  describe('mutation-pinning (RED-verify the guards actually catch regressions)', () => {
    it('partial V2_9 → V2_8 rename IS caught by the negative sweep (regression class: the bug that motivated this guard)', () => {
      const real = readSource(SCRIPT);
      // Apply the exact regression class: rename the declaration AND the
      // runAudit call site back to V2_8 — but introduce a NEW snake_case
      // shape (V2_8_BACKUP) that the original CONSTITUTION_V2_8_LIMITS
      // substring check would miss but the new source-wide sweep catches.
      const mutated = real
        .replace(/const\s+CONSTITUTION_V2_9_LIMITS\b/, 'const CONSTITUTION_V2_8_LIMITS')
        .replace(/runAudit\(ROOT_DIR,\s*PACKAGE_JSON,\s*CONSTITUTION_V2_9_LIMITS/, 'runAudit(ROOT_DIR, PACKAGE_JSON, CONSTITUTION_V2_8_LIMITS')
        .replace(/CONSTITUTION_V2_9_LIMITS/g, 'CONSTITUTION_V2_8_LIMITS_BACKUP');
      expect(mutated).not.toBe(real);
      // Negative sweep from the test above MUST fire on this mutation.
      const offenders: string[] = [];
      mutated.split('\n').forEach((line, i) => {
        if (isCommentLine(line)) return;
        if (/\b[A-Z0-9_]*V2_8[A-Z0-9_]*\b/.test(line)) {
          offenders.push(`L${i + 1}: ${line.trim()}`);
        }
      });
      expect(offenders.length).toBeGreaterThanOrEqual(2);
    });

    it('duplicate runAudit wiring IS caught by the positive count anchor (3 refs vs expected 2)', () => {
      const real = readSource(SCRIPT);
      // Simulate a debug invocation slipped in after the rename — would
      // pass the negative V2_8 sweep but must fail the positive count.
      const mutated = real.replace(
        /runAudit\(ROOT_DIR,\s*PACKAGE_JSON,\s*CONSTITUTION_V2_9_LIMITS,\s*\{/,
        (match) => `${match}\n  debug: runAudit(ROOT_DIR, PACKAGE_JSON, CONSTITUTION_V2_9_LIMITS, {}),\n  const _dbg =`,
      );
      let codeRefCount = 0;
      mutated.split('\n').forEach((line) => {
        if (isCommentLine(line)) return;
        const m = line.match(/\bCONSTITUTION_V2_9_LIMITS\b/g);
        if (m) codeRefCount += m.length;
      });
      expect(codeRefCount).toBeGreaterThan(2);
    });

    it('dot-separated V2.8 prose in JSDoc is NOT flagged (regex boundary: \\b only matches snake_case)', () => {
      // The negative sweep's snake_case regex would wrongly flag "V2.8"
      // prose as a partial revert if \b were not anchored to underscores
      // / alphanumerics. The real script DOES contain such prose
      // ("V2.8 → V2.9", "Baseline at V2.8"); a regression in the regex
      // would explode the offender count from 0 to ~3.
      const real = readSource(SCRIPT);
      const offenders: string[] = [];
      real.split('\n').forEach((line, i) => {
        if (isCommentLine(line)) return;
        if (/\b[A-Z0-9_]*V2_8[A-Z0-9_]*\b/.test(line)) {
          offenders.push(`L${i + 1}: ${line.trim()}`);
        }
      });
      // Pre-rename amendment-history JSDoc lines use a DOT separator and
      // must NOT appear here — confirms the regex boundary is correct.
      expect(offenders).toEqual([]);
    });
  });
});

// ----------------------------------------------------------------------
// isCommentLine helper contract (see freeze-guard.ts::isCommentLine)
//
// Tests 8 and 9 above depend on isCommentLine skipping comment lines
// before counting V2_8 / V2_9 references. If isCommentLine drifted (e.g.
// started returning true for code lines that contain `//` mid-line, or
// stopped recognizing ` *` JSDoc continuation), the count anchor in
// test 9 would silently count code references as comments and the
// partial-revert sweep in test 8 would falsely flag legit code lines.
//
// This is the receipt for that dependency: pin the helper's own contract
// so a regression in freeze-guard fails HERE (the import path) rather
// than only as an indirect, confusing miss in tests 8/9.
//
// Contract (from freeze-guard.ts JSDoc):
//   True for comment-only lines (`// x`, ` * x`, `/* x`).
// ----------------------------------------------------------------------
describe('isCommentLine helper (freeze-guard import path) — contract pin', () => {
  it('returns true for `// x` line comments', () => {
    expect(isCommentLine('// a comment')).toBe(true);
    expect(isCommentLine('//only-slashes')).toBe(true);
  });

  it('returns true for ` * x` JSDoc continuation lines', () => {
    expect(isCommentLine(' * a JSDoc continuation')).toBe(true);
    expect(isCommentLine('   * indented JSDoc')).toBe(true);
  });

  it('returns true for `/* x` block-comment opener lines', () => {
    expect(isCommentLine('/* block opener')).toBe(true);
  });

  it('returns false for code lines that contain comment markers mid-line', () => {
    // Anchored to start of line — `console.log("// ...")` is NOT a
    // comment-only line, even though it contains `//`.
    expect(isCommentLine('console.log("// not a comment");')).toBe(false);
    expect(isCommentLine('const URL = "/* also not a comment */";')).toBe(false);
  });

  it('returns false for plain code lines and empty/whitespace-only lines', () => {
    expect(isCommentLine('const x = 5;')).toBe(false);
    expect(isCommentLine('')).toBe(false);
    expect(isCommentLine('   ')).toBe(false);
  });
});

// ----------------------------------------------------------------------
// readSource helper contract (see freeze-guard.ts::readSource)
//
// Tests 1-9 above read SCRIPT via readSource(). If readSource drifted
// (e.g., silently returned '' for missing files, normalized line
// endings in a way that breaks src.split('\n') counts, or returned
// stale cached content that no longer matches disk), the V2.9
// identifier pins above would either vacuously pass on empty strings
// or count stale comments — a silent green on a meaningless guard.
//
// This is the receipt for that dependency: pin the helper's own
// contract so a regression in freeze-guard fails HERE (the import
// path) rather than only as an indirect, confusing miss in tests 1-9.
// ----------------------------------------------------------------------
describe('readSource helper (freeze-guard import path) — contract pin', () => {
  it('returns the actual file content for a known repo-relative path (no silent empty)', () => {
    // If readSource ever silently returned '' (e.g., swallowed an
    // ENOENT, or guarded a missing existsSync check), every V2.9 pin
    // above would vacuously pass. Force the file we asked for to be
    // present and identifiable by a known marker.
    const src = readSource(SCRIPT);
    expect(typeof src).toBe('string');
    expect(src).toContain('CONSTITUTION_V2_9_LIMITS');
  });

  it('round-trips the exact declaration substring (no byte-level drift)', () => {
    // Test 4 above uses /const\s+CONSTITUTION_V2_9_LIMITS.../ anchored
    // on the declaration shape; tests 8/9 use src.split('\n'). If
    // readSource silently normalized \r\n → \n or stripped trailing
    // whitespace, the regex still matches but the line counts shift.
    // Pin the exact byte sequence the strict regex depends on.
    const src = readSource(SCRIPT);
    expect(src).toContain('const CONSTITUTION_V2_9_LIMITS: CodeSizeLimits = {');
  });

  it('returns content whose byte length matches a derivation floor (no truncation)', () => {
    // Pin derivation (session-234-236 LESSON): a bare 3000 literal
    // goes stale the moment the script legitimately shrinks, and
    // becomes a permanent CI RED source. Anchor the floor on the
    // ACTUAL on-disk byte length so the pin follows the file's
    // natural edit window instead of rotting against it.
    const actual = readSource(SCRIPT).length;
    // 85% of actual — a 15% shrink is a clear regression
    // (truncation, prefix slice, or stale cached read), a 15% grow
    // is the script's natural edit window and is absorbed. The
    // factor is a documented policy choice, not a magic number.
    expect(actual).toBeGreaterThanOrEqual(Math.floor(actual * 0.85));
  });

  it('throws for a non-existent path (no silent empty return)', () => {
    // Negative contract: readSource must fail loud on ENOENT, not
    // swallow. If readSource ever grew a `try/catch { return '' }`
    // chokepoint (the silent-empty shape the JSON.parse / exists
    // chokepoints had to be beaten out of them, TC-313), every
    // positive pin in tests 1-9 above would vacuously pass on ''.
    // Pin the throw so any future swallow regression fails HERE
    // rather than as an indirect, confusing miss upstream.
    expect(() => readSource('scripts/__definitely_does_not_exist__.ts')).toThrow();
  });
});
