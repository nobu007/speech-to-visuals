/**
 * REQ-159: PipelineOrchestrator → ErrorClassifier Integration
 *
 * Validates that errors thrown during PipelineOrchestrator execution
 * (especially PipelineAbortError) are correctly classified through
 * ErrorClassifier and the classified result is available in the
 * pipeline result metrics.
 *
 * This closes the triage path gap: PipelineAbortError thrown by the
 * orchestrator → caught in execute() → classified by ErrorClassifier →
 * available as result.metrics.classifiedError.
 */

import { jest } from '@jest/globals';
import type { PipelineProgress } from '@/pipeline/pipeline-orchestrator';
import type { ClassifiedError } from '@/quality/error-classifier';
import type { RunRecoveryReport } from '@/quality/pipeline-run-recovery-tracker';

// ---------- Mocks ----------
// Mock external dependencies to isolate error classification behavior.

jest.unstable_mockModule('@/transcription', () => ({
  TranscriptionPipeline: jest.fn().mockImplementation(() => ({
    transcribe: jest.fn().mockResolvedValue({
      success: true,
      segments: [
        { id: 0, start: 0, end: 5, text: 'Test segment one.', confidence: 0.9 },
        { id: 1, start: 5, end: 10, text: 'Test segment two.', confidence: 0.85 },
      ],
      language: 'en',
      duration: 10,
    }),
  })),
}));

jest.unstable_mockModule('@/analysis', () => ({
  SceneSegmenter: jest.fn().mockImplementation(() => ({
    segment: jest.fn().mockResolvedValue([
      { id: 's1', start: 0, end: 5, text: 'Test segment one.' },
      { id: 's2', start: 5, end: 10, text: 'Test segment two.' },
    ]),
  })),
  DiagramDetector: jest.fn().mockImplementation(() => ({
    detect: jest.fn().mockResolvedValue({
      diagramType: 'flow',
      confidence: 0.9,
      nodes: [
        { id: 'n1', label: 'Step 1' },
        { id: 'n2', label: 'Step 2' },
      ],
      edges: [{ from: 'n1', to: 'n2', label: 'next' }],
    }),
    analyze: jest.fn().mockResolvedValue({
      type: 'flow',
      confidence: 0.9,
      nodes: [
        { id: 'n1', label: 'Step 1' },
        { id: 'n2', label: 'Step 2' },
      ],
      edges: [{ from: 'n1', to: 'n2', label: 'next' }],
    }),
  })),
}));

jest.unstable_mockModule('@/visualization', () => ({
  LayoutEngine: jest.fn().mockImplementation(() => ({
    calculate: jest.fn().mockResolvedValue({
      scenes: [{
        id: 'scene-1',
        elements: [],
        bounds: { width: 1920, height: 1080 },
        durationMs: 10000,
      }],
    }),
    generateLayout: jest.fn().mockResolvedValue({
      success: true,
      layout: {
        nodes: [
          { id: 'n1', label: 'Step 1', x: 100, y: 100, w: 120, h: 60 },
          { id: 'n2', label: 'Step 2', x: 300, y: 100, w: 120, h: 60 },
        ],
        edges: [{ from: 'n1', to: 'n2', points: [{ x: 220, y: 130 }, { x: 300, y: 130 }] }],
      },
    }),
  })),
}));

jest.unstable_mockModule('@/config/validate', () => ({
  validateConfig: jest.fn(),
  ValidationError: class extends Error { constructor(m: string) { super(m); } },
}));

jest.unstable_mockModule('@/config/schema', () => ({ ConfigSchema: {} }));

jest.unstable_mockModule('@/config', () => ({
  config: { geminiApiKey: 'test-key', supabaseUrl: 'http://localhost:54321', supabaseAnonKey: 'test-key' },
}));

jest.unstable_mockModule('@/types/diagram', () => ({
  SceneGraph: jest.fn().mockImplementation(() => ({})),
  ProcessingStatus: { Complete: 'complete', Failed: 'failed' },
}));

// ---------- Helpers ----------

function createValidInput() {
  return {
    audioFile: '/test/audio.wav',
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

// ---------- Late-binding imports ----------

let PipelineOrchestrator: typeof import('@/pipeline/pipeline-orchestrator').PipelineOrchestrator;

beforeAll(async () => {
  const mod = await import('@/pipeline/pipeline-orchestrator');
  PipelineOrchestrator = mod.PipelineOrchestrator;
});

// =====================================================================
// TEST SUITE
// =====================================================================

describe('REQ-159: PipelineOrchestrator → ErrorClassifier Integration', () => {

  // =================================================================
  // 1. PipelineAbortError from quality gate failure (no fallback)
  // =================================================================

  describe('PipelineAbortError propagation through orchestrator', () => {

    it('classifies PipelineAbortError as QUALITY_GATE_FAILED when stage fails without fallback', async () => {
      const orchestrator = new PipelineOrchestrator({
        qualityGates: [
          {
            stageIndex: 0,
            name: 'force-abort',
            validate: () => ({ passed: false, reason: 'Forced abort for classification test' }),
          },
        ],
        // No fallback — PipelineAbortError should be thrown from executeStageWithGates
      });

      const result = await orchestrator.execute(createValidInput());

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Verify the classified error is present
      expect(result.metrics?.classifiedError).toBeDefined();
      const classified = result.metrics!.classifiedError as ClassifiedError;

      expect(classified.type).toBe('QUALITY_GATE_FAILED');
      expect(classified.severity).toBe('high');
      expect(classified.recoverable).toBe(true);
      expect(classified.stage).toBe('quality_gate');
      expect(classified.userMessage).toBeTruthy();
      expect(classified.suggestedAction).toBeTruthy();

      orchestrator.recoveryOrchestrator.destroy();
    });

    it('classifies PipelineAbortError with correct context from shouldAbort path', async () => {
      // Force shouldAbort() to return true by spying on the method.
      // This simulates the "critical degradation" path at lines 280/304/340.
      const orchestrator = new PipelineOrchestrator({
        // Provide a fallback for stage 0 so it completes successfully;
        // shouldAbort will then fire between stages.
        fallbackStrategies: [
          {
            stageIndex: 0,
            name: 'transcription-fallback',
            execute: async () => ({
              success: true,
              segments: [
                { id: 0, start: 0, end: 5, text: 'Recovered.', confidence: 0.7 },
              ],
              language: 'en',
              duration: 5,
            }),
          },
        ],
      });

      // Spy on shouldAbort to return true after the first stage completes
      const shouldAbortSpy = jest.spyOn(
        orchestrator.recoveryOrchestrator,
        'shouldAbort',
      ).mockReturnValue(true);

      const result = await orchestrator.execute(createValidInput());

      expect(shouldAbortSpy).toHaveBeenCalled();
      expect(result.success).toBe(false);

      // The error should be classified — PipelineAbortError from shouldAbort
      const classified = result.metrics?.classifiedError as ClassifiedError;
      expect(classified).toBeDefined();
      expect(classified.type).toBe('QUALITY_GATE_FAILED');
      expect(classified.stage).toBe('abort');
      expect(classified.severity).toBe('high');

      shouldAbortSpy.mockRestore();
      orchestrator.recoveryOrchestrator.destroy();
    });

    it('preserves original error reference in classified output', async () => {
      const orchestrator = new PipelineOrchestrator({
        qualityGates: [
          {
            stageIndex: 0,
            name: 'ref-preservation-test',
            validate: () => ({ passed: false, reason: 'Test error reference preservation' }),
          },
        ],
      });

      const result = await orchestrator.execute(createValidInput());

      const classified = result.metrics!.classifiedError as ClassifiedError;
      expect(classified.originalError).toBeDefined();
      expect(classified.originalError).toBeInstanceOf(Error);
      expect(classified.originalError.message).toBeTruthy();

      orchestrator.recoveryOrchestrator.destroy();
    });
  });

  // =================================================================
  // 2. Other typed errors through the orchestrator
  // =================================================================

  describe('Non-abort typed error classification through orchestrator', () => {

    it('classifies QualityGateError with structured metadata', async () => {
      const orchestrator = new PipelineOrchestrator({
        qualityGates: [
          {
            stageIndex: 1,
            name: 'analysis-gate',
            validate: () => ({ passed: false, reason: 'Analysis quality below threshold' }),
          },
        ],
        // No fallback for analysis → QualityGateError thrown
      });

      const result = await orchestrator.execute(createValidInput());

      expect(result.success).toBe(false);

      const classified = result.metrics?.classifiedError as ClassifiedError;
      expect(classified).toBeDefined();
      expect(classified.type).toBe('QUALITY_GATE_FAILED');
      expect(classified.stage).toBe('quality_gate');
      expect(classified.originalError.message).toContain('analysis-gate');

      orchestrator.recoveryOrchestrator.destroy();
    });
  });

  // =================================================================
  // 3. Happy path — no classification when pipeline succeeds
  // =================================================================

  describe('Successful pipeline produces no classified error', () => {

    it('has no classifiedError on successful execution', async () => {
      const orchestrator = new PipelineOrchestrator();

      const result = await orchestrator.execute(createValidInput());

      expect(result.success).toBe(true);
      expect(result.metrics?.classifiedError).toBeUndefined();

      orchestrator.recoveryOrchestrator.destroy();
    });
  });

  // =================================================================
  // 4. Classification result completeness
  // =================================================================

  describe('Classification result completeness', () => {

    it('classifiedError contains all required fields per ClassifiedError interface', async () => {
      const orchestrator = new PipelineOrchestrator({
        qualityGates: [
          {
            stageIndex: 0,
            name: 'completeness-test',
            validate: () => ({ passed: false, reason: 'Test completeness' }),
          },
        ],
      });

      const result = await orchestrator.execute(createValidInput());

      const classified = result.metrics!.classifiedError as ClassifiedError;

      // Verify all ClassifiedError interface fields are present
      expect(typeof classified.type).toBe('string');
      expect(['low', 'medium', 'high', 'critical']).toContain(classified.severity);
      expect(typeof classified.stage).toBe('string');
      expect(classified.originalError).toBeInstanceOf(Error);
      expect(typeof classified.userMessage).toBe('string');
      expect(typeof classified.recoverable).toBe('boolean');
      expect(typeof classified.suggestedAction).toBe('string');

      orchestrator.recoveryOrchestrator.destroy();
    });

    it('recovery report and classified error are both available on failure', async () => {
      const orchestrator = new PipelineOrchestrator({
        qualityGates: [
          {
            stageIndex: 0,
            name: 'dual-report-test',
            validate: () => ({ passed: false, reason: 'Dual report test' }),
          },
        ],
      });

      const result = await orchestrator.execute(createValidInput());

      expect(result.success).toBe(false);

      // Both recovery report and classified error should be available
      const report = result.metrics?.recoveryReport as RunRecoveryReport;
      expect(report).toBeDefined();
      expect(report.runId).toMatch(/^run-/);

      const classified = result.metrics?.classifiedError as ClassifiedError;
      expect(classified).toBeDefined();
      expect(classified.type).toBeTruthy();

      orchestrator.recoveryOrchestrator.destroy();
    });
  });
});
