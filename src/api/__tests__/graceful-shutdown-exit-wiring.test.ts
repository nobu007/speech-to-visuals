/**
 * Graceful-shutdown exit-code WIRING test (src/api/index.ts) — the
 * integration counterpart of graceful-shutdown-exit-code.test.ts.
 *
 * The exit-code suite pins the pure signal→code map (exitCodeForSignal);
 * this suite pins the wiring: a signal driven through gracefulShutdown must
 * reach process.exit with the parity code, exactly once. The clean drain
 * half (SIGTERM → exit(0)) is already pinned at the wiring level in
 * graceful-shutdown.test.ts, so this file drives BOTH abnormal halves
 * (uncaughtException → 1, unhandledRejection → 1) and completes every
 * signal category at the wiring level (INV-API-001) — no abnormal category
 * is left depending on the pure-function legs alone.
 *
 * Freshness of the module-private `isShuttingDown` guard (each leg consumes
 * it once) is structural at two levels:
 *
 * - FILE level: jest hands every test file its own module registry, so no
 *   leg in another file can have consumed the guard before this file runs.
 * - LEG level: each leg calls jest.resetModules() before its dynamic
 *   import, clearing THIS file's registry so ../index re-evaluates fresh —
 *   the guard starts false regardless of leg order within this file.
 *
 * Why resetModules and not jest.isolateModulesAsync (the other in-file
 * fresh-import API): resetModules clears the registry but keeps the
 * unstable_mockModule FACTORY registrations and re-evaluates the module in
 * the SAME VM context, so the mock-wired ../index still observes the test
 * realm's process.exit. isolateModulesAsync evaluates a mock-wired ../index
 * in a separate VM context whose process is not the test realm's — a
 * process.exit spy installed from the test is never reached (verified
 * empirically on jest 30.4.2: a plain module imported in the same isolated
 * registry DOES hit the spy; the mock-wired ../index does not).
 *
 * The ../index mock graph lives in ./api-index-mocks.ts (shared with the
 * other graceful-shutdown suites).
 */

import { jest } from '@jest/globals';
import { registerApiIndexMocks } from './api-index-mocks';

// Must run before the legs' dynamic imports (unstable_mockModule applies by
// execution order — see the helper's usage contract).
registerApiIndexMocks();

describe('gracefulShutdown wiring — the exit code reaches process.exit', () => {
  const driveAbnormalSignal = async (
    signal: 'uncaughtException' | 'unhandledRejection',
  ): Promise<number | undefined> => {
    // The pre-fix shape (process.exit(0) on every path) REDs here exactly
    // like the pure uncaught/unhandled legs: the spy records the code the
    // orchestrator would actually see.
    //
    // process.exit is replaced by plain property assignment (the same idiom
    // as graceful-shutdown.test.ts), NOT jest.spyOn: spyOn's
    // defineProperty-based swap is NOT VISIBLE to the module under test —
    // it evaluates in a separate VM context and reads process.exit at call
    // time from that context, where the spy's descriptor never landed
    // (empirically verified on jest 30.4.2: this exact leg is green with
    // the assignment and permanently RED with spyOn — 0 recorded calls).
    // Restore in finally keeps the worker's real process.exit intact even
    // when the leg fails.
    const exitSpy = jest.fn((_code?: number) => undefined as never);
    const originalExit = process.exit;
    process.exit = exitSpy as typeof process.exit;
    try {
      // Fresh module registry for THIS leg: isShuttingDown starts false by
      // construction (see the header's leg-level freshness note), and the
      // mocks above still apply because resetModules keeps the mock
      // factories and only clears the registry.
      jest.resetModules();
      const { gracefulShutdown } = await import('../index');
      await gracefulShutdown(signal);
    } finally {
      process.exit = originalExit;
    }
    expect(exitSpy).toHaveBeenCalledTimes(1);
    return exitSpy.mock.calls[0]?.[0];
  };

  it('uncaughtException path calls process.exit with code 1', async () => {
    const code = await driveAbnormalSignal('uncaughtException');
    expect(code).toBe(1);
  });

  it('unhandledRejection path calls process.exit with code 1', async () => {
    const code = await driveAbnormalSignal('unhandledRejection');
    expect(code).toBe(1);
  });
});
