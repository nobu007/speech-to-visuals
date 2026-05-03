/**
 * WorkerPool Integration Tests
 *
 * Tests WorkerPool concurrent behavior, queueing, error recovery,
 * and resource cleanup using mocked workers.
 */

import { WorkerPool } from '@/workers/worker-pool';
import type { WorkerMessage, WorkerResponse } from '@/workers/types';

// --- Mock Worker infrastructure ---

function createMockWorkerPool() {
  const workers: Array<{
    instance: {
      postMessage: jest.Mock;
      terminate: jest.Mock;
      addEventListener: jest.Mock;
      removeEventListener: jest.Mock;
    };
    listeners: Record<string, Array<(e: { data?: unknown; message?: string }) => void>>;
  }> = [];

  const factory = jest.fn(() => {
    const listeners: Record<string, Array<(e: { data?: unknown; message?: string }) => void>> = {};

    const instance = {
      postMessage: jest.fn(),
      terminate: jest.fn(),
      addEventListener: jest.fn((event: string, handler: (e: unknown) => void) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(handler as (e: { data?: unknown; message?: string }) => void);
      }),
      removeEventListener: jest.fn((event: string, handler: (e: unknown) => void) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((h) => h !== handler);
        }
      }),
    };

    workers.push({ instance, listeners });
    return instance;
  });

  const dispatchToLastWorker = (data: WorkerResponse) => {
    const lastWorker = workers[workers.length - 1];
    if (!lastWorker) return;
    const handlers = lastWorker.listeners['message'] || [];
    for (const h of handlers) {
      h({ data });
    }
  };

  const dispatchErrorToLastWorker = (message: string) => {
    const lastWorker = workers[workers.length - 1];
    if (!lastWorker) return;
    const handlers = lastWorker.listeners['error'] || [];
    for (const h of handlers) {
      h({ message });
    }
  };

  return { factory, workers, dispatchToLastWorker, dispatchErrorToLastWorker };
}

describe('WorkerPool integration', () => {
  describe('concurrent execution', () => {
    it('should execute multiple tasks concurrently up to maxWorkers', async () => {
      const mock = createMockWorkerPool();
      const pool = new WorkerPool(mock.factory, 2);

      const msg1: WorkerMessage = { id: '1', type: 'EXPORT_RENDER', payload: null };
      const msg2: WorkerMessage = { id: '2', type: 'EXPORT_RENDER', payload: null };

      const p1 = pool.execute(msg1);
      const p2 = pool.execute(msg2);

      expect(mock.factory).toHaveBeenCalledTimes(2);
      expect(pool.activeCount).toBe(2);

      // Complete both
      mock.dispatchToLastWorker({ id: '2', type: 'EXPORT_RENDER', payload: { done: true } });
      // First worker
      const firstWorker = mock.workers[0];
      const handlers = firstWorker.listeners['message'] || [];
      for (const h of handlers) {
        h({ data: { id: '1', type: 'EXPORT_RENDER', payload: { done: true } } });
      }

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1.payload).toEqual({ done: true });
      expect(r2.payload).toEqual({ done: true });

      pool.terminate();
    });

    it('should queue excess tasks and dispatch when workers become idle', async () => {
      const mock = createMockWorkerPool();
      const pool = new WorkerPool(mock.factory, 1);

      const msg1: WorkerMessage = { id: '1', type: 'EXPORT_RENDER', payload: null };
      const msg2: WorkerMessage = { id: '2', type: 'LAYOUT_COMPUTE', payload: null };

      const p1 = pool.execute(msg1);
      pool.execute(msg2);

      expect(pool.queueSize).toBe(1);

      // Complete first task
      mock.dispatchToLastWorker({ id: '1', type: 'EXPORT_RENDER', payload: null });

      const r1 = await p1;
      expect(r1.id).toBe('1');

      // After flush, queue should be processed
      await Promise.resolve();
      expect(pool.queueSize).toBe(0);

      pool.terminate();
    });
  });

  describe('error recovery', () => {
    it('should handle worker error and continue processing', async () => {
      const mock = createMockWorkerPool();
      const pool = new WorkerPool(mock.factory, 2);

      const msg: WorkerMessage = { id: 'err-1', type: 'EXPORT_RENDER', payload: null };
      const promise = pool.execute(msg);

      mock.dispatchErrorToLastWorker('Worker crashed');

      await expect(promise).rejects.toThrow('Worker crashed');

      // Pool should still be functional
      expect(pool.isTerminated).toBe(false);

      pool.terminate();
    });

    it('should reject all queued tasks on terminate', async () => {
      const mock = createMockWorkerPool();
      const pool = new WorkerPool(mock.factory, 1);

      pool.execute({ id: '1', type: 'EXPORT_RENDER', payload: null });
      const p2 = pool.execute({ id: '2', type: 'EXPORT_RENDER', payload: null });
      const p3 = pool.execute({ id: '3', type: 'EXPORT_RENDER', payload: null });

      pool.terminate();

      await expect(p2).rejects.toThrow('WorkerPool terminated');
      await expect(p3).rejects.toThrow('WorkerPool terminated');
    });
  });

  describe('resource cleanup', () => {
    it('should terminate all workers on pool termination', () => {
      const mock = createMockWorkerPool();
      const pool = new WorkerPool(mock.factory, 3);

      pool.execute({ id: '1', type: 'EXPORT_RENDER', payload: null });
      pool.execute({ id: '2', type: 'EXPORT_RENDER', payload: null });

      pool.terminate();

      for (const w of mock.workers) {
        expect(w.instance.terminate).toHaveBeenCalled();
      }
      expect(pool.activeCount).toBe(0);
      expect(pool.idleCount).toBe(0);
    });
  });
});
