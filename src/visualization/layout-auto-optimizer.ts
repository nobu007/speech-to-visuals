/**
 * REQ-083: Quality-based Auto-Optimization Loop
 *
 * Automatically retries layout strategy selection and parameter tuning
 * when the composite quality score falls below a threshold.
 * Maximum 3 retries. Each retry re-evaluates the score.
 */

import { PositionedNode, LayoutEdge, DiagramType } from '@/types/diagram';
import { scoreLayout, CompositeScoreResult } from './layout-quality-composite';
import { minimizeEdgeCrossings } from './edge-crossing-minimizer';

export interface OptimizationResult {
  /** Final nodes after optimization */
  nodes: PositionedNode[];
  /** Final edges (unchanged references) */
  edges: LayoutEdge[];
  /** Score before optimization */
  initialScore: number;
  /** Score after optimization */
  finalScore: number;
  /** Number of attempts made */
  attempts: number;
  /** Whether the final score meets the threshold */
  passed: boolean;
  /** Score history per attempt */
  scoreHistory: number[];
}

export interface OptimizationConfig {
  /** Minimum acceptable composite score (default: 0.7) */
  threshold?: number;
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Canvas width (default: 1920) */
  canvasWidth?: number;
  /** Canvas height (default: 1080) */
  canvasHeight?: number;
}

const DEFAULT_CONFIG: Required<OptimizationConfig> = {
  threshold: 0.7,
  maxAttempts: 3,
  canvasWidth: 1920,
  canvasHeight: 1080,
};

/**
 * Run the auto-optimization loop.
 * Tries to improve layout quality by:
 *  1. Minimizing edge crossings (attempt 1)
 *  2. Re-centering nodes toward canvas center (attempt 2)
 *  3. Spreading out clustered nodes (attempt 3)
 */
export function runAutoOptimization(
  nodes: PositionedNode[],
  edges: LayoutEdge[],
  config?: OptimizationConfig
): OptimizationResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const scoreHistory: number[] = [];

  let currentNodes = nodes.map(n => ({ ...n }));
  const currentEdges = edges;

  // Initial score
  let currentScore = scoreLayout(
    currentNodes, currentEdges, cfg.canvasWidth, cfg.canvasHeight
  ).compositeScore;
  scoreHistory.push(currentScore);
  const initialScore = currentScore;

  if (currentScore >= cfg.threshold) {
    return {
      nodes: currentNodes,
      edges: currentEdges,
      initialScore,
      finalScore: currentScore,
      attempts: 0,
      passed: true,
      scoreHistory,
    };
  }

  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    // Apply optimization strategy based on attempt number
    currentNodes = applyOptimizationStrategy(
      currentNodes, currentEdges, attempt, cfg
    );

    currentScore = scoreLayout(
      currentNodes, currentEdges, cfg.canvasWidth, cfg.canvasHeight
    ).compositeScore;
    scoreHistory.push(currentScore);

    if (currentScore >= cfg.threshold) {
      return {
        nodes: currentNodes,
        edges: currentEdges,
        initialScore,
        finalScore: currentScore,
        attempts: attempt,
        passed: true,
        scoreHistory,
      };
    }
  }

  return {
    nodes: currentNodes,
    edges: currentEdges,
    initialScore,
    finalScore: currentScore,
    attempts: cfg.maxAttempts,
    passed: currentScore >= cfg.threshold,
    scoreHistory,
  };
}

// --- Internal strategies ---

function applyOptimizationStrategy(
  nodes: PositionedNode[],
  edges: LayoutEdge[],
  attempt: number,
  cfg: Required<OptimizationConfig>
): PositionedNode[] {
  switch (attempt) {
    case 1:
      return strategyCrossingMinimization(nodes, edges);
    case 2:
      return strategyRecenter(nodes, cfg);
    case 3:
      return strategySpreadOut(nodes, cfg);
    default:
      return nodes;
  }
}

/**
 * Strategy 1: Minimize edge crossings by swapping node positions
 */
function strategyCrossingMinimization(
  nodes: PositionedNode[],
  edges: LayoutEdge[]
): PositionedNode[] {
  const { nodes: optimized } = minimizeEdgeCrossings(nodes, edges, 5);
  return optimized;
}

/**
 * Strategy 2: Re-center nodes toward canvas center
 */
function strategyRecenter(
  nodes: PositionedNode[],
  cfg: Required<OptimizationConfig>
): PositionedNode[] {
  if (nodes.length === 0) return nodes;

  const cx = cfg.canvasWidth / 2;
  const cy = cfg.canvasHeight / 2;

  // Calculate current centroid
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

  // Shift all nodes toward center
  const dx = cx - centroidX;
  const dy = cy - centroidY;

  return nodes.map(n => ({
    ...n,
    x: n.x + dx * 0.5, // Move 50% toward center
    y: n.y + dy * 0.5,
  }));
}

/**
 * Strategy 3: Spread out clustered nodes
 */
function strategySpreadOut(
  nodes: PositionedNode[],
  cfg: Required<OptimizationConfig>
): PositionedNode[] {
  if (nodes.length < 2) return nodes;

  const minSpacing = 20;
  const result = nodes.map(n => ({ ...n }));

  // Repulsion: push overlapping/close nodes apart
  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const w1 = result[i].w ?? result[i].width ?? 0;
      const h1 = result[i].h ?? result[i].height ?? 0;
      const w2 = result[j].w ?? result[j].width ?? 0;
      const h2 = result[j].h ?? result[j].height ?? 0;

      const cx1 = result[i].x + w1 / 2;
      const cy1 = result[i].y + h1 / 2;
      const cx2 = result[j].x + w2 / 2;
      const cy2 = result[j].y + h2 / 2;

      const dist = Math.sqrt((cx1 - cx2) ** 2 + (cy1 - cy2) ** 2);
      const minDist = (w1 + w2) / 2 + minSpacing;

      if (dist < minDist && dist > 0) {
        const push = (minDist - dist) / 2;
        const nx = (cx2 - cx1) / dist;
        const ny = (cy2 - cy1) / dist;

        result[i] = { ...result[i], x: result[i].x - nx * push, y: result[i].y - ny * push };
        result[j] = { ...result[j], x: result[j].x + nx * push, y: result[j].y + ny * push };
      }
    }
  }

  return result;
}
