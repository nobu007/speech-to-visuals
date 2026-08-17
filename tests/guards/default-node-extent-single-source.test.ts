/**
 * @jest-environment node
 */
/**
 * default-node-extent-single-source.test.ts — round 49.
 *
 * Family: the DEFAULT-fallback dimension-resolution pair
 * `const w = getNodeWidth(node, DEFAULT_NODE_WIDTH);
 *  const h = getNodeHeight(node, DEFAULT_NODE_HEIGHT)` — was re-inlined at
 * 16 sites across 11 files (dagre-pipeline ×2 — g.setNode sizing + the
 * positioned-node stamp; strategy-selector fallback-grid inline property
 * reads; comparison / general / flow / matrix / tree / timeline strategy
 * stamps; cycle-strategy ×4 — single-node stamp, ring stamp, and both
 * radius maxima; network-strategy clamp sizing; mindmap-strategy ×2 stamp
 * branches), plus the raw pair inside strategy-graph's `scaledNodeExtent`
 * (the scaled twin of the same resolution). Canonical since round 49:
 * `defaultNodeExtent` in src/visualization/node-dimensions.ts.
 *
 * DRIFT SCENARIO this guard defends against: the width and height defaults
 * are DIFFERENT numbers (120 and 60) — a copy that swaps the axes' fallback
 * literals, passes one number for both, or re-reads the deprecated `w`/`h`
 * aliases directly mis-sizes one engine's stamps while every other consumer
 * of the same shape agrees. The per-axis seam is the whole point (round 47's
 * lesson: a single shared fallback number is the bug, not the cleanup).
 *
 * Layers:
 *   1. VERBATIM ORACLE — every retired idiom (two-const pair, inline
 *      property reads, the `Math.max(...nodes.map(...))` maxima, and the
 *      scaledNodeExtent pre-round-49 body) frozen below, Object.is-identical
 *      to the canonical over a seeded corpus of dimension shapes
 *      (dimensionless, `width`/`height`, `w`/`h` alias, NaN, Infinity,
 *      negative, zero, large).
 *   2. SEMANTIC PINS — the per-axis asymmetry witness (120 ≠ 60 for a
 *      dimensionless node), the fallback-chain precedence per axis, the
 *      implicit-default idiom equivalence (the scope-out that STAYS legal),
 *      and live strategy witnesses through real stamps (cycle single-node,
 *      timeline block-form stamp).
 *   3. SOURCE ANCHORS — every migrated file delegates with its idiom's
 *      shape, the raw pair lives in exactly one module, and the scope-outs
 *      (0-fallback measured reads, `?? DEFAULT_*` optional-chained edge
 *      reads) keep their inline forms.
 *
 * The "no site re-inlines the resolution pair" discovery sweep lives in the
 * shared registry (frozen-literal-families/default-node-extent.ts); this
 * file holds the behavioral pins.
 *
 * Worker-mock note: unlike rounds 41/48 (new layout-utils exports), the new
 * export lands in node-dimensions, which no test partial-mocks via
 * unstable_mockModule — there is no link-error surface to pin here.
 */

import { describe, it, expect } from '@jest/globals';
import { mulberry32 } from '@tests/helpers/fuzz';
import { readSource } from '@tests/guards/freeze-guard';
import {
  defaultNodeExtent,
  getNodeWidth,
  getNodeHeight,
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_HEIGHT,
} from '@/visualization/node-dimensions';
import { scaledNodeExtent } from '@/visualization/strategy-graph';
import { scaledDimensions } from '@/visualization/importance-scaler';
import { CycleLayoutStrategy } from '@/visualization/strategies/cycle-strategy';
import { TimelineStrategy } from '@/visualization/strategies/timeline-strategy';
import type { NodeDatum } from '@/types/diagram';

// ---------------------------------------------------------------------------
// Layer 1 material: the VERBATIM pre-round-49 expressions, frozen from the
// migrated files at c5c21785 (round 48 HEAD). Do not "improve" these copies:
// their job is to be the old behavior, not good behavior.
// ---------------------------------------------------------------------------

type ExtentNodeShape = { width?: number; w?: number; height?: number; h?: number };

/** The two-const preamble — dagre ×2, comparison, general, flow, matrix,
 *  tree, cycle ×2 stamps, network clamp, mindmap ×2 (12 sites). */
function legacyPairW(node: ExtentNodeShape): number {
  return getNodeWidth(node, DEFAULT_NODE_WIDTH);
}
function legacyPairH(node: ExtentNodeShape): number {
  return getNodeHeight(node, DEFAULT_NODE_HEIGHT);
}

/** The inline property reads — strategy-selector / timeline stamp literals. */
function legacyInlineW(node: ExtentNodeShape): number {
  return getNodeWidth(node, DEFAULT_NODE_WIDTH);
}
function legacyInlineH(node: ExtentNodeShape): number {
  return getNodeHeight(node, DEFAULT_NODE_HEIGHT);
}

/** The per-node maxima — cycle-strategy ×2 radius sizing. */
function legacyMaxW(nodes: ExtentNodeShape[]): number {
  return Math.max(...nodes.map((n) => getNodeWidth(n, DEFAULT_NODE_WIDTH)));
}
function legacyMaxH(nodes: ExtentNodeShape[]): number {
  return Math.max(...nodes.map((n) => getNodeHeight(n, DEFAULT_NODE_HEIGHT)));
}

/** The pre-round-49 `scaledNodeExtent` body (strategy-graph) — the scaled
 *  twin resolving the same raw pair inline. */
function legacyScaledExtent(node: NodeDatum): { width: number; height: number } {
  return scaledDimensions(
    node,
    getNodeWidth(node, DEFAULT_NODE_WIDTH),
    getNodeHeight(node, DEFAULT_NODE_HEIGHT),
  );
}

// ---------------------------------------------------------------------------
// Corpus: seeded node shapes spanning the retired sites' dimension inputs.
// ---------------------------------------------------------------------------

const DIM_VALUES = [undefined, 0, -3.5, NaN, Infinity, -Infinity, 60, 120, 1e15];

function buildNodeCorpus(): ExtentNodeShape[] {
  const rng = mulberry32(4921);
  const pickVal = () => DIM_VALUES[Math.floor(rng() * DIM_VALUES.length)];
  const nodes: ExtentNodeShape[] = [{}]; // the dimensionless node — the default path
  for (let k = 0; k < 240; k++) {
    nodes.push({
      width: pickVal(),
      w: pickVal(),
      height: pickVal(),
      h: pickVal(),
    });
  }
  // hand-built precedence ladders the fuzz cannot guarantee
  nodes.push(
    { width: 177, w: 210 },
    { w: 140, h: 70 },
    { width: NaN, w: 88 },
    { height: NaN, h: 44 },
    { width: Infinity, w: 51 },
    { height: Infinity, h: 33 },
    { width: 0, w: 999 },
    { height: 0, h: 999 },
  );
  return nodes;
}

const NODE_CORPUS = buildNodeCorpus();

describe('round 49: default node extent single source — layer 1 verbatim oracle', () => {
  it.each(NODE_CORPUS)('the two-const preamble equals the canonical pair %#', (node) => {
    const got = defaultNodeExtent(node);
    expect(Object.is(got.width, legacyPairW(node))).toBe(true);
    expect(Object.is(got.height, legacyPairH(node))).toBe(true);
    // width resolves BEFORE height in the retired preamble; the canonical
    // object literal preserves that evaluation order (both reads are pure,
    // so this is a shape witness, not a value one).
    expect(Object.is(got.width, legacyInlineW(node))).toBe(true);
    expect(Object.is(got.height, legacyInlineH(node))).toBe(true);
  });

  it('the cycle maxima equal the canonical per-node resolution', () => {
    const rng = mulberry32(4948);
    for (let k = 0; k < 120; k++) {
      const n = Math.floor(rng() * 6);
      const nodes = Array.from({ length: n }, () => NODE_CORPUS[Math.floor(rng() * NODE_CORPUS.length)]);
      if (nodes.length === 0) {
        // Math.max() of nothing is -Infinity at BOTH forms — same policy.
        expect(Object.is(Math.max(...nodes.map((x) => defaultNodeExtent(x).width)), legacyMaxW(nodes))).toBe(true);
        continue;
      }
      expect(Object.is(Math.max(...nodes.map((x) => defaultNodeExtent(x).width)), legacyMaxW(nodes))).toBe(true);
      expect(Object.is(Math.max(...nodes.map((x) => defaultNodeExtent(x).height)), legacyMaxH(nodes))).toBe(true);
    }
  });

  it('the pre-round-49 scaledNodeExtent body still equals the composed canonical', () => {
    const rng = mulberry32(4960);
    for (let k = 0; k < 200; k++) {
      const base = NODE_CORPUS[Math.floor(rng() * NODE_CORPUS.length)];
      const importance = [undefined, 0, 0.5, 1, 1.5, -0.5, NaN][Math.floor(rng() * 7)];
      const node = {
        id: `n${k}`,
        label: `n${k}`,
        ...(importance === undefined ? {} : { meta: { importance } }),
        ...base,
      } as unknown as NodeDatum;
      const got = scaledNodeExtent(node);
      const legacy = legacyScaledExtent(node);
      expect(Object.is(got.width, legacy.width)).toBe(true);
      expect(Object.is(got.height, legacy.height)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Layer 2: semantic pins — per-axis seam, fallback chain, the legal
// implicit-default idiom, and live strategy witnesses.
// ---------------------------------------------------------------------------

describe('round 49: default node extent — layer 2 semantic pins', () => {
  it('PER-AXIS SEAM WITNESS: a dimensionless node resolves 120 × 60, NOT one shared number', () => {
    const got = defaultNodeExtent({});
    expect(got).toEqual({ width: 120, height: 60 });
    // the seam: the two fallbacks differ — collapsing them to one number is
    // the drift this round closes; a swap or a shared constant fails here.
    expect(DEFAULT_NODE_WIDTH).toBe(120);
    expect(DEFAULT_NODE_HEIGHT).toBe(60);
    expect(DEFAULT_NODE_WIDTH).not.toBe(DEFAULT_NODE_HEIGHT);
  });

  it('fallback chain precedence, per axis: canonical → alias → DEFAULT (NaN/Infinity fall through)', () => {
    expect(defaultNodeExtent({ width: 177, w: 210, height: 88, h: 99 })).toEqual({ width: 177, height: 88 });
    expect(defaultNodeExtent({ w: 210, h: 99 })).toEqual({ width: 210, height: 99 });
    expect(defaultNodeExtent({ width: NaN, w: 210, height: Infinity, h: 99 })).toEqual({ width: 210, height: 99 });
    expect(defaultNodeExtent({ width: 0, w: 210, height: 0, h: 99 })).toEqual({ width: 0, height: 0 });
    expect(defaultNodeExtent({})).toEqual({ width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT });
  });

  it('SCOPE-OUT LEGAL IDIOM: the implicit default `getNodeWidth(node)` stays value-identical', () => {
    // getNodeWidth's own default parameter IS the single source for the
    // implicit form (e.g. quality-estimators reads) — no raw DEFAULT pair
    // needed there, and the registry bans only the explicit DEFAULT-literal
    // argument form.
    for (const node of NODE_CORPUS) {
      expect(Object.is(getNodeWidth(node), defaultNodeExtent(node).width)).toBe(true);
      expect(Object.is(getNodeHeight(node), defaultNodeExtent(node).height)).toBe(true);
    }
  });

  it('LIVE WITNESS: CycleLayoutStrategy single node stamps the 120×60 default box', () => {
    const strategy = new CycleLayoutStrategy();
    const result = strategy.apply([{ id: 'only', label: 'only' }], []);
    // the n === 1 branch delegates: x = canvas/2 − w/2 = 960 − 60, y = 540 − 30.
    expect(result.nodes[0]).toMatchObject({ x: 960 - 120 / 2, y: 540 - 60 / 2, width: 120, height: 60 });
  });

  it('LIVE WITNESS: TimelineStrategy stamp (block-form delegation) keeps 120×60', () => {
    const strategy = new TimelineStrategy();
    const result = strategy.apply([{ id: 'only', label: 'only' }], []);
    // x = DEFAULT_CANVAS_WIDTH/2 − DEFAULT_NODE_WIDTH/2; y = CANVAS_PADDING (80).
    expect(result.nodes[0]).toMatchObject({ x: 960 - 120 / 2, y: 80, width: 120, height: 60 });
  });
});

// ---------------------------------------------------------------------------
// Layer 3: source anchors — delegation shapes at every migrated site, the
// raw pair exactly once, the scope-outs documented.
// ---------------------------------------------------------------------------

const RAW_PAIR_W = /getNodeWidth\(\w+(?:\[\w+\])?,\s*DEFAULT_NODE_WIDTH\)/;
const RAW_PAIR_H = /getNodeHeight\(\w+(?:\[\w+\])?,\s*DEFAULT_NODE_HEIGHT\)/;

function codeLines(rel: string): string[] {
  return readSource(rel)
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line));
}

describe('round 49: default node extent — layer 3 source anchors', () => {
  it('node-dimensions holds the raw pair exactly once (the canonical itself)', () => {
    const lines = codeLines('src/visualization/node-dimensions.ts');
    expect(lines.filter((l) => RAW_PAIR_W.test(l)).length).toBe(1);
    expect(lines.filter((l) => RAW_PAIR_H.test(l)).length).toBe(1);
    expect(lines.filter((l) => /export function defaultNodeExtent\(/.test(l)).length).toBe(1);
  });

  it('dagre-pipeline delegates both sites (g.setNode sizing + the stamp)', () => {
    const src = readSource('src/visualization/dagre-pipeline.ts');
    expect((src.match(/const \{ width: w, height: h \} = defaultNodeExtent\(node\);/g) ?? []).length).toBe(2);
    expect(src).not.toMatch(RAW_PAIR_W);
    expect(src).not.toMatch(RAW_PAIR_H);
    // the center→top-left conversion locals stay (round-30 guard depends on them)
    expect(src).toMatch(/dagreNode\.x - w \/ 2/);
  });

  it('strategy-selector delegates the fallback-grid inline property reads', () => {
    const src = readSource('src/visualization/strategy-selector.ts');
    expect((src.match(/const \{ width, height \} = defaultNodeExtent\(n\);/g) ?? []).length).toBe(1);
    expect(src).not.toMatch(RAW_PAIR_W);
    expect(src).not.toMatch(RAW_PAIR_H);
  });

  it('strategy-graph composes the canonical (scaledNodeExtent no longer resolves the raw pair)', () => {
    const src = readSource('src/visualization/strategy-graph.ts');
    expect(src).toMatch(/const extent = defaultNodeExtent\(node\);/);
    expect(src).toMatch(/scaledDimensions\(node, extent\.width, extent\.height\)/);
    expect(codeLines('src/visualization/strategy-graph.ts').some((l) => RAW_PAIR_W.test(l))).toBe(false);
    // the round-42 guard's own ban still holds: the retired 3-line scaled
    // idiom must not reappear inline.
    expect(src).not.toMatch(/Math\.round\(getNodeWidth\(node, DEFAULT_NODE_WIDTH\) \* scale\)/);
  });

  it('the five pair-const strategy stamps delegate (comparison/general/flow/matrix/tree)', () => {
    const shapes: Record<string, RegExp> = {
      'src/visualization/strategies/comparison-strategy.ts': /const \{ width: w, height: h \} = defaultNodeExtent\(node\);/,
      'src/visualization/strategies/general-strategy.ts': /const \{ width: w, height: h \} = defaultNodeExtent\(node\);/,
      'src/visualization/strategies/flow-strategy.ts': /const \{ width: w, height: h \} = defaultNodeExtent\(node\);/,
      'src/visualization/strategies/matrix-strategy.ts': /const \{ width: nodeWidth, height: nodeHeight \} = defaultNodeExtent\(node\);/,
      'src/visualization/strategies/tree-strategy.ts': /const \{ width: w, height: h \} = defaultNodeExtent\(node\);/,
    };
    for (const [file, shape] of Object.entries(shapes)) {
      const src = readSource(file);
      expect(src).toMatch(shape);
      expect(src).not.toMatch(RAW_PAIR_W);
      expect(src).not.toMatch(RAW_PAIR_H);
    }
  });

  it('flow/tree keep the `?? DEFAULT_*` optional-chained EDGE reads (r46 scope-out, untouched)', () => {
    for (const file of ['src/visualization/strategies/flow-strategy.ts', 'src/visualization/strategies/tree-strategy.ts']) {
      const src = readSource(file);
      expect((src.match(/\?\.width \?\? DEFAULT_NODE_WIDTH/g) ?? []).length).toBe(2);
      expect((src.match(/\?\.height \?\? DEFAULT_NODE_HEIGHT/g) ?? []).length).toBe(2);
    }
  });

  it('cycle-strategy delegates all four sites (2 stamps + 2 maxima)', () => {
    const src = readSource('src/visualization/strategies/cycle-strategy.ts');
    expect((src.match(/const \{ width: w, height: h \} = defaultNodeExtent\(node\);/g) ?? []).length).toBe(2);
    expect((src.match(/defaultNodeExtent\((?:n|nd)\)\.width/g) ?? []).length).toBe(2);
    expect((src.match(/defaultNodeExtent\((?:n|nd)\)\.height/g) ?? []).length).toBe(2);
    expect(src).not.toMatch(RAW_PAIR_W);
    expect(src).not.toMatch(RAW_PAIR_H);
  });

  it('network-strategy delegates the clamp sizing', () => {
    const src = readSource('src/visualization/strategies/network-strategy.ts');
    expect(src).toMatch(/const \{ width: w, height: h \} = defaultNodeExtent\(node\);/);
    expect(src).not.toMatch(RAW_PAIR_W);
    expect(src).not.toMatch(RAW_PAIR_H);
  });

  it('mindmap-strategy delegates both stamp branches', () => {
    const src = readSource('src/visualization/strategies/mindmap-strategy.ts');
    expect((src.match(/const \{ width: w, height: h \} = defaultNodeExtent\(node\);/g) ?? []).length).toBe(2);
    expect(src).not.toMatch(RAW_PAIR_W);
    expect(src).not.toMatch(RAW_PAIR_H);
  });

  it('conceptmap-strategy delegates the width-only level-width read (registry-sweep discovery)', () => {
    // This site passes an EXPRESSION arg (`node ?? { width: 0, w: 0 }`) — the
    // first sweep's identifier-only grep missed it; the registry's
    // shape-level pattern caught it. The defensive nullish guard and the
    // importance scale stay at the site; only the resolution delegates.
    const src = readSource('src/visualization/strategies/conceptmap-strategy.ts');
    expect(src).toMatch(/defaultNodeExtent\(node \?\? \{ width: 0, w: 0 \}\)\.width/);
    expect(src).not.toMatch(RAW_PAIR_W);
    expect(src).not.toMatch(RAW_PAIR_H);
  });

  it('timeline-strategy delegates the stamp and KEEPS the 0-fallback measured reads', () => {
    const src = readSource('src/visualization/strategies/timeline-strategy.ts');
    expect(src).toMatch(/const \{ width, height \} = defaultNodeExtent\(node\);/);
    expect(codeLines('src/visualization/strategies/timeline-strategy.ts').some((l) => RAW_PAIR_W.test(l))).toBe(false);
    // round 41's measured-policy reads (fallback 0) are a DIFFERENT policy
    // and must not be converged onto the render-default box.
    expect((src.match(/getNodeWidth\(result\[(?:i|j)\], 0\)/g) ?? []).length).toBe(2);
    expect((src.match(/getNodeHeight\(result\[i\], 0\)/g) ?? []).length).toBe(1);
  });

  it('layout-utils keeps its fallback-PARAMETER signature (r41 seam, untouched)', () => {
    const src = readSource('src/visualization/layout-utils.ts');
    expect(src).toMatch(/fallbackWidth: number = DEFAULT_NODE_WIDTH/);
    expect(src).toMatch(/fallbackHeight: number = DEFAULT_NODE_HEIGHT/);
    // it calls getNodeWidth with the VARIABLE fallback, not the literal —
    // the registry ban must never fire on the r41 canonical.
    expect(codeLines('src/visualization/layout-utils.ts').some((l) => RAW_PAIR_W.test(l))).toBe(false);
  });
});
