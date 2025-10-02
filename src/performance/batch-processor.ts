/**
 * Batch Processing Engine - Iteration 10
 * High-throughput batch processing with queue management and resource pooling
 */

import { EventEmitter } from 'events';
import { parallelProcessor, ProcessingTask, ProcessingResult } from './parallel-processor';
import { memoryOptimizer } from './memory-optimizer';

export interface BatchJob {
  id: string;
  name: string;
  files: File[];
  priority: 'low' | 'normal' | 'high' | 'critical';
  config: BatchProcessingConfig;
  createdAt: Date;
  estimatedDuration?: number;
}

export interface BatchProcessingConfig {
  maxConcurrentFiles: number;
  chunkSize: number;
  retryAttempts: number;
  enableMemoryOptimization: boolean;
  outputFormat: 'json' | 'video' | 'both';
  qualitySettings: 'fast' | 'balanced' | 'high';
}

export interface BatchResult {
  jobId: string;
  success: boolean;
  filesProcessed: number;
  totalFiles: number;
  processingTime: number;
  results: ProcessingResult[];
  errors: string[];
  memoryStats: any;
}

export interface QueueStats {
  totalJobs: number;
  pendingJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  throughput: number; // jobs per hour
}

export class BatchProcessor extends EventEmitter {
  private jobQueue: BatchJob[] = [];
  private activeJobs: Map<string, BatchJob> = new Map();
  private completedJobs: Map<string, BatchResult> = new Map();
  private failedJobs: Map<string, BatchResult> = new Map();

  private readonly maxConcurrentJobs: number = 3;
  private readonly maxQueueSize: number = 100;
  private readonly defaultConfig: BatchProcessingConfig = {
    maxConcurrentFiles: 5,
    chunkSize: 10,
    retryAttempts: 2,
    enableMemoryOptimization: true,
    outputFormat: 'both',
    qualitySettings: 'balanced'
  };

  private isProcessing: boolean = false;
  private stats: QueueStats = {
    totalJobs: 0,
    pendingJobs: 0,
    activeJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    averageProcessingTime: 0,
    throughput: 0
  };

  constructor() {
    super();
    console.log('🔄 Batch Processor initialized');
    this.startQueueProcessor();
  }

  /**
   * Submit batch job for processing
   */
  async submitBatch(
    name: string,
    files: File[],
    config: Partial<BatchProcessingConfig> = {},
    priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'
  ): Promise<string> {
    if (this.jobQueue.length >= this.maxQueueSize) {
      throw new Error('Batch queue is full. Please try again later.');
    }

    if (files.length === 0) {
      throw new Error('No files provided for batch processing');
    }

    const jobId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const job: BatchJob = {
      id: jobId,
      name,
      files,
      priority,
      config: { ...this.defaultConfig, ...config },
      createdAt: new Date(),
      estimatedDuration: this.estimateProcessingTime(files, config)
    };

    // Insert job based on priority
    const insertIndex = this.findInsertionIndex(job);
    this.jobQueue.splice(insertIndex, 0, job);

    this.stats.totalJobs++;
    this.stats.pendingJobs++;

    console.log(`📥 Batch job ${jobId} submitted: ${files.length} files (priority: ${priority})`);

    this.emit('jobSubmitted', {
      jobId,
      fileCount: files.length,
      estimatedDuration: job.estimatedDuration,
      queuePosition: insertIndex + 1
    });

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return jobId;
  }

  /**
   * Get status of specific batch job
   */
  getJobStatus(jobId: string): {
    status: 'queued' | 'processing' | 'completed' | 'failed';
    progress?: number;
    result?: BatchResult;
    queuePosition?: number;
  } {
    // Check completed jobs
    if (this.completedJobs.has(jobId)) {
      return {
        status: 'completed',
        progress: 100,
        result: this.completedJobs.get(jobId)
      };
    }

    // Check failed jobs
    if (this.failedJobs.has(jobId)) {
      return {
        status: 'failed',
        progress: 0,
        result: this.failedJobs.get(jobId)
      };
    }

    // Check active jobs
    if (this.activeJobs.has(jobId)) {
      return {
        status: 'processing',
        progress: 50 // Simplified progress
      };
    }

    // Check queue
    const queueIndex = this.jobQueue.findIndex(job => job.id === jobId);
    if (queueIndex >= 0) {
      return {
        status: 'queued',
        progress: 0,
        queuePosition: queueIndex + 1
      };
    }

    throw new Error(`Job ${jobId} not found`);
  }

  /**
   * Cancel batch job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    // Remove from queue
    const queueIndex = this.jobQueue.findIndex(job => job.id === jobId);
    if (queueIndex >= 0) {
      this.jobQueue.splice(queueIndex, 1);
      this.stats.pendingJobs--;
      console.log(`❌ Job ${jobId} cancelled (was in queue)`);
      return true;
    }

    // Cannot cancel active jobs (they need to complete)
    if (this.activeJobs.has(jobId)) {
      console.log(`⚠️ Cannot cancel active job ${jobId} - it will complete normally`);
      return false;
    }

    console.log(`❓ Job ${jobId} not found or already completed`);
    return false;
  }

  /**
   * Process multiple files concurrently within a batch
   */
  private async processBatchJob(job: BatchJob): Promise<BatchResult> {
    console.log(`🚀 Starting batch job ${job.id}: ${job.files.length} files`);

    const startTime = performance.now();
    const results: ProcessingResult[] = [];
    const errors: string[] = [];

    let memoryStats: any = {};

    try {
      // Memory optimization setup
      if (job.config.enableMemoryOptimization) {
        await memoryOptimizer.performMemoryOptimization();
      }

      // Process files in chunks to manage memory and resources
      const chunks = this.chunkArray(job.files, job.config.chunkSize);
      let processedFiles = 0;

      for (const chunk of chunks) {
        console.log(`📦 Processing chunk: ${chunk.length} files`);

        // Create tasks for parallel processing
        const tasks: ProcessingTask[] = chunk.map((file, index) => ({
          id: `${job.id}-file-${processedFiles + index}`,
          type: 'transcription', // Start with transcription
          data: { audioFile: file, config: job.config },
          priority: job.priority,
          estimatedTime: this.estimateFileProcessingTime(file)
        }));

        // Process chunk in parallel
        const chunkResults = await parallelProcessor.processBatch(tasks);
        results.push(...chunkResults);

        processedFiles += chunk.length;

        // Progress reporting
        const progress = (processedFiles / job.files.length) * 100;
        this.emit('jobProgress', {
          jobId: job.id,
          progress,
          filesProcessed: processedFiles,
          totalFiles: job.files.length
        });

        // Memory management between chunks
        if (job.config.enableMemoryOptimization && chunks.indexOf(chunk) % 3 === 0) {
          await memoryOptimizer.performMemoryOptimization();
        }
      }

      // Final memory stats
      if (job.config.enableMemoryOptimization) {
        memoryStats = memoryOptimizer.getMemoryStats();
      }

      const processingTime = performance.now() - startTime;
      const successCount = results.filter(r => r.success).length;

      console.log(`✅ Batch job ${job.id} completed: ${successCount}/${job.files.length} files successful`);

      return {
        jobId: job.id,
        success: successCount === job.files.length,
        filesProcessed: processedFiles,
        totalFiles: job.files.length,
        processingTime,
        results,
        errors,
        memoryStats
      };

    } catch (error) {
      const processingTime = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown batch processing error';

      console.error(`❌ Batch job ${job.id} failed:`, errorMessage);

      return {
        jobId: job.id,
        success: false,
        filesProcessed: results.length,
        totalFiles: job.files.length,
        processingTime,
        results,
        errors: [errorMessage],
        memoryStats
      };
    }
  }

  /**
   * Main queue processing loop
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;
    console.log('🔄 Starting batch queue processing');

    while (this.jobQueue.length > 0 && this.activeJobs.size < this.maxConcurrentJobs) {
      const job = this.jobQueue.shift()!;

      this.activeJobs.set(job.id, job);
      this.stats.pendingJobs--;
      this.stats.activeJobs++;

      console.log(`⚡ Starting job ${job.id} (${this.activeJobs.size}/${this.maxConcurrentJobs} active)`);

      // Process job asynchronously
      this.processBatchJob(job)
        .then(result => this.handleJobCompletion(job, result))
        .catch(error => this.handleJobError(job, error));
    }

    // Check if processing should continue
    setTimeout(() => {
      if (this.jobQueue.length > 0 && this.activeJobs.size < this.maxConcurrentJobs) {
        this.processQueue();
      } else if (this.activeJobs.size === 0) {
        this.isProcessing = false;
        console.log('🏁 Batch queue processing completed');
      }
    }, 1000);
  }

  /**
   * Handle job completion
   */
  private handleJobCompletion(job: BatchJob, result: BatchResult): void {
    this.activeJobs.delete(job.id);
    this.stats.activeJobs--;

    if (result.success) {
      this.completedJobs.set(job.id, result);
      this.stats.completedJobs++;
      console.log(`✅ Job ${job.id} completed successfully`);
    } else {
      this.failedJobs.set(job.id, result);
      this.stats.failedJobs++;
      console.log(`❌ Job ${job.id} failed`);
    }

    // Update average processing time
    this.updateAverageProcessingTime(result.processingTime);

    // Emit completion event
    this.emit('jobCompleted', result);

    // Continue processing queue
    if (this.jobQueue.length > 0) {
      this.processQueue();
    }
  }

  /**
   * Handle job error
   */
  private handleJobError(job: BatchJob, error: any): void {
    const errorResult: BatchResult = {
      jobId: job.id,
      success: false,
      filesProcessed: 0,
      totalFiles: job.files.length,
      processingTime: 0,
      results: [],
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      memoryStats: {}
    };

    this.handleJobCompletion(job, errorResult);
  }

  /**
   * Utility functions
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private findInsertionIndex(job: BatchJob): number {
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    const jobPriority = priorityOrder[job.priority];

    for (let i = 0; i < this.jobQueue.length; i++) {
      if (priorityOrder[this.jobQueue[i].priority] > jobPriority) {
        return i;
      }
    }

    return this.jobQueue.length;
  }

  private estimateProcessingTime(files: File[], config: Partial<BatchProcessingConfig>): number {
    const avgTimePerFile = 5000; // 5 seconds per file (base estimate)
    const qualityMultiplier = config.qualitySettings === 'high' ? 2 : config.qualitySettings === 'fast' ? 0.5 : 1;
    const concurrency = config.maxConcurrentFiles || this.defaultConfig.maxConcurrentFiles;

    return (files.length * avgTimePerFile * qualityMultiplier) / concurrency;
  }

  private estimateFileProcessingTime(file: File): number {
    // Estimate based on file size
    const sizeInMB = file.size / (1024 * 1024);
    return Math.max(1000, sizeInMB * 2000); // 2 seconds per MB, minimum 1 second
  }

  private updateAverageProcessingTime(newTime: number): void {
    const totalCompleted = this.stats.completedJobs + this.stats.failedJobs;
    if (totalCompleted === 1) {
      this.stats.averageProcessingTime = newTime;
    } else {
      this.stats.averageProcessingTime = (
        (this.stats.averageProcessingTime * (totalCompleted - 1) + newTime) / totalCompleted
      );
    }

    // Update throughput (jobs per hour)
    this.stats.throughput = totalCompleted > 0 ? (3600000 / this.stats.averageProcessingTime) : 0;
  }

  /**
   * Get comprehensive batch processing statistics
   */
  getBatchStats(): QueueStats & {
    memoryEfficiency: number;
    parallelUtilization: number;
    queueHealth: 'excellent' | 'good' | 'fair' | 'poor';
    recommendations: string[];
  } {
    const parallelStats = parallelProcessor.getPerformanceStats();
    const memoryStats = memoryOptimizer.getMemoryStats();

    // Calculate queue health
    let queueHealth: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
    const queueUtilization = this.stats.pendingJobs / this.maxQueueSize;

    if (queueUtilization > 0.8) queueHealth = 'poor';
    else if (queueUtilization > 0.6) queueHealth = 'fair';
    else if (queueUtilization > 0.3) queueHealth = 'good';

    // Generate recommendations
    const recommendations: string[] = [];

    if (queueHealth === 'poor') {
      recommendations.push('Queue near capacity - consider increasing worker count');
    }

    if (parallelStats.workerUtilization < 50) {
      recommendations.push('Low worker utilization - consider reducing chunk size');
    }

    if (memoryStats.efficiency < 60) {
      recommendations.push('Enable memory optimization for large batches');
    }

    return {
      ...this.stats,
      memoryEfficiency: memoryStats.efficiency,
      parallelUtilization: parallelStats.workerUtilization,
      queueHealth,
      recommendations
    };
  }

  /**
   * Clean up completed and failed jobs
   */
  cleanupOldJobs(maxAge: number = 3600000): void { // 1 hour default
    const cutoffTime = Date.now() - maxAge;

    // Clean completed jobs
    for (const [jobId, result] of this.completedJobs.entries()) {
      // Note: we'd need to store completion time to do this properly
      // For now, just keep last 100 completed jobs
      if (this.completedJobs.size > 100) {
        this.completedJobs.delete(jobId);
        break;
      }
    }

    // Clean failed jobs
    for (const [jobId, result] of this.failedJobs.entries()) {
      if (this.failedJobs.size > 50) {
        this.failedJobs.delete(jobId);
        break;
      }
    }

    console.log('🧹 Old batch jobs cleaned up');
  }

  /**
   * Shutdown batch processor
   */
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down batch processor...');

    // Wait for active jobs to complete (with timeout)
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.activeJobs.size > 0 && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(`⏳ Waiting for ${this.activeJobs.size} active jobs to complete...`);
    }

    // Clear queues
    this.jobQueue = [];
    this.activeJobs.clear();

    this.isProcessing = false;

    console.log('✅ Batch processor shutdown complete');
  }
}

// Export singleton instance
export const batchProcessor = new BatchProcessor();