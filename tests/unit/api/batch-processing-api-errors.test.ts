/**
 * ISS-028: BatchProcessingAPI uses custom error classes
 *
 * Verifies that BatchProcessingAPI methods throw BatchValidationError
 * and JobNotFoundError instead of raw Error objects.
 */

import { BatchProcessingAPI } from '@/api/batch-processing-api';
import { BatchValidationError, JobNotFoundError } from '@/api/routes/batch';

// Mock pipeline dependencies so we don't need real implementations
jest.mock('@/pipeline/simple-pipeline', () => ({
  simplePipeline: {
    process: jest.fn().mockResolvedValue({ success: true, transcript: 'test' }),
  },
}));

jest.mock('@/pipeline/adaptive-quality-presets', () => ({
  adaptiveQualityPresets: {
    setPreset: jest.fn(),
    toPipelineOptions: jest.fn().mockReturnValue({
      file: { name: 'test.wav' },
      options: {},
    }),
    getCurrentPreset: jest.fn().mockReturnValue({ name: 'balanced' }),
  },
}));

// ===========================================================================
// Tests
// ===========================================================================

describe('ISS-028: BatchProcessingAPI custom error classes', () => {
  let api: BatchProcessingAPI;

  beforeEach(() => {
    api = new BatchProcessingAPI();
  });

  // ---------------------------------------------------------------------------
  // submitJob validation errors
  // ---------------------------------------------------------------------------

  describe('submitJob', () => {
    it('should throw BatchValidationError when no files provided', async () => {
      await expect(api.submitJob({ files: [] })).rejects.toThrow(BatchValidationError);
      await expect(api.submitJob({ files: [] })).rejects.toThrow('No files provided');
    });

    it('should throw BatchValidationError when too many files', async () => {
      const files = Array.from({ length: 101 }, (_, i) =>
        new File([], `file${i}.wav`)
      );

      await expect(api.submitJob({ files })).rejects.toThrow(BatchValidationError);
      await expect(api.submitJob({ files })).rejects.toThrow('Maximum 100 files');
    });

    it('BatchValidationError should have statusCode 400 and code VALIDATION_ERROR', async () => {
      try {
        await api.submitJob({ files: [] });
        fail('Expected BatchValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(BatchValidationError);
        expect((err as BatchValidationError).statusCode).toBe(400);
        expect((err as BatchValidationError).code).toBe('VALIDATION_ERROR');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // getJobStatus errors
  // ---------------------------------------------------------------------------

  describe('getJobStatus', () => {
    it('should throw JobNotFoundError for non-existent job', () => {
      expect(() => api.getJobStatus('non-existent-id')).toThrow(JobNotFoundError);
    });

    it('JobNotFoundError should have statusCode 404 and code JOB_NOT_FOUND', () => {
      try {
        api.getJobStatus('non-existent-id');
        fail('Expected JobNotFoundError');
      } catch (err) {
        expect(err).toBeInstanceOf(JobNotFoundError);
        expect((err as JobNotFoundError).statusCode).toBe(404);
        expect((err as JobNotFoundError).code).toBe('JOB_NOT_FOUND');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // getJobResult errors
  // ---------------------------------------------------------------------------

  describe('getJobResult', () => {
    it('should throw JobNotFoundError for non-existent job', () => {
      expect(() => api.getJobResult('non-existent-id')).toThrow(JobNotFoundError);
    });
  });
});
