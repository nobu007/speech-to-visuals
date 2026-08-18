/**
 * @jest-environment node
 */
/**
 * single-source-harness.test.ts — harness unit test (round 51, TC-001-xx).
 *
 * Covers the acceptance criteria of specs/guard-harness-fold-census:
 *   - TC-001-01: each row kind generates a green it (the self-test describe
 *     at the bottom of this file);
 *   - TC-001-E01 / EDGE-001: invalid rows fail LOUD at declaration — every
 *     malformed shape throws with the row id in the message;
 *   - TC-001-B01 / EDGE-101: a delta row whose corpus never diverges is RED
 *     (the witness is mandatory — a vacuous bound pins nothing);
 *   - TC-NFR-101-01: reads are import.meta.url anchored (worker cwd moves
 *     do not affect anchor counting);
 *   - D3 scope semantics: 'code' excludes comment-only lines, 'source'
 *     counts them.
 */

import { describe, it, expect } from '@jest/globals';
import { tmpdir } from 'node:os';
import {
  oracleRow,
  anchorRow,
  runOracleRow,
  runAnchorRow,
  countExpectations,
  fingerprintKind,
  codeLines,
  describeSingleSource,
} from '@tests/guards/single-source-harness';

// ---------------------------------------------------------------------------
// Fixture rows (against freeze-guard.ts — a stable sibling file).
// ---------------------------------------------------------------------------

/** readSource's definition line: exactly one CODE line in freeze-guard.ts. */
const READSOURCE_DEF = anchorRow({
  kind: 'occurs',
  id: 'fixture-readsource-defined-once',
  file: 'tests/guards/freeze-guard.ts',
  pattern: /^export function readSource\(/,
  exactly: 1,
});

/** A comment-only line that exists verbatim in freeze-guard.ts — only
 *  visible to the 'source' scope (the 'code' scope must not count it). */
const HEADER_COMMENT = anchorRow({
  kind: 'occurs',
  id: 'fixture-header-comment-source-scope-only',
  file: 'tests/guards/freeze-guard.ts',
  pattern: /Repo root, anchored to THIS file/,
  exactly: 1,
  scope: 'source',
});

const OBJECT_IS_ROW = oracleRow({
  id: 'fixture-sum-object-is',
  canonical: (a: number, b: number) => a + b,
  retired: (a: number, b: number) => a + b,
  corpus: [[1, 2], [0.1, 0.2], [-1, 1], [NaN, 1], [Infinity, -Infinity]] as Array<[number, number]>,
  mode: { kind: 'object-is' },
});

/** (a + b) − 0.5 vs a + (b − 0.5): the round-50 stamp regrouping in miniature
 *  — last-ulp differences EXIST in this corpus (the witness passes). */
const DELTA_ROW = oracleRow({
  id: 'fixture-regroup-delta',
  canonical: (a: number, b: number) => a + b - 0.5,
  retired: (a: number, b: number) => a + (b - 0.5),
  corpus: [[0.1, 0.2], [1, 2], [0.5, 0.5], [3, 7]] as Array<[number, number]>,
  mode: { kind: 'delta', maxDelta: 1e-9 },
});

// ---------------------------------------------------------------------------
// TC-001-E01 / EDGE-001: declaration-time fail-loud.
// ---------------------------------------------------------------------------

describe('single-source-harness — declaration-time validation (EDGE-001)', () => {
  it('oracle: empty id, empty corpus, and delta without a finite bound all throw', () => {
    const canonical = (x: number) => x;
    expect(() =>
      oracleRow({ id: '', canonical, retired: canonical, corpus: [[1]], mode: { kind: 'object-is' } }),
    ).toThrow(/row id must be a non-empty string/);
    expect(() =>
      oracleRow({ id: 'x', canonical, retired: canonical, corpus: [], mode: { kind: 'object-is' } }),
    ).toThrow(/'x'.*corpus must be a non-empty array/);
    expect(() =>
      oracleRow({ id: 'x', canonical, retired: canonical, corpus: [[1]], mode: { kind: 'delta', maxDelta: undefined } }),
    ).toThrow(/'x'.*finite maxDelta > 0/);
    for (const bad of [0, -1, NaN, Infinity, '1e-12']) {
      expect(() =>
        oracleRow({
          id: 'x',
          canonical,
          retired: canonical,
          corpus: [[1]],
          mode: { kind: 'delta', maxDelta: bad as number },
        }),
      ).toThrow(/finite maxDelta > 0/);
    }
  });

  it('oracle: non-function canonical/retired throws with the row id', () => {
    expect(() =>
      oracleRow({
        id: 'notafn',
        canonical: 42 as unknown as (x: number) => number,
        retired: (x: number) => x,
        corpus: [[1]],
        mode: { kind: 'object-is' },
      }),
    ).toThrow(/'notafn'.*must be functions/);
  });

  it('anchor: negative/zero pins, newline patterns, stateful flags, unknown scope all throw', () => {
    const pattern = /delegates/;
    expect(() =>
      anchorRow({ kind: 'occurs', id: 'neg', file: 'src/x.ts', pattern, exactly: -1 }),
    ).toThrow(/'neg'.*exactly ≥ 0/);
    expect(() =>
      anchorRow({ kind: 'occurs-at-least', id: 'zero', file: 'src/x.ts', pattern, atLeast: 0 }),
    ).toThrow(/'zero'.*atLeast ≥ 1/);
    expect(() =>
      anchorRow({ kind: 'ban', id: 'nl', file: 'src/x.ts', pattern: /foo\nbar/ }),
    ).toThrow(/'nl'.*line-based/);
    // …but `[^\n()]` — the line-idiom "anything but newline" INSIDE a
    // character class — never requires a newline to match and stays legal.
    expect(() =>
      anchorRow({ kind: 'occurs', id: 'cc-ok', file: 'src/x.ts', pattern: /Math\.ceil\([^\n()]*\/\s*[^\n()]*\)/, exactly: 1 }),
    ).not.toThrow();
    expect(() =>
      anchorRow({ kind: 'ban', id: 'global', file: 'src/x.ts', pattern: /foo/g }),
    ).toThrow(/'global'.*stateful flags/);
    expect(() =>
      anchorRow({
        kind: 'occurs',
        id: 'scope',
        file: 'src/x.ts',
        pattern,
        exactly: 1,
        scope: 'raw' as 'code',
      }),
    ).toThrow(/'scope'.*unknown scope/);
    expect(() =>
      anchorRow({ kind: 'occurs', id: 'nofile', file: '', pattern, exactly: 1 }),
    ).toThrow(/'nofile'.*non-empty repo-relative/);
  });

  it('describeSingleSource: empty rows and duplicate ids throw', () => {
    expect(() => describeSingleSource('fam', [])).toThrow(/rows must be non-empty/);
    const twice = [
      anchorRow({ kind: 'ban', id: 'dup', file: 'src/x.ts', pattern: /zzz-never/ }),
      anchorRow({ kind: 'ban', id: 'dup', file: 'src/y.ts', pattern: /zzz-never/ }),
    ];
    expect(() => describeSingleSource('fam', twice)).toThrow(/'fam' row 'dup'.*duplicate row id/);
  });

  it('describeSingleSource re-validates raw (non-factory) rows — double defense', () => {
    expect(() =>
      describeSingleSource('fam', [
        { kind: 'occurs', id: 'raw', file: 'src/x.ts', pattern: /x/, exactly: -5 },
      ]),
    ).toThrow(/'raw'.*exactly ≥ 0/);
  });
});

// ---------------------------------------------------------------------------
// TC-001-B01 / EDGE-101: oracle RED paths (via the exported runners).
// ---------------------------------------------------------------------------

describe('single-source-harness — oracle runner RED paths', () => {
  it('TC-001-B01: a delta row whose corpus never diverges is RED (vacuous bound)', () => {
    const vacuous = oracleRow({
      id: 'vacuous',
      canonical: (a: number, b: number) => a + b,
      retired: (a: number, b: number) => a + b,
      corpus: [[1, 2], [3, 4]] as Array<[number, number]>,
      mode: { kind: 'delta', maxDelta: 1e-12 },
    });
    expect(() => runOracleRow(vacuous)).toThrow(/toBeGreaterThan|Expected: > 0/);
  });

  it('object-is mode: a diverging corpus case fails the row (bit equality is enforced)', () => {
    const diverging = oracleRow({
      id: 'diverges',
      canonical: (a: number, b: number) => a + b,
      retired: (a: number, b: number) => a * b,
      corpus: [[2, 3], [1, 2]] as Array<[number, number]>,
      mode: { kind: 'object-is' },
    });
    expect(() => runOracleRow(diverging)).toThrow();
  });

  it('delta mode: a divergence beyond maxDelta fails the row', () => {
    const beyond = oracleRow({
      id: 'beyond',
      canonical: (a: number) => a + 1,
      retired: (a: number) => a + 2,
      corpus: [[0], [10]] as Array<[number]>,
      mode: { kind: 'delta', maxDelta: 0.5 },
    });
    expect(() => runOracleRow(beyond)).toThrow();
  });

  it('delta mode: NaN divergence is not ≤ any bound (contract violations stay RED)', () => {
    const nanCase = oracleRow({
      id: 'nan-divergence',
      canonical: (a: number) => a,
      retired: () => NaN,
      corpus: [[1]] as Array<[number]>,
      mode: { kind: 'delta', maxDelta: 1e9 },
    });
    expect(() => runOracleRow(nanCase)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Anchor counting + scope semantics (D3).
// ---------------------------------------------------------------------------

describe('single-source-harness — anchor runner and scopes', () => {
  it('occurs: counts code lines exactly', () => {
    expect(() => runAnchorRow(READSOURCE_DEF)).not.toThrow();
  });

  it('occurs: a wrong pin fails', () => {
    expect(() =>
      runAnchorRow(
        anchorRow({
          kind: 'occurs',
          id: 'wrong-count',
          file: 'tests/guards/freeze-guard.ts',
          pattern: /^export function readSource\(/,
          exactly: 5,
        }),
      ),
    ).toThrow();
  });

  it("scope 'code' excludes comment-only lines; scope 'source' counts them (D3)", () => {
    // the comment line exists verbatim — 'source' sees it…
    expect(() => runAnchorRow(HEADER_COMMENT)).not.toThrow();
    // …and the default 'code' scope does NOT (count 0 vs exactly 1 → RED).
    expect(() =>
      runAnchorRow(
        anchorRow({
          kind: 'occurs',
          id: 'fixture-header-comment-code-scope-must-not-count',
          file: 'tests/guards/freeze-guard.ts',
          pattern: /Repo root, anchored to THIS file/,
          exactly: 1,
          scope: 'code',
        }),
      ),
    ).toThrow();
  });

  it('ban: a pattern that DOES occur in code fails; a never-occurring one passes', () => {
    expect(() =>
      runAnchorRow(
        anchorRow({ kind: 'ban', id: 'ban-violated', file: 'tests/guards/freeze-guard.ts', pattern: /^export function readSource\(/ }),
      ),
    ).toThrow();
    expect(() =>
      runAnchorRow(
        anchorRow({ kind: 'ban', id: 'ban-clean', file: 'tests/guards/freeze-guard.ts', pattern: /THIS_LITERAL_IS_NOWHERE/ }),
      ),
    ).not.toThrow();
  });

  it('occurs-at-least: passes at/above the floor and fails below it', () => {
    expect(() =>
      runAnchorRow(
        anchorRow({
          kind: 'occurs-at-least',
          id: 'atleast-ok',
          file: 'tests/guards/freeze-guard.ts',
          pattern: /^export function /,
          atLeast: 3,
        }),
      ),
    ).not.toThrow();
    expect(() =>
      runAnchorRow(
        anchorRow({
          kind: 'occurs-at-least',
          id: 'atleast-too-high',
          file: 'tests/guards/freeze-guard.ts',
          pattern: /^export function /,
          atLeast: 100,
        }),
      ),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// D6: analytic expectation counts + fingerprint kinds.
// ---------------------------------------------------------------------------

describe('single-source-harness — countExpectations (D6)', () => {
  it('oracle(object-is) = corpus.length; oracle(delta) = corpus.length + 1; anchor = 1', () => {
    expect(countExpectations(OBJECT_IS_ROW)).toBe(5);
    expect(countExpectations(DELTA_ROW)).toBe(4 + 1); // witness included
    expect(countExpectations(READSOURCE_DEF)).toBe(1);
    expect(fingerprintKind(OBJECT_IS_ROW)).toBe('oracle-object-is');
    expect(fingerprintKind(DELTA_ROW)).toBe('oracle-delta');
    expect(fingerprintKind(READSOURCE_DEF)).toBe('anchor-occurs');
    expect(fingerprintKind(HEADER_COMMENT)).toBe('anchor-occurs');
  });
});

// ---------------------------------------------------------------------------
// Shared codeLines + cwd discipline (NFR-101 / TC-NFR-101-01).
// ---------------------------------------------------------------------------

describe('single-source-harness — codeLines and cwd discipline', () => {
  it('codeLines drops comment-only lines and keeps code (EDGE-002)', () => {
    const lines = codeLines('tests/guards/freeze-guard.ts');
    expect(lines.some((l) => /^\s*(\/\/|\*|\/\*)/.test(l))).toBe(false);
    expect(lines.filter((l) => /^export function readSource\(/.test(l)).length).toBe(1);
  });

  it('TC-NFR-101-01: anchor reads survive a moved worker cwd (import.meta.url anchored)', () => {
    const originalCwd = process.cwd();
    try {
      process.chdir(tmpdir());
      expect(() => runAnchorRow(READSOURCE_DEF)).not.toThrow();
      expect(codeLines('tests/guards/freeze-guard.ts').length).toBeGreaterThan(10);
    } finally {
      process.chdir(originalCwd);
    }
  });
});

// ---------------------------------------------------------------------------
// TC-001-01: the generated describe itself — every row kind green, plus the
// fingerprint it pinning this fixture's enumeration.
// ---------------------------------------------------------------------------

const FIXTURE_ROWS = [OBJECT_IS_ROW, DELTA_ROW, READSOURCE_DEF, HEADER_COMMENT];

describeSingleSource('harness-fixture', FIXTURE_ROWS, {
  fingerprint: [
    'harness-fixture:fixture-sum-object-is:5',
    'harness-fixture:fixture-regroup-delta:5',
    'harness-fixture:fixture-readsource-defined-once:1',
    'harness-fixture:fixture-header-comment-source-scope-only:1',
  ].join('\n'),
});
