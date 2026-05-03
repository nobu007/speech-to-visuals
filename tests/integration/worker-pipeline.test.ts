/**
 * Worker Pipeline Integration Tests
 *
 * Tests the layout worker → export worker pipeline,
 * verifying data flow between workers is correct.
 */

import { computeLayout } from '@/workers/layout-worker';
import { processExportPayload } from '@/workers/export-worker';
import type { LayoutWorkerPayload, ExportWorkerPayload } from '@/workers/types';

describe('Worker pipeline integration', () => {
  it('should compute layout then process export sequentially', () => {
    // Step 1: Compute layout
    const layoutPayload: LayoutWorkerPayload = {
      nodes: Array.from({ length: 50 }, (_, i) => ({
        id: `node-${i}`,
        width: 120,
        height: 60,
        label: `Node ${i}`,
      })),
      edges: Array.from({ length: 49 }, (_, i) => ({
        source: `node-${i}`,
        target: `node-${i + 1}`,
      })),
      config: {
        width: 1920,
        height: 1080,
        rankDirection: 'TB',
        nodeSeparation: 50,
        rankSeparation: 50,
      },
    };

    const layoutResult = computeLayout(layoutPayload);

    // Verify layout result
    expect(layoutResult.nodes).toHaveLength(50);
    expect(layoutResult.edges).toHaveLength(49);

    // Nodes should have valid coordinates
    for (const node of layoutResult.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeGreaterThanOrEqual(0);
    }

    // Step 2: Process export with layout result
    const exportPayload: ExportWorkerPayload = {
      format: 'mp4',
      data: {
        scenes: layoutResult.nodes.map((n) => ({
          id: n.id,
          x: n.x,
          y: n.y,
        })),
      },
      options: {
        fps: 30,
        duration: 10,
        avgFrameSize: 50000,
      },
    };

    const exportResult = processExportPayload(exportPayload);

    expect(exportResult.outputSize).toBeDefined();
    expect(exportResult.duration).toBe(10);
  });

  it('should handle 100+ node layout correctly', () => {
    const nodeCount = 100;
    const nodes = Array.from({ length: nodeCount }, (_, i) => ({
      id: `n${i}`,
      width: 80,
      height: 40,
    }));

    // Create a tree-like structure
    const edges: Array<{ source: string; target: string }> = [];
    for (let i = 0; i < nodeCount - 1; i++) {
      edges.push({ source: `n${Math.floor(i / 3)}`, target: `n${i + 1}` });
    }

    const result = computeLayout({
      nodes,
      edges,
      config: {
        width: 3840,
        height: 2160,
        rankDirection: 'TB',
        nodeSeparation: 30,
        rankSeparation: 40,
      },
    });

    expect(result.nodes).toHaveLength(nodeCount);
    expect(result.edges.length).toBeGreaterThan(0);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('should produce consistent results for identical inputs', () => {
    const payload: LayoutWorkerPayload = {
      nodes: [
        { id: 'A', width: 100, height: 50 },
        { id: 'B', width: 100, height: 50 },
      ],
      edges: [{ source: 'A', target: 'B' }],
      config: {
        width: 1920,
        height: 1080,
        rankDirection: 'TB',
        nodeSeparation: 50,
        rankSeparation: 50,
      },
    };

    const result1 = computeLayout(payload);
    const result2 = computeLayout(payload);

    expect(result1.nodes).toEqual(result2.nodes);
    expect(result1.edges).toEqual(result2.edges);
  });
});
