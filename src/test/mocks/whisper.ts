/**
 * Mock factories for Whisper speech recognition.
 */

export interface MockWhisperSegment {
  text: string;
  startMs: number;
  endMs: number;
}

export interface MockWhisperResult {
  text: string;
  segments: MockWhisperSegment[];
}

/**
 * Create a mock Whisper transcription result.
 */
export function createMockWhisperResult(
  overrides: Partial<MockWhisperResult> = {},
): MockWhisperResult {
  return {
    text: 'Sample transcription text',
    segments: [
      { text: 'Sample transcription text', startMs: 0, endMs: 5000 },
    ],
    ...overrides,
  };
}

/**
 * Create a mock Whisper transcriber object with jest fns.
 */
export function createMockWhisperTranscriber() {
  return {
    transcribe: vi.fn().mockResolvedValue(createMockWhisperResult()),
    setModel: vi.fn(),
    getLanguage: vi.fn().mockReturnValue('en'),
  };
}
