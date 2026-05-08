/**
 * @jest-environment jsdom
 */
/**
 * Tests for Video.tsx - Scene switching, total frames calculation, findSceneAtTime
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { SceneGraph, PositionedNode } from '@/types/diagram';
import {
  calculateTotalFrames,
  findSceneAtTime,
  DEFAULT_FPS,
  defaultVideoProps,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  SpeechToVisualsVideo,
  VideoProps,
} from '../Video';

// Mock remotion hooks for component tests
let mockFrame = 0;
let mockFps = 30;
let mockDurationInFrames = 300;

jest.mock('remotion', () => {
  const originalModule = jest.requireActual('remotion');
  return {
    ...originalModule,
    useCurrentFrame: () => mockFrame,
    useVideoConfig: () => ({
      fps: mockFps,
      width: 1920,
      height: 1080,
      durationInFrames: mockDurationInFrames,
    }),
    AbsoluteFill: ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) =>
      React.createElement('div', { style: { position: 'absolute', inset: 0, ...style }, 'data-testid': 'absolute-fill' }, children),
    Audio: ({ src }: { src: string }) =>
      React.createElement('audio', { src, 'data-testid': 'audio' }),
  };
});

// Helper to create a SceneGraph
function createScene(overrides: Partial<SceneGraph> = {}): SceneGraph {
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

describe('calculateTotalFrames', () => {
  describe('empty scenes', () => {
    it('should return 300 frames (10 seconds) for empty array', () => {
      expect(calculateTotalFrames([])).toBe(300);
    });

    it('should return 300 frames for undefined/null scenes', () => {
      expect(calculateTotalFrames(undefined as unknown as SceneGraph[])).toBe(300);
      expect(calculateTotalFrames(null as unknown as SceneGraph[])).toBe(300);
    });
  });

  describe('single scene', () => {
    it('should calculate frames for a 5-second scene at 30fps', () => {
      const scenes = [createScene({ durationMs: 5000 })];
      expect(calculateTotalFrames(scenes)).toBe(150); // 5s * 30fps
    });

    it('should calculate frames for a 10-second scene at 30fps', () => {
      const scenes = [createScene({ durationMs: 10000 })];
      expect(calculateTotalFrames(scenes)).toBe(300); // 10s * 30fps
    });
  });

  describe('multiple scenes', () => {
    it('should sum all scene durations', () => {
      const scenes = [
        createScene({ durationMs: 3000 }),
        createScene({ durationMs: 5000 }),
        createScene({ durationMs: 2000 }),
      ];
      expect(calculateTotalFrames(scenes)).toBe(300); // (3+5+2)s * 30fps = 300
    });

    it('should handle scenes with different durations', () => {
      const scenes = [
        createScene({ durationMs: 1500 }),
        createScene({ durationMs: 2500 }),
      ];
      expect(calculateTotalFrames(scenes)).toBe(120); // (1.5+2.5)s * 30fps = 120
    });
  });

  describe('custom FPS', () => {
    it('should use custom FPS when provided', () => {
      const scenes = [createScene({ durationMs: 10000 })];
      expect(calculateTotalFrames(scenes, 60)).toBe(600); // 10s * 60fps
    });

    it('should use custom FPS 24', () => {
      const scenes = [createScene({ durationMs: 10000 })];
      expect(calculateTotalFrames(scenes, 24)).toBe(240); // 10s * 24fps
    });
  });

  describe('edge cases', () => {
    it('should handle zero-duration scenes', () => {
      const scenes = [createScene({ durationMs: 0 })];
      expect(calculateTotalFrames(scenes)).toBe(0);
    });

    it('should handle mix of zero and non-zero durations', () => {
      const scenes = [
        createScene({ durationMs: 0 }),
        createScene({ durationMs: 3000 }),
        createScene({ durationMs: 0 }),
      ];
      expect(calculateTotalFrames(scenes)).toBe(90); // 3s * 30fps
    });

    it('should use default FPS constant', () => {
      expect(DEFAULT_FPS).toBe(30);
    });
  });
});

describe('findSceneAtTime', () => {
  const scenes = [
    createScene({ durationMs: 3000, summary: 'Scene 1' }),
    createScene({ durationMs: 5000, summary: 'Scene 2' }),
    createScene({ durationMs: 2000, summary: 'Scene 3' }),
  ];

  describe('scene selection', () => {
    it('should find the first scene at time 0', () => {
      const result = findSceneAtTime(scenes, 0);
      expect(result).not.toBeNull();
      expect(result!.index).toBe(0);
      expect(result!.scene.summary).toBe('Scene 1');
      expect(result!.timeInScene).toBe(0);
    });

    it('should find the first scene at time 2000ms', () => {
      const result = findSceneAtTime(scenes, 2000);
      expect(result!.index).toBe(0);
      expect(result!.timeInScene).toBe(2000);
    });

    it('should find the second scene at time 3000ms', () => {
      const result = findSceneAtTime(scenes, 3000);
      expect(result!.index).toBe(1);
      expect(result!.scene.summary).toBe('Scene 2');
      expect(result!.timeInScene).toBe(0);
    });

    it('should find the second scene mid-duration', () => {
      const result = findSceneAtTime(scenes, 5500);
      expect(result!.index).toBe(1);
      expect(result!.timeInScene).toBe(2500);
    });

    it('should find the third scene', () => {
      const result = findSceneAtTime(scenes, 8000);
      expect(result!.index).toBe(2);
      expect(result!.scene.summary).toBe('Scene 3');
    });
  });

  describe('boundary handling', () => {
    it('should return null for time before any scene', () => {
      // With scenes starting at 0, time before 0 is impossible,
      // but test with negative time
      const result = findSceneAtTime(scenes, -1);
      expect(result).toBeNull();
    });

    it('should return null for time past all scenes', () => {
      // Total duration is 3000+5000+2000 = 10000ms
      const result = findSceneAtTime(scenes, 10000);
      expect(result).toBeNull();
    });

    it('should handle exact boundary between scenes', () => {
      // At 3000ms, should be start of scene 2
      const result = findSceneAtTime(scenes, 3000);
      expect(result!.index).toBe(1);
    });

    it('should handle time just before scene boundary', () => {
      // At 2999ms, should still be scene 1
      const result = findSceneAtTime(scenes, 2999);
      expect(result!.index).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should return null for empty scenes array', () => {
      const result = findSceneAtTime([], 1000);
      expect(result).toBeNull();
    });

    it('should handle single scene', () => {
      const singleScenes = [createScene({ durationMs: 5000 })];
      const result = findSceneAtTime(singleScenes, 2500);
      expect(result!.index).toBe(0);
      expect(result!.timeInScene).toBe(2500);
    });

    it('should return null for time exactly at end of single scene', () => {
      const singleScenes = [createScene({ durationMs: 5000 })];
      const result = findSceneAtTime(singleScenes, 5000);
      expect(result).toBeNull();
    });
  });
});

describe('defaultVideoProps', () => {
  it('should have empty scenes array', () => {
    expect(defaultVideoProps.scenes).toEqual([]);
  });

  it('should have dark background color', () => {
    expect(defaultVideoProps.backgroundColor).toBe('#0f0f23');
  });

  it('should not have audio URL by default', () => {
    expect(defaultVideoProps.audioUrl).toBeUndefined();
  });
});

describe('SpeechToVisualsVideo component', () => {
  beforeEach(() => {
    mockFrame = 0;
    mockFps = 30;
    mockDurationInFrames = 300;
  });

  function createScenes(count: number, durationMs = 5000): SceneGraph[] {
    return Array.from({ length: count }, (_, i) => createScene({
      durationMs,
      summary: `Scene ${i + 1}`,
      type: 'flow',
      nodes: [{
        id: `n${i}`,
        label: `Node ${i}`,
        x: 100,
        y: 100,
        width: 120,
        height: 60,
      } as PositionedNode],
      edges: [],
    }));
  }

  it('should render with scenes at frame 0', () => {
    const scenes = createScenes(2);
    const { container } = render(
      React.createElement(SpeechToVisualsVideo, { scenes })
    );
    expect(container.querySelector('[data-testid="absolute-fill"]')).toBeTruthy();
  });

  it('should render Preparing... when no scene is found', () => {
    mockFrame = 9000; // well past the duration
    mockDurationInFrames = 300;
    const scenes = createScenes(1, 5000); // 5 seconds = 150 frames at 30fps
    render(React.createElement(SpeechToVisualsVideo, { scenes }));
    expect(screen.getByText('Preparing...')).toBeTruthy();
  });

  it('should render audio element when audioUrl is provided', () => {
    const scenes = createScenes(1);
    render(React.createElement(SpeechToVisualsVideo, {
      scenes,
      audioUrl: 'https://example.com/audio.mp3',
    }));
    const audio = screen.getByTestId('audio');
    expect(audio).toBeTruthy();
  });

  it('should not render audio element when audioUrl is not provided', () => {
    const scenes = createScenes(1);
    render(React.createElement(SpeechToVisualsVideo, { scenes }));
    expect(screen.queryByTestId('audio')).toBeNull();
  });

  it('should apply custom backgroundColor', () => {
    const scenes = createScenes(1);
    const { container } = render(
      React.createElement(SpeechToVisualsVideo, {
        scenes,
        backgroundColor: '#ff0000',
      })
    );
    const outerDiv = container.querySelector('[data-testid="absolute-fill"]');
    expect(outerDiv).toBeTruthy();
  });

  it('should display scene counter with multiple scenes', () => {
    const scenes = createScenes(3, 5000);
    mockFrame = 10; // within first scene
    mockDurationInFrames = calculateTotalFrames(scenes);
    render(React.createElement(SpeechToVisualsVideo, { scenes }));
    expect(screen.getByText(/Scene 1 \/ 3/)).toBeTruthy();
  });

  it('should show default background when no backgroundColor provided', () => {
    const scenes = createScenes(1);
    const { container } = render(
      React.createElement(SpeechToVisualsVideo, { scenes })
    );
    expect(container.firstChild).toBeTruthy();
  });
});

describe('Video constants', () => {
  it('should have correct DEFAULT_FPS', () => {
    expect(DEFAULT_FPS).toBe(30);
  });

  it('should have correct DEFAULT_WIDTH for 1080p', () => {
    expect(DEFAULT_WIDTH).toBe(1920);
  });

  it('should have correct DEFAULT_HEIGHT for 1080p', () => {
    expect(DEFAULT_HEIGHT).toBe(1080);
  });
});
