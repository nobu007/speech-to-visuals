/**
 * REQ-375 / REQ-377: PipelineOrchestrator layout-overlap measurement
 *
 * The layout stage used to FABRICATE its `layoutOverlap` from the composite
 * layout quality score (`score < 0.7 ? 1 : 0`) and launder the score into
 * `edgeCompleteness`. Both directions were wrong: a low-quality-but-clean
 * layout reported a phantom "1 overlap" (a critical eq-0 violation), and a
 * real overlap under a ≥0.7 score reported a perfect 0 (the +5 zero-overlap
 * bonus plus a green eq-0 gate for an overlapping run).
 *
 * These witnesses pin the replacement: a measured count via the canonical
 * `countOverlapPairs` scan, aggregated across the run's layouts, recorded
 * only when at least one layout was actually measured.
 */

import { PipelineOrchestrator } from '@/pipeline/pipeline-orchestrator';
import { QualityMonitor } from '@/pipeline/quality-monitor';

/** Positioned-node shape `countOverlapPairs` consumes (x/y/width/height). */
function node(id: string, x: number, y: number): Record<string, unknown> {
  return { id, label: id.toUpperCase(), x, y, width: 100, height: 100 };
}

/** White-box access to the private measurement/record helpers. */
type OrchestratorInternals = {
  measureLayoutOverlaps: (
    layoutResults: unknown[],
  ) => { measuredLayouts: number; overlapCount: number };
  recordStageQuality: (
    stage: 'transcription' | 'analysis' | 'layout' | 'rendering',
    stageOutput: unknown,
    qualityScores: Record<string, number | undefined>,
    measuredLayout?: { measuredLayouts: number; overlapCount: number },
  ) => void;
};

function internals(orchestrator: PipelineOrchestrator): OrchestratorInternals {
  return orchestrator as unknown as OrchestratorInternals;
}

describe('PipelineOrchestrator layout-overlap measurement (REQ-377)', () => {
  let recordMetricsSpy: jest.SpyInstance;

  beforeEach(() => {
    const monitor = QualityMonitor.getInstance();
    monitor.reset();
    recordMetricsSpy = jest
      .spyOn(monitor, 'recordMetrics')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    recordMetricsSpy.mockRestore();
  });

  describe('measureLayoutOverlaps', () => {
    it('counts an overlapping pair as 1 overlap in 1 measured layout', () => {
      const result = internals(new PipelineOrchestrator()).measureLayoutOverlaps([
        { layout: { nodes: [node('a', 0, 0), node('b', 50, 50)], edges: [] } },
      ]);

      expect(result).toEqual({ measuredLayouts: 1, overlapCount: 1 });
    });

    it('reports a measured 0 for disjoint nodes (a real reading)', () => {
      const result = internals(new PipelineOrchestrator()).measureLayoutOverlaps([
        { layout: { nodes: [node('a', 0, 0), node('b', 1000, 1000)], edges: [] } },
      ]);

      expect(result).toEqual({ measuredLayouts: 1, overlapCount: 0 });
    });

    it('aggregates the count across every layout of the run', () => {
      const result = internals(new PipelineOrchestrator()).measureLayoutOverlaps([
        { layout: { nodes: [node('a', 0, 0), node('b', 50, 50)], edges: [] } },
        { layout: { nodes: [node('c', 0, 0), node('d', 60, 60)], edges: [] } },
        { layout: { nodes: [node('e', 0, 0), node('f', 900, 900)], edges: [] } },
      ]);

      // 2 overlapping layouts + 1 clean one, all measured.
      expect(result).toEqual({ measuredLayouts: 3, overlapCount: 2 });
    });

    it('measures nothing for empty-node layouts, missing layouts, or no results', () => {
      const orchestrator = internals(new PipelineOrchestrator());
      expect(orchestrator.measureLayoutOverlaps([{ layout: { nodes: [], edges: [] } }]))
        .toEqual({ measuredLayouts: 0, overlapCount: 0 });
      expect(orchestrator.measureLayoutOverlaps([{}])).toEqual({ measuredLayouts: 0, overlapCount: 0 });
      expect(orchestrator.measureLayoutOverlaps([])).toEqual({ measuredLayouts: 0, overlapCount: 0 });
    });
  });

  describe('recordStageQuality (layout stage)', () => {
    it('records the MEASURED 0 even when the composite score is low (old code fabricated 1)', () => {
      internals(new PipelineOrchestrator()).recordStageQuality(
        'layout',
        { layoutQualityScore: 0.5 },
        {},
        { measuredLayouts: 1, overlapCount: 0 },
      );

      expect(recordMetricsSpy).toHaveBeenCalledTimes(1);
      expect(recordMetricsSpy.mock.calls[0][0]).toEqual({ layoutOverlap: 0 });
    });

    it('records the MEASURED count even when the composite score is high (old code fabricated 0)', () => {
      internals(new PipelineOrchestrator()).recordStageQuality(
        'layout',
        { layoutQualityScore: 0.9 },
        {},
        { measuredLayouts: 2, overlapCount: 3 },
      );

      expect(recordMetricsSpy.mock.calls[0][0]).toEqual({ layoutOverlap: 3 });
    });

    it('does not launder the composite score into edgeCompleteness', () => {
      internals(new PipelineOrchestrator()).recordStageQuality(
        'layout',
        { layoutQualityScore: 0.82 },
        {},
        { measuredLayouts: 1, overlapCount: 0 },
      );

      // edgeCompleteness has its own analysis-time producer (GeminiAnalyzer
      // edge-ratio); the layout composite score is not that metric.
      expect(recordMetricsSpy.mock.calls[0][0].edgeCompleteness).toBeUndefined();
    });

    it('records nothing when no layout was measured (empty-layout run)', () => {
      internals(new PipelineOrchestrator()).recordStageQuality(
        'layout',
        { layoutQualityScore: 0.8 },
        {},
        { measuredLayouts: 0, overlapCount: 0 },
      );

      // No vacuous "measured 0" — recordMetrics' DEFAULT (null) then speaks.
      expect(recordMetricsSpy).not.toHaveBeenCalled();
    });

    it('records nothing when the measurement argument is absent', () => {
      internals(new PipelineOrchestrator()).recordStageQuality(
        'layout',
        { layoutQualityScore: 0.8 },
        {},
      );

      expect(recordMetricsSpy).not.toHaveBeenCalled();
    });
  });
});
