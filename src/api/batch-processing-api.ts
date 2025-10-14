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
class JobStore {
  private jobs = new Map<string, {
    status: BatchJobStatus;
    result?: BatchJobResult;
    cancelToken: { cancelled: boolean };
  }>();

  createJob(files: File[]): string {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.jobs.set(jobId, {
      status: {
        jobId,
        status: 'queued',
        progress: {
          total: files.length,
          completed: 0,
          failed: 0,
          percentage: 0,
        },
      },
      cancelToken: { cancelled: false },
    });
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
 * Batch Processing API Controller
 */
export class BatchProcessingAPI {
  /**
   * Submit batch processing job
   */
  async submitJob(request: BatchJobRequest): Promise<{ jobId: string }> {
    console.log(`📦 Phase 37: Submitting batch job with ${request.files.length} files`);

    // Validate request
    if (!request.files || request.files.length === 0) {
      throw new Error('No files provided');
    }

    if (request.files.length > 100) {
      throw new Error('Maximum 100 files per batch');
    }

    // Create job
    const jobId = jobStore.createJob(request.files);

    // Set preset if provided
    if (request.preset) {
      adaptiveQualityPresets.setPreset(request.preset);
    }

    // Start processing in background
    this.processJobAsync(jobId, request).catch((error) => {
      console.error(`❌ Phase 37: Batch job ${jobId} failed:`, error);
      jobStore.updateJobStatus(jobId, {
        status: 'failed',
        completedAt: new Date().toISOString(),
      });
    });

    return { jobId };
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): BatchJobStatus {
    const status = jobStore.getJobStatus(jobId);
    if (!status) {
      throw new Error(`Job not found: ${jobId}`);
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
        throw new Error(`Job not found: ${jobId}`);
      }
      if (status.status !== 'completed') {
        throw new Error(`Job not completed: ${jobId} (status: ${status.status})`);
      }
      throw new Error(`Result not available for job: ${jobId}`);
    }
    return result;
  }

  /**
   * Cancel job
   */
  cancelJob(jobId: string): { success: boolean; message: string } {
    const success = jobStore.cancelJob(jobId);
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
    request: BatchJobRequest
  ): Promise<void> {
    const startTime = Date.now();
    const results: BatchJobResult['results'] = [];
    const cancelToken = jobStore.getCancelToken(jobId);

    if (!cancelToken) {
      throw new Error(`Cancel token not found for job: ${jobId}`);
    }

    // Update status to processing
    jobStore.updateJobStatus(jobId, {
      status: 'processing',
      startedAt: new Date().toISOString(),
    });

    console.log(`🚀 Phase 37: Processing batch job ${jobId} (${request.files.length} files)`);

    // Process files sequentially (for Phase 37 MVP)
    // For production, implement parallel processing with concurrency control
    for (let i = 0; i < request.files.length; i++) {
      // Check for cancellation
      if (cancelToken.cancelled) {
        console.log(`⚠️  Phase 37: Job ${jobId} cancelled`);
        break;
      }

      const file = request.files[i];
      const fileStartTime = Date.now();

      console.log(`   📄 Processing file ${i + 1}/${request.files.length}: ${file.name}`);

      // Update progress
      jobStore.updateJobStatus(jobId, {
        currentFile: file.name,
        progress: {
          total: request.files.length,
          completed: i,
          failed: results.filter((r) => !r.success).length,
          percentage: Math.round((i / request.files.length) * 100),
        },
        estimatedTimeRemaining: this.estimateTimeRemaining(
          startTime,
          i,
          request.files.length
        ),
      });

      try {
        // Convert preset to pipeline options
        const pipelineInput = adaptiveQualityPresets.toPipelineOptions(file);

        // Override video generation based on request
        if (request.options?.generateVideo !== undefined) {
          pipelineInput.options!.includeVideoGeneration = request.options.generateVideo;
        }

        // Process file
        const result = await simplePipeline.process(pipelineInput);

        results.push({
          filename: file.name,
          success: result.success,
          result,
          processingTime: Date.now() - fileStartTime,
        });

        console.log(`   ✅ File ${i + 1}/${request.files.length} completed (${result.success ? 'success' : 'failed'})`);
      } catch (error) {
        console.error(`   ❌ File ${i + 1}/${request.files.length} failed:`, error);

        results.push({
          filename: file.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          processingTime: Date.now() - fileStartTime,
        });
      }
    }

    const totalProcessingTime = Date.now() - startTime;
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    // Calculate quality scores
    const qualityScores = results
      .filter((r) => r.success && r.result)
      .map((r) => this.calculateQualityScore(r.result!));
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
        averageProcessingTime: totalProcessingTime / request.files.length,
        totalQualityScore,
        averageQualityScore,
      },
      createdAt: jobStore.getJobStatus(jobId)?.startedAt || new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    // Store result
    jobStore.setJobResult(jobId, jobResult);

    // Update final status
    jobStore.updateJobStatus(jobId, {
      status: cancelToken.cancelled ? 'cancelled' : 'completed',
      completedAt: new Date().toISOString(),
      progress: {
        total: request.files.length,
        completed: successCount,
        failed: failureCount,
        percentage: 100,
      },
    });

    console.log(`✅ Phase 37: Batch job ${jobId} completed`);
    console.log(`   Success: ${successCount}/${request.files.length}`);
    console.log(`   Total time: ${(totalProcessingTime / 1000).toFixed(1)}s`);
    console.log(`   Average quality: ${averageQualityScore.toFixed(1)}/100`);
  }

  /**
   * Estimate time remaining for job
   */
  private estimateTimeRemaining(
    startTime: number,
    completed: number,
    total: number
  ): number {
    if (completed === 0) return 0;

    const elapsed = Date.now() - startTime;
    const avgTimePerFile = elapsed / completed;
    const remaining = total - completed;

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

// Export types for API consumers
export type {
  BatchJobRequest,
  BatchJobStatus,
  BatchJobResult,
};
