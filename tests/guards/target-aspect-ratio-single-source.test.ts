/**
 * Structural guard: the 16:9 layout target aspect ratio has ONE source.
 *
 * `TARGET_ASPECT_RATIO = 16 / 9` was previously re-declared as a local const in
 * 10 layout modules (canvas-calculator, layout-engine-v2, and 8 strategies),
 * under a second name `ASPECT_RATIO` in matrix-strategy, and inlined as a bare
 * `16 / 9` literal in timeline-strategy / overlap-resolver /
 * enhanced-zero-overlap-layout — 14 sites sharing one value with no link.
 * Every copy coincided with 16:9, so a behavioral RED→GREEN was impossible
 * (the latent-coincident desync pattern, same class as REQ-293). Changing one
 * copy would silently leave the others: strategies would grid-pack for one
 * ratio while canvas-calculator pads to another, and the reported
 * `metrics.aspectRatio` would lie about the canvas actually produced.
 *
 * The canonical constant is DERIVED from the default canvas dimensions
 * (1920/1080), so the layout target can never contradict the default canvas.
 *
 * This guard pins:
 *   1. The canonical export equals the default-canvas ratio and 16:9.
 *   2. No production module under src/visualization declares or inlines the
 *      `16 / 9` numeric literal in any shape (`16 / 9`, `16/9`, `16 /9`).
 *   3. Every known consumer imports the canonical constant from
 *      canvas-dimensions (not a re-inlined copy).
 *
 * Scope note: the sweep covers src/visualization only — the diagram-canvas
 * module boundary. The CSS string `aspectRatio: '16/9'` in
 * src/components/InteractiveResultViewer.tsx is a browser style value on a
 * different layer (like Video.tsx's 1920×1080, see canvas-dimensions.ts) and
 * is intentionally out of scope.
 *
 * Source anchors use import.meta.url, NOT process.cwd() — cwd-relative reads
 * flake under --maxWorkers>1 (TC-302/313, AGENTS.md テスト規約).
 */

import { readFileSync, readdirSync, Dirent } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname, relative } from 'path';
import { describe, it, expect } from '@jest/globals';
import {
  TARGET_ASPECT_RATIO,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
} from '@/visualization/canvas-dimensions';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const VIS_DIR = join(REPO_ROOT, 'src', 'visualization');
const CANONICAL_REL = join('src', 'visualization', 'canvas-dimensions.ts');

/** Matches `16 / 9`, `16/9`, `16 /9` — const declarations and inline literals alike. */
const ASPECT_LITERAL = /16\s*\/\s*9/;

/** Files that must consume the canonical constant (all 14 former dup sites). */
const CONSUMERS = [
  'src/visualization/canvas-calculator.ts',
  'src/visualization/layout-engine-v2.ts',
  'src/visualization/overlap-resolver.ts',
  'src/visualization/enhanced-zero-overlap-layout.ts',
  'src/visualization/strategies/general-strategy.ts',
  'src/visualization/strategies/flowchart-strategy.ts',
  'src/visualization/strategies/tree-strategy.ts',
  'src/visualization/strategies/conceptmap-strategy.ts',
  'src/visualization/strategies/flow-strategy.ts',
  'src/visualization/strategies/mindmap-strategy.ts',
  'src/visualization/strategies/network-strategy.ts',
  'src/visualization/strategies/comparison-strategy.ts',
  'src/visualization/strategies/matrix-strategy.ts',
  'src/visualization/strategies/timeline-strategy.ts',
];

function listProductionFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }) as Dirent[]) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      results.push(...listProductionFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      if (entry.name.includes('.test.') || entry.name.includes('.spec.')) continue;
      results.push(fullPath);
    }
  }
  return results;
}

describe('target-aspect-ratio single source (layout module)', () => {
  it('canonical constant is derived from the default canvas and equals 16:9', () => {
    // Derivation pin: the layout target can never contradict DEFAULT_CANVAS_*.
    expect(TARGET_ASPECT_RATIO).toBe(DEFAULT_CANVAS_WIDTH / DEFAULT_CANVAS_HEIGHT);
    // Value pin: if this ever changes, every strategy's grid packing and the
    // reported metrics.aspectRatio change with it — one place, consciously.
    expect(TARGET_ASPECT_RATIO).toBeCloseTo(16 / 9, 12);
  });

  it('no visualization module re-declares or inlines the 16:9 literal', () => {
    const files = listProductionFiles(VIS_DIR);
    expect(files.length).toBeGreaterThan(20); // sanity: sweep actually walked

    const violations: string[] = [];
    for (const file of files) {
      const rel = relative(REPO_ROOT, file);
      // The canonical file is the one place the ratio is defined (by
      // derivation it holds no 16/9 literal at all, but stay explicit).
      if (rel === CANONICAL_REL) continue;
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (ASPECT_LITERAL.test(line)) violations.push(`${rel}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(violations).toEqual([]);
  });

  it('every known consumer imports the canonical constant', () => {
    for (const rel of CONSUMERS) {
      const src = readFileSync(join(REPO_ROOT, rel), 'utf8');
      expect(src).toContain('TARGET_ASPECT_RATIO');
      expect(src).toMatch(/from ['"](\.\.?\/|@\/visualization\/)canvas-dimensions['"]/);
    }
  });
});
