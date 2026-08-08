/**
 * ContentAnalyzer cache key — injectivity + observable store round-trip.
 *
 * ContentAnalyzer previously built its LLM cache key as
 * `content-analyzer:${text.substring(0, 100)}` and forwarded it to LLMService,
 * which passes it to LLMCache.generateKey (sha256 over the FULL input). Because
 * the forwarded key was ALREADY truncated to 100 chars, the storage layer's
 * full-text hashing (fixed in f172f017) was defeated: two distinct texts sharing
 * a 100-char prefix produced the same key, so the second analyzeV2() returned the
 * first text's (wrong) diagram. This is the prefix-truncation class one layer UP
 * from the f172f017 storage-layer fix.
 *
 * Two locks:
 *  (P1) The canonical key builder is injective over inputs that share a long
 *       common prefix (pure-function property).
 *  (P2) The EXACT key ContentAnalyzer forwards, run through a REAL LLMCache (the
 *       observable store→get path the analyzer actually hits), never
 *       cross-returns. This tests the right layer — a key-BUILDER unit test
 *       proves nothing if a downstream site re-truncates, the f172f017 lesson.
 */
import { LLMCache } from '../llm-cache';
import { buildContentCacheKey } from '../cache-key';
import { CONTENT_ANALYZER_CACHE_VERSION } from '../content-analyzer';

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

/** The exact cacheKey ContentAnalyzer forwards to LLMService.execute(). */
function contentAnalyzerKey(text: string): string {
  return buildContentCacheKey(`content-analyzer-${CONTENT_ANALYZER_CACHE_VERSION}`, text);
}

/** The LLMService storage prefix passed alongside the key to LLMCache.get/set. */
const LLM_SERVICE_PREFIX = 'unified-llm-service';

describe('ContentAnalyzer cache key (buildContentCacheKey) — injectivity (P1)', () => {
  it('produces distinct keys for inputs sharing a 100-char prefix', () => {
    // Regression: the old key truncated to the first 100 chars, so two distinct
    // texts sharing a prefix collided and the second lookup returned the first.
    const prefix = 'A'.repeat(120);
    const keyA = contentAnalyzerKey(`${prefix} tail one`);
    const keyB = contentAnalyzerKey(`${prefix} tail two`);
    expect(keyA).not.toBe(keyB);
  });

  it('is stable for identical input', () => {
    expect(contentAnalyzerKey('same text')).toBe(contentAnalyzerKey('same text'));
  });

  it('incorporates the full text (never truncates)', () => {
    expect(contentAnalyzerKey('abcdefghij')).toContain('abcdefghij');
  });

  it('embeds the versioned content-analyzer scope', () => {
    expect(contentAnalyzerKey('x')).toContain(`content-analyzer-${CONTENT_ANALYZER_CACHE_VERSION}`);
  });

  it('is injective over many distinct texts sharing a long common prefix', () => {
    // Property form: 100 texts differing only past char 150 must each map to a
    // distinct key. The old text.substring(0,100) collapsed all of these.
    const prefix = 'Z'.repeat(150);
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const key = contentAnalyzerKey(`${prefix}__unique_suffix_${i}__`);
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe(100);
  });

  it('is injective over randomly generated distinct texts', () => {
    // General content-faithfulness lock: same key ⇒ same text.
    const seen = new Map<string, string>();
    let seed = 0x9e37 + 1;
    const rng = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    const alphabet = 'ABあ12 xy.、\nZq';
    for (let i = 0; i < 500; i++) {
      const len = 1 + Math.floor(rng() * 80);
      let text = '';
      for (let c = 0; c < len; c++) {
        text += alphabet[Math.floor(rng() * alphabet.length)];
      }
      const key = contentAnalyzerKey(text);
      if (seen.has(key)) {
        expect(seen.get(key)).toBe(text);
      } else {
        seen.set(key, text);
      }
    }
  });
});

describe('ContentAnalyzer key through a real LLMCache — no cross-return (P2)', () => {
  let cache: LLMCache<string>;

  beforeEach(() => {
    // Semantic OFF to isolate the EXACT-key contract (the bug was in the exact
    // path; semantic similarity is a separate intentional fuzzy layer).
    cache = new LLMCache<string>({ enableSemantic: false });
  });

  afterEach(() => {
    cache.destroy();
  });

  it('never returns a sibling text\'s data for inputs sharing a 100-char prefix', () => {
    const prefix = 'shared-introduction-text-'.repeat(8); // > 100 chars
    const textA = `${prefix}___UNIQUE_SUFFIX_A___`;
    const textB = `${prefix}___UNIQUE_SUFFIX_B___`;

    cache.set(contentAnalyzerKey(textA), 'diagram-for-A', LLM_SERVICE_PREFIX);

    // B must NOT receive A's diagram — only a clean miss.
    expect(cache.get(contentAnalyzerKey(textB), LLM_SERVICE_PREFIX)).toBeNull();
    // A still round-trips to its own value.
    expect(cache.get(contentAnalyzerKey(textA), LLM_SERVICE_PREFIX)).toBe('diagram-for-A');
  });

  it('distinguishes inputs whose difference lies entirely past the old 100-char window', () => {
    const shared = 'x'.repeat(300);
    const one = `${shared}__tail-one`;
    const two = `${shared}__tail-two`;

    cache.set(contentAnalyzerKey(one), 'one', LLM_SERVICE_PREFIX);
    cache.set(contentAnalyzerKey(two), 'two', LLM_SERVICE_PREFIX);

    expect(cache.get(contentAnalyzerKey(one), LLM_SERVICE_PREFIX)).toBe('one');
    expect(cache.get(contentAnalyzerKey(two), LLM_SERVICE_PREFIX)).toBe('two');
  });

  it('every prefix-sharing input recovers its own value (injective round-trip)', () => {
    const prefix = 'p'.repeat(120);
    for (let i = 0; i < 50; i++) {
      cache.set(contentAnalyzerKey(`${prefix}__unique_${i}__`), `diagram-${i}`, LLM_SERVICE_PREFIX);
    }
    for (let i = 0; i < 50; i++) {
      expect(cache.get(contentAnalyzerKey(`${prefix}__unique_${i}__`), LLM_SERVICE_PREFIX)).toBe(`diagram-${i}`);
    }
  });
});
