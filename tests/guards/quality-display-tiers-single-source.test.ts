/**
 * Round 27 single-source guard: quality DISPLAY tier bars (90/70/50).
 *
 * The 0–100 score→display classification lived as consumer-side literals in
 * FOUR shapes across two dashboards:
 *
 *   - src/components/FrameworkDashboard.tsx — private getQualityColor
 *     (90→green / 70→blue / 50→yellow / else red tailwind classes).
 *   - src/components/PerformanceMetricsVisualization.tsx — a byte-identical
 *     getQualityColor twin, plus getQualityBadge on the same bars
 *     (default/secondary/outline/destructive), plus the inline
 *     `displayScore >= 90 ? 'Excellent' : >= 70 ? 'Good' : 'Fair'` label.
 *
 * A drifted bar at one site makes the two dashboards color the SAME score
 * differently (e.g. one flips good→green at 75 while the other stays blue).
 * Canonical source: src/lib/quality-display-tiers.ts.
 *
 * This file pins (a) the canonical bar values (numeric delta vs the historic
 * literals — zero), (b) behavioral equivalence against the legacy inline
 * implementations at every bar boundary and a dense deterministic sweep, and
 * (c) source anchors that both consumers delegate via the canonical import.
 * The discovery sweep ("no src file re-freezes the bar+display-output
 * combination") lives in tests/guards/frozen-literal-rules.ts, rule
 * 'quality display tier bars (90/70/50) single-sourced in lib/quality-display-tiers (round 27)'.
 *
 * Out of scope (separate concepts, intentionally different tuned bars):
 * pipeline-health-score scoreToGrade (90/75/55/35), quality-monitor
 * determineStatus (90/75/60/40), continuous-learner compliance (90/75/60).
 */

import { describe, it, expect } from '@jest/globals';
import { readSource } from '@tests/guards/freeze-guard';
import {
  QUALITY_TIER_BARS,
  getQualityTier,
  getQualityColorClass,
  getQualityBadgeVariant,
  getQualityTierLabel,
} from '@stv/core/lib/quality-display-tiers';

// ---------------------------------------------------------------------------
// Legacy oracles — the EXACT pre-round-27 consumer literals, kept verbatim.
// The canonical functions must reproduce them bit-for-bit.
// ---------------------------------------------------------------------------

function legacyQualityColor(score: number): string {
  if (score >= 90) return 'text-green-600 dark:text-green-400';
  if (score >= 70) return 'text-blue-600 dark:text-blue-400';
  if (score >= 50) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function legacyQualityBadge(score: number): string {
  if (score >= 90) return 'default';
  if (score >= 70) return 'secondary';
  if (score >= 50) return 'outline';
  return 'destructive';
}

function legacyQualityLabel(score: number): string {
  return score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : 'Fair';
}

describe('quality display tiers: canonical bar values (round 27)', () => {
  it('QUALITY_TIER_BARS equals the historic literals (zero delta)', () => {
    expect(QUALITY_TIER_BARS).toEqual({ excellent: 90, good: 70, fair: 50 });
  });

  it('classifies the bar boundaries and the far side of each bar', () => {
    expect(getQualityTier(90)).toBe('excellent');
    expect(getQualityTier(100)).toBe('excellent');
    expect(getQualityTier(89.999)).toBe('good');
    expect(getQualityTier(70)).toBe('good');
    expect(getQualityTier(69.999)).toBe('fair');
    expect(getQualityTier(50)).toBe('fair');
    expect(getQualityTier(49.999)).toBe('poor');
    expect(getQualityTier(0)).toBe('poor');
  });
});

describe('quality display tiers: behavioral equivalence vs legacy consumers', () => {
  // Dense deterministic sweep: every half point 0..100 (201 cases) plus the
  // just-below/just-above of each bar.
  const scores: number[] = [];
  for (let i = 0; i <= 200; i += 1) scores.push(i / 2);
  for (const bar of [50, 70, 90]) {
    scores.push(bar - 0.001, bar, bar + 0.001);
  }

  it.each(scores)('color class matches legacy getQualityColor (score=%d)', (score) => {
    expect(getQualityColorClass(score)).toBe(legacyQualityColor(score));
  });

  it.each(scores)('badge variant matches legacy getQualityBadge (score=%d)', (score) => {
    expect(getQualityBadgeVariant(score)).toBe(legacyQualityBadge(score));
  });

  it.each(scores)('label matches legacy inline ternary (score=%d)', (score) => {
    expect(getQualityTierLabel(score)).toBe(legacyQualityLabel(score));
  });

  it('cross-consumer consistency: both historic dashboards now share ONE output per score', () => {
    for (const score of [0, 49, 50, 69, 70, 89, 90, 100]) {
      const color = getQualityColorClass(score);
      expect(color).toBe(legacyQualityColor(score));
      // The tier driving every display shape is the same classification.
      const tier = getQualityTier(score);
      expect(color).toContain(
        tier === 'excellent' ? 'green' : tier === 'good' ? 'blue' : tier === 'fair' ? 'yellow' : 'red',
      );
    }
  });
});

describe('quality display tiers: consumer source anchors (round 27)', () => {
  it('FrameworkDashboard delegates to the canonical module and drops the local twin', () => {
    const src = readSource('src/components/FrameworkDashboard.tsx');
    expect(src).toContain("from '@stv/core/lib/quality-display-tiers'");
    expect(src).toContain('getQualityColorClass');
    expect(src).not.toMatch(/const getQualityColor\b/);
  });

  it('PerformanceMetricsVisualization delegates all three display shapes', () => {
    const src = readSource('src/components/PerformanceMetricsVisualization.tsx');
    expect(src).toContain("from '@stv/core/lib/quality-display-tiers'");
    expect(src).toContain('getQualityColorClass');
    expect(src).toContain('getQualityBadgeVariant');
    expect(src).toContain('getQualityTierLabel');
    expect(src).not.toMatch(/const getQualityColor\b/);
    expect(src).not.toMatch(/const getQualityBadge\b/);
    expect(src).not.toMatch(/displayScore\s*>=\s*90\s*\?\s*'Excellent'/);
  });

  it('the canonical module owns the tier classes/variants (single copy of each output)', () => {
    const src = readSource('src/lib/quality-display-tiers.ts');
    for (const cls of [
      'text-green-600 dark:text-green-400',
      'text-blue-600 dark:text-blue-400',
      'text-yellow-600 dark:text-yellow-400',
      'text-red-600 dark:text-red-400',
    ]) {
      expect(src).toContain(cls);
    }
  });
});
