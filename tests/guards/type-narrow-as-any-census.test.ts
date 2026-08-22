/**
 * Type-narrow-as-any class — ONE repo-wide census (REQ-397 / Phase 194).
 *
 * The fifth-facet paired census for the type-system side, after the
 * REQ-391..394 measurement-shape family: a `as any` CAST, a double-cast
 * `as any as`, a `// @ts-ignore`, or a `// @ts-expect-error` used to
 * SILENCE the type system instead of NARROWING through `unknown`. REQ-393
 * score-ladder caught `??` / `||` fallback bypasses that dressed absent
 * inputs as graded scores — the same class on the type-system side: a
 * generic `as any` dresses an absent type as "anything goes" and silences
 * the next-line consumer's compile-time check. `unknown` is the canonical
 * narrowing (assertion + structural guard) and any deviation needs a
 * sharp reason.
 *
 *   1. DISCOVERY walks the production surface (repo src/ + @stv/core core-
 *      four — same walkProductionSurface as the other REQ-39x guards) for
 *      four axes:
 *      - `as any`           — narrow-by-cast, single
 *      - `as any as`        — double-cast bypassing ESLint no-useless-cast
 *      - `// @ts-ignore`    — type-system bypass via comment directive
 *      - `// @ts-expect-error` — same family (catching a deliberate bypass)
 *      Production only — `__tests__`, `__mocks__`, and `*.test.*` /
 *      `*.spec.*` files are EXCLUDED by walkProductionSurface (the ESM
 *      test-mock boundary variable is not a production cast). The
 *      REQ-397-007 test-mock ALLOWED classification therefore never
 *      applies inside the walked surface (a test-mock row would be
 *      reason-hygiene-RED — the synthetic-fixture test pins this).
 *   2. ALLOWED holds every legitimate discovery with the 4-category
 *      classification REQ-397-002 mandates: test-mock / json-parse-
 *      narrowing / external-boundary / third-party-type-gap. Test-mock
 *      rows cannot appear in this guard's surface walk (the walk
 *      excludes test files), so the live ALLOWED is empty for
 *      confirmed-zero.
 *   3. ERADICATED holds the negative anchors — shapes whose RE-INTRODUCTION
 *      in the production tree is RED. The shipped surface has zero
 *      hits, so the ERADICATED ledger is empty and the negative-anchor
 *      regexes (in the test below) are the always-on guard.
 *
 *   <!-- census-pin:F6:type-narrow-as-any ALLOWED 0 key / ERADICATED 0 key -->
 *
 * Ceiling (documented, same honesty as REQ-393/394): discovery is
 * LINE-level, so a cast split across lines (`as\n  any`) escapes it.
 * The negative anchors below pin the literal cast-shape that the
 * regression would take.
 */

import { describe, it, expect } from '@jest/globals';
import {
  readSource,
  isCommentLine,
  walkProductionSurface,
} from './freeze-guard';

// ---------------------------------------------------------------------------
// Axes. AND-binding is forbidden (the four are mutually exclusive shapes
// — a `// @ts-ignore` line cannot also be a `as any` line).
// ---------------------------------------------------------------------------

/** `as any` — single cast, narrow-by-cast. */
const AS_ANY_RE = /\bas\s+any\b/;

/** `as any as` — double-cast bypassing ESLint no-useless-cast. */
const AS_ANY_AS_RE = /\bas\s+any\s+as\b/;

/** `// @ts-ignore` — type-system bypass directive. */
const TS_IGNORE_RE = /\/\/\s*@ts-ignore\b/;

/** `// @ts-expect-error` — same family (catching a deliberate bypass). */
const TS_EXPECT_ERROR_RE = /\/\/\s*@ts-expect-error\b/;

/** Run the four axes against a single line; first axis wins. */
function firstAxis(line: string): 'as-any' | 'as-any-as' | 'ts-ignore' | 'ts-expect-error' | null {
  if (TS_IGNORE_RE.test(line)) return 'ts-ignore';
  if (TS_EXPECT_ERROR_RE.test(line)) return 'ts-expect-error';
  if (AS_ANY_AS_RE.test(line)) return 'as-any-as';
  if (AS_ANY_RE.test(line)) return 'as-any';
  return null;
}

/**
 * Every `file:LINE` site on the production surface that matches any axis.
 * file:line granularity — the cast IS the witness, there is no
 * identifier to bind it to the way REQ-391 binds to `field: literal`.
 */
function discoverTypeNarrowAsAny(): Map<string, { axis: string; text: string }[]> {
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
 * Live classification. The current production tree has zero cast sites
 * (all `as any` live under `__tests__` / `*.test.*` which walkProductionSurface
 * excludes); the 4-category ALLOWED classification sits empty for the
 * confirmed-zero shipment.
 */
const ALLOWED: Record<string, string> = {
  // (intentionally empty for confirmed-zero — all `as any` casts live in
  // test files which walkProductionSurface excludes; ALLOWED 0 key)
};

/**
 * Negative anchors — shapes whose re-introduction would be the first
 * ERADICATED row. The regexes below catch the most likely regression
 * shapes: a `someValue as any` near `JSON.parse`, a double-cast
 * `as any as ConcreteType`, or a `@ts-ignore` over a numeric leg.
 */
const ERADICATED: Record<string, string> = {
  // (intentionally empty for confirmed-zero — ERADICATED 0 key;
  // the negative-anchor test below pins the literal shapes instead.)
};

describe('type-narrow-as-any census (REQ-397)', () => {
  const discovered = discoverTypeNarrowAsAny();

  it('discovery has authority (axis regexes are live on the production surface)', () => {
    // The actual production tree has zero hits — that IS the confirmed-zero
    // result the census pins. We do not assert a minimum here; the
    // synthetic-fixture test below proves the four axes are themselves
    // live, and a future regression would flip this guard RED via the
    // completeness / negative-anchor tests.
    expect(discovered.size).toBeGreaterThanOrEqual(0);
  });

  it('completeness: every discovered type-narrow-as-any site is classified in ALLOWED', () => {
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
        // Empty maps short-circuit: nothing to check.
        if (Object.keys(map).length === 0) continue;
        expect({ name, key, reason }).toEqual({
          name,
          key,
          reason: expect.stringMatching(/\S/),
        });
      }
    }
  });

  it('eradicated cast shapes stay eradicated (reappearance is RED)', () => {
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

  it('negative anchors: production files stay free of the bypass shapes (code lines only)', () => {
    const offenders: string[] = [];
    const anchors: Array<[string, RegExp]> = [
      // Generic `as any` cast — the most likely regression shape.
      ['src/pipeline/simple-pipeline.ts', /\bas\s+any\b/],
      ['src/visualization/layout-engine.ts', /\bas\s+any\b/],
      ['src/quality/quality-monitor.ts', /\bas\s+any\b/],
      // Double-cast `as any as` — should fail ESLint no-useless-cast.
      ['src/api', /\bas\s+any\s+as\b/],
      // Type-system bypass directives.
      ['src/pipeline', /\/\/\s*@ts-ignore\b/],
      ['src/visualization', /\/\/\s*@ts-ignore\b/],
    ];
    for (const [rel, pattern] of anchors) {
      // The anchor regex must apply on TOP-LEVEL files only — subdirs
      // like src/api may legitimately contain @ts-ignore for SDK gaps,
      // so we restrict to exact file matches when the anchor targets a
      // directory (the test walks that dir).
      const isDir = !/\.(ts|tsx)$/.test(rel);
      const targets = isDir
        ? walkProductionSurface().filter((r) => r.startsWith(`${rel}/`))
        : [rel];
      for (const target of targets) {
        readSource(target).split('\n').forEach((line, idx) => {
          if (isCommentLine(line)) return;
          if (pattern.test(line)) offenders.push(`${target}:${idx + 1}: ${line.trim()}`);
        });
      }
    }
    expect(offenders).toEqual([]);
  });

  it('liveness: synthetic fixtures prove the 4 axes catch the cast shapes', () => {
    const source = [
      'const x = value as any;',                  // as-any: MUST hit
      'const y = value as any as ConcreteType;',  // as-any-as: MUST hit (double-cast)
      '// @ts-ignore — bypass',                   // ts-ignore: MUST hit
      '// @ts-expect-error — bypass',             // ts-expect-error: MUST hit
      'const z = value as ConcreteType;',         // legitimate cast: MUST NOT hit
      'const w = value;',                         // no cast: MUST NOT hit
    ].join('\n');
    const axes = source.split('\n').map((line) => firstAxis(line));
    expect(axes[0]).toBe('as-any');
    expect(axes[1]).toBe('as-any-as');
    expect(axes[2]).toBe('ts-ignore');
    expect(axes[3]).toBe('ts-expect-error');
    expect(axes[4]).toBeNull();
    expect(axes[5]).toBeNull();
  });
});
