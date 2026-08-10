import { jest } from '@jest/globals';

// ─── Mock Setup ──────────────────────────────────────────────────────────────

// Mock the error-handler module's fetchWithTimeout. jest.mock is a no-op under
// the ESM jest preset, so register the factory via unstable_mockModule and
// resolve the bindings through dynamic import (after registration). The mock
// module is cached, so the SUT's `import { fetchWithTimeout }` and the test's
// re-import below receive the same jest.fn() instance.
jest.unstable_mockModule('#supabase/functions/_shared/error-handler.ts', () => ({
  __esModule: true,
  CORS_HEADERS: {},
  corsResponse: jest.fn(),
  optionsResponse: jest.fn(),
  errorResponse: jest.fn(),
  validateRequired: (body: Record<string, unknown>, fields: string[]) => {
    for (const field of fields) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        throw new Error(`${field} is required`);
      }
    }
  },
  createTimeout: jest.fn(),
  fetchWithTimeout: jest.fn(),
}));

const { handleTranscribe, TRANSCRIBE_TIMEOUT_MS } = await import('#supabase/functions/transcribe-audio/index');
const fetchWithTimeout = (await import('#supabase/functions/_shared/error-handler.ts')).fetchWithTimeout as jest.Mock;

const VALID_ENV = { LOVABLE_API_KEY: 'test-api-key' };
const USER_ID = 'user-test-001';

function mockAudioResponse(buffer: ArrayBuffer) {
  return {
    ok: true,
    blob: async () => new Blob([buffer]),
  };
}

function mockTranscriptionResponse(data: Record<string, unknown>) {
  return {
    ok: true,
    text: async () => JSON.stringify(data),
    json: async () => data,
  };
}

// ─── handleTranscribe Tests ──────────────────────────────────────────────────

describe('handleTranscribe', () => {
  beforeEach(() => {
    (fetchWithTimeout as jest.Mock).mockReset();
  });

  it('should return transcript with segments on success', async () => {
    const audioBuffer = new ArrayBuffer(1024);
    const transcriptionData = {
      text: 'Hello world, this is a test.',
      duration: 5.2,
      language: 'en',
      segments: [
        { id: 0, start: 0, end: 2.5, text: 'Hello world,', avg_logprob: -0.1 },
        { id: 1, start: 2.5, end: 5.2, text: ' this is a test.', avg_logprob: -0.2 },
      ],
    };

    // First call: audio download
    (fetchWithTimeout as jest.Mock).mockResolvedValueOnce(mockAudioResponse(audioBuffer));
    // Second call: Whisper API
    (fetchWithTimeout as jest.Mock).mockResolvedValueOnce(mockTranscriptionResponse(transcriptionData));

    const result = await handleTranscribe(
      { audioUrl: 'https://example.com/audio.mp3' },
      USER_ID,
      VALID_ENV
    );

    expect(result.transcript).toBe('Hello world, this is a test.');
    expect(result.duration).toBe(5.2);
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0].text).toBe('Hello world,');
    expect(result.segments[0].confidence).toBeDefined();
    expect(result.language).toBe('en');
  });

  it('should pass language parameter to the API', async () => {
    const audioBuffer = new ArrayBuffer(512);
    (fetchWithTimeout as jest.Mock).mockResolvedValueOnce(mockAudioResponse(audioBuffer));
    (fetchWithTimeout as jest.Mock).mockResolvedValueOnce(
      mockTranscriptionResponse({ text: 'テスト', duration: 1, segments: [] })
    );

    await handleTranscribe(
      { audioUrl: 'https://example.com/audio.mp3', language: 'ja' },
      USER_ID,
      VALID_ENV
    );

    // The second call should be the Whisper API call
    const whisperCall = (fetchWithTimeout as jest.Mock).mock.calls[1];
    expect(whisperCall[0]).toContain('transcriptions');
  });

  it('should throw validation error when audioUrl is missing', async () => {
    await expect(
      handleTranscribe({} as Partial<import('#supabase/functions/transcribe-audio/index').TranscribeRequest> as import('#supabase/functions/transcribe-audio/index').TranscribeRequest, USER_ID, VALID_ENV)
    ).rejects.toThrow('audioUrl is required');
  });

  it('should throw validation error when audioUrl is empty', async () => {
    await expect(
      handleTranscribe({ audioUrl: '' }, USER_ID, VALID_ENV)
    ).rejects.toThrow('audioUrl is required');
  });

  it('should throw when audio download fails', async () => {
    (fetchWithTimeout as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    await expect(
      handleTranscribe({ audioUrl: 'https://example.com/notfound.mp3' }, USER_ID, VALID_ENV)
    ).rejects.toThrow('Failed to download audio file');
  });

  it('should throw when audio file is empty', async () => {
    (fetchWithTimeout as jest.Mock).mockResolvedValueOnce(mockAudioResponse(new ArrayBuffer(0)));

    await expect(
      handleTranscribe({ audioUrl: 'https://example.com/empty.mp3' }, USER_ID, VALID_ENV)
    ).rejects.toThrow('Downloaded audio file is empty');
  });

  it('should throw when LOVABLE_API_KEY is not configured', async () => {
    (fetchWithTimeout as jest.Mock).mockResolvedValueOnce(mockAudioResponse(new ArrayBuffer(100)));

    await expect(
      handleTranscribe({ audioUrl: 'https://example.com/audio.mp3' }, USER_ID, { LOVABLE_API_KEY: '' })
    ).rejects.toThrow('LOVABLE_API_KEY not configured');
  });

  it('should throw when Whisper API returns error', async () => {
    (fetchWithTimeout as jest.Mock).mockResolvedValueOnce(mockAudioResponse(new ArrayBuffer(100)));
    (fetchWithTimeout as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    await expect(
      handleTranscribe({ audioUrl: 'https://example.com/audio.mp3' }, USER_ID, VALID_ENV)
    ).rejects.toThrow('Transcription failed: 500');
  });

  it('should default to 30s timeout', () => {
    expect(TRANSCRIBE_TIMEOUT_MS).toBe(30000);
  });

  it('should handle segments without avg_logprob', async () => {
    (fetchWithTimeout as jest.Mock).mockResolvedValueOnce(mockAudioResponse(new ArrayBuffer(100)));
    (fetchWithTimeout as jest.Mock).mockResolvedValueOnce(
      mockTranscriptionResponse({
        text: 'Simple text',
        duration: 2,
        segments: [{ id: 0, start: 0, end: 2, text: 'Simple text' }],
      })
    );

    const result = await handleTranscribe(
      { audioUrl: 'https://example.com/audio.mp3' },
      USER_ID,
      VALID_ENV
    );

    expect(result.segments[0].confidence).toBeUndefined();
  });

  it('should handle missing segments gracefully', async () => {
    (fetchWithTimeout as jest.Mock).mockResolvedValueOnce(mockAudioResponse(new ArrayBuffer(100)));
    (fetchWithTimeout as jest.Mock).mockResolvedValueOnce(
      mockTranscriptionResponse({ text: 'No segments here', duration: 3 })
    );

    const result = await handleTranscribe(
      { audioUrl: 'https://example.com/audio.mp3' },
      USER_ID,
      VALID_ENV
    );

    expect(result.segments).toEqual([]);
  });

  // TC-312 behavioral witness for the trust-boundary sanitizer wired at the
  // external Whisper-response parse site. RED before the fix: a malformed
  // gateway response carrying `1e400` parses to `Infinity`, which is truthy so
  // `transcription.duration || 0` yields `Infinity` and leaks out as
  // result.duration (non-finite → poisons downstream frame arithmetic). GREEN
  // after: sanitizeUntrustedJsonValue neutralizes Infinity → null, so
  // `null || 0` yields a finite 0. Built via JSON.parse so `1e400` becomes a
  // real Infinity and `__proto__` a real own property, mirroring production.
  it('neutralizes non-finite duration and poison keys from the Whisper response', async () => {
    const adversarial = JSON.parse(
      '{"text":"hi","duration":1e400,"language":"en","__proto__":{"polluted":true},"segments":[]}'
    );

    (fetchWithTimeout as jest.Mock).mockResolvedValueOnce(mockAudioResponse(new ArrayBuffer(100)));
    (fetchWithTimeout as jest.Mock).mockResolvedValueOnce(mockTranscriptionResponse(adversarial));

    const result = await handleTranscribe(
      { audioUrl: 'https://example.com/audio.mp3' },
      USER_ID,
      VALID_ENV
    );

    // The defect symptom: pre-fix this was Infinity (truthy || 0 === Infinity).
    expect(Number.isFinite(result.duration)).toBe(true);
    expect(result.duration).toBe(0);
    // Defense-in-depth: __proto__ key must not have polluted Object.prototype.
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });
});
