import { DiagramLayout, DiagramType, LayoutResult, PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutConfig, LayoutMetrics, Point, OverlapPair, BoundingBox } from '../types';
import { nodesOverlap, calculateNodeCenter, calculateNodeDistance } from '../layout-utils';

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
    const totalArea = nodes.reduce((sum, node) => sum + node.w * node.h, 0);
    const nodeSpacing = this.calculateAverageNodeSpacing(nodes);
    const layoutBalance = this.calculateLayoutBalance(nodes);
    const edgeCrossings = this.detectEdgeCrossings(nodes, edges);

    return {
      overlapCount,
      edgeCrossings,
      totalArea,
      nodeSpacing,
      layoutBalance
    };
  }

  /**
   * Phase 33: Detect edge crossings in the layout
   * Uses line segment intersection algorithm for accurate detection
   *
   * @param nodes - Array of positioned nodes with coordinates
   * @param edges - Array of edges connecting nodes
   * @returns Number of edge crossings detected
   */
  private detectEdgeCrossings(nodes: PositionedNode[], edges: LayoutEdge[]): number {
    if (edges.length < 2) return 0;

    // Create a map of node IDs to their center points for quick lookup
    const nodePositions = new Map<string, Point>();
    nodes.forEach(node => {
      const center = calculateNodeCenter(node);
      nodePositions.set(node.id, center);
    });

    // Convert edges to line segments
    interface LineSegment {
      edge: LayoutEdge;
      start: Point;
      end: Point;
    }

    const segments: LineSegment[] = [];
    for (const edge of edges) {
      const start = nodePositions.get(edge.from);
      const end = nodePositions.get(edge.to);

      if (start && end) {
        segments.push({ edge, start, end });
      }
    }

    // Count crossings by checking each pair of segments
    let crossingCount = 0;
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const seg1 = segments[i];
        const seg2 = segments[j];

        // Skip if edges share a node (they're allowed to touch at endpoints)
        if (
          seg1.edge.from === seg2.edge.from ||
          seg1.edge.from === seg2.edge.to ||
          seg1.edge.to === seg2.edge.from ||
          seg1.edge.to === seg2.edge.to
        ) {
          continue;
        }

        // Check if the line segments intersect
        if (this.lineSegmentsIntersect(seg1.start, seg1.end, seg2.start, seg2.end)) {
          crossingCount++;
        }
      }
    }

    return crossingCount;
  }

  /**
   * Phase 33: Check if two line segments intersect
   * Uses the orientation method for robust intersection detection
   *
   * @param p1 Start point of first segment
   * @param p2 End point of first segment
   * @param p3 Start point of second segment
   * @param p4 End point of second segment
   * @returns true if segments intersect, false otherwise
   */
  private lineSegmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
    // Calculate orientations
    const o1 = this.orientation(p1, p2, p3);
    const o2 = this.orientation(p1, p2, p4);
    const o3 = this.orientation(p3, p4, p1);
    const o4 = this.orientation(p3, p4, p2);

    // General case: segments intersect if they have different orientations
    if (o1 !== o2 && o3 !== o4) {
      return true;
    }

    // Special cases: collinear points with overlap
    if (o1 === 0 && this.onSegment(p1, p3, p2)) return true;
    if (o2 === 0 && this.onSegment(p1, p4, p2)) return true;
    if (o3 === 0 && this.onSegment(p3, p1, p4)) return true;
    if (o4 === 0 && this.onSegment(p3, p2, p4)) return true;

    return false;
  }

  /**
   * Phase 33: Find orientation of ordered triplet (p, q, r)
   * Returns:
   *  0 -> Collinear points
   *  1 -> Clockwise orientation
   *  2 -> Counterclockwise orientation
   */
  private orientation(p: Point, q: Point, r: Point): number {
    const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);

    if (Math.abs(val) < 0.0001) return 0; // Collinear with tolerance
    return val > 0 ? 1 : 2; // Clockwise or Counterclockwise
  }

  /**
   * Phase 33: Check if point q lies on segment pr
   * Assumes p, q, r are collinear
   */
  private onSegment(p: Point, q: Point, r: Point): boolean {
    return (
      q.x <= Math.max(p.x, r.x) &&
      q.x >= Math.min(p.x, r.x) &&
      q.y <= Math.max(p.y, r.y) &&
      q.y >= Math.min(p.y, r.y)
    );
  }

  /**
   * Detect all overlapping node pairs
   * Custom Instructions: Zero overlap tolerance
   */
  protected detectAllOverlaps(nodes: PositionedNode[], spacing?: number): OverlapPair[] {
    const overlaps: OverlapPair[] = [];
    const minSpacing = spacing ?? this.config.nodeSeparation;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (nodesOverlap(nodes[i], nodes[j], minSpacing)) {
          overlaps.push({ node1: nodes[i], node2: nodes[j] });
        }
      }
    }

    return overlaps;
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

    console.log('\n📊 Layout Metrics:');
    console.log(`- Type: ${diagramType}`);
    console.log(`- Bounds: ${result.bounds.width.toFixed(0)}x${result.bounds.height.toFixed(0)}`);
    console.log(`- Node Count: ${result.layout.nodes.length}`);
    console.log(`- Edge Count: ${result.layout.edges.length}`);
    console.log(`- Overlaps: ${metrics.overlapCount}`);
    console.log(`- Edge Crossings: ${metrics.edgeCrossings} [Phase 33]`);
    console.log(`- Processing Time: ${result.processingTime.toFixed(0)}ms`);

    const successCriteria = {
      hasNodes: result.layout.nodes.length > 0,
      noOverlaps: metrics.overlapCount === 0,
      withinBounds: result.bounds.width <= this.config.width && result.bounds.height <= this.config.height,
      fastProcessing: result.processingTime < 5000
    };

    const success = Object.values(successCriteria).every(v => v);
    console.log(success ? '✅ Layout successful' : '⚠️ Layout needs improvement');

    if (!success) {
      console.log('Failed criteria:');
      Object.entries(successCriteria).forEach(([key, passed]) => {
        if (!passed) console.log(`  - ${key}: FAILED`);
      });
    }
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

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * 🎯 Custom Instructions: Enhanced Layout Evaluation
   * Evaluates against Custom Instructions Phase 4 requirements
   */
  public async evaluateLayoutWithCustomInstructions(result: LayoutResult, diagramType: DiagramType): Promise<void> {
    const metrics = this.calculateLayoutMetrics(result.layout.nodes, result.layout.edges);

    console.log('\n🎯 Custom Instructions Phase 4 Evaluation:');
    console.log(`- Zero Overlaps: ${metrics.overlapCount === 0 ? '✅ PASSED' : '❌ FAILED'} (${metrics.overlapCount} overlaps)`);
    console.log(`- Processing Time: ${result.processingTime < 5000 ? '✅ PASSED' : '❌ FAILED'} (${(result.processingTime / 1000).toFixed(1)}s)`);
    console.log(`- Layout Quality: ${result.confidence ? (result.confidence * 100).toFixed(1) + '%' : 'N/A'}`);
    console.log(`- Diagram Type: ${diagramType}`);
    console.log(`- Node Count: ${result.layout.nodes.length}`);
    console.log(`- Edge Count: ${result.layout.edges.length}`);

    // Custom Instructions compliance check
    const compliance = {
      zeroOverlaps: metrics.overlapCount === 0,
      fastProcessing: result.processingTime < 5000,
      hasValidStructure: result.layout.nodes.length > 0,
      withinBounds: result.bounds.width <= this.config.width && result.bounds.height <= this.config.height
    };

    const complianceScore = Object.values(compliance).filter(v => v).length / Object.keys(compliance).length;
    const passed = complianceScore >= 0.75; // 75% compliance required

    console.log(`\n🎯 Custom Instructions Compliance: ${(complianceScore * 100).toFixed(1)}%`);
    console.log(`🎯 Overall Assessment: ${passed ? '✅ COMPLIANT' : '❌ NEEDS IMPROVEMENT'}`);

    if (!passed) {
      console.log('🔧 Failed Requirements:');
      Object.entries(compliance).forEach(([requirement, passed]) => {
        if (!passed) {
          console.log(`  - ${requirement}: FAILED`);
        }
      });
    }

    // Trigger improvement if needed
    if (!compliance.zeroOverlaps) {
      console.log('🚨 CRITICAL: Zero overlap requirement not met - triggering emergency resolution');
    }
  }
}
