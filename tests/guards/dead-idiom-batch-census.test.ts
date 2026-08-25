/**
 * Dead-idiom batch census — SEVERAL confirmed-zero idiom classes pinned by
 * ONE lightweight guard (REQ-410 / Phase 217 / census family 19).
 *
 * make-run steering directive this guard is shaped by (2026-08-25, after
 * REQ-405): families 15/16 each shipped zero violations yet cost a 6-file
 * spec + 2 phases + an MW entry — so from family 19 on, the DISCOVERY SWEEP
 * runs BEFORE the requirements are written, classes that measure clean are
 * bundled into one batch guard (adding a kind is the whole cost), and full
 * per-family investment goes only to classes with measured violations.
 *
 * The 2026-08-25 discovery sweep walked the production surface (repo src/ +
 * installed @stv/core core-four — same walkProductionSurface as every other
 * census guard; 331 files) and measured SEVEN candidate classes:
 *
 *   kind                          measured  verdict
 *   ----------------------------- --------- -------------------------------
 *   coercing-isnan                2 (src)   VIOLATION — unified in-commit:
 *                                             global isNaN → Number.isNaN
 *                                             (srt-parser.ts:98 guarded by
 *                                             parseInt-always-number,
 *                                             quality-monitor.ts:637 guarded
 *                                             by the REQ-375 typeof filter;
 *                                             both keep identical semantics,
 *                                             the coercing spelling is gone)
 *   coercing-isfinite             1 (core)  ALLOWED — @stv/core
 *                                             formatDuration(seconds: number)
 *                                             typed param; this repo cannot
 *                                             edit the package in-tree
 *   unguarded-for-in              1 (src)   ALLOWED — body opens with the
 *                                             own-key filter `if (key in …)`
 *   unawaited-async-forEach       0         exact-0 pin
 *   legacy-indexof-membership     0         exact-0 pin
 *   loose-equality-nonnullish     0         exact-0 pin
 *   bare-hasOwnProperty           0         exact-0 pin
 *
 * Why these axes are load-bearing and not style:
 *   - global isNaN/isFinite COERCE (`isFinite('12') === true`), so a future
 *     refactor that widens the operand type flips the verdict silently —
 *     this repo's recurring NaN-routing incidents are exactly that shape.
 *   - `.forEach(async …)` drops the returned promise: rejections become
 *     unhandled, ordering is lost, and the caller's `await` covers nothing.
 *   - `for (k in o)` walks the prototype chain; an unfiltered body reads
 *     inherited keys as data.
 *   - `x.indexOf(y) !== -1` and bare `x == y` (outside the deliberate
 *     `== null` nullish idiom) are the legacy spellings of `.includes` /
 *     `===`; nothing on the surface uses them, so the pin is pure ratchet.
 *   - `x.hasOwnProperty(k)` crashes on null-prototype objects;
 *     `Object.prototype.hasOwnProperty.call` / `Object.hasOwn` are the safe
 *     forms. Zero sites today.
 *
 * Structure (the "add a kind" contract): every class is ONE entry in
 * IDIOM_KINDS — a per-line detector, plus an optional contextual
 * `guardedBy` rule for classes whose incident shape is contextual (for-in).
 * A hit is an offender unless (a) it carries its guard where the kind
 * requires one AND (b) its `rel:line` key is judged in the ALLOWED roster.
 * ALLOWED / ERADICATED are the census-artifact three-way blocks (REQ-395):
 * the requirements prose must declare `ALLOWED 2 key` / `ERADICATED 2 key`.
 *
 *   <!-- census-pin:F19:dead-idiom-batch ALLOWED 2 key / ERADICATED 2 key -->
 *
 * Documented ceilings (same honesty as the sibling censuses):
 *   - line-level detection sees one line at a time: a `==` split across a
 *     line break, or an `indexOf` comparison wrapped to the next line,
 *     escapes the detector. No such site exists (measured with the exact
 *     detector below); multi-line idioms would need an AST pass.
 *   - a line that contains BOTH a nonnullish loose equality and a `== null`
 *     comparison is skipped whole (the nullish exclusion is line-granular).
 *   - the for-in `guardedBy` rule scans the body by indent (≤12 lines) for
 *     an own-key filter — a guard spelled later in the body than that, or
 *     via a helper call the regex does not know, reads as unguarded (safe
 *     direction: it lands in the offender list, forcing a judgment).
 *   - kind regexes are line text: string literals containing the idiom
 *     (e.g. a message `'a == b'`) can false-positive; any such hit simply
 *     demands an ALLOWED judgment, which is the census working as designed.
 */

import { describe, it, expect } from '@jest/globals';
import {
  readSource,
  isCommentLine,
  walkProductionSurface,
} from './freeze-guard';

// ---------------------------------------------------------------------------
// Kind registry — adding a class = adding one entry here (steering contract).
// ---------------------------------------------------------------------------

/** One dead-idiom class: where the incident shape lives, line by line. */
export interface IdiomKind {
  /** Stable id, used in offender messages and the spec's kind table. */
  id: string;
  /** Non-comment lines matching this are hits (regex or predicate). */
  detect: RegExp | ((line: string) => boolean);
  /**
   * Context rule for classes whose acceptability is contextual: when
   * present, a hit must satisfy it (e.g. a for-in body must open with an
   * own-key filter). A rostered hit that fails this rule is STILL an
   * offender — ALLOWED never overrides a missing guard.
   */
  guardedBy?: (lines: string[], hitIdx: number) => boolean;
}

/** `==` / `!=` loose equality that is NOT the deliberate nullish idiom. */
const LOOSE_EQ_RE = /(?<![=!<>+\-*/&|^%])(==|!=)(?![=])/;

function isNonNullishLooseEquality(line: string): boolean {
  if (!LOOSE_EQ_RE.test(line)) return false;
  // `x == null` / `null != y` is the repo-wide nullish idiom — excluded.
  return !/(==|!=)\s*null\b|null\s*(==|!=)/.test(line);
}

/**
 * A for-in hit is acceptable only when its body opens with an own-key
 * filter (`if (k in target)`, `.hasOwnProperty(`, `Object.hasOwn(`) before
 * the body closes at the for-line's indent (scan capped at 12 lines).
 */
function forInBodyHasOwnKeyFilter(lines: string[], hitIdx: number): boolean {
  const indent = lines[hitIdx].match(/^\s*/)?.[0].length ?? 0;
  const ownKeyFilter =
    /if\s*\(\s*\w+\s+in\s|\.hasOwnProperty\(|Object\.hasOwn\(/;
  // A one-line body (`for (…) { … }`) is checked on the hit line itself.
  if (ownKeyFilter.test(lines[hitIdx].slice(lines[hitIdx].indexOf('{')))) {
    return true;
  }
  for (let j = hitIdx + 1; j < lines.length && j <= hitIdx + 12; j++) {
    const lineIndent = lines[j].match(/^\s*/)?.[0].length ?? 0;
    if (lineIndent <= indent && /^\s*\}/.test(lines[j])) break;
    if (ownKeyFilter.test(lines[j])) return true;
  }
  return false;
}

export const IDIOM_KINDS: readonly IdiomKind[] = [
  // global isNaN coerces; Number.isNaN does not. (Number.isNaN excluded by
  // the lookbehind, as is any myIsNaN identifier.)
  { id: 'coercing-isnan', detect: /(?<![.\w$])isNaN\(/ },
  { id: 'coercing-isfinite', detect: /(?<![.\w$])isFinite\(/ },
  // `.forEach(async …)` drops the promise: rejections go unhandled.
  { id: 'unawaited-async-foreach', detect: /\.forEach\(\s*async\b/ },
  // `.indexOf(x) !== -1`-family: the legacy spelling of `.includes`.
  {
    id: 'legacy-indexof-membership',
    detect: /\.indexOf\([^)]*\)\s*(?:!==|===|!=|==|>=|<=|>|<)\s*-?\d/,
  },
  // `a == b` outside the `== null` nullish idiom.
  { id: 'loose-equality-nonnullish', detect: isNonNullishLooseEquality },
  // Direct `.hasOwnProperty(` crashes on null-prototype objects.
  { id: 'bare-hasOwnProperty', detect: /\.hasOwnProperty\(/ },
  // Unfiltered for-in reads prototype-chain keys as data.
  {
    id: 'unguarded-for-in',
    detect: /for\s*\(\s*(?:const|let|var)\s+\w+\s+in\s/,
    guardedBy: forInBodyHasOwnKeyFilter,
  },
];

/** One discovered idiom site, classified against its kind's context rule. */
export interface IdiomSite {
  /** `${rel}:${line}` — the roster key form. */
  key: string;
  kind: string;
  rel: string;
  line: number;
  /** False when the kind's guardedBy rule is not satisfied. */
  guarded: boolean;
  text: string;
}

/** Extract every kind's hits from one file (comment lines skipped). */
export function discoverIdiomSites(rel: string, content: string): IdiomSite[] {
  const lines = content.split('\n');
  const sites: IdiomSite[] = [];
  lines.forEach((line, idx) => {
    if (isCommentLine(line)) return;
    for (const kind of IDIOM_KINDS) {
      const hit =
        typeof kind.detect === 'function' ? kind.detect(line) : kind.detect.test(line);
      if (!hit) continue;
      sites.push({
        key: `${rel}:${idx + 1}`,
        kind: kind.id,
        rel,
        line: idx + 1,
        guarded: kind.guardedBy === undefined || kind.guardedBy(lines, idx),
        text: line.trim(),
      });
    }
  });
  return sites;
}

// ---------------------------------------------------------------------------
// The judged rosters (census-artifact three-way blocks, REQ-395).
// ---------------------------------------------------------------------------

/**
 * Sites whose idiom is judged acceptable — every key needs a reason, and
 * every key must stay a live hit (stale rows are RED).
 */
const ALLOWED: Record<string, string> = {
  // [coercing-isfinite] core package surface — formatDuration's param is
  // the typed `seconds: number`, so global coercion is unreachable from
  // typed callers; the file lives in @stv/core and this repo cannot fix
  // the spelling in-tree (core's own CI owns the follow-up).
  'src/utils/audio-duration.ts:47':
    'CORE-TYPED — @stv/core formatDuration(seconds: number); typed param makes the coercing verdict unreachable from typed callers, package-owned file.',
  // [unguarded-for-in] the body opens with the own-key filter.
  'src/optimization/smart-parameter-tuner.ts:332':
    'GUARDED — body opens with `if (key in result)`, so prototype-chain keys never reach the blend.',
};

/**
 * The unified sites (the measured violations this family fixed in-commit).
 * Reappearance of either spelling is RED.
 */
const ERADICATED: Record<string, string> = {
  'src/remotion/srt-parser.ts:98':
    'unified 2026-08-25 (REQ-410) — global isNaN → Number.isNaN; the parseInt(…, 10) result is always a number so semantics are identical, the coercing spelling is gone.',
  'src/pipeline/quality-monitor.ts:637':
    'unified 2026-08-25 (REQ-410) — !isNaN → !Number.isNaN inside the REQ-375 typeof-number filter (kept: Number.isNaN(null) is false too, so the typeof guard stays load-bearing).',
};

describe('dead-idiom batch census (REQ-410)', () => {
  const sites: IdiomSite[] = walkProductionSurface().flatMap((rel) =>
    discoverIdiomSites(rel, readSource(rel)),
  );
  const liveKeys = new Set(sites.map((s) => s.key));

  it('discovery has authority (the walk traversed the production surface)', () => {
    // Floor pins against the 2026-08-25 baseline: 331 swept files, with
    // the two rostered classes still represented (1 core isFinite + 1
    // for-in). A collapse means the walk rotted, not that the tree got
    // cleaner. The five exact-0 kinds have no floor — zero is their pin.
    expect(walkProductionSurface().length).toBeGreaterThanOrEqual(300);
    expect(sites.filter((s) => s.kind === 'coercing-isfinite').length).toBeGreaterThanOrEqual(1);
    expect(sites.filter((s) => s.kind === 'unguarded-for-in').length).toBeGreaterThanOrEqual(1);
    // The kind registry is the steering contract — shrinking it is RED.
    expect(IDIOM_KINDS.map((k) => k.id)).toEqual([
      'coercing-isnan',
      'coercing-isfinite',
      'unawaited-async-foreach',
      'legacy-indexof-membership',
      'loose-equality-nonnullish',
      'bare-hasOwnProperty',
      'unguarded-for-in',
    ]);
  });

  it('completeness: every hit is either guard-carried and ALLOWED, or RED', () => {
    const offenders = sites.filter((s) => !(s.key in ALLOWED));
    expect(
      offenders.map((s) => `${s.key} [${s.kind}]: ${s.text}`),
    ).toEqual([]);
  });

  it('a roster key never overrides a missing context guard (for-in rule)', () => {
    // ALLOWED is a judgment about a SITE AS WRITTEN — deleting the
    // own-key filter must put the rostered site back in the offender
    // list, so every hit of a guard-carrying kind must carry its guard
    // whether rostered or not.
    const unguarded = sites.filter((s) => !s.guarded);
    expect(
      unguarded.map((s) => `${s.key} [${s.kind}] missing own-key guard: ${s.text}`),
    ).toEqual([]);
  });

  it('no stale ALLOWED rows (every roster entry is still a live hit)', () => {
    const stale = Object.keys(ALLOWED).filter((k) => !liveKeys.has(k));
    expect(stale).toEqual([]);
  });

  it('eradicated spellings stay eradicated (reappearance is RED)', () => {
    const reappeared = Object.keys(ERADICATED).filter((k) => liveKeys.has(k));
    expect(
      reappeared.map((k) => `${k} reappeared — the unified site regressed`),
    ).toEqual([]);
  });

  it('every ALLOWED / ERADICATED entry carries a non-empty reason', () => {
    for (const [map, name] of [
      [ALLOWED, 'ALLOWED'],
      [ERADICATED, 'ERADICATED'],
    ] as const) {
      for (const [key, reason] of Object.entries(map)) {
        expect({ name, key, reason }).toEqual({
          name,
          key,
          reason: expect.stringMatching(/\S/),
        });
      }
    }
  });

  it('negative anchors: the unified and rostered spellings stay pinned', () => {
    const anchors: Array<[string, RegExp]> = [
      // The two unified isNaN sites keep the Number.isNaN spelling.
      ['src/remotion/srt-parser.ts', /if \(Number\.isNaN\(index\)\) \{/],
      [
        'src/pipeline/quality-monitor.ts',
        /typeof v === 'number' && !Number\.isNaN\(v\)/,
      ],
      // The rostered for-in keeps its own-key filter (deleting it must
      // flip the guard-carried rule above, this anchor documents why).
      [
        'src/optimization/smart-parameter-tuner.ts',
        /for \(const key in historical\) \{\s*\n\s*if \(key in result\) \{/,
      ],
      // The rostered core isFinite keeps the judged spelling (a core-side
      // flip to Number.isFinite is fine — it only makes this row stale,
      // which the stale-row test catches).
      ['src/utils/audio-duration.ts', /!isFinite\(seconds\)/],
    ];
    for (const [file, pattern] of anchors) {
      expect(`${file}: ${readSource(file)}`).toMatch(pattern);
    }
  });

  it('liveness: synthetic fixtures prove every kind detects its incident shape', () => {
    // (a) coercing predicates: globals flagged, Number./member forms not.
    expect(discoverIdiomSites('f.ts', 'if (isNaN(x)) return;')).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'const ok = Number.isNaN(x); const m = myIsNaN(x);'),
    ).toEqual([]);

    // (b) unawaited-async-foreach flagged; sync callback and for-await not.
    expect(
      discoverIdiomSites('f.ts', 'items.forEach(async (x) => fetch(x));'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'items.forEach((x) => save(x));'),
    ).toEqual([]);

    // (c) legacy indexOf membership flagged in both polarities (`!== -1`
    // found, `< 0` not-found); includes and lastIndexOf are not the class.
    expect(
      discoverIdiomSites('f.ts', 'if (xs.indexOf(y) !== -1) run();'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'if (xs.indexOf(y) < 0) skip();'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites('f.ts', 'if (xs.includes(y)) run(); if (xs.lastIndexOf(y) >= 0) run();'),
    ).toEqual([]);

    // (d) nonnullish loose equality flagged; `== null` and strict forms not.
    expect(discoverIdiomSites('f.ts', 'if (a == b) run();')).toHaveLength(1);
    expect(
      discoverIdiomSites(
        'f.ts',
        "if (a == null) run(); if (a === b) run(); if (a !== b) run(); if (a <= b) run(); if (a != null) run();",
      ),
    ).toEqual([]);

    // (e) bare hasOwnProperty flagged; the safe call/hasOwn forms not.
    expect(
      discoverIdiomSites('f.ts', 'if (obj.hasOwnProperty(k)) run();'),
    ).toHaveLength(1);
    expect(
      discoverIdiomSites(
        'f.ts',
        'Object.prototype.hasOwnProperty.call(o, k); Object.hasOwn(o, k);',
      ),
    ).toEqual([]);

    // (f) for-in: unguarded body is an offender, own-key-filtered body is
    // a guarded hit — the roster judgment is what makes the latter ALLOWED.
    const unguarded = discoverIdiomSites(
      'f.ts',
      ['for (const key in cfg) {', '  total += cfg[key];', '}'].join('\n'),
    );
    expect(unguarded).toHaveLength(1);
    expect(unguarded[0].guarded).toBe(false);
    const guarded = discoverIdiomSites(
      'f.ts',
      ['for (const key in cfg) {', '  if (key in known) {', '    total += cfg[key];', '  }', '}'].join('\n'),
    );
    expect(guarded).toHaveLength(1);
    expect(guarded[0].guarded).toBe(true);

    // (g) comment lines are documentation, not decisions.
    expect(discoverIdiomSites('f.ts', '// if (isNaN(x)) return;')).toEqual([]);

    // (h) a hit on a file NOT in the roster is an offender by shape — the
    // completeness rule keys off the same discovery used here.
    const rogue = discoverIdiomSites('f.ts', 'const bad = !isFinite(v);');
    expect(rogue).toHaveLength(1);
    expect(rogue[0].kind).toBe('coercing-isfinite');
  });
});
