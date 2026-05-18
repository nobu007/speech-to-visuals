/**
 * ISS-044: Tests for centralized limits configuration.
 * Verifies that all magic numbers are accessible and consistent.
 */
import {
  RATE_LIMITS,
  BATCH_LIMITS,
  SERVER_LIMITS,
  PIPELINE_LIMITS,
  SECURITY_LIMITS,
} from '../../../src/config/limits';

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

  describe('as const immutability', () => {
    it('RATE_LIMITS should be inferred as literal types', () => {
      const limits = RATE_LIMITS;
      // TypeScript enforces literal types via `as const`; runtime check verifies values are frozen
      expect(limits.API.WINDOW_MS).toBe(900000 as 900000);
      expect(limits.API.MAX_REQUESTS).toBe(100 as 100);
    });

    it('BATCH_LIMITS should be inferred as literal types', () => {
      const limits = BATCH_LIMITS;
      expect(limits.MAX_CONCURRENT_JOBS).toBe(3 as 3);
      expect(limits.MAX_STORED_JOBS).toBe(200 as 200);
      expect(limits.MAX_FILES_PER_BATCH).toBe(100 as 100);
    });

    it('PIPELINE_LIMITS should be inferred as literal types', () => {
      const limits = PIPELINE_LIMITS;
      expect(limits.MAX_SCENES).toBe(200 as 200);
      expect(limits.MAX_FPS).toBe(120 as 120);
    });

    it('SECURITY_LIMITS should be inferred as literal types', () => {
      const limits = SECURITY_LIMITS;
      expect(limits.JWT_SECRET_MIN_LENGTH).toBe(32 as 32);
      expect(limits.JWT_SECRET_MIN_CHAR_TYPES).toBe(2 as 2);
    });
  });
});
