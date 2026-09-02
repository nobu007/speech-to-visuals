/**
 * measure-diagram-detection-accuracy.ts — dataset contract + metric core pins.
 *
 * QUALITY_METRICS §3.2 "Diagram Type Accuracy" is only as trustworthy as this
 * harness: the recorded number is correct/total over the committed dataset, so
 * the dataset contract (coverage, uniqueness, honest labels) and the summary
 * math (agreement, per-type recall, confusion ordering, fail-loud empty run)
 * are pinned to hand-computable cases. A drifted formula or a quietly-shrunk
 * dataset would silently re-scale the recorded agreement — these legs make
 * that a RED, not a quiet rebase. The full-dataset leg additionally pins the
 * MEASURED baseline itself: any detector behavior change must surface here and
 * force a conscious re-measurement instead of drifting the number unreviewed.
 */
import { DIAGRAM_TYPES, isDiagramType } from '@stv/core/types/diagram';
import {
  DIAGRAM_TYPE_EVAL_DATASET,
  MIN_CASES_PER_TYPE,
  type DiagramTypeEvalCase,
} from '../../src/analysis/eval/diagram-type-eval-dataset';
import {
  toEvalRow,
  summarizeDetection,
  buildDetectionReport,
  parseDetectionArgv,
  type DetectionEvalRow,
} from '../../scripts/measure-diagram-detection-accuracy';

// ---------------------------------------------------------------------------
// Dataset contract
// ---------------------------------------------------------------------------

describe('DIAGRAM_TYPE_EVAL_DATASET contract', () => {
  it('ids are unique', () => {
    const ids = DIAGRAM_TYPE_EVAL_DATASET.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every case has a non-empty text and a canonical expected type', () => {
    for (const c of DIAGRAM_TYPE_EVAL_DATASET) {
      expect(c.text.trim().length).toBeGreaterThan(0);
      expect(isDiagramType(c.expectedType)).toBe(true);
      expect(['ja', 'en']).toContain(c.language);
    }
  });

  it('every canonical diagram type has >= MIN_CASES_PER_TYPE cases', () => {
    for (const type of DIAGRAM_TYPES) {
      const count = DIAGRAM_TYPE_EVAL_DATASET.filter((c) => c.expectedType === type).length;
      expect(count).toBeGreaterThanOrEqual(MIN_CASES_PER_TYPE);
    }
  });

  it('every canonical diagram type has at least one Japanese and one English case', () => {
    for (const type of DIAGRAM_TYPES) {
      const cases = DIAGRAM_TYPE_EVAL_DATASET.filter((c) => c.expectedType === type);
      expect(cases.some((c) => c.language === 'ja')).toBe(true);
      expect(cases.some((c) => c.language === 'en')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Metric core (pure, hand-computed)
// ---------------------------------------------------------------------------

function row(partial: Partial<DetectionEvalRow> & Pick<DetectionEvalRow, 'expectedType' | 'predictedType'>): DetectionEvalRow {
  return {
    id: partial.id ?? 'synthetic',
    language: partial.language ?? 'en',
    expectedType: partial.expectedType,
    predictedType: partial.predictedType,
    confidence: partial.confidence ?? 0.5,
    correct: partial.expectedType === partial.predictedType,
  };
}

describe('summarizeDetection', () => {
  it('computes agreement, per-type recall, and confusions on a hand-computable set', () => {
    const summary = summarizeDetection([
      row({ id: 'a', expectedType: 'flow', predictedType: 'flow' }),
      row({ id: 'b', expectedType: 'flow', predictedType: 'tree' }),
      row({ id: 'c', expectedType: 'tree', predictedType: 'tree' }),
    ]);
    expect(summary.casesEvaluated).toBe(3);
    expect(summary.correct).toBe(2);
    expect(summary.agreementRate).toBeCloseTo(2 / 3, 12);
    const flow = summary.perType.find((t) => t.type === 'flow');
    const tree = summary.perType.find((t) => t.type === 'tree');
    expect(flow).toMatchObject({ total: 2, correct: 1, recall: 0.5 });
    expect(tree).toMatchObject({ total: 1, correct: 1, recall: 1 });
    expect(summary.confusions).toEqual([{ expected: 'flow', predicted: 'tree', count: 1 }]);
  });

  it('sorts confusions by count desc, then by type names (byte-stable output)', () => {
    const summary = summarizeDetection([
      row({ expectedType: 'flow', predictedType: 'tree' }),
      row({ expectedType: 'flow', predictedType: 'tree' }),
      row({ expectedType: 'cycle', predictedType: 'flow' }),
      row({ expectedType: 'cycle', predictedType: 'flow' }),
      row({ expectedType: 'cycle', predictedType: 'tree' }),
      row({ expectedType: 'mindmap', predictedType: 'general' }),
    ]);
    expect(summary.confusions.map((c) => `${c.expected}→${c.predicted}:${c.count}`)).toEqual([
      'cycle→flow:2',
      'flow→tree:2',
      'cycle→tree:1',
      'mindmap→general:1',
    ]);
  });

  it('throws on an empty row set — an empty run is not a measurement', () => {
    expect(() => summarizeDetection([])).toThrow(/not a measurement/);
  });

  it('agreement 1.0 yields an empty confusion set, not undefined', () => {
    const summary = summarizeDetection([
      row({ expectedType: 'flow', predictedType: 'flow' }),
      row({ expectedType: 'tree', predictedType: 'tree' }),
    ]);
    expect(summary.agreementRate).toBe(1);
    expect(summary.confusions).toEqual([]);
  });
});

describe('toEvalRow / buildDetectionReport', () => {
  const evalCase: DiagramTypeEvalCase = {
    id: 'case-1',
    language: 'ja',
    expectedType: 'cycle',
    text: '繰り返す',
  };

  it('marks correct only when primaryType equals the human label', () => {
    expect(toEvalRow(evalCase, {
      primaryType: 'cycle', confidence: 0.8, alternatives: [], isComplex: false,
      secondaryTypes: [], fusionStrategy: 'single', reasoning: '',
    })).toMatchObject({ id: 'case-1', language: 'ja', expectedType: 'cycle', predictedType: 'cycle', confidence: 0.8, correct: true });
    expect(toEvalRow(evalCase, {
      primaryType: 'flow', confidence: 0.4, alternatives: [], isComplex: false,
      secondaryTypes: [], fusionStrategy: 'single', reasoning: '',
    })).toMatchObject({ predictedType: 'flow', correct: false });
  });

  it('report carries the schema tag, dataset path, and rows verbatim (no timestamp)', () => {
    const report = buildDetectionReport([row({ id: 'x', expectedType: 'flow', predictedType: 'flow' })]);
    expect(report.schema).toBe('stv-diagram-detection-accuracy/1');
    expect(report.dataset).toBe('src/analysis/eval/diagram-type-eval-dataset.ts');
    expect(report.generatedAt).toBeUndefined();
    expect(report.rows).toHaveLength(1);
    expect(report.summary.casesEvaluated).toBe(1);
  });
});

describe('parseDetectionArgv', () => {
  it('accepts no arguments and --output <file>', () => {
    expect(parseDetectionArgv([])).toEqual({});
    expect(parseDetectionArgv(['--output', 'r.json'])).toEqual({ output: 'r.json' });
  });

  it('rejects unknown flags, missing values, and stray positionals', () => {
    expect(parseDetectionArgv(['--corpus', 'x'])).toMatchObject({ error: expect.stringContaining('unknown option: --corpus') });
    expect(parseDetectionArgv(['--output'])).toMatchObject({ error: expect.stringContaining('--output requires a value') });
    expect(parseDetectionArgv(['extra'])).toMatchObject({ error: expect.stringContaining('unexpected argument: extra') });
  });
});

// ---------------------------------------------------------------------------
// Full-dataset measured baseline (deterministic production path)
// ---------------------------------------------------------------------------

describe('measured baseline over DIAGRAM_TYPE_EVAL_DATASET', () => {
  it('pins the measured agreement and confusion set of the rule-based detect() path', async () => {
    const { DiagramDetector } = await import('../../src/analysis/diagram-detector');
    const detector = new DiagramDetector();

    const runOnce = () =>
      buildDetectionReport(
        DIAGRAM_TYPE_EVAL_DATASET.map((c) =>
          toEvalRow(
            c,
            detector.detect(null, [
              { startMs: 0, endMs: 5000, text: c.text, summary: c.text.slice(0, 40), keyphrases: [], confidence: 1 },
            ])
          )
        )
      ).summary;

    const summary = runOnce();

    // Measured baseline (2026-09-03, eval v1): 28/33 = 84.85%. Recorded in
    // QUALITY_METRICS §3.2. A change here means detect() behavior moved —
    // re-measure and re-record deliberately, never silently.
    expect(summary.casesEvaluated).toBe(33);
    expect(summary.correct).toBe(28);
    expect(summary.agreementRate).toBeCloseTo(28 / 33, 12);
    expect(summary.confusions.map((c) => `${c.expected}→${c.predicted}:${c.count}`)).toEqual([
      'comparison→matrix:1',
      'general→flowchart:1',
      'general→mindmap:1',
      'mindmap→tree:1',
      'tree→flowchart:1',
    ]);

    // Determinism witness: a second pass over the same deterministic path
    // produces a byte-identical summary.
    expect(runOnce()).toEqual(summary);
  });
});
