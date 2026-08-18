/**
 * Cross-invariant pin for the overlap-predicate consolidation.
 *
 * Four byte-identical hand-rolled `nodesOverlap` copies previously lived in
 * overlap-resolver.ts, layout-engine-v2.ts, cycle-strategy.ts and
 * timeline-strategy.ts — every one a separate AABB test that could drift from
 * the others (the exact failure mode that bit this codebase repeatedly:
 * quality-monitor's margin=10, quality-monitor's strict-`<`, the framework
 * pipeline's strict-`<`). They now ALL import the single canonical
 * `nodesOverlap` from layout-utils.ts. This file pins:
 *
 *   1. the canonical's boundary semantics — touching-at-0px is NOT an overlap
 *      (strict `>`/`<`, never `>=`/`<=`) — against an independent reference and
 *      a literal gap sweep, so an edit that flips the comparison is caught;
 *   2. that the consolidated consumers (OverlapResolver.detectOverlaps,
 *      calculateMetrics) agree with the canonical across a deterministic fuzz —
 *      so re-inlining a divergent copy in any of them is caught.
 *
 * Reuses the shared fuzz helper (@tests/helpers/fuzz) for determinism.
 */

import { describe, it, expect } from '@jest/globals';
import type { PositionedNode } from '@stv/core/types/diagram';
import { mulberry32 } from '@tests/helpers/fuzz';
import { nodesOverlap as canonical } from '../layout-utils';
import { getNodeWidth, getNodeHeight } from '../node-dimensions';
import { OverlapResolver } from '../overlap-resolver';
import { calculateMetrics } from '../layout-engine-v2';

/** Build a node with explicit dimensions (the canonical width/height pair). */
function node(id: string, x: number, y: number, w: number, h: number): PositionedNode {
  return { id, label: id, x, y, width: w, height: h };
}

/**
 * Independent reference overlap test, formulated as explicit 1-D interval
 * intersection (positive measure). Uses the shared dimension reader so the ONLY
 * thing cross-checked against the canonical is the comparison logic — the part
 * that drifts. Touching intervals (share an edge, zero-measure intersection) are
 * NOT an overlap.
 */
function referenceOverlap(a: PositionedNode, b: PositionedNode): boolean {
  const aw = getNodeWidth(a, 0);
  const ah = getNodeHeight(a, 0);
  const bw = getNodeWidth(b, 0);
  const bh = getNodeHeight(b, 0);
  const aL = a.x, aR = a.x + aw, aT = a.y, aB = a.y + ah;
  const bL = b.x, bR = b.x + bw, bT = b.y, bB = b.y + bh;
  return aL < bR && aR > bL && aT < bB && aB > bT;
}

describe('Overlap predicate: single source of truth (layout-utils.nodesOverlap)', () => {
  // -------------------------------------------------------------------------
  // Literal boundary anchors — the recurring `<=` vs `<` failure. Two 100×60
  // boxes; the horizontal gap between A's right edge and B's left edge is the
  // only variable.
  // -------------------------------------------------------------------------
  describe('literal anchors: touching-at-0px is NOT overlap (strict comparison)', () => {
    const A = node('a', 0, 0, 100, 60);

    it('touching edges (gap 0) → NOT overlap', () => {
      expect(canonical(A, node('b', 100, 0, 100, 60), 0)).toBe(false);
      expect(canonical(node('b', 100, 0, 100, 60), A, 0)).toBe(false);
    });

    it('1px overlap (gap -1) → overlap', () => {
      expect(canonical(A, node('b', 99, 0, 100, 60), 0)).toBe(true);
    });

    it('1px gap (gap +1) → NOT overlap', () => {
      expect(canonical(A, node('b', 101, 0, 100, 60), 0)).toBe(false);
    });

    it('vertical touching/overlap mirrors horizontal', () => {
      expect(canonical(A, node('b', 0, 60, 100, 60), 0)).toBe(false); // touch
      expect(canonical(A, node('b', 0, 59, 100, 60), 0)).toBe(true);  // 1px overlap
      expect(canonical(A, node('b', 0, 61, 100, 60), 0)).toBe(false); // 1px gap
    });

    it('identical position → overlap; full containment → overlap', () => {
      expect(canonical(A, node('b', 0, 0, 100, 60), 0)).toBe(true);
      expect(canonical(A, node('b', 10, 5, 20, 10), 0)).toBe(true); // B inside A
    });

    it('clearly disjoint → NOT overlap', () => {
      expect(canonical(A, node('b', 1000, 1000, 100, 60), 0)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Deterministic gap sweep — canonical must match the reference at every
  // integer gap across a range straddling the touching boundary.
  // -------------------------------------------------------------------------
  describe('gap sweep: canonical == reference across the touching boundary', () => {
    it('horizontal gap -30..+30 agrees with reference at every integer', () => {
      const A = node('a', 0, 0, 100, 60);
      for (let gap = -30; gap <= 30; gap++) {
        const B = node('b', 100 + gap, 0, 100, 60);
        expect(canonical(A, B, 0)).toBe(referenceOverlap(A, B));
      }
    });

    it('vertical gap -30..+30 agrees with reference at every integer', () => {
      const A = node('a', 0, 0, 100, 60);
      for (let gap = -30; gap <= 30; gap++) {
        const B = node('b', 0, 60 + gap, 100, 60);
        expect(canonical(A, B, 0)).toBe(referenceOverlap(A, B));
      }
    });
  });

  // -------------------------------------------------------------------------
  // Fuzz — random node pairs: canonical agrees with the independent reference.
  // -------------------------------------------------------------------------
  describe('fuzz: canonical == independent reference for random pairs', () => {
    it('5000 random pairs agree', () => {
      const rng = mulberry32(0x6f7665); // 'ove' overlap
      for (let i = 0; i < 5000; i++) {
        const a = node('a', Math.floor(rng() * 400), Math.floor(rng() * 400), 20 + Math.floor(rng() * 180), 20 + Math.floor(rng() * 120));
        const b = node('b', Math.floor(rng() * 400), Math.floor(rng() * 400), 20 + Math.floor(rng() * 180), 20 + Math.floor(rng() * 120));
        expect(canonical(a, b, 0)).toBe(referenceOverlap(a, b));
      }
    });
  });

  // -------------------------------------------------------------------------
  // Consumer delegation anchors — the consolidated consumers must agree with
  // the canonical. Catches re-inlining of a divergent predicate in any of them.
  // -------------------------------------------------------------------------
  describe('consumer delegation: detectOverlaps & calculateMetrics agree with canonical', () => {
    const resolver = new OverlapResolver();

    const cases: Array<[string, PositionedNode, PositionedNode]> = [
      ['touching', node('a', 0, 0, 100, 60), node('b', 100, 0, 100, 60)],
      ['1px overlap', node('a', 0, 0, 100, 60), node('b', 99, 0, 100, 60)],
      ['disjoint', node('a', 0, 0, 100, 60), node('b', 500, 500, 100, 60)],
      ['contained', node('a', 0, 0, 200, 200), node('b', 50, 50, 20, 20)],
    ];

    for (const [label, a, b] of cases) {
      it(`OverlapResolver.detectOverlaps matches canonical (${label})`, () => {
        const expected = canonical(a, b, 0) ? 1 : 0;
        expect(resolver.detectOverlaps([a, b])).toHaveLength(expected);
      });

      it(`calculateMetrics.overlapCount matches canonical (${label})`, () => {
        const expected = canonical(a, b, 0) ? 1 : 0;
        expect(calculateMetrics([a, b], []).overlapCount).toBe(expected);
      });
    }

    it('detectOverlaps & calculateMetrics match canonical across a fuzz', () => {
      const rng = mulberry32(0x6c6179); // 'lay' layout
      for (let i = 0; i < 2000; i++) {
        const a = node('a', Math.floor(rng() * 300), Math.floor(rng() * 300), 30 + Math.floor(rng() * 120), 30 + Math.floor(rng() * 90));
        const b = node('b', Math.floor(rng() * 300), Math.floor(rng() * 300), 30 + Math.floor(rng() * 120), 30 + Math.floor(rng() * 90));
        const expected = canonical(a, b, 0) ? 1 : 0;
        expect(resolver.detectOverlaps([a, b])).toHaveLength(expected);
        expect(calculateMetrics([a, b], []).overlapCount).toBe(expected);
      }
    });
  });
});
