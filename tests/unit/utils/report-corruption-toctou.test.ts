/**
 * TOCTOU (Time of Check / Time of Use) boundary tests for reportCorruption.
 *
 * Uses fake timers to test day-boundary, midnight, and year-boundary
 * timestamp generation edge cases. Verifies that CorruptionReport.timestamp
 * is always a valid ISO 8601 string, regardless of when reportCorruption
 * is called relative to date boundaries.
 *
 * Context: The feedback recommended:
 * "TOCTOU テストを CI time-travel（fake timers）で日跨ぎ境界を自動検証する仕組み"
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  reportCorruption,
  setCorruptionHandler,
  type CorruptionReport,
} from '@stv/core/utils/report-corruption';

function requireDefined<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) {
    throw new Error(`${label} was null/undefined`);
  }
  return value;
}

describe('reportCorruption TOCTOU boundary tests', () => {
  beforeEach(() => {
    setCorruptionHandler(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Midnight boundary (23:59:59 → 00:00:00)
  // -----------------------------------------------------------------------
  describe('midnight boundary', () => {
    it('timestamp is valid just before midnight', () => {
      const justBeforeMidnight = new Date('2025-12-31T23:59:59.999Z').getTime();
      jest.useFakeTimers({ now: justBeforeMidnight });

      const report = reportCorruption('MidnightPre', 'pre-midnight event');
      expect(report.timestamp).toMatch(/^2025-12-31T23:59:59/);
      expect(new Date(report.timestamp).toString()).not.toBe('Invalid Date');
    });

    it('timestamp is valid exactly at midnight', () => {
      const midnight = new Date('2026-01-01T00:00:00.000Z').getTime();
      jest.useFakeTimers({ now: midnight });

      const report = reportCorruption('MidnightExact', 'exact midnight event');
      expect(report.timestamp).toMatch(/^2026-01-01T00:00:00/);
      expect(new Date(report.timestamp).toString()).not.toBe('Invalid Date');
    });

    it('timestamp is valid just after midnight', () => {
      const justAfter = new Date('2026-01-01T00:00:00.001Z').getTime();
      jest.useFakeTimers({ now: justAfter });

      const report = reportCorruption('MidnightPost', 'post-midnight event');
      expect(report.timestamp).toMatch(/^2026-01-01T00:00:00/);
      expect(new Date(report.timestamp).toString()).not.toBe('Invalid Date');
    });

    it('two reports across midnight boundary have different dates', () => {
      jest.useFakeTimers({ now: new Date('2025-12-31T23:59:59.999Z').getTime() });
      const r1 = reportCorruption('Cross1', 'before midnight');

      jest.setSystemTime(new Date('2026-01-01T00:00:00.001Z').getTime());
      const r2 = reportCorruption('Cross2', 'after midnight');

      const d1 = new Date(r1.timestamp);
      const d2 = new Date(r2.timestamp);
      expect(d1.getUTCDate()).toBe(31);
      expect(d2.getUTCDate()).toBe(1);
      expect(d2.getTime()).toBeGreaterThan(d1.getTime());
    });
  });

  // -----------------------------------------------------------------------
  // Year boundary
  // -----------------------------------------------------------------------
  describe('year boundary', () => {
    it('handles Dec 31 → Jan 1 transition correctly', () => {
      jest.useFakeTimers({ now: new Date('2025-12-31T23:59:59.000Z').getTime() });
      const r1 = reportCorruption('YEnd', 'end of year');

      jest.setSystemTime(new Date('2026-01-01T00:00:01.000Z').getTime());
      const r2 = reportCorruption('YStart', 'start of year');

      expect(r1.timestamp).toMatch(/^2025-/);
      expect(r2.timestamp).toMatch(/^2026-/);
    });

    it('handles leap year Feb 28 → Feb 29', () => {
      // 2024 is a leap year
      jest.useFakeTimers({ now: new Date('2024-02-28T23:59:59.000Z').getTime() });
      const r1 = reportCorruption('LeapPre', 'before leap day');

      jest.setSystemTime(new Date('2024-02-29T00:00:01.000Z').getTime());
      const r2 = reportCorruption('LeapPost', 'leap day');

      expect(r1.timestamp).toMatch(/^2024-02-28/);
      expect(r2.timestamp).toMatch(/^2024-02-29/);
    });

    it('non-leap year Feb 28 → Mar 1 (skips Feb 29)', () => {
      // 2025 is not a leap year
      jest.useFakeTimers({ now: new Date('2025-02-28T23:59:59.000Z').getTime() });
      const r1 = reportCorruption('NoLeapPre', 'before');

      jest.setSystemTime(new Date('2025-03-01T00:00:01.000Z').getTime());
      const r2 = reportCorruption('NoLeapPost', 'after');

      expect(r1.timestamp).toMatch(/^2025-02-28/);
      expect(r2.timestamp).toMatch(/^2025-03-01/);
    });
  });

  // -----------------------------------------------------------------------
  // Month boundary
  // -----------------------------------------------------------------------
  describe('month boundary', () => {
    it('handles Jan 31 → Feb 1 transition', () => {
      jest.useFakeTimers({ now: new Date('2025-01-31T23:59:59.000Z').getTime() });
      const r1 = reportCorruption('JanEnd', 'end of Jan');

      jest.setSystemTime(new Date('2025-02-01T00:00:01.000Z').getTime());
      const r2 = reportCorruption('FebStart', 'start of Feb');

      expect(r1.timestamp).toMatch(/^2025-01-31/);
      expect(r2.timestamp).toMatch(/^2025-02-01/);
    });

    it('handles Mar 31 → Apr 1 transition (30-day month follows 31-day)', () => {
      jest.useFakeTimers({ now: new Date('2025-03-31T23:59:59.000Z').getTime() });
      const r1 = reportCorruption('MarEnd', 'end of Mar');

      jest.setSystemTime(new Date('2025-04-01T00:00:01.000Z').getTime());
      const r2 = reportCorruption('AprStart', 'start of Apr');

      expect(r1.timestamp).toMatch(/^2025-03-31/);
      expect(r2.timestamp).toMatch(/^2025-04-01/);
    });
  });

  // -----------------------------------------------------------------------
  // DST transition (non-exhaustive; checks format consistency)
  // -----------------------------------------------------------------------
  describe('DST transition format consistency', () => {
    it('spring forward: timestamps remain valid ISO 8601', () => {
      // US DST spring forward 2025: Mar 9, 2025 2:00 AM → 3:00 AM
      jest.useFakeTimers({ now: new Date('2025-03-09T01:59:59-05:00').getTime() });
      const r1 = reportCorruption('DSTPre', 'before spring forward');

      jest.setSystemTime(new Date('2025-03-09T03:00:01-04:00').getTime());
      const r2 = reportCorruption('DSTPost', 'after spring forward');

      // Both timestamps should be valid ISO 8601
      expect(new Date(r1.timestamp).toString()).not.toBe('Invalid Date');
      expect(new Date(r2.timestamp).toString()).not.toBe('Invalid Date');
      // r2 should be later than r1
      expect(new Date(r2.timestamp).getTime()).toBeGreaterThan(
        new Date(r1.timestamp).getTime(),
      );
    });

    it('fall back: timestamps remain valid ISO 8601', () => {
      // US DST fall back 2025: Nov 2, 2025 2:00 AM → 1:00 AM
      jest.useFakeTimers({ now: new Date('2025-11-02T01:59:59-04:00').getTime() });
      const r1 = reportCorruption('FBPre', 'before fall back');

      jest.setSystemTime(new Date('2025-11-02T01:00:01-05:00').getTime());
      const r2 = reportCorruption('FBPost', 'after fall back');

      // Both timestamps should be valid
      expect(new Date(r1.timestamp).toString()).not.toBe('Invalid Date');
      expect(new Date(r2.timestamp).toString()).not.toBe('Invalid Date');
      // r2 should be later (the "second" 1 AM is after the first 1:59 AM in absolute time)
      expect(new Date(r2.timestamp).getTime()).toBeGreaterThan(
        new Date(r1.timestamp).getTime(),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Rapid successive calls: verify no timestamp collision
  // -----------------------------------------------------------------------
  describe('rapid successive calls', () => {
    it('100 calls within same millisecond all produce valid timestamps', () => {
      const fixedTime = new Date('2025-06-15T12:00:00.000Z').getTime();
      jest.useFakeTimers({ now: fixedTime });

      const reports: CorruptionReport[] = [];
      for (let i = 0; i < 100; i++) {
        reports.push(reportCorruption(`Rapid${i}`, `call ${i}`));
      }

      // All timestamps should be valid ISO 8601
      for (const r of reports) {
        expect(typeof r.timestamp).toBe('string');
        expect(new Date(r.timestamp).toString()).not.toBe('Invalid Date');
        expect(r.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }

      // All should have the same timestamp (same millisecond)
      const uniqueTimestamps = new Set(reports.map((r) => r.timestamp));
      expect(uniqueTimestamps.size).toBe(1);

      // But all should have unique sources
      const uniqueSources = new Set(reports.map((r) => r.source));
      expect(uniqueSources.size).toBe(100);
    });

    it('monotonically advancing time produces ordered timestamps', () => {
      const start = new Date('2025-06-15T12:00:00.000Z').getTime();
      jest.useFakeTimers({ now: start });

      const r1 = reportCorruption('T1', 'first');

      jest.setSystemTime(start + 1000); // +1s
      const r2 = reportCorruption('T2', 'second');

      jest.setSystemTime(start + 2000); // +2s
      const r3 = reportCorruption('T3', 'third');

      const t1 = new Date(r1.timestamp).getTime();
      const t2 = new Date(r2.timestamp).getTime();
      const t3 = new Date(r3.timestamp).getTime();

      expect(t1).toBeLessThanOrEqual(t2);
      expect(t2).toBeLessThanOrEqual(t3);
    });
  });

  // -----------------------------------------------------------------------
  // Handler invocation timing
  // -----------------------------------------------------------------------
  describe('handler invocation across time boundaries', () => {
    it('handler receives correct timestamp at exact day boundary', () => {
      const midnight = new Date('2026-01-01T00:00:00.000Z').getTime();
      jest.useFakeTimers({ now: midnight });

      let receivedReport: CorruptionReport | null = null;
      setCorruptionHandler((r) => {
        receivedReport = r;
      });

      reportCorruption('HandlerBoundary', 'day boundary test');

      const received = requireDefined(receivedReport, 'receivedReport');
      expect(received.timestamp).toMatch(/^2026-01-01/);
      expect(received.source).toBe('HandlerBoundary');
    });
  });

  // -----------------------------------------------------------------------
  // Epoch edge cases
  // -----------------------------------------------------------------------
  describe('epoch edge cases', () => {
    it('Unix epoch (1970-01-01) produces valid timestamp', () => {
      jest.useFakeTimers({ now: 0 });
      const report = reportCorruption('Epoch', 'unix epoch');
      expect(report.timestamp).toMatch(/^1970-01-01T00:00:00/);
      expect(new Date(report.timestamp).toString()).not.toBe('Invalid Date');
    });

    it('negative time (pre-1970) produces valid ISO timestamp', () => {
      // Dec 31, 1969 23:59:59 UTC (equivalent to -1000ms)
      jest.useFakeTimers({ now: -1000 });
      const report = reportCorruption('PreEpoch', 'before unix epoch');
      // JavaScript Date handles negative timestamps
      expect(new Date(report.timestamp).toString()).not.toBe('Invalid Date');
    });
  });
});
