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
 */

import { describe, it, expect } from '@jest/globals';
import { readSource } from '@tests/guards/freeze-guard';

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
    const body = block![1];
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

  it('process.exit still enforces "teeth" (fail-loud on breach)', () => {
    const src = readSource(SCRIPT);
    // The non-negotiable part of the contract: a limit breach exits non-zero.
    // Pin the exact line so a future "let's just warn instead" edit fails.
    expect(src).toMatch(/process\.exit\(result\.isCompliant\s*\?\s*0\s*:\s*1\)/);
  });
});
