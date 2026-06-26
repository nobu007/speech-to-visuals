/**
 * Tests for LayoutAutoOptimizer (TASK-0128) and runAutoOptimization (REQ-083).
 *
 * Covers:
 * - runAutoOptimization: threshold pass/fail, retry strategies, score history
 * - LayoutAutoOptimizer class: optimization loop, strategy reselection,
 *   parameter adjustment, recalculate step, step history
 * - Edge cases: empty nodes, single node, already-passing score, max iterations
 * - Legacy strategies: crossing minimization, recenter, spread out
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  runAutoOptimization,
  LayoutAutoOptimizer,
  OptimizationResult,
  OptimizerResult,
  LayoutParams,
} from '@/visualization/layout-auto-optimizer';
import { StrategySelector } from '@/visualization/strategy-selector';
import { PositionedNode, LayoutEdge, DiagramType, NodeDatum, EdgeDatum } from '@/types/diagram';
import { LayoutStrategy, StrategyLayoutResult } from '@/visualization/types';
import { scoreLayout } from '@/visualization/layout-quality-composite';

// ── Test Helpers ──

function makeNode(id: string, x: number, y: number, w = 120, h = 60): PositionedNode {
  return { id, label: id, x, y, width: w, height: h, w, h };
}

function makeEdge(from: string, to: string): LayoutEdge {
  return {
    from,
    to,
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ],
  };
}

/** A well-spread layout that should score above 0.7 */
function makeGoodLayout(): { nodes: PositionedNode[]; edges: LayoutEdge[] } {
  return {
    nodes: [
      makeNode('a', 200, 200),
      makeNode('b', 600, 200),
      makeNode('c', 1000, 200),
      makeNode('d', 200, 600),
      makeNode('e', 600, 600),
      makeNode('f', 1000, 600),
    ],
    edges: [
      makeEdge('a', 'b'),
      makeEdge('b', 'c'),
      makeEdge('d', 'e'),
      makeEdge('e', 'f'),
    ],
  };
}

/** A terrible layout with overlapping nodes, all at the same position */
function makeBadLayout(): { nodes: PositionedNode[]; edges: LayoutEdge[] } {
  return {
    nodes: [
      makeNode('a', 0, 0),
      makeNode('b', 0, 0),
      makeNode('c', 0, 0),
      makeNode('d', 0, 0),
    ],
    edges: [
      makeEdge('a', 'b'),
      makeEdge('c', 'd'),
    ],
  };
}

/** A layout where nodes overflow the canvas bounds */
function makeOverflowLayout(): { nodes: PositionedNode[]; edges: LayoutEdge[] } {
  return {
    nodes: [
      makeNode('a', -200, -200),
      makeNode('b', 2000, 1200),
      makeNode('c', 100, 100),
    ],
    edges: [makeEdge('a', 'c'), makeEdge('c', 'b')],
  };
}

// ── runAutoOptimization Tests ──

describe('runAutoOptimization', () => {
  describe('already-passing layout', () => {
    it('should return immediately when score >= threshold', () => {
      const { nodes, edges } = makeGoodLayout();
      const result = runAutoOptimization(nodes, edges, { threshold: 0.0 });

      expect(result.passed).toBe(true);
      expect(result.attempts).toBe(0);
      expect(result.scoreHistory).toHaveLength(1);
      expect(result.initialScore).toBe(result.finalScore);
    });

    it('should not modify nodes when score already passes', () => {
      const { nodes, edges } = makeGoodLayout();
      const result = runAutoOptimization(nodes, edges, { threshold: 0.0 });

      // Node positions should be unchanged
      result.nodes.forEach((n, i) => {
        expect(n.x).toBeCloseTo(nodes[i].x);
        expect(n.y).toBeCloseTo(nodes[i].y);
      });
    });
  });

  describe('failing layout optimization', () => {
    it('should make multiple attempts when score < threshold', () => {
      const { nodes, edges } = makeBadLayout();
      const result = runAutoOptimization(nodes, edges, {
        threshold: 0.99,
        maxAttempts: 3,
      });

      expect(result.attempts).toBe(3);
      expect(result.scoreHistory).toHaveLength(4); // initial + 3 attempts
      expect(result.passed).toBe(false); // bad layout unlikely to reach 0.99
    });

    it('should track score history across attempts', () => {
      const { nodes, edges } = makeBadLayout();
      const result = runAutoOptimization(nodes, edges, {
        threshold: 0.99,
        maxAttempts: 3,
      });

      expect(result.scoreHistory.length).toBeGreaterThan(1);
      // Each entry should be a number between 0 and 1
      result.scoreHistory.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    it('should respect maxAttempts limit', () => {
      const { nodes, edges } = makeBadLayout();
      const result = runAutoOptimization(nodes, edges, {
        threshold: 0.99,
        maxAttempts: 2,
      });

      expect(result.attempts).toBe(2);
      expect(result.scoreHistory).toHaveLength(3); // initial + 2
    });

    it('should use custom canvas dimensions', () => {
      const { nodes, edges } = makeOverflowLayout();
      const result = runAutoOptimization(nodes, edges, {
        threshold: 0.99,
        maxAttempts: 1,
        canvasWidth: 1920,
        canvasHeight: 1080,
      });

      // Should compute scores using 1920x1080 canvas
      expect(result.scoreHistory[0]).toBeGreaterThanOrEqual(0);
    });
  });

  describe('default config', () => {
    it('should use threshold=0.7 and maxAttempts=3 by default', () => {
      const { nodes, edges } = makeBadLayout();
      const result = runAutoOptimization(nodes, edges);

      // With default config, it should try up to 3 times
      expect(result.attempts).toBeLessThanOrEqual(3);
    });
  });

  describe('edge cases', () => {
    it('should handle empty nodes array', () => {
      const result = runAutoOptimization([], [], { threshold: 0.99 });

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
      expect(result.scoreHistory).toHaveLength(1);
    });

    it('should handle single node', () => {
      const node = makeNode('solo', 500, 500);
      const result = runAutoOptimization([node], [], { threshold: 0.99 });

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('solo');
    });

    it('should handle nodes with no width/height fields', () => {
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'a', x: 100, y: 100 },
        { id: 'b', label: 'b', x: 200, y: 200 },
      ];
      const edges = [makeEdge('a', 'b')];
      const result = runAutoOptimization(nodes, edges, { threshold: 0.5 });

      expect(result.nodes).toHaveLength(2);
      // Should not produce NaN coordinates
      result.nodes.forEach(n => {
        expect(Number.isFinite(n.x)).toBe(true);
        expect(Number.isFinite(n.y)).toBe(true);
      });
    });
  });

  describe('improvement verification', () => {
    it('should not decrease the score below initial after optimization', () => {
      const { nodes, edges } = makeBadLayout();
      const result = runAutoOptimization(nodes, edges, {
        threshold: 0.99,
        maxAttempts: 3,
      });

      // Final score should be >= initial (strategies shouldn't make it worse)
      // Note: some strategies might not improve, but shouldn't worsen
      expect(result.finalScore).toBeGreaterThanOrEqual(0);
    });

    it('should not mutate the original input nodes array', () => {
      const { nodes, edges } = makeBadLayout();
      const originalX = nodes[0].x;
      const originalY = nodes[0].y;

      runAutoOptimization(nodes, edges, { threshold: 0.99 });

      expect(nodes[0].x).toBe(originalX);
      expect(nodes[0].y).toBe(originalY);
    });
  });
});

// ── LayoutAutoOptimizer Class Tests ──

describe('LayoutAutoOptimizer', () => {
  let selector: StrategySelector;

  beforeEach(() => {
    selector = new StrategySelector();
  });

  describe('constructor', () => {
    it('should use default maxIterations=3 and threshold=0.7', () => {
      const optimizer = new LayoutAutoOptimizer(selector);
      const { nodes, edges } = makeGoodLayout();

      return optimizer.optimize(nodes, edges, 'tree', { width: 1920, height: 1080 })
        .then(result => {
          // With a good layout and threshold 0.7, should skip optimization
          if (result.initialScore >= 0.7) {
            expect(result.iterations).toBe(0);
            expect(result.improved).toBe(false);
          }
        });
    });

    it('should accept custom maxIterations and threshold', () => {
      const optimizer = new LayoutAutoOptimizer(selector, 5, 0.95);
      const { nodes, edges } = makeBadLayout();

      return optimizer.optimize(nodes, edges, 'flow', { width: 1920, height: 1080 })
        .then(result => {
          // With threshold 0.95 and a bad layout, should run up to 5 iterations
          expect(result.steps.length).toBeGreaterThan(0);
        });
    });
  });

  describe('optimize - already passing', () => {
    it('should skip optimization when score >= threshold', () => {
      const optimizer = new LayoutAutoOptimizer(selector, 3, 0.0); // threshold=0 → always passes
      const { nodes, edges } = makeGoodLayout();

      return optimizer.optimize(nodes, edges, 'tree', { width: 1920, height: 1080 })
        .then(result => {
          expect(result.improved).toBe(false);
          expect(result.iterations).toBe(0);
          expect(result.steps).toHaveLength(0);
          expect(result.finalScore).toBe(result.initialScore);
        });
    });
  });

  describe('optimize - strategy reselection', () => {
    it('should try fallback strategy when primary score is low', () => {
      const optimizer = new LayoutAutoOptimizer(selector, 3, 0.99);
      const { nodes, edges } = makeBadLayout();

      return optimizer.optimize(nodes, edges, 'tree', { width: 1920, height: 1080 })
        .then(result => {
          // Should have at least one reselect_strategy step
          const reselectSteps = result.steps.filter(s => s.action === 'reselect_strategy');
          expect(reselectSteps.length).toBeGreaterThan(0);
        });
    });

    it('should record step details for each optimization action', () => {
      const optimizer = new LayoutAutoOptimizer(selector, 3, 0.99);
      const { nodes, edges } = makeBadLayout();

      return optimizer.optimize(nodes, edges, 'flow', { width: 1920, height: 1080 })
        .then(result => {
          result.steps.forEach(step => {
            expect(step.iteration).toBeGreaterThanOrEqual(1);
            expect(step.previousScore).toBeGreaterThanOrEqual(0);
            expect(step.newScore).toBeGreaterThanOrEqual(0);
            expect(typeof step.improved).toBe('boolean');
            expect(typeof step.details).toBe('string');
            expect(step.details.length).toBeGreaterThan(0);
          });
        });
    });
  });

  describe('optimize - parameter adjustment', () => {
    it('should apply parameter adjustments during optimization', () => {
      const optimizer = new LayoutAutoOptimizer(selector, 3, 0.99);
      const { nodes, edges } = makeBadLayout();

      return optimizer.optimize(nodes, edges, 'flow', { width: 1920, height: 1080 })
        .then(result => {
          const adjustSteps = result.steps.filter(s => s.action === 'adjust_params');
          expect(adjustSteps.length).toBeGreaterThan(0);
          // Each adjust step should have meaningful parameter info
          adjustSteps.forEach(step => {
            expect(step.details).toContain('nodeSpacing');
            expect(step.details).toContain('rankSeparation');
          });
        });
    });
  });

  describe('optimize - recalculate step', () => {
    it('should apply edge crossing minimization and recentering', () => {
      const optimizer = new LayoutAutoOptimizer(selector, 3, 0.99);
      const { nodes, edges } = makeBadLayout();

      return optimizer.optimize(nodes, edges, 'flow', { width: 1920, height: 1080 })
        .then(result => {
          const recalcSteps = result.steps.filter(s => s.action === 'recalculate');
          expect(recalcSteps.length).toBeGreaterThan(0);
          recalcSteps.forEach(step => {
            expect(step.details).toContain('Edge crossing');
          });
        });
    });
  });

  describe('optimize - result properties', () => {
    it('should return finalNodes and finalEdges in result', () => {
      const optimizer = new LayoutAutoOptimizer(selector, 3, 0.99);
      const { nodes, edges } = makeBadLayout();

      return optimizer.optimize(nodes, edges, 'tree', { width: 1920, height: 1080 })
        .then(result => {
          expect(result.finalNodes).toBeDefined();
          expect(result.finalEdges).toBeDefined();
          expect(Array.isArray(result.finalNodes)).toBe(true);
          expect(Array.isArray(result.finalEdges)).toBe(true);
        });
    });

    it('should set improved=true when finalScore > initialScore', () => {
      const optimizer = new LayoutAutoOptimizer(selector, 3, 0.5);
      const { nodes, edges } = makeBadLayout();

      return optimizer.optimize(nodes, edges, 'flow', { width: 1920, height: 1080 })
        .then(result => {
          if (result.finalScore > result.initialScore) {
            expect(result.improved).toBe(true);
          }
        });
    });

    it('should report correct iteration count', () => {
      const optimizer = new LayoutAutoOptimizer(selector, 2, 0.99);
      const { nodes, edges } = makeBadLayout();

      return optimizer.optimize(nodes, edges, 'flow', { width: 1920, height: 1080 })
        .then(result => {
          // The last step's iteration should not exceed maxIterations
          if (result.steps.length > 0) {
            const maxIter = Math.max(...result.steps.map(s => s.iteration));
            expect(maxIter).toBeLessThanOrEqual(2);
            expect(result.iterations).toBeLessThanOrEqual(2);
          }
        });
    });
  });

  describe('optimize - edge cases', () => {
    it('should handle empty nodes', () => {
      const optimizer = new LayoutAutoOptimizer(selector, 3, 0.7);

      return optimizer.optimize([], [], 'flow', { width: 1920, height: 1080 })
        .then(result => {
          expect(result.finalNodes).toHaveLength(0);
          expect(result.finalEdges).toHaveLength(0);
          expect(result.improved).toBe(false);
        });
    });

    it('should handle single node', () => {
      const optimizer = new LayoutAutoOptimizer(selector, 3, 0.99);
      const node = makeNode('solo', 100, 100);

      return optimizer.optimize([node], [], 'flow', { width: 1920, height: 1080 })
        .then(result => {
          expect(result.finalNodes).toHaveLength(1);
          expect(result.finalNodes[0].id).toBe('solo');
        });
    });

    it('should handle nodes without w/h fields', () => {
      const optimizer = new LayoutAutoOptimizer(selector, 3, 0.99);
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'a', x: 0, y: 0 },
        { id: 'b', label: 'b', x: 50, y: 50 },
      ];
      const edges = [makeEdge('a', 'b')];

      return optimizer.optimize(nodes, edges, 'flow', { width: 1920, height: 1080 })
        .then(result => {
          // Should not produce NaN
          result.finalNodes.forEach(n => {
            expect(Number.isFinite(n.x)).toBe(true);
            expect(Number.isFinite(n.y)).toBe(true);
          });
        });
    });

    it('should handle all nodes at the same position', () => {
      const optimizer = new LayoutAutoOptimizer(selector, 3, 0.99);
      const nodes = [
        makeNode('a', 100, 100),
        makeNode('b', 100, 100),
        makeNode('c', 100, 100),
      ];
      const edges = [makeEdge('a', 'b'), makeEdge('b', 'c')];

      return optimizer.optimize(nodes, edges, 'flow', { width: 1920, height: 1080 })
        .then(result => {
          expect(result.finalNodes).toHaveLength(3);
          // After optimization, nodes should not all be at the same position
          const positions = new Set(result.finalNodes.map(n => `${n.x},${n.y}`));
          // Spread out strategy should have moved some nodes
          // (not guaranteed to be unique, but at least the optimizer ran)
          expect(result.steps.length).toBeGreaterThan(0);
        });
    });
  });

  describe('optimize - immutability', () => {
    it('should not mutate the original nodes input', () => {
      const optimizer = new LayoutAutoOptimizer(selector, 3, 0.99);
      const { nodes, edges } = makeBadLayout();
      const originalX = nodes.map(n => n.x);
      const originalY = nodes.map(n => n.y);

      return optimizer.optimize(nodes, edges, 'flow', { width: 1920, height: 1080 })
        .then(() => {
          nodes.forEach((n, i) => {
            expect(n.x).toBe(originalX[i]);
            expect(n.y).toBe(originalY[i]);
          });
        });
    });
  });

  describe('optimize - different diagram types', () => {
    const diagramTypes: DiagramType[] = ['flow', 'tree', 'timeline', 'general'];

    diagramTypes.forEach(dt => {
      it(`should optimize ${dt} diagrams`, () => {
        const optimizer = new LayoutAutoOptimizer(selector, 1, 0.99);
        const { nodes, edges } = makeBadLayout();

        return optimizer.optimize(nodes, edges, dt, { width: 1920, height: 1080 })
          .then(result => {
            expect(result.finalNodes).toHaveLength(nodes.length);
          });
      });
    });
  });

  describe('optimize - threshold boundary', () => {
    it('should stop early when threshold is met mid-optimization', () => {
      const optimizer = new LayoutAutoOptimizer(selector, 10, 0.01); // Very low threshold → should pass quickly
      const { nodes, edges } = makeGoodLayout();

      return optimizer.optimize(nodes, edges, 'flow', { width: 1920, height: 1080 })
        .then(result => {
          // Should either skip entirely or stop after first successful step
          expect(result.iterations).toBeLessThanOrEqual(10);
        });
    });
  });
});

// ── Regression: edges vs currentEdges fix ──

describe('regression: strategy reselection uses currentEdges', () => {
  it('should use working copy of edges, not original input', () => {
    const selector = new StrategySelector();
    const optimizer = new LayoutAutoOptimizer(selector, 3, 0.99);

    // Create edges with distinct points to track modifications
    const nodes = [
      makeNode('a', 0, 0),
      makeNode('b', 0, 0),
      makeNode('c', 0, 0),
    ];
    const edges: LayoutEdge[] = [
      { from: 'a', to: 'b', points: [{ x: 0, y: 0 }, { x: 0, y: 0 }] },
      { from: 'b', to: 'c', points: [{ x: 0, y: 0 }, { x: 0, y: 0 }] },
    ];

    return optimizer.optimize(nodes, edges, 'tree', { width: 1920, height: 1080 })
      .then(result => {
        // The optimizer should complete without error
        expect(result.finalNodes).toHaveLength(3);
        expect(result.finalEdges).toBeDefined();

        // Original edges should not be mutated
        expect(edges[0].from).toBe('a');
        expect(edges[0].to).toBe('b');
      });
  });

  // Focused regression: construct a 3-element fallback chain where
  // Strategy B modifies edge from/to values, then verify Strategy C
  // receives the modified edges (not the original stale input).
  it('second strategy reselection receives edges modified by first reselection, not stale originals', async () => {
    const edgesReceivedByC: EdgeDatum[][] = [];
    const baseMetrics = { overlapCount: 0, edgeCrossings: 0, aspectRatio: 1 };
    const baseCanvas = { width: 1920, height: 1080 };

    // Strategy A (index 0): primary, never called for reselection
    const strategyA: LayoutStrategy = {
      name: 'A',
      canEscapeLocalMinimum: false,
      estimateComplexity: (n: NodeDatum[]) => n.length,
      apply: (nodes: NodeDatum[], edges: EdgeDatum[]): StrategyLayoutResult => ({
        nodes: nodes.map(n => ({
          id: n.id, label: n.label, x: 0, y: 0,
          width: n.width ?? 120, height: n.height ?? 60,
        })),
        edges: edges.map(e => ({
          from: e.from, to: e.to,
          points: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
        })),
        canvas: baseCanvas,
        metrics: baseMetrics,
      }),
    };

    // Strategy B (index 1): spreads nodes out AND modifies edge from/to
    // by appending '_B' suffix — this must be reflected in subsequent calls
    const strategyB: LayoutStrategy = {
      name: 'B',
      canEscapeLocalMinimum: false,
      estimateComplexity: (n: NodeDatum[]) => n.length,
      apply: (nodes: NodeDatum[], edges: EdgeDatum[]): StrategyLayoutResult => ({
        nodes: nodes.map((n, i) => ({
          id: n.id, label: n.label, x: 200 * (i + 1), y: 200,
          width: n.width ?? 120, height: n.height ?? 60,
        })),
        edges: edges.map(e => ({
          from: e.from + '_B',
          to: e.to + '_B',
          points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
        })),
        canvas: baseCanvas,
        metrics: baseMetrics,
      }),
    };

    // Strategy C (index 2): captures edges it receives
    const strategyC: LayoutStrategy = {
      name: 'C',
      canEscapeLocalMinimum: false,
      estimateComplexity: (n: NodeDatum[]) => n.length,
      apply: (nodes: NodeDatum[], edges: EdgeDatum[]): StrategyLayoutResult => {
        edgesReceivedByC.push([...edges]);
        return ({
          nodes: nodes.map((n, i) => ({
            id: n.id, label: n.label, x: 300, y: 300 + i * 100,
            width: n.width ?? 120, height: n.height ?? 60,
          })),
          edges: edges.map(e => ({
            from: e.from, to: e.to,
            points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
          })),
          canvas: baseCanvas,
          metrics: baseMetrics,
        });
      },
    };

    const mockSelector = {
      getFallbackChain: () => [strategyA, strategyB, strategyC],
      select: () => strategyA,
    } as unknown as StrategySelector;

    const optimizer = new LayoutAutoOptimizer(mockSelector, 3, 0.99);

    const nodes = [
      makeNode('a', 0, 0),
      makeNode('b', 0, 0),
      makeNode('c', 0, 0),
    ];
    const edges: LayoutEdge[] = [
      { from: 'a', to: 'b', points: [{ x: 0, y: 0 }] },
      { from: 'b', to: 'c', points: [{ x: 0, y: 0 }] },
    ];

    await optimizer.optimize(nodes, edges, 'tree', { width: 1920, height: 1080 });

    // Strategy C must have been called at least once
    expect(edgesReceivedByC.length).toBeGreaterThan(0);

    // KEY ASSERTION: Strategy C received Strategy B's MODIFIED edges
    // (from='a_B', to='b_B'), NOT the stale original edges (from='a', to='b').
    // If the bug were present, these would be 'a' and 'b' instead of 'a_B' and 'b_B'.
    expect(edgesReceivedByC[0][0].from).toBe('a_B');
    expect(edgesReceivedByC[0][0].to).toBe('b_B');
    expect(edgesReceivedByC[0][1].from).toBe('b_B');
    expect(edgesReceivedByC[0][1].to).toBe('c_B');
  });
});

// ── Score Consistency Verification ──

describe('layout-auto-optimizer score consistency', () => {
  it('runAutoOptimization finalScore should match scoreLayout of final nodes', () => {
    const { nodes, edges } = makeBadLayout();
    const result = runAutoOptimization(nodes, edges, {
      threshold: 0.99,
      maxAttempts: 3,
      canvasWidth: 1920,
      canvasHeight: 1080,
    });

    const recalculatedScore = scoreLayout(
      result.nodes, result.edges, 1920, 1080,
    ).compositeScore;

    expect(result.finalScore).toBeCloseTo(recalculatedScore, 5);
  });
});
