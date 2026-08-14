/**
 * Structural guard: the composite layout-quality pass threshold has ONE source.
 *
 * `0.7` was defined independently THREE times for the SAME concept — the
 * minimum composite layout quality score (balance × crossing × overflow ×
 * density) a layout must reach to pass:
 *
 *   - layout-quality-composite.ts `DEFAULT_THRESHOLD = 0.7` (the scorer's own
 *     pass bar: `compositeScore >= threshold`)
 *   - layout-auto-optimizer.ts `DEFAULT_THRESHOLD = 0.7` (the optimizer loop's
 *     stop bar for the very same scoreLayout() output)
 *   - layout-auto-optimizer.ts `threshold: 0.7` (the legacy function API's
 *     DEFAULTS entry)
 *
 * The optimizer iterates on the composite scorer's output, so the two pass
 * bars are the SAME judgment — if one drifted (e.g. scorer to 0.8) the
 * optimizer would stop optimizing at layouts the scorer still fails.
 *
 * NOT this concept (documented exclusions — different judgments that merely
 * share the value):
 *   - src/analysis/scene-segmenter.ts DEFAULT_CONFIDENCE_THRESHOLD (diagram
 *     detection confidence)
 *   - src/quality/quality-gate.ts criterion thresholds (pipeline quality
 *     gates, not layout geometry)
 *
 * Source anchors use import.meta.url, NOT process.cwd() — cwd-relative reads
 * flake under --maxWorkers>1 (TC-302/313, AGENTS.md テスト規約).
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { describe, it, expect } from '@jest/globals';
import { DEFAULT_LAYOUT_QUALITY_THRESHOLD } from '@/visualization/layout-quality-composite';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const CANONICAL = 'src/visualization/layout-quality-composite.ts';
const CONSUMERS = ['src/visualization/layout-auto-optimizer.ts'];

/** Files allowed to define a 0.7 threshold for a DIFFERENT concept. */
const EXCLUDED = new Set([
  CANONICAL,
  'src/analysis/scene-segmenter.ts', // detection confidence, not layout quality
  'src/quality/quality-gate.ts', // pipeline criterion gates, not layout geometry
]);

/** A local (re)definition of the layout-quality threshold literal. */
const LOCAL_DEFINITION =
  /(DEFAULT_THRESHOLD|DEFAULT_LAYOUT_QUALITY_THRESHOLD)\s*=\s*0\.7\b|\bthreshold\s*:\s*0\.7\b/;

function offendingLines(src: string): string[] {
  return src
    .split('\n')
    .filter(
      (line) =>
        // Doc comments may quote the value ("default: 0.7") — code only.
        !/^\s*(\/\/|\*|\/\*)/.test(line) && LOCAL_DEFINITION.test(line),
    );
}

describe('layout-quality threshold single source', () => {
  it('canonical module exports 0.7', () => {
    expect(DEFAULT_LAYOUT_QUALITY_THRESHOLD).toBe(0.7);
  });

  it.each(CONSUMERS)('%s imports the canonical threshold and has no bare 0.7', (file) => {
    const src = readFileSync(join(REPO_ROOT, file), 'utf-8');
    expect(src).toMatch(/DEFAULT_LAYOUT_QUALITY_THRESHOLD/);
    expect(offendingLines(src)).toEqual([]);
  });

  it('discovery sweep: no src/ file outside exclusions redefines the threshold', () => {
    const offenders: string[] = [];
    for (const file of [
      ...walk(join(REPO_ROOT, 'src/visualization')),
      ...walk(join(REPO_ROOT, 'src/pipeline')),
    ]) {
      const rel = file.slice(REPO_ROOT.length + 1);
      if (EXCLUDED.has(rel)) continue;
      const lines = offendingLines(readFileSync(file, 'utf-8'));
      if (lines.length > 0) offenders.push(`${rel}: ${lines[0].trim()}`);
    }
    expect(offenders).toEqual([]);
  });
});

function walk(absDir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(absDir)) {
    const abs = join(absDir, entry);
    if (statSync(abs).isDirectory()) {
      if (!entry.includes('__tests__')) walk(abs, acc);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\./.test(entry)) {
      acc.push(abs);
    }
  }
  return acc;
}
