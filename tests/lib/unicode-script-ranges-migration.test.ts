/**
 * Unicode script ranges — migration oracle (single-source round 23).
 *
 * Four files hand-rolled "which characters are CJK/kana" with drifted
 * memberships for the same script boundaries:
 *
 *   - analysis/language-detector.ts   code-point comparisons (most complete:
 *                                     kana + phonetic ext + Ext A + Compat)
 *   - analysis/semantic-similarity.ts tokenize class (Ext A + Hangul, but no
 *                                     Katakana Phonetic Ext, no Compat)
 *   - analysis/scene-segmenter.ts     narrowest gate (no Ext A / Compat /
 *                                     Hangul) + three keyword sub-patterns
 *   - visualization/smart-label-sizer.ts width class (Hangul + the WHOLE
 *                                     FF00-FFEF block — including halfwidth
 *                                     katakana, which renders 1x, not 2x)
 *
 * This file pins the migration the way rounds 21/22 did (delta table +
 * equivalence + source anchors):
 *
 *  - DELTA: rows where the drifted memberships produced wrong output —
 *    Ext-A/Compat/kana-ext chars counted 1 char-unit wide (labels ~2x over
 *    budget → overflow), halfwidth katakana counted 2x (premature wrap),
 *    Compat ideographs dropped from LLM-cache tokens, Ext-A-only text
 *    skipped by the Japanese keyword gate.
 *  - EQUIVALENCE: rows whose chars every variant already agreed on (plain
 *    kana/kanji/hangul/fullwidth-Latin, plain Latin) must stay identical.
 *  - SOURCE ANCHORS: the four consumers import the shared module.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  KANA_RANGES,
  CJK_IDEOGRAPH_RANGES,
  JAPANESE_TEXT_RANGES,
  CJK_TOKEN_RANGES,
  WIDE_DISPLAY_RANGES,
  charInRanges,
  charClassSource,
  buildCharClassRegex,
} from '@stv/core/lib/unicode-script-ranges';
import { calculateSemanticSimilarity } from '@/analysis/semantic-similarity';
import { SceneSegmenter } from '@/analysis/scene-segmenter';
import { detectLanguage } from '@/analysis/language-detector';
import { isCJKChar, hasCJKText, textWidth } from '@/visualization/smart-label-sizer';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, '..', '..');

// ---------------------------------------------------------------------------
// 1. Module membership — absolute expectation table (codepoint → preset).
//    Rows are the round-23 drift matrix: which variant had which range.
// ---------------------------------------------------------------------------

const MEMBERSHIP: Array<{ cp: string; label: string; kana: boolean; ideograph: boolean; japanese: boolean; token: boolean; wide: boolean }> = [
  // cp, label, kana, ideograph, japanese, token, wide
  { cp: 'あ', label: 'hiragana', kana: true, ideograph: false, japanese: true, token: true, wide: true },
  { cp: 'ア', label: 'katakana', kana: true, ideograph: false, japanese: true, token: true, wide: true },
  { cp: 'ㇰ', label: 'katakana phonetic ext (31F0) — only language-detector had it', kana: true, ideograph: false, japanese: true, token: true, wide: true },
  { cp: '一', label: 'CJK unified', kana: false, ideograph: true, japanese: true, token: true, wide: true },
  { cp: '㐀', label: 'CJK ext A (3400) — missing from segmenter/label-sizer', kana: false, ideograph: true, japanese: true, token: true, wide: true },
  { cp: '\uF900', label: 'CJK compat ideograph (F900) — only language-detector had it', kana: false, ideograph: true, japanese: true, token: true, wide: true },
  { cp: '가', label: 'hangul — token/wide but NOT Japanese', kana: false, ideograph: false, japanese: false, token: true, wide: true },
  { cp: 'Ａ', label: 'fullwidth Latin (FF21) — wide only', kana: false, ideograph: false, japanese: false, token: false, wide: true },
  { cp: 'ｱ', label: 'halfwidth katakana (FF71) — renders 1x, in NOTHING', kana: false, ideograph: false, japanese: false, token: false, wide: false },
  { cp: 'A', label: 'plain Latin', kana: false, ideograph: false, japanese: false, token: false, wide: false },
];

describe('unicode-script-ranges preset membership', () => {
  // Fail-loud capture over `codePointAt(0): number | undefined` — every
  // membership row is a single code point, so the throw keeps a malformed
  // fixture row RED and named instead of asserting it away
  // (Phase 168 / REQ-362).
  function requireCodePoint(cp: string): number {
    const code = cp.codePointAt(0);
    if (code === undefined) {
      throw new Error(`membership row has an empty code point: ${cp}`);
    }
    return code;
  }

  test.each(MEMBERSHIP)('$label $cp', row => {
    const code = requireCodePoint(row.cp);
    expect(charInRanges(code, KANA_RANGES)).toBe(row.kana);
    expect(charInRanges(code, CJK_IDEOGRAPH_RANGES)).toBe(row.ideograph);
    expect(charInRanges(code, JAPANESE_TEXT_RANGES)).toBe(row.japanese);
    expect(charInRanges(code, CJK_TOKEN_RANGES)).toBe(row.token);
    expect(charInRanges(code, WIDE_DISPLAY_RANGES)).toBe(row.wide);
  });

  test('presets nest: kana+ideograph ⊂ japanese ⊂ token ⊂ wide', () => {
    const all = MEMBERSHIP.map(m => requireCodePoint(m.cp));
    for (const code of all) {
      const ja = charInRanges(code, JAPANESE_TEXT_RANGES);
      if (ja) {
        expect(charInRanges(code, KANA_RANGES) || charInRanges(code, CJK_IDEOGRAPH_RANGES)).toBe(true);
        expect(charInRanges(code, CJK_TOKEN_RANGES)).toBe(true);
        expect(charInRanges(code, WIDE_DISPLAY_RANGES)).toBe(true);
      }
      if (charInRanges(code, CJK_TOKEN_RANGES)) {
        expect(charInRanges(code, WIDE_DISPLAY_RANGES)).toBe(true);
      }
    }
  });

  test('charClassSource emits the canonical escape shape', () => {
    expect(charClassSource(KANA_RANGES)).toBe('\\u3040-\\u309F\\u30A0-\\u30FF\\u31F0-\\u31FF');
    expect(charClassSource(CJK_IDEOGRAPH_RANGES)).toBe('\\u4E00-\\u9FFF\\u3400-\\u4DBF\\uF900-\\uFAFF');
  });

  test('buildCharClassRegex compiles a working class', () => {
    const re = buildCharClassRegex(WIDE_DISPLAY_RANGES);
    expect(re.test('㐀')).toBe(true);
    expect(re.test('ｱ')).toBe(false);
    expect(re.test('A')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. smart-label-sizer — width model (feeds node label wrapping AND the
//    multi-format-exporter size estimate via textWidth()).
// ---------------------------------------------------------------------------

describe('smart-label-sizer width model', () => {
  // DELTA rows — the drifted class returned these wrong before round 23:
  // Ext-A/Compat/kana-ext kanji are rendered ~2x wide but counted 1;
  // halfwidth katakana renders 1x but the whole FF00-FFEF block counted 2.
  test.each([
    ['㐀', 2],        // CJK ext A — was 1 (undercount → label overflow risk)
    ['\uF900', 2],     // CJK compat ideograph — was 1
    ['ㇰ', 2],        // katakana phonetic ext — was 1
    ['ｱ', 1],         // halfwidth katakana FF71 — was 2 (overcount → premature wrap)
    ['｡', 1],         // halfwidth ideographic stop FF61 — was 2
    ['A㐀', 3],       // mixed Latin + ext A
  ])('textWidth(%j) === %d (round-23 delta)', (text, expected) => {
    expect(textWidth(text)).toBe(expected);
  });

  test.each([
    ['A', 1],
    ['AB', 2],
    ['あ', 2],
    ['ア', 2],
    ['一', 2],
    ['漢字', 4],
    ['가', 2],
    ['Ａ', 2],        // fullwidth Latin stays wide (FF01-FF60 kept)
  ])('textWidth(%j) === %d (equivalence)', (text, expected) => {
    expect(textWidth(text)).toBe(expected);
  });

  test('isCJKChar/hasCJKText cover Ext A after round 23 (was false)', () => {
    expect(isCJKChar('㐀')).toBe(true);
    expect(isCJKChar('\uF900')).toBe(true);
    expect(hasCJKText('㐀㐁')).toBe(true);
  });

  test.each([
    ['あ', true], ['A', false], ['ｱ', false],   // ｱ was true pre-round-23 (whole FF00-FFEF block)
  ])('isCJKChar(%j) === %s', (ch, expected) => {
    expect(isCJKChar(ch)).toBe(expected);
  });

  test('hasCJKText plain Latin stays false (equivalence)', () => {
    expect(hasCJKText('hello world')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. semantic-similarity — LLM-cache tokenization.
//    Compat ideographs and katakana phonetic ext were STRIPPED from tokens
//    (fell to the Latin path and died in [^\w\s]); Ext A was already covered.
// ---------------------------------------------------------------------------

describe('semantic-similarity tokenize coverage', () => {
  // Absolute expected values, hand-derived from the Jaccard/n-gram weighting
  // (0.6/0.2/0.2) and cross-checked against the pre-migration probe.
  test('compat ideographs now tokenize as shared content (was 0.283333)', () => {
    expect(calculateSemanticSimilarity('\uF900\uF900ab', '\uF900\uF900abc')).toBeCloseTo(0.483333, 5);
  });

  test('katakana phonetic ext now tokenizes as shared content (was 0.283333)', () => {
    expect(calculateSemanticSimilarity('ㇰㇰab', 'ㇰㇰabc')).toBeCloseTo(0.483333, 5);
  });

  test.each([
    ['データベース設計', 'データベース実装', 0.544444],
    ['The quick brown fox', 'The quick brown cat', 0.622745],
    ['㐀㐀ab', '㐀㐀abc', 0.483333],  // ext A already in the old class
  ])('similarity(%j, %j) unchanged (equivalence)', (a, b, expected) => {
    expect(calculateSemanticSimilarity(a, b)).toBeCloseTo(expected, 5);
  });
});

// ---------------------------------------------------------------------------
// 4. scene-segmenter — Japanese keyword gate + sub-patterns.
// ---------------------------------------------------------------------------

describe('scene-segmenter Japanese keyword extraction', () => {
  const seg = new SceneSegmenter() as unknown as {
    extractJapaneseKeywords(text: string): string[];
  };

  // DELTA — gate and compound pattern now use the canonical ideograph set.
  test('Ext-A compounds are extracted (gate passed but pattern missed them)', () => {
    expect(seg.extractJapaneseKeywords('㐀㐁の設計')).toEqual(['㐀㐁', '設計']);
  });

  test('Ext-A-only text passes the Japanese gate (was [] → English fallback)', () => {
    expect(seg.extractJapaneseKeywords('㐀㐁㐂')).toEqual(['㐀㐁㐂']);
  });

  test('compat ideograph compounds are extracted', () => {
    expect(seg.extractJapaneseKeywords('\uF904\uF905の設計')).toEqual(['\uF904\uF905', '設計']);
  });

  // EQUIVALENCE — plain Japanese rows keep their exact pre-round-23 output.
  test.each([
    ['データベース設計を行う', ['データベース設計', 'データベース']],
    ['第三正規形について', ['第三正規形']],
    ['システムの構築', ['システム', '構築']],
  ])('keywords(%j) unchanged (equivalence)', (text, expected) => {
    expect(seg.extractJapaneseKeywords(text)).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// 5. language-detector — anchor file, delegation must be behavior-neutral.
// ---------------------------------------------------------------------------

describe('language-detector delegation is behavior-neutral', () => {
  test.each([
    ['今日は天気ですね', 'ja'],
    ['ㇰㇱアイヌ', 'ja'],          // kana phonetic ext already kana here
    ['\uF900\uF904\uF905', 'zh'],  // compat ideographs, no kana → zh (pre-existing)
    ['The quick brown fox', 'en'],
  ])('detectLanguage(%j).language === %s', (text, expected) => {
    expect(detectLanguage(text).language).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// 6. SOURCE ANCHORS — every consumer composes from the shared module.
// ---------------------------------------------------------------------------

describe('source anchors: consumers import the single source', () => {
  const CONSUMERS = [
    'src/analysis/language-detector.ts',
    'src/analysis/semantic-similarity.ts',
    'src/analysis/scene-segmenter.ts',
    'src/visualization/smart-label-sizer.ts',
  ];

  test.each(CONSUMERS)('%s imports unicode-script-ranges', rel => {
    const src = readFileSync(path.join(repoRoot, rel), 'utf8');
    expect(src).toMatch(/unicode-script-ranges/);
  });
});
