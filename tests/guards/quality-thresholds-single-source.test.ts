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
 * This guard pins:
 *   1. The canonical module exports the agreed default values.
 *   2. Every known default site imports the canonical module.
 *   3. Discovery sweep: NO file under src/ (outside the canonical module)
 *      re-freezes a threshold-field key to a bare threshold literal —
 *      catches NEW files (and NEW field spellings) that reintroduce the
 *      freeze. `layoutOverlap: 0` is the documented disable sentinel and
 *      intentionally not swept (0 is indistinguishable from metric-zero).
 *
 * Source anchors use import.meta.url, NOT process.cwd() — cwd-relative
 * reads flake under --maxWorkers>1 (TC-302/313, AGENTS.md テスト規約).
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { describe, it, expect } from '@jest/globals';
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

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const CANONICAL = 'src/framework/quality-thresholds.ts';

const CONSUMERS = [
  'src/pipeline/quality-monitor.ts',
  'src/framework/auto-improvement-engine.ts',
  'src/framework/recursive-custom-instructions.ts',
  'src/pipeline/main-pipeline.ts',
];

/**
 * Files allowed to couple a threshold-field key to a bare literal.
 * Every entry needs a documented reason — an exclusion without a reason is
 * itself a defect.
 */
const EXCLUDED = new Set([
  CANONICAL, // the source itself
]);

/**
 * Per-key frozen-literal shapes. Values are scoped per key so metric-shaped
 * lines do not false-positive: e.g. recursive-custom-instructions'
 * `memoryUsage: 0.85` is a stubbed quality-check SCORE (0-1), not a byte
 * budget — only the 512 budget shape is swept for that key.
 */
const FROZEN_DEFAULTS: RegExp[] = [
  // Ratio gates, both spellings of the relation variant.
  new RegExp(
    `^\\s*(?:transcriptionAccuracy|sceneSegmentationF1|entityExtractionF1|relationAccuracy|relationshipAccuracy|edgeCompleteness|edgeRatioQuality)\\s*:\\s*(?:0\\.85|0\\.75|0\\.80|0\\.70)\\s*[,})]`
  ),
  // Render-time budget (ms).
  /^\s*renderTime\s*:\s*30000\s*[,})]/,
  // Memory budget — MB literal (the `512 * 1024 * 1024` byte shape starts
  // with the same bare 512, so one pattern covers both conventions).
  /^\s*memoryUsage\s*:\s*512\s*[,})*/]/,
];

/**
 * A threshold-field key assigned a bare threshold literal — e.g.
 *   transcriptionAccuracy: 0.85,
 *   memoryUsage: 512 * 1024 * 1024,
 * `layoutOverlap: 0` (single-digit sentinel) and metric-shaped lines
 * (`entityExtractionF1: cond ? 0.85 : 0.3`) deliberately do NOT match.
 */
function isFrozenDefault(line: string): boolean {
  return FROZEN_DEFAULTS.some((re) => re.test(line));
}

function walk(dirRel: string, acc: string[]): string[] {
  for (const entry of readdirSync(join(REPO_ROOT, dirRel))) {
    const rel = `${dirRel}/${entry}`;
    if (statSync(join(REPO_ROOT, rel)).isDirectory()) {
      // Co-located __tests__ hold metric fixtures, not production thresholds.
      if (!entry.includes('__tests__')) walk(rel, acc);
    } else if (
      (rel.endsWith('.ts') || rel.endsWith('.tsx')) &&
      !/\.(test|spec)\./.test(rel)
    ) {
      acc.push(rel);
    }
  }
  return acc;
}

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

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
      const src = read(rel);
      expect({
        file: rel,
        importsCanonical: src.includes("from '@/framework/quality-thresholds'") ||
          src.includes("from './quality-thresholds'") ||
          src.includes("from '../framework/quality-thresholds'"),
      }).toEqual({ file: rel, importsCanonical: true });
    }
  });

  it('discovery sweep: no src/ file re-freezes a threshold default literal', () => {
    const offenders: string[] = [];
    for (const rel of walk('src', [])) {
      if (EXCLUDED.has(rel)) continue;
      const lines = read(rel).split('\n');
      lines.forEach((line, i) => {
        if (isFrozenDefault(line)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('consumer default objects are built from the canonical constants', () => {
    // The four default sites must each reference at least the transcription
    // and segmentation constants — the two fields present in ALL four shapes.
    for (const rel of CONSUMERS) {
      const src = read(rel);
      expect({
        file: rel,
        wired: /DEFAULT_TRANSCRIPTION_ACCURACY_THRESHOLD/.test(src) &&
          /DEFAULT_SCENE_SEGMENTATION_F1_THRESHOLD/.test(src),
      }).toEqual({ file: rel, wired: true });
    }
  });
});
