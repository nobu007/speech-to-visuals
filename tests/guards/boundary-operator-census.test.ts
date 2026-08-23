/**
 * Boundary-operator class — ONE repo-wide census (REQ-403 / Phase 203).
 *
 * The twelfth family of the audit-pass-first census series, after the
 * REQ-391 value census, the REQ-392 contract census, the REQ-393
 * score-ladder census, the REQ-394 statement-literal census, the REQ-396/397
 * comment/cast facets, and (parallel lineage) the REQ-398..401 suppression /
 * randomness / env / coercion facets: a decimal threshold compared against
 * the SAME metric with BOTH strict and inclusive operators at different
 * sites — the divergent-operator bug `diagram-detection-constants.ts`
 * already canonized for the 0.6 pair (`DiagramDetector` passed 0.6 via
 * `>=` while `SimplePipeline` failed the SAME 0.6 via `>` / `<=`).
 *
 * Why the operator choice is load-bearing here and not style: a ratio
 * metric (successRate = successes/total) is a single correctly-rounded
 * division, so it EQUALS the threshold exactly whenever
 * threshold × total is an integer (19/20 = 0.95, 4/5 = 0.8, 1/2 = 0.5).
 * At that mathematically-at-threshold input a strict site and an
 * inclusive site disagree — one endpoint reports healthy while the other
 * reports degraded for the same measurement. Steering (Phase 200
 * feedback) asked for this class to be "closed by census rather than by
 * one-off discovery"; the concrete symbols it named (TASK-0357..0359 /
 * z-score / effect-size) are cross-repo phantoms (REQ-402 interview
 * record A4), but the class itself had 3 live clusters in this repo:
 *
 *   - successRate @ 0.95: /health route `>= 0.95` (healthy) vs
 *     health-check-service `> 0.95` (degraded) — two user-visible
 *     endpoints disagreeing at exactly 95% success (19/20).
 *   - successRate @ 0.8 (spelled `0.80` at one site): framework
 *     iteration-manager `>= 0.8` vs health-check-service `> 0.80` —
 *     hidden until literals are canonically normalized (`0.80` ≡ `0.8`).
 *   - confidence @ 0.5 (same file): `goodConfidence > 0.5` vs
 *     highConfidence-types filter `>= 0.5`.
 *
 * All three closed boundary-INCLUSIVE (`>=`), the direction the 0.6 canon
 * already chose ("a detection whose confidence EQUALS this value has met
 * the threshold") and the diagram-detector test suite pins
 * (toBeGreaterThanOrEqual).
 *
 *   1. DISCOVERY walks the production surface (repo src/ + installed
 *      @stv/core core-four — same walkProductionSurface as the other
 *      census guards) for `identifier )? OP DECIMAL` comparisons. Only
 *      DECIMAL literals count: an integer threshold is exactly
 *      representable, so strict-vs-inclusive at an integer boundary is a
 *      different (and already operator-pinned) question. Comment lines
 *      are skipped (isCommentLine) — a quoted gate in prose is
 *      documentation, not a decision.
 *   2. Sites cluster on (identifier, CANONICAL literal, DIRECTION) where
 *      the literal is normalized via Number()->String() (`0.80` and
 *      `0.8` are one threshold) and direction collapses {>,>=} vs {<,<=}.
 *      A cluster carrying BOTH strict and inclusive operators is a
 *      split-interpretation candidate — the 0.6-incident shape.
 *   3. ALLOWED holds every legitimate split (a same-token coincidence
 *      across genuinely different domains). Shipped EMPTY: the tree is
 *      exact-0 after the three eradication fixes — any NEW mixed cluster
 *      is RED until classified or unified.
 *   4. ERADICATED holds the three fixed sites; their strict shapes
 *      reappearing re-splits the cluster and is RED twice (completeness
 *      + eradicated-reappear).
 *
 *   <!-- census-pin:F12:boundary-operator ALLOWED 0 key / ERADICATED 3 key -->
 *
 * Documented ceilings (same honesty as the sibling censuses):
 *   - attribution is the LAST identifier before the operator with at
 *     most closing parens in between (`s.confidence >= 0.5` →
 *     `confidence`; `Math.abs(correlation) > 0.7` → `correlation`). A
 *     complex multi-line LHS, a literal-on-left operand (`0.5 < x`), or
 *     a comparison embedded in a STRING (alert-rules PromQL
 *     `rate(...) > 0.5`) is not discovered — those are DSL/config text,
 *     not a JS decision.
 *   - complementary ladders (`>= 0.8` in the if-leg vs `< 0.8` in the
 *     else-leg) are DIFFERENT directions and never cluster together;
 *     only a same-direction strict/inclusive disagreement is a split.
 */

import { describe, it, expect } from '@jest/globals';
import {
  readSource,
  isCommentLine,
  walkProductionSurface,
} from './freeze-guard';

// ---------------------------------------------------------------------------
// Discovery primitives (pure + exported for the liveness tests).
// ---------------------------------------------------------------------------

/**
 * One discovered comparison. `id` is the trailing identifier of the LHS
 * (at most closing parens between it and the operator), `lit` is the
 * CANONICAL literal spelling (Number()->String()), `rawLit` the as-written
 * one for the normalization liveness test.
 */
export interface CmpSite {
  key: string;
  line: number;
  id: string;
  op: string;
  lit: string;
  rawLit: string;
  text: string;
}

/** `identifier` + closing parens + operator + DECIMAL literal. */
const CMP_RE = /([A-Za-z_$][A-Za-z0-9_$]*)\s*\)*\s*(>=|>|<=|<)\s*(\d+\.\d+)\b/g;

/** Inclusive (`>=`/`<=`) vs strict (`>`/`<`) — the split axis. */
export function strictness(op: string): 'inclusive' | 'strict' {
  return op.endsWith('=') ? 'inclusive' : 'strict';
}

/** Comparison direction: {>,>=} vs {<,<=}. Complementary legs never mix. */
export function direction(op: string): 'GT' | 'LT' {
  return op === '>' || op === '>=' ? 'GT' : 'LT';
}

/** Canonical literal spelling: `0.80` ≡ `0.8` (`String(Number(x))`). */
export function canonicalLiteral(text: string): string {
  return String(Number(text));
}

/**
 * Extract every comparison site from a file's source. Comment lines are
 * skipped — prose quoting a gate shape is documentation, not a decision.
 */
export function discoverCmpSites(rel: string, content: string): CmpSite[] {
  const sites: CmpSite[] = [];
  content.split('\n').forEach((line, idx) => {
    if (isCommentLine(line)) return;
    let m: RegExpExecArray | null;
    CMP_RE.lastIndex = 0;
    while ((m = CMP_RE.exec(line)) !== null) {
      sites.push({
        key: `${rel}:${idx + 1}`,
        line: idx + 1,
        id: m[1],
        op: m[2],
        lit: canonicalLiteral(m[3]),
        rawLit: m[3],
        text: line.trim(),
      });
    }
  });
  return sites;
}

/** Cluster key: metric identifier × canonical literal × direction. */
export function clusterKey(site: CmpSite): string {
  return `${site.id}|${site.lit}|${direction(site.op)}`;
}

/**
 * Keep only the clusters carrying BOTH strict and inclusive operators —
 * the split-interpretation candidates (0.6-incident shape). Single-
 * strictness clusters are consistent and carry no obligation.
 */
export function mixedStrictnessClusters(
  sites: CmpSite[],
): Map<string, CmpSite[]> {
  const clusters = new Map<string, CmpSite[]>();
  for (const s of sites) {
    const k = clusterKey(s);
    const arr = clusters.get(k) ?? [];
    arr.push(s);
    clusters.set(k, arr);
  }
  const mixed = new Map<string, CmpSite[]>();
  for (const [k, arr] of clusters) {
    const kinds = new Set(arr.map((s) => strictness(s.op)));
    if (kinds.size > 1) mixed.set(k, arr);
  }
  return mixed;
}

/**
 * Live classification of split-interpretation sites. Shipped EMPTY
 * (confirmed-zero): the three measured clusters were unified
 * boundary-inclusive, so every discovery hit below is a NEW split the
 * roster has not judged yet — RED until classified or fixed.
 */
const ALLOWED: Record<string, string> = {
  // confirmed-zero (REQ-403-003): no genuinely-different-domain same-token
  // cluster exists. countRosterBlock reads this block shape (multi-line,
  // zero key rows), so the three-way phrase stays "ALLOWED 0 key".
};

/**
 * The three unified sites. Each was the STRICT leg of a measured mixed
 * cluster and flipped inclusive with the facet's fix; re-introducing the
 * strict spelling re-splits its cluster (completeness) AND re-discovers
 * the site (eradicated-reappear) — RED twice.
 */
const ERADICATED: Record<string, string> = {
  'src/monitoring/health-check-service.ts:434':
    'successRate @ 0.95 strict leg — /health route (api/routes/monitoring.ts) already gated `>= 0.95` healthy; exactly-95% (19/20) now reports healthy on BOTH endpoints. Unified inclusive (REQ-403 fix).',
  'src/monitoring/health-check-service.ts:437':
    'successRate @ 0.8 strict leg (spelled `0.80` — hidden from clustering until literal canonicalization) — iteration-manager gates the same threshold `>= 0.8`; exactly-80% (4/5) now takes the degraded leg on both sites. Unified inclusive (REQ-403 fix).',
  'src/analysis/diagram-detector.ts:1037':
    'confidence @ 0.5 strict leg — the same file\'s high-confidence-types filter (line 1116) already gated `>= 0.5`, and the detector test suite pins toBeGreaterThanOrEqual. Unified inclusive (REQ-403 fix).',
};

describe('boundary-operator census (REQ-403)', () => {
  const sites: CmpSite[] = walkProductionSurface().flatMap((rel) =>
    discoverCmpSites(rel, readSource(rel)),
  );
  const mixed = mixedStrictnessClusters(sites);

  it('discovery has authority (the walk traversed the comparison surface)', () => {
    // Floor pins: the measured baseline is 145 comparison sites across
    // 126 clusters. A collapse below the floor means the walk (or the
    // regex) silently rotted, not that the tree got cleaner.
    expect(sites.length).toBeGreaterThanOrEqual(140);
    expect(new Set(sites.map(clusterKey)).size).toBeGreaterThanOrEqual(120);
  });

  it('completeness: the production tree is exact-0 mixed-strictness clusters', () => {
    // ALLOWED ships empty — every discovery hit is an unjudged NEW split.
    const unclassified = [...mixed.values()].flat().filter((s) => !(s.key in ALLOWED));
    expect(
      unclassified.map(
        (s) => `${s.key} [${s.id} ${s.op} ${s.rawLit}]: ${s.text}`,
      ),
    ).toEqual([]);
  });

  it('no stale ALLOWED rows (every roster entry still has a live split site)', () => {
    const live = new Set([...mixed.values()].flat().map((s) => s.key));
    const stale = Object.keys(ALLOWED).filter((k) => !live.has(k));
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

  it('eradicated strict shapes stay eradicated (reappearance is RED)', () => {
    const discoveredKeys = new Set([...mixed.values()].flat().map((s) => s.key));
    const reappeared = Object.keys(ERADICATED).filter((k) => discoveredKeys.has(k));
    expect(
      reappeared.map(
        (k) => `${k} reappeared — the unified-inclusive site re-split its cluster`,
      ),
    ).toEqual([]);
  });

  it('negative anchors: the unified sites keep their inclusive operator', () => {
    const anchors: Array<[string, RegExp]> = [
      // successRate @ 0.95 — both health endpoints inclusive.
      [
        'src/api/routes/monitoring.ts',
        /successRate >= 0\.95 \? 'healthy' : 'degraded'/,
      ],
      [
        'src/monitoring/health-check-service.ts',
        /if \(successRate >= 0\.95 && avgProcessingTime < 60000\)/,
      ],
      // successRate @ 0.8 — both gates inclusive (spelling may differ).
      [
        'src/monitoring/health-check-service.ts',
        /else if \(successRate >= 0\.8\d* && avgProcessingTime < 120000\)/,
      ],
      [
        'src/framework/iteration-manager.ts',
        /\} else if \(successRate >= 0\.8\)/,
      ],
      // confidence @ 0.5 — both detector gates inclusive.
      [
        'src/analysis/diagram-detector.ts',
        /goodConfidence: metrics\.confidence >= 0\.5/,
      ],
      [
        'src/analysis/diagram-detector.ts',
        /allScores\.filter\(s => s\.confidence >= 0\.5\)/,
      ],
    ];
    const offenders: string[] = [];
    for (const [rel, pattern] of anchors) {
      if (!pattern.test(readSource(rel))) {
        offenders.push(`${rel}: inclusive anchor ${pattern} no longer matches`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('liveness: synthetic fixtures prove the cluster axes catch the 0.6-incident shape', () => {
    // (a) A same-direction strict/inclusive pair IS a split — even when
    //     the literals are spelled differently (`0.80` vs `0.8`).
    const sitesA = discoverCmpSites(
      'synthetic/a.ts',
      [
        'if (successRate > 0.80) {', // strict, spelled 0.80
        'const ok = successRate >= 0.8;', // inclusive, spelled 0.8
      ].join('\n'),
    );
    expect(sitesA.length).toBe(2);
    expect(mixedStrictnessClusters(sitesA).size).toBe(1);

    // (b) Complementary ladder legs are DIFFERENT directions — the
    //     canonical if/else shape is not a split.
    const ladder = ['if (x >= 0.8) {', '} else if (x < 0.8) {'].join('\n');
    const sitesB = discoverCmpSites('synthetic/b.ts', ladder);
    expect(mixedStrictnessClusters(sitesB).size).toBe(0);

    // (c) Different metrics sharing a threshold are separate clusters.
    const distinct = ['if (confidence >= 0.8) {', 'if (precision > 0.8) {'].join('\n');
    const sitesC = discoverCmpSites('synthetic/c.ts', distinct);
    expect(mixedStrictnessClusters(sitesC).size).toBe(0);

    // (d) Closing-paren attribution: Math.abs(...) > 0.7 attributes to
    //     the inner identifier, so two Math.abs gates on the same metric
    //     still cluster.
    const paren = [
      'if (Math.abs(correlation) > 0.7) {',
      'const strong = Math.abs(correlation) >= 0.7;',
    ].join('\n');
    const sitesD = discoverCmpSites('synthetic/d.ts', paren);
    expect(mixedStrictnessClusters(sitesD).size).toBe(1);

    // (e) Integer thresholds and comment lines are out of scope.
    const oos = [
      '// legacy gate: successRate > 0.95 (documentation, not a decision)',
      'if (queueDepth > 100) {',
    ].join('\n');
    expect(discoverCmpSites('synthetic/e.ts', oos)).toEqual([]);
  });
});
