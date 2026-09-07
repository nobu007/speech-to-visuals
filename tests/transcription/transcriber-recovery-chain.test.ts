/**
 * TranscriptionPipeline recovery-chain wiring (TASK-0325 / AC-D5-1..05).
 *
 * The placeholder-priority contract (transcriber-placeholder-priority.test.ts)
 * pins the routing with engine RESULT injection only. These tests pin the
 * D-5 gaps that the inline routing could not express:
 *
 * - trace order as a machine-verifiable witness (AC-D5-1)
 * - THROW injection from whisper → next engine still wins (AC-D5-2)
 * - total engine wipe → terminal disclosed-placeholder step wins (AC-D5-3)
 * - budget exhaustion → pipeline-side disclosure still returned (AC-D5-3/SD4)
 * - minConfidence=0 authority: unmeasured (undefined-confidence) real whisper
 *   inference is never outranked by a lower engine (AC-D5-4)
 * - errorRecoveryEventBus events + getRecoveryOutcome() getter (AC-D5-5)
 */

import { jest } from '@jest/globals';
import { errorRecoveryEventBus } from '@/quality/error-recovery-event-bus';
import type { ChainOutcome } from '@/quality/recovery-strategy-chain';

// ---- mock state (module-level so the class mocks can read/write it) ----

interface SegmentLike {
  id?: number;
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

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
  throws: false,
};

const browserState = {
  constructed: 0,
  calls: 0,
  result: {} as EngineResult,
  throws: false,
};

jest.unstable_mockModule('@/transcription/whisper-transcriber', () => ({
  WhisperTranscriber: class {
    constructor() {
      whisperState.constructed += 1;
    }
    transcribe = jest.fn(async () => {
      whisperState.calls += 1;
      if (whisperState.throws) {
        throw new Error('whisper backend load failed (injected)');
      }
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
      if (browserState.throws) {
        throw new Error('browser engine threw (injected)');
      }
      return browserState.result;
    });
  },
}));

const { TranscriptionPipeline, isRealTranscriptionResult, endedAtDisclosedPlaceholder } = await import('@/transcription/transcriber');
const {
  estimateTranscriptionAccuracy,
  DISCLOSED_PLACEHOLDER_TRANSCRIPTION_ACCURACY,
} = await import('@/pipeline/quality-estimators');

// ---- environment helpers (same shape as the priority contract test) ----

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

// ---- event capture (real singleton bus — AC-D5-5 witness) ----

interface CapturedEvent {
  type: 'recovery:attempt' | 'recovery:success' | 'recovery:failure';
  stage: string;
  strategyId: string;
  fallbackUsed?: boolean;
}

const capturedEvents: CapturedEvent[] = [];

const attemptListener = (p: { stage: string; strategyId: string }): void => {
  capturedEvents.push({ type: 'recovery:attempt', stage: p.stage, strategyId: p.strategyId });
};
const successListener = (p: { stage: string; strategyId: string; fallbackUsed: boolean }): void => {
  capturedEvents.push({ type: 'recovery:success', stage: p.stage, strategyId: p.strategyId, fallbackUsed: p.fallbackUsed });
};
const failureListener = (p: { stage: string; strategyId: string }): void => {
  capturedEvents.push({ type: 'recovery:failure', stage: p.stage, strategyId: p.strategyId });
};

errorRecoveryEventBus.on('recovery:attempt', attemptListener);
errorRecoveryEventBus.on('recovery:success', successListener);
errorRecoveryEventBus.on('recovery:failure', failureListener);

afterAll(() => {
  errorRecoveryEventBus.off('recovery:attempt', attemptListener);
  errorRecoveryEventBus.off('recovery:success', successListener);
  errorRecoveryEventBus.off('recovery:failure', failureListener);
});

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  whisperState.constructed = 0;
  whisperState.calls = 0;
  whisperState.throws = false;
  whisperState.result = {
    success: true,
    placeholder: true,
    segments: [WHISPER_PLACEHOLDER_SEGMENT],
    language: 'en',
    duration: 10000,
  };

  browserState.constructed = 0;
  browserState.calls = 0;
  browserState.throws = false;
  browserState.result = {
    success: true,
    segments: [REAL_SEGMENT],
    language: 'en',
    duration: 4000,
  };

  capturedEvents.length = 0;

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

function transcriptionStageEvents(): CapturedEvent[] {
  return capturedEvents.filter((e) => e.stage === 'transcription');
}

/** Non-null narrowing helper — the `!` census ratchet (REQ-328/337) is 0. */
function requireOutcome(pipeline: InstanceType<typeof TranscriptionPipeline>): ChainOutcome {
  const outcome = pipeline.getRecoveryOutcome();
  if (outcome === null) {
    throw new Error('getRecoveryOutcome() returned null — transcribe() has not completed a chain run');
  }
  return outcome;
}

describe('TranscriptionPipeline recovery chain (AC-D5-1: trace order)', () => {
  it('pins the attempted step ids per environment: node has no web-speech step registered', async () => {
    setBrowserEnv(false);
    const pipeline = new TranscriptionPipeline();

    await pipeline.transcribe('blob:placeholder-whisper');

    const outcome = requireOutcome(pipeline);
    expect(outcome.trace.map((t) => t.stepId)).toEqual(['whisper-inference', 'disclosed-placeholder']);
    expect(outcome.trace.every((t) => t.attempted)).toBe(true);
  });

  it('registers web-speech-file between whisper and the terminal disclosure in a browser environment', async () => {
    setBrowserEnv(true);
    const pipeline = new TranscriptionPipeline();
    // The browser engine must not win at step 2, or the chain stops before
    // the terminal disclosure and the trace only has two steps.
    browserState.result = { success: false, segments: [], language: 'en', duration: 0, error: 'no-speech' };

    await pipeline.transcribe('blob:placeholder-whisper');

    const outcome = requireOutcome(pipeline);
    expect(outcome.trace.map((t) => t.stepId)).toEqual([
      'whisper-inference',
      'web-speech-file',
      'disclosed-placeholder',
    ]);
  });
});

describe('TranscriptionPipeline recovery chain (AC-D5-2: throw injection)', () => {
  it('moves to the browser engine when whisper transcribe() throws, keeping the failure in the trace', async () => {
    setBrowserEnv(true);
    const pipeline = new TranscriptionPipeline();
    whisperState.throws = true;

    const result = await pipeline.transcribe('blob:whisper-throws');

    expect(whisperState.calls).toBe(1);
    expect(browserState.calls).toBe(1);
    expect(result.success).toBe(true);
    expect(result.fallback).not.toBe(true);
    expect(result.segments[0]?.text).toBe(REAL_SEGMENT.text);

    const outcome = requireOutcome(pipeline);
    const whisperTrace = outcome.trace[0];
    expect(whisperTrace.stepId).toBe('whisper-inference');
    expect(whisperTrace.attempted).toBe(true);
    expect(whisperTrace.success).toBe(false);
    expect(outcome.winningStepId).toBe('web-speech-file');
  });
});

describe('TranscriptionPipeline recovery chain (AC-D5-3: total wipe → disclosure)', () => {
  it('lets the terminal disclosed-placeholder step win with fallbackUsed and confidence 0', async () => {
    setBrowserEnv(true);
    const pipeline = new TranscriptionPipeline();
    browserState.result = { success: false, segments: [], language: 'en', duration: 0, error: 'no-speech' };

    const result = await pipeline.transcribe('blob:all-engines-fail');

    const outcome = requireOutcome(pipeline);
    expect(outcome.winningStepId).toBe('disclosed-placeholder');
    expect(outcome.fallbackUsed).toBe(true);
    expect(outcome.confidence).toBe(0);

    expect(result.fallback).toBe(true);
    expect(result.success).toBe(false);
    expect(result.segments[0]?.confidence).toBe(0);
    expect(result.segments[0]?.text).toContain('[Transcription unavailable');
  });

  it('still returns disclosed placeholder segments when the chain ends success:false (budget exhaustion)', async () => {
    setBrowserEnv(true);
    const pipeline = new TranscriptionPipeline();

    // Advance the clock past the chain deadline on every Date.now() call so
    // all steps (mandatory included) are skipped: recovery-strategy-chain
    // hard-stops when remaining budget <= 0.
    let fakeNow = 1_000_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => {
      fakeNow += 60_000;
      return fakeNow;
    });

    const result = await pipeline.transcribe('blob:budget-exhausted');

    const outcome = requireOutcome(pipeline);
    expect(outcome.success).toBe(false);
    expect(outcome.stepsAttempted).toBe(0);
    expect(whisperState.calls).toBe(0);

    expect(result.fallback).toBe(true);
    expect(result.success).toBe(false);
    expect(result.segments[0]?.confidence).toBe(0);
    expect(result.segments[0]?.text).toContain('[Transcription unavailable');
  });
});

describe('TranscriptionPipeline recovery chain (AC-D5-4: minConfidence=0 order authority)', () => {
  it('lets unmeasured real whisper inference (undefined segment confidence) win over lower engines', async () => {
    setBrowserEnv(true);
    const pipeline = new TranscriptionPipeline();
    whisperState.result = {
      success: true,
      segments: [{ id: 0, start: 0, end: 4000, text: 'real whisper inference output' }],
      language: 'en',
      duration: 4000,
    };

    const result = await pipeline.transcribe('blob:real-whisper');

    const outcome = requireOutcome(pipeline);
    expect(outcome.winningStepId).toBe('whisper-inference');
    expect(outcome.confidence).toBe(0);
    expect(browserState.calls).toBe(0);
    expect(result.success).toBe(true);
    expect(result.fallback).not.toBe(true);
  });

  it('isRealTranscriptionResult rejects placeholder flag, empty segments and success:false', () => {
    expect(isRealTranscriptionResult({ success: true, segments: [REAL_SEGMENT], placeholder: true })).toBe(false);
    expect(isRealTranscriptionResult({ success: true, segments: [], placeholder: undefined })).toBe(false);
    expect(isRealTranscriptionResult({ success: false, segments: [REAL_SEGMENT], placeholder: undefined })).toBe(false);
    expect(isRealTranscriptionResult({ success: true, segments: [REAL_SEGMENT], placeholder: undefined })).toBe(true);
  });
});

describe('TranscriptionPipeline recovery chain (AC-D5-5: event witness + getter)', () => {
  it('emits attempt/success/failure on the singleton bus with stage transcription, and the getter returns the latest outcome', async () => {
    setBrowserEnv(true);
    const pipeline = new TranscriptionPipeline();
    browserState.result = { success: false, segments: [], language: 'en', duration: 0, error: 'no-speech' };

    await pipeline.transcribe('blob:event-witness');

    expect(transcriptionStageEvents().map((e) => `${e.type}:${e.strategyId}`)).toEqual([
      'recovery:attempt:whisper-inference',
      'recovery:failure:whisper-inference',
      'recovery:attempt:web-speech-file',
      'recovery:failure:web-speech-file',
      'recovery:attempt:disclosed-placeholder',
      'recovery:success:disclosed-placeholder',
    ]);
    const successEvent = transcriptionStageEvents().find((e) => e.type === 'recovery:success');
    expect(successEvent?.fallbackUsed).toBe(true);

    expect(pipeline.getRecoveryOutcome()?.winningStepId).toBe('disclosed-placeholder');

    // The getter holds only the LATEST transcribe() outcome (no accumulation).
    whisperState.result = {
      success: true,
      segments: [{ id: 0, start: 0, end: 4000, text: 'real whisper inference output' }],
      language: 'en',
      duration: 4000,
    };
    await pipeline.transcribe('blob:second-call');
    expect(pipeline.getRecoveryOutcome()?.winningStepId).toBe('whisper-inference');
  });
});

describe('TranscriptionPipeline → AX-3 quality seam (REQ-430 / TC-423-01)', () => {
  it('a total engine wipe terminates at disclosed-placeholder and flows through the canonical estimator as the penalized accuracy', async () => {
    setBrowserEnv(true);
    const pipeline = new TranscriptionPipeline();
    whisperState.result = { success: false, segments: [], language: 'en', duration: 0, error: 'no-backend' };
    browserState.result = { success: false, segments: [], language: 'en', duration: 0, error: 'no-speech' };

    const result = await pipeline.transcribe('blob:total-wipe');

    // TranscriptionResult itself marks the placeholder run as NOT a real
    // success (fallback disclosed) — but the chain outcome is still a win
    // for the terminal step, and a recovered pipeline path can aggregate a
    // nominally-successful PipelineResult for exactly this run.
    expect(result.success).toBe(false);
    expect(result.fallback).toBe(true);
    // The getter reports the terminal placeholder state — the single-source
    // input REQ-430 (a) pins for quality aggregation.
    const outcome = pipeline.getRecoveryOutcome();
    expect(outcome?.winningStepId).toBe('disclosed-placeholder');
    expect(endedAtDisclosedPlaceholder(outcome)).toBe(true);

    // The quality seam: that SAME outcome, derived through the exported
    // predicate, feeds the canonical estimator's penalty — an
    // all-engines-dead run aggregates BELOW the 0.85 gate band instead of
    // the structural proxy's 0.90. The signals fixture mirrors what a
    // recovered pipeline path (e.g. handlePipelineFailure → createMinimal
    // result) hands the estimator: pipeline-level success with scenes.
    const accuracy = estimateTranscriptionAccuracy(
      {
        success: true,
        scenes: [{ type: 'flow', nodes: [], edges: [], startMs: 0, durationMs: 4000, summary: '', keyphrases: [] }],
        duration: 4000,
      } as Parameters<typeof estimateTranscriptionAccuracy>[0],
      { endedAtDisclosedPlaceholder: endedAtDisclosedPlaceholder(outcome) },
    );
    expect(accuracy).toBe(DISCLOSED_PLACEHOLDER_TRANSCRIPTION_ACCURACY);
    expect(accuracy).toBeLessThan(0.85);
  });

  it('the predicate authority: a null outcome (pre-first-run) reads as false', () => {
    expect(endedAtDisclosedPlaceholder(null)).toBe(false);
  });
});
