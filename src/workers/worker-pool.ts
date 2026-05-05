/**
 * WorkerPool - Generic Web Worker pool manager
 *
 * Manages a pool of Web Workers for parallel processing.
 * Features:
 * - Reuse of idle workers (pool pattern)
 * - Queueing when all workers are busy
 * - Automatic worker recreation on abnormal termination
 * - Clean shutdown via terminate()
 */

import type { WorkerMessage, WorkerResponse } from './types';

interface PendingTask<T = unknown> {
  message: WorkerMessage<T>;
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
}

interface PooledWorker {
  worker: Worker;
  busy: boolean;
  currentMessageId: string | null;
}

/** Maximum times a worker slot is allowed to crash before giving up recreation */
const MAX_WORKER_CRASH_COUNT = 5;

export class WorkerPool {
  private workers: PooledWorker[] = [];
  private taskQueue: PendingTask[] = [];
  private activeTasks: Map<string, PendingTask> = new Map();
  private terminated = false;
  private crashCounts: Map<PooledWorker, number> = new Map();

  /**
   * @param workerFactory - Factory function that creates a new Worker instance
   * @param maxWorkers - Maximum number of concurrent workers (default: navigator.hardwareConcurrency or 4)
   */
  constructor(
    private workerFactory: () => Worker,
    private maxWorkers: number = typeof navigator !== 'undefined'
      ? navigator.hardwareConcurrency || 4
      : 4,
  ) {}

  /**
   * Execute a message on an available worker.
   * If all workers are busy, the task is queued.
   */
  execute<T = unknown>(message: WorkerMessage<T>): Promise<WorkerResponse> {
    if (this.terminated) {
      return Promise.resolve({
        id: message.id,
        type: message.type,
        error: { code: 'POOL_TERMINATED', message: 'WorkerPool has been terminated' },
      });
    }

    return new Promise<WorkerResponse>((resolve, reject) => {
      const task: PendingTask<T> = { message, resolve, reject };

      const idleWorker = this.workers.find((w) => !w.busy);
      if (idleWorker) {
        this.dispatchTask(idleWorker, task);
      } else if (this.workers.length < this.maxWorkers) {
        const pooledWorker = this.createWorker();
        this.dispatchTask(pooledWorker, task);
      } else {
        this.taskQueue.push(task);
      }
    });
  }

  /**
   * Terminate all workers and reject both active and queued task promises.
   * Ensures no caller promise hangs forever.
   */
  terminate(): void {
    this.terminated = true;

    // Reject promises for tasks currently executing on workers
    for (const task of this.activeTasks.values()) {
      task.reject(new Error('WorkerPool terminated'));
    }
    this.activeTasks.clear();

    for (const pooled of this.workers) {
      pooled.worker.terminate();
    }
    this.workers = [];
    this.crashCounts.clear();

    for (const task of this.taskQueue) {
      task.reject(new Error('WorkerPool terminated'));
    }
    this.taskQueue = [];
  }

  /** Current number of active workers */
  get activeCount(): number {
    return this.workers.filter((w) => w.busy).length;
  }

  /** Current number of idle workers */
  get idleCount(): number {
    return this.workers.filter((w) => !w.busy).length;
  }

  /** Number of queued tasks waiting for a worker */
  get queueSize(): number {
    return this.taskQueue.length;
  }

  /** Whether the pool has been terminated */
  get isTerminated(): boolean {
    return this.terminated;
  }

  private createWorker(): PooledWorker {
    const worker = this.workerFactory();
    const pooled: PooledWorker = {
      worker,
      busy: false,
      currentMessageId: null,
    };

    worker.addEventListener('error', (event: ErrorEvent) => {
      const hadActiveTask = !!pooled.currentMessageId;
      if (hadActiveTask) {
        void event;
        // A task was active when the crash happened. The per-task error
        // listener added by dispatchTask will reject the promise and call
        // processQueue.  We only need to clear the id here so the
        // per-task handler's busy/currentMessageId writes land on a
        // no-longer-tracked object (harmless), while the replacement
        // worker below picks up any remaining queued tasks.
        pooled.busy = false;
        pooled.currentMessageId = null;
      }

      // Attempt to recreate the worker if pool is not terminated
      if (!this.terminated) {
        const index = this.workers.indexOf(pooled);
        if (index !== -1) {
          const crashes = (this.crashCounts.get(pooled) || 0) + 1;
          pooled.worker.terminate();
          this.crashCounts.delete(pooled);

          if (crashes > MAX_WORKER_CRASH_COUNT) {
            // Too many crashes — remove the slot and stop recreating
            this.workers.splice(index, 1);
            console.warn(`Worker slot removed after ${crashes} crashes`);
          } else {
            const newPooled = this.createWorker();
            this.workers[index] = newPooled;
            this.crashCounts.set(newPooled, crashes);
          }

          // If the worker crashed while idle (no active task), we need
          // to processQueue ourselves since there is no per-task handler
          // to do it. When a task was active, the per-task handleError
          // already calls processQueue.
          if (!hadActiveTask) {
            this.processQueue();
          }
        }
      }
    });

    if (!this.workers.includes(pooled)) {
      this.workers.push(pooled);
    }

    return pooled;
  }

  private dispatchTask(pooledWorker: PooledWorker, task: PendingTask): void {
    pooledWorker.busy = true;
    pooledWorker.currentMessageId = task.message.id;
    this.activeTasks.set(task.message.id, task);

    const handleMessage = (event: MessageEvent<WorkerResponse>): void => {
      if (event.data.id !== task.message.id) return;

      pooledWorker.worker.removeEventListener('message', handleMessage);
      pooledWorker.worker.removeEventListener('error', handleError);
      pooledWorker.busy = false;
      pooledWorker.currentMessageId = null;
      this.activeTasks.delete(task.message.id);

      task.resolve(event.data);
      this.processQueue();
    };

    const handleError = (event: ErrorEvent): void => {
      pooledWorker.worker.removeEventListener('message', handleMessage);
      pooledWorker.worker.removeEventListener('error', handleError);
      pooledWorker.busy = false;
      pooledWorker.currentMessageId = null;
      this.activeTasks.delete(task.message.id);

      task.reject(new Error(event.message || 'Worker error'));
      this.processQueue();
    };

    pooledWorker.worker.addEventListener('message', handleMessage);
    pooledWorker.worker.addEventListener('error', handleError);
    pooledWorker.worker.postMessage(task.message);
  }

  private processQueue(): void {
    while (this.taskQueue.length > 0) {
      const idleWorker = this.workers.find((w) => !w.busy);
      if (!idleWorker) break;

      const task = this.taskQueue.shift();
      if (task) {
        this.dispatchTask(idleWorker, task);
      }
    }
  }
}
