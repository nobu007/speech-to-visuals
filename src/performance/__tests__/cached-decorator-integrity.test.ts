/**
 * @jest-environment node
 */
/**
 * cached() decorator — no cross-return for prefix-sharing args.
 *
 * The `cached` decorator's default key generator built
 * `${propertyName}_${JSON.stringify(args).slice(0, 100)}`. Two distinct arg-sets
 * whose serialized form shared a 100-char prefix produced the SAME key, and
 * because IntelligentCache.get's sourceContent guard compared the two truncated
 * strings, it passed — returning the first call's result for the second. That is
 * the prefix-truncation class again: a content-equality guard over a
 * pre-truncated value proves nothing (the f172f017 "test-the-right-layer"
 * lesson). The fix drops the truncation so generateCacheKey hashes the full
 * serialized args and the sourceContent guard compares full content.
 *
 * `@cached()` decorator syntax is unavailable (experimentalDecorators off), so
 * the decorator is applied manually via its descriptor form. The decisive
 * assertion is `computeCalls`: under the bug, the second call hits the cache and
 * the underlying method runs ONCE (returning the first call's value); after the
 * fix it runs for each distinct arg-set.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { cached, globalCache } from '@/performance/intelligent-cache';

/** Apply the decorator without `@cached()` syntax (experimentalDecorators is off). */
function decorate<T extends (...args: never[]) => unknown>(method: T): (...args: unknown[]) => Promise<unknown> {
  const descriptor: PropertyDescriptor = { value: method, writable: true, configurable: true };
  cached()(Object.create(null), 'compute', descriptor);
  return descriptor.value as (...args: unknown[]) => Promise<unknown>;
}

describe('cached() decorator — default key does not truncate args', () => {
  beforeEach(() => {
    globalCache.clear();
  });

  it('does not return a sibling arg-set\'s result for inputs sharing a 100-char JSON prefix', async () => {
    let computeCalls = 0;
    const compute = async (n: number, label: string): Promise<string> => {
      computeCalls++;
      return `${label}#${n}`;
    };
    const wrapped = decorate(compute);

    // Both JSON forms start `[5,"111...111` (well over 100 chars) and diverge
    // only in the last char, so the old slice(0,100) collapsed them to one key.
    const prefix = '1'.repeat(200);
    const resA = await wrapped(5, `${prefix}a`);
    const resB = await wrapped(5, `${prefix}b`);

    // Each distinct arg-set must resolve to its own result — never a sibling's.
    expect(resA).toBe(`${prefix}a#5`);
    expect(resB).toBe(`${prefix}b#5`);
    // Decisive: the method ran for BOTH (no cache cross-return). Under the bug,
    // the second call hit the cache and computeCalls stayed at 1.
    expect(computeCalls).toBe(2);
  });

  it('still caches genuinely identical calls (idempotency preserved)', async () => {
    let computeCalls = 0;
    const compute = async (n: number, label: string): Promise<string> => {
      computeCalls++;
      return `${label}#${n}`;
    };
    const wrapped = decorate(compute);

    const prefix = '1'.repeat(200);
    const first = await wrapped(5, `${prefix}a`);
    const second = await wrapped(5, `${prefix}a`);

    expect(first).toBe(second);
    // Identical args hit the cache: the method runs exactly once.
    expect(computeCalls).toBe(1);
  });

  it('every prefix-sharing arg-set recovers its own distinct result', async () => {
    let computeCalls = 0;
    const compute = async (n: number, label: string): Promise<string> => {
      computeCalls++;
      return `${label}#${n}`;
    };
    const wrapped = decorate(compute);

    // 40 arg-sets sharing a long common JSON prefix but differing in the suffix.
    const prefix = '9'.repeat(150);
    const results = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const label = `${prefix}${i}`;
      const res = await wrapped(7, label);
      expect(res).toBe(`${label}#7`);
      results.add(res);
    }
    // Every arg-set produced a distinct result — no two cross-returned.
    expect(results.size).toBe(40);
    // The method ran for every distinct arg-set (no cross-return via cache).
    expect(computeCalls).toBe(40);
  });

  it('a custom keyGenerator still takes precedence over the default', async () => {
    let computeCalls = 0;
    const compute = async (a: number, b: number): Promise<number> => {
      computeCalls++;
      return a + b;
    };
    // Custom generator: key off only the first arg.
    const descriptor: PropertyDescriptor = { value: compute, writable: true, configurable: true };
    cached((args) => `by-first_${args[0]}`)(Object.create(null), 'sum', descriptor);
    const wrapped = descriptor.value as (...args: unknown[]) => Promise<number>;

    const r1 = await wrapped(5, 100);
    const r2 = await wrapped(5, 200);

    // Custom key collides intentionally (same first arg) → second hits cache.
    expect(r1).toBe(105);
    expect(r2).toBe(105); // cached value from the first call
    expect(computeCalls).toBe(1);
  });
});
