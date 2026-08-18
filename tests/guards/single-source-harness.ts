/**
 * single-source-harness.ts — the table-driven runner for the MECHANICAL
 * layers of every per-family single-source guard (round 51).
 *
 * Background: rounds 46-50 each shipped a per-family test of the same
 * three-layer shape — Layer 1 (verbatim oracle: the frozen retired
 * expression equated to the canonical over a corpus), Layer 2 (semantic
 * pins: LIVE witnesses, NaN contracts — family-specific, NOT mechanizable),
 * Layer 3 (source anchors: delegation shapes + bans via readSource). The
 * mechanical layers 1 and 3 alone cost 365-673 lines per family (2,341
 * lines over five rounds) in nearly identical boilerplate, so a new fold
 * family paid most of its cost in copy-paste that no one re-verified.
 *
 * This module is the extraction — the same move freeze-guard.ts (round 8,
 * discovery walk) and frozen-literal-rules.ts (round 35, registry entries)
 * already made for the sweep side. Here a family's mechanical layers are
 * DATA ROWS declared next to their retired witnesses (D4: retired
 * expressions and corpora stay inside the per-family test — no
 * `*-retired.ts` split):
 *
 *   describeSingleSource('my-family', [
 *     oracleRow({ id: 'pair-w', canonical: ..., retired: ...,
 *                 corpus: [...], mode: { kind: 'object-is' } }),
 *     anchorRow({ kind: 'occurs', id: 'site-delegates', file: 'src/…',
 *                 pattern: /…/, exactly: 1 }),
 *     anchorRow({ kind: 'ban', id: 'site-no-raw', file: 'src/…',
 *                 pattern: /…/ }),           // scope 'code' by default
 *   ], { fingerprint: FAMILY_FINGERPRINT });
 *
 * Conventions (from the family tests this replaces — see
 * specs/guard-harness-fold-census/architecture.md D1-D6):
 *   - oracle equivalence modes: `object-is` (bit-identical) and
 *     `delta` (|canonical − retired| ≤ maxDelta, with a MANDATORY witness:
 *     a delta row whose corpus never diverges is RED — a vacuous bound
 *     would hide the behavior change the round shipped, EDGE-101);
 *   - every corpus case is one ENUMERATION unit, so the count is analytically
 *     computable (countExpectations, D6) and a shrunk corpus flips the
 *     fingerprint pin — object-is rows also assert once per case, delta
 *     rows assert only the divergences + the witness (see runOracleRow);
 *   - anchor counting is LINE-based (REQ-402: one match per line; a
 *     pattern containing `\n` is rejected at declaration), and `src.match(/…/g)`
 *     counts from the retired tests map onto `scope: 'source'` (whole file)
 *     while `codeLines()` filters map onto the default `scope: 'code'`
 *     (comment lines excluded — delegation comments must not self-detonate
 *     the ban that quotes them, r49/r50 GOTCHA);
 *   - rows fail LOUD at declaration (factory) and again at describe time —
 *     a negative count, an empty corpus, a delta without a bound, or an
 *     unknown id shape throws instead of silently skipping (EDGE-001);
 *   - all file reads go through freeze-guard's readSource (import.meta.url
 *     anchored — never process.cwd(), NFR-101).
 */

import { describe, it, expect } from '@jest/globals';
import { readSource, isCommentLine } from '@tests/guards/freeze-guard';

// ---------------------------------------------------------------------------
// Types (specs/guard-harness-fold-census/interfaces.ts §1; AnchorRow carries
// the `id` the layer diagram names tests by — the fingerprint pin keys on it).
// ---------------------------------------------------------------------------

/** Layer 1 equivalence mode. */
export type EquivalenceMode =
  | { kind: 'object-is' } // bit-identical (NaN equal via Object.is)
  | { kind: 'delta'; maxDelta: number }; // |canonical − retired| ≤ maxDelta, witness forced

/** Layer 1 verbatim oracle row: canonical vs frozen retired expression. */
export interface OracleRow<Args extends unknown[] = unknown[]> {
  id: string;
  canonical: (...args: Args) => unknown;
  retired: (...args: Args) => unknown;
  corpus: readonly Args[];
  mode: EquivalenceMode;
}

/**
 * Layer 3 anchor row scope.
 * - 'code' (default): comment-only lines excluded before counting
 * - 'source': every line, comments included (preserves the retired tests'
 *   whole-file `src.match(/…/g)` / `expect(src).not.toMatch(…)` semantics)
 */
export type AnchorScope = 'code' | 'source';

/** Layer 3 source anchor row: line-based occurrence counting / bans. */
export type AnchorRow =
  | { kind: 'occurs'; id: string; file: string; pattern: RegExp; exactly: number; scope?: AnchorScope }
  | { kind: 'occurs-at-least'; id: string; file: string; pattern: RegExp; atLeast: number; scope?: AnchorScope }
  | { kind: 'ban'; id: string; file: string; pattern: RegExp; scope?: AnchorScope };

/** Anything describeSingleSource accepts. */
export type SingleSourceRow<Args extends unknown[] = unknown[]> = OracleRow<Args> | AnchorRow;

/**
 * Generics-erased row: one family mixes corpus arities (grid-packing has
 * 1-arg and 4-arg oracles), so the runner's row list is heterogeneous.
 */
export type AnySingleSourceRow = SingleSourceRow<any>;

/** Options for describeSingleSource. */
export interface HarnessOptions {
  /**
   * Pinned enumeration — every row as `family:rowId:expectations`, joined
   * by '\n' (D6). Generated as an extra it; corpus shrink / row delete /
   * ban delete flip it RED. The pin literal lives next to the rows.
   */
  fingerprint?: string;
}

// ---------------------------------------------------------------------------
// Fail-loud validation (EDGE-001, REQ-402) — factory (declaration time) and
// describeSingleSource (double defense, D5).
// ---------------------------------------------------------------------------

function isFinitePositive(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function assertId(id: string, where: string): void {
  if (typeof id !== 'string' || id.trim() === '') {
    throw new Error(`[single-source-harness] ${where}: row id must be a non-empty string (got ${JSON.stringify(id)})`);
  }
  if (id.includes('\n')) {
    throw new Error(`[single-source-harness] ${where}: row id must be single-line (got ${JSON.stringify(id)})`);
  }
}

function assertLinePattern(pattern: RegExp, where: string): void {
  if (!(pattern instanceof RegExp)) {
    throw new Error(`[single-source-harness] ${where}: pattern must be a RegExp (got ${typeof pattern})`);
  }
  // REQ-402 line-based: a match must never REQUIRE a newline in the subject.
  // `\n` OUTSIDE a character class does (multi-line match); inside one
  // (`[^\n()]`) it is the line-idiom for "anything but newline" and stays
  // legal — so strip character classes before checking.
  const outsideClasses = pattern.source.replace(/\[(?:[^\]\\]|\\.)*\]/g, '');
  if (outsideClasses.includes('\n') || outsideClasses.includes('\\n')) {
    throw new Error(`[single-source-harness] ${where}: pattern must be line-based (REQ-402) — source contains a newline (literal or \\n escape) outside a character class`);
  }
  if (/[gy]/.test(pattern.flags)) {
    throw new Error(`[single-source-harness] ${where}: pattern must not carry stateful flags (got /${pattern.source}/${pattern.flags}) — .test() would skip matches`);
  }
}

/** Validate an oracle row; throws with the row id in the message. */
export function validateOracleRow(row: OracleRow): void {
  assertId(row.id, `oracle row '${row.id}'`);
  if (typeof row.canonical !== 'function' || typeof row.retired !== 'function') {
    throw new Error(`[single-source-harness] oracle row '${row.id}': canonical and retired must be functions`);
  }
  if (!Array.isArray(row.corpus) || row.corpus.length === 0) {
    throw new Error(`[single-source-harness] oracle row '${row.id}': corpus must be a non-empty array (EDGE-001 — an empty corpus pins nothing)`);
  }
  if (row.mode.kind === 'delta' && !isFinitePositive(row.mode.maxDelta)) {
    throw new Error(`[single-source-harness] oracle row '${row.id}': delta mode requires a finite maxDelta > 0 (got ${JSON.stringify(row.mode.maxDelta)})`);
  }
}

/** Validate an anchor row; throws with the row id in the message. */
export function validateAnchorRow(row: AnchorRow): void {
  const label = `anchor row '${row.id}'`;
  assertId(row.id, label);
  if (typeof row.file !== 'string' || row.file.trim() === '') {
    throw new Error(`[single-source-harness] ${label}: file must be a non-empty repo-relative path`);
  }
  if (row.scope !== undefined && row.scope !== 'code' && row.scope !== 'source') {
    throw new Error(`[single-source-harness] ${label}: unknown scope ${JSON.stringify(row.scope)} ('code' | 'source')`);
  }
  assertLinePattern(row.pattern, label);
  if (row.kind === 'occurs' && (!Number.isInteger(row.exactly) || row.exactly < 0)) {
    throw new Error(`[single-source-harness] ${label}: occurs requires an integer exactly ≥ 0 (got ${JSON.stringify(row.exactly)})`);
  }
  if (row.kind === 'occurs-at-least' && (!Number.isInteger(row.atLeast) || row.atLeast < 1)) {
    throw new Error(`[single-source-harness] ${label}: occurs-at-least requires an integer atLeast ≥ 1 (got ${JSON.stringify(row.atLeast)})`);
  }
  if (row.kind !== 'occurs' && row.kind !== 'occurs-at-least' && row.kind !== 'ban') {
    throw new Error(`[single-source-harness] ${label}: unknown anchor kind ${JSON.stringify((row as { kind?: string }).kind)}`);
  }
}

/** Oracle row factory — validates at declaration (fail-loud). */
export function oracleRow<Args extends unknown[]>(row: OracleRow<Args>): OracleRow<Args> {
  validateOracleRow(row);
  return row;
}

/** Anchor row factory — validates at declaration (fail-loud). */
export function anchorRow(row: AnchorRow): AnchorRow {
  validateAnchorRow(row);
  return row;
}

// ---------------------------------------------------------------------------
// Shared helpers.
// ---------------------------------------------------------------------------

/** Code lines of a repo-relative file (comment-only lines excluded). */
export function codeLines(rel: string): string[] {
  return readSource(rel).split('\n').filter((line) => !isCommentLine(line));
}

function anchorLines(row: AnchorRow): string[] {
  return row.scope === 'source' ? readSource(row.file).split('\n') : codeLines(row.file);
}

/**
 * The analytic expectation count of a row (D6):
 *   oracle(object-is) = corpus.length
 *   oracle(delta)     = corpus.length + 1  (the witness)
 *   anchor(any)       = 1
 */
export function countExpectations(row: AnySingleSourceRow): number {
  if ('corpus' in row) {
    return row.corpus.length + (row.mode.kind === 'delta' ? 1 : 0);
  }
  return 1;
}

/** Fingerprint kind tag for a row (FingerprintEntry.kind). */
export function fingerprintKind(row: AnySingleSourceRow): string {
  return 'corpus' in row ? `oracle-${row.mode.kind}` : `anchor-${row.kind}`;
}

// ---------------------------------------------------------------------------
// Row runners — the generated it bodies, exported so the harness unit test
// can assert the RED paths directly (vacuum witness, mismatch, wrong count).
// ---------------------------------------------------------------------------

/**
 * Layer 1 runner. Object-is rows assert the identity once per corpus case
 * (every case is load-bearing — a divergence REDs the row). Delta rows
 * assert ONLY the divergences (|canonical − retired| ≤ maxDelta) plus the
 * mandatory `deltas > 0` witness that proves the bound is exercised and not
 * vacuous (EDGE-101) — the retired tests' assert-on-mismatch semantics.
 * A tautological `expect(Object.is(…)).toBe(true)` on the MATCHING branch
 * (round 51's first cut, kept for a uniform per-case count) cost ~850k
 * no-op expectations on grid-packing's stamp corpora and broke REQ-403
 * (+35% over the retired suite — measured 2026-08-18, 3 alternating pairs);
 * countExpectations keeps counting corpus+1 as the ENUMERATION unit (the
 * fingerprint pin), independent of how many cases physically diverge.
 */
export function runOracleRow(row: OracleRow): void {
  validateOracleRow(row);
  if (row.mode.kind === 'object-is') {
    for (const args of row.corpus) {
      expect(Object.is(row.canonical(...args), row.retired(...args))).toBe(true);
    }
    return;
  }
  const maxDelta = row.mode.maxDelta;
  let deltas = 0;
  for (const args of row.corpus) {
    const got = row.canonical(...args);
    const legacy = row.retired(...args);
    if (!Object.is(got, legacy)) {
      deltas++;
      expect(Math.abs((got as unknown as number) - (legacy as unknown as number))).toBeLessThanOrEqual(maxDelta);
    }
  }
  expect(deltas).toBeGreaterThan(0); // witness — a never-diverging delta row is RED
}

/** Layer 3 runner: line-based count vs the row's pin (1 expectation). */
export function runAnchorRow(row: AnchorRow): void {
  validateAnchorRow(row);
  const count = anchorLines(row).filter((line) => row.pattern.test(line)).length;
  switch (row.kind) {
    case 'occurs':
      expect(count).toBe(row.exactly);
      return;
    case 'occurs-at-least':
      expect(count).toBeGreaterThanOrEqual(row.atLeast);
      return;
    case 'ban':
      expect(count).toBe(0);
      return;
  }
}

// ---------------------------------------------------------------------------
// The describe generator (REQ-001).
// ---------------------------------------------------------------------------

/**
 * Generate the mechanical layer-1/3 describe for one family. Layer 2
 * semantic pins stay handwritten in the per-family test (D1).
 */
export function describeSingleSource(
  family: string,
  rows: readonly AnySingleSourceRow[],
  options: HarnessOptions = {},
): void {
  if (typeof family !== 'string' || family.trim() === '') {
    throw new Error('[single-source-harness] family must be a non-empty string');
  }
  if (rows.length === 0) {
    throw new Error(`[single-source-harness] family '${family}': rows must be non-empty (an empty row list guards nothing)`);
  }
  const seen = new Set<string>();
  for (const row of rows) {
    const label = `'${family}' row '${row.id}'`;
    if ('corpus' in row) {
      validateOracleRow(row);
    } else {
      validateAnchorRow(row);
    }
    if (seen.has(row.id)) {
      throw new Error(`[single-source-harness] ${label}: duplicate row id (fingerprint keys on it)`);
    }
    seen.add(row.id);
  }

  describe(`${family} — single-source harness (layer 1/3)`, () => {
    for (const row of rows) {
      if ('corpus' in row) {
        const oracleRow_ = row;
        it(`${row.id} [${fingerprintKind(row)}]`, () => runOracleRow(oracleRow_));
      } else {
        const anchorRow_ = row;
        it(`${row.id} [${fingerprintKind(row)}]`, () => runAnchorRow(anchorRow_));
      }
    }
    if (options.fingerprint !== undefined) {
      it('fingerprint enumeration (corpus shrink / row delete flips this)', () => {
        expect(
          rows.map((row) => `${family}:${row.id}:${countExpectations(row)}`).join('\n'),
        ).toBe(options.fingerprint);
      });
    }
  });
}
