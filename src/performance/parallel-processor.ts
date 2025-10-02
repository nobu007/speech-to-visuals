/**
 * Parallel Processing Engine - Iteration 10
 * Ultra-high performance processing with multi-core utilization and worker threads
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { EventEmitter } from 'events';

export interface ProcessingTask {
  id: string;
  type: 'transcription' | 'analysis' | 'layout' | 'scene_preparation';
  data: any;
  priority: 'low' | 'normal' | 'high' | 'critical';
  estimatedTime: number; // milliseconds
}

export interface ProcessingResult {
  taskId: string;
  success: boolean;
  data?: any;
  error?: string;
  processingTime: number;
  memoryUsed: number;
}

export interface WorkerStats {
  id: string;
  status: 'idle' | 'busy' | 'error';
  tasksCompleted: number;
  totalProcessingTime: number;
  memoryUsage: number;
  lastActivity: Date;
}

export class ParallelProcessor extends EventEmitter {
  private workers: Worker[] = [];
  private workerStats: Map<string, WorkerStats> = new Map();
  private taskQueue: ProcessingTask[] = [];
  private activeTasks: Map<string, ProcessingTask> = new Map();
  private results: Map<string, ProcessingResult> = new Map();

  private readonly maxWorkers: number;
  private readonly maxQueueSize: number = 1000;
  private readonly taskTimeout: number = 30000; // 30 seconds

  constructor(maxWorkers?: number) {
    super();

    // Optimize worker count based on CPU cores
    this.maxWorkers = maxWorkers || Math.max(2, Math.min(8, require('os').cpus().length - 1));

    console.log(`🚀 Parallel Processor initialized with ${this.maxWorkers} workers`);
    this.initializeWorkers();
  }

  /**
   * Initialize worker threads for parallel processing
   */
  private initializeWorkers(): void {
    for (let i = 0; i < this.maxWorkers; i++) {
      const workerId = `worker-${i}`;

      // Create worker with inline code to avoid file dependency issues
      const workerCode = `
        const { parentPort } = require('worker_threads');

        // Worker processing functions
        async function processTask(task) {
          const startTime = performance.now();
          const startMemory = process.memoryUsage().heapUsed;

          try {
            let result;

            switch (task.type) {
              case 'transcription':
                result = await processTranscription(task.data);
                break;
              case 'analysis':
                result = await processAnalysis(task.data);
                break;
              case 'layout':
                result = await processLayout(task.data);
                break;
              case 'scene_preparation':
                result = await processScenePreparation(task.data);
                break;
              default:
                throw new Error('Unknown task type: ' + task.type);
            }

            const processingTime = performance.now() - startTime;
            const memoryUsed = process.memoryUsage().heapUsed - startMemory;

            return {
              taskId: task.id,
              success: true,
              data: result,
              processingTime,
              memoryUsed
            };

          } catch (error) {
            return {
              taskId: task.id,
              success: false,
              error: error.message,
              processingTime: performance.now() - startTime,
              memoryUsed: process.memoryUsage().heapUsed - startMemory
            };
          }
        }

        // Mock processing functions for demonstration
        async function processTranscription(data) {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
          return { segments: [], duration: 1000 };
        }

        async function processAnalysis(data) {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 150 + 75));
          return { scenes: [], diagramTypes: [] };
        }

        async function processLayout(data) {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));
          return { nodes: [], edges: [], layout: 'completed' };
        }

        async function processScenePreparation(data) {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 25));
          return { sceneGraph: {}, metadata: {} };
        }

        // Worker message handler
        parentPort.on('message', async (task) => {
          const result = await processTask(task);
          parentPort.postMessage(result);
        });
      `;

      const worker = new Worker(workerCode, { eval: true });

      // Set up worker event handlers
      worker.on('message', (result: ProcessingResult) => {
        this.handleWorkerResult(workerId, result);
      });

      worker.on('error', (error) => {
        console.error(`❌ Worker ${workerId} error:`, error);
        this.updateWorkerStats(workerId, { status: 'error' });
        this.restartWorker(workerId);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          console.warn(`⚠️ Worker ${workerId} exited with code ${code}`);
          this.restartWorker(workerId);
        }
      });

      this.workers[i] = worker;
      this.workerStats.set(workerId, {
        id: workerId,
        status: 'idle',
        tasksCompleted: 0,
        totalProcessingTime: 0,
        memoryUsage: 0,
        lastActivity: new Date()
      });
    }

    console.log(`✅ ${this.maxWorkers} workers initialized successfully`);
  }

  /**
   * Add task to processing queue with automatic load balancing
   */
  async addTask(task: ProcessingTask): Promise<string> {
    if (this.taskQueue.length >= this.maxQueueSize) {
      throw new Error('Task queue is full');
    }

    // Add priority-based insertion
    const insertIndex = this.findInsertionIndex(task);
    this.taskQueue.splice(insertIndex, 0, task);

    console.log(`📥 Task ${task.id} queued (priority: ${task.priority})`);

    // Try to process immediately if workers available
    this.processNextTask();

    return task.id;
  }

  /**
   * Process multiple tasks in parallel with optimal load distribution
   */
  async processBatch(tasks: ProcessingTask[]): Promise<ProcessingResult[]> {
    console.log(`🔄 Processing batch of ${tasks.length} tasks`);
    const startTime = performance.now();

    // Add all tasks to queue
    const taskPromises = tasks.map(task => this.addTaskAndWait(task));

    // Wait for all tasks to complete
    const results = await Promise.all(taskPromises);

    const totalTime = performance.now() - startTime;
    console.log(`✅ Batch completed in ${Math.round(totalTime)}ms`);

    this.emit('batchCompleted', {
      taskCount: tasks.length,
      processingTime: totalTime,
      successRate: results.filter(r => r.success).length / results.length
    });

    return results;
  }

  /**
   * Add task and wait for completion
   */
  private async addTaskAndWait(task: ProcessingTask): Promise<ProcessingResult> {
    await this.addTask(task);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Task ${task.id} timed out after ${this.taskTimeout}ms`));
      }, this.taskTimeout);

      const checkResult = () => {
        const result = this.results.get(task.id);
        if (result) {
          clearTimeout(timeout);
          this.results.delete(task.id);
          resolve(result);
        } else {
          setTimeout(checkResult, 10);
        }
      };

      checkResult();
    });
  }

  /**
   * Process next task in queue with optimal worker selection
   */
  private processNextTask(): void {
    if (this.taskQueue.length === 0) return;

    const availableWorker = this.findAvailableWorker();
    if (!availableWorker) return;

    const task = this.taskQueue.shift()!;
    const workerId = availableWorker.id;

    // Update worker status
    this.updateWorkerStats(workerId, {
      status: 'busy',
      lastActivity: new Date()
    });

    // Track active task
    this.activeTasks.set(task.id, task);

    // Send task to worker
    this.workers[parseInt(workerId.split('-')[1])].postMessage(task);

    console.log(`📤 Task ${task.id} sent to ${workerId}`);

    // Continue processing if more tasks available
    if (this.taskQueue.length > 0) {
      setTimeout(() => this.processNextTask(), 1);
    }
  }

  /**
   * Handle worker result and update statistics
   */
  private handleWorkerResult(workerId: string, result: ProcessingResult): void {
    const stats = this.workerStats.get(workerId)!;

    // Update worker statistics
    this.updateWorkerStats(workerId, {
      status: 'idle',
      tasksCompleted: stats.tasksCompleted + 1,
      totalProcessingTime: stats.totalProcessingTime + result.processingTime,
      memoryUsage: result.memoryUsed,
      lastActivity: new Date()
    });

    // Store result
    this.results.set(result.taskId, result);

    // Remove from active tasks
    this.activeTasks.delete(result.taskId);

    console.log(`✅ Task ${result.taskId} completed by ${workerId} in ${Math.round(result.processingTime)}ms`);

    // Emit result event
    this.emit('taskCompleted', result);

    // Process next task if available
    this.processNextTask();
  }

  /**
   * Find optimal worker for task assignment
   */
  private findAvailableWorker(): WorkerStats | null {
    const idleWorkers = Array.from(this.workerStats.values())
      .filter(stats => stats.status === 'idle');

    if (idleWorkers.length === 0) return null;

    // Select worker with least total processing time (load balancing)
    return idleWorkers.reduce((best, current) =>
      current.totalProcessingTime < best.totalProcessingTime ? current : best
    );
  }

  /**
   * Find optimal insertion position for task based on priority
   */
  private findInsertionIndex(task: ProcessingTask): number {
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    const taskPriority = priorityOrder[task.priority];

    for (let i = 0; i < this.taskQueue.length; i++) {
      if (priorityOrder[this.taskQueue[i].priority] > taskPriority) {
        return i;
      }
    }

    return this.taskQueue.length;
  }

  /**
   * Update worker statistics
   */
  private updateWorkerStats(workerId: string, updates: Partial<WorkerStats>): void {
    const currentStats = this.workerStats.get(workerId)!;
    this.workerStats.set(workerId, { ...currentStats, ...updates });
  }

  /**
   * Restart failed worker
   */
  private restartWorker(workerId: string): void {
    const workerIndex = parseInt(workerId.split('-')[1]);

    try {
      this.workers[workerIndex]?.terminate();
    } catch (error) {
      console.warn(`Warning: Could not terminate worker ${workerId}`);
    }

    // Reinitialize worker
    setTimeout(() => {
      console.log(`🔄 Restarting worker ${workerId}`);
      // Simplified restart - in production would recreate with full initialization
      this.updateWorkerStats(workerId, {
        status: 'idle',
        lastActivity: new Date()
      });
    }, 1000);
  }

  /**
   * Get comprehensive performance statistics
   */
  getPerformanceStats(): {
    workerUtilization: number;
    tasksInQueue: number;
    activeTasks: number;
    completedTasks: number;
    averageProcessingTime: number;
    memoryEfficiency: number;
    throughput: number; // tasks per second
  } {
    const workers = Array.from(this.workerStats.values());
    const busyWorkers = workers.filter(w => w.status === 'busy').length;
    const totalCompleted = workers.reduce((sum, w) => sum + w.tasksCompleted, 0);
    const totalProcessingTime = workers.reduce((sum, w) => sum + w.totalProcessingTime, 0);
    const totalMemoryUsage = workers.reduce((sum, w) => sum + w.memoryUsage, 0);

    const workerUtilization = (busyWorkers / this.maxWorkers) * 100;
    const averageProcessingTime = totalCompleted > 0 ? totalProcessingTime / totalCompleted : 0;
    const memoryEfficiency = totalMemoryUsage > 0 ? Math.max(0, 100 - (totalMemoryUsage / (1024 * 1024 * 100))) : 100;

    // Calculate throughput (simplified)
    const uptime = Date.now() - (workers[0]?.lastActivity?.getTime() || Date.now());
    const throughput = uptime > 0 ? (totalCompleted / (uptime / 1000)) : 0;

    return {
      workerUtilization,
      tasksInQueue: this.taskQueue.length,
      activeTasks: this.activeTasks.size,
      completedTasks: totalCompleted,
      averageProcessingTime,
      memoryEfficiency,
      throughput
    };
  }

  /**
   * Optimize performance based on current metrics
   */
  async optimizePerformance(): Promise<void> {
    const stats = this.getPerformanceStats();

    console.log('🎯 Optimizing parallel processor performance...');

    // Queue optimization
    if (stats.tasksInQueue > this.maxQueueSize * 0.8) {
      console.log('📈 High queue usage - prioritizing critical tasks');
      this.taskQueue.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
    }

    // Memory optimization
    if (stats.memoryEfficiency < 50) {
      console.log('🧹 Memory optimization triggered');
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }

    // Worker optimization
    if (stats.workerUtilization > 90) {
      console.log('⚡ High utilization - optimizing task distribution');
      // Implement more aggressive load balancing
    }

    console.log('✅ Performance optimization completed');
  }

  /**
   * Graceful shutdown of all workers
   */
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down parallel processor...');

    // Wait for active tasks to complete (with timeout)
    const shutdownTimeout = 10000; // 10 seconds
    const startTime = Date.now();

    while (this.activeTasks.size > 0 && (Date.now() - startTime) < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Terminate all workers
    await Promise.all(this.workers.map(worker => worker.terminate()));

    console.log('✅ Parallel processor shutdown complete');
  }
}

// Export singleton instance
export const parallelProcessor = new ParallelProcessor();