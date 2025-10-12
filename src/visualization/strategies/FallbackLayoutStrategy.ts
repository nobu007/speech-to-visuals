import { DiagramLayout, NodeDatum, EdgeDatum, PositionedNode, LayoutEdge, DiagramType } from '@/types/diagram';
import { LayoutConfig } from '../types';

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
    console.log(`Applying fallback ${diagramType} layout...`);

    // Different layout strategies based on diagram type
    switch (diagramType) {
      case 'flow':
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
      h: nodeHeight
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
        points: [
          { x: fromNode.x + fromNode.w / 2, y: fromNode.y + fromNode.h },
          { x: toNode.x + toNode.w / 2, y: toNode.y }
        ],
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
    const nodeHeight = 60;
    const spacing = (this.config.width - 2 * 50) / Math.max(1, nodes.length - 1);
    const y = (this.config.height - nodeHeight) / 2;

    const positionedNodes = nodes.map((node, index) => ({
      ...node,
      x: 50 + index * spacing - nodeWidth / 2,
      y: y,
      w: nodeWidth,
      h: nodeHeight
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
        points: [
          { x: fromNode.x + fromNode.w, y: fromNode.y + fromNode.h / 2 },
          { x: toNode.x, y: toNode.y + toNode.h / 2 }
        ],
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
    const nodeHeight = 60;

    const positionedNodes = nodes.map((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length;
      return {
        ...node,
        x: centerX + radius * Math.cos(angle) - nodeWidth / 2,
        y: centerY + radius * Math.sin(angle) - nodeHeight / 2,
        w: nodeWidth,
        h: nodeHeight
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
        points: [
          { x: fromNode.x + fromNode.w / 2, y: fromNode.y + fromNode.h / 2 },
          { x: toNode.x + toNode.w / 2, y: toNode.y + toNode.h / 2 }
        ],
        label: edge.label
      };
    });

    return { nodes: positionedNodes, edges: layoutEdges };
  }

  /**
   * Create a matrix layout (grid)
   */
  private createMatrixLayout(nodes: NodeDatum[], edges: EdgeDatum[]): DiagramLayout {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const nodeWidth = 140;
    const nodeHeight = 60;
    const spacingX = this.config.width / cols;
    const spacingY = this.config.height / Math.ceil(nodes.length / cols);

    const positionedNodes = nodes.map((node, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      return {
        ...node,
        x: col * spacingX + (spacingX - nodeWidth) / 2,
        y: row * spacingY + (spacingY - nodeHeight) / 2,
        w: nodeWidth,
        h: nodeHeight
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
        points: [
          { x: fromNode.x + fromNode.w / 2, y: fromNode.y + fromNode.h / 2 },
          { x: toNode.x + toNode.w / 2, y: toNode.y + toNode.h / 2 }
        ],
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
