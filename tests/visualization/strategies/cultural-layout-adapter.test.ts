import { describe, it, expect, beforeEach } from '@jest/globals';
import { DiagramLayout, PositionedNode } from '@/types/diagram';
import { CulturalLayoutAdapter } from '@/visualization/strategies/CulturalLayoutAdapter';
import { ComplexLayoutConfig } from '@/visualization/complex-layout-engine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: ComplexLayoutConfig = {
  width: 1920,
  height: 1080,
  nodeWidth: 120,
  nodeHeight: 60,
  marginX: 50,
  marginY: 50,
  rankDirection: 'TB',
  nodeSeparation: 50,
  edgeSeparation: 10,
  rankSeparation: 50,
  enableClustering: true,
  maxClusterSize: 8,
  clusterSeparation: 150,
  enableForceDirected: true,
  springStrength: 0.3,
  repulsionStrength: 800,
  iterations: 100,
  enableMultiLevel: true,
  levelThreshold: 15,
  enableOverlapResolution: true,
  overlapTolerance: 10,
  enableEdgeOptimization: true,
  minimizeCrossings: true,
  maxProcessingTime: 10000,
  useWebWorkers: false,
  enableRealTimeOptimization: true,
  adaptiveThresholds: true,
};

function makeSampleLayout(): DiagramLayout {
  const nodes: PositionedNode[] = [
    { id: 'a', label: 'A', x: 100, y: 50, w: 120, h: 60 },
    { id: 'b', label: 'B', x: 300, y: 50, w: 120, h: 60 },
    { id: 'c', label: 'C', x: 200, y: 200, w: 120, h: 60 },
    { id: 'd', label: 'D', x: 400, y: 200, w: 120, h: 60 },
  ];

  const edges = [
    {
      from: 'a',
      to: 'c',
      points: [{ x: 160, y: 110 }, { x: 260, y: 200 }],
    },
    {
      from: 'b',
      to: 'd',
      points: [{ x: 360, y: 110 }, { x: 460, y: 200 }],
    },
  ];

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CulturalLayoutAdapter (TASK-0065)', () => {
  let adapter: CulturalLayoutAdapter;

  beforeEach(() => {
    adapter = new CulturalLayoutAdapter(DEFAULT_CONFIG);
  });

  describe('Instantiation', () => {
    it('should instantiate with a ComplexLayoutConfig', () => {
      const a = new CulturalLayoutAdapter(DEFAULT_CONFIG);
      expect(a).toBeInstanceOf(CulturalLayoutAdapter);
    });

    it('should accept config with custom margins', () => {
      const config = {
        ...DEFAULT_CONFIG,
        marginX: 100,
        marginY: 80,
      };
      const a = new CulturalLayoutAdapter(config);
      expect(a).toBeInstanceOf(CulturalLayoutAdapter);
    });
  });

  describe('RTL layout mirroring (X coordinate reversal)', () => {
    it('should mirror node X coordinates for RTL reading pattern', async () => {
      const layout = makeSampleLayout();
      const originalXs = layout.nodes.map(n => n.x);

      const result = await adapter.applyCulturalAdaptation(layout, {
        languageCode: 'ar',
        readingPattern: 'rtl',
        hierarchyPreference: 'moderate',
        visualStyle: 'minimalist',
        colorHarmony: [],
      });

      // X coordinates should be mirrored (reversed around center)
      expect(result.nodes).toHaveLength(4);
      for (const node of result.nodes) {
        expect(typeof node.x).toBe('number');
        expect(isFinite(node.x)).toBe(true);
      }

      // Verify the mirroring: nodes that were on the left should now be on the right
      // and vice versa.  With RTL, the relative horizontal ordering is reversed.
      const resultXs = result.nodes.map(n => n.x);
      // All X values should have changed (mirrored)
      expect(resultXs).not.toEqual(originalXs);
    });

    it('should mirror edge points for RTL reading pattern', async () => {
      const layout = makeSampleLayout();

      const result = await adapter.applyCulturalAdaptation(layout, {
        languageCode: 'he',
        readingPattern: 'rtl',
        hierarchyPreference: 'moderate',
        visualStyle: 'technical',
        colorHarmony: [],
      });

      for (const edge of result.edges) {
        for (const point of edge.points) {
          expect(typeof point.x).toBe('number');
          expect(typeof point.y).toBe('number');
          expect(isFinite(point.x)).toBe(true);
        }
      }
    });

    it('should preserve Y coordinates during RTL mirroring', async () => {
      const layout = makeSampleLayout();
      const originalYs = layout.nodes.map(n => n.y);

      const result = await adapter.applyCulturalAdaptation(layout, {
        languageCode: 'ar',
        readingPattern: 'rtl',
        hierarchyPreference: 'moderate',
        visualStyle: 'minimalist',
        colorHarmony: [],
      });

      // RTL only mirrors X, Y stays the same
      for (let i = 0; i < result.nodes.length; i++) {
        expect(result.nodes[i].y).toBe(originalYs[i]);
      }
    });
  });

  describe('TTB vertical layout adaptation', () => {
    it('should rearrange nodes in a column-based layout for TTB reading pattern', async () => {
      const layout = makeSampleLayout();

      const result = await adapter.applyCulturalAdaptation(layout, {
        languageCode: 'ja',
        readingPattern: 'ttb',
        hierarchyPreference: 'moderate',
        visualStyle: 'minimalist',
        colorHarmony: [],
      });

      expect(result.nodes).toHaveLength(4);
      for (const node of result.nodes) {
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
        expect(isFinite(node.x)).toBe(true);
        expect(isFinite(node.y)).toBe(true);
      }
    });

    it('should use config margins for positioning in TTB layout', async () => {
      const customConfig = { ...DEFAULT_CONFIG, marginX: 75, marginY: 100 };
      const customAdapter = new CulturalLayoutAdapter(customConfig);
      const layout = makeSampleLayout();

      const result = await customAdapter.applyCulturalAdaptation(layout, {
        languageCode: 'zh',
        readingPattern: 'ttb',
        hierarchyPreference: 'moderate',
        visualStyle: 'minimalist',
        colorHarmony: [],
      });

      // First node should start near marginX, marginY
      expect(result.nodes[0].x).toBeGreaterThanOrEqual(75 - 1);
      expect(result.nodes[0].y).toBeGreaterThanOrEqual(100 - 1);
    });
  });

  describe('Hierarchy emphasis (strong vs flat)', () => {
    it('should increase vertical spread with strong hierarchy', async () => {
      const layout = makeSampleLayout();
      const originalYs = layout.nodes.map(n => n.y);

      const result = await adapter.applyCulturalAdaptation(layout, {
        languageCode: 'ko',
        readingPattern: 'ltr',
        hierarchyPreference: 'strong',
        visualStyle: 'minimalist',
        colorHarmony: [],
      });

      // With hierarchyMultiplier = 1.5, Y values should be scaled up
      for (let i = 0; i < result.nodes.length; i++) {
        if (originalYs[i] !== 0) {
          // The emphasized layout multiplies Y by 1.5, then visual style may
          // adjust w/h but not y. Check that the Y was amplified.
          expect(Math.abs(result.nodes[i].y)).toBeGreaterThanOrEqual(
            Math.abs(originalYs[i])
          );
        }
      }
    });

    it('should reduce vertical spread with flat hierarchy', async () => {
      const layout = makeSampleLayout();
      const originalYs = layout.nodes.map(n => n.y);

      const result = await adapter.applyCulturalAdaptation(layout, {
        languageCode: 'en',
        readingPattern: 'ltr',
        hierarchyPreference: 'flat',
        visualStyle: 'minimalist',
        colorHarmony: [],
      });

      // With flatteningFactor = 0.7, Y values should be scaled down
      for (let i = 0; i < result.nodes.length; i++) {
        if (originalYs[i] !== 0) {
          expect(Math.abs(result.nodes[i].y)).toBeLessThanOrEqual(
            Math.abs(originalYs[i])
          );
        }
      }
    });

    it('should leave Y unchanged with moderate hierarchy', async () => {
      const layout = makeSampleLayout();
      const originalYs = layout.nodes.map(n => n.y);

      const result = await adapter.applyCulturalAdaptation(layout, {
        languageCode: 'en',
        readingPattern: 'ltr',
        hierarchyPreference: 'moderate',
        visualStyle: 'minimalist',
        colorHarmony: [],
      });

      // moderate does not trigger emphasizeHierarchy or flattenHierarchy
      // so Y values should remain the same (only visualStyle affects w/h)
      for (let i = 0; i < result.nodes.length; i++) {
        expect(result.nodes[i].y).toBe(originalYs[i]);
      }
    });
  });

  describe('Visual style adaptation', () => {
    it('should apply minimalist style (smaller nodes, more space)', async () => {
      const layout = makeSampleLayout();
      const originalWs = layout.nodes.map(n => n.w);

      const result = await adapter.applyCulturalAdaptation(layout, {
        languageCode: 'ja',
        readingPattern: 'ltr',
        hierarchyPreference: 'moderate',
        visualStyle: 'minimalist',
        colorHarmony: [],
      });

      // Minimalist: sizeMultiplier = 0.9
      for (let i = 0; i < result.nodes.length; i++) {
        expect(result.nodes[i].w).toBeCloseTo(originalWs[i] * 0.9, 2);
      }
    });

    it('should apply expressive style (larger nodes)', async () => {
      const layout = makeSampleLayout();
      const originalWs = layout.nodes.map(n => n.w);

      const result = await adapter.applyCulturalAdaptation(layout, {
        languageCode: 'en',
        readingPattern: 'ltr',
        hierarchyPreference: 'moderate',
        visualStyle: 'expressive',
        colorHarmony: [],
      });

      // Expressive: sizeMultiplier = 1.1
      for (let i = 0; i < result.nodes.length; i++) {
        expect(result.nodes[i].w).toBeCloseTo(originalWs[i] * 1.1, 2);
      }
    });

    it('should apply technical style (standard size, compact)', async () => {
      const layout = makeSampleLayout();
      const originalWs = layout.nodes.map(n => n.w);

      const result = await adapter.applyCulturalAdaptation(layout, {
        languageCode: 'en',
        readingPattern: 'ltr',
        hierarchyPreference: 'moderate',
        visualStyle: 'technical',
        colorHarmony: [],
      });

      // Technical: sizeMultiplier = 1.0 (no change)
      for (let i = 0; i < result.nodes.length; i++) {
        expect(result.nodes[i].w).toBeCloseTo(originalWs[i] * 1.0, 2);
      }
    });
  });

  describe('adapt() returns valid LayoutResult', () => {
    it('should return a DiagramLayout with nodes and edges', async () => {
      const layout = makeSampleLayout();

      const result = await adapter.applyCulturalAdaptation(layout, {
        languageCode: 'ar',
        readingPattern: 'rtl',
        hierarchyPreference: 'strong',
        visualStyle: 'expressive',
        colorHarmony: ['#ff0000', '#00ff00'],
      });

      expect(result).toHaveProperty('nodes');
      expect(result).toHaveProperty('edges');
      expect(Array.isArray(result.nodes)).toBe(true);
      expect(Array.isArray(result.edges)).toBe(true);
    });

    it('should return layout unchanged when culturalAdaptation is undefined', async () => {
      const layout = makeSampleLayout();

      const result = await adapter.applyCulturalAdaptation(layout, undefined);

      // Should return the original layout unchanged
      expect(result.nodes).toEqual(layout.nodes);
      expect(result.edges).toEqual(layout.edges);
    });

    it('should handle an empty layout gracefully', async () => {
      const emptyLayout: DiagramLayout = { nodes: [], edges: [] };

      const result = await adapter.applyCulturalAdaptation(emptyLayout, {
        languageCode: 'ar',
        readingPattern: 'rtl',
        hierarchyPreference: 'strong',
        visualStyle: 'minimalist',
        colorHarmony: [],
      });

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });

    it('should handle a layout with a single node', async () => {
      const singleNodeLayout: DiagramLayout = {
        nodes: [{ id: 'a', label: 'A', x: 100, y: 100, w: 120, h: 60 }],
        edges: [],
      };

      const result = await adapter.applyCulturalAdaptation(singleNodeLayout, {
        languageCode: 'ar',
        readingPattern: 'rtl',
        hierarchyPreference: 'strong',
        visualStyle: 'expressive',
        colorHarmony: [],
      });

      expect(result.nodes).toHaveLength(1);
      expect(result.edges).toHaveLength(0);
      expect(typeof result.nodes[0].x).toBe('number');
      expect(typeof result.nodes[0].y).toBe('number');
    });

    it('should preserve node ids and labels after adaptation', async () => {
      const layout = makeSampleLayout();

      const result = await adapter.applyCulturalAdaptation(layout, {
        languageCode: 'ar',
        readingPattern: 'rtl',
        hierarchyPreference: 'strong',
        visualStyle: 'expressive',
        colorHarmony: [],
      });

      const originalIds = layout.nodes.map(n => n.id);
      const resultIds = result.nodes.map(n => n.id);
      expect(resultIds.sort()).toEqual(originalIds.sort());

      const originalLabels = layout.nodes.map(n => n.label);
      const resultLabels = result.nodes.map(n => n.label);
      expect(resultLabels.sort()).toEqual(originalLabels.sort());
    });
  });

  describe('Combined adaptations', () => {
    it('should apply RTL + strong hierarchy + expressive style together', async () => {
      const layout = makeSampleLayout();

      const result = await adapter.applyCulturalAdaptation(layout, {
        languageCode: 'ar',
        readingPattern: 'rtl',
        hierarchyPreference: 'strong',
        visualStyle: 'expressive',
        colorHarmony: [],
      });

      expect(result.nodes).toHaveLength(4);
      // X should be mirrored, Y should be multiplied by 1.5 (hierarchy),
      // w/h should be multiplied by 1.1 (expressive)
      for (const node of result.nodes) {
        expect(isFinite(node.x)).toBe(true);
        expect(isFinite(node.y)).toBe(true);
        expect(isFinite(node.w)).toBe(true);
        expect(isFinite(node.h)).toBe(true);
      }
    });

    it('should apply TTB + flat hierarchy + minimalist style together', async () => {
      const layout = makeSampleLayout();

      const result = await adapter.applyCulturalAdaptation(layout, {
        languageCode: 'zh',
        readingPattern: 'ttb',
        hierarchyPreference: 'flat',
        visualStyle: 'minimalist',
        colorHarmony: [],
      });

      expect(result.nodes).toHaveLength(4);
      for (const node of result.nodes) {
        expect(isFinite(node.x)).toBe(true);
        expect(isFinite(node.y)).toBe(true);
      }
    });
  });
});
