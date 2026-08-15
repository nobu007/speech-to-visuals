/**
 * Round-20 safe-aggregation migration oracle for the api continent:
 * BatchProcessingAPI job-summary quality aggregation
 * (specs/finite-safe-aggregation TASK-0011).
 *
 * Site (batch-processing-api.ts, was 411-412):
 *
 *   totalQualityScore    = qualityScores.reduce((sum, score) => sum + score, 0)
 *   averageQualityScore  = qualityScores.length > 0 ? totalQualityScore / qualityScores.length : 0
 *
 * `qualityScores` reads `r.result!.qualityScore` — an interface field on
 * SimplePipelineResult crossing the pipeline→REST boundary. The `??` fallback
 * only replaces null/undefined, so a non-finite score previously poisoned BOTH
 * summary fields with NaN (the REST response then serialized
 * `averageQualityScore: null`). safeSum/safeMean exclude non-finite samples
 * (D2); finite inputs are value-identical.
 *
 * Uses jest.unstable_mockModule (NOT jest.mock — a no-op under this repo's ESM
 * jest config) so the mocked pipeline result is actually consulted.
 */

import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { safeMean, safeSum } from '@/lib/metrics-utils';
import { createLayoutRng } from '@/visualization/layout-rng';

const here = path.dirname(fileURLToPath(import.meta.url));
const apiSource = readFileSync(
  path.join(here, '../../src/api/batch-processing-api.ts'),
  'utf8',
);

jest.unstable_mockModule('@/pipeline/simple-pipeline', () => {
  const mockProcess = jest.fn();
  return {
    simplePipeline: { process: mockProcess },
    __mockProcess: mockProcess,
  };
});

jest.unstable_mockModule('@/monitoring/pipeline-metrics-collector', () => ({
  pipelineMetricsCollector: { recordBatchJobTransition: jest.fn() },
}));

/** Legacy summary folds, replicated (was 411-412). */
const legacyTotal = (scores: number[]): number =>
  scores.reduce((sum, score) => sum + score, 0);
const legacyAverage = (scores: number[]): number =>
  scores.length > 0 ? legacyTotal(scores) / scores.length : 0;

// ---------------------------------------------------------------------------
// Numeric-delta oracle: finite inputs are value-identical to the legacy folds
// ---------------------------------------------------------------------------

describe('summary aggregation: finite scores are value-identical', () => {
  test('safeSum/safeMean === legacy reduce folds (300 seeded cases)', () => {
    const rng = createLayoutRng('round20|batch-quality-summary');
    for (let i = 0; i < 300; i++) {
      const n = 1 + Math.floor(rng() * 12);
      const scores = Array.from({ length: n }, () => Math.round(rng() * 10000) / 100);
      expect(safeSum(scores)).toBe(legacyTotal(scores));
      expect(safeMean(scores)).toBe(legacyAverage(scores));
    }
  });

  test('empty success set keeps the legacy else-branch (average 0)', () => {
    expect(safeMean([])).toBe(legacyAverage([]));
    expect(safeMean([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Behavioral oracle: the REST summary survives a poisoned qualityScore
// ---------------------------------------------------------------------------

describe('job summary with a poisoned qualityScore', () => {
  it('excludes the non-finite score instead of NaN-ing both summary fields', async () => {
    const { BatchProcessingAPI } = await import('../../src/api/batch-processing-api');
    const { __mockProcess } = (await import('@/pipeline/simple-pipeline')) as {
      __mockProcess: jest.Mock;
    };

    // Two files: the first surfaces a NaN qualityScore (the boundary field the
    // `??` guard does NOT catch), the second a clean 60.
    __mockProcess
      .mockResolvedValueOnce({
        success: true,
        transcript: 'x',
        scenes: [{ confidence: 0.9 }],
        processingTime: 100,
        videoUrl: undefined,
        qualityScore: Number.NaN,
      })
      .mockResolvedValueOnce({
        success: true,
        transcript: 'y',
        scenes: [{ confidence: 0.8 }],
        processingTime: 200,
        videoUrl: undefined,
        qualityScore: 60,
      });

    const api = new BatchProcessingAPI();
    // Distinct contents: the batch layer dedupes files by content hash, and a
    // skipped duplicate never reaches the summary we are asserting on.
    const files = [
      new File(['audio-a'], 'poisoned.wav', { type: 'audio/wav' }),
      new File(['audio-b'], 'clean.wav', { type: 'audio/wav' }),
    ];
    const { jobId } = await api.submitJob({ files });
    await api.waitForJob(jobId, { timeoutMs: 5000, intervalMs: 25 });

    const result = api.getJobResult(jobId);
    expect(result).not.toBeNull();
    // Legacy: total = NaN + 60 = NaN and average = NaN (serialized as null in
    // the REST response). New: the poisoned sample leaves the population.
    expect(result!.summary.totalQualityScore).toBe(60);
    expect(result!.summary.averageQualityScore).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// Source anchor: the legacy expressions stay migrated
// ---------------------------------------------------------------------------

describe('source anchor: legacy folds are gone, safe helpers remain', () => {
  test('batch-processing-api.ts', () => {
    expect(apiSource).not.toMatch(
      /qualityScores\.reduce\(\(sum, score\) => sum \+ score, 0\)/,
    );
    expect(apiSource).not.toMatch(/totalQualityScore \/ qualityScores\.length/);
    expect(apiSource).toMatch(/safeSum\(qualityScores\)/);
    expect(apiSource).toMatch(/safeMean\(qualityScores\)/);
  });
});
