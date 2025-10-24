import { NodeDatum, EdgeDatum, PositionedNode, LayoutEdge, DiagramLayout } from '@/types/diagram';
import { BoundingBox, LayoutConfig, LayoutResult, LayoutMetrics, OverlapPair } from '../../types';

export interface LayoutStrategy {
  /**
   * Unique name of the strategy for identification and debugging
   */
  readonly name: string;

  /**
   * Whether this strategy can escape local minima in the layout
   */
  readonly canEscapeLocalMinimum: boolean;

  /**
   * Applies the layout strategy to the given nodes and edges
   * @param nodes Array of nodes to be laid out
   * @param edges Array of edges connecting the nodes
   * @param config Layout configuration parameters
   * @param existingLayout Optional existing layout to improve upon
   */
  apply(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    config: LayoutConfig,
    existingLayout?: DiagramLayout
  ): Promise<LayoutResult>;

  /**
   * Estimates the computational complexity of applying this strategy
   * @param nodeCount Number of nodes in the diagram
   * @param edgeCount Number of edges in the diagram
   * @returns Estimated complexity score (higher is more complex)
   */
  estimateComplexity(nodeCount: number, edgeCount: number): number;

  /**
   * Calculates layout metrics for the current node positions
   * @param nodes Array of positioned nodes
   * @param edges Array of layout edges
   */
  calculateMetrics(nodes: PositionedNode[], edges: LayoutEdge[]): LayoutMetrics;

  /**
   * Detects and returns all overlapping node pairs
   * @param nodes Array of positioned nodes
   * @param padding Additional padding to consider around nodes
   */
  detectOverlaps(nodes: PositionedNode[], padding: number): OverlapPair[];

  /**
   * Calculates the bounding box that contains all nodes
   * @param nodes Array of positioned nodes
   */
  calculateBoundingBox(nodes: PositionedNode[]): BoundingBox;

  /**
   * Gets the recommended configuration for a specific diagram type
   * @param diagramType Type of the diagram
   */
  getDefaultConfig(diagramType: string): Partial<LayoutConfig>;
}

/**
 * Base abstract class that implements common functionality for all layout strategies
 */
export abstract class BaseLayoutStrategy implements LayoutStrategy {
  abstract readonly name: string;
  abstract readonly canEscapeLocalMinimum: boolean;
  
  async apply(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    config: LayoutConfig,
    existingLayout?: DiagramLayout
  ): Promise<LayoutResult> {
    const startTime = performance.now();
    
    try {
      // Convert NodeDatum to PositionedNode if not already positioned
      const positionedNodes: PositionedNode[] = nodes.map(node => 
        this.ensurePositionedNode(node, config)
      );
      
      // Convert EdgeDatum to LayoutEdge
      const layoutEdges: LayoutEdge[] = edges.map(edge => ({
        id: edge.id,
        // ensure required from/to while mirroring source/target
        from: (edge as any).from ?? edge.source!,
        to: (edge as any).to ?? edge.target!,
        source: edge.source ?? (edge as any).from,
        target: edge.target ?? (edge as any).to,
        label: (edge as any).label,
        type: (edge as any).type,
        points: []
      }));
      
      // Apply the specific layout algorithm
      const result = await this.performLayout(
        positionedNodes,
        layoutEdges,
        config,
        existingLayout
      );
      
      // Calculate metrics
      const metrics = this.calculateMetrics(result.nodes, result.edges);
      const bounds = this.calculateBoundingBox(result.nodes);
      
      return {
        layout: {
          nodes: result.nodes,
          edges: result.edges
        },
        bounds: {
          width: bounds.width,
          height: bounds.height,
          minX: bounds.minX,
          minY: bounds.minY,
          maxX: bounds.maxX,
          maxY: bounds.maxY,
        },
        processingTime: performance.now() - startTime,
        success: metrics.overlapCount === 0,
        metrics
      };
    } catch (error) {
      return {
        layout: {
          nodes: nodes.map(node => ({
            ...node,
            x: 0,
            y: 0,
            width: config.nodeWidth,
            height: config.nodeHeight
          })),
          edges: edges.map(edge => ({
            id: edge.id,
            from: (edge as any).from ?? edge.source!,
            to: (edge as any).to ?? edge.target!,
            source: edge.source ?? (edge as any).from,
            target: edge.target ?? (edge as any).to,
            label: (edge as any).label,
            type: (edge as any).type,
            points: []
          }))
        },
        bounds: { width: 0, height: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 },
        processingTime: performance.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
  
  /**
   * Abstract method that concrete strategies must implement
   */
  protected abstract performLayout(
    nodes: PositionedNode[],
    edges: LayoutEdge[],
    config: LayoutConfig,
    existingLayout?: DiagramLayout
  ): Promise<{ nodes: PositionedNode[]; edges: LayoutEdge[] }>;
  
  estimateComplexity(nodeCount: number, edgeCount: number): number {
    // Default implementation: O(n²) for overlap detection
    return nodeCount * nodeCount + edgeCount * 2;
  }
  
  calculateMetrics(nodes: PositionedNode[], edges: LayoutEdge[]): LayoutMetrics {
    const overlapPairs = this.detectOverlaps(nodes, 1); // 1px padding
    
    // Calculate total area covered by all nodes
    let totalArea = 0;
    for (const node of nodes) {
      totalArea += (node.width || 1) * (node.height || 1);
    }
    
    // Calculate node spacing (minimum distance between any two nodes)
    let minSpacing = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = Math.abs(nodes[i].x - nodes[j].x);
        const dy = Math.abs(nodes[i].y - nodes[j].y);
        const spacing = Math.sqrt(dx * dx + dy * dy);
        minSpacing = Math.min(minSpacing, spacing);
      }
    }
    
    // Calculate layout balance (how centered the layout is)
    const bounds = this.calculateBoundingBox(nodes);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const maxDist = Math.max(
      Math.sqrt(centerX * centerX + centerY * centerY),
      1
    );
    
    const balanceX = 1 - Math.min(Math.abs(centerX) / maxDist, 1);
    const balanceY = 1 - Math.min(Math.abs(centerY) / maxDist, 1);
    const layoutBalance = (balanceX + balanceY) / 2;
    
    // Count edge crossings (simplified approximation)
    let edgeCrossings = 0;
    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        const e1 = edges[i];
        const e2 = edges[j];
        
        const n1 = nodes.find(n => n.id === e1.source);
        const n2 = nodes.find(n => n.id === e1.target);
        const n3 = nodes.find(n => n.id === e2.source);
        const n4 = nodes.find(n => n.id === e2.target);
        
        if (n1 && n2 && n3 && n4) {
          if (this.doLinesIntersect(
            { x: n1.x, y: n1.y },
            { x: n2.x, y: n2.y },
            { x: n3.x, y: n3.y },
            { x: n4.x, y: n4.y }
          )) {
            edgeCrossings++;
          }
        }
      }
    }
    
    return {
      overlapCount: overlapPairs.length,
      edgeCrossings,
      totalArea,
      nodeSpacing: minSpacing,
      layoutBalance
    };
  }
  
  detectOverlaps(nodes: PositionedNode[], padding: number = 0): OverlapPair[] {
    const overlaps: OverlapPair[] = [];
    
    for (let i = 0; i < nodes.length; i++) {
      const node1 = nodes[i];
      
      for (let j = i + 1; j < nodes.length; j++) {
        const node2 = nodes[j];
        
        if (this.areNodesOverlapping(node1, node2, padding)) {
          overlaps.push({ node1, node2 });
        }
      }
    }
    
    return overlaps;
  }
  
  calculateBoundingBox(nodes: PositionedNode[]): BoundingBox {
    if (nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }
    
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    for (const node of nodes) {
      const halfWidth = (node.width || 0) / 2;
      const halfHeight = (node.height || 0) / 2;
      
      minX = Math.min(minX, node.x - halfWidth);
      minY = Math.min(minY, node.y - halfHeight);
      maxX = Math.max(maxX, node.x + halfWidth);
      maxY = Math.max(maxY, node.y + halfHeight);
    }
    
    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }
  
  getDefaultConfig(diagramType: string): Partial<LayoutConfig> {
    const baseConfig: Partial<LayoutConfig> = {
      nodeWidth: 150,
      nodeHeight: 60,
      marginX: 50,
      marginY: 50,
      nodeSeparation: 30,
      edgeSeparation: 10,
      rankSeparation: 50
    };
    
    switch (diagramType.toLowerCase()) {
      case 'flow':
        return {
          ...baseConfig,
          rankDirection: 'LR',
          nodeSeparation: 40,
          rankSeparation: 80
        };
        
      case 'tree':
        return {
          ...baseConfig,
          rankDirection: 'TB',
          nodeSeparation: 30,
          rankSeparation: 100
        };
        
      case 'timeline':
        return {
          ...baseConfig,
          rankDirection: 'LR',
          nodeSeparation: 20,
          rankSeparation: 120
        };
        
      case 'matrix':
        return {
          ...baseConfig,
          rankDirection: 'LR',
          nodeSeparation: 100,
          rankSeparation: 100
        };
        
      case 'cycle':
        return {
          ...baseConfig,
          rankDirection: 'LR',
          nodeSeparation: 40,
          rankSeparation: 40
        };
        
      default:
        return baseConfig;
    }
  }
  
  // Helper methods
  
  protected ensurePositionedNode(node: NodeDatum, config: LayoutConfig): PositionedNode {
    if ('x' in node && 'y' in node) {
      return node as PositionedNode;
    }
    
    return {
      ...node,
      x: 0,
      y: 0,
      width: config.nodeWidth,
      height: config.nodeHeight
    };
  }
  
  protected areNodesOverlapping(a: PositionedNode, b: PositionedNode, padding: number = 0): boolean {
    return !(
      a.x + a.width / 2 + padding < b.x - b.width / 2 ||
      a.x - a.width / 2 - padding > b.x + b.width / 2 ||
      a.y + a.height / 2 + padding < b.y - b.height / 2 ||
      a.y - a.height / 2 - padding > b.y + b.height / 2
    );
  }
  
  protected doLinesIntersect(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
    p4: { x: number; y: number }
  ): boolean {
    // Implementation of line segment intersection test
    const ccw = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) => {
      return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
    };
    
    return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && 
           ccw(p1, p2, p3) !== ccw(p1, p2, p4);
  }
}

export default LayoutStrategy;
