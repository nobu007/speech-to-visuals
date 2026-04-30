import { handleTranscribe, TRANSCRIBE_TIMEOUT_MS } from '../../../supabase/functions/transcribe-audio/index';

// ─── Mock Setup ──────────────────────────────────────────────────────────────

// Mock the error-handler module's fetchWithTimeout
jest.mock('../../../supabase/functions/_shared/error-handler', () => {
  const actual = jest.requireActual('../../../supabase/functions/_shared/error-handler');
  return {
    ...actual,
    fetchWithTimeout: jest.fn(),
  };
});

import { fetchWithTimeout } from '../../../supabase/functions/_shared/error-handler';

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
    fetchWithTimeout.mockReset();
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
    fetchWithTimeout.mockResolvedValueOnce(mockAudioResponse(audioBuffer));
    // Second call: Whisper API
    fetchWithTimeout.mockResolvedValueOnce(mockTranscriptionResponse(transcriptionData));

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
    fetchWithTimeout.mockResolvedValueOnce(mockAudioResponse(audioBuffer));
    fetchWithTimeout.mockResolvedValueOnce(
      mockTranscriptionResponse({ text: 'テスト', duration: 1, segments: [] })
    );

    await handleTranscribe(
      { audioUrl: 'https://example.com/audio.mp3', language: 'ja' },
      USER_ID,
      VALID_ENV
    );

    // The second call should be the Whisper API call
    const whisperCall = fetchWithTimeout.mock.calls[1];
    expect(whisperCall[0]).toContain('transcriptions');
  });

  it('should throw validation error when audioUrl is missing', async () => {
    await expect(
      handleTranscribe({} as any, USER_ID, VALID_ENV)
    ).rejects.toThrow('audioUrl is required');
  });

  it('should throw validation error when audioUrl is empty', async () => {
    await expect(
      handleTranscribe({ audioUrl: '' }, USER_ID, VALID_ENV)
    ).rejects.toThrow('audioUrl is required');
  });

  it('should throw when audio download fails', async () => {
    fetchWithTimeout.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    await expect(
      handleTranscribe({ audioUrl: 'https://example.com/notfound.mp3' }, USER_ID, VALID_ENV)
    ).rejects.toThrow('Failed to download audio file');
  });

  it('should throw when audio file is empty', async () => {
    fetchWithTimeout.mockResolvedValueOnce(mockAudioResponse(new ArrayBuffer(0)));

    await expect(
      handleTranscribe({ audioUrl: 'https://example.com/empty.mp3' }, USER_ID, VALID_ENV)
    ).rejects.toThrow('Downloaded audio file is empty');
  });

  it('should throw when LOVABLE_API_KEY is not configured', async () => {
    fetchWithTimeout.mockResolvedValueOnce(mockAudioResponse(new ArrayBuffer(100)));

    await expect(
      handleTranscribe({ audioUrl: 'https://example.com/audio.mp3' }, USER_ID, { LOVABLE_API_KEY: '' })
    ).rejects.toThrow('LOVABLE_API_KEY not configured');
  });

  it('should throw when Whisper API returns error', async () => {
    fetchWithTimeout.mockResolvedValueOnce(mockAudioResponse(new ArrayBuffer(100)));
    fetchWithTimeout.mockResolvedValueOnce({
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
    fetchWithTimeout.mockResolvedValueOnce(mockAudioResponse(new ArrayBuffer(100)));
    fetchWithTimeout.mockResolvedValueOnce(
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
    fetchWithTimeout.mockResolvedValueOnce(mockAudioResponse(new ArrayBuffer(100)));
    fetchWithTimeout.mockResolvedValueOnce(
      mockTranscriptionResponse({ text: 'No segments here', duration: 3 })
    );

    const result = await handleTranscribe(
      { audioUrl: 'https://example.com/audio.mp3' },
      USER_ID,
      VALID_ENV
    );

    expect(result.segments).toEqual([]);
  });
});
