import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 5: TARGET_ASPECT_RATIO derived from default canvas dims — no
   * visualization module may declare or inline `16 / 9` in any spacing shape.
   * (The canonical file holds no 16/9 literal at all — it derives — but the
   * exclusion stays explicit.) The CSS string `aspectRatio: '16/9'` in
   * InteractiveResultViewer.tsx is a browser style value on a different
   * layer, outside the src/visualization sweep boundary.
   */
  {
    id: 'target aspect ratio (16/9) single-sourced in canvas-dimensions',
    roots: ['src/visualization'],
    exclude: {
      'src/visualization/canvas-dimensions.ts': 'the canonical source itself (derives the ratio)',
    },
    patterns: [/16\s*\/\s*9/],
    minSweptFiles: 20,
  },
];
