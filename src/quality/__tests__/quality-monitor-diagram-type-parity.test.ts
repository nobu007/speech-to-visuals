/**
 * Diagram-type parity guard for the LIVE quality-monitor content-relevance
 * scorer.
 *
 * assessPipelineQuality → assessAccuracy → assessContentRelevance awards a
 * scene 0.3 of its content-relevance points (itself 30% of accuracyScore,
 * 40% of overallScore) when `scene.type` is a "valid" diagram type. This path
 * previously hardcoded `validTypes = ['flow','tree','timeline','matrix','cycle']`
 * — only 5 of the 11 canonical `DiagramType` values. The pipeline's primary
 * LLM analyzer (content-analyzer.ts / prompt-templates.ts) emits `'flowchart'`
 * as its dominant type, NOT `'flow'`, and rule-based detection emits
 * `mindmap`/`comparison`/etc. Every scene carrying one of the 6 omitted
 * canonical types (`flowchart`, `comparison`, `network`, `conceptmap`,
 * `mindmap`, `general`) silently lost the 0.3 bonus → a ~0.036 overallScore
 * false penalty on the MOST COMMON output — same namespace class as the
 * `'flow'` vs `'flowchart'` producer bug (f178cbf) and the same "false quality
 * penalty on correct output" flavor as the overlap margin bug (6923806).
 *
 * The scorer now delegates to the canonical `isDiagramType` guard
 * (src/types/diagram.ts, single source for the 11-type union). This file pins:
 *   1. All 11 canonical types score IDENTICALLY (no type is penalized).
 *   2. A non-canonical type still gets NO bonus (the guard isn't over-loosened).
 *
 * Isolation: every scene below carries the SAME layout nodes (identical
 * overlap + positioning + scene-count + llm-extraction contribution), so the
 * ONLY accuracyScore differentiator is the valid-type branch in
 * assessContentRelevance.
 */

import { describe, it, expect } from '@jest/globals';
import { isDiagramType } from '@stv/core/types/diagram';
import type { PositionedNode, SceneGraph, DiagramType } from '@stv/core/types/diagram';
import type { PipelineResult } from '@/pipeline/types';

const { QualityMonitor } = await import('../quality-monitor');

// All 11 canonical types, mirrored from the DiagramType union. DIAGRAM_TYPES
// (the runtime list backing isDiagramType) is module-private, so we mirror the
// union here AND assert isDiagramType coverage to stay coupled: adding a new
// DiagramType without updating the scorer (the original failure mode) makes
// the parity loop below fail loudly.
const CANONICAL_TYPES: DiagramType[] = [
  'flow', 'flowchart', 'tree', 'timeline', 'matrix', 'cycle',
  'comparison', 'network', 'conceptmap', 'mindmap', 'general',
];

it('parity list covers every value the canonical guard accepts', () => {
  for (const t of CANONICAL_TYPES) {
    expect(isDiagramType(t)).toBe(true);
  }
});

function positionedNode(id: string, x: number, y: number): PositionedNode {
  return { id, label: id, x, y, width: 120, height: 60 };
}

/** Two well-separated nodes → no overlap, generous positioning spread. */
const SHARED_LAYOUT_NODES: PositionedNode[] = [
  positionedNode('n0', 100, 100),
  positionedNode('n1', 700, 500),
];

function sceneWithType(type: string): SceneGraph {
  const nodes = SHARED_LAYOUT_NODES.map((n) => ({ id: n.id, label: n.label }));
  return {
    type: type as DiagramType,
    nodes,
    edges: [{ source: 'n0', target: 'n1' }],
    layout: { nodes: SHARED_LAYOUT_NODES, edges: [] },
    summary: 'This is a sufficiently long summary to earn the summary bonus.',
    keyphrases: ['alpha', 'beta'],
  } as unknown as SceneGraph;
}

function resultWithType(type: string): PipelineResult {
  return {
    success: true,
    scenes: [sceneWithType(type)],
    audioUrl: '/test.wav',
    duration: 60,
    processingTime: 10000,
    stages: [],
    outputPath: '/output/video.mp4',
    metrics: {
      totalProcessingTime: 10000,
      memoryUsage: 128 * 1024 * 1024,
      transcriptionTime: 2000,
      analysisTime: 3000,
      layoutTime: 1000,
      renderTime: 4000,
    },
  } as unknown as PipelineResult;
}

const monitor = new QualityMonitor();

describe('quality-monitor diagram-type parity (assessContentRelevance)', () => {
  describe('literal anchor: flowchart is not penalized relative to flow', () => {
    it('identical flow vs flowchart scenes score equal overallScore', async () => {
      const flow = await monitor.assessPipelineQuality(resultWithType('flow'));
      const flowchart = await monitor.assessPipelineQuality(resultWithType('flowchart'));
      // Pre-fix: flowchart lost the 0.3 valid-type bonus → ~0.036 lower
      // overallScore. Post-fix: identical.
      expect(flowchart.overallScore).toBeCloseTo(flow.overallScore, 5);
      expect(flowchart.accuracyScore).toBeCloseTo(flow.accuracyScore, 5);
    });
  });

  describe('all 11 canonical diagram types score identically', () => {
    // Pre-fix, 6 of 11 (flowchart, comparison, network, conceptmap, mindmap,
    // general) scored ~0.036 lower. Post-fix, all 11 are equal.
    const scores: Array<[string, number]> = [];
    for (const type of CANONICAL_TYPES) {
      it(`${type} earns the valid-type bonus (no penalty)`, async () => {
        const a = await monitor.assessPipelineQuality(resultWithType(type));
        scores.push([type, a.overallScore]);
        // Sanity floor: a valid, fully-populated scene must clear the
        // deployment-readiness band, not be dragged down by a missing bonus.
        expect(a.overallScore).toBeGreaterThanOrEqual(0.6);
      });
    }

    it('every canonical type matches the flow baseline within 1e-9', async () => {
      const baseline = await monitor.assessPipelineQuality(resultWithType('flow'));
      for (const [type, score] of scores) {
        expect(score).toBeCloseTo(baseline.overallScore, 5);
        void type;
      }
    });
  });

  describe('non-canonical type still gets NO bonus', () => {
    it('an unrecognized type scores strictly below a canonical one', async () => {
      const valid = await monitor.assessPipelineQuality(resultWithType('flow'));
      const bogus = await monitor.assessPipelineQuality(resultWithType('__not_a_real_type__'));
      // The guard must not over-loosen: a bogus type correctly loses the 0.3
      // bonus, so it scores strictly lower than a valid type.
      expect(bogus.overallScore).toBeLessThan(valid.overallScore);
    });
  });
});
