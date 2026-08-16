import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 16: layout jitter must come from the seeded PRNG in layout-rng.ts,
   * never bare `Math.random()`. Unseeded jitter made the SAME diagram render
   * at different node positions on every run — caught by the layout-outcome
   * oracle (tests/visualization/force-directed-layout-outcome-oracle.test.ts,
   * determinism case) after round 15's convergence change prompted an
   * outcome-level (not iteration-count) check. Fixed sites: the zero-overlap
   * engine's network grid jitter + aesthetic candidate perturbation, and
   * NetworkLayoutStrategy's grid jitter.
   *
   * Round 17 closed the deferred stochastic family: simulated annealing (all
   * six draw sites share one stream), progressive force (fallback + zero-
   * distance + escape jitter), both overlap resolvers, the mindmap
   * unassigned-node jitter, and the complex engine's worker-message id — each
   * with its own RED-verified determinism oracle (round-17 commit series;
   * see specs/stochastic-layout-seeding/architecture.md). No exclusions
   * remain except the canonical PRNG source itself.
   */
  {
    id: 'layout jitter drawn from seeded PRNG (layout-rng), not Math.random',
    roots: ['src/visualization'],
    exclude: {
      'src/visualization/layout-rng.ts': 'the canonical PRNG source itself',
    },
    patterns: [/Math\.random\s*\(/],
    minSweptFiles: 40,
  },
];
