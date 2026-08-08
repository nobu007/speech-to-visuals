/**
 * Structural source-coupling guard for the diagram-detection "good confidence"
 * threshold.
 *
 * "Is this detection confidence good enough?" is ONE concept and must have ONE
 * answer. It was previously encoded two ways that DISAGREE at the boundary:
 *   - `DiagramDetector.testConfidenceThreshold` used `confidence >= 0.6`
 *     (0.6 PASSES the gate), while
 *   - `SimplePipeline` flagged the SAME 0.6 as low-confidence via
 *     `confidence > 0.6` / `<= 0.6` (0.6 FAILS).
 * At exactly 0.6 the detector accepted a result the pipeline simultaneously
 * reported as low-confidence.
 *
 * The fix centralizes BOTH the value AND the operator:
 *   - value:  `GOOD_DETECTION_CONFIDENCE_THRESHOLD` (single source, in
 *     `diagram-detection-constants.ts`, sibling to `MAX_DIAGRAM_CONFIDENCE`);
 *   - operator/predicate: `meetsGoodDetectionConfidence` (single source, in
 *     `diagram-detector.ts`, boundary-INCLUSIVE `>=`).
 *
 * This test guards the COUPLING at the source-text level so the divergent bare
 * `> 0.6` / `<= 0.6` / `>= 0.6` comparisons cannot reappear in either
 * participant file, and so neither the constant nor the predicate can be
 * re-defined elsewhere.
 *
 * NOTE: `SceneSegmenter.GOOD_CONFIDENCE_THRESHOLD` is ALSO 0.6 but gates
 * SEGMENT-coherence avgConfidence — a separate domain, intentionally out of
 * scope.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { meetsGoodDetectionConfidence } from '../diagram-detector';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

const CONSTANTS_FILE = path.join('src', 'analysis', 'diagram-detection-constants.ts');
const DETECTOR_FILE = path.join('src', 'analysis', 'diagram-detector.ts');
const PIPELINE_FILE = path.join('src', 'pipeline', 'simple-pipeline.ts');

/** `export const GOOD_DETECTION_CONFIDENCE_THRESHOLD =` */
const CONSTANT_DEF = /export\s+const\s+GOOD_DETECTION_CONFIDENCE_THRESHOLD\s*=/;
/** `export function meetsGoodDetectionConfidence(` */
const PREDICATE_DEF = /export\s+function\s+meetsGoodDetectionConfidence\s*\(/;
/**
 * A comparison against the literal `0.6` — `> 0.6`, `>= 0.6`, `<= 0.6`, `< 0.6`
 * (any whitespace, no decimal follower). A bare `= 0.6` assignment does NOT
 * match (`[<>]` excludes `=`), so unrelated `SCORE = 0.6` literals are safe.
 */
const BARE_06_COMPARISON = /[<>]=?\s*0\.6(?!\d)/;

function getAllProductionSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'coverage', '__tests__'].includes(entry.name)) continue;
      results.push(...getAllProductionSourceFiles(fullPath));
    } else if (entry.name.match(/\.(ts|tsx)$/)) {
      if (entry.name.includes('.test.') || entry.name.includes('.spec.')) continue;
      results.push(fullPath);
    }
  }
  return results;
}

function rel(p: string): string {
  return path.relative(REPO_ROOT, p);
}

function readRel(relPath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

describe('diagram-detection "good confidence" threshold is single-sourced', () => {
  test('the threshold constant is defined exactly once (in the constants file)', () => {
    const files = getAllProductionSourceFiles(REPO_ROOT);
    const defining = files.filter(f => CONSTANT_DEF.test(fs.readFileSync(f, 'utf8')));
    expect(defining.map(rel)).toEqual([CONSTANTS_FILE]);
  });

  test('the predicate is defined exactly once (in the detector)', () => {
    const files = getAllProductionSourceFiles(REPO_ROOT);
    const defining = files.filter(f => PREDICATE_DEF.test(fs.readFileSync(f, 'utf8')));
    expect(defining.map(rel)).toEqual([DETECTOR_FILE]);
  });

  test('no participant file re-introduces a bare 0.6 confidence comparison', () => {
    // After delegating to the predicate, neither participant may compare against
    // a literal 0.6 — the value lives in the named constant and the operator in
    // the predicate. Re-introducing `> 0.6` / `<= 0.6` here would resurrect the
    // boundary disagreement. (This is the DECISIVE guard: verified RED when
    // either call site is reverted to a bare comparison.)
    for (const participant of [DETECTOR_FILE, PIPELINE_FILE]) {
      const src = readRel(participant);
      const matches = src.match(new RegExp(BARE_06_COMPARISON.source, 'g'));
      expect({ file: participant, matches }).toEqual({ file: participant, matches: null });
    }
  });
});

describe('meetsGoodDetectionConfidence boundary semantics', () => {
  // The whole point of centralizing: the boundary value 0.6 MEETS the threshold.
  test('is boundary-INCLUSIVE: exactly 0.6 passes', () => {
    expect(meetsGoodDetectionConfidence(0.6)).toBe(true);
  });

  test('just below the threshold fails', () => {
    expect(meetsGoodDetectionConfidence(0.599999)).toBe(false);
    expect(meetsGoodDetectionConfidence(0.59)).toBe(false);
    expect(meetsGoodDetectionConfidence(0)).toBe(false);
  });

  test('above the threshold passes', () => {
    expect(meetsGoodDetectionConfidence(0.61)).toBe(true);
    expect(meetsGoodDetectionConfidence(0.95)).toBe(true);
    expect(meetsGoodDetectionConfidence(1)).toBe(true);
  });

  test('undefined / NaN confidence is sanitized to 0 (fails)', () => {
    expect(meetsGoodDetectionConfidence(undefined as unknown as number)).toBe(false);
    expect(meetsGoodDetectionConfidence(NaN)).toBe(false);
  });
});
