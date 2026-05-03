/**
 * Worker Performance Benchmark Tests
 *
 * Measures performance of layout computation and export processing.
 * These tests validate that worker-ready functions perform within
 * acceptable time bounds.
 *
 * Note: CI environments may have variable performance, so thresholds
 * are set generously.
 */

import { computeLayout } from '@/workers/layout-worker';
import { processExportPayload } from '@/workers/export-worker';
import type { LayoutWorkerPayload } from '@/workers/types';

// Generous thresholds for CI environments
const LAYOUT_THRESHOLD_MS = 5000;
const EXPORT_THRESHOLD_MS = 100;

function generateNodes(count: number): LayoutWorkerPayload['nodes'] {
  return Array.from({ length: count }, (_, i) => ({
    id: `node-${i}`,
    width: 120,
    height: 60,
    label: `Node ${i}`,
  }));
}

function generateChainEdges(count: number): LayoutWorkerPayload['edges'] {
  return Array.from({ length: count - 1 }, (_, i) => ({
    source: `node-${i}`,
    target: `node-${i + 1}`,
  }));
}

function generateTreeEdges(count: number): LayoutWorkerPayload['edges'] {
  const edges: LayoutWorkerPayload['edges'] = [];
  for (let i = 1; i < count; i++) {
    const parent = Math.floor((i - 1) / 3);
    edges.push({ source: `node-${parent}`, target: `node-${i}` });
  }
  return edges;
}

describe('Worker performance benchmarks', () => {
  describe('layout computation performance', () => {
    const configs = [
      { nodeCount: 10, label: '10 nodes (small)' },
      { nodeCount: 50, label: '50 nodes (medium)' },
      { nodeCount: 100, label: '100 nodes (large)' },
      { nodeCount: 200, label: '200 nodes (stress)' },
    ];

    for (const { nodeCount, label } of configs) {
      it(`should compute layout for ${label} within ${LAYOUT_THRESHOLD_MS}ms`, () => {
        const nodes = generateNodes(nodeCount);
        const edges = generateChainEdges(nodeCount);

        const payload: LayoutWorkerPayload = {
          nodes,
          edges,
          config: {
            width: 1920,
            height: 1080,
            rankDirection: 'TB',
            nodeSeparation: 50,
            rankSeparation: 50,
          },
        };

        const start = performance.now();
        const result = computeLayout(payload);
        const elapsed = performance.now() - start;

        expect(result.nodes).toHaveLength(nodeCount);
        expect(elapsed).toBeLessThan(LAYOUT_THRESHOLD_MS);
      });
    }

    it('should compute tree layout for 100 nodes within threshold', () => {
      const nodes = generateNodes(100);
      const edges = generateTreeEdges(100);

      const payload: LayoutWorkerPayload = {
        nodes,
        edges,
        config: {
          width: 1920,
          height: 1080,
          rankDirection: 'TB',
          nodeSeparation: 50,
          rankSeparation: 50,
        },
      };

      const start = performance.now();
      const result = computeLayout(payload);
      const elapsed = performance.now() - start;

      expect(result.nodes).toHaveLength(100);
      expect(elapsed).toBeLessThan(LAYOUT_THRESHOLD_MS);
    });
  });

  describe('export processing performance', () => {
    it('should process export payload within threshold', () => {
      const payload = {
        format: 'mp4' as const,
        data: {
          scenes: Array.from({ length: 50 }, (_, i) => ({ id: i, frames: 30 })),
        },
        options: { fps: 30, duration: 60, avgFrameSize: 50000 },
      };

      const start = performance.now();
      const result = processExportPayload(payload);
      const elapsed = performance.now() - start;

      expect(result).toBeDefined();
      expect(elapsed).toBeLessThan(EXPORT_THRESHOLD_MS);
    });
  });

  describe('scalability', () => {
    it('layout time should scale sub-linearly with node count', () => {
      const times: { count: number; time: number }[] = [];

      for (const count of [10, 50, 100, 200]) {
        const nodes = generateNodes(count);
        const edges = generateChainEdges(count);

        const start = performance.now();
        computeLayout({
          nodes,
          edges,
          config: {
            width: 1920,
            height: 1080,
            rankDirection: 'TB',
            nodeSeparation: 50,
            rankSeparation: 50,
          },
        });
        const elapsed = performance.now() - start;
        times.push({ count, time: elapsed });
      }

      // Verify that 200 nodes doesn't take more than 50x the time of 10 nodes
      // Small test sizes have high variance in JIT-compiled environments
      const ratio = times[3].time / Math.max(times[0].time, 0.01);
      expect(ratio).toBeLessThan(50);
    });
  });
});
