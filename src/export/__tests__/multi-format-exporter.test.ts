/**
 * Tests for MultiFormatExporter — PDF export with actual diagram content
 */

import { MultiFormatExporter } from '../multi-format-exporter';
import type { SceneGraph } from '@/types/diagram';

/** First byte-index of `needle` within `haystack`, or -1 (naive, byte-exact). */
function indexOfBytes(haystack: Uint8Array, needle: Uint8Array): number {
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let j = 0;
    for (; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) break;
    }
    if (j === needle.length) return i;
  }
  return -1;
}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

const makeScene = (overrides: Partial<SceneGraph> = {}): SceneGraph => ({
  type: 'flow',
  nodes: [
    { id: 'n1', label: 'Start', x: 100, y: 100, width: 120, height: 60 },
    { id: 'n2', label: 'End', x: 400, y: 100, width: 120, height: 60 },
  ],
  edges: [{ from: 'n1', to: 'n2', label: 'next' }],
  layout: {
    nodes: [
      { id: 'n1', label: 'Start', x: 100, y: 100, width: 120, height: 60 },
      { id: 'n2', label: 'End', x: 400, y: 100, width: 120, height: 60 },
    ],
    edges: [{ from: 'n1', to: 'n2', label: 'next', points: [] }],
  },
  startMs: 0,
  durationMs: 5000,
  summary: 'test scene',
  keyphrases: ['test'],
  id: 'test-scene',
  ...overrides,
});

describe('MultiFormatExporter', () => {
  const exporter = new MultiFormatExporter();

  describe('PDF export', () => {
    it('produces a valid PDF blob with diagram content', async () => {
      const scene = makeScene({ id: 'pdf-test' });
      const result = await exporter.export(scene, { format: 'pdf' });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Blob);
      expect(result.mimeType).toBe('application/pdf');
      expect(result.filename).toBe('pdf-test.pdf');
    });

    it('includes drawing commands in the PDF content stream', async () => {
      const scene = makeScene({ id: 'content-check' });
      const result = await exporter.export(scene, { format: 'pdf' });

      const blob = result.data as Blob;
      const text = await blob.text();

      // PDF header
      expect(text).toContain('%PDF-1.4');

      // Content stream must reference the font and contain drawing operators
      expect(text).toContain('/F1');
      expect(text).toContain('re'); // rectangle operator
      expect(text).toContain('BT'); // begin text
      expect(text).toContain('ET'); // end text
    });

    it('embeds node labels in the PDF', async () => {
      const scene = makeScene({ id: 'label-check' });
      const result = await exporter.export(scene, { format: 'pdf' });

      const text = await (result.data as Blob).text();
      expect(text).toContain('(Start)');
      expect(text).toContain('(End)');
    });

    it('embeds edge labels in the PDF', async () => {
      const scene = makeScene({ id: 'edge-label-check' });
      const result = await exporter.export(scene, { format: 'pdf' });

      const text = await (result.data as Blob).text();
      expect(text).toContain('(next)');
    });

    it('uses custom dimensions when provided', async () => {
      const scene = makeScene({ id: 'dim-check' });
      const result = await exporter.export(scene, {
        format: 'pdf',
        width: 800,
        height: 600,
      });

      const text = await (result.data as Blob).text();
      expect(text).toContain('800');
      expect(text).toContain('600');
      expect(result.metadata?.dimensions).toEqual({ width: 800, height: 600 });
    });

    it('applies background color from options', async () => {
      const scene = makeScene({ id: 'bg-check' });
      const result = await exporter.export(scene, {
        format: 'pdf',
        backgroundColor: '#000000',
      });

      const text = await (result.data as Blob).text();
      // Black background: 0.000 0.000 0.000 rg
      expect(text).toContain('0.000');
    });

    it('escapes special characters in labels', async () => {
      const scene = makeScene({
        id: 'escape-check',
        nodes: [
          { id: 'n1', label: 'Hello (World)', x: 100, y: 100 },
        ],
        edges: [],
        layout: {
          nodes: [
            { id: 'n1', label: 'Hello (World)', x: 100, y: 100 },
          ],
          edges: [],
        },
      });
      const result = await exporter.export(scene, { format: 'pdf' });

      const text = await (result.data as Blob).text();
      // Parentheses must be escaped in PDF string literals
      expect(text).toContain('(Hello \\(World\\))');
    });

    it('declares byte-accurate /Length and xref offsets for CJK labels', async () => {
      // Non-ASCII labels are 1 UTF-16 code unit but 3 UTF-8 bytes each. Offsets
      // previously used JS `.length` (code units) while `new Blob([pdf])` emits
      // UTF-8, so any CJK content corrupted /Length and every xref offset after
      // the content stream — the common case in this Japanese-first pipeline.
      const cjkNodes = [
        { id: 'n1', label: '処理', x: 100, y: 100, width: 120, height: 60 },
        { id: 'n2', label: '入力', x: 400, y: 100, width: 120, height: 60 },
      ];
      const scene = makeScene({
        id: 'cjk-pdf',
        nodes: cjkNodes,
        edges: [{ from: 'n1', to: 'n2', label: '次へ' }],
        layout: {
          nodes: cjkNodes,
          edges: [{ from: 'n1', to: 'n2', label: '次へ', points: [] }],
        },
      });
      const result = await exporter.export(scene, { format: 'pdf' });
      expect(result.success).toBe(true);
      const bytes = new Uint8Array(await (result.data as Blob).arrayBuffer());
      const text = new TextDecoder().decode(bytes);

      // /Length must equal the BYTE span between "stream\n" and "\nendstream".
      const declaredLength = Number(text.match(/\/Length (\d+)/)![1]);
      const streamMark = new TextEncoder().encode('stream\n');
      const endstreamMark = new TextEncoder().encode('\nendstream');
      const streamStart = indexOfBytes(bytes, streamMark) + streamMark.length;
      const endstreamStart = indexOfBytes(bytes, endstreamMark);
      expect(endstreamStart - streamStart).toBe(declaredLength);

      // Every xref-declared object offset must point (in BYTES) at "<n> 0 obj".
      // 8 objects: 1 Catalog, 2 Pages, 3 Page, 4 content stream, 5/6 Helvetica
      // fonts, plus 7/8 — the CJK Type0 composite font + its CIDFont descendant,
      // declared because this scene's labels need them (see assertions below).
      const xrefOffsets = [...text.matchAll(/^(\d{10}) 00000 n\b/gm)].map((m) => Number(m[1]));
      expect(xrefOffsets).toHaveLength(8);
      const decodeAt = (off: number, len: number) =>
        new TextDecoder().decode(bytes.subarray(off, off + len));
      xrefOffsets.forEach((off, i) => {
        expect(decodeAt(off, 7).startsWith(`${i + 1} 0 obj`)).toBe(true);
      });

      // startxref must point (in BYTES) at the "xref" table.
      const startxref = Number(text.match(/startxref\n(\d+)/)![1]);
      expect(decodeAt(startxref, 4)).toBe('xref');
    });

    it('routes CJK labels to a CJK-capable Type0 font as displayable UTF-16BE glyphs', async () => {
      // The byte-offset fix made CJK PDFs structurally valid, but the labels
      // still could not RENDER: the content stream used Helvetica + WinAnsi
      // (Latin-1 only), so 処理/入力/次へ had no resolvable glyph. The fix routes
      // >U+00FF labels to a non-embedded Adobe-Japan1 Type0 composite font
      // (/F3) and emits them as UTF-16BE hex strings its UniJIS-UCS2-H CMap
      // maps to CIDs. This asserts that resolution, not just file structure.
      const cjkNodes = [
        { id: 'n1', label: '処理', x: 100, y: 100, width: 120, height: 60 },
        { id: 'n2', label: '入力', x: 400, y: 100, width: 120, height: 60 },
      ];
      const scene = makeScene({
        id: 'cjk-glyph',
        nodes: cjkNodes,
        edges: [{ from: 'n1', to: 'n2', label: '次へ' }],
        layout: {
          nodes: cjkNodes,
          edges: [{ from: 'n1', to: 'n2', label: '次へ', points: [] }],
        },
      });
      const result = await exporter.export(scene, { format: 'pdf' });
      expect(result.success).toBe(true);
      const text = await (result.data as Blob).text();

      // A Type0 composite font is declared and referenced from the Page.
      expect(text).toContain('/Subtype /Type0');
      expect(text).toContain('/BaseFont /HeiseiKakuGo-W5');
      expect(text).toContain('/Encoding /UniJIS-UCS2-H');
      expect(text).toContain('/Subtype /CIDFontType0');
      expect(text).toContain('/Ordering (Japan1)');
      expect(text).toContain('/F3 7 0 R');

      // CJK labels are encoded as UTF-16BE hex (the form UniJIS-UCS2-H shows),
      // proving they resolve to glyphs the font CAN render.
      //   処理 = U+51E6 U+7406 | 入力 = U+5165 U+529B | 次へ = U+6B21 U+3078
      expect(text).toContain('<51E67406>');
      expect(text).toContain('<5165529B>');
      expect(text).toContain('<6B213078>');

      // The CJK node labels select the Type0 font (/F3), not Helvetica (/F2).
      expect(text).toContain('/F3 14 Tf');
      // The CJK edge label selects /F3 too; Latin-only scenes use /F1 12 Tf.
      expect(text).toContain('/F3 12 Tf');

      // Negative — the CJK labels are NOT emitted as WinAnsi literal strings
      // under Helvetica (which provably cannot represent them). If a future
      // change reverted CJK to raw literals, these would reappear as `(処理)`.
      expect(text).not.toContain('(処理)');
      expect(text).not.toContain('(次へ)');
    });

    it('keeps a Latin-only PDF on Helvetica (no CJK font objects)', async () => {
      // A scene with only ASCII/Latin-1 labels must not declare the Type0 font
      // — it stays on the 6-object Helvetica layout (byte-identical to before).
      const scene = makeScene({ id: 'latin-only' }); // Start/End nodes, 'next' edge
      const result = await exporter.export(scene, { format: 'pdf' });
      expect(result.success).toBe(true);
      const text = await (result.data as Blob).text();

      expect(text).not.toContain('/Subtype /Type0');
      expect(text).not.toContain('/F3');
      // 6 xref entries (no CJK font objects 7/8).
      const xrefOffsets = [...text.matchAll(/^(\d{10}) 00000 n\b/gm)].map((m) => Number(m[1]));
      expect(xrefOffsets).toHaveLength(6);
    });
  });

  describe('SVG export', () => {
    it('generates valid SVG with nodes and edges', async () => {
      const scene = makeScene({ id: 'svg-test' });
      const result = await exporter.export(scene, { format: 'svg' });

      expect(result.success).toBe(true);
      expect(result.mimeType).toBe('image/svg+xml');

      const svg = await (result.data as Blob).text();
      expect(svg).toContain('<svg');
      expect(svg).toContain('Start');
      expect(svg).toContain('End');
      expect(svg).toContain('next');
    });

    it('renders node rect at top-left position (not center-offset)', async () => {
      const scene = makeScene({
        id: 'rect-pos-test',
        layout: {
          nodes: [
            { id: 'n1', label: 'A', x: 200, y: 150, w: 120, h: 60 },
          ],
          edges: [],
        },
      });
      const result = await exporter.export(scene, { format: 'svg' });
      const svg = await (result.data as Blob).text();

      // rect x should be 200 (top-left), NOT 200 - 120/2 = 140
      expect(svg).toContain('x="200"');
      expect(svg).toContain('y="150"');
      // rect should NOT be at center-offset position
      expect(svg).not.toContain('x="140"');
    });

    it('uses w/h properties when width/height are absent (regression)', async () => {
      const scene = makeScene({
        id: 'wh-test',
        layout: {
          nodes: [
            { id: 'n1', label: 'Node W', x: 50, y: 50, w: 100, h: 40 },
            { id: 'n2', label: 'Node H', x: 300, y: 50, w: 100, h: 40 },
          ],
          edges: [{ from: 'n1', to: 'n2', points: [] }],
        },
      });
      const result = await exporter.export(scene, { format: 'svg' });
      expect(result.success).toBe(true);

      const svg = await (result.data as Blob).text();
      // Nodes should render with w=100, h=40 (not fallback 120/60)
      expect(svg).toContain('width="100"');
      expect(svg).toContain('height="40"');
    });

    it('draws edges between node centers (not top-left corners)', async () => {
      const scene = makeScene({
        id: 'edge-center-test',
        layout: {
          nodes: [
            { id: 'n1', label: 'A', x: 0, y: 0, w: 100, h: 40 },
            { id: 'n2', label: 'B', x: 200, y: 0, w: 100, h: 40 },
          ],
          edges: [{ from: 'n1', to: 'n2', points: [] }],
        },
      });
      const result = await exporter.export(scene, { format: 'svg' });
      const svg = await (result.data as Blob).text();

      // Edge should go from (50, 20) to (250, 20) — centers of the nodes
      expect(svg).toContain('x1="50"');
      expect(svg).toContain('y1="20"');
      expect(svg).toContain('x2="250"');
      expect(svg).toContain('y2="20"');
    });
  });

  describe('cross-format WYSIWYG parity', () => {
    // Guards the "a field rendered on screen is dropped/distorted by a
    // download format" class. The on-screen NodeAnimation positions each
    // node by its top-LEFT corner (left: node.x, top: node.y); every export
    // format must agree on that convention, and every node/edge label that
    // the producer emits must reach each downloadable format.

    it('renders the node rect at the same top-left position in SVG and PDF', async () => {
      // node.x=200, w=120 → corner convention puts the rect at x=200;
      // a center convention would put it at 200 - 120/2 = 140.
      const scene = makeScene({
        id: 'parity-pos',
        layout: {
          nodes: [{ id: 'n1', label: 'Solo', x: 200, y: 150, w: 120, h: 60 }],
          edges: [],
        },
      });

      const svg = await (await exporter.export(scene, { format: 'svg' })).data as Blob;
      const svgText = await svg.text();
      expect(svgText).toContain('x="200"');
      expect(svgText).toContain('y="150"');
      expect(svgText).not.toContain('x="140"');

      const pdfText = await (await exporter.export(scene, { format: 'pdf' })).data as Blob;
      const pdf = await pdfText.text();
      // Rounded-rect path (the sharp `re B` node body was replaced by a cubic-Bézier
      // path). The path starts on the bottom edge at rx+radius = 200+8 = 208 (corner
      // convention); a center convention would start at 140+8 = 148. The node's w×h
      // (120 60) no longer appears in any `re` operator — only the full-page
      // background `0 0 1920 1080 re f` does.
      expect(pdf).toMatch(/208 [\d.]+ m/);
      expect(pdf).not.toMatch(/148 [\d.]+ m/);
      expect(pdf).not.toMatch(/120 60 re/);
      // Four cubic-Bézier `c` corner operators are emitted (rounded corners).
      expect((pdf.match(/ c/g) || []).length).toBeGreaterThanOrEqual(4);
    });

    it('draws edges between node centers in both SVG and PDF', async () => {
      // n1{x:0,w:100} center=50, n2{x:200,w:100} center=250.
      const scene = makeScene({
        id: 'parity-edge',
        layout: {
          nodes: [
            { id: 'n1', label: 'A', x: 0, y: 0, w: 100, h: 40 },
            { id: 'n2', label: 'B', x: 200, y: 0, w: 100, h: 40 },
          ],
          edges: [{ from: 'n1', to: 'n2', label: 'next', points: [] }],
        },
      });

      const svgText = await (await (await exporter.export(scene, { format: 'svg' })).data as Blob).text();
      expect(svgText).toContain('x1="50"');
      expect(svgText).toContain('x2="250"');

      const pdf = await (await (await exporter.export(scene, { format: 'pdf' })).data as Blob).text();
      // Edge path "<fx> <y> m <tx> <y> l S" connects centers (50, 250),
      // not the raw corners (0, 200) the previous center-convention used.
      expect(pdf).toMatch(/50 \d+ m 250 \d+ l S/);
      expect(pdf).not.toMatch(/0 \d+ m 200 \d+ l S/);
    });

    it('every node and edge label reaches SVG, PDF, and JSON (no field dropped)', async () => {
      const scene = makeScene({ id: 'parity-labels' });
      // makeScene ships nodes Start/End and a 'next' edge — assert each
      // producer-rendered label is present in every download format.
      const svg = await (await exporter.export(scene, { format: 'svg' })).data as Blob;
      const pdf = await (await exporter.export(scene, { format: 'pdf' })).data as Blob;
      const json = await (await exporter.export(scene, { format: 'json' })).data as Blob;

      const svgText = await svg.text();
      const pdfText = await pdf.text();
      const jsonText = await json.text();

      for (const label of ['Start', 'End', 'next']) {
        expect(svgText).toContain(label);
        expect(pdfText).toContain(label);
      }
      // JSON is structurally complete — labels are reachable via the nodes/edges arrays.
      const parsed = JSON.parse(jsonText);
      const nodeLabels = parsed.layout.nodes.map((n: { label: string }) => n.label);
      const edgeLabels = parsed.layout.edges.map((e: { label?: string }) => e.label);
      expect(nodeLabels).toEqual(expect.arrayContaining(['Start', 'End']));
      expect(edgeLabels).toEqual(expect.arrayContaining(['next']));
    });

    it('horizontally centers node and edge labels in PDF (text-anchor parity)', async () => {
      // SVG/Canvas center labels via text-anchor / textAlign middle. PDF writes
      // the content stream by hand, so it must offset the `Td` text origin LEFT
      // by half the label width rather than anchoring the left edge at the
      // geometric center (which shifts every label half a width to the right).
      const scene = makeScene({
        id: 'parity-label-center',
        layout: {
          nodes: [
            { id: 'n1', label: 'Start Node', x: 300, y: 100, w: 160, h: 60 },
            { id: 'n2', label: 'End Node', x: 300, y: 300, w: 160, h: 60 },
          ],
          edges: [{ from: 'n1', to: 'n2', label: 'flows to', points: [] }],
        },
      });

      const pdf = await (await exporter.export(scene, { format: 'pdf' })).data as Blob;
      const pdfText = await pdf.text();

      // Every node center x = 300 + 160/2 = 380; the edge midpoint x is also 380.
      // A centered label's origin sits strictly LEFT of 380 (offset by half its
      // width). A left-anchored-at-center label would be exactly 380.
      const centerX = 380;
      const tdXs = [...pdfText.matchAll(/([\d.]+) [\d.]+ Td/g)].map((m) => parseFloat(m[1]));
      expect(tdXs.length).toBe(3); // 2 node labels + 1 edge label
      for (const x of tdXs) {
        expect(x).toBeLessThan(centerX);
        // Sanity: the offset is at most ~half a label width, not absurdly far.
        expect(x).toBeGreaterThan(centerX - 120);
      }
    });
  });

  describe('PDF node WYSIWYG parity — rounded corners / bold font / vertical baseline', () => {
    // The SVG/Canvas parity pass (08ae) left the PDF path using a sharp `re`
    // rectangle, the non-bold `/F1` font, and a node-label `Td` whose origin sat
    // exactly on the node center (glyphs extend UP from the baseline, so labels
    // appeared ~0.35em too high). These guard the raw-PDF-op rewrite that brings
    // PDF to the same WYSIWYG contract as the on-screen DiagramScene render,
    // SVG and Canvas.

    it('draws node bodies with rounded corners (radius 8), not sharp rectangles', async () => {
      const scene = makeScene({
        id: 'pdf-rounded',
        layout: {
          nodes: [{ id: 'n1', label: 'Box', x: 100, y: 100, w: 120, h: 60 }],
          edges: [],
        },
      });
      const pdf = await (await exporter.export(scene, { format: 'pdf' })).data as Blob;
      const text = await pdf.text();

      // No sharp `re` paints the node body — the only `re` left is the full-page
      // background. The node's 120×60 must not appear in a `re` operator.
      expect(text).not.toMatch(/120 60 re/);
      // Four cubic-Bézier corner operators (one per rounded corner).
      expect((text.match(/ c/g) || []).length).toBe(4);
      // The path begins on the bottom edge at x+radius = 100+8 = 108 (the
      // bottom-left corner's arc start), confirming a radius-8 rounded rect.
      expect(text).toMatch(/108 [\d.]+ m/);
    });

    it('renders node labels in bold (/F2 Helvetica-Bold) while edge labels stay regular (/F1)', async () => {
      const scene = makeScene({ id: 'pdf-bold' }); // 2 nodes (Start/End) + 1 edge ('next')
      const pdf = await (await exporter.export(scene, { format: 'pdf' })).data as Blob;
      const text = await pdf.text();

      // A second font resource — Helvetica-Bold — is registered as /F2.
      expect(text).toContain('/F2 6 0 R');
      expect(text).toContain('/BaseFont /Helvetica-Bold');
      // Node labels select the bold /F2 (matching on-screen fontWeight 'bold' /
      // SVG font-weight="bold" / Canvas `bold 14px`); edge labels keep regular /F1
      // (SVG/Canvas edge text is non-bold).
      expect(text).toContain('/F2 14 Tf');
      expect(text).toContain('/F1 12 Tf');
      // Regression: node labels no longer use the non-bold /F1 at 14pt.
      expect(text).not.toContain('/F1 14 Tf');
    });

    it('drops the node label origin below the node center so glyphs sit vertically centered', async () => {
      // Single node, no edges → exactly one `Td` in the stream (the node label),
      // so the parsed Y is unambiguous. Page height defaults to 1080; node at
      // y=100, h=60 → vertical center (screen) = 130 → PDF center Y = 1080-130 = 950.
      const scene = makeScene({
        id: 'pdf-baseline',
        layout: {
          nodes: [{ id: 'n1', label: 'Node', x: 0, y: 100, width: 120, height: 60 }],
          edges: [],
        },
      });
      const pdf = await (await exporter.export(scene, { format: 'pdf' })).data as Blob;
      const text = await pdf.text();

      const centerY = 1080 - (100 + 60 / 2); // 950
      const tdYs = [...text.matchAll(/[\d.]+ ([\d.]+) Td/g)].map((m) => parseFloat(m[1]));
      expect(tdYs.length).toBe(1);
      // Pre-fix the origin sat exactly AT center (950); now it drops ~0.35em
      // (≈4.9pt at 14pt) below center so the glyph bodies center on the node —
      // matching SVG `dominant-baseline="middle"` / Canvas `textBaseline="middle"`.
      expect(tdYs[0]).toBeLessThan(centerY);
      expect(tdYs[0]).toBeCloseTo(centerY - 14 * 0.35, 0);
    });
  });

  describe('JSON export', () => {
    it('exports scene data as JSON', async () => {
      const scene = makeScene({ id: 'json-test', content: 'test content' });
      const result = await exporter.export(scene, { format: 'json' });

      expect(result.success).toBe(true);
      expect(result.mimeType).toBe('application/json');

      const json = JSON.parse(await (result.data as Blob).text());
      expect(json.id).toBe('json-test');
      expect(json.type).toBe('flow');
    });
  });

  describe('error handling', () => {
    it('returns error for unsupported format', async () => {
      const scene = makeScene();
      const result = await exporter.export(scene, {
        format: 'bmp' as 'svg',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported export format');
    });
  });

  describe('pdfColorFill NaN guard', () => {
    it('does not produce NaN for malformed short hex color', async () => {
      const scene = makeScene({ id: 'nan-short' });
      const result = await exporter.export(scene, {
        format: 'pdf',
        backgroundColor: '#ff',
      });

      const text = await (result.data as Blob).text();
      expect(text).not.toContain('NaN');
    });

    it('does not produce NaN for empty hex color', async () => {
      const scene = makeScene({ id: 'nan-empty' });
      const result = await exporter.export(scene, {
        format: 'pdf',
        backgroundColor: '',
      });

      const text = await (result.data as Blob).text();
      expect(text).not.toContain('NaN');
    });

    it('does not produce NaN for non-hex characters', async () => {
      const scene = makeScene({ id: 'nan-invalid' });
      const result = await exporter.export(scene, {
        format: 'pdf',
        backgroundColor: 'not-a-color',
      });

      const text = await (result.data as Blob).text();
      expect(text).not.toContain('NaN');
    });

    it('produces correct values for valid hex color', async () => {
      const scene = makeScene({ id: 'valid-hex' });
      const result = await exporter.export(scene, {
        format: 'pdf',
        backgroundColor: '#ff0000',
      });

      const text = await (result.data as Blob).text();
      // Red: 255/255 = 1.000
      expect(text).toContain('1.000');
      // Should NOT contain NaN
      expect(text).not.toContain('NaN');
    });
  });

  describe('PNG export quality pass-through', () => {
    // jsdom has no real 2D canvas context, so stub createCanvas (permissive
    // no-op ctx via Proxy) and spy on canvasToBlob to observe the quality arg
    // that exportPNG forwards to the encoder.
    const makeStubbedExporter = () => {
      const exp = new MultiFormatExporter();
      const ctxStub = new Proxy(
        {},
        { get: () => () => {}, set: () => true },
      ) as unknown as CanvasRenderingContext2D;
      const canvasStub = { getContext: () => ctxStub } as unknown as HTMLCanvasElement;
      jest.spyOn(exp as unknown as { createCanvas: () => HTMLCanvasElement }, 'createCanvas').mockReturnValue(canvasStub);
      const blobSpy = jest
        .spyOn(exp as unknown as { canvasToBlob: (c: HTMLCanvasElement, t: string, q: number) => Promise<Blob> }, 'canvasToBlob')
        .mockResolvedValue(new Blob([], { type: 'image/png' }));
      return { exp, canvasStub, blobSpy };
    };

    it('forwards an explicit quality of 0 to the encoder (regression: || collapsed 0 to 0.95)', async () => {
      const { exp, canvasStub, blobSpy } = makeStubbedExporter();
      await exp.export(makeScene({ id: 'png-q0' }), { format: 'png', quality: 0 });
      // quality arg (3rd positional) must be exactly 0, not the 0.95 default.
      expect(blobSpy).toHaveBeenCalledWith(canvasStub, 'image/png', 0);
    });

    it('uses the 0.95 default when quality is omitted', async () => {
      const { exp, canvasStub, blobSpy } = makeStubbedExporter();
      await exp.export(makeScene({ id: 'png-q-default' }), { format: 'png' });
      expect(blobSpy).toHaveBeenCalledWith(canvasStub, 'image/png', 0.95);
    });

    it('forwards an explicit mid-range quality unchanged', async () => {
      const { exp, canvasStub, blobSpy } = makeStubbedExporter();
      await exp.export(makeScene({ id: 'png-q-mid' }), { format: 'png', quality: 0.5 });
      expect(blobSpy).toHaveBeenCalledWith(canvasStub, 'image/png', 0.5);
    });
  });

  describe('node fill color — WYSIWYG parity with on-screen render', () => {
    // The on-screen DiagramScene renders nodes with #3b82f6 (the canonical
    // diagram blue, also used by Video.tsx / DiagramVideo / advanced-layouts).
    // Downloads must use the same fill — not a different blue — so the exported
    // file matches what the user sees in the rendered video.
    const ON_SCREEN_NODE_FILL = '#3b82f6';

    it('SVG node fill matches the on-screen canonical color', async () => {
      const scene = makeScene({ id: 'svg-color-parity' });
      const result = await exporter.export(scene, { format: 'svg' });
      const svg = await (result.data as Blob).text();
      expect(svg).toContain(`fill="${ON_SCREEN_NODE_FILL}"`);
      expect(svg).not.toContain('#4A90E2'); // previous divergent color
    });

    it('PDF node fill matches the on-screen canonical color', async () => {
      const scene = makeScene({ id: 'pdf-color-parity' });
      const result = await exporter.export(scene, { format: 'pdf' });
      const pdf = await (result.data as Blob).text();
      // #3b82f6 = rgb(59,130,246) ≈ 0.23 0.51 0.96 in normalized PDF RGB
      expect(pdf).toContain('0.23 0.51 0.96 rg');
      expect(pdf).not.toContain('0.29 0.56 0.89 rg'); // previous divergent color
    });
  });

  describe('node geometry & typography — WYSIWYG parity with on-screen render', () => {
    // The on-screen DiagramScene (src/remotion/DiagramScene.tsx) renders nodes
    // with `borderRadius: 8`, `fontWeight: 'bold'`, and `fontFamily: 'sans-serif'`.
    // The export previously diverged: corner radius 5 (SVG/Canvas), node labels
    // in regular weight, and SVG text with no font-family (defaults to a serif in
    // many viewers). Downloads must match the rendered video, not a stale variant.
    // (Edge/label COLORS stay #666 — a deliberate adaptation to the default white
    // export background, where the render's translucent-white strokes would be
    // invisible. Color is parity-checked separately above for the node FILL.)

    it('SVG node corner radius matches the on-screen borderRadius (8, not 5)', async () => {
      const scene = makeScene({ id: 'svg-radius-parity' });
      const svg = await (await exporter.export(scene, { format: 'svg' })).data.text();
      expect(svg).toContain('rx="8"');
      expect(svg).not.toContain('rx="5"');
    });

    it('SVG node label is bold sans-serif, matching the on-screen typography', async () => {
      const scene = makeScene({ id: 'svg-typography-parity' });
      const svg = await (await exporter.export(scene, { format: 'svg' })).data.text();
      expect(svg).toContain('font-weight="bold"');
      expect(svg).toContain('font-family="sans-serif"');
    });

    it('Canvas node corner radius is 8 and the label font is bold, matching the render', async () => {
      // jsdom has no real 2D context; record roundRect args and every font
      // assignment so the Canvas path's radius and weight are verifiable.
      const exp = new MultiFormatExporter();
      const roundRectCalls: number[][] = [];
      const fonts: string[] = [];
      const ctxStub = new Proxy(
        {},
        {
          get: (_t, prop) => {
            if (prop === 'roundRect') return (...args: number[]) => roundRectCalls.push(args);
            return () => {};
          },
          set: (_t, prop, value) => {
            if (prop === 'font') fonts.push(value);
            return true;
          },
        },
      ) as unknown as CanvasRenderingContext2D;
      const canvasStub = { getContext: () => ctxStub } as unknown as HTMLCanvasElement;
      jest
        .spyOn(exp as unknown as { createCanvas: () => HTMLCanvasElement }, 'createCanvas')
        .mockReturnValue(canvasStub);
      jest
        .spyOn(exp as unknown as { canvasToBlob: (c: HTMLCanvasElement, t: string, q: number) => Promise<Blob> }, 'canvasToBlob')
        .mockResolvedValue(new Blob([], { type: 'image/png' }));

      await exp.export(makeScene({ id: 'canvas-radius-parity' }), { format: 'png' });

      // Every node rect is drawn with the 5th roundRect arg (radius) === 8.
      expect(roundRectCalls.length).toBeGreaterThan(0);
      expect(roundRectCalls.every((args) => args[4] === 8)).toBe(true);
      // The node-label font is the bold form; the previous regular-weight form
      // must not appear as an EXACT font string (substring match would be fooled
      // by 'bold 14px Arial', so compare the whole string).
      expect(fonts).toContain('bold 14px Arial');
      expect(fonts.filter((f) => f === '14px Arial')).toEqual([]);
    });
  });
});
