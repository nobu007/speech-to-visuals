/**
 * Shared logger-mock factory.
 *
 * `@/utils/logger` is the single most-mocked module in the test suite (~50
 * files). Its mock factory — `{ logger: { info, warn, error, debug } }` of bare
 * `jest.fn()`s — had drifted across copies: some omit `debug`, some use
 * `() => {}` instead of `jest.fn()`, some order the keys differently. This
 * factory is the single source of truth, halting that drift.
 *
 * Each call returns a FRESH object with fresh `jest.fn()`s, so it is safe to
 * call per-test (e.g. in `beforeEach`) when call-assertion isolation matters.
 *
 * Usable with BOTH jest mock APIs — but mind the hoisting difference:
 *
 *   - `jest.unstable_mockModule('@stv/core/utils/logger', () => mockLogger());`
 *     PREFERRED for ESM. `unstable_mockModule` is NOT hoisted, so the imported
 *     `mockLogger` binding is in scope when the factory runs. (This is the only
 *     form used by the migration so far.)
 *
 *   - `jest.mock('@stv/core/utils/logger', () => mockLogger());`
 *     CAUTION: `jest.mock` factories ARE hoisted above imports, so an imported
 *     `mockLogger` is NOT in scope at factory-eval time and this throws. For
 *     `jest.mock` files, either keep the inline literal or define a same-file
 *     `function mockLogger()` (the `mock`-prefixed name is what jest's hoisting
 *     rule permits). Migrating those files is therefore deferred.
 */
import { jest } from '@jest/globals';

// Mirrors @stv/core/utils/logger's enum. Needed because consumers of the
// mocked module re-import LogLevel alongside logger (e.g.
// @stv/core/config/production-config.js does `import { logger, LogLevel }`)
// and ESM named-import resolution fails hard on a missing export — the
// mock must be export-complete, not just call-complete.
export const MOCK_LOG_LEVEL = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4,
} as const;

export function mockLogger() {
  return {
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
    LogLevel: MOCK_LOG_LEVEL,
  };
}
