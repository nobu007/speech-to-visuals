/**
 * @jest-environment node
 */
/**
 * force-directed-step-single-source.test.ts — round 40.
 *
 * Family: the force-directed STEP BODY — init force map / pairwise repulsion
 * (strong + moderate regimes) / edge attraction toward idealEdgeLength /
 * damped velocity-capped position update / canvas-bounds clamp — was inlined
 * VERBATIM at two live sites that r15 had already unified at the PARAMETER
 * layer only:
 *
 *   - src/visualization/strategies/NetworkLayoutStrategy.ts `applyForceStep`
 *       (bounds from the passed `config.width` / `config.height`)
 *   - src/visualization/enhanced-zero-overlap-layout.ts
 *     `applyEnhancedForceStep` (bounds from `this.config.canvasWidth` /
 *     `canvasHeight`)
 *
 * plus a THIRD, drifted copy `applyForceDirectedStep` (ezo) whose formulas
 * were v1-era (`forceStrength * 1000 / dist²` repulsion, `forceStrength *
 * dist * 0.1` attraction) and which had ZERO production callers — retired in
 * the same round. r15 single-sourced the phase schedule, physics coefficients
 * and convergence predicate (force-directed-params.ts + runForceDirectedPhases),
 * but the step body itself — the value+operator core that consumes those
 * parameters — remained two hand-maintained copies. A sign flip, a dropped
 * velocity cap, or an inverted bounds clamp edited into ONE copy would leave
 * the other engine untouched: two "identical" force-directed engines whose
 * layouts diverge, the exact invariant-split class rounds 15/38/39 kept
 * finding between producer and judge.
 *
 * Canonical since round 40: `applyForceDirectedStep(nodes, edges, strength,
 * optimalSpacing, bounds)` in src/visualization/force-directed-params.ts —
 * the same module that owns the parameters, so params and the arithmetic that
 * consumes them cannot drift apart either.
 *
 * DRIFT SCENARIO this guard defends against: either consumer re-inlines the
 * body (or edits the canonical formula in a way that changes any coordinate),
 * the ezo delegation swaps width/height, or a bounds clamp is dropped.
 *
 * Layers:
 *   1. VERBATIM ORACLE — the pre-round-40 inline step bodies, frozen below
 *      (one per consumer, preserving each one's OWN bounds expressions), must
 *      produce BITWISE-identical node positions (Object.is, so -0 survives)
 *      to (a) the canonical helper and (b) each consumer's live delegation
 *      seam, over a seeded fuzz corpus × strength {2.0, 1.0, 0.5} (the real
 *      phase schedule) × spacing {40, 60, 80} × 3 chained steps.
 *   2. SEMANTIC PINS — repulsion regimes, attraction toward the ideal edge
 *      length, per-step displacement ceiling (maxVelocity × damping), bounds
 *      clamp with BOUNDS_MARGIN, dist=0 pair stays finite, dangling edges
 *      skipped, empty input no-throw.
 *   3. SOURCE ANCHORS — both consumers delegate and no longer inline the
 *      body; the drifted dead copy is gone from ezo.
 *
 * The "no site re-inlines the force formulas" discovery sweep lives in the
 * shared registry (frozen-literal-families/force-directed-step.ts); this file
 * holds the behavioral pins.
 */

import { describe, it, expect } from '@jest/globals';
import { mulberry32 } from '@tests/helpers/fuzz';
import { readSource } from '@tests/guards/freeze-guard';
import type { PositionedNode, EdgeDatum, NodeDatum } from '@/types/diagram';
import type { LayoutConfig } from '@/visualization/types';
import { NetworkLayoutStrategy } from '@/visualization/strategies/NetworkLayoutStrategy';
import { ZeroOverlapLayoutEngine } from '@/visualization/enhanced-zero-overlap-layout';
import { getNodeWidth, getNodeHeight } from '@/visualization/node-dimensions';
import { distance } from '@/visualization/layout-utils';
import {
  FORCE_DIRECTED_PHYSICS,
  applyForceDirectedStep,
} from '@/visualization/force-directed-params';

// ---------------------------------------------------------------------------
// Layer 1 material: the VERBATIM pre-round-40 inline step bodies. Do not
// "improve" these copies: their job is to be the old behavior, not good
// behavior. The Network variant keeps its `config.width/height` bounds; the
// ezo variant keeps its `canvasWidth/Height` bounds — the ONLY difference the
// migration was allowed to have is where those two numbers come from.
// ---------------------------------------------------------------------------

/** NetworkLayoutStrategy.applyForceStep @ pre-round-40 (verbatim body). */
function inlineNetworkForceStep(
  nodes: PositionedNode[],
  edges: EdgeDatum[],
  strength: number,
  optimalSpacing: number,
  config: { width: number; height: number },
): void {
  const forces = new Map<string, { x: number; y: number }>();

  // Initialize forces
  nodes.forEach(node => {
    forces.set(node.id, { x: 0, y: 0 });
  });

  // Apply repulsive forces between all node pairs
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const node1 = nodes[i];
      const node2 = nodes[j];

      const dx = (node2.x + getNodeWidth(node2) / 2) - (node1.x + getNodeWidth(node1) / 2);
      const dy = (node2.y + getNodeHeight(node2) / 2) - (node1.y + getNodeHeight(node1) / 2);
      const dist = distance(dx, dy);

      if (dist > 0) {
        const idealDistance = optimalSpacing + (getNodeWidth(node1) + getNodeWidth(node2)) / 2;
        let repulsion = 0;

        if (dist < idealDistance) {
          // Strong repulsion when too close
          repulsion = strength * (idealDistance - dist) / dist * FORCE_DIRECTED_PHYSICS.STRONG_REPULSION_FACTOR;
        } else if (dist < idealDistance * FORCE_DIRECTED_PHYSICS.REPULSION_RANGE_MULTIPLIER) {
          // Moderate repulsion in intermediate range
          repulsion = strength * idealDistance / (dist * dist) * FORCE_DIRECTED_PHYSICS.MODERATE_REPULSION_FACTOR;
        }

        if (repulsion > 0) {
          const fx = (dx / dist) * repulsion;
          const fy = (dy / dist) * repulsion;

          const force1 = forces.get(node1.id) ?? { x: 0, y: 0 };
          const force2 = forces.get(node2.id) ?? { x: 0, y: 0 };

          force1.x -= fx;
          force1.y -= fy;
          force2.x += fx;
          force2.y += fy;
        }
      }
    }
  }

  // Apply attractive forces along edges
  edges.forEach(edge => {
    const source = nodes.find(n => n.id === edge.from);
    const target = nodes.find(n => n.id === edge.to);

    if (source && target) {
      const dx = (target.x + getNodeWidth(target) / 2) - (source.x + getNodeWidth(source) / 2);
      const dy = (target.y + getNodeHeight(target) / 2) - (source.y + getNodeHeight(source) / 2);
      const dist = distance(dx, dy);

      if (dist > 0) {
        const idealEdgeLength = optimalSpacing * FORCE_DIRECTED_PHYSICS.IDEAL_EDGE_LENGTH_MULTIPLIER;
        const attraction = strength * (dist - idealEdgeLength) * FORCE_DIRECTED_PHYSICS.ATTRACTION_FACTOR;

        const fx = (dx / dist) * attraction;
        const fy = (dy / dist) * attraction;

        const forceSource = forces.get(source.id) ?? { x: 0, y: 0 };
        const forceTarget = forces.get(target.id) ?? { x: 0, y: 0 };

        forceSource.x += fx;
        forceSource.y += fy;
        forceTarget.x -= fx;
        forceTarget.y -= fy;
      }
    }
  });

  // Apply forces with damping and bounds checking
  nodes.forEach(node => {
    const force = forces.get(node.id) ?? { x: 0, y: 0 };
    const damping = FORCE_DIRECTED_PHYSICS.DAMPING;

    // Limit maximum velocity
    const maxVelocity = optimalSpacing / FORCE_DIRECTED_PHYSICS.MAX_VELOCITY_DIVISOR;
    const velocity = distance(force.x, force.y);

    if (velocity > maxVelocity) {
      force.x = (force.x / velocity) * maxVelocity;
      force.y = (force.y / velocity) * maxVelocity;
    }

    // Update position
    node.x += force.x * damping;
    node.y += force.y * damping;

    // Constrain to canvas bounds
    const margin = FORCE_DIRECTED_PHYSICS.BOUNDS_MARGIN;
    node.x = Math.max(margin, Math.min(config.width - getNodeWidth(node) - margin, node.x));
    node.y = Math.max(margin, Math.min(config.height - getNodeHeight(node) - margin, node.y));
  });
}

/** ezo applyEnhancedForceStep @ pre-round-40 (verbatim body, canvas bounds). */
function inlineEzoForceStep(
  nodes: PositionedNode[],
  edges: EdgeDatum[],
  strength: number,
  optimalSpacing: number,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const forces = new Map<string, { x: number; y: number }>();

  // Initialize forces
  nodes.forEach(node => {
    forces.set(node.id, { x: 0, y: 0 });
  });

  // Enhanced repulsive forces with distance-based scaling
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const node1 = nodes[i];
      const node2 = nodes[j];

      const dx = (node2.x + getNodeWidth(node2) / 2) - (node1.x + getNodeWidth(node1) / 2);
      const dy = (node2.y + getNodeHeight(node2) / 2) - (node1.y + getNodeHeight(node1) / 2);
      const dist = distance(dx, dy);

      if (dist > 0) {
        const idealDistance = optimalSpacing + (getNodeWidth(node1) + getNodeWidth(node2)) / 2;
        let repulsion = 0;

        if (dist < idealDistance) {
          repulsion = strength * (idealDistance - dist) / dist * FORCE_DIRECTED_PHYSICS.STRONG_REPULSION_FACTOR;
        } else if (dist < idealDistance * FORCE_DIRECTED_PHYSICS.REPULSION_RANGE_MULTIPLIER) {
          repulsion = strength * idealDistance / (dist * dist) * FORCE_DIRECTED_PHYSICS.MODERATE_REPULSION_FACTOR;
        }

        if (repulsion > 0) {
          const fx = (dx / dist) * repulsion;
          const fy = (dy / dist) * repulsion;

          const force1 = forces.get(node1.id) ?? { x: 0, y: 0 };
          const force2 = forces.get(node2.id) ?? { x: 0, y: 0 };

          force1.x -= fx;
          force1.y -= fy;
          force2.x += fx;
          force2.y += fy;
        }
      }
    }
  }

  // Attractive forces along edges with optimal distance target
  edges.forEach(edge => {
    const source = nodes.find(n => n.id === (edge.from));
    const target = nodes.find(n => n.id === (edge.to));

    if (source && target) {
      const dx = (target.x + getNodeWidth(target) / 2) - (source.x + getNodeWidth(source) / 2);
      const dy = (target.y + getNodeHeight(target) / 2) - (source.y + getNodeHeight(source) / 2);
      const dist = distance(dx, dy);

      if (dist > 0) {
        const idealEdgeLength = optimalSpacing * FORCE_DIRECTED_PHYSICS.IDEAL_EDGE_LENGTH_MULTIPLIER;
        const attraction = strength * (dist - idealEdgeLength) * FORCE_DIRECTED_PHYSICS.ATTRACTION_FACTOR;

        const fx = (dx / dist) * attraction;
        const fy = (dy / dist) * attraction;

        const forceSource = forces.get(source.id) ?? { x: 0, y: 0 };
        const forceTarget = forces.get(target.id) ?? { x: 0, y: 0 };

        forceSource.x += fx;
        forceSource.y += fy;
        forceTarget.x -= fx;
        forceTarget.y -= fy;
      }
    }
  });

  // Apply forces with enhanced damping and bounds checking
  nodes.forEach(node => {
    const force = forces.get(node.id) ?? { x: 0, y: 0 };
    const damping = FORCE_DIRECTED_PHYSICS.DAMPING;

    const maxVelocity = optimalSpacing / FORCE_DIRECTED_PHYSICS.MAX_VELOCITY_DIVISOR;
    const velocity = distance(force.x, force.y);

    if (velocity > maxVelocity) {
      force.x = (force.x / velocity) * maxVelocity;
      force.y = (force.y / velocity) * maxVelocity;
    }

    node.x += force.x * damping;
    node.y += force.y * damping;

    const margin = FORCE_DIRECTED_PHYSICS.BOUNDS_MARGIN;
    node.x = Math.max(margin, Math.min(canvasWidth - getNodeWidth(node) - margin, node.x));
    node.y = Math.max(margin, Math.min(canvasHeight - getNodeHeight(node) - margin, node.y));
  });
}

// ---------------------------------------------------------------------------
// Corpus helpers
// ---------------------------------------------------------------------------

function positioned(id: string, x: number, y: number, width: number, height: number): PositionedNode {
  return { id, label: id, x, y, width, height };
}

interface CorpusCase {
  name: string;
  nodes: PositionedNode[];
  edges: EdgeDatum[];
}

/** Seeded corpus: mixed extents, overlapping seeds, chain+ring+star edges, ghosts. */
function fuzzCase(seed: number): CorpusCase {
  const rng = mulberry32(seed);
  const count = 8 + Math.floor(rng() * 8);
  const nodes: PositionedNode[] = [];
  for (let i = 0; i < count; i++) {
    const w = 60 + Math.floor(rng() * 160);
    const h = 40 + Math.floor(rng() * 80);
    // Dense band [0, 500)² so strong AND moderate repulsion regimes both fire.
    nodes.push(positioned(
      `n${i}`,
      Math.floor(rng() * 500),
      Math.floor(rng() * 500),
      w,
      h,
    ));
  }
  const edges: EdgeDatum[] = [];
  for (let i = 1; i < count; i++) {
    edges.push({ from: `n${i - 1}`, to: `n${i}` }); // chain
  }
  if (count > 3) edges.push({ from: `n${count - 1}`, to: `n0` }); // ring
  if (count > 4) edges.push({ from: `n0`, to: `n${Math.floor(count / 2)}` }); // chord
  edges.push({ from: 'ghost-a', to: 'n0' }); // dangling — skipped
  edges.push({ from: 'n0', to: 'ghost-b' }); // dangling — skipped
  return { name: `seed-${seed}`, nodes, edges };
}

function cloneNodes(nodes: PositionedNode[]): PositionedNode[] {
  return nodes.map(n => ({ ...n }));
}

/** Bitwise comparison (Object.is) of every coordinate, -0 included. */
function expectBitwiseEqual(actual: PositionedNode[], expected: PositionedNode[]): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < actual.length; i++) {
    expect(actual[i].id).toBe(expected[i].id);
    expect(Object.is(actual[i].x, expected[i].x)).toBe(true);
    expect(Object.is(actual[i].y, expected[i].y)).toBe(true);
  }
}

const CANVAS_W = 1280;
const CANVAS_H = 720;

const LAYOUT_CONFIG: LayoutConfig = {
  width: CANVAS_W,
  height: CANVAS_H,
  nodeWidth: 120,
  nodeHeight: 60,
  marginX: 40,
  marginY: 40,
  rankDirection: 'TB',
  nodeSeparation: 50,
  edgeSeparation: 30,
  rankSeparation: 80,
};

/** The live delegation seams, addressed the way the round-40 sites call them. */
function networkSeam(): (
  nodes: PositionedNode[], edges: EdgeDatum[], strength: number, spacing: number,
  config: LayoutConfig,
) => void {
  const strategy = new NetworkLayoutStrategy() as unknown as {
    applyForceStep(
      nodes: PositionedNode[], edges: EdgeDatum[], strength: number, optimalSpacing: number,
      config: LayoutConfig,
    ): void;
  };
  return (nodes, edges, strength, spacing, config) =>
    strategy.applyForceStep(nodes, edges, strength, spacing, config);
}

function ezoSeam(canvasWidth: number, canvasHeight: number): (
  nodes: PositionedNode[], edges: EdgeDatum[], strength: number, spacing: number,
) => void {
  const engine = new ZeroOverlapLayoutEngine({
    canvasWidth,
    canvasHeight,
  }) as unknown as {
    applyEnhancedForceStep(
      nodes: PositionedNode[], edges: EdgeDatum[], strength: number, optimalSpacing: number,
    ): void;
  };
  return (nodes, edges, strength, spacing) =>
    engine.applyEnhancedForceStep(nodes, edges, strength, spacing);
}

// ---------------------------------------------------------------------------
// Layer 1: verbatim oracle — canonical step ≡ pre-round-40 inline copies,
// through the canonical helper AND both consumers' live delegation seams.
// ---------------------------------------------------------------------------

describe('force-directed step: canonical ≡ pre-round-40 inline copies', () => {
  const STRENGTHS = [2.0, 1.0, 0.5]; // the real FORCE_DIRECTED_PHASES schedule
  const SPACINGS = [40, 60, 80];
  const STEPS = 3; // chained steps accumulate rounding-sensitive state

  for (const strength of STRENGTHS) {
    for (const spacing of SPACINGS) {
      it(`canonical helper is bitwise-equal to both inline copies (strength ${strength}, spacing ${spacing})`, () => {
        for (let seed = 1; seed <= 15; seed++) {
          const { nodes, edges } = fuzzCase(seed);

          const canonical = cloneNodes(nodes);
          const oracleNetwork = cloneNodes(nodes);
          const oracleEzo = cloneNodes(nodes);

          for (let step = 0; step < STEPS; step++) {
            applyForceDirectedStep(
              canonical, edges, strength, spacing, { width: CANVAS_W, height: CANVAS_H },
            );
            inlineNetworkForceStep(oracleNetwork, edges, strength, spacing, LAYOUT_CONFIG);
            inlineEzoForceStep(oracleEzo, edges, strength, spacing, CANVAS_W, CANVAS_H);
          }

          expectBitwiseEqual(canonical, oracleNetwork);
          expectBitwiseEqual(canonical, oracleEzo);
        }
      });

      it(`NetworkLayoutStrategy seam is bitwise-equal to its inline copy (strength ${strength}, spacing ${spacing})`, () => {
        const seam = networkSeam();
        for (let seed = 1; seed <= 15; seed++) {
          const { nodes, edges } = fuzzCase(seed);
          const live = cloneNodes(nodes);
          const oracle = cloneNodes(nodes);
          for (let step = 0; step < STEPS; step++) {
            seam(live, edges, strength, spacing, LAYOUT_CONFIG);
            inlineNetworkForceStep(oracle, edges, strength, spacing, LAYOUT_CONFIG);
          }
          expectBitwiseEqual(live, oracle);
        }
      });

      it(`ezo seam is bitwise-equal to its inline copy (strength ${strength}, spacing ${spacing})`, () => {
        const seam = ezoSeam(CANVAS_W, CANVAS_H);
        for (let seed = 1; seed <= 15; seed++) {
          const { nodes, edges } = fuzzCase(seed);
          const live = cloneNodes(nodes);
          const oracle = cloneNodes(nodes);
          for (let step = 0; step < STEPS; step++) {
            seam(live, edges, strength, spacing);
            inlineEzoForceStep(oracle, edges, strength, spacing, CANVAS_W, CANVAS_H);
          }
          expectBitwiseEqual(live, oracle);
        }
      });
    }
  }

  it('the two pre-round-40 inline copies agree with each other (drift witness: they were already identical)', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const { nodes, edges } = fuzzCase(seed);
      const a = cloneNodes(nodes);
      const b = cloneNodes(nodes);
      for (let step = 0; step < STEPS; step++) {
        inlineNetworkForceStep(a, edges, 2.0, 60, LAYOUT_CONFIG);
        inlineEzoForceStep(b, edges, 2.0, 60, CANVAS_W, CANVAS_H);
      }
      expectBitwiseEqual(a, b);
    }
  });

  it('ezo seam clamps along the ENGINE canvas axes (width/height-swap witness)', () => {
    // The ezo delegation maps its OWN config fields onto the bounds object —
    // the one place a transposed axis could hide. The fuzz corpus is a dense
    // [0,500)² band where the clamp almost never fires, so it CANNOT see a
    // width/height swap; this witness parks two force-free nodes (no edges,
    // beyond the repulsion cut-off) past BOTH upper clamps and pins the exact
    // clamped coordinates. Under swapped bounds a.x would land at 580 (not
    // 1140) and b.y would stay unclamped near 660 (not 640).
    const seam = ezoSeam(CANVAS_W, CANVAS_H); // 1280 × 720, non-square on purpose
    const nodes = [
      positioned('a', 1200, 360, 120, 60), // past x upper clamp only
      positioned('b', 1400, 660, 120, 60), // past x AND y upper clamps
    ];
    seam(nodes, [], 2.0, 40);
    // No forces act (no edges, pair beyond 2×idealDistance) → the clamp is the
    // ONLY mover, so the results are exact.
    expect(nodes[0].x).toBe(CANVAS_W - 120 - FORCE_DIRECTED_PHYSICS.BOUNDS_MARGIN); // 1140
    expect(nodes[0].y).toBe(360);
    expect(nodes[1].x).toBe(CANVAS_W - 120 - FORCE_DIRECTED_PHYSICS.BOUNDS_MARGIN);
    expect(nodes[1].y).toBe(CANVAS_H - 60 - FORCE_DIRECTED_PHYSICS.BOUNDS_MARGIN); // 640
  });

  it('empty node array and empty edge array are no-ops without throwing', () => {
    expect(() => applyForceDirectedStep([], [], 2.0, 40, { width: 1920, height: 1080 })).not.toThrow();
    const solo = [positioned('solo', 100, 100, 120, 60)];
    applyForceDirectedStep(solo, [], 2.0, 40, { width: 1920, height: 1080 });
    expect(solo[0].x).toBe(100);
    expect(solo[0].y).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Layer 2: semantic pins on the canonical step.
// ---------------------------------------------------------------------------

describe('force-directed step: semantics', () => {
  it('strong-repulsion regime: overlapping pair moves apart', () => {
    const nodes = [positioned('a', 100, 100, 120, 60), positioned('b', 140, 100, 120, 60)];
    const before = Math.abs(nodes[1].x - nodes[0].x);
    applyForceDirectedStep(nodes, [], 2.0, 40, { width: 1920, height: 1080 });
    const after = Math.abs(nodes[1].x - nodes[0].x);
    expect(after).toBeGreaterThan(before);
  });

  it('pairs beyond the repulsion range do not repel (moderate cut-off ×idealDistance)', () => {
    // spacing 40 + widths (120+120)/2 = 120 → idealDistance 160, cut-off 320.
    // Both nodes start well inside the canvas so ONLY repulsion could move
    // them (the bounds clamp is a no-op at these coordinates).
    const far = [positioned('a', 200, 500, 120, 60), positioned('b', 840, 500, 120, 60)];
    applyForceDirectedStep(far, [], 2.0, 40, { width: 1920, height: 1080 });
    expect(far[0].x).toBe(200);
    expect(far[1].x).toBe(840);
  });

  it('attraction pulls an over-long edge pair closer', () => {
    const nodes = [positioned('a', 100, 500, 120, 60), positioned('b', 1400, 500, 120, 60)];
    const before = Math.abs(nodes[1].x - nodes[0].x);
    applyForceDirectedStep(nodes, [{ from: 'a', to: 'b' }], 2.0, 40, { width: 1920, height: 1080 });
    const after = Math.abs(nodes[1].x - nodes[0].x);
    expect(after).toBeLessThan(before);
  });

  it('per-step displacement never exceeds maxVelocity × damping (in-bounds corpus)', () => {
    // Corpus translated +100/+100 and canvas 4000×4000: every start AND end
    // coordinate is far from both clamp edges, so the bounds clamp can NEVER
    // fire here — this pins the velocity cap alone; the clamp has its own
    // dedicated test below. (The clamp is two-sided: Math.max(margin, …)
    // pulls nodes below `margin` UP, which is real displacement not covered
    // by the velocity cap.)
    const maxVelocity = 80 / FORCE_DIRECTED_PHYSICS.MAX_VELOCITY_DIVISOR; // spacing 80
    const ceiling = maxVelocity * FORCE_DIRECTED_PHYSICS.DAMPING + 1e-9;
    for (let seed = 1; seed <= 15; seed++) {
      const { nodes, edges } = fuzzCase(seed);
      const shifted = nodes.map(n => positioned(n.id, (n.x ?? 0) + 100, (n.y ?? 0) + 100, n.width ?? 120, n.height ?? 60));
      const before = new Map(shifted.map(n => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]));
      applyForceDirectedStep(shifted, edges, 2.0, 80, { width: 4000, height: 4000 });
      for (const n of shifted) {
        const p = before.get(n.id)!;
        const moved = distance((n.x ?? 0) - p.x, (n.y ?? 0) - p.y);
        expect(moved).toBeLessThanOrEqual(ceiling);
      }
    }
  });

  it('bounds clamp keeps every node inside [margin, canvas - size - margin]', () => {
    // Start every node far outside the canvas so the clamp is the only force
    // that decides the final coordinate.
    const nodes = [
      positioned('a', -500, -500, 120, 60),
      positioned('b', 5000, -400, 120, 60),
      positioned('c', -300, 5000, 120, 60),
      positioned('d', 4000, 4000, 120, 60),
    ];
    applyForceDirectedStep(nodes, [], 2.0, 40, { width: CANVAS_W, height: CANVAS_H });
    const m = FORCE_DIRECTED_PHYSICS.BOUNDS_MARGIN;
    for (const n of nodes) {
      expect(n.x).toBeGreaterThanOrEqual(m);
      expect(n.x).toBeLessThanOrEqual(CANVAS_W - 120 - m);
      expect(n.y).toBeGreaterThanOrEqual(m);
      expect(n.y).toBeLessThanOrEqual(CANVAS_H - 60 - m);
    }
  });

  it('a coincident pair (dist 0) produces no NaN', () => {
    const nodes = [positioned('a', 200, 200, 120, 60), positioned('b', 200, 200, 120, 60)];
    applyForceDirectedStep(nodes, [{ from: 'a', to: 'b' }], 2.0, 40, { width: CANVAS_W, height: CANVAS_H });
    for (const n of nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
  });

  it('dangling edges (ghost endpoints) are skipped, not thrown', () => {
    const nodes = [positioned('a', 100, 100, 120, 60)];
    expect(() =>
      applyForceDirectedStep(
        nodes,
        [{ from: 'ghost', to: 'a' }, { from: 'a', to: 'ghost' }, { from: 'x', to: 'y' }],
        2.0, 40, { width: CANVAS_W, height: CANVAS_H },
      ),
    ).not.toThrow();
    expect(nodes[0].x).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Layer 3: source anchors — delegation shape at both consumers, dead copy gone.
// ---------------------------------------------------------------------------

describe('force-directed step: source anchors', () => {
  const NETWORK = 'src/visualization/strategies/NetworkLayoutStrategy.ts';
  const EZO = 'src/visualization/enhanced-zero-overlap-layout.ts';
  const CANONICAL = 'src/visualization/force-directed-params.ts';

  it('NetworkLayoutStrategy delegates the step to the canonical module', () => {
    const src = readSource(NETWORK);
    expect(src).toContain('applyForceDirectedStep(');
    expect(src).toContain("from '../force-directed-params'");
    // The body is gone: no local re-freeze of the signature formulas.
    expect(src).not.toContain('force1.x -= fx');
    expect(src).not.toContain('(idealDistance - dist) / dist');
  });

  it('ezo delegates the step with its OWN canvas bounds (r15/r40 wiring intact)', () => {
    const src = readSource(EZO);
    expect(src).toContain('applyForceDirectedStep(');
    expect(src).toContain('this.config.canvasWidth');
    expect(src).not.toContain('force1.x -= fx');
    expect(src).not.toContain('(idealDistance - dist) / dist');
    // The drifted DEAD third copy (v1 formulas, zero production callers) is
    // retired with this round — its method name must not come back.
    expect(src).not.toContain('private applyForceDirectedStep(');
    expect(src).not.toContain('forceStrength * 1000');
  });

  it('the canonical module owns the body exactly once', () => {
    const src = readSource(CANONICAL);
    expect(src.match(/force1\.x -= fx/g)?.length).toBe(1);
    expect(src.match(/\(idealDistance - dist\) \/ dist/g)?.length).toBe(1);
    expect(src).toContain('BOUNDS_MARGIN');
  });

  it('the r15 parameter layer is untouched by the step extraction', () => {
    const src = readSource(CANONICAL);
    expect(src).toContain('runForceDirectedPhases');
    expect(src).toContain('FORCE_DIRECTED_PHYSICS');
    // Both consumers still run the shared phase schedule.
    expect(readSource(NETWORK)).toContain('runForceDirectedPhases');
    expect(readSource(EZO)).toContain('runForceDirectedPhases');
  });
});
