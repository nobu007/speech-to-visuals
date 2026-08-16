import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 7 (09a): error-rate warning/critical boundaries (0.05/0.10/0.15)
   * live only in error-rate-thresholds.ts. Two line shapes: same-line
   * `errorRate … 0.05` coupling (any order via predicate), and the
   * next-line `warning: 0.05` / `critical: 0.15` threshold-shape assignment
   * that catches multi-line setAlertThreshold calls.
   * production-config.ts is the documented exclusion: a UI-editable default
   * coupled to the engine threshold is its own defect class (09a precedent).
   */
  {
    id: 'error-rate thresholds (0.05/0.10/0.15) single-sourced in error-rate-thresholds',
    roots: ['src'],
    exclude: {
      'src/monitoring/error-rate-thresholds.ts': 'the canonical source itself',
      'src/config/production-config.ts':
        'user-editable alertThresholds default — see 09a module header',
    },
    patterns: [
      (line) => /errorRate/i.test(line) && /\b0\.05\b|\b0\.10\b|\b0\.15\b/.test(line),
      /(warning|critical|maxErrorRate|errorRateThreshold)\s*:\s*(0\.05|0\.10|0\.15)\b/,
    ],
  },
];
