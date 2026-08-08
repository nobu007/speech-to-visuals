/**
 * Canonical cache-key builder for content-derived LLM cache keys.
 *
 * This is the single sanctioned CALLER-side keying pattern consumed by
 * `LLMService.execute({ cacheKey })` → `LLMCache.generateKey`, which hashes the
 * FULL input with sha256 before storage. The key MUST incorporate the ENTIRE
 * text — never a fixed-length prefix.
 *
 * Why this exists: prefix-truncated keys collapse two distinct inputs that share
 * a long common prefix onto one cache slot, so the second lookup returns the
 * first input's data. That defect class recurred at three layers before being
 * centralized here:
 *   - `GeminiAnalyzer.buildAnalyzerCacheKey`  (f6d5dc43: `text.slice(0,100)` → full text)
 *   - `LLMCache.generateKey` storage layer     (f172f017: `slice(0,2000)` → full hash)
 *   - `ContentAnalyzer` hand-rolled key        (this helper: `substring(0,100)` → full text)
 *
 * Each fix in isolation only proved the key BUILDER was injective; the defect
 * kept surviving one layer downstream because a different site re-truncated
 * before forwarding (see the "hash is a bucket selector NOT equality" /
 * "test-the-right-layer" lessons). Centralizing every analyzer's caller-side
 * key here means there is exactly ONE place that builds a content cache key, and
 * a structural guard (see `__tests__/cache-key-canon.test.ts`) forbids
 * re-inlining a truncating prefix at any call site — the same technique used to
 * consolidate the 2-D `distance` formula (089e92ad).
 *
 * sha256 streams over arbitrary length at negligible cost, so using the full
 * text carries no memory cost downstream; only the OUTPUT digest is ever
 * shortened (16 hex chars), never the INPUT.
 *
 * @param scope - Stable namespacing/versioning prefix
 *   (e.g. `"gemini-analyzer-v26"`, `"content-analyzer-v1"`). Bump the version
 *   segment when the analyzer's prompt or output schema changes so stale cached
 *   entries are invalidated.
 * @param text  - The full content the key is derived from. Never truncated here.
 * @returns A stable `${scope}:${text}` key. Downstream hashing makes its length
 *   irrelevant to storage cost.
 */
export function buildContentCacheKey(scope: string, text: string): string {
  return `${scope}:${text}`;
}
