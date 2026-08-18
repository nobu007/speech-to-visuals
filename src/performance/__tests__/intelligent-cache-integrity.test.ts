/**
 * IntelligentCache — cache-integrity & rate-derivation invariants.
 *
 * The cache has been hit by three defects in a row, all the same shape:
 *   - hash-collision cross-return (18778f3b): get() returned another content's
 *     data because the 32-bit hash key collided and was treated as equality.
 *   - RLE originalSize loss (b528bf7b): decompressData was fed compressedSize
 *     as the decompression budget, so compressed entries came back as gibberish.
 *   - self-referential rate formula (2428e472 / 61cd5328): updateHitRate and
 *     updatePerformanceScore fed the ratio fields (hitRate/missRate) back into
 *     their own denominator, overstating the hit rate and saturating preload
 *     effectiveness regardless of real request volume.
 *
 * Each already has a one-sequence regression test. This file turns the same
 * contracts into PROPERTY / INVARIANT tests so a future reintroduction in a
 * different form still fails. The governing invariants are:
 *
 *   (R1) Rates are derived from cumulative COUNTS, never self-referentially:
 *        hitRate === totalHits / (totalHits + totalMisses).
 *   (R2) preloadEffectiveness denominator is the same count-derived volume, so
 *        it must scale DOWN as request volume grows for fixed preloadHits.
 *   (I1) Content equality is the lookup contract: a get() for content c returns
 *        exactly c's data or null — never another content's data, even when two
 *        contents hash to the same slot.
 *   (I2) store→get is a faithful round-trip for every payload (compression is
 *        transparent), so originalSize must be restored exactly.
 */
import { IntelligentCache } from '@/performance/intelligent-cache';
import type { DiagramType } from '@stv/core/types/diagram';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMetadata(overrides: Partial<{
  contentType: DiagramType;
  duration: number;
  complexity: number;
  performanceScore: number;
  accessPattern: 'frequent' | 'recent' | 'mixed' | 'cold';
}> = {}) {
  return {
    contentType: 'flow' as DiagramType,
    duration: 100,
    complexity: 0.5,
    performanceScore: 0.8,
    accessPattern: 'mixed' as const,
    ...overrides,
  };
}

/** Stats shape including the cumulative count fields the invariants depend on. */
interface InvariantStats {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  averageRetrievalTime: number;
  totalSavedTime: number;
  memoryUsage: number;
  compressionRatio: number;
  evictionCount: number;
  preloadHits: number;
  performanceScore: number;
  totalHits: number;
  totalMisses: number;
}

interface CacheEntryLike {
  compressed: boolean;
  originalSize: number;
  compressedSize: number;
}

interface CacheInternals {
  stats: InvariantStats;
  cache: Map<string, CacheEntryLike>;
  generateCacheKey: (content: string) => string;
  updateHitRate: (isHit: boolean) => number;
  updatePerformanceScore: () => void;
}

function internals(cache: IntelligentCache): CacheInternals {
  return cache as unknown as CacheInternals;
}

/**
 * Deterministic LCG so the property tests are reproducible. (Math.random would
 * also work under jest, but a seeded generator guarantees a failing case can be
 * replayed exactly.)
 */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

// ===========================================================================
// (R1) Rate derivation invariants — "derive rate from cumulative counts"
// ===========================================================================

describe('IntelligentCache rate-derivation invariants (R1)', () => {
  let cache: IntelligentCache;

  beforeEach(() => {
    cache = new IntelligentCache();
  });

  it('hitRate always equals totalHits/(totalHits+totalMisses) for any sequence', () => {
    // Drives updateHitRate with 200 different pseudo-random hit/miss sequences.
    // Under the self-referential formula (denominator = hitRate+missRate+1) the
    // ratio fields no longer equal count/total, so this would fail.
    for (let seed = 1; seed <= 200; seed++) {
      cache.clear();
      const s = internals(cache).stats;
      const rng = makeRng(seed);
      const length = 1 + Math.floor(rng() * 50);

      for (let i = 0; i < length; i++) {
        internals(cache).updateHitRate(rng() < 0.5);
      }

      const total = s.totalHits + s.totalMisses;
      // Each call increments exactly one counter.
      expect(total).toBe(length);
      // R1: rate derived from counts, exactly.
      expect(s.hitRate).toBeCloseTo(s.totalHits / total, 10);
      expect(s.missRate).toBeCloseTo(s.totalMisses / total, 10);
      // Partitions: rates are complementary and bounded.
      expect(s.hitRate + s.missRate).toBeCloseTo(1, 10);
      expect(s.hitRate).toBeGreaterThanOrEqual(0);
      expect(s.hitRate).toBeLessThanOrEqual(1);
      expect(s.missRate).toBeGreaterThanOrEqual(0);
      expect(s.missRate).toBeLessThanOrEqual(1);
    }
  });

  it('all-miss sequence reports hitRate 0, all-hit sequence reports hitRate 1', () => {
    const s = internals(cache).stats;

    for (let i = 0; i < 25; i++) internals(cache).updateHitRate(false);
    expect(s.hitRate).toBe(0);
    expect(s.missRate).toBe(1);
    expect(s.totalMisses).toBe(25);
    expect(s.totalHits).toBe(0);

    cache.clear();
    const s2 = internals(cache).stats;
    for (let i = 0; i < 25; i++) internals(cache).updateHitRate(true);
    expect(s2.hitRate).toBe(1);
    expect(s2.missRate).toBe(0);
    expect(s2.totalHits).toBe(25);
  });
});

// ===========================================================================
// (R2) updatePerformanceScore count-derived denominator
// ===========================================================================

describe('IntelligentCache performance-score denominator invariant (R2)', () => {
  /**
   * Compute performanceScore with every component zeroed except preload
   * effectiveness, holding preloadHits fixed while varying request volume.
   * preloadEffectiveness = min(preloadHits / totalRequests * 2, 1) * 0.10.
   */
  function preloadOnlyScore(totalHits: number, totalMisses: number, preloadHits: number): number {
    const cache = new IntelligentCache();
    const s = internals(cache).stats;
    s.hitRate = 0;                         // hitRateScore   = 0
    s.missRate = 0;
    s.averageRetrievalTime = 30;           // speedScore     = 1 - 30/30 = 0
    s.memoryUsage = 50 * 1024 * 1024;      // memoryScore    = 1 - max/max = 0
    s.compressionRatio = 0;                // compressScore  = 0
    s.evictionCount = 1;                   // stabilityScore = 1 - 1/max(0,1) = 0
    s.totalHits = totalHits;
    s.totalMisses = totalMisses;
    s.preloadHits = preloadHits;

    internals(cache).updatePerformanceScore();
    return cache.getStats().performanceScore;
  }

  it('preload effectiveness scales DOWN with real request volume for fixed preloadHits', () => {
    // The buggy denominator (hitRate + missRate + 1 = 0 + 0 + 1 = 1) was
    // independent of request volume, so the score would be IDENTICAL across
    // these three cases. The count-derived denominator makes it decrease.
    const P = 4;
    const scoreTotal8 = preloadOnlyScore(4, 4, P);   // 4/(8)*2 = 1.0 (capped) -> 0.10
    const scoreTotal16 = preloadOnlyScore(8, 8, P);  // 4/16*2  = 0.5        -> 0.05
    const scoreTotal32 = preloadOnlyScore(16, 16, P); // 4/32*2 = 0.25       -> 0.025

    expect(scoreTotal8).toBeGreaterThan(scoreTotal16);
    expect(scoreTotal16).toBeGreaterThan(scoreTotal32);

    // Exact contract values.
    expect(scoreTotal16).toBeCloseTo(0.05, 5);
    expect(scoreTotal32).toBeCloseTo(0.025, 5);
  });

  it('zero preloadHits never contributes preload effectiveness, regardless of volume', () => {
    // preloadHits=0 => preloadEffectiveness=0 => performanceScore=0 when all
    // other components are zeroed. Holds for any request volume.
    expect(preloadOnlyScore(0, 100, 0)).toBe(0);
    expect(preloadOnlyScore(1000, 0, 0)).toBe(0);
  });
});

// ===========================================================================
// (I1) Content-matching invariant under key collision
// ===========================================================================

describe('IntelligentCache content-matching invariant under collision (I1)', () => {
  let cache: IntelligentCache;

  beforeEach(() => {
    cache = new IntelligentCache();
  });

  it('Aa and BB map to the same cache slot (collision premise)', () => {
    // Proves the invariant test below actually exercises the collision path:
    // generateCacheKey is hash*31+char (the Java string hash), so "Aa" and "BB"
    // both hash to 2112 with length 2.
    expect(internals(cache).generateCacheKey('Aa'))
      .toBe(internals(cache).generateCacheKey('BB'));
  });

  it('never returns a different content\'s data for any member of a collision family', async () => {
    // 4-char composites of the Aa/BB collision block all share hash and length:
    //   hash("AaAa") = hash("AaBB") = hash("BBAa") = hash("BBBB") = 2112*962
    // They collapse to a single slot, so only the last store() survives; every
    // other get() must be a null miss — never the survivor's data.
    const members = ['AaAa', 'AaBB', 'BBAa', 'BBBB'] as const;

    const keys = members.map(m => internals(cache).generateCacheKey(m));
    // Premise: all four collide into one slot.
    expect(new Set(keys).size).toBe(1);

    members.forEach((m, i) => {
      void cache.store(m, { who: m, index: i }, makeMetadata());
    });

    // Only the last-stored member (BBBB) is recoverable.
    const survivor = await cache.get('BBBB');
    expect(survivor).toEqual({ who: 'BBBB', index: 3 });

    // Every other member is a miss, never returns BBBB's data.
    for (const m of ['AaAa', 'AaBB', 'BBAa']) {
      expect(await cache.get(m)).toBeNull();
    }
  });

  it('returns the correct data for every distinct content across many entries', async () => {
    // General form of (I1): distinct contents never cross-return, at scale.
    // Each content carries unique data; get() must round-trip exactly.
    for (let i = 0; i < 60; i++) {
      await cache.store(`distinct-content-${i}`, { value: i, tag: `t${i}` }, makeMetadata());
    }
    for (let i = 0; i < 60; i++) {
      expect(await cache.get(`distinct-content-${i}`)).toEqual({ value: i, tag: `t${i}` });
    }
  });
});

// ===========================================================================
// (I2) store→get faithful round-trip (originalSize restoration)
// ===========================================================================

describe('IntelligentCache compression restoration invariant (I2)', () => {
  let cache: IntelligentCache;

  beforeEach(() => {
    cache = new IntelligentCache();
  });

  it('round-trips every payload exactly, whether or not it compressed', async () => {
    const payloads: Array<{ key: string; data: unknown }> = [
      { key: 'small', data: { v: 1 } },
      { key: 'primitive-num', data: 12345 },
      { key: 'primitive-str', data: 'a plain string' },
      { key: 'array', data: [1, 2, 3, 4, 5] },
      { key: 'nested', data: { a: { b: { c: [1, 2, 3] } } } },
      { key: 'compressible-a', data: { text: 'a'.repeat(2000) } },
      { key: 'compressible-x', data: { text: 'x'.repeat(5000) } },
      { key: 'compressible-braces', data: { deep: braceObject(300) } },
    ];

    let compressedCount = 0;
    for (const { key, data } of payloads) {
      await cache.store(key, data, makeMetadata());
      const entry = internals(cache).cache.get(internals(cache).generateCacheKey(key));
      if (entry?.compressed) compressedCount++;

      // Round-trip must restore the original value byte-for-byte.
      expect(await cache.get(key)).toEqual(data);
    }

    // The invariant is only meaningful if it actually exercised the compressed
    // path (the originalSize restoration fix). At least one payload compressed.
    expect(compressedCount).toBeGreaterThan(0);
  });

  it('compressed entry carries originalSize distinct from compressedSize', async () => {
    // Locks the field that the RLE fix added: without originalSize on the
    // entry, decompressData was handed compressedSize and the length guard
    // always short-circuited to JSON.parse of the still-encoded blob.
    await cache.store('big', { text: 'a'.repeat(5000) }, makeMetadata());
    const entry = internals(cache).cache.get(internals(cache).generateCacheKey('big'));

    expect(entry?.compressed).toBe(true);
    expect(entry?.originalSize).toBeGreaterThan(entry!.compressedSize);
    expect(entry!.originalSize).toBeGreaterThan(0);
  });
});

/** Build a deeply nested object whose JSON ends in a long run of '}' — compresses well. */
function braceObject(depth: number): unknown {
  let obj: Record<string, unknown> = { val: 1 };
  for (let i = 0; i < depth; i++) {
    obj = { a: obj };
  }
  return obj;
}
