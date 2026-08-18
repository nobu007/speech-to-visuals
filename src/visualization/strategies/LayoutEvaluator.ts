import { DiagramLayout, DiagramType, PositionedNode, LayoutEdge } from '@stv/core/types/diagram';
import { LayoutConfig, LayoutResult, LayoutMetrics, LayoutComplianceResult, Point, OverlapPair, BoundingBox } from '../types';
import { clamp01 } from '@stv/core/utils/guards';
import { detectOverlapPairs, calculateNodeCenter, calculateNodeDistance } from '../layout-utils';
import { detectEdgeCrossings } from '../edge-crossing-minimizer';
import { getNodeWidth, getNodeHeight } from '../node-dimensions';

export class LayoutEvaluator {
  private config: LayoutConfig;

  constructor(
    config: LayoutConfig
  ) {
    this.config = config;
  }

  /**
   * Calculate layout quality metrics
   */
  public calculateLayoutMetrics(
    nodes: PositionedNode[],
    edges: LayoutEdge[]
  ): LayoutMetrics {
    const overlapCount = this.countOverlaps(nodes);
    const totalArea = nodes.reduce((sum, node) => sum + getNodeWidth(node, 0) * getNodeHeight(node, 0), 0);
    const nodeSpacing = this.calculateAverageNodeSpacing(nodes);
    const layoutBalance = this.calculateLayoutBalance(nodes);
    // Round 43 single source: this scan (and its orientation/onSegment
    // geometry trio) was a private re-implementation of the exported
    // canonical in edge-crossing-minimizer.ts — identical centers
    // (calculateNodeCenter ≡ x + getNodeWidth(n,0)/2), identical
    // orientation+collinear predicate with the same 1e-4 tolerance,
    // identical shared-endpoint-id skip. Deltas are unreachable-input only:
    // the canonical also resolves `from ?? source` aliases (v1 LayoutEdges
    // always carry from/to) and null-guards the arrays.
    const edgeCrossings = detectEdgeCrossings(nodes, edges);

    return {
      overlapCount,
      edgeCrossings,
      totalArea,
      nodeSpacing,
      layoutBalance
    };
  }

  // Round 43 retired `detectEdgeCrossings` + `lineSegmentsIntersect` +
  // `orientation` + `onSegment` (private): a full private re-implementation
  // of the canonical orientation+collinear scan exported by
  // ../edge-crossing-minimizer (detectEdgeCrossings). Delegation deltas are
  // unreachable-input only — see the call site note above.

  /**
   * Detect all overlapping node pairs
   * Custom Instructions: Zero overlap tolerance
   *
   * "Overlap" means a *visual* intersection (gap < 0). This must match the
   * OverlapResolver producer guarantee: it resolves node pairs to gap >= 0
   * (center distance = getMinimumSeparationForType + (w1+w2)/2, then a
   * finalOverlapResolution pass iterates until `nodesOverlap(a,b,0)` is
   * false). Using config.nodeSeparation (50) as the buffer here flagged
   * every legitimately-separated pair (producer targets a 20-40px gap, and
   * even the largest target, tree=40, is < 50) as a false overlap. That
   * drove confidence from its no-overlap ceiling (~0.95) down toward the
   * −0.1/pair penalty floor and raised false "Low confidence" warnings
   * (video-generator.ts). Invariant-split fix: judge the same predicate the
   * producer resolves against (mirror of overlap-margin fix 6923806 /
   * overlap-delegate c34f5f12). An explicit `spacing` may still be passed.
   */
  protected detectAllOverlaps(nodes: PositionedNode[], spacing?: number): OverlapPair[] {
    // Round 39 single source — the pairwise scan itself lives in layout-utils
    // `detectOverlapPairs`; only this judge's spacing default (0 = plain
    // geometric overlap) is decided here.
    return detectOverlapPairs(nodes, spacing ?? 0);
  }

  /**
   * Count total overlaps in layout
   */
  protected countOverlaps(nodes: PositionedNode[]): number {
    return this.detectAllOverlaps(nodes).length;
  }

  /**
   * Calculate average spacing between all node pairs
   */
  protected calculateAverageNodeSpacing(nodes: PositionedNode[]): number {
    if (nodes.length < 2) return 0;

    let totalDistance = 0;
    let pairCount = 0;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        totalDistance += calculateNodeDistance(nodes[i], nodes[j]);
        pairCount++;
      }
    }

    return pairCount > 0 ? totalDistance / pairCount : 0;
  }

  /**
   * Calculate layout balance (how evenly distributed nodes are)
   * Returns 0-1, higher = more balanced
   */
  protected calculateLayoutBalance(nodes: PositionedNode[]): number {
    if (nodes.length === 0) return 1;

    const centers = nodes.map(node => calculateNodeCenter(node));
    const centerX = centers.reduce((sum, c) => sum + c.x, 0) / nodes.length;
    const centerY = centers.reduce((sum, c) => sum + c.y, 0) / nodes.length;

    const variance = centers.reduce((sum, center) => {
      const dx = center.x - centerX;
      const dy = center.y - centerY;
      return sum + dx * dx + dy * dy;
    }, 0) / nodes.length;

    // Normalize variance to 0-1 scale (higher = more balanced)
    return Math.max(0, 1 - variance / 100000);
  }

  /**
   * Evaluate layout quality
   */
  public async evaluateLayout(result: LayoutResult, diagramType: DiagramType): Promise<void> {
    const metrics = this.calculateLayoutMetrics(result.layout.nodes, result.layout.edges);

    const successCriteria = {
      hasNodes: result.layout.nodes.length > 0,
      noOverlaps: metrics.overlapCount === 0,
      withinBounds: result.bounds.width <= this.config.width && result.bounds.height <= this.config.height,
      fastProcessing: result.processingTime < 5000
    };

  }

  /**
   * Calculate layout confidence based on quality metrics
   */
  public calculateLayoutConfidence(layout: DiagramLayout, processingTime: number): number {
    const metrics = this.calculateLayoutMetrics(layout.nodes, layout.edges);
    let confidence = 0.8; // Base confidence

    // Zero overlaps is mandatory for high confidence
    if (metrics.overlapCount === 0) {
      confidence += 0.15;
    } else {
      confidence -= metrics.overlapCount * 0.1; // Heavy penalty for overlaps
    }

    // Performance bonus
    if (processingTime < 2000) {
      confidence += 0.05; // Fast processing bonus
    } else if (processingTime > 5000) {
      confidence -= 0.1; // Slow processing penalty
    }

    // Structure quality
    if (layout.nodes.length > 0 && layout.edges.length > 0) {
      confidence += 0.05; // Has valid structure
    }

    return clamp01(confidence);
  }

  /**
   * 🎯 Custom Instructions: Enhanced Layout Evaluation
   * Evaluates against Custom Instructions Phase 4 requirements.
   *
   * Returns the compliance result so the caller can surface failures. Previously
   * this method computed the compliance, score, and `passed` flag and then
   * returned `void` — every computed field was dropped (producer-computes-but-
   * DROPS), so failing layouts were silently swallowed on the live path.
   */
  public async evaluateLayoutWithCustomInstructions(result: LayoutResult, diagramType: DiagramType): Promise<LayoutComplianceResult> {
    const metrics = this.calculateLayoutMetrics(result.layout.nodes, result.layout.edges);

    // Custom Instructions compliance check
    const compliance = {
      zeroOverlaps: metrics.overlapCount === 0,
      fastProcessing: result.processingTime < 5000,
      hasValidStructure: result.layout.nodes.length > 0,
      withinBounds: result.bounds.width <= this.config.width && result.bounds.height <= this.config.height
    };

    const failures = Object.entries(compliance).filter(([, satisfied]) => !satisfied).map(([criterion]) => criterion);
    const complianceScore = 1 - failures.length / Object.keys(compliance).length;
    const passed = complianceScore >= 0.75; // 75% compliance required

    return { passed, complianceScore, failures };
  }
}
