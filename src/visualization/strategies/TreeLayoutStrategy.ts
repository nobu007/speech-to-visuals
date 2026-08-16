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
import { logger } from '../../utils/logger';
import { VisualizationError } from '@/pipeline/pipeline-errors';
import { getNodeWidth, getNodeHeight, DEFAULT_NODE_HEIGHT } from '../node-dimensions';
import { strategyNodeWidth, validateStrategyInputs } from '../strategy-common';
import { buildWarnedAnchoredEdges } from '../strategy-edges';
import { DEFAULT_EDGE_SEPARATION, DEFAULT_MARGIN } from '../layout-spacing';

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

    try {
      // Step 1: Find root node (node with no incoming edges)
      const rootId = this.findRootNode(nodes, edges);

      // Step 2: Build tree structure
      const treeRoot = this.buildTree(rootId, nodes, edges, config);

      // Step 3: Calculate tree dimensions
      const { maxDepth, maxWidth } = this.calculateTreeDimensions(treeRoot);

      // Step 4: Position nodes in tree structure
      const positionedNodes = this.positionTreeNodes(treeRoot, config, maxDepth, maxWidth);

      // Step 5: Generate edges between positioned nodes
      const layoutEdges = this.generateTreeEdges(edges, positionedNodes);


      return {
        nodes: positionedNodes,
        edges: layoutEdges
      };

    } catch (error) {
      logger.error('[Tree] Layout generation failed:', error);
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
      if (nodes.length === 0) {
        logger.warn('[Tree] No nodes available to find root');
        return '';
      }
      logger.warn('[Tree] No root found, using first node');
      return nodes[0].id;
    }

    return rootCandidates[0].id;
  }

  /**
   * Resolve effective node height, respecting explicit overrides.
   */
  private resolveNodeHeight(node: NodeDatum, config: LayoutConfig): number {
    const explicit = node.height ?? (node as NodeDatum & { h?: number }).h;
    if (typeof explicit === 'number' && isFinite(explicit) && explicit > 0) {
      return explicit;
    }
    return config.nodeHeight || DEFAULT_NODE_HEIGHT;
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
      logger.warn(`[Tree] Cycle detected at node ${nodeId}`);
      const node = nodes.find(n => n.id === nodeId)!;
      return {
        id: nodeId,
        node,
        children: [],
        level,
        width: this.calculateNodeWidth(node, config),
        height: this.resolveNodeHeight(node, config)
      };
    }

    visited.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (!node) {
      throw new VisualizationError(`Node ${nodeId} not found`);
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
      height: this.resolveNodeHeight(node, config)
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
        x = parentX + (node.width - childrenWidth) / 2;
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
        h: node.height,
        width: node.width,
        height: node.height
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
    // Round 33 single-source — warn-on-dangling skeleton in strategy-edges.ts.
    // Tree-specific geometry: straight line from the source's center-bottom
    // to the target's center-top.
    return buildWarnedAnchoredEdges(
      edges,
      nodes,
      (source, target) => [
        {
          x: source.x + getNodeWidth(source) / 2,
          y: source.y + getNodeHeight(source)  // Bottom of source
        },
        {
          x: target.x + getNodeWidth(target) / 2,
          y: target.y  // Top of target
        }
      ],
      '[Tree] '
    );
  }

  /**
   * Calculate node width based on label.
   * Respects explicit node.width override from NodeDatum when present.
   */
  private calculateNodeWidth(node: NodeDatum, config: LayoutConfig): number {
    // Round 31 single-source — Tree's explicit-dimension-first preamble
    // became the family-wide shape in strategy-common.ts.
    return strategyNodeWidth(node, config);
  }

  /**
   * Validate inputs before layout generation
   */
  validateInputs(nodes: NodeDatum[], edges: EdgeDatum[]): boolean {
    // Round 31 single-source — log messages keep the '[Tree]' prefix.
    return validateStrategyInputs(nodes, edges, '[Tree]');
  }

  /**
   * Get tree-specific configuration defaults
   */
  getStrategyDefaults(): Partial<LayoutConfig> {
    return {
      rankDirection: 'TB',       // Top to bottom
      rankSeparation: 100,       // Larger vertical spacing for hierarchy
      nodeSeparation: 80,        // Horizontal spacing between siblings
      edgeSeparation: DEFAULT_EDGE_SEPARATION,
      marginX: DEFAULT_MARGIN,
      marginY: DEFAULT_MARGIN
    };
  }
}
