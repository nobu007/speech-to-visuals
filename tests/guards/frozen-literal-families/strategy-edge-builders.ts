import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 32 (v2 strategy edge builders): the edge-construction skeleton —
   * nodeMap over positioned nodes, dangling-endpoint fallback, LayoutEdge
   * assembly — lives only in src/visualization/strategy-edges.ts
   * (buildAnchoredLayoutEdges + centerToCenterAnchors). The eight
   * non-dagre registered strategies (matrix/general/cycle/conceptmap/
   * network/mindmap/timeline/comparison) delegate; timeline and comparison
   * keep only their anchor GEOMETRY as local anchor functions. The sweep
   * engine is LINE-based, so the patterns pin the three single-line shapes
   * every re-roll of the skeleton must emit somewhere: the fallback points
   * line, its `as`-cast single-line variant, and the PHANTOM-anchor variant
   * (no fallback branch — the mindmap drift this round killed).
   *
   * Excluded with reasons: the separate layout/ engine family
   * (LayoutStrategy.ts normalizes edges with source/target mirrors then
   * blanks points; OverlapResolver.ts blanks the spread copy — both inside
   * the round-11-precedent separate system); the flow/tree grid-snap
   * fallbacks (phantom-anchor lines over TC-307 pre-filtered safeEdges, so
   * the `?? 0` is dead there — round 30 left the fallback algorithm
   * per-strategy); GridSnapFallbackStrategy (strategy-selector.ts —
   * deliberately emits NO geometry for ANY edge). The single-line spread
   * fallbacks (`{ ...edge, points: [] }` in
   * GridSnap/ProgressiveForce/SimulatedAnnealing/enhanced-zero-overlap)
   * match NO pattern: the anchored points-line cannot see them and no
   * label echo shares their line.
   *
   * Round 33 note: the v1 CamelCase family (Tree/Timeline/Network/
   * ConceptMap/Comparison strategies + BaseLayoutEngine) migrated onto
   * buildWarnedAnchoredEdges and is REMOVED from this entry's exclusions —
   * the shared `points: [],` fallback line is gone from those files, so
   * this sweep now bans a v1 re-roll of the multi-line fallback too (its
   * warn literal and find-lookup tells are banned by the round-33 entry).
   */
  {
    id: 'v2 strategy edge builder single-sourced in strategy-edges (round 32)',
    roots: ['src/visualization'],
    exclude: {
      'src/visualization/strategy-edges.ts': 'the canonical source itself',
      'src/visualization/layout/strategies/LayoutStrategy.ts':
        'separate layout/ engine family (round-11 precedent): normalizes edges with source/target mirrors, then blanks points — different contract',
      'src/visualization/layout/OverlapResolver.ts':
        'separate layout/ engine family: blanks the spread copy of a TC-style pre-filtered edge — different contract',
      'src/visualization/strategy-selector.ts':
        'GridSnapFallbackStrategy deliberately emits NO geometry for any edge (as-cast points line is its whole contract)',
      'src/visualization/strategies/flow-strategy.ts':
        'grid-snap fallback anchor lines over TC-307-pre-filtered safeEdges — ?? 0 dead there (round 30 kept the fallback per-strategy)',
      'src/visualization/strategies/tree-strategy.ts':
        'grid-snap fallback anchor lines over TC-307-pre-filtered safeEdges — ?? 0 dead there (round 30 kept the fallback per-strategy)',
    },
    patterns: [
      // the dangling-fallback points line on its own (multi-line block).
      /^\s*points:\s*\[\],?\s*$/,
      // single-line re-roll, any member order and any loop-var name: the
      // empty-points emit and the label echo sharing ONE line.
      (line) => /points:\s*\[\]/.test(line) && /label:\s*\w+\.label\b/.test(line),
      // the as-cast variant of the fallback points on its own line.
      /^\s*points:\s*\[\]\s*as\b/,
      // the PHANTOM-anchor variant: no fallback branch, missing endpoint
      // anchored near the origin instead (name-agnostic — any `X?.x ?? 0)`).
      /\?\.\s*x\s*\?\?\s*0\s*\)\s*\+\s*\(/,
    ],
    minSweptFiles: 20,
  },

  /**
   * Round 33 (v1 engine edge builders): the warn-on-dangling anchored-edge
   * skeleton — endpoint lookup over positioned nodes, `[Strategy] Edge f ->
   * t missing nodes` diagnostic, points:[] fallback, LayoutEdge assembly
   * WITHOUT id — lives only in src/visualization/strategy-edges.ts
   * (buildWarnedAnchoredEdges). The six legacy engine sites
   * (BaseLayoutEngine.generateAllEdges + Comparison/ConceptMap/Network/
   * Timeline/TreeLayoutStrategy.generate*Edges) delegate; timeline/tree/
   * comparison keep only their anchor GEOMETRY as local closures.
   *
   * The sweep bans the ONE shape every re-roll of this family must emit and
   * nothing else in the module legitimately carries: the warn literal
   * `missing nodes` (post-migration corpus: only the canonical file). The
   * other v1 tells were checked and left to their owners —
   *   - `from: edge.from` / `label: edge.label` own-line echoes appear in 8
   *     legitimate files (dagre extraction, FallbackLayoutStrategy grid
   *     edges, complex-layout-engine, v2 grid-snap fallbacks);
   *   - the `.find(n => n.id === edge.from)` endpoint lookup appears in 5
   *     (enhanced-zero-overlap's flatMap extraction, LayoutOptimizer,
   *     complex-layout-engine, FallbackLayoutStrategy, and
   *     NetworkLayoutStrategy's own force-directed PHYSICS — a different
   *     concept in the same file).
   * Banning them module-wide would cost 8+ exclusions and re-cover what the
   * round-32 entry (whose v1 exclusions this round removed) already bans.
   *
   * Residual, documented escape: a re-roll that DROPS the warn and writes
   * the fallback as a single-line spread (`{ ...edge, points: [] }`) emits
   * none of the banned lines — that is the round-32-documented spread
   * contract of a different family, and it changes observable behavior
   * (extra fields preserved), which the delegation-equality layer in
   * tests/guards/v1-engine-edge-builder-single-source.test.ts catches.
   */
  {
    id: 'v1 engine edge builder single-sourced in strategy-edges (round 33)',
    roots: ['src/visualization'],
    exclude: {
      'src/visualization/strategy-edges.ts': 'the canonical source itself',
    },
    patterns: [
      // the dangling-edge warn diagnostic — the only v1 tell that is clean
      // module-wide (verified by corpus grep at round 33).
      /missing nodes/,
    ],
    minSweptFiles: 20,
  },
];
