/**
 * Sort-receiver mutation class — ONE repo-wide census (REQ-407 / Phase 211).
 *
 * The sixteenth family of the audit-pass-first census series, after the
 * REQ-391..394 measurement facets, the REQ-396/397 comment/cast facets,
 * the (parallel lineage) REQ-398..401 suppression / randomness / env /
 * coercion facets, the REQ-403 boundary-operator census, the REQ-404
 * rounding-mode census, and the REQ-405 fallback-default census: the
 * SAME array reordered IN PLACE while the author believed they were
 * computing a view — the destructive-array-method receiver split.
 *
 * Why the receiver axis is load-bearing and not style: `.sort()` /
 * `.reverse()` (unlike every other array read) return the RECEIVER, not
 * a copy. `return items.sort(byX)` therefore hands the caller their own
 * argument back — silently reordered. Every downstream consumer of the
 * original order (animation order, edge drawing, pagination offsets,
 * percentile loops that re-read the same samples) forks by whether the
 * sort happened yet. The incident shape this census pins:
 *
 *   - a FRESH producer (`[...x].sort`, `x.map(f).sort`,
 *     `Array.from(m.values()).sort`) is the canonical "sorted VIEW" —
 *     the receiver is an expression that just built a new array;
 *   - an IN-PLACE receiver (`x.sort`, `this.queue.sort`,
 *     `data.times.sort`) mutates the named array. It is legitimate
 *     exactly when the array is LOCAL-BUILT in the same function (the
 *     accumulator being finalized) or an OWN FIELD whose persistent
 *     order IS the state (a priority queue re-heapified by design) —
 *     and a defect when the receiver aliases the caller's input
 *     (parameter, field of a parameter, registry obtained elsewhere).
 *
 *   1. DISCOVERY walks the production surface (repo src/ + installed
 *      @stv/core core-four — same walkProductionSurface as the other
 *      census guards) for every `.sort(` / `.reverse(` call and
 *      classifies the receiver from the text immediately before the
 *      call: a bare dotted identifier chain (with optional trailing
 *      `?` for optional-call forms) is IN-PLACE; anything ending in
 *      `)` or `]` — a spread literal, a producing method call, an
 *      indexed access — is a PRODUCED receiver (fresh view form).
 *      Chain-continuation lines (`.sort(` at line start) resolve the
 *      receiver from the tail of the previous non-comment line.
 *      Comment lines are skipped (isCommentLine).
 *   2. Every IN-PLACE `.sort(` site must appear in the ALLOWED roster
 *      with a LOCAL-BUILT / OWN-FIELD reason — the confirmed-roster
 *      pin (families 8/9 lineage). The 2026-08-25 measurement found
 *      every in-place receiver locally built or an own field: zero
 *      aliased-input mutations, so this facet ships as a
 *      confirmed-clean census with ERADICATED 0 (the ratchet — any
 *      NEW in-place sort on a dotted receiver is RED until judged).
 *   3. `.reverse()` in place is exact-0: both live call sites pin the
 *      copy form (`[...this.errorQueue].reverse()` /
 *      `[...this.deadLetterQueue].reverse()` — negative anchors).
 *   4. Comparator-less `.sort()` in the production surface is exact-0
 *      (the lexicographic-default trap: `[10, 9, 100].sort()` →
 *      [10, 100, 9]). Every production sort spells a comparator or
 *      sorts strings deliberately — none is bare today.
 *
 *   <!-- census-pin:F16:sort-receiver-mutation ALLOWED 24 key / ERADICATED 0 key -->
 *
 * Documented ceilings (same honesty as the sibling censuses):
 *   - an INDEXED-ACCESS receiver (`arr[0].sort`) ends in `]` and reads
 *     as PRODUCED — an aliased element sort escapes discovery. No such
 *     site exists today; the ceiling is why axis 3 also pins the
 *     comparator-less shape.
 *   - the receiver must be visible in the call's line or the tail of
 *     its continuation chain (≤3 look-back lines): a receiver computed
 *     many statements earlier reads as a bare identifier IN-PLACE site
 *     and lands in the roster with a judgment — which is the desired
 *     outcome anyway (that is exactly the aliasing the roster audits).
 *   - `.toSorted(` / `.toReversed(` (ES2023 copies) are the canonical
 *     escape hatch and are out of census scope by construction: the
 *     discovery only reads `.sort(`/`.reverse(`.
 *   - comparator SEMANTICS (NaN operands, direction, tie-breakers) are
 *     out of scope — this census judges the receiver-aliasing axis
 *     only; the rounding/boundary families own the numeric axes.
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

/** One destructive-array call site, receiver-classified. */
export interface SortSite {
  /** `${rel}:${line}:${receiver}` — the roster key form. */
  key: string;
  line: number;
  /** Dotted receiver chain for in-place sites; '<produced>' otherwise. */
  receiver: string;
  method: 'sort' | 'reverse';
  /** True when the receiver is a bare dotted chain (mutates that array). */
  inPlace: boolean;
  /** `.sort()` with no comparator at all (lexicographic default). */
  comparatorless: boolean;
  text: string;
}

/** A dotted identifier chain ending at the call: `data.times`, `this.queue`. */
const RECEIVER_CHAIN_RE = /([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)$/;

/**
 * Classify the receiver of a `.sort(`/`.reverse(` at `line[m.index]`:
 * look backward on the line; when the call continues a chain from a
 * previous line (nothing but whitespace before it, or a trailing `.`),
 * join the tail of up to 3 previous non-comment lines. A bare dotted
 * chain (optionally before a trailing `?`) is IN-PLACE; an expression
 * ending in `)` or `]` (producer call, spread literal, index) is not.
 */
function receiverPrefixBefore(
  lines: string[],
  lineIdx: number,
  matchIdx: number,
): string {
  let eff = lines[lineIdx].slice(0, matchIdx).trimEnd();
  let hop = 1;
  while ((eff === '' || eff.endsWith('.')) && hop <= 3) {
    let j = lineIdx - hop;
    while (j >= 0 && isCommentLine(lines[j])) j -= 1;
    if (j < 0) break;
    const prev = lines[j].trimEnd();
    eff = eff === '' ? prev : prev + eff;
    hop += 1;
  }
  return eff;
}

/** Extract every `.sort(`/`.reverse(` site from a file (comments skipped). */
export function discoverDestructiveArraySites(
  rel: string,
  content: string,
): SortSite[] {
  const sites: SortSite[] = [];
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (isCommentLine(line)) return;
    const callRe = /\.(sort|reverse)\(/g;
    let m: RegExpExecArray | null;
    callRe.lastIndex = 0;
    while ((m = callRe.exec(line)) !== null) {
      const method = m[1] as 'sort' | 'reverse';
      const prefix = receiverPrefixBefore(lines, idx, m.index);
      // An optional-call `x?.sort(` mutates x when present — strip the `?`.
      const chain = prefix.replace(/\?$/, '').match(RECEIVER_CHAIN_RE);
      const inPlace = chain !== null;
      const receiver = chain !== null ? chain[1] : '<produced>';
      const rest = line.slice(m.index + m[0].length).trimStart();
      sites.push({
        key: `${rel}:${idx + 1}:${receiver}`,
        line: idx + 1,
        receiver,
        method,
        inPlace,
        comparatorless: method === 'sort' && rest.startsWith(')'),
        text: line.trim(),
      });
    }
  });
  return sites;
}

/**
 * Live classification of every in-place `.sort(` site — the
 * confirmed-roster pin. The recurring justifications: an accumulator
 * built (push/map/filter) in the same function and finalized by the
 * sort before its single hand-off; an own field whose persistent order
 * IS the data structure (priority queue re-ranked on every mutation).
 */
const ALLOWED: Record<string, string> = {
  // -- diagram-detector: local accumulators finalized by the sort -----
  'src/analysis/diagram-detector.ts:780:entities':
    'LOCAL-BUILT — entity accumulator pushed in-function; the sort finalizes it for the single return (no external alias exists).',
  'src/analysis/diagram-detector.ts:1090:allScores':
    'LOCAL-BUILT — map() result re-sorted in place after the LLM-recommendation bonus mutation of the same local array.',
  'src/analysis/diagram-detector.ts:1102:allScores':
    'LOCAL-BUILT — second in-place re-sort of the same local; sorting a copy would orphan the mutation above.',
  // -- scene-segmenter / complexity: local boundary + count arrays -----
  'src/analysis/scene-segmenter.ts:294:boundaries':
    'LOCAL-BUILT — keyword-boundary offsets accumulated in-function; sorted once before the dedup pass over the same local.',
  // -- framework: local recommendation/pattern lists -------------------
  'src/framework/auto-improvement-engine.ts:315:recommendations':
    'LOCAL-BUILT — recommendations pushed in-function; the sort orders the local right before it is embedded in the returned report.',
  'src/framework/continuous-learner.ts:587:this.optimizationStrategies':
    'OWN-FIELD — the strategy table is re-ranked by expectedImprovement×priority on every learning update; the persistent order IS the state (deliberate, commented 戦略の優先度更新).',
  // -- export/pipeline: local list/report accumulators ------------------
  'src/export/export-artifact-store.ts:201:entries':
    'LOCAL-BUILT — let-bound Array.from(this.artifacts.values()).filter() fresh copy; the createdAt sort orders the local for pagination (the store map is never reordered).',
  'src/pipeline/improvement-detector.ts:74:opportunities':
    'LOCAL-BUILT — holds detectOpportunities() return value (an array built and returned inside that method); the priority sort orders the fresh local for the report field.',
  // -- monitoring: locally assembled route/report lists ----------------
  'src/monitoring/http-metrics-collector.ts:265:routes':
    'LOCAL-BUILT — per-route rows pushed in-function; sorted by count just before being returned in the snapshot.',
  'src/monitoring/production-error-handler.ts:420:strategies':
    'LOCAL-BUILT — strategy candidates pushed in-function; the priority sort finalizes the local for the return value.',
  // -- performance/intelligent-cache: candidate ranking ----------------
  'src/performance/intelligent-cache.ts:292:candidates':
    'LOCAL-BUILT — preload candidates pushed in-function; the combined-score sort ranks the local before its top-5 slice.',
  // -- quality: local strategy/chain/distribution accumulators --------
  'src/quality/enhanced-error-recovery.ts:801:chains':
    'LOCAL-BUILT — cascade chains pushed in-function; the frequency sort finalizes the local for the return value.',
  'src/quality/error-recovery/load-balanced-executor.ts:289:this.requestQueue':
    'OWN-FIELD — the request queue is a priority queue re-ranked after in-degree updates; reordering the persistent field is the data structure working as designed.',
  'src/quality/error-recovery/recovery-strategies.ts:361:strategies':
    'LOCAL-BUILT — array-literal strategy table closed over in-function; the priority sort orders it right before the return.',
  'src/quality/recovery-telemetry-aggregator.ts:179:data.times':
    'LOCAL-BUILT — data is a stageMap entry created in the same function; its times array is this aggregation own input, sorted once for mean/p95.',
  'src/quality/recovery-telemetry-aggregator.ts:205:errorTypeDistribution':
    'LOCAL-BUILT — distribution rows pushed in-function; the count sort orders the local for the report.',
  'src/quality/user-guided-error-recovery.ts:131:automatedStrategies':
    'LOCAL-BUILT — the receiver holds a filter() copy of guidance.recoveryStrategies (fresh array), not the guidance object own field.',
  // -- remotion animation orderings ------------------------------------
  'src/remotion/animation-strategies.ts:143:indexed':
    'LOCAL-BUILT — edges.map() local pairing edges with their index; the y-sort orders the local before animation config build.',
  'src/remotion/animation-strategies.ts:176:indexed':
    'LOCAL-BUILT — same map() local in the second strategy; the x-sort orders the local before its config build.',
  // -- visualization strategies: local traversal queues ---------------
  'src/visualization/strategies/flow-strategy.ts:79:queue':
    'LOCAL-BUILT — Kahn initial zero-in-degree queue filled in-function; sorted for stable traversal order before the loop.',
  'src/visualization/strategies/flow-strategy.ts:97:queue':
    'LOCAL-BUILT — same local queue re-ranked inside the traversal loop; the algorithm mutates its own working set.',
  'src/visualization/strategies/tree-strategy.ts:64:roots':
    'LOCAL-BUILT — filter() result (fresh copy of originalNodes); the dagre-y sort orders the local for BFS seeding.',
  'src/visualization/strategies/tree-strategy.ts:117:group':
    'LOCAL-BUILT — level-group arrays accumulated in the levelGroups map built in-function; the dagre-x sort orders each fresh group.',
  // -- LayoutOptimizer: spread-copy local ------------------------------
  'src/visualization/strategies/LayoutOptimizer.ts:74:nodes':
    'LOCAL-BUILT — const nodes = [...layout.nodes] spread copy two lines above; the x-sort orders the copy, never the layout argument.',
};

/**
 * The unified/eradicated sites. The 2026-08-25 measurement found ZERO
 * aliased-input mutations (every in-place receiver is LOCAL-BUILT or an
 * OWN FIELD by the roster judgment above), so the block is empty — the
 * confirmed-zero shape (families 8/9/15 lineage). The multi-line form
 * is deliberate: a one-line `= {};` bleeds countRosterBlock into the
 * next block (session-217 gotcha).
 */
const ERADICATED: Record<string, string> = {
  // (confirmed-zero 2026-08-25: no aliased-input in-place sort receiver
  //  exists on the production surface — REQ-407 discovery, family 16)
};

describe('sort-receiver-mutation census (REQ-407)', () => {
  const sites: SortSite[] = walkProductionSurface().flatMap((rel) =>
    discoverDestructiveArraySites(rel, readSource(rel)),
  );
  const sorts = sites.filter((s) => s.method === 'sort');
  const reverses = sites.filter((s) => s.method === 'reverse');
  const inPlaceSorts = sorts.filter((s) => s.inPlace);

  it('discovery has authority (the walk traversed the destructive surface)', () => {
    // Floor pins: the measured baseline is 74 `.sort(` sites, 24
    // in-place of them, and 2 `.reverse(` sites across the production
    // surface (family 16 discovery, incl. the @stv/core core-four). A
    // collapse below the floor means the walk (or the receiver regex)
    // silently rotted, not that the tree got cleaner.
    expect(sorts.length).toBeGreaterThanOrEqual(72);
    expect(reverses.length).toBeGreaterThanOrEqual(2);
    expect(inPlaceSorts.length).toBeGreaterThanOrEqual(24);
  });

  it('completeness: every in-place sort site is classified in ALLOWED', () => {
    // Every discovery hit below sorts a NAMED array in place without a
    // judged LOCAL-BUILT / OWN-FIELD reason — RED until classified.
    const unclassified = inPlaceSorts.filter((s) => !(s.key in ALLOWED));
    expect(
      unclassified.map((s) => `${s.key} [${s.receiver}.${s.method}(]: ${s.text}`),
    ).toEqual([]);
  });

  it('no stale ALLOWED rows (every roster entry is still a live in-place site)', () => {
    const live = new Set(inPlaceSorts.map((s) => s.key));
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

  it('eradicated receiver shapes stay eradicated (reappearance is RED)', () => {
    // ERADICATED is the confirmed-zero shape: any site landing here
    // re-enters the live roster above; a future unified site whose old
    // in-place spelling reappears must fail completeness a second time.
    const discoveredKeys = new Set(inPlaceSorts.map((s) => s.key));
    const reappeared = Object.keys(ERADICATED).filter((k) => discoveredKeys.has(k));
    expect(
      reappeared.map((k) => `${k} reappeared — the unified site re-split the roster`),
    ).toEqual([]);
  });

  it('axis 2: .reverse() in place is exact-0 (both live sites keep the copy form)', () => {
    const inPlaceReverses = reverses.filter((s) => s.inPlace);
    expect(
      inPlaceReverses.map((s) => `${s.key}: ${s.text}`),
    ).toEqual([]);
  });

  it('axis 3: comparator-less .sort() in the production surface is exact-0', () => {
    const bare = sorts.filter((s) => s.comparatorless);
    expect(
      bare.map((s) => `${s.key}: ${s.text}`),
    ).toEqual([]);
  });

  it('negative anchors: the canonical shapes keep their documented forms', () => {
    const anchors: Array<[string, RegExp]> = [
      // The two .reverse() sites pin the copy form — an in-place form
      // would silently reverse the persistent queue itself.
      [
        'src/monitoring/production-error-handler.ts',
        /return \[\.\.\.this\.errorQueue\]\.reverse\(\);/,
      ],
      [
        'src/export/export-job-queue.ts',
        /return \[\.\.\.this\.deadLetterQueue\]\.reverse\(\);/,
      ],
      // Representative FRESH-producer view sorts stay copy-first (the
      // incident shape this census guards against is flipping these).
      [
        'src/monitoring/real-time-performance-monitor.ts',
        /percentileCeil\(\[\.\.\.values\]\.sort\(\(a, b\) => a - b\), percentile\)/,
      ],
      [
        'src/quality/quality-gate.ts',
        /\[\.\.\.segments\]\.sort\(/,
      ],
      [
        'src/monitoring/production-monitor.ts',
        /this\.processingTimes\s*\n\s*\.filter\(\(t\) => Number\.isFinite\(t\)\)\s*\n\s*\.sort\(\(a, b\) => a - b\)/,
      ],
      // The two OWN-FIELD roster rows keep their deliberate in-place
      // forms (renaming them out of the dotted-receiver shape flips a
      // stale-row RED, so the anchors pin the spelling too).
      [
        'src/quality/error-recovery/load-balanced-executor.ts',
        /this\.requestQueue\.sort\(/,
      ],
      [
        'src/framework/continuous-learner.ts',
        /this\.optimizationStrategies\.sort\(/,
      ],
    ];
    for (const [file, pattern] of anchors) {
      expect(`${file}: ${readSource(file)}`).toMatch(pattern);
    }
  });

  it('liveness: synthetic fixtures prove the receiver axis catches the split', () => {
    // (a) An aliased input sorted in place — the incident shape.
    const fixtureA = 'function rank(items: Item[]) { return items.sort(byX); }';
    const sitesA = discoverDestructiveArraySites('fixture.ts', fixtureA);
    expect(sitesA[0].inPlace).toBe(true);
    expect(sitesA[0].receiver).toBe('items');

    // (b) Fresh producers — spread / map / Array.from — are NOT sites.
    const fixtureB = [
      'const a = [...values].sort(cmp);',
      'const b = values.map(f).sort(cmp);',
      'const c = Array.from(m.entries()).sort(cmp);',
      'const d = Object.entries(o).sort(cmp);',
    ].join('\n');
    for (const s of discoverDestructiveArraySites('fixture.ts', fixtureB)) {
      expect(s.inPlace).toBe(false);
    }

    // (c) Chain continuation resolves the receiver across lines.
    const fixtureC = [
      'const sorted = data.times',
      '  .sort((a, b) => a - b);',
    ].join('\n');
    const sitesC = discoverDestructiveArraySites('fixture.ts', fixtureC);
    expect(sitesC[0].inPlace).toBe(true);
    expect(sitesC[0].receiver).toBe('data.times');

    // (d) A producing previous line (call tail) classifies produced.
    const fixtureD = [
      'const all = Array.from(this.history.entries())',
      '  .flatMap(([s, xs]) => xs.map((e) => ({ ...e, s })))',
      '  .sort((a, b) => a.t - b.t);',
    ].join('\n');
    const sitesD = discoverDestructiveArraySites('fixture.ts', fixtureD);
    expect(sitesD[0].inPlace).toBe(false);

    // (e) Optional-call form `x?.sort(` is still the caller's array.
    const fixtureE = 'const r = nodes?.sort(cmp);';
    expect(
      discoverDestructiveArraySites('fixture.ts', fixtureE)[0].receiver,
    ).toBe('nodes');

    // (f) this.field receivers keep their full dotted chain.
    const fixtureF = 'this.queue.sort(cmp);';
    expect(
      discoverDestructiveArraySites('fixture.ts', fixtureF)[0].receiver,
    ).toBe('this.queue');

    // (g) Comparator-less sort flags the lexicographic trap; reverse
    // sites classify on the same receiver axis.
    const fixtureG = ['const z = nums.sort();', 'const y = q.reverse();'].join('\n');
    const sitesG = discoverDestructiveArraySites('fixture.ts', fixtureG);
    expect(sitesG.find((s) => s.method === 'sort')?.comparatorless).toBe(true);
    expect(sitesG.find((s) => s.method === 'reverse')?.inPlace).toBe(true);
    expect(sitesG.find((s) => s.method === 'reverse')?.comparatorless).toBe(false);

    // (h) Comment lines are documentation, not decisions; indexed
    // access is the documented produced-classification ceiling.
    const fixtureH = [
      '// const c = items.sort(cmp);',
      'const i = matrix[0].sort(cmp);',
    ].join('\n');
    const sitesH = discoverDestructiveArraySites('fixture.ts', fixtureH);
    expect(sitesH).toHaveLength(1);
    expect(sitesH[0].inPlace).toBe(false);
  });
});
