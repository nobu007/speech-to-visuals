import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 15: the force-directed phase schedule and physics coefficients
   * live only in force-directed-params.ts. Before this round, THREE sites
   * froze them independently (NetworkLayoutStrategy, and two force steps in
   * enhanced-zero-overlap-layout), and the convergence predicate had ALREADY
   * drifted between the two multi-phase copies: NetworkLayoutStrategy
   * checked `i % 10 === 0 && i > 0` (skipping the i=0 check) while the
   * enhanced engine checked `i % 10 === 0` — two "identical" algorithms that
   * exit phases at different iterations. The canonical predicate (shared
   * runner `runForceDirectedPhases`) includes the i=0 check, so the drifted
   * `&& i > 0` shape is itself banned. Banned literal shapes are anchored on
   * the force-math variable names (`idealDistance`, `idealEdgeLength`,
   * `optimalSpacing`, phase `iterations:`/`strength:` pairs) so unrelated
   * 0.1/20/100 literals elsewhere in visualization cannot false-positive.
   * Excluded siblings are genuinely different algorithms that merely reuse
   * the values: SimulatedAnnealingStrategy / ProgressiveForceStrategy /
   * complex-layout-engine converge on their own `iteration % 10` cadence and
   * share no coefficient with the force-directed family (their damping is
   * 0.9/0.5, not 0.1).
   */
  {
    id: 'force-directed params (phases 20/2.0, 30/1.0, 25/0.5 + physics constants) single-sourced in force-directed-params',
    roots: ['src/visualization'],
    exclude: {
      'src/visualization/force-directed-params.ts': 'the canonical source itself',
    },
    patterns: [
      // Phase schedule: any local re-freeze of the multi-phase array members.
      /\{\s*iterations:\s*20,\s*strength:\s*2\.0\b/,
      /\{\s*iterations:\s*30,\s*strength:\s*1\.0\b/,
      /\{\s*iterations:\s*25,\s*strength:\s*0\.5\b/,
      // Physics tail shared by all three step functions.
      /\bdamping\s*=\s*0\.1\b/,
      /\bmargin\s*=\s*20\b/,
      /optimalSpacing\s*\/\s*4\b/,
      // Multi-phase force math (NetworkLayoutStrategy + enhanced copies).
      /optimalSpacing\s*\*\s*2\b/,
      /idealDistance\s*\*\s*2\b/,
      /dist\)\s*\/\s*dist\s*\*\s*100\b/,
      /\(dist\s*\*\s*dist\)\s*\*\s*50\b/,
      /\(dist\s*-\s*idealEdgeLength\)\s*\*\s*0\.1\b/,
      // The drifted convergence predicate — the canonical runner checks i=0.
      /i\s*%\s*10\s*===\s*0\s*&&\s*i\s*>\s*0\b/,
    ],
    minSweptFiles: 20,
  },
];
