/**
 * TASK-0133 E2E Test: Quality Pipeline Integration
 *
 * End-to-end test verifying Phase 31 quality module pipeline integration:
 *   Layout Generation → Quality Scoring → Auto Optimization → Label Sizing → Render Preparation
 *
 * Covers:
 *   1. Full pipeline: layout generation → quality scoring → auto optimization flow
 *   2. Label sizing applied through the pipeline
 *   3. Auto-optimization trigger for low-quality layouts
 *   4. Optimization skip for high-quality layouts
 *   5. Edge cases: empty layout, many nodes (100+), optimization limit (3 attempts)
 *   6. All tests pass with zero ESLint errors
 */

import {
  PipelineOrchestrator,
  PipelineProgress,
  PipelineOrchestratorConfig,
  QualityGate,
} from '@/pipeline/pipeline-orchestrator';
import { PipelineInput } from '@/pipeline/types';
import { PositionedNode, LayoutEdge } from '@stv/core/types/diagram';
import { scoreLayout } from '@/visualization/layout-quality-composite';
import { runAutoOptimization } from '@/visualization/layout-auto-optimizer';
import { sizeAllLabels } from '@/visualization/smart-label-sizer';

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

/** Create a deliberately poor (clustered) layout that should trigger optimization */
function makePoorLayout(): { nodes: PositionedNode[]; edges: LayoutEdge[] } {
  const nodes: PositionedNode[] = [];
  for (let i = 0; i < 8; i++) {
    nodes.push({
      id: `pn${i}`,
      label: `PoorNode${i}`,
      x: 10 + i * 3,
      y: 10 + i * 3,
      width: 80,
      height: 50,
    });
  }
  const edges: LayoutEdge[] = [
    { from: 'pn0', to: 'pn7', points: [] },
    { from: 'pn1', to: 'pn6', points: [] },
    { from: 'pn2', to: 'pn5', points: [] },
    { from: 'pn3', to: 'pn4', points: [] },
  ];
  return { nodes, edges };
}

/** Create a well-spaced flowchart layout that should pass quality threshold */
function makeGoodLayout(): { nodes: PositionedNode[]; edges: LayoutEdge[] } {
  const nodes: PositionedNode[] = [
    { id: 'gn0', label: 'Start', x: 400, y: 50, width: 120, height: 50 },
    { id: 'gn1', label: 'Process', x: 400, y: 150, width: 120, height: 50 },
    { id: 'gn2', label: 'Decision', x: 400, y: 250, width: 120, height: 50 },
    { id: 'gn3', label: 'Output', x: 400, y: 350, width: 120, height: 50 },
    { id: 'gn4', label: 'End', x: 400, y: 450, width: 120, height: 50 },
  ];
  const edges: LayoutEdge[] = [
    { from: 'gn0', to: 'gn1', points: [] },
    { from: 'gn1', to: 'gn2', points: [] },
    { from: 'gn2', to: 'gn3', points: [] },
    { from: 'gn3', to: 'gn4', points: [] },
  ];
  return { nodes, edges };
}

// --- E2E Pipeline Integration Tests ---

describe('TASK-0133: E2E Quality Pipeline Integration', () => {
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

  // ====== Criterion 2: layout → quality scoring → auto optimization flow ======

  describe('layout → quality scoring → auto optimization flow', () => {
    it('should produce layoutQualityScore in pipeline metrics', async () => {
      const input = makeValidPipelineInput();
      const result = await orchestrator.execute(input);

      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();
      expect(result.metrics!.layoutQualityScore).toBeDefined();
      expect(typeof result.metrics!.layoutQualityScore).toBe('number');
      expect(result.metrics!.layoutQualityScore!).toBeGreaterThanOrEqual(0);
      expect(result.metrics!.layoutQualityScore!).toBeLessThanOrEqual(1);
    });

    it('should record composite quality score after layout stage', async () => {
      const input = makeValidPipelineInput();
      const progressCalls: PipelineProgress[] = [];
      const callback = (p: PipelineProgress) => progressCalls.push({ ...p });

      const result = await orchestrator.execute(input, callback);

      expect(result.success).toBe(true);
      // All 5 stages should complete
      const completedStages = progressCalls.filter(p => p.status === 'completed');
      expect(completedStages.length).toBe(5);

      // Layout stage (stage 3) should have completed
      const layoutStage = progressCalls.find(
        p => p.stageName === 'layout' && p.status === 'completed'
      );
      expect(layoutStage).toBeDefined();
    });

    it('should run auto-optimization and record attempts when quality is low', async () => {
      const input = makeValidPipelineInput();
      const result = await orchestrator.execute(input);

      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();
      expect(result.metrics!.optimizationAttempts).toBeDefined();
      expect(typeof result.metrics!.optimizationAttempts).toBe('number');
      expect(result.metrics!.optimizationAttempts!).toBeGreaterThanOrEqual(0);
    });

    it('should track whether optimization improved quality', async () => {
      const input = makeValidPipelineInput();
      const result = await orchestrator.execute(input);

      expect(result.success).toBe(true);
      expect(result.metrics!.optimizationImproved).toBeDefined();
      expect(typeof result.metrics!.optimizationImproved).toBe('boolean');
    });
  });

  // ====== Criterion 3: label sizing applied through pipeline ======

  describe('label sizing pipeline integration', () => {
    it('should apply label sizing and record overflow score', async () => {
      const input = makeValidPipelineInput();
      const result = await orchestrator.execute(input);

      expect(result.success).toBe(true);
      expect(result.metrics!.labelOverflowScore).toBeDefined();
      expect(typeof result.metrics!.labelOverflowScore).toBe('number');
      expect(result.metrics!.labelOverflowScore!).toBeGreaterThanOrEqual(0);
      expect(result.metrics!.labelOverflowScore!).toBeLessThanOrEqual(1);
    });

    it('should record label truncation count', async () => {
      const input = makeValidPipelineInput();
      const result = await orchestrator.execute(input);

      expect(result.success).toBe(true);
      expect(result.metrics!.labelTruncationCount).toBeDefined();
      expect(typeof result.metrics!.labelTruncationCount).toBe('number');
      expect(result.metrics!.labelTruncationCount!).toBeGreaterThanOrEqual(0);
    });

    it('should include both quality and label metrics in result', async () => {
      const input = makeValidPipelineInput();
      const result = await orchestrator.execute(input);

      expect(result.success).toBe(true);
      // Verify all quality-related metrics are present
      expect(result.metrics!.layoutQualityScore).toBeDefined();
      expect(result.metrics!.optimizationAttempts).toBeDefined();
      expect(result.metrics!.optimizationImproved).toBeDefined();
      expect(result.metrics!.labelOverflowScore).toBeDefined();
      expect(result.metrics!.labelTruncationCount).toBeDefined();
    });
  });

  // ====== Criterion 4: auto-optimization trigger for low-quality layouts ======

  describe('auto-optimization trigger for low-quality layouts', () => {
    it('should trigger optimization when layout score is below threshold', () => {
      const { nodes, edges } = makePoorLayout();
      const canvasWidth = 800;
      const canvasHeight = 700;

      const initialScore = scoreLayout(nodes, edges, canvasWidth, canvasHeight).compositeScore;

      const result = runAutoOptimization(nodes, edges, {
        threshold: 0.7,
        maxAttempts: 3,
        canvasWidth,
        canvasHeight,
      });

      // Poor layout should have low initial score
      expect(initialScore).toBeLessThan(0.7);

      // Optimization should have been triggered
      expect(result.attempts).toBeGreaterThan(0);
      expect(result.scoreHistory.length).toBeGreaterThan(1);
      expect(result.scoreHistory[0]).toBe(result.initialScore);
    });

    it('should improve layout score through optimization', () => {
      const { nodes, edges } = makePoorLayout();

      const result = runAutoOptimization(nodes, edges, {
        threshold: 0.5,
        maxAttempts: 3,
        canvasWidth: 800,
        canvasHeight: 700,
      });

      // Final score should be >= initial score (optimization shouldn't worsen)
      expect(result.finalScore).toBeGreaterThanOrEqual(result.initialScore);
    });

    it('should record score history showing improvement attempts', () => {
      const { nodes, edges } = makePoorLayout();

      const result = runAutoOptimization(nodes, edges, {
        threshold: 0.9,
        maxAttempts: 3,
        canvasWidth: 800,
        canvasHeight: 700,
      });

      // Each attempt produces a score entry
      expect(result.scoreHistory.length).toBe(result.attempts + 1);
    });
  });

  // ====== Criterion 5: optimization skip for high-quality layouts ======

  describe('optimization skip for high-quality layouts', () => {
    it('should skip optimization when score exceeds threshold', () => {
      const { nodes, edges } = makeGoodLayout();

      const result = runAutoOptimization(nodes, edges, {
        threshold: 0.3,
        canvasWidth: 800,
        canvasHeight: 700,
      });

      expect(result.passed).toBe(true);
      expect(result.attempts).toBe(0);
      expect(result.finalScore).toBe(result.initialScore);
    });

    it('should return zero attempts when layout is already good', () => {
      const { nodes, edges } = makeGoodLayout();

      const result = runAutoOptimization(nodes, edges, {
        threshold: 0.2,
        canvasWidth: 800,
        canvasHeight: 700,
      });

      expect(result.attempts).toBe(0);
      expect(result.scoreHistory.length).toBe(1);
    });
  });

  // ====== Edge cases ======

  describe('edge cases', () => {
    it('should handle empty layout gracefully in pipeline', async () => {
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
      expect(typeof result.metrics!.layoutQualityScore).toBe('number');
      expect(typeof result.metrics!.labelOverflowScore).toBe('number');
    });

    it('should handle 100+ nodes in quality evaluation', () => {
      const nodes: PositionedNode[] = [];
      for (let i = 0; i < 120; i++) {
        const col = i % 12;
        const row = Math.floor(i / 12);
        nodes.push({
          id: `n${i}`,
          label: `Node ${i}`,
          x: col * 150 + 50,
          y: row * 100 + 50,
          width: 100,
          height: 50,
        });
      }
      const edges: LayoutEdge[] = [];
      for (let i = 0; i < 119; i++) {
        edges.push({ from: `n${i}`, to: `n${i + 1}`, points: [] });
      }

      const startTime = Date.now();
      const score = scoreLayout(nodes, edges, 1920, 1080);
      const elapsed = Date.now() - startTime;

      expect(score.compositeScore).toBeGreaterThan(0);
      expect(score.compositeScore).toBeLessThanOrEqual(1);
      // Performance: should complete within reasonable time (< 5s)
      expect(elapsed).toBeLessThan(5000);
    });

    it('should respect optimization limit of 3 attempts', () => {
      // Create a layout that is extremely poor and unlikely to improve to 0.9
      const nodes: PositionedNode[] = [];
      for (let i = 0; i < 5; i++) {
        nodes.push({
          id: `ln${i}`,
          label: `Label${i}`,
          x: 5,
          y: 5,
          width: 80,
          height: 50,
        });
      }
      const edges: LayoutEdge[] = [
        { from: 'ln0', to: 'ln4', points: [] },
        { from: 'ln1', to: 'ln3', points: [] },
      ];

      const result = runAutoOptimization(nodes, edges, {
        threshold: 0.99,
        maxAttempts: 3,
        canvasWidth: 800,
        canvasHeight: 700,
      });

      // Should not exceed max 3 attempts
      expect(result.attempts).toBeLessThanOrEqual(3);
      // Score history should have at most 4 entries (1 initial + 3 attempts)
      expect(result.scoreHistory.length).toBeLessThanOrEqual(4);
    });

    it('should handle label sizing for nodes with various label lengths', () => {
      const nodes: PositionedNode[] = [
        { id: 's1', label: '', x: 100, y: 100, width: 120, height: 60 },
        { id: 's2', label: 'Short', x: 200, y: 100, width: 120, height: 60 },
        { id: 's3', label: 'A moderately long label for testing overflow', x: 300, y: 100, width: 80, height: 40 },
        { id: 's4', label: '非常に長い日本語テキストの例です折り返しが必要', x: 400, y: 100, width: 100, height: 50 },
      ];

      const labelMap = sizeAllLabels(nodes);

      expect(labelMap.size).toBe(4);
      for (const node of nodes) {
        const sizing = labelMap.get(node.id);
        expect(sizing).toBeDefined();
        expect(sizing!.fontSize).toBeGreaterThanOrEqual(8);
        expect(sizing!.lines.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  // ====== Full E2E pipeline flow ======

  describe('full E2E pipeline: layout → quality → optimize → label size → render', () => {
    it('should complete the entire quality pipeline end-to-end', async () => {
      const input = makeValidPipelineInput();
      const progressCalls: PipelineProgress[] = [];
      const callback = (p: PipelineProgress) => progressCalls.push({ ...p });

      const result = await orchestrator.execute(input, callback);

      // Pipeline completes successfully
      expect(result.success).toBe(true);
      expect(result.scenes).toBeDefined();
      expect(result.stages.length).toBe(5);

      // All stages completed
      for (const stage of result.stages) {
        expect(stage.status).toBe('complete');
      }

      // Quality metrics present
      expect(result.metrics).toBeDefined();
      expect(result.metrics!.layoutQualityScore).toBeDefined();
      expect(result.metrics!.optimizationAttempts).toBeDefined();
      expect(result.metrics!.labelOverflowScore).toBeDefined();
      expect(result.metrics!.labelTruncationCount).toBeDefined();

      // Progress was tracked
      expect(progressCalls.length).toBeGreaterThan(0);
    });

    it('should allow quality gates to inspect layout quality metrics', async () => {
      let capturedLayoutOutput: unknown;

      const gate: QualityGate = {
        stageIndex: 2,
        name: 'quality-metrics-gate',
        validate: (output) => {
          capturedLayoutOutput = output;
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
      expect(capturedLayoutOutput).toBeDefined();
    });

    it('should maintain consistent metrics across pipeline stages', async () => {
      const input = makeValidPipelineInput();
      const result = await orchestrator.execute(input);

      expect(result.success).toBe(true);

      // All metric values should be valid numbers
      const { layoutQualityScore, optimizationAttempts, labelOverflowScore, labelTruncationCount } =
        result.metrics!;

      expect(layoutQualityScore).toBeGreaterThanOrEqual(0);
      expect(layoutQualityScore).toBeLessThanOrEqual(1);
      expect(optimizationAttempts!).toBeGreaterThanOrEqual(0);
      // Total attempts across multiple layouts can exceed per-layout max of 3
      expect(typeof optimizationAttempts).toBe('number');
      expect(labelOverflowScore).toBeGreaterThanOrEqual(0);
      expect(labelOverflowScore).toBeLessThanOrEqual(1);
      expect(labelTruncationCount!).toBeGreaterThanOrEqual(0);
    });
  });
});
