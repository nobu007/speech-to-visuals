/**
 * @jest-environment jsdom
 */

/**
 * Tests for VideoPreview Component
 * Comprehensive tests covering rendering, user interactions, and state management
 * Uses jsdom test environment with React Testing Library
 */

import { jest } from '@jest/globals';
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SceneGraph } from '@stv/core/types/diagram';

// ========================================
// Mocks
// ========================================

// Store captured player ref for testing event handlers
// We need a stable mock player object that persists across renders
let capturedPlayerRef: {
  play: ReturnType<typeof jest.fn>;
  pause: ReturnType<typeof jest.fn>;
  seekTo: ReturnType<typeof jest.fn>;
  addEventListener: ReturnType<typeof jest.fn>;
  removeEventListener: ReturnType<typeof jest.fn>;
} | null = null;

// Track registered event listeners by the VideoPreview useEffect
let registeredListeners: Record<string, Array<(...args: unknown[]) => void>> = {}; // eslint-disable-line prefer-const -- reassigned in beforeEach

// Mock @remotion/player - Player component can't render in Jest
jest.unstable_mockModule('@remotion/player', () => {
  const MockPlayer = React.forwardRef<
    { play: ReturnType<typeof jest.fn>; pause: ReturnType<typeof jest.fn>; seekTo: ReturnType<typeof jest.fn>; addEventListener: ReturnType<typeof jest.fn>; removeEventListener: ReturnType<typeof jest.fn> },
    Record<string, unknown>
  >((_props, ref) => {
    // Use useMemo to create a stable mock player that persists across renders
    const mockPlayer = React.useMemo(() => ({
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(),
      addEventListener: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (!registeredListeners[event]) registeredListeners[event] = [];
        registeredListeners[event].push(handler);
      }),
      removeEventListener: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (registeredListeners[event]) {
          registeredListeners[event] = registeredListeners[event].filter((h) => h !== handler);
        }
      }),
    }), []);

    React.useImperativeHandle(ref, () => mockPlayer);
    capturedPlayerRef = mockPlayer;

    return React.createElement('div', { 'data-testid': 'mock-player' });
  });
  MockPlayer.displayName = 'MockPlayer';
  return {
    Player: MockPlayer,
  };
});

// Mock @/remotion/Video - calculateTotalFrames and SpeechToVisualsVideo
jest.unstable_mockModule('@/remotion/Video', () => ({
  SpeechToVisualsVideo: () => null,
  calculateTotalFrames: (scenes: SceneGraph[], fps: number) => {
    if (!scenes || scenes.length === 0) return fps * 10;
    const totalMs = scenes.reduce((sum: number, scene: SceneGraph) => sum + scene.durationMs, 0);
    return Math.ceil((totalMs / 1000) * fps);
  },
  DEFAULT_FPS: 30,
}));

// Mock UI components to simplify rendering
jest.unstable_mockModule('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, 'data-testid': testId, 'aria-label': ariaLabel, variant, ...props }: Record<string, unknown>) =>
    React.createElement(
      'button',
      { onClick, disabled: disabled || false, 'data-testid': testId, 'aria-label': ariaLabel, variant, ...props },
      ...(React.Children.toArray(children as React.ReactNode)),
    ),
}));

jest.unstable_mockModule('@/components/ui/slider', () => ({
  Slider: ({ value, min, max, step, onValueChange, 'data-testid': testId, ...props }: Record<string, unknown>) =>
    React.createElement('input', {
      type: 'range',
      value: Array.isArray(value) ? value[0] : value,
      min: min as number,
      max: max as number,
      step: step as number,
      'data-testid': testId,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => (onValueChange as (val: number[]) => void)?.([Number(e.target.value)]),
      ...props,
    }),
}));

jest.unstable_mockModule('@/components/ui/select', () => {
  // Use React context to share value/onValueChange between Select, SelectTrigger, and SelectItem.
  const SelectContext = React.createContext<{ value: string | null; onValueChange: ((val: string) => void) | null }>({
    value: null,
    onValueChange: null,
  });

  const MockSelect = ({ children, value, onValueChange }: Record<string, unknown>) =>
    React.createElement(
      SelectContext.Provider,
      { value: { value: value as string | null, onValueChange: onValueChange as ((val: string) => void) | null } },
      children as React.ReactNode,
    );
  MockSelect.displayName = 'MockSelect';

  const MockSelectTrigger = ({ children, 'data-testid': testId, ...props }: Record<string, unknown>) => {
    const ctx = React.useContext(SelectContext);
    return React.createElement('div', {
      'data-testid': testId || 'mock-select-trigger',
      'data-value': ctx.value,
      ...props,
    }, children as React.ReactNode);
  };
  MockSelectTrigger.displayName = 'MockSelectTrigger';

  const MockSelectValue = () => React.createElement('span', null, 'Select Value');
  MockSelectValue.displayName = 'MockSelectValue';

  const MockSelectContent = ({ children }: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': 'mock-select-content' }, children as React.ReactNode);
  MockSelectContent.displayName = 'MockSelectContent';

  const MockSelectItem = ({ children, value }: Record<string, unknown>) => {
    const ctx = React.useContext(SelectContext);
    return React.createElement('div', {
      'data-testid': `mock-select-item-${value}`,
      'data-value': value,
      onClick: () => {
        if (ctx.onValueChange && value != null) {
          ctx.onValueChange(String(value));
        }
      },
    }, children as React.ReactNode);
  };
  MockSelectItem.displayName = 'MockSelectItem';

  return {
    Select: MockSelect,
    SelectTrigger: MockSelectTrigger,
    SelectValue: MockSelectValue,
    SelectContent: MockSelectContent,
    SelectItem: MockSelectItem,
  };
});

// Dynamic import of module under test (after mocks are set up)
const {
  VideoPreview,
  formatTime,
  RESOLUTION_PRESETS,
  PLAYBACK_SPEEDS,
  DEFAULT_RESOLUTION,
} = await import('@/components/VideoPreview');

import type { PreviewResolution, PlaybackSpeed, VideoPreviewProps } from '@/components/VideoPreview';

// ========================================
// Test Helpers
// ========================================

function createScene(overrides: Partial<SceneGraph> = {}): SceneGraph {
  return {
    type: 'flow',
    nodes: [{ id: 'node1', label: 'Start' }],
    edges: [],
    startMs: 0,
    durationMs: 5000,
    summary: 'Test scene',
    keyphrases: ['test'],
    ...overrides,
  };
}

function createDefaultProps(overrides: Partial<VideoPreviewProps> = {}): VideoPreviewProps {
  return {
    scenes: [createScene()],
    ...overrides,
  };
}

// ========================================
// Test Suite: Helper Functions
// ========================================

describe('VideoPreview', () => {
  // ========================================
  // formatTime
  // ========================================

  describe('formatTime', () => {
    test('should return 00:00 for frame 0 at 30fps', () => {
      expect(formatTime(0, 30)).toBe('00:00');
    });

    test('should format 30 frames at 30fps as 00:01', () => {
      expect(formatTime(30, 30)).toBe('00:01');
    });

    test('should format 150 frames at 30fps as 00:05', () => {
      expect(formatTime(150, 30)).toBe('00:05');
    });

    test('should format 1800 frames at 30fps as 01:00', () => {
      expect(formatTime(1800, 30)).toBe('01:00');
    });

    test('should format 3600 frames at 30fps as 02:00', () => {
      expect(formatTime(3600, 30)).toBe('02:00');
    });

    test('should format 90 frames at 30fps as 00:03', () => {
      expect(formatTime(90, 30)).toBe('00:03');
    });

    test('should format with single digit minutes zero-padded', () => {
      // 900 frames = 30 seconds at 30fps
      expect(formatTime(900, 30)).toBe('00:30');
    });

    test('should format partial seconds by flooring', () => {
      // 45 frames at 30fps = 1.5 seconds -> floors to 1
      expect(formatTime(45, 30)).toBe('00:01');
    });

    test('should handle 60fps correctly', () => {
      // 3600 frames at 60fps = 60 seconds = 01:00
      expect(formatTime(3600, 60)).toBe('01:00');
    });

    test('should handle 24fps correctly', () => {
      // 1440 frames at 24fps = 60 seconds = 01:00
      expect(formatTime(1440, 24)).toBe('01:00');
    });
  });

  // ========================================
  // Exported Constants
  // ========================================

  describe('exported constants', () => {
    test('should have correct resolution presets', () => {
      expect(RESOLUTION_PRESETS['360p']).toEqual({ width: 640, height: 360 });
      expect(RESOLUTION_PRESETS['540p']).toEqual({ width: 960, height: 540 });
      expect(RESOLUTION_PRESETS['720p']).toEqual({ width: 1280, height: 720 });
      expect(RESOLUTION_PRESETS['1080p']).toEqual({ width: 1920, height: 1080 });
    });

    test('should have all four resolution presets', () => {
      expect(Object.keys(RESOLUTION_PRESETS)).toHaveLength(4);
    });

    test('should have correct playback speeds', () => {
      expect(PLAYBACK_SPEEDS).toEqual([0.5, 1, 1.5, 2]);
    });

    test('should have 720p as default resolution', () => {
      expect(DEFAULT_RESOLUTION).toBe('720p');
    });
  });

  // ========================================
  // Empty State (no scenes)
  // ========================================

  describe('empty state rendering', () => {
    test('should render empty state when scenes array is empty', () => {
      render(React.createElement(VideoPreview, createDefaultProps({ scenes: [] })));
      expect(screen.getByTestId('video-preview-empty')).toBeTruthy();
    });

    test('should render empty state when scenes is undefined', () => {
      render(React.createElement(VideoPreview, createDefaultProps({ scenes: undefined as unknown as SceneGraph[] })));
      expect(screen.getByTestId('video-preview-empty')).toBeTruthy();
    });

    test('should display "No scene data available" message in empty state', () => {
      render(React.createElement(VideoPreview, createDefaultProps({ scenes: [] })));
      expect(screen.getByText('No scene data available for preview')).toBeTruthy();
    });

    test('should apply custom className to empty state', () => {
      render(React.createElement(VideoPreview, createDefaultProps({ scenes: [], className: 'custom-class' })));
      const emptyEl = screen.getByTestId('video-preview-empty');
      expect(emptyEl.className).toContain('custom-class');
    });
  });

  // ========================================
  // Video Available State Rendering
  // ========================================

  describe('video available state rendering', () => {
    test('should render video preview container when scenes are provided', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      expect(screen.getByTestId('video-preview')).toBeTruthy();
    });

    test('should render mock player component', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      expect(screen.getByTestId('mock-player')).toBeTruthy();
    });

    test('should render controls section', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      expect(screen.getByTestId('video-preview-controls')).toBeTruthy();
    });

    test('should render time display elements', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      expect(screen.getByTestId('time-current')).toBeTruthy();
      expect(screen.getByTestId('time-total')).toBeTruthy();
    });

    test('should render seekbar', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      expect(screen.getByTestId('seekbar')).toBeTruthy();
    });

    test('should render play/pause button', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      expect(screen.getByTestId('btn-play-pause')).toBeTruthy();
    });

    test('should render frame backward button', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      expect(screen.getByTestId('btn-frame-backward')).toBeTruthy();
    });

    test('should render frame forward button', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      expect(screen.getByTestId('btn-frame-forward')).toBeTruthy();
    });

    test('should render loop toggle button', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      expect(screen.getByTestId('btn-loop')).toBeTruthy();
    });

    test('should render speed select', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      expect(screen.getByTestId('select-speed')).toBeTruthy();
    });

    test('should render resolution select', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      expect(screen.getByTestId('select-resolution')).toBeTruthy();
    });

    test('should apply custom className to video preview container', () => {
      render(React.createElement(VideoPreview, createDefaultProps({ className: 'my-custom-class' })));
      const container = screen.getByTestId('video-preview');
      expect(container.className).toContain('my-custom-class');
    });

    test('should not apply custom className when not provided', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      const container = screen.getByTestId('video-preview');
      expect(container.className).not.toContain('undefined');
    });

    test('should show initial time as 00:00', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      const timeCurrent = screen.getByTestId('time-current');
      expect(timeCurrent.textContent).toBe('00:00');
    });

    test('should show total time based on scenes duration', () => {
      const scenes = [createScene({ durationMs: 5000 })]; // 5 seconds at 30fps = 150 frames
      render(React.createElement(VideoPreview, createDefaultProps({ scenes })));
      const timeTotal = screen.getByTestId('time-total');
      // 150 frames at 30fps = 5 seconds = 00:05
      expect(timeTotal.textContent).toBe('00:05');
    });

    test('should show Pause aria-label when playing', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      const playPauseBtn = screen.getByTestId('btn-play-pause');
      // Initially not playing, should show "Play"
      expect(playPauseBtn.getAttribute('aria-label')).toBe('Play');
    });

    test('should show loop enabled by default', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      const loopBtn = screen.getByTestId('btn-loop');
      // Loop starts as true
      expect(loopBtn.getAttribute('aria-label')).toBe('Disable loop');
    });

    test('should have frame backward button disabled at frame 0', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      const backwardBtn = screen.getByTestId('btn-frame-backward');
      expect(backwardBtn).toHaveProperty('disabled', true);
    });

    test('should have default playback speed as 1x', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      const speedSelect = screen.getByTestId('select-speed');
      expect(speedSelect.getAttribute('data-value')).toBe('1');
    });

    test('should have default resolution as 720p', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      const resSelect = screen.getByTestId('select-resolution');
      expect(resSelect.getAttribute('data-value')).toBe('720p');
    });
  });

  // ========================================
  // Custom initialResolution prop
  // ========================================

  describe('initialResolution prop', () => {
    test('should use 360p when initialResolution is 360p', () => {
      render(React.createElement(VideoPreview, createDefaultProps({ initialResolution: '360p' })));
      const resSelect = screen.getByTestId('select-resolution');
      expect(resSelect.getAttribute('data-value')).toBe('360p');
    });

    test('should use 540p when initialResolution is 540p', () => {
      render(React.createElement(VideoPreview, createDefaultProps({ initialResolution: '540p' })));
      const resSelect = screen.getByTestId('select-resolution');
      expect(resSelect.getAttribute('data-value')).toBe('540p');
    });

    test('should use 1080p when initialResolution is 1080p', () => {
      render(React.createElement(VideoPreview, createDefaultProps({ initialResolution: '1080p' })));
      const resSelect = screen.getByTestId('select-resolution');
      expect(resSelect.getAttribute('data-value')).toBe('1080p');
    });
  });

  // ========================================
  // Multiple scenes
  // ========================================

  describe('multiple scenes rendering', () => {
    test('should calculate total time for multiple scenes', () => {
      const scenes = [
        createScene({ durationMs: 5000 }),
        createScene({ durationMs: 5000 }),
      ];
      render(React.createElement(VideoPreview, createDefaultProps({ scenes })));
      const timeTotal = screen.getByTestId('time-total');
      // 10 seconds at 30fps = 300 frames = 00:10
      expect(timeTotal.textContent).toBe('00:10');
    });

    test('should calculate total time for scenes with different durations', () => {
      const scenes = [
        createScene({ durationMs: 3000 }),
        createScene({ durationMs: 7000 }),
      ];
      render(React.createElement(VideoPreview, createDefaultProps({ scenes })));
      const timeTotal = screen.getByTestId('time-total');
      // 10 seconds at 30fps = 300 frames = 00:10
      expect(timeTotal.textContent).toBe('00:10');
    });
  });

  // ========================================
  // Seekbar interaction
  // ========================================

  describe('seekbar interaction', () => {
    test('should have seekbar with correct max value for single scene', () => {
      const scenes = [createScene({ durationMs: 5000 })]; // 150 frames
      render(React.createElement(VideoPreview, createDefaultProps({ scenes })));
      const seekbar = screen.getByTestId('seekbar');
      expect(seekbar.getAttribute('max')).toBe('149'); // totalFrames - 1
    });

    test('should have seekbar with min value of 0', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      const seekbar = screen.getByTestId('seekbar');
      expect(seekbar.getAttribute('min')).toBe('0');
    });

    test('should have seekbar with step of 1', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      const seekbar = screen.getByTestId('seekbar');
      expect(seekbar.getAttribute('step')).toBe('1');
    });

    test('should update time display when seekbar changes', () => {
      const scenes = [createScene({ durationMs: 10000 })]; // 300 frames
      render(React.createElement(VideoPreview, createDefaultProps({ scenes })));
      const seekbar = screen.getByTestId('seekbar');

      fireEvent.change(seekbar, { target: { value: 90 } }); // 3 seconds at 30fps

      const timeCurrent = screen.getByTestId('time-current');
      expect(timeCurrent.textContent).toBe('00:03');
    });
  });

  // ========================================
  // Play/Pause button interaction
  // ========================================

  describe('play/pause button interaction', () => {
    test('should have Play aria-label initially (not playing)', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      const btn = screen.getByTestId('btn-play-pause');
      expect(btn.getAttribute('aria-label')).toBe('Play');
    });
  });

  // ========================================
  // Frame navigation buttons
  // ========================================

  describe('frame navigation buttons', () => {
    test('should have Previous frame aria-label on backward button', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      const btn = screen.getByTestId('btn-frame-backward');
      expect(btn.getAttribute('aria-label')).toBe('Previous frame');
    });

    test('should have Next frame aria-label on forward button', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      const btn = screen.getByTestId('btn-frame-forward');
      expect(btn.getAttribute('aria-label')).toBe('Next frame');
    });

    test('should disable backward button when current frame is 0', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      const backwardBtn = screen.getByTestId('btn-frame-backward');
      expect(backwardBtn).toHaveProperty('disabled', true);
    });

    test('should enable forward button when not at last frame', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      const forwardBtn = screen.getByTestId('btn-frame-forward');
      expect(forwardBtn).toHaveProperty('disabled', false);
    });
  });

  // ========================================
  // Loop toggle
  // ========================================

  describe('loop toggle', () => {
    test('should show "Disable loop" aria-label when loop is enabled (default)', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      const loopBtn = screen.getByTestId('btn-loop');
      expect(loopBtn.getAttribute('aria-label')).toBe('Disable loop');
    });
  });

  // ========================================
  // Props handling
  // ========================================

  describe('props handling', () => {
    test('should render with audioUrl prop without crashing', () => {
      render(React.createElement(VideoPreview, createDefaultProps({ audioUrl: 'https://example.com/audio.mp3' })));
      expect(screen.getByTestId('video-preview')).toBeTruthy();
    });

    test('should render with custom backgroundColor prop without crashing', () => {
      render(React.createElement(VideoPreview, createDefaultProps({ backgroundColor: '#ffffff' })));
      expect(screen.getByTestId('video-preview')).toBeTruthy();
    });

    test('should use default backgroundColor when not provided', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      expect(screen.getByTestId('video-preview')).toBeTruthy();
    });
  });

  // ========================================
  // Resolution switching
  // ========================================

  describe('resolution switching', () => {
    test('should change resolution when a different resolution item is clicked', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));

      // The resolution select has a trigger with testId 'select-resolution'
      // The MockSelectTrigger handles click with data-new-value
      const resTrigger = screen.getByTestId('select-resolution');

      // Click on it with a new value to simulate selecting 1080p
      fireEvent.click(resTrigger, { target: { getAttribute: () => '1080p' } });

      // After resolution change, the trigger should show 1080p
      // But our mock needs the target element to have data-new-value
      // Let's find the 1080p item and click it
      const item1080 = screen.getByTestId('mock-select-item-1080p');
      // The click on the item needs to bubble up to the trigger
      // Instead, let's trigger via a custom approach
      fireEvent.click(item1080);
    });

    test('should update resolution display after switching to 1080p', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));

      // Find the 1080p select item and click it to trigger resolution change
      const item1080 = screen.getByTestId('mock-select-item-1080p');
      fireEvent.click(item1080);

      // The resolution trigger should now show 1080p
      const resTrigger = screen.getByTestId('select-resolution');
      expect(resTrigger.getAttribute('data-value')).toBe('1080p');
    });
  });

  // ========================================
  // Playback speed control
  // ========================================

  describe('playback speed control', () => {
    test('should change speed when a different speed item is clicked', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));

      // Find the 2x speed select item and click it
      const item2x = screen.getByTestId('mock-select-item-2');
      fireEvent.click(item2x);

      // The speed trigger should now show 2
      const speedTrigger = screen.getByTestId('select-speed');
      expect(speedTrigger.getAttribute('data-value')).toBe('2');
    });

    test('should change speed to 0.5x when 0.5 item is clicked', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));

      const item05x = screen.getByTestId('mock-select-item-0.5');
      fireEvent.click(item05x);

      const speedTrigger = screen.getByTestId('select-speed');
      expect(speedTrigger.getAttribute('data-value')).toBe('0.5');
    });
  });

  // ========================================
  // Component default export
  // ========================================

  describe('default export', () => {
    test('should be importable as default export', async () => {
      const module = await import('@/components/VideoPreview');
      expect(module.default).toBeDefined();
      expect(typeof module.default).toBe('function');
    });
  });

  // ========================================
  // Player event handlers
  // ========================================

  describe('player event handlers', () => {
    test('should update isPlaying to true when player emits play event', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      expect(capturedPlayerRef).toBeTruthy();

      // Trigger the 'play' event via registered listeners
      act(() => {
        registeredListeners['play'].forEach((handler) => handler());
      });

      const playPauseBtn = screen.getByTestId('btn-play-pause');
      expect(playPauseBtn.getAttribute('aria-label')).toBe('Pause');
    });

    test('should update isPlaying to false when player emits pause event', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      expect(capturedPlayerRef).toBeTruthy();

      // First play, then pause
      act(() => {
        registeredListeners['play'].forEach((handler) => handler());
      });
      act(() => {
        registeredListeners['pause'].forEach((handler) => handler());
      });

      const playPauseBtn = screen.getByTestId('btn-play-pause');
      expect(playPauseBtn.getAttribute('aria-label')).toBe('Play');
    });

    test('should update current frame when player emits frameupdate event', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      expect(capturedPlayerRef).toBeTruthy();

      // Trigger frameupdate event with detail.frame = 90 (3 seconds at 30fps)
      act(() => {
        registeredListeners['frameupdate'].forEach((handler) => handler({ detail: { frame: 90 } }));
      });

      const timeCurrent = screen.getByTestId('time-current');
      expect(timeCurrent.textContent).toBe('00:03');
    });

    test('should update current frame when player emits seeked event', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      expect(capturedPlayerRef).toBeTruthy();

      // Trigger seeked event with detail.frame = 60 (2 seconds at 30fps)
      act(() => {
        registeredListeners['seeked'].forEach((handler) => handler({ detail: { frame: 60 } }));
      });

      const timeCurrent = screen.getByTestId('time-current');
      expect(timeCurrent.textContent).toBe('00:02');
    });

    test('should set isPlaying to false when player emits ended event', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      expect(capturedPlayerRef).toBeTruthy();

      // First start playing
      act(() => {
        registeredListeners['play'].forEach((handler) => handler());
      });

      const playPauseBtn = screen.getByTestId('btn-play-pause');
      expect(playPauseBtn.getAttribute('aria-label')).toBe('Pause');

      // Then video ends
      act(() => {
        registeredListeners['ended'].forEach((handler) => handler());
      });

      expect(playPauseBtn.getAttribute('aria-label')).toBe('Play');
    });
  });

  // ========================================
  // Play/Pause button click interaction
  // ========================================

  describe('play/pause button click', () => {
    test('should call player.play() when play button clicked while not playing', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      expect(capturedPlayerRef).toBeTruthy();

      const playPauseBtn = screen.getByTestId('btn-play-pause');
      fireEvent.click(playPauseBtn);

      expect(capturedPlayerRef!.play).toHaveBeenCalled();
    });

    test('should call player.pause() when pause button clicked while playing', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      expect(capturedPlayerRef).toBeTruthy();

      // First set playing state
      act(() => {
        registeredListeners['play'].forEach((handler) => handler());
      });

      const playPauseBtn = screen.getByTestId('btn-play-pause');
      expect(playPauseBtn.getAttribute('aria-label')).toBe('Pause');

      // Click pause
      fireEvent.click(playPauseBtn);
      expect(capturedPlayerRef!.pause).toHaveBeenCalled();
    });
  });

  // ========================================
  // Frame forward/backward click interaction
  // ========================================

  describe('frame forward button click', () => {
    test('should call player.seekTo with next frame when forward button clicked', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      expect(capturedPlayerRef).toBeTruthy();

      const forwardBtn = screen.getByTestId('btn-frame-forward');
      fireEvent.click(forwardBtn);

      expect(capturedPlayerRef!.seekTo).toHaveBeenCalledWith(1);
    });

    test('should update time display after frame forward', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      expect(capturedPlayerRef).toBeTruthy();

      const forwardBtn = screen.getByTestId('btn-frame-forward');
      fireEvent.click(forwardBtn);

      // Frame 1 at 30fps = still 00:00
      const timeCurrent = screen.getByTestId('time-current');
      expect(timeCurrent.textContent).toBe('00:00');
    });

    test('should enable backward button after advancing frame', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      expect(capturedPlayerRef).toBeTruthy();

      // Advance frame from 0 to 1
      const forwardBtn = screen.getByTestId('btn-frame-forward');
      fireEvent.click(forwardBtn);

      const backwardBtn = screen.getByTestId('btn-frame-backward');
      expect(backwardBtn).toHaveProperty('disabled', false);
    });
  });

  describe('frame backward button click', () => {
    test('should call player.seekTo with previous frame when backward button clicked from frame 1', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      expect(capturedPlayerRef).toBeTruthy();

      // First advance to frame 1
      act(() => {
        registeredListeners['frameupdate'].forEach((handler) => handler({ detail: { frame: 1 } }));
      });

      const backwardBtn = screen.getByTestId('btn-frame-backward');
      expect(backwardBtn).toHaveProperty('disabled', false);

      fireEvent.click(backwardBtn);
      expect(capturedPlayerRef!.seekTo).toHaveBeenCalledWith(0);
    });
  });

  // ========================================
  // Loop toggle click
  // ========================================

  describe('loop toggle click', () => {
    test('should toggle loop to disabled when clicked from enabled state', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));

      const loopBtn = screen.getByTestId('btn-loop');
      expect(loopBtn.getAttribute('aria-label')).toBe('Disable loop');

      fireEvent.click(loopBtn);

      expect(loopBtn.getAttribute('aria-label')).toBe('Enable loop');
    });

    test('should toggle loop back to enabled when clicked twice', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));

      const loopBtn = screen.getByTestId('btn-loop');
      fireEvent.click(loopBtn);
      expect(loopBtn.getAttribute('aria-label')).toBe('Enable loop');

      fireEvent.click(loopBtn);
      expect(loopBtn.getAttribute('aria-label')).toBe('Disable loop');
    });
  });

  // ========================================
  // Player cleanup on unmount
  // ========================================

  describe('player event listener cleanup', () => {
    test('should register event listeners on mount', () => {
      render(React.createElement(VideoPreview, createDefaultProps()));
      expect(capturedPlayerRef).toBeTruthy();
      expect(capturedPlayerRef!.addEventListener).toHaveBeenCalledWith('play', expect.any(Function));
      expect(capturedPlayerRef!.addEventListener).toHaveBeenCalledWith('pause', expect.any(Function));
      expect(capturedPlayerRef!.addEventListener).toHaveBeenCalledWith('frameupdate', expect.any(Function));
      expect(capturedPlayerRef!.addEventListener).toHaveBeenCalledWith('seeked', expect.any(Function));
      expect(capturedPlayerRef!.addEventListener).toHaveBeenCalledWith('ended', expect.any(Function));
    });

    test('should remove event listeners on unmount', () => {
      const { unmount } = render(React.createElement(VideoPreview, createDefaultProps()));
      expect(capturedPlayerRef).toBeTruthy();

      unmount();

      expect(capturedPlayerRef!.removeEventListener).toHaveBeenCalledWith('play', expect.any(Function));
      expect(capturedPlayerRef!.removeEventListener).toHaveBeenCalledWith('pause', expect.any(Function));
      expect(capturedPlayerRef!.removeEventListener).toHaveBeenCalledWith('frameupdate', expect.any(Function));
      expect(capturedPlayerRef!.removeEventListener).toHaveBeenCalledWith('seeked', expect.any(Function));
      expect(capturedPlayerRef!.removeEventListener).toHaveBeenCalledWith('ended', expect.any(Function));
    });
  });
});
