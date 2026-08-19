/**
 * @jest-environment jsdom
 *
 * TC-320: Iteration43Interface async-setState-after-unmount real fix + witness
 * pair (TASK-0220 sibling / REQ-300).
 *
 * `Iteration43Interface.startProcessing` is an async loop that awaits
 * `new Promise(resolve => setTimeout(resolve, 1000))` between iterations and
 * then fires a burst of setState calls (setProcessingPhases, setQualityMetrics,
 * and the final-completion block: setVideoUrl / setIsProcessing /
 * setCurrentPhase / setDevelopmentCycle). If the user navigates away while the
 * 1s await is in flight, the unmount cleanup runs but CANNOT cancel the
 * in-flight setTimeout promise — so the post-await branch keeps running and
 * calls setState on an unmounted component. The fix (mirroring TC-316/317/318/
 * 319) adds a `mountedRef` + an empty-deps unmount-cleanup useEffect and bails
 * with `if (!mountedRef.current) return;` immediately after the await.
 *
 * Three layers, each closing a different gap:
 *  TC-320-01 — source anchor (AUTHORITATIVE): pin via readFileSync regex the
 *              mountedRef declaration, the unmount-cleanup flip, and the
 *              post-await early return. Reverting ANY of these is RED
 *              independent of any runtime — this is the load-bearing layer.
 *  TC-320-02 — runtime positive control: mount, upload, click 処理開始, run the
 *              full simulated pipeline while STILL MOUNTED → the final quality
 *              score log appears (96.0%). Proves the mock reaches the post-await
 *              code so the hazard witness is not vacuous.
 *  TC-320-03 — runtime hazard witness: mount, upload, click 処理開始, UNMOUNT
 *              before the first 1s await resolves, then resolve it → with the
 *              guard the post-await branch bails and no React unmounted-state
 *              warning is emitted; the production code path completes without
 *              throwing. (React 18 dropped the classic setState-on-unmounted
 *              warning, so this layer is best-effort — the authoritative
 *              guarantee is the TC-320-01 source anchor, exactly like TC-316-03
 *              for InteractiveResultViewer which has the same no-external-
 *              side-effect shape.)
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
// jest-globals entry: extends the @jest/globals expect AND types the matchers
import '@testing-library/jest-dom/jest-globals';

const CHOKEPOINT_FILE = 'src/components/Iteration43Interface.tsx';

// Resolve REPO_ROOT from this test file's own location, not process.cwd().
// jest ESM workers can run with a cwd that is not the repo root (see TC-302 /
// TC-313 — same cwd race under --maxWorkers>1).
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// --- Pre-import mocks (passthrough UI primitives so the simulation runs) -----
// Mirrors src/components/__tests__/Iteration43Interface.test.tsx. TabsContent
// renders its children unconditionally so the iteration log (in the "quality"
// tab) is queryable regardless of the active tab.

jest.unstable_mockModule('lucide-react', () => ({
  Upload: () => React.createElement('span'),
  Play: () => React.createElement('span'),
  Download: () => React.createElement('span'),
  Settings: () => React.createElement('span'),
  Activity: () => React.createElement('span'),
  CheckCircle: () => React.createElement('span'),
  AlertCircle: () => React.createElement('span'),
  Info: () => React.createElement('span'),
}));

jest.unstable_mockModule('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  CardHeader: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  CardTitle: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  CardContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
}));

jest.unstable_mockModule('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => React.createElement('button', { onClick, disabled }, children),
}));

jest.unstable_mockModule('@/components/ui/progress', () => ({
  Progress: () => React.createElement('div'),
}));

jest.unstable_mockModule('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) =>
    React.createElement('span', null, children),
}));

jest.unstable_mockModule('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  TabsList: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  TabsTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  // Render children unconditionally so the log panel is always in the DOM.
  TabsContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
}));

jest.unstable_mockModule('@stv/core/lib/metrics-utils', () => ({
  bytesToMb: (bytes: number) => bytes / (1024 * 1024),
}));

const { default: Iteration43Interface } = await import('@/components/Iteration43Interface');

// --- (TC-320-01) source anchor (AUTHORITATIVE) ------------------------------

describe('Iteration43Interface unmount guard — source anchor pinned (TC-320-01)', () => {
  const src = (): string => readFileSync(path.join(REPO_ROOT, CHOKEPOINT_FILE), 'utf8');

  it('declares mountedRef as useRef(true)', () => {
    expect(src()).toMatch(/const\s+mountedRef\s*=\s*useRef\(\s*true\s*\)/);
  });

  it('flips mountedRef.current = false in an empty-deps unmount-cleanup useEffect', () => {
    // The cleanup must live in a dedicated empty-deps effect (not folded into a
    // state-dependent effect, which would falsely report "unmounted" on a state
    // change while still mounted). Matches the StreamingProcessor TC-319 shape.
    expect(src()).toMatch(
      /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{\s*return\s*\(\s*\)\s*=>\s*\{\s*mountedRef\.current\s*=\s*false\s*;?\s*\}\s*;?\s*\}\s*,\s*\[\s*\]\s*\)/,
    );
  });

  it('bails with an early return immediately after the in-loop await', () => {
    // The load-bearing guard: right after `await new Promise(setTimeout)`,
    // before any post-await setState. Removing this line is RED.
    expect(src()).toMatch(
      /await new Promise\(\s*resolve\s*=>\s*setTimeout\(\s*resolve,\s*1000\s*\)\s*\)\s*;[\s\S]*?if\s*\(\s*!mountedRef\.current\s*\)\s*return\s*;/,
    );
  });
});

// --- (TC-320-02) runtime positive control ------------------------------------

describe('Iteration43Interface unmount guard — positive control (TC-320-02)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Deterministic: Math.random()=0 → each phase runs all 3 iterations and the
    // final overallScore is Math.min(5*20, 96) = 96.
    jest.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('mounted: full pipeline completes → final score log appears (path is exercised)', async () => {
    const { container } = render(React.createElement(Iteration43Interface));

    const file = new File(['dummy'], 'test.wav', { type: 'audio/wav' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    const playBtn = screen.getByRole('button', { name: '処理開始' });
    await act(async () => {
      fireEvent.click(playBtn);
    });
    // Run the full simulated pipeline (5 phases × 3 iterations × 1000ms).
    await act(async () => {
      await jest.advanceTimersByTimeAsync(20000);
    });

    // If this stops appearing, the guard bailed while still mounted (regression)
    // OR the mock no longer reaches the post-await completion block (which would
    // make the hazard witness below vacuous).
    expect(screen.getByText(/Overall quality score: 96\.0%/)).toBeInTheDocument();
  });
});

// --- (TC-320-03) runtime hazard witness --------------------------------------

describe('Iteration43Interface unmount guard — absorbs unmount-during-await (TC-320-03)', () => {
  let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('unmount before the first 1s await resolves → no unmounted-state warning, no throw', async () => {
    const { container, unmount } = render(React.createElement(Iteration43Interface));

    const file = new File(['dummy'], 'test.wav', { type: 'audio/wav' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    const playBtn = screen.getByRole('button', { name: '処理開始' });
    // Fire startProcessing. The synchronous prologue runs (setIsProcessing,
    // setCurrentPhase, the first setProcessingPhases) and the loop then suspends
    // at `await new Promise(setTimeout(1000))` — the timer is pending but NOT
    // resolved because we have not advanced fake timers.
    await act(async () => {
      fireEvent.click(playBtn);
    });

    // Unmount WHILE the first iteration's await is still in flight. The cleanup
    // useEffect flips mountedRef.current = false.
    unmount();

    // Now resolve the in-flight await (the component is gone). With the guard,
    // the post-await branch bails via `if (!mountedRef.current) return;`. The
    // authoritative guarantee is the TC-320-01 source anchor; this layer proves
    // the production code path completes without throwing under the vector.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(20000);
    });

    const unmountedWarnings = consoleErrorSpy.mock.calls
      .map((c: unknown[]) => String(c[0] ?? ''))
      .filter((msg: string) =>
        /setState.*unmounted|Can.*not.*perform.*state.*update.*unmounted|Warning.*unmounted component/i.test(
          msg,
        ),
      );
    expect(unmountedWarnings).toEqual([]);
  });
});
