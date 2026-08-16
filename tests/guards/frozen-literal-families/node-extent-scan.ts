import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 41). Registry policy and
// the ordered aggregation live in tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 41 (specs/speech-to-visuals round-41 record): the node EXTENT SCAN
   * — min over left edges, max over right/bottom edges of positioned nodes —
   * must delegate to foldNodeExtents / nodeExtentEdges in
   * src/visualization/layout-utils.ts. The scan was inlined at 11 sites in
   * two idioms (spread form: BaseLayoutEngine bounds, ezo
   * calculateCanvasUtilization, complex-layout-engine bounds ×2,
   * CulturalLayoutAdapter bounds, layout-worker result size; seeded-accumulator
   * loop: canvas-calculator calculate/center, layout-engine-v2
   * calculateCanvasSize, strategy-selector calculateBoundingBox, ezo
   * fitNodesToCanvas), so one engine's box could silently disagree with
   * another's — the invariant-split class, on the box every canvas-fit /
   * centering / utilization decision reads.
   *
   * Banned shapes are the two retired idiom tells (the spread min/max over a
   * mapped node coordinate, and the ±Infinity seed line every accumulator
   * loop needs, plus the comparison-loop tell). Legitimate non-extent spreads
   * don't match: a bare array spread has no `.map(` (quality-monitor's
   * `Math.min(...xPositions)`), and a dimension-only map has no `.x`
   * (cycle-strategy's `Math.max(...nodes.map((n) => getNodeWidth(...)))`).
   * The v2 `src/visualization/layout/` cluster computes extents in the CENTER
   * convention (`node.x ± width/2`) from a coordinate system src/ never
   * imports (r39 established the cluster is test-only); both of its files
   * are excluded with that reason. Delegation pins per site live in
   * node-extent-scan-single-source.test.ts.
   */
  {
    id: 'node-extent scan: no re-inlined min/max extent scan outside layout-utils',
    roots: ['src'],
    exclude: {
      'src/visualization/layout-utils.ts':
        'canonical source — foldNodeExtents/nodeExtentEdges beside the overlap-pair scan',
      'src/visualization/layout/OverlapResolver.ts':
        'v2 layout/ cluster: CENTER-convention extents (node.x ± width/2), test-only cluster, out of the top-left-convention family (r39 precedent)',
      'src/visualization/layout/strategies/LayoutStrategy.ts':
        'v2 layout/ cluster: CENTER-convention extents (node.x ± halfWidth), test-only cluster, out of the top-left-convention family (r39 precedent)',
    },
    patterns: [
      /Math\.min\(\.\.\..*\.map\(.*\.x\b/,
      /Math\.max\(\.\.\..*\.map\(.*\.x \+/,
      /let minX = Infinity/,
      /if \(left < minX\)/,
    ],
    minSweptFiles: 300,
  },
];
