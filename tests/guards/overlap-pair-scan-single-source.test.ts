/**
 * @jest-environment node
 */
/**
 * overlap-pair-scan-single-source.test.ts — round 39.
 *
 * Family: the pairwise overlap scan — `for i / for j = i+1 /
 * nodesOverlap(nodes[i], nodes[j]) / accumulate` — was inlined at 9 sites
 * across three continents (producers: BaseLayoutEngine, ezo brute branch,
 * NetworkLayoutStrategy, cycle-strategy, timeline-strategy, layout-engine-v2;
 * judges: LayoutEvaluator, quality-monitor; pipeline metric:
 * quality-estimators). Canonical since round 39:
 * detectOverlapPairs / countOverlapPairs / hasOverlapPairs in
 * src/visualization/layout-utils.ts, built directly on the ONE predicate
 * (`nodesOverlap`) that every site already delegated to.
 *
 * DRIFT SCENARIO this guard defends against: the scan written into one engine
 * diverges from the judge's scan — e.g. one copy starts counting ordered pairs
 * (j from 0 → double count), another drops the spacing expansion or flips
 * node1/node2, a third early-exits on the wrong index — and a layout the
 * producer cleared gets scored dirty (or vice versa), exactly the
 * invariant-split class that rounds 15/38 kept finding between producer and
 * judge. The scan is the core "zero overlap" guarantee; it cannot have 9
 * shapes.
 *
 * Layers:
 *   1. VERBATIM ORACLE — the pre-round-39 inline scan bodies, frozen below,
 *      must produce deep-equal output to the canonical helpers over a seeded
 *      fuzz corpus × spacing {0, 20, 40} × explicit-dimension and
 *      label-sized nodes. Any mutation of loop bounds, index order, pair
 *      shape, or spacing plumbing diverges here.
 *   2. SEMANTIC PINS — i<j visiting order with node1 = nodes[i], touching
 *      edges are NOT an overlap at spacing 0, has/count are the pair scan
 *      viewed as boolean/number (including the early-exit path).
 *   3. SOURCE ANCHORS — each of the 9 migrated sites delegates to the
 *      canonical helper and no longer inlines the scan; the three sites with a
 *      NONZERO default spacing keep their own default expression
 *      (LayoutEvaluator 0 = geometric judge, BaseLayoutEngine
 *      config.nodeSeparation, ezo minimumSpacing.nodeToNode with the r38
 *      geometric-vs-spacing split intact).
 *
 * The "no site re-inlines the nodes[i]/nodes[j] scan" discovery sweep lives in
 * the shared registry (frozen-literal-families/overlap-pair-scan.ts); this
 * file holds the behavioral pins.
 */

import { describe, it, expect } from '@jest/globals';
import { mulberry32 } from '@tests/helpers/fuzz';
import { readSource } from '@tests/guards/freeze-guard';
import type { PositionedNode } from '@stv/core/types/diagram';
import {
  nodesOverlap,
  detectOverlapPairs,
  countOverlapPairs,
  hasOverlapPairs,
} from '@/visualization/layout-utils';

// ---------------------------------------------------------------------------
// Layer 1 material: the VERBATIM pre-round-39 inline scans (frozen from
// BaseLayoutEngine.ts @ b3b6f0ff — the pairs variant — plus the count and
// early-exit-boolean variants as they lived at NetworkLayoutStrategy /
// cycle-strategy). Do not "improve" these copies: their job is to be the old
// behavior, not good behavior.
// ---------------------------------------------------------------------------

function inlineDetectAllOverlaps(nodes: PositionedNode[], minSpacing: number): { node1: PositionedNode; node2: PositionedNode }[] {
  const overlaps: { node1: PositionedNode; node2: PositionedNode }[] = [];

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodesOverlap(nodes[i], nodes[j], minSpacing)) {
        overlaps.push({ node1: nodes[i], node2: nodes[j] });
      }
    }
  }

  return overlaps;
}

function inlineCountOverlaps(nodes: PositionedNode[], spacing: number): number {
  let count = 0;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodesOverlap(nodes[i], nodes[j], spacing)) {
        count++;
      }
    }
  }

  return count;
}

function inlineDetectOverlapsAny(nodes: PositionedNode[]): boolean {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodesOverlap(nodes[i], nodes[j])) {
        return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Corpus helpers
// ---------------------------------------------------------------------------

/** Minimal valid positioned node with EXPLICIT dimensions (r37 sizing path). */
function node(id: string, x: number, y: number, width: number, height: number): PositionedNode {
  return { id, label: id, x, y, width, height };
}

/** Label-only node — dimensions come from the label sizer, like real layouts. */
function labelNode(id: string, label: string, x: number, y: number): PositionedNode {
  return { id, label, x, y } as PositionedNode;
}

/** Seeded node-field corpus: overlap → touch → spacing-violation → safe. */
function fuzzNodes(seed: number, count: number): PositionedNode[] {
  const rng = mulberry32(seed);
  const nodes: PositionedNode[] = [];
  for (let i = 0; i < count; i++) {
    const w = 60 + Math.floor(rng() * 180);
    const h = 40 + Math.floor(rng() * 100);
    // Gaps in [-30, 60) on a shared Y band make the X axis decisive, but the
    // independent Y below still exercises 2-D intersections.
    const x = Math.floor(rng() * 400);
    const y = Math.floor(rng() * 60) + (rng() < 0.5 ? 0 : Math.floor(rng() * 300));
    const gap = Math.floor(rng() * 90) - 30;
    if (i % 2 === 0) {
      nodes.push(node(`a${i}`, x, y, w, h));
    } else {
      // Pair each odd node against the previous one at a controlled gap.
      const prev = nodes[i - 1];
      nodes.push(node(`b${i}`, (prev.x ?? 0) + w + gap, y, w, h));
    }
  }
  return nodes;
}

// ---------------------------------------------------------------------------
// Layer 1: verbatim oracle — canonical helpers ≡ pre-round-39 inline scans
// ---------------------------------------------------------------------------

describe('overlap-pair scan: canonical helpers ≡ pre-round-39 inline scans', () => {
  const SPACINGS = [0, 20, 40];

  for (const spacing of SPACINGS) {
    it(`detectOverlapPairs equals the inline pairs scan at spacing ${spacing}`, () => {
      for (let seed = 1; seed <= 25; seed++) {
        const nodes = fuzzNodes(seed, 12);
        expect(detectOverlapPairs(nodes, spacing)).toEqual(inlineDetectAllOverlaps(nodes, spacing));
      }
    });

    it(`countOverlapPairs equals the inline count scan at spacing ${spacing}`, () => {
      for (let seed = 1; seed <= 25; seed++) {
        const nodes = fuzzNodes(seed, 12);
        expect(countOverlapPairs(nodes, spacing)).toBe(inlineCountOverlaps(nodes, spacing));
      }
    });

    it(`hasOverlapPairs equals the inline early-exit scan at spacing ${spacing}`, () => {
      for (let seed = 1; seed <= 25; seed++) {
        const nodes = fuzzNodes(seed, 12);
        expect(hasOverlapPairs(nodes, spacing)).toBe(inlineCountOverlaps(nodes, spacing) > 0);
      }
    });
  }

  it('label-sized nodes (no explicit dimensions) take the same path in both scans', () => {
    const labels = ['短い', 'a-much-longer-label-here', 'x', 'ラベル付きノードの見出し'];
    const nodes: PositionedNode[] = [];
    const rng = mulberry32(0xfeed);
    for (let i = 0; i < 16; i++) {
      nodes.push(
        labelNode(
          `n${i}`,
          labels[Math.floor(rng() * labels.length)],
          Math.floor(rng() * 300),
          Math.floor(rng() * 300),
        ),
      );
    }
    for (const spacing of SPACINGS) {
      expect(detectOverlapPairs(nodes, spacing)).toEqual(inlineDetectAllOverlaps(nodes, spacing));
    }
  });

  it('empty and single-node arrays return empty/0/false without dividing or indexing', () => {
    expect(detectOverlapPairs([])).toEqual([]);
    expect(countOverlapPairs([])).toBe(0);
    expect(hasOverlapPairs([])).toBe(false);
    expect(detectOverlapPairs([node('solo', 0, 0, 100, 50)])).toEqual([]);
    expect(hasOverlapPairs([node('solo', 0, 0, 100, 50)])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Layer 2: semantic pins — the contract every migrated site relies on
// ---------------------------------------------------------------------------

describe('overlap-pair scan: semantics', () => {
  it('pairs are visited in i<j order with node1 = nodes[i], node2 = nodes[j]', () => {
    // a∩b, a∩c, b∩c — all three intersect; order must be by index pair.
    const nodes = [
      node('a', 0, 0, 100, 50),
      node('b', 50, 0, 100, 50),
      node('c', 25, 0, 100, 50),
    ];
    const pairs = detectOverlapPairs(nodes);
    expect(pairs.map((p) => [p.node1.id, p.node2.id])).toEqual([
      ['a', 'b'],
      ['a', 'c'],
      ['b', 'c'],
    ]);
  });

  it('touching edges (0 px gap) are NOT an overlap at spacing 0 — the r38 geometric contract', () => {
    const a = node('a', 0, 0, 120, 60);
    const b = node('b', 120, 0, 120, 60); // right edge of a == left edge of b
    expect(hasOverlapPairs([a, b], 0)).toBe(false);
    expect(countOverlapPairs([a, b], 0)).toBe(0);
  });

  it('a spacing-violating-but-geometrically-clean pair counts only when spacing is passed', () => {
    // 25 px gap: geometrically clean, violates a 40 px spacing target.
    const a = node('a', 0, 0, 120, 60);
    const b = node('b', 145, 0, 120, 60);
    expect(countOverlapPairs([a, b], 0)).toBe(0);   // geometric (r38 overlapCount)
    expect(countOverlapPairs([a, b], 40)).toBe(1);  // spacing target (r38 spacingViolationCount)
  });

  it('has/count/pairs are one scan in three projections (exhaustive boundary sweep)', () => {
    for (let gap = -30; gap <= 60; gap += 5) {
      for (const spacing of [0, 10, 40]) {
        const a = node('a', 0, 0, 100, 50);
        const b = node('b', 100 + gap, 0, 100, 50);
        const pairs = detectOverlapPairs([a, b], spacing);
        expect(countOverlapPairs([a, b], spacing)).toBe(pairs.length);
        expect(hasOverlapPairs([a, b], spacing)).toBe(pairs.length > 0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Layer 3: source anchors — the 9 sites delegate; defaults stay per-site
// ---------------------------------------------------------------------------

const SITES: Array<{ file: string; delegation: RegExp; label: string }> = [
  {
    file: 'src/pipeline/quality-estimators.ts',
    delegation: /totalOverlaps \+= countOverlapPairs\(scene\.layout\.nodes, 0\)/,
    label: 'pipeline overlap metric counts via countOverlapPairs at spacing 0',
  },
  {
    file: 'src/visualization/layout-engine-v2.ts',
    delegation: /const overlapCount = countOverlapPairs\(nodes\)/,
    label: 'v2 metrics overlapCount delegates (spacing-0 default)',
  },
  {
    file: 'src/visualization/strategies/NetworkLayoutStrategy.ts',
    delegation: /private countOverlaps[\s\S]*?return countOverlapPairs\(nodes, spacing\)/,
    label: 'network strategy count delegates with caller spacing',
  },
  {
    file: 'src/visualization/strategies/cycle-strategy.ts',
    delegation: /private detectOverlaps[\s\S]*?return hasOverlapPairs\(nodes\)/,
    label: 'cycle strategy any-scan delegates (early exit preserved in helper)',
  },
  {
    file: 'src/visualization/strategies/timeline-strategy.ts',
    delegation: /const hasOverlaps = hasOverlapPairs\(optimizedNodes\)/,
    label: 'timeline step-5 any-scan delegates',
  },
  {
    file: 'src/quality/quality-monitor.ts',
    delegation: /return hasOverlapPairs\(safeNodes\)/,
    label: 'quality monitor delegates after defensive coordinate coercion',
  },
  {
    file: 'src/visualization/strategies/LayoutEvaluator.ts',
    delegation: /return detectOverlapPairs\(nodes, spacing \?\? 0\)/,
    label: 'judge scans geometrically by default (spacing 0)',
  },
  {
    file: 'src/visualization/base/BaseLayoutEngine.ts',
    delegation: /return detectOverlapPairs\(nodes, spacing \?\? this\.config\.nodeSeparation\)/,
    label: 'base engine default stays config.nodeSeparation',
  },
  {
    file: 'src/visualization/enhanced-zero-overlap-layout.ts',
    delegation: /\/\/ disabled — round 39 single source[\s\S]*?return detectOverlapPairs\(nodes, minSpacing\)/,
    label: 'ezo brute-force branch delegates',
  },
];

describe('overlap-pair scan: every migrated site delegates to layout-utils', () => {
  for (const site of SITES) {
    it(`${site.file}: ${site.label}`, () => {
      const src = readSource(site.file);
      expect({ file: site.file, delegated: site.delegation.test(src) }).toEqual({
        file: site.file,
        delegated: true,
      });
      // And it no longer inlines the scan shape.
      expect(src.includes('nodesOverlap(nodes[i], nodes[j]')).toBe(false);
    });
  }

  it('layout-utils exports the trio and count is defined AS the pairs length', () => {
    const src = readSource('src/visualization/layout-utils.ts');
    expect(src).toMatch(/export function detectOverlapPairs\(/);
    expect(src).toMatch(/export function countOverlapPairs\(/);
    expect(src).toMatch(/export function hasOverlapPairs\(/);
    // count must stay a projection of the pairs scan, not a second loop.
    expect(src).toMatch(/return detectOverlapPairs\(nodes, minSpacing\)\.length;/);
  });

  it('ezo keeps the r38 contracts: grid fast-path branch + spacing-parameter default', () => {
    const src = readSource('src/visualization/enhanced-zero-overlap-layout.ts');
    // Fast path still routes through the spatial grid when enabled.
    expect(src).toMatch(
      /if \(this\.config\.spatialIndexing && nodes\.length > 4\) \{\s*\n\s*return this\.detectOverlapsWithSpatialGrid\(nodes, minSpacing\)/,
    );
    // Default stays the 40 px spacing target (NOT a geometric default).
    // Phase 141: the `!` became the fail-loud `requireMinimumSpacing()` accessor.
    expect(src).toMatch(/minSpacing: number = this\.requireMinimumSpacing\(\)\.nodeToNode/);
    // r38 metric split stays on the two explicit spacings.
    expect(src).toMatch(/this\.detectAllOverlaps\(layout\.nodes, 0\)/);
    expect(src).toMatch(/const spacingViolations = this\.detectAllOverlaps\(layout\.nodes\);/);
  });

  it('quality-monitor keeps the defensive coercion BEFORE delegating', () => {
    const src = readSource('src/quality/quality-monitor.ts');
    expect(src).toMatch(/x: Number\(n\.x\) \|\| 0, y: Number\(n\.y\) \|\| 0/);
  });
});
