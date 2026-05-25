/**
 * Tests for scene ID generation and JSON export roundtrip.
 *
 * Validates:
 *   - buildSingleScene / buildMultiScenes produce scenes with `id`
 *   - MultiFormatExporter.exportJSON serialises all core SceneGraph fields
 *   - End-to-end runSmokePipeline produces usable JSON exports
 */

import { describe, it, expect } from '@jest/globals';
import {
  buildSingleScene,
  buildMultiScenes,
  runSmokePipeline,
  type RawDiagram,
} from '@/pipeline/smoke-orchestrator';
import { MultiFormatExporter } from '@/export/multi-format-exporter';
import { DEFAULT_FPS } from '@/remotion/scene-synchronizer';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FLOW_DIAGRAM: RawDiagram = {
  type: 'flow',
  nodes: [
    { id: 'a', label: 'Start' },
    { id: 'b', label: 'End' },
  ],
  edges: [{ from: 'a', to: 'b', label: 'next' }],
  summary: 'Two-step flow',
  keyphrases: ['step'],
  durationMs: 3000,
};

const TREE_DIAGRAM: RawDiagram = {
  type: 'tree',
  nodes: [
    { id: 'root', label: 'Root' },
    { id: 'child', label: 'Child' },
  ],
  edges: [{ from: 'root', to: 'child' }],
  summary: 'Simple tree',
  keyphrases: ['tree'],
  durationMs: 4000,
};

const LLM_ARRAY_TEXT = JSON.stringify([FLOW_DIAGRAM, TREE_DIAGRAM]);

// ---------------------------------------------------------------------------
// Scene ID generation
// ---------------------------------------------------------------------------

describe('buildSingleScene sets scene.id', () => {
  it('generates an id derived from startMs', () => {
    const { scene } = buildSingleScene(FLOW_DIAGRAM, 0, DEFAULT_FPS);
    expect(scene.id).toBe('scene-0');
  });

  it('produces different ids for different start times', () => {
    const { scene: s1 } = buildSingleScene(FLOW_DIAGRAM, 0, DEFAULT_FPS);
    const { scene: s2 } = buildSingleScene(TREE_DIAGRAM, 5000, DEFAULT_FPS);
    expect(s1.id).not.toBe(s2.id);
    expect(s2.id).toBe('scene-5000');
  });
});

describe('buildMultiScenes assigns sequential ids', () => {
  it('gives each scene a unique id', () => {
    const { scenes } = buildMultiScenes([FLOW_DIAGRAM, TREE_DIAGRAM], DEFAULT_FPS);
    expect(scenes).toHaveLength(2);
    expect(scenes[0].id).toBe('scene-0');
    expect(scenes[1].id).toBe(`scene-${FLOW_DIAGRAM.durationMs}`);
  });
});

// ---------------------------------------------------------------------------
// JSON export serialises all core SceneGraph fields
// ---------------------------------------------------------------------------

describe('MultiFormatExporter.exportJSON includes core fields', () => {
  const exporter = new MultiFormatExporter();

  it('exports nodes, edges, startMs, durationMs, summary, keyphrases', async () => {
    const { scene } = buildSingleScene(FLOW_DIAGRAM, 0, DEFAULT_FPS);
    const result = await exporter.export(scene, { format: 'json' });

    expect(result.success).toBe(true);
    expect(result.mimeType).toBe('application/json');

    // Parse the exported JSON
    const blob = result.data as Blob;
    const text = await blob.text();
    const parsed = JSON.parse(text);

    // Core fields must be present
    expect(parsed.id).toBe('scene-0');
    expect(parsed.type).toBe('flow');
    expect(parsed.nodes).toHaveLength(2);
    expect(parsed.nodes[0].id).toBe('a');
    expect(parsed.edges).toHaveLength(1);
    expect(parsed.edges[0].from).toBe('a');
    expect(parsed.edges[0].to).toBe('b');
    expect(parsed.startMs).toBe(0);
    expect(parsed.durationMs).toBe(3000);
    expect(parsed.summary).toBe('Two-step flow');
    expect(parsed.keyphrases).toEqual(['step']);
  });

  it('exports a valid filename using scene.id', async () => {
    const { scene } = buildSingleScene(FLOW_DIAGRAM, 1000, DEFAULT_FPS);
    const result = await exporter.export(scene, { format: 'json' });

    expect(result.success).toBe(true);
    expect(result.filename).toBe('scene-1000.json');
  });

  it('includes metadata when requested', async () => {
    const { scene } = buildSingleScene(FLOW_DIAGRAM, 0, DEFAULT_FPS);
    const result = await exporter.export(scene, {
      format: 'json',
      includeMetadata: true,
    });

    const text = await (result.data as Blob).text();
    const parsed = JSON.parse(text);

    expect(parsed.metadata).toBeDefined();
    expect(parsed.metadata.exportFormat).toBe('json');
  });
});

// ---------------------------------------------------------------------------
// End-to-end: JSON export roundtrip through smoke pipeline
// ---------------------------------------------------------------------------

describe('runSmokePipeline JSON export roundtrip', () => {
  it('exports all scenes with correct data after multi-scene pipeline', async () => {
    const result = await runSmokePipeline({
      rawLlmText: LLM_ARRAY_TEXT,
      exportFormat: 'json',
    });

    expect(result.scenes).toHaveLength(2);
    expect(result.exportResults).toHaveLength(2);

    // Parse each exported scene and verify data integrity
    for (let i = 0; i < result.exportResults.length; i++) {
      const exportResult = result.exportResults[i];
      expect(exportResult.success).toBe(true);

      const text = await (exportResult.data as Blob).text();
      const parsed = JSON.parse(text);

      // Core fields must survive the roundtrip
      expect(parsed.type).toBe(result.scenes[i].type);
      expect(parsed.nodes).toHaveLength(result.scenes[i].nodes.length);
      expect(parsed.edges).toHaveLength(result.scenes[i].edges.length);
      expect(parsed.startMs).toBe(result.scenes[i].startMs);
      expect(parsed.durationMs).toBe(result.scenes[i].durationMs);
      expect(parsed.summary).toBe(result.scenes[i].summary);
    }
  });

  it('single-scene pipeline produces complete JSON', async () => {
    const result = await runSmokePipeline({
      rawLlmText: JSON.stringify(FLOW_DIAGRAM),
      exportFormat: 'json',
    });

    expect(result.scenes).toHaveLength(1);
    const text = await (result.exportResults[0].data as Blob).text();
    const parsed = JSON.parse(text);

    expect(parsed.nodes).toHaveLength(2);
    expect(parsed.edges).toHaveLength(1);
    expect(parsed.keyphrases).toEqual(['step']);
  });
});
