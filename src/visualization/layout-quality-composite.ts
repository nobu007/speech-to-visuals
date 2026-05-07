/**
 * REQ-082: Layout Quality Composite Score
 *
 * Integrates balance, crossing, overflow, and density scores into
 * a weighted composite score (0.0~1.0) with per-metric contribution reporting.
 */

import { PositionedNode, LayoutEdge } from '@/types/diagram';
import { VisualBalanceScorer } from './visual-balance-scorer';
import { detectEdgeCrossings } from './edge-crossing-minimizer';

export interface CompositeScoreInput {
  balanceScore?: number;
  crossingCount?: number;
  /** Total edge count (used to normalize crossing ratio) */
  edgeCount?: number;
  /** Overflow count — nodes exceeding canvas bounds */
  overflowCount?: number;
  /** Total node count */
  nodeCount?: number;
  densityUniformity?: number;
}

export interface CompositeScoreResult {
  /** Overall composite score 0.0~1.0 */
  compositeScore: number;
  /** Individual metric contributions */
  contributions: {
    balance: { value: number; weight: number; contribution: number };
    crossing: { value: number; weight: number; contribution: number };
    overflow: { value: number; weight: number; contribution: number };
    density: { value: number; weight: number; contribution: number };
  };
}

export interface CompositeScoreWeights {
  balance: number;
  crossing: number;
  overflow: number;
  density: number;
}

const DEFAULT_WEIGHTS: CompositeScoreWeights = {
  balance: 0.3,
  crossing: 0.3,
  overflow: 0.2,
  density: 0.2,
};

/**
 * Calculate composite layout quality score from individual metrics.
 * Handles missing scores by substituting defaults.
 */
export function calculateCompositeScore(
  input: CompositeScoreInput,
  weights?: Partial<CompositeScoreWeights>
): CompositeScoreResult {
  const w = { ...DEFAULT_WEIGHTS, ...weights };

  // Balance: use provided or default to 0.5
  const balanceVal = input.balanceScore ?? 0.5;

  // Crossing: normalize to 0~1 (0 crossings = 1.0, many crossings = 0.0)
  const edgeCount = input.edgeCount ?? 1;
  const crossingRaw = input.crossingCount ?? 0;
  const crossingRatio = edgeCount > 0 ? crossingRaw / edgeCount : 0;
  const crossingVal = Math.max(0, 1 - crossingRatio);

  // Overflow: 0 overflow = 1.0, any overflow reduces score
  const nodeCount = input.nodeCount ?? 1;
  const overflowRaw = input.overflowCount ?? 0;
  const overflowVal = nodeCount > 0 ? Math.max(0, 1 - overflowRaw / nodeCount) : 1.0;

  // Density: use provided or default to 0.5
  const densityVal = input.densityUniformity ?? 0.5;

  const contributions = {
    balance: { value: balanceVal, weight: w.balance, contribution: balanceVal * w.balance },
    crossing: { value: crossingVal, weight: w.crossing, contribution: crossingVal * w.crossing },
    overflow: { value: overflowVal, weight: w.overflow, contribution: overflowVal * w.overflow },
    density: { value: densityVal, weight: w.density, contribution: densityVal * w.density },
  };

  const totalWeight = w.balance + w.crossing + w.overflow + w.density;
  const compositeScore = Math.max(0, Math.min(1,
    (contributions.balance.contribution +
     contributions.crossing.contribution +
     contributions.overflow.contribution +
     contributions.density.contribution) / totalWeight
  ));

  return { compositeScore, contributions };
}

/**
 * Convenience: compute composite score directly from layout data.
 */
export function scoreLayout(
  nodes: PositionedNode[],
  edges: LayoutEdge[],
  canvasWidth?: number,
  canvasHeight?: number
): CompositeScoreResult {
  const cw = canvasWidth ?? 1920;
  const ch = canvasHeight ?? 1080;

  const scorer = new VisualBalanceScorer();
  const balance = scorer.calculateVisualBalance(nodes, { width: cw, height: ch });
  const crossings = detectEdgeCrossings(nodes, edges);

  // Count overflows (nodes exceeding canvas bounds)
  let overflowCount = 0;
  for (const n of nodes) {
    const w = n.w ?? n.width ?? 0;
    const h = n.h ?? n.height ?? 0;
    if (n.x + w > cw || n.y + h > ch || n.x < 0 || n.y < 0) {
      overflowCount++;
    }
  }

  return calculateCompositeScore({
    balanceScore: balance.overallScore,
    crossingCount: crossings,
    edgeCount: edges.length,
    overflowCount,
    nodeCount: nodes.length,
    densityUniformity: balance.densityUniformity,
  });
}
