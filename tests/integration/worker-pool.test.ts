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
      const p2 = pool.execute(msg2);

      expect(pool.queueSize).toBe(1);

      // Complete first task — triggers processQueue which dispatches msg2
      mock.dispatchToLastWorker({ id: '1', type: 'EXPORT_RENDER', payload: null });

      const r1 = await p1;
      expect(r1.id).toBe('1');

      // After flush, queue should be processed
      await Promise.resolve();
      expect(pool.queueSize).toBe(0);

      // Complete second task so its promise doesn't leak
      mock.dispatchToLastWorker({ id: '2', type: 'LAYOUT_COMPUTE', payload: null });
      await p2;

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

      const p1 = pool.execute({ id: '1', type: 'EXPORT_RENDER', payload: null });
      const p2 = pool.execute({ id: '2', type: 'EXPORT_RENDER', payload: null });
      const p3 = pool.execute({ id: '3', type: 'EXPORT_RENDER', payload: null });

      pool.terminate();

      await expect(p1).rejects.toThrow('WorkerPool terminated');
      await expect(p2).rejects.toThrow('WorkerPool terminated');
      await expect(p3).rejects.toThrow('WorkerPool terminated');
    });
  });

  describe('resource cleanup', () => {
    it('should terminate all workers on pool termination', async () => {
      const mock = createMockWorkerPool();
      const pool = new WorkerPool(mock.factory, 3);

      const p1 = pool.execute({ id: '1', type: 'EXPORT_RENDER', payload: null });
      const p2 = pool.execute({ id: '2', type: 'EXPORT_RENDER', payload: null });

      pool.terminate();

      for (const w of mock.workers) {
        expect(w.instance.terminate).toHaveBeenCalled();
      }
      expect(pool.activeCount).toBe(0);
      expect(pool.idleCount).toBe(0);

      // Consume rejected promises to avoid unhandled rejection
      await expect(p1).rejects.toThrow('WorkerPool terminated');
      await expect(p2).rejects.toThrow('WorkerPool terminated');
    });
  });

  // ----------------------------------------------------------------
  // Full crash → recovery lifecycle integration tests
  // ----------------------------------------------------------------
  describe('full crash → recovery lifecycle', () => {
    it('should complete dispatch → crash → recovery → queued-drain end-to-end', async () => {
      const mock = createMockWorkerPool();
      const pool = new WorkerPool(mock.factory, 1);

      // Step 1: dispatch a task to the sole worker
      const msg1: WorkerMessage = { id: 'lifecycle-1', type: 'EXPORT_RENDER', payload: { step: 1 } };
      const p1 = pool.execute(msg1);
      expect(pool.activeCount).toBe(1);

      // Step 2: queue two more tasks (maxWorkers=1)
      const msg2: WorkerMessage = { id: 'lifecycle-2', type: 'LAYOUT_COMPUTE', payload: { step: 2 } };
      const msg3: WorkerMessage = { id: 'lifecycle-3', type: 'EXPORT_RENDER', payload: { step: 3 } };
      const p2 = pool.execute(msg2);
      const p3 = pool.execute(msg3);
      expect(pool.queueSize).toBe(2);

      // Step 3: worker crashes while processing task-1
      mock.dispatchErrorToLastWorker('Simulated crash');
      await expect(p1).rejects.toThrow('Simulated crash');

      // Worker should have been recreated
      expect(mock.factory).toHaveBeenCalledTimes(2);

      // Step 4: after crash recovery, the first queued task should be dispatched
      // to the recreated worker. Complete it.
      await Promise.resolve(); // let microtask queue settle
      expect(pool.queueSize).toBe(1); // one remaining in queue

      mock.dispatchToLastWorker({ id: 'lifecycle-2', type: 'LAYOUT_COMPUTE', payload: { computed: true } });
      const r2 = await p2;
      expect(r2.payload).toEqual({ computed: true });

      // Step 5: the second queued task should now be dispatched
      await Promise.resolve();
      expect(pool.queueSize).toBe(0);

      mock.dispatchToLastWorker({ id: 'lifecycle-3', type: 'EXPORT_RENDER', payload: { exported: true } });
      const r3 = await p3;
      expect(r3.payload).toEqual({ exported: true });

      // Pool should remain healthy
      expect(pool.isTerminated).toBe(false);
      expect(pool.activeCount).toBe(0);
      expect(pool.idleCount).toBe(1);

      pool.terminate();
    });

    it('should enforce crash-loop cap and remove worker slot after MAX_WORKER_CRASH_COUNT', async () => {
      const mock = createMockWorkerPool();
      const pool = new WorkerPool(mock.factory, 1);

      // Crash the worker 5 times in succession (MAX_WORKER_CRASH_COUNT = 5).
      // Each crash is followed by recreation, so the slot persists.
      for (let i = 0; i < 5; i++) {
        const msg: WorkerMessage = { id: `crash-${i}`, type: 'EXPORT_RENDER', payload: null };
        const p = pool.execute(msg);

        // Crash current worker — error fires both global & per-task listeners
        mock.dispatchErrorToLastWorker(`crash #${i}`);
        await expect(p).rejects.toThrow(`crash #${i}`);
      }

      // 1 initial + 5 recreations = 6 factory calls
      expect(mock.factory).toHaveBeenCalledTimes(6);

      // Pool should still have 1 worker slot (the 5th crash was still within cap)
      expect(pool.idleCount + pool.activeCount).toBe(1);

      // The 6th crash should exceed the cap and remove the slot
      const msgOver: WorkerMessage = { id: 'crash-over', type: 'EXPORT_RENDER', payload: null };
      const pOver = pool.execute(msgOver);

      mock.dispatchErrorToLastWorker('crash #6 - over limit');
      await expect(pOver).rejects.toThrow('crash #6 - over limit');

      // Worker slot should be removed — no more workers in pool
      expect(pool.idleCount + pool.activeCount).toBe(0);

      // Pool is still functional: a new execute() creates a fresh worker
      // since workers.length (0) < maxWorkers (1).
      const msgRecovery: WorkerMessage = { id: 'recovery', type: 'EXPORT_RENDER', payload: null };
      const pRecovery = pool.execute(msgRecovery);
      expect(pool.activeCount).toBe(1);

      // Complete the recovery task
      mock.dispatchToLastWorker({ id: 'recovery', type: 'EXPORT_RENDER', payload: { ok: true } });
      const rRecovery = await pRecovery;
      expect(rRecovery.payload).toEqual({ ok: true });

      pool.terminate();
    });

    it('should handle idle worker crash and still drain queued tasks', async () => {
      const mock = createMockWorkerPool();
      const pool = new WorkerPool(mock.factory, 1);

      // Complete a task so worker becomes idle
      const msg1: WorkerMessage = { id: 'idle-1', type: 'EXPORT_RENDER', payload: null };
      const p1 = pool.execute(msg1);
      mock.dispatchToLastWorker({ id: 'idle-1', type: 'EXPORT_RENDER', payload: null });
      await p1;
      expect(pool.idleCount).toBe(1);

      // Queue a task (worker is idle but hasn't picked it up yet because
      // the promise already resolved — let's execute a new one to dispatch)
      const msg2: WorkerMessage = { id: 'idle-2', type: 'LAYOUT_COMPUTE', payload: null };
      const p2 = pool.execute(msg2);
      expect(pool.activeCount).toBe(1);

      // Now crash the worker while processing task 2
      mock.dispatchErrorToLastWorker('Idle crash');
      await expect(p2).rejects.toThrow('Idle crash');

      // Worker should be recreated
      expect(mock.factory).toHaveBeenCalledTimes(2);

      // Queue a new task - should be dispatched to recreated worker
      const msg3: WorkerMessage = { id: 'idle-3', type: 'EXPORT_RENDER', payload: null };
      const p3 = pool.execute(msg3);
      mock.dispatchToLastWorker({ id: 'idle-3', type: 'EXPORT_RENDER', payload: { recovered: true } });
      const r3 = await p3;
      expect(r3.payload).toEqual({ recovered: true });

      pool.terminate();
    });

    it('should clean up per-task listeners across multiple crash-recovery cycles', async () => {
      const mock = createMockWorkerPool();
      const pool = new WorkerPool(mock.factory, 1);

      // Cycle 1: dispatch → complete normally
      const msg1: WorkerMessage = { id: 'clean-1', type: 'EXPORT_RENDER', payload: null };
      const p1 = pool.execute(msg1);
      mock.dispatchToLastWorker({ id: 'clean-1', type: 'EXPORT_RENDER', payload: null });
      await p1;

      // After normal completion, message and error listeners should be removed
      const w0 = mock.workers[0];
      const errorListenersAfterNormal = w0.listeners['error']?.length ?? 0;
      const messageListenersAfterNormal = w0.listeners['message']?.length ?? 0;
      // The global error listener from createWorker remains; per-task ones are cleaned
      // Check via removeEventListener calls
      const errorRemovals = w0.instance.removeEventListener.mock.calls.filter(
        (call: [string]) => call[0] === 'error',
      ).length;
      const messageRemovals = w0.instance.removeEventListener.mock.calls.filter(
        (call: [string]) => call[0] === 'message',
      ).length;
      expect(errorRemovals).toBeGreaterThanOrEqual(1);
      expect(messageRemovals).toBeGreaterThanOrEqual(1);

      // Cycle 2: dispatch → crash
      const msg2: WorkerMessage = { id: 'clean-2', type: 'EXPORT_RENDER', payload: null };
      const p2 = pool.execute(msg2);
      mock.dispatchErrorToLastWorker('Cycle 2 crash');
      await expect(p2).rejects.toThrow('Cycle 2 crash');

      // Recreated worker should exist
      expect(mock.factory).toHaveBeenCalledTimes(2);
      const w1 = mock.workers[1];

      // Cycle 3: dispatch to recreated worker → complete
      const msg3: WorkerMessage = { id: 'clean-3', type: 'LAYOUT_COMPUTE', payload: null };
      const p3 = pool.execute(msg3);
      // Dispatch message to the recreated worker (index 1)
      const handlers = w1.listeners['message'] || [];
      for (const h of handlers) {
        h({ data: { id: 'clean-3', type: 'LAYOUT_COMPUTE', payload: { ok: true } } });
      }
      const r3 = await p3;
      expect(r3.payload).toEqual({ ok: true });

      // Verify listeners were cleaned up on the recreated worker too
      const w1ErrorRemovals = w1.instance.removeEventListener.mock.calls.filter(
        (call: [string]) => call[0] === 'error',
      ).length;
      const w1MessageRemovals = w1.instance.removeEventListener.mock.calls.filter(
        (call: [string]) => call[0] === 'message',
      ).length;
      expect(w1ErrorRemovals).toBeGreaterThanOrEqual(1);
      expect(w1MessageRemovals).toBeGreaterThanOrEqual(1);

      pool.terminate();
    });

    it('should process queued tasks after multiple sequential crashes', async () => {
      const mock = createMockWorkerPool();
      const pool = new WorkerPool(mock.factory, 1);

      // Dispatch task 1
      const msg1: WorkerMessage = { id: 'seq-1', type: 'EXPORT_RENDER', payload: null };
      const p1 = pool.execute(msg1);

      // Queue tasks 2 and 3
      const msg2: WorkerMessage = { id: 'seq-2', type: 'EXPORT_RENDER', payload: null };
      const msg3: WorkerMessage = { id: 'seq-3', type: 'EXPORT_RENDER', payload: null };
      const p2 = pool.execute(msg2);
      const p3 = pool.execute(msg3);

      // Crash task 1
      mock.dispatchErrorToLastWorker('Crash 1');
      await expect(p1).rejects.toThrow('Crash 1');

      // Worker recreated, task 2 dispatched — crash it again
      await Promise.resolve();
      mock.dispatchErrorToLastWorker('Crash 2');
      await expect(p2).rejects.toThrow('Crash 2');

      // Worker recreated again, task 3 dispatched — complete normally
      await Promise.resolve();
      mock.dispatchToLastWorker({ id: 'seq-3', type: 'EXPORT_RENDER', payload: { final: true } });
      const r3 = await p3;
      expect(r3.payload).toEqual({ final: true });

      // All tasks resolved, pool healthy
      expect(pool.queueSize).toBe(0);
      expect(pool.activeCount).toBe(0);

      pool.terminate();
    });
  });
});
