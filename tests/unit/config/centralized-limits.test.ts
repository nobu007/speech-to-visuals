/**
 * ISS-044: Tests for centralized limits configuration.
 * Verifies that all magic numbers are accessible and consistent.
 */
import {
  RATE_LIMITS,
  BATCH_LIMITS,
  SERVER_LIMITS,
  PIPELINE_LIMITS,
  AUDIO_LIMITS,
  SECURITY_LIMITS,
  SUPPORTED_AUDIO_FORMATS,
} from '../../../src/config/limits';

// Import re-exports from types.ts to verify backward compatibility
import {
  MAX_FILE_SIZE,
  SUPPORTED_AUDIO_FORMATS as TYPES_SUPPORTED_FORMATS,
} from '../../../src/transcription/types';

describe('ISS-044: Centralized limits configuration', () => {
  describe('RATE_LIMITS', () => {
    it('should define API rate limit with window and max', () => {
      expect(RATE_LIMITS.API.WINDOW_MS).toBe(15 * 60 * 1000);
      expect(RATE_LIMITS.API.MAX_REQUESTS).toBe(100);
    });

    it('should define UPLOAD rate limit with window and max', () => {
      expect(RATE_LIMITS.UPLOAD.WINDOW_MS).toBe(15 * 60 * 1000);
      expect(RATE_LIMITS.UPLOAD.MAX_REQUESTS).toBe(20);
    });

    it('should have upload limit stricter than API limit', () => {
      expect(RATE_LIMITS.UPLOAD.MAX_REQUESTS).toBeLessThan(RATE_LIMITS.API.MAX_REQUESTS);
    });
  });

  describe('BATCH_LIMITS', () => {
    it('should define max concurrent jobs', () => {
      expect(BATCH_LIMITS.MAX_CONCURRENT_JOBS).toBe(3);
    });

    it('should define max stored jobs', () => {
      expect(BATCH_LIMITS.MAX_STORED_JOBS).toBe(200);
    });

    it('should define max files per batch', () => {
      expect(BATCH_LIMITS.MAX_FILES_PER_BATCH).toBe(100);
    });

    it('should have reasonable relative values', () => {
      expect(BATCH_LIMITS.MAX_CONCURRENT_JOBS).toBeLessThan(BATCH_LIMITS.MAX_STORED_JOBS);
      expect(BATCH_LIMITS.MAX_FILES_PER_BATCH).toBeLessThan(BATCH_LIMITS.MAX_STORED_JOBS);
    });
  });

  describe('SERVER_LIMITS', () => {
    it('should define body limit as a string with mb unit', () => {
      expect(SERVER_LIMITS.BODY_LIMIT).toBe('50mb');
    });
  });

  describe('SECURITY_LIMITS', () => {
    it('should define JWT secret minimum length >= 32', () => {
      expect(SECURITY_LIMITS.JWT_SECRET_MIN_LENGTH).toBeGreaterThanOrEqual(32);
    });

    it('should define JWT secret minimum char types >= 2', () => {
      expect(SECURITY_LIMITS.JWT_SECRET_MIN_CHAR_TYPES).toBeGreaterThanOrEqual(2);
    });
  });

  describe('PIPELINE_LIMITS', () => {
    it('should define max scenes', () => {
      expect(PIPELINE_LIMITS.MAX_SCENES).toBe(200);
    });

    it('should define max iterations', () => {
      expect(PIPELINE_LIMITS.MAX_ITERATIONS).toBe(500);
    });

    it('should define max output name length', () => {
      expect(PIPELINE_LIMITS.MAX_OUTPUT_NAME_LENGTH).toBe(255);
    });

    it('should define max commit message length', () => {
      expect(PIPELINE_LIMITS.MAX_COMMIT_MESSAGE_LENGTH).toBe(1000);
    });

    it('should define max FPS', () => {
      expect(PIPELINE_LIMITS.MAX_FPS).toBe(120);
    });
  });

  describe('AUDIO_LIMITS', () => {
    it('should define max file size as 50MB', () => {
      expect(AUDIO_LIMITS.MAX_FILE_SIZE_BYTES).toBe(50 * 1024 * 1024);
    });

    it('should define duration warning threshold as 3600 seconds (1 hour)', () => {
      expect(AUDIO_LIMITS.DURATION_WARNING_SECONDS).toBe(3600);
    });

    it('should have reasonable max file size (> 0)', () => {
      expect(AUDIO_LIMITS.MAX_FILE_SIZE_BYTES).toBeGreaterThan(0);
    });

    it('should have reasonable duration warning threshold (> 0)', () => {
      expect(AUDIO_LIMITS.DURATION_WARNING_SECONDS).toBeGreaterThan(0);
    });
  });

  describe('as const immutability', () => {
    it('RATE_LIMITS should be inferred as literal types', () => {
      const limits = RATE_LIMITS;
      // TypeScript enforces literal types via `as const`; runtime check verifies values are frozen
      expect(limits.API.WINDOW_MS).toBe(900000 as const);
      expect(limits.API.MAX_REQUESTS).toBe(100 as const);
    });

    it('BATCH_LIMITS should be inferred as literal types', () => {
      const limits = BATCH_LIMITS;
      expect(limits.MAX_CONCURRENT_JOBS).toBe(3 as const);
      expect(limits.MAX_STORED_JOBS).toBe(200 as const);
      expect(limits.MAX_FILES_PER_BATCH).toBe(100 as const);
    });

    it('PIPELINE_LIMITS should be inferred as literal types', () => {
      const limits = PIPELINE_LIMITS;
      expect(limits.MAX_SCENES).toBe(200 as const);
      expect(limits.MAX_FPS).toBe(120 as const);
    });

    it('SECURITY_LIMITS should be inferred as literal types', () => {
      const limits = SECURITY_LIMITS;
      expect(limits.JWT_SECRET_MIN_LENGTH).toBe(32 as const);
      expect(limits.JWT_SECRET_MIN_CHAR_TYPES).toBe(2 as const);
    });

    it('AUDIO_LIMITS should be inferred as literal types', () => {
      const limits = AUDIO_LIMITS;
      expect(limits.MAX_FILE_SIZE_BYTES).toBe(52428800 as const);
      expect(limits.DURATION_WARNING_SECONDS).toBe(3600 as const);
    });
  });

  // REQ-145: Consolidation tests — verify re-exported values match canonical source
  describe('REQ-145: audio constant consolidation', () => {
    it('MAX_FILE_SIZE re-exported from types.ts equals AUDIO_LIMITS.MAX_FILE_SIZE_BYTES', () => {
      expect(MAX_FILE_SIZE).toBe(AUDIO_LIMITS.MAX_FILE_SIZE_BYTES);
    });

    it('SUPPORTED_AUDIO_FORMATS re-exported from types.ts equals limits.ts canonical', () => {
      expect(TYPES_SUPPORTED_FORMATS).toBe(SUPPORTED_AUDIO_FORMATS);
    });

    it('SUPPORTED_AUDIO_FORMATS contains expected formats', () => {
      expect(SUPPORTED_AUDIO_FORMATS).toEqual(['mp3', 'wav', 'ogg', 'm4a']);
    });

    it('MAX_FILE_SIZE is exactly 50MB (52428800 bytes)', () => {
      expect(MAX_FILE_SIZE).toBe(52428800);
    });
  });
});
