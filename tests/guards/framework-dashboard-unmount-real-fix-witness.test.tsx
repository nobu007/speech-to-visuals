/**
 * @jest-environment jsdom
 *
 * TC-322: FrameworkDashboard async-setState-after-unmount real fix + mutation
 * witness pair — the LAST whitelisted latent site from the TC-316-02 sweep.
 *
 * FrameworkDashboard was the final "KNOWN LATENT / FIX DEFERRED" entry in the
 * TC-316-02 hazard whitelist. Two hazards, both post-await setState on a
 * component that may have unmounted mid-await (dashboard tab switched away):
 *
 *  1. `fetchIterationData` — awaits `fetch('/api/framework/status')` AND
 *     `response.text()` before setExecutionStatus / setIterationHistory /
 *     setQualityAnalysis (ok-branch), a simulated-progress fallback
 *     setExecutionStatus (else-branch), and setExecutionStatus in the catch.
 *     It also runs on the auto-refresh setInterval, so an in-flight request
 *     at unmount time is the COMMON case: the interval cleanup clears the
 *     NEXT tick, not the pending request.
 *  2. `handleExecute` — awaits the `onExecute` prop; its catch branch resets
 *     isRunning via setExecutionStatus after the await.
 *
 * Layers (mirrors TC-316..321):
 *  1. Source anchor (TC-322-01): pin the `mountedRef` declaration, the
 *     dedicated empty-deps unmount-cleanup effect, and a guard at EVERY
 *     post-await setState site. Reverting any of these is RED independent of
 *     any runtime test — the authoritative witness (React 18 no longer logs
 *     the unmounted-setState warning, so a runtime-only layer would be
 *     vacuous; see the TC-316-03 comments for the same reasoning).
 *  2. L3 runtime (TC-322-02): import the ACTUAL production component, drive
 *     the real fetch path (start execution → auto-refresh interval fires
 *     fetchIterationData → fetch pending), unmount mid-flight, then resolve
 *     the fetch. Proves the guarded component mounts, runs its async path,
 *     and absorbs the late resolution without warnings — and that the fix
 *     introduced no mount/unmount regression.
 *
 * Companion edits in the same change:
 *  - `async-state-after-unmount-real-fix-witness.test.tsx` (TC-316-02):
 *    FrameworkDashboard removed from HAZARD_WHITELIST so the sweep
 *    re-tightens (a future file-wide guard removal is RED again).
 *  - `react-anti-patterns.regression.test.ts`: graduated from
 *    ALLOW_MISSING_MOUNT_GUARD (same as the StreamingProcessor TC-319
 *    precedent).
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { render, fireEvent, act, waitFor, screen } from '@testing-library/react';
import { FrameworkDashboard } from '@/components/FrameworkDashboard';

const CHOKEPOINT_FILE = 'src/components/FrameworkDashboard.tsx';

// Resolve REPO_ROOT from this test file's own location, not process.cwd()
// (jest ESM workers can run with a cwd that is not the repo root — see the
// TC-302/TC-316 comments for the same cwd race under --maxWorkers>1).
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Extract a function body from `const NAME = async () => { ... }` up to the
// first 2-space-indented closing `};` (function level — inner blocks are
// indented deeper, so the lazy match cannot overshoot into the next function).
function extractFunction(src: string, name: string): string {
  const m = src.match(new RegExp(`const ${name} = async \\(\\) => \\{[\\s\\S]*?\\n  \\};`));
  return m?.[0] ?? '';
}

// --- (TC-322-01) source anchor: pin mountedRef + cleanup + every guard -------

describe('FrameworkDashboard unmount guard — source anchor pinned (TC-322-01)', () => {
  const src = (): string => readFileSync(path.join(REPO_ROOT, CHOKEPOINT_FILE), 'utf8');

  it('declares mountedRef as useRef(true) and flips it in a dedicated empty-deps unmount-cleanup useEffect', () => {
    // Without a mountedRef declaration every post-await setState in the file
    // is unguarded; without a cleanup effect that flips it the guard never
    // activates. Dedicated empty-deps effect: folding the flip into the
    // auto-refresh effect would falsely report "unmounted" when its deps
    // re-arm on a state change while still mounted.
    expect(src()).toMatch(/const\s+mountedRef\s*=\s*useRef\(\s*true\s*\)/);
    expect(src()).toMatch(
      /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{\s*return\s*\(\s*\)\s*=>\s*\{\s*mountedRef\.current\s*=\s*false\s*;?\s*\}\s*;?\s*\}\s*,\s*\[\s*\]\s*\)/,
    );
  });

  it('fetchIterationData guards after the fetch await AND after the response.text await, before the first setState', () => {
    const body = extractFunction(src(), 'fetchIterationData');
    expect(body).not.toBe('');
    const guard = 'if (!mountedRef.current) return;';
    const firstGuard = body.indexOf(guard);
    // Guard #1: after `await fetch(...)`, before any setX (the else-branch
    // fallback and the catch path are both reachable from here).
    expect(firstGuard).toBeGreaterThan(body.indexOf('await fetch('));
    expect(firstGuard).toBeLessThan(body.indexOf('setExecutionStatus('));
    // Guard #2: `response.text()` is a SECOND await — the component can
    // unmount while the body read is in flight, so the data-driven setX group
    // needs its own call-time re-check (call-time ref mirror, not just one
    // check after the first await).
    const secondGuard = body.indexOf(guard, firstGuard + 1);
    expect(secondGuard).toBeGreaterThan(-1);
    expect(secondGuard).toBeGreaterThan(body.indexOf('await response.text()'));
    expect(body.indexOf('setIterationHistory(')).toBeGreaterThan(secondGuard);
    expect(body.indexOf('setQualityAnalysis(')).toBeGreaterThan(secondGuard);
  });

  it('fetchIterationData gates the catch-path fallback setExecutionStatus on mountedRef.current', () => {
    const body = extractFunction(src(), 'fetchIterationData');
    expect(body).not.toBe('');
    // A request that rejects after unmount must not setState on the gone
    // component; the logger.warn diagnostic stays unconditional.
    expect(body).toMatch(/catch \(error\) \{[\s\S]*?if \(mountedRef\.current\) \{[\s\S]*?setExecutionStatus/);
  });

  it('handleExecute gates the catch-path setExecutionStatus on mountedRef.current', () => {
    const body = extractFunction(src(), 'handleExecute');
    expect(body).not.toBe('');
    expect(body).toMatch(/catch \(error\) \{[\s\S]*?if \(mountedRef\.current\) \{[\s\S]*?setExecutionStatus/);
  });
});

// --- (TC-322-02) L3 runtime: real production code absorbs a late resolution --

describe('FrameworkDashboard unmount guard — production code absorbs a late fetch resolution (TC-322-02)', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let originalFetch: typeof globalThis.fetch | undefined;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    if (originalFetch !== undefined) {
      globalThis.fetch = originalFetch;
    }
    consoleErrorSpy.mockRestore();
  });

  it('start → fetch pending → unmount → resolve: no unmounted-update warning, no throw', async () => {
    // Hold the status fetch pending until AFTER the unmount — the exact
    // vector guard #1 closes (interval cleanup clears the next tick, not the
    // in-flight request).
    let resolveFetch!: (value: unknown) => void;
    const fetchMock = jest.fn(
      () =>
        new Promise((res) => {
          resolveFetch = res;
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { unmount } = render(<FrameworkDashboard autoRefresh={true} refreshInterval={5} />);

    // Start execution so executionStatus.isRunning flips true and the
    // auto-refresh effect arms the interval that calls fetchIterationData.
    fireEvent.click(screen.getByText('実行開始'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    unmount();

    await act(async () => {
      resolveFetch({ ok: false, text: async () => '' });
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 10));
    });

    const unmountedWarnings = consoleErrorSpy.mock.calls
      .map((c) => String(c[0] ?? ''))
      .filter((msg) => /setState.*unmounted|state update.*unmounted|Warning.*unmounted component/i.test(msg));
    expect(unmountedWarnings).toEqual([]);
  });

  it('happy path: mounted dashboard completes a data fetch cycle without errors (sanity)', async () => {
    // Counter-control: a normal mount + full ok-branch cycle (data-driven
    // setExecutionStatus / setIterationHistory / setQualityAnalysis all fire
    // while mounted) must also produce zero unmount-class warnings — if this
    // fires, the guard machinery itself broke the mounted path.
    const body = JSON.stringify({
      executionStatus: {
        isRunning: true,
        currentPhase: 'MVP構築',
        progress: 10,
        timeElapsed: 100,
        estimatedRemaining: 900,
        shouldCommit: false,
      },
      iterationHistory: [
        {
          iterationNumber: 1,
          phase: 'MVP構築',
          status: 'success',
          duration: 100,
          metrics: { scenes: 3 },
          timestamp: '2026-08-19T00:00:00.000Z',
        },
      ],
      qualityAnalysis: {
        overallScore: 90,
        needsImprovement: false,
        recommendations: [],
        breakdown: { performance: 90, accuracy: 90, stability: 90 },
      },
    });
    const fetchMock = jest.fn(() =>
      Promise.resolve({ ok: true, text: async () => body } as unknown as Response),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<FrameworkDashboard autoRefresh={true} refreshInterval={5} />);
    fireEvent.click(screen.getByText('実行開始'));

    // Let the interval fire at least one full fetch→text→setX cycle inside
    // act so the state updates land in an act-wrapped window.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(fetchMock).toHaveBeenCalled();
    const warnings = consoleErrorSpy.mock.calls
      .map((c) => String(c[0] ?? ''))
      .filter((m) => /unmounted component/i.test(m));
    expect(warnings).toEqual([]);
  });
});
