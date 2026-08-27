/**
 * INV-BATCH-001: per-job batch preset isolation
 *
 * A batch job's `preset` is request-scoped configuration. Submitting it must
 * NOT reconfigure the process-global AdaptiveQualityPresetsManager: the HTTP
 * service process handles many unrelated jobs, so a preset-bearing job that
 * installed its preset globally would silently re-route every later
 * preset-less job (and race with concurrent jobs) onto that preset.
 *
 * Covers:
 * - A preset-bearing job's files are processed with that preset's parameters
 * - The process-global preset stays 'balanced' after such a job
 * - A later preset-less job runs with the default, not the inherited preset
 * - Invalid presets are still rejected at submission (error surface preserved)
 */

import { jest } from '@jest/globals';

// Mock only the pipeline execution — the presets module must stay REAL so the
// witness observes actual process-global state, not a mock's.
jest.unstable_mockModule('@/pipeline/simple-pipeline', () => ({
  simplePipeline: {
    process: jest.fn<any>().mockResolvedValue({ success: true, transcript: 'test', scenes: [] }),
  },
}));

const { BatchProcessingAPI } = await import('@/api/batch-processing-api');
const { adaptiveQualityPresets, QUALITY_PRESETS } = await import('@/pipeline/adaptive-quality-presets');
const { PipelineConfigError } = await import('@/pipeline/pipeline-errors');
const { simplePipeline } = await import('@/pipeline/simple-pipeline');

// Helper: create a stub File-like object. Provides `arrayBuffer()` so the dedup
// key derives from CONTENT bytes (via computeFileHash), never from name+size
// metadata (the 08y collision class). Distinct names ⇒ distinct content.
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

/** Parameters of the last simplePipeline.process call. */
function lastPipelineOptions(): Record<string, unknown> {
  const calls = (simplePipeline.process as jest.Mock<any>).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  const pipelineInput = calls[calls.length - 1][0] as { options: Record<string, unknown> };
  return pipelineInput.options;
}

describe('INV-BATCH-001: batch preset must not leak into process-global state', () => {
  let api: InstanceType<typeof BatchProcessingAPI>;

  beforeEach(() => {
    api = new BatchProcessingAPI();
    (simplePipeline.process as jest.Mock<any>).mockClear();
    // Reset the shared manager to its default so each leg starts from a
    // known process-global state (jest module registry resets per file, not
    // per test).
    adaptiveQualityPresets.setPreset('balanced');
  });

  afterAll(() => {
    adaptiveQualityPresets.setPreset('balanced');
  });

  it("applies the job's preset to its own files without mutating the global manager", async () => {
    const { jobId } = await api.submitJob({ files: [stubFile('fast-job.wav')], preset: 'fast' });
    const status = await api.waitForJob(jobId, { timeoutMs: 5000 });
    expect(status.status).toBe('completed');

    // fast preset's maxConcurrency (balanced/custom sit at 4) — the job's
    // files must run with the requested preset's parameters. Derived from
    // QUALITY_PRESETS rather than a bare 8 so a preset re-tune re-bases the
    // leg instead of going stale.
    expect(lastPipelineOptions().maxConcurrency).toBe(QUALITY_PRESETS.fast.parameters.maxConcurrency);

    // ... while the process-global configuration stays on the default.
    expect(adaptiveQualityPresets.getCurrentPreset().name).toBe('balanced');
  });

  it('a later preset-less job does not inherit the previous job preset', async () => {
    const { jobId: fastJob } = await api.submitJob({
      files: [stubFile('fast-job.wav')],
      preset: 'fast',
    });
    await api.waitForJob(fastJob, { timeoutMs: 5000 });

    const { jobId } = await api.submitJob({ files: [stubFile('plain-job.wav')] });
    const status = await api.waitForJob(jobId, { timeoutMs: 5000 });
    expect(status.status).toBe('completed');

    // The default (balanced) maxConcurrency — NOT the fast preset's value the
    // previous job installed under the old process-global contamination.
    expect(lastPipelineOptions().maxConcurrency).toBe(QUALITY_PRESETS.balanced.parameters.maxConcurrency);
  });

  it('still rejects an invalid preset at submission time', async () => {
    await expect(
      api.submitJob({ files: [stubFile('bad.wav')], preset: 'ultra' as never }),
    ).rejects.toThrow(PipelineConfigError);
    await expect(
      api.submitJob({ files: [stubFile('bad.wav')], preset: 'ultra' as never }),
    ).rejects.toThrow('Invalid preset: ultra');

    // The rejected submission must not have altered global state either.
    expect(adaptiveQualityPresets.getCurrentPreset().name).toBe('balanced');
  });

  it('concurrent jobs with different presets each run on their own preset', async () => {
    // The old contamination raced exactly here: two jobs in flight, the
    // global preset flip-flopping between submits while processing read it
    // per file. Per-request resolution must attribute each file's options to
    // ITS job's preset, not to whichever submit ran last.
    const [fastJob, qualityJob] = await Promise.all([
      api.submitJob({ files: [stubFile('conc-fast.wav')], preset: 'fast' }),
      api.submitJob({ files: [stubFile('conc-quality.wav')], preset: 'quality' }),
    ]);
    await api.waitForJob(fastJob.jobId, { timeoutMs: 5000 });
    await api.waitForJob(qualityJob.jobId, { timeoutMs: 5000 });

    const calls = (simplePipeline.process as jest.Mock<any>).mock.calls;
    expect(calls.length).toBe(2);
    for (const call of calls) {
      const input = call[0] as { audioFile: { name: string }; options: { maxConcurrency: number } };
      const expected = input.audioFile.name === 'conc-fast.wav'
        ? QUALITY_PRESETS.fast
        : QUALITY_PRESETS.quality;
      expect(input.options.maxConcurrency).toBe(expected.parameters.maxConcurrency);
    }

    expect(adaptiveQualityPresets.getCurrentPreset().name).toBe('balanced');
  });

  it('merges request.options on the preset path without mutating the QUALITY_PRESETS definitions', async () => {
    // The API writes the request-scoped includeVideoGeneration flag onto the
    // options object toPipelineOptions hands out. With an explicit preset that
    // producer reads the process-global QUALITY_PRESETS parameters — the
    // write must land on the fresh per-call object, never on the shared
    // definitions every future job in this process resolves against.
    const presetsBefore = JSON.parse(JSON.stringify(QUALITY_PRESETS));

    const { jobId } = await api.submitJob({
      files: [stubFile('fast-novideo.wav')],
      preset: 'fast',
      options: { generateVideo: false },
    });
    const status = await api.waitForJob(jobId, { timeoutMs: 5000 });
    expect(status.status).toBe('completed');

    // Both axes applied: the job's preset parameters AND the request flag.
    expect(lastPipelineOptions().includeVideoGeneration).toBe(false);
    expect(lastPipelineOptions().maxConcurrency).toBe(QUALITY_PRESETS.fast.parameters.maxConcurrency);

    // Shared definitions byte-identical to before the job.
    expect(QUALITY_PRESETS).toEqual(presetsBefore);

    // Order-independent tripwire for the same hazard: a request-scoped option
    // key must NEVER appear on the shared parameters object. (The toEqual
    // above only sees writes inside this leg's window — earlier legs calling
    // toPipelineOptions(file, 'fast') could mask a write-in that happened
    // before the snapshot was taken. The property pin has no such hole.)
    expect(QUALITY_PRESETS.fast.parameters).not.toHaveProperty('includeVideoGeneration');
  });

  it('a preset-less job still runs on the global configuration (custom overrides apply)', async () => {
    // The explicit-preset bypass must stay CONDITIONAL: requests that do not
    // name a preset keep using the process-global configuration, custom
    // overrides included. Normalizing the call site to
    // toPipelineOptions(file, request.preset ?? 'balanced') would silently
    // drop the overrides from every preset-less job.
    adaptiveQualityPresets.setCustomOverrides({ maxConcurrency: 16 });
    try {
      const { jobId } = await api.submitJob({ files: [stubFile('global-override-job.wav')] });
      const status = await api.waitForJob(jobId, { timeoutMs: 5000 });
      expect(status.status).toBe('completed');
      expect(lastPipelineOptions().maxConcurrency).toBe(16);
    } finally {
      adaptiveQualityPresets.clearCustomOverrides();
    }
    expect(adaptiveQualityPresets.getCurrentPreset().name).toBe('balanced');
  });
});
