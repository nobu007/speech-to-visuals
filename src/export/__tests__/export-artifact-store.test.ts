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
});
