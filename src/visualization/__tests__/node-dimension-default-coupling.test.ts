/**
 * Structural source-coupling guard for node-dimension defaults (REQ-291).
 *
 * `DEFAULT_NODE_WIDTH` (120) / `DEFAULT_NODE_HEIGHT` (60) are the single source
 * of truth in `src/visualization/node-dimensions.ts`, and `getNodeWidth` /
 * `getNodeHeight` default their `fallback` parameter to them. Behavioral
 * RED→GREEN is impossible here because every re-introduction coincides with the
 * canonical value (the A121 §3 lesson), so this test guards the COUPLING at the
 * source-text level: no production call site may re-inline the literal default
 * as a fallback arg, and no module may shadow the constants with a local
 * redeclaration. Both patterns silently desync the moment the canonical value
 * changes.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  getNodeWidth,
  getNodeHeight,
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_HEIGHT,
} from '../node-dimensions';
import type { PositionedNode } from '@/types/diagram';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** The canonical definition file — the one place these literals may appear. */
const CANONICAL_FILE = path.join('src', 'visualization', 'node-dimensions.ts');

/**
 * Inlining the canonical default as an explicit fallback arg, e.g.
 * `getNodeWidth(node, 120)`. Such a call is behaviorally identical to
 * `getNodeWidth(node)` today but freezes the literal, so a future change to
 * `DEFAULT_NODE_WIDTH` would not propagate. Intentionally-different fallbacks
 * (`getNodeWidth(n, 0)`, `getNodeWidth(n, 1)`) are NOT matched and remain valid.
 */
const INLINED_DEFAULT_FALLBACK =
  /getNode(?:Width)\s*\(\s*[^,()]+,\s*120\s*\)|getNode(?:Height)\s*\(\s*[^,()]+,\s*60\s*\)/;

/**
 * A local redeclaration that shadows the canonical export, e.g.
 * `const DEFAULT_NODE_WIDTH = 120;`. Prevents per-module drift.
 */
const LOCAL_REDECLARATION =
  /\bconst\s+DEFAULT_NODE_(?:WIDTH|HEIGHT)\s*=\s*(?:120|60)\s*;/;

function getAllProductionSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'coverage', '__tests__'].includes(entry.name)) continue;
      results.push(...getAllProductionSourceFiles(fullPath));
    } else if (entry.name.match(/\.(ts|tsx)$/)) {
      if (entry.name.includes('.test.') || entry.name.includes('.spec.')) continue;
      results.push(fullPath);
    }
  }
  return results;
}

describe('REQ-291: node-dimension defaults are single-sourced', () => {
  test('canonical constants hold their documented values', () => {
    // Locking the canonical values makes the "coincide today" desync detectable:
    // if these ever change, every frozen literal below would diverge.
    expect(DEFAULT_NODE_WIDTH).toBe(120);
    expect(DEFAULT_NODE_HEIGHT).toBe(60);
  });

  test('getNodeWidth/getNodeHeight default to the canonical constants', () => {
    const empty = {} as PositionedNode;
    expect(getNodeWidth(empty)).toBe(DEFAULT_NODE_WIDTH);
    expect(getNodeHeight(empty)).toBe(DEFAULT_NODE_HEIGHT);
  });

  test('no production source re-inlines the default literal or redeclares the constants', () => {
    const projectRoot = path.resolve(__dirname, '../../../');
    const srcDir = path.join(projectRoot, 'src');
    expect(fs.existsSync(srcDir)).toBe(true);

    const files = getAllProductionSourceFiles(srcDir);
    expect(files.length).toBeGreaterThan(50); // sanity check

    const violations: { file: string; line: number; content: string }[] = [];

    for (const file of files) {
      const rel = path.relative(projectRoot, file);
      // The canonical definition file is the single allowed home for these literals.
      if (rel === CANONICAL_FILE) continue;

      const lines = fs.readFileSync(file, 'utf-8').split('\n');
      lines.forEach((line, idx) => {
        if (INLINED_DEFAULT_FALLBACK.test(line) || LOCAL_REDECLARATION.test(line)) {
          violations.push({ file: rel, line: idx + 1, content: line.trim() });
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
