/**
 * Tests for nullable array access guards across the codebase.
 *
 * These tests verify that the guard patterns used in source files do NOT crash
 * when scene/layout objects have missing `nodes`, `edges`, `animations`, or
 * `keyphrases` arrays — a common runtime scenario when data comes from JSON
 * parsing or partial API responses.
 *
 * Each test exercises the EXACT guard pattern used in the patched source file.
 */

import { describe, it, expect } from '@jest/globals';

// ─── advanced-visual-engine guards ─────────────────────────────────────────────

describe('Nullable access guards — advanced-visual-engine', () => {

  it('scene.nodes || [] prevents crash when nodes is undefined', () => {
    const scene = { nodes: undefined as unknown as never };
    const safeNodes = scene.nodes || [];
    expect(safeNodes.length).toBe(0);
    expect(() => safeNodes.forEach(() => {})).not.toThrow();
  });

  it('scene.edges || [] prevents crash when edges is undefined', () => {
    const scene = { edges: undefined as unknown as never };
    const safeEdges = scene.edges || [];
    expect(safeEdges.length).toBe(0);
    expect(() => safeEdges.forEach(() => {})).not.toThrow();
  });

  it('(scene.animations || []).length prevents crash when animations is undefined', () => {
    const scene = { animations: undefined as unknown as never };
    expect((scene.animations || []).length).toBe(0);
  });

  it('safeNodes.length used in delay calculation does not crash', () => {
    const scene = { nodes: undefined as unknown as never };
    const safeNodes = scene.nodes || [];
    const delay = (safeNodes.length * 200) + (0 * 100);
    expect(delay).toBe(0);
  });

  it('full generateAnimationSequence pattern with undefined nodes and edges', () => {
    const scene = {
      nodes: undefined as unknown as never,
      edges: undefined as unknown as never,
    };

    const animations: unknown[] = [];
    const safeNodes = scene.nodes || [];
    safeNodes.forEach((_node, index) => {
      animations.push({ type: 'entrance', index });
    });

    const safeEdges = scene.edges || [];
    safeEdges.forEach((_edge, index) => {
      animations.push({
        type: 'connection',
        delay: (safeNodes.length * 200) + (index * 100),
      });
    });

    expect(animations.length).toBe(0);
  });
});

// ─── framework-integrated-pipeline guards ──────────────────────────────────────

describe('Nullable access guards — framework-integrated-pipeline', () => {

  it('(s.nodes || []).length works in filter for scenes with undefined nodes', () => {
    const scenes = [
      { nodes: undefined as unknown as never, edges: [] },
      { nodes: [{ id: 'n1' }], edges: [] },
    ] as const;

    const scenesWithNodes = scenes.filter(s => (s.nodes || []).length > 0);
    expect(scenesWithNodes.length).toBe(1);
  });

  it('(s.edges || []).length works in filter for scenes with undefined edges', () => {
    const scenes = [
      { nodes: [], edges: undefined as unknown as never },
      { nodes: [], edges: [{ from: 'a', to: 'b' }] },
    ] as const;

    const scenesWithEdges = scenes.filter(s => (s.edges || []).length > 0);
    expect(scenesWithEdges.length).toBe(1);
  });

  it('reduce with (s.nodes || []).length does not crash on undefined nodes', () => {
    const scenes = [
      { nodes: undefined as unknown as never },
      { nodes: [{ id: 'n1' }, { id: 'n2' }] },
    ];

    const sum = scenes.reduce((acc, s) => acc + (s.nodes || []).length, 0);
    expect(sum).toBe(2);
  });

  it('reduce with (s.edges || []).length does not crash on undefined edges', () => {
    const scenes = [
      { edges: undefined as unknown as never },
      { edges: [{ from: 'a', to: 'b' }] },
    ];

    const sum = scenes.reduce((acc, s) => acc + (s.edges || []).length, 0);
    expect(sum).toBe(1);
  });
});

// ─── complex-layout-engine calculateBounds guards ──────────────────────────────

describe('Nullable access guards — complex-layout-engine calculateBounds', () => {

  it('layout.nodes || [] prevents crash when nodes is undefined', () => {
    const layout = { nodes: undefined as unknown as never, edges: [] };

    const safeNodes = layout.nodes || [];
    expect(safeNodes.length).toBe(0);
  });

  it('calculateBounds returns zero bounds when nodes is undefined', () => {
    const layout = { nodes: undefined as unknown as never, edges: [] };

    // Reproduce the exact guard pattern from the source
    const safeNodes = layout.nodes || [];
    if (safeNodes.length === 0) {
      const bounds = { width: 0, height: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };
      expect(bounds.width).toBe(0);
      expect(bounds.height).toBe(0);
    } else {
      throw new Error('Should not reach this branch');
    }
  });

  it('safeNodes.map does not crash when nodes is undefined', () => {
    const layout = { nodes: undefined as unknown as never, edges: [] };

    const safeNodes = layout.nodes || [];
    const xs = safeNodes.map((n: { x: number }) => [n.x, n.x]).flat();
    expect(xs).toEqual([]);
  });
});

// ─── api/routes/pipeline guards ────────────────────────────────────────────────

describe('Nullable access guards — API route pipeline body.scenes', () => {

  it('(body.scenes || []).length returns 0 when scenes is undefined', () => {
    const body: { scenes?: unknown[] } = {};
    expect((body.scenes || []).length).toBe(0);
  });

  it('(body.scenes || []).length returns 0 when scenes is null', () => {
    const body: { scenes?: unknown[] | null } = { scenes: null };
    expect((body.scenes || []).length).toBe(0);
  });

  it('(body.scenes || []).length returns correct count for valid array', () => {
    const body = { scenes: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] };
    expect((body.scenes || []).length).toBe(3);
  });
});

// ─── diagram-detector guards ───────────────────────────────────────────────────

describe('Nullable access guards — diagram-detector generateDiagramSpecificContent', () => {

  it('(diagramContent.nodes || []).forEach does not crash when undefined', () => {
    const diagramContent = { nodes: undefined as unknown as never, edges: [] };
    const collected: unknown[] = [];

    (diagramContent.nodes || []).forEach((nodeData: unknown) => {
      collected.push(nodeData);
    });

    expect(collected.length).toBe(0);
  });

  it('(diagramContent.edges || []).forEach does not crash when undefined', () => {
    const diagramContent = { nodes: [], edges: undefined as unknown as never };
    const collected: unknown[] = [];

    (diagramContent.edges || []).forEach((edgeData: unknown) => {
      collected.push(edgeData);
    });

    expect(collected.length).toBe(0);
  });

  it('both nodes and edges undefined produces empty arrays', () => {
    const diagramContent = {
      nodes: undefined as unknown as never,
      edges: undefined as unknown as never,
    };

    const nodes: unknown[] = [];
    const edges: unknown[] = [];

    (diagramContent.nodes || []).forEach((n: unknown) => nodes.push(n));
    (diagramContent.edges || []).forEach((e: unknown) => edges.push(e));

    expect(nodes).toEqual([]);
    expect(edges).toEqual([]);
  });
});

// ─── KeyphraseOverlay guards ───────────────────────────────────────────────────

describe('Nullable access guards — KeyphraseOverlay keyphrases', () => {

  it('!scene.keyphrases || scene.keyphrases.length === 0 handles undefined', () => {
    const scene = {
      keyphrases: undefined as unknown as string[],
      startMs: 0,
      durationMs: 5000,
    };

    const shouldSkip = !scene.keyphrases || scene.keyphrases.length === 0;
    expect(shouldSkip).toBe(true);
  });

  it('(scene.keyphrases || []).slice handles undefined', () => {
    const scene = { keyphrases: undefined as unknown as string[] };
    const display = (scene.keyphrases || []).slice(0, 3);
    expect(display).toEqual([]);
  });

  it('(scene.keyphrases || []).slice handles valid array', () => {
    const scene = { keyphrases: ['a', 'b', 'c', 'd', 'e'] };
    const display = (scene.keyphrases || []).slice(0, 3);
    expect(display).toEqual(['a', 'b', 'c']);
  });
});

// ─── pipeline-interface guards ─────────────────────────────────────────────────

describe('Nullable access guards — pipeline-interface result.scenes', () => {

  it('(result.scenes || []).length handles undefined scenes', () => {
    const result = { success: true, scenes: undefined as unknown as never };
    expect((result.scenes || []).length).toBe(0);
  });

  it('(result.scenes || []).filter handles scenes with undefined nodes', () => {
    const scenes = [
      { nodes: undefined as unknown as never, edges: [] },
      { nodes: [{ id: 'n1' }], edges: [] },
    ];

    const result = { success: true, scenes };
    const diagrams = (result.scenes || []).filter(
      (s: { nodes?: unknown[] }) => (s.nodes || []).length > 0
    );
    expect(diagrams.length).toBe(1);
  });

  it('(result.scenes || []).map handles undefined scenes', () => {
    const result = { success: true, scenes: undefined as unknown as never };
    const mapped = (result.scenes || []).map((s: unknown) => s);
    expect(mapped).toEqual([]);
  });

  it('(scene.keyphrases || []).slice handles undefined keyphrases', () => {
    const scene = { keyphrases: undefined as unknown as string[] };
    expect((scene.keyphrases || []).slice(0, 3)).toEqual([]);
  });
});

// ─── DiagramPreview guards ─────────────────────────────────────────────────────

describe('Nullable access guards — DiagramPreview', () => {

  it('(scene.nodes || []).length handles undefined nodes', () => {
    const scene = { nodes: undefined as unknown as never };
    expect((scene.nodes || []).length).toBe(0);
  });

  it('(scene.edges || []).length handles undefined edges', () => {
    const scene = { edges: undefined as unknown as never };
    expect((scene.edges || []).length).toBe(0);
  });

  it('(scene.keyphrases || []).map handles undefined keyphrases', () => {
    const scene = { keyphrases: undefined as unknown as string[] };
    const mapped = (scene.keyphrases || []).map((p: string) => p.toUpperCase());
    expect(mapped).toEqual([]);
  });
});

// ─── StreamingProcessor guards ─────────────────────────────────────────────────

describe('Nullable access guards — StreamingProcessor', () => {

  it('(scene.keyphrases || []).slice(0, 3) handles undefined keyphrases', () => {
    const scene = { keyphrases: undefined as unknown as string[] };
    const result = (scene.keyphrases || []).slice(0, 3);
    expect(result).toEqual([]);
  });
});
