import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 29 (empty layout result single-source): the zero-nodes early
   * return of every layout path — `{nodes: [], edges: [], canvas: {width:
   * DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT}, metrics:
   * {overlapCount: 0, edgeCrossings: 0, aspectRatio: TARGET_ASPECT_RATIO}}`
   * — was hand-rolled at 12 sites (all 11 registered strategies' apply() +
   * LayoutEngineV2.layout), with two more sites re-freezing the metrics
   * triple alone (mindmap/conceptmap single-node early returns). The family
   * had ALREADY drifted: cycle-strategy re-derived `aspectRatio:
   * DEFAULT_CANVAS_WIDTH / DEFAULT_CANVAS_HEIGHT` instead of reading
   * TARGET_ASPECT_RATIO — numerically equal only while the derivation stays
   * coupled, the consumer-shape escape the round 25 freeze learned to ban.
   * A drifted site reports different empty-input geometry (canvas/aspect)
   * per diagram type, and empty results feed the caller's video-length math.
   * Canonical: emptyLayoutResult / emptyStrategyLayoutMetrics in
   * src/visualization/empty-layout-result.ts. Behavioral pins (all
   * strategies + engine + the emergent grid-snap fallback identity) live in
   * tests/guards/empty-layout-result-single-source.test.ts.
   *
   * NOT banned (legitimate other shapes, verified round 29): the zero-fills
   * of OTHER metric types — OverlapResolver's LayoutMetrics
   * (totalArea/nodeSpacing/layoutBalance, no aspectRatio member) and
   * enhanced-zero-overlap-layout's LayoutQualityMetrics (9 fields, separated
   * by overlapArea so the adjacency never matches) — plus its qualityTargets
   * block (edgeCrossings: -1 is a TARGET, not a measurement, and breaks the
   * adjacency); calculateCanvasSize([])'s canvas-only default (no metrics);
   * calculateMetrics's measured `canvas.width / canvas.height` (a real
   * measurement over the actual canvas, not a frozen empty triple); and
   * test files (the walk skips __tests__ and *.test.*).
   */
  {
    id: 'empty layout result single-sourced in empty-layout-result (round 29)',
    roots: ['src'],
    exclude: {
      'src/visualization/empty-layout-result.ts': 'the canonical source itself',
    },
    patterns: [
      // The frozen zero-metrics triple (+aspectRatio member adjacency),
      // re-rolled at any site instead of delegating.
      /overlapCount:\s*0,\s*edgeCrossings:\s*0,\s*aspectRatio:/,
      // The round-29 drift shape: re-deriving the aspect ratio from the
      // canvas constants at a member site instead of reading TARGET_ASPECT_RATIO.
      /aspectRatio:\s*DEFAULT_CANVAS_WIDTH\s*\/\s*DEFAULT_CANVAS_HEIGHT/,
    ],
    minSweptFiles: 200,
  },
];
