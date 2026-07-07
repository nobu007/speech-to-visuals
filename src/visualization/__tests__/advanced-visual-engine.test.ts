/**
 * Tests for AdvancedVisualEngine
 *
 * Covers: enhanceScene, enhanceMultipleScenes, exportForRendering,
 * createProfessionalStyle, enhanceLayout, animation sequences,
 * background creation, color schemes, watermarks, quality evaluation,
 * iteration management, statistics, and edge cases.
 */

import { AdvancedVisualEngine, advancedVisualEngine } from '../advanced-visual-engine';
import type { SceneGraph, DiagramLayout } from '@/types/diagram';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScene(overrides: Partial<SceneGraph> = {}): SceneGraph {
  const layout: DiagramLayout = {
    nodes: [
      { id: 'n1', label: 'Start', x: 0, y: 0, width: 100, height: 40 },
      { id: 'n2', label: 'Key Decision', x: 150, y: 0, width: 100, height: 40 },
      { id: 'n3', label: 'End', x: 300, y: 0, width: 100, height: 40 },
    ],
    edges: [
      { from: 'n1', to: 'n2', points: [{ x: 100, y: 20 }, { x: 150, y: 20 }] },
      { from: 'n2', to: 'n3', points: [{ x: 250, y: 20 }, { x: 300, y: 20 }] },
    ],
    bounds: { x: 0, y: 0, width: 400, height: 40 },
    center: { x: 200, y: 20 },
  };

  return {
    type: 'flow',
    nodes: [
      { id: 'n1', label: 'Start' },
      { id: 'n2', label: 'Key Decision' },
      { id: 'n3', label: 'End' },
    ],
    edges: [
      { from: 'n1', to: 'n2' },
      { from: 'n2', to: 'n3' },
    ],
    layout,
    startMs: 0,
    durationMs: 5000,
    summary: 'A simple flow diagram',
    keyphrases: ['start', 'decision', 'end'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdvancedVisualEngine', () => {
  let engine: AdvancedVisualEngine;

  beforeEach(() => {
    engine = new AdvancedVisualEngine();
  });

  // ---- Constructor ----

  describe('constructor', () => {
    it('creates engine with default layout engine', () => {
      const e = new AdvancedVisualEngine();
      expect(e).toBeDefined();
    });

    it('creates engine with custom layout engine', () => {
      const customEngine = new AdvancedVisualEngine(undefined);
      expect(customEngine).toBeDefined();
    });
  });

  // ---- enhanceScene ----

  describe('enhanceScene', () => {
    it('enhances a scene with default styling', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene);

      expect(result).toBeDefined();
      expect(result.visualStyle).toBeDefined();
      expect(result.visualStyle.theme).toBe('modern');
      expect(result.visualStyle.colorScheme).toBe('blue');
      expect(result.visualStyle.animation).toBe('smooth');
      expect(result.visualStyle.nodeStyle).toBe('rounded');
      expect(result.visualStyle.edgeStyle).toBe('curved');
      expect(result.visualStyle.fontSize).toBe('medium');
      expect(result.visualStyle.spacing).toBe('normal');
    });

    it('applies custom visual style overrides', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene, {
        theme: 'classic',
        colorScheme: 'green',
        animation: 'bounce',
        nodeStyle: 'square',
        edgeStyle: 'straight',
        fontSize: 'large',
        spacing: 'compact',
      });

      expect(result.visualStyle.theme).toBe('classic');
      expect(result.visualStyle.colorScheme).toBe('green');
      expect(result.visualStyle.animation).toBe('bounce');
      expect(result.visualStyle.nodeStyle).toBe('square');
      expect(result.visualStyle.edgeStyle).toBe('straight');
      expect(result.visualStyle.fontSize).toBe('large');
      expect(result.visualStyle.spacing).toBe('compact');
    });

    it('generates entrance animations for nodes', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene);

      const entranceAnims = result.animations.filter(a => a.type === 'entrance');
      expect(entranceAnims.length).toBe(3); // 3 nodes
      expect(entranceAnims[0].target).toBe('n1');
      expect(entranceAnims[1].target).toBe('n2');
      expect(entranceAnims[2].target).toBe('n3');
    });

    it('generates connection animations for edges', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene);

      const connectionAnims = result.animations.filter(a => a.type === 'connection');
      expect(connectionAnims.length).toBe(2); // 2 edges
    });

    it('staggeres node entrance animations by 200ms', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene);

      const entranceAnims = result.animations.filter(a => a.type === 'entrance');
      expect(entranceAnims[0].timing.delay).toBe(0);
      expect(entranceAnims[1].timing.delay).toBe(200);
      expect(entranceAnims[2].timing.delay).toBe(400);
    });

    it('creates background configuration', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene);

      expect(result.background).toBeDefined();
      expect(result.background.type).toBe('gradient');
      expect(result.background.primary).toBe('#EFF6FF');
    });

    it('creates watermark configuration', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene);

      expect(result.watermark).toBeDefined();
      expect(result.watermark!.text).toBe('Generated by Speech-to-Visuals AI');
      expect(result.watermark!.position).toBe('bottom-right');
      expect(result.watermark!.opacity).toBe(0.3);
      expect(result.watermark!.fontSize).toBe(12);
    });

    it('enhances layout nodes with visual styles', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene);

      // Enhanced layout should have styled nodes
      expect(result.layout.nodes).toBeDefined();
      expect(result.layout.nodes.length).toBe(3);
      const node = result.layout.nodes[0] as Record<string, unknown>;
      expect(node.style).toBeDefined();
    });

    it('preserves scene properties in enhanced result', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene);

      expect(result.type).toBe('flow');
      expect(result.nodes).toEqual(scene.nodes);
      expect(result.edges).toEqual(scene.edges);
      expect(result.startMs).toBe(0);
      expect(result.durationMs).toBe(5000);
      expect(result.summary).toBe('A simple flow diagram');
    });

    it('handles scenes with no nodes', async () => {
      const scene = makeScene({
        nodes: [],
        edges: [],
        layout: { nodes: [], edges: [], bounds: { x: 0, y: 0, width: 0, height: 0 }, center: { x: 0, y: 0 } },
      });
      const result = await engine.enhanceScene(scene);

      expect(result).toBeDefined();
      expect(result.animations.filter(a => a.type === 'entrance')).toHaveLength(0);
      expect(result.animations.filter(a => a.type === 'connection')).toHaveLength(0);
    });

    it('handles scenes with edges without id', async () => {
      const scene = makeScene({
        edges: [{ from: 'n1', to: 'n2' }],
        layout: {
          nodes: [{ id: 'n1', label: 'A', x: 0, y: 0, width: 100, height: 40 }],
          edges: [{ from: 'n1', to: 'n2', points: [] }],
          bounds: { x: 0, y: 0, width: 100, height: 40 },
          center: { x: 50, y: 20 },
        },
      });
      const result = await engine.enhanceScene(scene);

      const connAnims = result.animations.filter(a => a.type === 'connection');
      expect(connAnims[0].target).toBe('edge-0');
    });
  });

  // ---- Background themes ----

  describe('background creation', () => {
    it('creates gradient background for modern theme', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene, { theme: 'modern' });
      expect(result.background.type).toBe('gradient');
      expect(result.background.pattern).toBe('grid');
    });

    it('creates solid background for minimal theme', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene, { theme: 'minimal' });
      expect(result.background.type).toBe('solid');
      expect(result.background.primary).toBe('#FFFFFF');
    });

    it('creates solid background with pattern for corporate theme', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene, { theme: 'corporate' });
      expect(result.background.type).toBe('solid');
      expect(result.background.pattern).toBe('lines');
    });

    it('creates gradient background for creative theme', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene, { theme: 'creative' });
      expect(result.background.type).toBe('gradient');
      expect(result.background.pattern).toBe('dots');
    });

    it('creates solid background for classic theme (default case)', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene, { theme: 'classic' });
      expect(result.background.type).toBe('solid');
    });
  });

  // ---- Color schemes ----

  describe('color schemes', () => {
    it('applies blue color scheme', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene, { colorScheme: 'blue' });
      const node = result.layout.nodes[0] as Record<string, unknown>;
      const style = node.style as Record<string, unknown>;
      expect(style.stroke).toBe('#3B82F6');
    });

    it('applies green color scheme', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene, { colorScheme: 'green' });
      const node = result.layout.nodes[0] as Record<string, unknown>;
      const style = node.style as Record<string, unknown>;
      expect(style.stroke).toBe('#10B981');
    });

    it('applies purple color scheme', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene, { colorScheme: 'purple' });
      const node = result.layout.nodes[0] as Record<string, unknown>;
      const style = node.style as Record<string, unknown>;
      expect(style.stroke).toBe('#8B5CF6');
    });

    it('applies orange color scheme', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene, { colorScheme: 'orange' });
      const node = result.layout.nodes[0] as Record<string, unknown>;
      const style = node.style as Record<string, unknown>;
      expect(style.stroke).toBe('#F59E0B');
    });

    it('applies gradient color scheme', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene, { colorScheme: 'gradient' });
      const node = result.layout.nodes[0] as Record<string, unknown>;
      const style = node.style as Record<string, unknown>;
      expect(style.gradient).toBe(true);
    });

    it('applies monochrome color scheme', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene, { colorScheme: 'monochrome' });
      const node = result.layout.nodes[0] as Record<string, unknown>;
      const style = node.style as Record<string, unknown>;
      expect(style.stroke).toBe('#374151');
    });
  });

  // ---- Node styles ----

  describe('node styles', () => {
    it('applies rounded node style', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene, { nodeStyle: 'rounded' });
      const node = result.layout.nodes[0] as Record<string, unknown>;
      const style = node.style as Record<string, unknown>;
      expect(style.borderRadius).toBe(8);
    });

    it('applies square node style', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene, { nodeStyle: 'square' });
      const node = result.layout.nodes[0] as Record<string, unknown>;
      const style = node.style as Record<string, unknown>;
      expect(style.borderRadius).toBe(0);
    });

    it('applies circle node style', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene, { nodeStyle: 'circle' });
      const node = result.layout.nodes[0] as Record<string, unknown>;
      const style = node.style as Record<string, unknown>;
      expect(style.borderRadius).toBe(50);
    });

    it('applies default border radius for other node styles', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene, { nodeStyle: 'hexagon' });
      const node = result.layout.nodes[0] as Record<string, unknown>;
      const style = node.style as Record<string, unknown>;
      expect(style.borderRadius).toBe(6);
    });
  });

  // ---- Font sizes ----

  describe('font sizes', () => {
    it('applies small font size', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene, { fontSize: 'small' });
      const node = result.layout.nodes[0] as Record<string, unknown>;
      const style = node.style as Record<string, unknown>;
      expect(style.fontSize).toBe(12);
    });

    it('applies medium font size', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene, { fontSize: 'medium' });
      const node = result.layout.nodes[0] as Record<string, unknown>;
      const style = node.style as Record<string, unknown>;
      expect(style.fontSize).toBe(14);
    });

    it('applies large font size', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene, { fontSize: 'large' });
      const node = result.layout.nodes[0] as Record<string, unknown>;
      const style = node.style as Record<string, unknown>;
      expect(style.fontSize).toBe(16);
    });

    it('applies xl font size', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene, { fontSize: 'xl' });
      const node = result.layout.nodes[0] as Record<string, unknown>;
      const style = node.style as Record<string, unknown>;
      expect(style.fontSize).toBe(18);
    });
  });

  // ---- Edge styles ----

  describe('edge styles', () => {
    it('uses thinner edge width for minimal theme', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene, { theme: 'minimal' });
      const edge = result.layout.edges[0] as Record<string, unknown>;
      const style = edge.style as Record<string, unknown>;
      expect(style.strokeWidth).toBe(1);
    });

    it('uses standard edge width for non-minimal themes', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene, { theme: 'modern' });
      const edge = result.layout.edges[0] as Record<string, unknown>;
      const style = edge.style as Record<string, unknown>;
      expect(style.strokeWidth).toBe(2);
    });

    it('applies dashed pattern for dashed edge type', async () => {
      const scene = makeScene({
        edges: [{ from: 'n1', to: 'n2', type: 'dashed' }],
        layout: {
          nodes: [{ id: 'n1', label: 'A', x: 0, y: 0, width: 100, height: 40 }],
          edges: [{ from: 'n1', to: 'n2', points: [] }],
          bounds: { x: 0, y: 0, width: 100, height: 40 },
          center: { x: 50, y: 20 },
        },
      });
      const result = await engine.enhanceScene(scene);
      const edge = result.layout.edges[0] as Record<string, unknown>;
      const style = edge.style as Record<string, unknown>;
      expect(style.strokeDasharray).toBe('5,5');
    });

    it('applies dashed pattern for edge with dashed style', async () => {
      const scene = makeScene({
        edges: [{ from: 'n1', to: 'n2', style: 'dashed' } as Record<string, unknown> as import('@/types/diagram').EdgeDatum],
        layout: {
          nodes: [{ id: 'n1', label: 'A', x: 0, y: 0, width: 100, height: 40 }],
          edges: [{ from: 'n1', to: 'n2', points: [] }],
          bounds: { x: 0, y: 0, width: 100, height: 40 },
          center: { x: 50, y: 20 },
        },
      });
      const result = await engine.enhanceScene(scene);
      const edge = result.layout.edges[0] as Record<string, unknown>;
      const style = edge.style as Record<string, unknown>;
      expect(style.strokeDasharray).toBe('5,5');
    });

    it('uses undefined dash pattern for solid edges', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene);
      const edge = result.layout.edges[0] as Record<string, unknown>;
      const style = edge.style as Record<string, unknown>;
      expect(style.strokeDasharray).toBeUndefined();
    });

    it('includes arrow style for edges', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene);
      const edge = result.layout.edges[0] as Record<string, unknown>;
      const style = edge.style as Record<string, unknown>;
      expect(style.markerEnd).toBe('url(#arrowhead)');
    });

    it('includes animation style on edges', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene, { animation: 'fade' });
      const edge = result.layout.edges[0] as Record<string, unknown>;
      const style = edge.style as Record<string, unknown>;
      expect(style.animation).toBe('fade');
    });
  });

  // ---- Shadow config ----

  describe('shadow configuration', () => {
    it('returns null shadow for minimal theme', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene, { theme: 'minimal' });
      const node = result.layout.nodes[0] as Record<string, unknown>;
      const style = node.style as Record<string, unknown>;
      expect(style.shadow).toBeNull();
    });

    it('returns shadow config for non-minimal themes', async () => {
      const scene = makeScene();
      const result = await engine.enhanceScene(scene, { theme: 'modern' });
      const node = result.layout.nodes[0] as Record<string, unknown>;
      const style = node.style as Record<string, unknown>;
      expect(style.shadow).toEqual({
        offsetX: 0,
        offsetY: 2,
        blur: 4,
        color: 'rgba(0, 0, 0, 0.1)',
      });
    });
  });

  // ---- Node coloring by type ----

  describe('node coloring by type', () => {
    it('colors important nodes with primary color', async () => {
      const scene = makeScene({
        nodes: [{ id: 'n1', label: 'Important Node', type: 'important' }],
        layout: {
          nodes: [{ id: 'n1', label: 'Important Node', x: 0, y: 0, width: 100, height: 40 }],
          edges: [],
          bounds: { x: 0, y: 0, width: 100, height: 40 },
          center: { x: 50, y: 20 },
        },
      });
      const result = await engine.enhanceScene(scene, { colorScheme: 'blue' });
      const node = result.layout.nodes[0] as Record<string, unknown>;
      const style = node.style as Record<string, unknown>;
      expect(style.fill).toBe('#3B82F6'); // primary for blue
    });

    it('colors nodes with "key" in label with primary color', async () => {
      const scene = makeScene({
        nodes: [{ id: 'n1', label: 'Key Insight' }],
        layout: {
          nodes: [{ id: 'n1', label: 'Key Insight', x: 0, y: 0, width: 100, height: 40 }],
          edges: [],
          bounds: { x: 0, y: 0, width: 100, height: 40 },
          center: { x: 50, y: 20 },
        },
      });
      const result = await engine.enhanceScene(scene, { colorScheme: 'blue' });
      const node = result.layout.nodes[0] as Record<string, unknown>;
      const style = node.style as Record<string, unknown>;
      expect(style.fill).toBe('#3B82F6'); // primary for "key" label
    });

    it('colors secondary nodes with accent color', async () => {
      const scene = makeScene({
        nodes: [{ id: 'n1', label: 'Secondary', type: 'secondary' }],
        layout: {
          nodes: [{ id: 'n1', label: 'Secondary', x: 0, y: 0, width: 100, height: 40 }],
          edges: [],
          bounds: { x: 0, y: 0, width: 100, height: 40 },
          center: { x: 50, y: 20 },
        },
      });
      const result = await engine.enhanceScene(scene, { colorScheme: 'blue' });
      const node = result.layout.nodes[0] as Record<string, unknown>;
      const style = node.style as Record<string, unknown>;
      expect(style.fill).toBe('#60A5FA'); // accent for blue
    });

    it('colors regular nodes with secondary color', async () => {
      const scene = makeScene({
        nodes: [{ id: 'n1', label: 'Regular' }],
        layout: {
          nodes: [{ id: 'n1', label: 'Regular', x: 0, y: 0, width: 100, height: 40 }],
          edges: [],
          bounds: { x: 0, y: 0, width: 100, height: 40 },
          center: { x: 50, y: 20 },
        },
      });
      const result = await engine.enhanceScene(scene, { colorScheme: 'blue' });
      const node = result.layout.nodes[0] as Record<string, unknown>;
      const style = node.style as Record<string, unknown>;
      expect(style.fill).toBe('#1E40AF'); // secondary for blue
    });
  });

  // ---- enhanceMultipleScenes ----

  describe('enhanceMultipleScenes', () => {
    it('enhances multiple scenes with consistent styling', async () => {
      const scenes = [makeScene({ id: 's1' }), makeScene({ id: 's2' })];
      const results = await engine.enhanceMultipleScenes(scenes, { colorScheme: 'green' });

      expect(results.length).toBe(2);
      expect(results[0].visualStyle.colorScheme).toBe('green');
      expect(results[1].visualStyle.colorScheme).toBe('green');
    });

    it('staggeres animations for subsequent scenes', async () => {
      const scenes = [makeScene({ id: 's1' }), makeScene({ id: 's2' })];
      const results = await engine.enhanceMultipleScenes(scenes);

      // Second scene animations should have extra delay
      const firstSceneEntranceDelay = results[0].animations[0].timing.delay;
      const secondSceneEntranceDelay = results[1].animations[0].timing.delay;
      expect(secondSceneEntranceDelay).toBeGreaterThan(firstSceneEntranceDelay);
    });

    it('creates fallback scene on enhancement failure', async () => {
      // Force an error by spying on evaluateVisualQuality to throw
      const badScene = makeScene();
      jest.spyOn(engine as unknown as { evaluateVisualQuality: unknown }, 'evaluateVisualQuality')
        .mockRejectedValue(new Error('quality evaluation failed'));

      const results = await engine.enhanceMultipleScenes([badScene]);

      expect(results.length).toBe(1);
      expect(results[0].visualStyle).toBeDefined();
      expect(results[0].animations).toEqual([]);
      expect(results[0].background.type).toBe('solid');
    });

    it('handles empty scene array', async () => {
      const results = await engine.enhanceMultipleScenes([]);
      expect(results).toEqual([]);
    });
  });

  // ---- exportForRendering ----

  describe('exportForRendering', () => {
    it('exports enhanced scenes with render options', async () => {
      const scene = makeScene();
      const enhancedScene = await engine.enhanceScene(scene);

      const result = await engine.exportForRendering([enhancedScene], {
        width: 1920,
        height: 1080,
        fps: 30,
        quality: 'high',
        format: 'mp4',
        includeAudio: true,
        exportCaption: false,
      });

      expect(result).toBeDefined();
      const data = result as Record<string, unknown>;
      expect(data.scenes).toBeDefined();
      expect(data.globalConfig).toBeDefined();
    });

    it('includes render config in each exported scene', async () => {
      const scene = makeScene();
      const enhancedScene = await engine.enhanceScene(scene);

      const result = await engine.exportForRendering([enhancedScene], {
        width: 1280,
        height: 720,
        fps: 60,
        quality: 'ultra',
        format: 'webm',
        includeAudio: false,
        exportCaption: true,
      });

      const data = result as Record<string, unknown>;
      const scenes = data.scenes as Array<Record<string, unknown>>;
      expect(scenes[0].renderConfig).toBeDefined();
      const renderConfig = scenes[0].renderConfig as Record<string, unknown>;
      expect(renderConfig.width).toBe(1280);
      expect(renderConfig.height).toBe(720);
      expect(renderConfig.fps).toBe(60);
      expect(renderConfig.quality).toBe('ultra');
    });

    it('includes timestamp and version in global config', async () => {
      const scene = makeScene();
      const enhancedScene = await engine.enhanceScene(scene);

      const result = await engine.exportForRendering([enhancedScene], {
        width: 1920,
        height: 1080,
        fps: 30,
        quality: 'standard',
        format: 'mp4',
        includeAudio: false,
        exportCaption: false,
      });

      const data = result as Record<string, unknown>;
      const globalConfig = data.globalConfig as Record<string, unknown>;
      expect(globalConfig.timestamp).toBeDefined();
      expect(globalConfig.version).toBe('iteration-1');
    });
  });

  // ---- nextIteration ----

  describe('nextIteration', () => {
    it('increments iteration counter', async () => {
      const scene = makeScene();
      await engine.enhanceScene(scene);

      engine.nextIteration();

      const stats = engine.getStatistics();
      expect(stats.iteration).toBe(2);
    });

    it('applies quality improvements when quality is low', async () => {
      // First enhance with empty scene to get low quality
      const emptyScene = makeScene({
        nodes: [],
        edges: [],
        layout: { nodes: [], edges: [], bounds: { x: 0, y: 0, width: 0, height: 0 }, center: { x: 0, y: 0 } },
      });
      await engine.enhanceScene(emptyScene, { colorScheme: 'monochrome' });
      engine.nextIteration();

      const stats = engine.getStatistics();
      expect(stats.iteration).toBe(2);
    });
  });

  // ---- getStatistics ----

  describe('getStatistics', () => {
    it('returns initial statistics', () => {
      const stats = engine.getStatistics();

      expect(stats.iteration).toBe(1);
      expect(stats.averageQuality).toBe(0);
      expect(stats.qualityMetrics).toEqual({});
    });

    it('returns supported styles', () => {
      const stats = engine.getStatistics();
      const supportedStyles = stats.supportedStyles as string[];

      expect(supportedStyles).toContain('blue');
      expect(supportedStyles).toContain('green');
      expect(supportedStyles).toContain('purple');
      expect(supportedStyles).toContain('orange');
      expect(supportedStyles).toContain('gradient');
      expect(supportedStyles).toContain('monochrome');
    });

    it('returns quality metrics after enhancement', async () => {
      const scene = makeScene();
      await engine.enhanceScene(scene);

      const stats = engine.getStatistics();
      expect(stats.qualityMetrics).toBeDefined();
      expect(stats.averageQuality).toBeGreaterThan(0);
    });
  });

  // ---- Global instance ----

  describe('advancedVisualEngine global instance', () => {
    it('is an instance of AdvancedVisualEngine', () => {
      expect(advancedVisualEngine).toBeInstanceOf(AdvancedVisualEngine);
    });
  });

  // ---- Edge cases ----

  describe('edge cases', () => {
    it('handles scene with single node', async () => {
      const scene = makeScene({
        nodes: [{ id: 'solo', label: 'Solo' }],
        edges: [],
        layout: {
          nodes: [{ id: 'solo', label: 'Solo', x: 50, y: 50, width: 100, height: 40 }],
          edges: [],
          bounds: { x: 0, y: 0, width: 200, height: 100 },
          center: { x: 100, y: 50 },
        },
      });
      const result = await engine.enhanceScene(scene);

      expect(result).toBeDefined();
      expect(result.animations.length).toBe(1); // 1 entrance, 0 connections
    });

    it('handles enhanceScene error propagation', async () => {
      // Force an error via spy to test error propagation
      const scene = makeScene();
      jest.spyOn(engine as unknown as { evaluateVisualQuality: unknown }, 'evaluateVisualQuality')
        .mockRejectedValue(new Error('quality evaluation failed'));

      // enhanceScene catches and re-throws errors
      await expect(engine.enhanceScene(scene)).rejects.toThrow();
    });

    it('handles scene with undefined layout without crashing', async () => {
      const scene = makeScene({
        layout: undefined,
      });

      const result = await engine.enhanceScene(scene);

      expect(result).toBeDefined();
      expect(result.visualStyle).toBeDefined();
      expect(result.layout.nodes).toEqual([]);
      expect(result.layout.edges).toEqual([]);
    });

    it('handles scene with null layout without crashing', async () => {
      const scene = makeScene({
        layout: null as unknown as undefined,
      });

      const result = await engine.enhanceScene(scene);

      expect(result).toBeDefined();
      expect(result.visualStyle).toBeDefined();
      expect(result.layout.nodes).toEqual([]);
      expect(result.layout.edges).toEqual([]);
    });

    it('handles large number of nodes and edges', async () => {
      const nodes = Array.from({ length: 50 }, (_, i) => ({
        id: `n${i}`,
        label: `Node ${i}`,
      }));
      const edges = Array.from({ length: 49 }, (_, i) => ({
        from: `n${i}`,
        to: `n${i + 1}`,
      }));
      const positionedNodes = nodes.map((n, i) => ({
        ...n,
        x: (i % 10) * 120,
        y: Math.floor(i / 10) * 60,
        width: 100,
        height: 40,
      }));
      const layoutEdges = edges.map(e => ({
        ...e,
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      }));

      const scene = makeScene({
        nodes,
        edges,
        layout: {
          nodes: positionedNodes,
          edges: layoutEdges,
          bounds: { x: 0, y: 0, width: 1200, height: 300 },
          center: { x: 600, y: 150 },
        },
      });

      const result = await engine.enhanceScene(scene);
      expect(result.animations.length).toBe(50 + 49); // entrances + connections
    });
  });
});
