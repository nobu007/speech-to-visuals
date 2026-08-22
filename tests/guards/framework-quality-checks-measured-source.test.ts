/**
 * REQ-390 source guard: the framework's Quality Check System
 * (`runQualityChecks` → checkXxxQuality → evaluateResults → the
 * `passed = overallScore >= 0.8` commit gate) must score the RECORDED
 * measurements (`this.currentState.metrics`), never constant fixtures.
 *
 * Pre-fix, all four checkXxxQuality methods were "Implement ... validation"
 * stubs returning hardcoded numbers (`accuracy: 0.9, confidence: 0.85,
 * duration: 2.5, ...`), so every executeDevelopmentCycle "passed" on
 * evidence that never varied with the run and committed — the fabricated
 * always-pass verdict class (REQ-383 documentation leg / REQ-384
 * commitPhase). The seconds-valued `duration: 2.5` was additionally
 * averaged into the 0-1 module mean (module score 1.4167, overallScore
 * ≈ 1.0037 — a permanently >1 "quality fraction").
 *
 * The behavioral pins (verdict follows recordings, exact scores, fail-closed
 * fresh cycle, budget legs) live in
 * src/framework/__tests__/recursive-custom-instructions.test.ts; this guard
 * anchors the SOURCE so a future edit cannot re-introduce a constant
 * fixture (or a non-0-1 field) into a check body without a visible RED.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SOURCE_PATH = join(REPO_ROOT, 'src/framework/recursive-custom-instructions.ts');
const source = readFileSync(SOURCE_PATH, 'utf8');

/** Extract one `private async checkXxxQuality` body (method header → next method header). */
function checkMethodBody(name: string): string {
  const start = source.indexOf(`private async ${name}`);
  if (start === -1) {
    throw new Error(`check method ${name} not found — renamed? Update this guard.`);
  }
  const next = source.indexOf('\n  private ', start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

describe('REQ-390: framework quality checks score recorded measurements', () => {
  const CHECK_METHODS = [
    'checkTranscriptionQuality',
    'checkAnalysisQuality',
    'checkVisualizationQuality',
    'checkIntegrationQuality',
  ] as const;

  it.each([...CHECK_METHODS])('%s reads this.currentState.metrics', (name) => {
    expect(checkMethodBody(name)).toContain('this.currentState.metrics');
  });

  it('carries no pre-fix constant fixture literal (re-fabrication ban)', () => {
    // Every literal below is a value from the deleted stub bodies. Any
    // reappearance means a check leg stopped deriving from measurements.
    const fixtureMarkers = [
      'confidence: 0.85',
      'duration: 2.5',
      'diagramDetection: 0.78',
      'relationshipExtraction: 0.75',
      'labelReadability: 1.0',
      'renderPerformance: 0.88',
      'pipelineFlow: 0.93',
      'errorHandling: 0.90',
    ];
    for (const marker of fixtureMarkers) {
      expect(source).not.toContain(marker);
    }
  });

  it('calculateModuleScore still delegates to safeMean (round-20 anchor)', () => {
    expect(source).toMatch(/safeMean\(Object\.values\(moduleResults\) as number\[\]\)/);
  });
});
