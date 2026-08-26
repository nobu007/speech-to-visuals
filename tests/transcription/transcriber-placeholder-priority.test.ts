/**
 * TranscriptionPipeline placeholder-priority routing contract.
 *
 * README「音声認識の現状」documents the routing as:
 *   whisper → (on failure) browser Web Speech API → (all failed) placeholder.
 *
 * The code violated that contract: WhisperTranscriber.transcribe() returns
 * `success: true` for its no-inference placeholder segments, so Priority 1
 * always "succeeded" and the browser engine (Priority 2) was unreachable dead
 * code — in the browser flow users got fabricated English placeholder text
 * reported as a successful real transcription. These tests pin the fixed
 * routing with both engines mocked:
 *
 * - whisper placeholder + browser real  → browser result, success, no fallback
 * - whisper placeholder + browser failed → disclosed fallback, success=false
 * - whisper real (no placeholder flag)   → whisper result, browser never called
 * - Node environment                     → browser engine never constructed
 */

import { jest } from '@jest/globals';

// ---- mock state (module-level so the class mocks can read/write it) ----

interface SegmentLike {
  id?: number;
  start: number;
  end: number;
  text: string;
  confidence: number;
}

/** Shape the mocked engines resolve with — a stand-in for TranscriptionResult */
interface EngineResult {
  success: boolean;
  segments: SegmentLike[];
  language: string;
  duration: number;
  placeholder?: boolean;
  error?: string;
}

const REAL_SEGMENT: SegmentLike = {
  id: 0,
  start: 0,
  end: 4000,
  text: 'real transcript from web speech',
  confidence: 0.88,
};

const WHISPER_PLACEHOLDER_SEGMENT: SegmentLike = {
  id: 0,
  start: 0,
  end: 10000,
  text: 'The enterprise architecture consists of multiple interconnected layers.',
  confidence: 0.95,
};

const whisperState = {
  constructed: 0,
  calls: 0,
  result: {} as EngineResult,
};

const browserState = {
  constructed: 0,
  calls: 0,
  result: {} as EngineResult,
};

jest.unstable_mockModule('@/transcription/whisper-transcriber', () => ({
  WhisperTranscriber: class {
    constructor() {
      whisperState.constructed += 1;
    }
    transcribe = jest.fn(async () => {
      whisperState.calls += 1;
      return whisperState.result;
    });
    updateConfig = jest.fn();
  },
}));

jest.unstable_mockModule('@/transcription/browser-transcriber', () => ({
  BrowserTranscriber: class {
    constructor() {
      browserState.constructed += 1;
    }
    transcribeAudioFile = jest.fn(async () => {
      browserState.calls += 1;
      return browserState.result;
    });
  },
}));

const { TranscriptionPipeline } = await import('@/transcription/transcriber');

// ---- environment helpers ----

function setBrowserEnv(enabled: boolean): void {
  const globals = globalThis as Record<string, unknown>;
  if (enabled) {
    globals.window = {};
    globals.document = {};
  } else {
    delete globals.window;
    delete globals.document;
  }
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  whisperState.constructed = 0;
  whisperState.calls = 0;
  whisperState.result = {
    success: true,
    placeholder: true,
    segments: [WHISPER_PLACEHOLDER_SEGMENT],
    language: 'en',
    duration: 10000,
  };

  browserState.constructed = 0;
  browserState.calls = 0;
  browserState.result = {
    success: true,
    segments: [REAL_SEGMENT],
    language: 'en',
    duration: 4000,
  };

  // blob: URLs are fetched to a File before reaching whisper; a valid WAV
  // blob keeps blobUrlToFile() on its ok-path.
  (globalThis as Record<string, unknown>).fetch = jest.fn(async () => ({
    ok: true,
    blob: async () => new Blob([new Uint8Array([0x52, 0x49, 0x46, 0x46])], { type: 'audio/wav' }),
  }));
});

afterEach(() => {
  jest.restoreAllMocks();
  (globalThis as Record<string, unknown>).fetch = originalFetch;
  setBrowserEnv(false);
});

describe('TranscriptionPipeline placeholder-priority routing', () => {
  it('routes to the browser engine when whisper returns a placeholder result', async () => {
    setBrowserEnv(true);
    const pipeline = new TranscriptionPipeline();

    const result = await pipeline.transcribe('blob:placeholder-whisper');

    expect(whisperState.calls).toBe(1);
    expect(browserState.calls).toBe(1);
    expect(result.success).toBe(true);
    expect(result.fallback).not.toBe(true);
    expect(result.segments[0]?.text).toBe(REAL_SEGMENT.text);
  });

  it('returns the disclosed fallback when the browser engine also fails', async () => {
    setBrowserEnv(true);
    const pipeline = new TranscriptionPipeline();
    browserState.result = { success: false, segments: [], language: 'en', duration: 0, error: 'no-speech' };

    const result = await pipeline.transcribe('blob:placeholder-whisper');

    expect(browserState.calls).toBe(1);
    expect(result.success).toBe(false);
    expect(result.fallback).toBe(true);
    expect(result.segments[0]?.text).toContain('[Transcription unavailable');
    expect(result.segments[0]?.confidence).toBe(0);
  });

  it('never consults the browser engine when whisper produced a real result', async () => {
    setBrowserEnv(true);
    const pipeline = new TranscriptionPipeline();
    whisperState.result = {
      success: true,
      segments: [REAL_SEGMENT],
      language: 'en',
      duration: 4000,
    };

    const result = await pipeline.transcribe('blob:real-whisper');

    expect(whisperState.calls).toBe(1);
    expect(browserState.calls).toBe(0);
    expect(result.success).toBe(true);
    expect(result.fallback).not.toBe(true);
    expect(result.segments[0]?.text).toBe(REAL_SEGMENT.text);
  });

  it('does not construct the browser engine in a Node environment', async () => {
    setBrowserEnv(false);
    const pipeline = new TranscriptionPipeline();

    const result = await pipeline.transcribe('blob:placeholder-whisper');

    expect(browserState.constructed).toBe(0);
    expect(browserState.calls).toBe(0);
    expect(result.success).toBe(false);
    expect(result.fallback).toBe(true);
    expect(result.segments[0]?.text).toContain('[Transcription unavailable');
  });
});
