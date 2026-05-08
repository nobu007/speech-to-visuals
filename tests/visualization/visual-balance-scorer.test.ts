import { VisualBalanceScorer, VisualBalanceResult } from '@/visualization/visual-balance-scorer';
import { PositionedNode } from '@/types/diagram';

function makeNode(id: string, x: number, y: number, w = 100, h = 60): PositionedNode {
  return { id, label: id, x, y, width: w, height: h, w, h };
}

describe('VisualBalanceScorer', () => {
  let scorer: VisualBalanceScorer;

  beforeEach(() => {
    scorer = new VisualBalanceScorer();
  });

  describe('calculateVisualBalance', () => {
    const bounds = { width: 800, height: 600 };

    it('returns perfect score for empty nodes array', () => {
      const result = scorer.calculateVisualBalance([], bounds);

      expect(result.overallScore).toBe(1);
      expect(result.centroidDeviation).toBe(1);
      expect(result.quadrantBalance).toBe(1);
      expect(result.densityUniformity).toBe(1);
      expect(result.centroid).toEqual({ x: 0, y: 0 });
      expect(result.quadrantCounts).toEqual([0, 0, 0, 0]);
    });

    it('returns a result with all fields in valid range', () => {
      const nodes = [
        makeNode('a', 100, 100),
        makeNode('b', 400, 100),
        makeNode('c', 250, 400),
      ];
      const result = scorer.calculateVisualBalance(nodes, bounds);

      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(1);
      expect(result.centroidDeviation).toBeGreaterThanOrEqual(0);
      expect(result.centroidDeviation).toBeLessThanOrEqual(1);
      expect(result.quadrantBalance).toBeGreaterThanOrEqual(0);
      expect(result.quadrantBalance).toBeLessThanOrEqual(1);
      expect(result.densityUniformity).toBeGreaterThanOrEqual(0);
      expect(result.densityUniformity).toBeLessThanOrEqual(1);
      expect(typeof result.centroid.x).toBe('number');
      expect(typeof result.centroid.y).toBe('number');
      expect(result.quadrantCounts).toHaveLength(4);
    });
  });

  describe('centroid deviation', () => {
    const bounds = { width: 800, height: 600 };

    it('returns high score when nodes are centered', () => {
      // Nodes clustered around canvas center (400, 300)
      const nodes = [
        makeNode('a', 350, 270),
        makeNode('b', 400, 270),
        makeNode('c', 350, 300),
        makeNode('d', 400, 300),
      ];
      const result = scorer.calculateVisualBalance(nodes, bounds);

      expect(result.centroidDeviation).toBeGreaterThan(0.8);
    });

    it('returns low score when nodes are biased to top-left', () => {
      // Nodes clustered in top-left corner
      const nodes = [
        makeNode('a', 0, 0),
        makeNode('b', 50, 0),
        makeNode('c', 0, 50),
        makeNode('d', 50, 50),
      ];
      const result = scorer.calculateVisualBalance(nodes, bounds);

      expect(result.centroidDeviation).toBeLessThan(0.5);
    });

    it('calculates centroid correctly', () => {
      const nodes = [
        makeNode('a', 100, 100),
        makeNode('b', 300, 200),
      ];
      const result = scorer.calculateVisualBalance(nodes, bounds);

      // Centers: (150, 130) and (350, 230) → centroid (250, 180)
      expect(result.centroid.x).toBeCloseTo(250, 1);
      expect(result.centroid.y).toBeCloseTo(180, 1);
    });
  });

  describe('quadrant balance', () => {
    const bounds = { width: 800, height: 600 };

    it('returns high score for evenly distributed nodes across quadrants', () => {
      // One node in each quadrant
      const nodes = [
        makeNode('a', 100, 50),   // Q0: top-left
        makeNode('b', 500, 50),   // Q1: top-right
        makeNode('c', 100, 350),  // Q2: bottom-left
        makeNode('d', 500, 350),  // Q3: bottom-right
      ];
      const result = scorer.calculateVisualBalance(nodes, bounds);

      expect(result.quadrantBalance).toBeGreaterThan(0.9);
      expect(result.quadrantCounts).toEqual([1, 1, 1, 1]);
    });

    it('returns low score when all nodes are in one quadrant', () => {
      // All nodes in top-left quadrant
      const nodes = [
        makeNode('a', 10, 10),
        makeNode('b', 50, 10),
        makeNode('c', 10, 50),
        makeNode('d', 50, 50),
      ];
      const result = scorer.calculateVisualBalance(nodes, bounds);

      expect(result.quadrantBalance).toBeLessThan(0.3);
      expect(result.quadrantCounts[0]).toBe(4);
    });

    it('counts nodes in correct quadrants', () => {
      const nodes = [
        makeNode('q0', 100, 100),   // top-left
        makeNode('q1', 600, 100),   // top-right
        makeNode('q2', 100, 400),   // bottom-left
        makeNode('q3', 600, 400),   // bottom-right
        makeNode('q0b', 200, 200),  // top-left
      ];
      const result = scorer.calculateVisualBalance(nodes, bounds);

      expect(result.quadrantCounts[0]).toBe(2); // top-left
      expect(result.quadrantCounts[1]).toBe(1); // top-right
      expect(result.quadrantCounts[2]).toBe(1); // bottom-left
      expect(result.quadrantCounts[3]).toBe(1); // bottom-right
    });
  });

  describe('density uniformity', () => {
    const bounds = { width: 800, height: 600 };

    it('returns high score for uniformly distributed nodes', () => {
      // 4x4 grid of nodes spread evenly
      const nodes: PositionedNode[] = [];
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          nodes.push(makeNode(
            `n${row}_${col}`,
            50 + col * 200,
            50 + row * 150,
          ));
        }
      }
      const result = scorer.calculateVisualBalance(nodes, bounds);

      expect(result.densityUniformity).toBeGreaterThan(0.8);
    });

    it('returns low score when all nodes are clustered in one area', () => {
      // All 16 nodes in the same small area
      const nodes: PositionedNode[] = [];
      for (let i = 0; i < 16; i++) {
        nodes.push(makeNode(`n${i}`, 10 + (i % 4) * 5, 10 + Math.floor(i / 4) * 5, 3, 3));
      }
      const result = scorer.calculateVisualBalance(nodes, bounds);

      expect(result.densityUniformity).toBeLessThan(0.3);
    });
  });

  describe('overall score', () => {
    const bounds = { width: 800, height: 600 };

    it('returns high overall score for well-balanced layout', () => {
      // Nodes spread evenly across the canvas, centered
      const nodes = [
        makeNode('a', 100, 80),
        makeNode('b', 500, 80),
        makeNode('c', 100, 380),
        makeNode('d', 500, 380),
      ];
      const result = scorer.calculateVisualBalance(nodes, bounds);

      expect(result.overallScore).toBeGreaterThan(0.6);
    });

    it('returns lower overall score for unbalanced layout', () => {
      // All nodes in one corner
      const nodes = [
        makeNode('a', 0, 0),
        makeNode('b', 50, 0),
        makeNode('c', 0, 50),
        makeNode('d', 50, 50),
      ];
      const result = scorer.calculateVisualBalance(nodes, bounds);

      expect(result.overallScore).toBeLessThan(0.5);
    });

    it('overall score is average of the three sub-scores', () => {
      const nodes = [
        makeNode('a', 100, 100),
        makeNode('b', 400, 100),
        makeNode('c', 250, 300),
      ];
      const result = scorer.calculateVisualBalance(nodes, bounds);

      const expectedAverage = (
        result.centroidDeviation +
        result.quadrantBalance +
        result.densityUniformity
      ) / 3;

      expect(result.overallScore).toBeCloseTo(expectedAverage, 5);
    });
  });

  describe('edge cases', () => {
    it('handles single node at center', () => {
      const bounds = { width: 800, height: 600 };
      const nodes = [makeNode('a', 350, 270)];

      const result = scorer.calculateVisualBalance(nodes, bounds);

      expect(result.centroidDeviation).toBeGreaterThan(0.9);
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(1);
    });

    it('handles single node at corner', () => {
      const bounds = { width: 800, height: 600 };
      const nodes = [makeNode('a', 0, 0)];

      const result = scorer.calculateVisualBalance(nodes, bounds);

      expect(result.centroidDeviation).toBeLessThan(0.5);
    });

    it('handles nodes without explicit width/height (defaults to 0)', () => {
      const bounds = { width: 800, height: 600 };
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 400, y: 300 },
        { id: 'b', label: 'B', x: 100, y: 100 },
      ];

      const result = scorer.calculateVisualBalance(nodes, bounds);

      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(1);
    });

    it('handles very large bounds', () => {
      const bounds = { width: 10000, height: 10000 };
      const nodes = [
        makeNode('a', 4900, 4900),
        makeNode('b', 5100, 4900),
        makeNode('c', 4900, 5100),
        makeNode('d', 5100, 5100),
      ];

      const result = scorer.calculateVisualBalance(nodes, bounds);

      expect(result.centroidDeviation).toBeGreaterThan(0.9);
    });

    it('handles nodes with w/h instead of width/height', () => {
      const bounds = { width: 800, height: 600 };
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 150, y: 120, w: 100, h: 60 },
        { id: 'b', label: 'B', x: 450, y: 120, w: 100, h: 60 },
        { id: 'c', label: 'C', x: 300, y: 360, w: 100, h: 60 },
        { id: 'd', label: 'D', x: 300, y: 200, w: 100, h: 60 },
      ];

      const result = scorer.calculateVisualBalance(nodes, bounds);

      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(1);
    });
  });

  describe('score threshold boundary (0.7)', () => {
    const bounds = { width: 800, height: 600 };

    it('layout above 0.7 threshold is classified as balanced', () => {
      // 4 nodes perfectly centered with centroid at (400, 300) = canvas center
      // makeNode adds w=100, h=60 so centers are at x+50, y+30
      const nodes = [
        makeNode('a', 200, 120),  // center (250, 150) Q0
        makeNode('b', 500, 120),  // center (550, 150) Q1
        makeNode('c', 200, 420),  // center (250, 450) Q2
        makeNode('d', 500, 420),  // center (550, 450) Q3
      ];
      const result = scorer.calculateVisualBalance(nodes, bounds);
      expect(result.overallScore).toBeGreaterThan(0.7);
    });

    it('layout below 0.7 threshold is classified as unbalanced', () => {
      // Clustered in one corner with slight spread
      const nodes = [
        makeNode('a', 10, 10),
        makeNode('b', 60, 10),
        makeNode('c', 10, 60),
        makeNode('d', 60, 60),
        makeNode('e', 30, 30),
      ];
      const result = scorer.calculateVisualBalance(nodes, bounds);
      expect(result.overallScore).toBeLessThan(0.7);
    });

    it('score can be near the 0.7 boundary', () => {
      // Partially balanced: 3 quadrants occupied, centroid slightly off
      const nodes = [
        makeNode('a', 100, 100),
        makeNode('b', 600, 100),
        makeNode('c', 100, 400),
        makeNode('d', 150, 150),
        makeNode('e', 200, 200),
        makeNode('f', 250, 250),
      ];
      const result = scorer.calculateVisualBalance(nodes, bounds);
      // Score should be a reasonable number near the boundary
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(1);
    });
  });
});
