/**
 * Unit tests for LLMCache
 * Covers: get/set, TTL expiry, eviction, semantic matching, persistence, stats
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LLMCache } from '../llm-cache';
import { setCorruptionHandler, type CorruptionReport } from '@stv/core/utils/report-corruption';

// Mock logger
jest.mock('@stv/core/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('LLMCache', () => {
  let cache: LLMCache<string>;

  beforeEach(() => {
    jest.clearAllMocks();
    cache = new LLMCache<string>({ maxSize: 5, ttlMinutes: 60, enableSemantic: false });
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('basic get/set', () => {
    it('returns null for missing key', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('returns cached value after set', () => {
      cache.set('hello', 'world');
      expect(cache.get('hello')).toBe('world');
    });

    it('respects prefix parameter', () => {
      cache.set('text', 'data-a', 'prefixA');
      cache.set('text', 'data-b', 'prefixB');
      expect(cache.get('text', 'prefixA')).toBe('data-a');
      expect(cache.get('text', 'prefixB')).toBe('data-b');
    });

    it('normalizes text before hashing (trim + lowercase)', () => {
      cache.set('  Hello World  ', 'result1');
      expect(cache.get('hello world')).toBe('result1');
    });

    it('handles empty text', () => {
      cache.set('', 'empty-result');
      expect(cache.get('')).toBe('empty-result');
    });
  });

  describe('TTL expiry', () => {
    it('returns null for expired entries', () => {
      const shortCache = new LLMCache<string>({ ttlMinutes: 0.001 }); // ~60ms
      shortCache.set('key', 'value');
      // Wait for TTL to expire
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(shortCache.get('key')).toBeNull();
          shortCache.destroy();
          resolve();
        }, 100);
      });
    });

    it('does not return expired entries from exact match', () => {
      const shortCache = new LLMCache<string>({ ttlMinutes: 0.001, enableSemantic: false });
      shortCache.set('key1', 'value1');
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // Expired entry should not be returned
          expect(shortCache.get('key1')).toBeNull();
          shortCache.destroy();
          resolve();
        }, 100);
      });
    });
  });

  describe('eviction', () => {
    it('evicts oldest entry when maxSize is reached', () => {
      const smallCache = new LLMCache<string>({ maxSize: 3, enableSemantic: false });
      smallCache.set('a', '1');
      // Small delay to ensure different timestamps
      smallCache.set('b', '2');
      smallCache.set('c', '3');
      smallCache.set('d', '4'); // Should evict 'a'

      expect(smallCache.get('a')).toBeNull();
      expect(smallCache.get('d')).toBe('4');
      smallCache.destroy();
    });

    it('does not evict when below maxSize', () => {
      cache.set('a', '1');
      cache.set('b', '2');
      expect(cache.get('a')).toBe('1');
      expect(cache.get('b')).toBe('2');
    });
  });

  describe('clear', () => {
    it('clears all entries', () => {
      cache.set('a', '1');
      cache.set('b', '2');
      cache.clear();
      expect(cache.get('a')).toBeNull();
      expect(cache.get('b')).toBeNull();
    });
  });

  describe('clearExpired', () => {
    it('removes only expired entries', () => {
      cache.set('fresh', 'value');
      // Manually check that clearExpired doesn't remove valid entries
      cache.clearExpired();
      expect(cache.get('fresh')).toBe('value');
    });
  });

  describe('getStats', () => {
    it('returns zero stats for empty cache', () => {
      const stats = cache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.validEntries).toBe(0);
      expect(stats.totalHits).toBe(0);
    });

    it('tracks cache size', () => {
      cache.set('a', '1');
      cache.set('b', '2');
      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.validEntries).toBe(2);
    });

    it('tracks total hits', () => {
      cache.set('a', '1');
      cache.get('a');
      cache.get('a');
      const stats = cache.getStats();
      expect(stats.totalHits).toBeGreaterThan(0);
    });

    it('includes semantic metrics', () => {
      const stats = cache.getStats();
      expect(stats.semantic).toBeDefined();
      expect(stats.semantic.enabled).toBe(false); // disabled in this test
      expect(stats.semantic.threshold).toBe(0.8);
      expect(typeof stats.semantic.exactHits).toBe('number');
      expect(typeof stats.semantic.misses).toBe('number');
    });
  });

  describe('semantic matching', () => {
    it('finds semantically similar entries', () => {
      const semCache = new LLMCache<string>({
        enableSemantic: true,
        semanticThreshold: 0.3,
      });
      semCache.set('The quick brown fox jumps', 'result-fox');

      // Similar text should match
      const result = semCache.get('The quick brown fox jumps over the lazy dog');
      expect(result).not.toBeNull();
      semCache.destroy();
    });

    it('does not match completely different text', () => {
      const semCache = new LLMCache<string>({
        enableSemantic: true,
        semanticThreshold: 0.8,
      });
      semCache.set('The quick brown fox', 'fox-result');
      const result = semCache.get('Completely different topic about database');
      expect(result).toBeNull();
      semCache.destroy();
    });

    it('respects prefix in semantic matching', () => {
      const semCache = new LLMCache<string>({
        enableSemantic: true,
        semanticThreshold: 0.3,
      });
      semCache.set('The quick brown fox', 'result-a', 'prefixA');
      // Should not match with different prefix
      const result = semCache.get('The quick brown fox', 'prefixB');
      expect(result).toBeNull();
      semCache.destroy();
    });

    it('records semantic hit metrics', () => {
      const semCache = new LLMCache<string>({
        enableSemantic: true,
        semanticThreshold: 0.3,
      });
      semCache.set('hello world test', 'result');
      semCache.get('hello world test something');

      const stats = semCache.getStats();
      expect(stats.semantic.semanticHits).toBeGreaterThan(0);
      semCache.destroy();
    });
  });

  describe('persistence', () => {
    let tmpDir: string;
    let cachePath: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-cache-test-'));
      cachePath = path.join(tmpDir, 'cache.json');
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('persists to disk and loads back', () => {
      const cache1 = new LLMCache<string>({
        persistPath: cachePath,
        enableSemantic: false,
        persistDebounceMs: 0, // Immediate write
      });
      cache1.set('key1', 'value1');
      cache1.set('key2', 'value2');
      cache1.persist();

      // File should exist
      expect(fs.existsSync(cachePath)).toBe(true);

      // Load in new instance
      const cache2 = new LLMCache<string>({
        persistPath: cachePath,
        enableSemantic: false,
      });
      expect(cache2.get('key1')).toBe('value1');
      expect(cache2.get('key2')).toBe('value2');

      cache1.destroy();
      cache2.destroy();
    });

    it('handles missing cache file gracefully', () => {
      const cache = new LLMCache<string>({
        persistPath: path.join(tmpDir, 'nonexistent.json'),
        enableSemantic: false,
      });
      // Should not throw, just start fresh
      expect(cache.get('anything')).toBeNull();
      cache.destroy();
    });

    it('handles corrupted cache file gracefully', () => {
      fs.writeFileSync(cachePath, '{ invalid json }', 'utf8');
      const cache = new LLMCache<string>({
        persistPath: cachePath,
        enableSemantic: false,
      });
      // Should not throw, start fresh
      expect(cache.get('anything')).toBeNull();
      cache.destroy();
    });

    it('emits reportCorruption when disk cache is corrupted', () => {
      const reports: CorruptionReport[] = [];
      setCorruptionHandler((r) => reports.push(r));

      fs.writeFileSync(cachePath, '{ invalid json }', 'utf8');
      const cache = new LLMCache<string>({
        persistPath: cachePath,
        enableSemantic: false,
      });
      cache.destroy();

      setCorruptionHandler(null);

      expect(reports.length).toBeGreaterThanOrEqual(1);
      expect(reports[0].source).toBe('LLMCache');
      expect(reports[0].detail).toContain('disk');
    });

    it('handles version mismatch', () => {
      fs.writeFileSync(cachePath, JSON.stringify({
        version: '99.0',
        timestamp: Date.now(),
        entries: [],
      }), 'utf8');

      const cache = new LLMCache<string>({
        persistPath: cachePath,
        enableSemantic: false,
      });
      expect(cache.get('anything')).toBeNull();
      cache.destroy();
    });

    it('supports v1.0 cache format', () => {
      fs.writeFileSync(cachePath, JSON.stringify({
        version: '1.0',
        timestamp: Date.now(),
        entries: [
          { key: 'old-key', data: 'old-data', timestamp: Date.now(), hits: 3 },
        ],
      }), 'utf8');

      const cache = new LLMCache<string>({
        persistPath: cachePath,
        enableSemantic: false,
      });
      // The key is a hash of the text, so we can't predict it.
      // But we verify no crash and entries were loaded.
      const stats = cache.getStats();
      expect(stats.size).toBe(1);
      cache.destroy();
    });

    it('filters expired entries on load', () => {
      fs.writeFileSync(cachePath, JSON.stringify({
        version: '2.0',
        timestamp: Date.now(),
        entries: [
          { key: 'expired-key', data: 'data', timestamp: 0, hits: 0, originalText: 'test' },
          { key: 'fresh-key', data: 'data', timestamp: Date.now(), hits: 0, originalText: 'test' },
        ],
      }), 'utf8');

      const cache = new LLMCache<string>({
        persistPath: cachePath,
        enableSemantic: false,
        ttlMinutes: 60,
      });
      const stats = cache.getStats();
      // Only the non-expired entry should be loaded
      expect(stats.size).toBe(1);
      cache.destroy();
    });
  });

  describe('debounced persistence', () => {
    it('cancels pending save on destroy', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-cache-debounce-'));
      try {
        const cachePath = path.join(tmpDir, 'cache.json');
        const cache = new LLMCache<string>({
          persistPath: cachePath,
          enableSemantic: false,
          persistDebounceMs: 5000, // Long debounce
        });
        cache.set('key', 'value');
        // destroy() should cancel the pending timer
        cache.destroy();
        // File should not exist (debounced save was cancelled)
        // Note: with long debounce, save hasn't happened yet
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('persist() cancels debounce and saves immediately', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-cache-persist-'));
      try {
        const cachePath = path.join(tmpDir, 'cache.json');
        const cache = new LLMCache<string>({
          persistPath: cachePath,
          enableSemantic: false,
          persistDebounceMs: 5000,
        });
        cache.set('key', 'value');
        cache.persist(); // Should save immediately
        expect(fs.existsSync(cachePath)).toBe(true);
        cache.destroy();
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('CJK text handling', () => {
    it('handles Japanese text', () => {
      const semCache = new LLMCache<string>({
        enableSemantic: true,
        semanticThreshold: 0.3,
      });
      semCache.set('音声認識のテスト', 'japanese-result');
      // Exact match
      expect(semCache.get('音声認識のテスト')).toBe('japanese-result');
      semCache.destroy();
    });

    it('handles long text truncation', () => {
      const longText = 'a'.repeat(3000);
      cache.set(longText, 'result');
      expect(cache.get(longText)).toBe('result');
    });
  });
});
