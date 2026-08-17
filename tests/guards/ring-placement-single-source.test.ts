/**
 * @jest-environment node
 */
/**
 * ring-placement-single-source.test.ts — round 48.
 *
 * Family: the RING/CIRCLE placement arithmetic — the even ring step
 * `(2π · index) / count` and the circle point
 * `{x: cx + r·cos θ, y: cy + r·sin θ}` — was re-derived inline at 14 sites
 * across nine files (cycle-strategy ×2 ring placement + force-directed
 * attraction target, network-strategy importance ring, mindmap-strategy ×3
 * fallback spiral ring + polar subtree + branch-root polar read,
 * FallbackLayoutStrategy cycle, LayoutOptimizer ×2, advanced-layouts cycle,
 * complex-layout-engine ×2 cluster ring + within-cluster ring,
 * ProgressiveForceStrategy init ring, strategies/OverlapResolver probe walk),
 * in FOUR text variants (`2π·i`, `i·2π`, `π·2·attempt`, and LayoutOptimizer's
 * `/ Math.max(1, count)`), three coordinate policies (center-point storage,
 * `- w / 2` top-left conversion, origin-centered) and three radius policies
 * (fixed, per-node importance, per-index spiral). Canonical since round 48:
 * `ringAngle` / `pointOnCircle` in src/visualization/layout-utils.ts.
 *
 * DRIFT SCENARIO this guard defends against: one engine's copy gets a
 * phase-shifted step (`(i + 1)`), an off-by-one count, or a swapped
 * operand — and the SAME cycle topology renders rotated/clustered from one
 * code path while every other consumer of the same shape agrees. The
 * LayoutOptimizer copy had already drifted textually (`Math.max(1, count)`
 * vs the raw division) — value-equal only because the guard was dead.
 *
 * Layers:
 *   1. VERBATIM ORACLE — every retired text variant frozen below, must be
 *      Object.is-identical to the canonical over a seeded fuzz corpus
 *      (counts 1..17, centers/radii including 0, negatives, large and
 *      fractional values; commuted operand orders; origin-centered form).
 *   2. SEMANTIC PINS — the dead-guard retirement (reachable index<count
 *      implies count>=1; count 0 → NaN by contract), the +x-axis zero
 *      phase, radius-0/negative-radius behavior, NaN propagation, the
 *      `0 + v` origin-identity witness (the only theoretical bit-flip is a
 *      -0 that ring angles cannot produce — proven over the corpus), and
 *      the weighted-sector scope-out divergence pin (mindmap's
 *      weight-proportional `(2π·w)/total` is a DIFFERENT concept).
 *   3. SOURCE ANCHORS — each migrated file delegates with its policy's
 *      argument shapes, the canonical bodies appear exactly once, the
 *      retired shapes are gone, and the scoped-out OverlapResolver `+=/-=`
 *      push keeps its inline displacement.
 *
 * The "no site re-inlines the ring fold" discovery sweep lives in the
 * shared registry (frozen-literal-families/ring-placement.ts); this file
 * holds the behavioral pins.
 */

import { describe, it, expect } from '@jest/globals';
import { mulberry32 } from '@tests/helpers/fuzz';
import { readSource } from '@tests/guards/freeze-guard';
import { ringAngle, pointOnCircle } from '@/visualization/layout-utils';
import { CycleLayoutStrategy } from '@/visualization/strategies/cycle-strategy';
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from '@/visualization/canvas-dimensions';
import type { NodeDatum } from '@/types/diagram';

// ---------------------------------------------------------------------------
// Layer 1 material: the VERBATIM pre-round-48 expressions, frozen from the
// migrated files at ab35aca7 (round 47 HEAD). Do not "improve" these copies:
// their job is to be the old behavior, not good behavior.
// ---------------------------------------------------------------------------

type Pt = { x: number; y: number };

/** `(2π·i)/n` — cycle / network / mindmap-fallback / FallbackLayoutStrategy /
 *  advanced-layouts / complex-layout-engine ×2 retired step. */
function legacyStepA(i: number, n: number): number {
  return (2 * Math.PI * i) / n;
}

/** `(i·2π)/n` — ProgressiveForceStrategy retired step (commuted operands). */
function legacyStepB(i: number, n: number): number {
  return (i * 2 * Math.PI) / n;
}

/** `(π·2·attempt)/attempts` — OverlapResolver probe retired step. */
function legacyStepC(attempt: number, attempts: number): number {
  return (Math.PI * 2 * attempt) / attempts;
}

/** `(2π·i)/Math.max(1, n)` — LayoutOptimizer ×2 retired step (dead guard). */
function legacyStepGuarded(i: number, n: number): number {
  return (2 * Math.PI * i) / Math.max(1, n);
}

/** `cx + radius·cos` — the fixed/per-node-radius ring point (most sites). */
function legacyPoint(cx: number, cy: number, angle: number, radius: number): Pt {
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}

/** `cx + cos·radius` — mindmap polar reads / OverlapResolver probe (commuted). */
function legacyPointCommuted(cx: number, cy: number, angle: number, radius: number): Pt {
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
}

/** Bare `cos·radius` — ProgressiveForceStrategy origin-centered ring. */
function legacyOriginPoint(angle: number, radius: number): Pt {
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

/** Full top-left-converted ring site (cycle / network / mindmap fallback /
 *  Fallback / LayoutOptimizer / cluster-nodes): step + point + `- w / 2`. */
function legacyRingWithOffset(
  cx: number, cy: number, i: number, n: number, radius: number, w: number, h: number,
): Pt {
  const angle = (2 * Math.PI * i) / n;
  return {
    x: cx + radius * Math.cos(angle) - w / 2,
    y: cy + radius * Math.sin(angle) - h / 2,
  };
}

// ---------------------------------------------------------------------------
// Corpus: seeded (index, count) pairs and (center, radius, angle) tuples
// spanning the retired sites' operand ranges.
// ---------------------------------------------------------------------------

interface RingCase { i: number; n: number; cx: number; cy: number; radius: number; }

function buildRingCorpus(): RingCase[] {
  const rng = mulberry32(4821);
  const cases: RingCase[] = [];
  const centers = [0, -0.5, 960, 540, -137.25, 5000, 1e12];
  for (let k = 0; k < 120; k++) {
    const n = 1 + Math.floor(rng() * 17);
    cases.push({
      i: Math.floor(rng() * n),
      n,
      cx: centers[Math.floor(rng() * centers.length)],
      cy: centers[Math.floor(rng() * centers.length)],
      radius: [0, 20, 68.75, 200, 250, 1000, -35][Math.floor(rng() * 7)],
    });
  }
  // boundary counts the retired sites actually lived on
  for (const n of [1, 2, 3, 4, 5, 8, 20]) {
    for (const i of [0, 1, n - 1]) {
      if (i < n) cases.push({ i, n, cx: 960, cy: 540, radius: 200 });
    }
  }
  return cases;
}

const RING_CORPUS = buildRingCorpus();

describe('round 48: ring placement single source — layer 1 verbatim oracle', () => {
  it.each(RING_CORPUS)('every retired step variant equals ringAngle over i=$i n=$n', ({ i, n }) => {
    expect(Object.is(ringAngle(i, n), legacyStepA(i, n))).toBe(true);
    expect(Object.is(ringAngle(i, n), legacyStepB(i, n))).toBe(true);
    expect(Object.is(ringAngle(i, n), legacyStepC(i, n))).toBe(true);
    // the guarded variant is value-equal at every REACHABLE evaluation
    expect(Object.is(ringAngle(i, n), legacyStepGuarded(i, n))).toBe(true);
  });

  it.each(RING_CORPUS)('the circle point equals every retired form over i=$i n=$n', ({ i, n, cx, cy, radius }) => {
    const got = pointOnCircle(cx, cy, ringAngle(i, n), radius);
    const a = legacyPoint(cx, cy, legacyStepA(i, n), radius);
    expect(Object.is(got.x, a.x)).toBe(true);
    expect(Object.is(got.y, a.y)).toBe(true);
    const b = legacyPointCommuted(cx, cy, legacyStepA(i, n), radius);
    expect(Object.is(got.x, b.x)).toBe(true);
    expect(Object.is(got.y, b.y)).toBe(true);
  });

  it.each(RING_CORPUS)('the top-left-converted ring site is step+point+offset, grouping preserved', ({ i, n, cx, cy, radius }) => {
    const w = 120, h = 60;
    const legacy = legacyRingWithOffset(cx, cy, i, n, radius, w, h);
    const p = pointOnCircle(cx, cy, ringAngle(i, n), radius);
    expect(Object.is(p.x - w / 2, legacy.x)).toBe(true);
    expect(Object.is(p.y - h / 2, legacy.y)).toBe(true);
  });

  it('the origin-centered ring (ProgressiveForceStrategy) delegates through center (0, 0) bit-identically', () => {
    const rng = mulberry32(4848);
    for (let k = 0; k < 200; k++) {
      const n = 1 + Math.floor(rng() * 40);
      const i = Math.floor(rng() * n);
      const radius = Math.sqrt(n) * 50; // the retired site's own radius law
      const legacy = legacyOriginPoint(legacyStepB(i, n), radius);
      const got = pointOnCircle(0, 0, ringAngle(i, n), radius);
      expect(Object.is(got.x, legacy.x)).toBe(true);
      expect(Object.is(got.y, legacy.y)).toBe(true);
      // the `0 + v` identity itself — the ONLY theoretical divergence is a
      // -0 x that ring angles cannot produce; assert it never fires.
      expect(Object.is(0 + legacy.x, legacy.x)).toBe(true);
      expect(Object.is(legacy.x, -0)).toBe(false);
    }
  });

  it('the polar reads (mindmap subtree/branch) delegate at arbitrary angles', () => {
    const rng = mulberry32(4860);
    for (let k = 0; k < 200; k++) {
      const angle = rng() * 2 * Math.PI - Math.PI;
      const radius = rng() * 600;
      const got = pointOnCircle(960, 540, angle, radius);
      const legacy = legacyPointCommuted(960, 540, angle, radius);
      expect(Object.is(got.x, legacy.x)).toBe(true);
      expect(Object.is(got.y, legacy.y)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Layer 2: semantic pins — dead-guard retirement, phase, degenerate radii,
// NaN policy, and the weighted-sector scope-out divergence.
// ---------------------------------------------------------------------------

describe('round 48: ring placement — layer 2 semantic pins', () => {
  it('the retired Math.max(1, count) guard was DEAD: index < count implies count >= 1', () => {
    for (let n = 1; n <= 50; n++) {
      for (let i = 0; i < n; i++) {
        expect(Math.max(1, n)).toBe(n); // the guard never changed its input
        expect(Object.is(ringAngle(i, n), legacyStepGuarded(i, n))).toBe(true);
      }
    }
    // count 0 is UNREACHABLE at every retired site (all computed the angle
    // inside a per-element iteration); the canonical keeps the raw NaN.
    expect(Object.is(ringAngle(0, 0), NaN)).toBe(true);
  });

  it('zero phase: node 0 sits on the +x axis, steps are even', () => {
    expect(ringAngle(0, 7)).toBe(0);
    for (let n = 2; n <= 12; n++) {
      expect(ringAngle(1, n) - ringAngle(0, n)).toBeCloseTo((2 * Math.PI) / n, 15);
      // one full turn (index = n is never requested by the retired loops,
      // 0..n-1 — but the arithmetic closes the circle within float tolerance)
      expect(ringAngle(n, n)).toBeCloseTo(2 * Math.PI, 12);
    }
  });

  it('radius 0 collapses to the center; negative radius mirrors through it', () => {
    expect(pointOnCircle(960, 540, 1.234, 0)).toEqual({ x: 960, y: 540 });
    const r = pointOnCircle(960, 540, 0.7, 100);
    const m = pointOnCircle(960, 540, 0.7, -100);
    expect(m.x).toBeCloseTo(2 * 960 - r.x, 12);
    expect(m.y).toBeCloseTo(2 * 540 - r.y, 12);
  });

  it('NaN operands propagate raw (the retired forms did not sanitize)', () => {
    expect(Object.is(pointOnCircle(NaN, 540, 0, 100).x, NaN)).toBe(true);
    expect(Object.is(pointOnCircle(960, 540, 0, NaN).x, NaN)).toBe(true);
    expect(Object.is(pointOnCircle(960, 540, NaN, 100).x, NaN)).toBe(true);
  });

  it('WEIGHTED-SECTOR scope-out divergence pin: mindmap branch sectors are NOT ring steps', () => {
    // mindmap-strategy positions branch roots by weight-proportional sector
    // `(2π·weight)/totalWeight` — converging it onto ringAngle would change
    // layout for every unbalanced tree. Pinned as a DIFFERENT concept:
    const weights = [1, 2, 5];
    const total = 8;
    const sector0 = (2 * Math.PI * weights[0]) / total; // 2π/8, not 0
    expect(sector0).not.toBe(ringAngle(0, 3));
    expect(sector0).toBeCloseTo(Math.PI / 4, 15);
  });

  it('LIVE WITNESS: CycleLayoutStrategy renders the canonical ring (5 nodes, no overlap → pure placement)', () => {
    const strategy = new CycleLayoutStrategy();
    const nodes: NodeDatum[] = [1, 2, 3, 4, 5].map((k) => ({ id: `n${k}`, label: `n${k}` }));
    const result = strategy.apply(nodes, []);
    // dimensionless nodes → getNodeWidth(node, DEFAULT) = 120/60, so
    // maxNodeWidth=120: circumferenceNeeded = 5·120·1.2 = 720 → minRadius
    // ≈ 114.6 < MIN_RADIUS 200 → radius = 200 exactly.
    const radius = 200;
    for (let i = 0; i < 5; i++) {
      const p = pointOnCircle(
        DEFAULT_CANVAS_WIDTH / 2, DEFAULT_CANVAS_HEIGHT / 2,
        ringAngle(i, 5), radius,
      );
      expect(result.nodes[i].x).toBe(p.x - 120 / 2);
      expect(result.nodes[i].y).toBe(p.y - 60 / 2);
    }
  });
});

// ---------------------------------------------------------------------------
// Layer 3: source anchors — delegation shapes at every migrated site, the
// canonical bodies exactly once, the retired shapes gone, the scope-outs
// documented.
// ---------------------------------------------------------------------------

describe('round 48: ring placement — layer 3 source anchors', () => {
  it('layout-utils holds the canonical bodies exactly once', () => {
    const src = readSource('src/visualization/layout-utils.ts');
    expect((src.match(/export function ringAngle\(/g) ?? []).length).toBe(1);
    expect((src.match(/export function pointOnCircle\(/g) ?? []).length).toBe(1);
    expect((src.match(/centerX \+ radius \* Math\.cos\(angle\)/g) ?? []).length).toBe(1);
    expect((src.match(/\(2 \* Math\.PI \* index\) \/ count/g) ?? []).length).toBe(1);
  });

  it('cycle-strategy delegates both rings (placement + force-directed attraction target)', () => {
    const src = readSource('src/visualization/strategies/cycle-strategy.ts');
    expect((src.match(/pointOnCircle\(centerX, centerY, ringAngle\(i, n\), radius\)/g) ?? []).length).toBe(1);
    expect((src.match(/pointOnCircle\(centerX, centerY, ringAngle\(i, forceNodes\.length\), radius\)/g) ?? []).length).toBe(1);
    expect(src).not.toMatch(/const angle = \(2 \* Math\.PI \* i\) \/ n;/);
    expect(src).not.toMatch(/const targetX = centerX \+ radius \* Math\.cos\(angle\);/);
    // the reciprocal circumference→radius conversion is a DIFFERENT concept and stays
    expect(src).toMatch(/minRadius = circumferenceNeeded \/ \(2 \* Math\.PI\)/);
  });

  it('network-strategy delegates the importance ring (per-node radius threads the seam)', () => {
    const src = readSource('src/visualization/strategies/network-strategy.ts');
    expect((src.match(/pointOnCircle\(cx, cy, ringAngle\(i, nodes\.length\), radius\)/g) ?? []).length).toBe(1);
    expect(src).not.toMatch(/x: cx \+ radius \* Math\.cos\(angle\) - w \/ 2/);
  });

  it('mindmap-strategy delegates all three reads (spiral ring + polar subtree + branch root)', () => {
    const src = readSource('src/visualization/strategies/mindmap-strategy.ts');
    expect((src.match(/pointOnCircle\(cx, cy, ringAngle\(i, nodes\.length\), radius\)/g) ?? []).length).toBe(1);
    expect((src.match(/pointOnCircle\(center\.x, center\.y, angle, childRadius\)/g) ?? []).length).toBe(1);
    expect((src.match(/pointOnCircle\(center\.x, center\.y, baseAngle, branchRadius\)/g) ?? []).length).toBe(1);
    expect(src).not.toMatch(/const bx = center\.x \+ Math\.cos\(baseAngle\) \* branchRadius;/);
    // the WEIGHTED sector is scoped out (layer-2 divergence pin) and stays inline
    expect(src).toMatch(/const sectorAngle = \(2 \* Math\.PI \* branchWeights\[i\]\) \/ totalWeight;/);
  });

  it('FallbackLayoutStrategy delegates the cycle ring', () => {
    const src = readSource('src/visualization/strategies/FallbackLayoutStrategy.ts');
    expect((src.match(/pointOnCircle\(centerX, centerY, ringAngle\(index, nodes\.length\), radius\)/g) ?? []).length).toBe(1);
    expect(src).not.toMatch(/const angle = \(2 \* Math\.PI \* index\) \/ nodes\.length;/);
  });

  it('LayoutOptimizer delegates both rings; the dead Math.max(1, count) guard is retired', () => {
    const src = readSource('src/visualization/strategies/LayoutOptimizer.ts');
    expect((src.match(/pointOnCircle\(centerX, centerY, ringAngle\(index, nodes\.length\), radius\)/g) ?? []).length).toBe(2);
    expect(src).not.toMatch(/\(2 \* Math\.PI \* index\) \/ Math\.max\(1, nodes\.length\)/);
    // the OTHER Math.max(1, …) uses were the grid/cols/rows floors — round 50
    // delegated them to squareGridColumns (grid-packing-single-source.test.ts
    // layer 3 + registry ban the retired inline shape). The positive pin follows
    // the delegation chain (r42 precedent).
    expect((src.match(/squareGridColumns\(nodes\.length\)/g) ?? []).length).toBe(2);
  });

  it('advanced-layouts delegates the center-coordinate ring (no top-left conversion)', () => {
    const src = readSource('src/visualization/advanced-layouts.ts');
    expect((src.match(/pointOnCircle\(centerX, centerY, ringAngle\(index, nodes\.length\), radius\)/g) ?? []).length).toBe(1);
    expect(src).not.toMatch(/x: centerX \+ radius \* Math\.cos\(angle\)/);
  });

  it('complex-layout-engine delegates both rings (clusters + within-cluster)', () => {
    const src = readSource('src/visualization/complex-layout-engine.ts');
    expect((src.match(/pointOnCircle\(centerX, centerY, ringAngle\(index, clusters\.length\), radius\)/g) ?? []).length).toBe(1);
    expect((src.match(/pointOnCircle\(clusterCenter\.x, clusterCenter\.y, ringAngle\(index, nodes\.length\), clusterRadius\)/g) ?? []).length).toBe(1);
    expect(src).not.toMatch(/x: clusterCenter\.x \+ clusterRadius \* Math\.cos\(angle\)/);
  });

  it('ProgressiveForceStrategy delegates the origin-centered init ring', () => {
    const src = readSource('src/visualization/layout/strategies/ProgressiveForceStrategy.ts');
    expect((src.match(/pointOnCircle\(0, 0, ringAngle\(i, nodes\.length\), radius\)/g) ?? []).length).toBe(1);
    expect(src).not.toMatch(/x: Math\.cos\(angle\) \* radius/);
  });

  it('strategies/OverlapResolver delegates the probe walk; the ±= radial PUSH stays inline by design', () => {
    const src = readSource('src/visualization/strategies/OverlapResolver.ts');
    expect((src.match(/pointOnCircle\(node1\.x, node1\.y, ringAngle\(attempt, attempts\), distance\)/g) ?? []).length).toBe(1);
    expect(src).not.toMatch(/const newX = node1\.x \+ Math\.cos\(angle\) \* distance;/);
    // scope-out: the displacement push has NO circle center (direction vector
    // × magnitude, mutation-form `+=`/`-=`), so it keeps its inline reads.
    expect(src).toMatch(/node1\.x \+= Math\.cos\(angle\) \* separation;/);
    expect(src).toMatch(/node2\.x -= Math\.cos\(angle\) \* separation;/);
  });

  it('both worker ESM mocks provide the new layout-utils exports (link-error guard)', () => {
    for (const rel of [
      'src/workers/__tests__/layout-delegation-helpers.test.ts',
      'src/workers/__tests__/layout-engine-integration.test.ts',
    ]) {
      const src = readSource(rel);
      expect((src.match(/ringAngle: jest\.fn\(/g) ?? []).length).toBe(1);
      expect((src.match(/pointOnCircle: jest\.fn\(/g) ?? []).length).toBe(1);
    }
  });
});
