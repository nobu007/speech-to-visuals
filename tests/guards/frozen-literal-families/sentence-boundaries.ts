import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 21 (sentence-boundary single-source): the TERMINATOR MEMBERSHIP of
   * every sentence splitter in src/analysis lives in
   * src/analysis/sentence-boundaries.ts. Seven hand-rolled classes had
   * drifted four ways (no \n, no full-width ！？, a 。-less context
   * extractor, a lone ';' phrase variant) — TC-309 pins the decimal-safe '.'
   * arm but cannot see terminator membership at all. Any new splitter that
   * hand-rolls a CJK-terminator class re-opens the family: import
   * SENTENCE_BOUNDARY_REGEX (or PHRASE_BOUNDARY_REGEX for phrase-level
   * extraction) instead.
   */
  {
    id: 'sentence-boundary terminators single-sourced in src/analysis/sentence-boundaries',
    roots: ['src/analysis'],
    exclude: {
      'src/analysis/sentence-boundaries.ts': 'the canonical source itself',
      'src/analysis/diagram-detector.ts':
        'sub-phrase comma/conjunction split and the word tokenizer ([\\s、。,...]) are TOKEN-level — they also break on spaces/commas/brackets, so they are not sentence splitters (different concept)',
    },
    patterns: [
      // A hand-rolled split class containing CJK sentence terminators.
      /\.split\(\s*\/\[[^\]\n]*[。！？][^\]\n]*\]/,
      // The pre-round-21 rule-based shape: bare 。 first alternation arm.
      /\.split\(\s*\/。/,
    ],
    minSweptFiles: 25,
  },
];
