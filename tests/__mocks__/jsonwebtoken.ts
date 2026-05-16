/**
 * Manual mock for jsonwebtoken ESM compatibility.
 *
 * NOTE: Auth-related tests (auth.test.ts, auth-integration.test.ts,
 * pipeline-auth.test.ts, websocket-handler.test.ts) use REAL jsonwebtoken
 * rather than this mock.  This file exists as a reference and for any
 * future tests that explicitly need to mock JWT behaviour.
 *
 * The mock functions are re-created on each dynamic import so that
 * `jest.clearAllMocks()` in a `beforeEach` only resets call counts — the
 * module-level references stay stable across re-imports, unlike
 * `jest.unstable_mockModule` factories whose bindings can become stale for
 * CJS packages used with `import * as`.
 */

import { jest } from '@jest/globals';

const verify = jest.fn();
const sign = jest.fn();
const decode = jest.fn();

export { verify, sign, decode };

export default { verify, sign, decode };
