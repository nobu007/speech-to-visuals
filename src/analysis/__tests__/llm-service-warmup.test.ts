/**
 * REQ-202: LLMService Cache Warmup Integration Tests
 *
 * Verifies that CacheWarmupManager is correctly integrated into LLMService:
 * - warmupCache() triggers on cold start
 * - warmupCache() skips on warm cache
 * - Cache hit/miss tracking via execute()
 * - getCacheWarmupStats() and getCacheHitRateReport() accessors
 * - clearCache() resets warmup manager
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock the Google Generative AI SDK (no real API calls)
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn(),
  })),
}));

// Import after mocks
import { LLMService } from '../llm-service';

describe('LLMService Cache Warmup Integration (REQ-202)', () => {
  let service: LLMService;
  let tmpDir: string;

  beforeEach(() => {
    // Use a unique temp directory per test to avoid cross-test cache persistence
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-warmup-test-'));
    service = new LLMService('test-api-key', {
      cachePersistPath: path.join(tmpDir, 'test-cache.json'),
    });
  });

  afterEach(() => {
    // Clean up temp dir
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    jest.restoreAllMocks();
  });

  describe('warmupCache()', () => {
    test('returns true and populates cache on cold start', async () => {
      const result = await service.warmupCache();
      expect(result).toBe(true);
    });

    test('returns false when cache is already warm', async () => {
      // First warmup fills the cache
      await service.warmupCache();
      // Second warmup should be skipped
      const result = await service.warmupCache();
      expect(result).toBe(false);
    });

    test('uses custom resolver when provided', async () => {
      const customResolver = jest.fn().mockResolvedValue({ custom: 'data' });
      const result = await service.warmupCache(customResolver);
      expect(result).toBe(true);
      expect(customResolver).toHaveBeenCalled();
    });

    test('uses default pass-through resolver when none provided', async () => {
      const result = await service.warmupCache();
      expect(result).toBe(true);
    });
  });

  describe('getCacheWarmupStats()', () => {
    test('returns initial stats before any warmup', () => {
      const stats = service.getCacheWarmupStats();
      expect(stats.totalWarmups).toBe(0);
      expect(stats.totalPatternsProcessed).toBe(0);
      expect(stats.totalSuccesses).toBe(0);
      expect(stats.totalFailures).toBe(0);
    });

    test('returns updated stats after warmup', async () => {
      await service.warmupCache();
      const stats = service.getCacheWarmupStats();
      expect(stats.totalWarmups).toBe(1);
      expect(stats.totalPatternsProcessed).toBeGreaterThan(0);
      expect(stats.totalSuccesses).toBeGreaterThan(0);
    });
  });

  describe('getCacheHitRateReport()', () => {
    test('returns initial report with zero values', () => {
      const report = service.getCacheHitRateReport();
      expect(report.hitRateBefore).toBe(0);
      expect(report.hitRateAfterWarmup).toBe(0);
      expect(report.queriesAfterWarmup).toBe(0);
      expect(report.hitsAfterWarmup).toBe(0);
    });

    test('tracks queries after warmup', async () => {
      await service.warmupCache();
      service.recordCacheQuery(true);
      service.recordCacheQuery(false);
      const report = service.getCacheHitRateReport();
      expect(report.queriesAfterWarmup).toBe(2);
      expect(report.hitsAfterWarmup).toBe(1);
    });
  });

  describe('clearCache() resets warmup manager', () => {
    test('warmup can be re-triggered after clearCache', async () => {
      const first = await service.warmupCache();
      expect(first).toBe(true);

      service.clearCache();

      const second = await service.warmupCache();
      expect(second).toBe(true);
    });

    test('stats reset after clearCache', async () => {
      await service.warmupCache();
      expect(service.getCacheWarmupStats().totalWarmups).toBe(1);

      service.clearCache();
      const stats = service.getCacheWarmupStats();
      expect(stats.totalWarmups).toBe(0);
    });
  });
});
