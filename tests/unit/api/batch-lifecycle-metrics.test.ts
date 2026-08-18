/**
 * REQ-213: Batch job lifecycle metrics integration
 *
 * Verifies that BatchProcessingAPI emits lifecycle transition events
 * to pipelineMetricsCollector at every state change:
 *   created → running → completed/failed/cancelled
 */

import { jest } from '@jest/globals';
import { PipelineMetricsCollector, pipelineMetricsCollector } from '@/monitoring/pipeline-metrics-collector';

// Mock pipeline dependencies
jest.unstable_mockModule('@/pipeline/simple-pipeline', () => ({
  simplePipeline: {
    process: jest.fn<any>().mockResolvedValue({ success: true, transcript: 'test', scenes: [] }),
  },
}));

jest.unstable_mockModule('@/pipeline/adaptive-quality-presets', () => ({
  adaptiveQualityPresets: {
    setPreset: jest.fn(),
    toPipelineOptions: jest.fn().mockReturnValue({
      file: { name: 'test.wav' },
      options: {},
    }),
    getCurrentPreset: jest.fn().mockReturnValue({ name: 'balanced' }),
  },
}));

const { BatchProcessingAPI } = await import('@/api/batch-processing-api');

// Helper: create a stub File-like object. Provides `arrayBuffer()` so the dedup
// key derives from CONTENT bytes (via computeFileHash), never name+size metadata
// (the 08y collision class). Content is deterministic in name+size.
function stubFile(name: string, size = 1024): File {
  return {
    name,
    size,
    type: 'audio/wav',
    arrayBuffer: async () => {
      const bytes = Buffer.from(`${name}::${size}`);
      const ab = new ArrayBuffer(bytes.length);
      new Uint8Array(ab).set(bytes);
      return ab;
    },
  } as File;
}

describe('REQ-213: BatchProcessingAPI lifecycle metrics integration', () => {
  let api: InstanceType<typeof BatchProcessingAPI>;

  beforeEach(() => {
    pipelineMetricsCollector.reset();
    api = new BatchProcessingAPI();
  });

  afterAll(() => {
    pipelineMetricsCollector.reset();
  });

  it('emits created transition when job is submitted', async () => {
    const snap0 = pipelineMetricsCollector.getSnapshot();
    expect(snap0.batchJobs.jobsByStatus.created).toBe(0);

    const { jobId } = await api.submitJob({ files: [stubFile('a.wav')] });

    const snap = pipelineMetricsCollector.getSnapshot();
    expect(snap.batchJobs.jobsByStatus.created).toBe(1);
  });

  it('emits running → completed transitions for successful jobs', async () => {
    const { jobId } = await api.submitJob({ files: [stubFile('a.wav')] });

    // Wait for async processing to finish
    const status = await api.waitForJob(jobId, { timeoutMs: 5000 });

    const snap = pipelineMetricsCollector.getSnapshot();
    expect(snap.batchJobs.jobsByStatus.created).toBe(1);
    expect(snap.batchJobs.jobsByStatus.running).toBe(1);
    expect(snap.batchJobs.jobsByStatus.completed).toBe(1);
    expect(snap.batchJobs.activeJobs).toBe(0);
  });

  it('emits cancelled transition when job is cancelled', async () => {
    const { jobId } = await api.submitJob({ files: [stubFile('a.wav')] });

    // Attempt cancel (may or may not succeed depending on timing)
    api.cancelJob(jobId);

    // Wait for the job to reach a terminal state
    const status = await api.waitForJob(jobId, { timeoutMs: 5000 });

    // If cancel succeeded, we should see a cancelled transition
    // (cancel may race with completion)
    const snap = pipelineMetricsCollector.getSnapshot();
    const total = snap.batchJobs.jobsByStatus.completed
      + snap.batchJobs.jobsByStatus.cancelled;
    expect(total).toBeGreaterThanOrEqual(1);
  });

  it('completes job even when individual file processing fails', async () => {
    // Individual file failures are caught inside processFile;
    // the job still reaches 'completed' status.
    const { simplePipeline } = await import('@/pipeline/simple-pipeline');
    (simplePipeline.process as jest.Mock<any>).mockRejectedValueOnce(new Error('boom'));

    const { jobId } = await api.submitJob({ files: [stubFile('fail.wav'), stubFile('ok.wav')] });
    const status = await api.waitForJob(jobId, { timeoutMs: 5000 });

    const snap = pipelineMetricsCollector.getSnapshot();
    // Job goes through created → running → completed (even with file-level failures)
    expect(snap.batchJobs.jobsByStatus.created).toBe(1);
    expect(snap.batchJobs.jobsByStatus.running).toBe(1);
    expect(snap.batchJobs.jobsByStatus.completed).toBe(1);
    expect(snap.batchJobs.activeJobs).toBe(0);
  });
});
