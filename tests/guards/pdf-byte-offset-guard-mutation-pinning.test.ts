/**
 * @jest-environment node
 */
/**
 * pdf-byte-offset-guard-mutation-pinning.test.ts — TC-303
 *
 * Pins the byte-vs-codeunit PDF offset guard at
 * `src/export/multi-format-exporter.ts` (commit 239f3b72, iteration 11)
 * against silent regression.
 *
 * THE BUG CLASS. PDF cross-reference offsets and the content-stream /Length
 * are BYTE counts (PDF spec §7.5.4). `new Blob([pdf])` UTF-8-encodes the
 * assembled string, but JS `.length` counts UTF-16 code units. For a CJK
 * label (the common case in this Japanese-first pipeline) one BMP character
 * is 1 code unit but 3 UTF-8 bytes, so every offset declared AFTER the first
 * such character was too small and the file structure silently broke:
 * readers following the xref table landed mid-character inside object 4's
 * stream instead of on the `5 0 obj` / `6 0 obj` headers, and startxref
 * pointed into the middle of the xref table itself.
 *
 * `escapePDFString` deliberately leaves non-ASCII bytes raw (it only escapes
 * `()\` and ASCII control chars). Since the CJK-font fix (this iteration),
 * >U+00FF labels are routed to a Type0 font as ASCII UTF-16BE hex, so they no
 * longer carry multi-byte UTF-8 in the stream. But accented LATIN-1 labels
 * (é, ü, ñ — code points ≤ 0xFF, which WinAnsiEncoding CAN render, so they
 * stay Helvetica literals) STILL reach the content stream as 2-byte UTF-8 —
 * the remaining span where code-unit ≠ byte. Objects 1/2/3 and 5/6 (+ 7/8
 * when CJK fonts are declared) are pure ASCII; ALL divergence therefore lives
 * inside object 4's content stream, which is what shifts later offsets.
 *
 * THE GUARD. The PDF builder tracks a running UTF-8 byte count:
 *   const encoder = new TextEncoder();
 *   const byteLength = (s: string): number => encoder.encode(s).length;
 *   let pdfBytes = byteLength(pdf);
 *   const append = (segment) => { pdf += segment; pdfBytes += byteLength(segment); };
 * every xref offset, the `/Length`, and startxref are derived from `pdfBytes`.
 *
 * WHY MUTATION PINNING. No existing test generates a CJK PDF and checks the
 * byte structure — the offset guard was verified only by the commit message
 * and the in-source comment. A future "simplification" that rewrites
 * `byteLength` to `s.length` (or recomputes an offset from `pdf.length`)
 * compiles, passes every ASCII-only test, and silently re-corrupts every
 * CJK PDF. Layer 1 fails on that edit independent of any behavioral file;
 * Layer 2 then proves the corruption is structural (code-unit offsets miss
 * the object headers); Layer 3 proves the divergence is real and large
 * enough to mis-locate an object.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { MultiFormatExporter } from '@/export/multi-format-exporter';
import type { ExportOptions } from '@/export/multi-format-exporter';
import type { SceneGraph } from '@stv/core/types/diagram';

const GUARD_FILE = 'src/export/multi-format-exporter.ts';

// --- (TC-303-01) source anchors: pin the byte-counting machinery ---------------

describe('PDF byte-offset guard — source anchors pinned (TC-303-01)', () => {
  const src = (): string => readFileSync(GUARD_FILE, 'utf8');

  it('byteLength helper measures UTF-8 bytes via TextEncoder, not JS .length', () => {
    // A revert to `(s: string): number => s.length` leaves this anchor
    // unmatched → RED.
    expect(src()).toMatch(
      /const byteLength = \(s: string\): number => encoder\.encode\(s\)\.length/,
    );
  });

  it('a TextEncoder instance backs the byte counter', () => {
    expect(src()).toMatch(/const encoder = new TextEncoder\(\)/);
  });

  it('the running byte counter is seeded and incremented via byteLength', () => {
    const s = src();
    expect(s).toMatch(/let pdfBytes = byteLength\(pdf\)/);
    expect(s).toMatch(/pdfBytes \+= byteLength\(segment\)/);
  });

  it('the content-stream /Length is the BYTE length of the stream', () => {
    // Reverting to `${streamContent.length}` (code units) → RED.
    expect(src()).toMatch(/\/Length \$\{byteLength\(streamContent\)\}/);
  });

  it('startxref is derived from the byte counter, not the string length', () => {
    expect(src()).toMatch(/const xrefOffset = pdfBytes/);
  });
});

// --- (TC-303-02) structural invariant: every xref offset lands on its object --

// A scene whose node + edge labels are accented LATIN-1 (é/ü/ä — code points
// ≤ 0xFF, so WinAnsiEncoding renders them and they stay Helvetica literals).
// They pass through `escapePDFString` raw and reach the content stream as
// 2-byte UTF-8 — the span where UTF-8 bytes diverge from UTF-16 code units.
//
// Why accented-Latin and NOT CJK here: since the CJK-font fix, >U+00FF labels
// are routed to the Type0 font as ASCII UTF-16BE hex, so a CJK scene's content
// stream is now pure ASCII (no divergence) and its PDF carries 8 objects
// (the 2 CJK font objects). That CJK path is pinned separately in
// pdf-cjk-font-routing-guard-mutation-pinning.test.ts. THIS guard's remaining
// domain — multi-byte UTF-8 in the stream — is exactly accented Latin-1,
// which keeps the 6-object Latin layout AND the byte divergence.
function makeAccentedLatinScene(): SceneGraph {
  const n = (id: string, label: string, x: number) => ({
    id,
    label,
    x,
    y: 100,
    width: 160,
    height: 70,
  });
  return {
    id: 'accented-latin-scene',
    type: 'flow',
    nodes: [n('n1', 'Café', 100), n('n2', 'Résumé Über', 500)],
    edges: [{ from: 'n1', to: 'n2', label: 'Nächste' }],
    startMs: 0,
    durationMs: 5000,
    summary: 'Accented-Latin PDF offset guard',
    keyphrases: [],
    layout: {
      nodes: [n('n1', 'Café', 100), n('n2', 'Résumé Über', 500)],
      edges: [{ from: 'n1', to: 'n2', label: 'Nächste', points: [] }],
    },
  };
}

// Decode the PDF bytes as latin1 so a character index == a byte offset.
// (UTF-8 decoding would collapse multi-byte accented chars back to one char
// per glyph and break the offset arithmetic — the whole point of the guard.)
async function accentedPdfLatin1(): Promise<string> {
  const exporter = new MultiFormatExporter();
  const result = await exporter.export(makeAccentedLatinScene(), { format: 'pdf' } as ExportOptions);
  expect(result.success).toBe(true);
  const buf = Buffer.from(await (result.data as Blob).arrayBuffer());
  return buf.toString('latin1');
}

describe('PDF byte-offset guard — structural invariant on an accented-Latin PDF (TC-303-02)', () => {
  it('every xref offset points to its declared object header', async () => {
    const text = await accentedPdfLatin1();

    // Slice from the xref table so the regex cannot match stream content.
    const xrefIdx = text.indexOf('\nxref\n');
    expect(xrefIdx).toBeGreaterThanOrEqual(0);
    const table = text.slice(xrefIdx);
    const offsets = [...table.matchAll(/^(\d{10}) 00000 n\s*$/gm)].map((m) =>
      Number(m[1]),
    );
    expect(offsets).toHaveLength(6);

    // The strong invariant: at each declared BYTE offset the file actually
    // begins the matching "K 0 obj" header. If any offset was tracked via
    // code units, it lands mid-accented-sequence inside object 4's stream → RED.
    offsets.forEach((off, i) => {
      const objNum = i + 1;
      // Header "K 0 obj" is 7 chars; the 8th is the object's trailing "\n".
      expect(text.substr(off, 7)).toBe(`${objNum} 0 obj`);
    });
  });

  it('startxref points exactly at the "xref" keyword', async () => {
    const text = await accentedPdfLatin1();
    // Byte offset of the 'x' in the "xref" table header (table appears before
    // "startxref", so indexOf finds the table, not the trailer keyword).
    const xrefByteOff = text.indexOf('\nxref\n') + 1;
    const m = text.match(/startxref\n(\d+)\n/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBe(xrefByteOff);
  });

  it('the content-stream /Length equals the byte distance stream→endstream', async () => {
    const text = await accentedPdfLatin1();
    const lenMatch = text.match(/\/Length (\d+) >>\nstream\n/);
    expect(lenMatch).not.toBeNull();
    const declared = Number(lenMatch![1]);
    const afterStream = (lenMatch!.index ?? 0) + lenMatch![0].length;
    const streamEnd = text.indexOf('\nendstream', afterStream);
    expect(streamEnd - afterStream).toBe(declared);
  });
});

// --- (TC-303-03) mutation witness: code-unit counting mis-locates objects -----

describe('PDF byte-offset guard — mutation witness (TC-303-03)', () => {
  it('a CJK string has strictly more UTF-8 bytes than JS code units', () => {
    // Root divergence the guard exists for. If this ever becomes false
    // (bytes === codeUnits for CJK), the byte-vs-codeunit class closes at
    // the language level and the guard is moot — the test fails loudly.
    const cjk = 'データ入力'; // 5 BMP chars
    const bytes = new TextEncoder().encode(cjk).length;
    expect(bytes).toBeGreaterThan(cjk.length);
    expect(bytes).toBe(15); // 5 chars × 3 UTF-8 bytes
  });

  it('offsets tracked via .length would NOT land on the object headers', async () => {
    // Reconstruct the BUGGY shape from the real accented-Latin PDF. Objects 1/2/3 and
    // 5/6 are ASCII, so ALL byte/codeunit divergence up to object 5 lives in
    // object 4's CJK-laden content stream. A `.length` tracker under-counts
    // that span by (bytes − codeUnits), so the object-5 offset it would
    // report is short by exactly that divergence — landing inside the
    // stream instead of on "5 0 obj". Proves a revert to code-unit counting
    // is caught by the Layer 2 invariant.
    const text = await accentedPdfLatin1();

    const lenMatch = text.match(/\/Length (\d+) >>\nstream\n/);
    expect(lenMatch).not.toBeNull();
    const afterStream = (lenMatch!.index ?? 0) + lenMatch![0].length;
    const streamEnd = text.indexOf('\nendstream', afterStream);
    const streamLatin1 = text.slice(afterStream, streamEnd);

    // latin1 length == byte count; re-decode the bytes as UTF-8 to recover
    // the original JS string (CJK as single code units) for its .length.
    const streamBytes = Buffer.from(streamLatin1, 'latin1');
    const streamCodeUnits = streamBytes.toString('utf8').length;
    const divergence = streamBytes.length - streamCodeUnits;
    expect(divergence).toBeGreaterThan(0);

    // Read the true (byte-correct) object-5 offset from the xref table.
    const xrefIdx = text.indexOf('\nxref\n');
    const table = text.slice(xrefIdx);
    const offsets = [...table.matchAll(/^(\d{10}) 00000 n\s*$/gm)].map((m) =>
      Number(m[1]),
    );
    const trueObj5 = offsets[4]; // 6 objects (1..6); index 4 == object 5
    expect(text.substr(trueObj5, 7)).toBe('5 0 obj');

    // The buggy offset under-counts by the CJK divergence → it does NOT land
    // on "5 0 obj". This is the detectable mutation signature.
    const buggyObj5 = trueObj5 - divergence;
    expect(text.substr(buggyObj5, 7)).not.toBe('5 0 obj');
  });
});
