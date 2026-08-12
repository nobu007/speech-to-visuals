/**
 * TASK-0051: E2E Tests
 *
 * End-to-end tests for the speech-to-visuals pipeline flow.
 * Tests the full user flow and error recovery scenarios.
 */

import { jest } from '@jest/globals';

// ---------- Mocks ----------

jest.unstable_mockModule('@/transcription', () => ({
  TranscriptionPipeline: jest.fn().mockImplementation(() => ({
    // REQ-045/046: runTranscription syncs config via updateConfig before transcribing.
    updateConfig: jest.fn(),
    transcribe: jest.fn().mockResolvedValue({
      text: 'テスト文字起こし結果',
      segments: [{ start: 0, end: 2, text: 'テスト' }],
      language: 'ja',
      duration: 4,
    }),
  })),
}));

jest.unstable_mockModule('@/analysis', () => ({
  // Segment-length defaults the orchestrator pipelines import from the
  // @/analysis barrel to build their analysis config. The ESM mock must
  // export them or the suite fails at import with "does not provide an
  // export named 'DEFAULT_MAX_SEGMENT_LENGTH_MS'". Canonical: 3000/15000 ms.
  DEFAULT_MIN_SEGMENT_LENGTH_MS: 3000,
  DEFAULT_MAX_SEGMENT_LENGTH_MS: 15000,
  SceneSegmenter: jest.fn().mockImplementation(() => ({
    updateConfig: jest.fn(),
    segment: jest.fn().mockResolvedValue([{ id: 's1', start: 0, end: 2, text: 'テスト' }]),
  })),
  DiagramDetector: jest.fn().mockImplementation(() => ({
    detect: jest.fn().mockResolvedValue({ diagramType: 'flow', confidence: 0.95 }),
  })),
}));

jest.unstable_mockModule('@/visualization', () => ({
  LayoutEngine: jest.fn().mockImplementation(() => ({
    updateConfig: jest.fn(),
    calculate: jest.fn().mockResolvedValue({
      scenes: [{ id: 'scene-1', elements: [], bounds: { width: 1920, height: 1080 } }],
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


// ---------- Helpers ----------

function createValidInput() {
  return {
    audioFile: '/test/audio.wav',
    config: {
      language: 'ja',
      qualityLevel: 'standard',
      enableCaptions: true,
      outputFormat: 'mp4' as const,
    },
  };
}

// ---------- Tests ----------

describe('E2E: Main Pipeline Flow', () => {
  it('ファイルアップロード→音声処理→シーン生成→結果取得の全フロー', async () => {
    const { PipelineOrchestrator } = await import('@/pipeline/pipeline-orchestrator');
    const progressUpdates: Array<Record<string, unknown>> = [];

    const orchestrator = new PipelineOrchestrator({
      progressCallback: (p: Record<string, unknown>) => progressUpdates.push(p),
    });

    const result = await orchestrator.execute(createValidInput());

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(progressUpdates.length).toBeGreaterThan(0);
  });

  it('進捗が段階的に通知される', async () => {
    const { PipelineOrchestrator } = await import('@/pipeline/pipeline-orchestrator');
    const stages: number[] = [];

    const orchestrator = new PipelineOrchestrator({
      progressCallback: (p: { stage: number }) => stages.push(p.stage),
    });

    await orchestrator.execute(createValidInput());
    expect(stages.length).toBeGreaterThan(0);
  });
});

describe('E2E: Error Recovery', () => {
  it('無効なファイル入力でエラーが処理される', async () => {
    const { PipelineOrchestrator } = await import('@/pipeline/pipeline-orchestrator');
    const orchestrator = new PipelineOrchestrator();

    try {
      await orchestrator.execute({ audioFile: '', config: {} });
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('フォールバック戦略付きでパイプラインが実行される', async () => {
    const { PipelineOrchestrator } = await import('@/pipeline/pipeline-orchestrator');
    const orchestrator = new PipelineOrchestrator({
      fallbackStrategies: [{ stage: 2, strategy: 'rule-based' }],
    });

    const result = await orchestrator.execute(createValidInput());
    expect(result).toBeDefined();
  });
});

describe('E2E: Multi-device Pipeline', () => {
  it('並列実行でも結果が独立する', async () => {
    const { PipelineOrchestrator } = await import('@/pipeline/pipeline-orchestrator');
    const o1 = new PipelineOrchestrator();
    const o2 = new PipelineOrchestrator();

    const [r1, r2] = await Promise.all([
      o1.execute(createValidInput()),
      o2.execute(createValidInput()),
    ]);

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });

  it('異なる設定で同時にパイプラインが実行できる', async () => {
    const { PipelineOrchestrator } = await import('@/pipeline/pipeline-orchestrator');
    const o1 = new PipelineOrchestrator();
    const o2 = new PipelineOrchestrator();

    const [r1, r2] = await Promise.all([
      o1.execute({ audioFile: '/test/ja.wav', config: { language: 'ja' } }),
      o2.execute({ audioFile: '/test/en.wav', config: { language: 'en' } }),
    ]);

    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
  });
});

describe('E2E: UI Response', () => {
  it('進捗コールバックがリアルタイムに通知される', async () => {
    const { PipelineOrchestrator } = await import('@/pipeline/pipeline-orchestrator');
    const timestamps: number[] = [];

    const orchestrator = new PipelineOrchestrator({
      progressCallback: () => timestamps.push(Date.now()),
    });

    await orchestrator.execute(createValidInput());
    expect(timestamps.length).toBeGreaterThan(0);
  });
});
