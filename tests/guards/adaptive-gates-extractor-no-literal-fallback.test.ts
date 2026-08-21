/**
 * REQ-367 (MW-039): static guard against silent-pass fallback re-injection
 * into METRIC_EXTRACTORS.
 *
 * Phase 170 (REQ-364/MW-038) made the producer-less snapshot fields explicit
 * null and taught evaluateGate to FAIL a null-reading gate LOUD ("METRIC
 * UNAVAILABLE"). The runtime mutation witness for that contract lives in the
 * adaptive-quality-gates suites — but it only fires when a test happens to
 * exercise the poisoned gate. A re-injected "helpful default" like
 *
 *   transcriptionAccuracy: s => s.quality.transcriptionAccuracy ?? 0.90
 *
 * replaces the null with a constant that sits exactly at the gate threshold
 * and silently PASSES it again; nothing in review reliably catches the shape.
 * This guard bans the SHAPE itself at the source level: within the
 * METRIC_EXTRACTORS block, an extractor may read a snapshot field, but may
 * not coalesce (`??`/`||`) a missing reading into a numeric literal.
 *
 * Steering motivation (Phase 170 make-run feedback): "METRIC_EXTRACTORS への
 * `?? 定数` silent-pass 再注入は現在 MW-038 の test でのみ検出される。
 * extractor 実装に数値 literal fallback を禁止する静的 guard を追加しない
 * 限り、次の再注入は review を素通りする。"
 *
 * Anti-vacuity: the block-extraction is pinned (marker found, expected
 * extractor keys present, arrow count exact) so a refactor that moves or
 * renames METRIC_EXTRACTORS fails LOUD here instead of silently shrinking
 * the swept region to an empty string — a guard whose slice is empty passes
 * every "no fallback" assertion vacuously.
 */

import { describe, it, expect } from '@jest/globals';
import { readSource } from './freeze-guard';

const SOURCE_REL = 'src/quality/adaptive-quality-gates.ts';

/** The 18 extractor keys of METRIC_EXTRACTORS (Phase 170 shape). */
const EXTRACTOR_KEYS = [
  // Pipeline
  'avgProcessingTime',
  'p95ProcessingTime',
  'p99ProcessingTime',
  'successRate',
  'activeRequests',
  // LLM
  'cacheHitRate',
  'avgFlashResponseTime',
  'avgProResponseTime',
  'flashUsagePercent',
  // System
  'memoryUsagePercent',
  'memoryUsageMB',
  'cpuUsagePercent',
  // Errors
  'errorRate',
  'recoverySuccessRate',
  'totalErrors',
  // Quality
  'transcriptionAccuracy',
  'layoutOverlapRate',
  'avgSceneQuality',
] as const;

/**
 * Slice the METRIC_EXTRACTORS initializer out of the source: from the
 * `METRIC_EXTRACTORS` identifier to the first `};` after it (the object
 * literal's own terminator).
 */
function extractBlock(source: string): string {
  const start = source.indexOf('METRIC_EXTRACTORS');
  if (start === -1) {
    return '';
  }
  const end = source.indexOf('};', start);
  return end === -1 ? '' : source.slice(start, end + 2);
}

describe('REQ-367: METRIC_EXTRACTORS numeric-literal fallback ban (source-anchored)', () => {
  const source = readSource(SOURCE_REL);
  const block = extractBlock(source);

  it('locates the METRIC_EXTRACTORS block (non-vacuous sweep region)', () => {
    expect(block).not.toBe('');
    expect(block.length).toBeGreaterThan(500);
    // Extractor count pins the block as the real extractor map, not an
    // accidental earlier mention of the identifier in a comment/doc (the
    // `: s =>` shape excludes the `=>` inside the field's own type
    // annotation `Record<string, (snapshot) => number | null>`).
    const extractors = block.split(': s =>').length - 1;
    expect(extractors).toBe(EXTRACTOR_KEYS.length);
  });

  it.each(EXTRACTOR_KEYS)('extractor %s is present in the swept block', (key) => {
    expect(block).toContain(`${key}: s =>`);
  });

  it('no extractor coalesces a missing reading into a numeric literal (`?? <number>`)', () => {
    // e.g. `s.quality.transcriptionAccuracy ?? 0.90` — the silent-pass shape
    // MW-038 proved keeps a blocker gate permanently green.
    expect(block).not.toMatch(/\?\?\s*[-+]?\d/);
    expect(block).not.toMatch(/\?\?\s*[-+]?\.\d/);
  });

  it('no extractor coalesces a missing reading into a numeric literal (`|| <number>`)', () => {
    expect(block).not.toMatch(/\|\|\s*[-+]?\d/);
    expect(block).not.toMatch(/\|\|\s*[-+]?\.\d/);
  });
});
