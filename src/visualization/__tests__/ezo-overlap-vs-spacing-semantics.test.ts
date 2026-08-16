/**
 * @jest-environment node
 */
/**
 * ezo-overlap-vs-spacing-semantics.test.ts — round 38.
 *
 * Family: the ezo engine's QUALITY-METRIC semantics — which pairs count as
 * an "overlap" in qualityMetrics.overlapCount / success, versus which pairs
 * merely violate the minimumSpacing.nodeToNode (40px) separation target.
 *
 * The defect (open since round 36, tracked as the top L3 candidate):
 * ezo's detectAllOverlaps ALWAYS counted with the 40px-inflated predicate,
 * so qualityMetrics.overlapCount conflated two different concepts —
 * geometric overlap and sub-target spacing. A final layout that was
 * geometrically overlap-free (zero plain-AABB pairs) but had nodes 20px
 * apart reported overlapCount > 0 and success=false, and that flag flowed
 * into the simple pipeline's layout result as 'layout_generation_failed'
 * with the scene skipped. Every OTHER engine reports the geometric count
 * (layout-engine-v2's calculateMetrics, quality-gate, OverlapResolver —
 * pinned geometric by overlap-canonical-cross-invariant-fuzz.test.ts), so
 * ezo's number wasn't even comparable across engines.
 *
 * Round 38 splits the two concepts at the single detection chokepoint:
 *   - overlapCount        = GEOMETRIC pairs  (nodesOverlap(a, b, 0) shape)
 *   - spacingViolationCount = pairs closer than the 40px separation target
 *     (nodesOverlap(a, b, 40) shape) — warning-only, can never fail success
 *   - success             = overlapCount === 0   (now the geometric contract)
 *
 * The force-resolution loop still TARGETS the stricter 40px contract (that
 * is the engine's spacing optimization, unchanged); only the REPORTED
 * metric and the success flag de-conflate.
 *
 * Layers:
 *   1. SEMANTIC ANCHORS — literal gap sweep around the two boundaries
 *      (touching-at-0 and spacing-40) with exact expected counts, the exact
 *      shape the old conflated count got wrong.
 *   2. DETECTION-PATH EQUIVALENCE — ≥5 nodes flips ezo to the spatial-grid
 *      path; the split counts must agree with the brute-force predicate on
 *      both sides of the boundary there too.
 *   3. DEFAULT-METRICS SHAPE — the error-path metrics object carries the
 *      new field (0), so the result type never reports it undefined.
 */

import { describe, it, expect } from '@jest/globals';
import type { PositionedNode } from '@/types/diagram';
import {
  EnhancedZeroOverlapLayoutEngine,
  type LayoutQualityMetrics,
} from '../enhanced-zero-overlap-layout';
import { nodesOverlap } from '../layout-utils';

/** Two 100×60 boxes side by side; the horizontal gap is the only variable. */
function pairAtGap(gap: number): PositionedNode[] {
  return [
    { id: 'a', label: 'A', x: 0, y: 0, width: 100, height: 60 },
    { id: 'b', label: 'B', x: 100 + gap, y: 0, width: 100, height: 60 },
  ];
}

type EngineInternals = {
  calculateQualityMetrics(layout: {
    nodes: PositionedNode[];
    edges: unknown[];
  }): LayoutQualityMetrics;
  getDefaultMetrics(): LayoutQualityMetrics;
};

const engine = new EnhancedZeroOverlapLayoutEngine();
const internals = engine as unknown as EngineInternals;

const metricsFor = (nodes: PositionedNode[]): LayoutQualityMetrics =>
  internals.calculateQualityMetrics({ nodes, edges: [] });

describe('ezo quality metrics: overlap vs spacing are separate concepts (round 38)', () => {
  describe('semantic anchors — exact counts across the gap sweep', () => {
    // gap ≥ 40 satisfies the separation target: nothing reported either way.
    it('gap 45 (target met): overlapCount 0, spacingViolationCount 0', () => {
      const m = metricsFor(pairAtGap(45));
      expect(m.overlapCount).toBe(0);
      expect(m.spacingViolationCount).toBe(0);
    });

    // gap 40 exactly meets the target: inflated boxes TOUCH (zero-measure),
    // and touching is not a violation under the strict predicate.
    it('gap 40 (boundary, target exactly met): 0 / 0', () => {
      const m = metricsFor(pairAtGap(40));
      expect(m.overlapCount).toBe(0);
      expect(m.spacingViolationCount).toBe(0);
    });

    // 0 < gap < 40: THE conflation witness — geometrically clean, spacing
    // sub-target. Old code reported overlapCount 1 (and success=false).
    it('gap 39: geometrically clean — overlapCount 0, spacingViolationCount 1', () => {
      const m = metricsFor(pairAtGap(39));
      expect(nodesOverlap(pairAtGap(39)[0], pairAtGap(39)[1], 0)).toBe(false);
      expect(m.overlapCount).toBe(0);
      expect(m.spacingViolationCount).toBe(1);
    });

    it('gap 1: overlapCount 0, spacingViolationCount 1', () => {
      const m = metricsFor(pairAtGap(1));
      expect(m.overlapCount).toBe(0);
      expect(m.spacingViolationCount).toBe(1);
    });

    // Touching at 0px: not a geometric overlap (strict comparison), but far
    // below the 40px target.
    it('gap 0 (touching): overlapCount 0, spacingViolationCount 1', () => {
      const m = metricsFor(pairAtGap(0));
      expect(m.overlapCount).toBe(0);
      expect(m.spacingViolationCount).toBe(1);
    });

    // Genuine geometric overlap: both signals fire.
    it('gap -1 (1px overlap): overlapCount 1, spacingViolationCount 1', () => {
      const m = metricsFor(pairAtGap(-1));
      expect(m.overlapCount).toBe(1);
      expect(m.spacingViolationCount).toBe(1);
    });

    it('full containment: overlapCount 1, spacingViolationCount 1', () => {
      const m = metricsFor([
        { id: 'a', label: 'A', x: 0, y: 0, width: 200, height: 120 },
        { id: 'b', label: 'B', x: 50, y: 20, width: 40, height: 30 },
      ]);
      expect(m.overlapCount).toBe(1);
      expect(m.spacingViolationCount).toBe(1);
    });

    it('disjoint far apart: 0 / 0', () => {
      const m = metricsFor([
        { id: 'a', label: 'A', x: 0, y: 0, width: 100, height: 60 },
        { id: 'b', label: 'B', x: 1000, y: 800, width: 100, height: 60 },
      ]);
      expect(m.overlapCount).toBe(0);
      expect(m.spacingViolationCount).toBe(0);
    });
  });

  describe('spatial-grid path (≥5 nodes): both counts match the brute-force predicate', () => {
    // 6 nodes exercise detectOverlapsWithSpatialGrid (spatialIndexing on,
    // nodes.length > 4): one genuine overlap (a×b gap -2), one pure spacing
    // violation (c×d gap 30), the rest clean and far apart.
    const gridNodes: PositionedNode[] = [
      { id: 'a', label: 'A', x: 0, y: 0, width: 100, height: 60 },
      { id: 'b', label: 'B', x: 98, y: 0, width: 100, height: 60 },    // overlap a
      { id: 'c', label: 'C', x: 0, y: 300, width: 100, height: 60 },
      { id: 'd', label: 'D', x: 130, y: 300, width: 100, height: 60 }, // 30px from c
      { id: 'e', label: 'E', x: 0, y: 600, width: 100, height: 60 },
      { id: 'f', label: 'F', x: 0, y: 900, width: 100, height: 60 },
    ];

    const bruteForce = (spacing: number): number => {
      let count = 0;
      for (let i = 0; i < gridNodes.length; i++) {
        for (let j = i + 1; j < gridNodes.length; j++) {
          if (nodesOverlap(gridNodes[i], gridNodes[j], spacing)) count++;
        }
      }
      return count;
    };

    it('overlapCount equals the geometric brute-force count (1)', () => {
      expect(bruteForce(0)).toBe(1); // a×b only
      expect(metricsFor(gridNodes).overlapCount).toBe(bruteForce(0));
    });

    it('spacingViolationCount equals the 40px brute-force count (2)', () => {
      expect(bruteForce(40)).toBe(2); // a×b, c×d
      expect(metricsFor(gridNodes).spacingViolationCount).toBe(bruteForce(40));
    });
  });

  describe('result shape', () => {
    it('spacingViolationCount is a present finite number on real metrics', () => {
      const m = metricsFor(pairAtGap(20));
      expect(Number.isFinite(m.spacingViolationCount)).toBe(true);
    });

    it('default (error-path) metrics carry spacingViolationCount: 0', () => {
      expect(internals.getDefaultMetrics().spacingViolationCount).toBe(0);
    });
  });
});
