/**
 * WorkerPool unit tests
 *
 * Workers are mocked since Jest runs in Node environment.
 * Tests verify pool lifecycle, queueing, error handling, and cleanup.
 */

import { WorkerPool } from '../worker-pool';
import type { WorkerMessage, WorkerResponse } from '../types';

// --- Mock Worker ---

interface MockWorkerInstance {
  postMessage: ReturnType<typeof jest.fn>;
  terminate: ReturnType<typeof jest.fn>;
  addEventListener: ReturnType<typeof jest.fn>;
  removeEventListener: ReturnType<typeof jest.fn>;
  dispatchMessage: (data: WorkerResponse) => void;
  dispatchError: (message: string) => void;
}

function createMockWorker(): { instance: MockWorkerInstance; WorkerClass: ReturnType<typeof jest.fn> } {
  const listeners: Record<string, Array<(event: { data?: unknown; message?: string }) => void>> = {};

  const instance: MockWorkerInstance = {
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
    dispatchMessage(data: WorkerResponse) {
      const handlers = listeners['message'] || [];
      for (const h of handlers) {
        h({ data });
      }
    },
    dispatchError(message: string) {
      const handlers = listeners['error'] || [];
      for (const h of handlers) {
        h({ message });
      }
    },
  };

  const WorkerClass = jest.fn(() => instance);
  return { instance, WorkerClass };
}

// --- Tests ---

describe('WorkerPool', () => {
  let mock: ReturnType<typeof createMockWorker>;

  beforeEach(() => {
    mock = createMockWorker();
  });

  describe('lifecycle', () => {
    it('should create workers on demand', async () => {
      const pool = new WorkerPool(mock.WorkerClass, 4);
      const msg: WorkerMessage = { id: '1', type: 'EXPORT_RENDER', payload: null };

      const p = pool.execute(msg);

      expect(mock.WorkerClass).toHaveBeenCalledTimes(1);
      expect(pool.activeCount).toBe(1);
      pool.terminate();

      // terminate() rejects the active task promise
      await expect(p).rejects.toThrow('WorkerPool terminated');
    });

    it('should reuse idle workers', async () => {
      const pool = new WorkerPool(mock.WorkerClass, 4);

      // First task
      const msg1: WorkerMessage = { id: '1', type: 'EXPORT_RENDER', payload: null };
      const p1 = pool.execute(msg1);

      // Simulate completion
      mock.instance.dispatchMessage({ id: '1', type: 'EXPORT_RENDER', payload: { success: true } });

      await p1;

      // Second task should reuse same worker
      const msg2: WorkerMessage = { id: '2', type: 'EXPORT_RENDER', payload: null };
      const p2 = pool.execute(msg2);

      expect(mock.WorkerClass).toHaveBeenCalledTimes(1);
      expect(pool.idleCount).toBe(0);
      expect(pool.activeCount).toBe(1);
      pool.terminate();

      // terminate() rejects the active task promise
      await expect(p2).rejects.toThrow('WorkerPool terminated');
    });

    it('should terminate all workers and clear queue', async () => {
      const pool = new WorkerPool(mock.WorkerClass, 4);
      const msg: WorkerMessage = { id: '1', type: 'EXPORT_RENDER', payload: null };
      const p = pool.execute(msg);

      pool.terminate();

      expect(mock.instance.terminate).toHaveBeenCalled();
      expect(pool.isTerminated).toBe(true);
      expect(pool.activeCount).toBe(0);
      expect(pool.idleCount).toBe(0);

      // terminate() rejects the active task promise
      await expect(p).rejects.toThrow('WorkerPool terminated');
    });
  });

  describe('queueing', () => {
    it('should queue tasks when all workers are busy', async () => {
      const pool = new WorkerPool(mock.WorkerClass, 1);

      // Fill the single worker
      const msg1: WorkerMessage = { id: '1', type: 'EXPORT_RENDER', payload: null };
      const p1 = pool.execute(msg1);

      // Queue second task
      const msg2: WorkerMessage = { id: '2', type: 'LAYOUT_COMPUTE', payload: null };
      const p2 = pool.execute(msg2);

      expect(pool.queueSize).toBe(1);
      expect(pool.activeCount).toBe(1);

      // Complete first task - second should be dispatched
      mock.instance.dispatchMessage({ id: '1', type: 'EXPORT_RENDER', payload: null });
      await p1;

      // Allow microtask queue to flush
      await Promise.resolve();

      expect(pool.queueSize).toBe(0);
      expect(pool.activeCount).toBe(1);

      // Clean up second task
      mock.instance.dispatchMessage({ id: '2', type: 'LAYOUT_COMPUTE', payload: null });
      await p2;
      pool.terminate();
    });

    it('should create new workers up to maxWorkers', async () => {
      const pool = new WorkerPool(mock.WorkerClass, 2);

      const msg1: WorkerMessage = { id: '1', type: 'EXPORT_RENDER', payload: null };
      const msg2: WorkerMessage = { id: '2', type: 'EXPORT_RENDER', payload: null };
      const p1 = pool.execute(msg1);
      const p2 = pool.execute(msg2);

      expect(mock.WorkerClass).toHaveBeenCalledTimes(2);
      expect(pool.activeCount).toBe(2);
      pool.terminate();

      await expect(p1).rejects.toThrow('WorkerPool terminated');
      await expect(p2).rejects.toThrow('WorkerPool terminated');
    });
  });

  describe('message handling', () => {
    it('should send message to worker and return response', async () => {
      const pool = new WorkerPool(mock.WorkerClass, 4);
      const msg: WorkerMessage<{ format: string }> = {
        id: 'test-1',
        type: 'EXPORT_RENDER',
        payload: { format: 'mp4' },
      };

      const promise = pool.execute(msg);

      // Simulate worker response
      mock.instance.dispatchMessage({
        id: 'test-1',
        type: 'EXPORT_RENDER',
        payload: { success: true, outputSize: 1024 },
      });

      const response = await promise;
      expect(response.id).toBe('test-1');
      expect(response.payload).toEqual({ success: true, outputSize: 1024 });
      expect(mock.instance.postMessage).toHaveBeenCalledWith(msg);

      pool.terminate();
    });

    it('should return error when pool is terminated', async () => {
      const pool = new WorkerPool(mock.WorkerClass, 4);
      pool.terminate();

      const msg: WorkerMessage = { id: '1', type: 'EXPORT_RENDER', payload: null };
      const response = await pool.execute(msg);

      expect(response.error?.code).toBe('POOL_TERMINATED');
    });
  });

  describe('error handling', () => {
    it('should reject promise on worker error', async () => {
      const pool = new WorkerPool(mock.WorkerClass, 4);
      const msg: WorkerMessage = { id: 'err-1', type: 'EXPORT_RENDER', payload: null };

      const promise = pool.execute(msg);

      // Simulate worker error
      mock.instance.dispatchError('Worker crashed');

      await expect(promise).rejects.toThrow('Worker crashed');
      pool.terminate();
    });

    it('should reject queued tasks on terminate', async () => {
      const pool = new WorkerPool(mock.WorkerClass, 1);

      // Fill worker
      const msg1: WorkerMessage = { id: '1', type: 'EXPORT_RENDER', payload: null };
      const p1 = pool.execute(msg1);

      // Queue second task
      const msg2: WorkerMessage = { id: '2', type: 'EXPORT_RENDER', payload: null };
      const p2 = pool.execute(msg2);

      pool.terminate();

      await expect(p1).rejects.toThrow('WorkerPool terminated');
      await expect(p2).rejects.toThrow('WorkerPool terminated');
    });
  });

  describe('properties', () => {
    it('should report correct pool state', () => {
      const pool = new WorkerPool(mock.WorkerClass, 4);

      expect(pool.activeCount).toBe(0);
      expect(pool.idleCount).toBe(0);
      expect(pool.queueSize).toBe(0);
      expect(pool.isTerminated).toBe(false);

      pool.terminate();

      expect(pool.isTerminated).toBe(true);
    });
  });
});

// ---------- Worker crash recovery ----------

describe('worker crash recovery', () => {
  it('should recreate worker and process queued task after crash', async () => {
    // Factory returns a unique mock instance per call
    const instances: MockWorkerInstance[] = [];
    const factory = jest.fn((): Worker => {
      const { instance } = createMockWorker();
      instances.push(instance);
      return instance as unknown as Worker;
    });

    const pool = new WorkerPool(factory, 1);

    // Task 1: dispatched to the only worker
    const msg1: WorkerMessage = { id: '1', type: 'EXPORT_RENDER', payload: null };
    const p1 = pool.execute(msg1);

    // Task 2: queued (maxWorkers=1)
    const msg2: WorkerMessage = { id: '2', type: 'EXPORT_RENDER', payload: null };
    const p2 = pool.execute(msg2);

    expect(pool.queueSize).toBe(1);
    expect(factory).toHaveBeenCalledTimes(1);

    // Worker crashes
    instances[0].dispatchError('Worker crashed');

    // Task 1 should be rejected
    await expect(p1).rejects.toThrow('Worker crashed');

    // Worker should have been recreated
    expect(factory).toHaveBeenCalledTimes(2);

    // Task 2 should be dispatched to the recreated worker
    instances[1].dispatchMessage({ id: '2', type: 'EXPORT_RENDER', payload: { done: true } });

    const result = await p2;
    expect(result.payload).toEqual({ done: true });

    pool.terminate();
  });

  it('should remove per-task error listener on normal completion', async () => {
    const localMock = createMockWorker();
    const pool = new WorkerPool(localMock.WorkerClass, 4);
    const msg: WorkerMessage = { id: 'clean-1', type: 'EXPORT_RENDER', payload: null };

    const promise = pool.execute(msg);
    localMock.instance.dispatchMessage({ id: 'clean-1', type: 'EXPORT_RENDER', payload: null });
    await promise;

    // handleMessage should have removed both the message and error listeners
    const errorRemovals = localMock.instance.removeEventListener.mock.calls.filter(
      (call: [string]) => call[0] === 'error',
    );
    expect(errorRemovals.length).toBeGreaterThanOrEqual(1);

    pool.terminate();
  });
});

import { isWorkerAvailable, getOptimalWorkerCount } from '../index';

describe('worker module exports', () => {
  it('should export isWorkerAvailable', () => {
    expect(typeof isWorkerAvailable).toBe('function');
    // Node.js 18+ has global Worker via undici, but it's not the Web Worker API
    // The function should return a boolean
    expect(typeof isWorkerAvailable()).toBe('boolean');
  });

  it('should export getOptimalWorkerCount', () => {
    expect(typeof getOptimalWorkerCount).toBe('function');
    // Returns min(hardwareConcurrency, maxCap) in Node.js (navigator is available)
    const count = getOptimalWorkerCount(4);
    expect(count).toBeLessThanOrEqual(4);
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ---------- terminate() rejects active task promises ----------

describe('terminate() rejects active task promises', () => {
  it('should reject promise of a dispatched (in-flight) task on terminate', async () => {
    const localMock = createMockWorker();
    const pool = new WorkerPool(localMock.WorkerClass, 4);
    const msg: WorkerMessage = { id: 'active-1', type: 'EXPORT_RENDER', payload: null };

    const promise = pool.execute(msg);

    // Worker is busy, no response yet — now terminate
    pool.terminate();

    await expect(promise).rejects.toThrow('WorkerPool terminated');
  });

  it('should reject both active and queued tasks on terminate', async () => {
    const localMock = createMockWorker();
    const pool = new WorkerPool(localMock.WorkerClass, 1);

    const msg1: WorkerMessage = { id: 'active-1', type: 'EXPORT_RENDER', payload: null };
    const msg2: WorkerMessage = { id: 'queued-1', type: 'EXPORT_RENDER', payload: null };

    const p1 = pool.execute(msg1);
    const p2 = pool.execute(msg2);

    expect(pool.queueSize).toBe(1);

    pool.terminate();

    await expect(p1).rejects.toThrow('WorkerPool terminated');
    await expect(p2).rejects.toThrow('WorkerPool terminated');
  });
});
