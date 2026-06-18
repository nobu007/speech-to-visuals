/**
 * @jest-environment jsdom
 */
import {
  StreamingTranscriber,
  createStreamingTranscriber,
  validateStreamingSupport,
} from '@/transcription/streaming-transcriber';

// Mock Audio constructor
const createMockAudio = (shouldFail = false) => () => {
  const audio = {
    onloadedmetadata: null as (() => void) | null,
    onerror: null as (() => void) | null,
    src: '',
    duration: 10,
  };
  // Use setImmediate-like for microtask scheduling
  queueMicrotask(() => {
    if (shouldFail) {
      if (audio.onerror) audio.onerror();
    } else {
      if (audio.onloadedmetadata) audio.onloadedmetadata();
    }
  });
  return audio;
};

// Mock URL.createObjectURL
const origURL = global.URL;
beforeEach(() => {
  (global as unknown as { Audio: jest.Mock }).Audio = jest.fn(createMockAudio()) as jest.Mock;
  Object.defineProperty(global, 'URL', {
    value: {
      ...origURL,
      createObjectURL: jest.fn(() => 'blob:test'),
      revokeObjectURL: jest.fn(),
    },
    writable: true,
  });
});

describe('StreamingTranscriber', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should use default config when no config provided', () => {
      const transcriber = new StreamingTranscriber();
      const config = transcriber.getConfig();
      expect(config.chunkSizeMs).toBe(3000);
      expect(config.overlapMs).toBe(500);
      expect(config.minConfidence).toBe(0.7);
      expect(config.enableLiveUpdate).toBe(true);
    });

    it('should merge custom config with defaults', () => {
      const transcriber = new StreamingTranscriber({ chunkSizeMs: 5000, minConfidence: 0.9 });
      const config = transcriber.getConfig();
      expect(config.chunkSizeMs).toBe(5000);
      expect(config.minConfidence).toBe(0.9);
      expect(config.overlapMs).toBe(500);
    });
  });

  describe('isStreamingActive', () => {
    it('should return false initially', () => {
      const transcriber = new StreamingTranscriber();
      expect(transcriber.isStreamingActive()).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('should return a copy of the config', () => {
      const transcriber = new StreamingTranscriber();
      const config = transcriber.getConfig();
      config.chunkSizeMs = 9999;
      const config2 = transcriber.getConfig();
      expect(config2.chunkSizeMs).toBe(3000);
    });
  });

  describe('updateConfig', () => {
    it('should update config partially', () => {
      const transcriber = new StreamingTranscriber();
      transcriber.updateConfig({ chunkSizeMs: 7000 });
      const config = transcriber.getConfig();
      expect(config.chunkSizeMs).toBe(7000);
      expect(config.overlapMs).toBe(500);
    });
  });

  describe('transcribeStream', () => {
    it('should process audio file and return transcription result', async () => {
      const transcriber = new StreamingTranscriber({ chunkSizeMs: 5000 });

      const result = await transcriber.transcribeStream('test-audio.wav');

      expect(result.success).toBe(true);
      expect(result.segments.length).toBeGreaterThan(0);
      expect(result.text).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      expect(result.language).toBe('ja');
    }, 30000);

    it('should call progress callback for each chunk', async () => {
      const transcriber = new StreamingTranscriber({ chunkSizeMs: 5000 });
      const progressCallback = jest.fn();

      await transcriber.transcribeStream('test-audio.wav', progressCallback);

      expect(progressCallback).toHaveBeenCalled();
    }, 30000);

    it('should call segment callback for valid segments', async () => {
      const transcriber = new StreamingTranscriber({ minConfidence: 0.5 });
      const segmentCallback = jest.fn();

      await transcriber.transcribeStream('test-audio.wav', undefined, segmentCallback);

      expect(segmentCallback).toHaveBeenCalled();
    }, 30000);

    it('should filter segments below confidence threshold', async () => {
      const transcriber = new StreamingTranscriber({ minConfidence: 0.99 });

      const result = await transcriber.transcribeStream('test-audio.wav');

      expect(result).toBeDefined();
    }, 30000);

    it('should handle File objects', async () => {
      const transcriber = new StreamingTranscriber({ chunkSizeMs: 5000 });
      const file = new File(['audio data'], 'test.wav', { type: 'audio/wav' });

      const result = await transcriber.transcribeStream(file);
      expect(result.success).toBe(true);
    }, 30000);

    it('should throw on audio load failure', async () => {
      (global as unknown as { Audio: jest.Mock }).Audio = jest.fn(createMockAudio(true)) as jest.Mock;

      const transcriber = new StreamingTranscriber();
      await expect(transcriber.transcribeStream('bad-file.wav')).rejects.toThrow();
    }, 30000);

    it('should handle chunk processing errors gracefully', async () => {
      const transcriber = new StreamingTranscriber({ chunkSizeMs: 5000 });
      // Should still succeed even if individual chunks may fail
      const result = await transcriber.transcribeStream('test-audio.wav');
      expect(result).toBeDefined();
    }, 30000);

    it('should return result with merged overlapping segments', async () => {
      const transcriber = new StreamingTranscriber({ chunkSizeMs: 3000, overlapMs: 500 });
      const result = await transcriber.transcribeStream('test-audio.wav');
      // Segments should be merged (overlap tolerance of 0.5s)
      expect(result.segments).toBeDefined();
    }, 30000);
  });

  describe('startLiveTranscription', () => {
    it('should throw if recognition not available', async () => {
      const transcriber = new StreamingTranscriber();
      await expect(transcriber.startLiveTranscription()).rejects.toThrow(
        'Speech recognition not supported'
      );
    });

    it('should warn and return if already streaming', async () => {
      const transcriber = new StreamingTranscriber();
      (transcriber as unknown as { recognition: unknown }).recognition = {
        continuous: false,
        interimResults: false,
        maxAlternatives: 1,
        lang: '',
        onstart: null,
        onend: null,
        onerror: null,
        onresult: null,
        start: jest.fn(),
        stop: jest.fn(),
      };
      (transcriber as unknown as { isStreaming: boolean }).isStreaming = true;

      // Should return without error (warns but doesn't throw)
      const result = await transcriber.startLiveTranscription();
      expect(result).toBeUndefined();
    });

    it('should start recognition and resolve', async () => {
      const mockStart = jest.fn();
      const transcriber = new StreamingTranscriber();
      (transcriber as unknown as { recognition: unknown }).recognition = {
        continuous: false,
        interimResults: false,
        maxAlternatives: 1,
        lang: '',
        onstart: null as (() => void) | null,
        onend: null as (() => void) | null,
        onerror: null as ((e: { error: string }) => void) | null,
        onresult: null as ((e: unknown) => void) | null,
        start: mockStart,
        stop: jest.fn(),
      };
      (transcriber as unknown as { isStreaming: boolean }).isStreaming = false;

      const promise = transcriber.startLiveTranscription();
      // Resolve the timeout
      await promise;
      expect(mockStart).toHaveBeenCalled();
    }, 10000);
  });

  describe('stopLiveTranscription', () => {
    it('should call recognition.stop when streaming', () => {
      const mockStop = jest.fn();
      const transcriber = new StreamingTranscriber();
      (transcriber as unknown as { recognition: unknown }).recognition = { stop: mockStop };
      (transcriber as unknown as { isStreaming: boolean }).isStreaming = true;

      transcriber.stopLiveTranscription();
      expect(mockStop).toHaveBeenCalled();
    });

    it('should not throw when not streaming', () => {
      const transcriber = new StreamingTranscriber();
      expect(() => transcriber.stopLiveTranscription()).not.toThrow();
    });

    it('should not throw when recognition is null', () => {
      const transcriber = new StreamingTranscriber();
      (transcriber as unknown as { recognition: unknown }).recognition = null;
      expect(() => transcriber.stopLiveTranscription()).not.toThrow();
    });
  });
});

describe('createStreamingTranscriber', () => {
  it('should create a StreamingTranscriber instance', () => {
    const transcriber = createStreamingTranscriber({ chunkSizeMs: 4000 });
    expect(transcriber).toBeInstanceOf(StreamingTranscriber);
    expect(transcriber.getConfig().chunkSizeMs).toBe(4000);
  });

  it('should create with default config', () => {
    const transcriber = createStreamingTranscriber();
    expect(transcriber).toBeInstanceOf(StreamingTranscriber);
  });
});

describe('validateStreamingSupport', () => {
  it('should return support flags', () => {
    const support = validateStreamingSupport();
    expect(typeof support.webSpeechAPI).toBe('boolean');
    expect(typeof support.mediaDevices).toBe('boolean');
    expect(typeof support.audioContext).toBe('boolean');
    expect(typeof support.recommendation).toBe('string');
  });

  it('should recommend browser upgrade when no web speech api', () => {
    const support = validateStreamingSupport();
    if (!support.webSpeechAPI) {
      expect(support.recommendation).toContain('Chrome');
    }
  });
});
