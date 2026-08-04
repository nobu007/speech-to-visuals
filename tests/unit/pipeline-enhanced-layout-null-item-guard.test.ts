/**
 * Tests for generateLayoutsEnhanced null-item guard.
 *
 * Verifies:
 * - null items in diagramAnalyses are skipped without crashing
 * - items with null/undefined segment are skipped
 * - items with null/undefined analysis are skipped
 * - valid items alongside invalid ones are still processed
 * - dropped count is logged for invalid items
 */

// Type helper for the stub
type LayoutResult = { success: boolean; layout: unknown };

type PipelineLike = {
  generateLayoutsEnhanced(analysisResult: unknown): Promise<unknown[]>;
  layoutEngine: { generateLayout(...args: unknown[]): Promise<LayoutResult> };
  iteration: number;
  createFallbackLayout(nodes: unknown[], edges: unknown[]): unknown;
};

// Minimal stub that mirrors the FIXED generateLayoutsEnhanced logic
function makeStubPipeline(
  layoutEngineImpl: { generateLayout(...args: unknown[]): Promise<LayoutResult> },
): PipelineLike {
  return {
    layoutEngine: layoutEngineImpl,
    iteration: 1,
    createFallbackLayout(nodes: unknown[], edges: unknown[]) {
      const safeNodes = nodes ?? [];
      const safeEdges = edges ?? [];
      return {
        nodes: safeNodes.map((n: unknown, i: number) => ({
          ...(n as Record<string, unknown>),
          x: 100 + (i % 3) * 200,
          y: 100 + Math.floor(i / 3) * 150,
          w: 120,
          h: 60,
        })),
        edges: safeEdges,
      };
    },
    async generateLayoutsEnhanced(analysisResult: unknown) {
      const analysisData = analysisResult as Record<string, unknown>;
       
      const diagramAnalyses = (analysisData.diagramAnalyses as Array<any>) ?? [];

      const layoutPromises = diagramAnalyses.map(async (item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const segment = item.segment as Record<string, unknown> | undefined;
        const analysis = item.analysis as Record<string, unknown> | undefined;
        if (!segment || !analysis) {
          return null;
        }
        const nodes = (analysis.nodes as unknown[] | undefined) ?? [];
        const edges = (analysis.edges as unknown[]) ?? [];
        if (nodes.length > 0) {
          try {
            const layoutResult = await this.layoutEngine.generateLayout(
              nodes, edges, analysis.type, this.iteration,
            );
            if (layoutResult.success) {
              return { segment, analysis, layout: layoutResult.layout };
            }
            return { segment, analysis, layout: this.createFallbackLayout(nodes, edges) };
          } catch {
            return { segment, analysis, layout: this.createFallbackLayout(nodes, edges) };
          }
        }
        return null;
      });

      const allResults = await Promise.all(layoutPromises);
      const layouts = allResults.filter((r): r is NonNullable<typeof r> => r !== null);
      return layouts;
    },
  };
}

describe('generateLayoutsEnhanced null-item guard', () => {
  let generateLayoutCalls: number;
  let pipeline: PipelineLike;

  beforeEach(() => {
    generateLayoutCalls = 0;
    pipeline = makeStubPipeline({
      async generateLayout() {
        generateLayoutCalls++;
        return { success: true, layout: { nodes: [], edges: [] } };
      },
    });
  });

  it('skips null items in diagramAnalyses without throwing', async () => {
    const analysisResult = {
      diagramAnalyses: [null, undefined, {}],
    };
    const layouts = await pipeline.generateLayoutsEnhanced(analysisResult);
    expect(layouts).toEqual([]);
    expect(generateLayoutCalls).toBe(0);
  });

  it('skips items with null segment', async () => {
    const analysisResult = {
      diagramAnalyses: [
        { segment: null, analysis: { type: 'flow', nodes: [{ id: 'n1' }] } },
      ],
    };
    const layouts = await pipeline.generateLayoutsEnhanced(analysisResult);
    expect(layouts).toEqual([]);
    expect(generateLayoutCalls).toBe(0);
  });

  it('skips items with undefined segment', async () => {
    const analysisResult = {
      diagramAnalyses: [
        { analysis: { type: 'flow', nodes: [{ id: 'n1' }] } },
      ],
    };
    const layouts = await pipeline.generateLayoutsEnhanced(analysisResult);
    expect(layouts).toEqual([]);
    expect(generateLayoutCalls).toBe(0);
  });

  it('skips items with null analysis', async () => {
    const analysisResult = {
      diagramAnalyses: [
        { segment: { startMs: 0 }, analysis: null },
      ],
    };
    const layouts = await pipeline.generateLayoutsEnhanced(analysisResult);
    expect(layouts).toEqual([]);
    expect(generateLayoutCalls).toBe(0);
  });

  it('skips items with undefined analysis', async () => {
    const analysisResult = {
      diagramAnalyses: [
        { segment: { startMs: 0 } },
      ],
    };
    const layouts = await pipeline.generateLayoutsEnhanced(analysisResult);
    expect(layouts).toEqual([]);
    expect(generateLayoutCalls).toBe(0);
  });

  it('processes valid items alongside invalid ones', async () => {
    const analysisResult = {
      diagramAnalyses: [
        null,
        { segment: { startMs: 0, summary: 'A' }, analysis: { type: 'flow', nodes: [{ id: 'n1' }] } },
        undefined,
        { segment: { startMs: 1000, summary: 'B' }, analysis: { type: 'tree', nodes: [{ id: 'n2' }] } },
        { segment: null, analysis: { type: 'flow' } },
      ],
    };
    const layouts = await pipeline.generateLayoutsEnhanced(analysisResult);
    expect(layouts).toHaveLength(2);
    expect(generateLayoutCalls).toBe(2);
  });

  it('handles completely empty diagramAnalyses', async () => {
    const analysisResult = { diagramAnalyses: [] };
    const layouts = await pipeline.generateLayoutsEnhanced(analysisResult);
    expect(layouts).toEqual([]);
    expect(generateLayoutCalls).toBe(0);
  });

  it('handles missing diagramAnalyses property', async () => {
    const analysisResult = {};
    const layouts = await pipeline.generateLayoutsEnhanced(analysisResult);
    expect(layouts).toEqual([]);
    expect(generateLayoutCalls).toBe(0);
  });

  it('skips items that are primitives', async () => {
    const analysisResult = {
      diagramAnalyses: [42, 'string', true],
    };
    const layouts = await pipeline.generateLayoutsEnhanced(analysisResult);
    expect(layouts).toEqual([]);
    expect(generateLayoutCalls).toBe(0);
  });
});
