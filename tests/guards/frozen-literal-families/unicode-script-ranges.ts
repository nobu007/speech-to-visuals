import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 23 (Unicode script ranges single-source): the boundaries of the
   * CJK/kana/hangul/fullwidth script ranges are defined ONLY by
   * src/lib/unicode-script-ranges.ts. Four consumers had four drifted
   * memberships for the same boundaries: language-detector (most complete,
   * via code-point comparisons), semantic-similarity (Ext A + Hangul but no
   * Katakana Phonetic Ext / no Compat), scene-segmenter (narrowest gate),
   * and smart-label-sizer (whole FF00-FFEF block — halfwidth katakana
   * renders 1x but was counted 2). Banned shapes cover all three freeze
   * forms: regex range escapes, hex code-point comparisons, and raw-literal
   * ranges inside a character class.
   */
  {
    id: 'unicode script ranges single-sourced in src/lib/unicode-script-ranges',
    roots: ['src/analysis', 'src/visualization', 'src/lib'],
    exclude: {
      'src/lib/unicode-script-ranges.ts': 'the canonical source itself',
    },
    patterns: [
      // Regex range-escape shape (any partial variant re-freeze).
      /\\u3040-\\u309F/,
      /\\u30A0-\\u30FF/,
      /\\u31F0-\\u31FF/,
      /\\u4E00-\\u9FFF/,
      /\\u3400-\\u4DBF/,
      /\\uF900-\\uFAFF/,
      /\\uAC00-\\uD7AF/,
      /\\uFF00-\\uFFEF/,
      /\\uFF01-\\uFF60/,
      // Hex code-point comparison shape (the pre-round-23 language-detector form).
      /0x(3040|309F|30A0|30FF|31F0|31FF|4E00|9FFF|3400|4DBF|F900|FAFF|AC00|D7AF|FF00|FF01|FF60|FFEF)/i,
      // Raw-literal script ranges inside a regex character class.
      /\/\[[^\]\n]*[぀-ヿ゠-ヿ㐀-䶿一-鿿豈-﫿가-힣]\s*-\s*[぀-ヿ゠-ヿ㐀-䶿一-鿿豈-﫿가-힣]/,
    ],
    minSweptFiles: 80,
  },
];
