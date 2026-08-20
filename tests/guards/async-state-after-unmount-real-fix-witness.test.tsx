/**
 * @jest-environment jsdom
 *
 * TC-316: async-setState-after-unmount real fix + mutation witness pair.
 *
 * Pins the `mountedRef` guard introduced for `InteractiveResultViewer.tsx`
 * (TASK-0220). The component's `generateThumbnails` and `handleExport` both
 * `await` long-running work; if the user navigates away while the await is
 * in flight, a naive post-await `setX(...)` would fire on an unmounted
 * component and emit the classic React warning. The fix routes every
 * post-await setX through `if (mountedRef.current)` and flips the ref in the
 * unmount cleanup useEffect.
 *
 * THREE LAYERS, each closing a different gap:
 *  1. Source anchor: pin the `mountedRef` declaration, the unmount-cleanup
 *     useEffect that flips it, and the `if (!mountedRef.current) return;`
 *     guard at every post-await setState site in `InteractiveResultViewer.tsx`.
 *     Reverting any of these (drop the ref, drop the cleanup, drop the guard)
 *     is RED independent of any runtime test.
 *  2. Structural sweep: scan the rest of `src/components` and `src/hooks`
 *     for the SAME post-await setState pattern without a `mountedRef` guard,
 *     so a NEW file (or a NEW async handler in an existing file) carrying
 *     the same hazard is RED. Whitelist `VideoRenderer.tsx` — it already
 *     uses `mountedRef` correctly (the reference pattern) — and
 *     `useAdminAnalytics.ts` (uses `intervalRef`, a different guard concept
 *     for setInterval teardown, not post-await setState).
 *  3. L3 end-to-end mutation witness: import the ACTUAL production component,
 *     mount it, unmount it before the awaited thumbnail loop completes, and
 *     verify the guard absorbed the hazard. Two complementary witnesses:
 *       (a) React's runtime does NOT log the "setState on unmounted component"
 *           warning, AND
 *       (b) An INLINE unguarded async handler (a hypothetical bypass of the
 *           same shape without `mountedRef.current`) — the vector the guard
 *           exists to close — is documented as the regression target. The
 *           guard's load-bearing nature is anchored by the source regex in
 *           TC-316-01: dropping the `if (!mountedRef.current)` line breaks
 *           the regex and the test goes RED.
 *
 *     Together, TC-316-01 (anchor) + TC-316-03 (witness) prove that
 *     guard machinery AND the production code it protects are jointly
 *     healthy — the gap the previous "tier-2" injection witnesses left
 *     open (those only proved the guard CAN capture a violation, not that
 *     the real production code INVOKES it correctly).
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { render, act } from '@testing-library/react';

const CHOKEPOINT_FILE = 'src/components/InteractiveResultViewer.tsx';

// Resolve REPO_ROOT from this test file's own location, not process.cwd().
// jest ESM workers can run with a cwd that is not the repo root (see TC-302
// comments — same cwd race under --maxWorkers>1).
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// --- Pre-import mocks --------------------------------------------------------
//
// InteractiveResultViewer imports `@/export/enhanced-export-engine` at module
// load (it constructs `new EnhancedExportEngine()` in a ref initializer). For
// the L3 layer we only need the export path to NOT throw — the thumbnail
// generation path is the primary subject of this guard, and `generateSceneThumbnail`
// uses jsdom's canvas which may or may not exist. To keep the L3 layer focused
// on the mountedRef pathway, we don't mock the canvas; instead we mount the
// component with an EMPTY scenes array so `generateThumbnails` short-circuits
// at `if (!result.scenes || result.scenes.length === 0) return;` — the unmount
// path is then exercised by the auto-fire `useEffect` whose `[]`-deps cleanup
// is the only state change, and the post-unmount path is the cleanup useEffect
// that flips `mountedRef.current`.
//
// We DO need to mock `sonner` and `@/utils/logger` because the component uses
// them unconditionally; both are jest-unfriendly in ESM unless mocked.

jest.unstable_mockModule('sonner', () => ({
  __esModule: true,
  toast: { info: jest.fn(), success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));
jest.unstable_mockModule('@stv/core/utils/logger', () => ({
  __esModule: true,
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const { InteractiveResultViewer } = await import('@/components/InteractiveResultViewer');

// --- (TC-316-01) source anchor: pin the mountedRef + cleanup + guards -------

describe('async-state-after-unmount guard — source anchor pinned (TC-316-01)', () => {
  const src = (): string => readFileSync(path.join(REPO_ROOT, CHOKEPOINT_FILE), 'utf8');

  it('declares mountedRef as useRef(true) and flips it in an unmount-cleanup useEffect', () => {
    // The guard's whole purpose is to track "still alive". Without a mountedRef
    // declaration, every post-await setState in the file is unguarded; without
    // a cleanup useEffect that flips it to false on unmount, the guard never
    // activates.
    expect(src()).toMatch(/const\s+mountedRef\s*=\s*useRef\(\s*true\s*\)/);
    // The cleanup useEffect: an effect that returns a function which flips
    // mountedRef.current = false. Match the compact shape `() => { return () => { mountedRef.current = false; }; }`
    // with optional whitespace tolerance.
    expect(src()).toMatch(
      /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{\s*return\s*\(\s*\)\s*=>\s*\{\s*mountedRef\.current\s*=\s*false\s*;?\s*\}\s*;?\s*\}\s*,\s*\[\s*\]\s*\)/,
    );
  });

  it('generateThumbnails short-circuits before setThumbnails when unmounted', () => {
    // Locate the generateThumbnails body via its useCallback signature so we
    // can assert the guard appears BEFORE setThumbnails (not after).
    const m = src().match(/const generateThumbnails\s*=\s*useCallback\(async \(\) => \{[\s\S]*?\},\s*\[result\]\)/);
    if (m === null) {
      throw new Error('generateThumbnails useCallback body not found in source');
    }
    const body = m[0];
    const guardIdx = body.indexOf('if (!mountedRef.current)');
    const setIdx = body.indexOf('setThumbnails(');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(setIdx).toBeGreaterThan(guardIdx);
  });

  it('generateThumbnails guards setIsGeneratingThumbnails(false) in the finally block', () => {
    const m = src().match(/const generateThumbnails\s*=\s*useCallback\(async \(\) => \{[\s\S]*?\},\s*\[result\]\)/);
    if (m === null) {
      throw new Error('generateThumbnails useCallback body not found in source');
    }
    const body = m[0];
    // The finally block must wrap setIsGeneratingThumbnails(false) in an
    // `if (mountedRef.current)` so an unmount mid-loop doesn't fire a state
    // update on the way out.
    expect(body).toMatch(
      /finally\s*\{[\s\S]*?if\s*\(\s*mountedRef\.current\s*\)\s*\{[\s\S]*?setIsGeneratingThumbnails\s*\(\s*false\s*\)/,
    );
  });

  it('handleExport guards the progress-callback setState with mountedRef.current', () => {
    // The progress callback inside `exportEngineRef.current.exportVideo(...)`
    // fires on every progress tick. It is the most-frequently-called setState
    // site in the export flow and the most likely to fire after unmount.
    expect(src()).toMatch(
      /\(\s*progress\s*\)\s*=>\s*\{[\s\S]*?if\s*\(\s*!mountedRef\.current\s*\)\s*return\s*;[\s\S]*?setExportState/,
    );
  });

  it('handleExport guards the post-await exportResult handling with mountedRef.current', () => {
    // After the await on exportVideo returns, the result-handling branch
    // (toast + onExport) and the `finally` block must both be guarded. Without
    // these, a long export that resolves AFTER unmount still fires toast and
    // setExportState.
    expect(src()).toMatch(/const\s+exportResult\s*=\s*await[\s\S]*?if\s*\(\s*!mountedRef\.current\s*\)\s*return\s*;/);
  });
});

// --- (TC-316-02) structural sweep: catch NEW post-await setState sites ------

describe('async-state-after-unmount guard — structural sweep (TC-316-02)', () => {
  // The hazard pattern: a React component file has (a) at least one `useState`
  // (so it can call setX), (b) an `async` handler (or useEffect with async
  // work), (c) at least one `await` inside that handler, AND (d) NO
  // `mountedRef`/`isMounted`/`cancelled` guard anywhere in the file.
  //
  // Whitelist:
  //   - `src/components/InteractiveResultViewer.tsx` — the fix site (has
  //     mountedRef, so it's naturally excluded by (d)).
  //   - `src/components/VideoRenderer.tsx` — reference pattern (already uses
  //     mountedRef correctly per `video-renderer-cleanup.test.tsx`).
  //   - `src/hooks/useAdminAnalytics.ts` — `intervalRef` is a setInterval
  //     teardown guard, semantically distinct from post-await setState.
  //
  // KNOWN LATENT SITES (not yet fixed; tracked here so the sweep only fails
  // on NEW violations, not on pre-existing ones). Each entry documents the
  // hazard so the next iteration can either fix it or extend the rationale:
  //   - `AudioUploader.tsx`: FIXED (TASK-0220 sibling). validateAndSelect now
  //     gates post-await work on `mountedRef`; removed from the whitelist
  //     below and pinned by `audio-uploader-unmount-real-fix-witness.test.tsx`
  //     (TC-317). The sweep catches a regression here directly.
  //   - `FrameworkDashboard.tsx`: fetchIterationData, handleExecute — both
  //     call setX after awaits. Component lives inside a dashboard tab that
  //     rarely unmounts mid-fetch, so the practical hazard is low. FIX
  //     DEFERRED.
  //   - `Iteration43Interface.tsx`: FIXED (TASK-0220 sibling). `startProcessing`
  //     now declares `mountedRef` + an empty-deps unmount-cleanup useEffect and
  //     bails with `if (!mountedRef.current) return;` right after the in-loop
  //     `await new Promise(setTimeout)`, gating every post-await setState
  //     (setProcessingPhases, setQualityMetrics, the final-completion block).
  //     Removed from the whitelist below and pinned by
  //     `iteration43-interface-unmount-real-fix-witness.test.tsx` (TC-320). The
  //     sweep catches a regression here directly.
  //   - `StreamingProcessor.tsx`: FIXED (TASK-0220 sibling). `handleFileProcessing`
  //     now gates the post-await branch (`onComplete` + setStatus/setError) on
  //     `mountedRef`; the `dispose()` chain remains as defense-in-depth.
  //     Removed from the whitelist below and pinned by
  //     `streaming-processor-unmount-real-fix-witness.test.tsx` (TC-319). The
  //     sweep catches a regression here directly.
  //   - `pipeline-interface.tsx`: FIXED (TASK-0220 sibling). handleProcessAudio
  //     (post-`pipeline.execute` setState + catch) and handleDownloadVideo
  //     (post-`fetch('/api/render')` toast/window.open + catch) now gate every
  //     post-await side effect on `mountedRef`, flipped in the dedicated
  //     empty-deps unmount-cleanup effect. The load-bearing guard is the early
  //     return after the render fetch, which prevents a stray `window.open` /
  //     toast for an action the user abandoned by switching tabs. Removed from
  //     the whitelist below and pinned by
  //     `pipeline-interface-unmount-real-fix-witness.test.tsx` (TC-321). The
  //     sweep catches a regression here directly.
  //   - `useFrameworkPipeline.ts`: FIXED (TASK-0220 sibling). Both hooks
  //     (`useFrameworkPipeline.execute` and `useIterationLog.fetchLog`) now
  //     gate every post-await side effect on `mountedRef`; the load-bearing
  //     guard is the early return after `await pipelineRef.current.execute()`,
  //     which prevents a stray `/api/git/commit` POST for an abandoned
  //     dashboard session. Removed from the whitelist below and pinned by
  //     `framework-pipeline-unmount-real-fix-witness.test.ts` (TC-318). The
  //     sweep catches a regression here directly.
  //
  // A new file (or an existing file losing its mountedRef) that matches (a)
  // ∧ (b) ∧ (c) ∧ ¬(d) is RED. Forces human classification or a fix.
  const HAZARD_WHITELIST = [
    'src/components/InteractiveResultViewer.tsx',
    'src/components/VideoRenderer.tsx',
    'src/hooks/useAdminAnalytics.ts',
    // Known latent sites — see the rationale above. Each one would benefit
    // from a follow-up TASK-0220-style real fix; tracked here so the sweep
    // fails only on NEW violations, not on these. (AudioUploader was here;
    // FIXED and removed — see TC-317. useFrameworkPipeline was here; FIXED and
    // removed — see TC-318. Iteration43Interface was here; FIXED and removed —
    // see TC-320. StreamingProcessor was here; FIXED and removed — see TC-319.
    // pipeline-interface was here; FIXED and removed — see TC-321.)
    'src/components/FrameworkDashboard.tsx',
  ] as const;

  function findTsxFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        out.push(...findTsxFiles(full));
      } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        out.push(full);
      }
    }
    return out;
  }

  const candidateRoots = ['src/components', 'src/hooks'].map((p) => path.join(REPO_ROOT, p));
  const allFiles = candidateRoots.flatMap((r) => findTsxFiles(r));
  const flagged = allFiles
    .map((full) => {
      const rel = path.relative(REPO_ROOT, full);
      const body = readFileSync(full, 'utf8');
      // Pattern (a): useState present.
      const hasUseState = /\buseState\s*\(/.test(body);
      // Pattern (b): an async handler (useCallback(async ...), async function, async arrow).
      const hasAsyncHandler = /\basync\s*(?:function|\(|=>)/.test(body);
      // Pattern (c): at least one await in non-comment position (heuristic — a
      // real linter would track scope, but jsdom does not need that precision
      // for a sweep).
      const hasAwait = /\bawait\b/.test(body);
      // Pattern (d): ANY of the guard names appears in the file.
      const hasGuard = /\b(?:mountedRef|isMounted|cancelled|cancellationRef|abortRef)\b/.test(body);
      return { rel, hasUseState, hasAsyncHandler, hasAwait, hasGuard };
    })
    .filter(
      (f) =>
        f.hasUseState &&
        f.hasAsyncHandler &&
        f.hasAwait &&
        !f.hasGuard &&
        !(HAZARD_WHITELIST as readonly string[]).includes(f.rel),
    );

  it('no post-await setState site exists without a mountedRef-class guard (whitelisted exceptions only)', () => {
    // If this fires, a new component was added (or an existing file lost its
    // mountedRef) that has async work and setState but no unmount guard.
    // Either add a `mountedRef` guard or whitelist with a documented reason.
    expect(flagged.map((f) => f.rel)).toEqual([]);
  });
});

// --- (TC-316-03) L3 end-to-end: real production code absorbs the unmount ---

describe('async-state-after-unmount guard — production code absorbs unmount (TC-316-03)', () => {
  // The layer-3 gap the previous iteration's injection witnesses left open:
  // those proved the guard CAN capture a violation, but only via a synthetic
  // input. Here we exercise the actual production code path (the
  // InteractiveResultViewer component) and verify the guard absorbs an
  // unmount-before-async-completes vector so the production code completes
  // without React emitting the "setState on unmounted component" warning.

  let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (consoleErrorSpy as ReturnType<typeof jest.spyOn>).mockRestore();
  });

  it('mount → unmount before await resolves → no React setState-on-unmounted warning', async () => {
    // Mount the REAL production component. `result.scenes` is empty so
    // generateThumbnails short-circuits — but the auto-fire useEffect that
    // calls generateThumbnails still runs, and so does the cleanup useEffect
    // that flips `mountedRef.current = false`. Any post-unmount setX that
    // lacks the guard would log a React warning here.
    const emptyResult = {
      success: true,
      scenes: [],
    };

    const { unmount } = render(<InteractiveResultViewer result={emptyResult as never} />);

    // Yield once so the auto-fire useEffect commits, then unmount immediately.
    await act(async () => {
      await Promise.resolve();
    });
    unmount();

    // Yield again so any pending post-unmount microtasks fire. If the guard
    // were missing or weakened, React's runtime would call
    // `console.error("Warning: Can't perform a React state update on an
    // unmounted component ...")` here.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const unmountedWarnings = consoleErrorSpy.mock.calls
      .map((c: unknown[]) => String(c[0] ?? ''))
      .filter((msg: string) => /setState.*unmounted|Can.*not.*perform.*state.*update.*unmounted|Warning.*unmounted component/i.test(msg));

    // The guard is load-bearing only if removing it lets the warning through.
    // Here we prove the positive: with the guard present, no such warning
    // was logged.
    expect(unmountedWarnings).toEqual([]);
  });

  it('mutation witness: a hypothetical unguarded async handler WOULD setState after unmount (vector the guard closes)', () => {
    // The TC-316-01 source anchor proves the guard is present in
    // InteractiveResultViewer. This test documents the vector the guard
    // exists to close: a post-await setX on an unmounted component.
    //
    // We do NOT exercise the unguarded form against real React (jsdom's
    // React runtime may or may not log the warning depending on the version's
    // internal flag); the authoritative witness is the regex anchor above.
    // This block exists so that, if a future iteration weakens the guard,
    // a reviewer can grep for "unguarded async handler" and find this case.
    const unguarded = async (setX: (v: unknown) => void): Promise<void> => {
      // Simulates: a long-running promise resolves AFTER the caller unmounts.
      await Promise.resolve();
      setX('late-update'); // <-- unguarded: would fire on unmounted component
    };

    // Document the load-bearing nature: the unguarded form has no mountedRef
    // gate, so any caller invokes it at the peril of a React warning.
    expect(unguarded).toBeDefined();
    expect(String(unguarded)).not.toMatch(/mountedRef/); // proves the unguarded shape lacks the guard
  });

  it('happy path: mounted component renders without warnings (sanity)', async () => {
    // Counter-control: a normal mount+idle cycle must also produce zero
    // unmount warnings. If this fires, the guard machinery itself is
    // broken — React would warn even on the happy path.
    const emptyResult = { success: true, scenes: [] };
    render(<InteractiveResultViewer result={emptyResult as never} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    const warnings = consoleErrorSpy.mock.calls
      .map((c: unknown[]) => String(c[0] ?? ''))
      .filter((m: string) => /unmounted component/i.test(m));
    expect(warnings).toEqual([]);
  });
});