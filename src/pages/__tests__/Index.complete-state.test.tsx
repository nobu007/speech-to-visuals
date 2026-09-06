/**
 * @jest-environment jsdom
 *
 * TASK-0322 (REQ-426・TC-410-01): Index complete state における VideoPreview
 * mount の page test witness。
 *
 * Legacy Pipeline 経路 (useNewPipeline=false) の handleUpload を supabase /
 * fetch mock で成功させ、complete state (`result && status === 'complete'`)
 * の render tree に `data-testid="video-preview"` が現れることを立証する
 * (RED→GREEN — mount 前の旧実装では VideoPreview が render されない)。
 *
 * 既知の runtime 制約 (2026-09-07 実測): jest ESM (vm modules) の
 * `import.meta` には jest-runtime が url/filename/dirname のみ設定し `.env`
 * は undefined。Index.tsx の `${import.meta.env.VITE_SUPABASE_URL}` はその
 * ままだと handleUpload 内で TypeError → status='error' となり complete state
 * に到達できないため、SUT 側は optional chaining で test 環境でも URL 構築が
 * throw しないようにしている (本 test がその前提の witness)。
 */
import { jest } from '@jest/globals';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mocks — Index.tsx の依存 (子 component は stub、外部 I/O は成功経路)
// ---------------------------------------------------------------------------

jest.unstable_mockModule('@/components/AudioUploader', () => ({
  AudioUploader: ({ onUpload }: { onUpload: (file: File) => void }) =>
    React.createElement(
      'button',
      {
        'data-testid': 'audio-uploader-stub',
        onClick: () =>
          onUpload(new File(['fake-audio'], 'test.wav', { type: 'audio/wav' })),
      },
      'upload',
    ),
}));

jest.unstable_mockModule('@/components/ProcessingStatus', () => ({
  ProcessingStatus: () => null,
}));

jest.unstable_mockModule('@/components/DiagramPreview', () => ({
  DiagramPreview: () =>
    React.createElement('div', { 'data-testid': 'diagram-preview-stub' }),
}));

jest.unstable_mockModule('@/components/VideoRenderer', () => ({
  VideoRenderer: () =>
    React.createElement('div', { 'data-testid': 'video-renderer-stub' }),
}));

jest.unstable_mockModule('@/components/pipeline-interface', () => ({
  PipelineInterface: () => null,
}));

jest.unstable_mockModule('lucide-react', () => ({
  Sparkles: (props: Record<string, unknown>) => React.createElement('span', props),
}));

jest.unstable_mockModule('@/components/StreamingProcessor', () => ({
  StreamingProcessor: () => null,
}));

// MainPipeline は Index.tsx:9 で import されるが render には関与しない。
// 実 module は orchestrator 系を引き込むため stub に差し替える。
jest.unstable_mockModule('@/pipeline', () => ({
  MainPipeline: jest.fn(),
}));

jest.unstable_mockModule('@/integrations/supabase/client', () => ({
  getSupabaseClient: () => ({
    storage: {
      from: () => ({
        upload: jest.fn().mockResolvedValue({ error: null }),
        getPublicUrl: () => ({
          data: { publicUrl: 'https://example.com/audio/test.wav' },
        }),
      }),
    },
  }),
  resetSupabaseClient: jest.fn(),
}));

jest.unstable_mockModule('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
  Toaster: () => null,
}));

jest.unstable_mockModule('@stv/core/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// 以下は mount される VideoPreview (実体) の依存 — VideoPreview.test.tsx と
// 同一の stub。composition 本体と ui primitives を差し替え、page test は
// mount と testid の存在を検証する (composition 内容は既存 suite の管轄)。
jest.unstable_mockModule('@remotion/player', () => ({
  Player: React.forwardRef((_props: Record<string, unknown>, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
    return React.createElement('div', { 'data-testid': 'remotion-player' });
  }),
}));

jest.unstable_mockModule('@/remotion/Video', () => ({
  SpeechToVisualsVideo: () => null,
  calculateTotalFrames: (_scenes: unknown[], fps: number) => fps * 10,
  DEFAULT_FPS: 30,
}));

jest.unstable_mockModule('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    ['data-testid']?: string;
  }) => React.createElement('button', { onClick, disabled, ...props }, children),
}));

jest.unstable_mockModule('@/components/ui/slider', () => ({
  Slider: ({ value, onValueChange, ...props }: {
    value: number[];
    onValueChange?: (v: number[]) => void;
    ['data-testid']?: string;
  }) =>
    React.createElement('input', {
      type: 'range',
      value: value?.[0] ?? 0,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onValueChange?.([Number(e.target.value)]),
      ...props,
    }),
}));

jest.unstable_mockModule('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: {
    children: React.ReactNode;
    value: string;
    onValueChange?: (v: string) => void;
  }) =>
    React.createElement('div', { 'data-value': value, onClick: () => onValueChange?.('720p') }, children),
  SelectTrigger: ({ children, ...props }: { children: React.ReactNode }) =>
    React.createElement('div', props, children),
  SelectContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) =>
    React.createElement('div', { key: value }, children),
  SelectValue: () => React.createElement('span', null, 'value'),
}));

const { default: Index } = await import('../Index');

// parseUntrustedJson の chokepoint は実体を通す (検証二重化をしない)。
// fetch は Supabase Edge Function 応答の JSON 文字列を返す成功経路のみ差し替える。
// 呼び出し判別は request body で行う (URL は test 環境で env 未設定のため
// `undefined/functions/v1/...` になる — SUT の optional chaining 前提)。
const transcriptJson = `{"transcript":"テスト文字起こし","duration":3}`;
let scenesJson = JSON.stringify({
  scenes: [
    {
      id: 'scene-1',
      type: 'flow',
      title: 'テストシーン',
      nodes: [],
      edges: [],
      startTime: 0,
      endTime: 3,
    },
  ],
});

const fetchMock = jest.fn((_input: unknown, init?: { body?: unknown }) => {
  const body = typeof init?.body === 'string' ? init.body : '';
  const isGenerateScenes = body.includes('"transcript"');
  return Promise.resolve({
    ok: true,
    text: () =>
      Promise.resolve(isGenerateScenes ? scenesJson : transcriptJson),
  });
});
(globalThis as Record<string, unknown>).fetch = fetchMock;

const driveToCompleteState = async () => {
  render(React.createElement(Index));

  // default は Standard Pipeline (useNewPipeline=true) — complete state fragment
  // は legacy 経路のみが持つため明示的に切替。
  fireEvent.click(screen.getByRole('button', { name: 'Legacy Pipeline' }));
  fireEvent.click(screen.getByTestId('audio-uploader-stub'));

  // handleUpload は supabase upload → fetch ×2 → 1s setTimeout の後に
  // complete する。実 timer のまま findBy で待つ (act 内 microtask flush は
  // findBy が担う — 完了後 DOM assertion の既知 class)。
  await screen.findByTestId('video-preview', {}, { timeout: 5000 });
};

describe('Index complete state — VideoPreview mount (TASK-0322 / TC-410-01)', () => {
  it('complete state で VideoPreview (data-testid="video-preview") が render されること', async () => {
    await driveToCompleteState();
    expect(screen.getByTestId('video-preview')).toBeInTheDocument();
  });

  it('mount 順序は設計固定: DiagramPreview → VideoPreview → VideoRenderer', async () => {
    await driveToCompleteState();

    const diagram = screen.getByTestId('diagram-preview-stub');
    const preview = screen.getByTestId('video-preview');
    const renderer = screen.getByTestId('video-renderer-stub');

    expect(
      diagram.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      preview.compareDocumentPosition(renderer) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('VideoPreview は空 scenes で既存 empty fallback に落ちる (error UI を作らない)', async () => {
    scenesJson = `{"scenes":[]}`;

    render(React.createElement(Index));
    fireEvent.click(screen.getByRole('button', { name: 'Legacy Pipeline' }));
    fireEvent.click(screen.getByTestId('audio-uploader-stub'));

    await screen.findByTestId('video-preview-empty', {}, { timeout: 5000 });
    expect(screen.getByTestId('video-preview-empty')).toBeInTheDocument();
  });
});
