/**
 * @jest-environment node
 */
/**
 * Structural guard: the LLM cache namespace literal has ONE source.
 *
 * THE BUG CLASS (session-259 parked C1 → fixed in fb5a12bf). CacheWarmupManager
 * wrote prefix-less keys while LLMService.makeRequest read/wrote under
 * 'unified-llm-service' — REQ-202 warmup was structurally invisible to the
 * runtime reader, a silent no-op. The fix threaded WarmupOptions.namespace
 * through, but left the literal open-coded at 5 sites in llm-service.ts
 * (constructor warmup, cache.get, 2× cache.set, clearCache warmup). Any one
 * of those drifting (typo, rename, partial revert) silently reintroduces the
 * exact C1 divergence the INV-CACHE-001 behavior tests pin — and those tests
 * only fire when the drifted value is exercised, which a cold-start-only
 * warmup path rarely is.
 *
 * Same single-sourcing shape as error-rate-threshold-single-source /
 * clamp01-single-source: export a const from the module BOTH sides of the
 * parity contract already import (llm-cache.ts is the shared leaf;
 * llm-service.ts and cache-warmup.ts both import it, so no cycle), then
 * census the literal down to exactly that one definition.
 *
 * Legs:
 *   1. canonical value pin — the const IS 'unified-llm-service' (a value
 *      change must be a deliberate, visible act; test-side pins in
 *      content-analyzer-cache-key.test.ts independently alarm on it);
 *   2. literal census — exactly ONE non-comment occurrence of the quoted
 *      literal across src/ production code, in llm-cache.ts;
 *   3. every this.cache.get/set call in llm-service.ts passes the const;
 *   4. every CacheWarmupManager construction in llm-service.ts passes
 *      namespace: <const>;
 *   5. llm-service.ts imports the const from the canonical module.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync, globSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSource, isCommentLine } from './freeze-guard';
import { LLM_SERVICE_CACHE_NAMESPACE } from '@/analysis/llm-cache';

const LLM_SERVICE = 'src/analysis/llm-service.ts';
const LITERAL = `'unified-llm-service'`;

/** Argument span (between the outer parens) of a call starting at `openParen`. */
function callArgs(src: string, openParen: number): string {
  let depth = 0;
  for (let i = openParen; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') {
      depth--;
      if (depth === 0) return src.slice(openParen + 1, i);
    }
  }
  return src.slice(openParen + 1);
}

/** Line-start offset of the line containing `offset` (for comment filtering). */
function lineStart(src: string, offset: number): number {
  return src.lastIndexOf('\n', offset - 1) + 1;
}

describe('LLM cache namespace single source (INV-CACHE-001 drift guard)', () => {
  it('canonical const is exported from llm-cache.ts with the parity value', () => {
    expect(LLM_SERVICE_CACHE_NAMESPACE).toBe('unified-llm-service');
    expect(readSource('src/analysis/llm-cache.ts')).toMatch(
      /export const LLM_SERVICE_CACHE_NAMESPACE = 'unified-llm-service'/,
    );
  });

  it(`the quoted literal appears exactly once in src/ production code (llm-cache.ts)`, () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const repoRoot = join(here, '..', '..');
    const files = globSync(join(repoRoot, 'src', '**', '*.{ts,tsx}')).filter(
      (f: string) => !f.includes('__tests__'),
    );
    expect(files.length).toBeGreaterThan(100); // glob sanity floor

    const hits: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!isCommentLine(line) && line.includes(LITERAL)) {
          hits.push(`${file.replace(repoRoot + '/', '')}:${i + 1}`);
        }
      });
    }
    // RED before the single-sourcing refactor: 5 code hits in llm-service.ts.
    // Line number deliberately not pinned — import churn above the const must
    // not RED this census; only the FILE of the single definition is the
    // contract.
    expect(hits).toHaveLength(1);
    expect(hits[0].startsWith('src/analysis/llm-cache.ts:')).toBe(true);
  });

  it('every this.cache.get/set call in llm-service.ts passes the canonical const', () => {
    const src = readSource(LLM_SERVICE);
    const callRe = /this\.cache\.(get|set)\(/g;
    let calls = 0;
    for (const m of src.matchAll(callRe)) {
      if (isCommentLine(src.slice(lineStart(src, m.index!), m.index!))) continue;
      calls++;
      const args = callArgs(src, m.index! + m[0].length - 1);
      expect(args).toContain('LLM_SERVICE_CACHE_NAMESPACE');
    }
    expect(calls).toBeGreaterThanOrEqual(3); // reader + 2 writers exist
  });

  it('every CacheWarmupManager construction in llm-service.ts uses the const', () => {
    const src = readSource(LLM_SERVICE);
    const ctorRe = /new CacheWarmupManager</g;
    let ctors = 0;
    for (const m of src.matchAll(ctorRe)) {
      if (isCommentLine(src.slice(lineStart(src, m.index!), m.index!))) continue;
      ctors++;
      const args = callArgs(src, src.indexOf('(', m.index!));
      expect(args).toContain('namespace: LLM_SERVICE_CACHE_NAMESPACE');
    }
    expect(ctors).toBeGreaterThanOrEqual(2); // constructor + clearCache
  });

  it('llm-service.ts imports the const from the canonical module', () => {
    expect(readSource(LLM_SERVICE)).toMatch(
      /import\s+\{[^}]*LLM_SERVICE_CACHE_NAMESPACE[^}]*\}\s+from\s+["'][^"']*llm-cache["']/,
    );
  });
});
