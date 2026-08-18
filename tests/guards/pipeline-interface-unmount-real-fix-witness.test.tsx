/**
 * @jest-environment jsdom
 *
 * TC-321: PipelineInterface async-setState-after-unmount real fix +
 * RED→GREEN witness pair (sibling of TC-316/317/318/319/320, REQ-300,
 * Phase 132).
 *
 * `pipeline-interface.tsx` was the last substantial "FIX DEFERRED" entry in the
 * TC-316-02 hazard whitelist. It has THREE async handlers that setState / fire
 * external side effects after an `await`:
 *
 *   - `handleProcessAudio`: awaits `pipeline.execute(...)` (long-running) then
 *     bursts setStatus/setProgress/setResult/setStages/setCurrentStage, and the
 *     catch block does setStatus/setError.
 *   - `saveAudioFile`: `async` but contains no real await (synchronous body) —
 *     not a hazard on its own, but part of the file's async surface.
 *   - `handleDownloadVideo`: awaits `fetch('/api/render', { POST })` then
 *     awaits `response.text()`, and on the post-await branches fires
 *     `toast.error(...)` and `window.open(data.videoUrl, '_blank')` — REAL
 *     external side effects for an action the user may have abandoned.
 *
 * The load-bearing hazard is `handleDownloadVideo`: the render request is in
 * flight, the user switches tabs (unmount), THEN the fetch resolves. Pre-fix,
 * the post-await branch kept running — opening a browser window / surfacing a
 * stray toast for an action the user discarded, plus setState on an unmounted
 * component. React 18 no longer logs the "setState on unmounted component"
 * warning, so we assert the materially-different side effect itself (window.open
 * / toast), not a vacuous warning — same lesson as TC-317/318/319.
 *
 * Three layers:
 *   TC-321-01 — source anchor: pin (via readFileSync regex) the mountedRef
 *               declaration, the dedicated empty-deps unmount-cleanup flip, and
 *               the post-await `if (!mountedRef.current) return;` guards in
 *               BOTH handlers (ordering: after the await, before the side
 *               effect). Reverting ANY of these is RED independent of the
 *               runtime.
 *   TC-321-02 — runtime positive control: mounted component drives
 *               handleProcessAudio to completion (result card + Generate Video
 *               button render), then a resolving fetch → window.open IS called.
 *               Proves the mock reaches the post-fetch window.open branch, so
 *               the hazard witness below is not vacuous.
 *   TC-321-03 — runtime hazard witness (the load-bearing RED→GREEN): start the
 *               render request, UNMOUNT before fetch resolves, then resolve →
 *               with the guard, window.open is NOT called; without it it IS.
 *               This is the stray-window-for-an-abandoned-action harm the guard
 *               closes.
 */
import { jest } from '@jest/globals';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHOKEPOINT_FILE = 'src/components/pipeline-interface.tsx';

// Resolve REPO_ROOT from this test file's own location, not process.cwd()
// (jest ESM workers can run with a cwd that is not the repo root — same cwd
// race noted in TC-302 / TC-313 / TC-319 under --maxWorkers>1).
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// ---------------------------------------------------------------------------
// Mocks — every value import in pipeline-interface.tsx is stubbed so the render
// path runs in jsdom without pulling in the real pipeline / export stack.
// ---------------------------------------------------------------------------

const executeMock = jest.fn();

jest.unstable_mockModule('@/pipeline', () => ({
  __esModule: true,
  MainPipeline: jest.fn().mockImplementation(() => ({ execute: executeMock })),
}));

jest.unstable_mockModule('@/analysis/llm-utils', () => ({
  __esModule: true,
  // Passthrough — the response body is test-controlled, so the sanitizer's
  // behavior is exercised elsewhere; here we only need the parsed shape.
  parseUntrustedJson: (s: string) => JSON.parse(s),
}));

jest.unstable_mockModule('@stv/core/lib/metrics-utils', () => ({
  __esModule: true,
  bytesToMb: (b: number) => b / (1024 * 1024),
}));

jest.unstable_mockModule('@stv/core/utils/logger', () => ({
  __esModule: true,
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.unstable_mockModule('sonner', () => ({
  __esModule: true,
  toast: { info: jest.fn(), success: jest.fn(), error: jest.fn(), warning: jest.fn() },
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

jest.unstable_mockModule('lucide-react', () => {
  const make = () => (props: Record<string, unknown>) => React.createElement('span', props);
  const mod: Record<string, unknown> = {};
  for (const name of ['Upload', 'Play', 'Download', 'Settings', 'BarChart3']) {
    mod[name] = make();
  }
  return mod;
});

const { PipelineInterface } = await import('@/components/pipeline-interface');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fetchMock = jest.fn();

/** Attach a fake audio File to the hidden <input type="file"> and fire onChange. */
function attachFakeFile(container: HTMLElement, filename = 'audio.wav'): void {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  expect(input).toBeTruthy();
  const file = new File(['fake-audio'], filename, { type: 'audio/wav' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  // Fire the change event so handleFileSelect runs and setSelectedFile(file)
  // commits — without this the "Process Audio" button (gated on selectedFile)
  // never renders.
  fireEvent.change(input);
}

function getButton(label: string): HTMLButtonElement {
  const btn = screen
    .getAllByRole('button')
    .find((b) => b.textContent?.includes(label)) as HTMLButtonElement | undefined;
  expect(btn).toBeTruthy();
  return btn as HTMLButtonElement;
}

/**
 * Drive the real component through handleProcessAudio to a mounted state where
 * the result card + "Generate Video" button are rendered. Returns the render
 * utils (incl. `unmount`).
 */
async function renderUntilReady() {
  executeMock.mockResolvedValue({
    success: true,
    scenes: [],
    stages: [{ name: 'transcription', status: 'complete' }],
    duration: 1000,
    processingTime: 1000,
  });
  const utils = render(React.createElement(PipelineInterface));
  attachFakeFile(utils.container);
  const processBtn = getButton('Process Audio');
  await act(async () => {
    fireEvent.click(processBtn);
    await new Promise((r) => setTimeout(r, 0));
  });
  // The Generate Video button only appears once result.success is set.
  await waitFor(() => expect(getButton('Generate Video')).toBeTruthy());
  return utils;
}

beforeEach(() => {
  jest.clearAllMocks();
  (globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
  // jsdom does not implement URL.createObjectURL / revokeObjectURL.
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = jest.fn(() => 'blob:fake');
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = jest.fn();
});

// --- (TC-321-01) source anchor ------------------------------------------------

describe('PipelineInterface unmount guard — source anchor pinned (TC-321-01)', () => {
  const src = (): string => readFileSync(path.join(REPO_ROOT, CHOKEPOINT_FILE), 'utf8');

  it('declares mountedRef as useRef(true)', () => {
    expect(src()).toMatch(/const mountedRef = useRef\(true\)/);
  });

  it('flips mountedRef in a dedicated empty-deps unmount-cleanup useEffect', () => {
    // The flip must live in a stand-alone `useEffect(…, [])` whose cleanup sets
    // mountedRef.current = false. The empty-deps `[]` terminator uniquely
    // identifies the dedicated unmount effect (folding it into a non-empty-deps
    // effect would falsely report "unmounted" on a re-render).
    expect(src()).toMatch(
      /useEffect\(\(\) => \{[\s\S]*?return \(\) => \{[\s\S]*?mountedRef\.current = false;[\s\S]*?\}, \[\]\);/,
    );
  });

  it('handleDownloadVideo guards BEFORE window.open (post-fetch + post-text)', () => {
    const body = src();
    const m = body.match(/const handleDownloadVideo = useCallback\(async \(\) => \{[\s\S]*?\}, \[result\]\);/);
    expect(m).not.toBeNull();
    const fnBody = m![0];

    const fetchIdx = fnBody.indexOf('await fetch(');
    const guardPositions = [...fnBody.matchAll(/if \(!mountedRef\.current\) return;/g)].map(
      (mm) => mm.index as number,
    );
    const windowOpenIdx = fnBody.indexOf('window.open(');

    expect(fetchIdx).toBeGreaterThan(-1);
    // Two await points (fetch, response.text()) → two guards.
    expect(guardPositions.length).toBeGreaterThanOrEqual(2);
    // First guard sits AFTER the fetch await.
    expect(guardPositions[0]).toBeGreaterThan(fetchIdx);
    // window.open sits AFTER the LAST guard (the post-response.text() one).
    expect(windowOpenIdx).toBeGreaterThan(guardPositions[guardPositions.length - 1]);
  });

  it('handleDownloadVideo guards both toast.error call sites', () => {
    // toast fires on the !response.ok branch and in the catch block; each must
    // be gated so an abandoned render does not surface a stray toast.
    const body = src();
    expect(body).toMatch(
      /if \(mountedRef\.current\) toast\.error\('Video rendering failed\./,
    );
    expect(body).toMatch(
      /if \(mountedRef\.current\) toast\.error\('Video rendering encountered an error\./,
    );
  });

  it('handleProcessAudio guards the post-await path BEFORE setStatus complete', () => {
    const body = src();
    const m = body.match(/const handleProcessAudio = useCallback\(async \(\) => \{[\s\S]*?\}, \[selectedFile, pipeline\]\);/);
    expect(m).not.toBeNull();
    const fnBody = m![0];

    const executeIdx = fnBody.indexOf('await pipeline.execute');
    const guardIdx = fnBody.indexOf('if (!mountedRef.current) return;');
    const completeIdx = fnBody.indexOf("setStatus('complete')");

    expect(executeIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeGreaterThan(executeIdx); // guard AFTER the execute await
    expect(completeIdx).toBeGreaterThan(guardIdx); // setStatus AFTER the guard
  });

  it('handleProcessAudio guards the catch-block setStates (sibling rejection path)', () => {
    // 08ag lesson: guard EVERY async path or a sibling hides. The rejection
    // path must not setState on the gone component.
    const body = src();
    const m = body.match(/const handleProcessAudio = useCallback\(async \(\) => \{[\s\S]*?\}, \[selectedFile, pipeline\]\);/);
    expect(m).not.toBeNull();
    expect(m![0]).toMatch(
      /catch \(err\) \{[\s\S]*?if \(!mountedRef\.current\) return;[\s\S]*?setStatus\('error'\)/,
    );
  });
});

// --- (TC-321-02) runtime positive control -------------------------------------

describe('PipelineInterface unmount guard — positive control (TC-321-02)', () => {
  it('mounted component: fetch resolves ok → window.open IS called', async () => {
    // If this ever stopped calling window.open, the hazard witness (TC-321-03)
    // would pass vacuously. This control proves the mock reaches the post-fetch
    // window.open branch while the component is still mounted.
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ videoUrl: 'https://example.com/rendered.mp4' }),
    });

    const { container } = await renderUntilReady();
    const button = getButton('Generate Video');

    await act(async () => {
      fireEvent.click(button);
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(openSpy).toHaveBeenCalledWith('https://example.com/rendered.mp4', '_blank');

    openSpy.mockRestore();
    // container is referenced to keep the render alive across the await above.
    void container;
  });
});

// --- (TC-321-03) runtime hazard witness (load-bearing RED→GREEN) --------------

describe('PipelineInterface unmount guard — absorbs unmount-during-await (TC-321-03)', () => {
  it('unmount before fetch resolves → no stray window.open for the abandoned render', async () => {
    // The vector: user clicks Generate Video, the /api/render request is in
    // flight, the user switches tabs (unmount), THEN the fetch resolves.
    // Pre-fix, the post-await branch kept running and called window.open for
    // the abandoned action. Post-fix, the `if (!mountedRef.current) return;`
    // absorbs it — window.open is never called.
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

    // Controllable deferred so the test controls WHEN fetch resolves.
    let resolveFetch!: (value: unknown) => void;
    fetchMock.mockReturnValue(
      new Promise((r) => {
        resolveFetch = r;
      }),
    );

    const { unmount } = await renderUntilReady();
    const button = getButton('Generate Video');

    // Fire the click WITHOUT awaiting fetch; handleDownloadVideo suspends at
    // `await fetch(...)`.
    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });

    // window.open must not have fired yet (still pending).
    expect(openSpy).not.toHaveBeenCalled();

    // Unmount BEFORE the fetch resolves (the hazard window).
    act(() => {
      unmount();
    });

    // Now resolve the in-flight fetch with an ok response carrying a videoUrl
    // (the component is gone). Pre-fix this would reach window.open.
    await act(async () => {
      resolveFetch({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ videoUrl: 'https://example.com/rendered.mp4' }),
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    // WITH the guard: the post-await early return fired, so window.open never
    // ran for the abandoned render.
    // WITHOUT the guard: window.open('https://example.com/rendered.mp4', '_blank')
    // WOULD fire.
    expect(openSpy).not.toHaveBeenCalled();

    // Belt-and-braces: React 18 dropped this warning, so this is defensive —
    // but if the guard were swapped for a no-op, any environment that still
    // warns would surface it here.
    const unmountedWarnings = consoleErrorSpy.mock.calls
      .map((c) => String(c[0] ?? ''))
      .filter((m) => /unmounted component|Can.*perform.*state.*update/i.test(m));
    expect(unmountedWarnings).toEqual([]);

    consoleErrorSpy.mockRestore();
    openSpy.mockRestore();
  });
});
