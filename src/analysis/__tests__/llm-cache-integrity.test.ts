/**
 * LLMCache — content-matching invariant (prefix-truncation collision).
 *
 * LLMCache is the actual storage layer the GeminiAnalyzer forwards to:
 * LLMService.execute() calls `cache.get/set(cacheKey, ...)` where `cacheKey`
 * is the analyzer's full-text key `gemini-analyzer-v26:${text}`. generateKey
 * hashed that input AFTER slicing it to its first 2000 characters:
 *
 *   const normalized = text.trim().toLowerCase().slice(0, 2000);
 *   const hash = sha256(normalized).slice(0, 16);
 *
 * Because the analyzer's key prefix `gemini-analyzer-v26:` already consumes 21
 * characters, only the first ~1979 characters of the real transcript fed the
 * hash. Two distinct transcripts that share a long common prefix (a repeated
 * intro, shared boilerplate, the same long passage) but differ afterwards
 * collapsed to a SINGLE cache slot, so the second lookup returned the FIRST
 * transcript's analysis — silently producing the wrong diagram.
 *
 * This is the exact prefix-truncation class the GeminiAnalyzer's
 * buildAnalyzerCacheKey fix (f6d5dc43) was meant to eliminate. That function
 * uses the full text and its unit test proves key injectivity — but the test
 * only exercised buildAnalyzerCacheKey in isolation, never the downstream
 * LLMCache truncation, so the collision survived at the storage layer.
 *
 * Semantic similarity matching is a separate, intentional fuzzy layer and is
 * disabled here to isolate the EXACT-key contract: the exact key must be
 * content-distinguishing over the entire input, not a fixed-length prefix.
 */
import { LLMCache } from '../llm-cache';

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('LLMCache content-matching invariant (prefix-truncation collision)', () => {
  let cache: LLMCache<string>;

  beforeEach(() => {
    cache = new LLMCache<string>({ enableSemantic: false });
  });

  afterEach(() => {
    cache.destroy();
  });

  it('never returns a different content\'s data for inputs sharing a long common prefix', () => {
    // Two inputs identical for FAR more than the old 2000-char window, but
    // differing in the suffix. Before the fix both hashed to the same key, so
    // get(B) returned A's stored value. Each distinct content must resolve to
    // its own value (or a clean miss) — never a sibling's data.
    const prefix = 'shared-introduction-text-'.repeat(200); // ~5000 chars
    const textA = `${prefix}___UNIQUE_SUFFIX_A___`;
    const textB = `${prefix}___UNIQUE_SUFFIX_B___`;

    cache.set(textA, 'result-for-A');

    // B must NOT receive A's analysis.
    expect(cache.get(textB)).toBeNull();
    // A still round-trips to its own value.
    expect(cache.get(textA)).toBe('result-for-A');
  });

  it('distinguishes inputs whose difference lies entirely past the old truncation window', () => {
    // The analyzer key prefix is 21 chars, so the body's first ~1979 chars
    // were all that survived hashing. Place the distinguishing content well
    // past char 2000 of the full key and confirm the two stay distinct.
    const shared = 'x'.repeat(3000);
    const one = `${shared}__tail-one`;
    const two = `${shared}__tail-two`;

    cache.set(one, 'one');
    cache.set(two, 'two');

    expect(cache.get(one)).toBe('one');
    expect(cache.get(two)).toBe('two');
  });

  it('round-trips arbitrary-length inputs to their own value', () => {
    // The full-text key must still self-resolve at any length (the existing
    // 3000-char self-retrieval test only proved set→get for the SAME input;
    // this pairs it with a length past the old window to lock the fix).
    const longText = 'a'.repeat(6000);
    cache.set(longText, 'self-result');
    expect(cache.get(longText)).toBe('self-result');
  });

  it('is injective over many distinct texts sharing a long common prefix', () => {
    // Property form of the invariant: 100 inputs differing only past char 2500
    // must each map to a distinct entry — no two may cross-return. Under the
    // truncating key every one of these collapsed onto a single slot.
    const prefix = 'p'.repeat(2500);
    const seen = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const text = `${prefix}__unique_${i}__`;
      cache.set(text, `value-${i}`);
      seen.add(cache.get(text) as string);
    }

    // Every input recovered its own distinct value.
    expect(seen.size).toBe(100);
    for (let i = 0; i < 100; i++) {
      expect(cache.get(`${prefix}__unique_${i}__`)).toBe(`value-${i}`);
    }
  });
});
