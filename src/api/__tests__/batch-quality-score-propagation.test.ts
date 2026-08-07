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
});
