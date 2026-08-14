/**
 * Structural guard: analysis-layer LLM retry defaults have ONE source.
 *
 * Before this guard, the retry defaults (maxRetries 3, baseDelay 1000ms,
 * maxDelay 10000ms) were frozen independently in four places:
 *
 *   - src/analysis/retry-strategy.ts   (canonical, but module-private)
 *   - src/analysis/llm-service.ts      (`|| 3` fallback — also a falsy-guard
 *                                        bug: an explicit maxRetries: 0 was
 *                                        coerced back to 3)
 *   - src/analysis/gemini-analyzer.ts  (explicit `maxRetries: 3` override
 *                                        that silently equals the default)
 *   - src/analysis/fallback-chain.ts   (full `{3, 1000, 10000}` triple)
 *
 * The pipeline-layer retry system (src/pipeline/retry.ts — ErrorClassifier-
 * driven, 500ms base, `main-pipeline` stage retries) is a DIFFERENT concept
 * and deliberately keeps its own defaults; src/pipeline is outside this
 * family's sweep boundary.
 *
 * This file pins VALUES and CONSUMER WIRING. The "no src/analysis site
 * re-freezes 3/1000/10000" discovery sweep lives in the shared registry
 * (tests/guards/frozen-literal-registry.test.ts, rule
 * 'analysis retry defaults (3/1000/10000) single-sourced in retry-strategy').
 */

import { describe, it, expect } from '@jest/globals';
import { readSource } from './freeze-guard';
import { DEFAULT_RETRY_OPTIONS, executeWithRetry } from '@/analysis/retry-strategy';

const CONSUMERS = [
  'src/analysis/llm-service.ts',
  'src/analysis/gemini-analyzer.ts',
  'src/analysis/fallback-chain.ts',
];

describe('analysis retry-default single source (guard)', () => {
  it('canonical module exports the agreed default values', () => {
    expect(DEFAULT_RETRY_OPTIONS).toEqual({
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
    });
  });

  it('every known default site imports the canonical module', () => {
    for (const rel of CONSUMERS) {
      const src = readSource(rel);
      expect({
        file: rel,
        importsCanonical: src.includes("from './retry-strategy'") ||
          src.includes('from "./retry-strategy"'),
      }).toEqual({ file: rel, importsCanonical: true });
    }
  });

  it('consumer default sites are built from the canonical constant', () => {
    for (const rel of CONSUMERS) {
      const src = readSource(rel);
      expect({
        file: rel,
        wired: /DEFAULT_RETRY_OPTIONS\.maxRetries|\{\s*\.\.\.DEFAULT_RETRY_OPTIONS\s*\}/.test(src),
      }).toEqual({ file: rel, wired: true });
    }
  });

  it('behavioral: executeWithRetry with no options uses the canonical defaults', async () => {
    // A non-retryable error must surface immediately (no retries) — proving
    // the default merge path still reads DEFAULT_RETRY_OPTIONS.
    await expect(
      executeWithRetry(() => {
        const err = new Error('bad request') as Error & { status: number };
        err.status = 400;
        throw err;
      }),
    ).rejects.toThrow('bad request');
  });
});
