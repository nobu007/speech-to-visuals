/**
 * Web Speech file transcription engine tests - TASK-0318 (REQ-424 / TC-408-02)
 *
 * The shared file engine for Web Speech File transcription (Object URL +
 * Audio playback + SpeechRecognition): BrowserTranscriber delegates here and
 * StreamingTranscriber's browser route (TASK-0319) will consume the same
 * engine — the mechanism must not exist twice (missed-sibling-site class).
 *
 * Engine contract (specs/streaming-real-asr-inference dataflow.md 経路1):
 * - onFinalSegment fires once per FINAL result (progressive, real events only)
 * - confidence: measured value wins (including a legit 0); only undefined
 *   falls back to FINAL_NO_CONFIDENCE_STANDIN (REQ-393)
 * - timestamp: end = audio.currentTime * 1000 (ms); start = previous final
 * - empty run resolves [] — the engine NEVER fabricates mock segments
 * - revokeObjectURL on BOTH onend and onerror paths (ISS-A contract)
 * - onerror never throws: resolves with whatever final results arrived and
 *   reports the error via hooks.onError (the CALLER decides the fallback)
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join } from 'path';
import type { TranscriptionSegment } from '../types';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

// ---------- Mock setup for Web Speech API (same shape as browser-transcriber tests) ----------

type MockSpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: ((ev: Event) => void) | null;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((ev: Event) => void) | null;
  start: jest.Mock;
  stop: jest.Mock;
  abort: jest.Mock;
};

let mockRecognitionInstance: MockSpeechRecognitionInstance;

const createMockRecognition = (): MockSpeechRecognitionInstance => ({
  continuous: false,
  interimResults: false,
  lang: '',
  maxAlternatives: 1,
  onstart: null,
  onresult: null,
  onerror: null,
  onend: null,
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
});

const MockSpeechRecognition = jest.fn().mockImplementation(() => {
  mockRecognitionInstance = createMockRecognition();
  return mockRecognitionInstance;
});

type MockAudio = {
  src: string;
  currentTime: number;
  play: jest.Mock;
};

let mockAudio: MockAudio;
let mockCreateObjectURL: jest.Mock;
let mockRevokeObjectURL: jest.Mock;

const originalSpeechRecognition = (globalThis as Record<string, unknown>).SpeechRecognition;
const originalWebkitSpeechRecognition = (globalThis as Record<string, unknown>).webkitSpeechRecognition;
const originalAudio = (globalThis as Record<string, unknown>).Audio;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

/** Fire one FINAL result through the mocked recognition instance. */
const fireFinal = (transcript: string, confidence?: number): void => {
  if (!mockRecognitionInstance.onresult) {
    throw new Error('onresult handler not attached');
  }
  const alternative: { transcript: string; confidence?: number } = { transcript };
  if (confidence !== undefined) {
    alternative.confidence = confidence;
  }
  const event = {
    resultIndex: 0,
    results: {
      length: 1,
      0: { isFinal: true, length: 1, 0: alternative },
    } as unknown as SpeechRecognitionResultList,
  } as unknown as SpeechRecognitionEvent;
  mockRecognitionInstance.onresult(event);
};

describe('transcribeFileWithWebSpeech (TASK-0318 engine)', () => {
  let transcribeFileWithWebSpeech: typeof import('../web-speech-file-transcription').transcribeFileWithWebSpeech;

  beforeEach(() => {
    jest.resetModules();
    mockRecognitionInstance = createMockRecognition();
    MockSpeechRecognition.mockImplementation(() => mockRecognitionInstance);
    (globalThis as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;
    (globalThis as Record<string, unknown>).webkitSpeechRecognition = MockSpeechRecognition;

    mockAudio = { src: '', currentTime: 0, play: jest.fn() };
    (globalThis as Record<string, unknown>).Audio = jest.fn().mockImplementation(() => mockAudio);

    mockCreateObjectURL = jest.fn().mockReturnValue('blob:http://localhost/fake');
    mockRevokeObjectURL = jest.fn();
    URL.createObjectURL = mockCreateObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = mockRevokeObjectURL as unknown as typeof URL.revokeObjectURL;
  });

  afterEach(() => {
    const globals = globalThis as Record<string, unknown>;
    if (originalSpeechRecognition !== undefined) {
      globals.SpeechRecognition = originalSpeechRecognition;
    } else {
      delete globals.SpeechRecognition;
    }
    if (originalWebkitSpeechRecognition !== undefined) {
      globals.webkitSpeechRecognition = originalWebkitSpeechRecognition;
    } else {
      delete globals.webkitSpeechRecognition;
    }
    if (originalAudio !== undefined) {
      globals.Audio = originalAudio;
    } else {
      delete globals.Audio;
    }
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('exports the engine with the TASK-0318 signature (source-anchored)', async () => {
    const source = readFileSync(
      join(REPO_ROOT, 'src/transcription/web-speech-file-transcription.ts'),
      'utf8',
    );
    // Signature contract: (audioFile, hooks?) => Promise<TranscriptionSegment[]>
    expect(source).toMatch(
      /export async function transcribeFileWithWebSpeech\(\s*audioFile: File,\s*hooks\?: WebSpeechFileHooks,\s*\): Promise<TranscriptionSegment\[\]>/,
    );
    expect(source).toMatch(
      /onFinalSegment\?: \(segment: TranscriptionSegment\) => void;/,
    );
    // FINAL_NO_CONFIDENCE_STANDIN's DEFINITION stays in browser-transcriber.ts
    // (measurement-statement census pin) — the engine only imports it.
    expect(source).toMatch(/import \{ FINAL_NO_CONFIDENCE_STANDIN \} from '\.\/browser-transcriber';/);
    // The engine must not carry the mock fallback (empty is empty).
    expect(source).not.toMatch(/getEnhancedMockSegments/);
    transcribeFileWithWebSpeech = (await import('../web-speech-file-transcription')).transcribeFileWithWebSpeech;
    expect(typeof transcribeFileWithWebSpeech).toBe('function');
  });

  it('constructs and configures its own recognition instance (no this.recognition dependency)', async () => {
    transcribeFileWithWebSpeech = (await import('../web-speech-file-transcription')).transcribeFileWithWebSpeech;

    const run = transcribeFileWithWebSpeech(new File(['audio'], 'a.wav', { type: 'audio/wav' }));
    mockRecognitionInstance.onend(new Event('end'));
    await run;

    // A SECOND construction happened inside the engine (beyond any caller-side
    // instance) with the same file-run configuration the BrowserTranscriber
    // constructor applies: continuous final+interim capture, en-US.
    expect(MockSpeechRecognition).toHaveBeenCalled();
    expect(mockRecognitionInstance.continuous).toBe(true);
    expect(mockRecognitionInstance.interimResults).toBe(true);
    expect(mockRecognitionInstance.maxAlternatives).toBe(1);
    expect(mockRecognitionInstance.lang).toBe('en-US');
    expect(mockRecognitionInstance.start).toHaveBeenCalled();
  });

  it('plays the object-URL audio when recognition starts (mechanism parity)', async () => {
    transcribeFileWithWebSpeech = (await import('../web-speech-file-transcription')).transcribeFileWithWebSpeech;

    const file = new File(['audio'], 'a.wav', { type: 'audio/wav' });
    const run = transcribeFileWithWebSpeech(file);

    expect(mockCreateObjectURL).toHaveBeenCalledWith(file);
    expect(mockAudio.src).toBe('blob:http://localhost/fake');

    if (mockRecognitionInstance.onstart) {
      mockRecognitionInstance.onstart(new Event('start'));
    }
    mockRecognitionInstance.onend(new Event('end'));
    await run;

    expect(mockAudio.play).toHaveBeenCalled();
  });

  it('fires onFinalSegment once per FINAL result and resolves the accumulated segments', async () => {
    transcribeFileWithWebSpeech = (await import('../web-speech-file-transcription')).transcribeFileWithWebSpeech;

    const observed: TranscriptionSegment[] = [];
    const run = transcribeFileWithWebSpeech(new File(['audio'], 'a.wav', { type: 'audio/wav' }), {
      onFinalSegment: (segment) => { observed.push(segment); },
    });

    fireFinal('first utterance', 0.95);
    mockAudio.currentTime = 3; // 3000 ms
    fireFinal('second utterance', 0.8);
    mockRecognitionInstance.onend(new Event('end'));

    const segments = await run;

    expect(observed.map((s) => s.text)).toEqual(['first utterance', 'second utterance']);
    expect(segments.map((s) => s.text)).toEqual(['first utterance', 'second utterance']);
    // Each observed segment is the exact object the caller will receive.
    expect(observed[0]).toBe(segments[0]);
    expect(observed[1]).toBe(segments[1]);
  });

  it('preserves a measured confidence of exactly 0 (|| → ?? bug class)', async () => {
    transcribeFileWithWebSpeech = (await import('../web-speech-file-transcription')).transcribeFileWithWebSpeech;

    const run = transcribeFileWithWebSpeech(new File(['audio'], 'a.wav', { type: 'audio/wav' }));
    fireFinal('very uncertain result', 0);
    mockRecognitionInstance.onend(new Event('end'));

    const segments = await run;

    expect(segments[0].confidence).toBe(0);
  });

  it('falls back to FINAL_NO_CONFIDENCE_STANDIN (0.5) only when confidence is missing', async () => {
    transcribeFileWithWebSpeech = (await import('../web-speech-file-transcription')).transcribeFileWithWebSpeech;

    const run = transcribeFileWithWebSpeech(new File(['audio'], 'a.wav', { type: 'audio/wav' }));
    fireFinal('no confidence reading');
    mockRecognitionInstance.onend(new Event('end'));

    const segments = await run;

    expect(segments[0].confidence).toBe(0.5);
  });

  it('timestamps in ms: end = audio.currentTime * 1000, start chains the previous end', async () => {
    transcribeFileWithWebSpeech = (await import('../web-speech-file-transcription')).transcribeFileWithWebSpeech;

    const run = transcribeFileWithWebSpeech(new File(['audio'], 'a.wav', { type: 'audio/wav' }));

    mockAudio.currentTime = 2.5; // 2500 ms
    fireFinal('first', 0.9);
    mockAudio.currentTime = 4; // 4000 ms
    fireFinal('second', 0.9);
    mockRecognitionInstance.onend(new Event('end'));

    const segments = await run;

    expect(segments[0]).toMatchObject({ start: 0, end: 2500 });
    expect(segments[1]).toMatchObject({ start: 2500, end: 4000 });
  });

  it('resolves [] for an empty run — the engine never fabricates mock segments', async () => {
    transcribeFileWithWebSpeech = (await import('../web-speech-file-transcription')).transcribeFileWithWebSpeech;

    const run = transcribeFileWithWebSpeech(new File(['audio'], 'a.wav', { type: 'audio/wav' }));
    mockRecognitionInstance.onend(new Event('end'));

    const segments = await run;

    expect(segments).toEqual([]);
  });

  it('revokes the object URL on the onend path', async () => {
    transcribeFileWithWebSpeech = (await import('../web-speech-file-transcription')).transcribeFileWithWebSpeech;

    const run = transcribeFileWithWebSpeech(new File(['audio'], 'a.wav', { type: 'audio/wav' }));
    mockRecognitionInstance.onend(new Event('end'));
    await run;

    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/fake');
  });

  it('onerror never throws: resolves the final results so far, revokes, and reports via hooks.onError', async () => {
    transcribeFileWithWebSpeech = (await import('../web-speech-file-transcription')).transcribeFileWithWebSpeech;

    const observedErrors: string[] = [];
    const run = transcribeFileWithWebSpeech(new File(['audio'], 'a.wav', { type: 'audio/wav' }), {
      onError: (error) => { observedErrors.push(error); },
    });

    mockAudio.currentTime = 1;
    fireFinal('partial before failure', 0.9);
    if (!mockRecognitionInstance.onerror) {
      throw new Error('onerror handler not attached');
    }
    mockRecognitionInstance.onerror({ error: 'network' } as unknown as SpeechRecognitionErrorEvent);

    const segments = await run;

    expect(observedErrors).toEqual(['network']);
    expect(segments.map((s) => s.text)).toEqual(['partial before failure']);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/fake');
  });

  it('a terminal event settles the run exactly once (onerror followed by onend revokes once)', async () => {
    transcribeFileWithWebSpeech = (await import('../web-speech-file-transcription')).transcribeFileWithWebSpeech;

    const run = transcribeFileWithWebSpeech(new File(['audio'], 'a.wav', { type: 'audio/wav' }));
    if (mockRecognitionInstance.onerror) {
      mockRecognitionInstance.onerror({ error: 'aborted' } as unknown as SpeechRecognitionErrorEvent);
    }
    if (mockRecognitionInstance.onend) {
      mockRecognitionInstance.onend(new Event('end'));
    }

    const segments = await run;

    expect(segments).toEqual([]);
    expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('throws (fail-loud) only when the SpeechRecognition API itself is absent', async () => {
    delete (globalThis as Record<string, unknown>).SpeechRecognition;
    delete (globalThis as Record<string, unknown>).webkitSpeechRecognition;
    transcribeFileWithWebSpeech = (await import('../web-speech-file-transcription')).transcribeFileWithWebSpeech;

    await expect(
      transcribeFileWithWebSpeech(new File(['audio'], 'a.wav', { type: 'audio/wav' })),
    ).rejects.toThrow('Speech recognition not available');
  });
});
