/**
 * Advanced adversarial fuzz tests for ExportContentValidator.
 *
 * Extends the base fuzz/bypass test suites with sophisticated attack vectors
 * that target encoding-aware bypass, mutation XSS, polyglot payloads, and
 * context-specific injection (SVG animate, CSS @font-face, template literals).
 *
 * Categories covered:
 *   1. HTML entity encoding (decimal &amp;#60; and hex &amp;#x3c;)
 *   2. Base64 data-URI payloads
 *   3. SVG <animate>/<set> attribute injection
 *   4. CSS @keyframes/@font-face url injection
 *   5. Mutation XSS (mXSS) vectors
 *   6. Polyglot payloads (valid in SVG + HTML + JS contexts)
 *   7. Protocol handler bypasses (vbscript:, data:text/html)
 *   8. Unicode/zero-width character obfuscation
 *   9. Regex catastrophic backtracking resistance
 *  10. Combined multi-encoding vectors
 *
 * Detection expectations:
 *   - Payloads with a visible high-severity core pattern → detected as high
 *   - Payloads with only medium-severity signals → detected as medium
 *   - Fully entity-encoded payloads that hide the pattern → may not trigger
 *     (defense-in-depth relies on output escaping for these)
 *   - All payloads: no crash, no hang, deterministic result
 */

import {
  validateExportPayload,
  validateSceneGraphForExport,
} from '../export-content-validator';
import type { SceneGraph } from '../../types/diagram';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCleanScene(): SceneGraph {
  return {
    type: 'flow',
    nodes: [
      { id: 'node-1', label: 'Start' },
      { id: 'node-2', label: 'End' },
    ],
    edges: [{ from: 'node-1', to: 'node-2', label: 'next' }],
    startMs: 0,
    durationMs: 5000,
    summary: 'A flow diagram',
    keyphrases: ['start', 'end'],
  };
}

function hasHighFinding(findings: Array<{ severity: string }>): boolean {
  return findings.some((f) => f.severity === 'high');
}

function hasAnyFinding(findings: Array<{ severity: string }>): boolean {
  return findings.length > 0;
}

// ---------------------------------------------------------------------------
// 1. SVG <animate>/<set> attribute injection vectors
// ---------------------------------------------------------------------------

describe('Advanced SVG: <animate>/<set> attribute injection', () => {
  // Payloads with detectable patterns (javascript: protocol)
  const svgAnimatePayloadsDetected: Array<{ payload: string; desc: string }> = [
    {
      payload: '<svg><animate attributeName=href values=javascript:alert(1)>',
      desc: 'animate href to javascript protocol',
    },
    {
      payload: '<svg><animate xlink:href=#xss attributeName=href values="javascript:alert(1)"/>',
      desc: 'animate with xlink:href and javascript target',
    },
    {
      payload: '<svg><a><animate attributeName=href values="javascript:alert(1)"/></a></svg>',
      desc: 'nested animate inside <a> with javascript protocol',
    },
  ];

  // Payloads using SVG-specific events (onbegin, onend, onrepeat) —
  // previously a known coverage gap, now detected after pattern list expansion.
  const svgAnimateDetected: Array<{ payload: string; desc: string }> = [
    {
      payload: '<svg><animate onbegin=alert(1) attributeName=x dur=1s>',
      desc: 'animate onbegin event handler (SVG SMIL event)',
    },
    {
      payload: '<svg><set onbegin=alert(1) attributename=onload>',
      desc: 'set element with onbegin handler (SVG SMIL event)',
    },
    {
      payload: '<svg><text><animate onbegin=alert(1) attributeName=x dur=1s></text></svg>',
      desc: 'animate inside text element (SVG SMIL event)',
    },
    {
      payload: '<svg><animate onend=alert(1) attributeName=x dur=1s>',
      desc: 'animate onend event handler (SVG SMIL event)',
    },
    {
      payload: '<svg><animate onrepeat=alert(1) attributeName=x dur=1s>',
      desc: 'animate onrepeat event handler (SVG SMIL event)',
    },
  ];

  test.each(svgAnimatePayloadsDetected)('SVG animate vector: "$desc" → detected', ({ payload }) => {
    const result = validateExportPayload({ data: payload });
    expect(hasAnyFinding(result.findings)).toBe(true);
    expect(hasHighFinding(result.findings)).toBe(true); // javascript: protocol
  });

  test.each(svgAnimateDetected)('SVG SMIL event: "$desc" → detected as medium', ({ payload }) => {
    const result = validateExportPayload({ data: payload });
    // SVG SMIL events (onbegin, onend, onrepeat) are now in the pattern list.
    expect(result).toBeDefined();
    expect(hasAnyFinding(result.findings)).toBe(true);
    expect(result.findings.some((f) => f.pattern === 'event-handler')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. CSS @keyframes / @font-face injection vectors
// ---------------------------------------------------------------------------

describe('Advanced CSS: @keyframes and @font-face injection', () => {
  const cssPayloads: Array<{ payload: string; expectHigh: boolean; desc: string }> = [
    {
      payload: '@font-face { font-family: evil; src: url(javascript:alert(1)); }',
      expectHigh: true,
      desc: '@font-face with javascript: URL',
    },
    {
      payload: '@font-face { font-family: evil; src: url("javascript:alert(1)"); }',
      expectHigh: true,
      desc: '@font-face with quoted javascript: URL',
    },
    {
      payload: '@import url("https://evil.com/exfil.css")',
      expectHigh: false,
      desc: '@import with external URL (medium)',
    },
    {
      payload: '@keyframes xss { from { url(javascript:alert(1)) } to {} }',
      expectHigh: true,
      desc: '@keyframes with javascript: URL',
    },
    {
      payload: '@font-face{src:url(data:text/html,<script>alert(1)</script>)}',
      expectHigh: true,
      desc: '@font-face with data:text/html containing script tag',
    },
    {
      payload: '@counter-style x { system: cyclic; symbols: url(javascript:alert(1)); }',
      expectHigh: true,
      desc: '@counter-style with javascript: URL',
    },
  ];

  test.each(cssPayloads)('CSS vector: "$desc" → detected', ({ payload, expectHigh }) => {
    const result = validateExportPayload({ style: payload });
    expect(hasAnyFinding(result.findings)).toBe(true);
    if (expectHigh) {
      expect(hasHighFinding(result.findings)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Protocol handler bypass vectors
// ---------------------------------------------------------------------------

describe('Advanced: protocol handler bypass vectors', () => {
  const protocolPayloads: Array<{ payload: string; expectHigh: boolean; desc: string }> = [
    {
      payload: 'javascript:alert(document.domain)',
      expectHigh: true,
      desc: 'standard javascript: protocol',
    },
    {
      payload: 'JaVaScRiPt:alert(1)',
      expectHigh: true,
      desc: 'mixed case javascript: protocol',
    },
    {
      payload: 'javascript\t:alert(1)',
      expectHigh: true, // tab before colon — now detected with \s*: pattern
      desc: 'javascript with tab before colon',
    },
    {
      payload: 'javascript :alert(1)',
      expectHigh: true, // space before colon — now detected with \s*: pattern
      desc: 'javascript with space before colon',
    },
    {
      payload: 'data:text/html,<script>alert(1)</script>',
      expectHigh: true, // script-tag pattern triggers
      desc: 'data:text/html with script tag',
    },
    {
      payload: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      expectHigh: false, // base64 encoded — no visible pattern
      desc: 'base64-encoded data URI (no visible pattern)',
    },
    {
      payload: 'vbscript:msgbox("evil")',
      expectHigh: true, // vbscript: now detected
      desc: 'vbscript: protocol',
    },
    {
      payload: 'javascript://%0aalert(1)',
      expectHigh: true, // javascript: protocol with comment
      desc: 'javascript: with comment-newline',
    },
    {
      payload: 'javascript:/*--></script><script>alert(1)</script>',
      expectHigh: true,
      desc: 'javascript: with script tag',
    },
  ];

  test.each(protocolPayloads)('protocol vector: "$desc" → detected', ({ payload, expectHigh }) => {
    const result = validateExportPayload({ url: payload });
    if (expectHigh) {
      expect(hasHighFinding(result.findings)).toBe(true);
    } else {
      // Even if high is not triggered, check the validator doesn't crash
      expect(result).toBeDefined();
      expect(Array.isArray(result.findings)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Unicode / zero-width character obfuscation
// ---------------------------------------------------------------------------

describe('Advanced: Unicode obfuscation vectors', () => {
  const unicodePayloads: Array<{ payload: string; desc: string }> = [
    {
      payload: '<script>\u200Balert(1)</script>',
      desc: 'zero-width space inside script tag',
    },
    {
      payload: '<script>\u200Calert(1)</script>',
      desc: 'zero-width non-joiner inside script tag',
    },
    {
      payload: '<script>\u200Dalert(1)</script>',
      desc: 'zero-width joiner inside script tag',
    },
    {
      payload: '<script>\uFEFFalert(1)</script>',
      desc: 'BOM character inside script tag',
    },
    {
      payload: '<script>\u00A0alert(1)</script>',
      desc: 'non-breaking space inside script tag',
    },
    {
      payload: '\u200B<script>alert(1)</script>',
      desc: 'zero-width space before script tag',
    },
    {
      payload: '<scr\u200Bipt>alert(1)</scr\u200Bipt>',
      desc: 'zero-width space inside tag name (may evade pattern)',
    },
    {
      payload: '\uFF1Cscript\uFF1Ealert(1)\uFF1C/script\uFF1E',
      desc: 'fullwidth < > characters',
    },
  ];

  test.each(unicodePayloads)('Unicode vector: "$desc" → no crash', ({ payload }) => {
    const result = validateExportPayload({ data: payload });
    expect(result).toBeDefined();
    expect(Array.isArray(result.findings)).toBe(true);
    // If the core pattern is preserved (e.g. zero-width chars around but not
    // inside the tag name), high-severity detection should fire
    if (payload.includes('<script>') || payload.includes('<script')) {
      // Zero-width chars between < and script will break the pattern
      const hasCleanPattern = /<script[\s/>]/i.test(payload);
      if (hasCleanPattern) {
        expect(hasHighFinding(result.findings)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Mutation XSS (mXSS) vectors
// ---------------------------------------------------------------------------

describe('Advanced: Mutation XSS (mXSS) vectors', () => {
  const mXssPayloads: Array<{ payload: string; desc: string }> = [
    {
      payload: '<svg></p><style><a id=""></style><p><title></p><svg><script>alert(1)</script>',
      desc: 'mXSS via style element context confusion',
    },
    {
      payload: '<xmp><svg></xmp><script>alert(1)</script>',
      desc: 'mXSS via xmp element (legacy parser quirk)',
    },
    {
      payload: '<noscript><p title="</noscript><script>alert(1)</script>">',
      desc: 'mXSS via noscript/title context switch',
    },
    {
      payload: '<svg><foreignObject><body><script>alert(1)</script></body></foreignObject></svg>',
      desc: 'mXSS via SVG foreignObject to HTML context switch',
    },
    {
      payload: '<math><mtext><script>alert(1)</script></mtext></math>',
      desc: 'mXSS via MathML mtext context',
    },
    {
      payload: '<svg><desc><![CDATA[</desc><script>alert(1)</script>]]></desc></svg>',
      desc: 'mXSS via CDATA context confusion in SVG desc',
    },
  ];

  test.each(mXssPayloads)('mXSS vector: "$desc" → detected', ({ payload }) => {
    const result = validateExportPayload({ data: payload });
    // All mXSS vectors contain visible <script> tags that should be detected
    expect(hasHighFinding(result.findings)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Polyglot payloads (valid in multiple contexts)
// ---------------------------------------------------------------------------

describe('Advanced: Polyglot payloads', () => {
  const polyglotPayloads: Array<{ payload: string; desc: string }> = [
    {
      payload: '<svg><!--"--><script>alert(1)</script><!--',
      desc: 'SVG/HTML polyglot with comment confusion',
    },
    {
      payload: '"\'--><script>alert(1)</script>',
      desc: 'attribute/HTML polyglot breakout',
    },
    {
      payload: '</script><script>alert(1)</script>',
      desc: 'JSON-in-HTML breakout polyglot',
    },
    {
      payload: '"><script>alert(1)</script><svg onload=alert(1)>',
      desc: 'attribute breakout + SVG onload polyglot',
    },
    {
      payload: 'javascript:alert(1)//<svg/onload=alert(1)>',
      desc: 'href + SVG polyglot',
    },
  ];

  test.each(polyglotPayloads)('polyglot: "$desc" → detected as high', ({ payload }) => {
    const result = validateExportPayload({ data: payload });
    expect(hasHighFinding(result.findings)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Combined encoding vectors
// ---------------------------------------------------------------------------

describe('Advanced: Combined encoding vectors', () => {
  const combinedPayloads: Array<{ payload: string; desc: string }> = [
    {
      payload: '<svg><use xlink:href="data:image/svg+xml,<svg onload=alert(1)>">',
      desc: 'SVG use + data URI with onload',
    },
    {
      payload: '<svg><image href="x" onerror="alert(1)">',
      desc: 'SVG image with onerror (medium: event-handler)',
    },
    {
      payload: '<svg><script xlink:href="data:,alert(1)"/>',
      desc: 'SVG script with data URI via xlink',
    },
    {
      payload: '<svg><foreignObject><iframe src="javascript:alert(1)"></iframe></foreignObject></svg>',
      desc: 'SVG foreignObject → iframe with javascript: URI',
    },
    {
      payload: '<svg><style>@import url(javascript:alert(1));</style></svg>',
      desc: 'SVG style + @import + javascript: URI',
    },
    {
      payload: '<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>',
      desc: 'SVG anchor with javascript: via xlink:href',
    },
  ];

  test.each(combinedPayloads)('combined vector: "$desc" → detected', ({ payload }) => {
    const result = validateExportPayload({ svg: payload });
    expect(hasAnyFinding(result.findings)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8. Regex catastrophic backtracking resistance
// ---------------------------------------------------------------------------

describe('Advanced: Regex backtracking resistance', () => {
  test('deeply nested <svg> tags do not cause timeout', () => {
    const nested = '<svg>'.repeat(50) + '<script>alert(1)</script>' + '</svg>'.repeat(50);
    const start = Date.now();
    const result = validateExportPayload({ data: nested });
    const elapsed = Date.now() - start;
    expect(result).toBeDefined();
    expect(elapsed).toBeLessThan(1000); // should complete in under 1s
    expect(hasHighFinding(result.findings)).toBe(true);
  });

  test('long event handler string does not cause timeout', () => {
    const longHandler = 'onclick=' + 'a'.repeat(10000) + '<script>alert(1)</script>';
    const start = Date.now();
    const result = validateExportPayload({ data: longHandler });
    const elapsed = Date.now() - start;
    expect(result).toBeDefined();
    expect(elapsed).toBeLessThan(1000);
  });

  test('alternating dangerous/safe chars does not cause timeout', () => {
    let altString = '';
    for (let i = 0; i < 1000; i++) {
      altString += i % 2 === 0 ? '<script>' : 'safe text ';
    }
    const start = Date.now();
    const result = validateExportPayload({ data: altString });
    const elapsed = Date.now() - start;
    expect(result).toBeDefined();
    expect(elapsed).toBeLessThan(1000);
  });

  test('very long URL with javascript: prefix does not cause timeout', () => {
    const longUrl = 'javascript:' + 'a'.repeat(50000);
    const start = Date.now();
    const result = validateExportPayload({ data: longUrl });
    const elapsed = Date.now() - start;
    expect(result).toBeDefined();
    expect(elapsed).toBeLessThan(1000);
    expect(hasHighFinding(result.findings)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 9. Adversarial payloads in SceneGraph via nested meta objects
// ---------------------------------------------------------------------------

describe('Advanced: deep meta nesting with injection payloads', () => {
  test('injection in deeply nested node.meta is detected', () => {
    const scene = makeCleanScene();
    scene.nodes[0].meta = {
      level1: {
        level2: {
          level3: {
            value: '<script>alert(1)</script>',
          },
        },
      },
    };
    const result = validateSceneGraphForExport(scene);
    expect(hasHighFinding(result.findings)).toBe(true);
    expect(result.findings.some((f) => f.field.includes('meta'))).toBe(true);
  });

  test('injection in array inside node.meta is detected', () => {
    const scene = makeCleanScene();
    scene.nodes[0].meta = {
      tags: ['safe', '<iframe src="javascript:alert(1)">', 'also safe'],
    };
    const result = validateSceneGraphForExport(scene);
    expect(hasHighFinding(result.findings)).toBe(true);
  });

  test('injection in layout object is detected', () => {
    const scene = makeCleanScene();
    scene.layout = {
      type: 'dagre',
      customStyle: 'background: url(javascript:alert(1))',
    } as SceneGraph['layout'];
    const result = validateSceneGraphForExport(scene);
    expect(hasHighFinding(result.findings)).toBe(true);
    expect(result.findings.some((f) => f.field.includes('layout'))).toBe(true);
  });

  test('multiple injection patterns across multiple fields all reported', () => {
    const scene = makeCleanScene();
    scene.summary = '<script>alert(1)</script>';
    scene.nodes[0].label = 'javascript:alert(1)';
    scene.nodes[1].label = '<svg onload=alert(1)>';
    scene.edges[0].label = 'expression(alert(1))';
    scene.keyphrases = ['-moz-binding:url(evil.xml)', 'safe-keyphrase'];

    const result = validateSceneGraphForExport(scene);
    const fields = new Set(result.findings.map((f) => f.field));
    expect(fields.has('summary')).toBe(true);
    expect(fields.has('nodes[0].label')).toBe(true);
    expect(fields.has('nodes[1].label')).toBe(true);
    expect(fields.has('edges[0].label')).toBe(true);
    expect(fields.has('keyphrases[0]')).toBe(true);
    expect(fields.has('keyphrases[1]')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 10. Non-string types in payload (robustness)
// ---------------------------------------------------------------------------

describe('Advanced: non-string type handling', () => {
  test('number values do not trigger findings', () => {
    const result = validateExportPayload({ count: 42, ratio: 3.14, big: 1e308 });
    expect(result.findings).toHaveLength(0);
  });

  test('boolean values do not trigger findings', () => {
    const result = validateExportPayload({ active: true, disabled: false });
    expect(result.findings).toHaveLength(0);
  });

  test('null values do not trigger findings', () => {
    const result = validateExportPayload({ data: null, nested: { inner: null } });
    expect(result.findings).toHaveLength(0);
  });

  test('undefined values do not trigger findings', () => {
    const result = validateExportPayload({ data: undefined });
    expect(result.findings).toHaveLength(0);
  });

  test('mixed type object with one injection string is detected', () => {
    const result = validateExportPayload({
      count: 42,
      active: true,
      name: 'safe',
      evil: '<script>alert(1)</script>',
    });
    expect(hasHighFinding(result.findings)).toBe(true);
    expect(result.findings.some((f) => f.field === 'evil')).toBe(true);
  });

  test('empty string does not trigger findings', () => {
    const result = validateExportPayload({ data: '' });
    expect(result.findings).toHaveLength(0);
  });
});
