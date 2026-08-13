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
import { sanitizeFinite } from '@/utils/guards';
import { distance } from './layout-utils';
import { getNodeWidth as nodeWidth, getNodeHeight as nodeHeight } from './node-dimensions';

export interface VisualBalanceResult {
  /** Composite balance score 0.0~1.0, higher = more balanced */
  overallScore: number;
  /** Centroid deviation from canvas center (0.0~1.0, 1.0 = centered) */
  centroidDeviation: number;
  /** Quadrant balance ratio (0.0~1.0, 1.0 = perfectly even) */
  quadrantBalance: number;
  /** Density uniformity (0.0~1.0, 1.0 = uniform density) */
  densityUniformity: number;
  /** Geometric centroid of all node centers */
  centroid: { x: number; y: number };
  /** Node counts per quadrant [Q0=TL, Q1=TR, Q2=BL, Q3=BR] */
  quadrantCounts: [number, number, number, number];
}

/**
 * Get center point of a node.
 *
 * `node.x` / `node.y` are sanitized at this ingestion chokepoint (the single
 * producer of every center fed into the centroid/quadrant/density reduces)
 * so one non-finite coordinate can never poison the aggregate. Without it,
 * a NaN position propagates through `reduce((s, c) => s + c.x, 0)` (NaN +
 * finite = NaN), the local `clamp` cannot mask it, and a fully-NaN position
 * additionally crashes `computeDensityUniformity` (`grid[NaN]` → TypeError).
 * Same `node.x`/`node.y` field `canvas-calculator.ts` already sanitizes —
 * this was the missed sibling. Dimensions are already NaN-safe via
 * `getNodeWidth`/`getNodeHeight`.
 */
function nodeCenter(node: PositionedNode): { x: number; y: number } {
  return {
    x: sanitizeFinite(node.x, 0) + nodeWidth(node, 0) / 2,
    y: sanitizeFinite(node.y, 0) + nodeHeight(node, 0) / 2,
  };
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

export class VisualBalanceScorer {
  /**
   * Calculate visual balance metrics for a set of positioned nodes.
   *
   * @param nodes  - Array of positioned nodes
   * @param bounds - Canvas dimensions { width, height }
   * @returns VisualBalanceResult with overall and sub-scores
   */
  calculateVisualBalance(
    nodes: PositionedNode[],
    bounds: { width: number; height: number },
  ): VisualBalanceResult {
    if (nodes.length === 0) {
      return {
        overallScore: 1,
        centroidDeviation: 1,
        quadrantBalance: 1,
        densityUniformity: 1,
        centroid: { x: 0, y: 0 },
        quadrantCounts: [0, 0, 0, 0],
      };
    }

    const centers = nodes.map(nodeCenter);

    const centroid = this.computeCentroid(centers);
    const centroidDeviation = this.computeCentroidDeviation(centers, bounds);
    const { balance: quadrantBalance, counts: quadrantCounts } = this.computeQuadrantBalance(centers, bounds);
    const densityUniformity = this.computeDensityUniformity(centers, bounds);

    const overallScore = (centroidDeviation + quadrantBalance + densityUniformity) / 3;

    return {
      overallScore: clamp(overallScore),
      centroidDeviation: clamp(centroidDeviation),
      quadrantBalance: clamp(quadrantBalance),
      densityUniformity: clamp(densityUniformity),
      centroid,
      quadrantCounts,
    };
  }

  /** Geometric centroid of all node centers */
  private computeCentroid(centers: { x: number; y: number }[]): { x: number; y: number } {
    const sumX = centers.reduce((s, c) => s + c.x, 0);
    const sumY = centers.reduce((s, c) => s + c.y, 0);
    return {
      x: sumX / centers.length,
      y: sumY / centers.length,
    };
  }

  /**
   * Centroid deviation: how close is the centroid to the canvas center?
   * Returns 1.0 when centroid is at canvas center, approaching 0.0 when far.
   */
  private computeCentroidDeviation(
    centers: { x: number; y: number }[],
    bounds: { width: number; height: number },
  ): number {
    const n = Math.max(1, centers.length);
    const cx = centers.reduce((s, c) => s + c.x, 0) / n;
    const cy = centers.reduce((s, c) => s + c.y, 0) / n;

    const canvasCenterX = bounds.width / 2;
    const canvasCenterY = bounds.height / 2;

    const dx = cx - canvasCenterX;
    const dy = cy - canvasCenterY;
    const devDistance = distance(dx, dy);

    const maxDistance = distance(canvasCenterX, canvasCenterY);
    if (maxDistance === 0) return 1;

    return 1 - devDistance / maxDistance;
  }

  /**
   * Quadrant balance: how evenly distributed are nodes across 4 quadrants?
   *   Q0 (top-left)     | Q1 (top-right)
   *   ------------------+-------------------
   *   Q2 (bottom-left)  | Q3 (bottom-right)
   */
  private computeQuadrantBalance(
    centers: { x: number; y: number }[],
    bounds: { width: number; height: number },
  ): { balance: number; counts: [number, number, number, number] } {
    const midX = bounds.width / 2;
    const midY = bounds.height / 2;

    const counts: [number, number, number, number] = [0, 0, 0, 0];

    for (const c of centers) {
      const isLeft = c.x < midX;
      const isTop = c.y < midY;

      if (isLeft && isTop) counts[0]++;
      else if (!isLeft && isTop) counts[1]++;
      else if (isLeft && !isTop) counts[2]++;
      else counts[3]++;
    }

    const balance = this.evennessScore(counts);
    return { balance, counts };
  }

  /**
   * Evenness via 1 - coefficient_of_variation.
   * Returns 1.0 when all counts are equal, lower when skewed.
   */
  private evennessScore(counts: number[]): number {
    const total = counts.reduce((s, c) => s + c, 0);
    if (total === 0) return 1;

    const mean = total / counts.length;
    if (mean === 0) return 1;

    const variance = counts.reduce((s, c) => s + (c - mean) ** 2, 0) / counts.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean;

    return Math.max(0, 1 - cv);
  }

  /**
   * Density uniformity: grid-based analysis of node distribution.
   * Divides the canvas into a 4×4 grid and measures how uniformly
   * nodes are spread across cells using coefficient of variation.
   */
  private computeDensityUniformity(
    centers: { x: number; y: number }[],
    bounds: { width: number; height: number },
  ): number {
    // Dynamic grid size: scales with node count to avoid penalizing sparse layouts
    const GRID_SIZE = Math.max(2, Math.min(4, Math.ceil(Math.sqrt(centers.length))));
    const cellWidth = bounds.width / GRID_SIZE;
    const cellHeight = bounds.height / GRID_SIZE;

    const grid: number[][] = Array.from({ length: GRID_SIZE }, () =>
      Array(GRID_SIZE).fill(0),
    );

    for (const c of centers) {
      const col = Math.min(Math.max(0, Math.floor(c.x / cellWidth)), GRID_SIZE - 1);
      const row = Math.min(Math.max(0, Math.floor(c.y / cellHeight)), GRID_SIZE - 1);
      grid[row][col]++;
    }

    const cellCounts = grid.flat();
    const total = cellCounts.reduce((s, c) => s + c, 0);
    if (total === 0) return 1;

    const numCells = Math.max(1, cellCounts.length);
    const mean = total / numCells;
    if (mean === 0) return 1;

    const variance = cellCounts.reduce((s, c) => s + (c - mean) ** 2, 0) / numCells;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean;

    return Math.max(0, 1 - cv);
  }
}
