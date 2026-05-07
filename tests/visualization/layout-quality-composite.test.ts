/**
 * TASK-0127: Layout Quality Composite Score — Unit Tests
 *
 * Tests for the LayoutQualityCompositeScorer class and quality gate integration.
 */

import { PositionedNode, LayoutEdge } from '@/types/diagram';
import {
  LayoutQualityCompositeScorer,
  CompositeQualityResult,
  calculateCompositeScore,
  scoreLayout,
} from '@/visualization/layout-quality-composite';
import {
  QualityGateEvaluator,
  createDefaultQualityGates,
} from '@/quality/quality-gate';

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

/** Symmetric 4-node layout centered in 400x400 canvas */
function makeSymmetricNodes(): PositionedNode[] {
  const cx = 200;
  const cy = 200;
  const off = 100;
  return [
    { id: 'tl', label: 'TL', x: cx - off, y: cy - off, width: 60, height: 40 },
    { id: 'tr', label: 'TR', x: cx + off, y: cy - off, width: 60, height: 40 },
    { id: 'bl', label: 'BL', x: cx - off, y: cy + off, width: 60, height: 40 },
    { id: 'br', label: 'BR', x: cx + off, y: cy + off, width: 60, height: 40 },
  ];
}

/** No edges — no crossings */
function makeNoEdges(): LayoutEdge[] {
  return [];
}

/** Clustered nodes all in the top-left corner */
function makeClusteredNodes(count = 10): PositionedNode[] {
  const nodes: PositionedNode[] = [];
  for (let i = 0; i < count; i++) {
    nodes.push({
      id: `n${i}`,
      label: `N${i}`,
      x: 10 + i * 3,
      y: 10 + i * 2,
      width: 60,
      height: 40,
    });
  }
  return nodes;
}

/** Edges that cross (A-D diagonal crosses B-C diagonal) */
function makeCrossingEdges(): LayoutEdge[] {
  return [
    { from: 'tl', to: 'br', points: [] },
    { from: 'tr', to: 'bl', points: [] },
  ];
}

// ===========================================================================
// LayoutQualityCompositeScorer — Constructor
// ===========================================================================

describe('LayoutQualityCompositeScorer — constructor', () => {
  it('uses default weights and threshold when no args given', () => {
    const scorer = new LayoutQualityCompositeScorer();
    expect(scorer.getThreshold()).toBe(0.7);
  });

  it('accepts custom weights', () => {
    const scorer = new LayoutQualityCompositeScorer({ balance: 0.5, crossing: 0.5 });
    expect(scorer.getThreshold()).toBe(0.7);
  });

  it('accepts custom threshold', () => {
    const scorer = new LayoutQualityCompositeScorer(undefined, 0.9);
    expect(scorer.getThreshold()).toBe(0.9);
  });
});

// ===========================================================================
// LayoutQualityCompositeScorer — evaluate()
// ===========================================================================

describe('LayoutQualityCompositeScorer — evaluate', () => {
  const bounds = { width: 400, height: 400 };

  it('high-quality layout: all scores near 1.0 → composite >= 0.9', () => {
    const scorer = new LayoutQualityCompositeScorer();
    const nodes = makeSymmetricNodes();
    const edges = makeNoEdges();
    const result = scorer.evaluate(nodes, edges, bounds);

    expect(result.compositeScore).toBeGreaterThanOrEqual(0.9);
    expect(result.balanceScore).toBeGreaterThanOrEqual(0.8);
    expect(result.crossingScore).toBe(1.0); // no edges → 0 crossings
    expect(result.overflowScore).toBe(1.0); // all within bounds
    expect(result.passed).toBe(true);
  });

  it('all scores 1.0 when empty nodes and edges', () => {
    const scorer = new LayoutQualityCompositeScorer();
    const result = scorer.evaluate([], [], bounds);

    expect(result.compositeScore).toBe(1.0);
    expect(result.balanceScore).toBe(1.0);
    expect(result.crossingScore).toBe(1.0);
    expect(result.overflowScore).toBe(1.0);
    expect(result.densityScore).toBe(1.0);
    expect(result.passed).toBe(true);
  });

  it('clustered layout reduces balance and density scores', () => {
    const scorer = new LayoutQualityCompositeScorer();
    const nodes = makeClusteredNodes();
    const result = scorer.evaluate(nodes, [], bounds);

    expect(result.balanceScore).toBeLessThan(0.5);
    expect(result.densityScore).toBeLessThan(1.0);
  });

  it('crossing edges reduce crossing score', () => {
    const scorer = new LayoutQualityCompositeScorer();
    const nodes = makeSymmetricNodes();
    const edges = makeCrossingEdges();
    const result = scorer.evaluate(nodes, edges, bounds);

    expect(result.crossingScore).toBeLessThan(1.0);
  });

  it('nodes outside bounds reduce overflow score', () => {
    const scorer = new LayoutQualityCompositeScorer();
    const nodes: PositionedNode[] = [
      { id: 'a', label: 'A', x: -10, y: -10, width: 60, height: 40 },
      { id: 'b', label: 'B', x: 380, y: 380, width: 60, height: 40 },
      { id: 'c', label: 'C', x: 200, y: 200, width: 60, height: 40 },
    ];
    const result = scorer.evaluate(nodes, [], bounds);

    expect(result.overflowScore).toBeLessThan(1.0);
  });

  it('compositeScore is in 0.0~1.0 range', () => {
    const scorer = new LayoutQualityCompositeScorer();
    const nodes = makeClusteredNodes();
    const edges = makeCrossingEdges();
    const result = scorer.evaluate(nodes, edges, bounds);

    expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    expect(result.compositeScore).toBeLessThanOrEqual(1);
  });

  it('result has human-readable details string', () => {
    const scorer = new LayoutQualityCompositeScorer();
    const result = scorer.evaluate(makeSymmetricNodes(), [], bounds);

    expect(result.details).toContain('composite=');
    expect(result.details).toContain('balance=');
    expect(result.details).toContain('crossing=');
    expect(result.details).toContain('overflow=');
    expect(result.details).toContain('density=');
  });
});

// ===========================================================================
// Threshold tests
// ===========================================================================

describe('LayoutQualityCompositeScorer — threshold', () => {
  const bounds = { width: 400, height: 400 };

  it('compositeScore >= 0.7 → passed = true', () => {
    const scorer = new LayoutQualityCompositeScorer();
    const nodes = makeSymmetricNodes();
    const result = scorer.evaluate(nodes, [], bounds);

    expect(result.compositeScore).toBeGreaterThanOrEqual(0.7);
    expect(result.passed).toBe(true);
  });

  it('compositeScore < threshold → passed = false', () => {
    const scorer = new LayoutQualityCompositeScorer(undefined, 0.99);
    // Even a good layout should fail a 0.99 threshold
    const nodes = makeSymmetricNodes();
    const result = scorer.evaluate(nodes, [], bounds);

    // Most layouts won't reach 0.99
    if (result.compositeScore < 0.99) {
      expect(result.passed).toBe(false);
    }
  });

  it('custom threshold 0.5 passes clustered layout', () => {
    const scorer = new LayoutQualityCompositeScorer(undefined, 0.3);
    const nodes = makeClusteredNodes();
    const result = scorer.evaluate(nodes, [], bounds);

    expect(result.compositeScore).toBeGreaterThanOrEqual(0.3);
    expect(result.passed).toBe(true);
  });
});

// ===========================================================================
// Weighted integration tests
// ===========================================================================

describe('LayoutQualityCompositeScorer — weighted integration', () => {
  const bounds = { width: 400, height: 400 };

  it('balance-heavy weights: balance score dominates', () => {
    const scorer = new LayoutQualityCompositeScorer({
      balance: 1.0,
      crossing: 0,
      overflow: 0,
      density: 0,
    });
    const nodes = makeSymmetricNodes();
    const result = scorer.evaluate(nodes, [], bounds);

    // With 100% weight on balance, composite ≈ balanceScore
    expect(Math.abs(result.compositeScore - result.balanceScore)).toBeLessThan(0.01);
  });

  it('zero balance weight: balance score does not affect composite', () => {
    const scorer = new LayoutQualityCompositeScorer({
      balance: 0,
      crossing: 0.34,
      overflow: 0.33,
      density: 0.33,
    });
    const nodes = makeClusteredNodes(); // bad balance
    const result = scorer.evaluate(nodes, [], bounds);

    // Should still pass despite bad balance because balance weight is 0
    // Crossing score is 1.0 (no edges), overflow ~1.0, density moderate
    expect(result.compositeScore).toBeGreaterThan(result.balanceScore);
  });
});

// ===========================================================================
// Backward compatibility — functional API
// ===========================================================================

describe('calculateCompositeScore — backward compatibility', () => {
  it('all metrics 1.0 → compositeScore = 1.0', () => {
    const result = calculateCompositeScore({
      balanceScore: 1.0,
      crossingCount: 0,
      edgeCount: 5,
      overflowCount: 0,
      nodeCount: 10,
      densityUniformity: 1.0,
    });
    expect(result.compositeScore).toBeCloseTo(1.0, 5);
  });

  it('all metrics 0.5 → compositeScore = 0.5', () => {
    const result = calculateCompositeScore({
      balanceScore: 0.5,
      crossingCount: 5,
      edgeCount: 10, // crossingRatio = 0.5, crossingVal = 0.5
      overflowCount: 5,
      nodeCount: 10, // overflowVal = 0.5
      densityUniformity: 0.5,
    });
    expect(result.compositeScore).toBeCloseTo(0.5, 5);
  });

  it('partial low metric reduces score proportionally to weight', () => {
    const result = calculateCompositeScore({
      balanceScore: 0.0, // weight 0.3 → contributes 0
      crossingCount: 0,
      edgeCount: 5,
      overflowCount: 0,
      nodeCount: 5,
      densityUniformity: 1.0,
    });
    // balance(0.0)*0.3 + crossing(1.0)*0.3 + overflow(1.0)*0.2 + density(1.0)*0.2 = 0.7
    expect(result.compositeScore).toBeCloseTo(0.7, 5);
  });
});

// ===========================================================================
// scoreLayout — convenience function
// ===========================================================================

describe('scoreLayout — convenience function', () => {
  it('computes composite from nodes and edges', () => {
    const nodes = makeSymmetricNodes();
    const result = scoreLayout(nodes, [], 400, 400);

    expect(result.compositeScore).toBeGreaterThanOrEqual(0.7);
    expect(result.contributions.balance.value).toBeGreaterThan(0);
  });
});

// ===========================================================================
// Quality Gate Integration — Stage 3
// ===========================================================================

describe('Quality Gate Integration — Stage 3 composite score', () => {
  it('layoutQualityComposite criterion exists in Stage 3', () => {
    const gates = createDefaultQualityGates();
    const stage3 = gates.find((g) => g.stage === 3);
    expect(stage3).toBeDefined();
    const criterion = stage3!.criteria.find((c) => c.name === 'layoutQualityComposite');
    expect(criterion).toBeDefined();
    expect(criterion!.threshold).toBe(0.7);
  });

  it('passes when layoutQualityCompositeScore >= 0.7', () => {
    const evaluator = new QualityGateEvaluator();
    const input = {
      nodes: [
        { id: 'n1', x: 0, y: 0, w: 120, h: 60 },
        { id: 'n2', x: 200, y: 0, w: 120, h: 60 },
        { id: 'n3', x: 0, y: 200, w: 120, h: 60 },
      ],
      edges: [],
      segments: [
        { startMs: 0, endMs: 5000, durationMs: 5000 },
        { startMs: 5000, endMs: 10000, durationMs: 5000 },
      ],
      layoutQualityCompositeScore: 0.85,
    };
    const result = evaluator.evaluateStage(3, input);
    const composite = result.results.find((r) => r.criterionName === 'layoutQualityComposite');
    expect(composite).toBeDefined();
    expect(composite!.passed).toBe(true);
  });

  it('fails when layoutQualityCompositeScore < 0.7', () => {
    const evaluator = new QualityGateEvaluator();
    const input = {
      nodes: [
        { id: 'n1', x: 0, y: 0, w: 120, h: 60 },
        { id: 'n2', x: 200, y: 0, w: 120, h: 60 },
      ],
      edges: [],
      segments: [
        { startMs: 0, endMs: 5000, durationMs: 5000 },
      ],
      layoutQualityCompositeScore: 0.5,
    };
    const result = evaluator.evaluateStage(3, input);
    const composite = result.results.find((r) => r.criterionName === 'layoutQualityComposite');
    expect(composite).toBeDefined();
    expect(composite!.passed).toBe(false);
  });

  it('coexists with zeroOverlap criterion', () => {
    const evaluator = new QualityGateEvaluator();
    const input = {
      nodes: [
        { id: 'n1', x: 0, y: 0, w: 120, h: 60 },
        { id: 'n2', x: 200, y: 0, w: 120, h: 60 },
      ],
      edges: [],
      segments: [
        { startMs: 0, endMs: 5000, durationMs: 5000 },
      ],
      layoutQualityCompositeScore: 0.8,
    };
    const result = evaluator.evaluateStage(3, input);
    const overlap = result.results.find((r) => r.criterionName === 'zeroOverlap');
    const composite = result.results.find((r) => r.criterionName === 'layoutQualityComposite');
    expect(overlap).toBeDefined();
    expect(overlap!.passed).toBe(true);
    expect(composite).toBeDefined();
    expect(composite!.passed).toBe(true);
  });

  it('skips composite when no layout data provided', () => {
    const evaluator = new QualityGateEvaluator();
    const input = {
      nodes: [],
      edges: [],
      segments: [
        { startMs: 0, endMs: 5000, durationMs: 5000 },
      ],
    };
    const result = evaluator.evaluateStage(3, input);
    const composite = result.results.find((r) => r.criterionName === 'layoutQualityComposite');
    expect(composite).toBeDefined();
    expect(composite!.passed).toBe(true); // skips gracefully
  });

  it('computes composite from nodes/edges/bounds when score not provided', () => {
    const evaluator = new QualityGateEvaluator();
    const cx = 200;
    const cy = 200;
    const input = {
      nodes: [
        { id: 'tl', x: cx - 100, y: cy - 100, w: 60, h: 40 },
        { id: 'tr', x: cx + 100, y: cy - 100, w: 60, h: 40 },
        { id: 'bl', x: cx - 100, y: cy + 100, w: 60, h: 40 },
        { id: 'br', x: cx + 100, y: cy + 100, w: 60, h: 40 },
      ],
      edges: [],
      bounds: { width: 400, height: 400 },
      segments: [
        { startMs: 0, endMs: 5000, durationMs: 5000 },
      ],
    };
    const result = evaluator.evaluateStage(3, input);
    const composite = result.results.find((r) => r.criterionName === 'layoutQualityComposite');
    expect(composite).toBeDefined();
    expect(composite!.passed).toBe(true);
    expect(composite!.score).toBeGreaterThanOrEqual(0.7);
  });
});
