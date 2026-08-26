/**
 * Fallback-default class — ONE repo-wide census (REQ-405 / Phase 207).
 *
 * The fourteenth family of the audit-pass-first census series, after the
 * REQ-391 value census, the REQ-392 contract census, the REQ-393
 * score-ladder census, the REQ-394 statement-literal census, the
 * REQ-396/397 comment/cast facets, the (parallel lineage) REQ-398..401
 * suppression / randomness / env / coercion facets, the REQ-403
 * boundary-operator census, and the REQ-404 rounding-mode census: the
 * SAME field defaulted to DIFFERENT literal values at different sites —
 * the default-value interpretation split.
 *
 * Why the literal choice is load-bearing and not style: a fallback fires
 * exactly when the field is missing/falsy — the input the caller did NOT
 * spell out. At that input two sites with different literals hand
 * downstream code two different values, so every consumer of "the
 * default" silently forks by call path. The three live incidents this
 * facet measured and unified:
 *
 *   - `durationMs` — the render path (actual-video-renderer composition
 *     sizing) substituted an ad-hoc `|| 10000` while scene-duration-
 *     limits.ts documents DEFAULT_SCENE_DURATION_MS = 5000 as THE
 *     substitute value under a three-path agreement invariant
 *     (orchestrator == smoke == video-generator, guarded by
 *     scene-duration-limits-single-source.test.ts). The renderer was a
 *     fourth path the invariant never named, inventing DOUBLE the
 *     canonical substitute. Fixed by importing the canonical constant.
 *   - `gateResult.reason` — inside ONE function of pipeline-orchestrator,
 *     a missing reason surfaced as 'Quality gate failed' in the progress
 *     event but 'unknown' in the thrown QualityGateError (whose message
 *     already says "Quality gate ... failed", making the first default
 *     redundant). Unified on 'unknown', the repo's established
 *     missing-label marker.
 *   - `decoded.role` — the HTTP auth middleware defaulted the SAME JWT
 *     claim to 'authenticated' (verified token ⇒ authenticated tier)
 *     while the WebSocket handler stored ''. Unified on
 *     'authenticated'; the socket-side field has no other consumer.
 *
 *   1. DISCOVERY walks the production surface (repo src/ + installed
 *      @stv/core core-four — same walkProductionSurface as the other
 *      census guards) for `chain (?? | ||) LITERAL` sites. Only bare
 *      NUMBER / STRING / BOOLEAN literals count: a fallback onto a named
 *      constant (`|| DEFAULT_SCENE_DURATION_MS`) is the CANONICAL form
 *      this census wants, and re-measuring it would re-litigate the
 *      single-source families' jurisdiction. Comment lines are skipped
 *      (isCommentLine) — a default quoted in prose is documentation,
 *      not a decision.
 *   2. Sites cluster on the dotted-path chain IMMEDIATELY before the
 *      operator (`config.nodeSeparation || 60` → `config.nodeSeparation`;
 *      `frames[0]?.width ?? 1920` → `width`, the `[0]` breaks the
 *      chain). A cluster carrying 2+ distinct CANONICAL literals
 *      (`60.0` ≡ `60`, `'x'` ≡ `"x"`) is a default-divergence
 *      candidate.
 *   3. ALLOWED holds every site of every judged-legitimate split — a
 *      same-token coincidence across genuinely different domains
 *      (canvas frame dims vs layout node box dims; machine-facing ''
 *      vs human-facing '<unnamed>'; per-strategy tuning parameters; a
 *      deliberately tighter retry profile). Any site of an unjudged
 *      NEW mixed cluster is RED until classified or unified.
 *   4. ERADICATED holds the three unified sites; their old literal
 *      spellings reappearing re-split the cluster and are RED twice
 *      (completeness + eradicated-reappear).
 *
 *   <!-- census-pin:F14:fallback-default ALLOWED 32 key / ERADICATED 3 key -->
 *
 * Documented ceilings (same honesty as the sibling censuses):
 *   - the chain must sit IMMEDIATELY before the operator: a call-wrapped
 *     LHS (`parseInt(e.target.value) || 1`) or a TS cast
 *     (`(x as string | undefined) ?? '-'`) is NOT discovered — there the
 *     defaulted quantity is the destination field / cast expression,
 *     not the token the regex could see. This also excludes the
 *     Map-accumulator seeds (`counts.get(k) || 0`), whose default
 *     belongs to the MAP, not the lookup key.
 *   - the literal must be a STANDALONE right-hand side (followed by
 *     `,` `;` `)` `]` `}` `:` or end-of-line): `'A' in window ||
 *     'B' in window` is a logical OR over two probe operands, not a
 *     default, and string-embedded `a || 0` text fails the same gate.
 *   - the OPERATOR axis is out of scope ON PURPOSE: `|| x` vs `?? x`
 *     on the same literal disagree only at falsy-but-valid zero/false/
 *     '' — the falsy-guard class this repo already hunted to
 *     saturation (its `||`→`??` sweep is false-positive-prone), so
 *     this census judges the VALUE axis only.
 *   - a ternary ELSE arm (`: 10000`) is not a fallback shape and is
 *     not discovered.
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

/** One discovered defaulting site. `lit` is canonical, `rawLit` as-written. */
export interface FallbackSite {
  key: string;
  line: number;
  id: string;
  op: string;
  lit: string;
  rawLit: string;
  text: string;
}

/**
 * `dotted.path` + `??`/`||` + a bare literal that stands alone as the
 * right-hand side. The first lookahead rejects partial grabs (`10000`
 * of `100000`, `true` of `trueValue`); the second requires the literal
 * to END the expression (`,` `;` `)` `]` `}` `:` or EOL next), which
 * excludes probe-operand logical ORs and string-embedded text.
 */
const FALLBACK_RE =
  /([A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*)\s*(\?\?|\|\|)\s*(-?\d+(?:\.\d+)?|'[^']*'|"[^"]*"|true|false)(?![\w.])(?=\s*[,;)\]}:]|$)/g;

/** Canonical literal spelling: `60.0` ≡ `60`, `'x'` ≡ `"x"`. */
export function canonicalFallbackLiteral(raw: string): string {
  if (/^-?\d+(\.\d+)?$/.test(raw)) return String(Number(raw));
  if (/^['"]/.test(raw)) return JSON.stringify(raw.slice(1, -1));
  return raw;
}

/** Extract every defaulting site from a file's source (comments skipped). */
export function discoverFallbackSites(rel: string, content: string): FallbackSite[] {
  const sites: FallbackSite[] = [];
  content.split('\n').forEach((line, idx) => {
    if (isCommentLine(line)) return;
    let m: RegExpExecArray | null;
    FALLBACK_RE.lastIndex = 0;
    while ((m = FALLBACK_RE.exec(line)) !== null) {
      sites.push({
        // The chain id disambiguates same-line multi-field defaults
        // (`{ width: w ?? 1920, height: h ?? 1080 }` is TWO sites).
        key: `${rel}:${idx + 1}:${m[1]}`,
        line: idx + 1,
        id: m[1],
        op: m[2],
        lit: canonicalFallbackLiteral(m[3]),
        rawLit: m[3],
        text: line.trim(),
      });
    }
  });
  return sites;
}

/** Cluster key: the defaulted field's dotted-path chain. */
export function clusterKey(site: FallbackSite): string {
  return site.id;
}

/**
 * Keep only the clusters carrying 2+ distinct canonical literals — the
 * default-divergence candidates. Single-literal clusters are consistent
 * and carry no obligation (the operator axis is out of scope by design).
 */
export function mixedLiteralClusters(
  sites: FallbackSite[],
): Map<string, FallbackSite[]> {
  const clusters = new Map<string, FallbackSite[]>();
  for (const s of sites) {
    const k = clusterKey(s);
    const arr = clusters.get(k) ?? [];
    arr.push(s);
    clusters.set(k, arr);
  }
  const mixed = new Map<string, FallbackSite[]>();
  for (const [k, arr] of clusters) {
    const lits = new Set(arr.map((s) => s.lit));
    if (lits.size > 1) mixed.set(k, arr);
  }
  return mixed;
}

/**
 * Live classification of default-divergence sites — every site of the
 * ten measured legitimate splits. The recurring justifications:
 * machine-facing '' vs human-facing label; lookup-key token vs the
 * defaulted map/destination; same token naming different quantities
 * across domains.
 */
const ALLOWED: Record<string, string> = {
  // -- message: route-specific 400 copy (query/timespan vs generic body) --
  'src/api/routes/monitoring.ts:173:message':
    "timespan route's specific 400 message — per-endpoint UX copy, deliberately distinct from the generic body-validation default.",
  'src/api/routes/monitoring.ts:252:message':
    "query-route specific 400 message ('Invalid query parameters') — same per-endpoint copy rationale.",
  'src/api/routes/monitoring.ts:277:message':
    "query-route specific 400 message — same per-endpoint copy rationale.",
  'src/api/routes/monitoring.ts:305:message':
    "query-route specific 400 message — same per-endpoint copy rationale.",
  'src/api/routes/pipeline.ts:196:message':
    "generic body-schema 400 message ('Validation failed') — Zod issue detail fallback for a different validation surface.",
  'src/api/routes/pipeline.ts:230:message':
    "generic body-schema 400 message — same surface as :196.",
  // -- stage: label default vs lookup-lane default ----------------------
  'src/pipeline/performance-regression-detector.ts:93:stage':
    "display-label default ('unknown') for a worst-offender summary line.",
  'src/quality/error-classifier.ts:242:stage':
    "classification-tag default ('unknown') — error.stage/context.stage chain in the classifier.",
  'src/quality/error-classifier.ts:243:stage':
    "classification-tag default ('unknown') — the ternary else leg of the same classifier chain.",
  'src/quality/error-recovery/load-balanced-executor.ts:329:stage':
    "priority-LOOKUP lane default ('export') — indexes the importance table; the dominant workload lane, not a label.",
  'src/quality/error-recovery/load-balanced-executor.ts:467:stage':
    "multiplier-LOOKUP lane default ('export') — indexes stageMultipliers; same lane rationale as :329.",
  // -- width / height: canvas FRAME dims vs layout NODE box dims --------
  'src/export/enhanced-export-engine.ts:939:width':
    'canvas FRAME width fallback (1920) — export frame sizing; the layout-worker cluster-mates are node box dims behind the same trailing token.',
  'src/export/enhanced-export-engine.ts:951:width':
    'canvas FRAME width fallback (1920) — second frameInfo computation, same domain as :939.',
  'src/workers/layout-worker.ts:122:width':
    'layout NODE width fallback (120) — overlap-heuristic node box, not a canvas frame.',
  'src/workers/layout-worker.ts:129:width':
    'layout NODE width fallback (120) — same node-box domain as :122.',
  'src/export/enhanced-export-engine.ts:939:height':
    'canvas FRAME height fallback (1080) — export frame sizing, not a node box.',
  'src/export/enhanced-export-engine.ts:951:height':
    'canvas FRAME height fallback (1080) — same domain as :939.',
  'src/workers/layout-worker.ts:130:height':
    'layout NODE height fallback (60) — node box domain, same split as the width legs.',
  // -- options.quality: render TIER enum vs compression FRACTION --------
  'src/components/videoRenderer.ts:54:options.quality':
    "render-quality TIER default ('medium') — enum-valued render setting.",
  'src/export/multi-format-exporter.ts:187:options.quality':
    'image-compression FRACTION default (0.95) — a different options object and a numeric quality axis, not the render tier.',
  'src/pipeline/actual-video-renderer.ts:266:options.quality':
    "render-quality TIER default ('medium') — same tier domain as videoRenderer.",
  // -- scene.id / scene.diagramType: machine '' vs human-facing label ---
  'src/export/export-content-validator.ts:208:scene.id':
    "machine-facing checkString input ('') — empty keeps a missing id FLAGGED by the validator.",
  'src/export/export-content-validator.ts:252:scene.id':
    "human-facing summary label ('<unnamed>') — reads naturally in the findings prose.",
  'src/pipeline/video-generator.ts:280:scene.id':
    "scene-graph FIELD default ('') — data-shape default, same machine-facing domain as the validator check.",
  'src/components/InteractiveResultViewer.tsx:136:scene.diagramType':
    "display default ('unknown') — renders meaningfully in the viewer.",
  'src/export/export-content-validator.ts:212:scene.diagramType':
    "machine-facing checkString input ('') — empty keeps a missing type FLAGGED by the validator.",
  // -- status: health-check vs iteration-cycle status --------------------
  'src/components/AdminAnalyticsDashboard.tsx:244:status':
    "health-check status default ('unknown') — external health payload.",
  'src/framework/iteration-manager.ts:665:status':
    "iteration-cycle status default ('in_progress') — internal framework history record, a different status domain.",
  // -- maxRetries: tighter stage-boundary retry profile ------------------
  'src/quality/enhanced-error-recovery.ts:1125:maxRetries':
    'retryWithBackoff ENGINE default (3 retries / 5s cap) — the general entry-point default.',
  'src/quality/enhanced-error-recovery.ts:1306:maxRetries':
    'stage-boundary wrapper forwards a deliberately TIGHTER profile (2 retries / 2s cap, landed as one unit in 3775adac) — a failing stage surfaces to recovery routing sooner; documented at the site.',
  // -- config.nodeSeparation: per-strategy tuning ------------------------
  'src/visualization/strategies/ComparisonLayoutStrategy.ts:94:config.nodeSeparation':
    'per-strategy TUNING parameter (vertical spacing 60) — the 2026-08-08f refutation: nodeSeparation legitimately varies per strategy; only the default-valued 50/10 subset is canonicalized in layout-spacing.ts.',
  'src/visualization/strategies/TreeLayoutStrategy.ts:191:config.nodeSeparation':
    'per-strategy TUNING parameter (horizontal spacing 80) — same refuted-class rationale as the Comparison leg.',
};

/**
 * The three unified sites. Each old spelling re-split its cluster; the
 * bare literal reappearing re-splits it again (completeness) AND
 * re-discovers the site (eradicated-reappear) — RED twice.
 */
const ERADICATED: Record<string, string> = {
  'src/pipeline/actual-video-renderer.ts:226:scene.durationMs':
    'render-path durationMs fallback unified onto DEFAULT_SCENE_DURATION_MS (REQ-405 fix) — was an ad-hoc || 10000, double the canonical substitute, on the fourth path the three-path agreement invariant never named.',
  'src/pipeline/pipeline-orchestrator.ts:851:gateResult.reason':
    "progress-event reason default unified on 'unknown' (REQ-405 fix) — was 'Quality gate failed', disagreeing with the 'unknown' the thrown QualityGateError (3 lines below, same function) uses for the SAME missing reason.",
  'src/api/websocket-handler.ts:144:decoded.role':
    "socket-side JWT role default unified on 'authenticated' (REQ-405 fix) — was '', disagreeing with the HTTP auth middleware's 'authenticated' for the SAME decoded.role claim; the socket field has no other consumer.",
};

describe('fallback-default census (REQ-405)', () => {
  const sites: FallbackSite[] = walkProductionSurface().flatMap((rel) =>
    discoverFallbackSites(rel, readSource(rel)),
  );
  const mixed = mixedLiteralClusters(sites);

  it('discovery has authority (the walk traversed the defaulting surface)', () => {
    // Floor pins: the measured baseline is 327 defaulting sites across
    // 200 clusters (family 14 discovery). A collapse below the floor
    // means the walk (or the regex) silently rotted, not that the tree
    // got cleaner.
    expect(sites.length).toBeGreaterThanOrEqual(315);
    expect(new Set(sites.map(clusterKey)).size).toBeGreaterThanOrEqual(192);
  });

  it('completeness: every mixed-cluster site is classified in ALLOWED', () => {
    // Every discovery hit below is a site of an unjudged NEW split —
    // RED until classified or unified.
    const unclassified = [...mixed.values()].flat().filter((s) => !(s.key in ALLOWED));
    expect(
      unclassified.map(
        (s) => `${s.key} [${s.id} ${s.op} ${s.rawLit}]: ${s.text}`,
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

  it('eradicated literal shapes stay eradicated (reappearance is RED)', () => {
    const discoveredKeys = new Set([...mixed.values()].flat().map((s) => s.key));
    const reappeared = Object.keys(ERADICATED).filter((k) => discoveredKeys.has(k));
    expect(
      reappeared.map(
        (k) => `${k} reappeared — the unified site re-split its cluster`,
      ),
    ).toEqual([]);
  });

  it('negative anchors: the judged sites keep their documented literals', () => {
    const anchors: Array<[string, RegExp]> = [
      // The eradicated durationMs site now references the canonical
      // constant — the bare 10000 spelling must stay gone.
      [
        'src/pipeline/actual-video-renderer.ts',
        /scene\.durationMs \|\| DEFAULT_SCENE_DURATION_MS/,
      ],
      // The exporter leg of the durationMs cluster stays fail-closed 0
      // (export-progress aggregation — a contract-violating scene
      // contributes nothing), NOT dragged onto the renderer substitute.
      [
        'src/export/production-exporter.ts',
        /Math\.max\(0, scene\.durationMs \|\| 0\)/,
      ],
      // gateResult.reason: BOTH the progress event and the thrown error
      // default the same missing reason to 'unknown'.
      [
        'src/pipeline/pipeline-orchestrator.ts',
        /emitProgress\([\s\S]*?gateResult\.reason \?\? 'unknown'\)/,
      ],
      [
        'src/pipeline/pipeline-orchestrator.ts',
        /throw new QualityGateError\(gate\.name, gateResult\.reason \?\? 'unknown'\)/,
      ],
      // The stage-boundary profile keeps its tighter 2/2s shape.
      [
        'src/quality/enhanced-error-recovery.ts',
        /maxRetries: options\?\.maxRetries \?\? 2,/,
      ],
      // The engine default keeps its 3.
      [
        'src/quality/enhanced-error-recovery.ts',
        /maxRetries: options\?\.maxRetries \?\? 3,/,
      ],
      // decoded.role agrees with the HTTP middleware on 'authenticated' —
      // operator AND boundary: `||` on both sides, so an empty-string role
      // claim defaults identically (falsy-role parity; `??` here re-forked
      // the user objects REST had already unified).
      [
        'src/api/websocket-handler.ts',
        /decoded\.role \|\| 'authenticated'/,
      ],
      [
        'src/api/middleware/auth.ts',
        /decoded\.role \|\| 'authenticated'/,
      ],
    ];
    for (const [file, pattern] of anchors) {
      expect(`${file}: ${readSource(file)}`).toMatch(pattern);
    }
    // The eradicated spellings must not survive anywhere in their files.
    for (const [file, pattern] of [
      ['src/pipeline/actual-video-renderer.ts', /durationMs \|\| 10000/],
      ['src/pipeline/pipeline-orchestrator.ts', /reason \?\? 'Quality gate failed'/],
      ['src/api/websocket-handler.ts', /decoded\.role \?\? ''/],
    ] as const) {
      expect(`${file}: ${readSource(file)}`).not.toMatch(pattern);
    }
  });

  it('liveness: synthetic fixtures prove the cluster axis catches the split', () => {
    // (a) Same field defaulted to two literals at two sites → mixed.
    const fixtureA = [
      'const a = scene.durationMs || 0;',
      'const b = scene.durationMs || 10000;',
    ].join('\n');
    const sitesA = discoverFallbackSites('fixture.ts', fixtureA);
    expect(mixedLiteralClusters(sitesA).get('scene.durationMs')).toHaveLength(2);

    // (b) Canonical literal spelling collapses: 60.0 ≡ 60 → NOT mixed.
    const fixtureB = [
      'const a = config.nodeSeparation || 60;',
      'const b = config.nodeSeparation ?? 60.0;',
    ].join('\n');
    const sitesB = discoverFallbackSites('fixture.ts', fixtureB);
    expect(mixedLiteralClusters(sitesB).has('config.nodeSeparation')).toBe(false);

    // (c) A named-constant fallback is the canonical form — not a site.
    const fixtureC = 'const a = scene.durationMs || DEFAULT_SCENE_DURATION_MS;';
    expect(discoverFallbackSites('fixture.ts', fixtureC)).toHaveLength(0);

    // (d) String quoting collapses ('x' ≡ "x") but different text splits.
    const fixtureD = [
      "const a = options.mode || 'fast';",
      'const b = options.mode || "slow";',
    ].join('\n');
    const sitesD = discoverFallbackSites('fixture.ts', fixtureD);
    expect(mixedLiteralClusters(sitesD).get('options.mode')).toHaveLength(2);

    // (e) Call-wrapped LHS and TS casts are NOT fallback-field sites —
    // the defaulted quantity there is the destination, not the token.
    const fixtureE = [
      'const a = parseInt(e.target.value) || 1;',
      "const b = (x as string | undefined) ?? '-';",
    ].join('\n');
    expect(discoverFallbackSites('fixture.ts', fixtureE)).toHaveLength(0);

    // (f) Probe-operand logical ORs ('A' in w || 'B' in w) are not
    // defaults; string-embedded shapes are not either.
    const fixtureF = [
      "const p = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;",
      "const q = 'not a || 0 default';",
    ].join('\n');
    expect(discoverFallbackSites('fixture.ts', fixtureF)).toHaveLength(0);

    // (g) Comment lines are documentation, not decisions.
    const fixtureG = '// const a = x || 1;';
    expect(discoverFallbackSites('fixture.ts', fixtureG)).toHaveLength(0);
  });
});
