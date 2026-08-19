/**
 * Undefined-safe edge-endpoint lookup (Phase 141 — non-null assertion
 * eradication in the visualization tree).
 *
 * `LayoutEdge.source`/`target` are OPTIONAL (`string | undefined`), so the
 * historical idiom `nodeMap.get(edge.source!)` lied to the type checker: at
 * runtime an undefined endpoint flows into `Map.get(undefined)`, which
 * returns `undefined`, and every consumer's existing `if (!source …)`
 * guard absorbs it. The `!` only suppressed the diagnostic — it proved
 * nothing (the AI Hub steering on 02fa054a: an assertion that silences the
 * checker is not a safety proof).
 *
 * This helper is the typed form of that runtime behavior: an undefined key
 * resolves to `undefined` — exactly what `Map.get(undefined)` returned — so
 * consumers keep their existing absent-endpoint handling unchanged.
 *
 * Consumers (rounds 34/43 kept their delegation equality guards green
 * through this rewrite): edge-repointing.ts, layout/edge-crossings.ts,
 * SimulatedAnnealingStrategy.ts, ProgressiveForceStrategy.ts.
 */

/**
 * Look up `key` in `nodeMap`, treating an undefined key as an absent entry.
 *
 * ```ts
 * const source = lookupEndpoint(nodeMap, edge.source); // T | undefined
 * ```
 */
export function lookupEndpoint<T>(
  nodeMap: ReadonlyMap<string, T>,
  key: string | undefined,
): T | undefined {
  return key !== undefined ? nodeMap.get(key) : undefined;
}
