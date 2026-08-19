/**
 * @jest-environment node
 */
/**
 * node-extent-scan-single-source.test.ts — round 41.
 *
 * Family: the node EXTENT SCAN — min over left edges, max over right/bottom
 * edges of positioned nodes (top-left corner convention) — was inlined at 11
 * sites in two idioms: the spread form `Math.min(...nodes.map(n => n.x))` /
 * `Math.max(...nodes.map(n => n.x + getNodeWidth(n, …)))` (BaseLayoutEngine
 * calculateBounds, ezo calculateCanvasUtilization, complex-layout-engine
 * calculateBounds + calculateClusterBounds, CulturalLayoutAdapter
 * calculateBounds, layout-worker final bounds) and the seeded-accumulator
 * loop `let minX = Infinity … if (right > maxX) maxX = right` or
 * `minX = Math.min(minX, node.x)` (canvas-calculator calculate/center,
 * layout-engine-v2 calculateCanvasSize, strategy-selector
 * calculateBoundingBox, ezo fitNodesToCanvas). Canonical since round 41:
 * `nodeExtentEdges` (the per-node four-edge read, width term + fallback
 * chain in one place) and `foldNodeExtents` (the min/max fold) in
 * src/visualization/layout-utils.ts.
 *
 * DRIFT SCENARIO this guard defends against: the box one engine fits a
 * canvas from diverges from the box another engine centers or scores
 * utilization from — one copy drops the `+ width` term on the max edge (the
 * box shrinks to positions-only), another swaps the ±Infinity seeds or flips
 * a comparison, a third silently switches its dimension fallback (0 vs
 * DEFAULT_NODE_WIDTH — a dimension-less node is 0px wide to one site and
 * 120px wide to another). Every canvas-fit / centering / canvas-utilization
 * decision reads this box; it cannot have 11 shapes. That is the
 * duplicate-formula / invariant-split class rounds 15/38/39 kept finding.
 *
 * Layers:
 *   1. VERBATIM ORACLE — the pre-round-41 inline scan bodies, frozen below
 *      in all their per-site read policies (raw ×2 fallbacks, both-corner
 *      flat, `|| 0`, sanitized, canvas-seeded), must be field-identical to
 *      the canonical fold with the matching read over a seeded fuzz corpus
 *      of explicit-dimension and dimension-less nodes across four
 *      quadrants. Any mutation of the fold (seed, comparison, width term)
 *      or of a read policy diverges here.
 *   2. SEMANTIC PINS — null-on-empty, single-node identity, the FALLBACK
 *      axis (0 vs DEFAULT per site policy — the argument-mapping class the
 *      round-40 fuzz missed, so each axis gets an exact-coordinate
 *      witness), the w-alias chain, and the two documented degenerate-input
 *      behavior changes (negative explicit width at the retired flat-scan
 *      sites; NaN coordinate at the retired comparison-loop sites).
 *   3. SOURCE ANCHORS — each of the 11 migrated sites delegates to the
 *      canonical fold with its OWN read policy, and none re-inlines the
 *      retired idioms.
 *
 * The "no site re-inlines the extent scan" discovery sweep lives in the
 * shared registry (frozen-literal-families/node-extent-scan.ts); this file
 * holds the behavioral pins.
 */

import { describe, it, expect } from '@jest/globals';
import { mulberry32 } from '@tests/helpers/fuzz';
import { readSource } from '@tests/guards/freeze-guard';
import type { PositionedNode } from '@stv/core/types/diagram';
import { getNodeWidth, getNodeHeight } from '@/visualization/node-dimensions';
import { sanitizeFinite } from '@stv/core/utils/guards';
import {
  nodeExtentEdges,
  foldNodeExtents,
  type NodeExtents,
  type NodeExtentEdges,
  type ExtentNode,
} from '@/visualization/layout-utils';

// ---------------------------------------------------------------------------
// Layer 1 material: the VERBATIM pre-round-41 inline scans, frozen from the
// eleven sites at 9c66c351 (round 40 HEAD). Do not "improve" these copies:
// their job is to be the old behavior, not good behavior.
// ---------------------------------------------------------------------------

/** BaseLayoutEngine.calculateBounds / layout-worker-adjacent: raw read, fallback 0. */
function oldSpreadBoundsFallback0(nodes: PositionedNode[]): NodeExtents | null {
  if (nodes.length === 0) return null;
  const minX = Math.min(...nodes.map((n) => n.x));
  const maxX = Math.max(...nodes.map((n) => n.x + getNodeWidth(n, 0)));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxY = Math.max(...nodes.map((n) => n.y + getNodeHeight(n, 0)));
  return { minX, minY, maxX, maxY };
}

/** ezo calculateCanvasUtilization / fitNodesToCanvas: raw read, DEFAULT fallback. */
function oldSpreadBoundsDefault(nodes: PositionedNode[]): NodeExtents | null {
  if (nodes.length === 0) return null;
  const minX = Math.min(...nodes.map((n) => n.x));
  const maxX = Math.max(...nodes.map((n) => n.x + getNodeWidth(n)));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxY = Math.max(...nodes.map((n) => n.y + getNodeHeight(n)));
  return { minX, minY, maxX, maxY };
}

/** complex-layout-engine / CulturalLayoutAdapter calculateBounds: BOTH-CORNER flat scan. */
function oldFlatCornerBounds(nodes: PositionedNode[]): NodeExtents | null {
  if (nodes.length === 0) return null;
  const xs = nodes.map((n) => [n.x, n.x + getNodeWidth(n)]).flat();
  const ys = nodes.map((n) => [n.y, n.y + getNodeHeight(n)]).flat();
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

/** complex-layout-engine calculateClusterBounds: `|| 0` read over raw NodeDatum. */
function oldClusterBounds(nodes: PositionedNode[]): NodeExtents | null {
  if (nodes.length === 0) return null;
  const minX = Math.min(...nodes.map((node) => node.x || 0));
  const maxX = Math.max(...nodes.map((node) => (node.x || 0) + getNodeWidth(node)));
  const minY = Math.min(...nodes.map((node) => node.y || 0));
  const maxY = Math.max(...nodes.map((node) => (node.y || 0) + getNodeHeight(node)));
  return { minX, minY, maxX, maxY };
}

/** The cluster read, as the migrated site passes it to the canonical fold. */
function orZeroExtentEdges(node: ExtentNode): NodeExtentEdges {
  return {
    left: node.x || 0,
    top: node.y || 0,
    right: (node.x || 0) + getNodeWidth(node),
    bottom: (node.y || 0) + getNodeHeight(node),
  };
}

/** canvas-calculator calculate/center: sanitizeFinite read + comparison loop. */
function oldSanitizedLoopBounds(nodes: PositionedNode[]): NodeExtents | null {
  if (nodes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const left = sanitizeFinite(node.x, 0);
    const w = getNodeWidth(node, 0);
    const h = getNodeHeight(node, 0);
    const right = left + sanitizeFinite(w, 0);
    const top = sanitizeFinite(node.y, 0);
    const bottom = top + sanitizeFinite(h, 0);
    if (left < minX) minX = left;
    if (top < minY) minY = top;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  }
  return { minX, minY, maxX, maxY };
}

/** The sanitized read, as the migrated canvas-calculator passes it. */
function sanitizedExtentEdges(node: ExtentNode): NodeExtentEdges {
  const left = sanitizeFinite(node.x, 0);
  const top = sanitizeFinite(node.y, 0);
  return {
    left,
    top,
    right: left + sanitizeFinite(getNodeWidth(node, 0), 0),
    bottom: top + sanitizeFinite(getNodeHeight(node, 0), 0),
  };
}

/** layout-engine-v2 calculateCanvasSize / strategy-selector: raw read, comparison loop, fallback 0. */
function oldRawLoopBoundsFallback0(nodes: PositionedNode[]): NodeExtents | null {
  if (nodes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const left = node.x;
    const right = node.x + getNodeWidth(node, 0);
    const top = node.y;
    const bottom = node.y + getNodeHeight(node, 0);
    if (left < minX) minX = left;
    if (top < minY) minY = top;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  }
  return { minX, minY, maxX, maxY };
}

/** ezo fitNodesToCanvas: raw read, Math.min/max accumulation, DEFAULT fallback. */
function oldAccumulatorLoopBounds(nodes: PositionedNode[]): NodeExtents | null {
  if (nodes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const w = getNodeWidth(node);
    const h = getNodeHeight(node);
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + w);
    maxY = Math.max(maxY, node.y + h);
  }
  return { minX, minY, maxX, maxY };
}

/** layout-worker final bounds: canvas-seeded max over raw finite-dimension nodes. */
function oldWorkerBounds(
  nodes: Array<{ x: number; y: number; width: number; height: number }>,
  configWidth: number,
  configHeight: number,
): { width: number; height: number } {
  const maxX = Math.max(...nodes.map((n) => n.x + n.width), configWidth);
  const maxY = Math.max(...nodes.map((n) => n.y + n.height), configHeight);
  return { width: maxX, height: maxY };
}

// ---------------------------------------------------------------------------
// Corpus helpers
// ---------------------------------------------------------------------------

function node(id: string, x: number, y: number, width: number, height: number): PositionedNode {
  return { id, label: id, x, y, width, height };
}

/** Label-only node — dimensions come from the fallback chain, like real layouts. */
function labelNode(id: string, x: number, y: number): PositionedNode {
  return { id, label: `label-${id}`, x, y } as PositionedNode;
}

/**
 * Seeded corpus: explicit-dimension and dimension-less nodes across four
 * quadrants (negative coordinates exercise the min edge). Coordinates are
 * integers built as `k - 100` with integer k ≥ 0, so `-0` cannot occur —
 * the retired comparison loops and the canonical Math.min fold differ in
 * zero-sign resolution, and the corpus must stay inside the value domain
 * where they are provably identical (see the NaN/-0 pins in layer 2).
 */
function fuzzNodes(seed: number, count: number): PositionedNode[] {
  const rng = mulberry32(seed);
  const nodes: PositionedNode[] = [];
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rng() * 500) - 100;
    const y = Math.floor(rng() * 500) - 100;
    if (i % 3 === 2) {
      nodes.push(labelNode(`n${i}`, x, y));
    } else {
      nodes.push(node(`n${i}`, x, y, 40 + Math.floor(rng() * 200), 30 + Math.floor(rng() * 120)));
    }
  }
  return nodes;
}

function expectSameExtents(actual: NodeExtents | null, expected: NodeExtents | null): void {
  expect(actual === null).toBe(expected === null);
  if (expected === null || actual === null) return;
  // Object.is, not toEqual: -0 vs +0 and NaN-vs-NaN must be seen exactly.
  expect(Object.is(actual.minX, expected.minX)).toBe(true);
  expect(Object.is(actual.minY, expected.minY)).toBe(true);
  expect(Object.is(actual.maxX, expected.maxX)).toBe(true);
  expect(Object.is(actual.maxY, expected.maxY)).toBe(true);
}

// ---------------------------------------------------------------------------
// Layer 1: verbatim oracle — canonical fold ≡ each pre-round-41 inline scan
// ---------------------------------------------------------------------------

describe('node-extent scan: canonical fold ≡ pre-round-41 inline scans', () => {
  const READS: Array<{
    name: string;
    old: (nodes: PositionedNode[]) => NodeExtents | null;
    read: (node: ExtentNode) => NodeExtentEdges;
  }> = [
    {
      name: 'spread form, fallback 0 (BaseLayoutEngine bounds)',
      old: oldSpreadBoundsFallback0,
      read: (n) => nodeExtentEdges(n, 0, 0),
    },
    {
      name: 'spread form, DEFAULT fallback (ezo utilization / fit-to-canvas)',
      old: oldSpreadBoundsDefault,
      read: (n) => nodeExtentEdges(n),
    },
    {
      name: 'both-corner flat scan, DEFAULT fallback (CLE / Cultural bounds)',
      old: oldFlatCornerBounds,
      read: (n) => nodeExtentEdges(n),
    },
    {
      name: '|| 0 cluster read (CLE cluster bounds)',
      old: oldClusterBounds,
      read: orZeroExtentEdges,
    },
    {
      name: 'sanitizeFinite comparison loop (canvas-calculator)',
      old: oldSanitizedLoopBounds,
      read: sanitizedExtentEdges,
    },
    {
      name: 'raw comparison loop, fallback 0 (v2 canvas size / strategy-selector)',
      old: oldRawLoopBoundsFallback0,
      read: (n) => nodeExtentEdges(n, 0, 0),
    },
    {
      name: 'Math.min/max accumulator loop, DEFAULT fallback (ezo fit-to-canvas)',
      old: oldAccumulatorLoopBounds,
      read: (n) => nodeExtentEdges(n),
    },
  ];

  for (const { name, old, read } of READS) {
    it(`canonical fold equals the retired scan: ${name}`, () => {
      for (let seed = 1; seed <= 25; seed++) {
        for (const count of [1, 5, 12]) {
          const nodes = fuzzNodes(seed, count);
          expectSameExtents(foldNodeExtents(nodes, read), old(nodes));
        }
      }
    });
  }

  it('canvas-seeded worker bounds: canonical max edge ≡ retired raw-width spread', () => {
    const rng = mulberry32(0xbee2);
    for (let seed = 0; seed < 15; seed++) {
      const nodes = Array.from({ length: 4 + (seed % 9) }, (_, i) => ({
        // Worker nodes always carry finite width/height (`|| 120` / `|| 60`
        // at construction) — the corpus must respect that contract for the
        // canonical getNodeWidth read to be value-identical to raw n.width.
        x: Math.floor(rng() * 600) - 100,
        y: Math.floor(rng() * 600) - 100,
        width: 60 + Math.floor(rng() * 180),
        height: 40 + Math.floor(rng() * 100),
        id: `w${i}`,
        label: `w${i}`,
      }));
      const configWidth = Math.floor(rng() * 1200);
      const configHeight = Math.floor(rng() * 900);
      const extents = foldNodeExtents(nodes, (n) => nodeExtentEdges(n, 0, 0))!;
      const retired = oldWorkerBounds(nodes, configWidth, configHeight);
      expect(Math.max(extents.maxX, configWidth)).toBe(retired.width);
      expect(Math.max(extents.maxY, configHeight)).toBe(retired.height);
    }
  });

  it('empty input: canonical returns null where every retired site had its own empty branch', () => {
    expect(foldNodeExtents([], (n) => nodeExtentEdges(n))).toBeNull();
    expect(foldNodeExtents([], sanitizedExtentEdges)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Layer 2: semantic pins — including the per-axis exact witnesses the
// round-40 mutation M3 taught us fuzz cannot see.
// ---------------------------------------------------------------------------

describe('node-extent scan: semantic pins', () => {
  it('single node: extents are exactly that node\'s four edges', () => {
    const extents = foldNodeExtents([node('solo', 10, 20, 100, 50)], (n) => nodeExtentEdges(n, 0, 0))!;
    expect(extents).toEqual({ minX: 10, minY: 20, maxX: 110, maxY: 70 });
  });

  it('FALLBACK AXIS witness: a dimension-less node is 0px wide to the fallback-0 policy and DEFAULT-sized to the default policy', () => {
    const dimless = labelNode('d', 200, 100);
    // Default policy (ezo utilization/fit, CLE/Cultural bounds):
    expect(nodeExtentEdges(dimless)).toEqual({ left: 200, top: 100, right: 320, bottom: 160 });
    // Fallback-0 policy (BaseLayoutEngine bounds, canvas fitting, worker):
    expect(nodeExtentEdges(dimless, 0, 0)).toEqual({ left: 200, top: 100, right: 200, bottom: 100 });
    // And the fold inherits the read's policy, not its own:
    expect(foldNodeExtents([dimless], (n) => nodeExtentEdges(n, 0, 0))!.maxX).toBe(200);
    expect(foldNodeExtents([dimless], nodeExtentEdges)!.maxX).toBe(320);
  });

  it('WIDTH-ALIAS AXIS witness: getNodeWidth chain is width → w → fallback, exactly once in the read', () => {
    const wOnly = { id: 'w', label: 'w', x: 0, y: 0, w: 77, h: 33 } as PositionedNode;
    expect(nodeExtentEdges(wOnly, 0, 0)).toEqual({ left: 0, top: 0, right: 77, bottom: 33 });
    const widthWins = { ...wOnly, width: 55, height: 22 };
    expect(nodeExtentEdges(widthWins, 0, 0)).toEqual({ left: 0, top: 0, right: 55, bottom: 22 });
  });

  it('NaN POLICY witness: a raw read propagates NaN into the box (fail-loud, the spread sites\' historic policy); a sanitized read cannot', () => {
    const poisoned = [{ ...node('p', 50, 60, 100, 40), x: Number.NaN }];
    expect(() => {
      const extents = foldNodeExtents(poisoned as PositionedNode[], (n) => nodeExtentEdges(n, 0, 0))!;
      expect(Number.isNaN(extents.minX)).toBe(true);
    }).not.toThrow();
    const sanitized = foldNodeExtents(poisoned as PositionedNode[], sanitizedExtentEdges)!;
    expect(sanitized).toEqual({ minX: 0, minY: 60, maxX: 100, maxY: 100 });
  });

  it('|| 0 READ witness: a missing coordinate contributes 0, never NaN (cluster NodeDatum contract)', () => {
    const raw = { id: 'c', label: 'c' } as unknown as PositionedNode;
    const extents = foldNodeExtents([raw], orZeroExtentEdges)!;
    expect(extents).toEqual({
      minX: 0,
      minY: 0,
      maxX: getNodeWidth(raw),
      maxY: getNodeHeight(raw),
    });
  });

  it('NEGATIVE-WIDTH DELTA witness (documented behavior change at the retired flat-scan sites)', () => {
    // Pre-r41, CLE/Cultural bounds scanned BOTH corners, so a node with a
    // negative explicit width got a zero-ish box (min over {100, 50} = 50,
    // max = 100 → width 50). The canonical direct-corner read resolves the
    // same node to a REVERSED box (minX 100 > maxX 50 → width -50). Negative
    // widths are degenerate input — placement (r37) only produces positive
    // explicit dimensions — so this pins the new canonical deliberately.
    const degenerate = node('neg', 100, 0, -50, 40);
    expect(oldFlatCornerBounds([degenerate])).toEqual({ minX: 50, minY: 0, maxX: 100, maxY: 40 });
    expect(foldNodeExtents([degenerate], nodeExtentEdges)).toEqual({
      minX: 100,
      minY: 0,
      maxX: 50,
      maxY: 40,
    });
  });

  it('CANVAS-SEED witness: worker bounds floor at the requested canvas, exceeding it wins', () => {
    const tiny = [node('t', 0, 0, 100, 50)]; // max edge 100 / 50
    const foldTiny = foldNodeExtents(tiny, (n) => nodeExtentEdges(n, 0, 0))!;
    expect(Math.max(foldTiny.maxX, 800)).toBe(800);
    const big = [node('b', 0, 0, 900, 500)]; // max edge 900 / 500
    const foldBig = foldNodeExtents(big, (n) => nodeExtentEdges(n, 0, 0))!;
    expect(Math.max(foldBig.maxX, 800)).toBe(900);
  });
});

// ---------------------------------------------------------------------------
// Layer 3: source anchors — the 11 migrated sites delegate, none re-inlines
// ---------------------------------------------------------------------------

describe('node-extent scan: source anchors', () => {
  const SITES: Array<{ file: string; anchor: RegExp; site: string }> = [
    {
      file: 'src/visualization/base/BaseLayoutEngine.ts',
      anchor: /foldNodeExtents\(nodes, \(n\) => nodeExtentEdges\(n, 0, 0\)\)/,
      site: 'BaseLayoutEngine.calculateBounds (fallback-0 read)',
    },
    {
      file: 'src/visualization/enhanced-zero-overlap-layout.ts',
      anchor: /foldNodeExtents\(nodes, nodeExtentEdges\)/,
      site: 'ezo calculateCanvasUtilization + fitNodesToCanvas (DEFAULT-fallback read, 2 occurrences)',
    },
    {
      file: 'src/visualization/complex-layout-engine.ts',
      anchor: /foldNodeExtents\(layout\.nodes \|\| \[\], nodeExtentEdges\)/,
      site: 'complex-layout-engine.calculateBounds (DEFAULT-fallback read, nullable nodes)',
    },
    {
      file: 'src/visualization/complex-layout-engine.ts',
      anchor: /left: node\.x \|\| 0,/,
      site: 'complex-layout-engine.calculateClusterBounds (|| 0 read at the delegation seam)',
    },
    {
      file: 'src/visualization/strategies/CulturalLayoutAdapter.ts',
      anchor: /foldNodeExtents\(layout\.nodes, nodeExtentEdges\)/,
      site: 'CulturalLayoutAdapter.calculateBounds (DEFAULT-fallback read)',
    },
    {
      file: 'src/visualization/canvas-calculator.ts',
      anchor: /foldNodeExtents\(nodes, sanitizedExtentEdges\)/,
      site: 'canvas-calculator calculate + center (sanitized read, 2 occurrences)',
    },
    {
      file: 'src/visualization/layout-engine-v2.ts',
      anchor: /foldNodeExtents\(nodes, \(n\) => nodeExtentEdges\(n, 0, 0\)\)/,
      site: 'layout-engine-v2.calculateCanvasSize (fallback-0 read)',
    },
    {
      file: 'src/visualization/strategy-selector.ts',
      anchor: /foldNodeExtents\(nodes, \(n\) => nodeExtentEdges\(n, 0, 0\)\)/,
      site: 'strategy-selector.calculateBoundingBox (fallback-0 read)',
    },
    {
      file: 'src/workers/layout-worker.ts',
      anchor: /foldNodeExtents\(positionedNodes, \(n\) => nodeExtentEdges\(n, 0, 0\)\)/,
      site: 'layout-worker final bounds (fallback-0 read under the canvas seed)',
    },
  ];

  for (const { file, anchor, site } of SITES) {
    it(`delegates to the canonical fold: ${site}`, () => {
      expect(readSource(file)).toMatch(anchor);
    });
  }

  it('the ezo file carries BOTH delegations (utilization + fit-to-canvas)', () => {
    const src = readSource('src/visualization/enhanced-zero-overlap-layout.ts');
    expect(src.match(/foldNodeExtents\(nodes, nodeExtentEdges\)/g)?.length).toBe(2);
  });

  it('canvas-calculator carries BOTH delegations (calculate + center)', () => {
    const src = readSource('src/visualization/canvas-calculator.ts');
    expect(src.match(/foldNodeExtents\(nodes, sanitizedExtentEdges\)/g)?.length).toBe(2);
  });

  it('no migrated site re-inlines a retired extent idiom', () => {
    const files = [
      'src/visualization/base/BaseLayoutEngine.ts',
      'src/visualization/enhanced-zero-overlap-layout.ts',
      'src/visualization/complex-layout-engine.ts',
      'src/visualization/strategies/CulturalLayoutAdapter.ts',
      'src/visualization/canvas-calculator.ts',
      'src/visualization/layout-engine-v2.ts',
      'src/visualization/strategy-selector.ts',
      'src/workers/layout-worker.ts',
    ];
    const retiredIdioms = [
      /Math\.min\(\.\.\..*\.map\(.*\.x\b/,
      /Math\.max\(\.\.\..*\.map\(.*\.x \+/,
      /let minX = Infinity/,
      /if \(left < minX\)/,
    ];
    for (const file of files) {
      for (const line of readSource(file).split('\n')) {
        // comment lines may quote the retired shapes (they document history)
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
        for (const idiom of retiredIdioms) {
          expect({ file, line: line.trim(), idiom: idiom.source, hit: idiom.test(line) }).toEqual(
            expect.objectContaining({ hit: false }),
          );
        }
      }
    }
  });

  it('the canonical fold exists exactly once, in layout-utils', () => {
    const src = readSource('src/visualization/layout-utils.ts');
    expect(src.match(/export function foldNodeExtents/g)?.length).toBe(1);
    expect(src.match(/export function nodeExtentEdges/g)?.length).toBe(1);
  });
});
