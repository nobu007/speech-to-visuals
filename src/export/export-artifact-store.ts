/**
 * REQ-230: Export Artifact Store (Phase 100)
 *
 * In-memory storage for export artifacts with TTL-based auto-cleanup,
 * LRU eviction on quota overflow, time-limited download URLs,
 * usage tracking, and ExportMetricsCollector integration.
 */

import { randomUUID } from 'crypto';
import { ARTIFACT_STORE_LIMITS } from '@/config/limits';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StoredArtifact {
  artifactId: string;
  format: string;
  data: Uint8Array;
  sizeBytes: number;
  createdAt: number;
  lastAccessedAt: number;
  expiresAt: number;
  metadata?: Record<string, unknown>;
}

export interface ArtifactDownloadUrl {
  url: string;
  expiresAt: number;
}

export interface ArtifactUsageSnapshot {
  totalBytes: number;
  artifactCount: number;
  formatDistribution: Record<string, number>;
}

export interface ArtifactStoreOptions {
  defaultTtlMs: number;
  maxStorageBytes: number;
  maxArtifacts: number;
  downloadUrlTtlMs: number;
  cleanupIntervalMs: number;
}

export interface ArtifactMetadata {
  artifactId: string;
  format: string;
  sizeBytes: number;
  createdAt: number;
  lastAccessedAt: number;
  expiresAt: number;
  metadata?: Record<string, unknown>;
}

export interface ListOptions {
  format?: string;
  limit?: number;
  offset?: number;
}

export interface ListResult {
  artifacts: ArtifactMetadata[];
  total: number;
  limit: number;
  offset: number;
}

export interface ArtifactMetricsSink {
  recordArtifactStored(): void;
  recordArtifactStorageBytes(bytes: number): void;
  recordArtifactExpired(): void;
  recordArtifactDownload(): void;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_OPTIONS: ArtifactStoreOptions = {
  defaultTtlMs: ARTIFACT_STORE_LIMITS.DEFAULT_TTL_MS,
  maxStorageBytes: ARTIFACT_STORE_LIMITS.MAX_STORAGE_BYTES,
  maxArtifacts: ARTIFACT_STORE_LIMITS.MAX_ARTIFACTS,
  downloadUrlTtlMs: ARTIFACT_STORE_LIMITS.DOWNLOAD_URL_TTL_MS,
  cleanupIntervalMs: ARTIFACT_STORE_LIMITS.CLEANUP_INTERVAL_MS,
};

// ---------------------------------------------------------------------------
// ExportArtifactStore
// ---------------------------------------------------------------------------

export class ExportArtifactStore {
  private artifacts = new Map<string, StoredArtifact>();
  private readonly options: ArtifactStoreOptions;
  private readonly metrics?: ArtifactMetricsSink;
  private cleanupTimer?: ReturnType<typeof setInterval>;
  private started = false;

  constructor(options?: Partial<ArtifactStoreOptions>, metrics?: ArtifactMetricsSink) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.metrics = metrics;
  }

  // -- Public API ----------------------------------------------------------

  /**
   * Store an export artifact with optional TTL override.
   * Returns the created artifact with its assigned artifactId.
   */
  store(
    input: Omit<StoredArtifact, 'artifactId' | 'createdAt' | 'lastAccessedAt' | 'expiresAt'>,
    ttlMs?: number,
  ): StoredArtifact {
    const effectiveTtl = ttlMs ?? this.options.defaultTtlMs;

    const artifact: StoredArtifact = {
      ...input,
      artifactId: randomUUID(),
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      expiresAt: Date.now() + effectiveTtl,
    };

    this.artifacts.set(artifact.artifactId, artifact);
    this.enforceQuota();

    this.metrics?.recordArtifactStored();
    this.metrics?.recordArtifactStorageBytes(artifact.sizeBytes);

    logger.info(
      `[ArtifactStore] Stored artifact ${artifact.artifactId} (${artifact.format}, ${artifact.sizeBytes} bytes, TTL=${effectiveTtl}ms)`,
    );
    return artifact;
  }

  /**
   * Retrieve an artifact by its ID.
   * Returns undefined if the artifact has expired or does not exist.
   * Updates lastAccessedAt for LRU tracking.
   */
  get(artifactId: string): StoredArtifact | undefined {
    const artifact = this.artifacts.get(artifactId);
    if (!artifact) return undefined;

    if (Date.now() > artifact.expiresAt) {
      this.remove(artifactId);
      this.metrics?.recordArtifactExpired();
      return undefined;
    }

    artifact.lastAccessedAt = Date.now();
    return artifact;
  }

  /**
   * Get artifact metadata without the data payload.
   * Returns undefined if the artifact has expired or does not exist.
   */
  getMetadata(artifactId: string): ArtifactMetadata | undefined {
    const artifact = this.get(artifactId);
    if (!artifact) return undefined;
    const { data: _data, ...meta } = artifact;
    return meta;
  }

  /**
   * List stored artifacts with optional filtering and pagination.
   * Expired artifacts are excluded. Results are sorted newest-first.
   */
  list(options?: ListOptions): ListResult {
    const { format, limit = 50, offset = 0 } = options ?? {};
    const now = Date.now();

    let entries = Array.from(this.artifacts.values())
      .filter((a) => a.expiresAt > now);

    if (format) {
      entries = entries.filter((a) => a.format === format);
    }

    const total = entries.length;

    entries.sort((a, b) => b.createdAt - a.createdAt);
    const paginated = entries.slice(offset, offset + limit);

    const artifacts: ArtifactMetadata[] = paginated.map(
      ({ data: _data, ...meta }) => meta,
    );

    return { artifacts, total, limit, offset };
  }

  /**
   * Remove an artifact by ID.
   * Returns true if the artifact was found and removed.
   */
  remove(artifactId: string): boolean {
    const deleted = this.artifacts.delete(artifactId);
    if (deleted) {
      logger.info(`[ArtifactStore] Removed artifact ${artifactId}`);
    }
    return deleted;
  }

  /**
   * Generate a time-limited download URL for an artifact.
   * The URL contains a token that expires after downloadUrlTtlMs.
   * Returns undefined if the artifact does not exist or has expired.
   */
  generateDownloadUrl(artifactId: string): ArtifactDownloadUrl | undefined {
    const artifact = this.get(artifactId);
    if (!artifact) return undefined;

    const token = randomUUID();
    const expiresAt = Date.now() + this.options.downloadUrlTtlMs;

    // Store the token as metadata on the artifact
    if (!artifact.metadata) artifact.metadata = {};
    artifact.metadata._downloadTokens = artifact.metadata._downloadTokens ?? [];
    (artifact.metadata._downloadTokens as Array<{ token: string; expiresAt: number }>).push({
      token,
      expiresAt,
    });

    this.metrics?.recordArtifactDownload();

    return {
      url: `artifact://${artifactId}?token=${token}`,
      expiresAt,
    };
  }

  /**
   * Validate a download URL token for an artifact.
   * Returns the artifact if the token is valid and not expired.
   */
  resolveDownloadUrl(artifactId: string, token: string): StoredArtifact | undefined {
    const artifact = this.artifacts.get(artifactId);
    if (!artifact) return undefined;

    const tokens = artifact.metadata?._downloadTokens as
      | Array<{ token: string; expiresAt: number }>
      | undefined;
    if (!tokens) return undefined;

    const now = Date.now();
    const validToken = tokens.find((t) => t.token === token && t.expiresAt > now);
    if (!validToken) return undefined;

    artifact.lastAccessedAt = now;
    return artifact;
  }

  /**
   * Get current usage statistics.
   */
  getUsage(): ArtifactUsageSnapshot {
    let totalBytes = 0;
    const formatDistribution: Record<string, number> = {};

    for (const artifact of this.artifacts.values()) {
      totalBytes += artifact.sizeBytes;
      formatDistribution[artifact.format] = (formatDistribution[artifact.format] ?? 0) + 1;
    }

    return {
      totalBytes,
      artifactCount: this.artifacts.size,
      formatDistribution,
    };
  }

  /**
   * Start periodic TTL-based cleanup.
   */
  start(): void {
    if (this.started) return;
    this.started = true;

    this.cleanupTimer = setInterval(
      () => {
        try {
          this.cleanupExpired();
        } catch (err) {
          logger.error('[ExportArtifactStore] Cleanup tick failed:', err);
        }
      },
      this.options.cleanupIntervalMs,
    );

    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }

    logger.info('[ArtifactStore] Started cleanup timer');
  }

  /**
   * Stop periodic cleanup and release resources.
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.started = false;
    logger.info('[ArtifactStore] Stopped');
  }

  /**
   * Get the number of stored artifacts.
   */
  get size(): number {
    return this.artifacts.size;
  }

  // -- Internal helpers ----------------------------------------------------

  /**
   * Remove all expired artifacts.
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [id, artifact] of this.artifacts) {
      if (now > artifact.expiresAt) {
        this.artifacts.delete(id);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.metrics?.recordArtifactExpired();
      logger.info(`[ArtifactStore] Cleaned up ${expiredCount} expired artifacts`);
    }
  }

  /**
   * Enforce storage quotas by evicting least-recently-used artifacts.
   */
  private enforceQuota(): void {
    // Enforce max artifact count
    while (this.artifacts.size > this.options.maxArtifacts) {
      this.evictLRU();
    }

    // Enforce max storage bytes
    let totalBytes = 0;
    for (const a of this.artifacts.values()) {
      totalBytes += a.sizeBytes;
    }

    while (totalBytes > this.options.maxStorageBytes && this.artifacts.size > 0) {
      const evicted = this.evictLRU();
      if (evicted) {
        totalBytes -= evicted.sizeBytes;
      } else {
        break;
      }
    }
  }

  /**
   * Evict the least recently used artifact.
   */
  private evictLRU(): StoredArtifact | undefined {
    let lruId: string | undefined;
    let lruTime = Infinity;

    for (const [id, artifact] of this.artifacts) {
      if (artifact.lastAccessedAt < lruTime) {
        lruTime = artifact.lastAccessedAt;
        lruId = id;
      }
    }

    if (lruId) {
      const evicted = this.artifacts.get(lruId);
      this.artifacts.delete(lruId);
      this.metrics?.recordArtifactExpired();
      logger.info(`[ArtifactStore] LRU evicted artifact ${lruId}`);
      return evicted;
    }

    return undefined;
  }
}
