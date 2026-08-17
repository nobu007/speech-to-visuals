/**
 * @jest-environment node
 */
/**
 * node-canvas-clamp-single-source.test.ts — round 45.
 *
 * Family: the CANVAS CLAMP of a positioned node's top-left coordinate —
 * `Math.max(lo, Math.min(canvas - size - lo, v))` — was inlined at 17 x/y
 * coordinate-pair sites in three margin policies: the zero-margin form
 * `Math.max(0, Math.min(canvas - size, v))` (ezo grid+jitter placement,
 * post-resolver clamp, NaN-guarded force application, jitter candidates,
 * eight collision-resolution moves; NetworkLayoutStrategy grid placement),
 * the margin form `Math.max(m, Math.min(canvas - size - m, v))`
 * (force-directed-params keepInView via FORCE_DIRECTED_PHYSICS.BOUNDS_MARGIN,
 * network-strategy keep-within-bounds at literal 20, strategies/OverlapResolver
 * constrainNodeToBounds at default-10 margin via a double-guarded maxX), and
 * the point-clamp degenerate `size = 0` (complex-layout-engine velocity
 * integration, which clamps the point and ignores the node extent by design).
 * Canonical since round 45: `clampNodeCoordinate` in
 * src/visualization/layout-utils.ts. Zero-delta round: every delegation is
 * bit-identical to the retired expression, including NaN and the oversized
 * band collapse.
 *
 * DRIFT SCENARIO this guard defends against: one copy drops the
 * `- nodeSize` term (the node's right/bottom edge slides off canvas — ezo
 * and NetworkLayoutStrategy both clamp grid placements, so the two grids
 * could disagree about whether jitter can leave the canvas), another swaps
 * the margin into the wrong side or returns the inverted `hi < lo` band on
 * an oversized node (one engine parks oversized nodes at `margin`, another
 * at a negative coordinate), a third sanitizes NaN where the retired forms
 * propagated it (or vice versa). That is the duplicate-formula /
 * invariant-split class rounds 15/38/39 kept finding, on every
 * "keep the node on the canvas" decision.
 *
 * Layers:
 *   1. VERBATIM ORACLE — the four retired inline forms (zero-margin,
 *      margin-direct, OverlapResolver's double-guarded maxX, point-clamp),
 *      frozen below, must be Object.is-identical to the canonical over a
 *      seeded fuzz corpus spanning in/below/above band, oversized nodes,
 *      every margin policy, ±Infinity and NaN. Any mutation of the band
 *      (dropped size term, swapped margin, flipped max/min, NaN
 *      sanitization) diverges here.
 *   2. SEMANTIC PINS — in-range passthrough, lower/upper collapse, the
 *      oversized-node → LOWER-bound policy (never the inverted band),
 *      default margin 0, IEEE-exact NaN/±Infinity/-0 propagation, and the
 *      double-guard equivalence witness for the retired OverlapResolver
 *      idiom.
 *   3. SOURCE ANCHORS — each of the 17 migrated sites delegates to the
 *      canonical with its OWN size/margin policy, ezo keeps its NaN
 *      pre-guard AT the site (a site policy, not part of the clamp), and
 *      none re-inlines the retired shapes.
 *
 * The "no site re-inlines the clamp" discovery sweep lives in the shared
 * registry (frozen-literal-families/node-canvas-clamp.ts); this file holds
 * the behavioral pins.
 */

import { describe, it, expect } from '@jest/globals';
import { mulberry32 } from '@tests/helpers/fuzz';
import { readSource } from '@tests/guards/freeze-guard';
import { clampNodeCoordinate } from '@/visualization/layout-utils';

// ---------------------------------------------------------------------------
// Layer 1 material: the VERBATIM pre-round-45 inline clamps, frozen from the
// six migrated files at 1bd1ab9f (round 43 HEAD). Do not "improve" these
// copies: their job is to be the old behavior, not good behavior.
// ---------------------------------------------------------------------------

/**
 * Zero-margin form — verbatim from the 13 zero-margin sites (ezo ×12 pairs:
 * grid+jitter placement, post-resolver clamp, NaN-guarded force application,
 * jitter candidates, eight collision-resolution moves; NetworkLayoutStrategy
 * grid placement).
 */
function oldZeroMargin(value: number, canvasSize: number, nodeSize: number): number {
  return Math.max(0, Math.min(canvasSize - nodeSize, value));
}

/**
 * Margin form — verbatim from force-directed-params keepInView
 * (`Math.max(margin, Math.min(bounds.width - getNodeWidth(node) - margin, node.x))`)
 * and network-strategy keep-within-bounds (same shape at literal 20).
 */
function oldMarginDirect(
  value: number,
  canvasSize: number,
  nodeSize: number,
  margin: number
): number {
  return Math.max(margin, Math.min(canvasSize - nodeSize - margin, value));
}

/**
 * Double-guarded form — verbatim from strategies/OverlapResolver
 * constrainNodeToBounds: the upper bound is pre-clamped to the margin, THEN
 * the value clamps into [margin, maxX].
 */
function oldDoubleGuard(
  value: number,
  canvasSize: number,
  nodeSize: number,
  margin: number
): number {
  const maxX = Math.max(margin, canvasSize - nodeSize - margin);
  return Math.max(margin, Math.min(value, maxX));
}

/**
 * Point-clamp degenerate — verbatim from complex-layout-engine velocity
 * integration (`Math.max(0, Math.min(this.config.width, pos.x + pos.vx))`):
 * size 0, the node extent is ignored by design.
 */
function oldPointClamp(value: number, canvasSize: number): number {
  return Math.max(0, Math.min(canvasSize, value));
}

describe('round 45: node canvas clamp single source — layer 1 verbatim oracle', () => {
  const rng = mulberry32(4521);
  // deterministic corpus builder (no Math.random): mulberry32 stream
  const next = () => rng() * 3000 - 500; // [-500, 2500): below/in/above a 1920 band

  const values: number[] = [];
  for (let i = 0; i < 400; i++) values.push(next());
  // crafted degenerates the random stream might under-sample
  values.push(NaN, Infinity, -Infinity, 0, -0, 1920, 1800, 2500, -500);

  const canvases = [0, 320, 1080, 1920, 2500];
  const sizes = [0, 60, 120, 700, 2500];
  const margins = [0, 10, 20];

  it('canonical is Object.is-identical to the retired zero-margin form (13 site pairs)', () => {
    let checked = 0;
    for (const canvasSize of canvases) {
      for (const nodeSize of sizes) {
        for (const value of values) {
          expect(
            Object.is(
              clampNodeCoordinate(value, canvasSize, nodeSize),
              oldZeroMargin(value, canvasSize, nodeSize)
            )
          ).toBe(true);
          checked++;
        }
      }
    }
    // non-vacuum: the corpus actually exercised all three outcomes
    expect(checked).toBe(5 * 5 * values.length);
    const outcomes = new Set(
      canvases.flatMap((c) => sizes.map((s) => clampNodeCoordinate(1500, c, s)))
    );
    expect(outcomes.size).toBeGreaterThan(1);
  });

  it('canonical is Object.is-identical to the retired margin form (fdp + network-strategy)', () => {
    for (const canvasSize of canvases) {
      for (const nodeSize of sizes) {
        for (const margin of margins) {
          for (const value of values) {
            expect(
              Object.is(
                clampNodeCoordinate(value, canvasSize, nodeSize, margin),
                oldMarginDirect(value, canvasSize, nodeSize, margin)
              )
            ).toBe(true);
          }
        }
      }
    }
  });

  it('canonical is Object.is-identical to the retired double-guard form (OverlapResolver)', () => {
    for (const canvasSize of canvases) {
      for (const nodeSize of sizes) {
        for (const margin of margins) {
          for (const value of values) {
            expect(
              Object.is(
                clampNodeCoordinate(value, canvasSize, nodeSize, margin),
                oldDoubleGuard(value, canvasSize, nodeSize, margin)
              )
            ).toBe(true);
          }
        }
      }
    }
  });

  it('canonical at size 0 is Object.is-identical to the retired point clamp (complex-layout-engine)', () => {
    for (const canvasSize of canvases) {
      for (const value of values) {
        expect(
          Object.is(clampNodeCoordinate(value, canvasSize, 0), oldPointClamp(value, canvasSize))
        ).toBe(true);
      }
    }
  });

  it('the corpus is non-vacuous: all three band outcomes occur', () => {
    const canvas = 1920;
    const size = 120;
    expect(clampNodeCoordinate(500, canvas, size)).toBe(500); // in-band passthrough
    expect(clampNodeCoordinate(-10, canvas, size)).toBe(0); // below → lower
    expect(clampNodeCoordinate(2500, canvas, size)).toBe(1800); // above → upper
  });
});

describe('round 45: node canvas clamp single source — layer 2 semantic pins', () => {
  it('in-range value passes through untouched', () => {
    expect(clampNodeCoordinate(500, 1920, 120)).toBe(500);
    expect(clampNodeCoordinate(500, 1920, 120, 10)).toBe(500);
  });

  it('below-band collapses to the lower bound (margin, defaulting 0)', () => {
    expect(clampNodeCoordinate(-10, 1920, 120)).toBe(0);
    expect(clampNodeCoordinate(5, 1920, 120, 10)).toBe(10);
    expect(clampNodeCoordinate(15, 1920, 120, 20)).toBe(20);
  });

  it('above-band collapses to canvasSize - nodeSize - margin (the width term survives)', () => {
    expect(clampNodeCoordinate(2500, 1920, 120)).toBe(1800);
    expect(clampNodeCoordinate(2500, 1920, 120, 10)).toBe(1790);
    // the term this family exists to protect: dropping `- nodeSize` returns 1920
    expect(clampNodeCoordinate(2500, 1920, 120)).not.toBe(1920);
  });

  it('an OVERSIZED node (upper < lower) resolves to the lower bound, never the inverted band', () => {
    // 100 - 250 - 10 < 10 → the band is inverted; lower bound wins
    expect(clampNodeCoordinate(500, 100, 250, 10)).toBe(10);
    expect(clampNodeCoordinate(-500, 100, 250, 10)).toBe(10);
    // zero-margin oversized: collapses to 0, not a negative coordinate
    expect(clampNodeCoordinate(500, 100, 250)).toBe(0);
    expect(clampNodeCoordinate(500, 0, 0)).toBe(0);
  });

  it('margin defaults to 0 (the 13 zero-margin sites omit it)', () => {
    expect(clampNodeCoordinate(500, 1920, 120, 0)).toBe(clampNodeCoordinate(500, 1920, 120));
  });

  it('IEEE-exact propagation: NaN stays NaN, ±Infinity collapse, -0 normalizes to +0', () => {
    // NaN propagates exactly as the retired bare-Math forms did — sites that
    // must not propagate guard BEFORE the call (ezo force application)
    expect(Object.is(clampNodeCoordinate(NaN, 1920, 120), NaN)).toBe(true);
    expect(clampNodeCoordinate(Infinity, 1920, 120)).toBe(1800);
    expect(clampNodeCoordinate(-Infinity, 1920, 120, 10)).toBe(10);
    // Math.max(+0, Math.min(1800, -0)) === +0 — pinned so a reordered
    // composition cannot silently flip the zero sign
    expect(Object.is(clampNodeCoordinate(-0, 1920, 120), 0)).toBe(true);
    expect(Object.is(clampNodeCoordinate(-0, 1920, 120), -0)).toBe(false);
  });

  it('witness: the retired OverlapResolver double-guard and the direct form never diverge', () => {
    // exhaustive witness for the equivalence the migration relied on —
    // covers the hi < lo branch (oversized) where the two idioms could
    // theoretically differ
    for (const value of [-500, 0, 10, 55, 95, 100, 500, Infinity]) {
      for (const canvasSize of [0, 50, 100, 1920]) {
        for (const nodeSize of [0, 40, 120, 2500]) {
          for (const margin of [0, 10, 20]) {
            expect(
              Object.is(
                oldDoubleGuard(value, canvasSize, nodeSize, margin),
                clampNodeCoordinate(value, canvasSize, nodeSize, margin)
              )
            ).toBe(true);
          }
        }
      }
    }
  });
});

describe('round 45: node canvas clamp single source — layer 3 source anchors', () => {
  const SITES: Array<{ file: string; anchor: RegExp; site: string }> = [
    {
      file: 'src/visualization/enhanced-zero-overlap-layout.ts',
      anchor: /x: clampNodeCoordinate\(gridX \+ jitterX, this\.config\.canvasWidth, width\)/,
      site: 'ezo grid+jitter placement (local sizes)',
    },
    {
      file: 'src/visualization/enhanced-zero-overlap-layout.ts',
      anchor: /x: clampNodeCoordinate\(node\.x, this\.config\.canvasWidth, getNodeWidth\(node, this\.config\.nodeWidth\)\)/,
      site: 'ezo post-resolver clamp (config-fallback sizes)',
    },
    {
      file: 'src/visualization/enhanced-zero-overlap-layout.ts',
      anchor: /Number\.isFinite\(adjustedX\) \? clampNodeCoordinate\(adjustedX, this\.config\.canvasWidth, nw\)/,
      site: 'ezo force application (NaN pre-guard AT the site, nw local)',
    },
    {
      file: 'src/visualization/enhanced-zero-overlap-layout.ts',
      anchor: /x: clampNodeCoordinate\(node\.x \+ \(rand\(\) - 0\.5\) \* 10, this\.config\.canvasWidth, width\)/,
      site: 'ezo jitter candidates (bare getNodeWidth local)',
    },
    {
      file: 'src/visualization/enhanced-zero-overlap-layout.ts',
      anchor: /x: clampNodeCoordinate\(node1\.x - moveVector\.x, this\.config\.canvasWidth, getNodeWidth\(node1\)\)/,
      site: 'ezo collision minimal-movement node1',
    },
    {
      file: 'src/visualization/enhanced-zero-overlap-layout.ts',
      anchor: /x: clampNodeCoordinate\(node2\.x \+ moveVector\.x, this\.config\.canvasWidth, getNodeWidth\(node2\)\)/,
      site: 'ezo collision minimal-movement node2',
    },
    {
      file: 'src/visualization/enhanced-zero-overlap-layout.ts',
      anchor: /x: clampNodeCoordinate\(node1\.x - moveVector\.x \* 0\.3, this\.config\.canvasWidth, getNodeWidth\(node1\)\)/,
      site: 'ezo aesthetic collision node1 (0.3 share)',
    },
    {
      file: 'src/visualization/enhanced-zero-overlap-layout.ts',
      anchor: /x: clampNodeCoordinate\(node2\.x \+ moveVector\.x \* 0\.7, this\.config\.canvasWidth, getNodeWidth\(node2\)\)/,
      site: 'ezo aesthetic collision node2 (0.7 share)',
    },
    {
      file: 'src/visualization/enhanced-zero-overlap-layout.ts',
      anchor: /x: clampNodeCoordinate\(node1\.x - moveVector\.x \* 0\.7, this\.config\.canvasWidth, getNodeWidth\(node1\)\)/,
      site: 'ezo aesthetic collision else-branch node1 (0.7 share)',
    },
    {
      file: 'src/visualization/enhanced-zero-overlap-layout.ts',
      anchor: /x: clampNodeCoordinate\(node2\.x \+ moveVector\.x \* 0\.3, this\.config\.canvasWidth, getNodeWidth\(node2\)\)/,
      site: 'ezo aesthetic collision else-branch node2 (0.3 share)',
    },
    {
      file: 'src/visualization/enhanced-zero-overlap-layout.ts',
      anchor: /x: clampNodeCoordinate\(node1\.x - moveVector\.x \* 0\.2, this\.config\.canvasWidth, getNodeWidth\(node1\)\)/,
      site: 'ezo hierarchical collision node1 (0.2 share)',
    },
    {
      file: 'src/visualization/enhanced-zero-overlap-layout.ts',
      anchor: /x: clampNodeCoordinate\(node2\.x \+ moveVector\.x \* 0\.8, this\.config\.canvasWidth, getNodeWidth\(node2\)\)/,
      site: 'ezo hierarchical collision node2 (0.8 share)',
    },
    {
      file: 'src/visualization/complex-layout-engine.ts',
      anchor: /pos\.x = clampNodeCoordinate\(pos\.x \+ pos\.vx, this\.config\.width, 0\)/,
      site: 'complex-layout-engine velocity integration (POINT clamp, size 0)',
    },
    {
      file: 'src/visualization/force-directed-params.ts',
      anchor: /node\.x = clampNodeCoordinate\(node\.x, bounds\.width, getNodeWidth\(node\), margin\)/,
      site: 'force-directed-params keepInView (BOUNDS_MARGIN)',
    },
    {
      file: 'src/visualization/strategies/OverlapResolver.ts',
      anchor: /node\.x = clampNodeCoordinate\(node\.x, this\.config\.width, getNodeWidth\(node\), margin\)/,
      site: 'strategies/OverlapResolver constrainNodeToBounds (default-10 margin)',
    },
    {
      file: 'src/visualization/strategies/network-strategy.ts',
      anchor: /node\.x = clampNodeCoordinate\(node\.x, DEFAULT_CANVAS_WIDTH, w, 20\)/,
      site: 'network-strategy keep-within-bounds (literal margin 20)',
    },
    {
      file: 'src/visualization/strategies/NetworkLayoutStrategy.ts',
      anchor: /x: clampNodeCoordinate\(gridX \+ jitterX, config\.width, width\)/,
      site: 'NetworkLayoutStrategy grid placement (zero margin)',
    },
  ];

  for (const { file, anchor, site } of SITES) {
    it(`delegates to the canonical clamp: ${site}`, () => {
      expect(readSource(file)).toMatch(anchor);
    });
  }

  it('ezo carries exactly 24 clamp delegations (12 x/y pairs)', () => {
    const src = readSource('src/visualization/enhanced-zero-overlap-layout.ts');
    expect(src.match(/clampNodeCoordinate\(/g)?.length).toBe(24);
  });

  it('ezo keeps the NaN pre-guard at the force-application site (site policy, not clamp policy)', () => {
    const src = readSource('src/visualization/enhanced-zero-overlap-layout.ts');
    expect(src.match(/Number\.isFinite\(adjusted[XY]\) \? clampNodeCoordinate/g)?.length).toBe(2);
  });

  it('no migrated site re-inlines a retired clamp shape', () => {
    const files = [
      'src/visualization/enhanced-zero-overlap-layout.ts',
      'src/visualization/complex-layout-engine.ts',
      'src/visualization/force-directed-params.ts',
      'src/visualization/strategies/OverlapResolver.ts',
      'src/visualization/strategies/network-strategy.ts',
      'src/visualization/strategies/NetworkLayoutStrategy.ts',
    ];
    const retiredShapes = [
      /Math\.max\(0, Math\.min\(this\.config\.canvasWidth - /,
      /Math\.max\(0, Math\.min\(this\.config\.canvasHeight - /,
      /Math\.max\(0, Math\.min\(config\.width - width, /,
      /Math\.max\(0, Math\.min\(config\.height - height, /,
      /Math\.max\(margin, Math\.min\(bounds\.width - /,
      /Math\.max\(margin, Math\.min\(bounds\.height - /,
      /Math\.max\(margin, this\.config\.width - getNodeWidth/,
      /Math\.max\(margin, this\.config\.height - getNodeHeight/,
      /Math\.max\(20, Math\.min\(DEFAULT_CANVAS_WIDTH - /,
      /Math\.max\(20, Math\.min\(DEFAULT_CANVAS_HEIGHT - /,
      /Math\.max\(0, Math\.min\(this\.config\.width, pos\./,
    ];
    for (const file of files) {
      for (const line of readSource(file).split('\n')) {
        // comment lines may quote the retired shapes (they document history)
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
        for (const shape of retiredShapes) {
          expect({ file, line: line.trim(), shape: shape.source, hit: shape.test(line) }).toEqual(
            expect.objectContaining({ hit: false }),
          );
        }
      }
    }
  });

  it('the canonical clamp exists exactly once, in layout-utils', () => {
    const src = readSource('src/visualization/layout-utils.ts');
    expect(src.match(/export function clampNodeCoordinate/g)?.length).toBe(1);
  });
});
