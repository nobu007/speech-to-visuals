import { TranscriptionPipeline } from '@/transcription/transcriber';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock WhisperTranscriber to avoid heavy dependency
jest.mock('@/transcription/whisper-transcriber', () => {
  return {
    WhisperTranscriber: class {
      transcribe = jest.fn().mockResolvedValue({ success: true, segments: [] });
    },
  };
});

// Mock BrowserTranscriber (not used in Node tests)
jest.mock('@/transcription/browser-transcriber', () => {
  return {
    BrowserTranscriber: class {
      transcribeAudioFile = jest.fn();
    },
  };
});

describe('TranscriptionPipeline: validateAudioFile', () => {
  it('rejects an empty audio path', async () => {
    const pipeline = new TranscriptionPipeline();
    const result = await pipeline.transcribe('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid audio path');
  });

  it('rejects unsupported file extensions', async () => {
    const pipeline = new TranscriptionPipeline();
    const result = await pipeline.transcribe('/tmp/testfile.xyz');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unsupported audio format');
    expect(result.error).toContain('.xyz');
    expect(result.error).toContain('mp3');
  });

  it('rejects a non-existent file with supported extension', async () => {
    const pipeline = new TranscriptionPipeline();
    const bogusPath = path.join(os.tmpdir(), `nonexistent-${Date.now()}.mp3`);
    const result = await pipeline.transcribe(bogusPath);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found or not readable');
  });

  it('accepts blob URLs without extension validation', async () => {
    const pipeline = new TranscriptionPipeline();
    // blob URLs bypass both extension and fs checks, so transcribe proceeds
    // past validation. It may succeed (fallback segments) or fail, but should
    // never fail with "Unsupported audio format".
    const result = await pipeline.transcribe('blob:http://localhost/test');
    // If error is present, it must NOT be a validation error
    if (result.error) {
      expect(result.error).not.toContain('Unsupported audio format');
    } else {
      // Validation passed and fallback segments were used — acceptable
      expect(result.success).toBe(true);
    }
  });

  it('accepts a real file with supported extension', async () => {
    const pipeline = new TranscriptionPipeline();
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'audio-val-'));
    const tmpFile = path.join(tmpDir, 'test-audio.wav');
    await fs.promises.writeFile(tmpFile, Buffer.alloc(44)); // minimal WAV header size

    const result = await pipeline.transcribe(tmpFile);
    // Validation passes — if error is present, it must NOT be a validation error
    if (result.error) {
      expect(result.error).not.toContain('Unsupported audio format');
      expect(result.error).not.toContain('not found or not readable');
    } else {
      expect(result.success).toBe(true);
    }

    // Cleanup
    await fs.promises.rm(tmpDir, { recursive: true });
  });

  it('lists all supported formats in error message for bad extension', async () => {
    const pipeline = new TranscriptionPipeline();
    const result = await pipeline.transcribe('/tmp/file.txt');
    expect(result.error).toContain('mp3');
    expect(result.error).toContain('wav');
    expect(result.error).toContain('ogg');
    expect(result.error).toContain('m4a');
  });
});
