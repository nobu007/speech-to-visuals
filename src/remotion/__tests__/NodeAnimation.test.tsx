/**
 * Tests for NodeAnimation.tsx
 * Node fade-in animation: 0.3s = 9 frames at 30fps
 */

import * as React from 'react';
import {
  NodeAnimation,
  calculateNodeOpacity,
  calculateNodeScale,
  NODE_FADE_DURATION_SEC,
} from '../NodeAnimation';
import { PositionedNode } from '@/types/diagram';
import { NODE_FADE_DURATION_FRAMES } from '../animation-strategies';

// Mock remotion hooks - return controlled values via module-level variables
let mockFrame = 0;
let mockFps = 30;

vi.mock('remotion', () => {
  const originalModule = vi.requireActual('remotion');
  return {
    ...originalModule,
    useCurrentFrame: () => mockFrame,
    useVideoConfig: () => ({ fps: mockFps, width: 1920, height: 1080 }),
  };
});

// Helper to create a positioned node
function makeNode(overrides: Partial<PositionedNode> = {}): PositionedNode {
  return {
    id: 'test-node',
    label: 'Test Node',
    x: 100,
    y: 200,
    width: 120,
    height: 60,
    ...overrides,
  };
}

// Helper: call the NodeAnimation FC directly and extract style from the returned element
function renderAndGetStyle(
  node: PositionedNode,
  delayFrames: number,
  durationFrames: number = NODE_FADE_DURATION_FRAMES
): React.CSSProperties {
  // Call the component function directly (as React would during render)
  const element = (NodeAnimation as React.FC<{
    node: PositionedNode;
    delayFrames: number;
    durationFrames: number;
    children: React.ReactNode;
  }>)({
    node,
    delayFrames,
    durationFrames,
    children: React.createElement('div', null, 'Test Content'),
  }) as React.ReactElement;
  return element.props.style as React.CSSProperties;
}

describe('NodeAnimation', () => {
  beforeEach(() => {
    mockFrame = 0;
    mockFps = 30;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constants', () => {
    it('should export NODE_FADE_DURATION_SEC as 0.3', () => {
      expect(NODE_FADE_DURATION_SEC).toBe(0.3);
    });
  });

  describe('calculateNodeOpacity', () => {
    it('should return 0 at frame 0 with no delay', () => {
      expect(calculateNodeOpacity(0, 0, 30)).toBe(0);
    });

    it('should return 1 at frame 9 (0.3s at 30fps) with no delay', () => {
      expect(calculateNodeOpacity(9, 0, 30)).toBe(1);
    });

    it('should return 0.5 at approximately frame 4.5', () => {
      const opacity = calculateNodeOpacity(4.5, 0, 30);
      expect(opacity).toBeCloseTo(0.5, 1);
    });

    it('should respect delay frames', () => {
      expect(calculateNodeOpacity(5, 5, 30)).toBe(0);
      const opacity = calculateNodeOpacity(10, 5, 30);
      expect(opacity).toBeGreaterThan(0);
      expect(opacity).toBeLessThan(1);
    });

    it('should complete at delay + 9 frames', () => {
      expect(calculateNodeOpacity(14, 5, 30)).toBe(1);
    });

    it('should clamp opacity to 0 before start', () => {
      expect(calculateNodeOpacity(3, 5, 30)).toBe(0);
    });

    it('should clamp opacity to 1 after completion', () => {
      expect(calculateNodeOpacity(100, 5, 30)).toBe(1);
    });
  });

  describe('calculateNodeScale', () => {
    it('should return 0 at frame 0 with no delay', () => {
      expect(calculateNodeScale(0, 0, 30)).toBe(0);
    });

    it('should return 1 at frame 9 (0.3s at 30fps) with no delay', () => {
      expect(calculateNodeScale(9, 0, 30)).toBe(1);
    });

    it('should scale from 0 to 1 linearly', () => {
      const scale = calculateNodeScale(4.5, 0, 30);
      expect(scale).toBeCloseTo(0.5, 1);
    });

    it('should clamp scale to 0 before delay', () => {
      expect(calculateNodeScale(3, 5, 30)).toBe(0);
    });

    it('should clamp scale to 1 after completion', () => {
      expect(calculateNodeScale(100, 5, 30)).toBe(1);
    });
  });

  describe('NodeAnimation component rendering', () => {
    it('should apply opacity 0 at frame 0', () => {
      mockFrame = 0;
      const node = makeNode();
      const style = renderAndGetStyle(node, 0);

      expect(style.opacity).toBe(0);
    });

    it('should apply opacity 1 after animation completes', () => {
      mockFrame = 20;
      const node = makeNode();
      const style = renderAndGetStyle(node, 0);

      expect(style.opacity).toBe(1);
    });

    it('should position node at node coordinates', () => {
      mockFrame = 20;
      const node = makeNode({ x: 250, y: 350 });
      const style = renderAndGetStyle(node, 0);

      expect(style.left).toBe(250);
      expect(style.top).toBe(350);
    });

    it('should use node width and height', () => {
      mockFrame = 20;
      const node = makeNode({ width: 200, height: 80 });
      const style = renderAndGetStyle(node, 0);

      expect(style.width).toBe(200);
      expect(style.height).toBe(80);
    });

    it('should apply scale transform during animation', () => {
      mockFrame = 4.5;
      const node = makeNode();
      const style = renderAndGetStyle(node, 0);

      expect(style.transform).toContain('scale');
    });

    it('should apply scale 0 at frame 0', () => {
      mockFrame = 0;
      const node = makeNode();
      const style = renderAndGetStyle(node, 0);

      expect(style.transform).toContain('scale(0)');
    });

    it('should apply scale 1 after completion', () => {
      mockFrame = 20;
      const node = makeNode();
      const style = renderAndGetStyle(node, 0);

      expect(style.transform).toContain('scale(1)');
    });

    it('should respect delayFrames for opacity', () => {
      mockFrame = 3;
      const node = makeNode();
      const style = renderAndGetStyle(node, 5);

      expect(style.opacity).toBe(0);

      mockFrame = 10;
      const style2 = renderAndGetStyle(node, 5);
      expect(style2.opacity).toBeGreaterThan(0);
      expect(style2.opacity).toBeLessThan(1);
    });

    it('should set position to absolute', () => {
      mockFrame = 20;
      const node = makeNode();
      const style = renderAndGetStyle(node, 0);

      expect(style.position).toBe('absolute');
    });
  });
});
