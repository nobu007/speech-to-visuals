/**
 * Dual QualityMonitor scale contract (Phase 180 / REQ-382 / TC-366-01).
 *
 * Two same-named monitors deliberately keep DIFFERENT score scales:
 *
 *   - `src/quality/quality-monitor.ts`   QualityAssessment.overallScore  → 0-1
 *     (weighted sums of 0-1 assessors; deployment gate reads 0.7/0.9)
 *   - `src/pipeline/quality-monitor.ts`  QualityReport.overallScore      → 0-100
 *     (base 100, violation deductions, bonus +5s; status tiers 90/75/60/40)
 *
 * No production consumer currently imports both (verified 2026-08-22), so the
 * risk is LATENT: a future file that reads one monitor's score against the
 * other's thresholds gets a silent 100x error — a 0-1 score of 0.85 fails a
 * `>= 70` gate, or a 0-100 score of 85 passes a `>= 0.7` gate. That is the
 * undocumented-unit class (SceneGraph ms/s ×1000) on the score axis. The
 * scale docs were absent on the 0-1 side entirely (REQ-382 closes that).
 *
 * This guard pins the contract from four directions so a scale change or a
 * cross-wired import cannot land silently:
 *
 *   1. behavioral: the 0-1 monitor produces all four scores inside [0,1] on
 *      a rich success fixture (a ×100 rescale anywhere breaks it),
 *   2. behavioral: the 0-100 monitor produces overallScore > 1 (in fact 100,
 *      'excellent') for measured-good metrics and fails closed (0/critical)
 *      with no history — > 1 is the scale discriminator vs leg 1,
 *   3. source-anchored: both interfaces carry their scale doc comment
 *      (`// 0-1` / `// 0-100`) at the overallScore declaration,
 *   4. cross-wiring invariant: no non-test src file imports BOTH monitors
 *      (the only way the two scales can meet in one module today).
 *
 * Mutation witness: MW-046 (3 independent RED: ×30 rescale of the 0-1
 * performance weight, scale-doc removal, dual-import injection).
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve, dirname, normalize } from 'node:path';
import type { PipelineResult } from '@/pipeline/types';
import type { PositionedNode, SceneGraph, DiagramType } from '@stv/core/types/diagram';

const { QualityMonitor: FractionalQualityMonitor } = await import(
  '@/quality/quality-monitor'
);
const { getQualityMonitor } = await import('@/pipeline/quality-monitor');

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

// ---------------------------------------------------------------------------
// Leg 1 — behavioral: the src/quality monitor scores on the 0-1 scale
// ---------------------------------------------------------------------------

function positionedNode(id: string, x: number, y: number): PositionedNode {
  return { id, label: id, x, y, width: 120, height: 60 };
}

/** Two well-separated nodes → no overlap, generous positioning spread. */
const LAYOUT_NODES: PositionedNode[] = [
  positionedNode('n0', 100, 100),
  positionedNode('n1', 700, 500),
];

function richScene(): SceneGraph {
  const nodes = LAYOUT_NODES.map((n) => ({ id: n.id, label: n.label }));
  return {
    type: 'flowchart' as DiagramType,
    nodes,
    edges: [{ source: 'n0', target: 'n1' }],
    layout: { nodes: LAYOUT_NODES, edges: [] },
    summary: 'This is a sufficiently long summary to earn the summary bonus.',
    keyphrases: ['alpha', 'beta'],
  } as unknown as SceneGraph;
}

function richSuccessResult(): PipelineResult {
  return {
    success: true,
    scenes: [richScene()],
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

describe('dual QualityMonitor scale contract (REQ-382 / TC-366-01)', () => {
  describe('leg 1: src/quality QualityMonitor scores 0-1', () => {
    it('all four QualityAssessment scores are fractions in [0,1]', async () => {
      const monitor = new FractionalQualityMonitor();
      const a = await monitor.assessPipelineQuality(richSuccessResult());

      // Non-vacuous: the fixture is a rich success, so the scores are real
      // values well inside the range — not a degenerate all-zero pass.
      expect(a.overallScore).toBeGreaterThan(0);
      for (const score of [a.overallScore, a.performanceScore, a.accuracyScore, a.reliabilityScore]) {
        expect(score).toBeGreaterThanOrEqual(0);
        // The discriminator vs the sibling monitor: a 0-100 rescale of any
        // weighted component pushes overallScore past 1.
        expect(score).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('leg 2: src/pipeline QualityMonitor scores 0-100', () => {
    // The pipeline monitor is a singleton (private constructor). Jest gives
    // this file a fresh module registry, so the FIRST it below observes the
    // empty-history branch; declaration order matters and is intentional.
    it('with no recorded metrics the report fails closed (0 / critical)', () => {
      const report = getQualityMonitor().generateReport();
      expect(report.overallScore).toBe(0);
      expect(report.status).toBe('critical');
    });

    it('measured-good metrics yield overallScore > 1 (100 / excellent)', () => {
      const monitor = getQualityMonitor();
      monitor.recordMetrics({
        processingTime: 1000,
        memoryUsage: 100,
        cacheHitRate: 0.9,
        transcriptionAccuracy: 0.95,
        sceneSegmentationF1: 0.9,
        entityExtractionF1: 0.9,
        relationshipAccuracy: 0.9,
        layoutOverlap: 0, // MEASURED zero-overlap (REQ-375 count contract)
        edgeCompleteness: 0.95,
        edgeRatioQuality: 1.0,
        confidenceScore: 0.9,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
      });

      const report = monitor.generateReport();
      // > 1 is the scale discriminator against leg 1: only a 0-100 score can
      // exceed 1. The clamped ceiling also proves the range is [0,100].
      expect(report.overallScore).toBeGreaterThan(1);
      expect(report.overallScore).toBeLessThanOrEqual(100);
      expect(report.status).toBe('excellent');
    });
  });

  // -------------------------------------------------------------------------
  // Leg 3 — source-anchored: the scale is documented at both declarations
  // -------------------------------------------------------------------------
  describe('leg 3: scale doc comments pin both overallScore declarations', () => {
    const fractionalSrc = readFileSync(
      join(REPO_ROOT, 'src/quality/quality-monitor.ts'),
      'utf-8',
    );
    const percentSrc = readFileSync(
      join(REPO_ROOT, 'src/pipeline/quality-monitor.ts'),
      'utf-8',
    );

    it('src/quality QualityAssessment.overallScore is documented `// 0-1`', () => {
      // (?!\d) keeps `// 0-1` from matching the sibling's `// 0-100`.
      expect(fractionalSrc).toMatch(/overallScore: number; \/\/ 0-1(?!\d)/);
    });

    it('src/pipeline QualityReport.overallScore is documented `// 0-100`', () => {
      expect(percentSrc).toMatch(/overallScore: number; \/\/ 0-100/);
    });

    it('improvementPotential keeps its 0-100 doc (same scale family)', () => {
      expect(percentSrc).toMatch(/improvementPotential: number; \/\/ 0-100/);
    });
  });

  // -------------------------------------------------------------------------
  // Leg 4 — cross-wiring invariant: no src file imports BOTH monitors
  // -------------------------------------------------------------------------
  describe('leg 4: no non-test src file imports both QualityMonitors', () => {
    /** Exact module tail — `streaming-quality-monitor` etc. never match. */
    const MONITOR_TAIL_RE = /(^|\/)quality-monitor$/;

    function resolveSpecifier(specifier: string, importerDir: string): string {
      return specifier.startsWith('@/')
        ? normalize(join(REPO_ROOT, 'src', specifier.slice(2)))
        : normalize(resolve(importerDir, specifier));
    }

    /**
     * Classify a resolved module path as naming a monitor. Barrels hop one
     * level: `@/quality` (src/quality/index.ts) re-exports the fractional
     * monitor, so a barrel import is as much a cross-wiring vector as a
     * direct one. `@/pipeline`'s barrel does NOT re-export its monitor
     * (verified 2026-08-22) — extend the hop gate below if that ever changes.
     */
    function monitorNamedBy(specifier: string, importerDir: string): 'fractional' | 'percent' | null {
      const base = resolveSpecifier(specifier, importerDir);
      if (base.endsWith(join('src', 'quality', 'quality-monitor'))) return 'fractional';
      if (base.endsWith(join('src', 'pipeline', 'quality-monitor'))) return 'percent';
      if (!/(^|\/)quality$/.test(specifier)) return null;
      for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
        let barrel: string;
        try {
          barrel = readFileSync(candidate, 'utf-8');
        } catch {
          continue;
        }
        for (const reExport of barrel.matchAll(/from\s+'([^']+)'/g)) {
          const inner = reExport[1] as string;
          if (!MONITOR_TAIL_RE.test(inner)) continue;
          const innerPath = resolveSpecifier(inner, dirname(candidate));
          if (innerPath.endsWith(join('src', 'quality', 'quality-monitor'))) return 'fractional';
          if (innerPath.endsWith(join('src', 'pipeline', 'quality-monitor'))) return 'percent';
        }
      }
      return null;
    }

    /** Recursive .ts/.tsx listing under the given directory (tests excluded). */
    function listSrcFiles(dir: string, out: string[] = []): string[] {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '__tests__' || entry.name === '__mocks__') continue;
          listSrcFiles(full, out);
        } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
          out.push(full);
        }
      }
      return out;
    }

    it('every non-test src file imports at most one of the two monitors', () => {
      const files = listSrcFiles(join(REPO_ROOT, 'src'));

      // Anti-vacuity: the sweep must actually cover the src tree AND the
      // classifier must resolve both import styles — the fractional monitor
      // via the `@/quality` barrel (main-pipeline) and the percent monitor
      // via direct specifiers (orchestrator / simple-pipeline / gemini-analyzer).
      expect(files.length).toBeGreaterThan(100);

      const importRe = /from\s+'([^']+)'/g;
      let fractionalFiles = 0;
      let percentFiles = 0;
      for (const file of files) {
        const text = readFileSync(file, 'utf-8');
        const seen = new Set<'fractional' | 'percent'>();
        for (const m of text.matchAll(importRe)) {
          const named = monitorNamedBy(m[1] as string, dirname(file));
          if (named !== null) seen.add(named);
        }
        if (seen.has('fractional')) fractionalFiles += 1;
        if (seen.has('percent')) percentFiles += 1;
        // A module reading both scales can mix them up by 100x. If you
        // genuinely need both here, split the consumer or convert at ONE
        // documented boundary — then update this invariant deliberately.
        expect(Array.from(seen).sort().join('+')).not.toBe('fractional+percent');
      }
      expect(fractionalFiles).toBeGreaterThanOrEqual(1);
      expect(percentFiles).toBeGreaterThanOrEqual(3);
    });
  });
});
