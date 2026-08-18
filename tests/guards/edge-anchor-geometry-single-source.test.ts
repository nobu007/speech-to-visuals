/**
 * @jest-environment node
 */
/**
 * edge-anchor-geometry-single-source.test.ts — round 46.
 *
 * Family: the ANCHOR GEOMETRY of a straight-line edge endpoint — where on a
 * positioned node an edge attaches — was re-derived inline at every site:
 * the center half-extent `{x: n.x + getNodeWidth(n) / 2, y: n.y +
 * getNodeHeight(n) / 2}` (ezo timeline edges + collision-balance centers,
 * complex-layout-engine cluster edges, FallbackLayoutStrategy cycle/matrix,
 * v2 centerToCenterAnchors), the bottom→top vertical-flow pair (v2 timeline
 * `verticalFlowAnchors`, v1 tree, FallbackLayoutStrategy flow), the
 * right→left horizontal-flow pair (v1 timeline, FallbackLayoutStrategy
 * timeline), and the pair-dependent flanks (v1 + v2 comparison). Canonical
 * since round 46: the point helpers (centerAnchor + the four side anchors)
 * and the pair helpers (verticalFlowAnchors, horizontalFlowAnchors,
 * flankAnchors, centerToCenterAnchors) in src/visualization/strategy-edges.ts.
 * Zero-delta round: every delegation is bit-identical (Object.is) to the
 * retired expression, NaN propagation included — the retired forms read raw
 * coordinates and so does the canonical.
 *
 * DRIFT SCENARIO this guard defends against: one copy drops the `+ node.x`
 * origin term (the anchor snaps to the half-extent alone — an edge endpoint
 * near the origin for every node), halves the wrong axis, or reads the
 * extent off raw `.width` (NaN-unsafe), and one engine's edge endpoints
 * silently disagree with another's about the SAME node — e.g. ezo's timeline
 * edges arriving at a node's top-left corner while v2 timeline's arrive at
 * its center. At round 32 each side-anchor policy had ONE site so the
 * geometry deliberately stayed in the strategy files; by round 46 the
 * vertical pair had three sites and the flanks two — the premise expired,
 * and this round froze the geometry before a fork could open.
 *
 * Layers:
 *   1. VERBATIM ORACLE — the retired inline forms (nine shapes across the
 *      seven pre-round-46 flavors), frozen below, must be Object.is-identical
 *      to the canonical over a seeded fuzz corpus spanning explicit/alias/
 *      missing dimensions, NaN coordinates and NaN extents, and -0. Any
 *      dropped term, halved wrong axis, or swapped anchor order diverges
 *      here.
 *   2. SEMANTIC PINS + DELEGATION WITNESSES — exact anchor coordinates for
 *      crafted nodes (default-fallback 120/60 witness, w-alias witness, NaN
 *      propagation, flank direction including the equal-x tie branch), and
 *      the LIVE strategies (Fallback all five diagram types, v1 tree/
 *      timeline/comparison, v2 timeline/comparison, ezo timeline) emit edge
 *      points equal to the frozen legacy formulas over their own positioned
 *      nodes.
 *   3. SOURCE ANCHORS — each of the 14 migrated delegation blocks (Fallback
 *      ×4, cluster ×1, ezo ×2, v1 ×3, v2 ×2, network force-math ×2) delegates to a
 *      canonical helper with its own skeleton (find/dangling policy stays at
 *      the site), the canonical bodies appear exactly once, and the retired
 *      shapes are gone.
 *
 * Scope-outs pinned in layer 3 (different READ POLICIES, not this family):
 * the complex-layout-engine worker/fallback `?? 0` phantom reads and the
 * multi-format-exporter `|| 0` reads guard the COORDINATE (and the missing
 * node); converging them onto the raw-read canonical is a behavior question,
 * not a deduplication. force-directed-params' center diffs live inside the
 * round-40 frozen step body.
 *
 * The "no site re-inlines the anchor geometry" discovery sweep lives in the
 * shared registry (frozen-literal-families/edge-anchor-geometry.ts); this
 * file holds the behavioral pins.
 */

import { describe, it, expect } from '@jest/globals';
import { mulberry32 } from '@tests/helpers/fuzz';
import { readSource } from '@tests/guards/freeze-guard';
import {
  centerAnchor,
  bottomCenterAnchor,
  topCenterAnchor,
  rightCenterAnchor,
  leftCenterAnchor,
  centerToCenterAnchors,
  verticalFlowAnchors,
  horizontalFlowAnchors,
  flankAnchors,
} from '@/visualization/strategy-edges';
import { getNodeWidth, getNodeHeight, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from '@/visualization/node-dimensions';
import type { PositionedNode, NodeDatum, EdgeDatum, LayoutEdge } from '@stv/core/types/diagram';
import type { LayoutConfig } from '@/visualization/types';
import { FallbackLayoutStrategy } from '@/visualization/strategies/FallbackLayoutStrategy';
import { TreeLayoutStrategy } from '@/visualization/strategies/TreeLayoutStrategy';
import { TimelineLayoutStrategy } from '@/visualization/strategies/TimelineLayoutStrategy';
import { ComparisonLayoutStrategy } from '@/visualization/strategies/ComparisonLayoutStrategy';
import { TimelineStrategy as V2TimelineStrategy } from '@/visualization/strategies/timeline-strategy';
import { comparisonStrategy } from '@/visualization/strategies/comparison-strategy';
import { EnhancedZeroOverlapLayoutEngine } from '@/visualization/enhanced-zero-overlap-layout';

// ---------------------------------------------------------------------------
// Layer 1 material: the VERBATIM pre-round-46 anchor expressions, frozen from
// the migrated files at 81dbf6a3 (round 45 HEAD). Do not "improve" these
// copies: their job is to be the old behavior, not good behavior.
// ---------------------------------------------------------------------------

type Pt = { x: number; y: number };

/** Center — verbatim from ezo edge anchors / CLE cluster / Fallback cycle+matrix. */
function legacyCenterBare(n: PositionedNode): Pt {
  return { x: n.x + getNodeWidth(n) / 2, y: n.y + getNodeHeight(n) / 2 };
}

/** Center — verbatim from the pre-round-46 centerToCenterAnchors (explicit DEFAULT args). */
function legacyCenterExplicit(n: PositionedNode): Pt {
  return {
    x: n.x + getNodeWidth(n, DEFAULT_NODE_WIDTH) / 2,
    y: n.y + getNodeHeight(n, DEFAULT_NODE_HEIGHT) / 2,
  };
}

/** ezo collision-balance center reads — verbatim (four separate locals). */
function legacyEzoBalanceCenters(n1: PositionedNode, n2: PositionedNode): { x1: number; y1: number; x2: number; y2: number } {
  const node1CenterX = n1.x + getNodeWidth(n1) / 2;
  const node1CenterY = n1.y + getNodeHeight(n1) / 2;
  const node2CenterX = n2.x + getNodeWidth(n2) / 2;
  const node2CenterY = n2.y + getNodeHeight(n2) / 2;
  return { x1: node1CenterX, y1: node1CenterY, x2: node2CenterX, y2: node2CenterY };
}

/** Vertical flow — verbatim from the pre-round-46 v2 timeline verticalFlowAnchors (sw/sh/tw locals). */
function legacyV2Vertical(source: PositionedNode, target: PositionedNode): [Pt, Pt] {
  const sw = getNodeWidth(source, DEFAULT_NODE_WIDTH);
  const sh = getNodeHeight(source, DEFAULT_NODE_HEIGHT);
  const tw = getNodeWidth(target, DEFAULT_NODE_WIDTH);
  return [
    { x: source.x + sw / 2, y: source.y + sh },
    { x: target.x + tw / 2, y: target.y },
  ];
}

/** Vertical flow — verbatim from v1 tree (bare reads, trailing comments dropped). */
function legacyV1Tree(source: PositionedNode, target: PositionedNode): [Pt, Pt] {
  return [
    { x: source.x + getNodeWidth(source) / 2, y: source.y + getNodeHeight(source) },
    { x: target.x + getNodeWidth(target) / 2, y: target.y },
  ];
}

/** Vertical flow — verbatim from FallbackLayoutStrategy createFlowLayout (fromNode/toNode). */
function legacyFallbackFlow(fromNode: PositionedNode, toNode: PositionedNode): [Pt, Pt] {
  return [
    { x: fromNode.x + getNodeWidth(fromNode) / 2, y: fromNode.y + getNodeHeight(fromNode) },
    { x: toNode.x + getNodeWidth(toNode) / 2, y: toNode.y },
  ];
}

/** Horizontal flow — verbatim from v1 timeline (right-center → left-center). */
function legacyV1Timeline(source: PositionedNode, target: PositionedNode): [Pt, Pt] {
  return [
    { x: source.x + getNodeWidth(source), y: source.y + getNodeHeight(source) / 2 },
    { x: target.x, y: target.y + getNodeHeight(target) / 2 },
  ];
}

/** Horizontal flow — verbatim from FallbackLayoutStrategy createTimelineLayout. */
function legacyFallbackTimeline(fromNode: PositionedNode, toNode: PositionedNode): [Pt, Pt] {
  return [
    { x: fromNode.x + getNodeWidth(fromNode), y: fromNode.y + getNodeHeight(fromNode) / 2 },
    { x: toNode.x, y: toNode.y + getNodeHeight(toNode) / 2 },
  ];
}

/** Flanks — verbatim from the pre-round-46 v2 comparison sideAnchorPair (sw..th locals). */
function legacyV2Flank(source: PositionedNode, target: PositionedNode): [Pt, Pt] {
  const sourceIsLeft = source.x < target.x;
  const sw = getNodeWidth(source, DEFAULT_NODE_WIDTH);
  const sh = getNodeHeight(source, DEFAULT_NODE_HEIGHT);
  const tw = getNodeWidth(target, DEFAULT_NODE_WIDTH);
  const th = getNodeHeight(target, DEFAULT_NODE_HEIGHT);
  return [
    { x: sourceIsLeft ? source.x + sw : source.x, y: source.y + sh / 2 },
    { x: sourceIsLeft ? target.x : target.x + tw, y: target.y + th / 2 },
  ];
}

/** Flanks — verbatim from v1 comparison (bare reads). */
function legacyV1Comparison(source: PositionedNode, target: PositionedNode): [Pt, Pt] {
  const sourceIsLeft = source.x < target.x;
  return [
    { x: sourceIsLeft ? source.x + getNodeWidth(source) : source.x, y: source.y + getNodeHeight(source) / 2 },
    { x: sourceIsLeft ? target.x : target.x + getNodeWidth(target), y: target.y + getNodeHeight(target) / 2 },
  ];
}

// ---------------------------------------------------------------------------
// Corpus: seeded node pairs spanning the dimension-read axes and the
// coordinate edge cases the retired forms lived on.
// ---------------------------------------------------------------------------

const SPECIAL_COORDS = [0, -0, NaN, Infinity, -Infinity, 0.5, -137.25, 1920, 2500];

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- intentional: "any partial node" corpus type, the empty extension IS the corpus contract
interface CorpusNode extends Partial<PositionedNode> {}
type CorpusCase = { name: string; a: CorpusNode; b: CorpusNode };

function buildCorpus(): CorpusCase[] {
  const rng = mulberry32(4621);
  const cases: CorpusCase[] = [];
  const dimShapes: Array<(id: string, x: number, y: number) => CorpusNode> = [
    (id, x, y) => ({ id, label: id, x, y, width: 200, height: 80 }), // explicit both
    (id, x, y) => ({ id, label: id, x, y, w: 77, h: 33 }), // alias only
    (id, x, y) => ({ id, label: id, x, y, width: 200, w: 77, height: 80, h: 33 }), // both pairs (width wins)
    (id, x, y) => ({ id, label: id, x, y }), // dimensionless → defaults 120/60
    (id, x, y) => ({ id, label: id, x, y, width: NaN, height: NaN }), // NaN extents → defaults
    (id, x, y) => ({ id, label: id, x, y, width: 0, height: 0 }), // zero extents
    (id, x, y) => ({ id, label: id, x, y, width: -40, height: -15 }), // negative extents
  ];
  for (let i = 0; i < 70; i++) {
    const dimA = dimShapes[Math.floor(rng() * dimShapes.length)];
    const dimB = dimShapes[Math.floor(rng() * dimShapes.length)];
    const xa = i < SPECIAL_COORDS.length ? SPECIAL_COORDS[i] : Math.floor(rng() * 3000) - 500;
    const ya = Math.floor(rng() * 3000) - 500;
    const xb = i < SPECIAL_COORDS.length ? SPECIAL_COORDS[(i + 3) % SPECIAL_COORDS.length] : Math.floor(rng() * 3000) - 500;
    const yb = Math.floor(rng() * 3000) - 500;
    cases.push({ name: `fuzz-${i}`, a: dimA('a', xa, ya), b: dimB('b', xb, yb) });
  }
  // crafted: equal-x tie for the flank pair; NaN coordinate propagation.
  cases.push({ name: 'flank-tie', a: { id: 'a', label: 'a', x: 500, y: 100, width: 200, height: 80 }, b: { id: 'b', label: 'b', x: 500, y: 400, width: 200, height: 80 } });
  cases.push({ name: 'nan-coord', a: { id: 'a', label: 'a', x: NaN, y: 10, width: 100, height: 40 }, b: { id: 'b', label: 'b', x: 20, y: NaN, width: 100, height: 40 } });
  return cases;
}

const CORPUS = buildCorpus();

const asNode = (n: CorpusNode): PositionedNode => n as unknown as PositionedNode;

/** Field-wise Object.is over a pair of points (order-sensitive: [source, target]). */
function expectPairEqual(actual: readonly Pt[], legacy: [Pt, Pt], label: string): void {
  expect(actual).toHaveLength(2);
  for (let i = 0; i < 2; i++) {
    expect(Object.is(actual[i].x, legacy[i].x)).toBe(true);
    expect(Object.is(actual[i].y, legacy[i].y)).toBe(true);
  }
  expect(void label).toBe(void 0);
}

describe('round 46: edge anchor geometry single source — layer 1 verbatim oracle', () => {
  it.each(CORPUS)('center/side anchors over $name', ({ a, b }) => {
    const na = asNode(a);
    const nb = asNode(b);
    // The three center flavors (bare sites, explicit-default v2 canonical,
    // ezo balance locals) must agree with centerAnchor bitwise.
    for (const n of [na, nb]) {
      const c = centerAnchor(n);
      expect(Object.is(c.x, legacyCenterBare(n).x)).toBe(true);
      expect(Object.is(c.y, legacyCenterBare(n).y)).toBe(true);
      expect(Object.is(c.x, legacyCenterExplicit(n).x)).toBe(true);
      expect(Object.is(c.y, legacyCenterExplicit(n).y)).toBe(true);
    }
    const bal = legacyEzoBalanceCenters(na, nb);
    expect(Object.is(centerAnchor(na).x, bal.x1)).toBe(true);
    expect(Object.is(centerAnchor(na).y, bal.y1)).toBe(true);
    expect(Object.is(centerAnchor(nb).x, bal.x2)).toBe(true);
    expect(Object.is(centerAnchor(nb).y, bal.y2)).toBe(true);
  });

  it.each(CORPUS)('vertical-flow pair over $name', ({ a, b }) => {
    const na = asNode(a);
    const nb = asNode(b);
    const pair = verticalFlowAnchors(na, nb);
    expectPairEqual(pair, legacyV2Vertical(na, nb), 'v2');
    expectPairEqual(pair, legacyV1Tree(na, nb), 'v1-tree');
    expectPairEqual(pair, legacyFallbackFlow(na, nb), 'fallback-flow');
    expectPairEqual(pair, [bottomCenterAnchor(na), topCenterAnchor(nb)], 'point-composition');
  });

  it.each(CORPUS)('horizontal-flow pair over $name', ({ a, b }) => {
    const na = asNode(a);
    const nb = asNode(b);
    const pair = horizontalFlowAnchors(na, nb);
    expectPairEqual(pair, legacyV1Timeline(na, nb), 'v1-timeline');
    expectPairEqual(pair, legacyFallbackTimeline(na, nb), 'fallback-timeline');
    expectPairEqual(pair, [rightCenterAnchor(na), leftCenterAnchor(nb)], 'point-composition');
  });

  it.each(CORPUS)('flank pair over $name', ({ a, b }) => {
    const na = asNode(a);
    const nb = asNode(b);
    const pair = flankAnchors(na, nb);
    expectPairEqual(pair, legacyV2Flank(na, nb), 'v2');
    expectPairEqual(pair, legacyV1Comparison(na, nb), 'v1');
  });

  it.each(CORPUS)('centerToCenter pair over $name', ({ a, b }) => {
    const na = asNode(a);
    const nb = asNode(b);
    expectPairEqual(centerToCenterAnchors(na, nb), [legacyCenterBare(na), legacyCenterBare(nb)], 'center');
  });

  it('the corpus is real: default-fallback, alias, NaN-extent, and NaN-coordinate axes all fire', () => {
    const dimensionless = asNode({ id: 'd', label: 'd', x: 0, y: 0 });
    // 120/60 defaults — the dimensionless axis.
    expect(centerAnchor(dimensionless)).toEqual({ x: 60, y: 30 });
    // alias axis: width present but NaN, w finite → w wins.
    const aliasWins = asNode({ id: 'w', label: 'w', x: 0, y: 0, width: NaN, w: 77, h: 33 });
    expect(centerAnchor(aliasWins)).toEqual({ x: 38.5, y: 16.5 });
    // NaN-extent axis → defaults (not NaN).
    const nanExtent = asNode({ id: 'n', label: 'n', x: 100, y: 50, width: NaN, height: NaN });
    expect(centerAnchor(nanExtent)).toEqual({ x: 160, y: 80 });
    // NaN-coordinate axis → NaN propagates (the retired forms' policy).
    const nanCoord = asNode({ id: 'c', label: 'c', x: NaN, y: 10, width: 100, height: 40 });
    expect(Object.is(centerAnchor(nanCoord).x, NaN)).toBe(true);
    expect(centerAnchor(nanCoord).y).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// Layer 2: semantic pins (exact crafted values) + live delegation witnesses.
// ---------------------------------------------------------------------------

describe('round 46: edge anchor geometry — layer 2 semantic pins', () => {
  const n = (over: Partial<PositionedNode>): PositionedNode =>
    ({ id: 'x', label: 'x', x: 100, y: 200, width: 200, height: 80, ...over } as PositionedNode);

  it('side anchors land on the exact side midpoints', () => {
    expect(centerAnchor(n({}))).toEqual({ x: 200, y: 240 });          // corner + half extent
    expect(bottomCenterAnchor(n({}))).toEqual({ x: 200, y: 280 });    // y + h
    expect(topCenterAnchor(n({}))).toEqual({ x: 200, y: 200 });       // bare y
    expect(rightCenterAnchor(n({}))).toEqual({ x: 300, y: 240 });     // x + w
    expect(leftCenterAnchor(n({}))).toEqual({ x: 100, y: 240 });      // bare x
  });

  it('the width-origin term survives: dropping it is the drift this family exists to catch', () => {
    // rightCenter without the + x term would be 300 -> 200; center without
    // it would be 200 -> 100. Both exact witnesses pin the term.
    expect(rightCenterAnchor(n({ x: 100, width: 200 })).x).toBe(300);
    expect(rightCenterAnchor(n({ x: 0, width: 200 })).x).toBe(200);
    expect(centerAnchor(n({ x: 100, width: 200 })).x).toBe(200);
  });

  it('flank direction: source left → right→left; source right → left→right; equal x → the else branch', () => {
    const left = n({ id: 'l', x: 100 });
    const right = n({ id: 'r', x: 700 });
    expect(flankAnchors(left, right)).toEqual([
      { x: 300, y: 240 }, // right flank of the left node
      { x: 700, y: 240 }, // left flank of the right node
    ]);
    expect(flankAnchors(right, left)).toEqual([
      { x: 700, y: 240 }, // left flank of the (now-source) right node
      { x: 300, y: 240 }, // right flank of the (now-target) left node
    ]);
    // Tie takes the else-branch exactly like the retired `sourceIsLeft`
    // forms (strict <): source leaves its LEFT flank, target receives on its
    // RIGHT flank.
    const tieA = n({ id: 't1', x: 400, width: 100 });
    const tieB = n({ id: 't2', x: 400, width: 100 });
    expect(flankAnchors(tieA, tieB)).toEqual([
      { x: 400, y: 240 },
      { x: 500, y: 240 },
    ]);
  });

  it('pair helpers keep the [source, target] order — swapped anchors are a drift', () => {
    const src = n({ id: 's', x: 0, y: 0, width: 100, height: 50 });
    const tgt = n({ id: 't', x: 0, y: 500, width: 100, height: 50 });
    expect(verticalFlowAnchors(src, tgt)).toEqual([{ x: 50, y: 50 }, { x: 50, y: 500 }]);
    expect(horizontalFlowAnchors(src, tgt)).toEqual([{ x: 100, y: 25 }, { x: 0, y: 525 }]);
    expect(centerToCenterAnchors(src, tgt)).toEqual([{ x: 50, y: 25 }, { x: 50, y: 525 }]);
  });
});

// ---------------------------------------------------------------------------
// Layer 2b: LIVE delegation witnesses — the migrated emitters produce edge
// points equal to the frozen legacy formulas over their OWN positioned nodes.
// ---------------------------------------------------------------------------

const V1_CONFIG: LayoutConfig = {
  width: 1920,
  height: 1080,
  nodeWidth: 120,
  nodeHeight: 60,
  marginX: 80,
  marginY: 50,
  rankDirection: 'TB',
  nodeSeparation: 70,
  edgeSeparation: 10,
  rankSeparation: 50,
};

const TOPO_NODES: NodeDatum[] = [
  { id: 'n1', label: 'First node', width: 200, height: 80 },
  { id: 'n2', label: 'Second node' },
  { id: 'n3', label: 'Third node', width: 140 },
];
const TOPO_EDGES: EdgeDatum[] = [
  { from: 'n1', to: 'n2', label: 'a' },
  { from: 'n2', to: 'n3', label: 'b' },
  { from: 'n1', to: 'n3', label: 'c' },
];

function pointsByEdge(edges: LayoutEdge[]): Map<string, LayoutEdge['points']> {
  return new Map(edges.map((e) => [`${e.from}->${e.to}`, e.points]));
}

/**
 * Expected-side node lookup MUST mirror each emitter's own policy: the v1
 * builder, FallbackLayoutStrategy, and ezo all use first-match (`find` /
 * the has-guarded map), while the v2 builder's plain `new Map(...)` is
 * last-match. The tree strategy legitimately emits a node twice when an edge
 * skips a level (n1→n3 puts n3 at level 1 AND level 2), so the policies
 * genuinely disagree on real layouts — mirroring them pins which anchor each
 * emitter ACTUALLY reads instead of papering over the duplicate.
 */
function firstById(nodes: PositionedNode[]): Map<string, PositionedNode> {
  const map = new Map<string, PositionedNode>();
  for (const n of nodes) {
    if (!map.has(n.id)) map.set(n.id, n);
  }
  return map;
}

function lastById(nodes: PositionedNode[]): Map<string, PositionedNode> {
  return new Map(nodes.map((n) => [n.id, n]));
}

describe('round 46: edge anchor geometry — layer 2b live delegation witnesses', () => {
  describe('FallbackLayoutStrategy (all five diagram types + grid default)', () => {
    const fallback = new FallbackLayoutStrategy(V1_CONFIG);
    const types: Array<{ type: Parameters<typeof fallback.fallbackLayout>[2]; pair: (a: PositionedNode, b: PositionedNode) => [Pt, Pt] }> = [
      { type: 'flow', pair: (a, b) => [bottomCenterAnchor(a), topCenterAnchor(b)] },
      { type: 'flowchart', pair: (a, b) => [bottomCenterAnchor(a), topCenterAnchor(b)] },
      { type: 'tree', pair: (a, b) => [bottomCenterAnchor(a), topCenterAnchor(b)] },
      { type: 'timeline', pair: (a, b) => [rightCenterAnchor(a), leftCenterAnchor(b)] },
      { type: 'cycle', pair: (a, b) => [centerAnchor(a), centerAnchor(b)] },
      { type: 'matrix', pair: (a, b) => [centerAnchor(a), centerAnchor(b)] },
      { type: 'general', pair: (a, b) => [centerAnchor(a), centerAnchor(b)] }, // grid default
    ];
    it.each(types)('$type emits canonical anchor pairs', ({ type, pair }) => {
      const layout = fallback.fallbackLayout(TOPO_NODES, TOPO_EDGES, type);
      const byId = firstById(layout.nodes); // site skeleton: nodes.find = first-match
      const got = pointsByEdge(layout.edges);
      for (const edge of TOPO_EDGES) {
        const expected = pair(byId.get(edge.from)!, byId.get(edge.to)!);
        const actual = got.get(`${edge.from}->${edge.to}`)!;
        expect(actual).toHaveLength(2);
        expect(Object.is(actual[0].x, expected[0].x)).toBe(true);
        expect(Object.is(actual[0].y, expected[0].y)).toBe(true);
        expect(Object.is(actual[1].x, expected[1].x)).toBe(true);
        expect(Object.is(actual[1].y, expected[1].y)).toBe(true);
      }
    });

    it('the site skeleton stays: a dangling edge keeps the zero-points fallback, NOT canonical anchors', () => {
      const layout = fallback.fallbackLayout(
        TOPO_NODES,
        [{ from: 'n1', to: 'ghost', label: 'dangling' }],
        'flow'
      );
      expect(layout.edges[0].points).toEqual([{ x: 0, y: 0 }, { x: 0, y: 0 }]);
    });
  });

  it('v1 tree/timeline/comparison emit their canonical pairs over their own nodes', async () => {
    const tree = await new TreeLayoutStrategy().generateLayout(TOPO_NODES, TOPO_EDGES, V1_CONFIG);
    const timeline = await new TimelineLayoutStrategy().generateLayout(TOPO_NODES, TOPO_EDGES, V1_CONFIG);
    const comparison = await new ComparisonLayoutStrategy().generateLayout(TOPO_NODES, TOPO_EDGES, V1_CONFIG);

    const assertPair = (
      edges: LayoutEdge[],
      nodes: PositionedNode[],
      pair: (a: PositionedNode, b: PositionedNode) => [Pt, Pt]
    ): void => {
      // v1 builder = first-match-wins (pinned in strategy-edges.ts).
      const byId = firstById(nodes);
      const got = pointsByEdge(edges);
      for (const edge of TOPO_EDGES) {
        const expected = pair(byId.get(edge.from)!, byId.get(edge.to)!);
        const actual = got.get(`${edge.from}->${edge.to}`)!;
        expect(actual).toHaveLength(2);
        for (let i = 0; i < 2; i++) {
          expect(Object.is(actual[i].x, expected[i].x)).toBe(true);
          expect(Object.is(actual[i].y, expected[i].y)).toBe(true);
        }
      }
    };

    assertPair(tree.edges, tree.nodes, (a, b) => [bottomCenterAnchor(a), topCenterAnchor(b)]);
    assertPair(timeline.edges, timeline.nodes, (a, b) => [rightCenterAnchor(a), leftCenterAnchor(b)]);
    assertPair(comparison.edges, comparison.nodes, (a, b) => flankAnchors(a, b) as [Pt, Pt]);
  });

  it('v2 timeline/comparison emit their canonical pairs over their own nodes', () => {
    const timeline = new V2TimelineStrategy().apply(TOPO_NODES, TOPO_EDGES);
    const comparison = comparisonStrategy.apply(TOPO_NODES, TOPO_EDGES);

    const assertPair = (edges: LayoutEdge[], nodes: PositionedNode[], pair: (a: PositionedNode, b: PositionedNode) => [Pt, Pt]): void => {
      // v2 builder's plain new Map(...) = last-match-wins.
      const byId = lastById(nodes);
      const got = pointsByEdge(edges);
      for (const edge of TOPO_EDGES) {
        const expected = pair(byId.get(edge.from)!, byId.get(edge.to)!);
        const actual = got.get(`${edge.from}->${edge.to}`)!;
        expect(actual).toHaveLength(2);
        for (let i = 0; i < 2; i++) {
          expect(Object.is(actual[i].x, expected[i].x)).toBe(true);
          expect(Object.is(actual[i].y, expected[i].y)).toBe(true);
        }
      }
    };

    assertPair(timeline.edges, timeline.nodes, (a, b) => [bottomCenterAnchor(a), topCenterAnchor(b)]);
    assertPair(comparison.edges, comparison.nodes, (a, b) => flankAnchors(a, b) as [Pt, Pt]);
  });

  it('ezo timeline edges emit center anchors over its own positioned nodes', async () => {
    const engine = new EnhancedZeroOverlapLayoutEngine();
    const result = await engine.generateZeroOverlapLayout(
      'timeline',
      TOPO_NODES.map((n) => ({ ...n })),
      TOPO_EDGES.map((e) => ({ ...e }))
    );
    const byId = firstById(result.nodes); // ezo site skeleton: nodes.find = first-match
    const got = pointsByEdge(result.edges);
    for (const edge of TOPO_EDGES) {
      const expected = [centerAnchor(byId.get(edge.from)!), centerAnchor(byId.get(edge.to)!)];
      const actual = got.get(`${edge.from}->${edge.to}`)!;
      expect(actual).toHaveLength(2);
      for (let i = 0; i < 2; i++) {
        expect(Object.is(actual[i].x, expected[i].x)).toBe(true);
        expect(Object.is(actual[i].y, expected[i].y)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Layer 3: source anchors — delegation shapes at every migrated site, the
// canonical bodies exactly once, the retired shapes gone, and the documented
// scope-outs still outside the family.
// ---------------------------------------------------------------------------

describe('round 46: edge anchor geometry — layer 3 source anchors', () => {
  const CANONICAL = 'src/visualization/strategy-edges.ts';

  it('the canonical holds each anchor helper body exactly once and no stray half-extent reads', () => {
    const src = readSource(CANONICAL);
    for (const name of [
      'centerAnchor',
      'bottomCenterAnchor',
      'topCenterAnchor',
      'rightCenterAnchor',
      'leftCenterAnchor',
      'centerToCenterAnchors',
      'verticalFlowAnchors',
      'horizontalFlowAnchors',
      'flankAnchors',
    ]) {
      expect((src.match(new RegExp(`export function ${name}\\(`, 'g')) ?? []).length).toBe(1);
    }
    // The pairs COMPOSE the point helpers; the center pair composes centerAnchor.
    expect(src).toMatch(/return \[centerAnchor\(source\), centerAnchor\(target\)\];/);
    expect(src).toMatch(/return \[bottomCenterAnchor\(source\), topCenterAnchor\(target\)\];/);
    expect(src).toMatch(/return \[rightCenterAnchor\(source\), leftCenterAnchor\(target\)\];/);
    // Exactly three half-extent width reads live in the canonical point
    // helpers (center, bottom, top) plus ONE doc-comment copy in
    // centerAnchor's JSDoc — no fifth stray. Same shape for height.
    expect((src.match(/getNodeWidth\(node\) \/ 2/g) ?? []).length).toBe(4);
    expect((src.match(/getNodeHeight\(node\) \/ 2/g) ?? []).length).toBe(4);
    expect((src.match(/getNodeWidth\(node\),/g) ?? []).length).toBe(1);
    expect((src.match(/x: node\.x,/g) ?? []).length).toBe(1);
  });

  it('FallbackLayoutStrategy delegates all four blocks and re-inlines none', () => {
    const src = readSource('src/visualization/strategies/FallbackLayoutStrategy.ts');
    expect((src.match(/points: \[\.\.\.verticalFlowAnchors\(fromNode, toNode\)\]/g) ?? []).length).toBe(1);
    expect((src.match(/points: \[\.\.\.horizontalFlowAnchors\(fromNode, toNode\)\]/g) ?? []).length).toBe(1);
    expect((src.match(/points: \[\.\.\.centerToCenterAnchors\(fromNode, toNode\)\]/g) ?? []).length).toBe(2);
    // the retired inline anchors are gone
    expect(src).not.toMatch(/getNodeWidth\(fromNode\)/);
    expect(src).not.toMatch(/getNodeHeight\(fromNode\)/);
    expect(src).not.toMatch(/getNodeWidth\(toNode\)/);
    // the skeleton stays at the site (find + zero-points dangling fallback)
    expect((src.match(/points: \[\{ x: 0, y: 0 \}, \{ x: 0, y: 0 \}\]/g) ?? []).length).toBe(4);
  });

  it('complex-layout-engine cluster block delegates; the worker/fallback ?? 0 reads delegate with a pre-guard (round 47)', () => {
    const src = readSource('src/visualization/complex-layout-engine.ts');
    expect(src).toMatch(/points: \[\.\.\.centerToCenterAnchors\(fromNode, toNode\)\]/);
    expect(src).not.toMatch(/\{ x: fromNode\.x \+ getNodeWidth\(fromNode\) \/ 2,/);
    // Round 47 conscious update of the round-46 scope pin: the worker/
    // fallback blocks now delegate to layout-utils `calculateNodeCenter`,
    // keeping their MISSING-NODE policy as a `?? { x: 0, y: 0 }` pre-guard
    // and their DEFAULT dimension policy as explicit fallback args —
    // bit-identical to the retired `(fromNode?.x ?? 0) + getNodeWidth(fromNode ?? {}) / 2`
    // forms. The retired raw-read shape must not come back.
    expect((src.match(/calculateNodeCenter\(\(fromNode \?\? \{ x: 0, y: 0 \}\) as PositionedNode, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT\)/g) ?? []).length).toBe(2);
    expect((src.match(/calculateNodeCenter\(\(toNode \?\? \{ x: 0, y: 0 \}\) as PositionedNode, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT\)/g) ?? []).length).toBe(2);
    expect(src).not.toMatch(/\{ x: \(fromNode\?\.x \?\? 0\) \+ getNodeWidth/);
  });

  it('ezo delegates the edge anchors and the balance centers', () => {
    const src = readSource('src/visualization/enhanced-zero-overlap-layout.ts');
    expect(src).toMatch(/points: \[\.\.\.centerToCenterAnchors\(sourceNode, targetNode\)\]/);
    expect(src).toMatch(/const node1Center = centerAnchor\(node1\);/);
    expect(src).toMatch(/const node2Center = centerAnchor\(node2\);/);
    expect(src).not.toMatch(/node1CenterX = node1\.x \+ getNodeWidth\(node1\) \/ 2/);
    expect(src).not.toMatch(/\{ x: sourceNode\.x \+ getNodeWidth\(sourceNode\) \/ 2,/);
  });

  it('v1 tree/timeline/comparison import and pass the canonical pairs', () => {
    const tree = readSource('src/visualization/strategies/TreeLayoutStrategy.ts');
    expect(tree).toMatch(/import \{ buildWarnedAnchoredEdges, verticalFlowAnchors \} from '\.\.\/strategy-edges';/);
    expect(tree).toMatch(/verticalFlowAnchors,\s*\n\s*'\[Tree\] '/);
    const timeline = readSource('src/visualization/strategies/TimelineLayoutStrategy.ts');
    expect(timeline).toMatch(/import \{ buildWarnedAnchoredEdges, horizontalFlowAnchors \} from '\.\.\/strategy-edges';/);
    expect(timeline).toMatch(/horizontalFlowAnchors,\s*\n\s*'\[Timeline\] '/);
    const comparison = readSource('src/visualization/strategies/ComparisonLayoutStrategy.ts');
    expect(comparison).toMatch(/import \{ buildWarnedAnchoredEdges, flankAnchors \} from '\.\.\/strategy-edges';/);
    expect(comparison).toMatch(/flankAnchors,\s*\n\s*'\[Comparison\] '/);
  });

  it('v2 timeline/comparison import the canonical pairs and keep no local anchor function', () => {
    const timeline = readSource('src/visualization/strategies/timeline-strategy.ts');
    expect(timeline).toMatch(/import \{ buildAnchoredLayoutEdges, verticalFlowAnchors \} from '\.\.\/strategy-edges';/);
    expect(timeline).not.toMatch(/function verticalFlowAnchors/);
    expect(timeline).not.toMatch(/const sw = getNodeWidth\(source, DEFAULT_NODE_WIDTH\);/);
    const comparison = readSource('src/visualization/strategies/comparison-strategy.ts');
    expect(comparison).toMatch(/import \{ buildAnchoredLayoutEdges, flankAnchors \} from '\.\.\/strategy-edges';/);
    expect(comparison).toMatch(/buildAnchoredLayoutEdges\(edges, positionedNodes, flankAnchors\)/);
    expect(comparison).not.toMatch(/function sideAnchorPair/);
  });

  it('scope pin (round 47 update): force-directed-params center diffs and export || 0 reads now delegate to calculateNodeCenter', () => {
    // Round 47 conscious update of the round-46 scope pins. The r46 sweep
    // left these out: the force-step diffs live inside the round-40 frozen
    // body, and the exporter's `|| 0` reads are falsy-coercion pre-guards.
    // Round 47's per-axis fallback seam makes both delegations
    // bit-identical (grouped pair form preserved; `|| 0` kept as a site
    // pre-guard on the spread clone), so the convergence r46 demanded as "a
    // conscious round" is this one — guarded by
    // tests/guards/node-box-center-single-source.test.ts. The r40 verbatim
    // oracle in force-directed-step-single-source.test.ts still passes
    // unchanged (behavior-identical).
    const fdp = readSource('src/visualization/force-directed-params.ts');
    expect((fdp.match(/calculateNodeCenter\(node1, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT\)/g) ?? []).length).toBe(1);
    expect((fdp.match(/calculateNodeCenter\(node2, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT\)/g) ?? []).length).toBe(1);
    expect((fdp.match(/calculateNodeCenter\(source, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT\)/g) ?? []).length).toBe(1);
    expect((fdp.match(/calculateNodeCenter\(target, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT\)/g) ?? []).length).toBe(1);
    expect(fdp).not.toMatch(/const dx = \(node2\.x \+ getNodeWidth\(node2\) \/ 2/);
    // multi-format-exporter: `|| 0` defensive coordinate reads (PDF path)
    // preserved as the pre-guard on the delegated call.
    const mfe = readSource('src/export/multi-format-exporter.ts');
    expect(mfe).toMatch(/calculateNodeCenter\(\{ \.\.\.from, x: from\.x \|\| 0, y: from\.y \|\| 0 \}, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT\)/);
    expect(mfe).not.toMatch(/const fx = \(from\.x \|\| 0\) \+ getNodeWidth\(from\) \/ 2/);
  });

  it('network-strategy force math reads centers through centerAnchor (sibling-site completion)', () => {
    // The network strategy's importance-weighted force blocks re-derived
    // the center with explicit-DEFAULT reads — the same class as the ezo
    // balance centers. Found by the round-46 sibling sweep AFTER the main
    // migration (the MISSED-SIBLING-SITE lesson, honored late): both blocks
    // now read centerAnchor; the explicit-DEFAULT reads are gone.
    const src = readSource('src/visualization/strategies/network-strategy.ts');
    expect((src.match(/const centerA = centerAnchor\(a\);/g) ?? []).length).toBe(1);
    expect((src.match(/const centerB = centerAnchor\(b\);/g) ?? []).length).toBe(1);
    expect((src.match(/const sourceCenter = centerAnchor\(src\);/g) ?? []).length).toBe(1);
    expect((src.match(/const targetCenter = centerAnchor\(tgt\);/g) ?? []).length).toBe(1);
    expect(src).not.toMatch(/\.x \+ getNodeWidth\((a|b|src|tgt), DEFAULT_NODE_WIDTH\) \/ 2/);
    // its edge anchors already delegate since round 32 (centerToCenterAnchors)
    expect(src).toMatch(/buildAnchoredLayoutEdges\(edges, positioned, centerToCenterAnchors\)/);
    // Scope-out RESOLVED by round 47: LayoutOptimizer's circular edge
    // anchors and importance centroid now delegate to layout-utils
    // `calculateNodeCenter` / `nodesCentroid` with the config fallbacks
    // threaded per axis — bit-identical for ANY config.nodeWidth, which the
    // r46 pin had demanded as "a conscious round, not this sweep".
    const lo = readSource('src/visualization/strategies/LayoutOptimizer.ts');
    expect((lo.match(/calculateNodeCenter\(fromNode, this\.config\.nodeWidth, this\.config\.nodeHeight\)/g) ?? []).length).toBe(1);
    expect((lo.match(/calculateNodeCenter\(toNode, this\.config\.nodeWidth, this\.config\.nodeHeight\)/g) ?? []).length).toBe(1);
    expect(lo).toMatch(/nodesCentroid\(layout\.nodes, this\.config\.nodeWidth, this\.config\.nodeHeight\)/);
    expect(lo).not.toMatch(/x: fromNode\.x \+ getNodeWidth\(fromNode, this\.config\.nodeWidth\) \/ 2/);
  });
});
