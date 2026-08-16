import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 34 (strategy edge repointing): the post-positioning epilogue —
   * re-point ALREADY-BUILT LayoutEdges (source/target refs) at the settled
   * node positions via a spread that preserves every field, blanking the
   * points of a dangling edge — lives only in
   * src/visualization/edge-repointing.ts (repointEdgesStraightLine). The
   * three physics-first strategies (GridSnap/ProgressiveForce/
   * SimulatedAnnealing.updateEdgePoints) delegate; the private methods and
   * their signatures (including the already-dead `config` parameter) are
   * retained verbatim.
   *
   * This is the round-32/33-documented spread family, extracted under its
   * own entry because it is a DIFFERENT contract from the EdgeDatum-based
   * builders: input and output are LayoutEdge[], the spread preserves
   * optional fields (type/id/from/to), a dangling edge is kept blank with
   * no warn and no drop, and anchors are RAW node x/y (no center offset).
   *
   * The sweep bans the ONE line-shape every behavior-preserving re-roll
   * must emit somewhere — the `...edge` spread (single-line fallback,
   * single-line anchored emit, or multi-line block spread; any member
   * order). Scoped to src/visualization/layout/strategies where the corpus
   * is clean: post-migration the only `...edge` in src/visualization
   * belongs to enhanced-zero-overlap-layout.ts, whose timeline path is a
   * genuinely different variant (edge.from/to lookup, warn, and a
   * points-length filter that DROPS blank edges) — it lives outside these
   * roots on purpose. The sibling `new Map(nodes.map(...))` /
   * `nodeMap.get(edge.source)` lines are NOT banned: the same three files
   * legitimately carry them in their PHYSICS methods
   * (calculateEdgeEnergy / calculateCrossingEnergy / applyLinkForces), a
   * different concept sharing the lookup idiom.
   *
   * Residual, documented escape: a re-roll that drops the spread and
   * reconstructs a literal edge object emits no banned line — but that
   * changes observable behavior (optional fields like `type` are lost),
   * which the verbatim-oracle and delegation-equality layers in
   * tests/guards/edge-repointing-single-source.test.ts catch.
   */
  {
    id: 'strategy edge repointing single-sourced in edge-repointing (round 34)',
    roots: ['src/visualization/layout/strategies'],
    patterns: [
      // the spread that preserves every input-edge field — the family's
      // defining tell, clean in the strategies corpus post-migration.
      /\.\.\.edge/,
    ],
    minSweptFiles: 4,
  },
];
