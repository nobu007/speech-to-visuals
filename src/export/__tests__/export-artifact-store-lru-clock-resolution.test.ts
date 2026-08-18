/**
 * Regression: LRU eviction must be correct under clock-resolution collision.
 *
 * Root cause of the secure-download-pipeline LRU flake: the store ordered LRU
 * solely by `lastAccessedAt` (a `Date.now()` millisecond). When `store()` /
 * `get()` / `resolveDownloadUrl()` calls landed in the SAME millisecond —
 * guaranteed under fake timers without `advanceTimersByTime`, and common under
 * real timers on fast machines — every artifact shared one timestamp, so
 * `evictLRU` degenerated to Map insertion order and evicted the just-accessed
 * artifact instead of the true LRU. The integration suite used real timers and
 * only passed when `Date.now()` happened to advance between synchronous calls.
 *
 * The fix gives each store a monotonic access sequence as the true LRU
 * authority. These tests pin that behavior by FREEZING `Date.now()` to a
 * single millisecond — the exact degenerate condition — and asserting the
 * correct survivor is evicted every time.
 */

import { jest } from '@jest/globals';

jest.mock('@stv/core/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { ExportArtifactStore } from '../export-artifact-store';

function createStore(maxArtifacts: number): ExportArtifactStore {
  return new ExportArtifactStore({
    maxArtifacts,
    maxStorageBytes: 100_000,
    defaultTtlMs: 60_000,
    downloadUrlTtlMs: 30_000,
    cleanupIntervalMs: 60_000,
  });
}

function svg(byte: number) {
  return { format: 'svg', data: new Uint8Array([byte]), sizeBytes: 1 };
}

describe('ExportArtifactStore LRU under frozen clock (clock-resolution regression)', () => {
  // Freeze the wall clock: every Date.now() call returns this one value, so
  // lastAccessedAt CANNOT disambiguate accesses — only the monotonic seq can.
  const FROZEN_MS = 1_700_000_000_000;

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(FROZEN_MS);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('get()-bumped artifact survives eviction when all timestamps are identical', () => {
    const store = createStore(3);

    const a1 = store.store(svg(1));
    const a2 = store.store(svg(2));
    store.store(svg(3)); // a3

    // Bump a1 to most-recently-used. The clock is frozen, so without the
    // monotonic-seq fix a1 keeps lastAccessedAt === a2 === a3 and gets evicted
    // by insertion-order fallback. This is precisely the flaky-failure shape.
    store.get(a1.artifactId);

    store.store(svg(4)); // exceed maxArtifacts=3 → evict true LRU (a2)

    expect(store.get(a1.artifactId)).toBeDefined(); // bumped → present
    expect(store.get(a2.artifactId)).toBeUndefined(); // true LRU → evicted
  });

  it('successive evictions under a frozen clock evict in true-recency order', () => {
    const store = createStore(3);

    const a1 = store.store(svg(1));
    const a2 = store.store(svg(2));
    store.store(svg(3)); // a3

    // Establish recency a2 > a1 > a3 via same-ms accesses.
    store.get(a1.artifactId);
    store.get(a2.artifactId);

    store.store(svg(4)); // exceed → evict true LRU a3
    store.store(svg(5)); // exceed → evict next LRU a1

    expect(store.get(a1.artifactId)).toBeUndefined(); // a1 evicted before a2
    expect(store.get(a2.artifactId)).toBeDefined(); // a2 most-recent → survives
  });

  it('resolveDownloadUrl bumps recency under a frozen clock', () => {
    const store = createStore(2);

    const a1 = store.store(svg(1));
    const a2 = store.store(svg(2));

    const dl = store.generateDownloadUrl(a1.artifactId);
    const token = new URL(dl!.url.replace('artifact://', 'http://x/')).searchParams.get('token');
    // Resolving a download URL should mark a1 most-recently-used.
    expect(store.resolveDownloadUrl(a1.artifactId, token!)).toBeDefined();

    store.store(svg(3)); // exceed maxArtifacts=2 → evict LRU a2
    expect(store.get(a1.artifactId)).toBeDefined();
    expect(store.get(a2.artifactId)).toBeUndefined();
  });

  it('generateDownloadUrl (via get) bumps recency under a frozen clock', () => {
    const store = createStore(2);

    const a1 = store.store(svg(1));
    const a2 = store.store(svg(2));

    store.generateDownloadUrl(a1.artifactId); // touches a1

    store.store(svg(3)); // exceed → evict LRU a2
    expect(store.get(a1.artifactId)).toBeDefined();
    expect(store.get(a2.artifactId)).toBeUndefined();
  });
});
