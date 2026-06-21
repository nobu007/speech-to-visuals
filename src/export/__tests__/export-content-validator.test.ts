/**
 * Tests for the export content validator — defense-in-depth pre-export scanner.
 */

import { validateSceneGraphForExport, validateExportPayload } from '../export-content-validator';
import type { SceneGraph } from '../../types/diagram';

function makeCleanScene(): SceneGraph {
  return {
    type: 'flow',
    nodes: [
      { id: 'node-1', label: 'Start Process' },
      { id: 'node-2', label: 'End Process' },
    ],
    edges: [
      { from: 'node-1', to: 'node-2', label: 'next' },
    ],
    startMs: 0,
    durationMs: 5000,
    summary: 'A simple flow diagram',
    keyphrases: ['process', 'start', 'end'],
  };
}

describe('Export Content Validator', () => {
  describe('clean content', () => {
    test('passes validation for normal scene data', () => {
      const scene = makeCleanScene();
      const result = validateSceneGraphForExport(scene);
      expect(result.passed).toBe(true);
      expect(result.findings).toHaveLength(0);
    });

    test('passes for scene with special chars that are not dangerous', () => {
      const scene = makeCleanScene();
      scene.summary = 'A diagram showing (x > 0) & (y < 10)';
      const result = validateSceneGraphForExport(scene);
      expect(result.passed).toBe(true);
      expect(result.findings).toHaveLength(0);
    });
  });

  describe('high-severity detection', () => {
    test('detects <script> tag in node label', () => {
      const scene = makeCleanScene();
      scene.nodes[0].label = '<script>alert(1)</script>';
      const result = validateSceneGraphForExport(scene);
      const highFindings = result.findings.filter((f) => f.severity === 'high');
      expect(highFindings.length).toBeGreaterThanOrEqual(1);
      expect(highFindings.some((f) => f.pattern === 'script-tag')).toBe(true);
      expect(highFindings.some((f) => f.field === 'nodes[0].label')).toBe(true);
    });

    test('detects <img onerror> in summary', () => {
      const scene = makeCleanScene();
      scene.summary = '<img src=x onerror=alert(1)>';
      const result = validateSceneGraphForExport(scene);
      const highFindings = result.findings.filter((f) => f.severity === 'high');
      expect(highFindings.some((f) => f.pattern === 'img-onerror')).toBe(true);
    });

    test('detects <svg onload> in edge label', () => {
      const scene = makeCleanScene();
      scene.edges[0].label = '<svg onload=alert(1)>';
      const result = validateSceneGraphForExport(scene);
      expect(result.findings.some((f) => f.pattern === 'svg-onload')).toBe(true);
    });

    test('detects iframe tag in keyphrases', () => {
      const scene = makeCleanScene();
      scene.keyphrases = ['normal', '<iframe src="evil.com">'];
      const result = validateSceneGraphForExport(scene);
      expect(result.findings.some((f) => f.pattern === 'iframe-tag')).toBe(true);
    });

    test('detects javascript: protocol in content', () => {
      const scene = makeCleanScene();
      scene.content = 'Click here: javascript:alert(document.cookie)';
      const result = validateSceneGraphForExport(scene);
      expect(result.findings.some((f) => f.pattern === 'javascript-protocol')).toBe(true);
    });

    test('detects <embed> tag in title', () => {
      const scene = makeCleanScene();
      scene.title = '<embed src="data:text/html,evil">';
      const result = validateSceneGraphForExport(scene);
      expect(result.findings.some((f) => f.pattern === 'embed-tag')).toBe(true);
    });

    test('detects <object> tag in node id', () => {
      const scene = makeCleanScene();
      scene.nodes[0].id = '<object data="evil.swf">';
      const result = validateSceneGraphForExport(scene);
      expect(result.findings.some((f) => f.pattern === 'object-tag')).toBe(true);
    });

    test('detects PDF operator injection in node label', () => {
      const scene = makeCleanScene();
      scene.nodes[0].label = 'text) Tj (evil';
      const result = validateSceneGraphForExport(scene);
      expect(result.findings.some((f) => f.pattern === 'pdf-operator-injection')).toBe(true);
    });

    test('detects CSS expression() in node label', () => {
      const scene = makeCleanScene();
      scene.nodes[0].label = 'style="width:expression(alert(1))"';
      const result = validateSceneGraphForExport(scene);
      expect(result.findings.some((f) => f.pattern === 'css-expression')).toBe(true);
    });

    test('detects -moz-binding in summary', () => {
      const scene = makeCleanScene();
      scene.summary = 'div { -moz-binding: url(evil.xml) }';
      const result = validateSceneGraphForExport(scene);
      expect(result.findings.some((f) => f.pattern === 'css-moz-binding')).toBe(true);
    });

    test('detects url(javascript:) in CSS context', () => {
      const scene = makeCleanScene();
      scene.nodes[0].label = 'background: url(javascript:alert(1))';
      const result = validateSceneGraphForExport(scene);
      expect(result.findings.some((f) => f.pattern === 'css-url-javascript')).toBe(true);
    });
  });

  describe('medium-severity detection', () => {
    test('detects event handler in node label', () => {
      const scene = makeCleanScene();
      scene.nodes[0].label = 'text onclick=alert(1)';
      const result = validateSceneGraphForExport(scene);
      expect(result.findings.some((f) => f.pattern === 'event-handler')).toBe(true);
    });

    test('detects dangerous href in content', () => {
      const scene = makeCleanScene();
      scene.content = '<a href="javascript:void(0)">click</a>';
      const result = validateSceneGraphForExport(scene);
      expect(result.findings.some((f) => f.pattern === 'dangerous-href')).toBe(true);
    });

    test('detects null byte in edge from field', () => {
      const scene = makeCleanScene();
      scene.edges[0].from = 'node\0evil';
      const result = validateSceneGraphForExport(scene);
      expect(result.findings.some((f) => f.pattern === 'null-byte')).toBe(true);
    });

    test('detects <meta> tag in summary', () => {
      const scene = makeCleanScene();
      scene.summary = '<meta http-equiv="refresh" content="0;url=evil">';
      const result = validateSceneGraphForExport(scene);
      expect(result.findings.some((f) => f.pattern === 'meta-tag')).toBe(true);
    });

    test('detects @import url() in node label', () => {
      const scene = makeCleanScene();
      scene.nodes[0].label = '@import url("https://evil.com/exfil.css")';
      const result = validateSceneGraphForExport(scene);
      expect(result.findings.some((f) => f.pattern === 'css-import')).toBe(true);
    });

    test('detects behavior:url() in edge label', () => {
      const scene = makeCleanScene();
      scene.edges[0].label = 'behavior:url(evil.htc)';
      const result = validateSceneGraphForExport(scene);
      expect(result.findings.some((f) => f.pattern === 'css-behavior')).toBe(true);
    });

    test('detects data:text/html URI in CSS url() context', () => {
      const scene = makeCleanScene();
      scene.summary = 'background: url(data:text/html,<h1>evil</h1>)';
      const result = validateSceneGraphForExport(scene);
      expect(result.findings.some((f) => f.pattern === 'data-html-uri')).toBe(true);
    });
  });

  describe('strict mode', () => {
    test('blocks export on high-severity finding in strict mode', () => {
      const scene = makeCleanScene();
      scene.nodes[0].label = '<script>alert(1)</script>';
      const result = validateSceneGraphForExport(scene, { strict: true });
      expect(result.passed).toBe(false);
    });

    test('allows medium-severity findings in strict mode', () => {
      const scene = makeCleanScene();
      scene.nodes[0].label = 'text onclick=alert(1)';
      const result = validateSceneGraphForExport(scene, { strict: true });
      // Strict mode only blocks on high severity
      expect(result.passed).toBe(true);
    });

    test('allows clean content in strict mode', () => {
      const scene = makeCleanScene();
      const result = validateSceneGraphForExport(scene, { strict: true });
      expect(result.passed).toBe(true);
      expect(result.findings).toHaveLength(0);
    });
  });

  describe('multiple findings', () => {
    test('reports findings from multiple fields', () => {
      const scene = makeCleanScene();
      scene.nodes[0].label = '<script>alert(1)</script>';
      scene.summary = '<img src=x onerror=alert(1)>';
      scene.edges[0].label = '<iframe src="evil.com">';
      const result = validateSceneGraphForExport(scene);
      const fields = result.findings.map((f) => f.field);
      expect(fields).toContain('nodes[0].label');
      expect(fields).toContain('summary');
      expect(fields).toContain('edges[0].label');
    });

    test('findings include preview text', () => {
      const scene = makeCleanScene();
      scene.summary = '<script>alert(1)</script>';
      const result = validateSceneGraphForExport(scene);
      expect(result.findings[0].preview).toContain('<script>');
    });

    test('preview is truncated for long values', () => {
      const scene = makeCleanScene();
      scene.summary = '<script>' + 'A'.repeat(200) + '</script>';
      const result = validateSceneGraphForExport(scene);
      expect(result.findings[0].preview.length).toBeLessThanOrEqual(83 + 3); // 80 chars + '...'
      expect(result.findings[0].preview.endsWith('...')).toBe(true);
    });
  });

  describe('nested object traversal', () => {
    test('checks node.meta fields recursively', () => {
      const scene = makeCleanScene();
      scene.nodes[0].meta = {
        category: '<script>evil</script>',
        icon: 'normal-icon',
      };
      const result = validateSceneGraphForExport(scene);
      expect(result.findings.some((f) => f.field.includes('meta'))).toBe(true);
    });

    test('checks layout bounds without crashing on missing fields', () => {
      const scene = makeCleanScene();
      scene.layout = {
        nodes: [],
        edges: [],
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      };
      const result = validateSceneGraphForExport(scene);
      expect(result.passed).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('handles empty strings safely', () => {
      const scene = makeCleanScene();
      scene.summary = '';
      scene.nodes[0].label = '';
      const result = validateSceneGraphForExport(scene);
      expect(result.passed).toBe(true);
      expect(result.findings).toHaveLength(0);
    });

    test('handles undefined optional fields', () => {
      const scene: SceneGraph = {
        type: 'flow',
        nodes: [],
        edges: [],
        startMs: 0,
        durationMs: 1000,
        summary: 'test',
        keyphrases: [],
      };
      const result = validateSceneGraphForExport(scene);
      expect(result.passed).toBe(true);
    });

    test('handles scene with no keyphrases array', () => {
      const scene = makeCleanScene();
      scene.keyphrases = undefined as unknown as string[];
      const result = validateSceneGraphForExport(scene);
      expect(result.passed).toBe(true);
    });
  });

  describe('validateExportPayload', () => {
    test('detects injection in nested scene data', () => {
      const payload = {
        scenes: [
          { id: 's1', label: 'Normal scene' },
          { id: 's2', label: '<script>alert(1)</script>' },
        ],
      };
      const result = validateExportPayload(payload);
      expect(result.findings.some((f) => f.severity === 'high')).toBe(true);
    });

    test('detects CSS injection at arbitrary depth', () => {
      const payload = {
        meta: {
          styles: {
            body: { background: 'url(javascript:alert(1))' },
          },
        },
      };
      const result = validateExportPayload(payload);
      expect(result.findings.some((f) => f.pattern === 'css-url-javascript')).toBe(true);
    });

    test('handles arrays of objects', () => {
      const payload = {
        items: [
          { name: 'safe', value: 'normal' },
          { name: 'evil', value: '<iframe src="evil.com">' },
        ],
      };
      const result = validateExportPayload(payload);
      expect(result.findings.some((f) => f.pattern === 'iframe-tag')).toBe(true);
    });

    test('always returns passed=true (non-blocking)', () => {
      const payload = { data: '<script>alert(1)</script>' };
      const result = validateExportPayload(payload);
      expect(result.passed).toBe(true);
      expect(result.findings.length).toBeGreaterThan(0);
    });

    test('handles primitive payloads', () => {
      expect(validateExportPayload(null).passed).toBe(true);
      expect(validateExportPayload(undefined).passed).toBe(true);
      expect(validateExportPayload(42).passed).toBe(true);
      expect(validateExportPayload('string').passed).toBe(true);
    });

    test('handles deeply nested payloads within depth limit', () => {
      // Build a non-circular chain deeper than the depth limit
      let obj: Record<string, unknown> = { evil: '<script>x</script>' };
      for (let i = 0; i < 12; i++) {
        obj = { child: obj };
      }
      const result = validateExportPayload(obj);
      // Should not crash; deep object beyond depth 10 is silently skipped
      expect(result.passed).toBe(true);
    });

    test('handles clean payload without findings', () => {
      const payload = {
        scenes: [
          { id: 's1', label: 'Start', duration: 5.0 },
          { id: 's2', label: 'End', duration: 3.2 },
        ],
      };
      const result = validateExportPayload(payload);
      expect(result.findings).toHaveLength(0);
    });

    test('accepts context label for logging', () => {
      const payload = { data: '<script>x</script>' };
      const result = validateExportPayload(payload, 'job=test-123');
      expect(result.findings.length).toBeGreaterThan(0);
    });
  });
});
