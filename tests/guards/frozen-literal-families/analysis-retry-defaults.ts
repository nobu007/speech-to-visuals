import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 9: analysis-layer LLM retry defaults (maxRetries 3, baseDelay 1000,
   * maxDelay 10000) live only in retry-strategy.ts as the exported
   * DEFAULT_RETRY_OPTIONS. The pipeline-layer retry system
   * (src/pipeline/retry.ts — ErrorClassifier-driven, 500ms base) is a
   * different concept and lives outside this sweep boundary.
   */
  {
    id: 'analysis retry defaults (3/1000/10000) single-sourced in retry-strategy',
    roots: ['src/analysis'],
    exclude: {
      'src/analysis/retry-strategy.ts': 'the canonical source itself',
    },
    patterns: [
      /maxRetries\s*(:|=|\|\||\?\?)\s*3\b/,
      /baseDelay\s*:\s*1000\b/,
      /maxDelay\s*:\s*10000\b/,
    ],
    minSweptFiles: 20,
  },
];
