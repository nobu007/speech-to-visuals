import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 14: an average over `Object.values(x).reduce(...)` must derive its
   * denominator from the averaged keyset (`.length`), never a hardcoded count.
   * Before this round, quality-monitor's three compliance scorers each divided
   * by a literal `/ 5` next to a 5-key object — correct today, but adding a
   * sixth criterion silently changes the scale of the score (a 6×1.0 keyset
   * would max out at 1.2, and thresholds like `< 0.9` trip on perfect runs).
   * The banned shape is the same-line `reduce(...) / <integer>`; sibling shapes
   * that already derive (`… / Object.keys(x).length`, `… / values.length`)
   * do not match. There is no canonical source to exclude — the correct shape
   * IS deriving from the keyset at each site.
   */
  {
    id: 'mean denominators derive from the averaged keyset (no hardcoded /N)',
    roots: ['src'],
    patterns: [
      // Greedy callback match: the reduce callback itself contains `)`, so the
      // banned denominator is the LAST `)` on the line followed by `/ <int>`.
      /Object\.values\([^)]*\)\s*\.reduce\(.*\)\s*\/\s*\d+\b/,
      /Object\.keys\([^)]*\)\s*\.reduce\(.*\)\s*\/\s*\d+\b/,
    ],
    minSweptFiles: 200,
  },
];
