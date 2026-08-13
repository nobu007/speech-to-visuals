import {
  describe,
  it,
  expect,
} from '@jest/globals';

import { VisualBalanceScorer } from '../visual-balance-scorer';
import { PositionedNode } from '@/types/diagram';

describe('VisualBalanceScorer', () => {
  const scorer = new VisualBalanceScorer();
  const BOUNDS = { width: 1920, height: 1080 };

  /** Helper: create a node at (x, y) with given dimensions */
  function node(
    x: number,
    y: number,
    w = 120,
    h = 60,
    id = '',
  ): PositionedNode {
    return { id, label: id, x, y, w, h };
  }

  // ---- Empty / edge cases ------------------------------------------------

  describe('empty nodes', () => {
    it('returns perfect scores for zero nodes', () => {
      const result = scorer.calculateVisualBalance([], BOUNDS);
      expect(result.overallScore).toBe(1);
      expect(result.centroidDeviation).toBe(1);
      expect(result.quadrantBalance).toBe(1);
      expect(result.densityUniformity).toBe(1);
      expect(result.centroid).toEqual({ x: 0, y: 0 });
      expect(result.quadrantCounts).toEqual([0, 0, 0, 0]);
    });
  });

  // ---- Single node -------------------------------------------------------

  describe('single node', () => {
    it('returns perfect centroid score when node is at canvas center', () => {
      // Canvas center = (960, 540)
      const n = node(960 - 60, 540 - 30);
      const result = scorer.calculateVisualBalance([n], BOUNDS);
      expect(result.centroidDeviation).toBeCloseTo(1, 1);
    });

    it('returns lower centroid score when node is in a corner', () => {
      const n = node(0, 0);
      const result = scorer.calculateVisualBalance([n], BOUNDS);
      // Centroid is at (60, 30), far from center (960, 540)
      expect(result.centroidDeviation).toBeLessThan(0.5);
    });

    it('places node in the correct quadrant (TL)', () => {
      const n = node(100, 100);
      const result = scorer.calculateVisualBalance([n], BOUNDS);
      expect(result.quadrantCounts[0]).toBe(1); // TL
      expect(result.quadrantCounts[1]).toBe(0); // TR
      expect(result.quadrantCounts[2]).toBe(0); // BL
      expect(result.quadrantCounts[3]).toBe(0); // BR
    });

    it('places node in the correct quadrant (BR)', () => {
      const n = node(1500, 800);
      const result = scorer.calculateVisualBalance([n], BOUNDS);
      expect(result.quadrantCounts[3]).toBe(1); // BR
    });
  });

  // ---- Centroid deviation ------------------------------------------------

  describe('centroid deviation', () => {
    it('computes centroid as average of all node centers', () => {
      const nodes = [
        node(0, 0),     // center: (60, 30)
        node(1800, 1020), // center: (1860, 1050)
      ];
      const result = scorer.calculateVisualBalance(nodes, BOUNDS);
      // Centroid should be at ((60+1860)/2, (30+1050)/2) = (960, 540) = canvas center
      expect(result.centroid.x).toBeCloseTo(960, 0);
      expect(result.centroid.y).toBeCloseTo(540, 0);
    });

    it('returns higher deviation for clustered nodes in one corner', () => {
      const clustered = [node(0, 0), node(50, 50), node(20, 80)];
      const result = scorer.calculateVisualBalance(clustered, BOUNDS);
      expect(result.centroidDeviation).toBeLessThan(0.5);
    });
  });

  // ---- Quadrant balance --------------------------------------------------

  describe('quadrant balance', () => {
    it('returns perfect quadrant balance for 4 nodes, one per quadrant', () => {
      const nodes = [
        node(100, 100),     // TL
        node(1500, 100),    // TR
        node(100, 800),     // BL
        node(1500, 800),    // BR
      ];
      const result = scorer.calculateVisualBalance(nodes, BOUNDS);
      expect(result.quadrantCounts).toEqual([1, 1, 1, 1]);
      expect(result.quadrantBalance).toBeCloseTo(1, 1);
    });

    it('returns low quadrant balance when all nodes are in one quadrant', () => {
      const nodes = [
        node(100, 100),
        node(200, 200),
        node(150, 150),
        node(180, 80),
      ];
      const result = scorer.calculateVisualBalance(nodes, BOUNDS);
      expect(result.quadrantCounts[0]).toBe(4); // All in TL
      expect(result.quadrantBalance).toBeLessThan(0.3);
    });

    it('handles nodes on the boundary line', () => {
      // midX = 960, midY = 540
      // Node center exactly at midX/midY goes to BR (!isLeft && !isTop)
      const nodes = [
        node(960 - 60, 540 - 30), // center at (960, 540) → BR
      ];
      const result = scorer.calculateVisualBalance(nodes, BOUNDS);
      expect(result.quadrantCounts[3]).toBe(1);
    });
  });

  // ---- Density uniformity ------------------------------------------------

  describe('density uniformity', () => {
    it('returns high density uniformity for evenly spread nodes', () => {
      // Create nodes in a uniform grid pattern
      const nodes: PositionedNode[] = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          nodes.push(node(200 + c * 600, 200 + r * 300));
        }
      }
      const result = scorer.calculateVisualBalance(nodes, BOUNDS);
      expect(result.densityUniformity).toBeGreaterThan(0.5);
    });

    it('returns low density uniformity for heavily clustered nodes', () => {
      const nodes = [
        node(100, 100),
        node(110, 110),
        node(105, 108),
        node(102, 104),
        node(1000, 500),  // outlier
      ];
      const result = scorer.calculateVisualBalance(nodes, BOUNDS);
      expect(result.densityUniformity).toBeLessThan(0.5);
    });
  });

  // ---- Overall score -----------------------------------------------------

  describe('overall score', () => {
    it('computes overall score as average of three sub-scores', () => {
      const nodes = [
        node(100, 100),
        node(1500, 100),
        node(100, 800),
        node(1500, 800),
      ];
      const result = scorer.calculateVisualBalance(nodes, BOUNDS);
      const expected = (result.centroidDeviation + result.quadrantBalance + result.densityUniformity) / 3;
      expect(result.overallScore).toBeCloseTo(expected, 2);
    });

    it('clamps overall score to [0, 1]', () => {
      // Any valid input should produce a score in [0, 1]
      const nodes = [node(0, 0), node(1900, 1000)];
      const result = scorer.calculateVisualBalance(nodes, BOUNDS);
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(1);
    });

    it('clamps all sub-scores to [0, 1]', () => {
      const nodes = [node(0, 0), node(1900, 1000)];
      const result = scorer.calculateVisualBalance(nodes, BOUNDS);
      expect(result.centroidDeviation).toBeGreaterThanOrEqual(0);
      expect(result.centroidDeviation).toBeLessThanOrEqual(1);
      expect(result.quadrantBalance).toBeGreaterThanOrEqual(0);
      expect(result.quadrantBalance).toBeLessThanOrEqual(1);
      expect(result.densityUniformity).toBeGreaterThanOrEqual(0);
      expect(result.densityUniformity).toBeLessThanOrEqual(1);
    });
  });

  // ---- Width/height dual-property support --------------------------------

  describe('width/height property handling', () => {
    it('uses w/h when width/height are not provided', () => {
      const n: PositionedNode = {
        id: 'a',
        label: 'A',
        x: 100,
        y: 100,
        w: 200,
        h: 100,
      };
      const result = scorer.calculateVisualBalance([n], BOUNDS);
      // Center should be at (100 + 200/2, 100 + 100/2) = (200, 150)
      expect(result.centroid.x).toBe(200);
      expect(result.centroid.y).toBe(150);
    });

    it('uses width/height when w/h are not provided', () => {
      const n = {
        id: 'a',
        label: 'A',
        x: 100,
        y: 100,
        width: 200,
        height: 100,
      } as unknown as PositionedNode;
      const result = scorer.calculateVisualBalance([n], BOUNDS);
      // Center should be at (100 + 200/2, 100 + 100/2) = (200, 150)
      expect(result.centroid.x).toBe(200);
      expect(result.centroid.y).toBe(150);
    });

    it('defaults to 0 when neither w/h nor width/height provided', () => {
      const n = {
        id: 'a',
        label: 'A',
        x: 100,
        y: 100,
      } as unknown as PositionedNode;
      const result = scorer.calculateVisualBalance([n], BOUNDS);
      // Center should be at (100, 100) since dimensions are 0
      expect(result.centroid.x).toBe(100);
      expect(result.centroid.y).toBe(100);
    });
  });

  // ---- Degenerate canvas -------------------------------------------------

  describe('degenerate canvas dimensions', () => {
    it('handles zero-width canvas without NaN', () => {
      const n = node(0, 0);
      const result = scorer.calculateVisualBalance([n], { width: 0, height: 0 });
      expect(Number.isFinite(result.centroidDeviation)).toBe(true);
      expect(Number.isFinite(result.overallScore)).toBe(true);
    });
  });

  // ---- Non-finite node positions (aggregation poison) --------------------
  //
  // nodeCenter reads node.x/node.y raw. A single non-finite coordinate
  // poisoned every aggregation reduce (NaN + finite = NaN) and the local
  // clamp (Math.max(0, Math.min(1, NaN)) === NaN) let it leak straight into
  // the public VisualBalanceResult — and downstream into the composite layout
  // quality gate (clamp01 collapses a NaN balanceScore to 0 → permanent
  // false-fail / re-optimization thrash). Same node.x/node.y field that
  // canvas-calculator.ts already sanitizes; this site was the missed sibling.
  describe('non-finite node positions', () => {
    it('produces finite scores when one node has a NaN position', () => {
      const nodes = [
        node(100, 100),
        node(NaN, 200),
        node(1500, 800),
      ];
      const result = scorer.calculateVisualBalance(nodes, BOUNDS);
      expect(Number.isFinite(result.overallScore)).toBe(true);
      expect(Number.isFinite(result.centroidDeviation)).toBe(true);
      expect(Number.isFinite(result.quadrantBalance)).toBe(true);
      expect(Number.isFinite(result.densityUniformity)).toBe(true);
      expect(Number.isFinite(result.centroid.x)).toBe(true);
      expect(Number.isFinite(result.centroid.y)).toBe(true);
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(1);
    });

    it('produces finite scores when a node has ±Infinity position', () => {
      const nodes = [
        node(100, 100),
        node(Infinity, -Infinity),
        node(1500, 800),
      ];
      const result = scorer.calculateVisualBalance(nodes, BOUNDS);
      expect(Number.isFinite(result.overallScore)).toBe(true);
      expect(Number.isFinite(result.centroid.x)).toBe(true);
      expect(Number.isFinite(result.centroid.y)).toBe(true);
    });

    it('coerces a non-finite position to 0 (sanitizeFinite default, same as canvas-calculator)', () => {
      // sanitizeFinite(NaN, 0) → 0, so a NaN-positioned node is centered at
      // its (0,0)-anchored geometry, identical to an explicit (0,0) node.
      const atOrigin = scorer.calculateVisualBalance([node(0, 0)], BOUNDS);
      const nanPos = scorer.calculateVisualBalance([node(NaN, NaN)], BOUNDS);
      expect(nanPos.centroid.x).toBe(atOrigin.centroid.x);
      expect(nanPos.centroid.y).toBe(atOrigin.centroid.y);
    });
  });
});
