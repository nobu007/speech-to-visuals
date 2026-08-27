/**
 * @jest-environment jsdom
 *
 * Multi-hop regression test for the CorruptionOverlay fan-in contract.
 *
 *   intelligent-cache findSimilar()
 *     → decompressData() throws
 *       → reportCorruption('IntelligentCache', detail) (real @stv/core)
 *         → setCorruptionHandler() dispatch
 *           → <CorruptionOverlay /> renders the report
 *
 * The existing corruption-overlay-app-integration.test.tsx pins the same
 * 4-hop chain but originates the corruption event from TutorialSystem's
 * safeLoadFromStorage. This test pins the SAME chain from a different
 * source (intelligent-cache findSimilar decompression failure) so a
 * regression that breaks one specific source's reach to the overlay is
 * observable.
 *
 * Why this matters: reportCorruption() is shared by every reader (safe-
 * storage in @stv/core, production-config, llm-cache, intelligent-cache).
 * If intelligent-cache's corruption stops reaching the overlay but
 * TutorialSystem's still works, the overlay looks healthy while one of
 * the corruption sources goes silent — and the user's "Recovered" badge
 * promise is broken. The unit tests for intelligent-cache pin the call
 * to reportCorruption at the boundary, but only a real overlay can
 * answer "does the report survive the handler hop".
 *
 * Setup intentionally bypasses the full <App /> tree: the App mount runs
 * TutorialSystem in its effect, which would itself trigger a tutorial-
 * progress corruption event on first render if localStorage were dirty.
 * To keep the witness specific to the IntelligentCache source, the test
 * mounts the overlay in isolation against an explicit handler.
 */

import { jest } from '@jest/globals';
import React from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Silence the logger side-channel; the corruption chain under test is real.
jest.unstable_mockModule('@stv/core/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  LogLevel: { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, SILENT: 4 },
}));

let CorruptionOverlay: React.ComponentType;
type ReportCorruptionModule = typeof import('@stv/core/utils/report-corruption');
let reportCorruptionMod: ReportCorruptionModule;
let cacheMod: typeof import('@/performance/intelligent-cache');

beforeAll(async () => {
  CorruptionOverlay = (await import('@/components/CorruptionOverlay')).CorruptionOverlay;
  cacheMod = await import('@/performance/intelligent-cache');
  reportCorruptionMod = await import('@stv/core/utils/report-corruption');
});

// jsdom env stubs for Radix UI (same class as corruption-overlay-app-integration).
Object.defineProperty(globalThis, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }),
});
class StubResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: StubResizeObserver,
});

/**
 * Force an entry to bypass the cache's own RLE encoder and store a payload
 * that will fail JSON.parse in decompressData. The hop chain under test
 * starts at the failure point inside decompressData — earlier hops
 * (store → cache → findSimilar) are exercised by the real call path.
 */
function corruptCacheEntryDirectly(
  cache: InstanceType<typeof IntelligentCache>,
  content: string,
): void {
  const internal = cache as unknown as {
    cache: Map<string, { data: unknown; compressed: boolean; originalSize: number; sourceContent: string }>;
  };
  const key = cache['generateCacheKey' as keyof typeof cache] as (c: string) => string;
  const cacheKey = key(content);
  const entry = internal.cache.get(cacheKey);
  if (!entry) {
    throw new Error('corruptCacheEntryDirectly: entry must exist before corruption');
  }
  // The decompress path goes:
  //   compressed.length === originalSize → JSON.parse(compressed) → throws
  //   else                            → RLE decode → JSON.parse → throws
  // Either branch fails on an unparseable string. We pick the length-mismatch
  // branch so the encoder's own escape-marker pin (C2 fix) is not byassed
  // by the corruption seeding.
  entry.compressed = true;
  entry.data = 'x';
  entry.originalSize = 999; // mismatch → enters RLE decode path
  entry.sourceContent = content;
}

describe('CorruptionOverlay multi-hop: intelligent-cache → overlay', () => {
  beforeEach(() => {
    cacheMod.globalCache.clear();
    reportCorruptionMod.setCorruptionHandler(null);
  });

  afterEach(() => {
    cleanup();
    reportCorruptionMod.setCorruptionHandler(null);
    cacheMod.globalCache.clear();
  });

  it('a corrupted intelligent-cache entry surfaces in the mounted overlay via the real 4-hop chain', async () => {
    // Mount the overlay first so setCorruptionHandler is installed before
    // the corruption event fires. The same mount-order contract as the
    // App-tree integration test applies — handler must be installed
    // BEFORE the source emits.
    render(<CorruptionOverlay />);
    await act(async () => { /* flush mount effect */ });

    // Real hop 1+2: store a compressible entry, corrupt its bytes, then
    // call get() so decompressData → JSON.parse throws → reportCorruption
    // is invoked with source='IntelligentCache'.
    const content = 'multihop-test-' + 'x'.repeat(1100); // large enough to trigger compression
    await cacheMod.globalCache.store(content, { v: 1 }, {
      contentType: 'flow',
      duration: 0,
      complexity: 0,
      performanceScore: 0,
      accessPattern: 'mixed',
    });
    corruptCacheEntryDirectly(cacheMod.globalCache, content);
    await act(async () => {
      const result = await cacheMod.globalCache.get(content);
      expect(result).toBeNull(); // corruption-recovery: miss + purge
    });

    // Real hop 3+4: the handler dispatches, and the overlay should display
    // the report. The overlay's "Clear Key" button only appears when the
    // detail string matches the extractStorageKey regex — the intelligent-
    // cache detail does NOT match (no "localStorage" prefix), so we
    // assert on the source attribution and the Recovered badge instead.
    await act(async () => { /* flush async dispatch */ });

    expect(screen.getByTestId('corruption-overlay')).toBeInTheDocument();
    // Leg 1 — source attribution survived the chain end-to-end. A future
    // refactor that rewords `reportCorruption('IntelligentCache', ...)`
    // or the overlay's source render would silently drop the badge.
    expect(screen.getByText('IntelligentCache')).toBeInTheDocument();
    // Leg 2 — the overlay's "Recovered" tag depends on the
    // `recovered: true` flag on the report, which intelligent-cache sets
    // because the get() path already purges the corrupt entry before
    // reporting. A future "report only, no purge" regression would flip
    // this to "Needs Attention" while still passing the mount leg.
    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });

  });