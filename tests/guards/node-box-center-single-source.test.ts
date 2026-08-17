/**
 * @jest-environment node
 */
/**
 * node-box-center-single-source.test.ts — round 47.
 *
 * Family: the NODE BOX-CENTER geometry — given a positioned node whose x/y is
 * the top-LEFT corner, the center is `{x: n.x + width/2, y: n.y + height/2}`
 * — was re-derived inline at ~19 sites across nine files (edge-crossing-
 * minimizer ×3, cycle-strategy ×2, layout-auto-optimizer ×4 — centroid folds
 * ×3 + per-node read, LayoutOptimizer ×2, force-directed-params ×2,
 * complex-layout-engine ×2 fallback edge blocks, visual-balance-scorer ×1,
 * ezo calculateMoveVector, multi-format-exporter PDF edges), each copy free
 * to drop the origin term, halve the wrong axis, or drift its dimension
 * fallback. Canonical since round 47: `calculateNodeCenter` /
 * `nodesCentroid` in src/visualization/layout-utils.ts, with a PER-AXIS
 * fallback seam (`widthFallback`/`heightFallback`).
 *
 * Why the seam is per-axis: `getNodeWidth` defaults a missing dimension to
 * 120 (DEFAULT_NODE_WIDTH) but `getNodeHeight` to 60 (DEFAULT_NODE_HEIGHT).
 * The retired sites split into read policies — bare `getNodeWidth(n)`
 * (render-default), explicit `getNodeWidth(n, 0)` (geometry-neutral),
 * `getNodeWidth(n, this.config.nodeWidth)` (config), `(n.x || 0)` /
 * `(n?.x ?? 0)` (defensive coordinate) — and a single shared fallback number
 * would shift the y axis by 30 for every DEFAULT-policy site. The seam makes
 * each delegation bit-identical (Object.is) to its retired site-local form.
 *
 * Three sites r46 had scoped out ("a conscious round, not this sweep") are
 * resolved HERE by that seam: LayoutOptimizer's config-fallback anchors, the
 * force-directed-params center diffs, and the exporter's `|| 0` reads.
 *
 * DRIFT SCENARIO this guard defends against: one engine computes a node's
 * center at its corner (fallback 0) while another computes it at the
 * render-default box (120/60) — the same node's "center" then differs by up
 * to 60px/30px between the overlap resolver that pushes nodes apart and the
 * edge builder that attaches edges, so edges visually detach from node
 * centers exactly on dimensionless nodes.
 *
 * Layers:
 *   1. VERBATIM ORACLE — the retired inline forms (zero-fallback,
 *      render-default bare, DEFAULT-explicit, config-parametric, `|| 0`
 *      coercion, `?? 0` phantom, centroid folds) frozen below, must be
 *      Object.is-identical to the canonical over a seeded fuzz corpus
 *      spanning explicit/alias/missing/NaN/zero/negative dimensions and
 *      special coordinates (-0/Infinity/NaN).
 *   2. SEMANTIC PINS — the per-axis fallback seam (0 vs DEFAULT vs config,
 *      including the y-by-30 asymmetric hazard), NaN coordinate propagation
 *      vs the visual-balance-scorer sanitize chokepoint, nodesCentroid empty
 *      contract + accumulation order, the applyParams divergence pin (the
 *      pre-existing 0-fallback-centroid vs DEFAULT-per-node split, kept and
 *      documented — not "fixed"), and the UNGROUPED-FOLD scope-out witness
 *      (ezo calculateOptimalSeparation stays inline because
 *      `a + b/2 - c - d/2` ≠ `(a+b/2) - (c+d/2)` on 1e16-scale floats —
 *      pinned with a concrete divergence pair).
 *   3. SOURCE ANCHORS — each migrated file delegates with its policy's
 *      fallback args, the canonical bodies appear exactly once, the retired
 *      shapes are gone, and strategy-edges#centerAnchor COMPOSES the
 *      canonical (one center definition, not two).
 *
 * The "no site re-inlines the box-center fold" discovery sweep lives in the
 * shared registry (frozen-literal-families/node-box-center.ts); this file
 * holds the behavioral pins.
 */

import { describe, it, expect } from '@jest/globals';
import { mulberry32 } from '@tests/helpers/fuzz';
import { readSource } from '@tests/guards/freeze-guard';
import { calculateNodeCenter, nodesCentroid } from '@/visualization/layout-utils';
import { centerAnchor } from '@/visualization/strategy-edges';
import { getNodeWidth, getNodeHeight, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from '@/visualization/node-dimensions';
import { VisualBalanceScorer } from '@/visualization/visual-balance-scorer';
import type { PositionedNode } from '@/types/diagram';

// ---------------------------------------------------------------------------
// Layer 1 material: the VERBATIM pre-round-47 expressions, frozen from the
// migrated files at 1db745e5 (round 46 HEAD). Do not "improve" these copies:
// their job is to be the old behavior, not good behavior.
// ---------------------------------------------------------------------------

type Pt = { x: number; y: number };

/** Zero-fallback — verbatim from edge-crossing-minimizer ×3 / cycle ×2 /
 *  layout-auto-optimizer centroid ×3 / ezo moveVector / visual-balance-scorer
 *  (`getNodeWidth(n, 0)` forms). */
function legacyZero(n: PositionedNode): Pt {
  const w = getNodeWidth(n, 0);
  const h = getNodeHeight(n, 0);
  return { x: n.x + w / 2, y: n.y + h / 2 };
}

/** Render-default bare — verbatim from layout-auto-optimizer applyParams map
 *  body and force-directed-params (`getNodeWidth(n)` forms, fallback 120/60). */
function legacyDefaultBare(n: PositionedNode): Pt {
  const w = getNodeWidth(n);
  const h = getNodeHeight(n);
  return { x: n.x + w / 2, y: n.y + h / 2 };
}

/** DEFAULT-explicit — verbatim from strategy-edges#centerAnchor's pre-round-47
 *  body (now composing the canonical instead). */
function legacyDefaultExplicit(n: PositionedNode): Pt {
  return {
    x: n.x + getNodeWidth(n, DEFAULT_NODE_WIDTH) / 2,
    y: n.y + getNodeHeight(n, DEFAULT_NODE_HEIGHT) / 2,
  };
}

/** Config-fallback — verbatim from LayoutOptimizer's circular edge points /
 *  importance centroid (`this.config.nodeWidth` forms). */
function legacyConfig(n: PositionedNode, cw: number, ch: number): Pt {
  return {
    x: n.x + getNodeWidth(n, cw) / 2,
    y: n.y + getNodeHeight(n, ch) / 2,
  };
}

/** `|| 0` defensive coordinate — verbatim from multi-format-exporter PDF
 *  edges (also coerces -0/NaN to 0 BEFORE the geometry). */
function legacyCoerce(n: PositionedNode): Pt {
  const fx = (n.x || 0) + getNodeWidth(n) / 2;
  const fy = (n.y || 0) + getNodeHeight(n) / 2;
  return { x: fx, y: fy };
}

/** `?? 0` phantom-node — verbatim from complex-layout-engine's two fallback
 *  edge blocks (undefined coordinate/node collapse to 0 + default box). */
function legacyPhantom(n: PositionedNode | undefined): Pt {
  return {
    x: (n?.x ?? 0) + getNodeWidth(n ?? {}) / 2,
    y: (n?.y ?? 0) + getNodeHeight(n ?? {}) / 2,
  };
}

/** Centroid fold — verbatim from layout-auto-optimizer's three
 *  `let sumX = 0; for … sumX += n.x + w / 2; sumX / nodes.length` folds. */
function legacyCentroidFold(nodes: readonly PositionedNode[]): Pt {
  let sumX = 0;
  let sumY = 0;
  for (const n of nodes) {
    const w = getNodeWidth(n, 0);
    const h = getNodeHeight(n, 0);
    sumX += n.x + w / 2;
    sumY += n.y + h / 2;
  }
  return { x: sumX / nodes.length, y: sumY / nodes.length };
}

/** LayoutOptimizer importance-centroid fold — verbatim (config fallbacks,
 *  two independent reduces — same accumulation order as one combined loop). */
function legacyConfigCentroidFold(nodes: readonly PositionedNode[], cw: number, ch: number): Pt {
  const cx = nodes.reduce((sum, n) => sum + (n.x + getNodeWidth(n, cw) / 2), 0) / nodes.length;
  const cy = nodes.reduce((sum, n) => sum + (n.y + getNodeHeight(n, ch) / 2), 0) / nodes.length;
  return { x: cx, y: cy };
}

// ---------------------------------------------------------------------------
// Corpus: seeded nodes spanning the dimension-read axes and coordinate edge
// cases the retired forms lived on.
// ---------------------------------------------------------------------------

const SPECIAL_COORDS = [0, -0, NaN, Infinity, -Infinity, 0.5, -137.25, 1920, 9000];

interface CorpusNode extends Partial<PositionedNode> {}
type CorpusCase = { name: string; node: CorpusNode };

function buildCorpus(): CorpusCase[] {
  const rng = mulberry32(4721);
  const cases: CorpusCase[] = [];
  const dimShapes: Array<(id: string, x: number, y: number) => CorpusNode> = [
    (id, x, y) => ({ id, label: id, x, y, width: 200, height: 80 }), // explicit both
    (id, x, y) => ({ id, label: id, x, y, w: 77, h: 33 }), // alias only
    (id, x, y) => ({ id, label: id, x, y, width: 200, w: 77, height: 80, h: 33 }), // both pairs (width wins)
    (id, x, y) => ({ id, label: id, x, y }), // dimensionless → the fallback seam
    (id, x, y) => ({ id, label: id, x, y, width: NaN, height: NaN }), // NaN extents → fallbacks
    (id, x, y) => ({ id, label: id, x, y, width: 0, height: 0 }), // zero extents
    (id, x, y) => ({ id, label: id, x, y, width: -40, height: -15 }), // negative extents
    (id, x, y) => ({ id, label: id, x, y, width: 200 }), // width only (per-axis asymmetry)
    (id, x, y) => ({ id, label: id, x, y, height: 80 }), // height only
  ];
  for (let i = 0; i < 80; i++) {
    const dim = dimShapes[Math.floor(rng() * dimShapes.length)];
    const x = i < SPECIAL_COORDS.length ? SPECIAL_COORDS[i] : Math.floor(rng() * 3000) - 500;
    const y = i < SPECIAL_COORDS.length ? SPECIAL_COORDS[(i + 4) % SPECIAL_COORDS.length] : Math.floor(rng() * 3000) - 500;
    cases.push({ name: `fuzz-${i}`, node: dim('n', x, y) });
  }
  cases.push({ name: 'nan-x', node: { id: 'n', label: 'n', x: NaN, y: 10, width: 100, height: 40 } });
  cases.push({ name: 'neg-zero', node: { id: 'n', label: 'n', x: -0, y: -0 } });
  return cases;
}

const CORPUS = buildCorpus();

const asNode = (n: CorpusNode): PositionedNode => n as unknown as PositionedNode;

function expectPointIdentical(actual: Pt, legacy: Pt): void {
  expect(Object.is(actual.x, legacy.x)).toBe(true);
  expect(Object.is(actual.y, legacy.y)).toBe(true);
}

describe('round 47: node box-center single source — layer 1 verbatim oracle', () => {
  it.each(CORPUS)('each read policy equals its retired site-local form over $name', ({ node }) => {
    const n = asNode(node);
    // zero-fallback policy (9 retired sites)
    expectPointIdentical(calculateNodeCenter(n), legacyZero(n));
    // render-default policy (2 retired sites) — explicit DEFAULT args
    expectPointIdentical(calculateNodeCenter(n, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT), legacyDefaultBare(n));
    expectPointIdentical(calculateNodeCenter(n, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT), legacyDefaultExplicit(n));
    // config policy (LayoutOptimizer) — ANY config pair, per axis
    expectPointIdentical(calculateNodeCenter(n, 90, 45), legacyConfig(n, 90, 45));
    expectPointIdentical(calculateNodeCenter(n, 0, 300), legacyConfig(n, 0, 300));
    // defensive-coordinate policy (exporter `|| 0`) — pre-guard at the site
    const coerced: PositionedNode = { ...n, x: n.x || 0, y: n.y || 0 } as PositionedNode;
    expectPointIdentical(calculateNodeCenter(coerced, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT), legacyCoerce(n));
  });

  it.each(CORPUS)('the phantom-node policy (CLE `?? 0`) equals the delegated pre-guard form over $name', ({ node }) => {
    const n = asNode(node);
    const delegated = calculateNodeCenter(
      (n ?? { x: 0, y: 0 }) as PositionedNode,
      DEFAULT_NODE_WIDTH,
      DEFAULT_NODE_HEIGHT,
    );
    expectPointIdentical(delegated, legacyPhantom(n));
    // the missing node collapses to the default box center at the origin
    expectPointIdentical(
      calculateNodeCenter({ x: 0, y: 0 } as PositionedNode, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT),
      legacyPhantom(undefined),
    );
  });

  it('the corpus is real: fallback, alias, NaN-extent, per-axis and NaN-coordinate axes all fire', () => {
    const dimensionless = asNode({ id: 'd', label: 'd', x: 100, y: 50 });
    // fallback 0 = geometry-neutral: center IS the corner.
    expect(calculateNodeCenter(dimensionless)).toEqual({ x: 100, y: 50 });
    // DEFAULT fallback = the render box.
    expect(calculateNodeCenter(dimensionless, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT)).toEqual({ x: 160, y: 80 });
    // alias axis: width NaN but w finite → w wins (getNodeWidth policy).
    const aliasWins = asNode({ id: 'w', label: 'w', x: 0, y: 0, width: NaN, w: 77, h: 33 });
    expect(calculateNodeCenter(aliasWins)).toEqual({ x: 38.5, y: 16.5 });
    // NaN-extent axis → fallback (not NaN).
    const nanExtent = asNode({ id: 'n', label: 'n', x: 100, y: 50, width: NaN, height: NaN });
    expect(calculateNodeCenter(nanExtent, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT)).toEqual({ x: 160, y: 80 });
    // NaN coordinate → NaN propagates (the retired forms' raw-read policy).
    const nanCoord = asNode({ id: 'c', label: 'c', x: NaN, y: 10, width: 100, height: 40 });
    expect(Object.is(calculateNodeCenter(nanCoord).x, NaN)).toBe(true);
    expect(calculateNodeCenter(nanCoord).y).toBe(30);
  });
});

describe('round 47: node box-center — layer 1 centroid oracle', () => {
  it('nodesCentroid equals the retired inline folds, same accumulation order (bitwise)', () => {
    const rng = mulberry32(4747);
    for (let trial = 0; trial < 60; trial++) {
      const count = 1 + Math.floor(rng() * 12);
      const nodes: PositionedNode[] = [];
      for (let i = 0; i < count; i++) {
        const shape = Math.floor(rng() * 4);
        const x = Math.floor(rng() * 2000) - 300;
        const y = Math.floor(rng() * 2000) - 300;
        if (shape === 0) nodes.push({ id: `n${i}`, label: `n${i}`, x, y, width: 150, height: 70 } as PositionedNode);
        else if (shape === 1) nodes.push({ id: `n${i}`, label: `n${i}`, x, y } as PositionedNode); // fallback seam
        else if (shape === 2) nodes.push({ id: `n${i}`, label: `n${i}`, x, y, w: 90, h: 40 } as PositionedNode);
        else nodes.push({ id: `n${i}`, label: `n${i}`, x: -x, y: -y, width: NaN, height: NaN } as PositionedNode);
      }
      // zero-fallback fold (layout-auto-optimizer's three folds)
      const got = nodesCentroid(nodes);
      const legacy = legacyCentroidFold(nodes);
      expect(Object.is(got.x, legacy.x)).toBe(true);
      expect(Object.is(got.y, legacy.y)).toBe(true);
      // config-fallback fold (LayoutOptimizer adjustSpacingByImportance)
      const gotCfg = nodesCentroid(nodes, 110, 55);
      const legacyCfg = legacyConfigCentroidFold(nodes, 110, 55);
      expect(Object.is(gotCfg.x, legacyCfg.x)).toBe(true);
      expect(Object.is(gotCfg.y, legacyCfg.y)).toBe(true);
    }
  });

  it('empty input returns the {0,0} contract (calculateClusterCentroid precedent)', () => {
    expect(nodesCentroid([])).toEqual({ x: 0, y: 0 });
    // every migrated call site early-returns on empty BEFORE the fold; the
    // branch exists so the helper never synthesizes NaN (0/0).
  });
});

// ---------------------------------------------------------------------------
// Layer 2: semantic pins — the fallback seam, NaN policies, the documented
// divergence, and the ungrouped-fold scope-out witness.
// ---------------------------------------------------------------------------

describe('round 47: node box-center — layer 2 semantic pins', () => {
  const n = (over: Partial<PositionedNode>): PositionedNode =>
    ({ id: 'x', label: 'x', x: 100, y: 200, width: 200, height: 80, ...over } as PositionedNode);

  it('explicit dimensions ignore the fallbacks entirely', () => {
    expect(calculateNodeCenter(n({}), 0, 0)).toEqual({ x: 200, y: 240 });
    expect(calculateNodeCenter(n({}), 999, 999)).toEqual({ x: 200, y: 240 });
  });

  it('the seam is PER-AXIS: one shared number would shift y by 30', () => {
    const dim = n({ width: undefined, height: undefined, w: undefined, h: undefined });
    // width-only fallback fires on x, height axis stays neutral:
    expect(calculateNodeCenter(dim, DEFAULT_NODE_WIDTH, 0)).toEqual({ x: 160, y: 200 });
    // height-only fallback fires on y, x axis stays neutral:
    expect(calculateNodeCenter(dim, 0, DEFAULT_NODE_HEIGHT)).toEqual({ x: 100, y: 230 });
    // the hazard itself: passing ONE number for both axes (the pre-seam
    // design) would have moved every DEFAULT-policy site's y by 30.
    expect(calculateNodeCenter(dim, DEFAULT_NODE_WIDTH, 0).y).not.toBe(
      calculateNodeCenter(dim, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT).y,
    );
  });

  it('per-axis fallbacks fire independently on half-present dimensions', () => {
    const widthOnly = n({ height: undefined, h: undefined });
    expect(calculateNodeCenter(widthOnly, 60, 30)).toEqual({ x: 200, y: 215 });
    const heightOnly = n({ width: undefined, w: undefined });
    expect(calculateNodeCenter(heightOnly, 60, 30)).toEqual({ x: 130, y: 240 });
  });

  it('NaN coordinates propagate raw; the visual-balance-scorer keeps its sanitize chokepoint (live witness)', () => {
    const poisoned = n({ x: NaN, y: NaN });
    expect(Object.is(calculateNodeCenter(poisoned).x, NaN)).toBe(true);
    // The scorer sanitizes x/y BEFORE the geometry — its ingestion chokepoint
    // survived the delegation, so one NaN position still cannot poison the
    // centroid/quadrant/density aggregates.
    const scorer = new VisualBalanceScorer();
    const result = scorer.calculateVisualBalance([poisoned, n({ id: 'ok' })], { width: 1920, height: 1080 });
    expect(Number.isFinite(result.centroid.x)).toBe(true);
    expect(Number.isFinite(result.overallScore)).toBe(true);
    // the poisoned node's sanitized center is its corner at the origin plus
    // half its EXPLICIT box (width 200/height 80); the healthy node's is its
    // own box-center — the mean is finite and exactly this.
    expect(result.centroid.x).toBeCloseTo((0 + 200 / 2 + 100 + 200 / 2) / 2, 10);
    expect(result.centroid.y).toBeCloseTo((0 + 80 / 2 + 200 + 80 / 2) / 2, 10);
  });

  it('applyParams divergence pin: 0-fallback centroid vs DEFAULT per-node reads is PRE-EXISTING and kept', () => {
    // layout-auto-optimizer.applyParams reads the centroid with fallback 0
    // (geometry-neutral) but each node's own center with DEFAULT fallbacks
    // (render box). On a dimensionless node the two policies disagree by
    // 60/30 — a split that predates round 47. Converging them is a behavior
    // change, NOT a deduplication; this pin documents the split instead of
    // papering over it.
    const dim = asNode({ id: 'd', label: 'd', x: 0, y: 0 });
    const centroidRead = nodesCentroid([dim]); // the applyParams centroid call
    const perNodeRead = calculateNodeCenter(dim, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT); // the map body
    expect(centroidRead).toEqual({ x: 0, y: 0 });
    expect(perNodeRead).toEqual({ x: 60, y: 30 });
    expect(centroidRead).not.toEqual(perNodeRead); // the divergence, pinned
  });

  it('UNGROUPED-FOLD scope witness: ezo calculateOptimalSeparation cannot delegate (regrouping hazard)', () => {
    // The retired ezo fold is UNGROUPED: `a + b/2 - c - d/2` evaluates as
    // ((a + b/2) − c) − d/2, while the canonical pair form is
    // (a + b/2) − (c + d/2). These groupings disagree on exotic floats —
    // this concrete 1e16-scale pair proves the hazard is real, i.e. the
    // scope-out is a bit-safety requirement, not an oversight.
    const a = 1e16, b = 1, c = 1, d = 1;
    const ungrouped = a + b / 2 - c - d / 2;
    const grouped = (a + b / 2) - (c + d / 2);
    expect(ungrouped).toBe(1e16);
    expect(grouped).toBe(9999999999999998);
    expect(ungrouped).not.toBe(grouped);
  });

  it('strategy-edges#centerAnchor COMPOSES the canonical (one center definition)', () => {
    for (const { node } of CORPUS.slice(0, 30)) {
      const n = asNode(node);
      expectPointIdentical(centerAnchor(n), calculateNodeCenter(n, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT));
    }
  });
});

// ---------------------------------------------------------------------------
// Layer 3: source anchors — delegation shapes at every migrated site, the
// canonical bodies exactly once, the retired shapes gone, the scope-outs
// documented.
// ---------------------------------------------------------------------------

describe('round 47: node box-center — layer 3 source anchors', () => {
  it('layout-utils holds the canonical bodies exactly once', () => {
    const src = readSource('src/visualization/layout-utils.ts');
    expect((src.match(/export function calculateNodeCenter\(/g) ?? []).length).toBe(1);
    expect((src.match(/export function nodesCentroid\(/g) ?? []).length).toBe(1);
    // The canonical reads dimensions exactly four times (center + centroid's
    // delegation has none of its own): center x/y, and no stray raw reads.
    expect((src.match(/getNodeWidth\(node, widthFallback\) \/ 2/g) ?? []).length).toBe(1);
    expect((src.match(/getNodeHeight\(node, heightFallback\) \/ 2/g) ?? []).length).toBe(1);
  });

  it('edge-crossing-minimizer delegates all three sites (fallback 0) and re-inlines none', () => {
    const src = readSource('src/visualization/edge-crossing-minimizer.ts');
    expect((src.match(/calculateNodeCenter\(n\)/g) ?? []).length).toBe(3);
    expect(src).not.toMatch(/const w = getNodeWidth\(n, 0\);/);
    expect(src).not.toMatch(/x: n\.x \+ w \/ 2/);
    // the mutation-then-read order in the displacement loop is load-bearing
    // (the center follows the JUST-MUTATED position) — the comment pins it.
    expect(src).toMatch(/positions\.set\(n\.id, calculateNodeCenter\(n\)\);/);
  });

  it('cycle-strategy delegates both blocks (fallback 0)', () => {
    const src = readSource('src/visualization/strategies/cycle-strategy.ts');
    expect((src.match(/const aCenter = calculateNodeCenter\(a\);/g) ?? []).length).toBe(1);
    expect((src.match(/const bCenter = calculateNodeCenter\(b\);/g) ?? []).length).toBe(1);
    expect((src.match(/const nCenter = calculateNodeCenter\(n\);/g) ?? []).length).toBe(1);
    expect(src).not.toMatch(/const aCx = a\.x \+ getNodeWidth\(a, 0\) \/ 2;/);
    expect(src).not.toMatch(/const ncx = n\.x \+ getNodeWidth\(n, 0\) \/ 2;/);
    // the DEFAULT reads that REMAIN are the sizing reads (different concept)
    expect(src).toMatch(/getNodeWidth\(nd, DEFAULT_NODE_WIDTH\)/);
  });

  it('layout-auto-optimizer delegates 4 sites with the divergence documented', () => {
    const src = readSource('src/visualization/layout-auto-optimizer.ts');
    // three centroid folds (applyParams / recenter / module-level recenter)
    expect((src.match(/nodesCentroid\((nodes|optNodes)\)/g) ?? []).length).toBe(3);
    // the per-node map read keeps DEFAULT fallbacks
    expect((src.match(/calculateNodeCenter\(n, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT\)/g) ?? []).length).toBe(1);
    expect(src).not.toMatch(/cx \+= n\.x \+ w \/ 2;/);
    expect(src).not.toMatch(/sumX \+= n\.x \+ w \/ 2;/);
    // the applyParams 0-vs-DEFAULT split is DOCUMENTED at the site (the
    // layer-2 divergence pin's source-side anchor)
    expect(src).toMatch(/NOTE the deliberate per-site/);
  });

  it('LayoutOptimizer delegates both sites with config fallbacks threaded per axis', () => {
    const src = readSource('src/visualization/strategies/LayoutOptimizer.ts');
    expect((src.match(/calculateNodeCenter\(fromNode, this\.config\.nodeWidth, this\.config\.nodeHeight\)/g) ?? []).length).toBe(1);
    expect((src.match(/calculateNodeCenter\(toNode, this\.config\.nodeWidth, this\.config\.nodeHeight\)/g) ?? []).length).toBe(1);
    expect((src.match(/nodesCentroid\(layout\.nodes, this\.config\.nodeWidth, this\.config\.nodeHeight\)/g) ?? []).length).toBe(1);
    expect(src).not.toMatch(/fromNode\.x \+ getNodeWidth\(fromNode, this\.config\.nodeWidth\) \/ 2/);
    expect(src).not.toMatch(/reduce\(\(sum, n\) => sum \+ \(n\.x \+ getNodeWidth\(n, this\.config\.nodeWidth\) \/ 2\), 0\)/);
  });

  it('force-directed-params delegates both pair-delta sites with explicit DEFAULT fallbacks', () => {
    const src = readSource('src/visualization/force-directed-params.ts');
    expect((src.match(/calculateNodeCenter\(node1, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT\)/g) ?? []).length).toBe(1);
    expect((src.match(/calculateNodeCenter\(node2, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT\)/g) ?? []).length).toBe(1);
    expect((src.match(/calculateNodeCenter\(source, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT\)/g) ?? []).length).toBe(1);
    expect((src.match(/calculateNodeCenter\(target, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT\)/g) ?? []).length).toBe(1);
    expect(src).not.toMatch(/\(node2\.x \+ getNodeWidth\(node2\) \/ 2\) - \(node1\.x/);
    expect(src).not.toMatch(/\(target\.x \+ getNodeWidth\(target\) \/ 2\) - \(source\.x/);
  });

  it('complex-layout-engine keeps the missing-node pre-guard and delegates the geometry', () => {
    const src = readSource('src/visualization/complex-layout-engine.ts');
    expect((src.match(/calculateNodeCenter\(\(fromNode \?\? \{ x: 0, y: 0 \}\) as PositionedNode, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT\)/g) ?? []).length).toBe(2);
    expect((src.match(/calculateNodeCenter\(\(toNode \?\? \{ x: 0, y: 0 \}\) as PositionedNode, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT\)/g) ?? []).length).toBe(2);
    expect(src).not.toMatch(/\{ x: \(fromNode\?\.x \?\? 0\) \+ getNodeWidth/);
  });

  it('multi-format-exporter keeps the `|| 0` pre-guard on the spread clone', () => {
    const src = readSource('src/export/multi-format-exporter.ts');
    expect((src.match(/calculateNodeCenter\(\{ \.\.\.from, x: from\.x \|\| 0, y: from\.y \|\| 0 \}, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT\)/g) ?? []).length).toBe(1);
    expect((src.match(/calculateNodeCenter\(\{ \.\.\.to, x: to\.x \|\| 0, y: to\.y \|\| 0 \}, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT\)/g) ?? []).length).toBe(1);
    expect(src).not.toMatch(/const fx = \(from\.x \|\| 0\) \+ getNodeWidth\(from\) \/ 2/);
  });

  it('visual-balance-scorer stays the sanitize chokepoint and delegates the geometry', () => {
    const src = readSource('src/visualization/visual-balance-scorer.ts');
    expect(src).toMatch(/return calculateNodeCenter\(\{\s*\.\.\.node,\s*x: sanitizeFinite\(node\.x, 0\),\s*y: sanitizeFinite\(node\.y, 0\),\s*\}\);/);
    expect(src).not.toMatch(/sanitizeFinite\(node\.x, 0\) \+ nodeWidth\(node, 0\) \/ 2/);
  });

  it('ezo: moveVector delegates (grouped form); the ungrouped separation fold stays INLINE by design', () => {
    const src = readSource('src/visualization/enhanced-zero-overlap-layout.ts');
    expect(src).toMatch(/const c1 = calculateNodeCenter\(node1\);/);
    expect(src).toMatch(/const c2 = calculateNodeCenter\(node2\);/);
    expect(src).not.toMatch(/const dx = \(node1\.x \+ n1w \/ 2\) - \(node2\.x \+ n2w \/ 2\);/);
    // the scope-out: the ungrouped fold must KEEP its raw reads (delegating
    // it would regroup the subtraction — the layer-2 witness pair).
    expect(src).toMatch(/const centerDx = node1\.x \+ n1w \/ 2 - node2\.x - n2w \/ 2;/);
    expect(src).toMatch(/UNGROUPED/);
  });

  it('strategy-edges#centerAnchor composes the canonical, not a second fold', () => {
    const src = readSource('src/visualization/strategy-edges.ts');
    expect(src).toMatch(/return calculateNodeCenter\(node, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT\);/);
    // The retired CENTER fold is the adjacent x+y pair — the side anchors
    // (bottom/top-center) legitimately keep their single-axis half-extent
    // reads, so the ban is shape-specific, not name-broad.
    expect(src).not.toMatch(/x: node\.x \+ getNodeWidth\(node\) \/ 2,\s*\n\s*y: node\.y \+ getNodeHeight\(node\) \/ 2,/);
  });
});
