/**
 * @jest-environment node
 */
/**
 * MainPipeline.execute — runtime config (`input.config`) must reach the
 * construction-once collaborators. (REQ-047)
 *
 * `execute(input)` advertises an optional `input.config: PipelineConfig`
 * override (PipelineInput.config) and is the primary live entry point (root
 * route + framework-integrated pipeline). But the transcriber / segmenter /
 * layoutEngine are constructed ONCE in the constructor from `this.config` at
 * that moment and, unlike `nextIteration` (REQ-045) and the orchestrator's
 * execute() (which merges input.config into pipelineConfig and re-syncs via
 * applyConfigToCollaborators), MainPipeline.execute() never re-synced
 * input.config. So a per-run override was a silent no-op at the collaborator
 * level: getConfig() / the transcription cache key at generateCacheKey reported
 * the NEW value while the collaborators kept running the construction-time one.
 *
 * execute() was the LAST runtime-config entry point with no re-sync site — the
 * proactive sweep of every construction-once collaborator built in a constructor
 * that exposes updateConfig. The fix routes execute()'s input.config through the
 * SAME `applyRuntimeConfig` helper nextIteration uses, so the two entry points
 * cannot drift.
 *
 * Two layers exercised:
 *   1. applyRuntimeConfig itself (shared with nextIteration) — per-section
 *      this.config merge + collaborator sync + partial-field preservation,
 *      isolated via prototype-stub-bind (like main-pipeline-cache-key.test) so
 *      the heavy pipeline never runs.
 *   2. execute() wiring — spies the REAL collaborators' updateConfig and
 *      short-circuits the stages/framework, asserting execute() actually
 *      triggers the sync before any stage runs.
 */
import { describe, it, expect, jest } from '@jest/globals';
import { MainPipeline } from '@/pipeline/main-pipeline';
import type { PipelineConfig, PipelineInput, PipelineResult } from '@/pipeline/types';

interface ConfigAwareCollaborator {
  updateConfig(partial: Record<string, unknown>): void;
}

interface MainPipelineInternals {
  transcriber: ConfigAwareCollaborator & { config: { model: string } };
  segmenter: ConfigAwareCollaborator;
  layoutEngine: ConfigAwareCollaborator;
}

/** A full PipelineConfig matching the constructor defaults (model 'base'). */
function defaultConfig(): PipelineConfig {
  return {
    transcription: { model: 'base' },
    analysis: { minSegmentLengthMs: 3000, maxSegmentLengthMs: 30000, confidenceThreshold: 0.7 },
    layout: { width: 1920, height: 1080, nodeWidth: 120, nodeHeight: 60 },
    output: { fps: 30, videoDuration: 60, includeAudio: true },
  };
}

// ---------------------------------------------------------------------------
// Layer 1: applyRuntimeConfig in isolation (prototype-stub-bind).
// ---------------------------------------------------------------------------

type ApplyRuntimeConfig = (updates: Partial<PipelineConfig>) => void;

interface StubCtx {
  config: PipelineConfig;
  transcriber: ConfigAwareCollaborator;
  segmenter: ConfigAwareCollaborator;
  layoutEngine: ConfigAwareCollaborator;
}

/** Bind the private applyRuntimeConfig to a stub carrying only what it reads. */
function runtimeFor(initial: PipelineConfig): { ctx: StubCtx; apply: ApplyRuntimeConfig } {
  const ctx: StubCtx = {
    config: initial,
    transcriber: { updateConfig: jest.fn() },
    segmenter: { updateConfig: jest.fn() },
    layoutEngine: { updateConfig: jest.fn() },
  };
  const fn = (MainPipeline as unknown as {
    prototype: { applyRuntimeConfig: ApplyRuntimeConfig };
  }).prototype.applyRuntimeConfig;
  return { ctx, apply: fn.bind(ctx as unknown as MainPipeline) };
}

describe('MainPipeline.applyRuntimeConfig — per-section merge + collaborator sync', () => {
  it('syncs transcription (model + language) into the transcriber', () => {
    const { ctx, apply } = runtimeFor(defaultConfig());

    apply({ transcription: { model: 'large', language: 'ja' } } as Partial<PipelineConfig>);

    expect(ctx.transcriber.updateConfig).toHaveBeenCalledWith({
      model: 'large',
      language: 'ja',
    });
    expect(ctx.config.transcription.model).toBe('large');
    expect(ctx.config.transcription.language).toBe('ja');
  });

  it('syncs analysis thresholds into the segmenter', () => {
    const { ctx, apply } = runtimeFor(defaultConfig());

    apply({
      analysis: { minSegmentLengthMs: 8000, maxSegmentLengthMs: 40000, confidenceThreshold: 0.85 },
    } as Partial<PipelineConfig>);

    expect(ctx.segmenter.updateConfig).toHaveBeenCalledWith({
      minSegmentLengthMs: 8000,
      maxSegmentLengthMs: 40000,
      confidenceThreshold: 0.85,
    });
  });

  it('syncs layout dimensions into the layout engine', () => {
    const { ctx, apply } = runtimeFor(defaultConfig());

    apply({ layout: { width: 1280, height: 720, nodeWidth: 160, nodeHeight: 80 } } as Partial<PipelineConfig>);

    expect(ctx.layoutEngine.updateConfig).toHaveBeenCalledWith({
      width: 1280,
      height: 720,
      nodeWidth: 160,
      nodeHeight: 80,
    });
  });

  it('does not call updateConfig for a section the update omits', () => {
    // Only transcription changes → segmenter/layoutEngine must not be touched.
    const { ctx, apply } = runtimeFor(defaultConfig());

    apply({ transcription: { model: 'small' } } as Partial<PipelineConfig>);

    expect(ctx.transcriber.updateConfig).toHaveBeenCalled();
    expect(ctx.segmenter.updateConfig).not.toHaveBeenCalled();
    expect(ctx.layoutEngine.updateConfig).not.toHaveBeenCalled();
  });

  it('merges the output section into this.config even though it has no collaborator', () => {
    const { ctx, apply } = runtimeFor(defaultConfig());

    apply({ output: { fps: 60 } } as Partial<PipelineConfig>);

    // No collaborator carries output config.
    expect(ctx.transcriber.updateConfig).not.toHaveBeenCalled();
    expect(ctx.segmenter.updateConfig).not.toHaveBeenCalled();
    expect(ctx.layoutEngine.updateConfig).not.toHaveBeenCalled();
    // But this.config.output reflects the partial update, retaining siblings.
    expect(ctx.config.output.fps).toBe(60);
    expect(ctx.config.output.videoDuration).toBe(60);
    expect(ctx.config.output.includeAudio).toBe(true);
  });

  it('preserves the transcriber model when only language is updated (partial section)', () => {
    // REQ-045 hardening carried through the shared helper. updateConfig must NOT
    // receive `model: undefined` (its merge would clobber 'base'), and the
    // this.config merge must deep-merge per section, not replace it.
    const { ctx, apply } = runtimeFor(defaultConfig());
    expect(ctx.config.transcription.model).toBe('base');

    apply({ transcription: { language: 'ja' } } as Partial<PipelineConfig>);

    // toEqual ignores undefined, so assert the absence of the key directly.
    const pushed = ctx.transcriber.updateConfig.mock.calls[0][0];
    expect('model' in pushed).toBe(false);
    expect(pushed).toEqual({ language: 'ja' });
    // this.config layer: retained model survives the partial-section update.
    expect(ctx.config.transcription.model).toBe('base');
    expect(ctx.config.transcription.language).toBe('ja');
  });
});

// ---------------------------------------------------------------------------
// Layer 2: execute() wiring (real collaborators + spy, stages short-circuited).
// ---------------------------------------------------------------------------

function pipelineForExecuteWiring(): {
  pipeline: MainPipeline;
  transcriber: jest.SpyInstance;
  segmenter: jest.SpyInstance;
  layoutEngine: jest.SpyInstance;
} {
  const pipeline = new MainPipeline({});
  const internals = pipeline as unknown as MainPipelineInternals;
  // Short-circuit: execute() runs its REAL body (incl. the config sync under
  // test at the very top), but the framework + the framework-integrated stage
  // runner + post-run iteration are stubbed so it resolves deterministically
  // without transcription/whisper/layout work. The sync happens BEFORE any of
  // these, so the updateConfig spies are valid regardless.
  (pipeline as unknown as { framework: { startCycle: jest.Mock } }).framework = {
    startCycle: jest.fn().mockResolvedValue(undefined),
  };
  jest
    .spyOn(
      pipeline as unknown as {
        executeFrameworkIntegratedPipeline: (input: PipelineInput, startTime: number) => Promise<PipelineResult>;
      },
      'executeFrameworkIntegratedPipeline',
    )
    .mockResolvedValue({
      success: true,
      scenes: [],
      audioUrl: '',
      duration: 0,
      processingTime: 0,
      stages: [],
    } as PipelineResult);
  jest
    .spyOn(
      pipeline as unknown as { evaluateAndIterate: (result: PipelineResult, startTime: number) => Promise<void> },
      'evaluateAndIterate',
    )
    .mockResolvedValue(undefined);

  return {
    pipeline,
    transcriber: jest.spyOn(internals.transcriber, 'updateConfig'),
    segmenter: jest.spyOn(internals.segmenter, 'updateConfig'),
    layoutEngine: jest.spyOn(internals.layoutEngine, 'updateConfig'),
  };
}

describe('MainPipeline.execute — propagates input.config to construction-once collaborators', () => {
  it('syncs transcription config before stage 1 runs', async () => {
    const { pipeline, transcriber } = pipelineForExecuteWiring();

    await pipeline.execute({
      audioFile: new File(['x'], 'a.wav', { type: 'audio/wav' }),
      config: { transcription: { model: 'large', language: 'ja' } } as Partial<PipelineConfig>,
    });

    expect(transcriber).toHaveBeenCalledWith({ model: 'large', language: 'ja' });
  });

  it('syncs analysis thresholds into the segmenter', async () => {
    const { pipeline, segmenter } = pipelineForExecuteWiring();

    await pipeline.execute({
      audioFile: new File(['x'], 'a.wav', { type: 'audio/wav' }),
      config: {
        analysis: { minSegmentLengthMs: 8000, maxSegmentLengthMs: 40000, confidenceThreshold: 0.85 },
      } as Partial<PipelineConfig>,
    });

    expect(segmenter).toHaveBeenCalledWith({
      minSegmentLengthMs: 8000,
      maxSegmentLengthMs: 40000,
      confidenceThreshold: 0.85,
    });
  });

  it('syncs layout dimensions into the layout engine', async () => {
    const { pipeline, layoutEngine } = pipelineForExecuteWiring();

    await pipeline.execute({
      audioFile: new File(['x'], 'a.wav', { type: 'audio/wav' }),
      config: { layout: { width: 1280, height: 720, nodeWidth: 160, nodeHeight: 80 } } as Partial<PipelineConfig>,
    });

    expect(layoutEngine).toHaveBeenCalledWith({
      width: 1280,
      height: 720,
      nodeWidth: 160,
      nodeHeight: 80,
    });
  });

  it('does NOT re-sync collaborators when input.config is absent', async () => {
    // The default/no-override execute path must not spuriously touch
    // collaborators — only an explicit input.config triggers a sync.
    const { pipeline, transcriber, segmenter, layoutEngine } = pipelineForExecuteWiring();

    await pipeline.execute({
      audioFile: new File(['x'], 'a.wav', { type: 'audio/wav' }),
    });

    expect(transcriber).not.toHaveBeenCalled();
    expect(segmenter).not.toHaveBeenCalled();
    expect(layoutEngine).not.toHaveBeenCalled();
  });

  it('preserves the construction-time model on a partial transcription update', async () => {
    // REQ-045 hardening via the shared helper: execute({config:{transcription:
    // {language:'ja'}}}) updates only language; the construction-time model
    // 'base' must survive at BOTH the collaborator and getConfig() layers.
    const pipeline = new MainPipeline({});
    const transcriber = (pipeline as unknown as MainPipelineInternals).transcriber;
    (pipeline as unknown as { framework: { startCycle: jest.Mock } }).framework = {
      startCycle: jest.fn().mockResolvedValue(undefined),
    };
    jest
      .spyOn(
        pipeline as unknown as {
          executeFrameworkIntegratedPipeline: (input: PipelineInput, startTime: number) => Promise<PipelineResult>;
        },
        'executeFrameworkIntegratedPipeline',
      )
      .mockResolvedValue({
        success: true,
        scenes: [],
        audioUrl: '',
        duration: 0,
        processingTime: 0,
        stages: [],
      } as PipelineResult);
    jest
      .spyOn(
        pipeline as unknown as { evaluateAndIterate: (result: PipelineResult, startTime: number) => Promise<void> },
        'evaluateAndIterate',
      )
      .mockResolvedValue(undefined);

    expect(transcriber.config.model).toBe('base'); // construction default
    expect(pipeline.getConfig().transcription.model).toBe('base');

    await pipeline.execute({
      audioFile: new File(['x'], 'a.wav', { type: 'audio/wav' }),
      config: { transcription: { language: 'ja' } } as Partial<PipelineConfig>,
    });

    // Collaborator layer: model never overwritten with undefined.
    expect(transcriber.config.model).toBe('base');
    expect(transcriber.config.language).toBe('ja');
    // this.config layer: getConfig() still reports the retained model.
    expect(pipeline.getConfig().transcription.model).toBe('base');
    expect(pipeline.getConfig().transcription.language).toBe('ja');
  });
});
