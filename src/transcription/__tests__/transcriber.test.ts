import { describe, it, expect } from '@jest/globals';
import { TranscriptionPipeline } from '@/transcription/transcriber';

describe('TranscriptionPipeline', () => {
  describe('constructor', () => {
    it('should create pipeline with default config', () => {
      const pipeline = new TranscriptionPipeline();
      expect(pipeline).toBeDefined();
    });

    it('should create pipeline with custom config', () => {
      const pipeline = new TranscriptionPipeline({
        model: 'tiny',
        outputFormat: 'json',
        combineMs: 100,
        maxRetries: 5,
      });
      expect(pipeline).toBeDefined();
    });
  });

  describe('nextIteration', () => {
    it('should increment iteration', () => {
      const pipeline = new TranscriptionPipeline();
      pipeline.nextIteration();
      // No error should be thrown
    });
  });

  describe('transcribe', () => {
    it('should handle empty audio path', async () => {
      const pipeline = new TranscriptionPipeline();
      const result = await pipeline.transcribe('');

      expect(result.success).toBe(false);
      expect(result.segments).toEqual([]);
      expect(result.error).toBeDefined();
    });

    it('should handle invalid audio path gracefully', async () => {
      const pipeline = new TranscriptionPipeline();
      const result = await pipeline.transcribe('nonexistent-audio.wav');

      // Should either succeed with fallback segments or fail gracefully
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should return result with proper structure', async () => {
      const pipeline = new TranscriptionPipeline();
      const result = await pipeline.transcribe('test.wav');

      expect(result).toHaveProperty('segments');
      expect(result).toHaveProperty('language');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('processingTime');
      expect(result).toHaveProperty('success');
      expect(Array.isArray(result.segments)).toBe(true);
    });
  });
});
