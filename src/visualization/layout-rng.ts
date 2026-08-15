/**
 * Deterministic layout RNG — SINGLE SOURCE (round 16).
 *
 * Every stochastic step in the layout engines (initial-placement jitter,
 * aesthetic candidate perturbation) MUST draw from a seeded PRNG so the same
 * diagram produces the same rendered output on every run. Bare `Math.random()`
 * in a layout path silently makes video frames and golden-output comparisons
 * irreproducible — this bit the complex-layout engine before (fixed by seeding
 * there) and survived at three jitter sites in the zero-overlap engine and the
 * network strategy until the layout-outcome oracle test caught the run-to-run
 * position drift.
 *
 * The freeze-guard sweep ("no `Math.random(` in src/visualization outside this
 * module") lives in tests/guards/frozen-literal-rules.ts.
 */

/** FNV-1a-style string hash — stable across runs and platforms. */
export function seedFromString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 PRNG — tiny, deterministic, adequate for layout jitter. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build a PRNG keyed by the node set: the same diagram (same node ids, same
 * order) always yields the same jitter sequence.
 */
export function createLayoutRng(seedText: string): () => number {
  return mulberry32(seedFromString(seedText));
}
