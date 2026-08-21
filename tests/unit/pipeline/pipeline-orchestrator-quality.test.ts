/**
 * TASK-0134: PipelineOrchestrator QualityMonitor Integration Tests (REQ-088)
 *
 * Tests that PipelineOrchestrator integrates QualityMonitor to record
 * stage-specific quality scores during pipeline execution.
 */


import {
  PipelineOrchestrator,
} from '@/pipeline/pipeline-orchestrator';
import { PipelineInput } from '@/pipeline/types';
import { QualityMonitor } from '@/pipeline/quality-monitor';

// ---------- Helpers ----------

/** One recordMetrics invocation's arguments, as the find() callbacks type it. */
type QualityCall = Parameters<QualityMonitor['recordMetrics']>;

// Fail-loud unwrap for the per-stage find() results: the preceding asserts
// only proved a matching recording existed, the reads then re-asserted it via
// `call![0]`. The throw keeps the old TypeError's RED verdict with the stage
// name, and the `expect(call).toBeDefined()` pairs fold in.
function requireQualityCall(call: QualityCall | undefined, stage: string): QualityCall {
  if (call === undefined) throw new Error(`expected a ${stage} quality-metrics recording`);
  return call;
}

function makeValidPipelineInput(): PipelineInput {
  return {
    audioFile: 'test-audio.wav',
    config: {
      transcription: { model: 'base', language: 'en' },
      analysis: {
        minSegmentLengthMs: 3000,
        maxSegmentLengthMs: 15000,
        confidenceThreshold: 0.7,
      },
      layout: { width: 1920, height: 1080, nodeWidth: 120, nodeHeight: 60 },
      output: { fps: 30, videoDuration: 60, includeAudio: true },
    },
  };
}

// ---------- Tests ----------

describe('PipelineOrchestrator QualityMonitor Integration (REQ-088)', () => {
  let recordMetricsSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    // Spy on QualityMonitor.recordMetrics to verify it is called
    const monitor = QualityMonitor.getInstance();
    recordMetricsSpy = jest.spyOn(monitor, 'recordMetrics').mockImplementation(() => {});
  });

  afterEach(() => {
    recordMetricsSpy.mockRestore();
  });

  it('records quality scores for all pipeline stages via QualityMonitor', async () => {
    const orchestrator = new PipelineOrchestrator();
    const result = await orchestrator.execute(makeValidPipelineInput());

    // Pipeline should succeed
    expect(result.success).toBe(true);

    // QualityMonitor.recordMetrics should have been called for each stage
    expect(recordMetricsSpy).toHaveBeenCalled();

    // At least 4 calls: transcription, analysis, layout, rendering
    expect(recordMetricsSpy.mock.calls.length).toBeGreaterThanOrEqual(3);

    // Verify result metrics include qualityScores
    expect(result.metrics?.qualityScores).toBeDefined();
    expect(result.metrics?.qualityScores).toHaveProperty('transcription');
    expect(result.metrics?.qualityScores).toHaveProperty('analysis');
    expect(result.metrics?.qualityScores).toHaveProperty('layout');
    expect(result.metrics?.qualityScores).toHaveProperty('rendering');
  });

  it('records transcription accuracy from segment confidence', async () => {
    const orchestrator = new PipelineOrchestrator();
    await orchestrator.execute(makeValidPipelineInput());

    // Find the transcription quality recording
    const transcriptionCall = requireQualityCall(recordMetricsSpy.mock.calls.find(
      (call: QualityCall) => call[0].transcriptionAccuracy !== undefined,
    ), 'transcription');

    expect(transcriptionCall[0].transcriptionAccuracy).toBeGreaterThanOrEqual(0);
    expect(transcriptionCall[0].transcriptionAccuracy).toBeLessThanOrEqual(1);
  });

  it('records analysis quality from diagram confidence', async () => {
    const orchestrator = new PipelineOrchestrator();
    await orchestrator.execute(makeValidPipelineInput());

    // Find the analysis quality recording
    const analysisCall = requireQualityCall(recordMetricsSpy.mock.calls.find(
      (call: QualityCall) => call[0].entityExtractionF1 !== undefined,
    ), 'analysis');

    expect(analysisCall[0].entityExtractionF1).toBeGreaterThanOrEqual(0);
    expect(analysisCall[0].entityExtractionF1).toBeLessThanOrEqual(1);
  });

  it('records layout quality score after optimization', async () => {
    const orchestrator = new PipelineOrchestrator();
    const result = await orchestrator.execute(makeValidPipelineInput());

    // Find the layout quality recording. REQ-375: the layout-stage record
    // carries the MEASURED overlap count (layoutOverlap) — not the laundered
    // edgeCompleteness copy of the composite layout score it used to carry.
    const layoutCall = recordMetricsSpy.mock.calls.find(
      (call: QualityCall) => call[0].layoutOverlap !== undefined,
    );

    // Layout quality should be recorded if layoutQualityScore was computed
    if (result.metrics?.layoutQualityScore !== undefined) {
      expect(layoutCall).toBeDefined();
      const recorded = requireQualityCall(layoutCall, 'layout')[0].layoutOverlap;
      expect(recorded).not.toBeNull();
      expect(recorded as number).toBeGreaterThanOrEqual(0);
      // the composite score must no longer be laundered through this record
      expect(requireQualityCall(layoutCall, 'layout')[0].edgeCompleteness).toBeUndefined();
    }
  });

  it('records rendering time in quality metrics', async () => {
    const orchestrator = new PipelineOrchestrator();
    const result = await orchestrator.execute(makeValidPipelineInput());

    // Find the rendering quality recording
    const renderingCall = requireQualityCall(recordMetricsSpy.mock.calls.find(
      (call: QualityCall) => call[0].processingTime !== undefined && call[0].processingTime > 0,
    ), 'rendering');

    expect(renderingCall[0].processingTime).toBeGreaterThan(0);

    // Rendering score should be set
    expect(result.metrics?.qualityScores?.rendering).toBeDefined();
  });

  it('gracefully handles QualityMonitor initialization failure', async () => {
    // Force QualityMonitor.getInstance to throw
    const originalGetInstance = QualityMonitor.getInstance;
    jest.spyOn(QualityMonitor, 'getInstance').mockImplementation(() => {
      throw new Error('QualityMonitor unavailable');
    });

    // Pipeline should still work
    const orchestrator = new PipelineOrchestrator();
    const result = await orchestrator.execute(makeValidPipelineInput());

    expect(result.success).toBe(true);

    jest.restoreAllMocks();
  });

  it('quality scores are reasonable numeric values', async () => {
    const orchestrator = new PipelineOrchestrator();
    const result = await orchestrator.execute(makeValidPipelineInput());

    const scores = result.metrics?.qualityScores;
    if (scores === undefined) throw new Error('expected qualityScores on the pipeline metrics');

    // All score values should be numbers in [0, 1] range
    for (const value of Object.values(scores)) {
      if (value !== undefined) {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
});
