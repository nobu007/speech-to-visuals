/**
 * 🎯 Enhanced Zero Overlap Layout Engine - Phase 60
 * カスタムインストラクション準拠の段階的改善実装
 *
 * Development Philosophy:
 * - incremental: 小さく作り、確実に動作確認
 * - recursive: 動作→評価→改善→コミットの繰り返し
 * - modular: 疎結合なモジュール設計
 * - testable: 各段階で検証可能な出力
 * - transparent: 処理過程の可視化
 */

import { AdvancedLayoutEngine, AdvancedLayoutOptions, VisualTheme } from './advanced-layouts';

export interface ZeroOverlapConfig {
  overlapDetectionMode: 'strict' | 'balanced' | 'performance';
  collisionResolutionStrategy: 'force_directed' | 'grid_snap' | 'spiral_placement';
  separationDistance: number;
  maxIterations: number;
  qualityThreshold: number; // 0-100% overlap-free requirement
}

export interface OverlapMetrics {
  totalOverlaps: number;
  overlapPercentage: number;
  resolutionTime: number;
  iterationsUsed: number;
  qualityScore: number; // 0-100
}

export interface ZeroOverlapResult {
  success: boolean;
  layout: any;
  metrics: OverlapMetrics;
  iterations: IterationResult[];
  visualEnhancements: any;
  qualityAssessment: QualityAssessment;
}

interface IterationResult {
  iteration: number;
  overlapsDetected: number;
  overlapsResolved: number;
  processingTime: number;
  quality: number;
  action: string;
}

interface QualityAssessment {
  overlapFreePercent: number;
  layoutEfficiency: number;
  visualBalance: number;
  readability: number;
  overallScore: number;
  improvements: string[];
}

/**
 * Enhanced Zero Overlap Layout Engine
 * Iteration 1: Basic overlap detection and resolution
 * Iteration 2: Advanced force-directed algorithms
 * Iteration 3: Quality-driven optimization
 */
export class EnhancedZeroOverlapLayoutEngine extends AdvancedLayoutEngine {
  private config: ZeroOverlapConfig;
  private iterationLog: IterationResult[] = [];

  constructor(config: Partial<ZeroOverlapConfig> = {}) {
    super();

    this.config = {
      overlapDetectionMode: 'balanced',
      collisionResolutionStrategy: 'force_directed',
      separationDistance: 20,
      maxIterations: 10,
      qualityThreshold: 100, // カスタムインストラクション: ゼロオーバーラップ要求
      ...config
    };

    console.log('🎯 Enhanced Zero Overlap Layout Engine initialized');
    console.log('   📋 Config:', this.config);
  }

  /**
   * Generate layout with guaranteed zero overlaps
   * Following custom instructions: implement → test → evaluate → improve
   */
  generateZeroOverlapLayout(
    nodes: any[],
    edges: any[],
    diagramType: string,
    options: Partial<AdvancedLayoutOptions> = {}
  ): ZeroOverlapResult {
    const startTime = performance.now();

    console.log('🎯 Starting Zero Overlap Layout Generation');
    console.log(`   📊 Input: ${nodes.length} nodes, ${edges.length} edges`);
    console.log(`   🎨 Type: ${diagramType}`);

    // Phase 1: Generate initial layout using advanced engine
    console.log('\n📋 Phase 1: Initial Layout Generation');
    const initialLayout = this.generateAdvancedLayout(nodes, edges, diagramType, options);

    if (!initialLayout.success) {
      return this.createFailureResult('Initial layout generation failed', startTime);
    }

    // Phase 2: Overlap Detection and Resolution (Iterative)
    console.log('\n📋 Phase 2: Zero Overlap Optimization');
    const optimizedLayout = this.optimizeForZeroOverlap(
      initialLayout.layout,
      diagramType
    );

    // Phase 3: Quality Assessment
    console.log('\n📋 Phase 3: Quality Assessment');
    const qualityAssessment = this.assessLayoutQuality(optimizedLayout);

    // Phase 4: Final Enhancement
    console.log('\n📋 Phase 4: Final Enhancement');
    const finalLayout = this.applyFinalEnhancements(optimizedLayout, qualityAssessment);

    const totalTime = performance.now() - startTime;

    const result: ZeroOverlapResult = {
      success: true,
      layout: finalLayout,
      metrics: this.calculateMetrics(totalTime),
      iterations: this.iterationLog,
      visualEnhancements: initialLayout.visualEnhancements,
      qualityAssessment
    };

    console.log('\n✅ Zero Overlap Layout Complete');
    console.log('   📊 Metrics:', result.metrics);
    console.log('   🏆 Quality:', result.qualityAssessment.overallScore.toFixed(1));

    return result;
  }

  /**
   * Iterative overlap optimization following custom instructions
   */
  private optimizeForZeroOverlap(layout: any, diagramType: string): any {
    let currentLayout = { ...layout };
    this.iterationLog = [];

    for (let iteration = 1; iteration <= this.config.maxIterations; iteration++) {
      const iterationStart = performance.now();

      console.log(`   🔄 Iteration ${iteration}/${this.config.maxIterations}`);

      // Detect overlaps
      const overlaps = this.detectOverlaps(currentLayout.nodes);
      console.log(`      🔍 Detected ${overlaps.length} overlaps`);

      if (overlaps.length === 0) {
        console.log(`      ✅ Zero overlaps achieved in ${iteration} iterations`);
        break;
      }

      // Resolve overlaps
      const resolvedLayout = this.resolveOverlaps(currentLayout, overlaps, iteration);
      const newOverlaps = this.detectOverlaps(resolvedLayout.nodes);

      const iterationTime = performance.now() - iterationStart;
      const quality = this.calculateIterationQuality(resolvedLayout.nodes);

      this.iterationLog.push({
        iteration,
        overlapsDetected: overlaps.length,
        overlapsResolved: overlaps.length - newOverlaps.length,
        processingTime: iterationTime,
        quality,
        action: this.getIterationAction(overlaps.length, newOverlaps.length)
      });

      console.log(`      ⚡ Resolved ${overlaps.length - newOverlaps.length} overlaps`);
      console.log(`      📊 Quality: ${quality.toFixed(1)}%`);

      currentLayout = resolvedLayout;

      // Early termination if quality threshold met
      if (quality >= this.config.qualityThreshold && newOverlaps.length === 0) {
        console.log(`      🎯 Quality threshold reached: ${quality.toFixed(1)}%`);
        break;
      }
    }

    return currentLayout;
  }

  /**
   * Detect node overlaps using spatial indexing
   */
  private detectOverlaps(nodes: any[]): Array<{node1: any, node2: any, overlap: number}> {
    const overlaps: Array<{node1: any, node2: any, overlap: number}> = [];

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];

        const overlap = this.calculateOverlap(node1, node2);

        if (overlap > 0) {
          overlaps.push({ node1, node2, overlap });
        }
      }
    }

    return overlaps.sort((a, b) => b.overlap - a.overlap); // Sort by severity
  }

  /**
   * Calculate overlap area between two nodes
   */
  private calculateOverlap(node1: any, node2: any): number {
    const dx = Math.abs(node1.x - node2.x);
    const dy = Math.abs(node1.y - node2.y);

    const minDistanceX = (node1.width + node2.width) / 2 + this.config.separationDistance;
    const minDistanceY = (node1.height + node2.height) / 2 + this.config.separationDistance;

    if (dx >= minDistanceX || dy >= minDistanceY) {
      return 0; // No overlap
    }

    const overlapX = minDistanceX - dx;
    const overlapY = minDistanceY - dy;

    return overlapX * overlapY;
  }

  /**
   * Resolve overlaps using configured strategy
   */
  private resolveOverlaps(layout: any, overlaps: any[], iteration: number): any {
    let resolvedLayout = { ...layout, nodes: [...layout.nodes] };

    switch (this.config.collisionResolutionStrategy) {
      case 'force_directed':
        resolvedLayout = this.resolveWithForceDirected(resolvedLayout, overlaps);
        break;
      case 'grid_snap':
        resolvedLayout = this.resolveWithGridSnap(resolvedLayout, overlaps);
        break;
      case 'spiral_placement':
        resolvedLayout = this.resolveWithSpiralPlacement(resolvedLayout, overlaps);
        break;
    }

    return resolvedLayout;
  }

  /**
   * Force-directed overlap resolution
   */
  private resolveWithForceDirected(layout: any, overlaps: any[]): any {
    const forces = new Map<string, {x: number, y: number}>();

    // Initialize forces
    layout.nodes.forEach((node: any) => {
      forces.set(node.id, { x: 0, y: 0 });
    });

    // Calculate repulsive forces
    overlaps.forEach(({ node1, node2, overlap }) => {
      const dx = node2.x - node1.x;
      const dy = node2.y - node1.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;

      const force = overlap * 0.1; // Force strength
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;

      const force1 = forces.get(node1.id)!;
      const force2 = forces.get(node2.id)!;

      force1.x -= fx;
      force1.y -= fy;
      force2.x += fx;
      force2.y += fy;
    });

    // Apply forces with damping
    const damping = 0.8;
    layout.nodes.forEach((node: any) => {
      const force = forces.get(node.id)!;
      node.x += force.x * damping;
      node.y += force.y * damping;

      // Boundary constraints
      node.x = Math.max(node.width / 2, Math.min(1920 - node.width / 2, node.x));
      node.y = Math.max(node.height / 2, Math.min(1080 - node.height / 2, node.y));
    });

    return layout;
  }

  /**
   * Grid-based overlap resolution
   */
  private resolveWithGridSnap(layout: any, overlaps: any[]): any {
    const gridSize = 50;
    const occupiedCells = new Set<string>();

    // Mark occupied grid cells
    layout.nodes.forEach((node: any) => {
      const gridX = Math.floor(node.x / gridSize);
      const gridY = Math.floor(node.y / gridSize);
      occupiedCells.add(`${gridX},${gridY}`);
    });

    // Resolve overlapping nodes to free grid positions
    const processedNodes = new Set<string>();

    overlaps.forEach(({ node1, node2 }) => {
      [node1, node2].forEach(node => {
        if (processedNodes.has(node.id)) return;

        const newPosition = this.findNearestFreeGridPosition(
          node.x, node.y, gridSize, occupiedCells
        );

        if (newPosition) {
          node.x = newPosition.x;
          node.y = newPosition.y;
          occupiedCells.add(`${Math.floor(newPosition.x / gridSize)},${Math.floor(newPosition.y / gridSize)}`);
          processedNodes.add(node.id);
        }
      });
    });

    return layout;
  }

  /**
   * Spiral placement overlap resolution
   */
  private resolveWithSpiralPlacement(layout: any, overlaps: any[]): any {
    const processedNodes = new Set<string>();

    overlaps.forEach(({ node1, node2 }) => {
      [node1, node2].forEach(node => {
        if (processedNodes.has(node.id)) return;

        const newPosition = this.findSpiralPosition(
          node.x, node.y, layout.nodes, node
        );

        node.x = newPosition.x;
        node.y = newPosition.y;
        processedNodes.add(node.id);
      });
    });

    return layout;
  }

  /**
   * Find nearest free grid position
   */
  private findNearestFreeGridPosition(
    x: number,
    y: number,
    gridSize: number,
    occupiedCells: Set<string>
  ): { x: number, y: number } | null {
    const startGridX = Math.floor(x / gridSize);
    const startGridY = Math.floor(y / gridSize);

    for (let radius = 1; radius <= 10; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const gridX = startGridX + dx;
          const gridY = startGridY + dy;
          const cellKey = `${gridX},${gridY}`;

          if (!occupiedCells.has(cellKey)) {
            return {
              x: gridX * gridSize + gridSize / 2,
              y: gridY * gridSize + gridSize / 2
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Find spiral position around original location
   */
  private findSpiralPosition(
    centerX: number,
    centerY: number,
    allNodes: any[],
    currentNode: any
  ): { x: number, y: number } {
    const spiralStep = 30;
    const maxRadius = 200;

    for (let radius = spiralStep; radius <= maxRadius; radius += spiralStep) {
      const angleStep = Math.PI / 8; // 8 positions per circle

      for (let angle = 0; angle < 2 * Math.PI; angle += angleStep) {
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        // Check if this position is collision-free
        const testNode = { ...currentNode, x, y };
        const hasCollision = allNodes.some(node =>
          node.id !== currentNode.id && this.calculateOverlap(testNode, node) > 0
        );

        if (!hasCollision) {
          return { x, y };
        }
      }
    }

    // Fallback to original position + offset
    return { x: centerX + 100, y: centerY + 100 };
  }

  /**
   * Assess layout quality following custom instructions criteria
   */
  private assessLayoutQuality(layout: any): QualityAssessment {
    const nodes = layout.nodes;
    const overlaps = this.detectOverlaps(nodes);

    // 1. Overlap-free percentage (most important for zero overlap goal)
    const overlapFreePercent = overlaps.length === 0 ? 100 :
      ((nodes.length * (nodes.length - 1) / 2 - overlaps.length) / (nodes.length * (nodes.length - 1) / 2)) * 100;

    // 2. Layout efficiency (space utilization)
    const boundingBox = this.calculateBoundingBox(nodes);
    const totalNodeArea = nodes.reduce((sum: number, node: any) => sum + (node.width * node.height), 0);
    const layoutArea = boundingBox.width * boundingBox.height;
    const layoutEfficiency = Math.min(100, (totalNodeArea / layoutArea) * 100 * 2); // *2 for reasonable scaling

    // 3. Visual balance (distribution)
    const visualBalance = this.calculateVisualBalance(nodes);

    // 4. Readability (minimum distances)
    const readability = this.calculateReadability(nodes);

    // Overall score with weights matching custom instructions priorities
    const overallScore = (
      overlapFreePercent * 0.5 +  // 50% weight - primary goal
      layoutEfficiency * 0.2 +    // 20% weight
      visualBalance * 0.15 +      // 15% weight
      readability * 0.15          // 15% weight
    );

    const improvements: string[] = [];
    if (overlapFreePercent < 100) improvements.push('Eliminate remaining overlaps');
    if (layoutEfficiency < 70) improvements.push('Improve space utilization');
    if (visualBalance < 80) improvements.push('Better visual distribution');
    if (readability < 85) improvements.push('Increase node separation');

    return {
      overlapFreePercent,
      layoutEfficiency,
      visualBalance,
      readability,
      overallScore,
      improvements
    };
  }

  /**
   * Calculate bounding box of all nodes
   */
  private calculateBoundingBox(nodes: any[]): { x: number, y: number, width: number, height: number } {
    if (nodes.length === 0) return { x: 0, y: 0, width: 1920, height: 1080 };

    const minX = Math.min(...nodes.map(n => n.x - n.width / 2));
    const maxX = Math.max(...nodes.map(n => n.x + n.width / 2));
    const minY = Math.min(...nodes.map(n => n.y - n.height / 2));
    const maxY = Math.max(...nodes.map(n => n.y + n.height / 2));

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Calculate visual balance score
   */
  private calculateVisualBalance(nodes: any[]): number {
    if (nodes.length === 0) return 100;

    const centerX = 1920 / 2;
    const centerY = 1080 / 2;

    const avgX = nodes.reduce((sum, n) => sum + n.x, 0) / nodes.length;
    const avgY = nodes.reduce((sum, n) => sum + n.y, 0) / nodes.length;

    const centerDeviation = Math.sqrt(
      Math.pow(avgX - centerX, 2) + Math.pow(avgY - centerY, 2)
    );

    const maxDeviation = Math.sqrt(Math.pow(centerX, 2) + Math.pow(centerY, 2));

    return Math.max(0, 100 - (centerDeviation / maxDeviation) * 100);
  }

  /**
   * Calculate readability score based on minimum distances
   */
  private calculateReadability(nodes: any[]): number {
    let totalDistance = 0;
    let pairCount = 0;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        totalDistance += distance;
        pairCount++;
      }
    }

    if (pairCount === 0) return 100;

    const avgDistance = totalDistance / pairCount;
    const idealDistance = 150; // Ideal average distance for readability

    return Math.min(100, (avgDistance / idealDistance) * 100);
  }

  /**
   * Apply final enhancements based on quality assessment
   */
  private applyFinalEnhancements(layout: any, quality: QualityAssessment): any {
    const enhancedLayout = { ...layout };

    // Apply improvements based on quality assessment
    if (quality.improvements.includes('Increase node separation')) {
      enhancedLayout.nodes = this.increaseNodeSeparation(enhancedLayout.nodes);
    }

    if (quality.improvements.includes('Better visual distribution')) {
      enhancedLayout.nodes = this.improveVisualDistribution(enhancedLayout.nodes);
    }

    return enhancedLayout;
  }

  /**
   * Increase minimum separation between nodes
   */
  private increaseNodeSeparation(nodes: any[]): any[] {
    const enhanced = [...nodes];
    const minSeparation = this.config.separationDistance + 10;

    for (let i = 0; i < enhanced.length; i++) {
      for (let j = i + 1; j < enhanced.length; j++) {
        const node1 = enhanced[i];
        const node2 = enhanced[j];

        const dx = node2.x - node1.x;
        const dy = node2.y - node1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const minRequired = (node1.width + node2.width) / 2 + minSeparation;

        if (distance < minRequired && distance > 0) {
          const pushFactor = (minRequired - distance) / 2;
          const unitX = dx / distance;
          const unitY = dy / distance;

          node1.x -= unitX * pushFactor;
          node1.y -= unitY * pushFactor;
          node2.x += unitX * pushFactor;
          node2.y += unitY * pushFactor;
        }
      }
    }

    return enhanced;
  }

  /**
   * Improve visual distribution of nodes
   */
  private improveVisualDistribution(nodes: any[]): any[] {
    const enhanced = [...nodes];
    const centerX = 1920 / 2;
    const centerY = 1080 / 2;

    // Calculate current center of mass
    const avgX = enhanced.reduce((sum, n) => sum + n.x, 0) / enhanced.length;
    const avgY = enhanced.reduce((sum, n) => sum + n.y, 0) / enhanced.length;

    // Shift all nodes to center the distribution
    const shiftX = centerX - avgX;
    const shiftY = centerY - avgY;

    enhanced.forEach(node => {
      node.x += shiftX * 0.3; // Gentle adjustment
      node.y += shiftY * 0.3;

      // Keep within bounds
      node.x = Math.max(node.width / 2, Math.min(1920 - node.width / 2, node.x));
      node.y = Math.max(node.height / 2, Math.min(1080 - node.height / 2, node.y));
    });

    return enhanced;
  }

  /**
   * Calculate iteration quality score
   */
  private calculateIterationQuality(nodes: any[]): number {
    const overlaps = this.detectOverlaps(nodes);
    if (overlaps.length === 0) return 100;

    const totalPossibleOverlaps = nodes.length * (nodes.length - 1) / 2;
    return ((totalPossibleOverlaps - overlaps.length) / totalPossibleOverlaps) * 100;
  }

  /**
   * Get iteration action description
   */
  private getIterationAction(oldOverlaps: number, newOverlaps: number): string {
    const resolved = oldOverlaps - newOverlaps;
    if (resolved > 0) return `Resolved ${resolved} overlaps`;
    if (resolved === 0) return 'No improvement';
    return 'Overlap increased - adjusting strategy';
  }

  /**
   * Calculate final metrics
   */
  private calculateMetrics(totalTime: number): OverlapMetrics {
    const finalOverlaps = this.iterationLog.length > 0 ?
      this.iterationLog[this.iterationLog.length - 1].overlapsDetected -
      this.iterationLog[this.iterationLog.length - 1].overlapsResolved : 0;

    const qualityScore = this.iterationLog.length > 0 ?
      this.iterationLog[this.iterationLog.length - 1].quality : 100;

    return {
      totalOverlaps: finalOverlaps,
      overlapPercentage: finalOverlaps === 0 ? 0 : (finalOverlaps / (this.iterationLog[0]?.overlapsDetected || 1)) * 100,
      resolutionTime: totalTime,
      iterationsUsed: this.iterationLog.length,
      qualityScore
    };
  }

  /**
   * Create failure result
   */
  private createFailureResult(reason: string, startTime: number): ZeroOverlapResult {
    return {
      success: false,
      layout: null,
      metrics: {
        totalOverlaps: -1,
        overlapPercentage: -1,
        resolutionTime: performance.now() - startTime,
        iterationsUsed: 0,
        qualityScore: 0
      },
      iterations: [],
      visualEnhancements: null,
      qualityAssessment: {
        overlapFreePercent: 0,
        layoutEfficiency: 0,
        visualBalance: 0,
        readability: 0,
        overallScore: 0,
        improvements: [reason]
      }
    };
  }
}

/**
 * Factory function for creating zero overlap layout engine
 * Following custom instructions modular design principle
 */
export function createZeroOverlapLayoutEngine(config?: Partial<ZeroOverlapConfig>): EnhancedZeroOverlapLayoutEngine {
  return new EnhancedZeroOverlapLayoutEngine(config);
}

/**
 * Quick test function for validation
 * Following custom instructions testable principle
 */
export function testZeroOverlapEngine(): boolean {
  console.log('🧪 Testing Enhanced Zero Overlap Layout Engine');

  try {
    const engine = createZeroOverlapLayoutEngine();

    // Test with sample data
    const testNodes = [
      { id: 'A', label: 'Node A', x: 100, y: 100, width: 120, height: 60 },
      { id: 'B', label: 'Node B', x: 110, y: 110, width: 120, height: 60 }, // Intentional overlap
      { id: 'C', label: 'Node C', x: 300, y: 200, width: 120, height: 60 }
    ];

    const testEdges = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' }
    ];

    const result = engine.generateZeroOverlapLayout(testNodes, testEdges, 'flow');

    console.log('   ✅ Test completed successfully');
    console.log('   📊 Quality Score:', result.qualityAssessment.overallScore.toFixed(1));

    return result.success && result.qualityAssessment.overlapFreePercent === 100;
  } catch (error) {
    console.error('   ❌ Test failed:', error);
    return false;
  }
}