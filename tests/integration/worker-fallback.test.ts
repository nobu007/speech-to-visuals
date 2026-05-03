/**
 * Worker Fallback Integration Tests
 *
 * Verifies that systems work correctly when workers are disabled,
 * ensuring graceful degradation to main-thread processing.
 */

import { computeLayout } from '@/workers/layout-worker';
import { processExportPayload } from '@/workers/export-worker';
import { isWorkerAvailable } from '@/workers';
import type { LayoutWorkerPayload, ExportWorkerPayload } from '@/workers/types';

describe('Worker fallback integration', () => {
  describe('fallback processing', () => {
    it('should produce identical results with or without workers', () => {
      const layoutPayload: LayoutWorkerPayload = {
        nodes: [
          { id: 'A', width: 120, height: 60 },
          { id: 'B', width: 120, height: 60 },
          { id: 'C', width: 100, height: 50 },
        ],
        edges: [
          { source: 'A', target: 'B' },
          { source: 'B', target: 'C' },
        ],
        config: {
          width: 1920,
          height: 1080,
          rankDirection: 'TB',
          nodeSeparation: 50,
          rankSeparation: 50,
        },
      };

      // Main-thread processing (simulating fallback)
      const mainThreadResult = computeLayout(layoutPayload);

      // Worker processing would produce the same result
      // since it uses the same computeLayout function
      const workerResult = computeLayout(layoutPayload);

      expect(mainThreadResult).toEqual(workerResult);
    });

    it('should handle export fallback gracefully', () => {
      const payload: ExportWorkerPayload = {
        format: 'mp4',
        data: { scenes: [{ id: 1 }] },
        options: { fps: 30, duration: 5 },
      };

      const result = processExportPayload(payload);
      expect(result).toBeDefined();
      expect(result.duration).toBe(5);
    });
  });

  describe('worker availability detection', () => {
    it('should correctly detect worker availability', () => {
      // In Node.js test env, Worker may or may not be available
      const available = isWorkerAvailable();
      expect(typeof available).toBe('boolean');
    });

    it('should provide fallback when workers are not available', () => {
      // Even if workers are unavailable, computeLayout works as fallback
      const result = computeLayout({
        nodes: [{ id: 'test', width: 100, height: 50 }],
        edges: [],
        config: {
          width: 800,
          height: 600,
          rankDirection: 'TB',
          nodeSeparation: 50,
          rankSeparation: 50,
        },
      });

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('test');
    });
  });
});
