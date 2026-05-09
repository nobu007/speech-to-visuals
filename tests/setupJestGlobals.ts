/**
 * Makes the `jest` object available as a global in ESM mode.
 *
 * When Jest runs with `--experimental-vm-modules` and `extensionsToTreatAsEsm`,
 * the `jest` global is NOT injected.  Tests that call `jest.resetModules()`,
 * `jest.restoreAllMocks()`, etc. get `ReferenceError: jest is not defined`.
 *
 * The fix recommended by Jest docs is to `import { jest } from '@jest/globals'`
 * in every file — but that imports the *module-scoped* binding which has
 * different (stricter) TypeScript types than the ambient global declared by
 * `@types/jest`, causing type regressions.
 *
 * This setup file bridges the gap: it imports the runtime object once and
 * assigns it to `globalThis` so every test file sees it as a global, matching
 * the ambient type declarations from `@types/jest`.
 */
import { jest } from '@jest/globals';

globalThis.jest = jest;
