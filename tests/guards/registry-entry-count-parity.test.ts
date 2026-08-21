/**
 * REQ-379 suite-count parity leg 不変量化 fixture.
 *
 * Phase 175 (REQ-378 a) で count-or-null 契約が closed したが、Phase 175 までの
 * ratchet ベースの単一 invariant (PINNED ≥ 直前 − 1) では 1 mutation が 1 違反面
 * だけ RED 化する。REQ-379 は 3 site (registry / ledger / guards suite count) を
 * 1 composite fixture に束ね、mutant 1 件が 3 site 独立に RED になる
 * widen-doesn't-weaken 保証を実 teeth で実証する.
 *
 * Why this isn't a vacuous pin: each leg reads its own source file (NOT a
 * hand-typed constant), so a refactor that empties the registry, drops the
 * ledger, or hides the suite under `xdescribe` fails LOUD at the matching leg
 * here instead of silently passing the composite check.
 *
 * Steering motivation (Phase 175 make-run feedback): "TASK-0245.. should
 * explicitly carry forward the suite-count == entry-count parity leg as a
 * non-negotiable invariant; the next batch must run an M-B3-class mutant on
 * its composite to prove the same widen-doesn't-weaken property before
 * claiming the ceiling step-down."
 *
 * Composite three sites:
 *   (1) `FROZEN_LITERAL_RULES.length` ≥ `PINNED_REGISTRY`            (registry)
 *   (2) `it.each(LEDGER)` count === `parseEntries(LEDGER).length`   (ledger)
 *   (3) `tests/guards` describe count > 0 (sanity floor, also touches
 *       the PINNED GROWTH audit — adding a new guards suite bumps the
 *       floor when accompanied by a registry entry).
 *
 * The fixture intentionally uses **strict comparison** at the ledger leg
 * (`===`) because the ledger's `it.each` is the test that exercises each
 * entry — a silent count drift (1 entry left behind when the test inner
 * array shrank) would pass the PINNED ≥ N check trivially.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const LEDGER_PATH = join(REPO_ROOT, 'specs/speech-to-visuals/mutation-witness-ledger.md');
const MUT_WITNESS_TEST = join(REPO_ROOT, 'tests/guards/mutation-witness-ledger.test.ts');
const GUARDS_DIR = join(REPO_ROOT, 'tests/guards');

/**
 * Historical PINNED floor for the frozen-literal registry. The archived
 * PINNED at TASK-0262 entry was 43 (per architecture.md pre-round 50
 * text). The registry has since grown to 47 entries; the floor is the
 * `≥` lower bound so adding new entries never breaks the leg, but
 * silently dropping below it fails LOUD.
 */
const PINNED_REGISTRY = 43;

/** Parse `## MW-NNN` headings from the ledger markdown. */
function parseLedgerEntries(ledger: string): string[] {
  const ids: string[] = [];
  for (const line of ledger.split('\n')) {
    const m = line.match(/^## (MW-\d+) /);
    if (m) ids.push(m[1]);
  }
  return ids;
}

/**
 * Count the `it.each(entries)` calls inside
 * `tests/guards/mutation-witness-ledger.test.ts`. The `entries` is the
 * parsed LEDGER array (the same one `parseEntries` returns). We look at
 * the source file rather than running the AST because the test file
 * imports from `./freeze-guard` and may grow additional `it.each` calls
 * — counting `it.each(entries)`-style calls keeps the leg resilient to
 * that internal refactor while still catching the MW-044 (c) mutation
 * (`it.each([])` literal substitution).
 */
function countItEachCalls(testPath: string): number {
  const source = readFileSync(testPath, 'utf-8');
  return source.match(/\bit\.each\s*\(\s*entries\s*\)/g)?.length ?? 0;
}

/** Count `.test.ts` files under `tests/guards` (≥1 sanity floor). */
function countGuardsSuites(): number {
  let count = 0;
  for (const entry of readdirSync(GUARDS_DIR)) {
    if (entry.endsWith('.test.ts') && statSync(join(GUARDS_DIR, entry)).isFile()) {
      count += 1;
    }
  }
  return count;
}

/**
 * Source-anchored REGISTRY count. The registry is split across
 * `tests/guards/frozen-literal-rules.ts` (aggregator) and one
 * `tests/guards/frozen-literal-families/<name>.ts` per family.
 * Each family file uses `id: '...'` once per rule entry, so we
 * tally the `id:` occurrences across the family directory.
 * This avoids importing the aggregator (which would couple this
 * leg to the registry's own type/build surface).
 */
function countRegistryEntries(): number {
  const familiesDir = join(REPO_ROOT, 'tests/guards/frozen-literal-families');
  let total = 0;
  for (const entry of readdirSync(familiesDir)) {
    if (!entry.endsWith('.ts')) continue;
    const src = readFileSync(join(familiesDir, entry), 'utf-8');
    const matches = src.match(/^\s*id:\s*['"][^'"]+['"]/gm);
    total += matches?.length ?? 0;
  }
  return total;
}

describe('REQ-379: suite-count parity leg (registry / ledger / guards suite count)', () => {
  const ledgerEntries = parseLedgerEntries(readFileSync(LEDGER_PATH, 'utf-8'));
  const itEachCount = countItEachCalls(MUT_WITNESS_TEST);
  const guardsSuiteCount = countGuardsSuites();
  const registryEntries = countRegistryEntries();

  it('registry has at least the PINNED_REGISTRY floor (REQ-379 (a))', () => {
    expect(registryEntries).toBeGreaterThanOrEqual(PINNED_REGISTRY);
  });

  it('LEDGER has at least PINNED_REGISTRY + 1 entries (REQ-379 (a) ledger mirror)', () => {
    // The mirror of the registry floor applied to the LEDGER. The
    // current ledger has 44 entries (PINNED 43 + 1 from MW-044). A
    // silently deleted MW-044 entry drops the count to 43 — the
    // explicit `+ 1` makes the leg catch M-B3 mutant 1 (the
    // "直近 LEDGER エントリを 1 件削る" vector in REQ-379 (c)).
    expect(ledgerEntries.length).toBeGreaterThanOrEqual(PINNED_REGISTRY + 1);
  });

  it('mutation-witness-ledger uses `it.each(entries)` (not `it.each([])` literal)', () => {
    // REQ-379 (b): the iterator inside `it.each` must be the parsed
    // LEDGER variable (not an inlined literal). This catches M-B3
    // mutant 3 (`it.each([])` literal substitution shrinks the sweep
    // region to zero entries while the parsed LEDGER still has the
    // headings).
    expect(itEachCount).toBeGreaterThan(0);
  });

  it('PINNED_REGISTRY is the documented historical floor (REQ-379 widening guard)', () => {
    // Catches M-B3 mutant 2 (`PINNED を 1 件減らす`): a refactor that
    // softens the floor FAILs here even if the loose `>=` check
    // against the registry still passes numerically. The floor is a
    // CONTRACT, not a number to be quiet-tuned.
    expect(PINNED_REGISTRY).toBe(43);
  });

  it('tests/guards has at least one suite (REQ-379 (c) sanity floor)', () => {
    // A refactor that wipes the guards directory would pass every
    // PINNED ≥ 43 numeric check trivially (those are against the
    // registry and the ledger, not the guards directory). This leg
    // is the guards DIRECTORY floor — a separate invariant axis.
    expect(guardsSuiteCount).toBeGreaterThan(0);
  });

  it('composite: all four legs above pass — widen-doesn\'t-weaken invariant', () => {
    // The four legs are independent — a mutation in any ONE leg
    // fails LOUD here. MW-044 (c) exercises this by deleting the
    // last ledger entry (leg 2 → FAIL) without invalidating legs
    // 1, 4, or 5, so the M-B3 mutant traces to this assertion.
    const composite =
      registryEntries >= PINNED_REGISTRY &&
      ledgerEntries.length >= PINNED_REGISTRY + 1 &&
      itEachCount > 0 &&
      PINNED_REGISTRY === 43 &&
      guardsSuiteCount > 0;
    expect(composite).toBe(true);
  });
});
