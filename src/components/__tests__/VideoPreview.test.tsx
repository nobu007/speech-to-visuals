/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock @remotion/player
jest.unstable_mockModule('@remotion/player', () => ({
  Player: React.forwardRef((_props: Record<string, unknown>, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
    return React.createElement('div', { 'data-testid': 'remotion-player' });
  }),
}));

// Mock the Remotion Video component
jest.unstable_mockModule('@/remotion/Video', () => ({
  SpeechToVisualsVideo: () => null,
  calculateTotalFrames: (_scenes: unknown[], fps: number) => fps * 10,
  DEFAULT_FPS: 30,
}));

// Mock UI components
jest.unstable_mockModule('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    ['data-testid']?: string;
  }) => React.createElement('button', { onClick, disabled, ...props }, children),
}));

jest.unstable_mockModule('@/components/ui/slider', () => ({
  Slider: ({ value, onValueChange, ...props }: {
    value: number[];
    onValueChange?: (v: number[]) => void;
    ['data-testid']?: string;
  }) =>
    React.createElement('input', {
      type: 'range',
      value: value?.[0] ?? 0,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onValueChange?.([Number(e.target.value)]),
      ...props,
    }),
}));

jest.unstable_mockModule('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: {
    children: React.ReactNode;
    value: string;
    onValueChange?: (v: string) => void;
  }) =>
    React.createElement('div', { 'data-value': value, onClick: () => onValueChange?.('720p') }, children),
  SelectTrigger: ({ children, ...props }: { children: React.ReactNode }) =>
    React.createElement('div', props, children),
  SelectContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) =>
    React.createElement('div', { key: value }, children),
  SelectValue: () => React.createElement('span', null, 'value'),
}));

const {
  VideoPreview,
  formatTime,
  RESOLUTION_PRESETS,
  PLAYBACK_SPEEDS,
  DEFAULT_RESOLUTION,
} = await import('@/components/VideoPreview');

describe('formatTime', () => {
  it('should format 0 frames to 00:00', () => {
    expect(formatTime(0, 30)).toBe('00:00');
  });

  it('should format 30 frames (1 second) to 00:01', () => {
    expect(formatTime(30, 30)).toBe('00:01');
  });

  it('should format 1800 frames (1 minute) to 01:00', () => {
    expect(formatTime(1800, 30)).toBe('01:00');
  });

  it('should format 90 frames (3 seconds) to 00:03', () => {
    expect(formatTime(90, 30)).toBe('00:03');
  });

  it('should format with different fps', () => {
    expect(formatTime(60, 60)).toBe('00:01');
  });

  it('should format 5400 frames (3 minutes) to 03:00', () => {
    expect(formatTime(5400, 30)).toBe('03:00');
  });
});

describe('RESOLUTION_PRESETS', () => {
  it('should have all expected resolutions', () => {
    expect(RESOLUTION_PRESETS['360p']).toEqual({ width: 640, height: 360 });
    expect(RESOLUTION_PRESETS['540p']).toEqual({ width: 960, height: 540 });
    expect(RESOLUTION_PRESETS['720p']).toEqual({ width: 1280, height: 720 });
    expect(RESOLUTION_PRESETS['1080p']).toEqual({ width: 1920, height: 1080 });
  });
});

describe('PLAYBACK_SPEEDS', () => {
  it('should have expected speed options', () => {
    expect(PLAYBACK_SPEEDS).toEqual([0.5, 1, 1.5, 2]);
  });
});

describe('DEFAULT_RESOLUTION', () => {
  it('should be 720p', () => {
    expect(DEFAULT_RESOLUTION).toBe('720p');
  });
});

describe('VideoPreview', () => {
  const mockScenes = [
    {
      type: 'flow' as const,
      nodes: [{ id: 'n1', label: 'Step 1' }],
      edges: [],
      layout: {
        nodes: [{ id: 'n1', label: 'Step 1', x: 100, y: 100, w: 120, h: 60 }],
        edges: [],
      },
      startMs: 0,
      durationMs: 5000,
      summary: 'Test scene',
      keyphrases: ['test'],
    },
  ];

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('empty state', () => {
    it('should render empty state when no scenes', () => {
      render(React.createElement(VideoPreview, { scenes: [] }));
      expect(screen.getByTestId('video-preview-empty')).toBeInTheDocument();
    });

    it('should render empty state with custom className', () => {
      render(React.createElement(VideoPreview, { scenes: [], className: 'test-class' }));
      const el = screen.getByTestId('video-preview-empty');
      expect(el.className).toContain('test-class');
    });
  });

  describe('with scenes', () => {
    it('should render video preview with scenes', () => {
      render(React.createElement(VideoPreview, { scenes: mockScenes }));
      expect(screen.getByTestId('video-preview')).toBeInTheDocument();
    });

    it('should render player', () => {
      render(React.createElement(VideoPreview, { scenes: mockScenes }));
      expect(screen.getByTestId('remotion-player')).toBeInTheDocument();
    });

    it('should render controls', () => {
      render(React.createElement(VideoPreview, { scenes: mockScenes }));
      expect(screen.getByTestId('video-preview-controls')).toBeInTheDocument();
    });

    it('should render seekbar', () => {
      render(React.createElement(VideoPreview, { scenes: mockScenes }));
      expect(screen.getByTestId('seekbar')).toBeInTheDocument();
    });

    it('should render play/pause button', () => {
      render(React.createElement(VideoPreview, { scenes: mockScenes }));
      expect(screen.getByTestId('btn-play-pause')).toBeInTheDocument();
    });

    it('should render frame forward button', () => {
      render(React.createElement(VideoPreview, { scenes: mockScenes }));
      expect(screen.getByTestId('btn-frame-forward')).toBeInTheDocument();
    });

    it('should render frame backward button', () => {
      render(React.createElement(VideoPreview, { scenes: mockScenes }));
      expect(screen.getByTestId('btn-frame-backward')).toBeInTheDocument();
    });

    it('should render loop toggle button', () => {
      render(React.createElement(VideoPreview, { scenes: mockScenes }));
      expect(screen.getByTestId('btn-loop')).toBeInTheDocument();
    });

    it('should render speed selector', () => {
      render(React.createElement(VideoPreview, { scenes: mockScenes }));
      expect(screen.getByTestId('select-speed')).toBeInTheDocument();
    });

    it('should render resolution selector', () => {
      render(React.createElement(VideoPreview, { scenes: mockScenes }));
      expect(screen.getByTestId('select-resolution')).toBeInTheDocument();
    });

    it('should display current time and total time', () => {
      render(React.createElement(VideoPreview, { scenes: mockScenes }));
      expect(screen.getByTestId('time-current')).toBeInTheDocument();
      expect(screen.getByTestId('time-total')).toBeInTheDocument();
    });
  });

  describe('interaction', () => {
    it('should handle play/pause click', () => {
      render(React.createElement(VideoPreview, { scenes: mockScenes }));
      const playBtn = screen.getByTestId('btn-play-pause');
      fireEvent.click(playBtn);
      // Should not crash
    });

    it('should handle frame forward click', () => {
      render(React.createElement(VideoPreview, { scenes: mockScenes }));
      const fwdBtn = screen.getByTestId('btn-frame-forward');
      fireEvent.click(fwdBtn);
    });

    it('should handle frame backward click when at frame 0', () => {
      render(React.createElement(VideoPreview, { scenes: mockScenes }));
      const backBtn = screen.getByTestId('btn-frame-backward');
      expect(backBtn).toBeDisabled();
    });

    it('should handle loop toggle click', () => {
      render(React.createElement(VideoPreview, { scenes: mockScenes }));
      const loopBtn = screen.getByTestId('btn-loop');
      fireEvent.click(loopBtn);
    });

    it('should handle seek', () => {
      render(React.createElement(VideoPreview, { scenes: mockScenes }));
      const seekbar = screen.getByTestId('seekbar');
      fireEvent.change(seekbar, { target: { value: '50' } });
    });
  });

  describe('custom props', () => {
    it('should accept audioUrl prop', () => {
      render(React.createElement(VideoPreview, {
        scenes: mockScenes,
        audioUrl: 'test-audio.wav',
      }));
      expect(screen.getByTestId('video-preview')).toBeInTheDocument();
    });

    it('should accept backgroundColor prop', () => {
      render(React.createElement(VideoPreview, {
        scenes: mockScenes,
        backgroundColor: '#ffffff',
      }));
      expect(screen.getByTestId('video-preview')).toBeInTheDocument();
    });

    it('should accept initialResolution prop', () => {
      render(React.createElement(VideoPreview, {
        scenes: mockScenes,
        initialResolution: '1080p',
      }));
      expect(screen.getByTestId('video-preview')).toBeInTheDocument();
    });

    it('should accept className prop', () => {
      render(React.createElement(VideoPreview, {
        scenes: mockScenes,
        className: 'custom-class',
      }));
      const el = screen.getByTestId('video-preview');
      expect(el.className).toContain('custom-class');
    });
  });
});
