/**
 * End-to-end smoke test for the speech→visuals pipeline happy path.
 *
 * Exercises three pipeline stages without any external API calls:
 *   1. parseJsonFromLLMText  — extracts structured diagram JSON from LLM text
 *   2. scene-synchronizer    — validates captions against scene boundaries
 *   3. MultiFormatExporter   — produces a deliverable export
 *
 * Uses the thin orchestrator in src/pipeline/smoke-orchestrator.ts so that
 * the wiring is also covered (not just individual units).
 */

import { jest, describe, it, expect } from '@jest/globals';
import { parseJsonFromLLMText } from '@/analysis/llm-utils';
import {
  msToFrame,
  validateSceneCaptionSync,
  splitCaptionAtSceneBoundary,
  detectSyncDrift,
  DEFAULT_FPS,
} from '@/remotion/scene-synchronizer';
import type { SrtCaption } from '@/remotion/srt-parser';
import { MultiFormatExporter } from '@/export/multi-format-exporter';
import {
  runSmokePipeline,
  type SmokeOrchestratorInput,
  type SmokeOrchestratorResult,
} from '@/pipeline/smoke-orchestrator';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Minimal LLM response containing a flow diagram. */
const FIXTURE_LLM_TEXT = `
Here is the diagram JSON you requested:

\`\`\`json
{
  "type": "flow",
  "nodes": [
    { "id": "step1", "label": "データ入力" },
    { "id": "step2", "label": "前処理" },
    { "id": "step3", "label": "分析" },
    { "id": "step4", "label": "出力" }
  ],
  "edges": [
    { "from": "step1", "to": "step2", "label": "渡す" },
    { "from": "step2", "to": "step3", "label": "渡す" },
    { "from": "step3", "to": "step4", "label": "渡す" }
  ],
  "summary": "四段階データ処理フロー",
  "keyphrases": ["データ", "前処理", "分析"]
}
\`\`\`
`;

/** Captions that align with a 5-second, 4-node scene (1.25s each). */
const FIXTURE_CAPTIONS = [
  { index: 1, startMs: 0, endMs: 1250, text: 'データ入力' },
  { index: 2, startMs: 1250, endMs: 2500, text: '前処理' },
  { index: 3, startMs: 2500, endMs: 3750, text: '分析' },
  { index: 4, startMs: 3750, endMs: 5000, text: '出力' },
];

// ===========================================================================
// Stage 1: parseJsonFromLLMText
// ===========================================================================

describe('Stage 1: parseJsonFromLLMText', () => {
  it('extracts valid diagram JSON from markdown-wrapped LLM text', () => {
    const result = parseJsonFromLLMText(FIXTURE_LLM_TEXT);

    expect(result).toBeDefined();
    expect(result.type).toBe('flow');
    expect(result.nodes).toHaveLength(4);
    expect(result.edges).toHaveLength(3);
    expect(result.summary).toBe('四段階データ処理フロー');
  });

  it('handles JSON surrounded by preamble text without code fences', () => {
    const raw = 'Sure! Here is your diagram: {"type":"tree","nodes":[{"id":"a","label":"Root"}],"edges":[]}';
    const result = parseJsonFromLLMText(raw);

    expect(result.type).toBe('tree');
    expect(result.nodes).toHaveLength(1);
  });

  it('handles trailing commas in JSON objects', () => {
    const raw = '{"type":"flow","nodes":[{"id":"n1","label":"A"},],"edges":[],}';
    const result = parseJsonFromLLMText(raw);

    expect(result.type).toBe('flow');
    expect(result.nodes).toHaveLength(1);
  });

  it('throws on empty input', () => {
    expect(() => parseJsonFromLLMText('')).toThrow();
  });

  it('throws on null input', () => {
    expect(() => parseJsonFromLLMText(null as unknown as string)).toThrow();
  });

  it('handles array JSON output', () => {
    const raw = '[{"type":"flow","nodes":[],"edges":[]}]';
    const result = parseJsonFromLLMText(FIXTURE_LLM_TEXT);
    // Array variant
    const arr = parseJsonFromLLMText<Array<unknown>>(raw);
    expect(Array.isArray(arr)).toBe(true);
    expect(arr).toHaveLength(1);
  });
});

// ===========================================================================
// Stage 2: scene-synchronizer
// ===========================================================================

describe('Stage 2: scene-synchronizer', () => {
  const fps = DEFAULT_FPS;

  it('converts ms to frame and back without drift', () => {
    const ms = 1500;
    const frame = msToFrame(ms, fps);
    expect(frame).toBe(Math.round((ms / 1000) * fps));

    // Verify roundtrip tolerance
    const backMs = (frame / fps) * 1000;
    expect(Math.abs(backMs - ms)).toBeLessThan(1000 / fps + 1);
  });

  it('validates caption sync with no issues for aligned captions', () => {
    const scenes = [{ durationMs: 5000 }];
    const captions: SrtCaption[] = FIXTURE_CAPTIONS.map((c) => ({
      ...c,
      startFrame: msToFrame(c.startMs, fps),
      endFrame: msToFrame(c.endMs, fps),
    }));

    const result = validateSceneCaptionSync(scenes, captions, fps);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('detects captions extending past total scene duration', () => {
    const scenes = [{ durationMs: 3000 }];
    const captions: SrtCaption[] = [
      {
        index: 1,
        startMs: 0,
        endMs: 5000,
        text: 'Overflows',
        startFrame: 0,
        endFrame: msToFrame(5000, fps),
      },
    ];

    const result = validateSceneCaptionSync(scenes, captions, fps);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0]).toContain('extends');
  });

  it('splits caption at scene boundary when it spans multiple scenes', () => {
    const scenes = [{ durationMs: 2500 }, { durationMs: 2500 }];
    const caption: SrtCaption = {
      index: 1,
      startMs: 1000,
      endMs: 4000,
      text: 'Spans two scenes',
      startFrame: msToFrame(1000, fps),
      endFrame: msToFrame(4000, fps),
    };

    const segments = splitCaptionAtSceneBoundary(caption, scenes, fps);
    expect(segments.length).toBeGreaterThan(1);

    // Segments should cover the same text
    for (const seg of segments) {
      expect(seg.text).toBe('Spans two scenes');
    }

    // Segments should be contiguous
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].startMs).toBe(segments[i - 1].endMs);
    }
  });

  it('detects sync drift within tolerance for well-aligned captions', () => {
    const captions: SrtCaption[] = FIXTURE_CAPTIONS.map((c) => ({
      ...c,
      startFrame: msToFrame(c.startMs, fps),
      endFrame: msToFrame(c.endMs, fps),
    }));

    const drift = detectSyncDrift(captions, fps);
    expect(drift.withinTolerance).toBe(true);
    expect(drift.maxDriftMs).toBeLessThanOrEqual(50);
  });
});

// ===========================================================================
// Stage 3: MultiFormatExporter
// ===========================================================================

describe('Stage 3: MultiFormatExporter', () => {
  it('exports a scene graph as JSON', async () => {
    const exporter = new MultiFormatExporter();
    const scene = {
      type: 'flow' as const,
      nodes: [
        { id: 'n1', label: 'Start' },
        { id: 'n2', label: 'End' },
      ],
      edges: [{ from: 'n1', to: 'n2' }],
      startMs: 0,
      durationMs: 5000,
      summary: 'Test scene',
      keyphrases: ['test'],
      id: 'test-scene',
    };

    const result = await exporter.export(scene, { format: 'json' });
    expect(result.success).toBe(true);
    expect(result.mimeType).toBe('application/json');
    expect(result.data).toBeDefined();
  });

  it('exports batch of scenes as JSON', async () => {
    const exporter = new MultiFormatExporter();
    const scenes = [
      {
        type: 'flow' as const,
        nodes: [{ id: 'n1', label: 'A' }],
        edges: [],
        startMs: 0,
        durationMs: 3000,
        summary: 'Scene 1',
        keyphrases: [],
        id: 'scene-1',
      },
      {
        type: 'tree' as const,
        nodes: [{ id: 'n2', label: 'B' }],
        edges: [],
        startMs: 3000,
        durationMs: 3000,
        summary: 'Scene 2',
        keyphrases: [],
        id: 'scene-2',
      },
    ];

    const results = await exporter.exportBatch(scenes, { format: 'json' });
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.success).toBe(true);
    }
  });

  it('exports SVG without canvas dependency', async () => {
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
      summary: 'SVG test',
      keyphrases: [],
      id: 'svg-scene',
    };

    const result = await exporter.export(scene, { format: 'svg' });
    expect(result.success).toBe(true);
    expect(result.mimeType).toBe('image/svg+xml');
    expect(result.data).toBeDefined();
  });

  it('returns error for unsupported format', async () => {
    const exporter = new MultiFormatExporter();
    const scene = {
      type: 'flow' as const,
      nodes: [],
      edges: [],
      startMs: 0,
      durationMs: 5000,
      summary: 'Bad format test',
      keyphrases: [],
      id: 'bad-scene',
    };

    const result = await exporter.export(scene, {
      format: 'unsupported' as 'json',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unsupported');
  });
});

// ===========================================================================
// End-to-end: runSmokePipeline orchestrator
// ===========================================================================

describe('End-to-end: runSmokePipeline', () => {
  it('chains all three stages and returns valid results', async () => {
    const result = await runSmokePipeline({
      rawLlmText: FIXTURE_LLM_TEXT,
      captions: FIXTURE_CAPTIONS,
    });

    // Stage 1: parsed diagram
    expect(result.parsed).toBeDefined();
    expect(result.parsed.type).toBe('flow');
    expect(result.parsed.nodes).toHaveLength(4);

    // Stage 2: scenes and sync
    expect(result.scenes).toHaveLength(1);
    expect(result.scenes[0].type).toBe('flow');
    expect(result.scenes[0].nodes).toHaveLength(4);
    expect(result.syncValidation.valid).toBe(true);
    expect(result.splitCaptions).toHaveLength(4);

    // Stage 3: export
    expect(result.exportResults).toHaveLength(1);
    expect(result.exportResults[0].success).toBe(true);
    expect(result.exportResults[0].mimeType).toBe('application/json');
  });

  it('auto-generates captions from nodes when none provided', async () => {
    const result = await runSmokePipeline({
      rawLlmText: FIXTURE_LLM_TEXT,
    });

    // Should have auto-generated 4 captions (one per node)
    expect(result.splitCaptions).toHaveLength(4);
    expect(result.syncValidation.valid).toBe(true);
  });

  it('handles minimal diagram with no edges', async () => {
    const result = await runSmokePipeline({
      rawLlmText: '{"type":"general","nodes":[{"id":"solo","label":"Standalone"}],"edges":[]}',
    });

    expect(result.parsed.nodes).toHaveLength(1);
    expect(result.scenes[0].edges).toHaveLength(0);
    expect(result.exportResults[0].success).toBe(true);
  });

  it('throws on invalid LLM text that contains no JSON', async () => {
    await expect(
      runSmokePipeline({ rawLlmText: 'This is just plain text with no JSON at all.' }),
    ).rejects.toThrow();
  });

  it('throws on JSON that is not a diagram object', async () => {
    await expect(
      runSmokePipeline({ rawLlmText: '{"message":"hello","count":42}' }),
    ).rejects.toThrow('does not contain a valid diagram');
  });

  it('respects custom fps and export format', async () => {
    const result = await runSmokePipeline({
      rawLlmText: FIXTURE_LLM_TEXT,
      captions: FIXTURE_CAPTIONS,
      fps: 60,
      exportFormat: 'svg',
    });

    expect(result.exportResults[0].success).toBe(true);
    expect(result.exportResults[0].mimeType).toBe('image/svg+xml');
  });
});
