/**
 * Structural guard: force-directed optimization parameters have ONE source.
 *
 * Before this guard, the multi-phase force-directed schedule and physics
 * coefficients were frozen independently at three sites:
 *
 *   - src/visualization/strategies/NetworkLayoutStrategy.ts
 *       (phases array + repulsion 100/50 + idealEdgeLength ×2 + attraction
 *        0.1 + damping 0.1 + maxVelocity /4 + margin 20)
 *   - src/visualization/enhanced-zero-overlap-layout.ts ×2 force steps
 *       (same phases array in the multi-phase copy; damping/maxVelocity/
 *        margin tail in both)
 *
 * The convergence predicate had ALREADY drifted between the two multi-phase
 * copies: NetworkLayoutStrategy used `i % 10 === 0 && i > 0` (skipping the
 * i=0 check) while the enhanced engine used `i % 10 === 0`. Round 15 closed
 * both: constants live in force-directed-params.ts, and both loops delegate
 * to the shared `runForceDirectedPhases` with the canonical predicate
 * (i=0 check included — a phase that starts overlap-free exits after one
 * step instead of burning its full iteration budget).
 *
 * The "no src/visualization site re-freezes the literals" discovery sweep
 * lives in the shared registry (tests/guards/frozen-literal-registry.test.ts,
 * rule 'force-directed params …'). This file pins VALUES, CONSUMER WIRING,
 * and the CANONICAL CONVERGENCE PREDICATE.
 */

import { describe, it, expect } from '@jest/globals';
import { readSource } from './freeze-guard';
import {
  FORCE_DIRECTED_PHASES,
  FORCE_DIRECTED_PHYSICS,
  CONVERGENCE_CHECK_INTERVAL,
  runForceDirectedPhases,
} from '@/visualization/force-directed-params';

const CONSUMERS = [
  'src/visualization/strategies/NetworkLayoutStrategy.ts',
  'src/visualization/enhanced-zero-overlap-layout.ts',
];

describe('force-directed params single source (guard)', () => {
  it('canonical module exports the agreed schedule and physics values', () => {
    expect(FORCE_DIRECTED_PHASES).toEqual([
      { iterations: 20, strength: 2.0, description: 'Initial separation' },
      { iterations: 30, strength: 1.0, description: 'Structure formation' },
      { iterations: 25, strength: 0.5, description: 'Fine adjustment' },
    ]);
    expect(FORCE_DIRECTED_PHYSICS).toEqual({
      DAMPING: 0.1,
      STRONG_REPULSION_FACTOR: 100,
      MODERATE_REPULSION_FACTOR: 50,
      REPULSION_RANGE_MULTIPLIER: 2,
      ATTRACTION_FACTOR: 0.1,
      IDEAL_EDGE_LENGTH_MULTIPLIER: 2,
      MAX_VELOCITY_DIVISOR: 4,
      BOUNDS_MARGIN: 20,
    });
    expect(CONVERGENCE_CHECK_INTERVAL).toBe(10);
  });

  it('every known consumer imports the canonical module', () => {
    for (const rel of CONSUMERS) {
      const src = readSource(rel);
      expect({
        file: rel,
        importsCanonical: src.includes('force-directed-params'),
      }).toEqual({ file: rel, importsCanonical: true });
    }
  });

  it('consumer sites are wired to the canonical constants and shared runner', () => {
    for (const rel of CONSUMERS) {
      const src = readSource(rel);
      expect({
        file: rel,
        wiredPhysics: /FORCE_DIRECTED_PHYSICS/.test(src),
        wiredRunner: /runForceDirectedPhases\(/.test(src),
      }).toEqual({ file: rel, wiredPhysics: true, wiredRunner: true });
    }
  });

  it('canonical convergence predicate includes the first iteration of each phase', () => {
    // A layout that is overlap-free from the very first check must exit each
    // phase after ONE step (strength recorded once per phase). This is the
    // behavioral half of the drift fix: the old NetworkLayoutStrategy
    // predicate (`i % 10 === 0 && i > 0`) would have taken 11 steps in
    // phase 1 before its first check.
    const strengths: number[] = [];
    let checks = 0;
    runForceDirectedPhases(
      (strength) => strengths.push(strength),
      () => (checks++, true)
    );
    expect(strengths).toEqual([2.0, 1.0, 0.5]); // one step per phase
    expect(checks).toBe(3); // checked at i=0 of each phase
  });

  it('canonical predicate still runs to the iteration budget when never converged', () => {
    let steps = 0;
    runForceDirectedPhases(
      () => steps++,
      () => false
    );
    // Full budget: 20 + 30 + 25, with a convergence check every 10th
    // iteration (including i=0). Total checks = ceil(20/10) + (30/10 + 1
    // remainder) + ceil(25/10)… assert only the step budget — the check
    // cadence is pinned by the i=0 test above.
    expect(steps).toBe(20 + 30 + 25);
  });
});
