/**
 * sentence-boundary migration oracle — round 21 (single-source campaign).
 *
 * Seven src/analysis splitters migrated to src/analysis/sentence-boundaries.ts.
 * This file pins the migration the same way the finite-safe-aggregation
 * waves did (legacy replica + seeded fuzz + delta evidence + source anchors):
 *
 *  - EQUIVALENCE (fuzz): against the two legacy shapes that already had the
 *    full terminator membership (rule-based-analyzer's splitSentences and
 *    diagram-detector's phrase splitter) the canonical regex is
 *    fragment-identical after trim/filter on 300 seeded cases.
 *  - DELTA (the behavior change): the four drifted shapes under-split —
 *    each row is a real input where the legacy site produced ONE fragment
 *    and the canonical regex produces the per-sentence split.
 *  - SOURCE ANCHORS: every former hand-roller imports the canonical module.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  SENTENCE_BOUNDARY_REGEX,
  PHRASE_BOUNDARY_REGEX,
} from '@/analysis/sentence-boundaries';
import { createLayoutRng } from '@/visualization/layout-rng';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Legacy rule-based-analyzer shape — the fullest pre-migration membership. */
const legacyFullSet = (text: string): string[] =>
  text
    .split(/。|\.\s+|\.$|[!！?？\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

/** Legacy diagram-detector phrase shape — full set + ';'. */
const legacyPhrase = (text: string): string[] =>
  text
    .split(/[。！？\n!?;]+|\.(?:\s+|$)/)
    .map((s) => s.trim())
    .filter(Boolean);

const canonical = (text: string): string[] =>
  text
    .split(SENTENCE_BOUNDARY_REGEX)
    .map((s) => s.trim())
    .filter(Boolean);

const canonicalPhrase = (text: string): string[] =>
  text
    .split(PHRASE_BOUNDARY_REGEX)
    .map((s) => s.trim())
    .filter(Boolean);

// ---------------------------------------------------------------------------
// Equivalence — canonical vs the legacy shapes that already had full membership
// ---------------------------------------------------------------------------

describe('canonical regex ≡ legacy full-set shapes (seeded fuzz)', () => {
  const FRAGMENTS = [
    'alpha', 'beta', 'gamma', 'データ', '処理', '2.5', '192.168.1.1', 'v2.0',
    '。', '！', '？', '!', '?', '\n', '.', ' ', ', ', ';', '、',
  ];

  function fuzzText(rng: () => number): string {
    const n = 1 + Math.floor(rng() * 14);
    return Array.from({ length: n }, () => FRAGMENTS[Math.floor(rng() * FRAGMENTS.length)]).join('');
  }

  test('300 seeded cases: fragments identical to legacy rule-based shape', () => {
    const rng = createLayoutRng('sentence-boundary|equiv-fullset');
    for (let i = 0; i < 300; i++) {
      const text = fuzzText(rng);
      expect(canonical(text)).toEqual(legacyFullSet(text));
    }
  });

  test('300 seeded cases: phrase fragments identical to legacy phrase shape', () => {
    const rng = createLayoutRng('sentence-boundary|equiv-phrase');
    for (let i = 0; i < 300; i++) {
      const text = fuzzText(rng);
      expect(canonicalPhrase(text)).toEqual(legacyPhrase(text));
    }
  });

  test('decimal safety preserved (TC-309 arm unchanged)', () => {
    // '1. Version' IS a sentence boundary (dot + space); the intra-token
    // dots must survive intact.
    const text = 'The ratio is 1.5 to 1. Version 2.0 and IP 192.168.1.1 end.';
    const fragments = canonical(text);
    expect(fragments).toEqual([
      'The ratio is 1.5 to 1',
      'Version 2.0 and IP 192.168.1.1 end',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Delta evidence — the four drifted shapes under-split before the migration
// ---------------------------------------------------------------------------

describe('delta table: legacy drifted shapes vs canonical (behavior change)', () => {
  const cases: Array<{
    site: string;
    legacyShape: (text: string) => string[];
    input: string;
    legacyCount: number;
    canonicalCount: number;
  }> = [
    {
      // content-analyzer.ts:54 + complexity-detector.ts:448 — no full-width ！？
      site: 'content-analyzer/complexity:448 [。!?\\n]',
      legacyShape: (t) => t.split(/[。!?\n]+|\.(?:\s+|$)/).map((s) => s.trim()).filter(Boolean),
      input: '良い！安い？買う。',
      legacyCount: 1,
      canonicalCount: 3,
    },
    {
      // complexity-detector.ts:144 — no \n (same file as :448!)
      site: 'complexity:144 [。!?]',
      legacyShape: (t) => t.split(/[。!?]+|\.(?:\s+|$)/).map((s) => s.trim()).filter(Boolean),
      input: 'line one\nline two\nline three',
      legacyCount: 1,
      canonicalCount: 3,
    },
    {
      // scene-segmenter.ts:437 — no \n
      site: 'scene-segmenter:437 [!?。！？]',
      legacyShape: (t) => t.split(/[!?。！？]+|\.(?:\s+|$)/).map((s) => s.trim()).filter(Boolean),
      input: '一行目です\n二行目です\n三行目です',
      legacyCount: 1,
      canonicalCount: 3,
    },
    {
      // diagram-detector.ts:847 extractContext — [!?] only
      site: 'diagram-detector:847 [!?]',
      legacyShape: (t) => t.split(/[!?]+|\.(?:\s+|$)/).map((s) => s.trim()).filter(Boolean),
      input: 'これはAです。それはBです。',
      legacyCount: 1,
      canonicalCount: 2,
    },
  ];

  it.each(cases)(
    '$site: "$input" legacy=$legacyCount → canonical=$canonicalCount',
    ({ legacyShape, input, legacyCount, canonicalCount }) => {
      expect(legacyShape(input)).toHaveLength(legacyCount);
      expect(canonical(input)).toHaveLength(canonicalCount);
    },
  );
});

// ---------------------------------------------------------------------------
// Source anchors — every former hand-roller delegates to the canonical module
// ---------------------------------------------------------------------------

describe('source anchors: the 6 migrated files import sentence-boundaries', () => {
  // Pure sentence splitters: no hand-rolled CJK-terminator class may remain.
  const SENTENCE_FILES = [
    'src/analysis/content-analyzer.ts',
    'src/analysis/complexity-detector.ts',
    'src/analysis/rule-based-analyzer.ts',
    'src/analysis/scene-segmenter.ts',
  ];
  // diagram-detector additionally hosts the WORD TOKENIZER
  // ([\s、。,!?；;：:...]) — token-level, a documented different concept — so
  // only the import pins and the sentence-splitter SHAPE are asserted there.
  const IMPORTS: Array<[string, string]> = [
    ...SENTENCE_FILES.map((f) => [f, 'SENTENCE_BOUNDARY_REGEX'] as [string, string]),
    ['src/analysis/diagram-detector.ts', 'SENTENCE_BOUNDARY_REGEX'],
    ['src/analysis/diagram-detector.ts', 'PHRASE_BOUNDARY_REGEX'],
  ];

  it.each(IMPORTS)('%s imports %s', (file, name) => {
    const src = readFileSync(path.join(here, '../../', file), 'utf8');
    expect(src).toMatch(
      new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"]\\./sentence-boundaries['"]`),
    );
  });

  it.each(SENTENCE_FILES)('%s no longer hand-rolls a terminator class', (file) => {
    const src = readFileSync(path.join(here, '../../', file), 'utf8');
    expect(src).not.toMatch(/\.split\(\s*\/\[[^\]\n]*[。！？]/);
  });

  it('diagram-detector keeps no sentence-SPLITTER shape (tokenizer class is token-level)', () => {
    const src = readFileSync(
      path.join(here, '../../src/analysis/diagram-detector.ts'),
      'utf8',
    );
    // The sentence-splitter signature: a CJK-terminator class JOINED with the
    // decimal-safe dot arm. The word tokenizer has no dot arm.
    expect(src).not.toMatch(/[。！？][^\n]*\]\+\|\\\.\(\?:\\\s\+\|\$\)/);
  });
});
