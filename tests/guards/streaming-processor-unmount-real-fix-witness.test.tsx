/**
 * @jest-environment jsdom
 *
 * TC-319: StreamingProcessor async-setState-after-unmount real fix +
 * RED→GREEN witness pair (sibling of TC-316/317/318, REQ-300, Phase 132).
 *
 * Delivers, together, the two things the AI Hub steering asked the guard
 * family to ground:
 *
 *  1. A REAL production-code behavior fix (A1 grounding). `handleFileProcessing`
 *     awaits `transcriber.current.transcribeStream(...)` and, on a non-empty
 *     result, invokes the `onComplete` prop with the accumulated scenes. The
 *     unmount cleanup calls `stopAllProcessing`, but that only stops LIVE
 *     transcription and clears timers — it CANNOT cancel the in-flight
 *     `transcribeStream` promise. So if the component unmounts mid-stream
 *     (route/tab switch), the post-await branch kept running: firing `onComplete`
 *     for an abandoned stream (the parent, e.g. Index.tsx, would then toast
 *     "ストリーミング処理完了" for a stream the user discarded) AND calling
 *     setState on an unmounted component. The fix mirrors TC-316/317/318: a
 *     `mountedRef` flipped in a dedicated empty-deps unmount effect, gating the
 *     post-await side effects.
 *
 *  2. An end-to-end RED→GREEN verify pair. The observable harm the guard closes
 *     is the stray `onComplete` prop invocation — a materially different side
 *     effect with/without the guard (React 18 no longer logs the "setState on
 *     unmounted component" warning, so we assert the side effect itself, not a
 *     vacuous warning — same lesson as TC-317/318).
 *
 * Three layers:
 *   TC-319-01 — source anchor: pin (via readFileSync regex) the mountedRef
 *               declaration, the dedicated unmount-cleanup flip, and the
 *               post-await `if (!mountedRef.current) return;` that precedes the
 *               `onComplete(...)` call. Reverting ANY of these is RED independent
 *               of the runtime. Also pins the catch-block guard (sibling path).
 *   TC-319-02 — runtime positive control: mounted component, transcribeStream
 *               resolves with a diagram segment → `onComplete` IS called. Proves
 *               the mock reaches the post-await onComplete branch, so the hazard
 *               witness below is not vacuous.
 *   TC-319-03 — runtime hazard witness (the load-bearing RED→GREEN): start file
 *               processing, UNMOUNT before transcribeStream resolves, then
 *               resolve → with the guard, `onComplete` is NOT called; without it
 *               it IS. This is the stray-onComplete-for-an-abandoned-stream harm
 *               the guard closes.
 */
import { jest } from '@jest/globals';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHOKEPOINT_FILE = 'src/components/StreamingProcessor.tsx';

// Resolve REPO_ROOT from this test file's own location, not process.cwd()
// (jest ESM workers can run with a cwd that is not the repo root — same cwd
// race noted in TC-302 / TC-313 under --maxWorkers>1).
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// ---------------------------------------------------------------------------
// Mocks — mirror src/components/__tests__/StreamingProcessor.test.tsx so the
// render path is identical to the regression suite's.
// ---------------------------------------------------------------------------

type SegmentHandler = (segment: { start: number; end: number; text: string }) => void;

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

beforeEach(() => {
  jest.clearAllMocks();
});

// --- (TC-319-01) source anchor ------------------------------------------------

describe('StreamingProcessor unmount guard — source anchor pinned (TC-319-01)', () => {
  const src = (): string => readFileSync(path.join(REPO_ROOT, CHOKEPOINT_FILE), 'utf8');

  it('declares mountedRef as useRef(true)', () => {
    expect(src()).toMatch(/const mountedRef = useRef\(true\)/);
  });

  it('flips mountedRef in a dedicated empty-deps unmount-cleanup useEffect', () => {
    // Pin that the flip lives in a stand-alone `useEffect(…, [])` whose cleanup
    // sets mountedRef.current = false — NOT folded into the config-dependent
    // init effect (which ends `}, [config]);`), which would falsely report
    // "unmounted" on a config change while still mounted. The empty-deps `[]`
    // terminator uniquely identifies this dedicated effect.
    const body = src();
    expect(body).toMatch(
      /useEffect\(\(\) => \{[\s\S]*?return \(\) => \{[\s\S]*?mountedRef\.current = false;[\s\S]*?\}, \[\]\);/,
    );
  });

  it('handleFileProcessing guards the post-await path BEFORE the onComplete call', () => {
    // Extract the handleFileProcessing body so we can assert ordering: the
    // `if (!mountedRef.current) return;` must appear AFTER the transcribeStream
    // await and BEFORE the `onComplete(...)` call. This is the load-bearing
    // line — removing it lets the stray onComplete through.
    const body = src();
    const m = body.match(/const handleFileProcessing = useCallback\(async \(\) => \{[\s\S]*?\}, \[onComplete\]\);/);
    if (m === null) {
      throw new Error('handleFileProcessing useCallback body not found in source');
    }
    const fnBody = m[0];

    const awaitIdx = fnBody.indexOf('await transcriber.current.transcribeStream');
    const guardIdx = fnBody.indexOf('if (!mountedRef.current) return;');
    const onCompleteIdx = fnBody.indexOf('onComplete(scenesRef.current)');

    expect(awaitIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeGreaterThan(awaitIdx); // guard is AFTER the await
    expect(onCompleteIdx).toBeGreaterThan(guardIdx); // onComplete is AFTER the guard
  });

  it('handleFileProcessing also guards the catch-block setStates (sibling rejection path)', () => {
    // The rejection path must be guarded too: a stream that rejects after
    // unmount must not setState on the gone component. (08ag lesson: guard
    // EVERY async path in the function or a sibling hides.)
    const body = src();
    const m = body.match(/const handleFileProcessing = useCallback\(async \(\) => \{[\s\S]*?\}, \[onComplete\]\);/);
    if (m === null) {
      throw new Error('handleFileProcessing useCallback body not found in source');
    }
    expect(m[0]).toMatch(
      /catch \(err\) \{[\s\S]*?if \(mountedRef\.current\) \{[\s\S]*?setStatus\('error'\)/,
    );
  });
});

// --- (TC-319-02) runtime positive control -------------------------------------

describe('StreamingProcessor unmount guard — positive control (TC-319-02)', () => {
  it('mounted component: transcribeStream resolves with a segment → onComplete IS called', async () => {
    // If this ever stopped calling onComplete, the hazard witness (TC-319-03)
    // would pass vacuously. This control proves the mock reaches the post-await
    // onComplete branch while the component is still mounted.
    const emittedSegment = { start: 0, end: 1500, text: 'first run process A then process B step by step' };
    transcribeStreamMock.mockImplementation(
      async (...args: unknown[]) => {
        const onSegment = args[2] as SegmentHandler;
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

    expect(onCompleteSpy).toHaveBeenCalledTimes(1);
  });
});

// --- (TC-319-03) runtime hazard witness (load-bearing RED→GREEN) --------------

describe('StreamingProcessor unmount guard — absorbs unmount-during-await (TC-319-03)', () => {
  it('unmount before transcribeStream resolves → no stray onComplete for the abandoned stream', async () => {
    // The vector: user starts file streaming, the transcription is in flight,
    // the user switches tabs (unmount), THEN the stream resolves. Pre-fix, the
    // post-await branch kept running and fired `onComplete(scenesRef.current)`
    // for the abandoned stream (plus setState on an unmounted component).
    // Post-fix, the `if (!mountedRef.current) return;` absorbs it — onComplete
    // is never invoked.
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Controllable deferred so the test controls WHEN transcribeStream
    // resolves. The executor runs synchronously at `new Promise(...)`, so the
    // holder is assigned before the guard below fires — kept `| undefined`
    // and checked fail-loudly instead of asserted away with `!`.
    let resolveTranscribe: ((value: unknown) => void) | undefined;
    transcribeStreamMock.mockReturnValue(
      new Promise((r) => {
        resolveTranscribe = r;
      }),
    );

    const onCompleteSpy = jest.fn();
    const { container, unmount } = render(
      React.createElement(StreamingProcessor, { onComplete: onCompleteSpy }),
    );

    attachFakeFile(container);
    const button = getProcessFileButton();

    // Fire the click WITHOUT awaiting the stream; it suspends at the
    // `await transcribeStream(...)` line.
    await act(async () => {
      fireEvent.click(button);
      // Flush microtasks so handleFileProcessing runs up to the awaiting line.
      await Promise.resolve();
    });

    // onComplete must not have fired yet (still pending).
    expect(onCompleteSpy).not.toHaveBeenCalled();

    // Unmount BEFORE the stream resolves (the hazard window).
    act(() => {
      unmount();
    });

    // Now resolve the in-flight stream with a non-empty segment result (the
    // component is gone). Pre-fix this would enter the `result.segments.length
    // > 0` branch and fire onComplete.
    await act(async () => {
      if (resolveTranscribe === undefined) {
        throw new Error('transcribeStream mock executor did not capture the resolver synchronously');
      }
      resolveTranscribe({ segments: [{ start: 0, end: 1500, text: 'flow process step' }] });
      await Promise.resolve();
      await Promise.resolve();
    });

    // WITH the guard: the post-await early return fired, so onComplete never
    // ran for the abandoned stream.
    // WITHOUT the guard: onComplete(scenesRef.current) WOULD fire.
    expect(onCompleteSpy).not.toHaveBeenCalled();

    // Belt-and-braces: React 18 dropped this warning, so this is defensive —
    // but if the guard were swapped for a no-op, any environment that still
    // warns would surface it here.
    const unmountedWarnings = consoleErrorSpy.mock.calls
      .map((c) => String(c[0] ?? ''))
      .filter((m) => /unmounted component|Can.*perform.*state.*update/i.test(m));
    expect(unmountedWarnings).toEqual([]);

    consoleErrorSpy.mockRestore();
  });
});
