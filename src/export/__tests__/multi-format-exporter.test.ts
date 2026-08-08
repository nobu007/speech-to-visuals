/**
 * Tests for MultiFormatExporter — PDF export with actual diagram content
 */

import { MultiFormatExporter } from '../multi-format-exporter';
import type { SceneGraph } from '@/types/diagram';

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
      // PDF `re` operator: "<x> <y> <w> <h> re" — corner x is 200, not 140.
      expect(pdf).toMatch(/200 \d+ 120 60 re/);
      expect(pdf).not.toMatch(/140 \d+ 120 60 re/);
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
});
