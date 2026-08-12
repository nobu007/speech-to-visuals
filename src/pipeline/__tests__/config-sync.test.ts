/**
 * @jest-environment node
 */
/**
 * applyConfigToCollaborators — the single source for the per-collaborator field
 * mapping shared by every runtime-config-sync site (MainPipeline.nextIteration,
 * PipelineOrchestrator.runTranscription).
 *
 * The contract this locks:
 *   1. Only the {@link PipelineConfig} sections actually PRESENT in `updates`
 *      reach a collaborator — an absent section never calls updateConfig.
 *   2. Within a present section, only fields actually DEFINED are pushed — an
 *      omitted field (e.g. `model` when only `language` is updated) must NOT
 *      appear in the pushed partial at all. `updateConfig` merges via
 *      `{ ...this.config, ...partial }`, so a bare `model: undefined` would
 *      overwrite the collaborator's retained `model` with `undefined` — the
 *      partial-update-overwrites-sibling defect. Asserting the pushed partial
 *      has NO such key (not merely that its value is undefined) is what catches
 *      the regression: jest's toEqual ignores `undefined` properties, so a
 *      plain deep-equal assertion would pass for `{ model: undefined }`.
 *
 * Uses lightweight fake collaborators that record the exact partial each
 * received — no TranscriptionPipeline / SceneSegmenter / LayoutEngine
 * construction, so this isolates the mapping logic from collaborator internals.
 */
import { describe, it, expect } from '@jest/globals';
import { applyConfigToCollaborators } from '@/pipeline/config-sync';
import type { PipelineConfig } from '@/pipeline/types';

type Pushed = Record<string, unknown>;

function makeHarness() {
  const calls: { transcriber: Pushed[]; segmenter: Pushed[]; layoutEngine: Pushed[] } = {
    transcriber: [],
    segmenter: [],
    layoutEngine: [],
  };
  const recorder = (bucket: Pushed[]) => (partial: Pushed) => {
    // Shallow-copy AND snapshot the key set at call time, so later mutation of
    // the caller's object cannot rewrite history.
    bucket.push({ ...partial });
  };
  return {
    calls,
    collaborators: {
      transcriber: { updateConfig: recorder(calls.transcriber) },
      segmenter: { updateConfig: recorder(calls.segmenter) },
      layoutEngine: { updateConfig: recorder(calls.layoutEngine) },
    },
  };
}

describe('applyConfigToCollaborators', () => {
  describe('omits undefined fields within a present section (the core invariant)', () => {
    it('does NOT push transcription.model when only language is provided', () => {
      const { calls, collaborators } = makeHarness();
      applyConfigToCollaborators(collaborators, {
        transcription: { language: 'ja' },
      } as Partial<PipelineConfig>);

      expect(calls.transcriber).toHaveLength(1);
      // The pushed partial must carry ONLY `language` — no `model` key at all.
      // A bare `model: updates.transcription.model` would push `{ model: undefined,
      // language: 'ja' }` and clobber the retained model via updateConfig's merge.
      expect(Object.keys(calls.transcriber[0])).toEqual(['language']);
      expect('model' in calls.transcriber[0]).toBe(false);
    });

    it('does NOT push transcription.language when only model is provided', () => {
      const { calls, collaborators } = makeHarness();
      applyConfigToCollaborators(collaborators, {
        transcription: { model: 'large' },
      } as Partial<PipelineConfig>);

      expect(Object.keys(calls.transcriber[0])).toEqual(['model']);
      expect('language' in calls.transcriber[0]).toBe(false);
    });

    it('does NOT push absent analysis fields when only one threshold changes', () => {
      const { calls, collaborators } = makeHarness();
      applyConfigToCollaborators(collaborators, {
        analysis: { confidenceThreshold: 0.9 },
      } as Partial<PipelineConfig>);

      expect(Object.keys(calls.segmenter[0])).toEqual(['confidenceThreshold']);
      expect('minSegmentLengthMs' in calls.segmenter[0]).toBe(false);
      expect('maxSegmentLengthMs' in calls.segmenter[0]).toBe(false);
    });

    it('does NOT push absent layout fields when only dimensions change', () => {
      const { calls, collaborators } = makeHarness();
      applyConfigToCollaborators(collaborators, {
        layout: { width: 1280, height: 720 },
      } as Partial<PipelineConfig>);

      expect(Object.keys(calls.layoutEngine[0]).sort()).toEqual(['height', 'width']);
      expect('nodeWidth' in calls.layoutEngine[0]).toBe(false);
      expect('nodeHeight' in calls.layoutEngine[0]).toBe(false);
    });
  });

  describe('pushes every defined field when a section is complete', () => {
    it('pushes both transcription fields when both are provided', () => {
      const { calls, collaborators } = makeHarness();
      applyConfigToCollaborators(collaborators, {
        transcription: { model: 'large', language: 'ja' },
      } as Partial<PipelineConfig>);

      expect(calls.transcriber[0]).toEqual({ model: 'large', language: 'ja' });
    });

    it('pushes all three analysis fields when all are provided', () => {
      const { calls, collaborators } = makeHarness();
      applyConfigToCollaborators(collaborators, {
        analysis: { minSegmentLengthMs: 8000, maxSegmentLengthMs: 40000, confidenceThreshold: 0.85 },
      } as Partial<PipelineConfig>);

      expect(calls.segmenter[0]).toEqual({
        minSegmentLengthMs: 8000,
        maxSegmentLengthMs: 40000,
        confidenceThreshold: 0.85,
      });
    });

    it('pushes all four layout fields when all are provided', () => {
      const { calls, collaborators } = makeHarness();
      applyConfigToCollaborators(collaborators, {
        layout: { width: 1280, height: 720, nodeWidth: 160, nodeHeight: 80 },
      } as Partial<PipelineConfig>);

      expect(calls.layoutEngine[0]).toEqual({
        width: 1280, height: 720, nodeWidth: 160, nodeHeight: 80,
      });
    });
  });

  describe('skips absent sections (section-level guard)', () => {
    it('does not call any collaborator when updates is empty', () => {
      const { calls, collaborators } = makeHarness();
      applyConfigToCollaborators(collaborators, {});

      expect(calls.transcriber).toHaveLength(0);
      expect(calls.segmenter).toHaveLength(0);
      expect(calls.layoutEngine).toHaveLength(0);
    });

    it('only touches the transcriber when only transcription is present', () => {
      const { calls, collaborators } = makeHarness();
      applyConfigToCollaborators(collaborators, {
        transcription: { language: 'ja' },
      } as Partial<PipelineConfig>);

      expect(calls.transcriber).toHaveLength(1);
      expect(calls.segmenter).toHaveLength(0);
      expect(calls.layoutEngine).toHaveLength(0);
    });

    it('syncs multiple present sections independently', () => {
      const { calls, collaborators } = makeHarness();
      applyConfigToCollaborators(collaborators, {
        transcription: { model: 'small' },
        layout: { width: 1920 },
      } as Partial<PipelineConfig>);

      expect(calls.transcriber[0]).toEqual({ model: 'small' });
      expect(calls.segmenter).toHaveLength(0);
      expect(Object.keys(calls.layoutEngine[0])).toEqual(['width']);
    });
  });
});
