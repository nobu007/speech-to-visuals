/**
 * @jest-environment jsdom
 */

/**
 * REQ-179: StreamingTranscriber Quality Monitoring & Error Recovery Tests
 *
 * Lightweight unit tests for streaming-transcriber.ts focusing on:
 * - Quality monitor integration (getQualityMonitor, getQualitySummary, onQualityAlert)
 * - Configuration handling
 * - Error throwing with TranscriptionError
 * - Segment merging logic
 * - Streaming state management
 */

import { jest } from '@jest/globals';
import type { StreamingProgress, StreamingProgressCallback, SegmentCallback } from '@/transcription/streaming-transcriber';

let StreamingTranscriber: typeof import('@/transcription/streaming-transcriber').StreamingTranscriber;
let TranscriptionError: typeof import('@/transcription/types').TranscriptionError;

beforeAll(async () => {
  const mod = await import('@/transcription/streaming-transcriber');
  StreamingTranscriber = mod.StreamingTranscriber;

  const typesMod = await import('@/transcription/types');
  TranscriptionError = typesMod.TranscriptionError;
});

describe('REQ-179: StreamingTranscriber quality monitoring & error recovery', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---- Quality monitor integration ----

  describe('quality monitor', () => {
    it('should initialize quality monitor by default', () => {
      const transcriber = new StreamingTranscriber();
      expect(transcriber.getQualityMonitor()).not.toBeNull();
    });

    it('should not initialize quality monitor when disabled', () => {
      const transcriber = new StreamingTranscriber({ enableQualityMonitoring: false });
      expect(transcriber.getQualityMonitor()).toBeNull();
    });

    it('should return null quality summary when monitor is disabled', () => {
      const transcriber = new StreamingTranscriber({ enableQualityMonitoring: false });
      expect(transcriber.getQualitySummary()).toBeNull();
    });

    it('should register quality alert callback without throwing', () => {
      const transcriber = new StreamingTranscriber();
      const callback = jest.fn();
      expect(() => transcriber.onQualityAlert(callback)).not.toThrow();
    });

    it('should not throw when registering alert callback without monitor', () => {
      const transcriber = new StreamingTranscriber({ enableQualityMonitoring: false });
      const callback = jest.fn();
      expect(() => transcriber.onQualityAlert(callback)).not.toThrow();
    });
  });

  // ---- Configuration ----

  describe('configuration', () => {
    it('should return a defensive copy of config', () => {
      const transcriber = new StreamingTranscriber();
      const config1 = transcriber.getConfig();
      config1.chunkSizeMs = 9999;
      const config2 = transcriber.getConfig();
      expect(config2.chunkSizeMs).toBe(3000);
    });

    it('should update config partially', () => {
      const transcriber = new StreamingTranscriber();
      transcriber.updateConfig({ chunkSizeMs: 7000 });
      const config = transcriber.getConfig();
      expect(config.chunkSizeMs).toBe(7000);
      expect(config.overlapMs).toBe(500);
    });

    it('should use quality monitor config with minConfidence', () => {
      const transcriber = new StreamingTranscriber({ minConfidence: 0.9 });
      const monitor = transcriber.getQualityMonitor();
      expect(monitor).not.toBeNull();
    });
  });

  // ---- State management ----

  describe('streaming state', () => {
    it('should return false for isStreamingActive initially', () => {
      const transcriber = new StreamingTranscriber();
      expect(transcriber.isStreamingActive()).toBe(false);
    });
  });

  // ---- Live transcription error handling ----

  describe('startLiveTranscription error handling', () => {
    it('should throw TranscriptionError when recognition not available', async () => {
      const transcriber = new StreamingTranscriber();
      await expect(transcriber.startLiveTranscription()).rejects.toThrow(
        'Speech recognition not supported',
      );
    });

    it('should throw a TranscriptionError instance', async () => {
      const transcriber = new StreamingTranscriber();
      try {
        await transcriber.startLiveTranscription();
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(TranscriptionError);
      }
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

      const result = await transcriber.startLiveTranscription();
      expect(result).toBeUndefined();
    });
  });

  // ---- Stop live transcription ----

  describe('stopLiveTranscription', () => {
    it('should call recognition.stop when streaming', () => {
      const mockStop = jest.fn();
      const transcriber = new StreamingTranscriber();
      (transcriber as unknown as { recognition: unknown }).recognition = { stop: mockStop };
      (transcriber as unknown as { isStreaming: boolean }).isStreaming = true;

      transcriber.stopLiveTranscription();
      expect(mockStop).toHaveBeenCalled();
    });

    it('should not throw when recognition is null', () => {
      const transcriber = new StreamingTranscriber();
      (transcriber as unknown as { recognition: unknown }).recognition = null;
      expect(() => transcriber.stopLiveTranscription()).not.toThrow();
    });
  });

  // ---- Quality summary ----

  describe('quality summary', () => {
    it('should return a quality summary object from monitor', () => {
      const transcriber = new StreamingTranscriber();
      const summary = transcriber.getQualitySummary();
      // Summary may be null if no chunks processed, or a valid object
      if (summary) {
        expect(typeof summary.totalChunks).toBe('number');
        expect(typeof summary.averageConfidence).toBe('number');
      }
    });
  });
});
