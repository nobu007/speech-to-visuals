/**
 * REQ-290: diagram-detector scoring must cover the canonical DiagramType set.
 *
 * `DiagramDetector.detect()` previously iterated a re-literalized copy of the
 * 11-type union (`[...] as DiagramType[]`). The `as` cast defeated the
 * type-checker, so adding a 12th `DiagramType` to `types/diagram.ts` would be
 * silently un-scored by this loop. It now delegates to the single-source
 * `DIAGRAM_TYPES`. This test locks that invariant: every canonical type must
 * receive a score, and no non-canonical type may leak into the results.
 */

import { DiagramDetector } from '@/analysis/diagram-detector';
import type { ContentSegment } from '@/analysis/types';
import { DIAGRAM_TYPES, isDiagramType } from '@stv/core/types/diagram';

function makeSegment(text: string): ContentSegment {
  return {
    startMs: 0,
    endMs: 5000,
    text,
    summary: text.slice(0, 80),
    keyphrases: [],
    confidence: 0.9,
  };
}

describe('REQ-290: DiagramDetector canonical-type scoring parity', () => {
  const detector = new DiagramDetector();

  it('scores every canonical DiagramType exactly once', () => {
    const result = detector.detect(null, [
      makeSegment('process workflow with pipeline steps and hierarchy structure'),
    ]);

    // primaryType + alternatives together are the full scored set
    // (alternatives = allScores.slice(1), see detect() return).
    const scoredTypes = [result.primaryType, ...result.alternatives.map(a => a.type)];

    // Every scored type must be a valid canonical DiagramType (no invalid
    // values like the historic 'concept'/'orgchart' leaks).
    for (const t of scoredTypes) {
      expect(isDiagramType(t)).toBe(true);
    }

    // The scored set must cover the canonical source exactly — same size,
    // same members, no drift. This fails if detect() ever re-introduces a
    // partial/hardcoded type list that omits or invents a type.
    expect(scoredTypes).toHaveLength(DIAGRAM_TYPES.length);
    expect(new Set(scoredTypes)).toEqual(new Set(DIAGRAM_TYPES));
  });

  it('scoring coverage is independent of input text (always full canonical set)', () => {
    // Even with empty/garbage input, every canonical type is still scored
    // (confidence may be 0, but the type is present).
    const result = detector.detect(null, [makeSegment('')]);
    const scoredTypes = new Set([result.primaryType, ...result.alternatives.map(a => a.type)]);

    expect(scoredTypes).toEqual(new Set(DIAGRAM_TYPES));
  });
});
