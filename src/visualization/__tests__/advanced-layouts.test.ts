import { AdvancedLayoutEngine } from '../advanced-layouts';
import type { NodeDatum, EdgeDatum } from '@stv/core/types/diagram';

describe('AdvancedLayoutEngine', () => {
  let engine: AdvancedLayoutEngine;

  const sampleNodes: NodeDatum[] = [
    { id: 'n1', label: 'Start' },
    { id: 'n2', label: 'Process A' },
    { id: 'n3', label: 'End' },
  ];

  const sampleEdges: EdgeDatum[] = [
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
  ];

  beforeEach(() => {
    engine = new AdvancedLayoutEngine();
  });

  describe('generateAdvancedLayout', () => {
    it('should return success with layout data', () => {
      const result = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'flow');
      expect(result.success).toBe(true);
      expect(result.layout).toBeDefined();
      expect(result.layout.nodes).toHaveLength(3);
      expect(result.layout.edges).toHaveLength(2);
    });

    it('should return performance metrics', () => {
      const result = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'flow');
      expect(result.performance).toBeDefined();
      expect(result.performance.layoutTime).toBeGreaterThanOrEqual(0);
      expect(result.performance.optimizationLevel).toBeGreaterThanOrEqual(60);
      expect(result.performance.optimizationLevel).toBeLessThanOrEqual(100);
    });

    it('should handle empty nodes and edges', () => {
      const result = engine.generateAdvancedLayout([], [], 'flow');
      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(0);
      expect(result.layout.edges).toHaveLength(0);
    });

    it('should use dark theme by default', () => {
      const result = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'flow');
      expect(result.layout.theme.background).toBe('#0f0f23');
      expect(result.layout.theme.textColor).toBe('#f9fafb');
    });

    it('should use light theme when specified', () => {
      const result = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'flow', {
        theme: 'light',
      });
      expect(result.layout.theme.background).toBe('#ffffff');
      expect(result.layout.theme.textColor).toBe('#111827');
    });

    it('should NOT override defaults with undefined when options contain undefined fields', () => {
      // This tests the mergeOptions bug fix: spreading ...options with undefined values
      // used to override the computed defaults
      const result = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'flow', {
        theme: undefined,
        animationStyle: undefined,
      });
      // Should fall back to 'dark' theme, not undefined
      expect(result.layout.theme.background).toBe('#0f0f23');
      expect(result.visualEnhancements.animations.nodeEntrance.duration).toBe(800);
    });

    it('should apply animation style options correctly', () => {
      const bouncyResult = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'flow', {
        animationStyle: 'bouncy',
      });
      expect(bouncyResult.visualEnhancements.animations.nodeEntrance.easing).toBe('easeOutBounce');

      const minimalResult = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'flow', {
        animationStyle: 'minimal',
      });
      expect(minimalResult.visualEnhancements.animations.nodeEntrance.duration).toBe(400);
      expect(minimalResult.visualEnhancements.animations.edgeDrawing.duration).toBe(600);
    });

    it('should apply node shape options to all nodes', () => {
      const result = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'flow', {
        nodeShape: 'circle',
      });
      result.layout.nodes.forEach(node => {
        expect(node.shape).toBe('circle');
        expect(node.borderRadius).toBe(0);
      });
    });

    it('should apply rounded shape with border radius', () => {
      const result = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'flow', {
        nodeShape: 'rounded',
      });
      result.layout.nodes.forEach(node => {
        expect(node.shape).toBe('rounded');
        expect(node.borderRadius).toBe(8);
      });
    });

    it('should set canvas dimensions to 1920x1080', () => {
      const result = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'flow');
      expect(result.layout.canvas.width).toBe(1920);
      expect(result.layout.canvas.height).toBe(1080);
    });
  });

  describe('layout types', () => {
    it('should position nodes in flow layout', () => {
      const result = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'flow');
      // Flow layout: x starts at 200, increments by 300 per column (3 cols)
      expect(result.layout.nodes[0].x).toBe(200);
      expect(result.layout.nodes[1].x).toBe(500);
      expect(result.layout.nodes[0].y).toBe(200);
    });

    it('should position nodes in tree layout with levels', () => {
      const result = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'tree');
      // Root node (n1) at level 0, n2 at level 1, n3 at level 2
      const n1 = result.layout.nodes.find(n => n.id === 'n1')!;
      const n2 = result.layout.nodes.find(n => n.id === 'n2')!;
      const n3 = result.layout.nodes.find(n => n.id === 'n3')!;
      expect(n1.y).toBeLessThan(n2.y);
      expect(n2.y).toBeLessThan(n3.y);
    });

    it('should position nodes in timeline layout horizontally', () => {
      const result = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'timeline');
      // Timeline: x increments by 200
      expect(result.layout.nodes[0].x).toBe(200);
      expect(result.layout.nodes[1].x).toBe(400);
      expect(result.layout.nodes[2].x).toBe(600);
    });

    it('should position nodes in cycle layout circularly', () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
        { id: 'd', label: 'D' },
      ];
      const edges: EdgeDatum[] = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'd' },
        { from: 'd', to: 'a' },
      ];
      const result = engine.generateAdvancedLayout(nodes, edges, 'cycle');
      // All nodes should be equidistant from center (960, 540)
      const radius = 250;
      result.layout.nodes.forEach(node => {
        const dx = node.x - 960;
        const dy = node.y - 540;
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(dist).toBeCloseTo(radius, 0);
      });
    });

    it('should use grid layout for unknown diagram type', () => {
      const result = engine.generateAdvancedLayout(
        sampleNodes,
        sampleEdges,
        'unknown-type'
      );
      // Grid layout: x starts at 200, cols = ceil(sqrt(3)) = 2
      expect(result.layout.nodes[0].x).toBe(200);
      expect(result.layout.nodes[1].x).toBe(400);
      expect(result.layout.nodes[0].y).toBe(200);
    });

    it('should assign edge points for flow diagram edges', () => {
      const result = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'flow');
      expect(result.layout.edges[0].points.length).toBeGreaterThanOrEqual(2);
      expect(result.layout.edges[0].style).toBe('curved');
      expect(result.layout.edges[0].animated).toBe(false); // iteration 1
      expect(result.layout.edges[0].thickness).toBe(2); // flow thickness
    });
  });

  describe('visual enhancements', () => {
    it('should generate theme in enhancements', () => {
      const result = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'flow');
      expect(result.visualEnhancements.theme).toBeDefined();
      expect(result.visualEnhancements.theme.nodeColors).toHaveLength(5);
    });

    it('should generate animations with correct defaults', () => {
      const result = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'flow');
      expect(result.visualEnhancements.animations.nodeEntrance.duration).toBe(800);
      expect(result.visualEnhancements.animations.nodeEntrance.easing).toBe('easeOutCubic');
      expect(result.visualEnhancements.animations.edgeDrawing.duration).toBe(1200);
    });

    it('should generate effects based on iteration', () => {
      const result = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'flow');
      // Iteration 1 defaults
      expect(result.visualEnhancements.effects.nodeGlow).toBe(false);
      expect(result.visualEnhancements.effects.edgePulse).toBe(false);
      expect(result.visualEnhancements.effects.shadowDepth).toBe(1);
      expect(result.visualEnhancements.effects.gradientNodes).toBe(false);
    });

    it('should generate interactions', () => {
      const result = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'flow');
      expect(result.visualEnhancements.interactions.nodeHover).toBe(true);
      expect(result.visualEnhancements.interactions.clickHighlight).toBe(true);
      expect(result.visualEnhancements.interactions.zoomableCanvas).toBe(false); // iteration < 4
    });

    it('should generate transitions', () => {
      const result = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'flow');
      expect(result.visualEnhancements.transitions.sceneTransition).toBe('fade');
      expect(result.visualEnhancements.transitions.nodeTransition).toBe('scale');
      expect(result.visualEnhancements.transitions.edgeTransition).toBe('draw');
    });
  });

  describe('iteration progression', () => {
    it('should advance iteration level', () => {
      engine.nextIteration();
      const result = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'flow');
      // Iteration 2: gradient and edgePulse enabled
      expect(result.visualEnhancements.effects.gradientNodes).toBe(true);
      expect(result.visualEnhancements.effects.edgePulse).toBe(true);
      expect(result.performance.optimizationLevel).toBe(80);
    });

    it('should cap optimization level at 100', () => {
      // Advance to iteration 5+
      for (let i = 0; i < 5; i++) {
        engine.nextIteration();
      }
      const result = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'flow');
      expect(result.performance.optimizationLevel).toBe(100);
    });

    it('should enable zoomable canvas at iteration 4+', () => {
      for (let i = 0; i < 3; i++) {
        engine.nextIteration();
      }
      const result = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'flow');
      expect(result.visualEnhancements.interactions.zoomableCanvas).toBe(true);
    });
  });

  describe('node optimization', () => {
    it('should calculate node width based on label length for flow', () => {
      const longLabelNodes: NodeDatum[] = [
        { id: 'n1', label: 'This is a very long label for testing width calculation' },
      ];
      const result = engine.generateAdvancedLayout(longLabelNodes, [], 'flow');
      expect(result.layout.nodes[0].width).toBeLessThanOrEqual(200);
      expect(result.layout.nodes[0].width).toBeGreaterThanOrEqual(100);
    });

    it('should set fixed width for tree nodes', () => {
      const result = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'tree');
      result.layout.nodes.forEach(node => {
        expect(node.width).toBe(100);
        expect(node.height).toBe(50);
      });
    });

    it('should set fixed width for timeline nodes', () => {
      const result = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'timeline');
      result.layout.nodes.forEach(node => {
        expect(node.width).toBe(140);
        expect(node.height).toBe(70);
      });
    });

    it('should set default width for unknown diagram type', () => {
      const result = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'matrix');
      result.layout.nodes.forEach(node => {
        expect(node.width).toBe(120);
        expect(node.height).toBe(60);
      });
    });
  });

  describe('edge optimization', () => {
    it('should set edge thickness based on diagram type', () => {
      const flowResult = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'flow');
      expect(flowResult.layout.edges[0].thickness).toBe(2);

      const treeResult = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'tree');
      expect(treeResult.layout.edges[0].thickness).toBe(1.5);

      const timelineResult = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'timeline');
      expect(timelineResult.layout.edges[0].thickness).toBe(3);
    });

    it('should set arrow style based on diagram type', () => {
      const flowResult = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'flow');
      expect(flowResult.layout.edges[0].arrowHead).toBe('standard');

      const treeResult = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'tree');
      expect(treeResult.layout.edges[0].arrowHead).toBe('minimal');

      const timelineResult = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'timeline');
      expect(timelineResult.layout.edges[0].arrowHead).toBe('bold');
    });

    it('should handle edges referencing non-existent nodes gracefully', () => {
      const edgesWithMissing: EdgeDatum[] = [
        { from: 'n1', to: 'nonexistent' },
      ];
      const result = engine.generateAdvancedLayout(sampleNodes, edgesWithMissing, 'flow');
      // Edge should still be created, with fallback position (0,0)
      expect(result.layout.edges).toHaveLength(1);
      expect(result.layout.edges[0].points).toBeDefined();
      expect(result.layout.edges[0].points.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('themes', () => {
    it('should support professional theme', () => {
      const result = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'flow', {
        theme: 'professional' as 'dark',
      });
      expect(result.layout.theme.background).toBe('#f8fafc');
    });

    it('should support vibrant theme', () => {
      const result = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'flow', {
        theme: 'vibrant' as 'dark',
      });
      expect(result.layout.theme.background).toBe('#1a1a2e');
      expect(result.layout.theme.nodeColors).toContain('#00d2ff');
    });

    it('should fall back to dark theme for unknown theme name', () => {
      const result = engine.generateAdvancedLayout(sampleNodes, sampleEdges, 'flow', {
        theme: 'nonexistent' as 'dark',
      });
      expect(result.layout.theme.background).toBe('#0f0f23');
    });
  });

  describe('tree layout with complex hierarchy', () => {
    it('should handle multi-level tree correctly', () => {
      const treeNodes: NodeDatum[] = [
        { id: 'root', label: 'Root' },
        { id: 'child1', label: 'Child 1' },
        { id: 'child2', label: 'Child 2' },
        { id: 'grandchild1', label: 'Grandchild 1' },
        { id: 'grandchild2', label: 'Grandchild 2' },
      ];
      const treeEdges: EdgeDatum[] = [
        { from: 'root', to: 'child1' },
        { from: 'root', to: 'child2' },
        { from: 'child1', to: 'grandchild1' },
        { from: 'child1', to: 'grandchild2' },
      ];
      const result = engine.generateAdvancedLayout(treeNodes, treeEdges, 'tree');

      const root = result.layout.nodes.find(n => n.id === 'root')!;
      const child1 = result.layout.nodes.find(n => n.id === 'child1')!;
      const grandchild1 = result.layout.nodes.find(n => n.id === 'grandchild1')!;

      // Root at top, children below, grandchildren further below
      expect(root.y).toBe(150);
      expect(child1.y).toBe(300);
      expect(grandchild1.y).toBe(450);
    });

    it('should handle nodes with no edges (isolated)', () => {
      const isolatedNodes: NodeDatum[] = [
        { id: 'iso1', label: 'Isolated 1' },
        { id: 'iso2', label: 'Isolated 2' },
      ];
      const result = engine.generateAdvancedLayout(isolatedNodes, [], 'tree');
      expect(result.layout.nodes).toHaveLength(2);
      // All isolated nodes become roots at level 0
      result.layout.nodes.forEach(node => {
        expect(node.y).toBe(150); // level 0
      });
    });
  });

  describe('grid layout', () => {
    it('should calculate proper columns for many nodes', () => {
      const manyNodes: NodeDatum[] = Array.from({ length: 9 }, (_, i) => ({
        id: `n${i}`,
        label: `Node ${i}`,
      }));
      const result = engine.generateAdvancedLayout(manyNodes, [], 'matrix');
      // sqrt(9) = 3 cols
      expect(result.layout.nodes[0].x).toBe(200); // col 0
      expect(result.layout.nodes[1].x).toBe(400); // col 1
      expect(result.layout.nodes[2].x).toBe(600); // col 2
      expect(result.layout.nodes[3].x).toBe(200); // row 1, col 0
    });

    it('should handle single node', () => {
      const singleNode: NodeDatum[] = [{ id: 'only', label: 'Only' }];
      const result = engine.generateAdvancedLayout(singleNode, [], 'matrix');
      expect(result.layout.nodes).toHaveLength(1);
      expect(result.layout.nodes[0].x).toBe(200);
      expect(result.layout.nodes[0].y).toBe(200);
    });
  });

  describe('cycle layout', () => {
    it('should place single node at center + radius', () => {
      const singleNode: NodeDatum[] = [{ id: 'only', label: 'Only' }];
      const result = engine.generateAdvancedLayout(singleNode, [], 'cycle');
      // angle = 0 for index 0, so x = 960 + 250 = 1210, y = 540
      expect(result.layout.nodes[0].x).toBeCloseTo(1210, 0);
      expect(result.layout.nodes[0].y).toBeCloseTo(540, 0);
    });

    it('should place two nodes diametrically opposite', () => {
      const twoNodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ];
      const result = engine.generateAdvancedLayout(twoNodes, [], 'cycle');
      const dx = result.layout.nodes[0].x - result.layout.nodes[1].x;
      const dy = result.layout.nodes[0].y - result.layout.nodes[1].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Should be diameter = 2 * 250 = 500
      expect(dist).toBeCloseTo(500, 0);
    });
  });
});
