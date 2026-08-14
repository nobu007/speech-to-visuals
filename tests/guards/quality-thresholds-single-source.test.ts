/**
 * Structural guard: quality-gate threshold DEFAULTS have ONE source.
 *
 * Before this guard, the default quality thresholds (transcription 0.85,
 * segmentation 0.75, entity/relation 0.80/0.85, renderTime 30000ms,
 * memoryUsage 512MB) were frozen independently in four files:
 *
 *   - src/pipeline/quality-monitor.ts            (QualityMonitor defaults)
 *   - src/framework/auto-improvement-engine.ts   (constructor `??` fallbacks)
 *   - src/framework/recursive-custom-instructions.ts (framework defaults)
 *   - src/pipeline/main-pipeline.ts              (qualityThresholds passed
 *                                                 to the framework — a copy)
 *
 * Two live hazards motivated the single-sourcing:
 *   1. Field-NAME variant: `relationshipAccuracy` (pipeline/quality-monitor)
 *      vs `relationAccuracy` (framework) — both 0.85, invisible to same-name
 *      greps (the MISSED-SIBLING-SITE class).
 *   2. memoryUsage UNIT divergence: quality-monitor and
 *      auto-improvement-engine treat it as MB (512); recursive-custom-
 *      instructions and main-pipeline treat it as BYTES (512*1024*1024).
 *      The canonical module derives BYTES from MB so the 1024× relation is
 *      structural, not re-typed per site (same lesson as the ms/s class).
 *
 * This file pins VALUES and CONSUMER WIRING. The "no site re-freezes a
 * threshold-field literal" discovery sweep lives in the shared registry
 * (tests/guards/frozen-literal-registry.test.ts, rule
 * 'quality-gate threshold defaults …') since round 8 — per-key patterns there
 * are scoped so metric-shaped lines (`memoryUsage: 0.85` stub scores) do not
 * false-positive, and `layoutOverlap: 0` remains the documented sentinel.
 */

import { describe, it, expect } from '@jest/globals';
import { readSource } from './freeze-guard';
import {
  DEFAULT_TRANSCRIPTION_ACCURACY_THRESHOLD,
  DEFAULT_SCENE_SEGMENTATION_F1_THRESHOLD,
  DEFAULT_ENTITY_EXTRACTION_F1_THRESHOLD,
  DEFAULT_RELATION_ACCURACY_THRESHOLD,
  DEFAULT_LAYOUT_OVERLAP_THRESHOLD,
  DEFAULT_EDGE_COMPLETENESS_THRESHOLD,
  DEFAULT_EDGE_RATIO_QUALITY_THRESHOLD,
  DEFAULT_RENDER_TIME_THRESHOLD_MS,
  DEFAULT_MEMORY_USAGE_THRESHOLD_MB,
  DEFAULT_MEMORY_USAGE_THRESHOLD_BYTES,
} from '@/framework/quality-thresholds';

const CONSUMERS = [
  'src/pipeline/quality-monitor.ts',
  'src/framework/auto-improvement-engine.ts',
  'src/framework/recursive-custom-instructions.ts',
  'src/pipeline/main-pipeline.ts',
];

describe('quality-threshold single source (guard)', () => {
  it('canonical module exports the agreed default values', () => {
    expect(DEFAULT_TRANSCRIPTION_ACCURACY_THRESHOLD).toBe(0.85);
    expect(DEFAULT_SCENE_SEGMENTATION_F1_THRESHOLD).toBe(0.75);
    expect(DEFAULT_ENTITY_EXTRACTION_F1_THRESHOLD).toBe(0.80);
    expect(DEFAULT_RELATION_ACCURACY_THRESHOLD).toBe(0.85);
    expect(DEFAULT_LAYOUT_OVERLAP_THRESHOLD).toBe(0);
    expect(DEFAULT_EDGE_COMPLETENESS_THRESHOLD).toBe(0.70);
    expect(DEFAULT_EDGE_RATIO_QUALITY_THRESHOLD).toBe(0.80);
    expect(DEFAULT_RENDER_TIME_THRESHOLD_MS).toBe(30000);
    expect(DEFAULT_MEMORY_USAGE_THRESHOLD_MB).toBe(512);
    // The byte convention must stay 1024× the MB convention — structurally.
    expect(DEFAULT_MEMORY_USAGE_THRESHOLD_BYTES).toBe(512 * 1024 * 1024);
  });

  it('every known default site imports the canonical module', () => {
    for (const rel of CONSUMERS) {
      const src = readSource(rel);
      expect({
        file: rel,
        importsCanonical: src.includes("from '@/framework/quality-thresholds'") ||
          src.includes("from './quality-thresholds'") ||
          src.includes("from '../framework/quality-thresholds'"),
      }).toEqual({ file: rel, importsCanonical: true });
    }
  });

  it('consumer default objects are built from the canonical constants', () => {
    // The four default sites must each reference at least the transcription
    // and segmentation constants — the two fields present in ALL four shapes.
    for (const rel of CONSUMERS) {
      const src = readSource(rel);
      expect({
        file: rel,
        wired: /DEFAULT_TRANSCRIPTION_ACCURACY_THRESHOLD/.test(src) &&
          /DEFAULT_SCENE_SEGMENTATION_F1_THRESHOLD/.test(src),
      }).toEqual({ file: rel, wired: true });
    }
  });
});
