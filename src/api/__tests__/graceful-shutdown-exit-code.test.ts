/**
 * Tests for graceful shutdown exit-code parity
 * (src/api/index.ts)
 *
 * Verifies that the exit code passed to `process.exit` matches the signal
 * category:
 *   - SIGTERM / SIGINT              → exit(0)  (orchestrator-requested drain)
 *   - uncaughtException / unhandled → exit(1)  (abnormal termination)
 *
 * Pre-fix behaviour: every code path called `process.exit(0)`, so an
 * `uncaughtException` (which surfaces as a crash, not a clean drain) was
 * reported to the orchestrator and CI as a successful exit. This test pins
 * the parity that the abnormal paths must surface a non-zero code.
 *
 * Import discipline (eval follow-up on run 20260827-193717): `../index` is
 * loaded via a DYNAMIC import only. A static import is linked before the
 * `unstable_mockModule` registrations run, so it resolves the REAL
 * dependency graph — including `app.listen(3001)` at module scope, which
 * boots a live socket inside the jest worker.
 *
 * The wiring-level counterpart (gracefulShutdown → exitCodeForSignal →
 * process.exit, driven on a FRESH module instance) lives in
 * graceful-shutdown-exit-wiring.test.ts: jest gives each test FILE its own
 * module registry, so hosting the wiring legs in a dedicated file resets
 * the module-private `isShuttingDown` guard by construction — no leg-ordering
 * dependency on this file's shared instance (each wiring leg additionally
 * calls jest.resetModules(); `jest.isolateModulesAsync` is NOT usable there:
 * an isolated import of a mock-wired `../index` is evaluated in a separate
 * VM context whose `process.exit` is unobservable from the test realm —
 * verified empirically on jest 30.4.2; see the wiring file's header).
 *
 * The ../index mock graph lives in ./api-index-mocks.ts (shared with the
 * other graceful-shutdown suites).
 */

import { jest, beforeAll } from '@jest/globals';
import { registerApiIndexMocks } from './api-index-mocks';

// Mock registrations must precede the dynamic import below (see the header
// and the helper's usage contract).
registerApiIndexMocks();

// Loaded after the mock registrations above (the dynamic import is what
// makes unstable_mockModule apply — see the header's import discipline note).
let exitCodeForSignal: typeof import('../index')['exitCodeForSignal'];

beforeAll(async () => {
  ({ exitCodeForSignal } = await import('../index'));
});

describe('graceful shutdown exit code parity', () => {
  it('SIGTERM resolves to exit code 0 (orchestrator-requested clean drain)', () => {
    expect(exitCodeForSignal('SIGTERM')).toBe(0);
  });

  it('SIGINT resolves to exit code 0 (orchestrator-requested clean drain)', () => {
    expect(exitCodeForSignal('SIGINT')).toBe(0);
  });

  it('uncaughtException resolves to exit code 1 (abnormal termination)', () => {
    // Pre-fix: this was 0 (silent crash) → RED on the fix.
    expect(exitCodeForSignal('uncaughtException')).toBe(1);
  });

  it('unhandledRejection resolves to exit code 1 (abnormal termination)', () => {
    // Pre-fix: this was 0 (silent crash) → RED on the fix.
    expect(exitCodeForSignal('unhandledRejection')).toBe(1);
  });

  it('parity contract: clean drain ≠ abnormal termination', () => {
    // Cross-path parity anchor: the two abnormal signals must be 1, the two
    // clean signals must be 0, and 1 ≠ 0. If any path drifts back to a single
    // hard-coded exit code, this assertion fails.
    const codes = {
      SIGTERM: exitCodeForSignal('SIGTERM'),
      SIGINT: exitCodeForSignal('SIGINT'),
      uncaughtException: exitCodeForSignal('uncaughtException'),
      unhandledRejection: exitCodeForSignal('unhandledRejection'),
    };
    expect(codes.SIGTERM).toBe(0);
    expect(codes.SIGINT).toBe(0);
    expect(codes.uncaughtException).toBe(1);
    expect(codes.unhandledRejection).toBe(1);
    expect(new Set(Object.values(codes)).size).toBe(2);
  });
});
