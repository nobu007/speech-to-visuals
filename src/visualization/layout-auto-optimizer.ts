/**
 * REQ-083: Quality-based Auto-Optimization Loop
 *
 * Automatically retries layout strategy selection and parameter tuning
 * when the composite quality score falls below a threshold.
 * Maximum 3 retries. Each retry re-evaluates the score.
 */

import { PositionedNode, LayoutEdge, DiagramType, NodeDatum, EdgeDatum } from '@/types/diagram';
import { scoreLayout, CompositeScoreResult } from './layout-quality-composite';
import { minimizeEdgeCrossings } from './edge-crossing-minimizer';
import { StrategySelector } from './strategy-selector';
import { LayoutStrategy, StrategyLayoutResult } from './types';
import { getNodeWidth, getNodeHeight } from './node-dimensions';

// ── Legacy function-based API (kept for backward compat) ──

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

// ── Class-based API: LayoutAutoOptimizer (TASK-0128) ──

export interface OptimizationStep {
  iteration: number;
  action: 'reselect_strategy' | 'adjust_params' | 'recalculate';
  previousScore: number;
  newScore: number;
  improved: boolean;
  details: string;
}

export interface OptimizerResult {
  improved: boolean;
  initialScore: number;
  finalScore: number;
  iterations: number;
  steps: OptimizationStep[];
  finalNodes: PositionedNode[];
  finalEdges: LayoutEdge[];
}

/** Adjustable layout parameters */
export interface LayoutParams {
  nodeSpacing: number;
  rankSeparation: number;
  nodeWidthScale: number;
  nodeHeightScale: number;
}

const DEFAULT_PARAMS: LayoutParams = {
  nodeSpacing: 50,
  rankSeparation: 80,
  nodeWidthScale: 1.0,
  nodeHeightScale: 1.0,
};

const DEFAULT_THRESHOLD = 0.7;
const DEFAULT_MAX_ITERATIONS = 3;

/**
 * Pure parameter-adjustment arithmetic, extracted from `adjustParams` for
 * unit testing. Each score value is in [0,1] (1 = good); values below 0.5
 * trigger a corrective boost.
 */
export function adjustLayoutParams(
  params: LayoutParams,
  scores: { balanceValue: number; crossingValue: number; overflowValue: number },
): LayoutParams {
  const newParams = { ...params };

  // Low balance → increase spacing to spread nodes out
  if (scores.balanceValue < 0.5) {
    newParams.nodeSpacing = Math.round(params.nodeSpacing * 1.2);
    newParams.rankSeparation = Math.round(params.rankSeparation * 1.2);
  }

  // High crossing → also increase spacing (compounds on the balance boost;
  // read from newParams, not params, or the balance boost above is discarded)
  if (scores.crossingValue < 0.5) {
    newParams.nodeSpacing = Math.round(newParams.nodeSpacing * 1.15);
  }

  // High overflow → scale down nodes
  if (scores.overflowValue < 0.5) {
    newParams.nodeWidthScale = params.nodeWidthScale * 0.9;
    newParams.nodeHeightScale = params.nodeHeightScale * 0.9;
  }

  return newParams;
}

export class LayoutAutoOptimizer {
  private readonly strategySelector: StrategySelector;
  private readonly maxIterations: number;
  private readonly threshold: number;

  /**
   * @param strategySelector  Provides fallback chain for strategy reselection
   * @param maxIterations     Maximum optimization iterations (default: 3)
   * @param threshold         Minimum composite score (default: 0.7)
   */
  constructor(
    strategySelector: StrategySelector,
    maxIterations?: number,
    threshold?: number,
  ) {
    this.strategySelector = strategySelector;
    this.maxIterations = maxIterations ?? DEFAULT_MAX_ITERATIONS;
    this.threshold = threshold ?? DEFAULT_THRESHOLD;
  }

  /**
   * Run the full optimization loop.
   *
   * 1. Evaluate initial composite score
   * 2. If score < threshold → iterate up to maxIterations:
   *    a. Strategy reselection (try fallback chain)
   *    b. Parameter adjustment (spacing, separation, scale)
   *    c. Recalculate with adjusted layout
   * 3. Return detailed result with step history
   */
  async optimize(
    nodes: PositionedNode[],
    edges: LayoutEdge[],
    diagramType: DiagramType,
    bounds: { width: number; height: number },
  ): Promise<OptimizerResult> {
    let currentNodes = nodes.map(n => ({ ...n }));
    let currentEdges = edges.map(e => ({ ...e, points: [...e.points] }));
    const steps: OptimizationStep[] = [];

    // Initial score evaluation
    let currentScore = scoreLayout(
      currentNodes, currentEdges, bounds.width, bounds.height,
    ).compositeScore;
    const initialScore = currentScore;

    // Score already meets threshold → skip optimization
    if (currentScore >= this.threshold) {
      return {
        improved: false,
        initialScore,
        finalScore: currentScore,
        iterations: 0,
        steps: [],
        finalNodes: currentNodes,
        finalEdges: currentEdges,
      };
    }

    let params = { ...DEFAULT_PARAMS };
    const fallbackChain = this.strategySelector.getFallbackChain(diagramType);
    let strategyIndex = 0;

    for (let iteration = 1; iteration <= this.maxIterations; iteration++) {
      const prevScore = currentScore;

      // Step A: Strategy reselection — try next strategy in fallback chain
      if (strategyIndex < fallbackChain.length - 1) {
        const nextStrategy = fallbackChain[strategyIndex + 1];
        const reselectResult = this.applyStrategy(
          nextStrategy, currentNodes, currentEdges,
        );
        const reselectScore = scoreLayout(
          reselectResult.nodes, reselectResult.edges, bounds.width, bounds.height,
        ).compositeScore;

        steps.push({
          iteration,
          action: 'reselect_strategy',
          previousScore: prevScore,
          newScore: reselectScore,
          improved: reselectScore > prevScore,
          details: `Tried strategy '${nextStrategy.name}' (index ${strategyIndex + 1})`,
        });

        if (reselectScore > currentScore) {
          currentNodes = reselectResult.nodes;
          currentEdges = reselectResult.edges;
          currentScore = reselectScore;
          strategyIndex++;
        }

        if (currentScore >= this.threshold) break;
      }

      // Step B: Parameter adjustment
      params = this.adjustParams(params, currentNodes, currentEdges, bounds);
      const adjustedNodes = this.applyParams(currentNodes, params);
      const adjustedScore = scoreLayout(
        adjustedNodes, currentEdges, bounds.width, bounds.height,
      ).compositeScore;

      steps.push({
        iteration,
        action: 'adjust_params',
        previousScore: currentScore,
        newScore: adjustedScore,
        improved: adjustedScore > currentScore,
        details: `nodeSpacing=${params.nodeSpacing} rankSeparation=${params.rankSeparation} widthScale=${params.nodeWidthScale}`,
      });

      if (adjustedScore > currentScore) {
        currentNodes = adjustedNodes;
        currentScore = adjustedScore;
      }

      if (currentScore >= this.threshold) break;

      // Step C: Recalculate — edge crossing minimization + recenter
      const recalcResult = this.recalculate(
        currentNodes, currentEdges, bounds,
      );
      const recalcScore = scoreLayout(
        recalcResult.nodes, recalcResult.edges, bounds.width, bounds.height,
      ).compositeScore;

      steps.push({
        iteration,
        action: 'recalculate',
        previousScore: currentScore,
        newScore: recalcScore,
        improved: recalcScore > currentScore,
        details: 'Edge crossing minimization + recentering',
      });

      if (recalcScore > currentScore) {
        currentNodes = recalcResult.nodes;
        currentEdges = recalcResult.edges;
        currentScore = recalcScore;
      }

      if (currentScore >= this.threshold) break;
    }

    return {
      improved: currentScore > initialScore,
      initialScore,
      finalScore: currentScore,
      iterations: steps.length > 0 ? steps[steps.length - 1].iteration : 0,
      steps,
      finalNodes: currentNodes,
      finalEdges: currentEdges,
    };
  }

  // ── Internal helpers ──

  /**
   * Apply a strategy to get a new layout.
   * Converts PositionedNode → NodeDatum for strategy input.
   */
  private applyStrategy(
    strategy: LayoutStrategy,
    currentNodes: PositionedNode[],
    originalEdges: LayoutEdge[],
  ): { nodes: PositionedNode[]; edges: LayoutEdge[] } {
    const nodeData: NodeDatum[] = currentNodes.map(n => ({
      id: n.id,
      label: n.label,
      type: n.type,
      meta: n.meta,
      width: getNodeWidth(n),
      height: getNodeHeight(n),
    }));

    const edgeData: EdgeDatum[] = originalEdges.map(e => ({
      from: e.from ?? e.source ?? '',
      to: e.to ?? e.target ?? '',
      label: e.label,
      id: e.id,
      type: e.type,
    }));

    const result: StrategyLayoutResult = strategy.apply(nodeData, edgeData);
    return { nodes: result.nodes, edges: result.edges };
  }

  /**
   * Adjust layout parameters based on current score contributions.
   */
  private adjustParams(
    params: LayoutParams,
    nodes: PositionedNode[],
    edges: LayoutEdge[],
    bounds: { width: number; height: number },
  ): LayoutParams {
    const score = scoreLayout(nodes, edges, bounds.width, bounds.height);
    const c = score.contributions;
    return adjustLayoutParams(params, {
      balanceValue: c.balance.value,
      crossingValue: c.crossing.value,
      overflowValue: c.overflow.value,
    });
  }

  /**
   * Apply parameter adjustments to node positions and sizes.
   */
  private applyParams(
    nodes: PositionedNode[],
    params: LayoutParams,
  ): PositionedNode[] {
    if (nodes.length === 0) return nodes;

    // Compute bounding box center
    let cx = 0, cy = 0;
    for (const n of nodes) {
      const w = getNodeWidth(n, 0);
      const h = getNodeHeight(n, 0);
      cx += n.x + w / 2;
      cy += n.y + h / 2;
    }
    cx /= nodes.length;
    cy /= nodes.length;

    return nodes.map(n => {
      const w = getNodeWidth(n);
      const h = getNodeHeight(n);
      const ncx = n.x + w / 2;
      const ncy = n.y + h / 2;

      // Scale distance from centroid by spacing factor
      const dx = ncx - cx;
      const dy = ncy - cy;
      const spacingFactor = params.nodeSpacing / DEFAULT_PARAMS.nodeSpacing;

      return {
        ...n,
        x: cx + dx * spacingFactor - (w * params.nodeWidthScale) / 2,
        y: cy + dy * spacingFactor - (h * params.nodeHeightScale) / 2,
        w: Math.round(w * params.nodeWidthScale),
        h: Math.round(h * params.nodeHeightScale),
        width: Math.round(w * params.nodeWidthScale),
        height: Math.round(h * params.nodeHeightScale),
      };
    });
  }

  /**
   * Recalculate: minimize edge crossings + recenter.
   */
  private recalculate(
    nodes: PositionedNode[],
    edges: LayoutEdge[],
    bounds: { width: number; height: number },
  ): { nodes: PositionedNode[]; edges: LayoutEdge[] } {
    // Edge crossing minimization
    const { nodes: optNodes } = minimizeEdgeCrossings(nodes, edges, 5);

    // Recenter
    if (optNodes.length === 0) return { nodes: optNodes, edges };

    const cxTarget = bounds.width / 2;
    const cyTarget = bounds.height / 2;

    let sumX = 0, sumY = 0;
    for (const n of optNodes) {
      const w = getNodeWidth(n, 0);
      const h = getNodeHeight(n, 0);
      sumX += n.x + w / 2;
      sumY += n.y + h / 2;
    }
    const centroidX = sumX / optNodes.length;
    const centroidY = sumY / optNodes.length;

    const dx = cxTarget - centroidX;
    const dy = cyTarget - centroidY;

    const recentered = optNodes.map(n => ({
      ...n,
      x: n.x + dx * 0.5,
      y: n.y + dy * 0.5,
    }));

    return { nodes: recentered, edges };
  }
}

// ── Legacy internal strategies ──

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

function strategyCrossingMinimization(
  nodes: PositionedNode[],
  edges: LayoutEdge[]
): PositionedNode[] {
  const { nodes: optimized } = minimizeEdgeCrossings(nodes, edges, 5);
  return optimized;
}

function strategyRecenter(
  nodes: PositionedNode[],
  cfg: Required<OptimizationConfig>
): PositionedNode[] {
  if (nodes.length === 0) return nodes;

  const cx = cfg.canvasWidth / 2;
  const cy = cfg.canvasHeight / 2;

  let sumX = 0;
  let sumY = 0;
  for (const n of nodes) {
    const w = getNodeWidth(n, 0);
    const h = getNodeHeight(n, 0);
    sumX += n.x + w / 2;
    sumY += n.y + h / 2;
  }
  const centroidX = sumX / nodes.length;
  const centroidY = sumY / nodes.length;

  const dx = cx - centroidX;
  const dy = cy - centroidY;

  return nodes.map(n => ({
    ...n,
    x: n.x + dx * 0.5,
    y: n.y + dy * 0.5,
  }));
}

function strategySpreadOut(
  nodes: PositionedNode[],
  cfg: Required<OptimizationConfig>
): PositionedNode[] {
  if (nodes.length < 2) return nodes;

  const minSpacing = 20;
  const result = nodes.map(n => ({ ...n }));

  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const w1 = getNodeWidth(result[i], 0);
      const h1 = getNodeHeight(result[i], 0);
      const w2 = getNodeWidth(result[j], 0);
      const h2 = getNodeHeight(result[j], 0);

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
