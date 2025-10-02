/**
 * 🎨 Advanced Visualization Features
 * Enhanced diagram layouts and visual effects
 * Following iterative improvement philosophy
 */

export interface AdvancedLayoutOptions {
  theme: 'dark' | 'light' | 'auto';
  animationStyle: 'smooth' | 'bouncy' | 'minimal';
  colorScheme: 'professional' | 'vibrant' | 'monochrome';
  nodeShape: 'rectangle' | 'rounded' | 'circle' | 'hexagon';
  edgeStyle: 'straight' | 'curved' | 'orthogonal';
}

export interface VisualTheme {
  background: string;
  nodeColors: string[];
  edgeColor: string;
  textColor: string;
  accentColor: string;
}

/**
 * Advanced Layout Engine with Enhanced Visualizations
 * Iteration 1: Basic layout improvements
 * Iteration 2: Theme system
 * Iteration 3: Advanced animations
 */
export class AdvancedLayoutEngine {
  private themes: Map<string, VisualTheme> = new Map();
  private iteration = 1;

  constructor() {
    this.initializeThemes();
  }

  /**
   * Generate enhanced layout with advanced visual features
   */
  generateAdvancedLayout(
    nodes: any[],
    edges: any[],
    diagramType: string,
    options: Partial<AdvancedLayoutOptions> = {}
  ): {
    success: boolean;
    layout: any;
    visualEnhancements: any;
    performance: {
      layoutTime: number;
      optimizationLevel: number;
    };
  } {
    const startTime = performance.now();

    console.log(`🎨 Generating advanced ${diagramType} layout (Iteration ${this.iteration})`);

    const config = this.mergeOptions(options);
    const theme = this.getTheme(config.theme);

    // Apply diagram-specific optimizations
    const optimizedNodes = this.optimizeNodes(nodes, diagramType, config);
    const optimizedEdges = this.optimizeEdges(edges, diagramType, config);

    // Generate enhanced layout
    const layout = this.calculateAdvancedLayout(optimizedNodes, optimizedEdges, diagramType);

    // Add visual enhancements
    const visualEnhancements = this.generateVisualEnhancements(layout, theme, config);

    const endTime = performance.now();
    const layoutTime = endTime - startTime;

    console.log(`   ✨ Layout generated with ${this.getEnhancementCount(config)} enhancements`);
    console.log(`   ⏱️  Layout time: ${layoutTime.toFixed(1)}ms`);

    return {
      success: true,
      layout: {
        nodes: layout.nodes,
        edges: layout.edges,
        canvas: layout.canvas,
        theme: theme
      },
      visualEnhancements,
      performance: {
        layoutTime,
        optimizationLevel: this.getOptimizationLevel()
      }
    };
  }

  /**
   * Initialize predefined themes
   */
  private initializeThemes(): void {
    this.themes.set('dark', {
      background: '#0f0f23',
      nodeColors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
      edgeColor: '#6b7280',
      textColor: '#f9fafb',
      accentColor: '#06b6d4'
    });

    this.themes.set('light', {
      background: '#ffffff',
      nodeColors: ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed'],
      edgeColor: '#374151',
      textColor: '#111827',
      accentColor: '#0891b2'
    });

    this.themes.set('professional', {
      background: '#f8fafc',
      nodeColors: ['#1e40af', '#047857', '#b45309', '#b91c1c', '#6d28d9'],
      edgeColor: '#475569',
      textColor: '#0f172a',
      accentColor: '#0e7490'
    });

    this.themes.set('vibrant', {
      background: '#1a1a2e',
      nodeColors: ['#00d2ff', '#ff006e', '#fb8500', '#8ecae6', '#ffb3c6'],
      edgeColor: '#16213e',
      textColor: '#edf2f7',
      accentColor: '#219ebc'
    });
  }

  /**
   * Merge user options with defaults
   */
  private mergeOptions(options: Partial<AdvancedLayoutOptions>): AdvancedLayoutOptions {
    return {
      theme: options.theme || 'dark',
      animationStyle: options.animationStyle || 'smooth',
      colorScheme: options.colorScheme || 'professional',
      nodeShape: options.nodeShape || 'rounded',
      edgeStyle: options.edgeStyle || 'curved',
      ...options
    };
  }

  /**
   * Get theme by name or auto-detect
   */
  private getTheme(themeName: string): VisualTheme {
    if (themeName === 'auto') {
      // Auto-detect based on time or system preference
      const hour = new Date().getHours();
      themeName = (hour >= 6 && hour < 18) ? 'light' : 'dark';
    }

    return this.themes.get(themeName) || this.themes.get('dark')!;
  }

  /**
   * Optimize nodes based on diagram type and iteration learnings
   */
  private optimizeNodes(
    nodes: any[],
    diagramType: string,
    config: AdvancedLayoutOptions
  ): any[] {
    return nodes.map((node, index) => {
      const optimizedNode = { ...node };

      // Apply diagram-specific optimizations
      switch (diagramType) {
        case 'flow':
          optimizedNode.width = this.calculateOptimalNodeWidth(node.label, 'flow');
          optimizedNode.height = 60;
          break;
        case 'tree':
          optimizedNode.width = 100;
          optimizedNode.height = 50;
          break;
        case 'timeline':
          optimizedNode.width = 140;
          optimizedNode.height = 70;
          break;
        default:
          optimizedNode.width = 120;
          optimizedNode.height = 60;
      }

      // Apply shape optimizations
      optimizedNode.shape = config.nodeShape;
      optimizedNode.borderRadius = config.nodeShape === 'rounded' ? 8 : 0;

      // Add visual properties
      optimizedNode.gradient = this.iteration >= 2;
      optimizedNode.shadow = this.iteration >= 3;
      optimizedNode.animation = this.getNodeAnimation(config.animationStyle);

      return optimizedNode;
    });
  }

  /**
   * Optimize edges based on diagram type
   */
  private optimizeEdges(
    edges: any[],
    diagramType: string,
    config: AdvancedLayoutOptions
  ): any[] {
    return edges.map(edge => {
      const optimizedEdge = { ...edge };

      // Apply edge style optimizations
      optimizedEdge.style = config.edgeStyle;
      optimizedEdge.animated = this.iteration >= 2;
      optimizedEdge.thickness = this.calculateEdgeThickness(diagramType);

      // Add arrow optimizations
      optimizedEdge.arrowHead = this.getArrowStyle(diagramType);

      return optimizedEdge;
    });
  }

  /**
   * Calculate advanced layout positions
   */
  private calculateAdvancedLayout(
    nodes: any[],
    edges: any[],
    diagramType: string
  ): { nodes: any[]; edges: any[]; canvas: any } {
    let layoutNodes: any[];
    let layoutEdges: any[];

    switch (diagramType) {
      case 'flow':
        ({ nodes: layoutNodes, edges: layoutEdges } = this.calculateFlowLayout(nodes, edges));
        break;
      case 'tree':
        ({ nodes: layoutNodes, edges: layoutEdges } = this.calculateTreeLayout(nodes, edges));
        break;
      case 'timeline':
        ({ nodes: layoutNodes, edges: layoutEdges } = this.calculateTimelineLayout(nodes, edges));
        break;
      case 'cycle':
        ({ nodes: layoutNodes, edges: layoutEdges } = this.calculateCycleLayout(nodes, edges));
        break;
      default:
        ({ nodes: layoutNodes, edges: layoutEdges } = this.calculateGridLayout(nodes, edges));
    }

    return {
      nodes: layoutNodes,
      edges: layoutEdges,
      canvas: { width: 1920, height: 1080 }
    };
  }

  /**
   * Flow diagram layout with improved spacing
   */
  private calculateFlowLayout(nodes: any[], edges: any[]): { nodes: any[]; edges: any[] } {
    const layoutNodes = nodes.map((node, index) => ({
      ...node,
      x: 200 + (index % 3) * 300,
      y: 200 + Math.floor(index / 3) * 200
    }));

    const layoutEdges = edges.map(edge => ({
      ...edge,
      points: this.calculateBezierCurve(
        this.findNodePosition(edge.from, layoutNodes),
        this.findNodePosition(edge.to, layoutNodes)
      )
    }));

    return { nodes: layoutNodes, edges: layoutEdges };
  }

  /**
   * Tree diagram layout with improved hierarchy
   */
  private calculateTreeLayout(nodes: any[], edges: any[]): { nodes: any[]; edges: any[] } {
    const levels = this.calculateTreeLevels(nodes, edges);
    const layoutNodes = nodes.map(node => {
      const level = levels.get(node.id) || 0;
      const nodesAtLevel = Array.from(levels.values()).filter(l => l === level).length;
      const indexAtLevel = Array.from(levels.entries())
        .filter(([id, l]) => l === level)
        .findIndex(([id]) => id === node.id);

      return {
        ...node,
        x: 960 - (nodesAtLevel * 120) / 2 + indexAtLevel * 120,
        y: 150 + level * 150
      };
    });

    const layoutEdges = edges.map(edge => ({
      ...edge,
      points: this.calculateTreeEdgePath(
        this.findNodePosition(edge.from, layoutNodes),
        this.findNodePosition(edge.to, layoutNodes)
      )
    }));

    return { nodes: layoutNodes, edges: layoutEdges };
  }

  /**
   * Timeline layout with chronological positioning
   */
  private calculateTimelineLayout(nodes: any[], edges: any[]): { nodes: any[]; edges: any[] } {
    const layoutNodes = nodes.map((node, index) => ({
      ...node,
      x: 200 + index * 200,
      y: 400 + (index % 2) * 100 // Alternating heights
    }));

    const layoutEdges = edges.map(edge => ({
      ...edge,
      points: [
        this.findNodePosition(edge.from, layoutNodes),
        this.findNodePosition(edge.to, layoutNodes)
      ]
    }));

    return { nodes: layoutNodes, edges: layoutEdges };
  }

  /**
   * Cycle layout with circular positioning
   */
  private calculateCycleLayout(nodes: any[], edges: any[]): { nodes: any[]; edges: any[] } {
    const centerX = 960;
    const centerY = 540;
    const radius = 250;

    const layoutNodes = nodes.map((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length;
      return {
        ...node,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    });

    const layoutEdges = edges.map(edge => ({
      ...edge,
      points: this.calculateCurvedPath(
        this.findNodePosition(edge.from, layoutNodes),
        this.findNodePosition(edge.to, layoutNodes),
        { centerX, centerY }
      )
    }));

    return { nodes: layoutNodes, edges: layoutEdges };
  }

  /**
   * Grid layout for matrix-style diagrams
   */
  private calculateGridLayout(nodes: any[], edges: any[]): { nodes: any[]; edges: any[] } {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const rows = Math.ceil(nodes.length / cols);

    const layoutNodes = nodes.map((node, index) => ({
      ...node,
      x: 200 + (index % cols) * 200,
      y: 200 + Math.floor(index / cols) * 150
    }));

    const layoutEdges = edges.map(edge => ({
      ...edge,
      points: [
        this.findNodePosition(edge.from, layoutNodes),
        this.findNodePosition(edge.to, layoutNodes)
      ]
    }));

    return { nodes: layoutNodes, edges: layoutEdges };
  }

  /**
   * Generate visual enhancements
   */
  private generateVisualEnhancements(
    layout: any,
    theme: VisualTheme,
    config: AdvancedLayoutOptions
  ): any {
    return {
      theme: theme,
      animations: this.generateAnimations(config.animationStyle),
      effects: this.generateVisualEffects(),
      transitions: this.generateTransitions(),
      interactions: this.generateInteractions()
    };
  }

  private generateAnimations(style: string): any {
    const animations = {
      nodeEntrance: { duration: 800, easing: 'easeOutCubic' },
      edgeDrawing: { duration: 1200, easing: 'easeInOutQuad' },
      textFadeIn: { duration: 600, delay: 400 }
    };

    switch (style) {
      case 'bouncy':
        animations.nodeEntrance.easing = 'easeOutBounce';
        break;
      case 'minimal':
        animations.nodeEntrance.duration = 400;
        animations.edgeDrawing.duration = 600;
        break;
    }

    return animations;
  }

  private generateVisualEffects(): any {
    return {
      nodeGlow: this.iteration >= 3,
      edgePulse: this.iteration >= 2,
      shadowDepth: this.iteration >= 3 ? 3 : 1,
      gradientNodes: this.iteration >= 2
    };
  }

  private generateTransitions(): any {
    return {
      sceneTransition: 'fade',
      nodeTransition: 'scale',
      edgeTransition: 'draw'
    };
  }

  private generateInteractions(): any {
    return {
      nodeHover: true,
      clickHighlight: true,
      zoomableCanvas: this.iteration >= 4
    };
  }

  // Helper methods
  private calculateOptimalNodeWidth(text: string, diagramType: string): number {
    const baseWidth = Math.max(100, text.length * 8 + 40);
    const typeMultiplier = diagramType === 'timeline' ? 1.2 : 1;
    return Math.min(200, baseWidth * typeMultiplier);
  }

  private calculateEdgeThickness(diagramType: string): number {
    switch (diagramType) {
      case 'flow': return 2;
      case 'tree': return 1.5;
      case 'timeline': return 3;
      default: return 2;
    }
  }

  private getArrowStyle(diagramType: string): string {
    switch (diagramType) {
      case 'flow': return 'standard';
      case 'tree': return 'minimal';
      case 'timeline': return 'bold';
      default: return 'standard';
    }
  }

  private getNodeAnimation(style: string): any {
    return {
      entrance: style,
      duration: style === 'minimal' ? 300 : 600
    };
  }

  private getEnhancementCount(config: AdvancedLayoutOptions): number {
    let count = 0;
    if (config.theme !== 'light') count++;
    if (config.animationStyle !== 'minimal') count++;
    if (config.nodeShape !== 'rectangle') count++;
    if (config.edgeStyle !== 'straight') count++;
    return count + this.iteration;
  }

  private getOptimizationLevel(): number {
    return Math.min(100, 60 + (this.iteration * 10));
  }

  private findNodePosition(nodeId: string, nodes: any[]): { x: number; y: number } {
    const node = nodes.find(n => n.id === nodeId || n.label === nodeId);
    return node ? { x: node.x, y: node.y } : { x: 0, y: 0 };
  }

  private calculateBezierCurve(from: any, to: any): any[] {
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    return [
      from,
      { x: midX, y: from.y },
      { x: midX, y: to.y },
      to
    ];
  }

  private calculateTreeLevels(nodes: any[], edges: any[]): Map<string, number> {
    const levels = new Map<string, number>();
    const processed = new Set<string>();

    // Find root nodes (no incoming edges)
    const hasIncoming = new Set(edges.map(e => e.to));
    const roots = nodes.filter(n => !hasIncoming.has(n.id));

    // BFS to assign levels
    const queue = roots.map(r => ({ id: r.id, level: 0 }));

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      if (processed.has(id)) continue;

      levels.set(id, level);
      processed.add(id);

      // Add children
      edges.filter(e => e.from === id).forEach(e => {
        if (!processed.has(e.to)) {
          queue.push({ id: e.to, level: level + 1 });
        }
      });
    }

    return levels;
  }

  private calculateTreeEdgePath(from: any, to: any): any[] {
    return [
      from,
      { x: from.x, y: (from.y + to.y) / 2 },
      { x: to.x, y: (from.y + to.y) / 2 },
      to
    ];
  }

  private calculateCurvedPath(from: any, to: any, center: any): any[] {
    const controlX = center.centerX;
    const controlY = center.centerY;
    return [
      from,
      { x: controlX, y: controlY },
      to
    ];
  }

  /**
   * Move to next iteration with improvements
   */
  public nextIteration(): void {
    this.iteration++;
    console.log(`🎨 Advanced Layout Engine: Moving to iteration ${this.iteration}`);
  }
}