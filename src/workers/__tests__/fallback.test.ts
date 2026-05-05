/**
 * Fallback tests - Verify fallback behavior when workers are unavailable
 */

import { describe, it, expect, jest } from '@jest/globals';
import { isWorkerAvailable, getOptimalWorkerCount } from '../index';
import { WorkerPool } from '../worker-pool';
import type { WorkerMessage } from '../types';

describe('Worker fallback behavior', () => {
  it('isWorkerAvailable returns boolean', () => {
    const result = isWorkerAvailable();
    expect(typeof result).toBe('boolean');
  });

  it('getOptimalWorkerCount returns value within valid range', () => {
    const count = getOptimalWorkerCount(4);
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(4);
  });

  it('getOptimalWorkerCount respects maxCap', () => {
    const count = getOptimalWorkerCount(1);
    expect(count).toBeLessThanOrEqual(1);
  });

  it('WorkerPool handles terminated pool gracefully', async () => {
    const mockFactory = jest.fn((() => ({
      postMessage: jest.fn(),
      terminate: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })) as unknown as () => Worker);

    const pool = new WorkerPool(mockFactory, 2);
    pool.terminate();

    const msg: WorkerMessage = { id: '1', type: 'EXPORT_RENDER', payload: null };
    const response = await pool.execute(msg);

    expect(response.error?.code).toBe('POOL_TERMINATED');
  });
});
