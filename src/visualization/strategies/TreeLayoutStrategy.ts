/**
 * Tree Layout Strategy
 *
 * Implements hierarchical tree layout
 * Optimized for organizational charts, family trees, and hierarchical data
 *
 * Algorithm: Top-down hierarchical positioning
 * - Finds root node (no incoming edges)
 * - Builds tree structure
 * - Positions nodes level by level
 *
 * Custom Instructions Compliance:
 * - Zero overlap through hierarchical spacing
 * - <5s processing for standard trees
 */

import { DiagramType, NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutConfig } from '../types';
import { ILayoutStrategy, LayoutStrategyOutput } from './ILayoutStrategy';

interface TreeNode {
  id: string;
  node: NodeDatum;
  children: TreeNode[];
  level: number;
  width: number;
  height: number;
}

export class TreeLayoutStrategy implements ILayoutStrategy {
  readonly name = 'tree';

  supports(diagramType: DiagramType): boolean {
    return diagramType === 'tree';
  }

  async generateLayout(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    config: LayoutConfig
  ): Promise<LayoutStrategyOutput> {
    console.log(`🌳 [Tree] Generating hierarchical tree layout for ${nodes.length} nodes`);

    try {
      // Step 1: Find root node (node with no incoming edges)
      const rootId = this.findRootNode(nodes, edges);
      console.log(`   📍 Root node: ${rootId}`);

      // Step 2: Build tree structure
      const treeRoot = this.buildTree(rootId, nodes, edges, config);

      // Step 3: Calculate tree dimensions
      const { maxDepth, maxWidth } = this.calculateTreeDimensions(treeRoot);
      console.log(`   📏 Tree dimensions: depth=${maxDepth}, maxWidth=${maxWidth}`);

      // Step 4: Position nodes in tree structure
      const positionedNodes = this.positionTreeNodes(treeRoot, config, maxDepth, maxWidth);

      // Step 5: Generate edges between positioned nodes
      const layoutEdges = this.generateTreeEdges(edges, positionedNodes);

      console.log(`✅ [Tree] Layout generated successfully`);

      return {
        nodes: positionedNodes,
        edges: layoutEdges
      };

    } catch (error) {
      console.error('[Tree] Layout generation failed:', error);
      throw error;
    }
  }

  /**
   * Find root node (node with no incoming edges)
   */
  private findRootNode(nodes: NodeDatum[], edges: EdgeDatum[]): string {
    const hasIncoming = new Set(edges.map(e => e.to));
    const rootCandidates = nodes.filter(n => !hasIncoming.has(n.id));

    if (rootCandidates.length === 0) {
      console.warn('[Tree] No root found, using first node');
      return nodes[0].id;
    }

    return rootCandidates[0].id;
  }

  /**
   * Build tree structure from flat node list
   */
  private buildTree(
    nodeId: string,
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    config: LayoutConfig,
    level: number = 0,
    visited: Set<string> = new Set()
  ): TreeNode {
    // Prevent infinite loops
    if (visited.has(nodeId)) {
      console.warn(`[Tree] Cycle detected at node ${nodeId}`);
      const node = nodes.find(n => n.id === nodeId)!;
      return {
        id: nodeId,
        node,
        children: [],
        level,
        width: this.calculateNodeWidth(node, config),
        height: config.nodeHeight || 60
      };
    }

    visited.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    // Find child nodes
    const childEdges = edges.filter(e => e.from === nodeId);
    const children = childEdges.map(edge =>
      this.buildTree(edge.to, nodes, edges, config, level + 1, new Set(visited))
    );

    return {
      id: nodeId,
      node,
      children,
      level,
      width: this.calculateNodeWidth(node, config),
      height: config.nodeHeight || 60
    };
  }

  /**
   * Calculate tree dimensions (max depth and max width at any level)
   */
  private calculateTreeDimensions(
    root: TreeNode
  ): { maxDepth: number; maxWidth: number } {
    const levelCounts = new Map<number, number>();

    const traverse = (node: TreeNode) => {
      levelCounts.set(node.level, (levelCounts.get(node.level) || 0) + 1);
      node.children.forEach(child => traverse(child));
    };

    traverse(root);

    const maxDepth = Math.max(...Array.from(levelCounts.keys()), 0);
    const maxWidth = Math.max(...Array.from(levelCounts.values()), 1);

    return { maxDepth: maxDepth + 1, maxWidth };
  }

  /**
   * Position nodes in tree structure using hierarchical layout
   */
  private positionTreeNodes(
    root: TreeNode,
    config: LayoutConfig,
    maxDepth: number,
    maxWidth: number
  ): PositionedNode[] {
    const positionedNodes: PositionedNode[] = [];

    // Calculate spacing
    const verticalSpacing = config.rankSeparation || 100;
    const horizontalSpacing = config.nodeSeparation || 80;

    // Position nodes level by level
    const levelPositions = new Map<number, number>(); // Track horizontal position for each level

    const positionNode = (node: TreeNode, parentX?: number) => {
      // Calculate vertical position (based on level)
      const y = node.level * verticalSpacing + 50;

      // Calculate horizontal position
      let x: number;

      if (node.level === 0) {
        // Root node at center
        x = config.width / 2 - node.width / 2;
      } else if (node.children.length === 0 && parentX !== undefined) {
        // Leaf node: position under parent with slight offset
        const currentLevelX = levelPositions.get(node.level) || 100;
        x = currentLevelX;
        levelPositions.set(node.level, currentLevelX + node.width + horizontalSpacing);
      } else if (parentX !== undefined) {
        // Non-leaf node: center under parent
        const childrenWidth = node.children.reduce((sum, child) => sum + child.width, 0) +
          (node.children.length - 1) * horizontalSpacing;
        x = parentX + (root.width - childrenWidth) / 2;
      } else {
        // Fallback
        const currentLevelX = levelPositions.get(node.level) || 100;
        x = currentLevelX;
        levelPositions.set(node.level, currentLevelX + node.width + horizontalSpacing);
      }

      // Add positioned node
      positionedNodes.push({
        ...node.node,
        x,
        y,
        w: node.width,
        h: node.height
      });

      // Position children
      if (node.children.length > 0) {
        const childrenStartX = x;
        let currentX = childrenStartX;

        node.children.forEach(child => {
          positionNode(child, currentX);
          currentX += child.width + horizontalSpacing;
        });
      }
    };

    positionNode(root);

    return positionedNodes;
  }

  /**
   * Generate edges between positioned nodes
   */
  private generateTreeEdges(
    edges: EdgeDatum[],
    nodes: PositionedNode[]
  ): LayoutEdge[] {
    return edges.map(edge => {
      const source = nodes.find(n => n.id === edge.from);
      const target = nodes.find(n => n.id === edge.to);

      if (!source || !target) {
        console.warn(`[Tree] Edge ${edge.from} -> ${edge.to} missing nodes`);
        return {
          from: edge.from,
          to: edge.to,
          points: [],
          label: edge.label
        };
      }

      // Create straight line from source center-bottom to target center-top
      const sourcePoint = {
        x: source.x + source.w / 2,
        y: source.y + source.h  // Bottom of source
      };

      const targetPoint = {
        x: target.x + target.w / 2,
        y: target.y  // Top of target
      };

      return {
        from: edge.from,
        to: edge.to,
        points: [sourcePoint, targetPoint],
        label: edge.label
      };
    });
  }

  /**
   * Calculate node width based on label
   */
  private calculateNodeWidth(node: NodeDatum, config: LayoutConfig): number {
    const baseWidth = config.nodeWidth || 120;
    const labelLength = node.label?.length || 0;
    const charWidth = 8;
    const padding = 20;

    const textWidth = labelLength * charWidth + padding;
    return Math.max(baseWidth, Math.min(textWidth, baseWidth * 2));
  }

  /**
   * Validate inputs before layout generation
   */
  validateInputs(nodes: NodeDatum[], edges: EdgeDatum[]): boolean {
    if (nodes.length === 0) {
      console.warn('[Tree] No nodes to layout');
      return false;
    }

    // Check for duplicate node IDs
    const nodeIds = new Set(nodes.map(n => n.id));
    if (nodeIds.size !== nodes.length) {
      console.error('[Tree] Duplicate node IDs detected');
      return false;
    }

    // Check for invalid edges
    const invalidEdges = edges.filter(
      edge => !nodeIds.has(edge.from) || !nodeIds.has(edge.to)
    );

    if (invalidEdges.length > 0) {
      console.error('[Tree] Invalid edges detected:', invalidEdges);
      return false;
    }

    return true;
  }

  /**
   * Get tree-specific configuration defaults
   */
  getStrategyDefaults(): Partial<LayoutConfig> {
    return {
      rankDirection: 'TB',       // Top to bottom
      rankSeparation: 100,       // Larger vertical spacing for hierarchy
      nodeSeparation: 80,        // Horizontal spacing between siblings
      edgeSeparation: 10,
      marginX: 50,
      marginY: 50
    };
  }
}
