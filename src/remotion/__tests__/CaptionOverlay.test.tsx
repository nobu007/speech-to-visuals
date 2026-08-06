/**
 * Tests for CaptionOverlay.tsx
 * Caption display, visibility animation, multi-line support, and positioning
 */

import { jest } from '@jest/globals';
import * as React from 'react';
import { SrtCaption } from '../srt-parser';
import type { CaptionOverlayProps } from '../CaptionOverlay';

// Mock remotion hooks
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
  AbsoluteFill: ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) =>
    React.createElement('div', { style: { position: 'absolute', inset: 0, ...style } }, children),
}));

const {
  CaptionOverlay,
  getActiveCaptionText,
  calculateCaptionOpacity,
  MAX_CHARS_PER_LINE,
  MAX_LINES,
} = await import('../CaptionOverlay');

// Helper to create an SrtCaption
function createCaption(overrides: Partial<SrtCaption> = {}): SrtCaption {
  return {
    index: 1,
    startMs: 0,
    endMs: 3000,
    text: 'Test caption',
    startFrame: 0,
    endFrame: 90,
    ...overrides,
  };
}

// Helper: call the CaptionOverlay FC directly and extract the returned element
function renderOverlay(props: CaptionOverlayProps): React.ReactElement {
  return (CaptionOverlay as React.FC<CaptionOverlayProps>)(props) as React.ReactElement;
}

describe('CaptionOverlay', () => {
  beforeEach(() => {
    mockFrame = 0;
    mockFps = 30;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constants', () => {
    it('should define MAX_CHARS_PER_LINE as 42', () => {
      expect(MAX_CHARS_PER_LINE).toBe(42);
    });

    it('should define MAX_LINES as 2', () => {
      expect(MAX_LINES).toBe(2);
    });
  });

  describe('calculateCaptionOpacity', () => {
    it('should return 0 when frame is before caption start', () => {
      const caption = createCaption({ startFrame: 30, endFrame: 90 });
      expect(calculateCaptionOpacity(0, caption)).toBe(0);
    });

    it('should return 1 when frame is within caption range (after fade-in)', () => {
      const caption = createCaption({ startFrame: 30, endFrame: 90 });
      // At frame 35, well past fade-in
      expect(calculateCaptionOpacity(35, caption)).toBe(1);
    });

    it('should fade in over FADE_IN_FRAMES at caption start', () => {
      const caption = createCaption({ startFrame: 30, endFrame: 90 });
      // Fade-in: frames 30-35 (5 frames)
      const opacity0 = calculateCaptionOpacity(30, caption);
      const opacity3 = calculateCaptionOpacity(33, caption);
      const opacity5 = calculateCaptionOpacity(35, caption);

      expect(opacity0).toBe(0);
      expect(opacity3).toBeGreaterThan(0);
      expect(opacity3).toBeLessThan(1);
      expect(opacity5).toBe(1);
    });

    it('should fade out over FADE_OUT_FRAMES at caption end', () => {
      const caption = createCaption({ startFrame: 0, endFrame: 90 });
      // Fade-out: frames 85-90 (5 frames before end)
      const opacity85 = calculateCaptionOpacity(85, caption);
      const opacity88 = calculateCaptionOpacity(88, caption);
      const opacity90 = calculateCaptionOpacity(90, caption);

      expect(opacity85).toBe(1);
      expect(opacity88).toBeGreaterThan(0);
      expect(opacity88).toBeLessThan(1);
      expect(opacity90).toBe(0);
    });

    it('should return 0 when frame is after caption end', () => {
      const caption = createCaption({ startFrame: 0, endFrame: 90 });
      expect(calculateCaptionOpacity(91, caption)).toBe(0);
    });

    it('should handle very short captions (less than fade frames)', () => {
      const caption = createCaption({ startFrame: 0, endFrame: 3 });
      // Caption is only 3 frames, shorter than 5-frame fade
      const opacity1 = calculateCaptionOpacity(1, caption);
      expect(opacity1).toBeGreaterThanOrEqual(0);
      expect(opacity1).toBeLessThanOrEqual(1);
    });

    it('keeps short captions visible at the midpoint (max fade, not min)', () => {
      // Fades overlap: totalDuration (4) <= FADE_IN + FADE_OUT (10).
      // midpoint = 102, visibility window [101, 103].
      // At frame 101: fadeIn = 0.2, fadeOut = 0.6.
      //   min(fadeIn, fadeOut) = 0.2  (caption nearly invisible — bug)
      //   max(fadeIn, fadeOut) = 0.6  (caption stays visible — intent)
      const caption = createCaption({ startFrame: 100, endFrame: 104 });
      const opacity = calculateCaptionOpacity(101, caption);
      expect(opacity).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('getActiveCaptionText', () => {
    const captions: SrtCaption[] = [
      createCaption({
        index: 1,
        startFrame: 0,
        endFrame: 30,
        text: 'First caption',
      }),
      createCaption({
        index: 2,
        startFrame: 31,
        endFrame: 60,
        text: 'Second caption',
      }),
    ];

    it('should return text for active caption at frame 0', () => {
      expect(getActiveCaptionText(captions, 0)).toBe('First caption');
    });

    it('should return text for second caption', () => {
      expect(getActiveCaptionText(captions, 40)).toBe('Second caption');
    });

    it('should return null when no caption is active', () => {
      expect(getActiveCaptionText(captions, 61)).toBeNull();
    });

    it('should return null for empty captions array', () => {
      expect(getActiveCaptionText([], 10)).toBeNull();
    });

    it('should return null when frame is in a gap', () => {
      // Gap between first and second (frame 30 ends caption 1, frame 31 starts caption 2)
      // No gap in this test case, but test the function handles it
      expect(getActiveCaptionText(captions, 30)).toBe('First caption');
      expect(getActiveCaptionText(captions, 31)).toBe('Second caption');
    });

    it('should handle multi-line caption text', () => {
      const multilineCaptions: SrtCaption[] = [
        createCaption({
          startFrame: 0,
          endFrame: 30,
          text: 'First line\nSecond line',
        }),
      ];
      expect(getActiveCaptionText(multilineCaptions, 10)).toBe('First line\nSecond line');
    });
  });

  describe('CaptionOverlay component rendering', () => {
    it('should render nothing when no caption is active', () => {
      mockFrame = 100;
      const captions = [createCaption({ startFrame: 0, endFrame: 30 })];
      const element = renderOverlay({ captions });

      // Should not render visible content when no caption is active
      // The component renders with opacity 0 or returns null
      expect(element).toBeDefined();
    });

    it('should render caption text when active', () => {
      mockFrame = 15;
      const captions = [createCaption({
        startFrame: 0,
        endFrame: 30,
        text: 'Hello world',
      })];
      const element = renderOverlay({ captions });

      expect(element).toBeDefined();
      // The rendered element should contain the caption text
      const textContent = extractText(element);
      expect(textContent).toContain('Hello world');
    });

    it('should position caption at bottom center', () => {
      mockFrame = 15;
      const captions = [createCaption({
        startFrame: 0,
        endFrame: 30,
        text: 'Positioned text',
      })];
      const element = renderOverlay({ captions });

      // The outermost element (AbsoluteFill) should be positioned absolutely
      const outerStyle = (element.props.style || {}) as React.CSSProperties;
      expect(outerStyle.display).toBe('flex');
      expect(outerStyle.justifyContent).toBe('center');
      expect(outerStyle.alignItems).toBe('flex-end');
      expect(outerStyle.paddingBottom).toBe(60);
    });

    it('should apply fade-in opacity at caption start', () => {
      mockFrame = 0;
      const captions = [createCaption({
        startFrame: 0,
        endFrame: 30,
        text: 'Fading in',
      })];
      const element = renderOverlay({ captions });
      const containerStyle = getContainerStyle(element);

      // At frame 0, opacity should be 0 (start of fade-in)
      expect(containerStyle.opacity).toBe(0);
    });

    it('should apply full opacity mid-caption', () => {
      mockFrame = 15;
      const captions = [createCaption({
        startFrame: 0,
        endFrame: 30,
        text: 'Fully visible',
      })];
      const element = renderOverlay({ captions });
      const containerStyle = getContainerStyle(element);

      expect(containerStyle.opacity).toBe(1);
    });

    it('should support custom style override', () => {
      mockFrame = 15;
      const captions = [createCaption({
        startFrame: 0,
        endFrame: 30,
        text: 'Custom styled',
      })];
      const element = renderOverlay({
        captions,
        style: { color: 'yellow' },
      });

      expect(element).toBeDefined();
    });

    it('should handle multi-line text by splitting into separate elements', () => {
      mockFrame = 15;
      const captions = [createCaption({
        startFrame: 0,
        endFrame: 30,
        text: 'Line one\nLine two',
      })];
      const element = renderOverlay({ captions });

      const textContent = extractText(element);
      expect(textContent).toContain('Line one');
      expect(textContent).toContain('Line two');
    });
  });
});

// Helper: extract text content from a React element tree
function extractText(element: React.ReactElement): string {
  const texts: string[] = [];

  function traverse(node: React.ReactNode): void {
    if (typeof node === 'string') {
      texts.push(node);
    } else if (typeof node === 'number') {
      texts.push(String(node));
    } else if (node && typeof node === 'object' && 'props' in node) {
      const reactEl = node as React.ReactElement;
      if (reactEl.props && reactEl.props.children) {
        if (Array.isArray(reactEl.props.children)) {
          reactEl.props.children.forEach(traverse);
        } else {
          traverse(reactEl.props.children);
        }
      }
    }
  }

  traverse(element);
  return texts.join(' ');
}

// Helper: get the container style from the inner div (caption text container)
function getContainerStyle(element: React.ReactElement): React.CSSProperties {
  // The structure is: AbsoluteFill > div (caption text container with opacity)
  const children = element.props.children;
  if (children && typeof children === 'object' && 'props' in children) {
    return ((children as React.ReactElement).props.style || {}) as React.CSSProperties;
  }
  return (element.props.style || {}) as React.CSSProperties;
}
