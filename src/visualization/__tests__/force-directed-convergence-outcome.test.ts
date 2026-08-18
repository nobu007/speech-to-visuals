/**
 * Tests: force-directed convergence predicate — LAYOUT OUTCOME parity.
 *
 * The convergence-predicate unification (0531aa4f, round 15) changed WHEN
 * layout phases exit: the canonical predicate (`i % 10 === 0`, i=0 included)
 * lets a phase that starts overlap-free exit after ONE step, where the old
 * NetworkLayoutStrategy predicate (`i % 10 === 0 && i > 0`) burned 11 steps
 * before its first check. The existing pins
 * (tests/guards/force-directed-params-single-source.test.ts) assert
 * ITERATION-COUNT behavior only — they cannot say whether the earlier exit
 * regresses the rendered result. This file pins the OUTCOME.
 *
 * Measured baseline (2026-08-15, canvas 1920×1080, node 120×60, separation 50):
 *
 *   topology    canonical        old predicate     full budget
 *   chain-8     steps=3  ov=0    steps=33 ov=0     ov=0
 *   ring-12     steps=3  ov=0    steps=33 ov=0     ov=0
 *   star-12     steps=3  ov=0    steps=33 ov=0     ov=0
 *   complete-8  steps=3  ov=0    steps=33 ov=0     ov=0
 *   hubs-15     steps=3  ov=0    steps=33 ov=0     ov=0
 *   chain-20    steps=3  ov=0    steps=33 ov=0     ov=0
 *   ring-24     steps=3  ov=0    steps=33 ov=0     ov=0
 *   chain-40    steps=75 ov=0    steps=75 ov=0     ov=0
 *   ring-40     steps=75 ov=0    steps=75 ov=0     ov=0
 *   grid-64     steps=75 ov=0    steps=75 ov=0     ov=0
 *   star-50     steps=75 ov=0    steps=75 ov=0     ov=0
 *   rand-100    steps=75 ov=7    steps=75 ov=7     ov=7
 *
 * (rand-100 = 100 nodes with a partial chain, the only topology whose final
 * layout retains geometric overlaps in every variant — kept precisely because
 * it pins that the earlier exit does not ADD overlaps where none were fixed.)
 *
 * (ov = raw geometric overlaps via `nodesOverlap(…, 0)`; every variant also
 * has 0 bounds violations.) Conclusion, now pinned: the earlier exit NEVER
 * worsens overlap quality — on overlap-free starts it reaches the identical
 * outcome in 3 steps instead of 33, and on dense topologies (never converged)
 * all three variants are value-identical because the budget is exhausted.
 *
 * RED vectors (verified by mutation, 2026-08-15):
 *   - reverting the canonical predicate to `&& i > 0` → the one-step-per-phase
 *     sparse assertion fails (the canonical arm calls the production runner);
 *   - removing the bounds clamp in applyForceStep → 5 oob assertions fail;
 *   - inflating the initializeNodePositions jitter ×20 → 3 geometric-overlap
 *     assertions fail.
 * A repulsion-sign flip is NOT outcome-observable on these topologies (the
 * damped, velocity-capped steps barely move an already-separated layout) —
 * that vector stays covered by the physics value pins in the round-15 guard,
 * not by outcome assertions.
 */
import { NetworkLayoutStrategy } from '@/visualization/strategies/NetworkLayoutStrategy';
import {
  FORCE_DIRECTED_PHYSICS,
  FORCE_DIRECTED_PHASES,
  runForceDirectedPhases,
} from '@/visualization/force-directed-params';
import { nodesOverlap } from '@/visualization/layout-utils';
import type { NodeDatum, EdgeDatum } from '@stv/core/types/diagram';
import type { LayoutConfig } from '@/visualization/types';

const CANVAS: LayoutConfig = {
  width: 1920,
  height: 1080,
  nodeWidth: 120,
  nodeHeight: 60,
  marginX: 50,
  marginY: 50,
  rankDirection: 'TB',
  nodeSeparation: 50,
  edgeSeparation: 10,
  rankSeparation: 80,
};

interface Topology {
  readonly name: string;
  readonly nodes: NodeDatum[];
  readonly edges: EdgeDatum[];
}

function topo(name: string, count: number, edges: EdgeDatum[]): Topology {
  const nodes: NodeDatum[] = Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    label: `Node ${i}`,
  }));
  return { name, nodes, edges };
}

function chain(n: number): EdgeDatum[] {
  return Array.from({ length: n - 1 }, (_, i) => ({ from: `n${i}`, to: `n${i + 1}` }));
}
function ring(n: number): EdgeDatum[] {
  return [...chain(n), { from: `n${n - 1}`, to: `n0` }];
}
function star(n: number): EdgeDatum[] {
  return Array.from({ length: n - 1 }, (_, i) => ({ from: `n0`, to: `n${i + 1}` }));
}
function complete(n: number): EdgeDatum[] {
  const edges: EdgeDatum[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) edges.push({ from: `n${i}`, to: `n${j}` });
  }
  return edges;
}
function grid(rows: number, cols: number): EdgeDatum[] {
  const edges: EdgeDatum[] = [];
  const at = (r: number, c: number) => `n${r * cols + c}`;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c < cols - 1) edges.push({ from: at(r, c), to: at(r, c + 1) });
      if (r < rows - 1) edges.push({ from: at(r, c), to: at(r + 1, c) });
    }
  }
  return edges;
}

/**
 * Topologies whose initial grid layout is already overlap-free: the canonical
 * predicate exits each phase after one step (the exact behavior change of
 * 0531aa4f), so these are the regression-sensitive half of the parity table.
 */
const SPARSE: Topology[] = [
  topo('chain-8', 8, chain(8)),
  topo('ring-12', 12, ring(12)),
  topo('star-12', 12, star(12)),
  topo('complete-8', 8, complete(8)),
  topo('hubs-15', 15, [
    ...star(5),
    { from: 'n0', to: 'n5' },
    { from: 'n0', to: 'n10' },
  ]),
  topo('chain-20', 20, chain(20)),
  topo('ring-24', 24, ring(24)),
];

/**
 * Topologies that never converge (initial layout overlaps at the required
 * spacing): all predicates exhaust the budget, isolating outcome parity from
 * exit timing.
 */
const DENSE: Topology[] = [
  topo('chain-40', 40, chain(40)),
  topo('ring-40', 40, ring(40)),
  topo('grid-64', 64, grid(8, 8)),
  topo('star-50', 50, star(50)),
  topo('partial-chain-100', 100, chain(100).slice(0, 80)),
];

type PredicateVariant = 'canonical' | 'old' | 'full';

interface RunOutcome {
  steps: number;
  geometricOverlaps: number;
  outOfBounds: number;
  nonFinite: number;
}

/**
 * Drive the REAL strategy internals (initialize → force steps → overlap
 * count) under three convergence predicates. The 'canonical' arm calls the
 * production `runForceDirectedPhases` (so source mutations propagate into
 * this test); the private-method seam exists only for the 'old' and 'full'
 * comparison arms, which reproduce the historical predicate / the budget
 * ceiling that `generateLayout` never exposes.
 */
function runVariant(t: Topology, variant: PredicateVariant): RunOutcome {
  const strategy = new NetworkLayoutStrategy() as unknown as {
    calculateOptimalSpacing(n: number, c: LayoutConfig): number;
    initializeNodePositions(nodes: NodeDatum[], c: LayoutConfig, s: number): PositionedNodeLike[];
    applyForceStep(
      nodes: PositionedNodeLike[], edges: EdgeDatum[], strength: number, s: number, c: LayoutConfig
    ): void;
    countOverlaps(nodes: PositionedNodeLike[], s: number): number;
  };
  const spacing = strategy.calculateOptimalSpacing(t.nodes.length, CANVAS);
  const positioned = strategy.initializeNodePositions(t.nodes, CANVAS, spacing);
  let steps = 0;
  const apply = (strength: number): void => {
    steps++;
    strategy.applyForceStep(positioned, t.edges, strength, spacing, CANVAS);
  };
  const converged = (): boolean => strategy.countOverlaps(positioned, spacing) === 0;

  if (variant === 'canonical') {
    runForceDirectedPhases(apply, converged);
  } else if (variant === 'full') {
    for (const phase of FORCE_DIRECTED_PHASES) {
      for (let i = 0; i < phase.iterations; i++) apply(phase.strength);
    }
  } else {
    for (const phase of FORCE_DIRECTED_PHASES) {
      for (let i = 0; i < phase.iterations; i++) {
        apply(phase.strength);
        if (i % 10 === 0 && i > 0 && converged()) break;
      }
    }
  }

  let geometricOverlaps = 0;
  for (let i = 0; i < positioned.length; i++) {
    for (let j = i + 1; j < positioned.length; j++) {
      if (nodesOverlap(positioned[i], positioned[j], 0)) geometricOverlaps++;
    }
  }
  const m = FORCE_DIRECTED_PHYSICS.BOUNDS_MARGIN;
  const outOfBounds = positioned.filter(
    (p) =>
      p.x < m - 1e-9 ||
      p.y < m - 1e-9 ||
      p.x + p.w > CANVAS.width - m + 1e-9 ||
      p.y + p.h > CANVAS.height - m + 1e-9
  ).length;
  const nonFinite = positioned.filter(
    (p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)
  ).length;
  return { steps, geometricOverlaps, outOfBounds, nonFinite };
}

/** PositionedNode fields the harness reads (structural, not the full type). */
interface PositionedNodeLike {
  x: number;
  y: number;
  w: number;
  h: number;
}

describe('force-directed convergence predicate — layout OUTCOME parity', () => {
  describe.each([...SPARSE, ...DENSE])('$name', (t) => {
    it('earlier exit produces the SAME overlap outcome as the old predicate', () => {
      const canonical = runVariant(t, 'canonical');
      const old = runVariant(t, 'old');
      expect(canonical.geometricOverlaps).toBe(old.geometricOverlaps);
      expect(canonical.steps).toBeLessThanOrEqual(old.steps);
    });

    it('earlier exit does not skip bounds/overlap safety the full budget would catch', () => {
      const canonical = runVariant(t, 'canonical');
      const full = runVariant(t, 'full');
      expect(canonical.geometricOverlaps).toBeLessThanOrEqual(full.geometricOverlaps);
      expect(canonical.outOfBounds).toBe(0);
      expect(canonical.nonFinite).toBe(0);
    });
  });

  it('sparse topologies exit after one step per phase with the identical outcome', () => {
    for (const t of SPARSE) {
      const canonical = runVariant(t, 'canonical');
      const full = runVariant(t, 'full');
      expect({ name: t.name, steps: canonical.steps, overlaps: canonical.geometricOverlaps })
        .toEqual({ name: t.name, steps: FORCE_DIRECTED_PHASES.length, overlaps: full.geometricOverlaps });
    }
  });
});

describe('force-directed layout END-TO-END outcome (public API)', () => {
  it.each(SPARSE)('$name renders overlap-free, in-bounds, finite', async (t) => {
    const layout = await new NetworkLayoutStrategy().generateLayout(t.nodes, t.edges, CANVAS);
    const m = FORCE_DIRECTED_PHYSICS.BOUNDS_MARGIN;
    for (const node of layout.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(node.x).toBeGreaterThanOrEqual(m - 1e-9);
      expect(node.y).toBeGreaterThanOrEqual(m - 1e-9);
      expect(node.x + node.w).toBeLessThanOrEqual(CANVAS.width - m + 1e-9);
      expect(node.y + node.h).toBeLessThanOrEqual(CANVAS.height - m + 1e-9);
    }
    let overlaps = 0;
    for (let i = 0; i < layout.nodes.length; i++) {
      for (let j = i + 1; j < layout.nodes.length; j++) {
        if (nodesOverlap(layout.nodes[i], layout.nodes[j], 0)) overlaps++;
      }
    }
    expect(overlaps).toBe(0);
  });

  it('same input renders identical positions across fresh instances (seeded)', async () => {
    const t = SPARSE[1];
    const a = await new NetworkLayoutStrategy().generateLayout(t.nodes, t.edges, CANVAS);
    const b = await new NetworkLayoutStrategy().generateLayout(t.nodes, t.edges, CANVAS);
    expect(a.nodes.map((n) => [n.x, n.y])).toEqual(b.nodes.map((n) => [n.x, n.y]));
  });
});
