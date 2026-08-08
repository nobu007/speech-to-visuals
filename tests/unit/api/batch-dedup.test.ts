/**
 * Tests for batch job file deduplication in BatchProcessingAPI.submitJob().
 *
 * Covers:
 * - Duplicate files (same name + size) are skipped
 * - Unique files are processed normally
 * - All-duplicate request raises BatchValidationError
 * - Return value includes skippedFiles list
 */
import { jest } from '@jest/globals';
import { BatchProcessingAPI } from '@/api/batch-processing-api';
import { BatchValidationError } from '@/api/routes/batch';

// Prevent actual pipeline execution during tests
jest.mock('@/pipeline/simple-pipeline', () => ({
  simplePipeline: {
    process: jest.fn().mockResolvedValue({
      scenes: [],
      diagramData: { type: 'flow', nodes: [], edges: [] },
      metadata: { duration: 0 },
    }),
  },
}));

/**
 * Minimal File-like stub for testing. Provides `arrayBuffer()` so the dedup key
 * is derived from CONTENT bytes (via computeFileHash), matching how a real File
 * behaves — never from name+size metadata (the 08y collision class). The content
 * is deterministic in name+size, so the dedup contract (same name+size ⇒ same
 * bytes ⇒ duplicate; same name, different size ⇒ distinct) is preserved.
 */
class StubFile {
  name: string;
  size: number;
  constructor(name: string, size: number) {
    this.name = name;
    this.size = size;
  }
  arrayBuffer(): Promise<ArrayBuffer> {
    const bytes = Buffer.from(`${this.name}::${this.size}`);
    const ab = new ArrayBuffer(bytes.length);
    new Uint8Array(ab).set(bytes);
    return Promise.resolve(ab);
  }
}

describe('BatchProcessingAPI – file deduplication', () => {
  let api: BatchProcessingAPI;

  beforeEach(() => {
    api = new BatchProcessingAPI();
  });

  it('should return jobId for unique files', async () => {
    const result = await api.submitJob({
      files: [
        new StubFile('audio1.wav', 1024) as unknown as File,
        new StubFile('audio2.wav', 2048) as unknown as File,
      ],
    });

    expect(result.jobId).toBeDefined();
    expect(result.jobId).toMatch(/^job_/);
  });

  it('should skip duplicate files (same name + size)', async () => {
    const result = await api.submitJob({
      files: [
        new StubFile('audio1.wav', 1024) as unknown as File,
        new StubFile('audio2.wav', 2048) as unknown as File,
        new StubFile('audio1.wav', 1024) as unknown as File, // duplicate of first
      ],
    });

    expect(result.jobId).toBeDefined();
    expect(result.skippedFiles).toEqual(['audio1.wav']);
  });

  it('should not skip files with same name but different size', async () => {
    const result = await api.submitJob({
      files: [
        new StubFile('audio.wav', 1024) as unknown as File,
        new StubFile('audio.wav', 2048) as unknown as File, // same name, different size
      ],
    });

    expect(result.jobId).toBeDefined();
    expect(result.skippedFiles).toBeUndefined();
  });

  it('should keep one copy when all files are identical', async () => {
    const result = await api.submitJob({
      files: [
        new StubFile('audio.wav', 1024) as unknown as File,
        new StubFile('audio.wav', 1024) as unknown as File,
      ],
    });

    // First occurrence is kept, subsequent duplicates are skipped
    expect(result.jobId).toBeDefined();
    expect(result.skippedFiles).toEqual(['audio.wav']);
  });

  it('should throw BatchValidationError for empty file list', async () => {
    await expect(
      api.submitJob({
        files: [],
      }),
    ).rejects.toThrow(BatchValidationError);
  });

  it('should not return skippedFiles when no duplicates', async () => {
    const result = await api.submitJob({
      files: [
        new StubFile('a.wav', 100) as unknown as File,
        new StubFile('b.wav', 200) as unknown as File,
        new StubFile('c.wav', 300) as unknown as File,
      ],
    });

    expect(result.jobId).toBeDefined();
    expect(result.skippedFiles).toBeUndefined();
  });

  it('should skip multiple duplicates and keep uniques', async () => {
    const result = await api.submitJob({
      files: [
        new StubFile('a.wav', 100) as unknown as File,
        new StubFile('b.wav', 200) as unknown as File,
        new StubFile('a.wav', 100) as unknown as File, // dup
        new StubFile('b.wav', 200) as unknown as File, // dup
        new StubFile('c.wav', 300) as unknown as File,
      ],
    });

    expect(result.skippedFiles).toEqual(['a.wav', 'b.wav']);
    expect(result.jobId).toBeDefined();
  });
});
