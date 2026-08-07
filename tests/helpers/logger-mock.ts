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
 *   - `jest.unstable_mockModule('@/utils/logger', () => mockLogger());`
 *     PREFERRED for ESM. `unstable_mockModule` is NOT hoisted, so the imported
 *     `mockLogger` binding is in scope when the factory runs. (This is the only
 *     form used by the migration so far.)
 *
 *   - `jest.mock('@/utils/logger', () => mockLogger());`
 *     CAUTION: `jest.mock` factories ARE hoisted above imports, so an imported
 *     `mockLogger` is NOT in scope at factory-eval time and this throws. For
 *     `jest.mock` files, either keep the inline literal or define a same-file
 *     `function mockLogger()` (the `mock`-prefixed name is what jest's hoisting
 *     rule permits). Migrating those files is therefore deferred.
 */
import { jest } from '@jest/globals';

export function mockLogger() {
  return {
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  };
}
