/**
 * Simple Layout Engine for Diagrams
 * MVP implementation following custom instructions
 * 🔄 Focus: 確実に動作する最小実装
 */

import { DiagramType, SimpleNode, SimpleEdge } from '@/analysis/simple-diagram-detector';

export interface LayoutNode {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type?: string;
}

export interface LayoutEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  type?: 'flow' | 'conditional' | 'timeline';
  points?: Array<{ x: number; y: number }>;
}

export interface LayoutResult {
  success: boolean;
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
  error?: string;
}

export interface LayoutConfig {
  width: number;
  height: number;
  nodeWidth: number;
  nodeHeight: number;
  spacing: number;
  margin: number;
}

/**
 * Simple deterministic layout engine
 * MVP: Predictable layouts, no complex algorithms
 */
export class SimpleLayoutEngine {
  private config: LayoutConfig;

  constructor(config: Partial<LayoutConfig> = {}) {
    this.config = {
      width: 1920,
      height: 1080,
      nodeWidth: 160,
      nodeHeight: 80,
      spacing: 120,
      margin: 100,
      ...config
    };
  }

  /**
   * Generate layout based on diagram type
   * 🔄 Custom Instructions: タイプ別の最適化
   */
  async generateLayout(
    nodes: SimpleNode[],
    edges: SimpleEdge[],
    type: DiagramType
  ): Promise<LayoutResult> {
    console.log(`🎨 Generating ${type} layout for ${nodes.length} nodes...`);

    try {
      let layoutNodes: LayoutNode[];
      let layoutEdges: LayoutEdge[];

      switch (type) {
        case 'flow':
          ({ nodes: layoutNodes, edges: layoutEdges } = this.generateFlowLayout(nodes, edges));
          break;
        case 'tree':
          ({ nodes: layoutNodes, edges: layoutEdges } = this.generateTreeLayout(nodes, edges));
          break;
        case 'timeline':
          ({ nodes: layoutNodes, edges: layoutEdges } = this.generateTimelineLayout(nodes, edges));
          break;
        case 'cycle':
          ({ nodes: layoutNodes, edges: layoutEdges } = this.generateCycleLayout(nodes, edges));
          break;
        case 'network':
          ({ nodes: layoutNodes, edges: layoutEdges } = this.generateNetworkLayout(nodes, edges));
          break;
        default:
          ({ nodes: layoutNodes, edges: layoutEdges } = this.generateDefaultLayout(nodes, edges));
      }

      // Ensure all nodes are within bounds
      this.adjustToBounds(layoutNodes);

      console.log(`✅ Layout generated: ${layoutNodes.length} nodes positioned`);

      return {
        success: true,
        nodes: layoutNodes,
        edges: layoutEdges,
        width: this.config.width,
        height: this.config.height
      };

    } catch (error) {
      console.error('❌ Layout generation failed:', error);

      return {
        success: false,
        nodes: [],
        edges: [],
        width: this.config.width,
        height: this.config.height,
        error: error instanceof Error ? error.message : 'Layout generation failed'
      };
    }
  }

  /**
   * Generate flow chart layout (top to bottom)
   */
  private generateFlowLayout(nodes: SimpleNode[], edges: SimpleEdge[]): {
    nodes: LayoutNode[];
    edges: LayoutEdge[];
  } {
    const layoutNodes: LayoutNode[] = [];
    const centerX = this.config.width / 2;
    const startY = this.config.margin;

    // Arrange nodes vertically
    nodes.forEach((node, index) => {
      layoutNodes.push({
        id: node.id,
        label: node.label,
        x: centerX - this.config.nodeWidth / 2,
        y: startY + index * (this.config.nodeHeight + this.config.spacing),
        width: this.config.nodeWidth,
        height: this.config.nodeHeight,
        type: node.type
      });
    });

    // Generate straight line edges
    const layoutEdges = this.generateStraightEdges(layoutNodes, edges);

    return { nodes: layoutNodes, edges: layoutEdges };
  }

  /**
   * Generate tree layout (hierarchical)
   */
  private generateTreeLayout(nodes: SimpleNode[], edges: SimpleEdge[]): {
    nodes: LayoutNode[];
    edges: LayoutEdge[];
  } {
    const layoutNodes: LayoutNode[] = [];
    const levels = this.organizeLevels(nodes, edges);

    levels.forEach((levelNodes, levelIndex) => {
      const levelY = this.config.margin + levelIndex * (this.config.nodeHeight + this.config.spacing);
      const startX = (this.config.width - (levelNodes.length * (this.config.nodeWidth + this.config.spacing))) / 2;

      levelNodes.forEach((node, nodeIndex) => {
        layoutNodes.push({
          id: node.id,
          label: node.label,
          x: startX + nodeIndex * (this.config.nodeWidth + this.config.spacing),
          y: levelY,
          width: this.config.nodeWidth,
          height: this.config.nodeHeight,
          type: node.type
        });
      });
    });

    const layoutEdges = this.generateStraightEdges(layoutNodes, edges);

    return { nodes: layoutNodes, edges: layoutEdges };
  }

  /**
   * Generate timeline layout (horizontal)
   */
  private generateTimelineLayout(nodes: SimpleNode[], edges: SimpleEdge[]): {
    nodes: LayoutNode[];
    edges: LayoutEdge[];
  } {
    const layoutNodes: LayoutNode[] = [];
    const centerY = this.config.height / 2;
    const startX = this.config.margin;

    // Arrange nodes horizontally
    nodes.forEach((node, index) => {
      layoutNodes.push({
        id: node.id,
        label: node.label,
        x: startX + index * (this.config.nodeWidth + this.config.spacing),
        y: centerY - this.config.nodeHeight / 2,
        width: this.config.nodeWidth,
        height: this.config.nodeHeight,
        type: node.type
      });
    });

    const layoutEdges = this.generateStraightEdges(layoutNodes, edges);

    return { nodes: layoutNodes, edges: layoutEdges };
  }

  /**
   * Generate cycle layout (circular)
   */
  private generateCycleLayout(nodes: SimpleNode[], edges: SimpleEdge[]): {
    nodes: LayoutNode[];
    edges: LayoutEdge[];
  } {
    const layoutNodes: LayoutNode[] = [];
    const centerX = this.config.width / 2;
    const centerY = this.config.height / 2;
    const radius = Math.min(this.config.width, this.config.height) / 3;

    // Arrange nodes in a circle
    nodes.forEach((node, index) => {
      const angle = (index / nodes.length) * 2 * Math.PI - Math.PI / 2; // Start from top
      const x = centerX + Math.cos(angle) * radius - this.config.nodeWidth / 2;
      const y = centerY + Math.sin(angle) * radius - this.config.nodeHeight / 2;

      layoutNodes.push({
        id: node.id,
        label: node.label,
        x,
        y,
        width: this.config.nodeWidth,
        height: this.config.nodeHeight,
        type: node.type
      });
    });

    const layoutEdges = this.generateStraightEdges(layoutNodes, edges);

    return { nodes: layoutNodes, edges: layoutEdges };
  }

  /**
   * Generate network layout (distributed)
   */
  private generateNetworkLayout(nodes: SimpleNode[], edges: SimpleEdge[]): {
    nodes: LayoutNode[];
    edges: LayoutEdge[];
  } {
    const layoutNodes: LayoutNode[] = [];
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const rows = Math.ceil(nodes.length / cols);

    const cellWidth = (this.config.width - 2 * this.config.margin) / cols;
    const cellHeight = (this.config.height - 2 * this.config.margin) / rows;

    nodes.forEach((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      layoutNodes.push({
        id: node.id,
        label: node.label,
        x: this.config.margin + col * cellWidth + (cellWidth - this.config.nodeWidth) / 2,
        y: this.config.margin + row * cellHeight + (cellHeight - this.config.nodeHeight) / 2,
        width: this.config.nodeWidth,
        height: this.config.nodeHeight,
        type: node.type
      });
    });

    const layoutEdges = this.generateStraightEdges(layoutNodes, edges);

    return { nodes: layoutNodes, edges: layoutEdges };
  }

  /**
   * Generate default layout (grid)
   */
  private generateDefaultLayout(nodes: SimpleNode[], edges: SimpleEdge[]): {
    nodes: LayoutNode[];
    edges: LayoutEdge[];
  } {
    return this.generateNetworkLayout(nodes, edges);
  }

  /**
   * Organize nodes into hierarchical levels
   */
  private organizeLevels(nodes: SimpleNode[], edges: SimpleEdge[]): SimpleNode[][] {
    const levels: SimpleNode[][] = [];
    const processed = new Set<string>();

    // Find root nodes (no incoming edges)
    const hasIncoming = new Set(edges.map(e => e.to));
    const roots = nodes.filter(node => !hasIncoming.has(node.id));

    if (roots.length === 0) {
      // If no clear root, start with first node
      levels.push([nodes[0]]);
      processed.add(nodes[0].id);
    } else {
      levels.push(roots);
      roots.forEach(root => processed.add(root.id));
    }

    // Build levels based on edges
    let currentLevel = 0;
    while (processed.size < nodes.length && currentLevel < levels.length) {
      const nextLevel: SimpleNode[] = [];

      for (const edge of edges) {
        if (processed.has(edge.from) && !processed.has(edge.to)) {
          const targetNode = nodes.find(n => n.id === edge.to);
          if (targetNode && !nextLevel.find(n => n.id === targetNode.id)) {
            nextLevel.push(targetNode);
            processed.add(targetNode.id);
          }
        }
      }

      if (nextLevel.length > 0) {
        levels.push(nextLevel);
      } else {
        // Add remaining unprocessed nodes
        const remaining = nodes.filter(n => !processed.has(n.id));
        if (remaining.length > 0) {
          levels.push(remaining);
          remaining.forEach(n => processed.add(n.id));
        }
      }

      currentLevel++;
      if (currentLevel > 10) break; // Prevent infinite loop
    }

    return levels;
  }

  /**
   * Generate straight line edges between nodes
   */
  private generateStraightEdges(layoutNodes: LayoutNode[], edges: SimpleEdge[]): LayoutEdge[] {
    const layoutEdges: LayoutEdge[] = [];

    edges.forEach(edge => {
      const fromNode = layoutNodes.find(n => n.id === edge.from);
      const toNode = layoutNodes.find(n => n.id === edge.to);

      if (fromNode && toNode) {
        const fromCenterX = fromNode.x + fromNode.width / 2;
        const fromCenterY = fromNode.y + fromNode.height / 2;
        const toCenterX = toNode.x + toNode.width / 2;
        const toCenterY = toNode.y + toNode.height / 2;

        layoutEdges.push({
          id: edge.id,
          from: edge.from,
          to: edge.to,
          label: edge.label,
          type: edge.type,
          points: [
            { x: fromCenterX, y: fromCenterY },
            { x: toCenterX, y: toCenterY }
          ]
        });
      }
    });

    return layoutEdges;
  }

  /**
   * Adjust node positions to stay within bounds
   */
  private adjustToBounds(nodes: LayoutNode[]): void {
    nodes.forEach(node => {
      // Ensure nodes don't go outside the canvas
      node.x = Math.max(this.config.margin,
        Math.min(node.x, this.config.width - this.config.margin - node.width));
      node.y = Math.max(this.config.margin,
        Math.min(node.y, this.config.height - this.config.margin - node.height));
    });
  }

  /**
   * Update layout configuration
   */
  updateConfig(newConfig: Partial<LayoutConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get layout engine capabilities
   */
  getCapabilities() {
    return {
      supportedTypes: ['flow', 'tree', 'timeline', 'cycle', 'network'],
      layoutAlgorithms: ['vertical', 'horizontal', 'hierarchical', 'circular', 'grid'],
      features: [
        'Deterministic positioning',
        'Type-specific layouts',
        'Bounds checking',
        'Simple edge routing'
      ],
      config: this.config
    };
  }

  /**
   * Test layout engine
   * 🔄 Custom Instructions: テスト機能内蔵
   */
  async testLayoutEngine(): Promise<void> {
    console.log('🧪 Testing Simple Layout Engine...');

    const testNodes: SimpleNode[] = [
      { id: 'n1', label: 'ノード1' },
      { id: 'n2', label: 'ノード2' },
      { id: 'n3', label: 'ノード3' },
      { id: 'n4', label: 'ノード4' }
    ];

    const testEdges: SimpleEdge[] = [
      { id: 'e1', from: 'n1', to: 'n2' },
      { id: 'e2', from: 'n2', to: 'n3' },
      { id: 'e3', from: 'n3', to: 'n4' }
    ];

    const types: DiagramType[] = ['flow', 'tree', 'timeline', 'cycle', 'network'];

    for (const type of types) {
      const result = await this.generateLayout(testNodes, testEdges, type);
      const success = result.success && result.nodes.length === testNodes.length;
      console.log(`${success ? '✅' : '❌'} ${type} layout: ${result.nodes.length} nodes positioned`);
    }

    console.log('🧪 Layout engine testing completed');
  }
}

export const simpleLayoutEngine = new SimpleLayoutEngine();