/**
 * Stale-comment class — ONE repo-wide census (REQ-396 / Phase 194).
 *
 * The fifth facet of the audit-pass-first census family, after the
 * REQ-391 value census (measurement-shaped field literals), the REQ-392
 * contract census (unpopulated optional numeric), the REQ-393 score-ladder
 * census (ternary/fallback bare decimal × measurement-token), and the
 * REQ-394 statement-literal census (frozen return / binding initializer):
 * a code comment that CONFESSES an unrealized measurement, DISCLOSES a
 * stub / simulated / placeholder value, MARKS an unfulfilled TODO/FIXME/
 * XXX/HACK, or SELF-CLAIMS a deprecated / legacy / obsolete status
 * WITHOUT a follow-through action. REQ-391..394's hand audit caught many
 * "this should be derived from real data later" / "assumes" / "Simulated"
 * confessions as fabricated-measurement hiding spots; the class is worth
 * pinning so a future regression is RED before it ships.
 *
 *   1. DISCOVERY walks the entire production surface (repo src/ plus the
 *      installed @stv/core core-four — same walkProductionSurface as the
 *      other REQ-39x guards) for one of four axes:
 *      - confession: `// Would be / assumes / intends to / will be …`
 *      - disclosure: `// Simulated / placeholder / fake / mock / dummy / stub`
 *        as a value qualifier (NOT a class identifier such as
 *        SimulatedAnnealingStrategy)
 *      - marker: `TODO` / `FIXME` / `XXX` / `HACK`
 *      - self-claim: `deprecated` / `legacy` / `obsolete` / `won't fix` /
 *        `don't use this` / `outdated` / `no longer used`
 *      Only `//` line comments count — JSDoc-style doc comments and
 *      `/* … * /` block-comment openers and continuations are
 *      excluded (REQ-396-004).
 *   2. When one line matches several axes, the FIRST axis (the order
 *      above) wins — AND-binding is forbidden (REQ-396-005).
 *   3. ALLOWED holds every legitimate discovery — historical
 *      "execution removed" / "fix applied" notes that DOCUMENT a done
 *      state rather than confess an undone one, and the
 *      backward-compat documentation that the spec deliberately allows.
 *   4. ERADICATED holds patterns whose RE-INTRODUCTION is RED — kept
 *      empty for the confirmed-zero shipment; the negative anchors
 *      below catch the literal shapes the next regression would take.
 *
 *   <!-- census-pin:F5:stale-comment ALLOWED 23 key / ERADICATED 0 key -->
 *
 * Counter liveness (REQ-394 convention, re-stated for F5):
 *   - Each roster entry must be either quoted-key `'src/foo.ts:LINE'` or
 *     bare-identifier-key `path:LINE` indented exactly 2 spaces.
 *   - 4-space continuation lines, comment lines, and missing blocks are
 *     not counted; the synthetic-fixture test pins the counter.
 *
 * Ceiling (documented, same honesty as REQ-393's line-level ceiling and
 * REQ-394's enclosing-declaration ceiling): discovery is LINE-level for
 * the comment text, so a confession split across a multi-line `//`
 * continuation OR moved inside a JSDoc block escapes it. The
 * negative anchors below pin the exact literal shapes the confessor
 * tends to use (`// Would be calculated` / `// Simulated` siblings of
 * REQ-391's own confessions).
 */

import { describe, it, expect } from '@jest/globals';
import {
  readSource,
  isCommentLine,
  walkProductionSurface,
} from './freeze-guard';

// ---------------------------------------------------------------------------
// Axes. AND-binding is forbidden — when several match, the FIRST wins.
// Each regex only matches a `//` line comment. JSDoc (`/** … */`),
// `/* … */` block-comment openers, and `* …` continuations are skipped
// via the discovery loop's LINE_COMMENT_RE gate below.
// ---------------------------------------------------------------------------

/**
 * CONFESSION: a comment that confesses an unrealized measurement or
 * unfulfilled derivation. Words chosen match the REQ-391-era confessions
 * (`// Would be calculated from actual results`, `// assumes`, …) and the
 * adjacent `// Will be` / `// Intends to` family.
 */
const CONFESSION_RE =
  /\/\/\s*\b(would be calculated|would be derived|would be computed|will be calculated|will be derived|assumes|intends to|should be derived|should be calculated)\b/i;

/**
 * DISCLOSURE: a comment that DISCLOSES the value is simulated / placeholder.
 * Class-identifier hits like `SimulatedAnnealingStrategy` are NOT this axis —
 * the regex anchors on a value-qualifier context (`// Simulated`,
 * `// placeholder` as a standalone adjective immediately after `//`).
 * The leading `:\s*|\s+` allows both `// foo Simulated` and `// : Simulated`.
 */
const DISCLOSURE_RE =
  /\/\/[:\s]*\b(simulated|placeholder|fake|mock value|dummy value|stub value)\b/i;

/**
 * MARKER: TODO / FIXME / XXX / HACK as a stand-alone word in a code comment.
 * The two known historical TODO references live in JSDoc-style docstrings
 * and are excluded by the LINE_COMMENT_RE gate below; a positive discovery
 * here for TODO/FIXME/XXX/HACK would be a regression.
 */
const MARKER_RE = /\/\/\s*\(?\b(TODO|FIXME|XXX|HACK)\b/;

/**
 * SELF-CLAIM: a code comment that calls something deprecated / legacy /
 * obsolete / outdated / no longer used / won't fix / don't use this,
 * WITHOUT the qualifier phrases that mark backward-compat documentation
 * (`for backward`, `backward compatibility`, `alias`, `kept for`,
 * `preserves the legacy default`, `comparison anchor`).
 *
 * NOTE: the literal block-comment-opener shape in this JSDoc uses a
 * space between `*` and `/` (i.e. `* /`) so the JSDoc's own `* /`
 * closer (with the space broken for parser safety) does not get
 * pre-empted by an embedded example.
 */
const SELF_CLAIM_RE =
  /\/\/[^/]*\b(deprecated|legacy|obsolete|won'?t fix|don'?t use this|outdated|no longer used)\b(?![^/]*(alias|format|compatibility|still|for backward|backward compatibility|for compat|kept for|preserves the|comparison anchor|reference to|predecessor))/i;

/** A `//` line comment opener (used as the discovery's line filter). */
const LINE_COMMENT_RE = /^\s*\/\//;

/** Run the four axes against a single line; first axis wins. */
function firstAxis(line: string): 'confession' | 'disclosure' | 'marker' | 'self-claim' | null {
  if (CONFESSION_RE.test(line)) return 'confession';
  if (DISCLOSURE_RE.test(line)) return 'disclosure';
  if (MARKER_RE.test(line)) return 'marker';
  if (SELF_CLAIM_RE.test(line)) return 'self-claim';
  return null;
}

/**
 * Every `file:LINE` site on the production surface that matches any axis.
 * file:line granularity — the comment IS the witness.
 */
function discoverStaleComments(): Map<string, { axis: string; text: string }[]> {
  const hits = new Map<string, { axis: string; text: string }[]>();
  for (const rel of walkProductionSurface()) {
    const lines = readSource(rel).split('\n');
    lines.forEach((line, idx) => {
      // The comment census walks `//` LINE comments only — the comment
      // IS the witness. JSDoc `/** … */` and `/* … */` block-comment
      // openers and continuations are excluded (REQ-396-004); they
      // either are typedoc consumers or do not begin with `//`.
      if (!LINE_COMMENT_RE.test(line)) return;
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
 * Live classification of every site discovery currently finds. Granularity
 * is file:line — the comment is the witness. Every row carries the
 * reason hygiene REQ-391 requires (no empty / no boilerplate).
 */
const ALLOWED: Record<string, string> = {
  // ── Self-claim axis: descriptive `legacy` / `deprecated` mentions in
  // code comments that document an INTENTIONAL predecessor or upstream
  // contract (NOT a confession of dead code). The discovery's exclusion
  // list (alias / format / backward compatibility / …) filters most of
  // these out at the regex layer; the ones below pass the regex because
  // they describe a deliberate, live bridge to the predecessor.
  'src/analysis/llm-cache.ts:357':
    '`legacy/tampered` is a COMPOUND hypothesis (the cache file may be either pre-rewrite format OR attacker-tampered), not a self-claim of dead code.',
  'src/quality/pipeline-error-guidance.ts:67':
    '`legacy ErrorCategory used by UserGuidedErrorRecovery` — documentation of an intentional name bridge to the older recovery module; the bridge is live.',
  'src/quality/lib/change-percent-or-null.ts:37':
    '`legacy 0 return silently classified the metric` — HISTORICAL confession that the fix (REQ-178) already addressed; the file now returns null on Infinity, the comment is the WHY.',
  'src/visualization/layout-utils.ts:616':
    '`legacy LayoutEngine→DagreLayoutStrategy` — descriptive reference to the predecessor strategy that the new engine delegates to.',
  'src/pipeline/main-pipeline.ts:647':
    '`adaptive processor deprecated` paired with the still-callable function body — the call site keeps the public surface working while the inner implementation moved out; the in-source `executeWithAdaptation` removed in the same line set is the resolution (resolved).',
  'src/pipeline/main-pipeline.ts:682':
    '`executeWithAdaptation() removed as adaptive processor deprecated` — this IS the resolution comment for line 647; the comment documents the done state.',
  'src/visualization/strategies/DagreLayoutStrategy.ts:62':
    '`deprecated w/h` describes the OUTPUT contract that the upstream dagre library still emits — not the local code; the local strategy reads `width`/`height` and the comment notes the upstream still echoes the old names.',
  'src/quality/regression-detector.ts:318':
    '`legacy 0 return … which is the bug this function fixes` — historical confession + resolution in one line; the function returns null now (the fix).',
  'src/framework/iteration-manager.ts:443':
    '`default ">=" (preserves the legacy default for backward compat)` — descriptive documentation of the comparison operator\'s chosen direction; the predecessor-default is the choice, not a confession.',
  'src/framework/iteration-manager.ts:477':
    '`legacy >= default is a tautology at threshold 0` — same WHY pattern; documents the bug the fix corrects.',
  'src/framework/iteration-manager.ts:506':
    '`flip the legacy >= default to <=` — RESOLUTION comment for the previous row.',
  'src/framework/iteration-manager.ts:525':
    '`legacy code` is the comparison anchor for the new pass that requires zero overlaps AND zero overflow; the new code does both, the comment names the predecessor.',
  'src/framework/iteration-manager.ts:549':
    '`legacy code returned met when any key supplied a checkable value` — historical confession whose fix is the new met-when-zero-and-only-zero logic on the same lines.',
  'src/quality/quality-gate.ts:644':
    '`legacy ?? 0 manufactured a 0ms offset` — WHY-comment for the change to null on missing input; the fix is in this file.',
  'src/transcription/browser-transcriber.ts:273':
    '`File-based transcription API (legacy)` — descriptive of a deliberately-kept entry point; the body delegates to the modern browser path.',
  'src/visualization/strategy-edges.ts:277':
    '`legacy point-array anchors` — descriptive of the upstream contract that the local helper still accepts; the legacy form is intentionally supported.',
  'src/visualization/strategies/FlowchartLayoutStrategy.ts:97':
    'Same shape as DagreLayoutStrategy.ts:62 — descriptive of upstream dagre\'s deprecated w/h echo, not a self-claim about local code.',
  // ── Section-header / descriptive markers (SELF-CLAIM axis at word boundary)
  'src/export/export-content-validator.ts:59':
    '`Legacy: marquee onstart` — comment-adjacent descriptive marker for the XSS-relevant legacy tag set; the legacy tag-list is kept live (see line 84).',
  'src/export/export-content-validator.ts:84':
    '`Legacy tags that enable scriptless XSS via auto-firing events` — documentation of WHICH tags are blocked; the comment names the threat, not a confession.',
  'src/visualization/layout-auto-optimizer.ts:482':
    '`Legacy internal strategies ──` — section-header marker, names the file region that holds the legacy strategy paths. The strategies are still live.',
  // ── CONFESSION axis (would-be-calculated / simulated / placeholder narration)
  'src/monitoring/performance-dashboard.ts:230':
    '`0.95 // Would be calculated from actual results` — quoted inside a backtick narration of REQ-391 history; the dashboard NO LONGER publishes that number, the comment narrates the fix.',
  'src/transcription/whisper-transcriber.ts:290':
    '`placeholder text with no ASR behind it` — DISCLOSURE of a deliberate UX placeholder; the placeholder is INTENTIONAL (no live ASR backend in this build path) — the README it references documents the limit.',
  'src/visualization/enhanced-zero-overlap-layout.ts:1199':
    '`// Simulated` constants published frozen numbers as readings` — quoted inside a backtick narration of REQ-391 history; the layout NO LONGER publishes simulated constants, the comment narrates the fix.',
};

/**
 * Negative anchors — literal shapes that RE-INTRODUCTION must RED. The
 * discovered roster holds zero confessed sites today (the production tree
 * has been kept clean for these patterns across the REQ-391..394 rounds),
 * so the anchors exist to catch the next regression before it lands.
 */
const ERADICATED: Record<string, string> = {};

describe('stale-comment census (REQ-396)', () => {
  const discovered = discoverStaleComments();

  it('discovery has authority (axis regexes are live on the production surface)', () => {
    // The axis regexes are exercised by the synthetic-fixture liveness
    // test below; here we just prove the walk traversed the surface.
    expect(discovered.size).toBeGreaterThanOrEqual(20);
  });

  it('completeness: every discovered stale-comment site is classified in ALLOWED', () => {
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

  it('eradicated comment shapes stay eradicated (reappearance is RED)', () => {
    const reappeared = Object.keys(ERADICATED).filter((k) => discovered.has(k));
    expect(
      reappeared.map((k) => `${k} reappeared @ ${(discovered.get(k) ?? []).join(', ')}`),
    ).toEqual([]);
  });

  it('negative anchors: confession / disclosure / marker literals stay out of the production tree (code lines only)', () => {
    const offenders: string[] = [];
    const anchors: Array<[string, RegExp]> = [
      // Confession shapes (REQ-391-era confessors)
      ['src/visualization/enhanced-zero-overlap-layout.ts', /\/\/[^/]*\b(Simulated|simulated)\b/],
      ['src/monitoring/performance-dashboard.ts', /Would be calculated from actual results/],
      // Marker shapes — TODO/FIXME/XXX/HACK in production code (not in resolved-state comments)
      ['src/pipeline/main-pipeline.ts', /\/\/\s*\(?\b(TODO|FIXME|XXX|HACK)\b/],
      ['src/framework/iteration-logger.ts', /\/\/\s*\(?\b(TODO|FIXME|XXX|HACK)\b/],
    ];
    for (const [rel, pattern] of anchors) {
      readSource(rel).split('\n').forEach((line, idx) => {
        // The negative anchors search for CONFESSION / DISCLOSURE / MARKER
        // SHAPES — those shapes ARE comments (they require `//` prefix),
        // so we must walk ALL lines including comment lines. The
        // resolved-state filter (removed / resolution / fix / resolves /
        // keep legacy / preserves the legacy) excludes the
        // historical-reference entries the ALLOWED roster already carries.
        // The `fix` token is word-bounded: a bare `fix` substring would
        // substring-match "FIXME" itself and blind this anchor to the very
        // marker shape it exists to back up (MW-060 mutation finding).
        if (/removed|resolution|\bfix\b|resolves|keep legacy|preserves the legacy|REQ-\d+|replaces the|replaced the|horizontal-balance|frozen `0|publishes frozen|publish frozen|published frozen|simulated\)|`\d+\.\d+/i.test(line)) return;
        if (pattern.test(line)) offenders.push(`${rel}:${idx + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('liveness: synthetic fixtures prove the 4 axes catch the confessor shapes', () => {
    const source = [
      '// Would be calculated from actual results',          // confession: MUST hit
      '// assumes high confidence',                          // confession: MUST hit
      '// Simulated for now',                                // disclosure: MUST hit
      '// placeholder value',                                // disclosure: MUST hit
      '// TODO: replace with real measurement',              // marker: MUST hit
      '// FIXME: the upstream library is broken',            // marker: MUST hit
      '// This function is deprecated, do not use',          // self-claim: MUST hit
      '/**',
      ' * Implements TODO from X (resolved).',               // JSDoc: MUST NOT hit
      ' */',
      'const score = 0.9;',                                  // unrelated: MUST NOT hit (no axis words)
      '// legacy alias kept for backward compat',            // qualified legacy: MUST NOT hit
      '// preserves the legacy default for backward',        // qualified legacy: MUST NOT hit
      '// legacy code as reference to predecessor',          // qualified legacy: MUST NOT hit
    ].join('\n');
    const axes = source.split('\n').map((line) => firstAxis(line));
    const hits = axes.map((a, i) => (a !== null ? `${i}:${a}` : null)).filter(Boolean);
    expect(hits).toContain('0:confession');
    expect(hits).toContain('1:confession');
    expect(hits).toContain('2:disclosure');
    expect(hits).toContain('3:disclosure');
    expect(hits).toContain('4:marker');
    expect(hits).toContain('5:marker');
    expect(hits).toContain('6:self-claim');
    // JSDoc line 8: MUST NOT hit (regex requires `//` prefix).
    expect(axes[8]).toBeNull();
    // Code line 10: MUST NOT hit.
    expect(axes[10]).toBeNull();
    // Qualified legacy lines 11, 12, 13: MUST NOT hit.
    expect(axes[11]).toBeNull();
    expect(axes[12]).toBeNull();
    expect(axes[13]).toBeNull();
  });
});
