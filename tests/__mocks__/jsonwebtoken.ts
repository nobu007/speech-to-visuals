/**
 * Manual mock for jsonwebtoken ESM compatibility.
 *
 * The mock functions are re-created on each dynamic import so that
 * `jest.clearAllMocks()` in a `beforeEach` only resets call counts — the
 * module-level references (`__mocks__/jsonwebtoken.ts`) stay stable across
 * re-imports, unlike `jest.unstable_mockModule` factories whose bindings can
 * become stale for CJS packages used with `import * as`.
 */

import { jest } from '@jest/globals';

const verify = jest.fn();
const sign = jest.fn();
const decode = jest.fn();

export { verify, sign, decode };

export default { verify, sign, decode };
