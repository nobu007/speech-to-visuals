/**
 * REQ-168: multi-format-exporter.ts Test Coverage
 *
 * Unit tests for MultiFormatExporter's core functionality:
 *   - SVG/PNG/PDF/JSON format conversion
 *   - Metadata attachment
 *   - Validation and error handling
 *   - SVG generation with nodes and edges
 *   - PDF generation with Y-axis flip
 *   - Batch export
 *   - XML/PDF string escaping
 */

import { jest } from '@jest/globals';
import { MultiFormatExporter } from '@/export/multi-format-exporter';
import type { ExportOptions, ExportFormat, ExportResult as MFExportResult } from '@/export/multi-format-exporter';
import type { SceneGraph, NodeDatum, LayoutEdge, EdgeDatum } from '@stv/core/types/diagram';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScene(overrides: Partial<SceneGraph> = {}): SceneGraph {
  return {
    id: 'test-scene-001',
    type: 'flow',
    nodes: [
      { id: 'n1', label: 'Start', x: 100, y: 100, width: 120, height: 60 } as NodeDatum & { x: number; y: number; width: number; height: number },
      { id: 'n2', label: 'End', x: 400, y: 100, width: 120, height: 60 } as NodeDatum & { x: number; y: number; width: number; height: number },
    ],
    edges: [
      { from: 'n1', to: 'n2', label: 'next', points: [] } as EdgeDatum,
    ],
    startMs: 0,
    durationMs: 5000,
    summary: 'Test scene summary',
    keyphrases: ['test', 'scene'],
    layout: {
      nodes: [
        { id: 'n1', label: 'Start', x: 100, y: 100, width: 120, height: 60 } as NodeDatum & { x: number; y: number; width: number; height: number },
        { id: 'n2', label: 'End', x: 400, y: 100, width: 120, height: 60 } as NodeDatum & { x: number; y: number; width: number; height: number },
      ],
      edges: [
        { from: 'n1', to: 'n2', label: 'next', points: [] } as LayoutEdge,
      ],
    },
    ...overrides,
  };
}

function makeOptions(overrides: Partial<ExportOptions> = {}): ExportOptions {
  return {
    format: 'svg',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('REQ-168: MultiFormatExporter', () => {
  let exporter: MultiFormatExporter;

  beforeEach(() => {
    exporter = new MultiFormatExporter();
  });

  // ─── TC-168-01: SVG export ────────────────────────────────────────────

  describe('TC-168-01: SVG export', () => {
    it('exports scene to SVG format', async () => {
      const result = await exporter.export(makeScene(), makeOptions({ format: 'svg' }));

      expect(result.success).toBe(true);
      expect(result.mimeType).toBe('image/svg+xml');
      expect(result.filename).toContain('.svg');
    });

    it('generates valid SVG with nodes and edges', async () => {
      const result = await exporter.export(makeScene(), makeOptions({ format: 'svg' }));

      expect(result.success).toBe(true);
      const svgText = await (result.data as Blob).text();
      expect(svgText).toContain('<?xml');
      expect(svgText).toContain('<svg');
      expect(svgText).toContain('n1');
      expect(svgText).toContain('n2');
    });

    it('uses custom dimensions for SVG', async () => {
      const result = await exporter.export(
        makeScene(),
        makeOptions({ format: 'svg', width: 800, height: 600 }),
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.dimensions).toEqual({ width: 800, height: 600 });
      const svgText = await (result.data as Blob).text();
      expect(svgText).toContain('width="800"');
      expect(svgText).toContain('height="600"');
    });

    it('uses default dimensions when not specified', async () => {
      const result = await exporter.export(
        makeScene(),
        makeOptions({ format: 'svg' }),
      );

      expect(result.metadata?.dimensions).toEqual({ width: 1920, height: 1080 });
    });

    it('uses custom background color', async () => {
      const result = await exporter.export(
        makeScene(),
        makeOptions({ format: 'svg', backgroundColor: '#000000' }),
      );

      expect(result.success).toBe(true);
      const svgText = await (result.data as Blob).text();
      expect(svgText).toContain('#000000');
    });

    it('escapes XML special characters in node labels', async () => {
      const scene = makeScene({
        layout: {
          nodes: [
            { id: 'n1', label: 'A & B < C > D', x: 100, y: 100, width: 120, height: 60 },
          ],
          edges: [],
        },
      });

      const result = await exporter.export(scene, makeOptions({ format: 'svg' }));
      expect(result.success).toBe(true);
      const svgText = await (result.data as Blob).text();
      expect(svgText).toContain('&amp;');
      expect(svgText).toContain('&lt;');
      expect(svgText).toContain('&gt;');
    });

    it('includes edge labels in SVG', async () => {
      const result = await exporter.export(makeScene(), makeOptions({ format: 'svg' }));

      const svgText = await (result.data as Blob).text();
      expect(svgText).toContain('next');
    });

    it('skips edges with missing nodes', async () => {
      const scene = makeScene({
        layout: {
          nodes: [
            { id: 'n1', label: 'A', x: 100, y: 100, width: 120, height: 60 },
          ],
          edges: [
            { from: 'n1', to: 'nonexistent', label: 'broken', points: [] },
          ],
        },
      });

      const result = await exporter.export(scene, makeOptions({ format: 'svg' }));
      expect(result.success).toBe(true);
    });
  });

  // ─── TC-168-02: JSON export ───────────────────────────────────────────

  describe('TC-168-02: JSON export', () => {
    it('exports scene to JSON format', async () => {
      const result = await exporter.export(makeScene(), makeOptions({ format: 'json' }));

      expect(result.success).toBe(true);
      expect(result.mimeType).toBe('application/json');
      expect(result.filename).toContain('.json');
    });

    it('includes all scene fields in JSON', async () => {
      const result = await exporter.export(makeScene(), makeOptions({ format: 'json' }));

      const json = JSON.parse(await (result.data as Blob).text());
      expect(json.id).toBe('test-scene-001');
      expect(json.type).toBe('flow');
      expect(json.nodes).toBeDefined();
      expect(json.edges).toBeDefined();
      expect(json.startMs).toBe(0);
      expect(json.durationMs).toBe(5000);
      expect(json.summary).toBe('Test scene summary');
      expect(json.keyphrases).toEqual(['test', 'scene']);
    });

    it('excludes metadata when includeMetadata is false', async () => {
      const result = await exporter.export(
        makeScene(),
        makeOptions({ format: 'json', includeMetadata: false }),
      );

      const json = JSON.parse(await (result.data as Blob).text());
      expect(json.metadata).toBeUndefined();
    });

    it('includes metadata when includeMetadata is true', async () => {
      const result = await exporter.export(
        makeScene(),
        makeOptions({ format: 'json', includeMetadata: true }),
      );

      const json = JSON.parse(await (result.data as Blob).text());
      expect(json.metadata).toBeDefined();
      expect(json.metadata.exportFormat).toBe('json');
      expect(json.metadata.generatedAt).toBeDefined();
    });
  });

  // ─── TC-168-03: PDF export ────────────────────────────────────────────

  describe('TC-168-03: PDF export', () => {
    it('exports scene to PDF format', async () => {
      const result = await exporter.export(makeScene(), makeOptions({ format: 'pdf' }));

      expect(result.success).toBe(true);
      expect(result.mimeType).toBe('application/pdf');
      expect(result.filename).toContain('.pdf');
    });

    it('generates valid PDF structure', async () => {
      const result = await exporter.export(makeScene(), makeOptions({ format: 'pdf' }));

      expect(result.success).toBe(true);
      const pdfBuffer = await (result.data as Blob).arrayBuffer();
      const pdfText = new TextDecoder().decode(pdfBuffer);
      expect(pdfText).toContain('%PDF');
      expect(pdfText).toContain('%%EOF');
    });

    it('escapes parentheses in PDF strings', async () => {
      const scene = makeScene({
        layout: {
          nodes: [
            { id: 'n1', label: 'Test (A) & B', x: 100, y: 100, width: 120, height: 60 },
          ],
          edges: [],
        },
      });

      const result = await exporter.export(scene, makeOptions({ format: 'pdf' }));
      expect(result.success).toBe(true);
    });

    it('expands 3-digit hex background shorthand exactly like SVG/Canvas (#fff → white)', async () => {
      // WYSIWYG parity: the SAME options.backgroundColor flows into SVG
      // `fill="${bgColor}"`, Canvas `ctx.fillStyle`, and the hand-rolled PDF
      // content stream. Browsers expand the CSS 3-digit shorthand (#RGB →
      // #RRGGBB by digit doubling), so `#fff` renders white in SVG/PNG — but
      // the PDF parser used to slice `fff` as (ff, f, '') → (255, 15, NaN→1),
      // filling MAGENTA (and `#000` → blue). The content stream is embedded
      // uncompressed, so the fill operator is visible in the decoded bytes.
      const decode = async (r: MFExportResult) =>
        new TextDecoder().decode(await (r.data as Blob).arrayBuffer());

      // Control: the default 6-digit #ffffff already fills white (proves the
      // leg reads the background fill, not an arbitrary `rg` elsewhere).
      const control = await decode(await exporter.export(makeScene(), makeOptions({ format: 'pdf' })));
      expect(control).toContain('1.000 1.000 1.000 rg');

      const white = await exporter.export(makeScene(), makeOptions({ format: 'pdf', backgroundColor: '#fff' }));
      expect(white.success).toBe(true);
      expect(await decode(white)).toContain('1.000 1.000 1.000 rg');

      const black = await exporter.export(makeScene(), makeOptions({ format: 'pdf', backgroundColor: '#000' }));
      expect(black.success).toBe(true);
      expect(await decode(black)).toContain('0.000 0.000 0.000 rg');
    });

    it('expands the shorthand per-channel: asymmetric #3C8 pins doubling, channel order, and hex case', async () => {
      // #fff/#000 above are channel-symmetric — an r/g/b channel swap or a
      // pad-with-zero mis-expansion still fills white/black and would pass.
      // #3C8 (uppercase: CSS hex is case-insensitive) pins every channel
      // independently: digit doubling → 33 CC 88 → 0.200/0.800/0.533, a triple
      // no node/text fill in the stream produces. The SAME raw string flows
      // into SVG `fill="#3C8"` (browser expands) and Canvas `fillStyle`, so the
      // PDF triple above is the WYSIWYG parity anchor for all three formats.
      const svg = await exporter.export(makeScene(), makeOptions({ format: 'svg', backgroundColor: '#3C8' }));
      expect(svg.success).toBe(true);
      expect(await (svg.data as Blob).text()).toContain('fill="#3C8"');

      const pdf = await exporter.export(makeScene(), makeOptions({ format: 'pdf', backgroundColor: '#3C8' }));
      expect(pdf.success).toBe(true);
      const pdfText = new TextDecoder().decode(await (pdf.data as Blob).arrayBuffer());
      expect(pdfText).toContain('0.200 0.800 0.533 rg');

      // Canvas leg — completes the three-way parity inside ONE test. The SAME
      // raw string must reach ctx.fillStyle untouched: the browser expands the
      // shorthand itself, so pre-expanding (or letting a default eat it) here
      // would desync PNG from the SVG/PDF legs above. exportPNG assigns the
      // background fillStyle FIRST (renderToCanvas then sets '#666' node
      // strokes / '#3b82f6' / 'white'), and fillRect is used ONLY for the
      // background (nodes go through roundRect+fill) — so first assignment +
      // the sole fillRect pin the background hand-off exactly.
      const fillStyleAssignments: string[] = [];
      const fillRectCalls: number[][] = [];
      const ctx = {
        set fillStyle(value: string) { fillStyleAssignments.push(value); },
        strokeStyle: '', lineWidth: 0, font: '', textAlign: '', textBaseline: '',
        fillRect: (...args: number[]) => { fillRectCalls.push(args); },
        beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {},
        roundRect: () => {}, fill: () => {}, fillText: () => {},
      };
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ctx,
        toBlob: (callback: (blob: Blob | null) => void) =>
          callback(new Blob(['png'], { type: 'image/png' })),
      };
      const globals = globalThis as { document?: unknown };
      const originalDocument = globals.document;
      globals.document = { createElement: () => canvas };
      try {
        const png = await exporter.export(
          makeScene(),
          makeOptions({ format: 'png', backgroundColor: '#3C8', width: 800, height: 600 }),
        );
        expect(png.success).toBe(true);
        expect(fillStyleAssignments[0]).toBe('#3C8');
        expect(fillRectCalls).toEqual([[0, 0, 800, 600]]);
      } finally {
        if (originalDocument === undefined) {
          delete globals.document;
        } else {
          globals.document = originalDocument;
        }
      }
    });

    it('fail-opens an out-of-contract length (#RGBA) per-channel instead of throwing — documented policy', async () => {
      // pdfColorFill's contract is #RGB / #RRGGBB. For anything else the
      // current policy is fail-open, not fail-fast: '#3C88' is not doubled
      // (only length===3 triggers doubling), so the channels slice as
      // (3C, 88, '') → (0.235, 0.533, NaN→1.000). Pinning this makes the
      // policy explicit, so extending to #RGBA support or switching to
      // fail-fast later is a conscious contract change, not a silent drift.
      // (SVG would emit the raw string verbatim — 4-digit input is outside
      // the documented background contract either way.)
      const pdf = await exporter.export(makeScene(), makeOptions({ format: 'pdf', backgroundColor: '#3C88' }));
      expect(pdf.success).toBe(true);
      const pdfText = new TextDecoder().decode(await (pdf.data as Blob).arrayBuffer());
      expect(pdfText).toContain('0.235 0.533 1.000 rg');
    });
  });

  // ─── TC-168-04: PNG export ────────────────────────────────────────────

  describe('TC-168-04: PNG export (browser environment)', () => {
    it('returns error when canvas is not available (Node.js)', async () => {
      // In Node.js test environment, document is not available
      const result = await exporter.export(makeScene(), makeOptions({ format: 'png' }));

      // In Node.js, createCanvas throws, caught by the try-catch in export()
      expect(result.success).toBe(false);
    });
  });

  // ─── TC-168-05: Unsupported format ────────────────────────────────────

  describe('TC-168-05: Unsupported format handling', () => {
    it('returns error for unsupported format', async () => {
      const result = await exporter.export(
        makeScene(),
        // @ts-expect-error intentionally passing unsupported format
        makeOptions({ format: 'bmp' }),
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ─── TC-168-06: Metadata ──────────────────────────────────────────────

  describe('TC-168-06: Metadata in export results', () => {
    it('includes metadata for SVG export', async () => {
      const result = await exporter.export(makeScene(), makeOptions({ format: 'svg' }));

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.format).toBe('svg');
      expect(result.metadata?.sizeBytes).toBeGreaterThan(0);
      expect(result.metadata?.generatedAt).toBeDefined();
    });

    it('includes metadata for JSON export', async () => {
      const result = await exporter.export(makeScene(), makeOptions({ format: 'json' }));

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.format).toBe('json');
      expect(result.metadata?.sizeBytes).toBeGreaterThan(0);
    });

    it('includes metadata for PDF export', async () => {
      const result = await exporter.export(makeScene(), makeOptions({ format: 'pdf' }));

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.format).toBe('pdf');
      expect(result.metadata?.sizeBytes).toBeGreaterThan(0);
    });
  });

  // ─── TC-168-07: Batch export ──────────────────────────────────────────

  describe('TC-168-07: Batch export', () => {
    it('exports multiple scenes in batch', async () => {
      const scenes = [makeScene({ id: 's1' }), makeScene({ id: 's2' }), makeScene({ id: 's3' })];
      const results = await exporter.exportBatch(scenes, makeOptions({ format: 'svg' }));

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('handles empty batch', async () => {
      const results = await exporter.exportBatch([], makeOptions({ format: 'svg' }));

      expect(results).toHaveLength(0);
    });
  });

  // ─── TC-168-08: Scene without layout ──────────────────────────────────

  describe('TC-168-08: Scene without layout', () => {
    it('exports scene without layout nodes/edges (empty SVG)', async () => {
      const scene = makeScene({ layout: { nodes: [], edges: [] } });
      const result = await exporter.export(scene, makeOptions({ format: 'svg' }));

      expect(result.success).toBe(true);
    });

    it('exports scene with undefined layout fields', async () => {
      const scene = makeScene({
        layout: {
          nodes: undefined as unknown as [],
          edges: undefined as unknown as [],
        },
      });
      const result = await exporter.export(scene, makeOptions({ format: 'svg' }));

      // Should handle gracefully (uses || [] fallback)
      expect(result.success).toBe(true);
    });
  });

  // ─── TC-168-09: Edge label positioning ────────────────────────────────

  describe('TC-168-09: Edge label rendering', () => {
    it('renders edge label at midpoint', async () => {
      const scene = makeScene();
      const result = await exporter.export(scene, makeOptions({ format: 'svg' }));
      const svgText = await (result.data as Blob).text();

      // Edge from center (160,130) to center (460,130), midpoint should be (310, 125)
      expect(svgText).toContain('310');
    });

    it('skips edge label when label is not defined', async () => {
      const scene = makeScene({
        layout: {
          nodes: [
            { id: 'n1', label: 'A', x: 100, y: 100, width: 120, height: 60 },
            { id: 'n2', label: 'B', x: 400, y: 100, width: 120, height: 60 },
          ],
          edges: [
            { from: 'n1', to: 'n2', points: [] },
          ],
        },
      });

      const result = await exporter.export(scene, makeOptions({ format: 'svg' }));
      expect(result.success).toBe(true);
    });
  });
});
