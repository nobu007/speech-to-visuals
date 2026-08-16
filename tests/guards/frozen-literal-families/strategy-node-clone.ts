import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 35 (strategy node clone): the shallow-copy node-array helper of
   * the physics-first strategies — the generic `cloneNodes<T extends
   * PositionedNode>` that keeps grid-snap placement and annealing
   * best-solution snapshots from mutating caller-owned nodes — lives only
   * as a protected member of BaseLayoutStrategy (LayoutStrategy.ts, next to
   * the other shared protected helpers). Was a byte-identical private twin
   * in GridSnapStrategy and SimulatedAnnealingStrategy; call sites
   * `this.cloneNodes(...)` are unchanged (zero-delta move).
   *
   * The sweep bans the generic DECLARATION shape (`cloneNodes<X extends`)
   * — the only line a re-freeze must emit that is clean corpus-wide
   * (post-migration grep: one declaration, three call sites, call sites
   * never carry a `<`). Any modifier (private/protected/public) and any
   * type-parameter name match.
   *
   * Residual, documented escape: a FULL RENAME re-roll (e.g.
   * `duplicateNodes<T extends PositionedNode>` with the same body) emits no
   * banned line — the body's `nodes.map(node => ({ ...node } as T))` is the
   * generic shallow-copy idiom dozens of legitimate sites share, so it
   * cannot be banned. The own-property layer in
   * tests/guards/strategy-node-clone-single-source.test.ts catches a twin
   * that keeps the name; a renamed twin is behavior-identical by
   * construction and only re-opens the DUPLICATION (not a drift), which the
   * next corpus grep for the idiom finds.
   */
  {
    id: 'strategy node clone single-sourced on BaseLayoutStrategy (round 35)',
    roots: ['src'],
    exclude: {
      'src/visualization/layout/strategies/LayoutStrategy.ts': 'the canonical source itself',
    },
    patterns: [
      // the generic method declaration — call sites never carry a `<`.
      /\bcloneNodes\s*<\w+\s+extends\b/,
    ],
    minSweptFiles: 200,
  },
];
