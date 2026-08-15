/**
 * Force-directed optimization parameters — SINGLE SOURCE (round 15).
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
 * The discovery sweep ("no src/visualization site re-freezes these literals")
 * lives in tests/guards/frozen-literal-rules.ts (rule id 'force-directed
 * params …'); this module is the only place the raw values appear.
 */

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
