import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 10 (08ba narrowed to its clean half): the label-driven node-width
   * constants charWidth 8 / padding 20 live only in layout-utils.ts. Before
   * this round, six strategies (Tree/Flowchart/Network/Timeline/ConceptMap/
   * Comparison) hand-rolled the IDENTICAL formula `label*8+20 clamped to
   * [base, base*2]` next to the shared calculateNodeWidth util, and
   * BaseLayoutEngine + DagreLayoutStrategy froze their own
   * DEFAULT_CHAR_WIDTH/DEFAULT_PADDING locals. NOT swept (different
   * concepts): the util's omitted-field padding default `?? 16` (pinned by
   * layout-bug-fixes.test.ts — callers that omit padding get tighter
   * packing by design), smart-label-sizer's `charWidthFactor: 8`
   * (font-scaled sizer, not the fixed px estimate), and advanced-layouts'
   * `text.length * 8 + 40` (different formula and padding, different
   * concept — the patterns below do not match it).
   */
  {
    id: 'label-width constants (charWidth 8 / padding 20) single-sourced in layout-utils',
    roots: ['src/visualization'],
    exclude: {
      'src/visualization/layout-utils.ts': 'the canonical source itself',
    },
    patterns: [
      /const\s+(DEFAULT_)?CHAR_WIDTH\s*=\s*8\b/,
      /const\s+charWidth\s*=\s*8\b/,
      /charWidth\s*\?\?\s*8\b/,
      /const\s+(DEFAULT_)?PADDING\s*=\s*20\b/,
      /const\s+padding\s*=\s*20\b/,
    ],
    minSweptFiles: 20,
  },
];
