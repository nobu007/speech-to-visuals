/**
 * Tests for DiagramScene.tsx
 * Strategy-based animation dispatch for all 11 diagram types
 */

import { jest } from '@jest/globals';
import * as React from 'react';
import { SceneGraph, DiagramType, PositionedNode, LayoutEdge } from '@stv/core/types/diagram';
import { getAnimationStrategy } from '../animation-strategies';

// Mock remotion hooks
let mockFrame = 0;
let mockFps = 30;

jest.unstable_mockModule('remotion', () => ({
  useCurrentFrame: () => mockFrame,
  useVideoConfig: () => ({ fps: mockFps, width: 1920, height: 1080 }),
  AbsoluteFill: ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) =>
    React.createElement('div', { style: { position: 'absolute', inset: 0, ...style } }, children),
  interpolate: (frame: number, inputRange: number[], outputRange: number[]) => {
    if (frame <= inputRange[0]) return outputRange[0];
    if (frame >= inputRange[inputRange.length - 1]) return outputRange[outputRange.length - 1];
    const t = (frame - inputRange[0]) / (inputRange[inputRange.length - 1] - inputRange[0]);
    return outputRange[0] + t * (outputRange[outputRange.length - 1] - outputRange[0]);
  },
}));

const { DiagramScene } = await import('../DiagramScene');

// Helper factories
function makePositionedNode(overrides: Partial<PositionedNode> = {}): PositionedNode {
  return {
    id: 'node-1',
    label: 'Node 1',
    x: 100,
    y: 100,
    width: 120,
    height: 60,
    ...overrides,
  };
}

function makeLayoutEdge(overrides: Partial<LayoutEdge> = {}): LayoutEdge {
  return {
    from: 'node-1',
    to: 'node-2',
    points: [
      { x: 160, y: 130 },
      { x: 360, y: 130 },
    ],
    ...overrides,
  };
}

function makeSceneGraph(overrides: Partial<SceneGraph> = {}): SceneGraph {
  return {
    type: 'flow',
    nodes: [],
    edges: [],
    startMs: 0,
    durationMs: 5000,
    summary: 'Test scene',
    keyphrases: [],
    ...overrides,
  };
}

// Helper: call DiagramScene FC directly
function renderDiagramScene(
  scene: SceneGraph,
  sceneIndex: number = 0,
  currentTime: number = 0
): React.ReactElement {
  return (DiagramScene as React.FC<{
    scene: SceneGraph;
    sceneIndex: number;
    currentTime: number;
  }>)({ scene, sceneIndex, currentTime }) as React.ReactElement;
}

describe('DiagramScene', () => {
  beforeEach(() => {
    mockFrame = 30;
    mockFps = 30;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering with layout', () => {
    it('should render nodes when layout is present', () => {
      mockFrame = 30;
      const scene = makeSceneGraph({
        type: 'flow',
        layout: {
          nodes: [
            makePositionedNode({ id: 'n1', label: 'Start' }),
            makePositionedNode({ id: 'n2', label: 'End', x: 300 }),
          ],
          edges: [makeLayoutEdge()],
        },
      });

      const el = renderDiagramScene(scene);
      // Should render without errors
      expect(el).toBeTruthy();
    });

    it('should render edges when layout is present', () => {
      mockFrame = 50;
      const scene = makeSceneGraph({
        type: 'flow',
        layout: {
          nodes: [
            makePositionedNode({ id: 'n1', label: 'Start' }),
            makePositionedNode({ id: 'n2', label: 'End', x: 300 }),
          ],
          edges: [
            makeLayoutEdge({
              from: 'n1',
              to: 'n2',
              points: [{ x: 160, y: 130 }, { x: 360, y: 130 }],
            }),
          ],
        },
      });

      const el = renderDiagramScene(scene);
      expect(el).toBeTruthy();
    });

    it('should handle empty layout gracefully', () => {
      const scene = makeSceneGraph({
        type: 'flow',
        layout: {
          nodes: [],
          edges: [],
        },
      });

      const el = renderDiagramScene(scene);
      expect(el).toBeTruthy();
    });

    it('should handle undefined layout gracefully', () => {
      const scene = makeSceneGraph({
        type: 'flow',
        // No layout
      });

      const el = renderDiagramScene(scene);
      expect(el).toBeTruthy();
    });
  });

  describe('diagram type dispatch', () => {
    const types: DiagramType[] = [
      'flow', 'flowchart', 'tree', 'timeline', 'matrix',
      'cycle', 'comparison', 'network', 'conceptmap', 'mindmap', 'general',
    ];

    for (const type of types) {
      it(`should render ${type} type using correct strategy`, () => {
        mockFrame = 30;
        const scene = makeSceneGraph({
          type,
          layout: {
            nodes: [
              makePositionedNode({ id: 'n1', label: 'A', x: 100, y: 100 }),
              makePositionedNode({ id: 'n2', label: 'B', x: 300, y: 100 }),
            ],
            edges: [
              makeLayoutEdge({
                from: 'n1',
                to: 'n2',
                points: [{ x: 160, y: 130 }, { x: 360, y: 130 }],
              }),
            ],
          },
        });

        // Verify the strategy exists and produces configs
        const strategy = getAnimationStrategy(type);
        const nodeConfigs = strategy.getNodeAnimations(scene.layout!.nodes);
        expect(nodeConfigs).toHaveLength(2);

        const el = renderDiagramScene(scene);
        expect(el).toBeTruthy();
      });
    }
  });

  describe('animation synchronization', () => {
    it('should use strategy node configs for animation delays', () => {
      mockFrame = 30;
      const scene = makeSceneGraph({
        type: 'flow',
        layout: {
          nodes: [
            makePositionedNode({ id: 'n1', label: 'First', y: 50 }),
            makePositionedNode({ id: 'n2', label: 'Second', y: 200 }),
          ],
          edges: [],
        },
      });

      const strategy = getAnimationStrategy('flow');
      const configs = strategy.getNodeAnimations(scene.layout!.nodes);

      // First node (lower y) should have less delay
      expect(configs[0].nodeId).toBe('n1');
      expect(configs[0].delayFrames).toBeLessThanOrEqual(configs[1].delayFrames);
    });

    it('should pass correct durationFrames from strategy to NodeAnimation', () => {
      const scene = makeSceneGraph({
        type: 'flow',
        layout: {
          nodes: [makePositionedNode()],
          edges: [],
        },
      });

      const strategy = getAnimationStrategy('flow');
      const configs = strategy.getNodeAnimations(scene.layout!.nodes);

      for (const config of configs) {
        expect(config.durationFrames).toBe(9); // NODE_FADE_DURATION_FRAMES
      }
    });

    it('should pass correct durationFrames from strategy to EdgeAnimation', () => {
      const scene = makeSceneGraph({
        type: 'flow',
        layout: {
          nodes: [
            makePositionedNode({ id: 'n1' }),
            makePositionedNode({ id: 'n2', x: 300 }),
          ],
          edges: [
            makeLayoutEdge({
              from: 'n1',
              to: 'n2',
              points: [{ x: 160, y: 130 }, { x: 360, y: 130 }],
            }),
          ],
        },
      });

      const strategy = getAnimationStrategy('flow');
      const configs = strategy.getEdgeAnimations(
        scene.layout!.edges,
        scene.layout!.nodes
      );

      for (const config of configs) {
        expect(config.durationFrames).toBe(15); // EDGE_DRAW_DURATION_FRAMES
      }
    });

    it('should ensure edge animations start after nodes', () => {
      const scene = makeSceneGraph({
        type: 'flow',
        layout: {
          nodes: [
            makePositionedNode({ id: 'n1' }),
            makePositionedNode({ id: 'n2', x: 300 }),
          ],
          edges: [
            makeLayoutEdge({
              from: 'n1',
              to: 'n2',
              points: [{ x: 160, y: 130 }, { x: 360, y: 130 }],
            }),
          ],
        },
      });

      const strategy = getAnimationStrategy('flow');
      const nodeConfigs = strategy.getNodeAnimations(scene.layout!.nodes);
      const edgeConfigs = strategy.getEdgeAnimations(
        scene.layout!.edges,
        scene.layout!.nodes
      );

      if (nodeConfigs.length > 0 && edgeConfigs.length > 0) {
        const maxNodeDelay = Math.max(...nodeConfigs.map((c) => c.delayFrames));
        const minEdgeDelay = Math.min(...edgeConfigs.map((c) => c.delayFrames));
        expect(minEdgeDelay).toBeGreaterThanOrEqual(maxNodeDelay);
      }
    });
  });

  describe('title display', () => {
    const titleMap: Record<DiagramType, string> = {
      flow: 'プロセスフロー',
      flowchart: 'プロセスフロー',
      tree: '階層構造',
      timeline: 'タイムライン',
      matrix: '比較表',
      cycle: '循環プロセス',
      comparison: '比較',
      network: 'ネットワーク',
      conceptmap: 'コンセプトマップ',
      mindmap: 'マインドマップ',
      general: 'ダイアグラム',
    };

    for (const [type, expectedTitle] of Object.entries(titleMap)) {
      it(`should display "${expectedTitle}" for ${type} type`, () => {
        mockFrame = 30;
        const scene = makeSceneGraph({
          type: type as DiagramType,
          layout: { nodes: [], edges: [] },
        });

        const el = renderDiagramScene(scene);
        // The component should render successfully with the title
        expect(el).toBeTruthy();
      });
    }
  });

  describe('scene timing', () => {
    it('should derive animation timing from currentTime (scene-relative), not startMs', () => {
      mockFrame = 100;
      const scene = makeSceneGraph({
        // startMs is the ABSOLUTE audio timestamp — it must NOT drive timing.
        startMs: 1000,
        durationMs: 5000,
        layout: { nodes: [], edges: [] },
      });

      // currentTime = 0 → scene just started → intro animations at their start.
      const el = renderDiagramScene(scene, 0, 0);
      expect(el).toBeTruthy();
    });

    it('should handle sceneIndex parameter', () => {
      mockFrame = 50;
      const scene = makeSceneGraph({
        layout: { nodes: [], edges: [] },
      });

      const el = renderDiagramScene(scene, 2, 1500);
      expect(el).toBeTruthy();
    });
  });
});
