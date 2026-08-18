import {
  describe,
  it,
  expect,
} from '@jest/globals';

import {
  calculateCompositeScore,
  scoreLayout,
  LayoutQualityCompositeScorer,
} from '../layout-quality-composite';
import { PositionedNode, LayoutEdge } from '@stv/core/types/diagram';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function node(
  x: number,
  y: number,
  w = 120,
  h = 60,
  id = '',
): PositionedNode {
  return { id, label: id, x, y, w, h };
}

function edge(from: string, to: string, points?: { x: number; y: number }[]): LayoutEdge {
  return {
    id: `${from}-${to}`,
    from,
    to,
    points: points ?? [],
  };
}

// ---------------------------------------------------------------------------
// calculateCompositeScore
// ---------------------------------------------------------------------------

describe('calculateCompositeScore', () => {
  describe('default behavior', () => {
    it('returns score 1.0 when all metrics are perfect', () => {
      const result = calculateCompositeScore({
        balanceScore: 1,
        crossingCount: 0,
        edgeCount: 5,
        overflowCount: 0,
        nodeCount: 5,
        densityUniformity: 1,
      });
      expect(result.compositeScore).toBeCloseTo(1, 5);
    });

    it('returns balanced contributions summing to composite score', () => {
      const result = calculateCompositeScore({
        balanceScore: 0.8,
        crossingCount: 2,
        edgeCount: 10,
        overflowCount: 1,
        nodeCount: 10,
        densityUniformity: 0.6,
      });
      // Verify contributions
      const sum =
        result.contributions.balance.contribution +
        result.contributions.crossing.contribution +
        result.contributions.overflow.contribution +
        result.contributions.density.contribution;
      const totalWeight =
        result.contributions.balance.weight +
        result.contributions.crossing.weight +
        result.contributions.overflow.weight +
        result.contributions.density.weight;
      expect(result.compositeScore).toBeCloseTo(sum / totalWeight, 5);
    });
  });

  describe('crossing score normalization', () => {
    it('returns 1.0 crossing score when no crossings', () => {
      const result = calculateCompositeScore({
        crossingCount: 0,
        edgeCount: 10,
      });
      expect(result.contributions.crossing.value).toBe(1);
    });

    it('returns 0.0 crossing score when all edges cross', () => {
      const result = calculateCompositeScore({
        crossingCount: 10,
        edgeCount: 10,
      });
      expect(result.contributions.crossing.value).toBe(0);
    });

    it('handles zero edge count gracefully', () => {
      const result = calculateCompositeScore({
        crossingCount: 0,
        edgeCount: 0,
      });
      expect(Number.isFinite(result.contributions.crossing.value)).toBe(true);
    });
  });

  describe('overflow score', () => {
    it('returns 1.0 when no nodes overflow', () => {
      const result = calculateCompositeScore({
        overflowCount: 0,
        nodeCount: 10,
      });
      expect(result.contributions.overflow.value).toBe(1);
    });

    it('returns 0.0 when all nodes overflow', () => {
      const result = calculateCompositeScore({
        overflowCount: 10,
        nodeCount: 10,
      });
      expect(result.contributions.overflow.value).toBe(0);
    });

    it('handles zero node count gracefully', () => {
      const result = calculateCompositeScore({
        overflowCount: 0,
        nodeCount: 0,
      });
      expect(Number.isFinite(result.contributions.overflow.value)).toBe(true);
    });
  });

  describe('defaults for missing values', () => {
    it('uses 0.5 for missing balanceScore', () => {
      const result = calculateCompositeScore({});
      expect(result.contributions.balance.value).toBe(0.5);
    });

    it('uses 0.5 for missing densityUniformity', () => {
      const result = calculateCompositeScore({});
      expect(result.contributions.density.value).toBe(0.5);
    });

    it('uses 0 for missing crossingCount', () => {
      const result = calculateCompositeScore({});
      expect(result.contributions.crossing.value).toBe(1); // 0 crossings = perfect
    });

    it('uses 0 for missing overflowCount', () => {
      const result = calculateCompositeScore({});
      expect(result.contributions.overflow.value).toBe(1); // 0 overflow = perfect
    });
  });

  describe('custom weights', () => {
    it('applies custom weights to score calculation', () => {
      const result = calculateCompositeScore(
        { balanceScore: 1, crossingCount: 0, edgeCount: 1, overflowCount: 0, nodeCount: 1, densityUniformity: 0 },
        { balance: 0.9, crossing: 0.03, overflow: 0.03, density: 0.04 },
      );
      // With density weight only 0.04, low density barely impacts score
      expect(result.compositeScore).toBeGreaterThan(0.95);
    });

    it('handles partial custom weights (merges with defaults)', () => {
      const result = calculateCompositeScore(
        { balanceScore: 1 },
        { balance: 1 },
      );
      // Default crossing=0.3, overflow=0.2, density=0.2
      // balance weight overridden to 1.0, total = 1 + 0.3 + 0.2 + 0.2 = 1.7
      expect(result.contributions.balance.weight).toBe(1);
      expect(result.contributions.crossing.weight).toBe(0.3);
    });
  });

  describe('score clamping', () => {
    it('clamps composite score to [0, 1]', () => {
      // Values above 1 shouldn't be possible, but test clamp
      const result = calculateCompositeScore({
        balanceScore: 1,
        crossingCount: 0,
        edgeCount: 1,
        overflowCount: 0,
        nodeCount: 1,
        densityUniformity: 1,
      });
      expect(result.compositeScore).toBeLessThanOrEqual(1);
      expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    });
  });
});

// ---------------------------------------------------------------------------
// scoreLayout convenience function
// ---------------------------------------------------------------------------

describe('scoreLayout', () => {
  it('computes score from positioned nodes and edges', () => {
    const nodes = [
      node(100, 100, 120, 60, 'A'),
      node(1500, 100, 120, 60, 'B'),
      node(100, 800, 120, 60, 'C'),
      node(1500, 800, 120, 60, 'D'),
    ];
    const edges = [
      edge('A', 'B', [{ x: 220, y: 130 }, { x: 1500, y: 130 }]),
      edge('C', 'D', [{ x: 220, y: 830 }, { x: 1500, y: 830 }]),
    ];
    const result = scoreLayout(nodes, edges);
    expect(Number.isFinite(result.compositeScore)).toBe(true);
    expect(result.compositeScore).toBeGreaterThan(0);
  });

  it('detects overflow when nodes exceed canvas bounds', () => {
    const nodes = [
      node(1900, 1000, 120, 60, 'overflow'), // extends beyond 1920x1080
    ];
    const result = scoreLayout(nodes, [], 1920, 1080);
    // The overflow node should reduce the overflow contribution
    expect(result.contributions.overflow.value).toBe(0);
  });

  it('uses default canvas dimensions when not provided', () => {
    const nodes = [node(100, 100)];
    const result = scoreLayout(nodes, []);
    expect(Number.isFinite(result.compositeScore)).toBe(true);
  });

  it('handles empty nodes and edges', () => {
    const result = scoreLayout([], []);
    expect(Number.isFinite(result.compositeScore)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// LayoutQualityCompositeScorer class
// ---------------------------------------------------------------------------

describe('LayoutQualityCompositeScorer', () => {
  describe('constructor', () => {
    it('uses default threshold of 0.7', () => {
      const scorer = new LayoutQualityCompositeScorer();
      expect(scorer.getThreshold()).toBe(0.7);
    });

    it('accepts custom threshold', () => {
      const scorer = new LayoutQualityCompositeScorer({}, 0.85);
      expect(scorer.getThreshold()).toBe(0.85);
    });

    it('accepts custom weights', () => {
      const scorer = new LayoutQualityCompositeScorer({ balance: 0.5, crossing: 0.1, overflow: 0.2, density: 0.2 });
      expect(scorer.getThreshold()).toBe(0.7);
    });
  });

  describe('evaluate', () => {
    const bounds = { width: 1920, height: 1080 };

    it('returns all individual scores in result', () => {
      const scorer = new LayoutQualityCompositeScorer();
      const nodes = [
        node(100, 100, 120, 60, 'A'),
        node(1500, 100, 120, 60, 'B'),
      ];
      const edges = [
        edge('A', 'B', [{ x: 220, y: 130 }, { x: 1500, y: 130 }]),
      ];
      const result = scorer.evaluate(nodes, edges, bounds);
      expect(result).toHaveProperty('compositeScore');
      expect(result).toHaveProperty('balanceScore');
      expect(result).toHaveProperty('crossingScore');
      expect(result).toHaveProperty('overflowScore');
      expect(result).toHaveProperty('densityScore');
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('details');
    });

    it('computes crossing score as 1 - crossings/maxCrossings', () => {
      const scorer = new LayoutQualityCompositeScorer();
      const nodes = [
        node(100, 100, 120, 60, 'A'),
        node(1500, 100, 120, 60, 'B'),
        node(100, 800, 120, 60, 'C'),
        node(1500, 800, 120, 60, 'D'),
      ];
      // Two edges that don't cross
      const edges = [
        edge('A', 'B', [{ x: 220, y: 130 }, { x: 1500, y: 130 }]),
        edge('C', 'D', [{ x: 220, y: 830 }, { x: 1500, y: 830 }]),
      ];
      const result = scorer.evaluate(nodes, edges, bounds);
      expect(result.crossingScore).toBe(1); // No crossings
    });

    it('detects overflow in evaluate', () => {
      const scorer = new LayoutQualityCompositeScorer();
      const nodes = [
        node(1900, 1000, 200, 200, 'overflow'),
      ];
      const result = scorer.evaluate(nodes, [], bounds);
      expect(result.overflowScore).toBe(0); // The one node overflows
    });

    it('returns passed=true when score >= threshold', () => {
      const scorer = new LayoutQualityCompositeScorer({}, 0.0); // Very low threshold
      const nodes = [node(960, 540, 120, 60, 'center')];
      const result = scorer.evaluate(nodes, [], bounds);
      expect(result.passed).toBe(true);
    });

    it('returns passed=false when score < threshold', () => {
      const scorer = new LayoutQualityCompositeScorer({}, 0.99); // Very high threshold
      const nodes = [node(0, 0, 120, 60, 'corner')];
      const result = scorer.evaluate(nodes, [], bounds);
      expect(result.passed).toBe(false);
    });

    it('includes human-readable details string', () => {
      const scorer = new LayoutQualityCompositeScorer();
      const nodes = [node(960, 540, 120, 60, 'center')];
      const result = scorer.evaluate(nodes, [], bounds);
      expect(result.details).toContain('composite=');
      expect(result.details).toContain('balance=');
      expect(result.details).toContain('crossing=');
      expect(result.details).toContain('overflow=');
      expect(result.details).toContain('density=');
    });

    it('handles empty nodes with perfect overflow score', () => {
      const scorer = new LayoutQualityCompositeScorer();
      const result = scorer.evaluate([], [], bounds);
      expect(result.overflowScore).toBe(1);
    });

    it('handles single edge with no crossings (maxCrossings=1)', () => {
      const scorer = new LayoutQualityCompositeScorer();
      const nodes = [
        node(100, 100, 120, 60, 'A'),
        node(300, 100, 120, 60, 'B'),
      ];
      const edges = [edge('A', 'B', [{ x: 220, y: 130 }, { x: 300, y: 130 }])];
      const result = scorer.evaluate(nodes, edges, bounds);
      expect(result.crossingScore).toBe(1);
    });

    it('does not produce NaN when all weights are zero', () => {
      const scorer = new LayoutQualityCompositeScorer({
        balance: 0,
        crossing: 0,
        overflow: 0,
        density: 0,
      });
      const nodes = [
        node(100, 100, 120, 60, 'A'),
        node(300, 100, 120, 60, 'B'),
      ];
      const edges = [edge('A', 'B')];
      const result = scorer.evaluate(nodes, edges, bounds);
      expect(Number.isFinite(result.compositeScore)).toBe(true);
    });
  });
});
