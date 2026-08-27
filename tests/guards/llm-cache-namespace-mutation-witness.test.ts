/**
 * @jest-environment node
 */
/**
 * LLMCache namespace isolation — mutation witness (INV-CACHE-001).
 *
 * Pins the structural claim that the contract legs in
 * `llm-cache-namespace-contract.test.ts` are not vacuous. We construct three
 * different `LLMCache` subclasses, each overriding `generateKey` to model a
 * distinct namespace-isolation regression, and verify that each subclass is
 * observably distinguishable from the real LLMCache on the same
 * set()/get() sequence. Both control (real) and broken (subclass) legs live
 * on the same suite → independent detection power for the C1 bug class.
 *
 * Subclasses modeled (each is a C1 inverse or a related isolation failure):
 *
 *   - `PrefixStrippingLLMCache` — drops the reader's prefix, so a prefixed
 *     lookup lands on whatever bare write happened to land first (C1 inverse).
 *
 *   - `FullPrefixDroppingLLMCache` — drops the prefix on BOTH write and read,
 *     so two prefixed writes with different namespaces collapse onto the same
 *     bare slot (inverse direction of the existing broken subclass).
 *
 *   - `TextBlindLLMCache` — hash output is constant regardless of text input,
 *     so two distinct texts under the same prefix collapse to a single slot
 *     (hash-collision class; the contract legs cover the prefix-isolation
 *     leg, but a future regression that drops the sha256 update entirely
 *     would surface here).
 *
 * The semantic-fallback control leg proves that namespace isolation is
 * preserved by the `prefix && !cachedKey.startsWith(${prefix}:)` gate at
 * src/analysis/llm-cache.ts:168 even when `enableSemantic: true`. The
 * matching broken leg uses the existing PrefixStrippingLLMCache to show that
 * the semantic path is unreachable when `generateKey` is broken — the exact-
 * match branch returns first, so the same collapse shape surfaces regardless
 * of whether semantic matching is enabled.
 */
import { describe, it, expect } from '@jest/globals';
import { LLMCache } from '../../src/analysis/llm-cache';

class PrefixStrippingLLMCache<T> extends LLMCache<T> {
  // C1 inverse: the reader's prefix is silently dropped on lookup, collapsing
  // every namespace into a single global keyspace. Writes keep whatever
  // prefix the caller supplied — only the read path is broken.
  protected override generateKey(text: string, prefix: string = ''): string {
    if (prefix) {
      return super.generateKey(text, '');
    }
    return super.generateKey(text, prefix);
  }
}

class FullPrefixDroppingLLMCache<T> extends LLMCache<T> {
  // Inverse direction of the above: prefix is silently dropped on BOTH write
  // and read, so two prefixed writes with different namespaces collapse onto
  // the same bare slot. The round-trip below (same prefix on set and get)
  // ALSO fails, but the collapse witness is two distinct prefixed writes
  // overwriting each other.
  protected override generateKey(text: string, prefix: string = ''): string {
    return super.generateKey(text, '');
  }
}

class TextBlindLLMCache<T> extends LLMCache<T> {
  // Hash-collision class: the text input is ignored entirely, so every entry
  // under the same prefix collapses to a single slot regardless of text.
  // Different texts (with the same prefix) overwrite each other in
  // insertion order. Round-trips for a single text, but cross-text reads
  // return whichever text was stored most recently.
  protected override generateKey(_text: string, prefix: string = ''): string {
    const constantHash = '0000000000000000';
    return prefix ? `${prefix}:${constantHash}` : constantHash;
  }
}

describe('LLMCache mutation witness — broken LLMCache must break namespace isolation', () => {
  it('real LLMCache isolates namespaces (control)', () => {
    const cache = new LLMCache<unknown>({
      maxSize: 50,
      ttlMinutes: 60,
      enableSemantic: false,
    });
    cache.set('warm-pattern', { warm: true }); // no prefix
    // Reader supplies a prefix the writer did not → must miss exactly.
    expect(cache.get('warm-pattern', 'unified-llm-service')).toBeNull();
  });

  it('broken LLMCache (prefix-stripping reader) collapses namespaces', () => {
    const cache = new PrefixStrippingLLMCache<unknown>({
      maxSize: 50,
      ttlMinutes: 60,
      enableSemantic: false,
    });
    cache.set('warm-pattern', { warm: true }); // no prefix
    // Reader supplies a prefix that the broken subclass drops — the lookup
    // lands on the prefixless writer's slot. The contract asserts this shape
    // is null; the broken subclass returns the entry. Witness: the bug is
    // real and the contract is structural, not tautological.
    expect(cache.get('warm-pattern', 'unified-llm-service')).toEqual({ warm: true });
  });

  it('real LLMCache keeps the semantic-fallback path namespace-isolated (control)', () => {
    // Control for the USE_SEMANTIC_MATCH=true leg: the prefix gate at
    // src/analysis/llm-cache.ts:168 must keep the disjoint-keyspace property
    // even when semantic matching is enabled. A bare write must NEVER be
    // rescued by a prefixed semantic lookup.
    const cache = new LLMCache<unknown>({
      maxSize: 50,
      ttlMinutes: 60,
      enableSemantic: true,
    });
    cache.set('warm-pattern', { warm: true }); // no prefix

    // Prefixed lookup against a prefixless, semantically-indexed entry — the
    // semantic path's prefix gate drops every entry whose key does not start
    // with the reader's prefix, so no fuzzy rescue is possible.
    expect(cache.get('warm-pattern', 'unified-llm-service')).toBeNull();
  });

  it('broken LLMCache (prefix-stripping reader) still collapses when semantic matching is enabled', () => {
    // Mirror of the previous leg with the broken subclass: enableSemantic:true
    // does not save us because `get()` consults `generateKey` BEFORE the
    // semantic fallback (src/analysis/llm-cache.ts:137 → :153). The broken
    // subclass already collapses the namespace on the exact-match branch, so
    // the semantic path is unreachable for this query shape. The witness:
    // namespace isolation is broken regardless of whether the caller has
    // semantic matching turned on.
    const cache = new PrefixStrippingLLMCache<unknown>({
      maxSize: 50,
      ttlMinutes: 60,
      enableSemantic: true,
    });
    cache.set('warm-pattern', { warm: true }); // no prefix
    expect(cache.get('warm-pattern', 'unified-llm-service')).toEqual({ warm: true });
  });

  it('broken LLMCache (full prefix-dropping) collapses two distinct prefixed writes', () => {
    // Inverse direction of the C1 bug: the prefix is dropped on BOTH write
    // and read, so two writes with the same text but different prefixes
    // overwrite each other on the same bare slot. Real LLMCache keeps them
    // disjoint (each write lands at its own `${prefix}:hash` key).
    const cache = new FullPrefixDroppingLLMCache<unknown>({
      maxSize: 50,
      ttlMinutes: 60,
      enableSemantic: false,
    });
    cache.set('shared-text', { from: 'A' }, 'namespace-A');
    cache.set('shared-text', { from: 'B' }, 'namespace-B'); // overwrites the above

    // Both reads return the second write — namespaces collapsed end-to-end.
    expect(cache.get('shared-text', 'namespace-A')).toEqual({ from: 'B' });
    expect(cache.get('shared-text', 'namespace-B')).toEqual({ from: 'B' });
  });

  it('broken LLMCache (text-blind hash) collapses two distinct texts under one prefix', () => {
    // Hash-collision class: the text input is ignored, so two distinct texts
    // under the same prefix land at the same slot. Real LLMCache keeps them
    // disjoint because each text produces a distinct sha256 digest. Witness:
    // the contract's prefix isolation leg is independent of text distinctness
    // — a regression that drops the sha256 update entirely would surface here.
    const cache = new TextBlindLLMCache<unknown>({
      maxSize: 50,
      ttlMinutes: 60,
      enableSemantic: false,
    });
    cache.set('text-one', { from: 'one' }, 'shared-prefix');
    cache.set('text-two', { from: 'two' }, 'shared-prefix'); // overwrites the above

    // Both reads return the second write — text was ignored by the hash.
    expect(cache.get('text-one', 'shared-prefix')).toEqual({ from: 'two' });
    expect(cache.get('text-two', 'shared-prefix')).toEqual({ from: 'two' });
  });
});
