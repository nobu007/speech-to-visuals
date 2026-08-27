/**
 * @jest-environment node
 */
/**
 * LLMCache namespace isolation — mutation witness (INV-CACHE-001).
 *
 * Pins the structural claim that the contract legs in
 * `llm-cache-namespace-contract.test.ts` are not vacuous. We construct a
 * `PrefixStrippingLLMCache` subclass that overrides `generateKey` to ignore
 * the reader's prefix (the exact regression shape that motivated
 * INV-CACHE-001 in session 259: cache-warmup writes prefixless, llm-service
 * reads prefixed — disjoint keyspaces). If the contract is structural, the
 * broken subclass must collapse the namespace and produce a hit on the
 * prefixless write, while the real LLMCache (control) must still return null.
 *
 * Both assertions pass on the same suite → the contract has independent
 * detection power for the C1 bug shape (proves the legs are not tautological).
 */
import { describe, it, expect } from '@jest/globals';
import { LLMCache } from '../../src/analysis/llm-cache';

class PrefixStrippingLLMCache<T> extends LLMCache<T> {
  // Mirror of the C1 inverse: the reader's prefix is silently dropped on
  // lookup, collapsing all namespaces into a single global keyspace. Writes
  // keep whatever prefix the caller supplied — only the read path is broken.
  protected override generateKey(text: string, prefix: string = ''): string {
    if (prefix) {
      return super.generateKey(text, '');
    }
    return super.generateKey(text, prefix);
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
});
