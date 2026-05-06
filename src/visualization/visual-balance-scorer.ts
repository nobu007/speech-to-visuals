/**
 * REQ-079: Visual Balance Scoring
 *
 * Evaluates how visually balanced a diagram layout is by analyzing:
 * - Centroid deviation (distance of node center-of-mass from canvas center)
 * - Quadrant balance (distribution uniformity across 4 quadrants)
 * - Density uniformity (variance of local density across the layout)
 * - Composite balance score (0.0 ~ 1.0)
 */

import { PositionedNode } from '@/types/diagram';

export interface BalanceScoreResult {
  /** Composite balance score 0.0~1.0, higher = more balanced */
  score: number;
  /** Centroid deviation from canvas center (0.0~1.0, lower = better) */
  centroidDeviation: number;
  /** Quadrant balance ratio (0.0~1.0, 1.0 = perfectly even) */
  quadrantBalance: number;
  /** Density uniformity (0.0~1.0, 1.0 = uniform density) */
  densityUniformity: number;
}

export interface BalanceScorerConfig {
  /** Canvas width for center reference (default: 1920) */
  canvasWidth?: number;
  /** Canvas height for center reference (default: 1080) */
  canvasHeight?: number;
}

const DEFAULT_CONFIG: Required<BalanceScorerConfig> = {
  canvasWidth: 1920,
  canvasHeight: 1080,
};

/**
 * Calculate the composite visual balance score for a layout
 */
export function calculateBalanceScore(
  nodes: PositionedNode[],
  config?: BalanceScorerConfig
): BalanceScoreResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Edge case: 0 nodes → score 0.0 (no meaningful layout)
  if (nodes.length === 0) {
    return {
      score: 0.0,
      centroidDeviation: 0.0,
      quadrantBalance: 0.0,
      densityUniformity: 0.0,
    };
  }

  // Edge case: 1 node → always balanced
  if (nodes.length === 1) {
    return {
      score: 1.0,
      centroidDeviation: 0.0,
      quadrantBalance: 1.0,
      densityUniformity: 1.0,
    };
  }

  const centroidDeviation = computeCentroidDeviation(nodes, cfg);
  const quadrantBalance = computeQuadrantBalance(nodes, cfg);
  const densityUniformity = computeDensityUniformity(nodes, cfg);

  // Weighted composite: centroid 30%, quadrant 40%, density 30%
  const score =
    (1 - centroidDeviation) * 0.3 +
    quadrantBalance * 0.4 +
    densityUniformity * 0.3;

  return {
    score: Math.max(0, Math.min(1, score)),
    centroidDeviation,
    quadrantBalance,
    densityUniformity,
  };
}

/**
 * Compute how far the centroid of all nodes deviates from canvas center.
 * Returns 0.0 (centered) to 1.0 (far from center).
 */
function computeCentroidDeviation(
  nodes: PositionedNode[],
  cfg: Required<BalanceScorerConfig>
): number {
  const cx = cfg.canvasWidth / 2;
  const cy = cfg.canvasHeight / 2;

  let sumX = 0;
  let sumY = 0;
  for (const n of nodes) {
    const w = n.w ?? n.width ?? 0;
    const h = n.h ?? n.height ?? 0;
    sumX += n.x + w / 2;
    sumY += n.y + h / 2;
  }
  const centroidX = sumX / nodes.length;
  const centroidY = sumY / nodes.length;

  const maxDist = Math.sqrt(cx * cx + cy * cy);
  const dist = Math.sqrt((centroidX - cx) ** 2 + (centroidY - cy) ** 2);

  return Math.min(1, dist / maxDist);
}

/**
 * Compute how evenly nodes are distributed across 4 quadrants.
 * Returns 0.0 (all in one quadrant) to 1.0 (perfectly even).
 */
function computeQuadrantBalance(
  nodes: PositionedNode[],
  cfg: Required<BalanceScorerConfig>
): number {
  const midX = cfg.canvasWidth / 2;
  const midY = cfg.canvasHeight / 2;

  // Count nodes in each quadrant
  const counts = [0, 0, 0, 0]; // TL, TR, BL, BR
  for (const n of nodes) {
    const w = n.w ?? n.width ?? 0;
    const h = n.h ?? n.height ?? 0;
    const cx = n.x + w / 2;
    const cy = n.y + h / 2;
    const idx = (cx < midX ? 0 : 1) + (cy < midY ? 0 : 2);
    counts[idx]++;
  }

  const total = nodes.length;
  const ideal = total / 4;

  // Chi-squared-like metric: sum of squared deviations from ideal
  const chiSq = counts.reduce((sum, c) => sum + (c - ideal) ** 2, 0) / ideal;

  // Normalize: 0 deviation = 1.0, max deviation (all in one quadrant) → 0.0
  const maxChiSq = (total - ideal) ** 2 / ideal + 3 * ideal; // worst case
  return Math.max(0, 1 - chiSq / maxChiSq);
}

/**
 * Compute how uniform the local density is across the layout.
 * Uses a simple grid-based approach.
 * Returns 0.0 (highly uneven) to 1.0 (perfectly uniform).
 */
function computeDensityUniformity(
  nodes: PositionedNode[],
  _cfg: Required<BalanceScorerConfig>
): number {
  if (nodes.length < 2) return 1.0;

  // Use pairwise nearest-neighbor distances
  const dists: number[] = [];
  for (let i = 0; i < nodes.length; i++) {
    let minDist = Infinity;
    const w1 = nodes[i].w ?? nodes[i].width ?? 0;
    const h1 = nodes[i].h ?? nodes[i].height ?? 0;
    const cx1 = nodes[i].x + w1 / 2;
    const cy1 = nodes[i].y + h1 / 2;

    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const w2 = nodes[j].w ?? nodes[j].width ?? 0;
      const h2 = nodes[j].h ?? nodes[j].height ?? 0;
      const cx2 = nodes[j].x + w2 / 2;
      const cy2 = nodes[j].y + h2 / 2;
      const d = Math.sqrt((cx1 - cx2) ** 2 + (cy1 - cy2) ** 2);
      if (d < minDist) minDist = d;
    }
    dists.push(minDist);
  }

  // Coefficient of variation (lower = more uniform)
  const mean = dists.reduce((a, b) => a + b, 0) / dists.length;
  if (mean === 0) return 1.0;
  const variance =
    dists.reduce((sum, d) => sum + (d - mean) ** 2, 0) / dists.length;
  const cv = Math.sqrt(variance) / mean;

  // cv=0 → uniform=1.0, cv=2+ → uniform≈0
  return Math.max(0, 1 - cv / 2);
}
