import { AdvancedLayoutEngine, type AdvancedLayoutOptions, type VisualTheme } from '@/visualization/advanced-layouts';
import type { NodeDatum, EdgeDatum } from '@/types/diagram';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNodes(count: number, prefix = 'node'): NodeDatum[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i}`,
    label: `${prefix === 'node' ? 'Node' : prefix} ${i}`,
  }));
}

function makeChainEdges(nodes: NodeDatum[]): EdgeDatum[] {
  return nodes.slice(1).map((n, i) => ({
    from: nodes[i].id,
    to: n.id,
  }));
}

const SAMPLE_NODES: NodeDatum[] = [
  { id: 'a', label: 'Start' },
  { id: 'b', label: 'Process' },
  { id: 'c', label: 'End' },
];

const SAMPLE_EDGES: EdgeDatum[] = [
  { from: 'a', to: 'b' },
  { from: 'b', to: 'c' },
];

// ---------------------------------------------------------------------------
// TASK-0062: AdvancedLayoutEngine
// ---------------------------------------------------------------------------

describe('AdvancedLayoutEngine (TASK-0062)', () => {
  let engine: AdvancedLayoutEngine;

  beforeEach(() => {
    engine = new AdvancedLayoutEngine();
  });

  // -----------------------------------------------------------------------
  // 1. Instantiation
  // -----------------------------------------------------------------------

  describe('instantiation', () => {
    test('should create an instance without error', () => {
      expect(engine).toBeInstanceOf(AdvancedLayoutEngine);
    });

    test('should expose generateAdvancedLayout as a function', () => {
      expect(typeof engine.generateAdvancedLayout).toBe('function');
    });

    test('should expose nextIteration as a function', () => {
      expect(typeof engine.nextIteration).toBe('function');
    });
  });

  // -----------------------------------------------------------------------
  // 2. Theme application
  // -----------------------------------------------------------------------

  describe('theme application', () => {
    const themeCases: Array<{ name: string; opts: Partial<AdvancedLayoutOptions> }> = [
      { name: 'dark', opts: { theme: 'dark' } },
      { name: 'light', opts: { theme: 'light' } },
      { name: 'professional (mapped via getTheme)', opts: { theme: 'professional' } },
      { name: 'vibrant', opts: { theme: 'vibrant' } },
    ];

    for (const { name, opts } of themeCases) {
      test(`should apply the ${name} theme and return it in the layout`, () => {
        const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow', opts);
        expect(result.success).toBe(true);
        expect(result.layout.theme).toBeDefined();
        expect(result.layout.theme.background).toBeDefined();
        expect(result.layout.theme.nodeColors).toBeInstanceOf(Array);
        expect(result.layout.theme.nodeColors.length).toBeGreaterThan(0);
        expect(result.layout.theme.edgeColor).toBeDefined();
        expect(result.layout.theme.textColor).toBeDefined();
        expect(result.layout.theme.accentColor).toBeDefined();
      });
    }

    test('dark theme should have a dark background', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow', { theme: 'dark' });
      expect(result.layout.theme.background).toBe('#0f0f23');
    });

    test('light theme should have a white-ish background', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow', { theme: 'light' });
      expect(result.layout.theme.background).toBe('#ffffff');
    });

    test('professional theme should have a light slate background', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow', { theme: 'professional' });
      expect(result.layout.theme.background).toBe('#f8fafc');
    });

    test('vibrant theme should have a deep dark background', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow', { theme: 'vibrant' });
      expect(result.layout.theme.background).toBe('#1a1a2e');
    });
  });

  // -----------------------------------------------------------------------
  // 3. Theme auto-detection based on time of day
  // -----------------------------------------------------------------------

  describe('theme auto-detection', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    test('should select light theme during daytime (hour 12)', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-15T12:00:00'));
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow', { theme: 'auto' });
      expect(result.layout.theme.background).toBe('#ffffff');
    });

    test('should select dark theme during nighttime (hour 22)', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-15T22:00:00'));
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow', { theme: 'auto' });
      expect(result.layout.theme.background).toBe('#0f0f23');
    });

    test('should select light theme at early morning boundary (hour 6)', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-15T06:00:00'));
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow', { theme: 'auto' });
      expect(result.layout.theme.background).toBe('#ffffff');
    });

    test('should select dark theme just before morning boundary (hour 5)', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-15T05:00:00'));
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow', { theme: 'auto' });
      expect(result.layout.theme.background).toBe('#0f0f23');
    });

    test('should select light theme just before evening boundary (hour 17)', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-15T17:00:00'));
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow', { theme: 'auto' });
      expect(result.layout.theme.background).toBe('#ffffff');
    });

    test('should select dark theme at evening boundary (hour 18)', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-15T18:00:00'));
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow', { theme: 'auto' });
      expect(result.layout.theme.background).toBe('#0f0f23');
    });

    test('should fallback to dark theme for unknown theme name', () => {
      // The implementation falls back to 'dark' when theme name is not in the map
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow', { theme: 'nonexistent' as AdvancedLayoutOptions['theme'] });
      expect(result.layout.theme.background).toBe('#0f0f23');
    });
  });

  // -----------------------------------------------------------------------
  // 4. Animation styles
  // -----------------------------------------------------------------------

  describe('animation styles', () => {
    test('should apply smooth animation style by default', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      expect(result.visualEnhancements.animations.nodeEntrance.easing).toBe('easeOutCubic');
      expect(result.visualEnhancements.animations.nodeEntrance.duration).toBe(800);
      expect(result.visualEnhancements.animations.edgeDrawing.duration).toBe(1200);
      expect(result.visualEnhancements.animations.textFadeIn.duration).toBe(600);
      expect(result.visualEnhancements.animations.textFadeIn.delay).toBe(400);
    });

    test('should apply bouncy animation style with bounce easing', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow', {
        animationStyle: 'bouncy',
      });
      expect(result.visualEnhancements.animations.nodeEntrance.easing).toBe('easeOutBounce');
    });

    test('should apply minimal animation style with shorter durations', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow', {
        animationStyle: 'minimal',
      });
      expect(result.visualEnhancements.animations.nodeEntrance.duration).toBe(400);
      expect(result.visualEnhancements.animations.edgeDrawing.duration).toBe(600);
    });
  });

  // -----------------------------------------------------------------------
  // 5. Node shapes
  // -----------------------------------------------------------------------

  describe('node shapes', () => {
    const shapes: AdvancedLayoutOptions['nodeShape'][] = ['rectangle', 'rounded', 'circle', 'hexagon'];

    for (const shape of shapes) {
      test(`should apply ${shape} shape to all nodes`, () => {
        const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow', {
          nodeShape: shape,
        });
        for (const node of result.layout.nodes) {
          expect(node.shape).toBe(shape);
        }
      });
    }

    test('rounded shape should set borderRadius to 8', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow', {
        nodeShape: 'rounded',
      });
      for (const node of result.layout.nodes) {
        expect(node.borderRadius).toBe(8);
      }
    });

    test('rectangle shape should set borderRadius to 0', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow', {
        nodeShape: 'rectangle',
      });
      for (const node of result.layout.nodes) {
        expect(node.borderRadius).toBe(0);
      }
    });

    test('circle shape should set borderRadius to 0', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow', {
        nodeShape: 'circle',
      });
      for (const node of result.layout.nodes) {
        expect(node.borderRadius).toBe(0);
      }
    });

    test('hexagon shape should set borderRadius to 0', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow', {
        nodeShape: 'hexagon',
      });
      for (const node of result.layout.nodes) {
        expect(node.borderRadius).toBe(0);
      }
    });

    test('default node shape should be rounded', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      for (const node of result.layout.nodes) {
        expect(node.shape).toBe('rounded');
      }
    });
  });

  // -----------------------------------------------------------------------
  // 6. Edge styles
  // -----------------------------------------------------------------------

  describe('edge styles', () => {
    const styles: AdvancedLayoutOptions['edgeStyle'][] = ['straight', 'curved', 'orthogonal'];

    for (const style of styles) {
      test(`should apply ${style} edge style to all edges`, () => {
        const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow', {
          edgeStyle: style,
        });
        for (const edge of result.layout.edges) {
          expect(edge.style).toBe(style);
        }
      });
    }

    test('default edge style should be curved', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      for (const edge of result.layout.edges) {
        expect(edge.style).toBe('curved');
      }
    });

    test('edges should have thickness property', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      for (const edge of result.layout.edges) {
        expect(typeof edge.thickness).toBe('number');
        expect(edge.thickness).toBeGreaterThan(0);
      }
    });

    test('edges should have arrowHead property', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      for (const edge of result.layout.edges) {
        expect(typeof edge.arrowHead).toBe('string');
      }
    });

    test('edges should have points array', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      for (const edge of result.layout.edges) {
        expect(edge.points).toBeInstanceOf(Array);
      }
    });
  });

  // -----------------------------------------------------------------------
  // 7. AdvancedLayoutNode / Edge conversion
  // -----------------------------------------------------------------------

  describe('node and edge conversion', () => {
    test('should convert NodeDatum to LayoutNode with visual properties', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      for (const node of result.layout.nodes) {
        // Original properties preserved
        expect(typeof node.id).toBe('string');
        expect(typeof node.label).toBe('string');
        // Layout properties added
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
        expect(typeof node.width).toBe('number');
        expect(typeof node.height).toBe('number');
        // Visual properties added
        expect(typeof node.shape).toBe('string');
        expect(typeof node.borderRadius).toBe('number');
        expect(typeof node.gradient).toBe('boolean');
        expect(typeof node.shadow).toBe('boolean');
        expect(typeof node.animation).toBe('object');
        expect(typeof node.animation.entrance).toBe('string');
        expect(typeof node.animation.duration).toBe('number');
      }
    });

    test('should convert EdgeDatum to LayoutEdgeDatum with visual properties', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      for (const edge of result.layout.edges) {
        // Original properties preserved
        expect(typeof edge.from).toBe('string');
        expect(typeof edge.to).toBe('string');
        // Visual properties added
        expect(typeof edge.style).toBe('string');
        expect(typeof edge.animated).toBe('boolean');
        expect(typeof edge.thickness).toBe('number');
        expect(typeof edge.arrowHead).toBe('string');
        expect(edge.points).toBeInstanceOf(Array);
      }
    });

    test('should preserve edge labels when present', () => {
      const edgesWithLabels: EdgeDatum[] = [
        { from: 'a', to: 'b', label: 'connects' },
      ];
      const result = engine.generateAdvancedLayout(
        [SAMPLE_NODES[0], SAMPLE_NODES[1]],
        edgesWithLabels,
        'flow',
      );
      expect(result.layout.edges[0].label).toBe('connects');
    });

    test('should assign diagram-specific node widths for flow', () => {
      const nodes: NodeDatum[] = [
        { id: 'x', label: 'Very long label text for testing' },
      ];
      const result = engine.generateAdvancedLayout(nodes, [], 'flow');
      expect(result.layout.nodes[0].width).toBeGreaterThan(0);
      expect(result.layout.nodes[0].height).toBe(60);
    });

    test('should assign diagram-specific node dimensions for tree', () => {
      const nodes: NodeDatum[] = [{ id: 't', label: 'Tree Node' }];
      const result = engine.generateAdvancedLayout(nodes, [], 'tree');
      expect(result.layout.nodes[0].width).toBe(100);
      expect(result.layout.nodes[0].height).toBe(50);
    });

    test('should assign diagram-specific node dimensions for timeline', () => {
      const nodes: NodeDatum[] = [{ id: 'tl', label: 'Timeline Event' }];
      const result = engine.generateAdvancedLayout(nodes, [], 'timeline');
      expect(result.layout.nodes[0].width).toBe(140);
      expect(result.layout.nodes[0].height).toBe(70);
    });

    test('should use default node dimensions for unknown diagram type', () => {
      const nodes: NodeDatum[] = [{ id: 'u', label: 'Unknown' }];
      const result = engine.generateAdvancedLayout(nodes, [], 'unknown');
      expect(result.layout.nodes[0].width).toBe(120);
      expect(result.layout.nodes[0].height).toBe(60);
    });

    test('should assign diagram-specific edge thickness for flow', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      for (const edge of result.layout.edges) {
        expect(edge.thickness).toBe(2);
      }
    });

    test('should assign diagram-specific edge thickness for tree', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'tree');
      for (const edge of result.layout.edges) {
        expect(edge.thickness).toBe(1.5);
      }
    });

    test('should assign diagram-specific edge thickness for timeline', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'timeline');
      for (const edge of result.layout.edges) {
        expect(edge.thickness).toBe(3);
      }
    });

    test('should assign diagram-specific arrow styles', () => {
      const flow = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      expect(flow.layout.edges[0].arrowHead).toBe('standard');

      const tree = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'tree');
      expect(tree.layout.edges[0].arrowHead).toBe('minimal');

      const timeline = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'timeline');
      expect(timeline.layout.edges[0].arrowHead).toBe('bold');
    });
  });

  // -----------------------------------------------------------------------
  // 8. Visual effects (TASK-0064)
  // -----------------------------------------------------------------------

  describe('visual effects (TASK-0064)', () => {
    test('should include effects in visualEnhancements', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      const effects = result.visualEnhancements.effects;
      expect(effects).toBeDefined();
      expect(typeof effects.nodeGlow).toBe('boolean');
      expect(typeof effects.edgePulse).toBe('boolean');
      expect(typeof effects.shadowDepth).toBe('number');
      expect(typeof effects.gradientNodes).toBe('boolean');
    });

    test('at iteration 1, nodeGlow should be false', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      expect(result.visualEnhancements.effects.nodeGlow).toBe(false);
    });

    test('at iteration 1, edgePulse should be false', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      expect(result.visualEnhancements.effects.edgePulse).toBe(false);
    });

    test('at iteration 1, shadowDepth should be 1', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      expect(result.visualEnhancements.effects.shadowDepth).toBe(1);
    });

    test('at iteration 1, gradientNodes should be false', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      expect(result.visualEnhancements.effects.gradientNodes).toBe(false);
    });

    test('at iteration 3, nodeGlow should be true', () => {
      engine.nextIteration(); // -> 2
      engine.nextIteration(); // -> 3
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      expect(result.visualEnhancements.effects.nodeGlow).toBe(true);
      expect(result.visualEnhancements.effects.shadowDepth).toBe(3);
    });

    test('at iteration 2, edgePulse and gradientNodes should be true', () => {
      engine.nextIteration(); // -> 2
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      expect(result.visualEnhancements.effects.edgePulse).toBe(true);
      expect(result.visualEnhancements.effects.gradientNodes).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 9. Animations (TASK-0064)
  // -----------------------------------------------------------------------

  describe('animations (TASK-0064)', () => {
    test('should include animations in visualEnhancements', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      const anims = result.visualEnhancements.animations;
      expect(anims).toBeDefined();
      expect(anims.nodeEntrance).toBeDefined();
      expect(anims.edgeDrawing).toBeDefined();
      expect(anims.textFadeIn).toBeDefined();
    });

    test('nodeEntrance should have duration and easing', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      const { nodeEntrance } = result.visualEnhancements.animations;
      expect(typeof nodeEntrance.duration).toBe('number');
      expect(typeof nodeEntrance.easing).toBe('string');
    });

    test('edgeDrawing should have duration and easing', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      const { edgeDrawing } = result.visualEnhancements.animations;
      expect(typeof edgeDrawing.duration).toBe('number');
      expect(typeof edgeDrawing.easing).toBe('string');
    });

    test('textFadeIn should have duration and delay', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      const { textFadeIn } = result.visualEnhancements.animations;
      expect(typeof textFadeIn.duration).toBe('number');
      expect(typeof textFadeIn.delay).toBe('number');
    });
  });

  // -----------------------------------------------------------------------
  // 10. Interactions (TASK-0064)
  // -----------------------------------------------------------------------

  describe('interactions (TASK-0064)', () => {
    test('should include interactions in visualEnhancements', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      const interactions = result.visualEnhancements.interactions;
      expect(interactions).toBeDefined();
      expect(typeof interactions.nodeHover).toBe('boolean');
      expect(typeof interactions.clickHighlight).toBe('boolean');
      expect(typeof interactions.zoomableCanvas).toBe('boolean');
    });

    test('nodeHover should be true by default', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      expect(result.visualEnhancements.interactions.nodeHover).toBe(true);
    });

    test('clickHighlight should be true by default', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      expect(result.visualEnhancements.interactions.clickHighlight).toBe(true);
    });

    test('zoomableCanvas should be false at iteration 1', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      expect(result.visualEnhancements.interactions.zoomableCanvas).toBe(false);
    });

    test('zoomableCanvas should be true at iteration 4+', () => {
      engine.nextIteration(); // 2
      engine.nextIteration(); // 3
      engine.nextIteration(); // 4
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      expect(result.visualEnhancements.interactions.zoomableCanvas).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 11. VisualEnhancements integration wrapper
  // -----------------------------------------------------------------------

  describe('VisualEnhancements integration', () => {
    test('should return all five enhancement categories', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      const ve = result.visualEnhancements;
      expect(ve).toHaveProperty('theme');
      expect(ve).toHaveProperty('animations');
      expect(ve).toHaveProperty('effects');
      expect(ve).toHaveProperty('transitions');
      expect(ve).toHaveProperty('interactions');
    });

    test('should include transitions with scene, node, and edge types', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      const { transitions } = result.visualEnhancements;
      expect(transitions.sceneTransition).toBe('fade');
      expect(transitions.nodeTransition).toBe('scale');
      expect(transitions.edgeTransition).toBe('draw');
    });

    test('should include theme in visualEnhancements matching layout theme', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow', {
        theme: 'dark',
      });
      expect(result.visualEnhancements.theme.background).toBe(result.layout.theme.background);
      expect(result.visualEnhancements.theme.nodeColors).toEqual(result.layout.theme.nodeColors);
    });

    test('should include performance metrics', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      expect(result.performance).toBeDefined();
      expect(typeof result.performance.layoutTime).toBe('number');
      expect(result.performance.layoutTime).toBeGreaterThanOrEqual(0);
      expect(typeof result.performance.optimizationLevel).toBe('number');
    });

    test('optimizationLevel should increase with iterations', () => {
      const result1 = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      const level1 = result1.performance.optimizationLevel;

      engine.nextIteration();
      const result2 = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      const level2 = result2.performance.optimizationLevel;

      expect(level2).toBeGreaterThan(level1);
    });

    test('optimizationLevel should be capped at 100', () => {
      // Push to a very high iteration
      for (let i = 0; i < 50; i++) {
        engine.nextIteration();
      }
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      expect(result.performance.optimizationLevel).toBeLessThanOrEqual(100);
    });
  });

  // -----------------------------------------------------------------------
  // 12. Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    test('should handle empty nodes and empty edges', () => {
      const result = engine.generateAdvancedLayout([], [], 'flow');
      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(0);
      expect(result.layout.edges).toHaveLength(0);
      expect(result.layout.canvas.width).toBe(1920);
      expect(result.layout.canvas.height).toBe(1080);
    });

    test('should handle a single node with no edges', () => {
      const nodes: NodeDatum[] = [{ id: 'only', label: 'Only Node' }];
      const result = engine.generateAdvancedLayout(nodes, [], 'flow');
      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(1);
      expect(result.layout.nodes[0].id).toBe('only');
      expect(result.layout.edges).toHaveLength(0);
    });

    test('should handle many nodes (50+)', () => {
      const manyNodes = makeNodes(60);
      const manyEdges = makeChainEdges(manyNodes);
      const result = engine.generateAdvancedLayout(manyNodes, manyEdges, 'flow');
      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(60);
      expect(result.layout.edges).toHaveLength(59);
    });

    test('should handle edges referencing non-existent nodes gracefully', () => {
      const nodes: NodeDatum[] = [{ id: 'a', label: 'A' }];
      const edges: EdgeDatum[] = [
        { from: 'a', to: 'nonexistent' },
      ];
      // Should not throw; findNodePosition returns { x: 0, y: 0 } for missing nodes
      const result = engine.generateAdvancedLayout(nodes, edges, 'flow');
      expect(result.success).toBe(true);
      expect(result.layout.edges).toHaveLength(1);
    });

    test('should handle nodes with no connecting edges', () => {
      const nodes: NodeDatum[] = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ];
      const result = engine.generateAdvancedLayout(nodes, [], 'flow');
      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(3);
      expect(result.layout.edges).toHaveLength(0);
    });

    test('should return success: true for all diagram types', () => {
      const types = ['flow', 'tree', 'timeline', 'cycle', 'matrix', 'unknown'];
      for (const type of types) {
        const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, type);
        expect(result.success).toBe(true);
      }
    });

    test('should handle empty options object (use all defaults)', () => {
      const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow', {});
      expect(result.success).toBe(true);
      expect(result.layout.theme.background).toBe('#0f0f23'); // default dark
    });

    test('should handle nodes with long labels', () => {
      const nodes: NodeDatum[] = [
        { id: 'long', label: 'This is a very long node label that exceeds typical length expectations' },
      ];
      const result = engine.generateAdvancedLayout(nodes, [], 'flow');
      expect(result.success).toBe(true);
      expect(result.layout.nodes[0].width).toBeLessThanOrEqual(200);
    });

    test('should handle tree layout with root detection', () => {
      // Node 'root' has no incoming edges, nodes 'child1' and 'child2' do
      const treeNodes: NodeDatum[] = [
        { id: 'root', label: 'Root' },
        { id: 'child1', label: 'Child 1' },
        { id: 'child2', label: 'Child 2' },
      ];
      const treeEdges: EdgeDatum[] = [
        { from: 'root', to: 'child1' },
        { from: 'root', to: 'child2' },
      ];
      const result = engine.generateAdvancedLayout(treeNodes, treeEdges, 'tree');
      expect(result.success).toBe(true);
      expect(result.layout.nodes).toHaveLength(3);
      // Root node should be at level 0 (y: 150 + 0 * 150 = 150)
      const rootNode = result.layout.nodes.find(n => n.id === 'root');
      expect(rootNode).toBeDefined();
      expect(rootNode!.y).toBe(150);
    });

    test('should handle cycle layout with circular positioning', () => {
      const cycleNodes = makeNodes(4);
      const cycleEdges: EdgeDatum[] = [
        { from: cycleNodes[0].id, to: cycleNodes[1].id },
        { from: cycleNodes[1].id, to: cycleNodes[2].id },
        { from: cycleNodes[2].id, to: cycleNodes[3].id },
        { from: cycleNodes[3].id, to: cycleNodes[0].id },
      ];
      const result = engine.generateAdvancedLayout(cycleNodes, cycleEdges, 'cycle');
      expect(result.success).toBe(true);
      // In cycle layout, nodes should be arranged in a circle around (960, 540)
      for (const node of result.layout.nodes) {
        const dx = node.x - 960;
        const dy = node.y - 540;
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(dist).toBeCloseTo(250, 0); // radius = 250
      }
    });

    test('should handle timeline layout with alternating heights', () => {
      const tlNodes = makeNodes(5);
      const tlEdges = makeChainEdges(tlNodes);
      const result = engine.generateAdvancedLayout(tlNodes, tlEdges, 'timeline');
      expect(result.success).toBe(true);
      // Timeline uses alternating y: 400 + (index % 2) * 100
      expect(result.layout.nodes[0].y).toBe(400); // index 0
      expect(result.layout.nodes[1].y).toBe(500); // index 1
      expect(result.layout.nodes[2].y).toBe(400); // index 2
    });
  });

  // -----------------------------------------------------------------------
  // nextIteration
  // -----------------------------------------------------------------------

  describe('nextIteration', () => {
    test('should increment iteration and update node gradient/shadow behavior', () => {
      // Iteration 1: gradient=false, shadow=false
      const result1 = engine.generateAdvancedLayout(SAMPLE_NODES, [], 'flow');
      expect(result1.layout.nodes[0].gradient).toBe(false);
      expect(result1.layout.nodes[0].shadow).toBe(false);

      engine.nextIteration();
      // Iteration 2: gradient=true, shadow=false
      const result2 = engine.generateAdvancedLayout(SAMPLE_NODES, [], 'flow');
      expect(result2.layout.nodes[0].gradient).toBe(true);
      expect(result2.layout.nodes[0].shadow).toBe(false);

      engine.nextIteration();
      // Iteration 3: gradient=true, shadow=true
      const result3 = engine.generateAdvancedLayout(SAMPLE_NODES, [], 'flow');
      expect(result3.layout.nodes[0].gradient).toBe(true);
      expect(result3.layout.nodes[0].shadow).toBe(true);
    });

    test('should animate edges starting from iteration 2', () => {
      const result1 = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      expect(result1.layout.edges[0].animated).toBe(false);

      engine.nextIteration();
      const result2 = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, 'flow');
      expect(result2.layout.edges[0].animated).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Layout-specific positioning
  // -----------------------------------------------------------------------

  describe('layout-specific positioning', () => {
    test('flow layout should position nodes in a grid pattern', () => {
      const nodes = makeNodes(6);
      const edges = makeChainEdges(nodes);
      const result = engine.generateAdvancedLayout(nodes, edges, 'flow');
      // First three nodes at y=200, next three at y=400
      expect(result.layout.nodes[0].y).toBe(200);
      expect(result.layout.nodes[3].y).toBe(400);
    });

    test('grid layout should use sqrt-based columns', () => {
      const nodes = makeNodes(9); // sqrt(9) = 3 cols
      const result = engine.generateAdvancedLayout(nodes, [], 'grid');
      // Node at index 3 should be on second row
      expect(result.layout.nodes[3].y).toBeGreaterThan(result.layout.nodes[2].y);
    });

    test('should return a 1920x1080 canvas for all layout types', () => {
      const types = ['flow', 'tree', 'timeline', 'cycle', 'other'];
      for (const type of types) {
        const result = engine.generateAdvancedLayout(SAMPLE_NODES, SAMPLE_EDGES, type);
        expect(result.layout.canvas.width).toBe(1920);
        expect(result.layout.canvas.height).toBe(1080);
      }
    });
  });
});
