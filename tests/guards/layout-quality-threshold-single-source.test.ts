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
 * This file pins VALUE and CONSUMER IMPORTS. The discovery sweep over
 * src/visualization + src/pipeline (with the documented different-concept
 * exclusions: scene-segmenter detection confidence, quality-gate criterion
 * gates) lives in the shared registry since round 8 —
 * tests/guards/frozen-literal-registry.test.ts, rule 'layout-quality
 * threshold (0.7) …'.
 */

import { describe, it, expect } from '@jest/globals';
import { readSource } from './freeze-guard';
import { DEFAULT_LAYOUT_QUALITY_THRESHOLD } from '@/visualization/layout-quality-composite';

const CONSUMERS = ['src/visualization/layout-auto-optimizer.ts'];

describe('layout-quality threshold single source', () => {
  it('canonical module exports 0.7', () => {
    expect(DEFAULT_LAYOUT_QUALITY_THRESHOLD).toBe(0.7);
  });

  it.each(CONSUMERS)('%s imports the canonical threshold', (file) => {
    expect(readSource(file)).toMatch(/DEFAULT_LAYOUT_QUALITY_THRESHOLD/);
  });
});
