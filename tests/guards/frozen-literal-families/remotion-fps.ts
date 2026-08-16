import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 4 (REQ-296 + sibling-shape extension): DEFAULT_FPS = 30 lives only
   * in src/remotion/scene-synchronizer.ts. Banned shapes cover const
   * redeclaration, `|| 30` / `?? 30` fallbacks, and the `const fps = 30`
   * local alias that feeds Lottie/composition frame math directly.
   */
  {
    id: 'default-fps (30) single-sourced in scene-synchronizer',
    roots: ['src'],
    exclude: {
      'src/remotion/scene-synchronizer.ts': 'the canonical source itself',
    },
    patterns: [
      /\bconst\s+DEFAULT_FPS\s*=\s*30\s*;/,
      /\bfps\b\s*\|\|\s*30\b/,
      /\bconst\s+fps\s*=\s*30\b/,
      /\bfps\s*\?\?\s*30\b/,
    ],
    minSweptFiles: 50,
  },
];
