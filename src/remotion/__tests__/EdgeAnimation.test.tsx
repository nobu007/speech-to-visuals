/**
 * Tests for EdgeAnimation.tsx
 * Edge drawing animation: 0.5s = 15 frames at 30fps
 * Uses SVG stroke-dasharray/dashoffset technique
 */

import { jest } from '@jest/globals';
import * as React from 'react';
import { LayoutEdge, PositionedNode } from '@stv/core/types/diagram';
import { EDGE_DRAW_DURATION_FRAMES } from '../animation-strategies';

// Mock remotion hooks - return controlled values via module-level variables.
// IMPORTANT: this project runs Jest in ESM mode (--experimental-vm-modules),
// where jest.mock() CANNOT intercept ESM imports. jest.unstable_mockModule is
// required, and the module under test must be loaded via dynamic import AFTER
// the mock is registered (cf. NodeAnimation.test.tsx and every other test in
// this directory). With the old jest.mock('remotion', ...) the REAL remotion
// stayed in place, so EdgeAnimation's useCurrentFrame() hit React.useContext
// with no Remotion provider and threw "Cannot read properties of null" — the
// 9 component-rendering failures this conversion fixes.
let mockFrame = 0;
let mockFps = 30;

jest.unstable_mockModule('remotion', () => ({
  useCurrentFrame: () => mockFrame,
  useVideoConfig: () => ({ fps: mockFps, width: 1920, height: 1080 }),
  interpolate: (frame: number, inputRange: number[], outputRange: number[]) => {
    if (frame <= inputRange[0]) return outputRange[0];
    if (frame >= inputRange[inputRange.length - 1]) return outputRange[outputRange.length - 1];
    const t = (frame - inputRange[0]) / (inputRange[inputRange.length - 1] - inputRange[0]);
    return outputRange[0] + t * (outputRange[outputRange.length - 1] - outputRange[0]);
  },
}));

const {
  EdgeAnimation,
  calculateEdgeProgress,
  EDGE_DRAW_DURATION_SEC,
  calculatePathLength,
  generatePathD,
} = await import('../EdgeAnimation');

// Helper factories
function makeEdge(overrides: Partial<LayoutEdge> = {}): LayoutEdge {
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

// Helper: call EdgeAnimation FC directly and return the rendered element
function renderEdge(element: React.ReactElement): React.ReactElement {
  // For function components, call them directly
  if (typeof element.type === 'function') {
    return (element.type as (...args: unknown[]) => unknown)(element.props) as React.ReactElement;
  }
  return element;
}

describe('EdgeAnimation', () => {
  beforeEach(() => {
    mockFrame = 0;
    mockFps = 30;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constants', () => {
    it('should export EDGE_DRAW_DURATION_SEC as 0.5', () => {
      expect(EDGE_DRAW_DURATION_SEC).toBe(0.5);
    });
  });

  describe('calculatePathLength', () => {
    it('should calculate length of a straight horizontal line', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ];
      expect(calculatePathLength(points)).toBe(100);
    });

    it('should calculate length of a straight vertical line', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 0, y: 50 },
      ];
      expect(calculatePathLength(points)).toBe(50);
    });

    it('should calculate length of a diagonal line', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 30, y: 40 },
      ];
      expect(calculatePathLength(points)).toBeCloseTo(50, 1);
    });

    it('should calculate total length of multi-segment path', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ];
      expect(calculatePathLength(points)).toBe(200);
    });

    it('should return 0 for a single point', () => {
      expect(calculatePathLength([{ x: 50, y: 50 }])).toBe(0);
    });

    it('should return 0 for empty points', () => {
      expect(calculatePathLength([])).toBe(0);
    });
  });

  describe('calculateEdgeProgress', () => {
    it('should return 0 at frame 0 with no delay', () => {
      expect(calculateEdgeProgress(0, 0, 30)).toBe(0);
    });

    it('should return 1 at frame 15 (0.5s at 30fps) with no delay', () => {
      expect(calculateEdgeProgress(15, 0, 30)).toBe(1);
    });

    it('should return 0.5 at approximately frame 7.5', () => {
      const progress = calculateEdgeProgress(7.5, 0, 30);
      expect(progress).toBeCloseTo(0.5, 1);
    });

    it('should respect delay frames', () => {
      expect(calculateEdgeProgress(4, 5, 30)).toBe(0);
      const progress = calculateEdgeProgress(12, 5, 30);
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThan(1);
    });

    it('should complete at delay + 15 frames', () => {
      expect(calculateEdgeProgress(20, 5, 30)).toBe(1);
    });

    it('should clamp to 0 before start', () => {
      expect(calculateEdgeProgress(3, 5, 30)).toBe(0);
    });

    it('should clamp to 1 after completion', () => {
      expect(calculateEdgeProgress(100, 5, 30)).toBe(1);
    });
  });

  describe('generatePathD', () => {
    it('should generate SVG path for two points', () => {
      const points = [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ];
      const d = generatePathD(points);
      expect(d).toBe('M10,20 L30,40');
    });

    it('should generate SVG path for multiple points', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 100, y: 50 },
        { x: 200, y: 0 },
      ];
      const d = generatePathD(points);
      expect(d).toBe('M0,0 L100,50 L200,0');
    });

    it('should return empty string for empty points', () => {
      expect(generatePathD([])).toBe('');
    });

    it('should return M command for single point', () => {
      expect(generatePathD([{ x: 10, y: 20 }])).toBe('M10,20');
    });
  });

  describe('EdgeAnimation component rendering', () => {
    it('should render an SVG element', () => {
      mockFrame = 20;
      const edge = makeEdge();
      const element = React.createElement(EdgeAnimation, {
        edge,
        edgeIndex: 0,
        delayFrames: 0,
        durationFrames: EDGE_DRAW_DURATION_FRAMES,
        pathLength: 200,
      });
      const rendered = renderEdge(element);

      expect(rendered.type).toBe('svg');
    });

    it('should have stroke-dasharray equal to pathLength', () => {
      mockFrame = 0;
      const edge = makeEdge();
      const element = React.createElement(EdgeAnimation, {
        edge,
        edgeIndex: 0,
        delayFrames: 0,
        durationFrames: EDGE_DRAW_DURATION_FRAMES,
        pathLength: 200,
      });
      const rendered = renderEdge(element);

      // Find the path element inside the SVG
      const pathElement = rendered.props.children;
      expect(pathElement.props.strokeDasharray).toBe(200);
    });

    it('should have stroke-dashoffset equal to pathLength at frame 0', () => {
      mockFrame = 0;
      const edge = makeEdge();
      const element = React.createElement(EdgeAnimation, {
        edge,
        edgeIndex: 0,
        delayFrames: 0,
        durationFrames: EDGE_DRAW_DURATION_FRAMES,
        pathLength: 200,
      });
      const rendered = renderEdge(element);
      const pathElement = rendered.props.children;

      expect(pathElement.props.strokeDashoffset).toBe(200);
    });

    it('should have stroke-dashoffset of 0 after animation completes', () => {
      mockFrame = 20;
      const edge = makeEdge();
      const element = React.createElement(EdgeAnimation, {
        edge,
        edgeIndex: 0,
        delayFrames: 0,
        durationFrames: EDGE_DRAW_DURATION_FRAMES,
        pathLength: 200,
      });
      const rendered = renderEdge(element);
      const pathElement = rendered.props.children;

      expect(pathElement.props.strokeDashoffset).toBe(0);
    });

    it('should have partial stroke-dashoffset mid-animation', () => {
      mockFrame = 7.5;
      const edge = makeEdge();
      const element = React.createElement(EdgeAnimation, {
        edge,
        edgeIndex: 0,
        delayFrames: 0,
        durationFrames: EDGE_DRAW_DURATION_FRAMES,
        pathLength: 200,
      });
      const rendered = renderEdge(element);
      const pathElement = rendered.props.children;

      // At 50% progress, dashoffset should be 100
      expect(pathElement.props.strokeDashoffset).toBeCloseTo(100, 0);
    });

    it('should respect delay frames', () => {
      mockFrame = 3;
      const edge = makeEdge();
      const element = React.createElement(EdgeAnimation, {
        edge,
        edgeIndex: 0,
        delayFrames: 5,
        durationFrames: EDGE_DRAW_DURATION_FRAMES,
        pathLength: 200,
      });
      const rendered = renderEdge(element);
      const pathElement = rendered.props.children;

      // Before delay: dashoffset should be full (200)
      expect(pathElement.props.strokeDashoffset).toBe(200);
    });

    it('should render path with correct d attribute', () => {
      mockFrame = 20;
      const edge = makeEdge({
        points: [
          { x: 10, y: 20 },
          { x: 110, y: 20 },
        ],
      });
      const element = React.createElement(EdgeAnimation, {
        edge,
        edgeIndex: 0,
        delayFrames: 0,
        durationFrames: EDGE_DRAW_DURATION_FRAMES,
        pathLength: 100,
      });
      const rendered = renderEdge(element);
      const pathElement = rendered.props.children;

      expect(pathElement.props.d).toBe('M10,20 L110,20');
    });

    it('should not produce NaN dimensions for empty points array', () => {
      mockFrame = 0;
      const edge = makeEdge({ points: [] });
      const element = React.createElement(EdgeAnimation, {
        edge,
        edgeIndex: 0,
        delayFrames: 0,
        durationFrames: EDGE_DRAW_DURATION_FRAMES,
        pathLength: 0,
      });
      const rendered = renderEdge(element);

      const style = rendered.props.style;
      expect(Number.isFinite(style.width)).toBe(true);
      expect(Number.isFinite(style.height)).toBe(true);
      // With no points, bounding box should be [-pad, +pad] = [-10, 10] => 20
      expect(style.width).toBe(20);
      expect(style.height).toBe(20);
    });

    it('should not produce NaN dimensions for single-point edge', () => {
      mockFrame = 0;
      const edge = makeEdge({ points: [{ x: 50, y: 75 }] });
      const element = React.createElement(EdgeAnimation, {
        edge,
        edgeIndex: 0,
        delayFrames: 0,
        durationFrames: EDGE_DRAW_DURATION_FRAMES,
        pathLength: 0,
      });
      const rendered = renderEdge(element);

      const style = rendered.props.style;
      expect(Number.isFinite(style.width)).toBe(true);
      expect(Number.isFinite(style.height)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Edge label rendering — WYSIWYG parity with SVG/Canvas/PDF exports
  // -------------------------------------------------------------------------
  // The exports render edge.label at the path midpoint; the on-screen video
  // previously drew edges as bare lines and dropped the label entirely.
  describe('edge label rendering (WYSIWYG parity with exports)', () => {
    // Find a child element by SVG type. children is a single element when no
    // label is present and an array [path, text] once a label is added.
    function findChild(
      rendered: React.ReactElement,
      type: string
    ): React.ReactElement | undefined {
      const children = rendered.props.children;
      const arr: React.ReactElement[] = Array.isArray(children) ? children : [children];
      return arr.find((c) => c && c.type === type);
    }

    it('renders edge.label as <text> at the path midpoint when a label is present', () => {
      mockFrame = 20; // animation complete → progress 1, label fully visible
      const edge = makeEdge({
        label: 'leads to',
        points: [
          { x: 100, y: 200 },
          { x: 300, y: 400 },
        ],
      });
      const element = React.createElement(EdgeAnimation, {
        edge,
        edgeIndex: 0,
        delayFrames: 0,
        durationFrames: EDGE_DRAW_DURATION_FRAMES,
        pathLength: 100,
      });
      const rendered = renderEdge(element);

      const text = findChild(rendered, 'text');
      expect(text).toBeDefined();
      expect(text!.props.children).toBe('leads to');
      // midpoint = ((100+300)/2, (200+400)/2 - 5) = (200, 295)
      expect(text!.props.x).toBe(200);
      expect(text!.props.y).toBe(295);
    });

    it('fades the label in alongside the drawing progress', () => {
      const edge = makeEdge({ label: 'x' });
      const labelAt = (frame: number): number => {
        mockFrame = frame;
        const el = React.createElement(EdgeAnimation, {
          edge,
          edgeIndex: 0,
          delayFrames: 0,
          durationFrames: EDGE_DRAW_DURATION_FRAMES,
          pathLength: 200,
        });
        return findChild(renderEdge(el), 'text')!.props.opacity;
      };
      expect(labelAt(0)).toBe(0); // before/at start: invisible
      expect(labelAt(20)).toBe(1); // after completion: fully visible
    });

    it('does not render a <text> when the edge has no label (path stays the direct child)', () => {
      mockFrame = 20;
      const edge = makeEdge(); // no label
      const element = React.createElement(EdgeAnimation, {
        edge,
        edgeIndex: 0,
        delayFrames: 0,
        durationFrames: EDGE_DRAW_DURATION_FRAMES,
        pathLength: 200,
      });
      const rendered = renderEdge(element);

      expect(findChild(rendered, 'text')).toBeUndefined();
      // Back-compat: callers that grab the path directly still get it.
      expect(rendered.props.children.type).toBe('path');
    });

    it('does not render a label when fewer than 2 points are available', () => {
      mockFrame = 20;
      const edge = makeEdge({ label: 'orphan', points: [{ x: 5, y: 5 }] });
      const element = React.createElement(EdgeAnimation, {
        edge,
        edgeIndex: 0,
        delayFrames: 0,
        durationFrames: EDGE_DRAW_DURATION_FRAMES,
        pathLength: 0,
      });
      const rendered = renderEdge(element);
      expect(findChild(rendered, 'text')).toBeUndefined();
    });
  });
});
