/**
 * @jest-environment node
 */
/**
 * ezo-explicit-dimension-sizing.test.ts — round 37.
 *
 * Family: the LAYOUT-TIME node sizing decision "explicit finite positive
 * dimension first, then the label/config-driven estimate".
 *
 * Round 31 made this the v1 strategy family's shape (strategyNodeWidth in
 * strategy-common.ts) but the ezo engine — a DIFFERENT import graph — kept
 * sizing its 7 initial-layout sites (flowchart/tree/timeline/comparison/
 * network/concept-map paths + network grid init) with the raw label-driven
 * `calculateNodeWidth`/`calculateNodeHeight`, which NEVER read
 * `node.width`/`node.height`. Every downstream measurement (overlap
 * predicates, edge anchoring, canvas fitting, the renderer) reads via
 * `getNodeWidth`/`getNodeHeight`, which honor the explicit field FIRST —
 * so a `width: 400, height: 120` input node was PLACED as a ≤240×60 box
 * but MEASURED as 400×120: a genuine geometric overlap emitted by the
 * "zero overlap guaranteed" engine (round 36 pinned it as a KNOWN_EZO_GAP
 * on tree/mixed-extents).
 *
 * Round 37 closes the engine-level missed sibling:
 *   - canonical `resolveNodeWidth`/`resolveNodeHeight` in layout-utils.ts
 *     (next to the label-driven estimator they delegate to);
 *   - ezo's 7+7 sizing sites delegate;
 *   - strategyNodeWidth delegates its explicit branch to the canonical
 *     (keeping the strategy family's padding-20 label tail);
 *   - TreeLayoutStrategy's height twin delegates;
 *   - BEHAVIOR CHANGE, deliberate: nodes carrying an explicit finite
 *     positive width/height are now placed at that size. Non-explicit
 *     nodes are byte-identical (zero-delta oracle below).
 *
 * A second, interacting defect closed in the same round: ezo's force loop
 * targets the STRICTER minimumSpacing contract and its no-progress guard
 * stranded residual GEOMETRIC overlaps when a displacement traded one pair
 * for another (mixed-extent flowchart: clearing the m1×m2 pair drove m1
 * into m0). resolveAllOverlaps now runs the production OverlapResolver
 * (the same last-mile component executeLayout uses for the v1 strategies)
 * as a final pass, clamped to the fixed canvas and kept only when still
 * geometric-clean — a capacity-overflow shape (node row wider than the
 * canvas) re-overlaps under the clamp and keeps its previous state rather
 * than rendering off-canvas.
 *
 * Layers:
 *   1. UNIT SPECS — the explicit-first branch: positive finite wins,
 *      0/NaN/±Infinity/undefined fall through; `w`/`h` aliases honored
 *      after the canonical fields.
 *   2. ZERO-DELTA ORACLES — for nodes WITHOUT a usable explicit dimension,
 *      each resolve fn equals its pre-round-37 legacy replica EXACTLY over
 *      a seeded corpus (ezo omitted-padding shape, strategy padding-20
 *      shape, Tree height twin shape). These pin that the migration changed
 *      nothing for the 99% case.
 *   3. ENGINE CONTRACT WITNESSES — the invariant the defect violated:
 *      PLACED size === MEASURED size for every emitted node (`w`/`h` equal
 *      what getNodeWidth/getNodeHeight read), across all five ezo diagram
 *      types on explicit-dimension topologies; plus in-canvas bounds and
 *      independent-AABB overlap-freedom.
 *   4. SOURCE ANCHORS — the canonical branch lives only in layout-utils;
 *      the ezo engine rolls no direct sizing call; the final
 *      OverlapResolver last-mile is present in resolveAllOverlaps; Tree's
 *      height twin delegates.
 *
 * The "no site re-rolls the sizing shapes" discovery sweep lives in the
 * shared registry (round-37 entry in
 * tests/guards/frozen-literal-families/explicit-dimension-sizing.ts); this
 * file holds the behavioral pins.
 *
 * Mutations RED-verified at round 37 (against THIS file + the outcome
 * guard):
 *   M1 resolveNodeWidth drops the explicit branch → layer-2 strategy
 *      replica delta AND layer-3 placed==measured fail (w reverts to the
      label estimate while getNodeWidth still reads 400).
 *   M2 one ezo site re-freezes `calculateNodeWidth(node, { nodeWidth:
 *      this.config.nodeWidth …})` → layer-4 anchor + registry sweep fail.
 *   M3 resolveAllOverlaps final pass removed → outcome guard mixed-extent
 *      flowchart fails (m0×m1 re-strands); layer-4 anchor fails.
 */

import { describe, it, expect } from '@jest/globals';
import { readSource } from '@tests/guards/freeze-guard';
import type { NodeDatum, EdgeDatum, DiagramType, PositionedNode } from '@/types/diagram';
import {
  calculateNodeWidth,
  resolveNodeWidth,
  resolveNodeHeight,
  DEFAULT_CHAR_WIDTH,
  DEFAULT_LABEL_PADDING,
} from '@/visualization/layout-utils';
import {
  getNodeWidth,
  getNodeHeight,
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_HEIGHT,
} from '@/visualization/node-dimensions';
import { strategyNodeWidth } from '@/visualization/strategy-common';
import { createLayoutRng } from '@/visualization/layout-rng';
import { TreeLayoutStrategy } from '@/visualization/strategies/TreeLayoutStrategy';
import { EnhancedZeroOverlapLayoutEngine } from '@/visualization/enhanced-zero-overlap-layout';

// ---------------------------------------------------------------------------
// Seeded corpus.
// ---------------------------------------------------------------------------

const LABELS: string[] = [
  '', 'x', 'A', 'Start', 'Fetch Data', 'Render Result',
  '音声から図解動画を自動生成するシステムの構成要素', // long CJK
  'とても長い日本語のラベル名で二行になる場合の挙動確認用',
  'a'.repeat(40), 'Mixed 混在 Label 12345',
];

const CONFIGS: Array<{ nodeWidth: number; nodeHeight: number; charWidth?: number; padding?: number }> = [
  { nodeWidth: DEFAULT_NODE_WIDTH, nodeHeight: DEFAULT_NODE_HEIGHT },               // ezo shape: padding omitted → 16
  { nodeWidth: 200, nodeHeight: 80 },
  { nodeWidth: 120, nodeHeight: 60, charWidth: DEFAULT_CHAR_WIDTH, padding: DEFAULT_LABEL_PADDING }, // strategy shape
  { nodeWidth: 260, nodeHeight: 90, charWidth: 10, padding: 24 },
];

/** Non-usable explicit values that must fall through to the estimate. */
const INVALID_EXPLICIT: Array<number | undefined> = [undefined, 0, -1, -400, Number.NaN, Infinity, -Infinity];

/** Deterministic explicit positive dimensions. */
const VALID_EXPLICIT = [
  { width: 400, height: 120 },   // the round-36 defect witness
  { width: 240, height: 240 },   // exactly the label clamp ceiling
  { width: 121, height: 61 },    // just past the base
  { width: 1, height: 1 },       // degenerate-but-positive
];

// ---------------------------------------------------------------------------
// Layer 2 — pre-round-37 legacy replicas (frozen). Each replica is the exact
// arithmetic the replaced code performed; the resolve fns must stay equal to
// it for every input the legacy path could not distinguish.
// ---------------------------------------------------------------------------

/** Pre-r37 ezo width site: raw label-driven estimate, padding omitted. */
function legacyEzoWidth(node: NodeDatum, cfg: { nodeWidth: number; nodeHeight: number }): number {
  return calculateNodeWidth(node, cfg);
}

/** Pre-r37 ezo height site: raw configured height. */
function legacyEzoHeight(node: NodeDatum, cfg: { nodeWidth: number; nodeHeight: number }): number {
  return cfg.nodeHeight;
}

/** Pre-r37 strategyNodeWidth: inline explicit branch + padding-20 tail. */
function legacyStrategyWidth(
  node: NodeDatum,
  cfg: { nodeWidth: number; nodeHeight: number },
): number {
  const explicitWidth = node.width ?? (node as NodeDatum & { w?: number }).w;
  if (typeof explicitWidth === 'number' && isFinite(explicitWidth) && explicitWidth > 0) {
    return explicitWidth;
  }
  const baseWidth = cfg.nodeWidth || DEFAULT_NODE_WIDTH;
  return calculateNodeWidth(node, {
    nodeWidth: baseWidth,
    nodeHeight: cfg.nodeHeight,
    charWidth: DEFAULT_CHAR_WIDTH,
    padding: DEFAULT_LABEL_PADDING,
  });
}

/** Pre-r37 TreeLayoutStrategy.resolveNodeHeight twin. */
function legacyTreeHeight(node: NodeDatum, cfg: { nodeHeight: number }): number {
  const explicit = node.height ?? (node as NodeDatum & { h?: number }).h;
  if (typeof explicit === 'number' && isFinite(explicit) && explicit > 0) {
    return explicit;
  }
  return cfg.nodeHeight || DEFAULT_NODE_HEIGHT;
}

describe('ezo explicit-dimension sizing single source (round 37)', () => {
  // -------------------------------------------------------------------------
  // Layer 1 — unit specs for the canonical branch.
  // -------------------------------------------------------------------------
  describe('layer 1 — explicit-first branch', () => {
    for (const { width, height } of VALID_EXPLICIT) {
      it(`explicit ${width}×${height} wins over the label estimate`, () => {
        const node: NodeDatum = { id: 'n', label: 'x', width, height };
        expect(resolveNodeWidth(node, CONFIGS[0])).toBe(width);
        expect(resolveNodeHeight(node, CONFIGS[0])).toBe(height);
      });
    }

    it('the w/h layout-time aliases are honored after the canonical fields', () => {
      const aliased = { id: 'n', label: 'x', w: 320, h: 140 } as unknown as NodeDatum;
      expect(resolveNodeWidth(aliased, CONFIGS[0])).toBe(320);
      expect(resolveNodeHeight(aliased, CONFIGS[0])).toBe(140);
      const both = { id: 'n', label: 'x', width: 400, w: 320, height: 120, h: 140 } as NodeDatum;
      expect(resolveNodeWidth(both, CONFIGS[0])).toBe(400);
      expect(resolveNodeHeight(both, CONFIGS[0])).toBe(120);
    });

    for (const bad of INVALID_EXPLICIT) {
      it(`non-usable explicit width ${String(bad)} falls through to the estimate`, () => {
        const node: NodeDatum = { id: 'n', label: 'Start', width: bad };
        expect(resolveNodeWidth(node, CONFIGS[0])).toBe(calculateNodeWidth(node, CONFIGS[0]));
      });
      it(`non-usable explicit height ${String(bad)} falls through to the configured height`, () => {
        const node: NodeDatum = { id: 'n', label: 'Start', height: bad };
        expect(resolveNodeHeight(node, CONFIGS[0])).toBe(CONFIGS[0].nodeHeight);
      });
    }
  });

  // -------------------------------------------------------------------------
  // Layer 2 — zero-delta oracles vs the frozen legacy replicas.
  // -------------------------------------------------------------------------
  describe('layer 2 — zero-delta oracles', () => {
    it('resolveNodeWidth equals the legacy ezo estimate for every non-explicit node × config × label', () => {
      for (const cfg of CONFIGS) {
        for (const label of LABELS) {
          const node: NodeDatum = { id: 'n', label };
          expect(resolveNodeWidth(node, cfg)).toBe(legacyEzoWidth(node, cfg));
          for (const bad of INVALID_EXPLICIT) {
            const invalid: NodeDatum = { id: 'n', label, width: bad };
            expect(resolveNodeWidth(invalid, cfg)).toBe(legacyEzoWidth(invalid, cfg));
          }
        }
      }
    });

    it('resolveNodeHeight equals the legacy ezo height for every non-explicit node × config', () => {
      for (const cfg of CONFIGS) {
        for (const label of LABELS) {
          const node: NodeDatum = { id: 'n', label };
          expect(resolveNodeHeight(node, cfg)).toBe(legacyEzoHeight(node, cfg));
        }
      }
    });

    it('strategyNodeWidth equals its pre-r37 inline replica for explicit AND non-explicit nodes', () => {
      const rand = createLayoutRng('strategy-width-replica');
      for (let i = 0; i < 300; i++) {
        const label = LABELS[Math.floor(rand() * LABELS.length)];
        const cfg = CONFIGS[Math.floor(rand() * CONFIGS.length)];
        const widthRoll = rand();
        const node: NodeDatum = widthRoll < 0.25
          ? { id: `n${i}`, label, ...VALID_EXPLICIT[Math.floor(rand() * VALID_EXPLICIT.length)] }
          : widthRoll < 0.35
            ? { id: `n${i}`, label, width: INVALID_EXPLICIT[Math.floor(rand() * INVALID_EXPLICIT.length)] }
            : { id: `n${i}`, label };
        expect(strategyNodeWidth(node, cfg)).toBe(legacyStrategyWidth(node, cfg));
      }
    });

    it('layout-utils resolveNodeHeight equals the pre-r37 Tree twin for explicit AND non-explicit nodes', () => {
      const rand = createLayoutRng('tree-height-replica');
      for (let i = 0; i < 300; i++) {
        const label = LABELS[Math.floor(rand() * LABELS.length)];
        const cfg = CONFIGS[Math.floor(rand() * CONFIGS.length)];
        const roll = rand();
        const node: NodeDatum = roll < 0.3
          ? { id: `n${i}`, label, height: VALID_EXPLICIT[Math.floor(rand() * VALID_EXPLICIT.length)].height }
          : roll < 0.4
            ? { id: `n${i}`, label, height: INVALID_EXPLICIT[Math.floor(rand() * INVALID_EXPLICIT.length)] }
            : { id: `n${i}`, label };
        expect(resolveNodeHeight(node, cfg)).toBe(legacyTreeHeight(node, cfg));
      }
    });

    it('TreeLayoutStrategy.resolveNodeHeight (private seam) delegates to the canonical', async () => {
      const strategy = new TreeLayoutStrategy() as unknown as {
        resolveNodeHeight(node: NodeDatum, cfg: { nodeHeight: number }): number;
      };
      const node: NodeDatum = { id: 'n', label: 'Tall', height: 200 };
      expect(strategy.resolveNodeHeight(node, { nodeHeight: 60 })).toBe(200);
      expect(strategy.resolveNodeHeight({ id: 'm', label: 'x' }, { nodeHeight: 60 })).toBe(60);
    });
  });

  // -------------------------------------------------------------------------
  // Layer 3 — engine contract witnesses: PLACED size === MEASURED size.
  // -------------------------------------------------------------------------
  describe('layer 3 — ezo placed==measured invariant', () => {
    const engine = new EnhancedZeroOverlapLayoutEngine();
    const CANVAS_W = 1920;
    const CANVAS_H = 1080;

    const EXPLICIT_TOPOLOGIES: ReadonlyArray<readonly [string, NodeDatum[], EdgeDatum[]]> = [
      ['mixed extents (the round-36 defect shape)', [
        { id: 'm0', label: 'M0', width: 400, height: 120 },
        { id: 'm1', label: 'M1', width: 400, height: 120 },
        { id: 'm2', label: 'M2' },
        { id: 'm3', label: 'M3' },
      ], [
        { from: 'm0', to: 'm1' }, { from: 'm1', to: 'm2' }, { from: 'm2', to: 'm3' },
      ]],
      ['all-explicit varied sizes', [
        { id: 'a', label: 'Alpha', width: 500, height: 200 },
        { id: 'b', label: 'Beta', width: 150, height: 45 },
        { id: 'c', label: 'Gamma', width: 320, height: 90 },
        { id: 'd', label: 'Delta', width: 240, height: 240 },
        { id: 'e', label: 'Epsilon' },
      ], [
        { from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'd' }, { from: 'd', to: 'e' },
      ]],
      ['explicit aliases (w/h)', [
        { id: 'w0', label: 'Alias0', w: 360, h: 150 } as unknown as NodeDatum,
        { id: 'w1', label: 'Alias1' },
      ], [
        { from: 'w0', to: 'w1' },
      ]],
    ];

    const EZO_TYPES: DiagramType[] = ['flowchart', 'tree', 'timeline', 'comparison', 'network'];

    function independentOverlapPairs(nodes: PositionedNode[]): string[] {
      const offenders: string[] = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const separated =
            a.x + getNodeWidth(a, 0) <= b.x || b.x + getNodeWidth(b, 0) <= a.x ||
            a.y + getNodeHeight(a, 0) <= b.y || b.y + getNodeHeight(b, 0) <= a.y;
          if (!separated) offenders.push(`${a.id}×${b.id}`);
        }
      }
      return offenders;
    }

    for (const diagramType of EZO_TYPES) {
      for (const [name, nodes, edges] of EXPLICIT_TOPOLOGIES) {
        it(`placed==measured + in-canvas + overlap-free — ${diagramType} / ${name}`, async () => {
          const result = await engine.generateZeroOverlapLayout(
            diagramType,
            nodes.map(n => ({ ...n })),
            edges.map(e => ({ ...e })) as EdgeDatum[],
          );

          expect(result.nodes.length).toBe(nodes.length);
          for (const node of result.nodes) {
            // THE invariant the defect violated: the size the layout placed
            // (`w`/`h`) is the size measurement reads (`getNodeWidth` first
            // honors `width`, then `w`).
            expect(node.w).toBe(getNodeWidth(node, 0));
            expect(node.h).toBe(getNodeHeight(node, 0));
            expect(Number.isFinite(node.x)).toBe(true);
            expect(Number.isFinite(node.y)).toBe(true);
            // Fixed-canvas contract of this engine (nodes stay renderable).
            expect(node.x).toBeGreaterThanOrEqual(0);
            expect(node.y).toBeGreaterThanOrEqual(0);
            expect(node.x + getNodeWidth(node, 0)).toBeLessThanOrEqual(CANVAS_W);
            expect(node.y + getNodeHeight(node, 0)).toBeLessThanOrEqual(CANVAS_H);
          }
          expect(independentOverlapPairs(result.nodes)).toEqual([]);

          // Determinism of the whole pipeline including the final resolver pass.
          const second = await engine.generateZeroOverlapLayout(
            diagramType,
            nodes.map(n => ({ ...n })),
            edges.map(e => ({ ...e })) as EdgeDatum[],
          );
          expect(second.nodes).toEqual(result.nodes);
        });
      }
    }
  });

  // -------------------------------------------------------------------------
  // Layer 4 — source anchors.
  // -------------------------------------------------------------------------
  describe('layer 4 — source anchors', () => {
    it('the canonical explicit-first branch lives only in layout-utils', () => {
      const canonical = readSource('src/visualization/layout-utils.ts');
      expect(canonical).toMatch(/node\.width \?\? \(node as NodeDatum & \{ w\?: number \}\)\.w/);
      expect(canonical).toMatch(/node\.height \?\? \(node as NodeDatum & \{ h\?: number \}\)\.h/);
      expect(canonical).toMatch(/export function resolveNodeWidth\(/);
      expect(canonical).toMatch(/export function resolveNodeHeight\(/);
    });

    it('the ezo engine rolls no direct sizing call — all 7+7 sites delegate', () => {
      const src = readSource('src/visualization/enhanced-zero-overlap-layout.ts');
      const directWidth = src.match(/calculateNodeWidth\(/g) ?? [];
      const directHeight = src.match(/calculateNodeHeight\(/g) ?? [];
      expect(directWidth.length).toBe(0);
      expect(directHeight.length).toBe(0);
      const widthSites = src.match(/resolveNodeWidth\(node, \{ nodeWidth: this\.config\.nodeWidth/g) ?? [];
      const heightSites = src.match(/resolveNodeHeight\(node, \{ nodeWidth: this\.config\.nodeWidth/g) ?? [];
      expect(widthSites.length).toBe(7);
      expect(heightSites.length).toBe(7);
    });

    it('resolveAllOverlaps keeps the OverlapResolver last-mile (clamped, kept only when clean)', () => {
      const src = readSource('src/visualization/enhanced-zero-overlap-layout.ts');
      expect(src).toMatch(/const finalResolver = new OverlapResolver\(100\);/);
      expect(src).toMatch(/finalResolver\.detectOverlaps\(currentNodes\)\.length > 0/);
      expect(src).toMatch(/finalResolver\.detectOverlaps\(clamped\)\.length === 0/);
    });

    it("TreeLayoutStrategy's height twin delegates (no re-rolled preamble)", () => {
      const src = readSource('src/visualization/strategies/TreeLayoutStrategy.ts');
      expect(src).not.toMatch(/node\.height \?\?/);
      expect(src).toMatch(/resolveNodeHeight as resolveNodeHeightUtil/);
    });

    it("BaseLayoutEngine's height twin delegates (registry sweep caught it at round 37)", () => {
      const src = readSource('src/visualization/base/BaseLayoutEngine.ts');
      expect(src).toMatch(/return resolveNodeHeight\(node, this\.config\);/);
      expect(src).not.toMatch(/calculateNodeHeight\(node, \{ nodeWidth/);
    });

    it('strategyNodeWidth delegates its explicit branch to the canonical', () => {
      const src = readSource('src/visualization/strategy-common.ts');
      expect(src).toMatch(/return resolveNodeWidth\(node, \{/);
      // Code shape, not the doc header (which quotes the historical
      // `node.width ?? node.w` form on purpose).
      expect(src).not.toMatch(/const explicitWidth = node\.width/);
    });
  });
});
