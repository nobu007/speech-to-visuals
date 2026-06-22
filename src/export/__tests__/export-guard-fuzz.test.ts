/**
 * REQ-251: Export Guard Function Fuzz Tests
 *
 * Dedicated fuzz tests for export guard functions with multi-seed support.
 * Tests validateExportPayload, validateSceneGraphForExport, and sanitizeFilename
 * against randomly generated malicious inputs to ensure robust detection.
 *
 * Uses mulberry32 PRNG for deterministic runs and FUZZ_SEEDS env var for
 * additional random-seed iterations in CI.
 */

import {
  validateExportPayload,
  validateSceneGraphForExport,
} from '../export-content-validator';
import { sanitizeFilename } from '../../utils/sanitize';
import type { SceneGraph } from '../../types/diagram';

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32)
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Payload building blocks for fuzz generation
// ---------------------------------------------------------------------------
const DANGEROUS_TAGS = [
  '<script>', '<script/>', '<script src=x>', '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>', '<iframe src=//evil>', '<embed src=//evil>',
  '<object data=//evil>', '<base href=//evil>', '<foreignObject>',
  '<marquee onstart=alert(1)>', '<isindex onclick=alert(1)>',
  '<meta http-equiv=refresh>', '<form><button formaction=javascript:alert(1)>',
];

const DANGEROUS_PROTOCOLS = [
  'javascript:alert(1)', 'javascript:void(0)', 'vbscript:msgbox(1)',
  'data:text/html,<script>alert(1)</script>',
  'data:image/svg+xml,<svg onload=alert(1)>',
];

const DANGEROUS_CSS = [
  'expression(alert(1))', '-moz-binding:url(//evil/xbl.xml)',
  '@import url(//evil/evil.css)', 'behavior:url(//evil.htc)',
  'url(javascript:alert(1))', 'url(data:text/html,<script>alert(1)</script>)',
];

const EVENT_VECTORS = [
  'onclick=alert(1)', 'onload=alert(1)', 'onerror=alert(1)',
  'onmouseover=alert(1)', 'onfocus=alert(1)', 'onpointerdown=alert(1)',
  'ontouchstart=alert(1)', 'onkeydown=alert(1)',
];

const PATH_TRAVERSAL_VECTORS = [
  '../../../etc/passwd', '..\\\\..\\\\windows\\\\system32',
  '..%2f..%2f..%2f', '/etc/passwd', '\\\\server\\share\\file',
  './hidden', '.bashrc', '....//....//etc/passwd',
  '\x00../../../etc/passwd', 'file\x00name',
];

const ALL_VECTORS = [
  ...DANGEROUS_TAGS, ...DANGEROUS_PROTOCOLS, ...DANGEROUS_CSS,
  ...EVENT_VECTORS, ...PATH_TRAVERSAL_VECTORS,
];

// ---------------------------------------------------------------------------
// Fuzz helpers
// ---------------------------------------------------------------------------
function pickRandom<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randomString(rng: () => number, maxLen = 50): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789-_./\\<>"\'=;:(){}';
  const len = Math.floor(rng() * maxLen) + 1;
  let result = '';
  for (let i = 0; i < len; i++) {
    result += chars[Math.floor(rng() * chars.length)];
  }
  return result;
}

function injectVector(rng: () => number, base: string, vector: string): string {
  const pos = Math.floor(rng() * (base.length + 1));
  return base.slice(0, pos) + vector + base.slice(pos);
}

function createSafeSceneGraph(): SceneGraph {
  return {
    id: 'scene-001',
    title: 'System Architecture Overview',
    summary: 'A flow diagram showing the main system components',
    content: 'The system processes audio input through multiple stages',
    diagramType: 'flow',
    nodes: [
      { id: 'node-1', label: 'Audio Input', type: 'input' },
      { id: 'node-2', label: 'Transcription', type: 'process' },
      { id: 'node-3', label: 'Analysis', type: 'process' },
      { id: 'node-4', label: 'Video Output', type: 'output' },
    ],
    edges: [
      { from: 'node-1', to: 'node-2', label: 'audio data' },
      { from: 'node-2', to: 'node-3', label: 'text' },
      { from: 'node-3', to: 'node-4', label: 'scenes' },
    ],
  };
}

// Fields in SceneGraph that accept user content and are checked by the validator
const STRING_FIELDS: Array<{ key: string; getter: (s: SceneGraph) => string; setter: (s: SceneGraph, v: string) => void }> = [
  { key: 'id', getter: s => s.id, setter: (s, v) => { s.id = v; } },
  { key: 'title', getter: s => s.title, setter: (s, v) => { s.title = v; } },
  { key: 'summary', getter: s => s.summary, setter: (s, v) => { s.summary = v; } },
  { key: 'content', getter: s => s.content, setter: (s, v) => { s.content = v; } },
  { key: 'node[0].label', getter: s => s.nodes[0].label, setter: (s, v) => { s.nodes[0].label = v; } },
  { key: 'node[0].id', getter: s => s.nodes[0].id, setter: (s, v) => { s.nodes[0].id = v; } },
  { key: 'edge[0].label', getter: s => s.edges[0].label, setter: (s, v) => { s.edges[0].label = v; } },
];

// ---------------------------------------------------------------------------
// Seeds: deterministic + optional CI random seeds
// ---------------------------------------------------------------------------
const SEEDS: number[] = [42, 12345, 999983];
const fuzzSeedsEnv = process.env.FUZZ_SEEDS;
if (fuzzSeedsEnv) {
  const count = parseInt(fuzzSeedsEnv, 10);
  for (let i = 0; i < count; i++) {
    SEEDS.push(Math.floor(Math.random() * 0xFFFFFFFF));
  }
}

const ITERATIONS = 50;

// ===========================================================================
// validateSceneGraphForExport fuzz tests
// ===========================================================================
SEEDS.forEach((seed, seedIdx) => {
  describe(`REQ-251: validateSceneGraphForExport fuzz (seed=${seed}, #${seedIdx})`, () => {
    const rng = mulberry32(seed);

    for (let i = 0; i < ITERATIONS; i++) {
      const vector = pickRandom(rng, ALL_VECTORS);
      const field = pickRandom(rng, STRING_FIELDS);
      const baseValue = field.getter(createSafeSceneGraph());
      const injectMode = Math.floor(rng() * 3);
      let maliciousValue: string;
      let description: string;

      if (injectMode === 0) {
        maliciousValue = vector;
        description = `replace ${field.key} with "${vector.slice(0, 30)}"`;
      } else if (injectMode === 1) {
        maliciousValue = injectVector(rng, baseValue, vector);
        description = `inject "${vector.slice(0, 30)}" into ${field.key}`;
      } else {
        // Combine two vectors
        const v2 = pickRandom(rng, ALL_VECTORS);
        maliciousValue = vector + baseValue + v2;
        description = `combine "${vector.slice(0, 20)}" + "${v2.slice(0, 20)}" in ${field.key}`;
      }

      test(`iter ${i}: ${description}`, () => {
        const scene = createSafeSceneGraph();
        field.setter(scene, maliciousValue);
        const result = validateSceneGraphForExport(scene);
        // Safe baseline (no vector injected) should have zero findings
        const safeScene = createSafeSceneGraph();
        const safeResult = validateSceneGraphForExport(safeScene);
        expect(safeResult.findings).toHaveLength(0);
        // If the value contains a dangerous vector, the validator should detect it
        // (unless the random injection accidentally produced a safe string)
        const isPathTraversal = PATH_TRAVERSAL_VECTORS.includes(vector);
        if (!isPathTraversal) {
          // Non-path-traversal vectors should always be detected
          expect(result.findings.length).toBeGreaterThan(0);
        }
      });
    }
  });
});

// ===========================================================================
// validateExportPayload fuzz tests (nested objects)
// ===========================================================================
SEEDS.forEach((seed, seedIdx) => {
  describe(`REQ-251: validateExportPayload fuzz (seed=${seed}, #${seedIdx})`, () => {
    const rng = mulberry32(seed);

    for (let i = 0; i < ITERATIONS; i++) {
      const vector = pickRandom(rng, [...DANGEROUS_TAGS, ...DANGEROUS_PROTOCOLS, ...DANGEROUS_CSS, ...EVENT_VECTORS]);
      const nestingDepth = Math.floor(rng() * 3);
      const keyName = pickRandom(rng, ['id', 'title', 'content', 'label', 'summary', 'description', 'metadata']);

      test(`iter ${i}: nested(depth=${nestingDepth}) ${keyName}="${vector.slice(0, 30)}"`, () => {
        let payload: unknown = vector;
        for (let d = 0; d < nestingDepth; d++) {
          payload = { [pickRandom(rng, ['data', 'scene', 'node', 'edge', 'meta'])]: payload };
        }
        const wrapper = { [keyName]: payload };
        const result = validateExportPayload(wrapper, 'guard-fuzz-test');
        // Non-path-traversal dangerous content should be detected
        expect(result.findings.length).toBeGreaterThan(0);
      });
    }
  });
});

// ===========================================================================
// sanitizeFilename fuzz tests
// ===========================================================================
SEEDS.forEach((seed, seedIdx) => {
  describe(`REQ-251: sanitizeFilename fuzz (seed=${seed}, #${seedIdx})`, () => {
    const rng = mulberry32(seed);

    for (let i = 0; i < ITERATIONS; i++) {
      const mode = Math.floor(rng() * 4);
      let input: string;
      let description: string;

      if (mode === 0) {
        input = pickRandom(rng, PATH_TRAVERSAL_VECTORS);
        description = `path traversal: "${input.slice(0, 30)}"`;
      } else if (mode === 1) {
        // Random control chars + normal text
        const ctrl = String.fromCharCode(Math.floor(rng() * 32));
        input = 'file' + ctrl + pickRandom(rng, PATH_TRAVERSAL_VECTORS);
        description = `control chars + traversal`;
      } else if (mode === 2) {
        // Pure random string
        input = randomString(rng, 100);
        description = `random string len=${input.length}`;
      } else {
        // Null byte injection
        input = 'safe\x00../../etc/passwd';
        description = `null byte injection`;
      }

      test(`iter ${i}: ${description}`, () => {
        const result = sanitizeFilename(input);

        // Guard assertions: sanitized result must never contain:
        expect(result).not.toContain('..');      // No parent directory traversal
        expect(result).not.toContain('/');        // No forward slash
        expect(result).not.toContain('\\');       // No backslash
        expect(result).not.toContain('\0');       // No null bytes
        expect(result.length).toBeGreaterThan(0); // Never empty (fallback to 'unnamed')

        // Check no control characters remain
        for (let c = 0; c < 32; c++) {
          expect(result).not.toContain(String.fromCharCode(c));
        }
        expect(result).not.toContain(String.fromCharCode(0x7f));
      });
    }
  });
});

// ===========================================================================
// Cross-guard: validateExportPayload + sanitizeFilename combined
// ===========================================================================
SEEDS.forEach((seed, seedIdx) => {
  describe(`REQ-251: cross-guard combined fuzz (seed=${seed}, #${seedIdx})`, () => {
    const rng = mulberry32(seed);

    for (let i = 0; i < 20; i++) {
      test(`iter ${i}: scene with malicious id + content`, () => {
        const vector1 = pickRandom(rng, [...DANGEROUS_TAGS, ...DANGEROUS_PROTOCOLS]);
        const vector2 = pickRandom(rng, PATH_TRAVERSAL_VECTORS);

        const scene = createSafeSceneGraph();
        scene.id = vector2;               // path traversal in id
        scene.content = vector1;           // XSS vector in content
        scene.nodes[0].id = vector1;       // XSS in node id

        // validateSceneGraphForExport should detect XSS (may or may not flag path traversal)
        const validateResult = validateSceneGraphForExport(scene);
        expect(validateResult.findings.length).toBeGreaterThan(0);

        // sanitizeFilename should neutralize path traversal
        const sanitizedId = sanitizeFilename(scene.id);
        expect(sanitizedId).not.toContain('..');
        expect(sanitizedId).not.toContain('/');
        expect(sanitizedId).not.toContain('\\');
      });
    }
  });
});

// ===========================================================================
// False positive verification: safe content never triggers findings
// ===========================================================================
describe('REQ-251: false positive verification', () => {
  const rng = mulberry32(7777);

  for (let i = 0; i < 30; i++) {
    test(`safe payload iter ${i} has zero findings`, () => {
      const scene = createSafeSceneGraph();
      // Modify with only safe characters
      const safeText = randomString(rng, 30).replace(/[<>"'=/\\]/g, 'X');
      const field = pickRandom(rng, STRING_FIELDS);
      field.setter(scene, safeText);

      const result = validateSceneGraphForExport(scene);
      expect(result.findings).toHaveLength(0);
    });
  }
});
