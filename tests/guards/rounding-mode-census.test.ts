/**
 * Rounding-mode class — ONE repo-wide census (REQ-404 / Phase 205).
 *
 * The thirteenth family of the audit-pass-first census series, after the
 * REQ-391 value census, the REQ-392 contract census, the REQ-393
 * score-ladder census, the REQ-394 statement-literal census, the
 * REQ-396/397 comment/cast facets, the (parallel lineage) REQ-398..401
 * suppression / randomness / env / coercion facets, and the REQ-403
 * boundary-operator census: the SAME normalized expression rounded with
 * DIFFERENT Math modes (round vs floor vs ceil) at different sites.
 *
 * Why the mode choice is load-bearing and not style — this is the OUTPUT
 * side of the boundary class REQ-403 closed on the COMPARISON side. A
 * strict site and an inclusive site disagree exactly at the threshold;
 * a round site and a ceil site disagree on EVERY non-integer product
 * (`2.04s × 30fps = 61.2` → round 61, ceil 62), by exactly one frame.
 * When two code paths compute "how many frames does this duration span"
 * with different modes, one path truncates content the other keeps —
 * the off-by-one-frame shape, discovered one-off until now, closed here
 * by census (the same steering directive REQ-403 answered).
 *
 * The measured tree carries exactly ONE mixed cluster:
 *
 *   - `duration * fps` → round at animated-scene-renderer.ts (per-scene
 *     Lottie layer frame count — NEAREST-frame semantics is correct for
 *     keyframe timing: fade keyframes sit on the closest frame to their
 *     nominal time, and the monotonicity clamp derives from this count)
 *     vs ceil at enhanced-export-engine.ts + export-worker.ts (whole-
 *     export render frame count — COVERAGE semantics: a FrameData[] sized
 *     by round can silently drop up to half a frame of tail content, so
 *     the render loop must round UP).
 *
 * That split is classified ALLOWED — a same-token coincidence across two
 * genuinely different domains (the `duration` identifier names different
 * quantities: a clamped per-scene value vs the whole-export duration).
 * This is the first census family whose roster ships NON-empty ALLOWED:
 * REQ-403 predicted this shape ("a same-token coincidence across
 * genuinely different domains") but measured none; this facet measures
 * one and must document WHY each leg is legitimate rather than unify it.
 * Unifying would either shift pinned Lottie keyframe contracts toward
 * stretched layers or under-cover the export tail — both regressions
 * dressed as consistency.
 *
 *   1. DISCOVERY walks the production surface (repo src/ + installed
 *      @stv/core core-four — same walkProductionSurface as the other
 *      census guards) for `Math.(round|floor|ceil)(` calls and extracts
 *      the balanced-paren argument WITHIN the line. Comment lines are
 *      skipped (isCommentLine) — a rounding quoted in prose is
 *      documentation, not a decision.
 *   2. Sites cluster on the WHITESPACE-NORMALIZED argument text
 *      (`duration * fps` ≡ `duration  *  fps`). A cluster carrying 2+
 *      distinct modes is a mixed-rounding candidate.
 *   3. ALLOWED holds every site of every judged-legitimate mixed
 *      cluster, each with its domain reason. Any site of an unjudged
 *      NEW mixed cluster is RED until classified or unified.
 *   4. ERADICATED ships EMPTY (confirmed-zero): no mixed cluster was
 *      unified by this facet — the one measured cluster was classified,
 *      not eradicated. A future unification must move the site here.
 *
 *   <!-- census-pin:F13:rounding-mode ALLOWED 3 key / ERADICATED 0 key -->
 *
 * Documented ceilings (same honesty as the sibling censuses):
 *   - the argument must balance within ONE line; a call wrapped across
 *     lines is not discovered (measured: 2 of 231 src calls wrap).
 *   - clustering is TEXTUAL: `fps * duration` and `duration * fps` are
 *     different clusters (operand order is not normalized), and a
 *     renamed variable or a semantically-equal spelling (`durationMs /
 *     1000 * fps`) does not join the cluster it threatens. The census
 *     closes the same-spelling class; cross-spelling drift needs the
 *     single-source canon families.
 *   - non-Math rounding (`x | 0`, `toFixed` + Number, bitwise tricks)
 *     is out of scope — different idioms with their own contracts.
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

/** One discovered rounding call. `inner` is the whitespace-normalized argument. */
export interface RoundSite {
  key: string;
  line: number;
  mode: 'round' | 'floor' | 'ceil';
  inner: string;
  text: string;
}

/** `Math.round(` / `Math.floor(` / `Math.ceil(` call heads. */
const CALL_RE = /Math\.(round|floor|ceil)\(/g;

/**
 * Extract the balanced-paren argument that opens at `openIdx` (the index
 * of the opening paren), WITHOUT crossing the line end. A call whose
 * argument wraps to the next line returns null (documented ceiling).
 */
export function extractBalancedArg(
  line: string,
  openIdx: number,
): { inner: string; end: number } | null {
  let depth = 0;
  for (let i = openIdx; i < line.length; i++) {
    if (line[i] === '(') depth++;
    else if (line[i] === ')') {
      depth--;
      if (depth === 0) {
        return { inner: line.slice(openIdx + 1, i), end: i };
      }
    }
  }
  return null;
}

/** Whitespace-normalized argument: `duration  *  fps` ≡ `duration * fps`. */
export function normalizedInner(inner: string): string {
  return inner.replace(/\s+/g, ' ').trim();
}

/** Extract every in-line rounding site from a file's source. */
export function discoverRoundSites(rel: string, content: string): RoundSite[] {
  const sites: RoundSite[] = [];
  content.split('\n').forEach((line, idx) => {
    if (isCommentLine(line)) return;
    let m: RegExpExecArray | null;
    CALL_RE.lastIndex = 0;
    while ((m = CALL_RE.exec(line)) !== null) {
      const arg = extractBalancedArg(line, m.index + m[0].length - 1);
      if (arg === null) continue;
      sites.push({
        key: `${rel}:${idx + 1}`,
        line: idx + 1,
        mode: m[1] as RoundSite['mode'],
        inner: normalizedInner(arg.inner),
        text: line.trim(),
      });
    }
  });
  return sites;
}

/** Cluster key: the normalized argument itself. */
export function clusterKey(site: RoundSite): string {
  return site.inner;
}

/**
 * Keep only the clusters carrying 2+ distinct modes — the
 * mixed-rounding candidates. Single-mode clusters are consistent and
 * carry no obligation.
 */
export function mixedModeClusters(sites: RoundSite[]): Map<string, RoundSite[]> {
  const clusters = new Map<string, RoundSite[]>();
  for (const s of sites) {
    const k = clusterKey(s);
    const arr = clusters.get(k) ?? [];
    arr.push(s);
    clusters.set(k, arr);
  }
  const mixed = new Map<string, RoundSite[]>();
  for (const [k, arr] of clusters) {
    const modes = new Set(arr.map((s) => s.mode));
    if (modes.size > 1) mixed.set(k, arr);
  }
  return mixed;
}

/**
 * Live classification of mixed-rounding sites. Ships with the ONE
 * measured cluster (`duration * fps`, 3 sites): a legitimate two-domain
 * split — Lottie per-scene keyframe timing (nearest frame) vs whole-
 * export render frame count (coverage). Every discovery hit NOT in this
 * roster is an unjudged NEW mixed cluster — RED until classified or
 * unified.
 */
const ALLOWED: Record<string, string> = {
  'src/export/animated-scene-renderer.ts:198':
    'duration * fps @ round — PER-SCENE Lottie layer frame count. Nearest-frame semantics: fade keyframes sit on the frame closest to their nominal 0.3s marks, and the short-scene monotonicity clamp (Math.floor(totalFrames/2)) derives from this same count. REQ-404 classified-legitimate (whole-export ceil sites below are a different `duration` quantity).',
  'src/export/enhanced-export-engine.ts:596':
    'duration * fps @ ceil — WHOLE-EXPORT render frame count (FrameData[] length). Coverage semantics: a render loop sized by round truncates up to half a frame of tail scene content; ceil never drops the tail. REQ-404 classified-legitimate (the per-scene round site above rounds a different quantity).',
  'src/workers/export-worker.ts:39':
    'duration * fps @ ceil — the worker-side mirror of the enhanced-export-engine render frame count (same whole-export quantity, same coverage semantics); the engine passes its own totalFrames into buildFramesFromWorkerResult, so the two MUST stay the same mode. REQ-404 classified-legitimate.',
};

/**
 * Sites this facet UNIFIED out of a mixed cluster. Ships EMPTY
 * (confirmed-zero): the single measured cluster was classified ALLOWED,
 * not eradicated — a future unification moves the losing site here and
 * its old mode's reappearance becomes RED twice.
 */
const ERADICATED: Record<string, string> = {
  // confirmed-zero (REQ-404-003): no unified site exists. Multi-line +
  // comment so countRosterBlock reads 0 keys without bleeding into the
  // next block (Phase 203 GOTCHA).
};

describe('rounding-mode census (REQ-404)', () => {
  const sites: RoundSite[] = walkProductionSurface().flatMap((rel) =>
    discoverRoundSites(rel, readSource(rel)),
  );
  const mixed = mixedModeClusters(sites);

  it('discovery has authority (the walk traversed the rounding surface)', () => {
    // Floor pins: the measured baseline is 247 rounding sites across
    // 190 clusters (src 229/178 + @stv/core 18/12). A collapse below
    // the floor means the walk (or the extractor) silently rotted, not
    // that the tree got cleaner.
    expect(sites.length).toBeGreaterThanOrEqual(240);
    expect(new Set(sites.map(clusterKey)).size).toBeGreaterThanOrEqual(185);
  });

  it('completeness: every mixed-cluster site is classified in ALLOWED', () => {
    // The roster holds the one judged cluster (3 sites). Any site of a
    // NEW mixed cluster is RED until it is classified or unified.
    const unclassified = [...mixed.values()].flat().filter((s) => !(s.key in ALLOWED));
    expect(
      unclassified.map(
        (s) => `${s.key} [Math.${s.mode}(${s.inner})]: ${s.text}`,
      ),
    ).toEqual([]);
  });

  it('no stale ALLOWED rows (every roster entry is still a live mixed-cluster site)', () => {
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

  it('eradicated shapes stay eradicated (reappearance is RED)', () => {
    // Confirmed-zero today: a future unification moves the losing mode's
    // site here, and its reappearance re-mixes the cluster — RED twice
    // (completeness + this check) the same way REQ-403 pins its fixed
    // sites.
    const discoveredKeys = new Set(sites.map((s) => s.key));
    const reappeared = Object.keys(ERADICATED).filter((k) => discoveredKeys.has(k));
    expect(
      reappeared.map((k) => `${k} reappeared — the unified site re-mixed its cluster`),
    ).toEqual([]);
  });

  it('negative anchors: the classified sites keep their documented mode', () => {
    const anchors: Array<[string, RegExp]> = [
      // Lottie per-scene count stays round (nearest-frame keyframes).
      [
        'src/export/animated-scene-renderer.ts',
        /const totalFrames = Math\.round\(duration \* fps\);/,
      ],
      // Whole-export render count stays ceil (coverage, never drop the
      // tail frame) — engine and worker MUST agree with each other.
      [
        'src/export/enhanced-export-engine.ts',
        /const totalFrames = Math\.ceil\(duration \* fps\);/,
      ],
      [
        'src/workers/export-worker.ts',
        /const totalFrames = Math\.ceil\(duration \* fps\);/,
      ],
    ];
    const offenders: string[] = [];
    for (const [rel, pattern] of anchors) {
      if (!pattern.test(readSource(rel))) {
        offenders.push(`${rel}: mode anchor ${pattern} no longer matches`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('liveness: synthetic fixtures prove the cluster axis catches the off-by-one-frame shape', () => {
    // (a) A round/ceil pair on the same normalized argument IS a mixed
    //     cluster — even when spelled with different whitespace.
    const sitesA = discoverRoundSites(
      'synthetic/a.ts',
      [
        'const framesA = Math.round(duration * fps);',
        'const framesB = Math.ceil(duration  *  fps);',
      ].join('\n'),
    );
    expect(sitesA.length).toBe(2);
    expect(mixedModeClusters(sitesA).size).toBe(1);

    // (b) Consistent mode across sites is NOT a cluster.
    const consistent = [
      'const a = Math.ceil(x * fps);',
      'const b = Math.ceil(x * fps);',
    ].join('\n');
    expect(mixedModeClusters(discoverRoundSites('synthetic/b.ts', consistent)).size).toBe(0);

    // (c) Operand order is NOT normalized — documented ceiling: the
    //     textual key does not join commuted spellings.
    const commuted = [
      'const a = Math.round(duration * fps);',
      'const b = Math.ceil(fps * duration);',
    ].join('\n');
    expect(mixedModeClusters(discoverRoundSites('synthetic/c.ts', commuted)).size).toBe(0);

    // (d) A three-mode cluster carries all three sites.
    const three = [
      'const a = Math.round(w);',
      'const b = Math.floor(w);',
      'const c = Math.ceil(w);',
    ].join('\n');
    const mixedD = mixedModeClusters(discoverRoundSites('synthetic/d.ts', three));
    expect(mixedD.size).toBe(1);
    expect(mixedD.get('w')?.length).toBe(3);

    // (e) Comment lines and line-wrapped calls are out of scope.
    const oos = [
      '// legacy: Math.round(duration * fps) (documentation, not a decision)',
      'const wrapped = Math.round(',
      '  duration * fps,',
      ');',
    ].join('\n');
    expect(discoverRoundSites('synthetic/e.ts', oos)).toEqual([]);

    // (f) Nested balanced parens inside the argument stay one site with
    //     the full argument as the cluster key.
    const nested = discoverRoundSites(
      'synthetic/f.ts',
      'const v = Math.round(Math.max(1, ratio) * scale);',
    );
    expect(nested).toHaveLength(1);
    expect(nested[0]?.inner).toBe('Math.max(1, ratio) * scale');
  });
});
