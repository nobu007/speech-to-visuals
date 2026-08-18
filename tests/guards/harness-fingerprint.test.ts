/**
 * @jest-environment node
 */
/**
 * harness-fingerprint.test.ts — the fingerprint LEDGER (round 51, TC-004-F).
 *
 * Each migrated family test pins its own row enumeration via
 * describeSingleSource(..., { fingerprint }) — a generated it inside THAT
 * file. This ledger is the second, INDEPENDENT copy of the same
 * enumerations, extracted mechanically from the family test SOURCES (not by
 * importing them — a cross-test import would re-execute the family's corpus
 * loops inside this suite's fresh module registry, doubling the ~60s cost).
 *
 * The two-party ratchet mirrors the census doc-pin (architecture D9):
 *   - family test changes a row → its own fingerprint it goes RED until the
 *     literal is updated, and this ledger goes RED until the ledger copy is
 *     updated too — an unreviewed pin edit cannot pass CI;
 *   - a THIRD family adopts the harness → the adopter sweep below goes RED
 *     until the family registers here (onboarding cannot be skipped).
 *
 * Documented migration accounting (D6 — how the row expectations map onto
 * the retired per-it expectations; full detail in specs/guard-harness-fold-
 * census/architecture.md §D6):
 *   - grid-packing: 28 + 2132 + 220 + 850000×2 + 846001 + 240 + 4001 oracle
 *     expectations. The retired stamp-A its asserted only on mismatching
 *     cases; the rows assert Object.is on matching cases too (trivially
 *     green, keeps the count analytic). The retired aspect compose expect
 *     (canonical-vs-canonical, 221st) moved to Layer 2 as a handwritten it.
 *   - grid-packing anchor rows: 45 — the retired whole-file
 *     `src.match(/…/g)` counts are preserved as scope:'source', the retired
 *     `codeLines()` filters as scope:'code'.
 *   - default-node-extent: 249×4 + 120×2 + 200×2 oracle expectations; the
 *     retired it.each(249) × 4-expect fold became 4 rows; the retired
 *     maxima it skipped the height axis on EMPTY groups (both policies
 *     agree at -Infinity, now asserted on both axes for all 120 groups).
 *   - Timing (REQ-403): the round-51 note "baseline 131.2s → migrated
 *     59-63s" was a COLD-CACHE artifact (the warm pre-migration baseline is
 *     55-69s). Warm, round 51's first cut ran +32-55% OVER baseline (85-87s
 *     — the delta rows' tautological matching-case expect, ~850k no-ops);
 *     removing it (assert divergences only + the witness, i.e. the retired
 *     semantics; enumeration pins unchanged) re-measured over 3 alternating
 *     CPU-time pairs at -7.9% / +8.9% / -14.4% — inside the ±20% window
 *     (2026-08-18, TC-004-B01).
 *
 * STATIC-PIN LESSON (from the M3 corpus-shrink mutation, RED-verified):
 * interpolating `CORPUS.length` into a fingerprint literal makes the pin
 * track the shrink and the ratchet degenerates — both sides shrink
 * together and nothing fails. Every pin count below is a static literal,
 * and the block scan forbids `${` inside either family's fingerprint
 * array.
 */

import { describe, it, expect } from '@jest/globals';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, readSource } from '@tests/guards/freeze-guard';

/** The harness-adopting families and their test files (onboarding registry). */
const FAMILY_TESTS: Readonly<Record<string, string>> = {
  'grid-packing': 'tests/guards/grid-packing-single-source.test.ts',
  'default-node-extent': 'tests/guards/default-node-extent-single-source.test.ts',
};

/** A fingerprint pin line in a family test source:
 * `  'family:rowId:count',` — single-quoted, optional trailing comma. */
const PIN_LINE = /^\s*'([a-z][a-z0-9-]*:[^':\n]+:\d+)',?\s*$/;

/** Extract the `family:rowId:count` pin strings declared in a family test. */
function extractPinLines(file: string): string[] {
  return readSource(file)
    .split('\n')
    .flatMap((line) => {
      const m = PIN_LINE.exec(line);
      return m ? [m[1]] : [];
    });
}

/**
 * Extract `rowId:maxDelta-literal` pairs — one per delta-mode oracle row —
 * by chunking the source at each `oracleRow(` (everything from one call to
 * the next is that row's declaration, so the id and its maxDelta pair up).
 */
function extractDeltaBounds(file: string): string[] {
  return readSource(file)
    .split(/\boracleRow\(/)
    .slice(1)
    .flatMap((chunk) => {
      const id = /id:\s*'([^']+)'/.exec(chunk)?.[1];
      const delta = /maxDelta:\s*([^\s,}]+)/.exec(chunk)?.[1];
      return id !== undefined && delta !== undefined ? [`${id}:${delta}`] : [];
    });
}

describe('harness fingerprint ledger (TC-004-F)', () => {
  it('F01: grid-packing — the pins declared in source equal the ledger copy', () => {
    expect(extractPinLines(FAMILY_TESTS['grid-packing']).join('\n')).toBe(
      [
        'grid-packing:columns-verbatim:28',
        'grid-packing:rows-verbatim:2132',
        'grid-packing:aspect-verbatim:220',
        'grid-packing:stamp-b-object-is:850000',
        'grid-packing:stamp-matrix-object-is:850000',
        'grid-packing:stamp-a-canvas-delta:846001',
        'grid-packing:stamp-a-integer-exact:240',
        'grid-packing:stamp-a-fuzz-delta:4001',
        'grid-packing:utils-raw-columns-once:1',
        'grid-packing:utils-raw-rows-divisor-once:1',
        'grid-packing:utils-raw-stamp-b-once:1',
        'grid-packing:utils-aspect-composes-columns-once:1',
        'grid-packing:ezo-columns-delegates:1',
        'grid-packing:ezo-rows-delegates:1',
        'grid-packing:ezo-stamps-delegate:1',
        'grid-packing:ezo-no-raw-columns:1',
        'grid-packing:network-grid-delegates:1',
        'grid-packing:network-stamps-delegate:1',
        'grid-packing:network-no-raw-columns:1',
        'grid-packing:conceptmap-columns-delegates:1',
        'grid-packing:conceptmap-rows-delegates:1',
        'grid-packing:conceptmap-stamps-delegate:1',
        'grid-packing:optimizer-columns-delegates:1',
        'grid-packing:optimizer-rows-delegates:1',
        'grid-packing:optimizer-stamps-delegate:1',
        'grid-packing:optimizer-no-raw-columns:1',
        'grid-packing:fallback-columns-delegates:1',
        'grid-packing:fallback-rows-delegates:1',
        'grid-packing:fallback-stamps-delegate:1',
        'grid-packing:advanced-columns-delegates:1',
        'grid-packing:advanced-dead-rows-copy-retired:1',
        'grid-packing:advanced-fixed-pitch-stamp-stays:1',
        'grid-packing:gridsnap-columns-delegates:1',
        'grid-packing:gridsnap-span-stamp-stays:1',
        'grid-packing:flow-columns-delegates:1',
        'grid-packing:flow-no-raw-columns:1',
        'grid-packing:matrix-aspect-delegates:1',
        'grid-packing:matrix-rows-delegates:1',
        'grid-packing:matrix-stamps-delegate:1',
        'grid-packing:general-aspect-delegates:1',
        'grid-packing:general-rows-delegates:1',
        'grid-packing:general-stamps-delegate:1',
        'grid-packing:overlap-aspect-delegates:1',
        'grid-packing:overlap-rows-delegates:1',
        'grid-packing:overlap-snap-stamp-x-stays:1',
        'grid-packing:overlap-snap-stamp-y-stays:1',
        'grid-packing:ezo-no-raw-rows-divisor:1',
        'grid-packing:conceptmap-no-raw-rows-divisor:1',
        'grid-packing:optimizer-no-raw-rows-divisor:1',
        'grid-packing:fallback-no-raw-rows-divisor:1',
        'grid-packing:matrix-no-raw-rows-divisor:1',
        'grid-packing:general-no-raw-rows-divisor:1',
        'grid-packing:overlap-resolver-no-raw-rows-divisor:1',
      ].join('\n'),
    );
  });

  it('F01: default-node-extent — the pins declared in source equal the ledger copy', () => {
    expect(extractPinLines(FAMILY_TESTS['default-node-extent']).join('\n')).toBe(
      [
        'default-node-extent:pair-w-verbatim:249',
        'default-node-extent:pair-h-verbatim:249',
        'default-node-extent:inline-w-verbatim:249',
        'default-node-extent:inline-h-verbatim:249',
        'default-node-extent:cycle-maxima-w:120',
        'default-node-extent:cycle-maxima-h:120',
        'default-node-extent:scaled-extent-w:200',
        'default-node-extent:scaled-extent-h:200',
        'default-node-extent:node-dimensions-raw-pair-w-once:1',
        'default-node-extent:node-dimensions-raw-pair-h-once:1',
        'default-node-extent:node-dimensions-default-extent-export-once:1',
        'default-node-extent:dagre-pair-delegates:1',
        'default-node-extent:dagre-no-raw-pair-w:1',
        'default-node-extent:dagre-no-raw-pair-h:1',
        'default-node-extent:dagre-center-conversion-stays:1',
        'default-node-extent:selector-inline-delegates:1',
        'default-node-extent:selector-no-raw-pair-w:1',
        'default-node-extent:selector-no-raw-pair-h:1',
        'default-node-extent:strategy-graph-extent-delegates:1',
        'default-node-extent:strategy-graph-scaled-composes:1',
        'default-node-extent:strategy-graph-no-raw-pair-w:1',
        'default-node-extent:strategy-graph-retired-scaled-idiom-banned:1',
        'default-node-extent:comparison-stamp-delegates:1',
        'default-node-extent:comparison-no-raw-pair-w:1',
        'default-node-extent:comparison-no-raw-pair-h:1',
        'default-node-extent:general-stamp-delegates:1',
        'default-node-extent:general-no-raw-pair-w:1',
        'default-node-extent:general-no-raw-pair-h:1',
        'default-node-extent:flow-stamp-delegates:1',
        'default-node-extent:flow-no-raw-pair-w:1',
        'default-node-extent:flow-no-raw-pair-h:1',
        'default-node-extent:matrix-stamp-delegates:1',
        'default-node-extent:matrix-no-raw-pair-w:1',
        'default-node-extent:matrix-no-raw-pair-h:1',
        'default-node-extent:tree-stamp-delegates:1',
        'default-node-extent:tree-no-raw-pair-w:1',
        'default-node-extent:tree-no-raw-pair-h:1',
        'default-node-extent:flow-edge-reads-stay-w:1',
        'default-node-extent:flow-edge-reads-stay-h:1',
        'default-node-extent:tree-edge-reads-stay-w:1',
        'default-node-extent:tree-edge-reads-stay-h:1',
        'default-node-extent:cycle-stamps-delegate:1',
        'default-node-extent:cycle-maxima-delegate-w:1',
        'default-node-extent:cycle-maxima-delegate-h:1',
        'default-node-extent:cycle-no-raw-pair-w:1',
        'default-node-extent:cycle-no-raw-pair-h:1',
        'default-node-extent:network-stamp-delegates:1',
        'default-node-extent:network-no-raw-pair-w:1',
        'default-node-extent:network-no-raw-pair-h:1',
        'default-node-extent:mindmap-stamps-delegate:1',
        'default-node-extent:mindmap-no-raw-pair-w:1',
        'default-node-extent:mindmap-no-raw-pair-h:1',
        'default-node-extent:conceptmap-level-width-delegates:1',
        'default-node-extent:conceptmap-no-raw-pair-w:1',
        'default-node-extent:conceptmap-no-raw-pair-h:1',
        'default-node-extent:timeline-stamp-delegates:1',
        'default-node-extent:timeline-no-raw-pair-w:1',
        'default-node-extent:timeline-measured-reads-stay-w:1',
        'default-node-extent:timeline-measured-reads-stay-h:1',
        'default-node-extent:layout-utils-fallback-param-w-stays:1',
        'default-node-extent:layout-utils-fallback-param-h-stays:1',
        'default-node-extent:layout-utils-no-raw-pair-w:1',
      ].join('\n'),
    );
  });

  it('F02: the adopter sweep — every guards test calling describeSingleSource is registered here', () => {
    const guardDir = join(REPO_ROOT, 'tests', 'guards');
    const self = 'harness-fingerprint.test.ts';
    const harnessSelfTest = 'single-source-harness.test.ts'; // fixture describe, not a family
    const adopters = readdirSync(guardDir)
      .filter((f) => f.endsWith('.test.ts') && f !== self && f !== harnessSelfTest)
      .filter((f) => readSource(join('tests', 'guards', f)).includes('describeSingleSource('))
      .sort();
    expect(adopters).toEqual(
      Object.values(FAMILY_TESTS)
        .map((rel) => rel.replace('tests/guards/', ''))
        .sort(),
    );
  });

  it('F03: every pin count is a static literal — no `${` interpolation inside either fingerprint array (M3 lesson)', () => {
    for (const file of Object.values(FAMILY_TESTS)) {
      const src = readSource(file);
      const start = src.indexOf('FINGERPRINT = [');
      const end = src.indexOf("].join('\\n')");
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeGreaterThan(start);
      const block = src.slice(start, end);
      expect(block.includes('${')).toBe(false);
    }
  });

  it('F04: every delta bound (maxDelta) is pinned — relaxing ε flips this (TC-004-E01 ε mutation)', () => {
    // The generated delta its only prove |canonical − retired| ≤ ε; ε itself
    // is data, so relaxing it stays execution-GREEN (verified 2026-08-18:
    // 1e-12 → 1e-3 passed all 65 grid+ledger tests before this pin existed).
    // The ledger therefore pins each row's maxDelta LITERAL, extracted from
    // the family test source next to its row id — the same two-party
    // ratchet as F01 (relax in the row → RED here until this copy moves).
    expect(extractDeltaBounds(FAMILY_TESTS['grid-packing'])).toEqual([
      'stamp-a-canvas-delta:1e-12',
      'stamp-a-fuzz-delta:1e-9',
    ]);
    // default-node-extent has no delta rows — the empty pin is load-bearing:
    // adding one without registering it here is RED.
    expect(extractDeltaBounds(FAMILY_TESTS['default-node-extent'])).toEqual([]);
  });
});
