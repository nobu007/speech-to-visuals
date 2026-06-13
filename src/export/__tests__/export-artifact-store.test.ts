/**
 * Tests for ExportArtifactStore (REQ-230, Phase 100)
 */

import { ExportArtifactStore } from '../export-artifact-store';
import type { ArtifactMetricsSink } from '../export-artifact-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeData(size: number): Uint8Array {
  return new Uint8Array(size);
}

function createSink(): ArtifactMetricsSink & Record<string, number> {
  return {
    artifactStoredCount: 0,
    artifactStorageBytes: 0,
    artifactExpiredCount: 0,
    artifactDownloadCount: 0,
    recordArtifactStored() { this.artifactStoredCount++; },
    recordArtifactStorageBytes(bytes: number) { this.artifactStorageBytes += bytes; },
    recordArtifactExpired() { this.artifactExpiredCount++; },
    recordArtifactDownload() { this.artifactDownloadCount++; },
  };
}

function createSmallStore(overrides?: {
  maxArtifacts?: number;
  maxStorageBytes?: number;
  defaultTtlMs?: number;
  downloadUrlTtlMs?: number;
  cleanupIntervalMs?: number;
}) {
  return new ExportArtifactStore(
    {
      maxArtifacts: overrides?.maxArtifacts ?? 5,
      maxStorageBytes: overrides?.maxStorageBytes ?? 1024,
      defaultTtlMs: overrides?.defaultTtlMs ?? 60_000,
      downloadUrlTtlMs: overrides?.downloadUrlTtlMs ?? 30_000,
      cleanupIntervalMs: overrides?.cleanupIntervalMs ?? 10_000,
    },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExportArtifactStore', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  // -- store() ------------------------------------------------------------

  describe('store()', () => {
    it('stores an artifact and returns it with generated ID', () => {
      const store = createSmallStore();
      const artifact = store.store({
        format: 'svg',
        data: makeData(100),
        sizeBytes: 100,
      });

      expect(artifact.artifactId).toBeDefined();
      expect(artifact.format).toBe('svg');
      expect(artifact.sizeBytes).toBe(100);
      expect(artifact.createdAt).toBeGreaterThan(0);
      expect(artifact.expiresAt).toBeGreaterThan(artifact.createdAt);
    });

    it('uses default TTL when not specified', () => {
      const store = createSmallStore({ defaultTtlMs: 5000 });
      const before = Date.now();
      const artifact = store.store({
        format: 'json',
        data: makeData(10),
        sizeBytes: 10,
      });

      expect(artifact.expiresAt - before).toBeGreaterThanOrEqual(4000);
      expect(artifact.expiresAt - before).toBeLessThanOrEqual(6000);
    });

    it('uses custom TTL when specified', () => {
      const store = createSmallStore();
      const artifact = store.store(
        { format: 'mp4', data: makeData(50), sizeBytes: 50 },
        120_000,
      );

      expect(artifact.expiresAt - artifact.createdAt).toBeGreaterThanOrEqual(110_000);
    });

    it('records metrics on store', () => {
      const sink = createSink();
      const store = new ExportArtifactStore(
        { maxArtifacts: 5, maxStorageBytes: 1024, defaultTtlMs: 60_000, downloadUrlTtlMs: 30_000, cleanupIntervalMs: 10_000 },
        sink,
      );

      store.store({ format: 'svg', data: makeData(50), sizeBytes: 50 });
      store.store({ format: 'mp4', data: makeData(100), sizeBytes: 100 });

      expect(sink.artifactStoredCount).toBe(2);
      expect(sink.artifactStorageBytes).toBe(150);
    });
  });

  // -- get() --------------------------------------------------------------

  describe('get()', () => {
    it('returns stored artifact by ID', () => {
      const store = createSmallStore();
      const stored = store.store({ format: 'svg', data: makeData(10), sizeBytes: 10 });

      const retrieved = store.get(stored.artifactId);
      expect(retrieved).toBeDefined();
      expect(retrieved!.artifactId).toBe(stored.artifactId);
    });

    it('returns undefined for non-existent artifact', () => {
      const store = createSmallStore();
      expect(store.get('non-existent')).toBeUndefined();
    });

    it('returns undefined and records expired for TTL-expired artifact', () => {
      const sink = createSink();
      const store = new ExportArtifactStore(
        { maxArtifacts: 5, maxStorageBytes: 1024, defaultTtlMs: 1000, downloadUrlTtlMs: 30_000, cleanupIntervalMs: 10_000 },
        sink,
      );

      const stored = store.store({ format: 'svg', data: makeData(10), sizeBytes: 10 });

      jest.advanceTimersByTime(1500);

      expect(store.get(stored.artifactId)).toBeUndefined();
      expect(sink.artifactExpiredCount).toBe(1);
    });

    it('updates lastAccessedAt on get', () => {
      const store = createSmallStore();
      const stored = store.store({ format: 'svg', data: makeData(10), sizeBytes: 10 });
      const initialAccess = stored.lastAccessedAt;

      jest.advanceTimersByTime(100);
      store.get(stored.artifactId);

      const retrieved = store.get(stored.artifactId);
      expect(retrieved!.lastAccessedAt).toBeGreaterThanOrEqual(initialAccess + 100);
    });
  });

  // -- remove() -----------------------------------------------------------

  describe('remove()', () => {
    it('removes an existing artifact', () => {
      const store = createSmallStore();
      const stored = store.store({ format: 'svg', data: makeData(10), sizeBytes: 10 });

      expect(store.remove(stored.artifactId)).toBe(true);
      expect(store.get(stored.artifactId)).toBeUndefined();
    });

    it('returns false for non-existent artifact', () => {
      const store = createSmallStore();
      expect(store.remove('non-existent')).toBe(false);
    });
  });

  // -- LRU eviction -------------------------------------------------------

  describe('LRU eviction', () => {
    it('evicts LRU artifacts when maxArtifacts is exceeded', () => {
      const store = createSmallStore({ maxArtifacts: 2, maxStorageBytes: 10000 });

      const a = store.store({ format: 'a', data: makeData(10), sizeBytes: 10 });

      jest.advanceTimersByTime(10);
      const b = store.store({ format: 'b', data: makeData(10), sizeBytes: 10 });

      // Access 'a' to make it recently used
      jest.advanceTimersByTime(10);
      store.get(a.artifactId);

      // This should evict 'b' (least recently used)
      store.store({ format: 'c', data: makeData(10), sizeBytes: 10 });

      expect(store.get(a.artifactId)).toBeDefined();
      expect(store.get(b.artifactId)).toBeUndefined();
    });

    it('evicts LRU artifacts when maxStorageBytes is exceeded', () => {
      const store = createSmallStore({ maxArtifacts: 10, maxStorageBytes: 100 });

      const a = store.store({ format: 'a', data: makeData(40), sizeBytes: 40 });

      jest.advanceTimersByTime(10);
      const b = store.store({ format: 'b', data: makeData(40), sizeBytes: 40 });

      // Access 'a' to make it recently used
      jest.advanceTimersByTime(10);
      store.get(a.artifactId);

      // This should evict 'b' to stay under 100 bytes
      store.store({ format: 'c', data: makeData(30), sizeBytes: 30 });

      expect(store.get(a.artifactId)).toBeDefined();
      expect(store.get(b.artifactId)).toBeUndefined();
    });

    it('records expired metrics on LRU eviction', () => {
      const sink = createSink();
      const store = new ExportArtifactStore(
        { maxArtifacts: 2, maxStorageBytes: 10000, defaultTtlMs: 60_000, downloadUrlTtlMs: 30_000, cleanupIntervalMs: 10_000 },
        sink,
      );

      store.store({ format: 'a', data: makeData(10), sizeBytes: 10 });
      jest.advanceTimersByTime(10);
      store.store({ format: 'b', data: makeData(10), sizeBytes: 10 });
      // Trigger eviction by exceeding maxArtifacts
      store.store({ format: 'c', data: makeData(10), sizeBytes: 10 });

      // LRU eviction should increment the expired counter
      expect(sink.artifactExpiredCount).toBe(1);
    });

    it('evicts multiple artifacts when both count and byte limits are exceeded', () => {
      const store = createSmallStore({ maxArtifacts: 5, maxStorageBytes: 50 });

      // Fill with 5 artifacts of 15 bytes each = 75 total, exceeds 50 byte limit
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        const a = store.store({ format: 'x', data: makeData(15), sizeBytes: 15 });
        ids.push(a.artifactId);
        jest.advanceTimersByTime(1);
      }

      // Some artifacts must have been evicted to stay under 50 bytes
      const usage = store.getUsage();
      expect(usage.totalBytes).toBeLessThanOrEqual(50);
      expect(usage.artifactCount).toBeLessThanOrEqual(3); // at most 3 * 15 = 45 bytes
    });
  });

  // -- generateDownloadUrl() -----------------------------------------------

  describe('generateDownloadUrl()', () => {
    it('generates a download URL for a valid artifact', () => {
      const store = createSmallStore();
      const stored = store.store({ format: 'svg', data: makeData(10), sizeBytes: 10 });

      const dl = store.generateDownloadUrl(stored.artifactId);

      expect(dl).toBeDefined();
      expect(dl!.url).toContain(`artifact://${stored.artifactId}`);
      expect(dl!.url).toContain('token=');
      expect(dl!.expiresAt).toBeGreaterThan(Date.now());
    });

    it('returns undefined for non-existent artifact', () => {
      const store = createSmallStore();
      expect(store.generateDownloadUrl('non-existent')).toBeUndefined();
    });

    it('records download metrics', () => {
      const sink = createSink();
      const store = new ExportArtifactStore(
        { maxArtifacts: 5, maxStorageBytes: 1024, defaultTtlMs: 60_000, downloadUrlTtlMs: 30_000, cleanupIntervalMs: 10_000 },
        sink,
      );

      const stored = store.store({ format: 'svg', data: makeData(10), sizeBytes: 10 });
      store.generateDownloadUrl(stored.artifactId);

      expect(sink.artifactDownloadCount).toBe(1);
    });
  });

  // -- resolveDownloadUrl() -----------------------------------------------

  describe('resolveDownloadUrl()', () => {
    it('resolves a valid download URL token', () => {
      const store = createSmallStore();
      const stored = store.store({ format: 'svg', data: makeData(10), sizeBytes: 10 });

      const dl = store.generateDownloadUrl(stored.artifactId)!;

      const token = new URL(dl.url.replace('artifact://', 'http://dummy/')).searchParams.get('token')!;
      const resolved = store.resolveDownloadUrl(stored.artifactId, token);

      expect(resolved).toBeDefined();
      expect(resolved!.artifactId).toBe(stored.artifactId);
    });

    it('returns undefined for invalid token', () => {
      const store = createSmallStore();
      const stored = store.store({ format: 'svg', data: makeData(10), sizeBytes: 10 });

      store.generateDownloadUrl(stored.artifactId);

      expect(store.resolveDownloadUrl(stored.artifactId, 'invalid-token')).toBeUndefined();
    });

    it('returns undefined for expired token', () => {
      const store = createSmallStore({ downloadUrlTtlMs: 1000 });
      const stored = store.store({ format: 'svg', data: makeData(10), sizeBytes: 10 });

      const dl = store.generateDownloadUrl(stored.artifactId)!;
      const token = new URL(dl.url.replace('artifact://', 'http://dummy/')).searchParams.get('token')!;

      jest.advanceTimersByTime(1500);

      expect(store.resolveDownloadUrl(stored.artifactId, token)).toBeUndefined();
    });
  });

  // -- getUsage() ---------------------------------------------------------

  describe('getUsage()', () => {
    it('returns correct usage statistics', () => {
      const store = createSmallStore();

      store.store({ format: 'svg', data: makeData(10), sizeBytes: 10 });
      store.store({ format: 'svg', data: makeData(20), sizeBytes: 20 });
      store.store({ format: 'mp4', data: makeData(30), sizeBytes: 30 });

      const usage = store.getUsage();

      expect(usage.artifactCount).toBe(3);
      expect(usage.totalBytes).toBe(60);
      expect(usage.formatDistribution.svg).toBe(2);
      expect(usage.formatDistribution.mp4).toBe(1);
    });

    it('returns zeros for empty store', () => {
      const store = createSmallStore();
      const usage = store.getUsage();

      expect(usage.artifactCount).toBe(0);
      expect(usage.totalBytes).toBe(0);
      expect(Object.keys(usage.formatDistribution)).toHaveLength(0);
    });

    it('reflects removal in usage stats', () => {
      const store = createSmallStore();
      const a = store.store({ format: 'svg', data: makeData(10), sizeBytes: 10 });
      store.store({ format: 'mp4', data: makeData(20), sizeBytes: 20 });

      store.remove(a.artifactId);

      const usage = store.getUsage();
      expect(usage.artifactCount).toBe(1);
      expect(usage.totalBytes).toBe(20);
    });
  });

  // -- TTL cleanup --------------------------------------------------------

  describe('TTL cleanup', () => {
    it('cleans up expired artifacts on timer tick', () => {
      const sink = createSink();
      const store = new ExportArtifactStore(
        {
          maxArtifacts: 10,
          maxStorageBytes: 10000,
          defaultTtlMs: 1000,
          downloadUrlTtlMs: 30_000,
          cleanupIntervalMs: 500,
        },
        sink,
      );

      store.store({ format: 'svg', data: makeData(10), sizeBytes: 10 });
      store.store({ format: 'mp4', data: makeData(20), sizeBytes: 20 });

      expect(store.size).toBe(2);

      store.start();
      jest.advanceTimersByTime(1500);

      expect(store.size).toBe(0);
      expect(sink.artifactExpiredCount).toBeGreaterThanOrEqual(1);

      store.stop();
    });

    it('does not clean up non-expired artifacts', () => {
      const store = new ExportArtifactStore({
        maxArtifacts: 10,
        maxStorageBytes: 10000,
        defaultTtlMs: 10_000,
        downloadUrlTtlMs: 30_000,
        cleanupIntervalMs: 500,
      });

      store.store({ format: 'svg', data: makeData(10), sizeBytes: 10 });

      store.start();
      jest.advanceTimersByTime(5000);

      expect(store.size).toBe(1);

      store.stop();
    });
  });

  // -- start/stop ---------------------------------------------------------

  describe('start/stop', () => {
    it('does not start multiple timers', () => {
      const store = createSmallStore({ cleanupIntervalMs: 100 });
      store.start();
      store.start(); // should be a no-op

      store.store({ format: 'svg', data: makeData(10), sizeBytes: 10 });

      jest.advanceTimersByTime(500);

      // Should have cleaned once, not crashed
      store.stop();
    });

    it('stop is idempotent', () => {
      const store = createSmallStore();
      store.stop(); // no-op
      store.stop(); // still no-op
    });
  });

  // -- size property -------------------------------------------------------

  describe('size', () => {
    it('returns current artifact count', () => {
      const store = createSmallStore();
      expect(store.size).toBe(0);

      store.store({ format: 'svg', data: makeData(10), sizeBytes: 10 });
      expect(store.size).toBe(1);

      store.store({ format: 'mp4', data: makeData(20), sizeBytes: 20 });
      expect(store.size).toBe(2);
    });
  });

  // -- getMetadata() (REQ-238) --------------------------------------------

  describe('getMetadata()', () => {
    it('returns artifact metadata without data field', () => {
      const store = createSmallStore();
      const stored = store.store({
        format: 'svg',
        data: makeData(100),
        sizeBytes: 100,
        metadata: { jobId: 'test-job' },
      });

      const meta = store.getMetadata(stored.artifactId);
      expect(meta).toBeDefined();
      expect(meta!.artifactId).toBe(stored.artifactId);
      expect(meta!.format).toBe('svg');
      expect(meta!.sizeBytes).toBe(100);
      expect(meta!.metadata).toEqual({ jobId: 'test-job' });
      expect((meta as any).data).toBeUndefined();
    });

    it('returns undefined for non-existent artifact', () => {
      const store = createSmallStore();
      expect(store.getMetadata('non-existent')).toBeUndefined();
    });

    it('returns undefined for expired artifact', () => {
      const store = createSmallStore({ defaultTtlMs: 500 });
      const stored = store.store({ format: 'svg', data: makeData(10), sizeBytes: 10 });

      jest.advanceTimersByTime(600);
      expect(store.getMetadata(stored.artifactId)).toBeUndefined();
    });
  });

  // -- list() (REQ-238) ---------------------------------------------------

  describe('list()', () => {
    it('returns all non-expired artifacts as metadata', () => {
      const store = createSmallStore({ maxArtifacts: 10, maxStorageBytes: 10000 });
      store.store({ format: 'svg', data: makeData(10), sizeBytes: 10 });
      store.store({ format: 'mp4', data: makeData(20), sizeBytes: 20 });

      const result = store.list();
      expect(result.artifacts).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.artifacts.every((a) => !('data' in a && a.data instanceof Uint8Array))).toBe(true);
    });

    it('sorts by createdAt descending (newest first)', () => {
      const store = createSmallStore({ maxArtifacts: 10, maxStorageBytes: 10000 });
      store.store({ format: 'svg', data: makeData(10), sizeBytes: 10 });

      jest.advanceTimersByTime(10);
      store.store({ format: 'mp4', data: makeData(20), sizeBytes: 20 });

      const result = store.list();
      expect(result.artifacts[0].format).toBe('mp4');
      expect(result.artifacts[1].format).toBe('svg');
    });

    it('filters by format', () => {
      const store = createSmallStore({ maxArtifacts: 10, maxStorageBytes: 10000 });
      store.store({ format: 'svg', data: makeData(10), sizeBytes: 10 });
      store.store({ format: 'mp4', data: makeData(20), sizeBytes: 20 });
      store.store({ format: 'svg', data: makeData(15), sizeBytes: 15 });

      const result = store.list({ format: 'svg' });
      expect(result.artifacts).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.artifacts.every((a) => a.format === 'svg')).toBe(true);
    });

    it('paginates with limit and offset', () => {
      const store = createSmallStore({ maxArtifacts: 10, maxStorageBytes: 10000 });
      for (let i = 0; i < 5; i++) {
        store.store({ format: 'svg', data: makeData(10), sizeBytes: 10 });
        jest.advanceTimersByTime(1);
      }

      const page1 = store.list({ limit: 2, offset: 0 });
      expect(page1.artifacts).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page1.limit).toBe(2);
      expect(page1.offset).toBe(0);

      const page2 = store.list({ limit: 2, offset: 2 });
      expect(page2.artifacts).toHaveLength(2);
      expect(page2.offset).toBe(2);

      const page3 = store.list({ limit: 2, offset: 4 });
      expect(page3.artifacts).toHaveLength(1);
    });

    it('excludes expired artifacts', () => {
      const store = createSmallStore({ maxArtifacts: 10, maxStorageBytes: 10000, defaultTtlMs: 1000 });
      store.store({ format: 'svg', data: makeData(10), sizeBytes: 10 });

      jest.advanceTimersByTime(10);
      store.store({ format: 'mp4', data: makeData(20), sizeBytes: 20 });

      jest.advanceTimersByTime(995);
      // First artifact expired (t≈1005 > expiresAt 1000), second still valid (expiresAt 1010)
      const result = store.list();
      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].format).toBe('mp4');
    });

    it('returns empty list for format with no matches', () => {
      const store = createSmallStore({ maxArtifacts: 10, maxStorageBytes: 10000 });
      store.store({ format: 'svg', data: makeData(10), sizeBytes: 10 });

      const result = store.list({ format: 'webm' });
      expect(result.artifacts).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
