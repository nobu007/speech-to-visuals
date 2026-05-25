/**
 * Smoke Orchestrator
 *
 * Thin chain function that wires together three core pipeline stages:
 *   1. parseJsonFromLLMText  — extract structured data from raw LLM output
 *   2. scene-synchronizer    — validate/split captions against scene boundaries
 *   3. MultiFormatExporter   — produce a deliverable (JSON/SVG/PDF)
 *
 * This is intentionally lightweight: no external API calls, no audio
 * transcription, no LLM inference. It proves the internal wiring works
 * end-to-end with fixture data.
 */

import { parseJsonFromLLMText } from '../analysis';
import {
  msToFrame,
  validateSceneCaptionSync,
  splitCaptionAtSceneBoundary,
  DEFAULT_FPS,
} from '../remotion/scene-synchronizer';
import type { SrtCaption } from '../remotion/srt-parser';
import type { SceneGraph, DiagramType, NodeDatum, EdgeDatum, DiagramLayout } from '../types/diagram';
import { MultiFormatExporter, type ExportFormat, type ExportResult } from '../export/multi-format-exporter';
import { generateRenderPlan, validateRenderPlan, type RenderPlan } from './scene-render-spec-generator';
import { timeStage, aggregateTimingReport, type StageTimingRecord, type StageTimingReport } from './stage-timing-metrics';
import { computePipelineHealth, type PipelineHealthReport } from './pipeline-health-score';
import type { CostData } from './cost-efficiency-metrics';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SmokeCaptionInput {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

export interface SmokeOrchestratorInput {
  /** Raw text returned by an LLM, containing a JSON diagram definition. */
  rawLlmText: string;
  /** Optional captions to synchronise against the generated scenes. */
  captions?: SmokeCaptionInput[];
  /** Frames per second (defaults to 30). */
  fps?: number;
  /** Export format (defaults to 'json'). */
  exportFormat?: ExportFormat;
  /** Optional cost data — when provided, a health report is generated. */
  costData?: CostData;
}

export interface SmokeOrchestratorResult {
  /** Stage 1 — the object parsed from the LLM text. */
  parsed: unknown;
  /** Stage 2 — SceneGraph array built from the parsed diagram. */
  scenes: SceneGraph[];
  /** Stage 2 — caption-sync validation result. */
  syncValidation: { valid: boolean; issues: string[] };
  /** Stage 2 — captions after splitting at scene boundaries. */
  splitCaptions: SrtCaption[][];
  /** Stage 3 — render plan generated from scenes. */
  renderPlan: RenderPlan;
  /** Stage 3 — render plan validation result. */
  renderPlanValidation: { valid: boolean; issues: string[] };
  /** Stage 4 — export result for each scene. */
  exportResults: ExportResult[];
  /** Per-stage timing records. */
  timingReport?: StageTimingReport;
  /** Stage 5 — pipeline health report (present when costData was provided). */
  healthReport?: PipelineHealthReport;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface RawDiagram {
  type?: string;
  nodes?: Array<Record<string, unknown>>;
  edges?: Array<Record<string, unknown>>;
  summary?: string;
  keyphrases?: string[];
}

function toNodeDatum(raw: Array<Record<string, unknown>>): NodeDatum[] {
  return raw.map((n, i) => ({
    id: (n.id as string) ?? `node-${i}`,
    label: (n.label as string) ?? `Node ${i}`,
    type: n.type as string | undefined,
    width: n.width as number | undefined,
    height: n.height as number | undefined,
  }));
}

function toEdgeDatum(raw: Array<Record<string, unknown>>): EdgeDatum[] {
  return raw.map((e, i) => ({
    from: (e.from as string) ?? (e.source as string) ?? `node-0`,
    to: (e.to as string) ?? (e.target as string) ?? `node-1`,
    label: e.label as string | undefined,
    id: (e.id as string) ?? `edge-${i}`,
  }));
}

const DEFAULT_SCENE_DURATION_MS = 5000;

function buildSingleScene(diagram: RawDiagram, startMs: number, fps: number): {
  scene: SceneGraph;
  captions: SrtCaption[];
} {
  const nodes = toNodeDatum(diagram.nodes ?? []);
  const edges = toEdgeDatum(diagram.edges ?? []);
  const durationMs = DEFAULT_SCENE_DURATION_MS;

  const scene: SceneGraph = {
    type: (diagram.type as DiagramType) ?? 'flow',
    nodes,
    edges,
    startMs,
    durationMs,
    summary: diagram.summary ?? 'Smoke test scene',
    keyphrases: diagram.keyphrases ?? [],
  };

  const nodeCount = nodes.length;
  const perNodeMs = nodeCount > 0 ? durationMs / nodeCount : durationMs;
  const captions: SrtCaption[] = nodes.map((n, i) => ({
    index: i + 1,
    startMs: Math.round(startMs + i * perNodeMs),
    endMs: Math.round(startMs + (i + 1) * perNodeMs),
    text: n.label,
    startFrame: msToFrame(Math.round(startMs + i * perNodeMs), fps),
    endFrame: msToFrame(Math.round(startMs + (i + 1) * perNodeMs), fps),
  }));

  return { scene, captions };
}

/**
 * Build multiple scenes from an array of diagram objects.
 * Each diagram becomes one scene with sequential timing.
 */
function buildMultiScenes(diagrams: RawDiagram[], fps: number): {
  scenes: SceneGraph[];
  captions: SrtCaption[];
} {
  const scenes: SceneGraph[] = [];
  const allCaptions: SrtCaption[] = [];
  let currentMs = 0;

  for (const diagram of diagrams) {
    const { scene, captions } = buildSingleScene(diagram, currentMs, fps);
    scenes.push(scene);
    allCaptions.push(...captions);
    currentMs += scene.durationMs;
  }

  return { scenes, captions: allCaptions };
}

function buildScenes(diagram: RawDiagram, fps: number): {
  scenes: SceneGraph[];
  captions: SrtCaption[];
} {
  const { scene, captions } = buildSingleScene(diagram, 0, fps);
  return { scenes: [scene], captions };
}

// ---------------------------------------------------------------------------
// Main orchestration function
// ---------------------------------------------------------------------------

/**
 * Run the three-stage smoke pipeline.
 *
 * Returns the intermediate and final results so tests can assert on each
 * stage independently.  When `costData` is provided, also produces a
 * pipeline health report (bottleneck + regression + cost analysis).
 */
export async function runSmokePipeline(
  input: SmokeOrchestratorInput,
): Promise<SmokeOrchestratorResult> {
  const fps = input.fps ?? DEFAULT_FPS;
  const format = input.exportFormat ?? 'json';
  const timings: StageTimingRecord[] = [];

  // ── Stage 1: Parse JSON from LLM text ──────────────────────────────────
  const { result: parsed, timing: t1 } = await timeStage(
    'parse',
    1,
    async () => parseJsonFromLLMText<RawDiagram | RawDiagram[]>(input.rawLlmText),
  );
  timings.push(t1);

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(
      'Smoke pipeline: parsed LLM text does not contain a valid diagram object',
    );
  }

  // Detect whether the LLM returned a single diagram or an array of diagrams
  const isArray = Array.isArray(parsed);
  const diagrams: RawDiagram[] = isArray ? parsed : [parsed];
  const firstInvalid = diagrams.find(
    (d) => !d.nodes && !d.edges && !d.type,
  );
  if (firstInvalid) {
    throw new Error(
      'Smoke pipeline: parsed LLM text does not contain a valid diagram object',
    );
  }

  // ── Stage 2: Build scenes and synchronise captions ──────────────────────
  const { result: sceneBuild, timing: t2 } = await timeStage(
    'scene-sync',
    diagrams.length,
    async () => {
      const { scenes, captions: autoCaptions } = isArray
        ? buildMultiScenes(diagrams, fps)
        : buildScenes(diagrams[0], fps);

      const rawCaptions: SrtCaption[] = (input.captions ?? []).map((c) => ({
        index: c.index,
        startMs: c.startMs,
        endMs: c.endMs,
        text: c.text,
        startFrame: msToFrame(c.startMs, fps),
        endFrame: msToFrame(c.endMs, fps),
      }));
      const captions = rawCaptions.length > 0 ? rawCaptions : autoCaptions;

      const syncValidation = validateSceneCaptionSync(scenes, captions, fps);
      const splitCaptions = captions.map((c) =>
        splitCaptionAtSceneBoundary(c, scenes, fps),
      );
      return { scenes, captions, syncValidation, splitCaptions };
    },
  );
  timings.push(t2);

  // ── Stage 3: Generate render plan ──────────────────────────────────────
  const { result: renderPlan, timing: t3 } = await timeStage(
    'render-plan',
    sceneBuild.scenes.length,
    async () => {
      const plan = generateRenderPlan(sceneBuild.scenes, { fps });
      const validation = validateRenderPlan(plan);
      return { plan, validation };
    },
  );
  timings.push(t3);

  if (!renderPlan.validation.valid) {
    throw new Error(
      `Smoke pipeline: render plan validation failed: ${renderPlan.validation.issues.join('; ')}`,
    );
  }

  // ── Stage 4: Export each scene ──────────────────────────────────────────
  const { result: exportResults, timing: t4 } = await timeStage(
    'export',
    sceneBuild.scenes.length,
    async () => {
      const exporter = new MultiFormatExporter();
      return exporter.exportBatch(sceneBuild.scenes, { format });
    },
  );
  timings.push(t4);

  const timingReport = aggregateTimingReport(timings);

  // ── Stage 5 (optional): Pipeline health report ─────────────────────────
  let healthReport: PipelineHealthReport | undefined;
  if (input.costData) {
    const measurements = timings.map((t) => ({
      stage: t.stageName,
      durationMs: t.durationMs,
      memoryMB: 0, // memory not tracked in smoke runs
      timestamp: t.startTime,
    }));
    healthReport = computePipelineHealth({
      stages: timings,
      measurements,
      costData: input.costData,
    });
  }

  return {
    parsed,
    scenes: sceneBuild.scenes,
    syncValidation: sceneBuild.syncValidation,
    splitCaptions: sceneBuild.splitCaptions,
    renderPlan: renderPlan.plan,
    renderPlanValidation: renderPlan.validation,
    exportResults,
    timingReport,
    healthReport,
  };
}
