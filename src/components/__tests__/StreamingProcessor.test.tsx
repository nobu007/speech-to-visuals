/**
 * @jest-environment jsdom
 *
 * Regression tests for StreamingProcessor.
 *
 * Bug fixed here: `handleFileProcessing` called `onComplete(scenes)` where
 * `scenes` was the React state captured in the click-time closure — which had
 * just been reset to `[]` at the start of processing. Because scenes accumulate
 * asynchronously during `await transcribeStream(...)`, the closure value stayed
 * `[]`, so the parent (Index.tsx) toasted "ストリーミング処理完了: 0シーン"
 * even when scenes were actually generated.
 *
 * Fix: maintain synchronous `scenesRef`/`segmentsRef` mirrors and read
 * `scenesRef.current` at the `onComplete` call site.
 */
import { jest } from '@jest/globals';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

type SegmentHandler = (segment: { start: number; end: number; text: string }) => void;

/**
 * Controlled StreamingTranscriber. `transcribeStream` is configured per-test via
 * `setTranscribeStreamImpl` so each test drives the segment flow deterministically.
 */
const transcribeStreamMock = jest.fn();
const startLiveMock = jest.fn();
const stopLiveMock = jest.fn();

jest.unstable_mockModule('@/transcription/streaming-transcriber', () => ({
  StreamingTranscriber: jest.fn().mockImplementation(() => ({
    transcribeStream: transcribeStreamMock,
    startLiveTranscription: startLiveMock,
    stopLiveTranscription: stopLiveMock,
  })),
  validateStreamingSupport: () => ({
    webSpeechAPI: true,
    mediaDevices: true,
    mediaRecorder: true,
    fileAPI: true,
    recommendation: '',
  }),
}));

jest.unstable_mockModule('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => React.createElement('button', { onClick, disabled, ...props }, children),
}));

jest.unstable_mockModule('@/components/ui/progress', () => ({
  Progress: (props: Record<string, unknown>) =>
    React.createElement('div', { ...props, 'data-testid': 'progress' }),
}));

jest.unstable_mockModule('@/components/ui/card', () => ({
  Card: ({ children, ...p }: { children: React.ReactNode }) =>
    React.createElement('div', p, children),
  CardContent: ({ children, ...p }: { children: React.ReactNode }) =>
    React.createElement('div', p, children),
  CardDescription: ({ children, ...p }: { children: React.ReactNode }) =>
    React.createElement('div', p, children),
  CardHeader: ({ children, ...p }: { children: React.ReactNode }) =>
    React.createElement('div', p, children),
  CardTitle: ({ children, ...p }: { children: React.ReactNode }) =>
    React.createElement('div', p, children),
}));

jest.unstable_mockModule('@/components/ui/alert', () => ({
  Alert: ({ children, ...p }: { children: React.ReactNode }) =>
    React.createElement('div', p, children),
  AlertDescription: ({ children, ...p }: { children: React.ReactNode }) =>
    React.createElement('div', p, children),
  AlertTitle: ({ children, ...p }: { children: React.ReactNode }) =>
    React.createElement('div', p, children),
}));

jest.unstable_mockModule('@/components/ui/badge', () => ({
  Badge: ({ children, ...p }: { children: React.ReactNode }) =>
    React.createElement('span', p, children),
}));

jest.unstable_mockModule('@/components/ui/separator', () => ({
  Separator: (p: Record<string, unknown>) => React.createElement('hr', p),
}));

jest.unstable_mockModule('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.unstable_mockModule('lucide-react', () => {
  const make = () => (props: Record<string, unknown>) => React.createElement('span', props);
  const mod: Record<string, unknown> = {};
  for (const name of [
    'Mic', 'MicOff', 'Play', 'Pause', 'Square', 'Download',
    'BarChart3', 'Clock', 'Zap', 'Activity',
  ]) {
    mod[name] = make();
  }
  return mod;
});

const { StreamingProcessor } = await import('@/components/StreamingProcessor');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Attach a fake audio File to the hidden <input type="file">. */
function attachFakeFile(container: HTMLElement, filename = 'audio.wav'): void {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  expect(input).toBeTruthy();
  const file = new File(['fake-audio'], filename, { type: 'audio/wav' });
  Object.defineProperty(input, 'files', {
    value: [file],
    configurable: true,
  });
}

function getProcessFileButton(): HTMLButtonElement {
  const btn = screen
    .getAllByRole('button')
    .find((b) => b.textContent?.includes('Stream Process File')) as HTMLButtonElement;
  expect(btn).toBeTruthy();
  return btn;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StreamingProcessor — onComplete scene propagation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes the ACTUAL accumulated scenes to onComplete, not a stale empty array', async () => {
    // Simulate the transcriber emitting one segment that triggers a 'flow'
    // diagram, then resolving with that segment in the result.
    const emittedSegment = { start: 0, end: 1500, text: 'first run process A then process B step by step' };
    transcribeStreamMock.mockImplementation(
      async (_file: unknown, _onProgress: unknown, onSegment: SegmentHandler) => {
        onSegment(emittedSegment);
        return { segments: [emittedSegment] };
      },
    );

    const onCompleteSpy = jest.fn();
    const { container } = render(
      React.createElement(StreamingProcessor, { onComplete: onCompleteSpy }),
    );

    attachFakeFile(container);
    const button = getProcessFileButton();

    await act(async () => {
      fireEvent.click(button);
      await waitFor(() => expect(onCompleteSpy).toHaveBeenCalled());
    });

    // The regression: previously this was [] (length 0) due to the stale closure.
    expect(onCompleteSpy).toHaveBeenCalledTimes(1);
    const passedScenes = onCompleteSpy.mock.calls[0][0];
    expect(Array.isArray(passedScenes)).toBe(true);
    expect(passedScenes.length).toBe(1);
    expect(passedScenes[0].type).toBe('flow');
  });

  it('accumulates multiple scenes across segments before calling onComplete', async () => {
    const seg1 = { start: 0, end: 1500, text: 'the workflow process begins here' };
    const seg2 = { start: 1500, end: 3000, text: 'continue the process flow forward' };
    transcribeStreamMock.mockImplementation(
      async (_file: unknown, _onProgress: unknown, onSegment: SegmentHandler) => {
        onSegment(seg1); // -> 'flow'
        onSegment(seg2); // -> 'flow' (combined window still contains flow keywords)
        return { segments: [seg1, seg2] };
      },
    );

    const onCompleteSpy = jest.fn();
    const { container } = render(
      React.createElement(StreamingProcessor, { onComplete: onCompleteSpy }),
    );

    attachFakeFile(container);
    const button = getProcessFileButton();

    await act(async () => {
      fireEvent.click(button);
      await waitFor(() => expect(onCompleteSpy).toHaveBeenCalled());
    });

    // Both segments must be accumulated — previously the stale closure dropped
    // everything and reported 0.
    const passedScenes = onCompleteSpy.mock.calls[0][0];
    expect(passedScenes.length).toBe(2);
    expect(passedScenes[0].type).toBe('flow');
    expect(passedScenes[1].type).toBe('flow');
  });

  it('reports an empty array (not stale data) when no diagram is detected', async () => {
    const seg = { start: 0, end: 1500, text: 'hello world this is plain narration' };
    transcribeStreamMock.mockImplementation(
      async (_file: unknown, _onProgress: unknown, onSegment: SegmentHandler) => {
        onSegment(seg);
        return { segments: [seg] };
      },
    );

    const onCompleteSpy = jest.fn();
    const { container } = render(
      React.createElement(StreamingProcessor, { onComplete: onCompleteSpy }),
    );

    attachFakeFile(container);
    const button = getProcessFileButton();

    await act(async () => {
      fireEvent.click(button);
      await waitFor(() => expect(onCompleteSpy).toHaveBeenCalled());
    });

    // No diagram keyword -> no scene built -> [] (and crucially not stale prior data).
    expect(onCompleteSpy.mock.calls[0][0]).toEqual([]);
  });
});
