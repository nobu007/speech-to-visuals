/**
 * @jest-environment node
 */
/**
 * Boundary → generation-output audit for the construction-once-collaborator /
 * runtime-config-not-propagated defect class (REQ-039..051).
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The sibling `config-sync.test.ts` verifies the per-collaborator FIELD MAPPING
 * with FAKE collaborators (objects that merely record the pushed partial). That
 * locks "the right partial reached updateConfig" but NOT "generation then reads
 * the new value" — the exact gap REQ-051 exposed: LayoutEngine.updateConfig used
 * to reassign a NEW `this.config` object, so every sub-strategy that captured the
 * `this.config` reference in the constructor kept reading the STALE original.
 * `getConfig()` (reads `this.config` directly) reported the new value while
 * `dagreLayoutStrategy.applyLayout` (reads the captured ref) kept the old one —
 * a silent no-op where the boundary field never reached generation. The fake-
 * collaborator test passed throughout because it never ran generation.
 *
 * This file closes that gap as a durable regression pin: it wires the REAL
 * collaborators through the SAME `applyConfigToCollaborators` helper every
 * runtime-config-sync site uses, then runs the REAL generation path and asserts
 * the OUTPUT reflects the boundary value. If anyone reverts the REQ-051
 * `Object.assign` (back to a spread reassignment), or re-introduces a stale-ref
 * sub-strategy in any collaborator, the LayoutEngine case below goes RED.
 *
 * VERIFICATION LEVEL PER COLLABORATOR (and why each suffices)
 * ----------------------------------------------------------
 * The stale-ref failure mode ONLY affects collaborators that hand `this.config`
 * BY REFERENCE to a sub-strategy constructed once. Only LayoutEngine does that,
 * so only LayoutEngine needs a true generation-OUTPUT assertion:
 *
 *   • LayoutEngine   — generation OUTPUT (node w/h). Sub-strategies (dagre,
 *     fallback, overlap resolver, optimizer, evaluator) capture `this.config`
 *     by ref → stale-ref risk → MUST verify at generation output.
 *   • SceneSegmenter — live `this.config` read. Monolithic: `segment()` and
 *     every helper read `this.config.X` directly (no captured-ref sub-strategy),
 *     so the value `getConfig()` reports IS the value generation reads. A
 *     config-level check is therefore a faithful generation-read proxy.
 *   • TranscriptionPipeline — explicit re-sync. Holds the inner
 *     `WhisperTranscriber` as a field and re-syncs it on every updateConfig
 *     (no shared-ref leak), and WhisperTranscriber reads its config live at
 *     transcribe(). Verifying the inner engine received the partial is the
 *     boundary→live-read contract.
 *
 * AUDIT RESULT (the "RED-verify each field" deliverable)
 * ------------------------------------------------------
 * The boundary itself is additionally STRUCTURALLY GUARDED by
 * `config-sync-forwarding-exhaustive.test.ts` (REQ-053): a source-anchored pin
 * asserting every PipelineConfig.{transcription,analysis,layout} field is
 * forwarded by applyConfigToCollaborators, so a NEW field added to the type
 * without routing through the helper fails loudly instead of becoming the next
 * silent dead option. The per-field verdicts below are the behavioral read;
 * that file is the structural one.
 *
 * SimplePipelineInput.options → generation:
 *   language .............. WIRED (REQ-043, simple-pipeline.test.ts)
 *   maxScenes ............. WIRED (REQ-044, generation-site cap, tested)
 *   layoutType ............ WIRED (REQ-049, scene.type override, tested)
 *   includeVideoGeneration  WIRED (gates video stage, tested)
 *   videoOptions .......... WIRED (spread into per-call VideoGenerator)
 *   useEnhancedLayout ..... WIRED (engine selection, tested)
 *   layoutQuality ......... WIRED (→ useEnhancedLayout, tested)
 *   enableParallelProcessing WIRED (exec path, tested)
 *   maxConcurrency ........ WIRED (batch size, tested)
 *   overlapTolerance ...... DEAD — design-heavy (EnhancedZeroOverlapLayoutEngine
 *                          .overlapDetectionMode is never read at generation;
 *                          wiring needs engine-level feature work). DEFERRED.
 *
 * PipelineConfig → generation (MainPipeline / PipelineOrchestrator):
 *   transcription.{model,language} ........ WIRED (this file + transcriber.test)
 *   analysis.{min,max,confidence} ......... WIRED (config-sync + this file)
 *   layout.{width,height,nodeWidth,nodeHeight} WIRED (this file — generation pin)
 *   output.fps ............................ WIRED (Orchestrator.runRendering →
 *                                          generateRenderPlan)
 *   output.videoDuration .................. PARTIAL — auto-tuner `duration` hint
 *                                          only (runTranscription), never an
 *                                          output length control. Known.
 *   output.includeAudio ................... DEAD — no encoding stage in either
 *                                          pipeline consumes it (Orchestrator
 *                                          emits a frame RenderPlan, MainPipeline
 *                                          emits scenes; the only audio-muxing
 *                                          path is SimplePipeline's separate
 *                                          `videoOptions.includeAudio`). DEFERRED
 *                                          (needs an encoding stage = feature).
 */
import { describe, it, expect } from '@jest/globals';
import { LayoutEngine } from '@/visualization';
import { applyConfigToCollaborators } from '@/pipeline/config-sync';
import type { ConfigurableCollaborators } from '@/pipeline/config-sync';
import type { NodeDatum, EdgeDatum } from '@/types/diagram';
import type { AnalysisConfig } from '@/analysis/types';

/** No-op collaborators for the sections a given test does not exercise. */
function stubCollaborator(): { updateConfig: (p: Record<string, unknown>) => void } {
  return { updateConfig: () => undefined };
}

/**
 * Build the REAL collaborator set the helper expects, swapping in one real
 * collaborator under test and stubbing the rest. Mirrors how MainPipeline /
 * PipelineOrchestrator call the helper (all three always present).
 */
function collaboratorsWith(
  real: Partial<ConfigurableCollaborators>,
): ConfigurableCollaborators {
  return {
    transcriber: real.transcriber ?? stubCollaborator(),
    segmenter: real.segmenter ?? stubCollaborator(),
    layoutEngine: real.layoutEngine ?? stubCollaborator(),
  };
}

// ---------------------------------------------------------------------------
// LayoutEngine: boundary config → generation OUTPUT (the REQ-051 regression pin)
// ---------------------------------------------------------------------------

describe('boundary config reaches generation output — LayoutEngine (REQ-051 pin)', () => {
  // DagreLayoutStrategy applies config.nodeHeight DIRECTLY to every output node
  // (`height: this.config.nodeHeight`) and config.nodeWidth as the floor of
  // calculateNodeWidth (`Math.max(nodeWidth, ...)`), so for short-label nodes the
  // output w === nodeWidth and h === nodeHeight exactly. A distinctive override
  // value therefore propagates 1:1 to generation output iff the sub-strategy
  // read the UPDATED config — i.e. iff updateConfig mutated in place (REQ-051)
  // rather than reassigning a new object the sub-strategy never sees.
  const NODE_W = 300;
  const NODE_H = 140;

  const nodes: NodeDatum[] = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ];
  const edges: EdgeDatum[] = [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c' },
  ];

  it('nodeWidth/nodeHeight pushed via applyConfigToCollaborators reach node w/h', async () => {
    // Constructed with DEFAULTS (nodeWidth 120 / nodeHeight 60) — the same way
    // PipelineOrchestrator constructs its LayoutEngine (no node dims at build
    // time; they arrive only via the runtime sync under test).
    const engine = new LayoutEngine();

    // The boundary→collaborator bridge every runtime-config site shares.
    applyConfigToCollaborators(
      collaboratorsWith({ layoutEngine: engine }),
      { layout: { nodeWidth: NODE_W, nodeHeight: NODE_H } },
    );

    // < 20 nodes, not simple mode → the dagre path that captured `this.config`.
    const result = await engine.generateLayout(nodes, edges, 'flow', 1);

    expect(result.success).toBe(true);
    expect(result.layout.nodes.length).toBe(nodes.length);
    for (const node of result.layout.nodes) {
      // Direct application → exact match. A stale ref would yield the default 60.
      expect(node.h).toBe(NODE_H);
      // Short labels ⇒ calculateNodeWidth floors at nodeWidth ⇒ exact match.
      // A stale ref would yield the default 120.
      expect(node.w).toBe(NODE_W);
    }
  });

  it('respects only the present field on a partial layout update', async () => {
    // Only nodeHeight changes; nodeWidth must retain its default (120) — the
    // partial-field-preservation contract shared with the segmenter/transcriber.
    const engine = new LayoutEngine();

    applyConfigToCollaborators(
      collaboratorsWith({ layoutEngine: engine }),
      { layout: { nodeHeight: NODE_H } },
    );

    const result = await engine.generateLayout(nodes, edges, 'flow', 1);

    expect(result.success).toBe(true);
    for (const node of result.layout.nodes) {
      expect(node.h).toBe(NODE_H); // pushed
      expect(node.w).toBe(120); // retained construction default, not clobbered
    }
  });
});

// ---------------------------------------------------------------------------
// SceneSegmenter: boundary config → live this.config read
// ---------------------------------------------------------------------------

describe('boundary config reaches generation read — SceneSegmenter (monolithic)', () => {
  // SceneSegmenter exposes no public config getter, but it is monolithic:
  // `segment()` and every helper read `this.config.X` directly — no sub-strategy
  // holds a captured ref — so the private `this.config` IS the value generation
  // reads (no stale-ref failure mode is possible). Reading it back is therefore
  // a faithful generation-read proxy, stronger than a fake-collaborator call
  // assertion because it verifies the value the REAL segment() will consume.
  function readConfig(segmenter: { config: AnalysisConfig }): AnalysisConfig {
    return segmenter.config;
  }

  it('analysis thresholds pushed via applyConfigToCollaborators update the live config', async () => {
    const { SceneSegmenter } = await import('@/analysis');
    const segmenter = new SceneSegmenter();

    applyConfigToCollaborators(
      collaboratorsWith({ segmenter }),
      {
        analysis: {
          minSegmentLengthMs: 8000,
          maxSegmentLengthMs: 40000,
          confidenceThreshold: 0.85,
        },
      },
    );

    const config = readConfig(segmenter as unknown as { config: AnalysisConfig });
    expect(config.minSegmentLengthMs).toBe(8000);
    expect(config.maxSegmentLengthMs).toBe(40000);
    expect(config.confidenceThreshold).toBe(0.85);
  });

  it('preserves retained analysis fields on a single-field partial update', async () => {
    const { SceneSegmenter } = await import('@/analysis');
    const segmenter = new SceneSegmenter();
    const before = readConfig(segmenter as unknown as { config: AnalysisConfig });
    expect(before.maxSegmentLengthMs).toBeDefined();

    applyConfigToCollaborators(
      collaboratorsWith({ segmenter }),
      { analysis: { confidenceThreshold: 0.9 } },
    );

    const after = readConfig(segmenter as unknown as { config: AnalysisConfig });
    expect(after.confidenceThreshold).toBe(0.9); // pushed
    // minSegmentLengthMs / maxSegmentLengthMs retained, not overwritten with
    // undefined by the single-field partial.
    expect(after.minSegmentLengthMs).toBe(before.minSegmentLengthMs);
    expect(after.maxSegmentLengthMs).toBe(before.maxSegmentLengthMs);
  });
});

// ---------------------------------------------------------------------------
// TranscriptionPipeline: boundary config → inner WhisperTranscriber re-sync
// ---------------------------------------------------------------------------

describe('boundary config reaches live engine — TranscriptionPipeline (explicit re-sync)', () => {
  it('transcription fields pushed via applyConfigToCollaborators reach the inner WhisperTranscriber', async () => {
    // TranscriptionPipeline holds the inner WhisperTranscriber as a field and
    // re-syncs it explicitly on updateConfig (no shared-ref leak); Whisper reads
    // its config live at transcribe(). The forwarding call IS the boundary→live-
    // read contract — verified directly to mirror the wrapper's REQ-041 wiring.
    const { TranscriptionPipeline } = await import('@/transcription');
    const pipeline = new TranscriptionPipeline();
    const internals = pipeline as unknown as {
      whisperTranscriber: { updateConfig: (p: Record<string, unknown>) => void };
    };
    // Spy on the real inner engine's updateConfig (replace, then restore).
    const original = internals.whisperTranscriber.updateConfig.bind(
      internals.whisperTranscriber,
    );
    let received: Record<string, unknown> | undefined;
    internals.whisperTranscriber.updateConfig = (p) => {
      received = p;
    };
    try {
      applyConfigToCollaborators(
        collaboratorsWith({ transcriber: pipeline as unknown as ConfigurableCollaborators['transcriber'] }),
        { transcription: { language: 'ja' } },
      );
    } finally {
      internals.whisperTranscriber.updateConfig = original;
    }

    // The wrapper mapped language through to the inner engine; model was omitted
    // from the partial so it must NOT appear (no clobber of the retained model).
    expect(received).toEqual({ language: 'ja' });
    expect(received).not.toHaveProperty('model');
  });
});
