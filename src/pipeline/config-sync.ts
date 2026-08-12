import type { PipelineConfig } from './types';

/**
 * A collaborator whose effective config is fixed at construction time and must
 * be re-synced when runtime/user config changes. Each exposes `updateConfig`,
 * which performs a LIVE merge into its own `this.config` (read again on the next
 * stage run), so a pre-stage sync takes effect for the current run without
 * reconstructing the collaborator.
 *
 * Declared with method shorthand so the bivariant method check accepts the
 * concrete collaborators (TranscriptionPipeline / SceneSegmenter / LayoutEngine)
 * whose `updateConfig` takes a narrower, collaborator-specific partial — no cast
 * is needed at the call site.
 */
export interface ConfigurableCollaborator {
  updateConfig(partial: Record<string, unknown>): void;
}

/** The three construction-once, config-bearing collaborators of a pipeline. */
export interface ConfigurableCollaborators {
  transcriber: ConfigurableCollaborator;
  segmenter: ConfigurableCollaborator;
  layoutEngine: ConfigurableCollaborator;
}

/**
 * Runtime-config update shape the helper actually consumes: each section
 * optional, and within a present section EVERY field optional.
 *
 * This is intentionally narrower than `Partial<PipelineConfig>`, which only
 * makes the TOP-level sections optional while leaving each section's required
 * fields (e.g. `transcription.model`) mandatory. Against `Partial<PipelineConfig>`
 * a genuine partial-section update — `{ transcription: { language: 'ja' } }`
 * with `model` omitted — does NOT type-check (model is required), forcing a
 * cast at every call site that supplies a real partial. But the helper reads
 * every field defensively (`!== undefined`), so partial fields are valid at
 * runtime; this type makes that contract expressible at the type level so call
 * sites pass real partials directly instead of `as Partial<PipelineConfig>`.
 *
 * A complete section (and therefore a full `PipelineConfig`, passed by
 * {@link PipelineOrchestrator.runTranscription}) and a `Partial<PipelineConfig>`
 * (passed by {@link MainPipeline.applyRuntimeConfig}, which also carries an
 * `output` section this helper ignores) both remain assignable: required→optional
 * is a widening, and excess/ignored keys on a variable-typed argument are fine.
 */
export type PipelineConfigSyncUpdate = {
  transcription?: Partial<PipelineConfig['transcription']>;
  analysis?: Partial<PipelineConfig['analysis']>;
  layout?: Partial<PipelineConfig['layout']>;
};

/**
 * Push only the {@link PipelineConfig} sections actually present in `updates`
 * into the construction-once collaborators — and within each section, only the
 * fields actually defined. This is the single source for the per-collaborator
 * field mapping, shared by every runtime-config-sync site so the
 * construction-once-collaborator / runtime-config-not-propagated class cannot
 * be re-introduced by hand-copying guards at a new call site.
 *
 * Why every field is a conditional spread (not a bare assignment):
 * a collaborator built once keeps its construction-time defaults; a caller that
 * updates only PART of a section (e.g. `nextIteration({ transcription: {
 * language: 'ja' } })` with `model` omitted) must NOT clobber the retained
 * field. `updateConfig` merges via `{ ...this.config, ...partial }`, so a bare
 * `model: updates.transcription.model` (= `undefined` when omitted) would
 * overwrite the construction-time `model` with `undefined` — the same
 * partial-update-overwrites-sibling defect. The conditional spread guarantees an
 * omitted field is simply not present in the pushed partial, leaving the
 * collaborator's retained value intact. (DiagramDetector carries no config and
 * is intentionally not part of this interface.)
 *
 * Callers:
 *  - {@link MainPipeline.nextIteration} / {@link MainPipeline.execute}: pass a
 *    *partial* `configUpdates` / `input.config`, so only present sections/fields
 *    propagate (the partial-update path).
 *  - {@link PipelineOrchestrator.runTranscription}: passes the fully-merged
 *    `pipelineConfig` (defaults ⊕ user ⊕ auto-tuner), so every defined field
 *    propagates — identical to the previous inline guards, now centralized.
 *  - {@link SimplePipeline.process}: maps its narrower `options` surface
 *    (only `transcription.language` is mappable today) onto a partial
 *    `PipelineConfigSyncUpdate` and routes through the helper — eliminating the
 *    last hand-copied config-sync guard (REQ-043 was previously an inline
 *    `transcription.updateConfig({ language })`).
 */
export function applyConfigToCollaborators(
  collaborators: ConfigurableCollaborators,
  updates: PipelineConfigSyncUpdate,
): void {
  if (updates.transcription) {
    const { model, language } = updates.transcription;
    collaborators.transcriber.updateConfig({
      ...(model !== undefined ? { model } : {}),
      ...(language !== undefined ? { language } : {}),
    });
  }

  if (updates.analysis) {
    const { minSegmentLengthMs, maxSegmentLengthMs, confidenceThreshold } = updates.analysis;
    collaborators.segmenter.updateConfig({
      ...(minSegmentLengthMs !== undefined ? { minSegmentLengthMs } : {}),
      ...(maxSegmentLengthMs !== undefined ? { maxSegmentLengthMs } : {}),
      ...(confidenceThreshold !== undefined ? { confidenceThreshold } : {}),
    });
  }

  if (updates.layout) {
    const { width, height, nodeWidth, nodeHeight } = updates.layout;
    collaborators.layoutEngine.updateConfig({
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
      ...(nodeWidth !== undefined ? { nodeWidth } : {}),
      ...(nodeHeight !== undefined ? { nodeHeight } : {}),
    });
  }
}
