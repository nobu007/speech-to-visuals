/**
 * Phase 37: Batch Processing REST API
 *
 * Provides REST endpoints for automated batch processing:
 * - POST /api/batch/process - Submit batch processing job
 * - GET /api/batch/status/:jobId - Check job status
 * - GET /api/batch/result/:jobId - Retrieve results
 * - POST /api/batch/cancel/:jobId - Cancel running job
 *
 * Custom Instructions Alignment:
 * - Section 3: Execution Protocol - Batch processing automation
 * - Section 6: Web UI Development - API integration
 * - Section 9.2: Continuous Improvement - Production scalability
 */

import type { SimplePipelineInput, SimplePipelineResult } from '@/pipeline/simple-pipeline';
import { simplePipeline } from '@/pipeline/simple-pipeline';
import type { QualityPreset } from '@/pipeline/adaptive-quality-presets';
import { adaptiveQualityPresets } from '@/pipeline/adaptive-quality-presets';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { BatchValidationError, JobNotFoundError } from './routes/batch';
import { BATCH_LIMITS } from '../config/limits';
import { logger } from '../utils/logger';
import { pipelineMetricsCollector } from '@/monitoring/pipeline-metrics-collector';
import { validateAudioFile } from '@/utils/audio-validation';
import { sanitizeFilename } from '@/utils/sanitize';

export interface BatchJobRequest {
  files: File[];
  preset?: QualityPreset;
  options?: {
    generateVideo?: boolean;
    exportFormats?: Array<'svg' | 'png' | 'pdf' | 'json'>;
    notifyOnComplete?: boolean;
    priority?: 'low' | 'normal' | 'high';
  };
}

export interface BatchJobStatus {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: {
    total: number;
    completed: number;
    failed: number;
    percentage: number;
  };
  startedAt?: string;
  completedAt?: string;
  estimatedTimeRemaining?: number; // seconds
  currentFile?: string;
  errorMessage?: string;
}

export interface BatchJobResult {
  jobId: string;
  status: 'completed' | 'partial' | 'failed';
  results: Array<{
    filename: string;
    success: boolean;
    result?: SimplePipelineResult;
    error?: string;
    processingTime: number;
  }>;
  summary: {
    totalFiles: number;
    successCount: number;
    failureCount: number;
    totalProcessingTime: number;
    averageProcessingTime: number;
    totalQualityScore: number;
    averageQualityScore: number;
  };
  createdAt: string;
  completedAt: string;
}

/**
 * In-memory job storage (for Phase 37 MVP)
 * For production, use Redis or database
 */
const MAX_STORED_JOBS_V2 = BATCH_LIMITS.MAX_STORED_JOBS; // ISS-005: prevent unbounded memory growth

class JobStore {
  private jobs = new Map<string, {
    status: BatchJobStatus;
    result?: BatchJobResult;
    cancelToken: { cancelled: boolean };
  }>();

  /** Prune terminal jobs when store exceeds limit (ISS-005) */
  private pruneOldJobs(): void {
    if (this.jobs.size <= MAX_STORED_JOBS_V2) return;
    const terminal = new Set(['completed', 'failed', 'cancelled']);
    for (const [id, job] of this.jobs) {
      if (terminal.has(job.status.status)) {
        this.jobs.delete(id);
        if (this.jobs.size <= MAX_STORED_JOBS_V2) return;
      }
    }
  }

  createJob(files: File[], totalFiles?: number): string {
    this.pruneOldJobs();
    const jobId = `job_${Date.now()}_${randomUUID().split('-')[0]}`;
    this.jobs.set(jobId, {
      status: {
        jobId,
        status: 'queued',
        progress: {
          total: totalFiles ?? files.length,
          completed: 0,
          failed: 0,
          percentage: 0,
        },
      },
      cancelToken: { cancelled: false },
    });
    pipelineMetricsCollector.recordBatchJobTransition('created');
    return jobId;
  }

  getJobStatus(jobId: string): BatchJobStatus | null {
    return this.jobs.get(jobId)?.status || null;
  }

  getJobResult(jobId: string): BatchJobResult | null {
    return this.jobs.get(jobId)?.result || null;
  }

  updateJobStatus(jobId: string, update: Partial<BatchJobStatus>): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = { ...job.status, ...update };
    }
  }

  setJobResult(jobId: string, result: BatchJobResult): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.result = result;
    }
  }

  getCancelToken(jobId: string): { cancelled: boolean } | null {
    return this.jobs.get(jobId)?.cancelToken || null;
  }

  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (job && job.status.status === 'processing') {
      job.cancelToken.cancelled = true;
      job.status.status = 'cancelled';
      return true;
    }
    return false;
  }

  getAllJobs(): BatchJobStatus[] {
    return Array.from(this.jobs.values()).map((j) => j.status);
  }
}

const jobStore = new JobStore();

/**
 * Compute a SHA-256 content hash for a File.
 * Falls back to name+size when the blob API is unavailable (e.g. test stubs).
 */
async function computeFileHash(file: File): Promise<string> {
  if (typeof file.arrayBuffer === 'function') {
    const buffer = await file.arrayBuffer();
    return createHash('sha256').update(Buffer.from(buffer)).digest('hex').slice(0, 16);
  }
  // Fallback for non-standard File objects (test mocks)
  return createHash('sha256').update(`${file.name}::${file.size}`).digest('hex').slice(0, 16);
}

/**
 * Batch Processing API Controller
 */
export class BatchProcessingAPI {
  /**
   * Submit batch processing job
   */
  async submitJob(request: BatchJobRequest): Promise<{ jobId: string; skippedFiles?: string[] }> {

    // Validate request
    if (!request.files || request.files.length === 0) {
      throw new BatchValidationError('No files provided');
    }

    if (request.files.length > BATCH_LIMITS.MAX_FILES_PER_BATCH) {
      throw new BatchValidationError(`Maximum ${BATCH_LIMITS.MAX_FILES_PER_BATCH} files per batch`);
    }

    // Validate each file: reject oversized, empty, or non-audio files early
    // before consuming pipeline resources.
    for (const file of request.files) {
      const validation = validateAudioFile(file);
      if (!validation.valid) {
        throw new BatchValidationError(
          `File "${sanitizeFilename(file.name)}" rejected: ${validation.errors.join('; ')}`,
        );
      }
    }

    // Deduplicate files by content hash + size to avoid redundant processing.
    // Content-based hashing catches identical files with different names and
    // avoids false negatives that name+size alone would miss.
    // Sequential processing avoids race conditions on shared mutable state
    // (seen, dedupedFiles, skippedFiles) that the previous Promise.all +
    // IIFE pattern created.
    const seen = new Map<string, number>();
    const dedupedFiles: File[] = [];
    const skippedFiles: string[] = [];

    for (const file of request.files) {
      const hash = await computeFileHash(file);
      const dedupKey = `${hash}::${file.size}`;
      if (seen.has(dedupKey)) {
        skippedFiles.push(sanitizeFilename(file.name));
        continue;
      }
      seen.set(dedupKey, dedupedFiles.length);
      dedupedFiles.push(file);
    }

    if (dedupedFiles.length === 0) {
      throw new BatchValidationError('All files were duplicates — no unique files to process');
    }

    const dedupedRequest = skippedFiles.length > 0
      ? { ...request, files: dedupedFiles }
      : request;

    // Create job — total reflects the original submitted count so progress
    // is meaningful to the caller even when duplicates were skipped.
    const originalTotal = request.files.length;
    const skippedCount = skippedFiles.length;
    const jobId = jobStore.createJob(dedupedRequest.files, originalTotal);

    // Set preset if provided
    if (request.preset) {
      adaptiveQualityPresets.setPreset(request.preset);
    }

    // Start processing in background
    this.processJobAsync(jobId, dedupedRequest, originalTotal, skippedCount).catch((error) => {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Phase 37: Batch job ${jobId} failed: ${errorMsg}`);
      jobStore.updateJobStatus(jobId, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        errorMessage: errorMsg,
      });
      pipelineMetricsCollector.recordBatchJobTransition('failed');
    });

    const result: { jobId: string; skippedFiles?: string[] } = { jobId };
    if (skippedFiles.length > 0) {
      result.skippedFiles = skippedFiles;
      logger.info(`Phase 37: Job ${jobId} skipped ${skippedFiles.length} duplicate file(s): ${skippedFiles.join(', ')}`);
    }
    return result;
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): BatchJobStatus {
    const status = jobStore.getJobStatus(jobId);
    if (!status) {
      throw new JobNotFoundError(jobId);
    }
    return status;
  }

  /**
   * Get job result
   */
  getJobResult(jobId: string): BatchJobResult {
    const result = jobStore.getJobResult(jobId);
    if (!result) {
      const status = jobStore.getJobStatus(jobId);
      if (!status) {
        throw new JobNotFoundError(jobId);
      }
      if (status.status !== 'completed') {
        throw new BatchValidationError(`Job not completed: ${jobId} (status: ${status.status})`);
      }
      throw new BatchValidationError(`Result not available for job: ${jobId}`);
    }
    return result;
  }

  /**
   * Cancel job
   */
  cancelJob(jobId: string): { success: boolean; message: string } {
    const success = jobStore.cancelJob(jobId);
    if (success) {
      pipelineMetricsCollector.recordBatchJobTransition('cancelled');
    }
    return {
      success,
      message: success
        ? `Job ${jobId} cancelled successfully`
        : `Job ${jobId} cannot be cancelled (not processing or not found)`,
    };
  }

  /**
   * List all jobs
   */
  listJobs(): BatchJobStatus[] {
    return jobStore.getAllJobs();
  }

  /**
   * Process job asynchronously
   */
  private async processJobAsync(
    jobId: string,
    request: BatchJobRequest,
    originalTotal: number,
    skippedCount: number,
  ): Promise<void> {
    const startTime = Date.now();
    const results: BatchJobResult['results'] = [];
    const cancelToken = jobStore.getCancelToken(jobId);

    if (!cancelToken) {
      throw new JobNotFoundError(jobId);
    }

    // Update status to processing
    jobStore.updateJobStatus(jobId, {
      status: 'processing',
      startedAt: new Date().toISOString(),
    });
    pipelineMetricsCollector.recordBatchJobTransition('running');

    // Process files with parallel concurrency control
    // Files are processed concurrently up to MAX_CONCURRENT_JOBS workers,
    // preserving original file order in results.
    const completedCount = { value: 0 };
    const failedCount = { value: 0 };
    const fileSlots = new Array<BatchJobResult['results'][number] | null>(
      request.files.length,
    ).fill(null);

    await this.processFilesWithConcurrency(
      jobId,
      request.files,
      request,
      cancelToken,
      fileSlots,
      completedCount,
      failedCount,
      () => {
        // Progress callback after each file completes
        const done = skippedCount + completedCount.value + failedCount.value;
        jobStore.updateJobStatus(jobId, {
          currentFile: sanitizeFilename(request.files[Math.min(done - skippedCount, request.files.length - 1)]?.name ?? ''),
          progress: {
            total: originalTotal,
            completed: skippedCount + completedCount.value,
            failed: failedCount.value,
            percentage: originalTotal > 0 ? Math.round((done / originalTotal) * 100) : 0,
          },
          estimatedTimeRemaining: this.estimateTimeRemaining(
            startTime,
            done,
            originalTotal,
          ),
        });
      },
    );

    // Collect results in original file order
    for (const slot of fileSlots) {
      if (slot) results.push(slot);
    }

    const totalProcessingTime = Date.now() - startTime;
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    // Calculate quality scores — prefer the qualityScore the pipeline already
    // computed and surfaced on its result (canonical value). Only fall back to
    // re-deriving when it is absent (older results / mocks). The previous
    // unconditional recompute was a divergent copy of SimplePipeline's formula
    // (falsy-guarded on processingTime), so the batch summary could silently
    // disagree with the pipeline's own recorded metric. (REQ-299)
    const qualityScores = results
      .filter((r) => r.success && r.result)
      .map((r) => r.result!.qualityScore ?? this.calculateQualityScore(r.result!));
    const totalQualityScore = qualityScores.reduce((sum, score) => sum + score, 0);
    const averageQualityScore = qualityScores.length > 0 ? totalQualityScore / qualityScores.length : 0;

    // Create final result
    const jobResult: BatchJobResult = {
      jobId,
      status: cancelToken.cancelled ? 'partial' : successCount > 0 ? 'completed' : 'failed',
      results,
      summary: {
        totalFiles: request.files.length,
        successCount,
        failureCount,
        totalProcessingTime,
        averageProcessingTime: request.files.length > 0 ? totalProcessingTime / request.files.length : 0,
        totalQualityScore,
        averageQualityScore,
      },
      createdAt: jobStore.getJobStatus(jobId)?.startedAt || new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    // Store result
    jobStore.setJobResult(jobId, jobResult);

    // Update final status
    const finalStatus = cancelToken.cancelled ? 'cancelled' : 'completed';
    jobStore.updateJobStatus(jobId, {
      status: finalStatus,
      completedAt: new Date().toISOString(),
      progress: {
        total: originalTotal,
        completed: skippedCount + successCount,
        failed: failureCount,
        percentage: 100,
      },
    });
    pipelineMetricsCollector.recordBatchJobTransition(finalStatus);
  }

  /**
   * Process files concurrently with bounded parallelism.
   *
   * Uses a worker-pool pattern: up to MAX_CONCURRENT_JOBS files are processed
   * in parallel. As each file finishes, the next queued file is picked up.
   * Results are stored in `slots` at the original file index to preserve order.
   */
  private async processFilesWithConcurrency(
    jobId: string,
    files: File[],
    request: BatchJobRequest,
    cancelToken: { cancelled: boolean },
    slots: Array<BatchJobResult['results'][number] | null>,
    completedCount: { value: number },
    failedCount: { value: number },
    onFileDone: () => void,
  ): Promise<void> {
    const maxConcurrency = BATCH_LIMITS.MAX_CONCURRENT_JOBS;
    let nextIndex = 0;

    const processFile = async (fileIndex: number): Promise<void> => {
      const file = files[fileIndex];
      const fileStartTime = Date.now();

      jobStore.updateJobStatus(jobId, { currentFile: sanitizeFilename(file.name) });

      try {
        const pipelineInput = adaptiveQualityPresets.toPipelineOptions(file);

        if (request.options?.generateVideo !== undefined) {
          pipelineInput.options!.includeVideoGeneration = request.options.generateVideo;
        }

        const result = await simplePipeline.process(pipelineInput);

        slots[fileIndex] = {
          filename: sanitizeFilename(file.name),
          success: result.success,
          result,
          processingTime: Date.now() - fileStartTime,
        };

        if (result.success) {
          completedCount.value++;
        } else {
          failedCount.value++;
        }
      } catch (error) {
        logger.error(`File ${fileIndex + 1}/${files.length} (${sanitizeFilename(file.name)}) failed:`, error);
        slots[fileIndex] = {
          filename: sanitizeFilename(file.name),
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          processingTime: Date.now() - fileStartTime,
        };
        failedCount.value++;
      }

      onFileDone();
    };

    // Worker function: keeps picking up the next file index until cancelled or exhausted
    const worker = async (): Promise<void> => {
      while (!cancelToken.cancelled) {
        const idx = nextIndex++;
        if (idx >= files.length) break;
        await processFile(idx);
      }
    };

    // Launch up to maxConcurrency workers
    const workerCount = Math.min(maxConcurrency, files.length);
    const workers = Array.from({ length: workerCount }, () => worker());
    await Promise.all(workers);
  }

  /**
   * Wait for a job to reach a terminal state (completed, failed, cancelled).
   * Polls job status at the given interval. Useful for tests.
   */
  async waitForJob(
    jobId: string,
    options: { timeoutMs?: number; intervalMs?: number } = {}
  ): Promise<BatchJobStatus> {
    const { timeoutMs = 10_000, intervalMs = 50 } = options;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const status = jobStore.getJobStatus(jobId);
      if (!status) throw new JobNotFoundError(jobId);
      if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
        return status;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new BatchValidationError(`waitForJob timed out after ${timeoutMs}ms for job ${jobId}`);
  }

  /**
   * Estimate time remaining for job
   */
  private estimateTimeRemaining(
    startTime: number,
    completed: number,
    total: number
  ): number {
    if (completed === 0 || total <= 0) return 0;

    const elapsed = Date.now() - startTime;
    const avgTimePerFile = elapsed / completed;
    const remaining = total - completed;

    if (remaining <= 0) return 0;

    return Math.round((avgTimePerFile * remaining) / 1000); // Convert to seconds
  }

  /**
   * Calculate quality score from pipeline result
   */
  private calculateQualityScore(result: SimplePipelineResult): number {
    let score = 0;

    // Transcript quality (30%)
    if (result.transcript && result.transcript.length > 0) {
      score += Math.min(result.transcript.length / 100, 1) * 30;
    }

    // Scene detection quality (30%)
    if (result.scenes && result.scenes.length > 0) {
      const avgConfidence =
        result.scenes.reduce((sum, scene) => sum + (scene.confidence || 0), 0) /
        result.scenes.length;
      score += avgConfidence * 30;
    }

    // Performance score (20%)
    if (result.processingTime) {
      const performanceScore = Math.max(0, 20 - result.processingTime / 1000);
      score += Math.max(0, performanceScore);
    }

    // Video generation bonus (20%)
    if (result.videoUrl) {
      score += 20;
    }

    return Math.min(score, 100);
  }
}

// Export singleton instance
export const batchProcessingAPI = new BatchProcessingAPI();
