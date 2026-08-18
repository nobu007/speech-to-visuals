/**
 * Cross-invariant (intersection) fuzz: pins the LIVE quality-monitor overlap
 * CHECKER (QualityMonitor.detectOverlaps, reached via assessPipelineQuality on
 * the main-pipeline hot path) against the layout engine's canonical overlap
 * PREDICATE (nodesOverlap from layout-utils, spacing 0).
 *
 * This mirrors zero-overlap-cross-invariant-fuzz.test.ts, which pins the
 * (currently dormant) quality-gate.ts gate. THIS file pins the checker that is
 * actually wired into production: main-pipeline.ts calls
 * qualityMonitor.assessPipelineQuality, whose assessLayoutQuality →
 * detectOverlaps → nodesOverlap contributes 30% of accuracyScore (itself 40% of
 * overallScore), and overallScore gates checkDeploymentReadiness (≥ 0.7).
 *
 * Previously the monitor inlined `margin = 10` with strict `<` while the
 * producer guarantees strict zero-overlap (spacing 0, `<=`/`>=`): a correct
 * zero-overlap layout left with a 0–10 px gap (the resolver advances nodes in
 * fractional steps and stops the moment they no longer strictly intersect) was
 * reported OVERLAPPING by the monitor but NOT by the producer → a false quality
 * penalty on correct output (scene scored 0.3 instead of 1.0). The monitor now
 * delegates to the producer predicate; this file pins the agreement so any
 * future drift is caught immediately.
 *
 * Reuses the shared fuzz helper (@tests/helpers/fuzz) for determinism.
 */

import { describe, it, expect } from '@jest/globals';
import { mulberry32 } from '@tests/helpers/fuzz';
import { nodesOverlap as producerNodesOverlap } from '@/visualization/layout-utils';
import type { PositionedNode, SceneGraph } from '@stv/core/types/diagram';
import type { PipelineResult } from '@/pipeline/types';

const { QualityMonitor } = await import('../quality-monitor');

/** Minimal valid positioned node. width/height are the non-deprecated fields. */
function node(id: string, x: number, y: number, width: number, height: number): PositionedNode {
  return { id, label: id, x, y, width, height };
}

/**
 * White-box access to the monitor's private overlap scan. assessPipelineQuality
 * entangles the overlap verdict with a positioning score, so the only way to
 * pin the predicate precisely is to read it directly — exactly the invariant we
 * need: the monitor's "do these overlap?" must equal the producer's.
 *
 * Round 39: the pair-level private predicate was folded into `detectOverlaps`
 * (defensive coordinate coercion + `hasOverlapPairs` from layout-utils), so the
 * scan itself is now the live white-box handle — for a 2-node array its verdict
 * IS the pair verdict, including the coercion boundary.
 */
type WithOverlapScan = { detectOverlaps: (nodes: unknown[]) => boolean };
const monitor = new QualityMonitor() as unknown as WithOverlapScan;
const monitorOverlap = (a: PositionedNode, b: PositionedNode): boolean => monitor.detectOverlaps([a, b]);

// ---------------------------------------------------------------------------
// Helpers for the public-path behavioral anchor (exercises the LIVE scoring
// path end-to-end, isolating the overlap component by holding positioning
// spread identical across the compared scenes).
// ---------------------------------------------------------------------------

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

describe('quality-monitor overlap × producer-predicate cross-invariant', () => {
  // -------------------------------------------------------------------------
  // Literal anchors — the concrete bug + its boundaries, at the predicate level
  // -------------------------------------------------------------------------
  describe('literal anchors: monitor verdict matches producer predicate', () => {
    it('5 px gap is ZERO overlap: monitor must not flag what the producer clears', () => {
      // Box A spans x∈[0,120]; box B starts at x=125 → a 5 px gap, same Y band
      // so the X gap is the deciding axis. Genuinely zero-overlap. Before the
      // fix the monitor (margin 10) flagged this exact pair as overlapping.
      const a = node('a', 0, 0, 120, 60);
      const b = node('b', 125, 0, 120, 60);
      expect(producerNodesOverlap(a, b, 0)).toBe(false); // producer: no overlap
      expect(monitorOverlap(a, b)).toBe(false); // monitor: must agree
    });

    it('touching edges (0 px gap) is NOT an overlap for either layer', () => {
      const a = node('a', 0, 0, 120, 60);
      const b = node('b', 120, 0, 120, 60); // right edge of A == left edge of B
      expect(producerNodesOverlap(a, b, 0)).toBe(false);
      expect(monitorOverlap(a, b)).toBe(false);
    });

    it('9 px gap (inside the old 10 px danger zone) is ZERO overlap for both', () => {
      const a = node('a', 0, 0, 120, 60);
      const b = node('b', 129, 0, 120, 60); // 9 px gap — falsely flagged pre-fix
      expect(producerNodesOverlap(a, b, 0)).toBe(false);
      expect(monitorOverlap(a, b)).toBe(false);
    });

    it('a real intersection is flagged by BOTH the monitor and the producer', () => {
      const a = node('a', 0, 0, 120, 60);
      const b = node('b', 50, 0, 120, 60); // 50 < 120 → boxes intersect
      expect(producerNodesOverlap(a, b, 0)).toBe(true);
      expect(monitorOverlap(a, b)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Public-path behavioral anchor — the LIVE scoring path must not penalize a
  // producer-cleared 5 px gap. Positioning spread is held IDENTICAL across the
  // two scenes (same min/max x and y), so the ONLY accuracyScore difference is
  // the overlap component. Before the fix, GAP5 was penalized and scored lower
  // than FAR; after the fix they are equal.
  // -------------------------------------------------------------------------
  describe('live assessPipelineQuality path: 5 px gap is not penalized', () => {
    it('a producer-cleared 5 px-gap scene scores equal to a clearly-separated scene', async () => {
      // GAP5: n0..n1 share a Y band with a 5 px X gap (producer clears it);
      //       n2 sits far out to give BOTH scenes an identical positioning
      //       spread (x∈[0,1000], y∈[0,400]).
      const gap5 = sceneWithLayoutNodes([
        node('n0', 0, 0, 120, 60),
        node('n1', 125, 0, 120, 60), // 5 px gap from n0
        node('n2', 1000, 400, 120, 60),
      ]);
      // FAR: identical structure & identical positioning spread; only n1's X
      //      moves to a clearly non-overlapping position.
      const far = sceneWithLayoutNodes([
        node('n0', 0, 0, 120, 60),
        node('n1', 500, 0, 120, 60), // 380 px gap from n0
        node('n2', 1000, 400, 120, 60),
      ]);

      const fresh = new QualityMonitor();
      const scoreGap5 = (await fresh.assessPipelineQuality(resultWithScenes([gap5]))).accuracyScore;
      const scoreFar = (await fresh.assessPipelineQuality(resultWithScenes([far]))).accuracyScore;

      // Every accuracyScore component except the layout-overlap term is
      // identical between the two scenes (same type, node count, edges,
      // positioning spread). After the fix the overlap terms agree (neither
      // overlaps), so the scores must be exactly equal. Pre-fix this failed:
      // gap5's overlap penalty (0.3 vs 1.0) dragged its score below far's.
      expect(scoreGap5).toBe(scoreFar);
    });
  });

  // -------------------------------------------------------------------------
  // Randomized composition — monitor verdict == producer predicate verdict for
  // every pair, including the 0–10 px danger zone where they once disagreed.
  // -------------------------------------------------------------------------
  describe('randomized: monitor verdict always matches producer predicate', () => {
    it('600 pairs spanning overlap→touch→danger-zone→safe never disagree', () => {
      const rng = mulberry32(0x5a1e0e);
      const disagreements: string[] = [];
      for (let i = 0; i < 600; i++) {
        const w1 = 60 + Math.floor(rng() * 200);
        const h1 = 40 + Math.floor(rng() * 120);
        const w2 = 60 + Math.floor(rng() * 200);
        const h2 = 40 + Math.floor(rng() * 120);
        // Same Y band → X gap is the deciding axis. Gap range [-20, 40) covers
        // real overlap (<0), touch (0), the 0–10 px danger zone, and safe (>10).
        const y = Math.floor(rng() * 300);
        const x1 = Math.floor(rng() * 300);
        const gap = Math.floor(rng() * 60) - 20;
        const x2 = x1 + w1 + gap;

        const a = node(`a${i}`, x1, y, w1, h1);
        const b = node(`b${i}`, x2, y, w2, h2);
        const producer = producerNodesOverlap(a, b, 0);
        const mon = monitorOverlap(a, b);
        if (producer !== mon) {
          disagreements.push(
            `pair#${i} a=(${x1},${y},${w1}×${h1}) b=(${x2},${y},${w2}×${h2}) gap=${gap} producer=${producer} monitor=${mon}`,
          );
        }
      }
      // Surface EVERY disagreement (not just the first) so drift is diagnosable.
      expect(disagreements).toEqual([]);
    });

    it('600 pairs with independent random X/Y positions never disagree', () => {
      const rng2 = mulberry32(0xc0ffee);
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
        if (producerNodesOverlap(a, b, 0) !== monitorOverlap(a, b)) {
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
  describe('defense-in-depth: monitor and producer predicates cannot be made to disagree', () => {
    it('every integer gap from -30..+30 yields identical verdicts', () => {
      // An exhaustive sweep of the boundary region — stronger than random
      // sampling around the exact threshold where the old margin-10 bug lived.
      for (let gap = -30; gap <= 30; gap++) {
        const a = node('a', 0, 0, 100, 50);
        const b = node('b', 100 + gap, 0, 100, 50);
        expect(producerNodesOverlap(a, b, 0)).toBe(monitorOverlap(a, b));
      }
    });
  });
});
