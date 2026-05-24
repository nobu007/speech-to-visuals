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
        format: 'bmp' as any,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported export format');
    });
  });
});
