/**
 * Registry-driven discovery sweep for ALL frozen-literal single-source rules.
 *
 * One test per rule from tests/guards/frozen-literal-rules.ts: sweeps the
 * rule's roots/files with the shared walk and fails naming the exact
 * `file:line: content` if any site re-freezes a constant that has a canonical
 * module. This is the extraction target of the round-4..7 per-family guard
 * tests: their hand-rolled ~120-line sweeps collapse to registry entries, and
 * every family now shares ONE walk, ONE comment-skip policy, and ONE failure
 * format — so the next frozen-constant family costs one entry, not a new
 * test file.
 *
 * Also guards the registry's own hygiene:
 *   - every rule sweeps at least one file (and honors minSweptFiles),
 *   - every exclusion carries a non-empty reason (undocumented exclusions
 *     are how guards rot),
 *   - roots- and files-mode are mutually exclusive (ambiguous rules are
 *     authoring bugs, not sweep results).
 *
 * Value pins, consumer-import pins, and behavioral pins for each family stay
 * in the per-family test files next door — this file owns ONLY the sweep.
 */

import { describe, it, expect } from '@jest/globals';
import { FROZEN_LITERAL_RULES } from './frozen-literal-rules';
import { sweepFrozenLiteralRule, sweptFileCount } from './freeze-guard';
import type { FrozenLiteralRule } from './freeze-guard';

describe('frozen-literal registry (shared discovery sweep)', () => {
  it('registry is non-empty and every rule id is unique', () => {
    expect(FROZEN_LITERAL_RULES.length).toBeGreaterThanOrEqual(7);
    const ids = FROZEN_LITERAL_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every rule is well-formed (roots XOR files, patterns, reasoned exclusions)', () => {
    for (const rule of FROZEN_LITERAL_RULES) {
      expect({
        id: rule.id,
        targetsExactlyOneMode: (rule.roots !== undefined) !== (rule.files !== undefined),
        hasPatterns: (rule.patterns?.length ?? 0) > 0,
      }).toEqual({ id: rule.id, targetsExactlyOneMode: true, hasPatterns: true });

      for (const [file, reason] of Object.entries(rule.exclude ?? {})) {
        // An exclusion without a reason is itself a defect — that is how a
        // guard silently stops guarding a reintroduced freeze site.
        expect({ rule: rule.id, file, reason }).toEqual({
          rule: rule.id,
          file,
          reason: expect.stringMatching(/\S/),
        });
      }
    }
  });

  it.each(FROZEN_LITERAL_RULES.map((r) => [r.id, r]))(
    'sweep: %s',
    (_id: string, rule: FrozenLiteralRule) => {
      const offenders = sweepFrozenLiteralRule(rule);
      expect(offenders).toEqual([]);

      // Sanity: the sweep actually traversed the module boundary. A walk that
      // silently matches nothing is a false all-green (the "delegates-to-X
      // whole-file regex = FALSE-PASS" class).
      const swept = sweptFileCount(rule);
      expect(swept).toBeGreaterThan(0);
      if (rule.minSweptFiles !== undefined) {
        expect(swept).toBeGreaterThanOrEqual(rule.minSweptFiles);
      }
    },
  );
});
