import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 4 (layout-quality desync): the composite layout-quality pass bar
   * 0.7 — scorer's pass bar and optimizer's stop bar are the SAME judgment.
   * Exclusions are different concepts that merely share the value 0.7
   * (detection confidence; pipeline criterion gates).
   */
  {
    id: 'layout-quality threshold (0.7) single-sourced in layout-quality-composite',
    roots: ['src/visualization', 'src/pipeline'],
    exclude: {
      'src/visualization/layout-quality-composite.ts': 'the canonical source itself',
      'src/analysis/scene-segmenter.ts':
        'DETECTION confidence (diagram-type), not layout geometry — different concept',
      'src/quality/quality-gate.ts':
        'pipeline criterion gates, not layout geometry — different concept',
    },
    patterns: [
      /(DEFAULT_THRESHOLD|DEFAULT_LAYOUT_QUALITY_THRESHOLD)\s*=\s*0\.7\b/,
      /\bthreshold\s*:\s*0\.7\b/,
    ],
  },
];
