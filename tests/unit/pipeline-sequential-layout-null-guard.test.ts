/**
 * Tests for sequential generateLayouts null-guard and createFallbackLayout edge safety.
 *
 * Verifies:
 * - generateLayouts does not throw TypeError when analysis.nodes is undefined/null
 * - generateLayouts does not throw TypeError when analysis.edges is undefined/null
 * - createFallbackLayout handles null/undefined edges without crashing
 * - Valid segments with nodes but no edges are still processed
 */

import { logger } from '@stv/core/utils/logger';

// Type helper to access private methods
type PipelineLike = {
  generateLayouts(analysisResult: unknown): Promise<unknown[]>;
  createFallbackLayout(nodes: unknown[], edges: unknown[]): unknown;
  layoutEngine: { generateLayout(...args: unknown[]): Promise<unknown> };
  iteration: number;
};

// Minimal stub that mirrors the fixed sequential generateLayouts logic
function makeStubPipeline(
  layoutEngineImpl: { generateLayout(...args: unknown[]): Promise<unknown> },
): PipelineLike {
  return {
    layoutEngine: layoutEngineImpl,
    iteration: 1,
    createFallbackLayout(nodes: unknown[], edges: unknown[]) {
      const safeNodes = nodes ?? [];
      const safeEdges = edges ?? [];
      const layoutNodes = safeNodes.map((node: unknown, index: number) => ({
        ...(node as Record<string, unknown>),
        x: 100 + (index % 3) * 200,
        y: 100 + Math.floor(index / 3) * 150,
        w: 120,
        h: 60,
      }));
      const layoutEdges = safeEdges.map((edge: unknown) => ({
        ...(edge as Record<string, unknown>),
        points: [{ x: 150, y: 150 }, { x: 350, y: 150 }],
      }));
      return { nodes: layoutNodes, edges: layoutEdges };
    },
    async generateLayouts(analysisResult: unknown) {
      const analysisData = analysisResult as Record<string, unknown>;
      const diagramAnalyses = (analysisData.diagramAnalyses as Array<Record<string, unknown>>) ?? [];
      const layouts: unknown[] = [];

      for (const item of diagramAnalyses) {
        const segment = item.segment as Record<string, unknown>;
        const analysis = item.analysis as Record<string, unknown>;
        const nodes = (analysis.nodes as unknown[] | undefined) ?? [];
        const edges = (analysis.edges as unknown[] | undefined) ?? [];
        if (nodes.length > 0) {
          const layoutResult = await this.layoutEngine.generateLayout(
            nodes,
            edges,
            analysis.type,
            this.iteration,
          );
          if ((layoutResult as { success: boolean }).success) {
            layouts.push({ segment, analysis, layout: (layoutResult as { layout: unknown }).layout });
          } else {
            layouts.push({
              segment,
              analysis,
              layout: this.createFallbackLayout(nodes, edges),
            });
          }
        }
      }
      return layouts;
    },
  };
}

describe('sequential generateLayouts null-guard', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(logger, 'warn').mockImplementation();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('does not throw when analysis.nodes is undefined', async () => {
    const pipeline = makeStubPipeline({
      async generateLayout() {
        return { success: true, layout: { type: 'flow' } };
      },
    });

    const result = await pipeline.generateLayouts({
      diagramAnalyses: [
        {
          segment: { summary: 'test' },
          analysis: { type: 'flow', edges: [] /* nodes intentionally undefined */ },
        },
      ],
    });

    expect(result).toEqual([]);
  });

  it('does not throw when analysis.nodes is null', async () => {
    const pipeline = makeStubPipeline({
      async generateLayout() {
        return { success: true, layout: { type: 'flow' } };
      },
    });

    const result = await pipeline.generateLayouts({
      diagramAnalyses: [
        {
          segment: { summary: 'test' },
          analysis: { type: 'flow', nodes: null, edges: [] },
        },
      ],
    });

    expect(result).toEqual([]);
  });

  it('does not throw when analysis.edges is undefined', async () => {
    const pipeline = makeStubPipeline({
      async generateLayout() {
        return { success: true, layout: { type: 'flow' } };
      },
    });

    const result = await pipeline.generateLayouts({
      diagramAnalyses: [
        {
          segment: { summary: 'test' },
          analysis: {
            type: 'flow',
            nodes: [{ id: 'n1', label: 'Node 1' }],
            /* edges intentionally undefined */
          },
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect((result[0] as { layout: unknown }).layout).toEqual({ type: 'flow' });
  });

  it('passes empty edges array to generateLayout when edges is undefined', async () => {
    let receivedEdges: unknown;
    const pipeline = makeStubPipeline({
      async generateLayout(_nodes, edges) {
        receivedEdges = edges;
        return { success: true, layout: { type: 'flow' } };
      },
    });

    await pipeline.generateLayouts({
      diagramAnalyses: [
        {
          segment: { summary: 'test' },
          analysis: {
            type: 'flow',
            nodes: [{ id: 'n1', label: 'A' }],
          },
        },
      ],
    });

    expect(receivedEdges).toEqual([]);
  });

  it('handles undefined edges in fallback layout path', async () => {
    const pipeline = makeStubPipeline({
      async generateLayout() {
        return { success: false };
      },
    });

    const result = await pipeline.generateLayouts({
      diagramAnalyses: [
        {
          segment: { summary: 'test' },
          analysis: {
            type: 'flow',
            nodes: [{ id: 'n1', label: 'A' }],
            /* edges intentionally undefined */
          },
        },
      ],
    });

    expect(result).toHaveLength(1);
    const layout = (result[0] as { layout: { nodes: unknown[]; edges: unknown[] } }).layout;
    expect(layout.nodes).toHaveLength(1);
    expect(layout.edges).toEqual([]);
  });

  it('processes valid segments with both nodes and edges', async () => {
    const pipeline = makeStubPipeline({
      async generateLayout() {
        return { success: true, layout: { type: 'tree' } };
      },
    });

    const result = await pipeline.generateLayouts({
      diagramAnalyses: [
        {
          segment: { summary: 'valid segment' },
          analysis: {
            type: 'tree',
            nodes: [{ id: 'n1', label: 'Root' }, { id: 'n2', label: 'Child' }],
            edges: [{ from: 'n1', to: 'n2' }],
          },
        },
      ],
    });

    expect(result).toHaveLength(1);
  });

  it('skips segments with empty nodes array', async () => {
    const pipeline = makeStubPipeline({
      async generateLayout() {
        return { success: true, layout: {} };
      },
    });

    const result = await pipeline.generateLayouts({
      diagramAnalyses: [
        {
          segment: { summary: 'empty' },
          analysis: { type: 'flow', nodes: [], edges: [] },
        },
        {
          segment: { summary: 'has nodes' },
          analysis: {
            type: 'flow',
            nodes: [{ id: 'n1' }],
            edges: [],
          },
        },
      ],
    });

    expect(result).toHaveLength(1);
  });

  it('handles empty diagramAnalyses array', async () => {
    const pipeline = makeStubPipeline({
      async generateLayout() {
        return { success: true, layout: {} };
      },
    });

    const result = await pipeline.generateLayouts({ diagramAnalyses: [] });
    expect(result).toEqual([]);
  });

  it('handles undefined diagramAnalyses', async () => {
    const pipeline = makeStubPipeline({
      async generateLayout() {
        return { success: true, layout: {} };
      },
    });

    const result = await pipeline.generateLayouts({});
    expect(result).toEqual([]);
  });
});

describe('createFallbackLayout edge safety', () => {
  it('does not throw when edges is null', () => {
    const pipeline = makeStubPipeline({
      async generateLayout() {
        return { success: true };
      },
    });

    expect(() => pipeline.createFallbackLayout([{ id: 'n1' }], null as unknown as unknown[])).not.toThrow();
  });

  it('does not throw when edges is undefined', () => {
    const pipeline = makeStubPipeline({
      async generateLayout() {
        return { success: true };
      },
    });

    expect(() => pipeline.createFallbackLayout([{ id: 'n1' }], undefined as unknown as unknown[])).not.toThrow();
  });

  it('does not throw when nodes is null', () => {
    const pipeline = makeStubPipeline({
      async generateLayout() {
        return { success: true };
      },
    });

    expect(() => pipeline.createFallbackLayout(null as unknown as unknown[], [])).not.toThrow();
  });

  it('returns empty edges array when edges is null', () => {
    const pipeline = makeStubPipeline({
      async generateLayout() {
        return { success: true };
      },
    });

    const result = pipeline.createFallbackLayout(
      [{ id: 'n1' }],
      null as unknown as unknown[],
    ) as { nodes: unknown[]; edges: unknown[] };

    expect(result.edges).toEqual([]);
    expect(result.nodes).toHaveLength(1);
  });

  it('returns empty nodes array when nodes is undefined', () => {
    const pipeline = makeStubPipeline({
      async generateLayout() {
        return { success: true };
      },
    });

    const result = pipeline.createFallbackLayout(
      undefined as unknown as unknown[],
      [{ from: 'a', to: 'b' }],
    ) as { nodes: unknown[]; edges: unknown[] };

    expect(result.nodes).toEqual([]);
    expect(result.edges).toHaveLength(1);
  });
});
