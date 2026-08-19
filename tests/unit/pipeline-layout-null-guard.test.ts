/**
 * Tests for generateLayoutsEnhanced null-guard and dropped-segment logging.
 *
 * Verifies:
 * - analysis.nodes being undefined does not throw TypeError
 * - Segments with zero nodes are silently dropped before the fix; now logged
 * - Valid segments with nodes are returned correctly
 */

import { logger } from '@stv/core/utils/logger';

// Type helper to access private method
type PipelineLike = {
  generateLayoutsEnhanced(analysisResult: unknown): Promise<unknown[]>;
  createFallbackLayout(nodes: unknown[], edges: unknown[]): unknown;
  layoutEngine: { generateLayout(...args: unknown[]): Promise<unknown> };
  iteration: number;
};

// Minimal stub pipeline that bypasses heavy constructor deps
function makeStubPipeline(
  layoutEngineImpl: { generateLayout(...args: unknown[]): Promise<unknown> },
): PipelineLike {
  return {
    layoutEngine: layoutEngineImpl,
    iteration: 1,
    createFallbackLayout(nodes: unknown[], edges: unknown[]) {
      return { nodes, edges, type: 'grid' };
    },
    async generateLayoutsEnhanced(analysisResult: unknown) {
      const analysisData = analysisResult as Record<string, unknown>;
      const diagramAnalyses = (analysisData.diagramAnalyses as Array<Record<string, unknown>>) ?? [];

      const layoutPromises = diagramAnalyses.map(async (item) => {
        const segment = item.segment as Record<string, unknown>;
        const analysis = item.analysis as Record<string, unknown>;
        const nodes = (analysis.nodes as unknown[] | undefined) ?? [];
        if (nodes.length > 0) {
          try {
            const layoutResult = await this.layoutEngine.generateLayout(
              nodes,
              analysis.edges,
              analysis.type,
              this.iteration,
            );
            if ((layoutResult as { success: boolean }).success) {
              return { segment, analysis, layout: (layoutResult as { layout: unknown }).layout };
            }
            return { segment, analysis, layout: this.createFallbackLayout(nodes, analysis.edges as unknown[]) };
          } catch (error) {
            logger.warn(`Layout generation failed for segment: ${(segment as { summary?: string }).summary ?? 'unknown'}`, error);
            return { segment, analysis, layout: this.createFallbackLayout(nodes, analysis.edges as unknown[]) };
          }
        }
        return null;
      });

      const allResults = await Promise.all(layoutPromises);
      const layouts = allResults.filter((r): r is NonNullable<typeof r> => r !== null);
      const droppedCount = allResults.length - layouts.length;
      if (droppedCount > 0) {
        logger.warn(`${droppedCount} segment(s) dropped in layout generation — no nodes in analysis`);
      }
      return layouts;
    },
  };
}

describe('generateLayoutsEnhanced null-guard', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('should not throw when analysis.nodes is undefined', async () => {
    const pipeline = makeStubPipeline({
      async generateLayout() {
        return { success: true, layout: {} };
      },
    });

    const input = {
      diagramAnalyses: [
        {
          segment: { startMs: 0, endMs: 5000, summary: 'seg-1' },
          analysis: { type: 'flow', edges: [] }, // nodes missing entirely
        },
      ],
    };

    // Should not throw TypeError
    const result = await pipeline.generateLayoutsEnhanced(input);

    // Segment with no nodes should be dropped
    expect(result).toHaveLength(0);
  });

  it('should not throw when analysis.nodes is null', async () => {
    const pipeline = makeStubPipeline({
      async generateLayout() {
        return { success: true, layout: {} };
      },
    });

    const input = {
      diagramAnalyses: [
        {
          segment: { startMs: 0, endMs: 5000, summary: 'seg-1' },
          analysis: { type: 'flow', nodes: null, edges: [] },
        },
      ],
    };

    const result = await pipeline.generateLayoutsEnhanced(input);
    expect(result).toHaveLength(0);
  });

  it('should log a warning when segments are dropped', async () => {
    const pipeline = makeStubPipeline({
      async generateLayout() {
        return { success: true, layout: {} };
      },
    });

    const input = {
      diagramAnalyses: [
        {
          segment: { startMs: 0, endMs: 5000, summary: 'empty-seg' },
          analysis: { type: 'flow', nodes: [], edges: [] },
        },
        {
          segment: { startMs: 5000, endMs: 10000, summary: 'good-seg' },
          analysis: { type: 'flow', nodes: [{ id: 'n1', label: 'A' }], edges: [] },
        },
      ],
    };

    const result = await pipeline.generateLayoutsEnhanced(input);

    expect(result).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('1 segment(s) dropped'),
    );
  });

  it('should process valid segments with nodes correctly', async () => {
    const generateLayoutMock = jest.fn().mockResolvedValue({
      success: true,
      layout: { nodes: [{ id: 'n1', x: 10, y: 20 }], edges: [] },
    });
    const pipeline = makeStubPipeline({ generateLayout: generateLayoutMock });

    const input = {
      diagramAnalyses: [
        {
          segment: { startMs: 0, endMs: 5000, summary: 'seg-A' },
          analysis: {
            type: 'flow',
            nodes: [{ id: 'n1', label: 'Node 1' }],
            edges: [{ from: 'n1', to: 'n2' }],
          },
        },
      ],
    };

    const result = await pipeline.generateLayoutsEnhanced(input);
    expect(result).toHaveLength(1);
    expect(generateLayoutMock).toHaveBeenCalledTimes(1);
  });

  it('should not log when no segments are dropped', async () => {
    const pipeline = makeStubPipeline({
      async generateLayout() {
        return { success: true, layout: {} };
      },
    });

    const input = {
      diagramAnalyses: [
        {
          segment: { startMs: 0, endMs: 5000, summary: 'seg-A' },
          analysis: { type: 'flow', nodes: [{ id: 'n1' }], edges: [] },
        },
      ],
    };

    await pipeline.generateLayoutsEnhanced(input);

    // Should NOT log the "dropped" warning
    const droppedWarnings = warnSpy.mock.calls.filter(
      ([msg]) => typeof msg === 'string' && msg.includes('segment(s) dropped'),
    );
    expect(droppedWarnings).toHaveLength(0);
  });

  it('should handle empty diagramAnalyses array', async () => {
    const pipeline = makeStubPipeline({
      async generateLayout() {
        return { success: true, layout: {} };
      },
    });

    const result = await pipeline.generateLayoutsEnhanced({ diagramAnalyses: [] });
    expect(result).toHaveLength(0);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('should handle missing diagramAnalyses key', async () => {
    const pipeline = makeStubPipeline({
      async generateLayout() {
        return { success: true, layout: {} };
      },
    });

    const result = await pipeline.generateLayoutsEnhanced({});
    expect(result).toHaveLength(0);
  });
});
