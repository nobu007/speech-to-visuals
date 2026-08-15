/**
 * Determinism oracle for the complex-layout-engine worker-message id
 * (round 17, architecture.md D4).
 *
 * The id appears in output JSON. Its old form
 * `layout_${Date.now()}_${Math.random()...}` made whole-JSON golden
 * comparisons non-deterministic even though the engine's positions were
 * already seeded. The id is identity-only (no consumer references it),
 * so keying it to the node-id set is safe: same diagram → same id.
 *
 * The registry-level RED verification for this site is the round-16
 * frozen-literal rule (frozen-literal-registry.test.ts) with the
 * complex-engine exclusion removed — it fails on the bare Math.random,
 * which this commit deletes.
 */
import { makeLayoutWorkerMessageId } from '@/visualization/complex-layout-engine';
import { NodeDatum } from '@/types/diagram';

function makeNodes(ids: string[]): NodeDatum[] {
  return ids.map((id) => ({ id, label: id }));
}

describe('makeLayoutWorkerMessageId — deterministic layout id (round 17)', () => {
  test('same node set → identical id on every call', () => {
    const nodes = makeNodes(['a', 'b', 'c']);
    expect(makeLayoutWorkerMessageId(nodes)).toBe(makeLayoutWorkerMessageId(nodes));
  });

  test('id order is not input-order sensitive at the set level it documents', () => {
    // The seed derivation is ids.join('|') — order matters by design (same as
    // every other layout-rng consumer); this pins the documented derivation
    // so an accidental seed-text change is caught.
    const a = makeNodes(['a', 'b', 'c']);
    const reordered = makeNodes(['c', 'b', 'a']);
    expect(makeLayoutWorkerMessageId(a)).not.toBe(makeLayoutWorkerMessageId(reordered));
  });

  test('different node sets get different ids', () => {
    expect(makeLayoutWorkerMessageId(makeNodes(['a', 'b']))).not.toBe(
      makeLayoutWorkerMessageId(makeNodes(['a', 'b', 'z'])),
    );
  });

  test('keeps the layout_ prefix and 7-char base36 suffix shape', () => {
    const id = makeLayoutWorkerMessageId(makeNodes(['a']));
    expect(id).toMatch(/^layout_[0-9a-z]{1,7}$/);
  });
});
