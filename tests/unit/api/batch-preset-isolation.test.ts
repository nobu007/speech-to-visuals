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
import { waitForState } from '@tests/helpers/wait-for-state';

const PIPELINE_OK_RESULT = { success: true, transcript: 'test', scenes: [] };

// Mock only the pipeline execution — the presets module must stay REAL so the
// witness observes actual process-global state, not a mock's.
jest.unstable_mockModule('@/pipeline/simple-pipeline', () => ({
  simplePipeline: {
    process: jest.fn<any>().mockResolvedValue(PIPELINE_OK_RESULT),
  },
}));

const { BatchProcessingAPI } = await import('@/api/batch-processing-api');
const { adaptiveQualityPresets, QUALITY_PRESETS } = await import('@/pipeline/adaptive-quality-presets');
const { PipelineConfigError } = await import('@/pipeline/pipeline-errors');
const { simplePipeline } = await import('@/pipeline/simple-pipeline');
const { BATCH_LIMITS } = await import('@stv/core/config/limits');

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

  it('forces the mid-flight submit window — a file picked up later keeps its own job preset', async () => {
    // Deterministic companion to the concurrent leg above. Immediately-
    // resolving mocks let both submits settle before any options are built,
    // so what that leg observes of the pre-fix contamination is submit
    // ORDER, not an actual in-flight window. Here the pipeline is suspended
    // on manual deferreds: job A carries one file MORE than the worker pool
    // size, so that file's options are built only after job B has submitted
    // — exactly the interleaving the pre-fix global mutation corrupted. The
    // window is proven in-test: the pool is asserted saturated BEFORE job B
    // submits.
    const poolSize = BATCH_LIMITS.MAX_CONCURRENT_JOBS;
    const jobAFiles = Array.from({ length: poolSize + 1 }, (_, i) => stubFile(`held-${i}.wav`));
    const deferreds = new Map<string, (value: unknown) => void>();
    const processMock = simplePipeline.process as jest.Mock<any>;
    processMock.mockImplementation((input: { audioFile: { name: string } }) =>
      input.audioFile.name.startsWith('held-')
        ? new Promise((resolve) => deferreds.set(input.audioFile.name, resolve))
        : Promise.resolve(PIPELINE_OK_RESULT),
    );

    try {
      const jobA = await api.submitJob({ files: jobAFiles, preset: 'fast' });

      // Every worker suspended INSIDE simplePipeline.process; the
      // (poolSize+1)-th file has not built its options yet.
      await waitForState(() => deferreds.size === poolSize, 'the worker pool to saturate');
      expect(deferreds.size).toBe(poolSize);

      // Job B submits strictly inside job A's processing window. Pre-fix,
      // this is the moment the process-global preset flipped under job A.
      const jobB = await api.submitJob({
        files: [stubFile('midflight-b.wav')],
        preset: 'quality',
      });
      expect((await api.waitForJob(jobB.jobId, { timeoutMs: 5000 })).status).toBe('completed');

      // Release the in-flight files; a worker picks up the queued one and
      // builds its options NOW — after job B's submit.
      for (const resolve of deferreds.values()) resolve(PIPELINE_OK_RESULT);
      await waitForState(() => deferreds.size === jobAFiles.length, 'the queued file to be picked up');
      for (const resolve of deferreds.values()) resolve(PIPELINE_OK_RESULT);

      const status = await api.waitForJob(jobA.jobId, { timeoutMs: 5000 });
      expect(status.status).toBe('completed');

      // Pre-fix, exactly the late-picked file ('held-<poolSize>') came out
      // with job B's preset: the in-flight ones had built their options
      // before job B existed, the queued one after the global flip.
      const calls = processMock.mock.calls;
      expect(calls.length).toBe(jobAFiles.length + 1);
      for (const call of calls) {
        const input = call[0] as { audioFile: { name: string }; options: { maxConcurrency: number } };
        const expected = input.audioFile.name.startsWith('held-')
          ? QUALITY_PRESETS.fast
          : QUALITY_PRESETS.quality;
        expect(input.options.maxConcurrency).toBe(expected.parameters.maxConcurrency);
      }

      expect(adaptiveQualityPresets.getCurrentPreset().name).toBe('balanced');
    } finally {
      // beforeEach uses mockClear(), which KEEPS implementations — this leg
      // must put the file-wide default back for the legs that follow.
      processMock.mockReset();
      processMock.mockResolvedValue(PIPELINE_OK_RESULT);
    }
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

  it('a mid-flight global override install does not reach an explicit-preset job', async () => {
    // The other half of the isolation: not only must a job's preset not leak
    // OUT to the process-global manager, but process-global reconfiguration
    // happening while the job is in flight must not leak IN. An operator (or
    // any other component in this process) installing custom overrides
    // mid-job reconfigures preset-less work — a job that NAMED a preset
    // sidestepped that state at submit time and must keep doing so for every
    // file it has yet to pick up. Same manual-deferred window as the mid-
    // flight submit leg: the pool saturates before the global flips.
    const poolSize = BATCH_LIMITS.MAX_CONCURRENT_JOBS;
    const jobAFiles = Array.from({ length: poolSize + 1 }, (_, i) => stubFile(`held-${i}.wav`));
    const deferreds = new Map<string, (value: unknown) => void>();
    const processMock = simplePipeline.process as jest.Mock<any>;
    // The non-held branch is dead in THIS leg (every file is held-*) — it
    // mirrors the submit leg's mock shape so the two windows stay diffable.
    processMock.mockImplementation((input: { audioFile: { name: string } }) =>
      input.audioFile.name.startsWith('held-')
        ? new Promise((resolve) => deferreds.set(input.audioFile.name, resolve))
        : Promise.resolve(PIPELINE_OK_RESULT),
    );

    try {
      const jobA = await api.submitJob({ files: jobAFiles, preset: 'fast' });
      await waitForState(() => deferreds.size === poolSize, 'the worker pool to saturate');

      // The global configuration changes strictly inside job A's processing
      // window — pinned live before any queued file is released.
      adaptiveQualityPresets.setCustomOverrides({ maxConcurrency: 16 });
      expect(adaptiveQualityPresets.getCurrentPreset().name).toBe('custom');

      for (const resolve of deferreds.values()) resolve(PIPELINE_OK_RESULT);
      await waitForState(() => deferreds.size === jobAFiles.length, 'the queued file to be picked up');
      for (const resolve of deferreds.values()) resolve(PIPELINE_OK_RESULT);

      const status = await api.waitForJob(jobA.jobId, { timeoutMs: 5000 });
      expect(status.status).toBe('completed');

      // Pre-fix, the queued file resolved after the global flip and came out
      // on the overrides (16) while the in-flight ones had already built
      // their options. Every file of a preset-bearing job stays on its own
      // preset — the flip is observable only on the manager, never here.
      const calls = processMock.mock.calls;
      expect(calls.length).toBe(jobAFiles.length);
      for (const call of calls) {
        const input = call[0] as { options: { maxConcurrency: number } };
        expect(input.options.maxConcurrency).toBe(QUALITY_PRESETS.fast.parameters.maxConcurrency);
      }
    } finally {
      adaptiveQualityPresets.clearCustomOverrides();
      processMock.mockReset();
      processMock.mockResolvedValue(PIPELINE_OK_RESULT);
    }
  });

  it('processes every file of a job under its own audioFile with a fresh options object', async () => {
    // The attribution legs above derive each call's expected preset FROM
    // input.audioFile.name — self-consistent, so they cannot see a collapse
    // where the options build is hoisted out of the per-file loop and every
    // file is processed under files[0] (a plausible "options are per-job,
    // why rebuild per file?" refactor). Each submitted file must reach the
    // pipeline exactly once under its own audioFile, and each call must get
    // its own options object — a shared one would alias the request-scoped
    // includeVideoGeneration write across the job's files.
    const names = ['own-a.wav', 'own-b.wav', 'own-c.wav'];
    const { jobId } = await api.submitJob({
      files: names.map((name) => stubFile(name)),
      preset: 'quality',
    });
    const status = await api.waitForJob(jobId, { timeoutMs: 5000 });
    expect(status.status).toBe('completed');

    const calls = (simplePipeline.process as jest.Mock<any>).mock.calls;
    expect(calls.length).toBe(names.length);
    const seen = calls.map((call) => (call[0] as { audioFile: { name: string } }).audioFile.name);
    expect([...seen].sort()).toEqual([...names].sort());

    const optionObjects = calls.map((call) => (call[0] as { options: object }).options);
    for (let i = 0; i < optionObjects.length; i++) {
      for (let j = i + 1; j < optionObjects.length; j++) {
        expect(optionObjects[i]).not.toBe(optionObjects[j]);
      }
    }
  });
});
