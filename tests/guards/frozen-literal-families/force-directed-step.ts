import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 40). Registry policy and
// the ordered aggregation live in tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 40 (specs/speech-to-visuals round-40 record): the force-directed
   * STEP BODY must delegate to applyForceDirectedStep in
   * src/visualization/force-directed-params.ts (the same module that owns the
   * phase schedule / physics coefficients / convergence predicate since round
   * 15). The body was inlined — verbatim — at the two live engines
   * (NetworkLayoutStrategy.applyForceStep, ezo applyEnhancedForceStep), so an
   * operator edit (sign flip, dropped velocity cap, inverted clamp) at one
   * engine silently never reached the other. A THIRD, drifted v1-era copy in
   * ezo (`applyForceDirectedStep`, 1000/dist² repulsion) with zero
   * production callers was retired the same round.
   *
   * The banned shapes are the three signature formula/accumulation LINES of
   * the canonical body. Legitimate neighbors that must NOT match:
   * ezo resolveOverlapsBatch accumulates `force1.x += moveVector.x` (a
   * different vector, different sign, resolver not simulator);
   * complex-layout-engine / edge-crossing-minimizer / timeline-strategy run
   * their OWN algorithms with damping 0.9/0.5 and no idealDistance/idealEdge
   * vocabulary (the round-15 exclusion, unchanged here); the v2
   * src/visualization/layout/ cluster (ProgressiveForce/SimulatedAnnealing)
   * uses the center-convention force model and is out of scope. The verbatim
   * oracle copies inside tests/ are outside the swept roots. Delegation pins
   * per site live in force-directed-step-single-source.test.ts.
   */
  {
    id: 'force-directed step: no re-inlined step body (repulsion/attraction formulas or accumulation) outside force-directed-params',
    roots: ['src'],
    exclude: {
      'src/visualization/force-directed-params.ts':
        'canonical source — applyForceDirectedStep beside the FORCE_DIRECTED_PHYSICS constants it consumes',
    },
    patterns: [
      /force1\.x -= fx/,
      /\(idealDistance - dist\) \/ dist/,
      /idealDistance \/ \(dist \* dist\)/,
    ],
    minSweptFiles: 300,
  },
];
