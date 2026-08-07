/**
 * REQ-299: BatchProcessingAPI must read the `qualityScore` the pipeline surfaces
 * on its result instead of re-deriving it from a divergent copy of the formula.
 *
 * Background: SimplePipeline.calculateQualityScore was computed and consumed
 * internally but DROPPED from the success return, so BatchProcessingAPI
 * re-derived averageQualityScore via a duplicate formula that was falsy-guarded
 * on `processingTime` (diverging from the pipeline's own score when
 * processingTime is 0/missing). The fix surfaces qualityScore at the boundary;
 * this test proves the batch consumer uses the propagated value.
 *
 * Uses jest.unstable_mockModule (NOT jest.mock, which is a no-op under this
 * repo's ESM jest config) so the mocked pipeline result is actually consulted.
 */

import { jest } from '@jest/globals';

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

describe('BatchProcessingAPI quality-score propagation (REQ-299)', () => {
  it('uses the qualityScore surfaced on the pipeline result, not the re-derived copy', async () => {
    const { BatchProcessingAPI } = await import('../batch-processing-api');
    const { __mockProcess } = (await import('@/pipeline/simple-pipeline')) as {
      __mockProcess: jest.Mock;
    };

    // A distinctive score the recompute formula (30/30/20/20 weighting over
    // transcript-length / scene-confidence / processingTime / video-presence)
    // would NOT produce for these inputs (~47.2). If the consumer honors the
    // propagated value the summary reads exactly 73; if it re-derives, it reads
    // ~47.2 and this assertion fails.
    __mockProcess.mockResolvedValue({
      success: true,
      transcript: 'x',
      scenes: [{ confidence: 0.9 }],
      processingTime: 100,
      videoUrl: undefined,
      qualityScore: 73,
    });

    const api = new BatchProcessingAPI();
    const file = new File(['audio'], 'propagate.wav', { type: 'audio/wav' });
    const { jobId } = await api.submitJob({ files: [file] });
    await api.waitForJob(jobId, { timeoutMs: 5000, intervalMs: 25 });

    const result = api.getJobResult(jobId);
    expect(result).not.toBeNull();
    expect(result!.summary.averageQualityScore).toBe(73);
  });

  it('fallback (no surfaced qualityScore) uses the canonical single-source formula', async () => {
    // REQ-300: when a result lacks a surfaced qualityScore, the batch summary
    // must fall back to the SAME formula SimplePipeline uses (now both delegate
    // to calculatePipelineQualityScore), not a divergent re-derivation.
    const { BatchProcessingAPI } = await import('../batch-processing-api');
    const { calculatePipelineQualityScore } = await import('@/pipeline/quality-score');
    const { __mockProcess } = (await import('@/pipeline/simple-pipeline')) as {
      __mockProcess: jest.Mock;
    };

    // No qualityScore surfaced → forces the fallback path.
    // transcript 150 → 30, scene 0.5 → 15, perf 5000ms → 15, video → 20  == 80.
    const fallbackResult = {
      success: true,
      transcript: 'x'.repeat(150),
      scenes: [{ confidence: 0.5 }],
      processingTime: 5000,
      videoUrl: '/out/canonical.mp4',
    };
    __mockProcess.mockResolvedValue(fallbackResult);

    const canonical = calculatePipelineQualityScore(fallbackResult);
    expect(canonical).toBe(80); // distinctive sentinel the old divergent copy could not reproduce

    const api = new BatchProcessingAPI();
    const file = new File(['audio'], 'fallback.wav', { type: 'audio/wav' });
    const { jobId } = await api.submitJob({ files: [file] });
    await api.waitForJob(jobId, { timeoutMs: 5000, intervalMs: 25 });

    const result = api.getJobResult(jobId);
    expect(result).not.toBeNull();
    // The summary must equal the canonical single-source value, proving the
    // fallback delegates rather than re-deriving via a stale duplicate formula.
    expect(result!.summary.averageQualityScore).toBe(canonical);
    expect(result!.summary.averageQualityScore).toBe(80);
  });
});
