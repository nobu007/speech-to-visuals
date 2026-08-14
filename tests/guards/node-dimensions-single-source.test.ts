/**
 * Structural guard: default node dimensions have ONE source (round 6 sweep).
 *
 * `src/visualization/node-dimensions.ts` already exports DEFAULT_NODE_WIDTH
 * (120) and DEFAULT_NODE_HEIGHT (60) — the canonical fallback used by
 * getNodeWidth/getNodeHeight. But at the time this guard was written, the same
 * values were independently hardcoded at 22 sites under src/visualization
 * (default LayoutConfig literals, `config.nodeWidth || 120` /
 * `config.nodeHeight || 60` strategy fallbacks, and `const nodeHeight = 60`
 * locals in FallbackLayoutStrategy). Any future retune of the canonical
 * default would silently leave those 22 sites behind — the exact freeze class
 * closed for DEFAULT_FPS / TARGET_ASPECT_RATIO / scene-duration in rounds 4-5.
 *
 * This guard pins:
 *   1. The canonical module exports 120 / 60.
 *   2. Every known consumer imports the canonical constants and carries no
 *      bare nodeWidth/nodeHeight default literal.
 *   3. Discovery sweep: NO file under src/visualization (outside the canonical
 *      module) couples `nodeWidth` to 120 or `nodeHeight` to 60 — catches NEW
 *      files that reintroduce the drift.
 *
 * Intentionally NOT covered (different semantics, left as literals):
 *   - per-diagram-type tuned dimensions (advanced-layouts.ts tree/timeline
 *     100/50, 140/70; FallbackLayoutStrategy's 140 width and line-47 80 height)
 *   - `nodeSeparation: 60` / NODE_SEP (spacing, not node height)
 *
 * Source anchors use import.meta.url, NOT process.cwd() — cwd-relative
 * reads flake under --maxWorkers>1 (TC-302/313, AGENTS.md テスト規約).
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { describe, it, expect } from '@jest/globals';
import {
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_HEIGHT,
} from '@/visualization/node-dimensions';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const CONSUMERS = [
  'src/visualization/layout-engine.ts',
  'src/visualization/complex-layout-engine.ts',
  'src/visualization/enhanced-zero-overlap-layout.ts',
  'src/visualization/layout/strategies/LayoutStrategy.ts',
  'src/visualization/strategies/TimelineLayoutStrategy.ts',
  'src/visualization/strategies/TreeLayoutStrategy.ts',
  'src/visualization/strategies/FlowchartLayoutStrategy.ts',
  'src/visualization/strategies/NetworkLayoutStrategy.ts',
  'src/visualization/strategies/ConceptMapLayoutStrategy.ts',
  'src/visualization/strategies/ComparisonLayoutStrategy.ts',
  'src/visualization/strategies/FallbackLayoutStrategy.ts',
];

/** Files allowed to carry the default-dimension literals. */
const EXCLUDED = new Set([
  'src/visualization/node-dimensions.ts', // the canonical source itself
]);

/**
 * Lines that couple the nodeWidth/nodeHeight identifier to its bare default
 * literal, in any of the sibling syntactic shapes the freeze took:
 * object literal (`nodeHeight: 60`), local const (`const nodeHeight = 60`),
 * and fallback (`config.nodeHeight || 60`).
 */
function offendingLines(src: string): string[] {
  return src.split('\n').filter(
    (line) =>
      /nodeWidth\s*(:|=|\|\|)\s*120\b/.test(line) ||
      /nodeHeight\s*(:|=|\|\|)\s*60\b/.test(line),
  );
}

function walk(dirRel: string, acc: string[]): string[] {
  for (const entry of readdirSync(join(REPO_ROOT, dirRel))) {
    const rel = `${dirRel}/${entry}`;
    if (statSync(join(REPO_ROOT, rel)).isDirectory()) {
      // Co-located __tests__ hold layout fixtures, not production defaults.
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

describe('node-dimension defaults single source (round 6)', () => {
  it('canonical module exports 120 width / 60 height', () => {
    expect(DEFAULT_NODE_WIDTH).toBe(120);
    expect(DEFAULT_NODE_HEIGHT).toBe(60);
  });

  it.each(CONSUMERS)('%s imports the canonical constants and has no bare defaults', (file) => {
    const src = readFileSync(join(REPO_ROOT, file), 'utf-8');
    expect(src).toMatch(/DEFAULT_NODE_(WIDTH|HEIGHT)/);
    expect(offendingLines(src)).toEqual([]);
  });

  it('discovery sweep: no src/visualization file outside the canonical module hardcodes the defaults', () => {
    const offenders: string[] = [];
    for (const file of walk('src/visualization', [])) {
      if (EXCLUDED.has(file)) continue;
      const lines = offendingLines(readFileSync(join(REPO_ROOT, file), 'utf-8'));
      if (lines.length > 0) offenders.push(`${file}: ${lines[0].trim()}`);
    }
    expect(offenders).toEqual([]);
  });
});
