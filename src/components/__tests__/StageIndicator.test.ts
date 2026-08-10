/**
 * Tests for StageIndicator pure helpers.
 * REQ-139: Verify calcElapsed, formatElapsed, and exported constants.
 */

import {
  calcElapsed,
  formatElapsed,
  STAGE_CONFIG,
  STATUS_LABEL,
  STATUS_BADGE_VARIANT,
  type StageInfo,
  type StageName,
  type StageStatus,
} from '../StageIndicator';

// ========================================
// calcElapsed
// ========================================

describe('calcElapsed', () => {
  it('returns 0 when startedAt is null', () => {
    const stage: StageInfo = {
      name: 'transcribe',
      status: 'pending',
      progress: 0,
      startedAt: null,
      completedAt: null,
      error: null,
    };
    expect(calcElapsed(stage)).toBe(0);
  });

  it('computes elapsed from startedAt to nowMs when still running', () => {
    const stage: StageInfo = {
      name: 'analyze',
      status: 'active',
      progress: 50,
      startedAt: 1000,
      completedAt: null,
      error: null,
    };
    expect(calcElapsed(stage, 4000)).toBe(3);
  });

  it('computes elapsed from startedAt to completedAt when finished', () => {
    const stage: StageInfo = {
      name: 'render',
      status: 'completed',
      progress: 100,
      startedAt: 1000,
      completedAt: 7000,
      error: null,
    };
    expect(calcElapsed(stage)).toBe(6);
  });

  it('uses Date.now() as fallback when nowMs and completedAt are null', () => {
    const before = Date.now();
    const stage: StageInfo = {
      name: 'transcribe',
      status: 'active',
      progress: 30,
      startedAt: before - 5000,
      completedAt: null,
      error: null,
    };
    const result = calcElapsed(stage);
    // Should be roughly 5 seconds (allowing some tolerance)
    expect(result).toBeGreaterThanOrEqual(4.9);
    expect(result).toBeLessThanOrEqual(6);
  });

  it('clamps negative elapsed to 0', () => {
    const stage: StageInfo = {
      name: 'layout',
      status: 'completed',
      progress: 100,
      startedAt: 5000,
      completedAt: 1000,
      error: null,
    };
    expect(calcElapsed(stage)).toBe(0);
  });
});

// ========================================
// formatElapsed
// ========================================

describe('formatElapsed', () => {
  it('formats seconds only (< 60)', () => {
    expect(formatElapsed(0)).toBe('0秒');
    expect(formatElapsed(1)).toBe('1秒');
    expect(formatElapsed(30)).toBe('30秒');
    expect(formatElapsed(59)).toBe('59秒');
  });

  it('formats minutes and seconds', () => {
    expect(formatElapsed(61)).toBe('1分1秒');
    expect(formatElapsed(90)).toBe('1分30秒');
    expect(formatElapsed(119)).toBe('1分59秒');
  });

  it('formats exact minutes without seconds', () => {
    expect(formatElapsed(60)).toBe('1分');
    expect(formatElapsed(120)).toBe('2分');
    expect(formatElapsed(300)).toBe('5分');
  });

  it('rounds seconds correctly', () => {
    expect(formatElapsed(60.4)).toBe('1分');   // 0.4 rounds to 0
    expect(formatElapsed(60.5)).toBe('1分1秒'); // 0.5 rounds to 1
    expect(formatElapsed(90.6)).toBe('1分31秒');
  });

  // Round-then-decompose: the TOTAL must be rounded to an integer BEFORE it is
  // decomposed into minutes + seconds. Rounding the seconds remainder in
  // isolation lets it reach 60 ("1分60秒"), and rounding under the <60 guard
  // yields "60秒" for a sub-minute input. `calcElapsed` returns fractional
  // seconds (a Date.now() delta / 1000), so these inputs are reached in
  // production for any stage lasting ≈N minutes − 0.5 s. Sibling of the
  // animated-scene-renderer subtitle bug; pinned here against regression.
  it('never emits a 60-second remainder (round total before decomposing)', () => {
    // Remainder ∈ [59.5, 60): previously "1分60秒" / "2分60秒" / "3分60秒".
    expect(formatElapsed(119.5)).toBe('2分');
    expect(formatElapsed(179.5)).toBe('3分');
    expect(formatElapsed(239.5)).toBe('4分');
    // <60 branch rounding into the next minute: previously "60秒".
    expect(formatElapsed(59.5)).toBe('1分');
  });
});

// ========================================
// STAGE_CONFIG completeness
// ========================================

describe('STAGE_CONFIG', () => {
  const stageNames: StageName[] = ['transcribe', 'analyze', 'layout', 'render'];

  it('has an entry for every stage name', () => {
    for (const name of stageNames) {
      expect(STAGE_CONFIG[name]).toBeDefined();
      expect(STAGE_CONFIG[name].label).toBeTruthy();
      expect(STAGE_CONFIG[name].description).toBeTruthy();
      expect(STAGE_CONFIG[name].Icon).toBeDefined();
    }
  });
});

// ========================================
// STATUS_LABEL and STATUS_BADGE_VARIANT
// ========================================

describe('STATUS_LABEL', () => {
  const statuses: StageStatus[] = ['pending', 'active', 'completed', 'error'];

  it('has a label for every status', () => {
    for (const s of statuses) {
      expect(STATUS_LABEL[s]).toBeTruthy();
    }
  });
});

describe('STATUS_BADGE_VARIANT', () => {
  const statuses: StageStatus[] = ['pending', 'active', 'completed', 'error'];

  it('has a variant for every status', () => {
    for (const s of statuses) {
      expect(['default', 'secondary', 'destructive', 'outline']).toContain(
        STATUS_BADGE_VARIANT[s],
      );
    }
  });
});
