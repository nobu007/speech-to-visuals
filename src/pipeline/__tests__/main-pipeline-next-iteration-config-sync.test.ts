/**
 * @jest-environment node
 */
/**
 * MainPipeline.nextIteration — runtime config must reach the construction-once
 * collaborators.
 *
 * `nextIteration(configUpdates)` advertises "move to next iteration WITH
 * optional config updates" and folds `configUpdates` into `this.config`. But
 * the transcriber / segmenter / layoutEngine are constructed ONCE in the
 * constructor from `this.config` at that moment and never re-synced. So every
 * configUpdates override was a silent no-op at the collaborator level:
 *
 *   - `this.config` reported the NEW values (e.g. `getConfig()` and even the
 *     transcription cache key at `generateCacheKey`, which reads
 *     `this.config.transcription.model`), while
 *   - the collaborators kept running the construction-time values
 *     (`this.transcriber` transcribed with the OLD model, etc.).
 *
 * Concretely, after `nextIteration({ transcription: { model: 'large' } })` the
 * cache key was tagged `…:large` but the transcription was produced with the
 * original `base` model — the cache key lied about what produced its entry.
 *
 * Same construction-once-collaborator / runtime-config-not-propagated class as
 * the orchestrator→{segmenter, transcriber, layoutEngine} syncs (REQ-039/041/
 * 042) and the SimplePipeline {language, maxScenes} wiring (REQ-043/044). All
 * three collaborators already expose `updateConfig`; this test pins that
 * `nextIteration` actually calls it for each config-bearing section. The
 * DiagramDetector has no config and is intentionally not asserted.
 */
import { describe, it, expect, jest } from '@jest/globals';
import { MainPipeline } from '@/pipeline/main-pipeline';
import type { PipelineConfig } from '@/pipeline/types';

interface ConfigAwareCollaborator {
  updateConfig(partial: Record<string, unknown>): void;
}

interface MainPipelineInternals {
  transcriber: ConfigAwareCollaborator;
  segmenter: ConfigAwareCollaborator;
  layoutEngine: ConfigAwareCollaborator;
}

function pipelineWithSpies(): {
  pipeline: MainPipeline;
  transcriber: jest.SpyInstance;
  segmenter: jest.SpyInstance;
  layoutEngine: jest.SpyInstance;
} {
  const pipeline = new MainPipeline({});
  const internals = pipeline as unknown as MainPipelineInternals;
  return {
    pipeline,
    transcriber: jest.spyOn(internals.transcriber, 'updateConfig'),
    segmenter: jest.spyOn(internals.segmenter, 'updateConfig'),
    layoutEngine: jest.spyOn(internals.layoutEngine, 'updateConfig'),
  };
}

describe('MainPipeline.nextIteration — propagates runtime config to construction-once collaborators', () => {
  it('syncs transcription config (model + language) into the transcriber', () => {
    const { pipeline, transcriber } = pipelineWithSpies();

    pipeline.nextIteration({
      transcription: { model: 'large', language: 'ja' },
    } as Partial<PipelineConfig>);

    expect(transcriber).toHaveBeenCalledWith({
      model: 'large',
      language: 'ja',
    });
  });

  it('syncs analysis thresholds into the segmenter', () => {
    const { pipeline, segmenter } = pipelineWithSpies();

    pipeline.nextIteration({
      analysis: {
        minSegmentLengthMs: 8000,
        maxSegmentLengthMs: 40000,
        confidenceThreshold: 0.85,
      },
    } as Partial<PipelineConfig>);

    expect(segmenter).toHaveBeenCalledWith({
      minSegmentLengthMs: 8000,
      maxSegmentLengthMs: 40000,
      confidenceThreshold: 0.85,
    });
  });

  it('syncs layout dimensions into the layout engine', () => {
    const { pipeline, layoutEngine } = pipelineWithSpies();

    pipeline.nextIteration({
      layout: { width: 1280, height: 720, nodeWidth: 160, nodeHeight: 80 },
    } as Partial<PipelineConfig>);

    expect(layoutEngine).toHaveBeenCalledWith({
      width: 1280,
      height: 720,
      nodeWidth: 160,
      nodeHeight: 80,
    });
  });

  it('does not call updateConfig when configUpdates omits a section (guard correctness)', () => {
    // Only transcription changes → segmenter/layoutEngine must not be touched.
    const { pipeline, segmenter, layoutEngine } = pipelineWithSpies();

    pipeline.nextIteration({
      transcription: { model: 'small', language: 'en' },
    } as Partial<PipelineConfig>);

    expect(segmenter).not.toHaveBeenCalled();
    expect(layoutEngine).not.toHaveBeenCalled();
  });

  it('leaves collaborators untouched when nextIteration() is called with no config', () => {
    // The live framework-integrated loop calls `nextIteration()` with no args.
    // That path must not spuriously reset/overwrite collaborator config.
    const { pipeline, transcriber, segmenter, layoutEngine } = pipelineWithSpies();

    pipeline.nextIteration();

    expect(transcriber).not.toHaveBeenCalled();
    expect(segmenter).not.toHaveBeenCalled();
    expect(layoutEngine).not.toHaveBeenCalled();
  });
});
