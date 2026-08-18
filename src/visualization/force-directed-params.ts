/**
 * Force-directed optimization parameters — SINGLE SOURCE (round 15; the step
 * body joined in round 40).
 *
 * Before this module, the multi-phase force-directed constants were frozen
 * independently at three sites, and the convergence predicate had ALREADY
 * drifted between the two multi-phase copies:
 *
 *   - src/visualization/strategies/NetworkLayoutStrategy.ts
 *       phases array + repulsion 100/50 + idealEdgeLength ×2 + attraction 0.1
 *       + damping 0.1 + maxVelocity /4 + margin 20
 *       convergence: `i % 10 === 0 && i > 0`   ← drifted: skips the i=0 check
 *   - src/visualization/enhanced-zero-overlap-layout.ts (×2 force steps)
 *       same phases array + same physics tail; the multi-phase copy used
 *       convergence: `i % 10 === 0`            ← canonical (checks i=0 too)
 *
 * Canonical predicate: the overlap check runs every interval INCLUDING the
 * first iteration of each phase. A phase that starts overlap-free (typical
 * for the fine-adjustment phase after earlier phases converged) exits after
 * one step instead of burning the full iteration budget.
 *
 * Round 40 extended the single source from the PARAMETERS to the step body
 * itself (`applyForceDirectedStep` below): the two live engines had kept
 * verbatim copies of the arithmetic that consumes these constants, so the
 * constants could no longer drift but the operators still could.
 *
 * The discovery sweeps ("no src/visualization site re-freezes these literals"
 * / "no site re-inlines the step formulas") live in tests/guards/
 * frozen-literal-rules.ts (rule ids 'force-directed params …' and
 * 'force-directed step …'); this module is the only place the raw values and
 * formulas appear.
 */

import type { PositionedNode, EdgeDatum } from '@stv/core/types/diagram';
import { getNodeWidth, getNodeHeight, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from './node-dimensions';
import { distance, clampNodeCoordinate, calculateNodeCenter } from './layout-utils';

/** One optimization phase of the multi-phase force-directed loop. */
export interface ForceDirectedPhase {
  readonly iterations: number;
  readonly strength: number;
  readonly description: string;
}

/** Multi-phase schedule shared by every force-directed layout engine. */
export const FORCE_DIRECTED_PHASES: readonly ForceDirectedPhase[] = [
  { iterations: 20, strength: 2.0, description: 'Initial separation' },
  { iterations: 30, strength: 1.0, description: 'Structure formation' },
  { iterations: 25, strength: 0.5, description: 'Fine adjustment' },
];

/** Physics coefficients applied inside a single force-directed step. */
export const FORCE_DIRECTED_PHYSICS = {
  /** Linear damping on accumulated force when updating node positions. */
  DAMPING: 0.1,
  /** Strong repulsion scale when dist < idealDistance. */
  STRONG_REPULSION_FACTOR: 100,
  /** Moderate repulsion scale in (idealDistance, idealDistance × range). */
  MODERATE_REPULSION_FACTOR: 50,
  /** Repulsion cut-off: dist < idealDistance × this. */
  REPULSION_RANGE_MULTIPLIER: 2,
  /** Attraction coefficient toward the ideal edge length. */
  ATTRACTION_FACTOR: 0.1,
  /** idealEdgeLength = optimalSpacing × this. */
  IDEAL_EDGE_LENGTH_MULTIPLIER: 2,
  /** maxVelocity = optimalSpacing ÷ this (per-step displacement cap). */
  MAX_VELOCITY_DIVISOR: 4,
  /** Canvas-bounds inset kept clear of every node after each step. */
  BOUNDS_MARGIN: 20,
} as const;

/** Overlap convergence is re-checked every N iterations (N-th included). */
export const CONVERGENCE_CHECK_INTERVAL = 10;

/**
 * Run the shared multi-phase optimization loop.
 *
 * `applyStep(strength)` applies one force step at the phase's strength;
 * `isConverged()` reports whether the layout is already overlap-free.
 * Both engines delegate here so the phase schedule AND the convergence
 * predicate can never drift apart again.
 */
export function runForceDirectedPhases(
  applyStep: (strength: number) => void,
  isConverged: () => boolean
): void {
  for (const phase of FORCE_DIRECTED_PHASES) {
    for (let i = 0; i < phase.iterations; i++) {
      applyStep(phase.strength);

      if (i % CONVERGENCE_CHECK_INTERVAL === 0 && isConverged()) {
        break;
      }
    }
  }
}

/**
 * Canvas rectangle the force step clamps nodes into, `{ width, height }`.
 * Callers supply their own: LayoutConfig.width/height at the strategy,
 * ZeroOverlapConfig.canvasWidth/Height at the ezo engine.
 */
export interface ForceDirectedBounds {
  readonly width: number;
  readonly height: number;
}

/**
 * Apply ONE force-directed step — the body that consumes FORCE_DIRECTED_*
 * above: init force map → pairwise repulsion (strong + moderate regimes) →
 * edge attraction toward idealEdgeLength → damped, velocity-capped position
 * update → canvas-bounds clamp.
 *
 * Round 40: this body was previously inlined — verbatim — at the two live
 * force-directed engines (NetworkLayoutStrategy.applyForceStep and the ezo
 * engine's applyEnhancedForceStep). Round 15 had already unified the phase
 * schedule, physics coefficients and convergence predicate, but the
 * arithmetic that CONSUMES them stayed two hand-maintained copies, so a sign
 * flip, a dropped velocity cap, or an inverted bounds clamp edited into one
 * engine would silently not reach the other. The only difference between the
 * two copies was where the canvas numbers come from — expressed here as the
 * `bounds` parameter. This is a deduplication, NOT a behavior change: the
 * body is the pre-round-40 text with the two canvas expressions replaced by
 * `bounds.width`/`bounds.height`, verified bitwise-identical by the round-40
 * guard (tests/guards/force-directed-step-single-source.test.ts).
 *
 * A third, DRIFTED copy of the same skeleton (v1-era `1000 / dist²`
 * repulsion, `forceStrength * dist * 0.1` attraction) lived in the ezo engine
 * with ZERO production callers; it was retired in the same round rather than
 * left as a plausible-looking sibling someone could resurrect.
 *
 * @param nodes          positioned nodes — mutated IN PLACE (the engines run
 *                       this per phase iteration on their live array).
 * @param edges          diagram edges; dangling endpoints are skipped.
 * @param strength       phase strength from FORCE_DIRECTED_PHASES.
 * @param optimalSpacing engine-computed spacing for this layout.
 * @param bounds         canvas size for the BOUNDS_MARGIN clamp.
 */
export function applyForceDirectedStep(
  nodes: PositionedNode[],
  edges: EdgeDatum[],
  strength: number,
  optimalSpacing: number,
  bounds: ForceDirectedBounds
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

      // Round 47 single source — node box-centers via layout-utils
      // `calculateNodeCenter` (DEFAULT fallbacks passed explicitly, identical
      // to the retired bare `getNodeWidth(node2) / 2` forms).
      const c1 = calculateNodeCenter(node1, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT);
      const c2 = calculateNodeCenter(node2, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT);
      const dx = c2.x - c1.x;
      const dy = c2.y - c1.y;
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
      // Round 47 single source — node box-centers via layout-utils
      // `calculateNodeCenter` (DEFAULT fallbacks passed explicitly).
      const s = calculateNodeCenter(source, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT);
      const t = calculateNodeCenter(target, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT);
      const dx = t.x - s.x;
      const dy = t.y - s.y;
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
    node.x = clampNodeCoordinate(node.x, bounds.width, getNodeWidth(node), margin);
    node.y = clampNodeCoordinate(node.y, bounds.height, getNodeHeight(node), margin);
  });
}
