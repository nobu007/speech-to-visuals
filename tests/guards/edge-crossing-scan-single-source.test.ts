/**
 * @jest-environment node
 */
/**
 * edge-crossing-scan-single-source.test.ts — round 43.
 *
 * Family: the EDGE-CROSSING PAIR SCAN — segment build + all-pairs i<j loop +
 * shared-endpoint skip + segment-intersection predicate — existed as FOUR
 * independent copies with TWO predicate policies:
 *
 *   - v2 strict (ccw product `< 0`; touching/collinear do NOT count):
 *     OverlapResolver.countEdgeCrossings + SimulatedAnnealing.
 *     calculateCrossingEnergy — byte-identical scan + predicate pair.
 *   - v1 orientation+collinear (orientation with 1e-4 tolerance +
 *     onSegment; touching/collinear DO count):
 *     edge-crossing-minimizer.detectEdgeCrossings (exported canonical) vs
 *     LayoutEvaluator's private detectEdgeCrossings/lineSegmentsIntersect/
 *     orientation/onSegment quartet — same algorithm re-implemented.
 *
 * Canonicals since round 43:
 *   - v2: src/visualization/layout/edge-crossings.ts
 *     (segmentsIntersect + countEdgeCrossings), delegated to by
 *     OverlapResolver and SimulatedAnnealingStrategy (energy = count²).
 *   - v1: src/visualization/edge-crossing-minimizer.ts (pre-existing
 *     export), now also used by LayoutEvaluator.
 *
 * DRIFT SCENARIO this guard defends against: the resolver and the annealer
 * disagree about what a crossing IS on the same layout (one site flips the
 * strict predicate or drops the shared-endpoint skip) — invisible because
 * each copy feeds a different consumer (metrics vs energy). And the v1
 * judge (LayoutEvaluator → layout-engine confidence) diverges from the v1
 * producer-side minimizer the quality composite reads. Two POLICIES
 * (strict vs collinear-inclusive) are deliberate and pinned separately —
 * this is not a bug to converge, it is a semantic choice kept per-side and
 * written once each.
 *
 * Layers:
 *   1. VERBATIM ORACLE — the pre-round-43 inline bodies (the v2 scan as
 *      carried by BOTH v2 sites, and LayoutEvaluator's private v1 scan),
 *      frozen from 857c68c7 (round 42 HEAD), must be count-identical to the
 *      canonicals over a seeded fuzz corpus (counts {1,5,12,25} × 25 seeds,
 *      dangling endpoints, mixed/no dimensions, NaN coordinates).
 *   2. SEMANTIC PINS — the two policies on the same geometric cases
 *      (properX both count; collinear / T-touching / positional-T: strict 0
 *      vs orientation 1), shared-endpoint-id skip, dangling drop,
 *      dimension-less centering, the SA quadratic energy (count²), the
 *      LayoutEvaluator delegation incl. the one documented unreachable-input
 *      change (source/target-alias edges now resolve: 0 → 1), and NaN
 *      coordinates never registering a crossing in either policy.
 *   3. SOURCE ANCHORS — the three delegating files import and call the
 *      canonical names, no site re-inlines a retired shape, each canonical
 *      carries its shapes exactly once, and the SA energy policy
 *      (`crossings * crossings`) stays at its site.
 *
 * The "no site re-inlines the scan" discovery sweep lives in the shared
 * registry (frozen-literal-families/edge-crossing-scan.ts); this file holds
 * the behavioral pins.
 */

import { describe, it, expect } from '@jest/globals';
import { mulberry32 } from '@tests/helpers/fuzz';
import { readSource, isCommentLine } from '@tests/guards/freeze-guard';
import type { PositionedNode, LayoutEdge } from '@stv/core/types/diagram';
import { segmentsIntersect, countEdgeCrossings } from '@/visualization/layout/edge-crossings';
import { detectEdgeCrossings as detectEdgeCrossingsV1 } from '@/visualization/edge-crossing-minimizer';
import { LayoutEvaluator } from '@/visualization/strategies/LayoutEvaluator';
import { calculateNodeCenter } from '@/visualization/layout-utils';
import SimulatedAnnealingStrategy from '@/visualization/layout/strategies/SimulatedAnnealingStrategy';

// ---------------------------------------------------------------------------
// Layer 1 material: the VERBATIM pre-round-43 inline bodies, frozen from
// 857c68c7 (round 42 HEAD). Do not "improve" these copies: their job is to
// be the old behavior, not good behavior.
// ---------------------------------------------------------------------------

/** OverlapResolver.countEdgeCrossings — the v2 strict scan (HEAD body). */
function oldV2CountEdgeCrossings(nodes: PositionedNode[], edges: LayoutEdge[]): number {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  let crossings = 0;

  const segments = edges
    .map(edge => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      return source && target ? { source, target } : null;
    })
    .filter((segment): segment is { source: PositionedNode; target: PositionedNode } => segment !== null);

  for (let i = 0; i < segments.length; i++) {
    const a = segments[i];

    for (let j = i + 1; j < segments.length; j++) {
      const b = segments[j];

      if (a.source === b.source || a.source === b.target ||
          a.target === b.source || a.target === b.target) {
        continue;
      }

      if (oldV2SegmentsIntersect(a, b)) {
        crossings++;
      }
    }
  }

  return crossings;
}

/** OverlapResolver.segmentsIntersect — the v2 strict predicate (HEAD body). */
function oldV2SegmentsIntersect(
  a: { source: PositionedNode; target: PositionedNode },
  b: { source: PositionedNode; target: PositionedNode }
): boolean {
  const ccw = (A: PositionedNode, B: PositionedNode, C: PositionedNode): number => {
    return (C.y - A.y) * (B.x - A.x) - (B.y - A.y) * (C.x - A.x);
  };

  const A = a.source;
  const B = a.target;
  const C = b.source;
  const D = b.target;

  return (
    (ccw(A, C, D) * ccw(B, C, D) < 0) &&
    (ccw(C, A, B) * ccw(D, A, B) < 0)
  );
}

/** LayoutEvaluator.detectEdgeCrossings — the v1 orientation scan (HEAD body,
 *  including its orientation/onSegment trio). `calculateNodeCenter` is the
 *  same import HEAD used (x + getNodeWidth(n, 0)/2). */
function oldV1DetectEdgeCrossings(nodes: PositionedNode[], edges: LayoutEdge[]): number {
  if (edges.length < 2) return 0;

  const nodePositions = new Map<string, { x: number; y: number }>();
  nodes.forEach(node => {
    const center = calculateNodeCenter(node);
    nodePositions.set(node.id, center);
  });

  interface LineSegment {
    edge: LayoutEdge;
    start: { x: number; y: number };
    end: { x: number; y: number };
  }

  const segments: LineSegment[] = [];
  for (const edge of edges) {
    const start = nodePositions.get(edge.from!);
    const end = nodePositions.get(edge.to!);

    if (start && end) {
      segments.push({ edge, start, end });
    }
  }

  let crossingCount = 0;
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const seg1 = segments[i];
      const seg2 = segments[j];

      if (
        seg1.edge.from === seg2.edge.from ||
        seg1.edge.from === seg2.edge.to ||
        seg1.edge.to === seg2.edge.from ||
        seg1.edge.to === seg2.edge.to
      ) {
        continue;
      }

      if (oldV1LineSegmentsIntersect(seg1.start, seg1.end, seg2.start, seg2.end)) {
        crossingCount++;
      }
    }
  }

  return crossingCount;
}

function oldV1LineSegmentsIntersect(
  p1: { x: number; y: number }, p2: { x: number; y: number },
  p3: { x: number; y: number }, p4: { x: number; y: number }
): boolean {
  const o1 = oldOrientation(p1, p2, p3);
  const o2 = oldOrientation(p1, p2, p4);
  const o3 = oldOrientation(p3, p4, p1);
  const o4 = oldOrientation(p3, p4, p2);

  if (o1 !== o2 && o3 !== o4) {
    return true;
  }

  if (o1 === 0 && oldOnSegment(p1, p3, p2)) return true;
  if (o2 === 0 && oldOnSegment(p1, p4, p2)) return true;
  if (o3 === 0 && oldOnSegment(p3, p1, p4)) return true;
  if (o4 === 0 && oldOnSegment(p3, p2, p4)) return true;

  return false;
}

function oldOrientation(
  p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }
): number {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);

  if (Math.abs(val) < 0.0001) return 0;
  return val > 0 ? 1 : 2;
}

function oldOnSegment(
  p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }
): boolean {
  return (
    q.x <= Math.max(p.x, r.x) &&
    q.x >= Math.min(p.x, r.x) &&
    q.y <= Math.max(p.y, r.y) &&
    q.y >= Math.min(p.y, r.y)
  );
}

// ---------------------------------------------------------------------------
// Crafted geometry cases. v2 semantics: node.x/y ARE the segment endpoints
// (CENTER convention). v1 semantics: centers derive from x + width/2 — the
// dimension-less mirror below makes the two policies see the same segments,
// so the count deltas below are PREDICATE deltas, not coordinate deltas.
// ---------------------------------------------------------------------------

interface Case {
  nodes: PositionedNode[];
  edges: LayoutEdge[];
}

const N = (id: string, x: number, y: number): PositionedNode => ({ id, label: id, x, y });
const E2 = (source: string, target: string): LayoutEdge => ({ source, target, points: [] });
const E1 = (from: string, to: string): LayoutEdge => ({ from, to, points: [] });

/** v2 cases (source/target fields, raw x/y endpoints). */
const V2_CASES: Record<string, Case> = {
  properX: {
    nodes: [N('a', 100, 100), N('b', 500, 500), N('c', 100, 500), N('d', 500, 100)],
    edges: [E2('a', 'b'), E2('c', 'd')],
  },
  parallel: {
    nodes: [N('a', 0, 0), N('b', 100, 0), N('c', 0, 50), N('d', 100, 50)],
    edges: [E2('a', 'b'), E2('c', 'd')],
  },
  // distinct ids at the SAME coordinate: no id-skip applies, segments touch
  // at (100,0) — a T-junction, so only the collinear-inclusive policy counts.
  positionalT: {
    nodes: [N('a', 0, 0), N('b', 100, 0), N('c', 100, 0), N('d', 100, 100)],
    edges: [E2('a', 'b'), E2('c', 'd')],
  },
  collinearOverlap: {
    nodes: [N('a', 0, 100), N('b', 400, 100), N('c', 100, 100), N('d', 500, 100)],
    edges: [E2('a', 'b'), E2('c', 'd')],
  },
  touchingT: {
    nodes: [N('a', 0, 0), N('b', 400, 0), N('c', 200, 0), N('d', 200, 300)],
    edges: [E2('a', 'b'), E2('c', 'd')],
  },
  dangling: {
    nodes: [N('a', 0, 0), N('b', 400, 400), N('c', 0, 400), N('d', 400, 0)],
    edges: [E2('a', 'missing'), E2('c', 'd')],
  },
  singleEdge: {
    nodes: [N('a', 0, 0), N('b', 100, 100)],
    edges: [E2('a', 'b')],
  },
  sharedIdPair: {
    nodes: [N('a', 0, 0), N('b', 100, 100), N('c', 0, 100)],
    edges: [E2('a', 'b'), E2('b', 'a')],
  },
  nanCoord: {
    nodes: [N('a', 0, 0), N('b', NaN, 400), N('c', 0, 400), N('d', 400, 0)],
    edges: [E2('a', 'b'), E2('c', 'd')],
  },
};

/** v1 mirror: same coordinates, from/to fields. Dimension-less nodes make
 *  center == raw x/y (getNodeWidth(n, 0) fallback), matching the v2 geometry. */
const V1_CASES: Record<string, Case> = Object.fromEntries(
  Object.entries(V2_CASES).map(([k, c]) => [
    k,
    {
      nodes: c.nodes.map((n) => ({ ...n })),
      edges: c.edges.map((e) => E1(e.source!, e.target!)),
    } satisfies Case,
  ])
);

// Expected counts, frozen at 857c68c7 (round 42 HEAD) by executing the four
// original sites directly (see round-43 record).
const EXPECT_STRICT: Record<string, number> = {
  properX: 1, parallel: 0, positionalT: 0, collinearOverlap: 0, touchingT: 0,
  dangling: 0, singleEdge: 0, sharedIdPair: 0, nanCoord: 0,
};
const EXPECT_ORIENTATION: Record<string, number> = {
  properX: 1, parallel: 0, positionalT: 1, collinearOverlap: 1, touchingT: 1,
  dangling: 0, singleEdge: 0, sharedIdPair: 0, nanCoord: 0,
};

// ---------------------------------------------------------------------------
// Fuzz corpora generators (same shape as the round-43 freeze run).
// ---------------------------------------------------------------------------

function fuzzV2(n: number, seed: number): Case {
  const r = mulberry32(seed * 7919);
  const nodes = Array.from({ length: n }, (_, i) => {
    const x = Math.floor(r() * 1000);
    const y = Math.floor(r() * 1000);
    const dims = i % 3;
    return {
      id: `n${i}`, label: `N${i}`, x, y,
      ...(dims === 0 ? { w: 120, h: 60, width: 120, height: 60 } : dims === 1 ? { w: 100, h: 50 } : {}),
    } as PositionedNode;
  });
  const re = mulberry32(seed * 104729);
  const m = Math.max(1, Math.floor(n * 1.5));
  const edges = Array.from({ length: m }, (_, i) => {
    const s = nodes[Math.floor(re() * nodes.length)].id;
    const t = re() < 0.2 ? `ghost-${i}` : nodes[Math.floor(re() * nodes.length)].id;
    return E2(s, t);
  });
  return { nodes, edges };
}

function fuzzV1(n: number, seed: number): Case {
  const r = mulberry32(seed * 7919);
  const nodes = Array.from({ length: n }, (_, i) => {
    const x = Math.floor(r() * 1000);
    const y = Math.floor(r() * 1000);
    const dims = i % 3;
    return {
      id: `n${i}`, label: `N${i}`, x, y,
      ...(dims === 0 ? { w: 120, h: 60, width: 120, height: 60 } : dims === 1 ? { width: 100, height: 50 } : {}),
    } as PositionedNode;
  });
  const re = mulberry32(seed * 104729);
  const m = Math.max(1, Math.floor(n * 1.5));
  const edges = Array.from({ length: m }, (_, i) => {
    const s = nodes[Math.floor(re() * nodes.length)].id;
    const t = re() < 0.2 ? `ghost-${i}` : nodes[Math.floor(re() * nodes.length)].id;
    return E1(s, t);
  });
  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Layer 1 — verbatim-oracle equivalence over the fuzz corpus.
// ---------------------------------------------------------------------------

describe('round 43 layer 1: canonical ≡ verbatim HEAD bodies (fuzz)', () => {
  const SIZES = [1, 5, 12, 25];
  const SEEDS = Array.from({ length: 25 }, (_, i) => i + 1);

  it.each(SIZES)('v2 strict scan matches the HEAD body on n=%i', (n) => {
    for (const seed of SEEDS) {
      const { nodes, edges } = fuzzV2(n, seed);
      expect(countEdgeCrossings(nodes, edges)).toBe(oldV2CountEdgeCrossings(nodes, edges));
    }
  });

  it.each(SIZES)('v1 orientation scan matches the HEAD body on n=%i', (n) => {
    for (const seed of SEEDS) {
      const { nodes, edges } = fuzzV1(n, seed);
      expect(detectEdgeCrossingsV1(nodes, edges)).toBe(oldV1DetectEdgeCrossings(nodes, edges));
    }
  });

  it('v2 corpora include real crossings (oracle is not vacuous)', () => {
    let nonzero = 0;
    for (const n of SIZES) {
      for (const seed of SEEDS) {
        const { nodes, edges } = fuzzV2(n, seed);
        if (oldV2CountEdgeCrossings(nodes, edges) > 0) nonzero++;
      }
    }
    expect(nonzero).toBeGreaterThanOrEqual(20);
  });

  it('v1 corpora include real crossings (oracle is not vacuous)', () => {
    let nonzero = 0;
    for (const n of SIZES) {
      for (const seed of SEEDS) {
        const { nodes, edges } = fuzzV1(n, seed);
        if (oldV1DetectEdgeCrossings(nodes, edges) > 0) nonzero++;
      }
    }
    expect(nonzero).toBeGreaterThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------
// Layer 2 — semantic pins: the two policies, the skips, the delegation.
// ---------------------------------------------------------------------------

describe('round 43 layer 2: strict vs orientation+collinear policies (frozen counts)', () => {
  for (const [name, expectStrict, expectOrientation] of
      (Object.keys(V2_CASES) as (keyof typeof EXPECT_STRICT)[])
        .map((k) => [k, EXPECT_STRICT[k], EXPECT_ORIENTATION[k]] as const)) {
    it(`${name}: strict=${expectStrict} orientation=${expectOrientation}`, () => {
      const v2 = V2_CASES[name];
      const v1 = V1_CASES[name];
      expect(countEdgeCrossings(v2.nodes, v2.edges)).toBe(expectStrict);
      expect(detectEdgeCrossingsV1(v1.nodes, v1.edges)).toBe(expectOrientation);
    });
  }

  it('predicate divergence is the POLICY, not the corpus: same segments, different verdicts', () => {
    // collinearOverlap: same four points, strict says no crossing, the
    // orientation+collinear predicate says crossing. If either canonical
    // converges toward the other, this pin fails.
    const seg = {
      nodes: [N('a', 0, 100), N('b', 400, 100), N('c', 100, 100), N('d', 500, 100)],
      edges: [E2('a', 'b'), E2('c', 'd')],
    };
    const segA = { source: seg.nodes[0], target: seg.nodes[1] };
    const segB = { source: seg.nodes[2], target: seg.nodes[3] };
    expect(segmentsIntersect(segA, segB)).toBe(false);
  });

  it('shared-endpoint NODE OBJECT skip (v2): a→b vs b→a never counts', () => {
    const nodes = [N('a', 0, 0), N('b', 100, 100), N('c', 0, 100)];
    const edges = [E2('a', 'b'), E2('b', 'a')];
    expect(countEdgeCrossings(nodes, edges)).toBe(0);
  });

  it('shared-endpoint ID skip (v1): a→b vs b→c never counts', () => {
    const nodes = [N('a', 0, 0), N('b', 100, 0), N('c', 200, 0)];
    const edges = [E1('a', 'b'), E1('b', 'c')];
    expect(detectEdgeCrossingsV1(nodes, edges)).toBe(0);
  });

  it('v1 centers derive from dimensions: same ids/coords shift geometry when width present', () => {
    // properX with width 120/height 60: centers move by (60, 30) — still
    // crossing (1), but this pins that the v1 scan READS the dimensions the
    // getNodeWidth/getNodeHeight helpers resolve (w/h alias included).
    const nodes = [
      { ...N('a', 100, 100), width: 120, height: 60 },
      { ...N('b', 500, 500), width: 120, height: 60 },
      { ...N('c', 100, 500), w: 120, h: 60 },
      { ...N('d', 500, 100), w: 120, h: 60 },
    ];
    const edges = [E1('a', 'b'), E1('c', 'd')];
    expect(detectEdgeCrossingsV1(nodes, edges)).toBe(1);
  });

  it('NaN coordinates never register a crossing in either policy', () => {
    expect(EXPECT_STRICT.nanCoord).toBe(0);
    expect(EXPECT_ORIENTATION.nanCoord).toBe(0);
  });
});

describe('round 43 layer 2: delegation pins', () => {
  const evaluator = new LayoutEvaluator({
    width: 1920, height: 1080, nodeWidth: 120, nodeHeight: 60,
    marginX: 40, marginY: 40, nodeSeparation: 20,
  } as never);

  it('LayoutEvaluator.edgeCrossings ≡ minimizer canonical on every crafted case', () => {
    for (const [name, c] of Object.entries(V1_CASES)) {
      const viaEvaluator = evaluator.calculateLayoutMetrics(c.nodes, c.edges).edgeCrossings;
      const viaCanonical = detectEdgeCrossingsV1(c.nodes, c.edges);
      expect(`${name}: ${viaEvaluator}`).toBe(`${name}: ${viaCanonical}`);
    }
  });

  it('LayoutEvaluator.edgeCrossings ≡ canonical on the fuzz corpus (counts {1,5,12,25} × 25 seeds)', () => {
    for (const n of [1, 5, 12, 25]) {
      for (let seed = 1; seed <= 25; seed++) {
        const { nodes, edges } = fuzzV1(n, seed);
        const viaEvaluator = evaluator.calculateLayoutMetrics(nodes, edges).edgeCrossings;
        expect(viaEvaluator).toBe(detectEdgeCrossingsV1(nodes, edges));
      }
    }
  });

  it('behavior change (unreachable inputs only): source/target-alias edges now resolve (was dropped)', () => {
    // v1 LayoutEdges always carry from/to (every strategy writes both), so
    // this input shape is unreachable in production; the pin documents the
    // one observable delta of delegating to the canonical.
    const nodes = V1_CASES.properX.nodes;
    const aliasEdges: LayoutEdge[] = [
      { source: 'a', target: 'b', points: [] },
      { source: 'c', target: 'd', points: [] },
    ];
    expect(evaluator.calculateLayoutMetrics(nodes, aliasEdges).edgeCrossings).toBe(1);
    expect(oldV1DetectEdgeCrossings(nodes, aliasEdges)).toBe(0);
  });

  it('SimulatedAnnealing crossing energy = count² (quadratic penalty at its site)', () => {
    const sa = new SimulatedAnnealingStrategy({} as never) as unknown as {
      calculateCrossingEnergy(nodes: PositionedNode[], edges: LayoutEdge[]): number;
    };
    for (const [name, c] of Object.entries(V2_CASES)) {
      const count = countEdgeCrossings(c.nodes, c.edges);
      expect(`${name}: ${sa.calculateCrossingEnergy(c.nodes, c.edges)}`).toBe(`${name}: ${count * count}`);
    }
    // and on a multi-crossing corpus entry so count² > count is exercised
    const { nodes, edges } = fuzzV2(25, 3);
    const count = countEdgeCrossings(nodes, edges);
    expect(count).toBeGreaterThanOrEqual(2);
    expect(sa.calculateCrossingEnergy(nodes, edges)).toBe(count * count);
  });
});

// ---------------------------------------------------------------------------
// Layer 3 — source anchors: delegation shapes and no re-inlined bodies.
// ---------------------------------------------------------------------------

describe('round 43 layer 3: source anchors', () => {
  const resolver = readSource('src/visualization/layout/OverlapResolver.ts');
  const annealer = readSource('src/visualization/layout/strategies/SimulatedAnnealingStrategy.ts');
  const evaluatorSrc = readSource('src/visualization/strategies/LayoutEvaluator.ts');
  const canonicalV2 = readSource('src/visualization/layout/edge-crossings.ts');
  const canonicalV1 = readSource('src/visualization/edge-crossing-minimizer.ts');

  const codeLines = (src: string): string[] => src.split('\n').filter((l) => !isCommentLine(l));

  it('OverlapResolver delegates to the v2 canonical and carries no retired shape', () => {
    expect(resolver).toContain("import { countEdgeCrossings } from './edge-crossings'");
    expect(codeLines(resolver).some((l) => l.includes('countEdgeCrossings(nodes, edges)'))).toBe(true);
    // retired v2 shapes (comment mentions do not count)
    expect(codeLines(resolver).some((l) => l.includes('ccw('))).toBe(false);
    expect(codeLines(resolver).some((l) => l.includes('private countEdgeCrossings'))).toBe(false);
    expect(codeLines(resolver).some((l) => l.includes('private segmentsIntersect'))).toBe(false);
  });

  it('SimulatedAnnealingStrategy delegates and keeps only the energy policy', () => {
    expect(annealer).toContain("import { countEdgeCrossings } from '../edge-crossings'");
    expect(codeLines(annealer).some((l) => l.includes('countEdgeCrossings(nodes, edges)'))).toBe(true);
    expect(codeLines(annealer).some((l) => l.includes('ccw('))).toBe(false);
    // the quadratic penalty stays AT the energy site, exactly once
    expect(codeLines(annealer).filter((l) => l.includes('crossings * crossings')).length).toBe(1);
  });

  it('LayoutEvaluator delegates to the v1 canonical and carries no retired shape', () => {
    expect(evaluatorSrc).toContain("import { detectEdgeCrossings } from '../edge-crossing-minimizer'");
    expect(codeLines(evaluatorSrc).some((l) => l.includes('detectEdgeCrossings(nodes, edges)'))).toBe(true);
    for (const retired of ['private detectEdgeCrossings', 'lineSegmentsIntersect(', 'orientation(', 'onSegment(']) {
      expect(codeLines(evaluatorSrc).some((l) => l.includes(retired))).toBe(false);
    }
  });

  it('the v2 canonical carries the scan and the predicate exactly once each', () => {
    expect(codeLines(canonicalV2).filter((l) => l.includes('export function countEdgeCrossings')).length).toBe(1);
    expect(codeLines(canonicalV2).filter((l) => l.includes('export function segmentsIntersect')).length).toBe(1);
    expect(codeLines(canonicalV2).some((l) => l.includes('ccw(A, C, D) * ccw(B, C, D) < 0'))).toBe(true);
    expect(codeLines(canonicalV2).some((l) => l.includes('a.source === b.source || a.source === b.target'))).toBe(true);
  });

  it('the v1 canonical keeps the orientation trio and its 1e-4 tolerance (not converged to strict)', () => {
    expect(codeLines(canonicalV1).some((l) => l.includes('Math.abs(val) < 0.0001'))).toBe(true);
    expect(codeLines(canonicalV1).some((l) => l.includes('o1 !== o2 && o3 !== o4'))).toBe(true);
  });
});
