/**
 * REQ-245: Property-Based Mutation Fuzzing Regression Net
 *
 * Takes known-good export payloads (CSV/JSON scene data), systematically
 * mutates them by injecting XSS vectors at various positions, and asserts
 * that every mutation either:
 *   (a) is caught by ExportContentValidator (findings.length > 0), OR
 *   (b) is genuinely safe (mutation didn't introduce dangerous content)
 *
 * This creates a fuzzing regression net: if a future code change weakens
 * the validator, these tests will fail because mutations that were
 * previously caught will now pass through undetected.
 */

import {
  validateExportPayload,
  validateSceneGraphForExport,
} from '../export-content-validator';
import type { SceneGraph } from '../../types/diagram';
import { mulberry32 } from '@tests/helpers/fuzz';

// ---------------------------------------------------------------------------
// Known-good baseline payloads
// ---------------------------------------------------------------------------
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

function createSafeJsonPayload(): Record<string, unknown> {
  return {
    format: 'json',
    metadata: { version: '1.0', author: 'system' },
    scenes: [
      { id: 's1', title: 'Introduction', timestamp: 0 },
      { id: 's2', title: 'Main Content', timestamp: 5.2 },
    ],
    keyphrases: ['audio processing', 'visualization', 'animation'],
  };
}

// ---------------------------------------------------------------------------
// XSS mutation vectors to inject
// ---------------------------------------------------------------------------
const XSS_VECTORS: Array<{ payload: string; pattern: string; minSeverity: 'high' | 'medium' }> = [
  { payload: '<script>alert(1)</script>', pattern: 'script-tag', minSeverity: 'high' },
  { payload: '<img src=x onerror=alert(1)>', pattern: 'img-onerror', minSeverity: 'high' },
  { payload: '<svg onload=alert(1)>', pattern: 'svg-onload', minSeverity: 'high' },
  { payload: '<iframe src=//evil.com></iframe>', pattern: 'iframe-tag', minSeverity: 'high' },
  { payload: 'javascript:alert(1)', pattern: 'javascript-protocol', minSeverity: 'high' },
  { payload: '<script/src=//evil.com>', pattern: 'script-tag', minSeverity: 'high' },
  { payload: '<embed src=//evil.com>', pattern: 'embed-tag', minSeverity: 'high' },
  { payload: '<object data=//evil.com>', pattern: 'object-tag', minSeverity: 'high' },
  { payload: 'expression(alert(1))', pattern: 'css-expression', minSeverity: 'high' },
  { payload: '<div onclick=alert(1)>click</div>', pattern: 'event-handler', minSeverity: 'medium' },
  { payload: '<div onmouseover=alert(1)>hover</div>', pattern: 'event-handler', minSeverity: 'medium' },
  { payload: '<div onload=alert(1)>load</div>', pattern: 'event-handler', minSeverity: 'medium' },
  { payload: '<a href="javascript:alert(1)">link</a>', pattern: 'dangerous-href', minSeverity: 'medium' },
  { payload: '<meta http-equiv=refresh>', pattern: 'meta-tag', minSeverity: 'medium' },
  { payload: '<style>@import url(evil.css)</style>', pattern: 'css-import', minSeverity: 'medium' },
  { payload: 'vbscript:msgbox(1)', pattern: 'vbscript-protocol', minSeverity: 'high' },
  { payload: '<base href=//evil.com>', pattern: 'base-tag', minSeverity: 'high' },
  { payload: '<div onfocus=alert(1)>focus</div>', pattern: 'event-handler', minSeverity: 'medium' },
  { payload: '<div onchange=alert(1)>change</div>', pattern: 'event-handler', minSeverity: 'medium' },
  { payload: '<div onsubmit=alert(1)>submit</div>', pattern: 'event-handler', minSeverity: 'medium' },
];

// ---------------------------------------------------------------------------
// Mutation strategies
// ---------------------------------------------------------------------------

/** Insert a payload at a random position in a string */
function mutateStringField(
  original: string,
  payload: string,
  rng: () => number,
): string {
  const pos = Math.floor(rng() * (original.length + 1));
  return original.slice(0, pos) + payload + original.slice(pos);
}

/** Deep-clone and mutate a random string field in an object */
function mutateRandomField(
  obj: Record<string, unknown>,
  payload: string,
  rng: () => number,
): { mutated: Record<string, unknown>; fieldPath: string } {
  const cloned = JSON.parse(JSON.stringify(obj));
  const stringPaths = findStringPaths(cloned);
  if (stringPaths.length === 0) {
    return { mutated: cloned, fieldPath: '<none>' };
  }
  const target = stringPaths[Math.floor(rng() * stringPaths.length)];
  const original = getNestedValue(cloned, target) as string;
  setNestedValue(cloned, target, mutateStringField(original, payload, rng));
  return { mutated: cloned, fieldPath: target };
}

function findStringPaths(obj: unknown, prefix = ''): string[] {
  const paths: string[] = [];
  if (typeof obj === 'string') {
    paths.push(prefix);
  } else if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      paths.push(...findStringPaths(obj[i], `${prefix}[${i}]`));
    }
  } else if (obj !== null && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      paths.push(...findStringPaths(v, prefix ? `${prefix}.${k}` : k));
    }
  }
  return paths;
}

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split(/\.|\[(\d+)\]/).filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function setNestedValue(obj: unknown, path: string, value: unknown): void {
  const parts = path.split(/\.|\[(\d+)\]/).filter(Boolean);
  let cur: unknown = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur = (cur as Record<string, unknown>)[parts[i]];
  }
  (cur as Record<string, unknown>)[parts[parts.length - 1]] = value;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const FUZZ_ITERATIONS = 50;
const SEED = 12345;

describe('REQ-245: Property-Based Mutation Fuzzing Regression Net', () => {
  describe('SceneGraph mutation fuzzing', () => {
    for (let i = 0; i < FUZZ_ITERATIONS; i++) {
      const vectorIdx = i % XSS_VECTORS.length;
      const vector = XSS_VECTORS[vectorIdx];

      it(`mutation #${i}: inject "${vector.pattern}" into safe SceneGraph → must be detected`, () => {
        const rng = mulberry32(SEED + i);
        const safe = createSafeSceneGraph();
        const { mutated, fieldPath } = mutateRandomField(
          safe as unknown as Record<string, unknown>,
          vector.payload,
          rng,
        );

        const result = validateSceneGraphForExport(
          mutated as unknown as SceneGraph,
          { strict: false },
        );

        // The mutation introduced a known XSS vector, so the validator MUST detect it
        expect(result.findings.length).toBeGreaterThan(0);
        expect(
          result.findings.some((f) => f.pattern === vector.pattern),
        ).toBe(true);
      });
    }
  });

  describe('JSON payload mutation fuzzing', () => {
    for (let i = 0; i < FUZZ_ITERATIONS; i++) {
      const vectorIdx = (i + 3) % XSS_VECTORS.length;
      const vector = XSS_VECTORS[vectorIdx];

      it(`JSON mutation #${i}: inject "${vector.pattern}" into safe JSON payload → must be detected`, () => {
        const rng = mulberry32(SEED + i + 1000);
        const safe = createSafeJsonPayload();
        const { mutated } = mutateRandomField(safe, vector.payload, rng);

        const result = validateExportPayload(mutated, 'fuzz-test');

        expect(result.findings.length).toBeGreaterThan(0);
        expect(
          result.findings.some((f) => f.pattern === vector.pattern),
        ).toBe(true);
      });
    }
  });

  describe('Safe payloads must NOT trigger findings (no false positives)', () => {
    it('safe SceneGraph should have zero findings', () => {
      const safe = createSafeSceneGraph();
      const result = validateSceneGraphForExport(safe);
      expect(result.findings).toHaveLength(0);
      expect(result.passed).toBe(true);
    });

    it('safe JSON payload should have zero findings', () => {
      const safe = createSafeJsonPayload();
      const result = validateExportPayload(safe, 'safe-test');
      expect(result.findings).toHaveLength(0);
      expect(result.passed).toBe(true);
    });

    it('safe SceneGraph with legitimate HTML-like text should not false-positive', () => {
      const scene = createSafeSceneGraph();
      scene.nodes[0].label = 'Use <angle brackets> for display';
      scene.summary = 'The < and > symbols are used in math';
      const result = validateSceneGraphForExport(scene);
      // Should not detect the innocent angle brackets as XSS
      // (no script/event handler patterns present)
      expect(
        result.findings.some((f) => f.severity === 'high'),
      ).toBe(false);
    });
  });

  describe('Strict mode blocks all high-severity mutations', () => {
    for (const vector of XSS_VECTORS.filter((v) => v.minSeverity === 'high')) {
      it(`strict mode must block "${vector.pattern}" mutation`, () => {
        const rng = mulberry32(SEED + 500);
        const safe = createSafeSceneGraph();
        const { mutated } = mutateRandomField(
          safe as unknown as Record<string, unknown>,
          vector.payload,
          rng,
        );

        const result = validateSceneGraphForExport(
          mutated as unknown as SceneGraph,
          { strict: true },
        );

        expect(result.passed).toBe(false);
        expect(
          result.findings.some((f) => f.severity === 'high'),
        ).toBe(true);
      });
    }
  });

  describe('Destructive mutations must not crash validator', () => {
    it('null/undefined fields should not crash', () => {
      const scene = createSafeSceneGraph();
      (scene as unknown as Record<string, unknown>).nodes = null;
      (scene as unknown as Record<string, unknown>).edges = undefined;
      expect(() => validateSceneGraphForExport(scene)).not.toThrow();
    });

    it('very large strings should not crash or hang', () => {
      const scene = createSafeSceneGraph();
      scene.summary = 'A'.repeat(1_000_000);
      const start = Date.now();
      const result = validateSceneGraphForExport(scene);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1000); // must complete within 1s
      expect(result.findings).toHaveLength(0);
    });

    it('deeply nested objects should not cause stack overflow', () => {
      let nested: Record<string, unknown> = { value: 'safe' };
      for (let i = 0; i < 15; i++) {
        nested = { child: nested };
      }
      expect(() => validateExportPayload(nested, 'deep-nest')).not.toThrow();
    });
  });

  describe('Multi-vector injection (defense-in-depth)', () => {
    it('should detect multiple simultaneous XSS vectors', () => {
      const rng = mulberry32(SEED + 999);
      const scene = createSafeSceneGraph();
      scene.nodes[0].label = XSS_VECTORS[0].payload;
      scene.nodes[1].label = XSS_VECTORS[5].payload;
      scene.nodes[2].label = XSS_VECTORS[9].payload;

      const result = validateSceneGraphForExport(scene);

      expect(result.findings.length).toBeGreaterThanOrEqual(3);
      const patterns = new Set(result.findings.map((f) => f.pattern));
      expect(patterns.has('script-tag')).toBe(true);
      expect(patterns.size).toBeGreaterThanOrEqual(2);
    });
  });
});

// ---------------------------------------------------------------------------
// REQ-247: Multi-Seed CI Fuzzing Mode
//
// When FUZZ_SEEDS env var is set (e.g., in CI), additional fuzzing iterations
// run with random seeds to expand the fuzzing surface beyond the fixed
// deterministic seed. This catches edge cases the fixed seed misses.
//
// Local dev (FUZZ_SEEDS unset): only fixed-seed iterations run (fast).
// CI (FUZZ_SEEDS=3): 3 additional random seeds × FUZZ_ITERATIONS each.
// ---------------------------------------------------------------------------
const CI_SEED_COUNT = (() => {
  const raw = process.env.FUZZ_SEEDS;
  if (raw === undefined) return 0;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? 0 : Math.max(0, Math.min(10, n));
})();

if (CI_SEED_COUNT > 0) {
  describe('REQ-247: Multi-Seed CI Fuzzing Mode', () => {
    // Generate random seeds from process.hrtime for each CI run.
    // These are intentionally non-deterministic across CI runs to maximize
    // the fuzzing surface over time.
    const ciSeeds: number[] = [];
    for (let i = 0; i < CI_SEED_COUNT; i++) {
      const [sec, nano] = process.hrtime();
      ciSeeds.push((sec * 1000000 + nano + i * 0x9E3779B9) >>> 0);
    }

    for (let seedIdx = 0; seedIdx < ciSeeds.length; seedIdx++) {
      const ciSeed = ciSeeds[seedIdx];

      describe(`CI random seed #${seedIdx} (0x${ciSeed.toString(16)})`, () => {
        // Run half the normal iterations per seed to keep total runtime bounded
        const ciIterations = Math.max(10, Math.floor(FUZZ_ITERATIONS / 2));

        for (let i = 0; i < ciIterations; i++) {
          const vectorIdx = i % XSS_VECTORS.length;
          const vector = XSS_VECTORS[vectorIdx];

          it(`CI fuzz seed#${seedIdx} iter#${i}: "${vector.pattern}" → detected`, () => {
            const rng = mulberry32(ciSeed + i);
            const safe = createSafeSceneGraph();
            const { mutated } = mutateRandomField(
              safe as unknown as Record<string, unknown>,
              vector.payload,
              rng,
            );

            const result = validateSceneGraphForExport(
              mutated as unknown as SceneGraph,
              { strict: false },
            );

            // Every XSS injection MUST be detected regardless of seed
            expect(result.findings.length).toBeGreaterThan(0);
            expect(
              result.findings.some((f) => f.pattern === vector.pattern),
            ).toBe(true);
          });
        }
      });
    }
  });
}

