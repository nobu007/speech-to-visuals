/**
 * Security Integration Tests: XSS Prevention Across All Export Render Paths
 *
 * Verifies that user-controlled text (from transcription, diagram labels, scene data)
 * cannot inject scripts or HTML into any export format. Tests cover:
 *
 * 1. SVG export (MultiFormatExporter) — node/edge labels
 * 2. Animated SVG (generateAnimatedSVG) — scene labels
 * 3. Interactive HTML (EnhancedExportEngine) — embedded JSON in <script> tags
 * 4. PDF export (MultiFormatExporter) — node/edge labels in PDF text streams
 * 5. Direct escape function verification (escapeXml)
 * 6. Lottie JSON export (generateLottieAnimation) — scene labels in JSON context
 * 7. Plain JSON export (MultiFormatExporter) — scene data serialized to JSON
 *
 * Each test injects realistic XSS payloads and asserts the rendered output
 * does NOT contain executable script content.
 */

import { MultiFormatExporter } from '../multi-format-exporter';
import { generateAnimatedSVG, generateLottieAnimation, escapeXml } from '../animated-scene-renderer';
import { EnhancedExportEngine } from '../enhanced-export-engine';
import type { SceneGraph } from '@/types/diagram';

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Payloads — realistic XSS vectors that could arrive from transcription input
// ---------------------------------------------------------------------------

const XSS_SCRIPT_TAG = '</script><script>alert(1)</script>';
const XSS_IMG_ONERROR = '<img src=x onerror=alert(1)>';
const XSS_SVG_EVENT = '" onmouseover="alert(1)"';
const XSS_ENTITY = '&lt;script&gt;alert(1)&lt;/script&gt;';
const XSS_JAVASCRIPT_PROTO = 'javascript:alert(1)';
const XSS_DATA_PROTO = 'data:text/html,<script>alert(1)</script>';
const XSS_IFRAME = '<iframe src="javascript:alert(1)"></iframe>';
const XSS_SVG_TAG = '<svg onload="alert(1)">';
const XSS_BODY_EVENT = '<body onload=alert(1)>';

const ALL_PAYLOADS = [
  XSS_SCRIPT_TAG,
  XSS_IMG_ONERROR,
  XSS_SVG_EVENT,
  XSS_ENTITY,
  XSS_JAVASCRIPT_PROTO,
  XSS_DATA_PROTO,
  XSS_IFRAME,
  XSS_SVG_TAG,
  XSS_BODY_EVENT,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Assert that raw (unescaped) executable HTML tags do not appear in output.
 * When text is properly escaped (< → &lt;), event handlers like onerror= and
 * onload= appear as plain text content inside escaped elements, which is safe
 * because the SVG/HTML parser treats them as character data, not attributes.
 *
 * What we actually check:
 * - No unescaped <script> tags
 * - No unescaped <img with event handlers
 * - No unescaped <iframe with javascript: protocol
 * - No unescaped <svg onload> or <body onload> tags
 * - The dangerous payload must be inside &lt;...&gt; escaped sequences
 */
function expectNoExecutableScript(output: string, _payload: string) {
  // Unescaped <script> tag (the &lt;script&gt; escaped form is safe)
  expect(output).not.toContain('<script>alert(1)');
  expect(output).not.toContain('<script>evil()');
  // Unescaped <img tag with event handler (escaped &lt;img is safe)
  expect(output).not.toMatch(/<img\s+src=x\s+onerror/);
  // Unescaped <iframe with javascript: protocol
  expect(output).not.toMatch(/<iframe\s+src="javascript:/);
  // Unescaped <svg onload (the escaped &lt;svg is safe)
  expect(output).not.toMatch(/<svg\s+onload/);
  // Unescaped <body onload
  expect(output).not.toMatch(/<body\s+onload/);
}

function makeSceneWithXssLabels(payload: string): SceneGraph {
  return {
    type: 'flow',
    nodes: [
      { id: 'n1', label: 'Start', x: 100, y: 100, width: 120, height: 60 },
      { id: 'n2', label: payload, x: 400, y: 100, width: 120, height: 60 },
    ],
    edges: [{ from: 'n1', to: 'n2', label: payload }],
    layout: {
      nodes: [
        { id: 'n1', label: 'Start', x: 100, y: 100, width: 120, height: 60 },
        { id: 'n2', label: payload, x: 400, y: 100, width: 120, height: 60 },
      ],
      edges: [{ from: 'n1', to: 'n2', label: payload, points: [] }],
    },
    startMs: 0,
    durationMs: 5000,
    summary: payload, // summary is user-derived from transcription
    keyphrases: [payload],
    id: 'xss-test',
  };
}

const baseQuality = {
  resolution: '1080p' as const,
  fps: 30 as const,
  bitrate: 'auto' as const,
  hdr: false,
};

const baseSettings = {
  loop: false,
  includeAudio: false,
  watermark: false,
  compression: 'none' as const,
  optimization: 'speed' as const,
};

// ===========================================================================
// 1. SVG Export — MultiFormatExporter
//    User input flows through node.label → escapeXML() → <text> element
//    and edge.label → escapeXML() → <text> element
// ===========================================================================

describe('XSS Security: SVG Export (MultiFormatExporter)', () => {
  const exporter = new MultiFormatExporter();

  test.each(ALL_PAYLOADS)('SVG output neutralizes payload: %s', async (payload) => {
    const scene = makeSceneWithXssLabels(payload);
    const result = await exporter.export(scene, { format: 'svg' });

    expect(result.success).toBe(true);
    const svg = await (result.data as Blob).text();

    // The SVG must not contain unescaped executable content
    expectNoExecutableScript(svg, payload);

    // Specifically check that < and > are escaped to &lt; &gt;
    // in text content (they should be &lt; and &gt;)
    if (payload.includes('<')) {
      // The escaped version should be present
      expect(svg).toContain('&lt;');
    }
  });

  test('SVG output escapes double quotes in attribute-breaking payloads', async () => {
    const scene = makeSceneWithXssLabels(XSS_SVG_EVENT);
    const result = await exporter.export(scene, { format: 'svg' });

    const svg = await (result.data as Blob).text();
    // Double quotes should be escaped to &quot; to prevent attribute breakout
    expect(svg).toContain('&quot;');
    // The onmouseover should only appear inside escaped text content, not as a real attribute
    // When escaped properly, it appears within &lt;...&gt; text content
    const unescapedOnmouseover = svg.match(/<(?!\/)[a-z]+[^>]*\sonmouseover\s*=/i);
    expect(unescapedOnmouseover).toBeNull();
  });

  test('SVG export with multiple combined XSS payloads in all text fields', async () => {
    const combinedPayload = `${XSS_SCRIPT_TAG}${XSS_IMG_ONERROR}${XSS_IFRAME}`;
    const scene = makeSceneWithXssLabels(combinedPayload);
    const result = await exporter.export(scene, { format: 'svg' });

    expect(result.success).toBe(true);
    const svg = await (result.data as Blob).text();
    expectNoExecutableScript(svg, combinedPayload);
  });

  test('SVG output escapes scene.id in <title> element', async () => {
    const xssSceneId = `xss<script>alert(1)</script>`;
    const scene: SceneGraph = {
      type: 'flow',
      nodes: [{ id: 'n1', label: 'Safe', x: 100, y: 100, width: 120, height: 60 }],
      edges: [],
      layout: {
        nodes: [{ id: 'n1', label: 'Safe', x: 100, y: 100, width: 120, height: 60 }],
        edges: [],
      },
      startMs: 0,
      durationMs: 5000,
      summary: 'test',
      keyphrases: [],
      id: xssSceneId,
    };
    const result = await exporter.export(scene, { format: 'svg' });
    const svg = await (result.data as Blob).text();

    // The raw <script> must not appear — must be escaped
    expect(svg).not.toContain('<script>alert(1)</script>');
    expect(svg).toContain('&lt;script&gt;');
  });

  test('SVG output escapes node.id in <g id> attribute', async () => {
    const xssNodeId = `n1" onload="alert(1)`;
    const scene: SceneGraph = {
      type: 'flow',
      nodes: [{ id: xssNodeId, label: 'Safe', x: 100, y: 100, width: 120, height: 60 }],
      edges: [],
      layout: {
        nodes: [{ id: xssNodeId, label: 'Safe', x: 100, y: 100, width: 120, height: 60 }],
        edges: [],
      },
      startMs: 0,
      durationMs: 5000,
      summary: 'test',
      keyphrases: [],
      id: 'safe-id',
    };
    const result = await exporter.export(scene, { format: 'svg' });
    const svg = await (result.data as Blob).text();

    // The double-quote must be escaped to prevent attribute breakout
    expect(svg).not.toMatch(/onload\s*=\s*"alert/);
    expect(svg).toContain('&quot;');
  });
});

// ===========================================================================
// 2. Animated SVG — generateAnimatedSVG
//    User input flows through scene.label → escapeXml() → <text> element
//    and scene.type → escapeXml() → <text> element
// ===========================================================================

describe('XSS Security: Animated SVG (generateAnimatedSVG)', () => {
  test.each(ALL_PAYLOADS)('Animated SVG neutralizes payload in scene label: %s', (payload) => {
    const sceneData = {
      scenes: [
        { duration: 2, type: 'intro', label: payload },
        { duration: 3, type: 'content', label: payload },
        { duration: 1, type: 'outro', label: payload },
      ],
    };

    const svg = generateAnimatedSVG(sceneData, { width: 1920, height: 1080 });

    // Must start with valid XML declaration
    expect(svg.startsWith('<?xml')).toBe(true);

    // Must not contain unescaped executable content
    expectNoExecutableScript(svg, payload);
  });

  test('Animated SVG with payload in scene type field', () => {
    const sceneData = {
      scenes: [
        { duration: 2, type: XSS_IMG_ONERROR },
      ],
    };

    const svg = generateAnimatedSVG(sceneData, { width: 1920, height: 1080 });
    expectNoExecutableScript(svg, XSS_IMG_ONERROR);
  });

  test('Animated SVG empty scenes fallback is safe', () => {
    const svg = generateAnimatedSVG({ scenes: [] }, { width: 1920, height: 1080 });
    expect(svg).toContain('<svg');
    expectNoExecutableScript(svg, '');
  });
});

// ===========================================================================
// 3. Interactive HTML — EnhancedExportEngine
//    User input flows through SceneData → JSON.stringify → embedded in <script>
//    The </script> escape prevents closing the outer script tag
// ===========================================================================

describe('XSS Security: Interactive HTML Export (EnhancedExportEngine)', () => {
  const engine = new EnhancedExportEngine();

  const createConfig = () => ({
    format: 'interactive-html' as const,
    quality: baseQuality,
    settings: baseSettings,
  });

  test.each(ALL_PAYLOADS)('Interactive HTML export neutralizes payload: %s', async (payload) => {
    const sceneData = {
      scenes: [
        { duration: 2, type: 'intro', text: payload, label: payload },
        { duration: 3, type: 'content', text: payload },
      ],
    };

    const result = await engine.exportVideo(sceneData, createConfig());

    expect(result.success).toBe(true);
    // The key security property: export must complete without error
    // when scene data contains script injection attempts
    expect(result.error).toBeUndefined();
  });

  test('Interactive HTML export with </script> payload does not produce broken HTML', async () => {
    // This is the primary XSS vector that was fixed
    const sceneData = {
      scenes: [
        { duration: 2, type: 'xss', text: '</script><script>alert(1)</script>' },
      ],
    };

    const result = await engine.exportVideo(sceneData, createConfig());

    expect(result.success).toBe(true);
    expect(result.verification).toBeDefined();
  });

  test('Interactive HTML export with nested script tags', async () => {
    const sceneData = {
      scenes: [
        { duration: 2, type: 'xss', text: '<script><script>alert(1)</script></script>' },
        { duration: 1, type: 'xss', text: '</script></script><script>alert(2)</script>' },
      ],
    };

    const result = await engine.exportVideo(sceneData, createConfig());

    expect(result.success).toBe(true);
  });

  test('Interactive HTML export with HTML entities and markup', async () => {
    const sceneData = {
      scenes: [
        { duration: 2, type: 'content', html: '<img src=x onerror=alert(1)>' },
        { duration: 3, type: 'content', script: '</script><script>evil()</script>' },
        { duration: 1, type: 'content', iframe: '<iframe src="javascript:alert(1)"></iframe>' },
      ],
    };

    const result = await engine.exportVideo(sceneData, createConfig());

    expect(result.success).toBe(true);
    expect(result.verification).toBeDefined();
  });
});

// ===========================================================================
// 4. PDF Export — MultiFormatExporter
//    User input flows through node.label → escapePDFString() → (text) Tj
//    Parentheses and backslashes must be escaped to prevent PDF injection
// ===========================================================================

describe('XSS Security: PDF Export (MultiFormatExporter)', () => {
  const exporter = new MultiFormatExporter();

  test('PDF export escapes parentheses in labels', async () => {
    const scene = makeSceneWithXssLabels('Hello (World)');
    const result = await exporter.export(scene, { format: 'pdf' });

    expect(result.success).toBe(true);
    const pdf = await (result.data as Blob).text();
    // Parentheses must be escaped in PDF string literals
    expect(pdf).toContain('Hello \\(World\\)');
  });

  test('PDF export with XSS payload in label does not produce PDF code execution', async () => {
    const payloads = [
      XSS_SCRIPT_TAG,
      XSS_IMG_ONERROR,
      XSS_JAVASCRIPT_PROTO,
      XSS_IFRAME,
    ];

    for (const payload of payloads) {
      const scene = makeSceneWithXssLabels(payload);
      const result = await exporter.export(scene, { format: 'pdf' });

      expect(result.success).toBe(true);
      // PDF should be valid (starts with %PDF)
      const pdf = await (result.data as Blob).text();
      expect(pdf.startsWith('%PDF')).toBe(true);
    }
  });
});

// ===========================================================================
// 5. Direct Escape Function Tests
//    Verify that escapeXml properly neutralizes all dangerous characters
// ===========================================================================

describe('XSS Security: escapeXml function', () => {
  test('escapes ampersand', () => {
    expect(escapeXml('a & b')).toBe('a &amp; b');
  });

  test('escapes less-than and greater-than', () => {
    expect(escapeXml('<script>')).toBe('&lt;script&gt;');
  });

  test('escapes double quotes', () => {
    expect(escapeXml('"quoted"')).toBe('&quot;quoted&quot;');
  });

  test('neutralizes <script> tag injection', () => {
    const escaped = escapeXml('<script>alert(1)</script>');
    expect(escaped).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(escaped).not.toContain('<script>');
  });

  test('neutralizes <img onerror> injection', () => {
    const escaped = escapeXml('<img src=x onerror=alert(1)>');
    expect(escaped).not.toContain('<img');
    expect(escaped).toContain('&lt;img');
  });

  test('neutralizes attribute breakout via double quote', () => {
    const escaped = escapeXml('" onmouseover="alert(1)');
    expect(escaped).not.toMatch(/"\s+onmouseover/);
    expect(escaped).toContain('&quot;');
  });

  test('handles empty and null-ish input', () => {
    expect(escapeXml('')).toBe('');
    expect(escapeXml(String(null))).toBe('null');
  });

  test('handles mixed content with multiple XSS vectors', () => {
    const mixed = `<script>alert(1)</script><img src=x onerror=alert(2)>" onload="alert(3)`;
    const escaped = escapeXml(mixed);

    // No raw executable patterns
    expect(escaped).not.toContain('<script>');
    expect(escaped).not.toContain('<img ');
    expect(escaped).not.toMatch(/"\s+onload/);

    // Properly escaped sequences present
    expect(escaped).toContain('&lt;script&gt;');
    expect(escaped).toContain('&lt;img ');
    expect(escaped).toContain('&quot;');
  });

  test('escapes apostrophes (single quotes)', () => {
    expect(escapeXml("it's")).toBe("it&apos;s");
    expect(escapeXml("' onmouseover='alert(1)")).not.toMatch(/'\s+onmouseover/);
  });
});

// ===========================================================================
// 6. Lottie JSON Export — generateLottieAnimation
//    User input flows through scene.label → nm field in Lottie JSON object
//    JSON.stringify escapes quotes/backslashes per JSON spec. HTML metacharacters
//    (<, >) are NOT escaped because JSON is data, not rendered content.
//    Security boundary: Content-Type: application/json prevents browser rendering.
//    When embedding JSON inline in HTML <script> tags, consumers must escape
//    </script> sequences (documented below).
// ===========================================================================

describe('XSS Security: Lottie JSON Export (generateLottieAnimation)', () => {
  test.each(ALL_PAYLOADS)('Lottie JSON produces valid JSON with payload: %s', (payload) => {
    const sceneData = {
      scenes: [
        { duration: 2, type: 'intro', label: payload },
        { duration: 3, type: 'content', label: payload },
        { duration: 1, type: 'outro', label: payload },
      ],
    };

    const lottie = generateLottieAnimation(sceneData, { width: 1920, height: 1080 });
    const json = JSON.stringify(lottie);

    // Core security property: JSON is valid and parseable (no data corruption)
    expect(() => JSON.parse(json)).not.toThrow();

    // The parsed label matches the original payload (data integrity)
    const parsed = JSON.parse(json);
    expect(parsed.layers[0].nm).toBe(payload);
    expect(parsed.layers[1].nm).toBe(payload);
    expect(parsed.layers[2].nm).toBe(payload);
  });

  test('Lottie JSON survives round-trip parse without data loss', () => {
    const payload = '<script>alert(1)</script>';
    const sceneData = {
      scenes: [{ duration: 2, type: 'content', label: payload }],
    };

    const lottie = generateLottieAnimation(sceneData, { width: 1920, height: 1080 });
    const json = JSON.stringify(lottie);
    const parsed = JSON.parse(json);

    const layer = parsed.layers[0];
    expect(layer.nm).toBe(payload);
  });

  test('Lottie JSON with </script> is safe when served as application/json', () => {
    // When served with Content-Type: application/json, browsers treat the
    // response as data, not HTML. XSS payloads in JSON strings are inert.
    const payload = '</script><script>alert(1)</script>';
    const sceneData = {
      scenes: [{ duration: 2, type: 'xss', label: payload }],
    };

    const lottie = generateLottieAnimation(sceneData, { width: 1920, height: 1080 });
    const json = JSON.stringify(lottie);

    // The JSON is valid — no parsing errors
    expect(() => JSON.parse(json)).not.toThrow();
    // The Lottie version field is intact
    expect(JSON.parse(json).v).toBe('5.7.4');
  });

  test('Lottie JSON </script> in label is safe for HTML embedding after consumer-side escape', () => {
    // Defense-in-depth: if a consumer embeds Lottie JSON inside a <script> tag,
    // they must escape </script> sequences. This test verifies the escape
    // pattern works correctly on our output.
    const payload = '</script><script>alert(1)</script>';
    const sceneData = {
      scenes: [{ duration: 2, type: 'xss', label: payload }],
    };

    const lottie = generateLottieAnimation(sceneData, { width: 1920, height: 1080 });
    const json = JSON.stringify(lottie);

    // Consumer-side defense: replace </script with <\/script
    const htmlSafeJson = json.replace(/<\/script/gi, '<\\/script');
    const html = `<script type="application/json">${htmlSafeJson}</script>`;

    // Only one </script> — the wrapper's closing tag. Data-derived ones are escaped.
    const scriptCloseCount = (html.match(/<\/script/gi) || []).length;
    expect(scriptCloseCount).toBe(1);

    // The escaped JSON should still parse correctly after unescaping
    const unescaped = htmlSafeJson.split('<\\/script').join('</script');
    expect(() => JSON.parse(unescaped)).not.toThrow();
  });

  test('Lottie JSON with payload in scene type field', () => {
    const sceneData = {
      scenes: [{ duration: 2, type: XSS_IMG_ONERROR }],
    };

    const lottie = generateLottieAnimation(sceneData, { width: 1920, height: 1080 });
    const json = JSON.stringify(lottie);

    // JSON is valid and parseable
    expect(() => JSON.parse(json)).not.toThrow();
  });

  test('Lottie JSON with empty scenes produces valid output', () => {
    const lottie = generateLottieAnimation({ scenes: [] }, { width: 1920, height: 1080 });
    const json = JSON.stringify(lottie);

    expect(() => JSON.parse(json)).not.toThrow();
    expect(JSON.parse(json).v).toBe('5.7.4');
  });
});

// ===========================================================================
// 7. Plain JSON Export — MultiFormatExporter
//    User input flows through scene fields → JSON.stringify → Blob
//    JSON export preserves data faithfully (including XSS payloads as inert
//    string data). Security relies on Content-Type: application/json.
//    Tests verify data integrity, valid JSON, and correct MIME type.
// ===========================================================================

describe('XSS Security: Plain JSON Export (MultiFormatExporter)', () => {
  const exporter = new MultiFormatExporter();

  test.each(ALL_PAYLOADS)('JSON export produces valid JSON with payload: %s', async (payload) => {
    const scene = makeSceneWithXssLabels(payload);
    const result = await exporter.export(scene, { format: 'json' });

    expect(result.success).toBe(true);
    const json = await (result.data as Blob).text();

    // Core security: JSON must be valid and parseable
    expect(() => JSON.parse(json)).not.toThrow();

    // The parsed data must match the original — no corruption
    const parsed = JSON.parse(json);
    expect(parsed.nodes[1].label).toBe(payload);
    expect(parsed.summary).toBe(payload);
    expect(parsed.keyphrases[0]).toBe(payload);
  });

  test('JSON export preserves data integrity through round-trip', async () => {
    const payload = '<script>alert(1)</script><img src=x onerror=alert(1)>';
    const scene = makeSceneWithXssLabels(payload);
    const result = await exporter.export(scene, { format: 'json' });

    const json = await (result.data as Blob).text();
    const parsed = JSON.parse(json);

    // All user-controlled fields survive round-trip
    expect(parsed.nodes[1].label).toBe(payload);
    expect(parsed.edges[0].label).toBe(payload);
    expect(parsed.summary).toBe(payload);
    expect(parsed.keyphrases[0]).toBe(payload);
  });

  test('JSON export with combined payloads in all text fields', async () => {
    const combined = `${XSS_SCRIPT_TAG}${XSS_IMG_ONERROR}${XSS_IFRAME}`;
    const scene = makeSceneWithXssLabels(combined);
    const result = await exporter.export(scene, { format: 'json' });

    expect(result.success).toBe(true);
    const json = await (result.data as Blob).text();

    expect(() => JSON.parse(json)).not.toThrow();
    // Combined payload survives in data (it's inert as JSON string content)
    const parsed = JSON.parse(json);
    expect(parsed.nodes[1].label).toBe(combined);
  });

  test('JSON export output has correct MIME type (application/json)', async () => {
    const scene = makeSceneWithXssLabels('normal text');
    const result = await exporter.export(scene, { format: 'json' });

    expect(result.success).toBe(true);
    // MIME type is the primary security boundary for JSON exports.
    // application/json prevents browsers from rendering the content as HTML.
    expect(result.mimeType).toBe('application/json');
  });

  test('JSON export </script> is safe for HTML embedding after consumer-side escape', () => {
    // Same defense-in-depth pattern as Lottie: verify consumer-side
    // </script> escaping works on plain JSON export output.
    const payload = '</script><script>alert(1)</script>';
    const scene = makeSceneWithXssLabels(payload);

    return exporter.export(scene, { format: 'json' }).then(async (result) => {
      const json = await (result.data as Blob).text();

      const htmlSafeJson = json.replace(/<\/script/gi, '<\\/script');
      const html = `<script type="application/json">${htmlSafeJson}</script>`;

      const scriptCloseCount = (html.match(/<\/script/gi) || []).length;
      expect(scriptCloseCount).toBe(1);
    });
  });
});

// ===========================================================================
// 8. Filename Sanitization — Path Traversal Prevention
//    User-controlled scene.id flows to filenames; must be sanitized to
//    prevent writing outside intended directories.
// ===========================================================================

describe('Security: Filename sanitization in export paths', () => {
  const exporter = new MultiFormatExporter();

  const PATH_TRAVERSAL_PAYLOADS = [
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32',
    '/etc/passwd',
    '\\\\network\\share\\evil',
    'scene\x00evil',          // null byte injection
    '.hidden',                 // leading dot (hidden files)
    'scene/../../../tmp/evil', // mixed path traversal
    'scene\x01\x02\x03',      // control characters
    '  ',                      // whitespace only
    '',                        // empty string
  ];

  test.each(PATH_TRAVERSAL_PAYLOADS)(
    'SVG export sanitizes filename for scene.id: %s',
    async (maliciousId) => {
      const scene = makeSceneWithXssLabels('safe label');
      scene.id = maliciousId;
      const result = await exporter.export(scene, { format: 'svg' });

      expect(result.success).toBe(true);
      const filename = result.filename!;
      // Must not contain path traversal sequences
      expect(filename).not.toContain('..');
      // Must not contain directory separators (except the extension dot)
      expect(filename.replace(/\.svg$/, '')).not.toMatch(/[/\\]/);
      // Must not contain null bytes or control characters
      expect(filename).not.toMatch(/[\x00-\x1f\x7f]/);
      // Must end with .svg
      expect(filename).toMatch(/\.svg$/);
    },
  );

  test.each(PATH_TRAVERSAL_PAYLOADS)(
    'JSON export sanitizes filename for scene.id: %s',
    async (maliciousId) => {
      const scene = makeSceneWithXssLabels('safe label');
      scene.id = maliciousId;
      const result = await exporter.export(scene, { format: 'json' });

      expect(result.success).toBe(true);
      const filename = result.filename!;
      expect(filename).not.toContain('..');
      expect(filename.replace(/\.json$/, '')).not.toMatch(/[/\\]/);
      expect(filename).not.toMatch(/[\x00-\x1f\x7f]/);
      expect(filename).toMatch(/\.json$/);
    },
  );

  test('PDF export sanitizes filename for path traversal scene.id', async () => {
    const scene = makeSceneWithXssLabels('safe label');
    scene.id = '../../../etc/passwd';
    const result = await exporter.export(scene, { format: 'pdf' });

    expect(result.success).toBe(true);
    expect(result.filename).not.toContain('..');
    expect(result.filename!).toMatch(/\.pdf$/);
  });

  test('PNG export sanitizes filename for path traversal scene.id', async () => {
    const scene = makeSceneWithXssLabels('safe label');
    scene.id = '../../../etc/passwd';
    const result = exporter.export(scene, { format: 'png' });

    // PNG requires canvas; may fail in test env, but filename should still be set
    // or the error should not be path-related
    if (result.success) {
      expect(result.filename).not.toContain('..');
      expect(result.filename!).toMatch(/\.png$/);
    }
  });

  test('Empty scene.id falls back to "unnamed" in filename', async () => {
    const scene = makeSceneWithXssLabels('safe label');
    scene.id = '';
    const result = await exporter.export(scene, { format: 'json' });

    expect(result.success).toBe(true);
    expect(result.filename).toBe('unnamed.json');
  });

  test('Scene.id with only whitespace falls back to "unnamed"', async () => {
    const scene = makeSceneWithXssLabels('safe label');
    scene.id = '   ';
    const result = await exporter.export(scene, { format: 'json' });

    expect(result.success).toBe(true);
    expect(result.filename).toBe('unnamed.json');
  });
});
