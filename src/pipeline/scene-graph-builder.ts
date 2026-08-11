import { SceneGraph } from '@/types/diagram';
import { sanitizeFinite, sanitizeDiagramType } from '@/utils/guards';

/**
 * Build a {@link SceneGraph} from the three stage outputs every scene-build
 * site already produces: a content `segment`, a diagram `analysis`, and a
 * computed `layout`.
 *
 * WHY THIS EXISTS
 * --------------
 * Three pipelines — MainPipeline (`prepareScenes` + `prepareScenesEnhanced`),
 * SimplePipeline (`processScene`), and PipelineOrchestrator (`prepareSingleScene`)
 * — each assembled a SceneGraph inline and repeatedly DIVERGED on the same
 * fields:
 *   - `summary`     (iter-22: SimplePipeline used the full segment text)
 *   - `keyphrases`  (iter-24: SimplePipeline used diagram node labels)
 *   - `type`        (iter-25: Orchestrator cross-cast instead of sanitizing)
 *   - `id`/`startTime`/`endTime`/`content`
 *                   (iter-26: MainPipeline OMITTED all four; the Orchestrator
 *                    site STILL omits them as of this extraction)
 *
 * Because {@link SceneGraph} marks those fields optional, an omission compiled
 * cleanly and failed only at runtime: video-generator's `scene.content.substring`
 * threw `TypeError` and `scene.startTime * 1000` produced `NaN` for every scene
 * the divergent site produced.
 *
 * Centralizing the field contract HERE makes the omission structurally
 * impossible: every consumer-required field is assigned in exactly one place,
 * so a new pipeline (or a future edit) cannot silently drop one.
 */
export interface BuildSceneGraphInput {
  /**
   * Segmenter output: carries `startMs`/`endMs` (ms), `text`, `summary`,
   * `keyphrases`.
   *
   * Typed STRUCTURALLY (optional fields, no string index signature) rather than
   * as `Record<string, unknown>` so callers can pass the concrete
   * `ContentSegment` directly — a concrete interface lacks an index signature
   * and is therefore NOT assignable to `Record<string, unknown>`, which forced
   * a `diagramAnalysis as unknown as Record<...>` double-cast at the
   * SimplePipeline site (TS2352). A loose `Record<string, unknown>` remains
   * assignable here too, so the other call sites are unaffected.
   */
  segment: { startMs?: unknown; endMs?: unknown; text?: unknown; summary?: unknown; keyphrases?: unknown };
  /** DiagramDetector output: `type`, `nodes`, `edges`, `confidence` (structural — see {@link segment}). */
  analysis: { type?: unknown; nodes?: unknown; edges?: unknown; confidence?: unknown };
  /** LayoutEngine output: positioned nodes/edges. */
  layout: unknown;
  /** 0-based scene index — used for the `scene-${index}` id. */
  index: number;
  /**
   * Optional layout-engine confidence (0-1) to fold into `scene.confidence` via
   * `Math.min(detectorConfidence, layoutConfidence ?? 1)`.
   *
   * Pass this whenever the caller has a layout confidence (SimplePipeline does;
   * MainPipeline and PipelineOrchestrator drop the `LayoutResult.confidence`
   * wrapper during layout generation, so they OMIT the property).
   *
   * Property PRESENCE is what matters, not the value: SimplePipeline ALWAYS
   * folds — even when the layout confidence is `undefined` (then `?? 1` makes
   * the fold a no-op) — while the other two pipelines pass the raw detector
   * confidence through (preserving `undefined` so downstream `?? 0.8` / `|| 0`
   * consumers keep their defaults). We therefore test presence with
   * `'layoutConfidence' in input`, never truthiness.
   */
  layoutConfidence?: number;
}

/**
 * Single-source SceneGraph assembler. See {@link BuildSceneGraphInput} for the
 * divergence history this replaces.
 */
export function buildSceneGraph(input: BuildSceneGraphInput): SceneGraph {
  const { segment, analysis, layout, index } = input;

  // startMs/endMs are MILLISECONDS (segmenter contract); startTime/endTime are
  // SECONDS (video-generator reads `scene.startTime * 1000`). Mixing the two is
  // the recurring ×1000 unit divergence — keep the one conversion here.
  const startMs = (segment.startMs ?? 0) as number;
  const endMs = (segment.endMs ?? startMs) as number;

  const confidence = 'layoutConfidence' in input
    // `?? 1` (NOT `|| 1`): a layout confidence of exactly 0 is a legitimate
    // "layout broke down" signal (e.g. ≥8 overlaps → calculateLayoutConfidence
    // clamps to 0) and must survive Math.min, not be erased to 1.
    ? Math.min(
      sanitizeFinite(analysis.confidence),
      (input.layoutConfidence as number | undefined) ?? 1,
    )
    // Raw passthrough preserves `undefined` (so downstream `?? 0.8` keeps its
    // default) AND a legitimate 0 (detection-breakdown signal). Do NOT sanitize
    // here — sanitizing undefined→0 would change the consumer's `?? 0.8` result.
    : (analysis.confidence as number | undefined);

  return {
    id: `scene-${index}`,
    type: sanitizeDiagramType(analysis.type),
    nodes: (analysis.nodes ?? []) as SceneGraph['nodes'],
    edges: (analysis.edges ?? []) as SceneGraph['edges'],
    layout: layout as SceneGraph['layout'],
    startMs,
    durationMs: endMs - startMs,
    startTime: startMs / 1000,
    endTime: endMs / 1000,
    content: (segment.text ?? '') as string,
    summary: (segment.summary ?? '') as string,
    keyphrases: Array.isArray(segment.keyphrases)
      ? (segment.keyphrases as string[])
      : [],
    confidence,
  };
}
