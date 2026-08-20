/**
 * @jest-environment jsdom
 *
 * TC-318: useFrameworkPipeline async-setState-after-unmount real fix +
 * RED→GREEN witness pair (TASK-0220 sibling / REQ-300, Phase 132).
 *
 * The AI Hub steering (iter 32 feedback) asked for two things this file
 * delivers together:
 *
 *  1. A REAL production-code behavior fix (A1 grounding), not another
 *     injection/fixture-only witness: pick a critical-path guard's violating
 *     instance and fix it + test it as a pair. `useFrameworkPipeline.execute`
 *     awaits `pipelineRef.current.execute()` and, on shouldCommit +
 *     enableAutoCommit, a second `await fetch('/api/git/commit')`. If the
 *     dashboard unmounts mid-run (tab/route switch), the pre-fix post-await
 *     branch kept running — calling setState on an unmounted hook AND firing a
 *     stray `git commit` POST for an abandoned session. The fix mirrors TC-316/
 *     317: a `mountedRef` flipped in the unmount cleanup, gating every
 *     post-await side effect.
 *
 *  2. An end-to-end RED→GREEN verify pair: introduce the violation (revert the
 *     guard) → the witness goes RED → restore the guard → GREEN. The observable
 *     harm the guard closes is the stray `/api/git/commit` network request —
 *     a materially different side effect with/without the guard (React 18 no
 *     longer logs the "setState on unmounted component" warning, so we assert
 *     the side effect, not a vacuous warning — same lesson as TC-317).
 *
 * Three layers:
 *   TC-318-01 — source anchor: pin (via readFileSync regex) the mountedRef
 *               declaration, the unmount-cleanup flip, and the post-await
 *               `if (!mountedRef.current) return;` that precedes the commit
 *               branch. Reverting ANY of these is RED independent of runtime.
 *   TC-318-02 — runtime positive control: mounted hook, execute resolves with
 *               shouldCommit + enableAutoCommit → `/api/git/commit` IS called.
 *               Proves the mock reaches the post-await commit branch, so the
 *               hazard witness below is not vacuous.
 *   TC-318-03 — runtime hazard witness (the load-bearing RED→GREEN): start
 *               execute, UNMOUNT before the framework run resolves, then
 *               resolve → with the guard, `/api/git/commit` is NOT called;
 *               without the guard it IS. This is the stray-commit-for-an-
 *               abandoned-session harm the guard closes.
 *
 * Also exercises the sibling `useIterationLog` hook's fetchLog guard via a
 * source-anchor + a structural "no unmount warning" check (its only post-await
 * side effects are setState, so the load-bearing runtime witness lives on
 * `execute`, whose side effect is observable).
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderHook, act } from '@testing-library/react';

const CHOKEPOINT_FILE = 'src/hooks/useFrameworkPipeline.ts';

// Resolve REPO_ROOT from this test file's own location, not process.cwd()
// (jest ESM workers can run with a cwd that is not the repo root — see the
// TC-302 / TC-313 notes on the same cwd race under --maxWorkers>1).
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// --- Pre-import mocks (mirror tests/unit/hooks/use-framework-pipeline.test.ts)

const mockSetPhase = jest.fn();
const mockExecute = jest.fn<() => Promise<unknown>>();
const mockGenerateReport = jest.fn<() => unknown>().mockReturnValue('# Report');
const mockGetIterationSummary = jest.fn<() => unknown>().mockReturnValue({ iterations: 0 });
const mockGetImprovementHistory = jest.fn<() => unknown>().mockReturnValue([]);

jest.unstable_mockModule('@/pipeline/framework-integrated-pipeline', () => ({
  FrameworkIntegratedPipeline: jest.fn<(...args: unknown[]) => unknown>().mockImplementation(() => ({
    setPhase: mockSetPhase,
    execute: mockExecute,
    generateReport: mockGenerateReport,
    getIterationSummary: mockGetIterationSummary,
    getImprovementHistory: mockGetImprovementHistory,
  })),
}));

jest.unstable_mockModule('@stv/core/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.unstable_mockModule('@/framework/iteration-manager', () => ({
  DEVELOPMENT_CYCLES: {
    'MVP構築': { phase: 'MVP構築', maxIterations: 3, successCriteria: [], failureRecovery: '' },
    '基本機能': { phase: '基本機能', maxIterations: 5, successCriteria: [], failureRecovery: '' },
    '高品質化': { phase: '高品質化', maxIterations: 5, successCriteria: [], failureRecovery: '' },
    'リリース準備': { phase: 'リリース準備', maxIterations: 3, successCriteria: [], failureRecovery: '' },
  },
}));

// Controllable fetch spy — defaults to an ok response. Per-test, either let it
// resolve (positive control) or assert it was never called (hazard witness).
const fetchMock = jest.fn<any>().mockResolvedValue({
  ok: true,
  status: 200,
  statusText: 'OK',
} as Response);
global.fetch = fetchMock as unknown as typeof fetch;

const { useFrameworkPipeline } = await import('@/hooks/useFrameworkPipeline');

// --- Fixtures ----------------------------------------------------------------

const defaultPipelineInput = {
  audioFile: 'test.wav' as unknown as File,
};

// An execution that triggers the auto-commit branch: shouldCommit + commitMessage.
const commitExecution = {
  result: {
    success: true,
    scenes: [],
    audioUrl: '/audio/test.wav',
    duration: 10,
    processingTime: 5000,
  },
  iterationMetrics: { score: 90 },
  qualityAnalysis: {
    overallScore: 92,
    needsImprovement: false,
    recommendations: [],
    issues: [],
  },
  shouldCommit: true,
  commitMessage: 'feat: auto-improvement cycle 1',
};

// --- Setup / Teardown --------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' } as Response);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// --- (TC-318-01) source anchor ----------------------------------------------

describe('useFrameworkPipeline unmount guard — source anchor pinned (TC-318-01)', () => {
  const src = (): string => readFileSync(path.join(REPO_ROOT, CHOKEPOINT_FILE), 'utf8');

  it('declares mountedRef as useRef(true) and flips it in an unmount-cleanup useEffect', () => {
    const body = src();
    expect(body).toMatch(/const mountedRef = useRef\(true\)/);
    expect(body).toMatch(/useEffect\(\(\) => \{[\s\S]*?return \(\) => \{[\s\S]*?mountedRef\.current = false/);
  });

  it('execute guards the post-await path with an early return BEFORE the commit branch', () => {
    // Extract the execute useCallback body so we can assert ordering: the
    // `if (!mountedRef.current) return;` must appear AFTER the framework
    // execute() await and BEFORE the /api/git/commit fetch. This is the
    // load-bearing line — removing it lets the stray commit through.
    const body = src();
    const m = body.match(/const execute = useCallback\(async \(input: PipelineInput\) => \{[\s\S]*?\}, \[/);
    if (m === null) {
      throw new Error('execute useCallback body not found in source');
    }
    const execBody = m[0];

    const awaitIdx = execBody.indexOf('await pipelineRef.current.execute(input)');
    const guardIdx = execBody.indexOf('if (!mountedRef.current) return;');
    const commitIdx = execBody.indexOf("fetch('/api/git/commit'");

    expect(awaitIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeGreaterThan(awaitIdx); // guard is AFTER the await
    expect(commitIdx).toBeGreaterThan(guardIdx); // commit is AFTER the guard
  });

  it('execute guards the catch-block setStates and the trailing progress setState', () => {
    // The reject-after-unmount path must also be guarded: the catch block and
    // the final `setExecutionState(... progress: 100 ...)` must not fire on an
    // unmounted hook.
    const body = src();
    const m = body.match(/const execute = useCallback\(async \(input: PipelineInput\) => \{[\s\S]*?\}, \[/);
    if (m === null) {
      throw new Error('execute useCallback body not found in source');
    }
    const execBody = m[0];
    expect(execBody).toMatch(/catch \(error: unknown\) \{[\s\S]*?if \(mountedRef\.current\) \{[\s\S]*?setExecutionState/);
    expect(execBody).toMatch(/if \(mountedRef\.current\) \{[\s\S]*?setExecutionState\(prev => \(\{ \.\.\.prev, progress: 100/);
  });

  it('useIterationLog.fetchLog also guards its post-await setStates (sibling hook in the same file)', () => {
    // The TC-316-02 sweep is per-file: once `mountedRef` appears anywhere in
    // the file the sweep stops flagging it, so a guard on `execute` alone would
    // leave `fetchLog`'s unmount hazard silently uncovered (a false pass).
    // This anchor pins that fetchLog is guarded too.
    const body = src();
    const m = body.match(/const fetchLog = useCallback\(async \(\) => \{[\s\S]*?\}, \[\]\);/);
    if (m === null) {
      throw new Error('fetchLog useCallback body not found in source');
    }
    const fetchBody = m[0];
    expect(fetchBody).toMatch(/await fetch\('\/api\/iteration-log'\);[\s\S]*?if \(!mountedRef\.current\) return;/);
    // The finally-block setLoading must be guarded (finally runs on early return).
    expect(fetchBody).toMatch(/finally \{[\s\S]*?if \(mountedRef\.current\) \{[\s\S]*?setLoading\(false\)/);
  });
});

// --- (TC-318-02) runtime positive control -----------------------------------

describe('useFrameworkPipeline unmount guard — positive control (TC-318-02)', () => {
  it('mounted hook: shouldCommit + enableAutoCommit execute resolves → /api/git/commit IS called', async () => {
    // If this ever stops calling /api/git/commit, the hazard witness (TC-318-03)
    // would pass vacuously. This control proves the mock reaches the post-await
    // commit branch while the hook is still mounted.
    mockExecute.mockResolvedValue(commitExecution);

    const { result } = renderHook(() => useFrameworkPipeline({ enableAutoCommit: true }));

    await act(async () => {
      await result.current.execute(defaultPipelineInput);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/git/commit',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

// --- (TC-318-03) runtime hazard witness (load-bearing RED→GREEN) ------------

describe('useFrameworkPipeline unmount guard — absorbs unmount-during-await (TC-318-03)', () => {
  it('unmount before execute resolves → no stray /api/git/commit POST for the abandoned run', async () => {
    // The vector: dashboard starts a framework execute (shouldCommit +
    // enableAutoCommit), the run is in flight, the user switches tabs (unmount),
    // THEN the run resolves. Pre-fix, the post-await branch kept running and
    // fired a stray `git commit` for the abandoned session (plus setState on an
    // unmounted hook). Post-fix, the `if (!mountedRef.current) return;` absorbs
    // it — the commit POST is never made.
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Controllable deferred so the test controls WHEN execute resolves. The
    // executor runs synchronously at `new Promise(...)`, so the holder is
    // assigned before either guard below fires — kept `| undefined` and
    // checked fail-loudly instead of asserted away with `!`.
    let resolveExecution: ((value: unknown) => void) | undefined;
    mockExecute.mockReturnValue(
      new Promise((r) => {
        resolveExecution = r;
      }),
    );

    const { result, unmount } = renderHook(() =>
      useFrameworkPipeline({ enableAutoCommit: true }),
    );

    // Fire execute WITHOUT awaiting; it suspends at the framework execute().
    let execPromise: Promise<void> | undefined;
    act(() => {
      execPromise = result.current.execute(defaultPipelineInput);
    });

    // Unmount BEFORE the framework run resolves (the hazard window).
    unmount();

    // Now resolve the in-flight run (the hook is gone).
    await act(async () => {
      if (resolveExecution === undefined) {
        throw new Error('execute mock executor did not capture the resolver synchronously');
      }
      resolveExecution(commitExecution);
      await Promise.resolve();
      await Promise.resolve();
    });
    // Swallow the (guarded) resolution so an unhandled-rejection never surfaces.
    if (execPromise === undefined) {
      throw new Error('execute() promise was not captured inside act()');
    }
    await execPromise.catch(() => {});

    // WITH the guard: the post-await early return fired, so the commit branch
    // (and its /api/git/commit POST) never ran.
    // WITHOUT the guard: fetch('/api/git/commit', { method: 'POST' }) WOULD fire.
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/git/commit',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).not.toHaveBeenCalled();

    // Belt-and-braces: React 18 dropped this warning, so this is defensive —
    // but if the guard were ever swapped for a no-op, any environment that still
    // warns would surface it here.
    const unmountedWarnings = consoleErrorSpy.mock.calls
      .map((c) => String(c[0] ?? ''))
      .filter((m) => /unmounted component|Can.*perform.*state.*update/i.test(m));
    expect(unmountedWarnings).toEqual([]);

    consoleErrorSpy.mockRestore();
  });
});
