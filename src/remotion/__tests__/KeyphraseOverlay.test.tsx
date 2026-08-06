/**
 * Tests for KeyphraseOverlay.tsx
 * Keyphrase display, visibility animation, scene timing, and positioning
 */

import { jest } from '@jest/globals';
import * as React from 'react';
import type { KeyphraseOverlayProps, KeyphraseScene } from '../KeyphraseOverlay';

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
  spring: () => 1,
  AbsoluteFill: ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) =>
    React.createElement('div', { style: { position: 'absolute', inset: 0, ...style } }, children),
}));

const {
  KeyphraseOverlay,
  calculateKeyphraseOpacity,
  getActiveScene,
  msToFrame,
  KEYPHRASE_FADE_IN_FRAMES,
  KEYPHRASE_FADE_OUT_FRAMES,
  MAX_KEYPHRASES_DISPLAY,
} = await import('../KeyphraseOverlay');

// Helper to create a KeyphraseScene
function createScene(overrides: Partial<KeyphraseScene> = {}): KeyphraseScene {
  return {
    startMs: 0,
    durationMs: 5000,
    keyphrases: ['データベース', '正規化'],
    ...overrides,
  };
}

// Helper: call the KeyphraseOverlay FC directly
function renderOverlay(props: KeyphraseOverlayProps): React.ReactElement {
  return (KeyphraseOverlay as React.FC<KeyphraseOverlayProps>)(props) as React.ReactElement;
}

describe('KeyphraseOverlay', () => {
  beforeEach(() => {
    mockFrame = 0;
    mockFps = 30;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constants', () => {
    it('should define KEYPHRASE_FADE_IN_FRAMES', () => {
      expect(KEYPHRASE_FADE_IN_FRAMES).toBe(8);
    });

    it('should define KEYPHRASE_FADE_OUT_FRAMES', () => {
      expect(KEYPHRASE_FADE_OUT_FRAMES).toBe(8);
    });

    it('should define MAX_KEYPHRASES_DISPLAY', () => {
      expect(MAX_KEYPHRASES_DISPLAY).toBe(5);
    });
  });

  describe('msToFrame', () => {
    it('should convert milliseconds to frame number', () => {
      expect(msToFrame(1000, 30)).toBe(30);
      expect(msToFrame(2000, 30)).toBe(60);
      expect(msToFrame(500, 24)).toBe(12);
    });

    it('should handle zero milliseconds', () => {
      expect(msToFrame(0, 30)).toBe(0);
    });
  });

  describe('calculateKeyphraseOpacity', () => {
    it('should return 0 when frame is before scene start', () => {
      expect(calculateKeyphraseOpacity(0, 30, 150)).toBe(0);
    });

    it('should return 0 when frame is after scene end', () => {
      expect(calculateKeyphraseOpacity(151, 30, 150)).toBe(0);
    });

    it('should fade in over KEYPHRASE_FADE_IN_FRAMES', () => {
      const startFrame = 0;
      const endFrame = 150;
      const opacity0 = calculateKeyphraseOpacity(startFrame, startFrame, endFrame);
      const opacity8 = calculateKeyphraseOpacity(startFrame + KEYPHRASE_FADE_IN_FRAMES, startFrame, endFrame);

      expect(opacity0).toBe(0);
      expect(opacity8).toBe(1);
    });

    it('should fade out over KEYPHRASE_FADE_OUT_FRAMES', () => {
      const startFrame = 0;
      const endFrame = 150;
      const opacity142 = calculateKeyphraseOpacity(endFrame - KEYPHRASE_FADE_OUT_FRAMES, startFrame, endFrame);
      const opacity150 = calculateKeyphraseOpacity(endFrame, startFrame, endFrame);

      expect(opacity142).toBe(1);
      expect(opacity150).toBe(0);
    });

    it('should return 1 during the stable middle period', () => {
      const startFrame = 0;
      const endFrame = 150;
      const opacity = calculateKeyphraseOpacity(70, startFrame, endFrame);
      expect(opacity).toBe(1);
    });

    it('should handle very short scenes gracefully', () => {
      const startFrame = 0;
      const endFrame = 5; // Shorter than fade frames
      const opacity = calculateKeyphraseOpacity(2, startFrame, endFrame);
      expect(opacity).toBeGreaterThanOrEqual(0);
      expect(opacity).toBeLessThanOrEqual(1);
    });

    it('boosts short-scene midpoint visibility (uses the more-faded side, not the min)', () => {
      // When a scene is shorter than fadeIn+fadeOut (8+8=16) the fade windows
      // overlap, so the naive min(fadeIn,fadeOut) keeps the keyphrase dim. The
      // midpoint branch exists to ensure visibility — it must take the MAX.
      //   frame 4 in [0,10] (within midpoint±1 window [4,6]):
      //   fadeIn  = interpolate(4,[0,8],[0,1])  = 0.5
      //   fadeOut = interpolate(4,[2,10],[1,0]) = 0.75
      // Buggy Math.min -> 0.5; correct Math.max -> 0.75.
      const opacity = calculateKeyphraseOpacity(4, 0, 10);
      expect(opacity).toBeGreaterThanOrEqual(0.75);
    });
  });

  describe('getActiveScene', () => {
    const scenes: KeyphraseScene[] = [
      createScene({ startMs: 0, durationMs: 3000, keyphrases: ['AI', '機械学習'] }),
      createScene({ startMs: 3000, durationMs: 3000, keyphrases: ['データベース', 'SQL'] }),
    ];

    it('should return first scene when frame is in its range', () => {
      const result = getActiveScene(scenes, 30, 30); // 1000ms
      expect(result).not.toBeNull();
      expect(result!.scene.keyphrases).toEqual(['AI', '機械学習']);
    });

    it('should return second scene when frame is in its range', () => {
      const result = getActiveScene(scenes, 120, 30); // 4000ms
      expect(result).not.toBeNull();
      expect(result!.scene.keyphrases).toEqual(['データベース', 'SQL']);
    });

    it('should return null when no scene is active', () => {
      const result = getActiveScene(scenes, 200, 30); // beyond all scenes
      expect(result).toBeNull();
    });

    it('should skip scenes with empty keyphrases', () => {
      const scenesWithEmpty: KeyphraseScene[] = [
        createScene({ startMs: 0, durationMs: 3000, keyphrases: [] }),
        createScene({ startMs: 3000, durationMs: 3000, keyphrases: ['テスト'] }),
      ];
      // Frame is in the range of first scene, but it has no keyphrases
      const result = getActiveScene(scenesWithEmpty, 30, 30);
      expect(result).toBeNull();
    });

    it('should return null for empty scenes array', () => {
      expect(getActiveScene([], 10, 30)).toBeNull();
    });

    it('should return correct startFrame and endFrame', () => {
      const result = getActiveScene(scenes, 30, 30);
      expect(result!.startFrame).toBe(0);
      expect(result!.endFrame).toBe(90); // 3000ms at 30fps
    });
  });

  describe('KeyphraseOverlay component rendering', () => {
    it('should render nothing when no scene is active', () => {
      mockFrame = 200;
      const scenes = [createScene({ startMs: 0, durationMs: 3000 })];
      const element = renderOverlay({ scenes });
      expect(element).toBeDefined();
    });

    it('should render keyphrase tags when scene is active', () => {
      mockFrame = 45; // 1500ms at 30fps
      const scenes = [createScene({
        startMs: 0,
        durationMs: 5000,
        keyphrases: ['データベース', '正規化'],
      })];
      const element = renderOverlay({ scenes });
      const textContent = extractText(element);
      expect(textContent).toContain('データベース');
      expect(textContent).toContain('正規化');
    });

    it('should position overlay at top center', () => {
      mockFrame = 45;
      const scenes = [createScene()];
      const element = renderOverlay({ scenes });

      const outerStyle = (element.props.style || {}) as React.CSSProperties;
      expect(outerStyle.display).toBe('flex');
      expect(outerStyle.justifyContent).toBe('center');
      expect(outerStyle.alignItems).toBe('flex-start');
    });

    it('should limit displayed keyphrases to MAX_KEYPHRASES_DISPLAY', () => {
      mockFrame = 45;
      const scenes = [createScene({
        startMs: 0,
        durationMs: 5000,
        keyphrases: ['one', 'two', 'three', 'four', 'five', 'six', 'seven'],
      })];
      const element = renderOverlay({ scenes });
      const textContent = extractText(element);
      // Should only contain first 5
      expect(textContent).toContain('one');
      expect(textContent).toContain('five');
      expect(textContent).not.toContain('six');
      expect(textContent).not.toContain('seven');
    });

    it('should apply custom tagColor', () => {
      mockFrame = 45;
      const scenes = [createScene({ keyphrases: ['test'] })];
      const element = renderOverlay({ scenes, tagColor: 'red' });
      expect(element).toBeDefined();
    });

    it('should apply custom fontSize', () => {
      mockFrame = 45;
      const scenes = [createScene({ keyphrases: ['test'] })];
      const element = renderOverlay({ scenes, fontSize: 28 });
      expect(element).toBeDefined();
    });

    it('should handle empty keyphrases gracefully', () => {
      mockFrame = 45;
      const scenes = [createScene({ keyphrases: [] })];
      // Empty keyphrases means getActiveScene returns null, so nothing rendered
      const element = renderOverlay({ scenes });
      expect(element).toBeDefined();
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
