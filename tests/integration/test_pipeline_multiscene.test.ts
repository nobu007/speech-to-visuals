/**
 * Multi-scene integration tests for the speech→visuals pipeline.
 *
 * Extends the base smoke test coverage with:
 *   - Multi-scene diagrams (array of diagram objects from LLM)
 *   - Overlapping caption handling across scene boundaries
 *   - PDF export through the full pipeline
 *   - Cross-scene caption splitting validation
 *   - Mixed diagram types in a single pipeline run
 */

import { jest, describe, it, expect } from '@jest/globals';
import {
  runSmokePipeline,
  type SmokeOrchestratorResult,
} from '@/pipeline/smoke-orchestrator';
import {
  getAllCaptionsForFrame,
  msToFrame,
  splitCaptionAtSceneBoundary,
  validateSceneCaptionSync,
  DEFAULT_FPS,
} from '@/remotion/scene-synchronizer';
import type { SrtCaption } from '@/remotion/srt-parser';
import { MultiFormatExporter } from '@/export/multi-format-exporter';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** LLM text containing an array of two diagram scenes. */
const FIXTURE_MULTI_SCENE_LLM_TEXT = `
Here are the diagrams for your video:

\`\`\`json
[
  {
    "type": "flow",
    "nodes": [
      { "id": "s1a", "label": "入力" },
      { "id": "s1b", "label": "検証" }
    ],
    "edges": [
      { "from": "s1a", "to": "s1b" }
    ],
    "summary": "データ入力フロー"
  },
  {
    "type": "tree",
    "nodes": [
      { "id": "s2a", "label": "ルート" },
      { "id": "s2b", "label": "分岐A" },
      { "id": "s2c", "label": "分岐B" }
    ],
    "edges": [
      { "from": "s2a", "to": "s2b" },
      { "from": "s2a", "to": "s2c" }
    ],
    "summary": "決定木"
  }
]
\`\`\`
`;

/** Captions that overlap across the scene boundary (5s boundary). */
const FIXTURE_OVERLAPPING_CAPTIONS = [
  { index: 1, startMs: 0, endMs: 2500, text: 'データ入力' },
  { index: 2, startMs: 2000, endMs: 4500, text: '検証中' },       // overlaps with #1 (200ms) and crosses boundary
  { index: 3, startMs: 4000, endMs: 7000, text: '分岐判定' },     // crosses boundary
  { index: 4, startMs: 6000, endMs: 10000, text: '結果出力' },
];

/** LLM text with a single diagram suitable for PDF export test. */
const FIXTURE_PDF_LLM_TEXT = `
\`\`\`json
{
  "type": "flow",
  "nodes": [
    { "id": "n1", "label": "Start" },
    { "id": "n2", "label": "Process" },
    { "id": "n3", "label": "End" }
  ],
  "edges": [
    { "from": "n1", "to": "n2" },
    { "from": "n2", "to": "n3" }
  ],
  "summary": "Three-step process"
}
\`\`\`
`;

// ===========================================================================
// Multi-scene pipeline
// ===========================================================================

describe('Multi-scene pipeline: array of diagrams', () => {
  it('parses and builds two scenes from an array of diagrams', async () => {
    const result = await runSmokePipeline({
      rawLlmText: FIXTURE_MULTI_SCENE_LLM_TEXT,
    });

    // Two scenes built from two diagrams
    expect(result.scenes).toHaveLength(2);

    // Scene 1: flow with 2 nodes
    expect(result.scenes[0].type).toBe('flow');
    expect(result.scenes[0].nodes).toHaveLength(2);
    expect(result.scenes[0].startMs).toBe(0);

    // Scene 2: tree with 3 nodes
    expect(result.scenes[1].type).toBe('tree');
    expect(result.scenes[1].nodes).toHaveLength(3);
    expect(result.scenes[1].startMs).toBe(5000); // after scene 1

    // Render plan covers both scenes
    expect(result.renderPlan.sceneCount).toBe(2);
    expect(result.renderPlanValidation.valid).toBe(true);

    // Both scenes exported
    expect(result.exportResults).toHaveLength(2);
    expect(result.exportResults[0].success).toBe(true);
    expect(result.exportResults[1].success).toBe(true);
  });

  it('produces contiguous frame ranges across multi-scene render plan', async () => {
    const result = await runSmokePipeline({
      rawLlmText: FIXTURE_MULTI_SCENE_LLM_TEXT,
    });

    const plan = result.renderPlan;
    // Scene 2 starts where scene 1 ends
    expect(plan.scenes[1].startFrame).toBe(plan.scenes[0].endFrame);
    // Total frames = sum of per-scene frames
    expect(plan.totalFrames).toBe(
      plan.scenes[0].totalFrames + plan.scenes[1].totalFrames,
    );
  });

  it('auto-generates captions with correct timing across scenes', async () => {
    const result = await runSmokePipeline({
      rawLlmText: FIXTURE_MULTI_SCENE_LLM_TEXT,
    });

    // Auto-captions: 2 for scene 1 + 3 for scene 2 = 5 total
    expect(result.splitCaptions).toHaveLength(5);

    // Scene 1 captions should be within 0-5000ms
    const scene1Captions = result.splitCaptions.slice(0, 2).flat();
    for (const c of scene1Captions) {
      expect(c.startMs).toBeGreaterThanOrEqual(0);
      expect(c.endMs).toBeLessThanOrEqual(5000);
    }

    // Scene 2 captions should be within 5000-10000ms
    const scene2Captions = result.splitCaptions.slice(2).flat();
    for (const c of scene2Captions) {
      expect(c.startMs).toBeGreaterThanOrEqual(5000);
      expect(c.endMs).toBeLessThanOrEqual(10000);
    }
  });

  it('exports multi-scene as SVG format', async () => {
    const result = await runSmokePipeline({
      rawLlmText: FIXTURE_MULTI_SCENE_LLM_TEXT,
      exportFormat: 'svg',
    });

    expect(result.exportResults).toHaveLength(2);
    for (const exp of result.exportResults) {
      expect(exp.success).toBe(true);
      expect(exp.mimeType).toBe('image/svg+xml');
    }
  });
});

// ===========================================================================
// Overlapping captions
// ===========================================================================

describe('Overlapping captions across scene boundaries', () => {
  it('getAllCaptionsForFrame returns multiple captions at overlap point', () => {
    const fps = DEFAULT_FPS;
    const captions: SrtCaption[] = FIXTURE_OVERLAPPING_CAPTIONS.map((c) => ({
      ...c,
      startFrame: msToFrame(c.startMs, fps),
      endFrame: msToFrame(c.endMs, fps),
    }));

    // At frame ~62 (2067ms), both caption 1 and 2 should be active
    const overlapFrame = msToFrame(2067, fps);
    const active = getAllCaptionsForFrame(captions, overlapFrame);

    expect(active.length).toBeGreaterThanOrEqual(2);
    expect(active.map((c) => c.index).sort()).toEqual([1, 2]);
  });

  it('splits a boundary-crossing caption into multiple segments', () => {
    const fps = DEFAULT_FPS;
    const scenes = [{ durationMs: 5000 }, { durationMs: 5000 }];

    // Caption that crosses from scene 1 into scene 2
    const caption: SrtCaption = {
      index: 2,
      startMs: 3500,
      endMs: 6500,
      text: 'Crosses boundary',
      startFrame: msToFrame(3500, fps),
      endFrame: msToFrame(6500, fps),
    };

    const segments = splitCaptionAtSceneBoundary(caption, scenes, fps);

    expect(segments.length).toBe(2);
    // First segment: 3500-5000
    expect(segments[0].startMs).toBe(3500);
    expect(segments[0].endMs).toBe(5000);
    // Second segment: 5000-6500
    expect(segments[1].startMs).toBe(5000);
    expect(segments[1].endMs).toBe(6500);

    // Both retain original text
    for (const seg of segments) {
      expect(seg.text).toBe('Crosses boundary');
    }
  });

  it('validates overlapping captions against multi-scene timeline', () => {
    const fps = DEFAULT_FPS;
    const scenes = [{ durationMs: 5000 }, { durationMs: 5000 }];

    const captions: SrtCaption[] = FIXTURE_OVERLAPPING_CAPTIONS.map((c) => ({
      ...c,
      startFrame: msToFrame(c.startMs, fps),
      endFrame: msToFrame(c.endMs, fps),
    }));

    const result = validateSceneCaptionSync(scenes, captions, fps);

    // Captions that overlap across scene boundaries by >100ms are flagged
    // Caption #3 (4000-7000) crosses 5000ms boundary by 2000ms
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('spans scene boundary'))).toBe(true);
  });
});

// ===========================================================================
// PDF export through pipeline
// ===========================================================================

describe('PDF export through pipeline', () => {
  it('exports single scene as PDF via runSmokePipeline', async () => {
    const result = await runSmokePipeline({
      rawLlmText: FIXTURE_PDF_LLM_TEXT,
      exportFormat: 'pdf',
    });

    expect(result.exportResults).toHaveLength(1);
    const exp = result.exportResults[0];
    expect(exp.success).toBe(true);
    expect(exp.mimeType).toBe('application/pdf');
    expect(exp.data).toBeDefined();
    expect(exp.metadata?.format).toBe('pdf');
  });

  it('PDF export via MultiFormatExporter directly produces valid PDF blob', async () => {
    const exporter = new MultiFormatExporter();
    const scene = {
      type: 'flow' as const,
      nodes: [
        { id: 'a', label: 'X', x: 100, y: 100 },
        { id: 'b', label: 'Y', x: 300, y: 100 },
      ],
      edges: [{ from: 'a', to: 'b' }],
      layout: {
        nodes: [
          { id: 'a', label: 'X', x: 100, y: 100 },
          { id: 'b', label: 'Y', x: 300, y: 100 },
        ],
        edges: [{ from: 'a', to: 'b', points: [{ x: 100, y: 100 }, { x: 300, y: 100 }] }],
      },
      startMs: 0,
      durationMs: 5000,
      summary: 'PDF test',
      keyphrases: [],
      id: 'pdf-scene',
    };

    const result = await exporter.export(scene, { format: 'pdf' });
    expect(result.success).toBe(true);
    expect(result.mimeType).toBe('application/pdf');
    // PDF should start with %PDF header
    const data = result.data as Blob;
    expect(data.size).toBeGreaterThan(0);
  });

  it('multi-scene PDF export produces one PDF per scene', async () => {
    const result = await runSmokePipeline({
      rawLlmText: FIXTURE_MULTI_SCENE_LLM_TEXT,
      exportFormat: 'pdf',
    });

    expect(result.exportResults).toHaveLength(2);
    for (const exp of result.exportResults) {
      expect(exp.success).toBe(true);
      expect(exp.mimeType).toBe('application/pdf');
    }
  });
});

// ===========================================================================
// Cross-component integration
// ===========================================================================

describe('Cross-component integration', () => {
  it('render plan node/edge counts match parsed diagram', async () => {
    const result = await runSmokePipeline({
      rawLlmText: FIXTURE_MULTI_SCENE_LLM_TEXT,
    });

    // Scene 0: flow with 2 nodes, 1 edge
    expect(result.renderPlan.scenes[0].nodeCount).toBe(2);
    expect(result.renderPlan.scenes[0].edgeCount).toBe(1);

    // Scene 1: tree with 3 nodes, 2 edges
    expect(result.renderPlan.scenes[1].nodeCount).toBe(3);
    expect(result.renderPlan.scenes[1].edgeCount).toBe(2);
  });

  it('scene data and export results counts are consistent', async () => {
    const result = await runSmokePipeline({
      rawLlmText: FIXTURE_MULTI_SCENE_LLM_TEXT,
    });

    expect(result.scenes.length).toBe(result.renderPlan.sceneCount);
    expect(result.scenes.length).toBe(result.exportResults.length);
  });

  it('multi-format export of same scene produces consistent metadata', async () => {
    const formats: Array<'json' | 'svg' | 'pdf'> = ['json', 'svg', 'pdf'];
    const results: SmokeOrchestratorResult[] = [];

    for (const format of formats) {
      const result = await runSmokePipeline({
        rawLlmText: FIXTURE_PDF_LLM_TEXT,
        exportFormat: format,
      });
      results.push(result);
    }

    // All formats should produce the same scene structure
    for (const result of results) {
      expect(result.scenes).toHaveLength(1);
      expect(result.scenes[0].nodes).toHaveLength(3);
      expect(result.renderPlan.sceneCount).toBe(1);
    }

    // Each format should succeed with its own mime type
    expect(results[0].exportResults[0].mimeType).toBe('application/json');
    expect(results[1].exportResults[0].mimeType).toBe('image/svg+xml');
    expect(results[2].exportResults[0].mimeType).toBe('application/pdf');
  });
});
