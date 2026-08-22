import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 43). Registry policy and
// the ordered aggregation live in tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 43 (specs/speech-to-visuals round-43 record): the EDGE-CROSSING
   * PAIR SCAN (segment build + i<j pair loop + shared-endpoint skip +
   * intersection predicate) must delegate to ONE canonical per policy:
   * strict ccw → src/visualization/layout/edge-crossings.ts
   * (segmentsIntersect + countEdgeCrossings, delegated to by OverlapResolver
   * and SimulatedAnnealingStrategy's crossing energy), orientation+
   * collinear → the pre-existing export in src/visualization/
   * edge-crossing-minimizer.ts (detectEdgeCrossings, now also used by
   * LayoutEvaluator). The resolver/analyzer pair carried the strict scan as
   * a byte-identical copy-paste pair, and LayoutEvaluator re-implemented the
   * whole orientation quartet privately — four copies of "what is a
   * crossing" across two predicate policies, each feeding a different
   * consumer, the invariant-split class on the crossing metric.
   *
   * Banned shapes are the retired inline tells: the strict predicate's
   * `ccw(A, C, D)` call and the endpoint-object skip line (v2 pair), the
   * orientation formula and its 1e-4 tolerance line (v1 trio), and the
   * retired v1 accumulator name. Legitimate near-misses do NOT match:
   * LayoutStrategy.doLinesIntersect is a deliberately LOOSER approximation
   * (boolean ccw `!==`, no shared-endpoint skip) kept by design;
   * `nodeMap.get(edge.source)` alone is not banned because three
   * edge-energy/repointing sites use it for non-crossing segment builds;
   * ezo's calculateEdgeCrossings count stub (`floor(len*0.1)`) was retired
   * by REQ-391 — ezo now delegates to the strict canonical like the rest.
   * Delegation pins per site live in
   * edge-crossing-scan-single-source.test.ts.
   */
  {
    id: 'edge-crossing scan: no re-inlined crossing scan/predicate outside the two canonicals',
    roots: ['src'],
    exclude: {
      'src/visualization/layout/edge-crossings.ts':
        'canonical source (strict policy) — segmentsIntersect + countEdgeCrossings beside the endpoint-object skip',
      'src/visualization/edge-crossing-minimizer.ts':
        'canonical source (orientation+collinear policy) — detectEdgeCrossings with the orientation/onSegment trio',
    },
    patterns: [
      /ccw\(A, C, D\)/,
      /a\.source === b\.source \|\| a\.source === b\.target/,
      /\(q\.y - p\.y\) \* \(r\.x - q\.x\)/,
      /Math\.abs\(val\) < 0\.0001/,
      /let crossingCount = 0/,
    ],
    minSweptFiles: 300,
  },
];
