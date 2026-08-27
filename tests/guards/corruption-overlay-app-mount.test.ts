/**
 * Structural guard: CorruptionOverlay stays mounted in the app tree, before
 * any mount-time storage reader (wiring census).
 *
 * WHY A SOURCE GUARD WHEN AN INTEGRATION TEST EXISTS.
 * src/__tests__/corruption-overlay-app-integration.test.tsx proves the
 * behavior end-to-end (real storage → real @stv/core → overlay). This guard
 * pins the STRUCTURE that behavior depends on, in the repo's single-source
 * guard idiom, so that:
 *   - a refactor that moves/renames the mount fails with a pointed message
 *     ("expected App.tsx to mount <CorruptionOverlay /> before
 *     <TutorialSystem />"), not a page-level render diff;
 *   - the mount-order contract (see below) is checked lexically even on
 *     branches where the integration test is skipped or jsdom-flaky.
 *
 * MOUNT-ORDER CONTRACT. React flushes sibling mount effects in tree order.
 * TutorialSystem reads localStorage in its mount effect, and corruption
 * events fired while no handler is installed are dropped (report-corruption
 * keeps a single activeHandler, no replay buffer). CorruptionOverlay must
 * therefore appear EARLIER in App.tsx than <TutorialSystem />, or every
 * mount-time corruption event — the common "user arrives with an already
 * corrupt key" case — is silently unobservable in the UI.
 */

import { describe, it, expect } from '@jest/globals';
import { readSource } from './freeze-guard';

const APP = 'src/App.tsx';

describe('CorruptionOverlay app-tree mount (wiring census)', () => {
  it('App.tsx imports CorruptionOverlay', () => {
    expect(readSource(APP)).toMatch(
      /import\s+\{[^}]*CorruptionOverlay[^}]*\}\s+from\s+['"][^'"]*CorruptionOverlay['"]/,
    );
  });

  it('App.tsx mounts <CorruptionOverlay /> in the global layer', () => {
    expect(readSource(APP)).toMatch(/<CorruptionOverlay\s*\/>/);
  });

  it('CorruptionOverlay is mounted before <TutorialSystem /> (mount-order contract)', () => {
    const src = readSource(APP);
    const overlayAt = src.search(/<CorruptionOverlay\s*\/>/);
    const readerAt = src.search(/<TutorialSystem\s*\/>/);
    // search() === -1 on a missing mount is covered by the legs above; here
    // both are expected present, and the overlay must come first.
    expect(overlayAt).toBeGreaterThanOrEqual(0);
    expect(readerAt).toBeGreaterThanOrEqual(0);
    expect(overlayAt).toBeLessThan(readerAt);
  });
});
