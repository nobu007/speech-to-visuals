/**
 * Tests for smoke-orchestrator exported helper functions.
 *
 * Covers bugs fixed:
 * - Type coercion: toNodeDatum/toEdgeDatum now use String() instead of `as string`
 *   so numeric IDs from LLM output are properly converted at runtime.
 * - Duration guard: buildSingleScene enforces minimum duration of 1ms to prevent
 *   all captions getting timestamp 0 when diagram.durationMs is 0.
 */

import {
  buildSingleScene,
  buildMultiScenes,
  type RawDiagram,
} from '../smoke-orchestrator';

describe('smoke-orchestrator', () => {
  describe('toNodeDatum (via buildSingleScene) — type coercion fix', () => {
    it('converts numeric id to string', () => {
      const diagram: RawDiagram = {
        type: 'flow',
        nodes: [{ id: 123, label: 'Step A' }],
      };
      const { scene } = buildSingleScene(diagram, 0, 30);
      expect(scene.nodes[0].id).toBe('123');
      expect(typeof scene.nodes[0].id).toBe('string');
    });

    it('converts numeric label to string', () => {
      const diagram: RawDiagram = {
        type: 'flow',
        nodes: [{ id: 'n1', label: 999 }],
      };
      const { scene } = buildSingleScene(diagram, 0, 30);
      expect(scene.nodes[0].label).toBe('999');
      expect(typeof scene.nodes[0].label).toBe('string');
    });

    it('uses fallback id when id is null', () => {
      const diagram: RawDiagram = {
        type: 'flow',
        nodes: [{ id: null, label: 'A' }],
      };
      const { scene } = buildSingleScene(diagram, 0, 30);
      expect(scene.nodes[0].id).toBe('node-0');
    });

    it('uses fallback id when id is undefined', () => {
      const diagram: RawDiagram = {
        type: 'flow',
        nodes: [{ label: 'A' }],
      };
      const { scene } = buildSingleScene(diagram, 0, 30);
      expect(scene.nodes[0].id).toBe('node-0');
    });

    it('uses fallback label when label is undefined', () => {
      const diagram: RawDiagram = {
        type: 'flow',
        nodes: [{ id: 'n1' }],
      };
      const { scene } = buildSingleScene(diagram, 0, 30);
      expect(scene.nodes[0].label).toBe('Node 0');
    });

    it('preserves string id and label as-is', () => {
      const diagram: RawDiagram = {
        type: 'flow',
        nodes: [{ id: 'start', label: 'Begin' }],
      };
      const { scene } = buildSingleScene(diagram, 0, 30);
      expect(scene.nodes[0].id).toBe('start');
      expect(scene.nodes[0].label).toBe('Begin');
    });

    it('preserves width/height as numbers, filters non-numbers', () => {
      const diagram: RawDiagram = {
        type: 'flow',
        nodes: [
          { id: 'n1', label: 'A', width: 100, height: 50 },
          { id: 'n2', label: 'B', width: 'wide' },
        ],
      };
      const { scene } = buildSingleScene(diagram, 0, 30);
      expect(scene.nodes[0].width).toBe(100);
      expect(scene.nodes[0].height).toBe(50);
      expect(scene.nodes[1].width).toBeUndefined();
    });
  });

  describe('toEdgeDatum (via buildSingleScene) — type coercion fix', () => {
    it('converts numeric from/to to string', () => {
      const diagram: RawDiagram = {
        type: 'flow',
        nodes: [
          { id: 'n0', label: 'A' },
          { id: 'n1', label: 'B' },
        ],
        edges: [{ from: 0, to: 1 }],
      };
      const { scene } = buildSingleScene(diagram, 0, 30);
      expect(scene.edges[0].from).toBe('0');
      expect(scene.edges[0].to).toBe('1');
      expect(typeof scene.edges[0].from).toBe('string');
    });

    it('falls back to source/target when from/to missing', () => {
      const diagram: RawDiagram = {
        type: 'flow',
        nodes: [
          { id: 'n0', label: 'A' },
          { id: 'n1', label: 'B' },
        ],
        edges: [{ source: 'n0', target: 'n1' }],
      };
      const { scene } = buildSingleScene(diagram, 0, 30);
      expect(scene.edges[0].from).toBe('n0');
      expect(scene.edges[0].to).toBe('n1');
    });

    it('uses default from/to when both missing', () => {
      const diagram: RawDiagram = {
        type: 'flow',
        nodes: [{ id: 'n0', label: 'A' }],
        edges: [{}],
      };
      const { scene } = buildSingleScene(diagram, 0, 30);
      expect(scene.edges[0].from).toBe('node-0');
      expect(scene.edges[0].to).toBe('node-1');
    });

    it('converts numeric edge id to string', () => {
      const diagram: RawDiagram = {
        type: 'flow',
        nodes: [{ id: 'n0', label: 'A' }],
        edges: [{ from: 'a', to: 'b', id: 42 }],
      };
      const { scene } = buildSingleScene(diagram, 0, 30);
      expect(scene.edges[0].id).toBe('42');
    });
  });

  describe('buildSingleScene — duration guard', () => {
    it('defaults to 5000ms when durationMs omitted', () => {
      const diagram: RawDiagram = {
        type: 'flow',
        nodes: [{ id: 'a', label: 'A' }],
      };
      const { scene } = buildSingleScene(diagram, 0, 30);
      expect(scene.durationMs).toBe(5000);
    });

    it('enforces minimum 1ms when durationMs is 0', () => {
      const diagram: RawDiagram = {
        type: 'flow',
        durationMs: 0,
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
      };
      const { scene, captions } = buildSingleScene(diagram, 100, 30);
      // Duration is clamped to minimum 1ms so timestamps don't collapse to 0
      expect(scene.durationMs).toBeGreaterThanOrEqual(1);
      expect(captions.length).toBe(2);
      // Key fix: without the guard, both captions would have startMs=100
      expect(captions[0].startMs).toBe(100);
      expect(captions[1].startMs).toBeGreaterThanOrEqual(101);
    });

    it('produces correct caption timestamps for normal duration', () => {
      const diagram: RawDiagram = {
        type: 'flow',
        durationMs: 4000,
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
          { id: 'c', label: 'C' },
          { id: 'd', label: 'D' },
        ],
      };
      const { captions } = buildSingleScene(diagram, 0, 30);
      expect(captions).toHaveLength(4);
      expect(captions[0].startMs).toBe(0);
      expect(captions[0].endMs).toBe(1000);
      expect(captions[3].endMs).toBe(4000);
    });

    it('produces empty captions for empty nodes', () => {
      const diagram: RawDiagram = {
        type: 'flow',
        nodes: [],
      };
      const { captions } = buildSingleScene(diagram, 0, 30);
      expect(captions).toEqual([]);
    });
  });

  describe('buildMultiScenes', () => {
    it('builds multiple scenes with sequential timing', () => {
      const diagrams: RawDiagram[] = [
        { type: 'flow', durationMs: 3000, nodes: [{ id: 'a', label: 'A' }] },
        { type: 'tree', durationMs: 2000, nodes: [{ id: 'b', label: 'B' }] },
      ];
      const { scenes, captions } = buildMultiScenes(diagrams, 30);
      expect(scenes).toHaveLength(2);
      expect(scenes[0].startMs).toBe(0);
      expect(scenes[1].startMs).toBe(3000);
      // Captions should have global sequential indices
      expect(captions[0].index).toBe(1);
      expect(captions[1].index).toBe(2);
    });

    it('handles empty diagram array', () => {
      const { scenes, captions } = buildMultiScenes([], 30);
      expect(scenes).toEqual([]);
      expect(captions).toEqual([]);
    });

    it('coerces numeric IDs across multiple scenes', () => {
      const diagrams: RawDiagram[] = [
        { type: 'flow', nodes: [{ id: 1, label: 'A' }] },
        { type: 'flow', nodes: [{ id: 2, label: 'B' }] },
      ];
      const { scenes } = buildMultiScenes(diagrams, 30);
      expect(scenes[0].nodes[0].id).toBe('1');
      expect(scenes[1].nodes[0].id).toBe('2');
    });
  });
});
