/**
 * Regression: prepareSingleScene must route the detector `type` through the
 * canonical sanitizeDiagramType guard, mirroring the sibling pipelines.
 *
 * MainPipeline.prepareScenesEnhanced (`sanitizeDiagramType(analysis.type)`) and
 * SimplePipeline (`sanitizeDiagramType(diagramAnalysis.type)`) both delegate the
 * scene's type field to the canonical guard. PipelineOrchestrator.prepareSingleScene
 * instead did `(analysis?.type ?? 'flow') as DiagramType` — a raw cross-cast that
 * only coalesces null/undefined, letting any non-canonical STRING (an unmapped
 * LLM label, a stale cache entry, a future type not yet in the canon) propagate
 * onto scene.type unsanitized. Note the orchestrator even sanitizes the SAME
 * value for the LAYOUT engine (generateSingleLayout: `sanitizeDiagramType(diag.type)`),
 * so the scene was labeled with a type the layout was never computed for.
 *
 * This is the invariant-split / missed-sibling-site class: the switch-parity
 * work delegates type validity to isDiagramType/DIAGRAM_TYPES, but this
 * field-assignment shape escaped that sweep. The guard prevents re-drift.
 */
import { PipelineOrchestrator } from '@/pipeline/pipeline-orchestrator';
import type { SceneGraph } from '@stv/core/types/diagram';

type PrepArgs = [unknown, number, unknown[], unknown[]];

function prepare(
  orchestrator: PipelineOrchestrator,
  analysis: Record<string, unknown>,
  segment: Record<string, unknown> = { startMs: 0, endMs: 5000, summary: 's', keyphrases: [] },
  index = 0,
): SceneGraph {
  return (orchestrator as unknown as {
    prepareSingleScene: (...args: PrepArgs) => SceneGraph;
  }).prepareSingleScene(
    { segment, analysis, layout: undefined },
    index,
    [segment],
    [analysis],
  );
}

describe('PipelineOrchestrator.prepareSingleScene type sanitization', () => {
  it('passes a canonical diagram type through unchanged', () => {
    const orchestrator = new PipelineOrchestrator({});
    const scene = prepare(orchestrator, { type: 'flow', nodes: [], edges: [] });

    expect(scene.type).toBe('flow');
  });

  it('sanitizes a non-canonical type to the canonical default (no raw `as DiagramType` cross-cast)', () => {
    // Before the fix, `(analysis?.type ?? 'flow') as DiagramType` left
    // 'invalid_diagram_kind' on scene.type verbatim — a value no downstream
    // switch/renderer recognizes. The canonical guard maps it to 'general'.
    const orchestrator = new PipelineOrchestrator({});
    const scene = prepare(orchestrator, { type: 'invalid_diagram_kind', nodes: [], edges: [] });

    expect(scene.type).toBe('general');
  });

  it('sanitizes a near-miss type to the canonical default', () => {
    // 'flowchart_diagram' is not in the canon ('flow' | 'flowchart' | ...);
    // it must collapse to 'general', not survive the cross-cast.
    const orchestrator = new PipelineOrchestrator({});
    const scene = prepare(orchestrator, { type: 'flowchart_diagram', nodes: [], edges: [] });

    expect(scene.type).toBe('general');
  });

  it('defaults a missing type to the canonical default (parity with sibling pipelines)', () => {
    // MainPipeline & SimplePipeline both produce 'general' for a missing type
    // (sanitizeDiagramType default). The orchestrator previously fell back to
    // 'flow' — the lone outlier. Parity means 'general'.
    const orchestrator = new PipelineOrchestrator({});
    const scene = prepare(orchestrator, { nodes: [], edges: [] });

    expect(scene.type).toBe('general');
  });
});
