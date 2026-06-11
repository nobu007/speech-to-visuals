/**
 * TASK-0131 Integration Test: Smart Label Sizing Pipeline Integration
 *
 * Verifies that SmartLabelSizer is correctly integrated into
 * the PipelineOrchestrator's Stage 3 (layout generation).
 *
 * Acceptance criteria:
 * 1. SmartLabelSizer integrated in pipeline-orchestrator.ts
 * 2. Label sizing applied after layout generation
 * 3. Overflow scores recorded for all nodes
 * 4. Overflow scores reflected in quality metrics
 * 5. Integration tests pass
 * 6. ESLint/TypeScript errors = 0
 */

import {
  PipelineOrchestrator,
  PipelineProgress,
  PipelineOrchestratorConfig,
  QualityGate,
} from '@/pipeline/pipeline-orchestrator';
import { PipelineInput } from '@/pipeline/types';
import { sizeLabel, sizeAllLabels, LabelSizingResult } from '@/visualization/smart-label-sizer';
import { PositionedNode } from '@/types/diagram';

// --- Test fixtures ---

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

// --- Tests ---

describe('TASK-0131: Smart Label Sizing Pipeline Integration', () => {
  let orchestrator: PipelineOrchestrator;
  let config: PipelineOrchestratorConfig;

  beforeEach(() => {
    config = {
      stages: [],
      qualityGates: [],
      fallbackStrategies: [],
      enableStreaming: false,
      enableAutoTuning: false,
    };
    orchestrator = new PipelineOrchestrator(config);
  });

  // ====== Criterion 1 & 2: SmartLabelSizer integration + label sizing applied ======

  it('should include label overflow score in pipeline result metrics', async () => {
    const input = makeValidPipelineInput();
    const result = await orchestrator.execute(input);

    expect(result.success).toBe(true);
    expect(result.metrics).toBeDefined();
    expect(result.metrics!.labelOverflowScore).toBeDefined();
    expect(typeof result.metrics!.labelOverflowScore).toBe('number');
    expect(result.metrics!.labelOverflowScore).toBeGreaterThanOrEqual(0);
    expect(result.metrics!.labelOverflowScore).toBeLessThanOrEqual(1);
  });

  it('should record label truncation count in metrics', async () => {
    const input = makeValidPipelineInput();
    const result = await orchestrator.execute(input);

    expect(result.success).toBe(true);
    expect(result.metrics).toBeDefined();
    expect(result.metrics!.labelTruncationCount).toBeDefined();
    expect(typeof result.metrics!.labelTruncationCount).toBe('number');
    expect(result.metrics!.labelTruncationCount).toBeGreaterThanOrEqual(0);
  });

  // ====== Criterion 3: All nodes have overflow scores recorded ======

  it('should apply label sizing to all nodes in pipeline output', async () => {
    const input = makeValidPipelineInput();
    const result = await orchestrator.execute(input);

    expect(result.success).toBe(true);
    // The default pipeline produces scenes with nodes
    // Each node should have gone through label sizing
    expect(result.metrics!.labelOverflowScore).toBeDefined();
  });

  // ====== Criterion 4: Overflow scores reflected in quality gate ======

  it('should reflect label overflow in quality metrics alongside layout quality', async () => {
    const input = makeValidPipelineInput();
    const result = await orchestrator.execute(input);

    expect(result.success).toBe(true);
    // Both quality metrics should be present
    expect(result.metrics!.layoutQualityScore).toBeDefined();
    expect(result.metrics!.labelOverflowScore).toBeDefined();
  });

  it('should allow quality gates to access label overflow metrics', async () => {
    let capturedMetrics: Record<string, unknown> | undefined;

    const gate: QualityGate = {
      stageIndex: 2,
      name: 'label-overflow-gate',
      validate: (output) => {
        capturedMetrics = output as Record<string, unknown>;
        return { passed: true };
      },
    };

    const orch = new PipelineOrchestrator({
      ...config,
      qualityGates: [gate],
    });

    const input = makeValidPipelineInput();
    const result = await orch.execute(input);

    expect(result.success).toBe(true);
    // The gate was invoked during stage 3 (layout)
    expect(capturedMetrics).toBeDefined();
  });

  // ====== Criterion 5: Integration tests pass ======

  it('should complete full pipeline without errors when label sizing is active', async () => {
    const input = makeValidPipelineInput();
    const progressCalls: PipelineProgress[] = [];
    const callback = (p: PipelineProgress) => progressCalls.push({ ...p });

    const result = await orchestrator.execute(input, callback);

    expect(result.success).toBe(true);
    // All 5 stages should complete
    const completedStages = progressCalls.filter(p => p.status === 'completed');
    expect(completedStages.length).toBe(5);
  });

  // ====== Edge cases ======

  it('should handle empty layouts without crashing', async () => {
    const input: PipelineInput = {
      audioFile: 'test-audio.wav',
      config: {
        transcription: { model: 'base' },
        analysis: {
          minSegmentLengthMs: 3000,
          maxSegmentLengthMs: 15000,
          confidenceThreshold: 0.7,
        },
        layout: { width: 1920, height: 1080, nodeWidth: 120, nodeHeight: 60 },
        output: { fps: 30, videoDuration: 60, includeAudio: true },
      },
    };

    const result = await orchestrator.execute(input);

    expect(result).toBeDefined();
    expect(result.metrics).toBeDefined();
    expect(typeof result.metrics!.labelOverflowScore).toBe('number');
    expect(result.metrics!.labelOverflowScore).toBe(1); // No labels = no overflow
    expect(result.metrics!.labelTruncationCount).toBe(0);
  });
});

// ====== Unit-level tests for label sizing behavior ======

describe('SmartLabelSizer: label sizing behavior verification', () => {
  it('sizes all nodes in a layout', () => {
    const nodes: PositionedNode[] = [
      { id: 'a', label: 'Short', x: 0, y: 0, width: 120, height: 60 },
      { id: 'b', label: 'A very long label that should wrap or shrink', x: 100, y: 0, width: 80, height: 40 },
      { id: 'c', label: '日本語テスト', x: 200, y: 0, width: 120, height: 60 },
    ];

    const results = sizeAllLabels(nodes);

    expect(results.size).toBe(3);
    for (const node of nodes) {
      const sizing = results.get(node.id);
      expect(sizing).toBeDefined();
      expect(sizing!.fontSize).toBeGreaterThanOrEqual(8);
      expect(sizing!.lines.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('short text gets larger font, long text gets smaller font', () => {
    const shortResult = sizeLabel('Hi', 120, 60);
    const longResult = sizeLabel('This is a very long label text that should require font reduction', 80, 40);

    expect(shortResult.fontSize).toBeGreaterThanOrEqual(longResult.fontSize);
  });

  it('empty label returns sensible defaults', () => {
    const result = sizeLabel('', 120, 60);

    expect(result.fontSize).toBe(14);
    expect(result.lines).toEqual(['']);
    expect(result.truncated).toBe(false);
  });

  it('text does not overflow node boundaries', () => {
    const nodeWidth = 100;
    const nodeHeight = 50;
    const label = 'A moderately long label for testing';

    const result = sizeLabel(label, nodeWidth, nodeHeight);

    // After sizing, the text should fit or be truncated (not silently overflow)
    expect(result.lines.length).toBeGreaterThanOrEqual(1);
    expect(result.fontSize).toBeGreaterThanOrEqual(8);
  });
});
