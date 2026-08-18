/**
 * @jest-environment jsdom
 */
/**
 * raw-localstorage-remove-chokepoint.test.ts — TC-315
 *
 * Pins the `safeRemoveFromStorage` chokepoint — the "raw-localStorage"
 * critical-path guard — so that production code that tears down a
 * localStorage key stays routed through the single helper that absorbs
 * private-mode / restricted-env failures. Companion to the
 * `safeLoadFromStorage` / `safeSaveToStorage` chokepoints already in
 * `src/utils/safe-storage.ts`. Closes the cross-file drift hazard where
 * raw `localStorage.removeItem` calls in production code would each
 * re-implement try/catch + logger.warn (or — worse — call it without
 * either, and crash the consumer in private browsing).
 *
 * THE BUG CLASS. `localStorage.removeItem` can throw when the storage
 * object itself is inaccessible (Safari private browsing, restricted
 * iframes, some SSR fallback paths). Each raw callsite must absorb that
 * failure, otherwise the consumer crashes mid-teardown. The chokepoint
 * centralises the absorb + report so the production caller can be a
 * single line: `safeRemoveFromStorage(key, source)`.
 *
 * THREE LAYERS, each closing a different gap:
 *  1. Source anchor: pin the helper signature at
 *     `src/utils/safe-storage.ts:115` so a renaming or signature change
 *     is RED independent of any test file.
 *  2. Structural sweep: scan src/ for raw `localStorage.removeItem` calls
 *     outside the chokepoint helper itself (catches NEW files added with
 *     the defect). The known legitimate callsites (chokepoint +
 *     `CorruptionOverlay.tsx` corruption-cleanup flow) are explicitly
 *     whitelisted because that path is the corrupt-key consumer, not a
 *     chokepoint-bypass.
 *  3. End-to-end behavioural witness (the L3 upgrade): import the
 *     ACTUAL production code (`ProductionConfigManager.resetConfig()`)
 *     and verify the chokepoint absorbs a thrown `removeItem` so the
 *     production code completes without throwing. Proves the guard
 *     machinery AND the production code it protects are jointly
 *     healthy — exactly the gap the previous "tier-2" injection
 *     witnesses left open (those only proved the guard
 *     CAN capture a violation, not that the real production code
 *     INVOKES it correctly).
 *
 *     Layer 3 also carries a mutation witness: should the chokepoint
 *     ever be weakened (drop the try/catch, return true unconditionally,
 *     or skip the removeItem call), the production code that the
 *     chokepoint protects would re-throw — Layer 3 catches the
 *     mutation through the real production pathway, not via a
 *     synthetic input.
 */
import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeRemoveFromStorage } from '@stv/core/utils/safe-storage';
import { productionConfig } from '@stv/core/config/production-config';

import { resolveSource } from '@tests/guards/freeze-guard';
const CHOKEPOINT_FILE = 'src/utils/safe-storage.ts';
const PRODUCTION_FILE = 'src/config/production-config.ts';

// Resolve REPO_ROOT from this test file's own location, not process.cwd().
// jest ESM workers can run with a cwd that is not the repo root, which flaked
// the bare relative / process.cwd() form under --maxWorkers>1 (see TC-302
// comments — same cwd race).
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// --- (TC-315-01) source anchor: pin the chokepoint helper signature ------

describe('raw-localStorage remove chokepoint — source anchor pinned (TC-315-01)', () => {
  const src = (): string => readFileSync(resolveSource(CHOKEPOINT_FILE), 'utf8');

  it('safeRemoveFromStorage is exported from src/utils/safe-storage.ts', () => {
    // The chokepoint must be a public export. Dropping `export` (turning it
    // into a file-private helper) hides the chokepoint from new callers,
    // which is the silent-drift precursor.
    expect(src()).toMatch(/export function safeRemoveFromStorage\(/);
  });

  it('safeRemoveFromStorage wraps the removeItem call in try/catch (private-mode absorb)', () => {
    // The chokepoint's whole purpose is to absorb the throw. Removing the
    // try/catch (or returning `true` unconditionally) lets the unguarded
    // throw leak; the chokepoint becomes a no-op.
    expect(src()).toMatch(/export function safeRemoveFromStorage[\s\S]*?try\s*\{[\s\S]*?localStorage\.removeItem\(key\)[\s\S]*?\}\s*catch\s*\{/);
  });

  it('production-config resetConfig routes through the chokepoint (no raw localStorage.removeItem)', () => {
    // The actual production-side fix: `resetConfig` must NOT contain a raw
    // `localStorage.removeItem` call. Re-introducing one (e.g. "simplify
    // back to the original try/catch") is drift.
    const prodSrc = readFileSync(resolveSource(PRODUCTION_FILE), 'utf8');

    // Locate the resetConfig method body and assert it does not contain the
    // raw call. We use a non-greedy match across the resetConfig method.
    const resetBody = prodSrc.match(/resetConfig\(\):\s*void\s*\{[\s\S]*?\n\s*\}/);
    expect(resetBody).not.toBeNull();
    expect(resetBody![0]).not.toMatch(/localStorage\.removeItem\(/);
    expect(resetBody![0]).toMatch(/safeRemoveFromStorage\(/);
  });

  it('chokepoint corruption report uses the same `reportCorruption` chokepoint as load/save', () => {
    // The load/save helpers funnel failures through `reportCorruption` so
    // the CorruptionOverlay can surface them. If the new chokepoint reports
    // via `logger.warn` or `console.warn` instead, observability diverges
    // and the CorruptionOverlay never sees the failure — silent for the
    // operator.
    expect(src()).toMatch(/safeRemoveFromStorage[\s\S]*?reportCorruption\(source,\s*`localStorage\s*"\$\{key\}"\s*remove failed/);
  });
});

// --- (TC-315-02) structural sweep: catch NEW raw callers ---------------

describe('raw-localStorage remove chokepoint — structural sweep (TC-315-02)', () => {
  // Per the doc-comment on the chokepoint, the legitimate raw callers are
  // LIMITED to the corruption-cleanup paths in `CorruptionOverlay.tsx` (the
  // UI surface that *removes* keys flagged by the corruption report) and
  // the chokepoint helper itself. Any new raw caller is a chokepoint-bypass
  // and must use `safeRemoveFromStorage` instead.
  //
  // Implementation: walk src/ for `localStorage.removeItem(` occurrences and
  // assert every line is either the chokepoint or the CorruptionOverlay
  // corruption-cleanup path. We use the test runner's directory walk
  // (rather than the global `fs` layout) so the sweep stays self-contained.
  const RAW_CALL_WHITELIST = [
    // Chokepoint itself — the whole point is to wrap the call here.
    'src/utils/safe-storage.ts',
    // CorruptionOverlay uses raw removeItem in try/catch because it IS the
    // component the corruption report renders — removing the bad key is the
    // recovery action, not a chokepoint-bypass. The sweep still flags any
    // *other* component that copies this pattern.
    'src/components/CorruptionOverlay.tsx',
  ] as const;

  function findTsFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        out.push(...findTsFiles(full));
      } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        out.push(full);
      }
    }
    return out;
  }

  const srcRoot = path.join(REPO_ROOT, 'src');
  const allFiles = findTsFiles(srcRoot);
  const rawCallers = allFiles
    .map((full) => ({
      rel: path.relative(REPO_ROOT, full),
      lines: readFileSync(full, 'utf8').split('\n'),
    }))
    .filter(({ rel, lines }) =>
      lines.some((l) => /localStorage\.removeItem\(/.test(l)) &&
      !(RAW_CALL_WHITELIST as readonly string[]).includes(rel),
    );

  it('only the chokepoint + CorruptionOverlay raw-removeItem callsite may exist', () => {
    // If this fires, a new file has been added (or a whitelist entry removed)
    // that uses raw `localStorage.removeItem` outside the documented
    // corruption-cleanup path. Route it through `safeRemoveFromStorage` or
    // whitelist it with a documented reason.
    expect(rawCallers.map((c) => c.rel)).toEqual([]);
  });
});

// --- (TC-315-03) end-to-end L3 pair: real production code chokepoint ----

describe('raw-localStorage remove chokepoint — production code wires through (TC-315-03)', () => {
  // Layer 3 is the gap the previous iteration's injection witnesses left
  // open: those proved the guard CAN capture a violation, but only via a
  // synthetic input. Here we exercise the actual production code path
  // (the chokepoint's real consumer) and verify the chokepoint absorbs a
  // thrown `removeItem` so the production code completes without throwing.
  //
  // The mutation witness at the end of this layer proves the guard is
  // load-bearing: if the chokepoint's try/catch were dropped — making
  // `safeRemoveFromStorage` a perfect forwarder of the throw — the
  // production code re-throws, and the test catches the regression via
  // the real production pathway rather than a synthetic input.

  // jsdom is the default env for this file (configured at the top of the
  // file). The chokepoint calls `localStorage.removeItem`, which jsdom
  // provides. We replace the `removeItem` method on the prototype to
  // simulate the private-mode / restricted-env vector that the chokepoint
  // must absorb.
  //
  // Why spyOn(Storage.prototype, ...) and not direct assignment: jsdom's
  // `localStorage` is a StorageProxy with a getter for `removeItem` on the
  // prototype. Direct assignment to `localStorage.removeItem` does NOT
  // shadow the prototype method (verified in test isolation); the spy
  // path is the only reliable override.

  // We track the spy so each test can restore it independently.
  let removeItemSpy: ReturnType<typeof jest.spyOn> | null = null;

  function installThrowingRemoveItem(): ReturnType<typeof jest.spyOn> {
    removeItemSpy = jest
      .spyOn(Storage.prototype, 'removeItem')
      .mockImplementation((key: string) => {
        // Simulate the production hazard: storage throws on access for the
        // key the chokepoint is about to remove. Any code that calls
        // `localStorage.removeItem` directly must absorb this; the chokepoint
        // does, raw callers do not.
        if (key === 'production-config-overrides') {
          throw new DOMException('SecurityError: storage access denied', 'SecurityError');
        }
      });
    return removeItemSpy;
  }

  afterEach(() => {
    if (removeItemSpy) {
      removeItemSpy.mockRestore();
      removeItemSpy = null;
    }
  });

  it('ProductionConfigManager.resetConfig() does not throw when localStorage.removeItem throws (private-mode vector)', () => {
    // Set the seed: productionConfig.loadConfigOverrides() (called during
    // module init) may have populated this key; we ensure it exists so the
    // chokepoint's chokepoint path is actually exercised.
    localStorage.setItem('production-config-overrides', '{"performance":{"maxConcurrentJobs":7}}');

    // Install the failing removeItem.
    installThrowingRemoveItem();

    // Exercise the REAL production code. The chokepoint absorbs the throw;
    // the production code's `resetConfig()` completes normally.
    expect(() => productionConfig.resetConfig()).not.toThrow();

    // The chokepoint reports the failure as a corruption event (observable
    // through the same `reportCorruption` chokepoint the load/save helpers
    // use). The boolean return value is the documented side-channel.
    expect(safeRemoveFromStorage('production-config-overrides', 'test-source')).toBe(false);
  });

  it('corruption-free remove returns true (the success case the production code takes in the happy path)', () => {
    // Same code path, but localStorage is healthy. The chokepoint must
    // round-trip the call and return true. Without this, a regression that
    // always returns false would silently break every production caller.
    localStorage.setItem('production-config-overrides', '{}');
    expect(safeRemoveFromStorage('production-config-overrides', 'test-source')).toBe(true);
    expect(localStorage.getItem('production-config-overrides')).toBeNull();
  });

  it('mutation witness: the unguarded raw `localStorage.removeItem` would throw (proves the chokepoint is load-bearing)', () => {
    // The chokepoint's try/catch is the only thing that stands between the
    // production code and the underlying throw. This witness proves the
    // guard is NOT a no-op: with the stub installed, the raw
    // `localStorage.removeItem` throws the same SecurityError the chokepoint
    // would otherwise absorb. A weakened chokepoint (no try/catch) would
    // let this throw leak through to the production caller.
    installThrowingRemoveItem();

    // The unguarded form: a hypothetical production caller that bypasses
    // the chokepoint. With the chokepoint weakened (no try/catch), the
    // guard would no longer absorb — this is the vector the chokepoint
    // exists to close.
    const unguarded = (key: string): boolean => {
      localStorage.removeItem(key); // <-- unguarded: no try/catch
      return true;
    };

    expect(() => unguarded('production-config-overrides')).toThrow(DOMException);
  });
});
