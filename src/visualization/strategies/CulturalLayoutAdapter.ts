import { DiagramLayout, PositionedNode, LayoutEdge } from '@/types/diagram';
import { ComplexLayoutConfig } from '../complex-layout-engine'; // Assuming this path is correct

export class CulturalLayoutAdapter {
  private config: ComplexLayoutConfig;

  constructor(config: ComplexLayoutConfig) {
    this.config = config;
  }

  /**
   * Apply cultural adaptations to layout based on language and preferences
   */
  async applyCulturalAdaptation(
    layout: DiagramLayout,
    culturalConfig: ComplexLayoutConfig['culturalAdaptation']
  ): Promise<DiagramLayout> {
    if (!culturalConfig) return layout;

    console.log(`🎨 Applying cultural adaptation for ${culturalConfig.languageCode}...`);

    let adaptedLayout = { ...layout };

    // Apply reading pattern adjustments
    if (culturalConfig.readingPattern === 'rtl') {
      adaptedLayout = await this.applyRTLLayout(adaptedLayout);
    } else if (culturalConfig.readingPattern === 'ttb') {
      adaptedLayout = await this.applyVerticalLayout(adaptedLayout);
    }

    // Apply hierarchy preferences
    if (culturalConfig.hierarchyPreference === 'strong') {
      adaptedLayout = await this.emphasizeHierarchy(adaptedLayout);
    } else if (culturalConfig.hierarchyPreference === 'flat') {
      adaptedLayout = await this.flattenHierarchy(adaptedLayout);
    }

    // Apply visual style adjustments
    adaptedLayout = await this.applyVisualStyle(adaptedLayout, culturalConfig.visualStyle);

    console.log(`✅ Cultural adaptation applied for ${culturalConfig.languageCode}`);
    return adaptedLayout;
  }

  /**
   * Apply right-to-left layout adjustments
   */
  private async applyRTLLayout(layout: DiagramLayout): Promise<DiagramLayout> {
    const bounds = this.calculateBounds(layout);
    const centerX = bounds.width / 2;

    const flippedNodes = layout.nodes.map(node => ({
      ...node,
      x: centerX + (centerX - node.x - node.w)
    }));

    const flippedEdges = layout.edges.map(edge => ({
      ...edge,
      points: edge.points.map(point => ({
        x: centerX + (centerX - point.x),
        y: point.y
      }))
    }));

    return { nodes: flippedNodes, edges: flippedEdges };
  }

  /**
   * Apply top-to-bottom (vertical) layout for CJK languages
   */
  private async applyVerticalLayout(layout: DiagramLayout): Promise<DiagramLayout> {
    // For TTB layouts, we might want to arrange nodes in columns
    const verticalSpacing = 80;
    const horizontalSpacing = 150;

    const sortedNodes = layout.nodes.sort((a, b) => a.y - b.y);
    const columns = 3; // Adjustable based on content

    const verticalNodes = sortedNodes.map((node, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);

      return {
        ...node,
        x: this.config.marginX + col * horizontalSpacing,
        y: this.config.marginY + row * verticalSpacing
      };
    });

    return { ...layout, nodes: verticalNodes };
  }

  /**
   * Emphasize hierarchical relationships
   */
  private async emphasizeHierarchy(layout: DiagramLayout): Promise<DiagramLayout> {
    // Increase vertical spacing to emphasize levels
    const hierarchyMultiplier = 1.5;

    const emphasized = layout.nodes.map(node => ({
      ...node,
      y: node.y * hierarchyMultiplier
    }));

    return { ...layout, nodes: emphasized };
  }

  /**
   * Flatten hierarchy for cultures preferring equality
   */
  private async flattenHierarchy(layout: DiagramLayout): Promise<DiagramLayout> {
    // Reduce vertical spacing and arrange more horizontally
    const flatteningFactor = 0.7;

    const flattened = layout.nodes.map(node => ({
      ...node,
      y: node.y * flatteningFactor
    }));

    return { ...layout, nodes: flattened };
  }

  /**
   * Apply visual style based on cultural preferences
   */
  private async applyVisualStyle(
    layout: DiagramLayout,
    style: 'minimalist' | 'expressive' | 'technical'
  ): Promise<DiagramLayout> {
    // This would affect spacing, sizing, and visual elements
    let spacingMultiplier = 1.0;
    let sizeMultiplier = 1.0;

    switch (style) {
      case 'minimalist':
        spacingMultiplier = 1.3; // More white space
        sizeMultiplier = 0.9;    // Smaller elements
        break;
      case 'expressive':
        spacingMultiplier = 1.1; // Moderate spacing
        sizeMultiplier = 1.1;    // Larger elements
        break;
      case 'technical':
        spacingMultiplier = 0.9; // Compact spacing
        sizeMultiplier = 1.0;    // Standard size
        break;
    }

    const styledNodes = layout.nodes.map(node => ({
      ...node,
      w: node.w * sizeMultiplier,
      h: node.h * sizeMultiplier
    }));

    return { ...layout, nodes: styledNodes };
  }

  private calculateBounds(layout: DiagramLayout) {
    if (layout.nodes.length === 0) {
      return { width: 0, height: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    const xs = layout.nodes.map(n => [n.x, n.x + n.w]).flat();
    const ys = layout.nodes.map(n => [n.y, n.y + n.h]).flat();

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return { width: maxX - minX, height: maxY - minY, minX, minY, maxX, maxY };
  }
}
