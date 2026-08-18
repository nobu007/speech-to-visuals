/**
 * Cross-invariant (intersection) fuzz: pins the zero-overlap quality GATE
 * (src/quality/quality-gate.ts → rectsOverlap, used by the `zeroOverlap`
 * criterion) against the layout engine's overlap PREDICATE
 * (src/visualization/layout-utils.ts → nodesOverlap, used by the producer's
 * OverlapResolver). These are two independently-written geometric predicates
 * that MUST agree, because the producer resolves until `nodesOverlap` reports
 * zero overlaps and the gate then judges that same layout — the gate must not
 * contradict the guarantee the producer was built to satisfy.
 *
 *   A. PRODUCER PREDICATE — nodesOverlap(a, b) with default spacing 0 is the
 *      strict "do these boxes share any pixels?" test the OverlapResolver
 *      resolves against (touching edges are NOT an overlap).
 *   B. GATE PREDICATE — the `zeroOverlap` quality criterion counts overlapping
 *      pairs via rectsOverlap.
 *
 * Previously A used spacing 0 but B used margin 10, so a genuinely
 * zero-overlap layout left with a <10 px gap (e.g. two nodes 5 px apart — the
 * resolver advances nodes in fractional steps and stops the moment they no
 * longer strictly intersect) was reported OVERLAPPING by the gate but NOT by
 * the producer: a false quality-gate failure on correct output. The margin was
 * unified to 0 (ZERO_OVERLAP_MARGIN); this file pins the agreement so any
 * future drift between the two predicates is caught immediately.
 *
 * Reuses the shared fuzz helper (@tests/helpers/fuzz) for determinism.
 */

import { describe, it, expect } from '@jest/globals';
import { mulberry32 } from '@tests/helpers/fuzz';
import { nodesOverlap } from '@/visualization/layout-utils';
import type { PositionedNode } from '@stv/core/types/diagram';

const { QualityGateEvaluator } = await import('../quality-gate');

/** Minimal valid positioned node. width/height are the non-deprecated fields. */
function node(id: string, x: number, y: number, width: number, height: number): PositionedNode {
  return { id, label: id, x, y, width, height };
}

/**
 * Run the 2-node layout through the Stage-3 gate and return the `zeroOverlap`
 * criterion's verdict: true iff the gate considers the pair to overlap.
 */
function gateReportsOverlap(a: PositionedNode, b: PositionedNode): boolean {
  const evaluator = new QualityGateEvaluator();
  const result = evaluator.evaluateStage(3, { nodes: [a, b], segments: [] });
  const zeroOverlap = result.results.find((r) => r.criterionName === 'zeroOverlap');
  // Criterion absence would itself be a regression; treat it as "overlap seen".
  return zeroOverlap ? !zeroOverlap.passed : true;
}

describe('zero-overlap gate × producer-predicate cross-invariant', () => {
  // -------------------------------------------------------------------------
  // Literal anchors — the concrete bug + its boundaries
  // -------------------------------------------------------------------------
  describe('literal anchors', () => {
    it('5 px gap is ZERO overlap: gate must not false-fail what the producer clears', () => {
      // Box A spans x∈[0,120]; box B starts at x=125 → a 5 px gap. They do not
      // intersect, so this is genuinely zero-overlap. Before the margin fix the
      // gate (margin 10) flagged this exact pair as overlapping.
      const a = node('a', 0, 0, 120, 60);
      const b = node('b', 125, 0, 120, 60);
      expect(nodesOverlap(a, b)).toBe(false); // producer predicate: no overlap
      expect(gateReportsOverlap(a, b)).toBe(false); // gate: must agree
    });

    it('touching edges (0 px gap) is NOT an overlap for either layer', () => {
      const a = node('a', 0, 0, 120, 60);
      const b = node('b', 120, 0, 120, 60); // right edge of A == left edge of B
      expect(nodesOverlap(a, b)).toBe(false);
      expect(gateReportsOverlap(a, b)).toBe(false);
    });

    it('9 px gap (inside the old 10 px danger zone) is ZERO overlap for both', () => {
      const a = node('a', 0, 0, 120, 60);
      const b = node('b', 129, 0, 120, 60); // 9 px gap — falsely flagged pre-fix
      expect(nodesOverlap(a, b)).toBe(false);
      expect(gateReportsOverlap(a, b)).toBe(false);
    });

    it('a real intersection is flagged by BOTH the gate and the producer', () => {
      const a = node('a', 0, 0, 120, 60);
      const b = node('b', 50, 0, 120, 60); // 50 < 120 → boxes intersect
      expect(nodesOverlap(a, b)).toBe(true);
      expect(gateReportsOverlap(a, b)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Randomized composition — gate verdict == producer predicate verdict for
  // every pair, including the 0–10 px danger zone where they once disagreed.
  // -------------------------------------------------------------------------
  describe('randomized: gate verdict always matches producer predicate', () => {
    const rng = mulberry32(0x2e21a7);

    it('600 pairs spanning overlap→touch→danger-zone→safe never disagree', () => {
      const disagreements: string[] = [];
      for (let i = 0; i < 600; i++) {
        const w1 = 60 + Math.floor(rng() * 200);
        const h1 = 40 + Math.floor(rng() * 120);
        const w2 = 60 + Math.floor(rng() * 200);
        const h2 = 40 + Math.floor(rng() * 120);
        // Same Y band guarantees the Y projections overlap, so the X gap is
        // the deciding axis. Gap range [-20, 40) covers real overlap (<0),
        // touch (0), the 0–10 px danger zone, and safe separation (>10).
        const y = Math.floor(rng() * 300);
        const x1 = Math.floor(rng() * 300);
        const gap = Math.floor(rng() * 60) - 20;
        const x2 = x1 + w1 + gap;

        const a = node(`a${i}`, x1, y, w1, h1);
        const b = node(`b${i}`, x2, y, w2, h2);
        const producer = nodesOverlap(a, b);
        const gate = gateReportsOverlap(a, b);
        if (producer !== gate) {
          disagreements.push(
            `pair#${i} a=(${x1},${y},${w1}×${h1}) b=(${x2},${y},${w2}×${h2}) gap=${gap} producer=${producer} gate=${gate}`,
          );
        }
      }
      // Surface EVERY disagreement (not just the first) so drift is diagnosable.
      expect(disagreements).toEqual([]);
    });

    it('600 pairs with independent random X/Y positions never disagree', () => {
      // A second lens: fully unconstrained positions (both axes random) so the
      // two predicates are compared on arbitrary 2-D configurations too.
      const rng2 = mulberry32(0xc0ffee);
      const disagreements: string[] = [];
      for (let i = 0; i < 600; i++) {
        const a = node(
          `a${i}`,
          Math.floor(rng2() * 500),
          Math.floor(rng2() * 500),
          60 + Math.floor(rng2() * 200),
          40 + Math.floor(rng2() * 120),
        );
        const b = node(
          `b${i}`,
          Math.floor(rng2() * 500),
          Math.floor(rng2() * 500),
          60 + Math.floor(rng2() * 200),
          40 + Math.floor(rng2() * 120),
        );
        if (nodesOverlap(a, b) !== gateReportsOverlap(a, b)) {
          disagreements.push(
            `pair#${i} a=(${a.x},${a.y},${a.width}×${a.height}) b=(${b.x},${b.y},${b.width}×${b.height})`,
          );
        }
      }
      expect(disagreements).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Defense-in-depth: the layers must not silently re-diverge.
  // -------------------------------------------------------------------------
  describe('defense-in-depth: the two predicates cannot be made to disagree', () => {
    it('every integer gap from -30..+30 yields identical verdicts', () => {
      // An exhaustive sweep of the boundary region — stronger than random
      // sampling around the exact threshold where the old margin-10 bug lived.
      for (let gap = -30; gap <= 30; gap++) {
        const a = node('a', 0, 0, 100, 50);
        const b = node('b', 100 + gap, 0, 100, 50);
        expect(nodesOverlap(a, b)).toBe(gateReportsOverlap(a, b));
      }
    });
  });
});
