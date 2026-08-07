/**
 * Cross-invariant (intersection) fuzz: pins the LIVE framework-pipeline overlap
 * COUNTER (FrameworkIntegratedPipeline.detectLayoutOverlaps, reached via the
 * main-pipeline / useFrameworkPipeline paths at main-pipeline.ts:170,228 and
 * useFrameworkPipeline.ts:130) against the layout engine's canonical overlap
 * PREDICATE (nodesOverlap from layout-utils, spacing 0).
 *
 * This is the same bug class as quality-monitor-overlap-cross-invariant-fuzz
 * and zero-overlap-cross-invariant-fuzz: a checker re-derived the producer's
 * overlap test by hand and DRIFTED. Here the inline test used strict `<` for the
 * separation axes (`n1.x+w1 < n2.x || …`), so two nodes that merely TOUCH
 * (right edge of A == left edge of B) were counted as OVERLAPPING — while the
 * canonical nodesOverlap (and the quality gate) treat touching as NON-overlap
 * (`<=`/`>=`). A correct zero-overlap layout that leaves adjacent nodes edge-
 * touching was therefore reported as having overlaps, inflating layoutOverlap
 * and penalizing the framework quality score.
 *
 * The counter now delegates to nodesOverlap(n1, n2, 0) — the single source of
 * truth — so it can never re-diverge. This file pins that agreement.
 *
 * Reuses the shared fuzz helper (@tests/helpers/fuzz) for determinism.
 */

import { describe, it, expect } from '@jest/globals';
import { mulberry32 } from '@tests/helpers/fuzz';
import { nodesOverlap as producerNodesOverlap } from '@/visualization/layout-utils';
import type { PositionedNode, SceneGraph } from '@/types/diagram';
import type { PipelineResult } from '@/pipeline/types';

const { FrameworkIntegratedPipeline } = await import('../framework-integrated-pipeline');

/** Minimal valid positioned node. width/height are the non-deprecated fields. */
function node(id: string, x: number, y: number, width: number, height: number): PositionedNode {
  return { id, label: id, x, y, width, height };
}

/**
 * White-box access to the private overlap counter. detectLayoutOverlaps walks
 * every scene/node pair and returns a COUNT, so to map its verdict onto the
 * per-pair boolean predicate we feed it exactly ONE pair per result.
 */
type WithOverlapCounter = {
  detectLayoutOverlaps: (result: PipelineResult) => number;
};
const pipeline = new FrameworkIntegratedPipeline() as unknown as WithOverlapCounter;

function sceneWithLayoutNodes(nodes: PositionedNode[]): SceneGraph {
  return {
    type: 'flow',
    nodes: nodes.map((n) => ({ id: n.id, label: n.label })),
    edges: [{ source: nodes[0].id, target: nodes[1].id }],
    layout: { nodes, edges: [] },
  } as SceneGraph;
}

function resultWithScenes(scenes: SceneGraph[]): PipelineResult {
  return {
    success: true,
    scenes,
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

/** The invariant under test: the counter's verdict for a pair == the producer's. */
function counterOverlap(a: PositionedNode, b: PositionedNode): boolean {
  return pipeline.detectLayoutOverlaps(resultWithScenes([sceneWithLayoutNodes([a, b])])) > 0;
}

describe('framework-pipeline overlap counter × producer-predicate cross-invariant', () => {
  // -------------------------------------------------------------------------
  // Literal anchors — the concrete bug + its boundaries, at the predicate level
  // -------------------------------------------------------------------------
  describe('literal anchors: counter verdict matches producer predicate', () => {
    it('touching edges (0 px gap) is NOT an overlap — the exact pre-fix false positive', () => {
      // Box A spans x∈[0,120]; box B starts at x=120 → right edge of A == left
      // edge of B. The old strict-`<` test counted this pair as overlapping.
      const a = node('a', 0, 0, 120, 60);
      const b = node('b', 120, 0, 120, 60);
      expect(producerNodesOverlap(a, b, 0)).toBe(false); // producer: no overlap
      expect(counterOverlap(a, b)).toBe(false); // counter: must agree
    });

    it('a 1 px gap is NOT an overlap for either layer', () => {
      const a = node('a', 0, 0, 120, 60);
      const b = node('b', 121, 0, 120, 60);
      expect(producerNodesOverlap(a, b, 0)).toBe(false);
      expect(counterOverlap(a, b)).toBe(false);
    });

    it('a real intersection is flagged by BOTH the counter and the producer', () => {
      const a = node('a', 0, 0, 120, 60);
      const b = node('b', 50, 0, 120, 60); // 50 < 120 → boxes intersect
      expect(producerNodesOverlap(a, b, 0)).toBe(true);
      expect(counterOverlap(a, b)).toBe(true);
    });

    it('a clearly separated pair is cleared by both layers', () => {
      const a = node('a', 0, 0, 120, 60);
      const b = node('b', 500, 0, 120, 60);
      expect(producerNodesOverlap(a, b, 0)).toBe(false);
      expect(counterOverlap(a, b)).toBe(false);
    });

    it('touching along the Y axis is also NOT an overlap', () => {
      // Same X band, B sits directly below A with bottom-of-A == top-of-B.
      const a = node('a', 0, 0, 120, 60);
      const b = node('b', 0, 60, 120, 60);
      expect(producerNodesOverlap(a, b, 0)).toBe(false);
      expect(counterOverlap(a, b)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Randomized composition — counter verdict == producer predicate verdict for
  // every pair, including the touch boundary where they once disagreed.
  // -------------------------------------------------------------------------
  describe('randomized: counter verdict always matches producer predicate', () => {
    it('600 pairs spanning overlap→touch→safe never disagree (X-deciding axis)', () => {
      const rng = mulberry32(0x9f1a77);
      const disagreements: string[] = [];
      for (let i = 0; i < 600; i++) {
        const w1 = 60 + Math.floor(rng() * 200);
        const h1 = 40 + Math.floor(rng() * 120);
        const w2 = 60 + Math.floor(rng() * 200);
        const h2 = 40 + Math.floor(rng() * 120);
        // Same Y band → X gap is the deciding axis. Gap range [-30, 30) covers
        // real overlap (<0), touch (0), and safe (>0).
        const y = Math.floor(rng() * 300);
        const x1 = Math.floor(rng() * 300);
        const gap = Math.floor(rng() * 60) - 30;
        const x2 = x1 + w1 + gap;

        const a = node(`a${i}`, x1, y, w1, h1);
        const b = node(`b${i}`, x2, y, w2, h2);
        const producer = producerNodesOverlap(a, b, 0);
        const counter = counterOverlap(a, b);
        if (producer !== counter) {
          disagreements.push(
            `pair#${i} a=(${x1},${y},${w1}×${h1}) b=(${x2},${y},${w2}×${h2}) gap=${gap} producer=${producer} counter=${counter}`,
          );
        }
      }
      // Surface EVERY disagreement (not just the first) so drift is diagnosable.
      expect(disagreements).toEqual([]);
    });

    it('600 pairs with independent random X/Y positions never disagree', () => {
      const rng2 = mulberry32(0xbadc0de);
      const disagreements: string[] = [];
      for (let i = 0; i < 600; i++) {
        const a = node(
          `a${i}`,
          Math.floor(rng2() * 500),
          Math.floor(rng2() * 500),
          60 + Math.floor(rng2() * 200),
          40 + Math.floor(rng2() * 120),
        );
        const b = node(
          `b${i}`,
          Math.floor(rng2() * 500),
          Math.floor(rng2() * 500),
          60 + Math.floor(rng2() * 200),
          40 + Math.floor(rng2() * 120),
        );
        if (producerNodesOverlap(a, b, 0) !== counterOverlap(a, b)) {
          disagreements.push(
            `pair#${i} a=(${a.x},${a.y},${a.width}×${a.height}) b=(${b.x},${b.y},${b.width}×${b.height})`,
          );
        }
      }
      expect(disagreements).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Defense-in-depth: the two predicates must not silently re-diverge.
  // -------------------------------------------------------------------------
  describe('defense-in-depth: counter and producer predicates cannot be made to disagree', () => {
    it('every integer gap from -30..+30 yields identical verdicts', () => {
      // An exhaustive sweep of the boundary region — stronger than random
      // sampling around the exact threshold where the strict-`<` bug lived.
      for (let gap = -30; gap <= 30; gap++) {
        const a = node('a', 0, 0, 100, 50);
        const b = node('b', 100 + gap, 0, 100, 50);
        expect(producerNodesOverlap(a, b, 0)).toBe(counterOverlap(a, b));
      }
    });
  });
});
