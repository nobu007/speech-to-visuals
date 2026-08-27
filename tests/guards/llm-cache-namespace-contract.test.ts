/**
 * @jest-environment node
 */
/**
 * LLMCache namespace isolation contract — guard (INV-CACHE-001).
 *
 * `LLMCache.set/get` accept an optional `prefix` argument that is mixed into
 * the storage key (`${prefix}:${sha256(text).slice(0,16)}` per
 * src/analysis/llm-cache.ts:79-83). When two callers pass different prefixes,
 * their entries live under disjoint keyspaces even if the raw text collides —
 * a deliberate isolation primitive that lets the LLM service keep its
 * `unified-llm-service` namespace separate from any other consumer of the
 * same backing store.
 *
 * The unit legs on `CacheWarmupManager` (src/optimization/__tests__/
 * cache-warmup.test.ts) drive the warmup path through a mock that ignores
 * prefixes, so they cannot catch a caller that omits the prefix the LLM
 * service expects. Session 259 parked that bug as C1: cache-warmup.ts:228
 * (`this.cache.get(pattern.text)`) and :236 (`this.cache.set(pattern.text,
 * result)`) call without `prefix`, so the warmup data lands under keys no
 * llm-service.ts:264 lookup (`this.cache.get(cacheKey, 'unified-llm-service')`)
 * can ever resolve exactly. This guard pins the contract so any future
 * re-introduction of prefixless calls (or any silent change to the prefix
 * argument's role) fails the build at the cache primitive, not at the
 * downstream miss-rate report.
 *
 * Verified with the REAL `LLMCache` (semantic disabled so the semantic
 * fallback cannot accidentally rescue a mismatched prefix and make a broken
 * caller look green).
 */
import { describe, it, expect } from '@jest/globals';
import { LLMCache } from '../../src/analysis/llm-cache';

describe('LLMCache namespace isolation contract (INV-CACHE-001)', () => {
  // semanticEnabled:false pins the EXACT-match path — semantic fallback would
  // rescue mismatched prefixes by iterating all entries with similarity ≥ 0.80,
  // masking the C1 bug for callers that happen to write text the LLM service
  // later queries verbatim.
  const makeCache = () =>
    new LLMCache<unknown>({ maxSize: 50, ttlMinutes: 60, enableSemantic: false });

  it('round-trips a value when set and get use the same prefix', () => {
    const cache = makeCache();
    const payload = { tokens: 42, text: 'hello' };
    cache.set('hello', payload, 'unified-llm-service');

    expect(cache.get('hello', 'unified-llm-service')).toEqual(payload);
  });

  it('returns null when get is called with a prefix the setter did not use', () => {
    const cache = makeCache();
    cache.set('hello', { ok: true }, 'unified-llm-service');

    // Different prefix → disjoint keyspace → exact match miss (semantic off).
    expect(cache.get('hello', 'other-namespace')).toBeNull();
  });

  it('returns null when set is called without a prefix and get supplies one', () => {
    // This is the C1 bug shape: cache-warmup.ts:236 calls
    //   this.cache.set(pattern.text, result)
    // with no prefix argument, but the LLM service later calls
    //   this.cache.get(cacheKey, 'unified-llm-service')
    // with one. The two entries live under disjoint keyspaces and the read
    // misses exactly — even with the same raw text.
    const cache = makeCache();
    cache.set('warm-pattern', { warm: true }); // no prefix

    expect(cache.get('warm-pattern', 'unified-llm-service')).toBeNull();
  });

  it('returns null when set uses a prefix and get omits it (mirror of C1)', () => {
    // Mirror of the previous leg: writer prefixed, reader bare. Same keyspace
    // isolation — protects against the inverse regression where the LLM
    // service is ever changed to drop its prefix while a caller keeps one.
    const cache = makeCache();
    cache.set('warm-pattern', { warm: true }, 'unified-llm-service');

    expect(cache.get('warm-pattern')).toBeNull();
  });

  it('treats two distinct prefixes as fully disjoint keyspaces', () => {
    const cache = makeCache();
    cache.set('shared-text', { from: 'A' }, 'namespace-A');
    cache.set('shared-text', { from: 'B' }, 'namespace-B');

    expect(cache.get('shared-text', 'namespace-A')).toEqual({ from: 'A' });
    expect(cache.get('shared-text', 'namespace-B')).toEqual({ from: 'B' });
    expect(cache.get('shared-text')).toBeNull();
  });

  it('does not let a prefixless write be rescued by the semantic fallback', () => {
    // With semanticEnabled:false, the previous legs already show exact-match
    // isolation. This leg is the structural pin: even if a future refactor
    // re-enables semantic matching by default for new LLMCache<T>() callers,
    // a misprefixed write must STILL miss — because the semantic fallback
    // requires the originalText payload and skips entries with no prefix (the
    // `prefix && !cachedKey.startsWith(`${prefix}:`)` guard at
    // src/analysis/llm-cache.ts:168). Cache-warmup's prefixless writes would
    // still be invisible to a prefixed reader.
    const cache = new LLMCache<unknown>({
      maxSize: 50,
      ttlMinutes: 60,
      enableSemantic: true,
    });
    cache.set('warm-pattern', { warm: true }); // no prefix

    // Prefixed lookup against a prefixless, semantically-indexed entry: must
    // miss exactly because the semantic path's prefix gate (line 168) drops
    // every entry whose key doesn't start with the reader's prefix.
    expect(cache.get('warm-pattern', 'unified-llm-service')).toBeNull();
  });
});