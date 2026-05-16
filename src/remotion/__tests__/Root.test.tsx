/**
 * Tests for Root.tsx - Composition rendering, resolution/FPS settings
 */

import { jest } from '@jest/globals';
import * as React from 'react';

// Mock Composition to have a displayName we can check
jest.unstable_mockModule('remotion', () => {
  const ActualReact = jest.requireActual('react') as typeof React;
  const MockComposition = (props: Record<string, unknown>) => {
    return null;
  };
  MockComposition.displayName = 'Composition';
  return {
    Composition: MockComposition,
    useCurrentFrame: () => 0,
    useVideoConfig: () => ({
      fps: 30,
      width: 1920,
      height: 1080,
      durationInFrames: 300,
    }),
    AbsoluteFill: ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) =>
      ActualReact.createElement('div', { style: { position: 'absolute', inset: 0, ...style } }, children),
    Audio: ({ src }: { src: string }) =>
      ActualReact.createElement('audio', { src }),
    interpolate: (frame: number, inputRange: number[], outputRange: number[]) => {
      if (frame <= inputRange[0]) return outputRange[0];
      if (frame >= inputRange[inputRange.length - 1]) return outputRange[outputRange.length - 1];
      const t = (frame - inputRange[0]) / (inputRange[inputRange.length - 1] - inputRange[0]);
      return outputRange[0] + t * (outputRange[outputRange.length - 1] - outputRange[0]);
    },
    Sequence: ({ children }: { children: React.ReactNode }) => children,
  };
});

const { RemotionRoot, COMPOSITION_ID } = await import('../Root');
const {
  DEFAULT_FPS,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  calculateTotalFrames,
  defaultVideoProps,
} = await import('../Video');

/**
 * Call RemotionRoot as a function component and extract the Composition element's props.
 * Since RemotionRoot is a simple FC that returns JSX, calling it directly gives us the element tree.
 */
function getCompositionFromRoot(): Record<string, unknown> | null {
  // Call the component function directly (like React would during render)
  const result = (RemotionRoot as () => React.ReactElement)();
  // result is a React fragment; its props.children contains the Composition element
  if (result && result.props && result.props.children) {
    const children = Array.isArray(result.props.children)
      ? result.props.children
      : [result.props.children];
    for (const child of children) {
      if (
        child &&
        typeof child.type === 'function' &&
        (child.type as { displayName?: string }).displayName === 'Composition'
      ) {
        return child.props as Record<string, unknown>;
      }
    }
  }
  return null;
}

describe('RemotionRoot', () => {
  describe('Composition rendering', () => {
    it('should return a valid element when called', () => {
      const result = (RemotionRoot as () => React.ReactElement)();
      expect(result).toBeTruthy();
    });

    it('should register composition with correct ID', () => {
      const props = getCompositionFromRoot();
      expect(props).not.toBeNull();
      expect(props!.id).toBe(COMPOSITION_ID);
    });

    it('should use SpeechToVisualsVideo as composition ID', () => {
      expect(COMPOSITION_ID).toBe('SpeechToVisualsVideo');
    });
  });

  describe('Resolution and FPS settings', () => {
    let compositionProps: Record<string, unknown>;

    beforeAll(() => {
      compositionProps = getCompositionFromRoot() ?? {};
    });

    it('should set width to 1920 (1080p)', () => {
      expect(compositionProps.width).toBe(1920);
    });

    it('should set height to 1080 (1080p)', () => {
      expect(compositionProps.height).toBe(1080);
    });

    it('should set FPS to 30', () => {
      expect(compositionProps.fps).toBe(30);
    });

    it('should export correct default constants', () => {
      expect(DEFAULT_FPS).toBe(30);
      expect(DEFAULT_WIDTH).toBe(1920);
      expect(DEFAULT_HEIGHT).toBe(1080);
    });
  });

  describe('Default properties', () => {
    let compositionProps: Record<string, unknown>;

    beforeAll(() => {
      compositionProps = getCompositionFromRoot() ?? {};
    });

    it('should have default scenes as empty array', () => {
      expect(defaultVideoProps.scenes).toEqual([]);
    });

    it('should have default backgroundColor', () => {
      expect(defaultVideoProps.backgroundColor).toBe('#0f0f23');
    });

    it('should set durationInFrames using calculateTotalFrames', () => {
      const expectedFrames = calculateTotalFrames(defaultVideoProps.scenes);
      expect(compositionProps.durationInFrames).toBe(expectedFrames);
    });

    it('should provide 10-second default duration for empty scenes', () => {
      const frames = calculateTotalFrames([]);
      expect(frames).toBe(300); // 10 seconds * 30 fps
    });
  });
});
