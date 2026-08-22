/**
 * Census-artifact three-way match — the promoted common acceptance condition
 * for fold/census-type REQs (REQ-395 / Phase 193).
 *
 * make-run steering: a fold task once CLOSED by declaration while the disk
 * inventory disagreed, and the spec-claim ↔ measured-inventory gap sat
 * undetected until a later audit. The directive: promote the three-way
 * consistency check — composite pin count × roster count × disk file count —
 * to a COMMON acceptance condition for fold-type tasks, so a declaration-only
 * close is mechanically RED.
 *
 * This repo's census-guard family already ties two of the three artifacts per
 * guard (roster ↔ live tree via each census's completeness/stale-row tests,
 * and the original fold census ties doc marker ↔ data pin ↔ engine via
 * TC-005-02). What NOTHING tied was the THIRD side: the roster COUNT the
 * requirements.md prose declares vs the roster the shipped guard actually
 * holds. This guard's first run over the REQ-391..394 family found two live
 * drifts shipped in the guards' own creation commits:
 *
 *   - REQ-391 declared `ALLOWED 38 key`; the shipped guard holds 37.
 *   - REQ-392 declared `ROSTER 32 row (LIVE 27 ...)`; the shipped guard holds
 *     34 rows (LIVE 29) — both off by more than the same commit's own census
 *     could have caught, because no test ever compared the prose number to
 *     the roster.
 *
 * Both are corrected in the same change as this guard (see the REQ-395
 * entry), and from now on every census-type REQ must, IN THE SAME COMMIT:
 * ship the guard roster, declare its counts in requirements.md, and add a
 * THREE_WAY row here — the phrase below is BUILT FROM THE MEASURED roster,
 * so any roster edit without a spec edit (or a spec number with no roster)
 * is RED in both directions.
 */

import { describe, it, expect } from '@jest/globals';
import { readSource } from './freeze-guard';
import {
  CENSUS_FAMILIES,
  CENSUS_DOC,
  parseCensusPinMarkers,
} from './fold-census-families';

const REQUIREMENTS = 'specs/speech-to-visuals/requirements.md';

/** A phrase the requirements prose must contain, built from a MEASURED count. */
interface PhraseSpec {
  /** the `const <BLOCK>` roster block in the guard file to measure. */
  block: string;
  /** phrase embedding the measured count — its absence in the spec is RED. */
  build: (measured: number) => string;
}

interface ThreeWayRow {
  req: string;
  guard: string;
  phrases: PhraseSpec[];
  /** verdict sub-counts (producer census) measured inside the named block. */
  verdictBlock?: string;
  verdictPhrases?: (v: Record<string, number>) => string[];
}

/**
 * The census-guard family this promotion covers. The fold census itself is
 * covered by the marker test below (its three-way predates this guard and
 * stays authoritative via TC-005-02 — re-asserted here so the promoted
 * condition spans the whole fold/census family).
 */
const THREE_WAY: ThreeWayRow[] = [
  {
    req: 'REQ-391',
    guard: 'tests/guards/measurement-fixture-census.test.ts',
    phrases: [
      { block: 'ALLOWED', build: (n) => `ALLOWED ${n} key` },
      { block: 'ERADICATED', build: (n) => `ERADICATED ${n} key` },
    ],
  },
  {
    req: 'REQ-392',
    guard: 'tests/guards/optional-metric-producer-census.test.ts',
    phrases: [{ block: 'ROSTER', build: (n) => `ROSTER ${n} row` }],
    verdictBlock: 'ROSTER',
    verdictPhrases: (v) => [
      `LIVE ${v.LIVE} / INPUT-CONTRACT ${v['INPUT-CONTRACT']} / ERADICATED ${v.ERADICATED}`,
    ],
  },
  {
    req: 'REQ-393',
    guard: 'tests/guards/score-ladder-census.test.ts',
    phrases: [
      { block: 'ALLOWED', build: (n) => `ALLOWED ${n} key` },
      { block: 'ERADICATED', build: (n) => `ERADICATED ${n} key` },
    ],
  },
  {
    req: 'REQ-394',
    guard: 'tests/guards/measurement-statement-literal-census.test.ts',
    phrases: [{ block: 'ALLOWED', build: (n) => `ALLOWED ${n} key` }],
  },
];

/**
 * Count the top-level entries of a `const <name>: … = { … }` roster block.
 * An entry line is exactly-2-space indented and either a quoted key
 * `'file::field':` or a bare identifier key `healthy:` — deeper-indented
 * continuation lines and comment lines never count.
 */
export function countRosterBlock(source: string, block: string): number {
  const m = source.match(
    new RegExp('(?:export )?const ' + block + '[\\s\\S]*?= *\\{\\n([\\s\\S]*?)\\n\\};'),
  );
  if (m === null) {
    throw new Error(`roster block const ${block} not found`);
  }
  return m[1]
    .split('\n')
    .filter((line) => /^ {2}(?:'[^']+':|[A-Za-z_$][A-Za-z0-9_$]*:)/.test(line))
    .length;
}

/** Verdict histogram inside a roster block (`verdict: 'LIVE'` occurrences). */
export function countVerdicts(source: string, block: string): Record<string, number> {
  const m = source.match(
    new RegExp('(?:export )?const ' + block + '[\\s\\S]*?= *\\{\\n([\\s\\S]*?)\\n\\};'),
  );
  if (m === null) {
    throw new Error(`roster block const ${block} not found`);
  }
  const verdicts: Record<string, number> = {};
  for (const v of m[1].match(/verdict: '([A-Z-]+)'/g) ?? []) {
    const key = v.slice("verdict: '".length, -1);
    verdicts[key] = (verdicts[key] ?? 0) + 1;
  }
  return verdicts;
}

describe('census-artifact three-way match (REQ-395)', () => {
  const spec = readSource(REQUIREMENTS);

  it('has authority: the table covers the census-guard family', () => {
    expect(THREE_WAY.length).toBeGreaterThanOrEqual(4);
    expect(THREE_WAY.map((r) => r.req)).toEqual(['REQ-391', 'REQ-392', 'REQ-393', 'REQ-394']);
  });

  it.each(THREE_WAY.map((r) => [r.req, r] as const))(
    '%s: the counts its requirements prose declares equal the shipped roster',
    (_req, row) => {
      const guardSource = readSource(row.guard);
      const missing: string[] = [];
      for (const { block, build } of row.phrases) {
        const measured = countRosterBlock(guardSource, block);
        // measured >= 1 is the roster side's own floor; the phrase is built
        // from the MEASURED count, so a roster edit without a spec edit (or
        // a spec number with no matching roster) is RED here.
        expect(measured).toBeGreaterThanOrEqual(1);
        const phrase = build(measured);
        if (!spec.includes(phrase)) {
          missing.push(`${row.req} ${block}=${measured}: requirements.md must declare "${phrase}"`);
        }
      }
      if (row.verdictBlock !== undefined && row.verdictPhrases !== undefined) {
        const verdicts = countVerdicts(guardSource, row.verdictBlock);
        expect(Object.values(verdicts).reduce((a, b) => a + b, 0)).toBe(
          countRosterBlock(guardSource, row.verdictBlock),
        );
        for (const phrase of row.verdictPhrases(verdicts)) {
          if (!spec.includes(phrase)) {
            missing.push(
              `${row.req} ${row.verdictBlock} verdicts ${JSON.stringify(verdicts)}: requirements.md must declare "${phrase}"`,
            );
          }
        }
      }
      expect(missing).toEqual([]);
    },
  );

  it('fold census three-way stays in the promoted family (marker set == family set)', () => {
    // The original three-way (doc marker == data pin == engine, TC-005-02)
    // predates this guard; re-assert the artifact-set equality so a family
    // retired from the data file without its doc marker (or vice versa) is
    // RED under the SAME promoted condition, not only in its home suite.
    const markers = parseCensusPinMarkers(readSource(CENSUS_DOC));
    expect([...markers.keys()].sort()).toEqual(
      CENSUS_FAMILIES.map((fam) => fam.id).sort(),
    );
    expect(CENSUS_FAMILIES.length).toBeGreaterThanOrEqual(5);
  });

  it('liveness: the roster counter itself has teeth (synthetic guard source)', () => {
    const synthetic = [
      "const ALLOWED: Record<string, string> = {",
      "  'src/a.ts::score': 'reason',",
      "  'src/b.ts::rate': 'reason',",
      "  healthy: 'reason',",
      "    'src/c.ts::notTopLevel': 'nested',", // 4-space: continuation, not an entry
      "  // 'src/d.ts::comment': 'commented',", // comment line, not an entry
      '};',
      'const ERADICATED: Record<string, string> = {',
      "  'src/e.ts::confidence': 'gone',",
      '};',
    ].join('\n');
    expect(countRosterBlock(synthetic, 'ALLOWED')).toBe(3);
    expect(countRosterBlock(synthetic, 'ERADICATED')).toBe(1);
    // a block that does not exist fails loud, not zero (silent under-count).
    expect(() => countRosterBlock(synthetic, 'MISSING')).toThrow(/not found/);
  });
});
