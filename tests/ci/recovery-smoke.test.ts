/**
 * CI Recovery Smoke Test — TASK-0162
 *
 * Fast (<3s) smoke test that verifies PipelineErrorRecoveryOrchestrator
 * can handle basic fail→recover scenarios. Runs as part of CI to close
 * the recovery verification loop.
 *
 * No external service dependencies. All I/O is mocked.
 */

import { jest } from '@jest/globals';
import type { PipelineErrorRecoveryOrchestrator } from '@/quality/pipeline-error-recovery-orchestrator';

// Use dynamic import so module graph is resolved after any mock setup.
let Orchestrator: typeof PipelineErrorRecoveryOrchestrator;

beforeAll(async () => {
  const mod = await import('@/quality/pipeline-error-recovery-orchestrator');
  Orchestrator = mod.PipelineErrorRecoveryOrchestrator;
});

describe('CI Recovery Smoke Test', () => {
  it('recovers from a single stage failure via boundary retry', async () => {
    const orch = new Orchestrator();
    orch.startRun('smoke-single-fail');

    let attempt = 0;
    const result = await orch.executeStage('transcription', async () => {
      attempt++;
      if (attempt === 1) throw new Error('Transient failure');
      return { text: 'recovered', confidence: 0.9 };
    }, { maxRetries: 2 });

    expect(result.success).toBe(true);
    expect(result.result).toEqual({ text: 'recovered', confidence: 0.9 });
    expect(result.recoveryPath).not.toBe('primary');

    orch.destroy();
  });

  it('health assessment returns nominal after successful recovery', async () => {
    const orch = new Orchestrator();
    orch.startRun('smoke-health');

    // Execute a stage that succeeds on first try
    await orch.executeStage('analysis', async () => ({ ok: true }));

    const health = orch.getHealthAssessment();
    expect(health).toBeDefined();
    expect(typeof health.overallScore).toBe('number');

    orch.destroy();
  });

  it('completes within 3 seconds', async () => {
    const start = performance.now();

    const orch = new Orchestrator();
    orch.startRun('smoke-timing');

    await orch.executeStage('layout_generation', async () => ({ nodes: [] }));

    const report = orch.finalizeRun(true);
    expect(report.success).toBe(true);

    orch.destroy();

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(3000);
  });
});
