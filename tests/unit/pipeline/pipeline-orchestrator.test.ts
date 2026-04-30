/**
 * TASK-0043: Pipeline Orchestrator Tests (TDD)
 *
 * Tests for the PipelineOrchestrator that orchestrates
 * Stage 1-5: Audio transcription -> Content analysis -> Layout generation
 *            -> Video preparation -> Video rendering
 */

import {
  PipelineOrchestrator,
  PipelineProgress,
  PipelineOrchestratorConfig,
  QualityGate,
  FallbackStrategy,
} from '@/pipeline/pipeline-orchestrator';
import { PipelineInput, PipelineResult, PipelineStage, PipelineConfig } from '@/pipeline/types';

// ---------- Mock Factories ----------

function makeMockTranscriptionResult(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    segments: [
      { id: 0, start: 0, end: 5, text: 'First step is to connect the database.', confidence: 0.95 },
      { id: 1, start: 5, end: 10, text: 'Next, run the migration scripts.', confidence: 0.92 },
    ],
    language: 'en',
    duration: 10,
    ...overrides,
  };
}

function makeMockContentSegments() {
  return [
    {
      startMs: 0,
      endMs: 5000,
      text: 'First step is to connect the database.',
      summary: 'Database connection step',
      keyphrases: ['database', 'connect'],
      confidence: 0.9,
    },
    {
      startMs: 5000,
      endMs: 10000,
      text: 'Next, run the migration scripts.',
      summary: 'Migration scripts step',
      keyphrases: ['migration', 'scripts'],
      confidence: 0.88,
    },
  ];
}

function makeMockDiagramAnalysis() {
  return {
    type: 'flow' as const,
    confidence: 0.9,
    nodes: [
      { id: 'n1', label: 'Connect DB' },
      { id: 'n2', label: 'Run Migration' },
    ],
    edges: [{ from: 'n1', to: 'n2', label: 'then' }],
    reasoning: 'Sequential process steps detected',
  };
}

function makeMockLayoutResult() {
  return {
    success: true,
    layout: {
      nodes: [
        { id: 'n1', label: 'Connect DB', x: 100, y: 100, w: 120, h: 60 },
        { id: 'n2', label: 'Run Migration', x: 300, y: 100, w: 120, h: 60 },
      ],
      edges: [{ from: 'n1', to: 'n2', points: [{ x: 220, y: 130 }, { x: 300, y: 130 }] }],
    },
    confidence: 0.85,
  };
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

describe('PipelineOrchestrator', () => {
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

  // ====== 1. Construction & Config Validation ======

  describe('construction and config validation', () => {
    it('should instantiate with default config', () => {
      const orch = new PipelineOrchestrator();
      expect(orch).toBeDefined();
    });

    it('should instantiate with a provided config', () => {
      const orch = new PipelineOrchestrator(config);
      expect(orch).toBeDefined();
    });

    it('should reject invalid PipelineConfig at init time (REQ-038)', () => {
      const badInput: PipelineInput = {
        audioFile: 'test.wav',
        config: {
          transcription: { model: 'invalid-model' as unknown as 'base' | 'tiny' | 'small' | 'medium' | 'large' },
          analysis: {
            minSegmentLengthMs: -1,
            maxSegmentLengthMs: 500,
            confidenceThreshold: 1.5,
          },
          layout: { width: 0, height: 0, nodeWidth: 0, nodeHeight: 0 },
          output: { fps: 0, videoDuration: -1, includeAudio: false },
        },
      };

      expect(() => orchestrator.validateInput(badInput)).toThrow();
    });

    it('should accept valid PipelineConfig at init time', () => {
      const input = makeValidPipelineInput();
      expect(() => orchestrator.validateInput(input)).not.toThrow();
    });
  });

  // ====== 2. Full Pipeline Stage Execution ======

  describe('full pipeline execution (Stages 1-5)', () => {
    it('should execute all 5 stages in order', async () => {
      const input = makeValidPipelineInput();
      const progressCalls: PipelineProgress[] = [];

      const progressCallback = (p: PipelineProgress) => progressCalls.push({ ...p });

      const result = await orchestrator.execute(input, progressCallback);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      // Verify all 5 stages were reported
      const stageNames = progressCalls.map((p) => p.stageName);
      expect(stageNames).toContain('transcription');
      expect(stageNames).toContain('analysis');
      expect(stageNames).toContain('layout');
      expect(stageNames).toContain('preparation');
      expect(stageNames).toContain('rendering');
    });

    it('should return scenes in PipelineResult', async () => {
      const input = makeValidPipelineInput();
      const result = await orchestrator.execute(input);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.scenes)).toBe(true);
      expect(result.scenes.length).toBeGreaterThan(0);
    });

    it('should record processing time in PipelineResult', async () => {
      const input = makeValidPipelineInput();
      const result = await orchestrator.execute(input);

      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should record stages in PipelineResult', async () => {
      const input = makeValidPipelineInput();
      const result = await orchestrator.execute(input);

      expect(result.stages).toBeDefined();
      expect(result.stages.length).toBe(5);
    });
  });

  // ====== 3. Quality Gates ======

  describe('quality gates between stages', () => {
    it('should pass stages that meet quality gate criteria', async () => {
      const gates: QualityGate[] = [
        {
          stageIndex: 0,
          validate: () => ({ passed: true }),
          name: 'transcription-gate',
        },
        {
          stageIndex: 1,
          validate: () => ({ passed: true }),
          name: 'analysis-gate',
        },
      ];

      const orch = new PipelineOrchestrator({
        ...config,
        qualityGates: gates,
      });

      const input = makeValidPipelineInput();
      const result = await orch.execute(input);

      expect(result.success).toBe(true);
    });

    it('should invoke fallback when a quality gate fails', async () => {
      let fallbackCalled = false;

      const gates: QualityGate[] = [
        {
          stageIndex: 1,
          validate: () => ({ passed: false, reason: 'Low confidence' }),
          name: 'analysis-gate',
        },
      ];

      const fallbacks: FallbackStrategy[] = [
        {
          stageIndex: 1,
          name: 'analysis-fallback',
          execute: async () => {
            fallbackCalled = true;
            return {
              segments: makeMockContentSegments(),
              diagrams: [makeMockDiagramAnalysis()],
            };
          },
        },
      ];

      const orch = new PipelineOrchestrator({
        ...config,
        qualityGates: gates,
        fallbackStrategies: fallbacks,
      });

      const input = makeValidPipelineInput();
      const result = await orch.execute(input);

      expect(fallbackCalled).toBe(true);
      expect(result.success).toBe(true);
    });

    it('should fail the pipeline when a quality gate fails with no fallback', async () => {
      const gates: QualityGate[] = [
        {
          stageIndex: 0,
          validate: () => ({ passed: false, reason: 'Transcription empty' }),
          name: 'transcription-gate',
        },
      ];

      const orch = new PipelineOrchestrator({
        ...config,
        qualityGates: gates,
        fallbackStrategies: [],
      });

      const input = makeValidPipelineInput();
      const result = await orch.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ====== 4. Fallback Integration ======

  describe('fallback integration (3-tier fallback chain)', () => {
    it('should try all fallback strategies before failing', async () => {
      const attemptedStrategies: string[] = [];

      const gates: QualityGate[] = [
        {
          stageIndex: 1,
          validate: () => ({ passed: false, reason: 'fail' }),
          name: 'always-fail-gate',
        },
      ];

      const fallbacks: FallbackStrategy[] = [
        {
          stageIndex: 1,
          name: 'fallback-1',
          execute: async () => {
            attemptedStrategies.push('fallback-1');
            throw new Error('Fallback 1 failed');
          },
        },
        {
          stageIndex: 1,
          name: 'fallback-2',
          execute: async () => {
            attemptedStrategies.push('fallback-2');
            return {
              segments: makeMockContentSegments(),
              diagrams: [makeMockDiagramAnalysis()],
            };
          },
        },
      ];

      const orch = new PipelineOrchestrator({
        ...config,
        qualityGates: gates,
        fallbackStrategies: fallbacks,
      });

      const input = makeValidPipelineInput();
      const result = await orch.execute(input);

      expect(attemptedStrategies).toEqual(['fallback-1', 'fallback-2']);
      expect(result.success).toBe(true);
    });

    it('should fail after all fallback strategies are exhausted', async () => {
      const gates: QualityGate[] = [
        {
          stageIndex: 0,
          validate: () => ({ passed: false, reason: 'fail' }),
          name: 'transcription-gate',
        },
      ];

      const fallbacks: FallbackStrategy[] = [
        {
          stageIndex: 0,
          name: 'fallback-1',
          execute: async () => {
            throw new Error('Fallback 1 failed');
          },
        },
        {
          stageIndex: 0,
          name: 'fallback-2',
          execute: async () => {
            throw new Error('Fallback 2 failed');
          },
        },
      ];

      const orch = new PipelineOrchestrator({
        ...config,
        qualityGates: gates,
        fallbackStrategies: fallbacks,
      });

      const input = makeValidPipelineInput();
      const result = await orch.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Fallback 2 failed');
    });
  });

  // ====== 5. Progress Callback ======

  describe('progress callback', () => {
    it('should fire progress callback for each stage', async () => {
      const progressCalls: PipelineProgress[] = [];
      const callback = (p: PipelineProgress) => progressCalls.push({ ...p });

      const input = makeValidPipelineInput();
      await orchestrator.execute(input, callback);

      // Each stage should fire at least once
      expect(progressCalls.length).toBeGreaterThanOrEqual(5);
    });

    it('should include correct stage number and name in progress', async () => {
      const progressCalls: PipelineProgress[] = [];
      const callback = (p: PipelineProgress) => progressCalls.push({ ...p });

      const input = makeValidPipelineInput();
      await orchestrator.execute(input, callback);

      const stageNumbers = progressCalls.map((p) => p.stage);
      expect(stageNumbers).toContain(1);
      expect(stageNumbers).toContain(2);
      expect(stageNumbers).toContain(3);
      expect(stageNumbers).toContain(4);
      expect(stageNumbers).toContain(5);
    });

    it('should report "completed" status for successful stages', async () => {
      const progressCalls: PipelineProgress[] = [];
      const callback = (p: PipelineProgress) => progressCalls.push({ ...p });

      const input = makeValidPipelineInput();
      await orchestrator.execute(input, callback);

      const completedStages = progressCalls.filter(
        (p) => p.status === 'completed'
      );
      expect(completedStages.length).toBe(5);
    });

    it('should report "failed" status when a stage throws', async () => {
      const progressCalls: PipelineProgress[] = [];
      const callback = (p: PipelineProgress) => progressCalls.push({ ...p });

      const badOrch = new PipelineOrchestrator({
        ...config,
        qualityGates: [
          {
            stageIndex: 0,
            validate: () => ({ passed: false, reason: 'forced failure' }),
            name: 'force-fail',
          },
        ],
        fallbackStrategies: [],
      });

      const input = makeValidPipelineInput();
      await badOrch.execute(input, callback);

      const failedStages = progressCalls.filter((p) => p.status === 'failed');
      expect(failedStages.length).toBeGreaterThanOrEqual(1);
    });

    it('should report "fallback" status when fallback is used', async () => {
      const progressCalls: PipelineProgress[] = [];
      const callback = (p: PipelineProgress) => progressCalls.push({ ...p });

      const orch = new PipelineOrchestrator({
        ...config,
        qualityGates: [
          {
            stageIndex: 1,
            validate: () => ({ passed: false, reason: 'force fallback' }),
            name: 'force-fallback-gate',
          },
        ],
        fallbackStrategies: [
          {
            stageIndex: 1,
            name: 'analysis-fallback',
            execute: async () => makeMockContentSegments(),
          },
        ],
      });

      const input = makeValidPipelineInput();
      await orch.execute(input, callback);

      const fallbackStages = progressCalls.filter((p) => p.status === 'fallback');
      expect(fallbackStages.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ====== 6. Parameter Auto-tuning (REQ-039) ======

  describe('parameter auto-tuning (REQ-039)', () => {
    it('should call SmartParameterTuner when enableAutoTuning is true', async () => {
      const orch = new PipelineOrchestrator({
        ...config,
        enableAutoTuning: true,
      });

      const input = makeValidPipelineInput();
      // Should not throw; internally, the tuner will be called
      const result = await orch.execute(input);
      expect(result).toBeDefined();
    });

    it('should not call SmartParameterTuner when enableAutoTuning is false', async () => {
      const orch = new PipelineOrchestrator({
        ...config,
        enableAutoTuning: false,
      });

      const input = makeValidPipelineInput();
      const result = await orch.execute(input);
      expect(result).toBeDefined();
    });
  });

  // ====== 7. Streaming Transcriber Integration (REQ-036) ======

  describe('streaming transcriber integration (REQ-036)', () => {
    it('should use streaming mode when enableStreaming is true', async () => {
      const orch = new PipelineOrchestrator({
        ...config,
        enableStreaming: true,
      });

      const input = makeValidPipelineInput();
      const result = await orch.execute(input);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should use batch mode when enableStreaming is false', async () => {
      const orch = new PipelineOrchestrator({
        ...config,
        enableStreaming: false,
      });

      const input = makeValidPipelineInput();
      const result = await orch.execute(input);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });

  // ====== 8. PipelineResult Structure ======

  describe('PipelineResult structure', () => {
    it('should contain all required fields on success', async () => {
      const input = makeValidPipelineInput();
      const result = await orchestrator.execute(input);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('scenes');
      expect(result).toHaveProperty('audioUrl');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('processingTime');
      expect(result).toHaveProperty('stages');
    });

    it('should contain error field on failure', async () => {
      const badOrch = new PipelineOrchestrator({
        ...config,
        qualityGates: [
          {
            stageIndex: 0,
            validate: () => ({ passed: false, reason: 'forced' }),
            name: 'fail-gate',
          },
        ],
        fallbackStrategies: [],
      });

      const input = makeValidPipelineInput();
      const result = await badOrch.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });
  });

  // ====== 9. Edge Cases ======

  describe('edge cases', () => {
    it('should handle empty audio file gracefully', async () => {
      const input: PipelineInput = {
        audioFile: '',
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
      // Should still produce a result (success or failure) without throwing
      expect(result).toBeDefined();
    });

    it('should work without a config in the input', async () => {
      const input: PipelineInput = {
        audioFile: 'test.wav',
      };

      const result = await orchestrator.execute(input);
      expect(result).toBeDefined();
    });

    it('should work without a progress callback', async () => {
      const input = makeValidPipelineInput();
      const result = await orchestrator.execute(input);
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });
});
