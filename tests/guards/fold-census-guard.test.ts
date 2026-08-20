/**
 * @jest-environment node
 */
/**
 * fold-census-guard.test.ts — the census ratchet (round 51, TC-005-xx).
 *
 * Ties THREE artifacts together so the fold series' convergence is machine-
 * decidable (REQ-005 / 103 / 201-202 / 404, architecture D7/D9/D11):
 *
 *   engine measurement  ==  data pin (CensusFamily.pin)
 *                      ==  doc marker (<!-- census-pin:C1:sites=…:files=… -->
 *                          in the requirements census table)
 *
 * The ratchet is toBe — a site count that moves in EITHER direction is RED:
 *   - INCREASE: someone re-inlined a family shape → REQ-202 demands the
 *     census table be re-baselined in the same change, deliberately;
 *   - DECREASE: someone folded/removed sites (or the walk broke) → the pin
 *     must be lowered in the open, never silently (EDGE-102: a family
 *     whose sites hit 0 is retired by DELETING its row, which flips the
 *     family-id enumeration pin).
 *
 * Plus the sanity floors: the walk must actually sweep production src/
 * (sweptFiles ≥ 300 — a walk regression sweeping one subtree would
 * under-count every family GREEN-ly, the silent-hang class of failure),
 * and the convergence status itself is pinned (valueNeutralCandidates=[]
 * is the REQ-201 terminal state).
 */

import { describe, it, expect } from '@jest/globals';
import { readSource } from '@tests/guards/freeze-guard';
import {
  CENSUS_FAMILIES,
  FOLD_SERIES_STATUS,
  CENSUS_DOC,
  buildCensusSnapshot,
  parseCensusPinMarkers,
} from '@tests/guards/fold-census-families';

const SNAPSHOT = buildCensusSnapshot();

describe('fold census — snapshot vs data pin (TC-005-01, REQ-202 ratchet)', () => {
  it.each(CENSUS_FAMILIES.map((fam) => [fam.id, fam] as const))(
    '%s — engine sites/files equal the pinned counts (both directions RED)',
    (_id, fam) => {
      const measured = SNAPSHOT.family[fam.id];
      expect(measured).toBeDefined();
      expect(measured.sites).toBe(fam.pin.sites);
      expect(measured.files).toBe(fam.pin.files);
    },
  );

  it('every family id is enumerated — silent delete flips this (EDGE-102)', () => {
    expect(CENSUS_FAMILIES.map((fam) => fam.id)).toEqual(['C1', 'C2', 'C3', 'C4', 'C5']);
  });

  it('the walk swept production src/ — a broken walk under-counts GREEN-ly otherwise (EDGE-002)', () => {
    // 331 files at the 2026-08-18 baseline; 300 leaves room for refactors
    // while catching a subtree-only walk.
    expect(SNAPSHOT.sweptFiles).toBeGreaterThanOrEqual(300);
  });
});

describe('fold census — doc-pin 3-way (TC-005-02, D9)', () => {
  it('requirements census markers == data pins == engine measurements', () => {
    const doc = readSource(CENSUS_DOC);
    const markers = parseCensusPinMarkers(doc);
    // marker set == family id set (a family without a marker, or a stale
    // marker for a deleted family, is RED)
    expect([...markers.keys()].sort()).toEqual(CENSUS_FAMILIES.map((fam) => fam.id).sort());
    for (const fam of CENSUS_FAMILIES) {
      const marker = markers.get(fam.id);
      if (marker === undefined) {
        throw new Error(`census marker for family ${fam.id} missing from ${CENSUS_DOC}`);
      }
      // doc == data pin…
      expect(marker.sites).toBe(fam.pin.sites);
      expect(marker.files).toBe(fam.pin.files);
      // …and data pin == engine measurement (ties the doc to the walk)
      expect(SNAPSHOT.family[fam.id].sites).toBe(marker.sites);
      expect(SNAPSHOT.family[fam.id].files).toBe(marker.files);
    }
  });
});

describe('fold census — convergence status (TC-005-03, REQ-201)', () => {
  it('the fold series is CONVERGED for value-neutral work — pinned, not implied', () => {
    expect(FOLD_SERIES_STATUS.converged).toBe(true);
    // the terminal state: reopening for a value-neutral family means
    // editing this pin deliberately
    expect(FOLD_SERIES_STATUS.valueNeutralCandidates).toEqual([]);
    expect(FOLD_SERIES_STATUS.lastRound).toBe(50);
    expect(FOLD_SERIES_STATUS.lastVerified).toBe('2026-08-18');
  });
});
