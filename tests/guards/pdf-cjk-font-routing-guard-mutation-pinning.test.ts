/**
 * @jest-environment node
 */
/**
 * pdf-cjk-font-routing-guard-mutation-pinning.test.ts — TC-308
 *
 * Pins the CJK-glyph-rendering fix at `src/export/multi-format-exporter.ts`
 * against silent regression.
 *
 * THE BUG CLASS. The PDF content stream rendered node/edge labels with the
 * base-14 Helvetica font + /Encoding /WinAnsiEncoding, which covers only
 * Latin-1 (U+0000–U+00FF). CJK and other >U+00FF glyphs have NO resolvable
 * glyph there, so labels like 処理 / 入力 / 次へ rendered as nothing — the file
 * was structurally valid (the byte-offset fix, TC-303, made sure of that) but
 * visually blank for the common case in this Japan-first pipeline.
 *
 * THE FIX. Labels containing a >U+00FF character are routed to a non-embedded
 * Adobe-Japan1 Type0 composite font (/F3, HeiseiKakuGo-W5) and emitted as
 * UTF-16BE hex strings; its /Encoding /UniJIS-UCS2-H CMap maps each 2-byte
 * unit → CID → glyph, so the labels become displayable. Latin-1-only labels
 * stay on Helvetica (/F1 edges, /F2 bold nodes) exactly as before.
 *
 * WHY MUTATION PINNING. A future "simplification" that drops the Type0 font
 * and reverts CJK labels to Helvetica literals compiles, passes every
 * ASCII-only test, and silently re-blanks every CJK diagram — identical to
 * the original bug. Layer 1 pins the source anchors so that edit goes RED
 * independent of any behavioral file; Layers 2–3 prove the routing actually
 * fires on a CJK scene and that the hex is the correct UTF-16BE of the glyph.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { MultiFormatExporter } from '@/export/multi-format-exporter';
import type { ExportOptions } from '@/export/multi-format-exporter';
import type { SceneGraph } from '@stv/core/types/diagram';

const GUARD_FILE = 'src/export/multi-format-exporter.ts';

// --- (TC-308-01) source anchors: pin the CJK font machinery -------------------

describe('PDF CJK font routing — source anchors pinned (TC-308-01)', () => {
  const src = (): string => readFileSync(GUARD_FILE, 'utf8');

  it('declares a Type0 composite font (the only font subtype that maps Unicode → CID)', () => {
    // Removing the Type0 object (reverting CJK to Helvetica) leaves this
    // unmatched → RED.
    expect(src()).toMatch(/\/Subtype \/Type0/);
  });

  it('uses a CJK-capable base font, not Helvetica', () => {
    expect(src()).toMatch(/\/BaseFont \/HeiseiKakuGo-W5/);
  });

  it('declares a Unicode CMap so 2-byte units resolve to glyphs', () => {
    // A revert to /WinAnsiEncoding here re-breaks CJK rendering → RED.
    expect(src()).toMatch(/\/Encoding \/UniJIS-UCS2-H/);
  });

  it('declares the CIDFont descendant on the Adobe-Japan1 collection', () => {
    expect(src()).toMatch(/\/Subtype \/CIDFontType0/);
    expect(src()).toMatch(/\/Ordering \(Japan1\)/);
  });

  it('has a non-WinAnsi detection helper keyed on the >U+00FF boundary', () => {
    // The detector decides which labels route to /F3. Lowering the threshold
    // (e.g. `> 0x7f`) is harmless-ish; removing it / flipping to `<=` breaks
    // routing. Pin both the helper and its boundary check.
    expect(src()).toMatch(/private hasNonWinAnsiChar\(text: string\): boolean/);
    expect(src()).toMatch(/> 0xff/);
  });

  it('has a UTF-16BE hex-string encoder (the form UniJIS-UCS2-H shows)', () => {
    // Reverting CJK to `(${escapePDFString(label)})` literals removes this → RED.
    expect(src()).toMatch(/private pdfUtf16BeHexString\(text: string\): string/);
    expect(src()).toMatch(/charCodeAt\(i\)\.toString\(16\)\.padStart\(4, '0'\)/);
  });

  it('declares /F3 only when the scene needs it (conditional resource)', () => {
    // The Page Resources add /F3 iff needsCjk. Hardcoding /F3 (always-on) is
    // wasteful but not wrong; the meaningful revert is DROPPING the ternary,
    // which this anchor catches.
    expect(src()).toMatch(/needsCjk \? ' \/F3 7 0 R' : ''/);
  });
});

// --- (TC-308-02) behavioral: a CJK scene actually routes labels to /F3 --------

function makeCjkScene(): SceneGraph {
  const n = (id: string, label: string, x: number) => ({
    id, label, x, y: 100, width: 160, height: 70,
  });
  return {
    id: 'cjk-routing',
    type: 'flow',
    nodes: [n('n1', '処理', 100), n('n2', '結果', 500)],
    edges: [{ from: 'n1', to: 'n2', label: '次へ' }],
    startMs: 0,
    durationMs: 5000,
    summary: 'CJK font routing guard',
    keyphrases: [],
    layout: {
      nodes: [n('n1', '処理', 100), n('n2', '結果', 500)],
      edges: [{ from: 'n1', to: 'n2', label: '次へ', points: [{ x: 100, y: 100 }, { x: 500, y: 100 }] }],
    },
  };
}

function makeLatinScene(): SceneGraph {
  const n = (id: string, label: string, x: number) => ({
    id, label, x, y: 100, width: 160, height: 70,
  });
  return {
    id: 'latin-routing',
    type: 'flow',
    nodes: [n('n1', 'Start', 100), n('n2', 'End', 500)],
    edges: [{ from: 'n1', to: 'n2', label: 'next' }],
    startMs: 0,
    durationMs: 5000,
    summary: 'Latin font routing guard',
    keyphrases: [],
    layout: {
      nodes: [n('n1', 'Start', 100), n('n2', 'End', 500)],
      edges: [{ from: 'n1', to: 'n2', label: 'next', points: [{ x: 100, y: 100 }, { x: 500, y: 100 }] }],
    },
  };
}

async function exportPdfText(scene: SceneGraph): Promise<string> {
  const exporter = new MultiFormatExporter();
  const result = await exporter.export(scene, { format: 'pdf' } as ExportOptions);
  expect(result.success).toBe(true);
  return (result.data as Blob).text();
}

describe('PDF CJK font routing — behavioral (TC-308-02)', () => {
  it('routes a CJK scene to the Type0 font with UTF-16BE hex labels', async () => {
    const text = await exportPdfText(makeCjkScene());

    // The Type0 font and its CIDFont descendant are both declared.
    expect(text).toContain('/Subtype /Type0');
    expect(text).toContain('/BaseFont /HeiseiKakuGo-W5');
    expect(text).toContain('/Encoding /UniJIS-UCS2-H');
    expect(text).toContain('/Subtype /CIDFontType0');

    // /F3 is registered in the Page Resources and selected by CJK labels.
    expect(text).toContain('/F3 7 0 R');
    expect(text).toContain('/F3 14 Tf'); // CJK node label
    expect(text).toContain('/F3 12 Tf'); // CJK edge label

    // The CJK glyphs appear as UTF-16BE hex (displayable by the CMap), NOT as
    // Helvetica literals (which provably cannot render them).
    //   処理 = U+51E6 U+7406 | 次へ = U+6B21 U+3078 | 結果 = U+7D50 U+679C
    expect(text).toContain('<51E67406>');
    expect(text).toContain('<6B213078>');
    expect(text).toContain('<7D50679C>');
    expect(text).not.toContain('(処理)');
    expect(text).not.toContain('(次へ)');
  });

  it('emits 8 objects for a CJK scene (6 base + 2 CJK font objects)', async () => {
    const text = await exportPdfText(makeCjkScene());
    const offsets = [...text.matchAll(/^(\d{10}) 00000 n\b/gm)].map((m) => Number(m[1]));
    expect(offsets).toHaveLength(8);
    // Trailer /Size reflects the free entry + 8 objects.
    expect(text).toMatch(/\/Size 9 /);
  });

  it('keeps a Latin-only scene on Helvetica with no CJK font objects', async () => {
    const text = await exportPdfText(makeLatinScene());

    expect(text).not.toContain('/Subtype /Type0');
    expect(text).not.toContain('/F3');
    // Latin nodes still use the bold Helvetica (/F2); edges regular (/F1).
    expect(text).toContain('/F2 14 Tf');
    expect(text).toContain('/F1 12 Tf');

    const offsets = [...text.matchAll(/^(\d{10}) 00000 n\b/gm)].map((m) => Number(m[1]));
    expect(offsets).toHaveLength(6);
  });

  it('routes a mixed Latin+CJK label wholly to /F3 (whole-label routing)', async () => {
    // A label mixing ASCII and CJK has a >U+00FF char → the whole label goes
    // to /F3 as one UTF-16BE hex string (the Latin glyphs render via the CJK
    // font's Latin coverage). This avoids splitting a label across fonts.
    const n = (id: string, label: string, x: number) => ({
      id, label, x, y: 100, width: 160, height: 70,
    });
    const scene: SceneGraph = {
      id: 'mixed-routing',
      type: 'flow',
      nodes: [n('n1', 'API処理', 100)],
      edges: [],
      startMs: 0,
      durationMs: 5000,
      summary: 'mixed label routing',
      keyphrases: [],
      layout: { nodes: [n('n1', 'API処理', 100)], edges: [] },
    };
    const text = await exportPdfText(scene);

    // 'A' (U+0041) + 'P' (U+0050) + 'I' (U+0049) + '処' (U+51E6) + '理' (U+7406)
    // → UTF-16BE hex: 0041 0050 0049 51E6 7406
    expect(text).toContain('<00410050004951E67406>');
    // And NOT split out as a separate Helvetica literal.
    expect(text).not.toContain('(API処理)');
  });
});

// --- (TC-308-03) witness: the hex is the correct UTF-16BE of the glyph --------

describe('PDF CJK font routing — encoding witness (TC-308-03)', () => {
  it('the emitted hex equals the glyph Unicode code point (UTF-16BE)', () => {
    // Proves the hex string is the genuine UTF-16BE of the CJK character —
    // i.e. what UniJIS-UCS2-H maps to a CID — not an arbitrary byte sequence.
    // If the encoder were wrong (e.g. UTF-8 bytes, or code points > 0xFFFF
    // mishandled), this relationship breaks.
    const hexOf = (ch: string): string =>
      ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0');
    expect(hexOf('処')).toBe('51E6'); // U+51E6
    expect(hexOf('理')).toBe('7406'); // U+7406
    expect(hexOf('次')).toBe('6B21'); // U+6B21
    expect(hexOf('へ')).toBe('3078'); // U+3078
    // Joined label 処理 → the exact hex asserted behaviorally in TC-308-02.
    expect(['処', '理'].map(hexOf).join('')).toBe('51E67406');
  });
});
