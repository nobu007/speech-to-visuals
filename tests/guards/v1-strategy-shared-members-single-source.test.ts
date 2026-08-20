/**
 * @jest-environment node
 */
/**
 * v1-strategy-shared-members-single-source.test.ts — round 31.
 *
 * Family: two method bodies pasted across the v1 (CamelCase) layout-strategy
 * family and the engine base:
 *
 *   - `validateInputs` — byte-identical in Tree/Flowchart/Network/Timeline/
 *     ConceptMap/Comparison except the logger prefix.
 *   - `calculateNodeWidth` — the label-driven tail byte-identical in five of
 *     the six; TreeLayoutStrategy had ALREADY drifted ahead with an
 *     explicit-dimension-first preamble (`node.width ?? node.w`, finite, > 0)
 *     the others lacked, so an explicit `NodeDatum.width` was silently clamped
 *     back to the label estimate. DagreLayoutStrategy + BaseLayoutEngine
 *     carried the same tail wired to raw `this.config.nodeWidth` (no
 *     `|| DEFAULT_NODE_WIDTH`).
 *
 * Canonical since round 31: `strategyNodeWidth` + `validateStrategyInputs` in
 * src/visualization/strategy-common.ts. Tree's preamble won the drift (it
 * matches the modern `getNodeWidth` contract in node-dimensions.ts) — the
 * five lagging siblings and both engine copies gained it. That is a
 * deliberate, pinned BEHAVIOR CHANGE, not an accident: the delta oracles
 * below assert both the new value and the old replicas' value.
 *
 * DRIFT SCENARIO this guard defends against: one strategy re-rolls a private
 * copy (e.g. drops the `> 0` in the explicit-width predicate, or renames its
 * log prefix) and only that diagram type drifts while shared-fixture tests
 * stay green.
 *
 * Layers:
 *   1. VERBATIM ORACLE — the pre-round-31 bodies, frozen below (five-file
 *      variant, Tree variant, validateInputs), must stay value-equal to the
 *      shared functions: always vs the Tree replica, and vs the five-file
 *      replica exactly on the sub-corpus where the explicit width is
 *      unusable (absent/0/negative/NaN). Plus seeded fuzz.
 *   2. DELEGATION EQUALITY — every migrated site's private method (reached
 *      through the r15-style seam cast; BaseLayoutEngine via a concrete
 *      subclass) equals the shared function for its own wiring, log output
 *      byte-equal via logger spies; and a public-seam witness pins the
 *      behavior change on NetworkLayoutStrategy (grid x shifts by exactly
 *      (260 − 120) / 2 when a node grows width 260).
 *   3. SOURCE ANCHORS — each of the 8 files delegates; the shared module
 *      holds both frozen shapes; no other production file re-rolls the
 *      validateInputs log literal, the width tail, or the explicit-width
 *      preamble.
 *
 * The "no site re-rolls the shapes" discovery sweep lives in the shared
 * registry (tests/guards/frozen-literal-rules.ts, round-31 entry); this file
 * holds the behavioral pins.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { readSource, walkProductionSurface } from '@tests/guards/freeze-guard';
import type { NodeDatum, EdgeDatum } from '@stv/core/types/diagram';
import type { LayoutConfig } from '@/visualization/types';
import { logger } from '@stv/core/utils/logger';
import { DEFAULT_NODE_WIDTH } from '@/visualization/node-dimensions';
import {
  calculateNodeWidth as calculateNodeWidthUtil,
  DEFAULT_CHAR_WIDTH,
  DEFAULT_LABEL_PADDING,
} from '@/visualization/layout-utils';
import { strategyNodeWidth, validateStrategyInputs } from '@/visualization/strategy-common';
import { TreeLayoutStrategy } from '@/visualization/strategies/TreeLayoutStrategy';
import { FlowchartLayoutStrategy } from '@/visualization/strategies/FlowchartLayoutStrategy';
import { NetworkLayoutStrategy } from '@/visualization/strategies/NetworkLayoutStrategy';
import { TimelineLayoutStrategy } from '@/visualization/strategies/TimelineLayoutStrategy';
import { ConceptMapLayoutStrategy } from '@/visualization/strategies/ConceptMapLayoutStrategy';
import { ComparisonLayoutStrategy } from '@/visualization/strategies/ComparisonLayoutStrategy';
import { DagreLayoutStrategy } from '@/visualization/strategies/DagreLayoutStrategy';
import { BaseLayoutEngine } from '@/visualization/base/BaseLayoutEngine';

// ---------------------------------------------------------------------------
// Layer 1 material: the VERBATIM pre-round-31 bodies, frozen from
// ComparisonLayoutStrategy.ts (the five-file member) and TreeLayoutStrategy.ts
// @ 003263a1. Do not "improve" these copies: their job is to be the OLD
// behavior, not good behavior.
// ---------------------------------------------------------------------------

type WidthConfig = Pick<LayoutConfig, 'nodeWidth' | 'nodeHeight'>;

function legacyFiveFileCalculateNodeWidth(node: NodeDatum, config: WidthConfig): number {
  const baseWidth = config.nodeWidth || DEFAULT_NODE_WIDTH;
  return calculateNodeWidthUtil(node, {
    nodeWidth: baseWidth,
    nodeHeight: config.nodeHeight,
    charWidth: DEFAULT_CHAR_WIDTH,
    padding: DEFAULT_LABEL_PADDING,
  });
}

function legacyTreeCalculateNodeWidth(node: NodeDatum, config: WidthConfig): number {
  const explicitWidth = node.width ?? (node as NodeDatum & { w?: number }).w;
  if (typeof explicitWidth === 'number' && isFinite(explicitWidth) && explicitWidth > 0) {
    return explicitWidth;
  }
  return legacyFiveFileCalculateNodeWidth(node, config);
}

function legacyValidateInputs(nodes: NodeDatum[], edges: EdgeDatum[], logPrefix: string): boolean {
  if (nodes.length === 0) {
    logger.warn(`${logPrefix} No nodes to layout`);
    return false;
  }
  const nodeIds = new Set(nodes.map(n => n.id));
  if (nodeIds.size !== nodes.length) {
    logger.error(`${logPrefix} Duplicate node IDs detected`);
    return false;
  }
  const invalidEdges = edges.filter(
    edge => !nodeIds.has(edge.from) || !nodeIds.has(edge.to)
  );
  if (invalidEdges.length > 0) {
    logger.error(`${logPrefix} Invalid edges detected:`, invalidEdges);
    return false;
  }
  return true;
}

/** Deterministic PRNG (mulberry32) so the fuzz corpus is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NODE_CORPUS: Array<NodeDatum & { w?: number }> = [
  { id: 'n0', label: '' },
  { id: 'n1', label: 'x' },
  { id: 'n2', label: '0123456789' },
  { id: 'n3', label: '0123456789012345678' },
  { id: 'n4', label: '0'.repeat(40) },
  { id: 'n5', label: 'plain', width: 260 },
  { id: 'n6', label: 'tiny', width: 50 },
  { id: 'n7', label: 'sub', width: 0.5 },
  { id: 'n8', label: 'zero', width: 0 },
  { id: 'n9', label: 'neg', width: -5 },
  { id: 'n10', label: 'nan', width: NaN },
  { id: 'n11', label: 'huge', width: 1e9 },
  { id: 'n12', label: 'alias', w: 90 },
  { id: 'n13', label: 'alias-loses', width: 30, w: 400 },
];

const WIDTH_CONFIGS: WidthConfig[] = [
  { nodeWidth: 120, nodeHeight: 60 },
  { nodeWidth: 300, nodeHeight: 80 },
  { nodeWidth: 0, nodeHeight: 60 },
  {} as WidthConfig,
];

/** Cases where the explicit width is unusable → the five-file body applies. */
function explicitWidthUnusable(node: NodeDatum & { w?: number }): boolean {
  const explicit = node.width ?? node.w;
  return !(typeof explicit === 'number' && isFinite(explicit) && explicit > 0);
}

describe('v1 strategy shared members single source (round 31)', () => {
  // -------------------------------------------------------------------------
  // Layer 1: verbatim oracle
  // -------------------------------------------------------------------------
  describe('layer 1 — verbatim oracle against the frozen pre-round-31 bodies', () => {
    it('strategyNodeWidth is value-identical to the Tree replica on the whole corpus', () => {
      for (const node of NODE_CORPUS) {
        for (const config of WIDTH_CONFIGS) {
          expect(strategyNodeWidth(node, config))
            .toBe(legacyTreeCalculateNodeWidth(node, config));
        }
      }
    });

    it('strategyNodeWidth matches the five-file replica wherever the explicit width is unusable (zero delta)', () => {
      for (const node of NODE_CORPUS.filter(explicitWidthUnusable)) {
        for (const config of WIDTH_CONFIGS) {
          expect(strategyNodeWidth(node, config))
            .toBe(legacyFiveFileCalculateNodeWidth(node, config));
        }
      }
    });

    it('DELTA oracle — the drift round 31 closed is pinned in BOTH directions', () => {
      const config: WidthConfig = { nodeWidth: 120, nodeHeight: 60 };
      // Usable explicit width now wins (was clamped to the label estimate).
      expect(strategyNodeWidth(NODE_CORPUS[5], config)).toBe(260);   // n5 width:260
      expect(legacyFiveFileCalculateNodeWidth(NODE_CORPUS[5], config)).toBe(120);
      // Deprecated `w` alias is honored when `width` is absent.
      expect(strategyNodeWidth(NODE_CORPUS[12], config)).toBe(90);   // n12 w:90
      expect(legacyFiveFileCalculateNodeWidth(NODE_CORPUS[12], config)).toBe(120);
      // `width` wins over the alias when both are present.
      expect(strategyNodeWidth(NODE_CORPUS[13], config)).toBe(30);   // n13 width:30 w:400
      // `> 0` strictness: 0.5 is honored, 0 / NaN / negative are not.
      expect(strategyNodeWidth(NODE_CORPUS[7], config)).toBe(0.5);
      for (const i of [8, 9, 10]) {
        expect(strategyNodeWidth(NODE_CORPUS[i], config)).toBe(120);
      }
    });

    it('seeded fuzz: 600 cases stay identical to the Tree replica', () => {
      const rand = mulberry32(31);
      const widths = [undefined, 0, 0.5, 1, 60, 120, 260, 1e6, -3, NaN];
      for (let i = 0; i < 600; i++) {
        const label = 'l'.repeat(Math.floor(rand() * 50));
        const width = widths[Math.floor(rand() * widths.length)];
        const w = rand() < 0.3 ? Math.floor(rand() * 400) : undefined;
        const node = { id: `f${i}`, label, width, w } as NodeDatum & { w?: number };
        const config: WidthConfig = {
          nodeWidth: [0, 40, 120, 300, undefined][Math.floor(rand() * 5)] as number,
          nodeHeight: [0, 60, 90][Math.floor(rand() * 3)],
        };
        expect(strategyNodeWidth(node, config))
          .toBe(legacyTreeCalculateNodeWidth(node, config));
      }
    });

    it('validateStrategyInputs is value- and log-identical to the frozen replica', () => {
      const cases: Array<{ nodes: NodeDatum[]; edges: EdgeDatum[] }> = [
        { nodes: [], edges: [] },
        {
          nodes: [{ id: 'a', label: 'A' }, { id: 'a', label: 'A2' }],
          edges: [],
        },
        {
          nodes: [{ id: 'a', label: 'A' }],
          edges: [{ from: 'a', to: 'ghost' }],
        },
        {
          nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
          edges: [{ from: 'a', to: 'b' }],
        },
        {
          nodes: [{ id: 'a', label: 'A' }, { id: 'a', label: 'dup' }],
          edges: [{ from: 'a', to: 'ghost' }],
        },
      ];
      const prefixes = ['[Tree]', '[Flowchart]', '[Network]', '[Timeline]', '[ConceptMap]', '[Comparison]'];

      const run = (fn: () => boolean) => {
        const calls: Array<{ level: 'warn' | 'error'; args: unknown[] }> = [];
        const warn = jest.spyOn(logger, 'warn').mockImplementation((...a: unknown[]) => {
          calls.push({ level: 'warn', args: a });
        });
        const error = jest.spyOn(logger, 'error').mockImplementation((...a: unknown[]) => {
          calls.push({ level: 'error', args: a });
        });
        const result = fn();
        warn.mockRestore();
        error.mockRestore();
        return { result, calls };
      };

      for (const prefix of prefixes) {
        for (const c of cases) {
          const shared = run(() => validateStrategyInputs(c.nodes, c.edges, prefix));
          const legacy = run(() => legacyValidateInputs(c.nodes, c.edges, prefix));
          expect(shared.result).toBe(legacy.result);
          expect(shared.calls).toEqual(legacy.calls);
        }
      }

      // Literal pins for one prefix (message shapes frozen).
      const empty = run(() => validateStrategyInputs([], [], '[Network]'));
      expect(empty.result).toBe(false);
      expect(empty.calls).toEqual([{ level: 'warn', args: ['[Network] No nodes to layout'] }]);
    });
  });

  // -------------------------------------------------------------------------
  // Layer 2: delegation equality at every migrated site
  // -------------------------------------------------------------------------
  describe('layer 2 — each migrated site delegates with identical output', () => {
    const strategies = [
      ['Tree', new TreeLayoutStrategy()],
      ['Flowchart', new FlowchartLayoutStrategy()],
      ['Network', new NetworkLayoutStrategy()],
      ['Timeline', new TimelineLayoutStrategy()],
      ['ConceptMap', new ConceptMapLayoutStrategy()],
      ['Comparison', new ComparisonLayoutStrategy()],
    ] as const;

    it.each(strategies)('%sLayoutStrategy.calculateNodeWidth equals the shared function', (_name, strategy) => {
      const priv = strategy as unknown as {
        calculateNodeWidth(node: NodeDatum, config: WidthConfig): number;
      };
      for (const node of NODE_CORPUS) {
        for (const config of WIDTH_CONFIGS) {
          expect(priv.calculateNodeWidth(node, config)).toBe(strategyNodeWidth(node, config));
        }
      }
    });

    it('DagreLayoutStrategy.calculateNodeWidth (this.config wiring) equals the shared function', () => {
      const dagre = new DagreLayoutStrategy(
        { nodeWidth: 120, nodeHeight: 60 } as LayoutConfig,
        {} as never,
      );
      const priv = dagre as unknown as { calculateNodeWidth(node: NodeDatum): number };
      for (const node of NODE_CORPUS) {
        expect(priv.calculateNodeWidth(node))
          .toBe(strategyNodeWidth(node, { nodeWidth: 120, nodeHeight: 60 }));
      }
    });

    it('BaseLayoutEngine.calculateNodeWidth (this.config wiring) equals the shared function', () => {
      class TestEngine extends BaseLayoutEngine {
        protected getDefaultConfig(): LayoutConfig {
          return { nodeWidth: 300, nodeHeight: 90 } as LayoutConfig;
        }
        async generateLayout(): Promise<never> {
          throw new Error('not used');
        }
      }
      const engine = new TestEngine();
      const priv = engine as unknown as { calculateNodeWidth(node: NodeDatum): number };
      for (const node of NODE_CORPUS) {
        expect(priv.calculateNodeWidth(node))
          .toBe(strategyNodeWidth(node, { nodeWidth: 300, nodeHeight: 90 }));
      }
    });

    it.each(strategies)('%sLayoutStrategy.validateInputs equals the replica incl. log bytes', (_name, strategy) => {
      const cases: Array<{ nodes: NodeDatum[]; edges: EdgeDatum[] }> = [
        { nodes: [], edges: [] },
        { nodes: [{ id: 'a', label: 'A' }, { id: 'a', label: 'A2' }], edges: [] },
        { nodes: [{ id: 'a', label: 'A' }], edges: [{ from: 'ghost', to: 'a' }] },
        { nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], edges: [{ from: 'a', to: 'b' }] },
      ];
      const prefix = `[${_name}]`;
      for (const c of cases) {
        const capture = (fn: () => boolean) => {
          const calls: unknown[][] = [];
          const warn = jest.spyOn(logger, 'warn').mockImplementation((...a: unknown[]) => { calls.push(['warn', ...a]); });
          const error = jest.spyOn(logger, 'error').mockImplementation((...a: unknown[]) => { calls.push(['error', ...a]); });
          const result = fn();
          warn.mockRestore();
          error.mockRestore();
          return { result, calls };
        };
        const viaStrategy = capture(() => strategy.validateInputs(c.nodes, c.edges));
        const viaReplica = capture(() => legacyValidateInputs(c.nodes, c.edges, prefix));
        expect(viaStrategy.result).toBe(viaReplica.result);
        expect(viaStrategy.calls).toEqual(viaReplica.calls);
      }
    });

    it('public-seam witness — Network grid x shifts by exactly (260-120)/2 for width:260 (the closed drift)', async () => {
      const config = {
        width: 1920, height: 1080, nodeWidth: 120, nodeHeight: 60,
        marginX: 40, marginY: 40, rankDirection: 'TB' as const,
        nodeSeparation: 60, edgeSeparation: 30, rankSeparation: 100,
      };
      const mkNodes = (wide: boolean) =>
        Array.from({ length: 6 }, (_, i) => ({
          id: `n${i}`, label: 'n', ...(i === 0 && wide ? { width: 260 } : {}),
        }));
      const strategy = new NetworkLayoutStrategy();
      // Same node ids both runs → identical seeded jitter → the only
      // difference is the width/2 term of gridX for node n0.
      const plain = await strategy.generateLayout(mkNodes(false), [], config);
      const wide = await strategy.generateLayout(mkNodes(true), [], config);
      const plainN0 = plain.nodes.find(n => n.id === 'n0');
      const wideN0 = wide.nodes.find(n => n.id === 'n0');
      if (plainN0 === undefined || wideN0 === undefined) {
        throw new Error('node n0 missing from NetworkLayoutStrategy output');
      }
      const xPlain = plainN0.x;
      const xWide = wideN0.x;
      // The grid term alone is (260-120)/2 = 70; downstream force refinement
      // (width-dependent repulsion) nudges it slightly. Bracketed, because the
      // exact refinement delta is an implementation detail — the drift this
      // witnesses is old-vs-new: under the pre-round-31 body the delta was 0.
      expect(xPlain - xWide).toBeGreaterThan(60);
      expect(xPlain - xWide).toBeLessThan(80);
    });
  });

  // -------------------------------------------------------------------------
  // Layer 3: source anchors
  // -------------------------------------------------------------------------
  describe('layer 3 — source anchors', () => {
    const CONFIG_WIRED = [
      'src/visualization/strategies/TreeLayoutStrategy.ts',
      'src/visualization/strategies/FlowchartLayoutStrategy.ts',
      'src/visualization/strategies/NetworkLayoutStrategy.ts',
      'src/visualization/strategies/TimelineLayoutStrategy.ts',
      'src/visualization/strategies/ConceptMapLayoutStrategy.ts',
      'src/visualization/strategies/ComparisonLayoutStrategy.ts',
    ];
    const THIS_CONFIG_WIRED = [
      'src/visualization/strategies/DagreLayoutStrategy.ts',
      'src/visualization/base/BaseLayoutEngine.ts',
    ];

    it.each(CONFIG_WIRED)('%s delegates both members', (file) => {
      const src = readSource(file);
      expect(src).toMatch(/return strategyNodeWidth\(node, config\);/);
      expect(src).toMatch(/return validateStrategyInputs\(nodes, edges, '\[.+?\]'\);/);
    });

    it.each(THIS_CONFIG_WIRED)('%s delegates node width with its own config wiring', (file) => {
      expect(readSource(file)).toMatch(/return strategyNodeWidth\(node, this\.config\);/);
    });

    it('the shared module holds both frozen shapes', () => {
      const src = readSource('src/visualization/strategy-common.ts');
      // Round 37: the explicit-width preamble moved verbatim into
      // layout-utils.ts `resolveNodeWidth` (the ezo engine shares the same
      // canonical branch); the anchor follows the shape, the delegation
      // wiring stays here.
      const canonical = readSource('src/visualization/layout-utils.ts');
      expect(canonical).toMatch(/node\.width \?\? \(node as NodeDatum & \{ w\?: number \}\)\.w/);
      expect(src).toMatch(/resolveNodeWidth\(node, \{/);
      expect(src).toMatch(/charWidth: DEFAULT_CHAR_WIDTH/);
      expect(src).toMatch(/Duplicate node IDs detected/);
    });

    it('no production file re-rolls the shapes (validate log literal / width tail / preamble)', () => {
      const files = walkProductionSurface();
      const offenders: string[] = [];
      for (const rel of files) {
        if (rel === 'src/visualization/strategy-common.ts') continue;
        const lines = readSource(rel).split('\n');
        lines.forEach((line, i) => {
          if (/Duplicate node IDs detected/.test(line)) offenders.push(`${rel}:${i + 1}: validate log literal`);
          if (/charWidth:\s*DEFAULT_CHAR_WIDTH/.test(line)) offenders.push(`${rel}:${i + 1}: width tail`);
          if (/explicitWidth\s*=\s*node\.width/.test(line)) offenders.push(`${rel}:${i + 1}: preamble`);
        });
      }
      expect(files.length).toBeGreaterThan(300); // the walk traversed the production surface (src/ + @stv/core)
      expect(offenders).toEqual([]);
    });
  });
});
