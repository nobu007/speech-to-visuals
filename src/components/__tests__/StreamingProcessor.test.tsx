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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

type SegmentHandler = (segment: { start: number; end: number; text: string }) => void;
type ProgressHandler = (progress: {
  processedDuration: number;
  totalDuration: number;
  currentSegment: { start: number; end: number; text: string; confidence?: number } | null;
  segmentCount: number;
  averageConfidence: number;
}) => void;

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

jest.unstable_mockModule('@stv/core/utils/logger', () => ({
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

const {
  StreamingProcessor,
  // Disclosure vocabulary single source (TASK-0321 test stage): the legs below
  // pin the RENDERED text against these exports so the component and the tests
  // can never carry two diverging copies of the disclosure sentence.
  PLACEHOLDER_NOTICE_TEXT,
  PLACEHOLDER_NOTICE_ARIA_LABEL,
  UNMEASURED_CONFIDENCE_LABEL,
} = await import('@/components/StreamingProcessor');

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

function getButton(label: string): HTMLButtonElement {
  const btn = screen
    .getAllByRole('button')
    .find((b) => b.textContent?.includes(label)) as HTMLButtonElement;
  expect(btn).toBeTruthy();
  return btn;
}

function getProcessFileButton(): HTMLButtonElement {
  return getButton('Stream Process File');
}

/** Drive one file run to completion through the mocked transcribeStream. */
async function runFileToCompletion(): Promise<void> {
  await act(async () => {
    fireEvent.click(getProcessFileButton());
    await Promise.resolve();
    await Promise.resolve();
  });
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

describe('StreamingProcessor — placeholder result disclosure (TASK-0321 / TC-408-03 UI half)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * 経路3 (disclosed placeholder): transcribeStream resolves with
   * `placeholder: true` and its single completion progress event carries
   * `averageConfidence` 0.75 — the disclosed PLACEHOLDER_CHUNK_CONFIDENCE
   * constant, NOT a measurement. The UI must (1) render a notice naming the
   * placeholder route and (2) suppress the `averageConfidence * 100`
   * measured-looking stats display (0.75 is not a real reading).
   */
  it('renders a placeholder notice and suppresses the fake confidence stats when result.placeholder is true', async () => {
    // Mirrors the 経路3 completion event: fixed placeholder sentence with the
    // disclosed 0.75 confidence, averageConfidence reported as 0.75.
    const placeholderSeg = { start: 0, end: 3000, text: 'Processed segment 0', confidence: 0.75 };
    transcribeStreamMock.mockImplementation(
      async (_file: unknown, onProgress: ProgressHandler, onSegment: SegmentHandler) => {
        onProgress({
          processedDuration: 3000,
          totalDuration: 3000,
          currentSegment: placeholderSeg,
          segmentCount: 1,
          averageConfidence: 0.75,
        });
        onSegment(placeholderSeg);
        return { segments: [placeholderSeg], success: true, placeholder: true };
      },
    );

    const { container } = render(
      React.createElement(StreamingProcessor, { onComplete: jest.fn() }),
    );

    attachFakeFile(container);
    const button = getProcessFileButton();

    // Flush the microtask chain (mock resolution -> post-await completion
    // branch) INSIDE act so the completion render is committed when act exits
    // — the DOM assertions below read post-completion state, unlike the
    // spy-based legs above which never needed the render to flush.
    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
      await Promise.resolve();
    });

    // The placeholder route is disclosed via a note (screen-reader labeled),
    // and the rendered note text IS the single-source disclosure sentence —
    // a diverging inline copy in the component fails here.
    const notice = screen.getByRole('note', { name: PLACEHOLDER_NOTICE_ARIA_LABEL });
    expect(notice.textContent).toBe(PLACEHOLDER_NOTICE_TEXT);
    // The measured-looking run-level stat must NOT be displayed — 0.75 is the
    // disclosed placeholder constant, not an ASR reading.
    expect(screen.queryByText('75%')).toBeNull();
    // Disclosure instead of a fabricated number: the confidence cell states
    // the value is unmeasured.
    expect(screen.getByText(UNMEASURED_CONFIDENCE_LABEL)).toBeTruthy();
  });

  it('keeps the measured confidence stats display and renders no notice on the real (placeholder: false) route', async () => {
    const seg = { start: 0, end: 1500, text: 'first run process A then process B step by step', confidence: 0.92 };
    transcribeStreamMock.mockImplementation(
      async (_file: unknown, onProgress: ProgressHandler, onSegment: SegmentHandler) => {
        onProgress({
          processedDuration: 1500,
          totalDuration: 1500,
          currentSegment: seg,
          segmentCount: 1,
          averageConfidence: 0.92,
        });
        onSegment(seg);
        return { segments: [seg], success: true, placeholder: false };
      },
    );

    const { container } = render(
      React.createElement(StreamingProcessor, { onComplete: jest.fn() }),
    );

    attachFakeFile(container);
    const button = getProcessFileButton();

    // Same act-wrapped microtask flush as the placeholder leg above: the
    // post-completion DOM is the assertion target.
    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
      await Promise.resolve();
    });

    // 経路1 is a real measurement — the stats display is justified, and no
    // placeholder notice may appear.
    expect(screen.getByText('92%')).toBeTruthy();
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.queryByText(UNMEASURED_CONFIDENCE_LABEL)).toBeNull();
  });
});

describe('StreamingProcessor — placeholder disclosure reset wiring (TASK-0321 test stage)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Run one file run through the disclosed placeholder route and leave the
   * component in the completed-with-notice state. Returns the container for a
   * follow-up attachFakeFile.
   */
  async function completePlaceholderRun(): Promise<HTMLElement> {
    const placeholderSeg = { start: 0, end: 3000, text: 'Processed segment 0', confidence: 0.75 };
    transcribeStreamMock.mockImplementation(
      async (_file: unknown, onProgress: ProgressHandler, onSegment: SegmentHandler) => {
        onProgress({
          processedDuration: 3000,
          totalDuration: 3000,
          currentSegment: placeholderSeg,
          segmentCount: 1,
          averageConfidence: 0.75,
        });
        onSegment(placeholderSeg);
        return { segments: [placeholderSeg], success: true, placeholder: true };
      },
    );

    const { container } = render(
      React.createElement(StreamingProcessor, { onComplete: jest.fn() }),
    );
    attachFakeFile(container);
    await runFileToCompletion();

    // Precondition: run 1 disclosed the placeholder route.
    expect(
      screen.getByRole('note', { name: PLACEHOLDER_NOTICE_ARIA_LABEL }),
    ).toBeTruthy();
    return container;
  }

  /**
   * Stop returns the component to idle WITHOUT touching the disclosure flag
   * (`stopAllProcessing` only resets status/mode/progress) — so the stale
   * notice from run 1 is kept at bay solely by the START-of-run reset in the
   * next run. That start reset is the wiring under test in both legs below:
   * a real (or live) run presenting placeholder disclosure it did not earn
   * is the inverse bug of TASK-0321 (false disclosure instead of suppressed
   * stats).
   */
  it('clears the stale placeholder disclosure when a new file run starts', async () => {
    const container = await completePlaceholderRun();

    await act(async () => {
      fireEvent.click(getButton('Stop'));
    });

    // Run 2: the REAL route, held in flight so the during-run DOM (status
    // 'processing' — status card rendered) is assertable before the result
    // overwrites the flag at completion.
    const realSeg = { start: 0, end: 1500, text: 'first run process A then process B step by step', confidence: 0.92 };
    let resolveRun2: () => void = () => {};
    transcribeStreamMock.mockImplementation(
      (_file: unknown, onProgress: ProgressHandler, _onSegment: SegmentHandler) =>
        new Promise((resolve) => {
          resolveRun2 = () => {
            onProgress({
              processedDuration: 1500,
              totalDuration: 1500,
              currentSegment: realSeg,
              segmentCount: 1,
              averageConfidence: 0.92,
            });
            resolve({ segments: [realSeg], success: true, placeholder: false });
          };
        }),
    );

    attachFakeFile(container);
    await act(async () => {
      fireEvent.click(getProcessFileButton());
      await Promise.resolve();
    });

    // MID-RUN assertion: run 1 was a placeholder run and the status card is
    // rendered — if the start-of-run reset were missing, the stale notice
    // would present THIS real run as placeholder content while it processes.
    expect(screen.queryByRole('note')).toBeNull();

    // Completing the real run shows the measured stat and keeps the
    // disclosure gone.
    await act(async () => {
      resolveRun2();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText('92%')).toBeTruthy();
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('clears the stale placeholder disclosure when a live run starts', async () => {
    await completePlaceholderRun();

    await act(async () => {
      fireEvent.click(getButton('Stop'));
    });

    await act(async () => {
      fireEvent.click(getButton('Start Live Processing'));
      await Promise.resolve();
    });

    // Status is 'recording' (status card rendered) — the placeholder notice
    // from the earlier file run must not bleed into the live view.
    expect(screen.queryByRole('note')).toBeNull();

    // Teardown: stop the live recording.
    await act(async () => {
      fireEvent.click(getButton('Stop'));
    });
  });
});

describe('StreamingProcessor — placeholder disclosure vocabulary anchor (D-1 alignment)', () => {
  /**
   * The notice's parenthetical cites README「音声認識の現状」 — the same section
   * the server D-1 disclosure vocabulary (whisper-transcriber / streaming
   * placeholder constants) is documented under. The citation is only honest if
   * that section heading actually exists: extract the cited title FROM the
   * single-source notice constant (derived pin — no second copy here) and
   * require a matching heading in README.md. A README retitle breaks this leg
   * until the notice citation is updated in the same commit.
   */
  it('cites a README section heading that actually exists (derived from the notice constant)', () => {
    const readmePath = fileURLToPath(new URL('../../../README.md', import.meta.url));
    const readme = readFileSync(readmePath, 'utf8');

    const cited = PLACEHOLDER_NOTICE_TEXT.match(/README「(.+?)」/);
    expect(cited).not.toBeNull();
    const citedTitle = cited?.[1] ?? '';
    expect(citedTitle.length).toBeGreaterThan(0);

    const escaped = citedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    expect(readme).toMatch(new RegExp(`^#{2,4} ${escaped}\\s*$`, 'm'));
  });
});
