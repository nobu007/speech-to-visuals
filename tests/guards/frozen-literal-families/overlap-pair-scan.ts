import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 39). Registry policy and
// the ordered aggregation live in tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 39 (specs/speech-to-visuals round-39 record): the pairwise
   * overlap scan (`for i / for j = i+1 / nodesOverlap(nodes[i], nodes[j]) /
   * accumulate`) must delegate to detectOverlapPairs / countOverlapPairs /
   * hasOverlapPairs in src/visualization/layout-utils.ts. The loop was
   * inlined at 9 sites across the producer/judge/monitor continents
   * (quality-estimators, layout-engine-v2, NetworkLayoutStrategy,
   * cycle-strategy, timeline-strategy, quality-monitor, LayoutEvaluator,
   * BaseLayoutEngine, enhanced-zero-overlap-layout brute branch), so a scan
   * edited at one site silently disagreed with the others — the
   * invariant-split class, on the core zero-overlap guarantee.
   *
   * The banned shape is the canonical `nodes[i]/nodes[j]` scan idiom (every
   * migrated site used it). Legitimate per-pair USES of the predicate inside
   * resolution/mutation loops (timeline-strategy `result[i]/result[j]`,
   * cycle-strategy force fallback, ezo spatial-grid probe) do not match and
   * stay inline by design; the v2 `src/visualization/layout/` cluster uses a
   * different CENTER-convention predicate (`areNodesOverlapping`,
   * `this.nodesOverlap`) and is out of this family's scope. Delegation pins
   * per site live in overlap-pair-scan-single-source.test.ts.
   */
  {
    id: 'overlap-pair scan: no re-inlined nodes[i]/nodes[j] pairwise scan outside layout-utils',
    roots: ['src'],
    exclude: {
      'src/visualization/layout-utils.ts':
        'canonical source — detectOverlapPairs/countOverlapPairs/hasOverlapPairs next to the nodesOverlap predicate',
    },
    patterns: [
      /nodesOverlap\(nodes\[i\], nodes\[j\]/,
    ],
    minSweptFiles: 300,
  },
];
