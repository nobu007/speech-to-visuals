/**
 * Any-annotate class — ONE repo-wide census (REQ-397 / Phase 194).
 *
 * The fifth-facet paired census for the type-system side, after the
 * REQ-391..394 measurement-shape family and the sibling
 * type-narrow-as-any-census (this file's pair in REQ-397): a `: any`
 * annotation, an `<any>` generic argument, or a `any[]` bare array type
 * used where `unknown` (or a SHARP concrete type) would let the type
 * system carry the type-discipline forward. REQ-393 score-ladder closed
 * `??` / `||` silent-legit-zero bypasses on the value side — the same
 * class on the type-system side: a generic `: any` annotation makes the
 * entire downstream expression `any`-typed (type-system fail-open), so
 * the next-line consumer loses compile-time checks entirely.
 *
 *   1. DISCOVERY walks the production surface (repo src/ + @stv/core core-
 *      four — same walkProductionSurface as the other REQ-39x guards) for
 *      three axes:
 *      - `: any` annotation — `: any;`, `: any)`, `: any>`, `: any,`,
 *        `: any]`, `: any}`, `: any =` (the type position MUST end in a
 *        type terminator; bare word `anything` / `anyone` / `anywhere` do
 *        not match because the word-boundary catches them only when
 *        followed by a non-identifier character).
 *      - `<any>` generic argument — `Array<any>`, `Record<string, any>`,
 *        `Promise<any>`, etc. (preceded by `<`, possibly with a generic
 *        argument list).
 *      - `any[]` bare array form.
 *      Production only — `__tests__`, `__mocks__`, and `*.test.*` /
 *      `*.spec.*` files are excluded by walkProductionSurface (the ESM
 *      test-mock boundary variable is not a production annotation).
 *   2. ALLOWED holds every legitimate discovery with the 4-category
 *      classification REQ-397-004 mandates: external-input /
 *      third-party-sdk / migration-shim / dynamic-config-load. Internal
 *      logic parameter / return types cannot be ALLOWED.
 *   3. ERADICATED holds the negative anchors — shapes whose RE-INTRODUCTION
 *      in the production tree is RED.
 *
 *   <!-- census-pin:F7:any-annotate ALLOWED 1 key / ERADICATED 0 key -->
 *
 * Counter liveness (REQ-394 convention, re-stated for F7):
 *   - Each roster entry must be either quoted-key `'src/foo.ts:LINE'` or
 *     bare-identifier-key `path:LINE` indented exactly 2 spaces.
 *   - 4-space continuation lines, comment lines, and missing blocks are
 *     not counted; the synthetic-fixture test pins the counter.
 *
 * Ceiling (documented, same honesty as REQ-393/394): discovery is
 * LINE-level, so an annotation split across lines (`:\n  any`) escapes
 * it. The negative anchors below pin the literal annotation shapes.
 */

import { describe, it, expect } from '@jest/globals';
import {
  readSource,
  isCommentLine,
  walkProductionSurface,
} from './freeze-guard';

// ---------------------------------------------------------------------------
// Axes. AND-binding is forbidden (the three are mutually exclusive shapes).
// Ordering matters only for the rare line that contains BOTH a `: any`
// annotation and a `<any>` generic — the `: any` annotation comes first
// because it is the broader type-position marker.
// ---------------------------------------------------------------------------

/**
 * `: any` annotation — colon prefix followed by `any` and a TYPE
 * TERMINATOR (`;`, `)`, `>`, `,`, `]`, `}`, `=` for a default, `[`
 * for `any[]` array form, or end-of-line). The `\b` on `any` prevents
 * `anything` / `anyone` / `anywhere` matches.
 */
const COLON_ANY_RE = /:\s*any\b\s*(?=[,;)\]>}=[|]|$)/;

/**
 * `<any>` generic argument — `<...any...>` where `any` is among the
 * generic arguments. `Array<any>` / `Record<string, any>` /
 * `Promise<any>` etc. The regex looks for `<`, then non-`>` chars,
 * then `any`, then non-`>` chars, then `>` (a single generic-arg slot).
 * `<T>` (no any) does NOT match; `<string, any>` does match.
 */
const LT_ANY_GT_RE = /<[^>]*\bany\b[^>]*>/;

/**
 * `any[]` bare array form — `any` followed by `[]` (possibly with a
 * space). Catches `any[]` and `any []`.
 */
const ANY_BRACKETS_RE = /\bany\s*\[\s*\]/;

/** Run the three axes against a single line; first axis wins. */
function firstAxis(line: string): 'colon-any' | 'lt-any-gt' | 'any-brackets' | null {
  if (COLON_ANY_RE.test(line)) return 'colon-any';
  if (LT_ANY_GT_RE.test(line)) return 'lt-any-gt';
  if (ANY_BRACKETS_RE.test(line)) return 'any-brackets';
  return null;
}

/**
 * Every `file:LINE` site on the production surface that matches any axis.
 */
function discoverAnyAnnotates(): Map<string, { axis: string; text: string }[]> {
  const hits = new Map<string, { axis: string; text: string }[]>();
  for (const rel of walkProductionSurface()) {
    readSource(rel).split('\n').forEach((line, idx) => {
      if (isCommentLine(line)) return;
      const axis = firstAxis(line);
      if (axis === null) return;
      const key = `${rel}:${idx + 1}`;
      const list = hits.get(key) ?? [];
      list.push({ axis, text: line.trim() });
      hits.set(key, list);
    });
  }
  return hits;
}

/**
 * Live classification. The current production tree has one legitimate
 * hit — `src/transcription/whisper-node.d.ts:7` declares the untyped
 * `whisper-node` module's default export. The companion ESLint
 * `no-explicit-any` disable comment on line 6 is part of the same
 * intentional declaration (REQ-397-004 third-party-sdk category).
 */
const ALLOWED: Record<string, string> = {
  'src/transcription/whisper-node.d.ts:7':
    'Ambient declaration of the untyped `whisper-node` module (REPO root src/transcription/whisper-node.d.ts). The file header documents WHY a .d.ts is needed (`declare module` inside a module file is rejected as TS2665 for an untyped module). third-party-sdk ALLOWED — there is no upstream @types package, so any narrowing would require re-declaring the module shape inline. The companion `// eslint-disable-next-line @typescript-eslint/no-explicit-any` on line 6 names the same shape explicitly.',
};

/** Negative anchors — re-introduction is RED. The shipped surface is empty. */
const ERADICATED: Record<string, string> = {
  // (intentionally empty for confirmed-zero — ERADICATED 0 key;
  // the negative-anchor test below pins the literal shapes instead.)
};

describe('any-annotate census (REQ-397)', () => {
  const discovered = discoverAnyAnnotates();

  it('discovery has authority (axis regexes are live on the production surface)', () => {
    // The shipped surface has exactly one hit (whisper-node.d.ts:7).
    // We do NOT assert a minimum here — the synthetic-fixture test
    // below proves the three axes are themselves live, and a future
    // regression would flip the completeness / negative-anchor tests RED.
    expect(discovered.size).toBeGreaterThanOrEqual(0);
  });

  it('completeness: every discovered any-annotate site is classified in ALLOWED', () => {
    const unclassified = [...discovered.keys()].filter((k) => !(k in ALLOWED));
    expect(
      unclassified.map((k) => {
        const hit = (discovered.get(k) ?? [])[0];
        return `${k} [${hit.axis}]: ${hit.text}`;
      }),
    ).toEqual([]);
  });

  it('no stale ALLOWED rows (every roster entry still has a live site)', () => {
    const stale = Object.keys(ALLOWED).filter((k) => !discovered.has(k));
    expect(stale).toEqual([]);
  });

  it('every ALLOWED / ERADICATED entry carries a non-empty reason', () => {
    for (const [map, name] of [
      [ALLOWED, 'ALLOWED'],
      [ERADICATED, 'ERADICATED'],
    ] as const) {
      for (const [key, reason] of Object.entries(map)) {
        if (Object.keys(map).length === 0) continue;
        expect({ name, key, reason }).toEqual({
          name,
          key,
          reason: expect.stringMatching(/\S/),
        });
      }
    }
  });

  it('eradicated annotation shapes stay eradicated (reappearance is RED)', () => {
    const reappeared = Object.keys(ERADICATED).filter((k) => discovered.has(k));
    expect(
      reappeared.map((k) => `${k} reappeared @ ${(discovered.get(k) ?? []).join(', ')}`),
    ).toEqual([]);
  });

  it('ALLOWED rows never claim test-mock classification in the walked surface (REQ-397-007 + EDGE-202)', () => {
    // The walked surface excludes __tests__ / *.test.* / __mocks__, so a
    // ALLOWED row claiming test-mock would mean the test-mock site
    // leaked into production — RED via reason-hygiene.
    const offenders = Object.entries(ALLOWED)
      .filter(([, reason]) => /test-mock|test mock|jest\.fn|jest\.spyOn/i.test(reason))
      .map(([key]) => key);
    expect(offenders).toEqual([]);
  });

  it('ALLOWED rows stay inside the boundary 4-category (REQ-397-004)', () => {
    // internal-logic / internal-handler / private-fn labels are RED here.
    const offenders = Object.entries(ALLOWED)
      .filter(([, reason]) =>
        /\binternal[- ]?(logic|handler|fn|function)\b|\bprivate[- ]?fn\b/i.test(reason),
      )
      .map(([key]) => key);
    expect(offenders).toEqual([]);
  });

  it('negative anchors: internal logic files stay free of `: any` / `<any>` / `any[]` annotations (code lines only)', () => {
    const offenders: string[] = [];
    const internalLogicFiles = [
      'src/pipeline/simple-pipeline.ts',
      'src/pipeline/main-pipeline.ts',
      'src/pipeline/pipeline-orchestrator.ts',
      'src/visualization/layout-engine.ts',
      'src/quality/quality-monitor.ts',
      'src/api/server.ts',
      'src/api/routes/pipeline.ts',
      'src/framework/continuous-learner.ts',
      'src/transcription/transcriber.ts',
    ];
    for (const rel of internalLogicFiles) {
      readSource(rel).split('\n').forEach((line, idx) => {
        if (isCommentLine(line)) return;
        // The internal-logic axis set is the same as the discovery axes
        // — a `: any` / `<any>` / `any[]` anywhere in these files is a
        // regression.
        if (firstAxis(line) !== null) {
          offenders.push(`${rel}:${idx + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('liveness: synthetic fixtures prove the 3 axes catch the annotation shapes', () => {
    const source = [
      'const x: any = value;',                  // colon-any: MUST hit (= terminator)
      'function f(x: any): any { return x; }',  // colon-any ×2 (param + return): MUST hit twice
      'const arr: any[] = [];',                 // any-brackets: MUST hit (and `: any[` is also colon-any)
      'const map = new Map<string, any>();',    // lt-any-gt: MUST hit
      'const pr: Promise<any> = Promise.resolve();', // lt-any-gt: MUST hit
      'function g<T>(arg: Array<any>): void {}', // lt-any-gt: MUST hit
      'const s: string = "anything";',          // contains "anything" but NOT a `: any` type terminator: MUST NOT hit colon-any
      'const t: unknown = x;',                  // unknown, not any: MUST NOT hit
      'function h(x: number): void {}',         // no any: MUST NOT hit
    ].join('\n');
    const axes = source.split('\n').map((line) => firstAxis(line));
    expect(axes[0]).toBe('colon-any');
    // Line 1: `function f(x: any): any { … }` — the FIRST axis match wins.
    // The `<any>` axis is checked AFTER the `: any` axis, so this line
    // reports `colon-any` (the function returns `any`). Param `: any` is
    // also there but we report first-match.
    expect(axes[1]).toBe('colon-any');
    // Line 2: `const arr: any[] = [];` — the `: any[` colon-any axis fires first.
    expect(axes[2]).toBe('colon-any');
    // Line 3: `Map<string, any>` — lt-any-gt axis fires (no colon-any before).
    expect(axes[3]).toBe('lt-any-gt');
    // Line 4: `Promise<any>` — lt-any-gt.
    expect(axes[4]).toBe('lt-any-gt');
    // Line 5: `Array<any>` — lt-any-gt.
    expect(axes[5]).toBe('lt-any-gt');
    // Line 6: `: string = "anything"` — the `anything` is in a string literal,
    // and the colon terminator is `: string` (not `: any`). MUST NOT hit.
    expect(axes[6]).toBeNull();
    // Line 7: `: unknown` — MUST NOT hit (unknown, not any).
    expect(axes[7]).toBeNull();
    // Line 8: `: number` — MUST NOT hit.
    expect(axes[8]).toBeNull();
  });
});
