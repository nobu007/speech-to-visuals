import { DiagramLayout, NodeDatum, EdgeDatum, LayoutEdge, DiagramType } from '@/types/diagram';
import { LayoutConfig } from '../types';
import { DEFAULT_NODE_HEIGHT } from '../node-dimensions';
import { ringAngle, pointOnCircle, squareGridColumns, squareGridRows, centerInCell } from '../layout-utils';
import {
  centerToCenterAnchors,
  horizontalFlowAnchors,
  verticalFlowAnchors,
} from '../strategy-edges';

export class FallbackLayoutStrategy {
  private config: LayoutConfig;

  constructor(config: LayoutConfig) {
    this.config = config;
  }

  /**
   * Fallback layout implementation (manual positioning)
   */
  public fallbackLayout(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    diagramType: DiagramType
  ): DiagramLayout {

    // Different layout strategies based on diagram type.
    // 'flowchart' is a distinct canonical DiagramType but semantically a flow
    // diagram; without this case it fell through to createGridLayout, producing
    // a grid for a flowchart on the DagreLayoutStrategy failure-fallback path.
    switch (diagramType) {
      case 'flow':
      case 'flowchart':
        return this.createFlowLayout(nodes, edges);
      case 'tree':
        return this.createTreeLayout(nodes, edges);
      case 'timeline':
        return this.createTimelineLayout(nodes, edges);
      case 'cycle':
        return this.createCycleLayout(nodes, edges);
      case 'matrix':
        return this.createMatrixLayout(nodes, edges);
      default:
        return this.createGridLayout(nodes, edges);
    }
  }

  /**
   * Create a simple flow layout (top to bottom)
   */
  private createFlowLayout(nodes: NodeDatum[], edges: EdgeDatum[]): DiagramLayout {
    const nodeWidth = 200;
    const nodeHeight = 80;
    const spacing = 100;
    const startX = (this.config.width - nodeWidth) / 2;
    const startY = 100;

    const positionedNodes = nodes.map((node, index) => ({
      ...node,
      x: startX,
      y: startY + index * (nodeHeight + spacing),
      w: nodeWidth,
      h: nodeHeight,
      width: nodeWidth,
      height: nodeHeight
    }));

    const layoutEdges = edges.map(edge => {
      const fromNode = positionedNodes.find(n => n.id === edge.from);
      const toNode = positionedNodes.find(n => n.id === edge.to);

      if (!fromNode || !toNode) {
        return {
          from: edge.from,
          to: edge.to,
          points: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
          label: edge.label
        };
      }

      return {
        from: edge.from,
        to: edge.to,
        // Round 46 single-source — anchor geometry in strategy-edges.ts. The
        // skeleton (find lookup + zero-points dangling fallback) stays here.
        points: [...verticalFlowAnchors(fromNode, toNode)],
        label: edge.label
      };
    });

    return { nodes: positionedNodes, edges: layoutEdges };
  }

  /**
   * Create a simple tree layout (hierarchical)
   */
  private createTreeLayout(nodes: NodeDatum[], edges: EdgeDatum[]): DiagramLayout {
    return this.createFlowLayout(nodes, edges); // Simple fallback for now
  }

  /**
   * Create a timeline layout (horizontal progression)
   */
  private createTimelineLayout(nodes: NodeDatum[], edges: EdgeDatum[]): DiagramLayout {
    const nodeWidth = 160;
    const nodeHeight = DEFAULT_NODE_HEIGHT;
    const margin = 50;
    const spacing = nodes.length > 1 ? (this.config.width - 2 * margin) / (nodes.length - 1) : 0;
    const y = (this.config.height - nodeHeight) / 2;

    const positionedNodes = nodes.map((node, index) => ({
      ...node,
      x: nodes.length === 1
        ? (this.config.width - nodeWidth) / 2
        : margin + index * spacing - nodeWidth / 2,
      y: y,
      w: nodeWidth,
      h: nodeHeight,
      width: nodeWidth,
      height: nodeHeight
    }));

    const layoutEdges = edges.map(edge => {
      const fromNode = positionedNodes.find(n => n.id === edge.from);
      const toNode = positionedNodes.find(n => n.id === edge.to);

      if (!fromNode || !toNode) {
        return {
          from: edge.from,
          to: edge.to,
          points: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
          label: edge.label
        };
      }

      return {
        from: edge.from,
        to: edge.to,
        // Round 46 single-source — anchor geometry in strategy-edges.ts.
        points: [...horizontalFlowAnchors(fromNode, toNode)],
        label: edge.label
      };
    });

    return { nodes: positionedNodes, edges: layoutEdges };
  }

  /**
   * Create a cycle layout (circular)
   */
  private createCycleLayout(nodes: NodeDatum[], edges: EdgeDatum[]): DiagramLayout {
    const centerX = this.config.width / 2;
    const centerY = this.config.height / 2;
    const radius = Math.min(this.config.width, this.config.height) * 0.3;
    const nodeWidth = 140;
    const nodeHeight = DEFAULT_NODE_HEIGHT;

    const positionedNodes = nodes.map((node, index) => {
      // Round 48 single-source — ring step + circle point in layout-utils;
      // the `- nodeWidth / 2` top-left conversion stays here.
      const p = pointOnCircle(centerX, centerY, ringAngle(index, nodes.length), radius);
      return {
        ...node,
        x: p.x - nodeWidth / 2,
        y: p.y - nodeHeight / 2,
        w: nodeWidth,
        h: nodeHeight,
        width: nodeWidth,
        height: nodeHeight
      };
    });

    const layoutEdges = edges.map(edge => {
      const fromNode = positionedNodes.find(n => n.id === edge.from);
      const toNode = positionedNodes.find(n => n.id === edge.to);

      if (!fromNode || !toNode) {
        return {
          from: edge.from,
          to: edge.to,
          points: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
          label: edge.label
        };
      }

      return {
        from: edge.from,
        to: edge.to,
        // Round 46 single-source — anchor geometry in strategy-edges.ts.
        points: [...centerToCenterAnchors(fromNode, toNode)],
        label: edge.label
      };
    });

    return { nodes: positionedNodes, edges: layoutEdges };
  }

  /**
   * Create a matrix layout (grid)
   */
  private createMatrixLayout(nodes: NodeDatum[], edges: EdgeDatum[]): DiagramLayout {
    // Round 50 single source — square-grid packing + cell-centered stamp.
    const cols = squareGridColumns(nodes.length);
    const nodeWidth = 140;
    const nodeHeight = DEFAULT_NODE_HEIGHT;
    const spacingX = this.config.width / cols;
    const spacingY = this.config.height / squareGridRows(nodes.length, cols);

    const positionedNodes = nodes.map((node, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      return {
        ...node,
        x: centerInCell(col, spacingX, nodeWidth),
        y: centerInCell(row, spacingY, nodeHeight),
        w: nodeWidth,
        h: nodeHeight,
        width: nodeWidth,
        height: nodeHeight
      };
    });

    const layoutEdges = edges.map(edge => {
      const fromNode = positionedNodes.find(n => n.id === edge.from);
      const toNode = positionedNodes.find(n => n.id === edge.to);

      if (!fromNode || !toNode) {
        return {
          from: edge.from,
          to: edge.to,
          points: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
          label: edge.label
        };
      }

      return {
        from: edge.from,
        to: edge.to,
        // Round 46 single-source — anchor geometry in strategy-edges.ts.
        points: [...centerToCenterAnchors(fromNode, toNode)],
        label: edge.label
      };
    });

    return { nodes: positionedNodes, edges: layoutEdges };
  }

  /**
   * Create a simple grid layout (default fallback)
   */
  private createGridLayout(nodes: NodeDatum[], edges: EdgeDatum[]): DiagramLayout {
    return this.createMatrixLayout(nodes, edges);
  }
}
