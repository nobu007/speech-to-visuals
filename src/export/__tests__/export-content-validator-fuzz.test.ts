/**
 * Fuzz tests targeting ExportContentValidator with adversarial SVG/CSS payloads.
 *
 * Generates randomized, mutated, and obfuscated injection payloads beyond the
 * static OWASP pattern list to verify detection coverage of:
 * - validateSceneGraphForExport
 * - validateExportPayload
 *
 * Test strategy:
 *   1. Static adversarial payloads (hand-crafted) → assert detection (always)
 *   2. Obfuscated payloads (case-flip, wrap, prepend, append) → assert detection
 *      because the core pattern is preserved
 *   3. Destructive mutations (char replacement, mid-string insertion) → assert
 *      no-crash only; the mutation may break the pattern itself
 *   4. Clean content → assert no false positives
 *   5. DoS resistance → assert no hang/crash on large/deep input
 *
 * Seed configuration: uses FUZZ_SEED env var (same convention as sanitize-fuzz.test.ts)
 */

import {
  validateSceneGraphForExport,
  validateExportPayload,
} from '../export-content-validator';
import type { SceneGraph } from '../../types/diagram';

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32)
// ---------------------------------------------------------------------------

function resolveFuzzSeed(): number {
  const envSeed = process.env.FUZZ_SEED;
  if (envSeed === undefined) return 0xFEEDFACE;
  if (envSeed === 'random') return (Math.random() * 0xFFFFFFFF) >>> 0;
  const parsed = parseInt(envSeed, 10);
  return Number.isNaN(parsed) ? 0xFEEDFACE : parsed >>> 0;
}

const FUZZ_SEED = resolveFuzzSeed();

function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(FUZZ_SEED);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randomInt(max: number): number {
  return Math.floor(rng() * max);
}

function randomString(len: number, charset: string): string {
  let s = '';
  for (let i = 0; i < len; i++) {
    s += charset[randomInt(charset.length)];
  }
  return s;
}

// ---------------------------------------------------------------------------
// Adversarial payload bases
// ---------------------------------------------------------------------------

/** Payloads that SHOULD trigger high-severity findings */
const HIGH_SEVERITY_BASES: string[] = [
  '<script>alert(1)</script>',
  '<SCRIPT SRC=//evil.com></SCRIPT>',
  '<img src=x onerror=alert(1)>',
  '<IMG SRC=x onerror="alert(document.cookie)">',
  '<svg onload=alert(1)>',
  '<svg/onload=alert(1)>',
  '<svg><script>alert(1)</script></svg>',
  '<iframe src="javascript:alert(1)">',
  '<IFRAME SRC=//evil.com></IFRAME>',
  '<embed src="data:text/html,<script>alert(1)</script>">',
  '<object data="javascript:alert(1)">',
  'javascript:alert(document.cookie)',
  'JavaScript:alert(1)',
  'javascript:void(alert(1))',
  ') Tj (evil',
  'text) Tj (more',
  'expression(alert(1))',
  'expression(window.location="//evil.com")',
  '-moz-binding:url(evil.xml)',
  '-moz-binding: url("http://evil.com/xbl.xml")',
  'background:url(javascript:alert(1))',
  'background: url("javascript:alert(1)")',
  'list-style-image:url(javascript:alert(1))',
];

/** Payloads that SHOULD trigger medium-severity findings (and NOT high) */
const MEDIUM_SEVERITY_BASES: string[] = [
  'onclick=alert(1)',
  'onload=alert(1)',
  'onerror=alert(1)',
  'onmouseover=alert(1)',
  'onfocus=alert(1)',
  'onblur=alert(1)',
  '<a href="data:text/html,evil">x</a>',
  '<meta http-equiv="refresh" content="0;url=evil">',
  '<meta charset="x">',
  'text\0evil',
  '@import url("https://evil.com/exfil.css")',
  'behavior:url(evil.htc)',
  'behavior: url(#default#userdata)',
  'url(data:text/html,<h1>evil</h1>)',
];

// ---------------------------------------------------------------------------
// Obfuscation functions (preserve core pattern)
// ---------------------------------------------------------------------------

const SAFE_PREFIXES = ['', 'xxx', 'data:', '\n', '\t', '   ', '>>>', 'abc'];
const SAFE_SUFFIXES = ['', 'xxx', '\n', '\t', '   ', '<<<', 'rest of text'];

/**
 * Obfuscate a payload in ways that PRESERVE the core injection pattern.
 * The validator should still detect these because the key regex pattern survives.
 */
function obfuscatePayload(base: string): string {
  const method = randomInt(5);
  switch (method) {
    case 0: // prepend benign prefix
      return pick(SAFE_PREFIXES) + base;
    case 1: // append benign suffix
      return base + pick(SAFE_SUFFIXES);
    case 2: { // case-flip the entire string (regexes are case-insensitive)
      return base
        .split('')
        .map((c) => (rng() > 0.5 ? c.toUpperCase() : c.toLowerCase()))
        .join('');
    }
    case 3: { // wrap in benign HTML tags (pattern still present inside)
      const tag = pick(['div', 'span', 'p', 'b', 'i']);
      return `<${tag}>${base}</${tag}>`;
    }
    default: { // duplicate the payload (pattern appears twice)
      return base + ' some text ' + base;
    }
  }
}

/**
 * Destructively mutate a payload — may break the core pattern.
 * Used for DoS/crash resistance testing, not detection coverage.
 */
function destructiveMutate(base: string): string {
  const DANGEROUS_CHARS = '<>&"\'\\(){}[];:/#=.\0\r\n\t';
  const mutation = randomInt(3);
  switch (mutation) {
    case 0: { // replace a random char with a dangerous one
      const p = randomInt(base.length);
      const dangerousChar = DANGEROUS_CHARS[randomInt(DANGEROUS_CHARS.length)];
      return base.slice(0, p) + dangerousChar + base.slice(p + 1);
    }
    case 1: { // insert a random dangerous char at a random position
      const p = randomInt(base.length);
      const dangerousChar = DANGEROUS_CHARS[randomInt(DANGEROUS_CHARS.length)];
      return base.slice(0, p) + dangerousChar + base.slice(p);
    }
    default: { // replace multiple chars
      let result = base;
      const numReplacements = randomInt(5) + 1;
      for (let i = 0; i < numReplacements; i++) {
        const p = randomInt(result.length);
        const dangerousChar = DANGEROUS_CHARS[randomInt(DANGEROUS_CHARS.length)];
        result = result.slice(0, p) + dangerousChar + result.slice(p + 1);
      }
      return result;
    }
  }
}

function generateObfuscated(bases: string[], count: number): string[] {
  return Array.from({ length: count }, () => obfuscatePayload(pick(bases)));
}

function generateDestructive(bases: string[], count: number): string[] {
  return Array.from({ length: count }, () => destructiveMutate(pick(bases)));
}

// Generate test payload sets
const OBFUSCATED_HIGH = generateObfuscated(HIGH_SEVERITY_BASES, 100);
const OBFUSCATED_MEDIUM = generateObfuscated(MEDIUM_SEVERITY_BASES, 80);
const DESTRUCTIVE_HIGH = generateDestructive(HIGH_SEVERITY_BASES, 80);
const RANDOM_DANGEROUS: string[] = [];
for (let i = 0; i < 30; i++) {
  RANDOM_DANGEROUS.push(randomString(randomInt(60) + 1, '<>&"\'\\(){}[];:/#=.\0\r\n\t '));
}

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
    edges: [
      { from: 'node-1', to: 'node-2', label: 'next' },
    ],
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
// Tests: static adversarial payloads (always detected)
// ---------------------------------------------------------------------------

describe('Fuzz: static high-severity adversarial payloads', () => {
  test.each(HIGH_SEVERITY_BASES)('static payload #%#: detected as high', (payload) => {
    const result = validateExportPayload({ field: payload });
    expect(hasHighFinding(result.findings)).toBe(true);
    expect(result.passed).toBe(true); // non-strict mode
  });

  test.each(HIGH_SEVERITY_BASES)('static payload #%#: blocks in strict mode', (payload) => {
    const result = validateExportPayload({ field: payload }, undefined, { strict: true });
    expect(result.passed).toBe(false);
  });
});

describe('Fuzz: static medium-severity adversarial payloads', () => {
  test.each(MEDIUM_SEVERITY_BASES)('static payload #%#: detected', (payload) => {
    const result = validateExportPayload({ field: payload });
    expect(hasAnyFinding(result.findings)).toBe(true);
  });

  test.each(MEDIUM_SEVERITY_BASES)('static payload #%#: passes in strict mode', (payload) => {
    const result = validateExportPayload({ field: payload }, undefined, { strict: true });
    expect(result.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: obfuscated payloads (pattern preserved → must detect)
// ---------------------------------------------------------------------------

describe('Fuzz: obfuscated high-severity payloads detected', () => {
  test.each(OBFUSCATED_HIGH)('obfuscated high payload #%#: detected as high', (payload) => {
    const result = validateExportPayload({ field: payload });
    expect(hasHighFinding(result.findings)).toBe(true);
  });

  test.each(OBFUSCATED_HIGH)('obfuscated high payload #%#: blocks in strict mode', (payload) => {
    const result = validateExportPayload({ field: payload }, undefined, { strict: true });
    expect(result.passed).toBe(false);
  });
});

describe('Fuzz: obfuscated medium-severity payloads detected', () => {
  test.each(OBFUSCATED_MEDIUM)('obfuscated medium payload #%#: detected', (payload) => {
    const result = validateExportPayload({ field: payload });
    expect(hasAnyFinding(result.findings)).toBe(true);
    // If this payload accidentally triggers a high finding, that's OK — it
    // means the obfuscation revealed a pattern overlap. We just verify detection.
  });
});

// ---------------------------------------------------------------------------
// Tests: obfuscated payloads in SceneGraph fields
// ---------------------------------------------------------------------------

describe('Fuzz: obfuscated payloads in SceneGraph node labels', () => {
  test.each(OBFUSCATED_HIGH.slice(0, 40))('node label #%#: detected as high', (payload) => {
    const scene = makeCleanScene();
    scene.nodes[0].label = payload;
    const result = validateSceneGraphForExport(scene);
    expect(hasHighFinding(result.findings)).toBe(true);
    expect(result.findings.some((f) => f.field === 'nodes[0].label')).toBe(true);
  });
});

describe('Fuzz: obfuscated payloads in SceneGraph summary', () => {
  test.each(OBFUSCATED_HIGH.slice(40, 80))('summary #%#: detected as high', (payload) => {
    const scene = makeCleanScene();
    scene.summary = payload;
    const result = validateSceneGraphForExport(scene);
    expect(hasHighFinding(result.findings)).toBe(true);
    expect(result.findings.some((f) => f.field === 'summary')).toBe(true);
  });
});

describe('Fuzz: obfuscated payloads in SceneGraph edge labels', () => {
  test.each(OBFUSCATED_HIGH.slice(80, 100))('edge label #%#: detected as high', (payload) => {
    const scene = makeCleanScene();
    scene.edges[0].label = payload;
    const result = validateSceneGraphForExport(scene);
    expect(hasHighFinding(result.findings)).toBe(true);
    expect(result.findings.some((f) => f.field === 'edges[0].label')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: obfuscated payloads in nested objects
// ---------------------------------------------------------------------------

describe('Fuzz: obfuscated payloads at arbitrary depth', () => {
  test.each(OBFUSCATED_HIGH.slice(0, 30))('nested depth 3 #%#: detected', (payload) => {
    const result = validateExportPayload({
      level1: { level2: { level3: { value: payload } } },
    });
    expect(hasHighFinding(result.findings)).toBe(true);
  });

  test.each(OBFUSCATED_HIGH.slice(30, 60))('array-nested #%#: detected', (payload) => {
    const result = validateExportPayload({
      items: [{ id: 'safe' }, { id: 'evil', value: payload }],
    });
    expect(hasHighFinding(result.findings)).toBe(true);
  });

  test.each(OBFUSCATED_HIGH.slice(60, 90))('meta-nested #%#: detected', (payload) => {
    const result = validateExportPayload({
      scene: { nodes: [{ meta: { custom: { description: payload } } }] },
    });
    expect(hasHighFinding(result.findings)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: SceneGraph node.meta with obfuscated payloads
// ---------------------------------------------------------------------------

describe('Fuzz: obfuscated payloads in node.meta', () => {
  test.each(OBFUSCATED_HIGH.slice(0, 30))('meta #%#: detected', (payload) => {
    const scene = makeCleanScene();
    scene.nodes[0].meta = { description: payload, icon: 'safe' };
    const result = validateSceneGraphForExport(scene);
    expect(hasHighFinding(result.findings)).toBe(true);
    expect(result.findings.some((f) => f.field.includes('meta'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: multi-field injection in SceneGraph
// ---------------------------------------------------------------------------

describe('Fuzz: multi-field injection reports all findings', () => {
  test.each(OBFUSCATED_HIGH.slice(0, 20))('multi-field #%#: all fields detected', (payload) => {
    const scene = makeCleanScene();
    scene.nodes[0].label = payload;
    scene.summary = payload;
    scene.edges[0].label = payload;
    const result = validateSceneGraphForExport(scene);
    const fields = new Set(result.findings.map((f) => f.field));
    expect(fields.has('nodes[0].label')).toBe(true);
    expect(fields.has('summary')).toBe(true);
    expect(fields.has('edges[0].label')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: SVG-specific obfuscation vectors (static)
// ---------------------------------------------------------------------------

describe('Fuzz: SVG-specific injection vectors', () => {
  const svgPayloads: Array<{ payload: string; expectHigh: boolean }> = [
    { payload: '<svg><script>alert(1)</script></svg>', expectHigh: true },
    { payload: '<svg onload=alert(1)>', expectHigh: true },
    { payload: '<svg/onload=alert(1)>', expectHigh: true },
    { payload: '<svg><use xlink:href="data:image/svg+xml,<svg onload=alert(1)>">', expectHigh: true },
    { payload: '<svg><foreignObject><script>alert(1)</script></foreignObject></svg>', expectHigh: true },
    { payload: '<svg><desc><![CDATA[<script>alert(1)</script>]]></desc></svg>', expectHigh: true },
    { payload: '<svg><style>@import url(javascript:alert(1));</style></svg>', expectHigh: true },
    { payload: '<svg><image href="x" onerror="alert(1)">', expectHigh: false }, // medium: event-handler
  ];

  test.each(svgPayloads)('SVG vector #%#: detected', ({ payload, expectHigh }) => {
    const result = validateExportPayload({ svg: payload });
    expect(hasAnyFinding(result.findings)).toBe(true);
    if (expectHigh) {
      expect(hasHighFinding(result.findings)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: CSS-specific obfuscation vectors (static)
// ---------------------------------------------------------------------------

describe('Fuzz: CSS-specific injection vectors', () => {
  const cssPayloads: Array<{ payload: string; expectHigh: boolean }> = [
    { payload: 'width: expression(alert(1))', expectHigh: true },
    { payload: 'background: -moz-binding: url(evil.xml)', expectHigh: true },
    { payload: 'background-image: url(javascript:alert(1))', expectHigh: true },
    { payload: 'list-style-image: url(javascript:alert(1))', expectHigh: true },
    { payload: 'cursor: url(javascript:alert(1)), auto', expectHigh: true },
    { payload: 'border-image: url(javascript:alert(1))', expectHigh: true },
    { payload: '@import url("https://evil.com/exfil.css")', expectHigh: false }, // medium
    { payload: 'behavior: url(evil.htc)', expectHigh: false }, // medium
    { payload: 'content: url(data:text/html,<script>alert(1)</script>)', expectHigh: true }, // has <script>
  ];

  test.each(cssPayloads)('CSS vector #%#: detected', ({ payload, expectHigh }) => {
    const result = validateExportPayload({ style: payload });
    expect(hasAnyFinding(result.findings)).toBe(true);
    if (expectHigh) {
      expect(hasHighFinding(result.findings)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: destructive mutations (no-crash guarantee)
// ---------------------------------------------------------------------------

describe('Fuzz: destructive mutations do not crash validator', () => {
  test.each(DESTRUCTIVE_HIGH)('destructive payload #%#: no crash', (payload) => {
    const result = validateExportPayload({ field: payload });
    expect(result).toBeDefined();
    expect(result.passed).toBe(true); // non-strict always passes
    expect(Array.isArray(result.findings)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: random dangerous strings (exploratory fuzz)
// ---------------------------------------------------------------------------

describe('Fuzz: random dangerous charset strings do not crash', () => {
  test.each(RANDOM_DANGEROUS)('random string #%#: no crash', (payload) => {
    const result = validateExportPayload({ data: payload });
    expect(result).toBeDefined();
    expect(result.passed).toBe(true);
    expect(Array.isArray(result.findings)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: clean content → no false positives
// ---------------------------------------------------------------------------

describe('Fuzz: benign content does not trigger false positives', () => {
  const benignStrings = [
    'A diagram showing (x > 0) & (y < 10)',
    'The process flows from A to B',
    'User clicks "Submit" button',
    'Response time: 200ms (good)',
    'Configuration: { "key": "value" }',
    'Path: /api/v1/export/artifacts',
    'CSS selector: div > span.class',
    'Math: 5 < 10 && 10 > 5',
    'Array[0] = value; Array[1] = other',
    'Title: "Hello World"',
    'Function call: render(1, 2, 3)',
    'URL: https://example.com/path?key=value',
    'Normal text with (parentheses) and "quotes"',
    'Expression: a + b = c',
    'HTML entities: &amp; &lt; &gt;',
  ];

  test.each(benignStrings)('benign #%#: no findings', (text) => {
    const scene = makeCleanScene();
    scene.summary = text;
    scene.nodes[0].label = text;
    const result = validateSceneGraphForExport(scene);
    expect(result.findings).toHaveLength(0);
    expect(result.passed).toBe(true);
  });

  const cleanPayloads = [
    { scenes: [{ id: 's1', label: 'Start', duration: 5.0 }] },
    { config: { format: 'svg', quality: 'high' } },
    { data: { nodes: 10, edges: 5, title: 'My Diagram' } },
    { metadata: { author: 'user', created: '2024-01-01' } },
    { items: ['apple', 'banana', 'cherry'] },
    { nested: { deep: { value: 42 } } },
  ];

  test.each(cleanPayloads)('clean payload #%#: no findings', (payload) => {
    const result = validateExportPayload(payload);
    expect(result.findings).toHaveLength(0);
    expect(result.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: DoS resistance
// ---------------------------------------------------------------------------

describe('Fuzz: validator DoS resistance', () => {
  test('deeply nested object (depth > 10) does not crash', () => {
    let obj: Record<string, unknown> = { evil: '<script>alert(1)</script>' };
    for (let i = 0; i < 100; i++) {
      obj = { child: obj };
    }
    const result = validateExportPayload(obj);
    expect(result).toBeDefined();
    expect(result.passed).toBe(true);
  });

  test('wide object with 1000 keys does not crash', () => {
    const wide: Record<string, string> = {};
    for (let i = 0; i < 1000; i++) {
      wide[`key${i}`] = i % 100 === 0 ? '<script>alert(1)</script>' : 'safe';
    }
    const result = validateExportPayload(wide);
    expect(result).toBeDefined();
    expect(result.findings.length).toBeGreaterThan(0);
  });

  test('large array of payloads does not crash', () => {
    const arr = OBFUSCATED_HIGH.slice(0, 50).map((p) => ({ value: p }));
    const result = validateExportPayload({ items: arr });
    expect(result).toBeDefined();
    expect(result.findings.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: seed configuration
// ---------------------------------------------------------------------------

describe('Fuzz seed configuration', () => {
  test('seed is configurable via FUZZ_SEED env var', () => {
    const orig = process.env.FUZZ_SEED;
    delete process.env.FUZZ_SEED;
    expect(resolveFuzzSeed()).toBe(0xFEEDFACE);
    process.env.FUZZ_SEED = '12345';
    expect(resolveFuzzSeed()).toBe(12345);
    process.env.FUZZ_SEED = 'random';
    const randomSeed = resolveFuzzSeed();
    expect(randomSeed).toBeGreaterThanOrEqual(0);
    expect(randomSeed).toBeLessThanOrEqual(0xFFFFFFFF);
    if (orig === undefined) {
      delete process.env.FUZZ_SEED;
    } else {
      process.env.FUZZ_SEED = orig;
    }
  });
});
