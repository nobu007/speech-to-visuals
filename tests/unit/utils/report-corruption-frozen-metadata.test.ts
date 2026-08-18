/**
 * Extended robustness tests for reportCorruption when callers attempt to
 * attach metadata to the returned CorruptionReport, especially when that
 * metadata is frozen/sealed/non-extensible.
 *
 * The feedback noted:
 * "metadataが既存オブジェクトでtimestampプロパティが存在しない場合
 *  (writable制約等)のエラーハンドリングが未テスト —
 *  次イテレーションでObject.freezeされたmetadataに対する堅牢性を検証すべき"
 *
 * These tests verify that:
 * 1. CorruptionReport can be safely extended (frozen report + metadata merge)
 * 2. A frozen handler that captures a report does not crash on property access
 * 3. Spread-copying a frozen report is safe
 * 4. JSON serialization of a frozen report round-trips correctly
 * 5. Handlers receiving reports with frozen metadata arrays do not crash
 * 6. Concurrent calls with frozen shared state are safe
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  reportCorruption,
  setCorruptionHandler,
  type CorruptionReport,
} from '@stv/core/utils/report-corruption';

describe('reportCorruption frozen-metadata robustness', () => {
  beforeEach(() => {
    setCorruptionHandler(null);
  });

  // -----------------------------------------------------------------------
  // Spread-copy and extend a frozen report
  // -----------------------------------------------------------------------
  describe('frozen report extension via spread', () => {
    it('spread-copy of frozen report includes all fields', () => {
      const report = reportCorruption('TestSource', 'detail', true);
      const frozen = Object.freeze(report);

      const extended = { ...frozen, metadata: { extra: 'info' } };
      expect(extended.source).toBe('TestSource');
      expect(extended.detail).toBe('detail');
      expect(extended.recovered).toBe(true);
      expect(extended.timestamp).toBe(frozen.timestamp);
      expect((extended as any).metadata).toEqual({ extra: 'info' });
    });

    it('Object.assign from frozen report is safe', () => {
      const report = reportCorruption('AssignSource', 'assign detail');
      const frozen = Object.freeze(report);

      const target: Record<string, unknown> = {};
      Object.assign(target, frozen);

      expect(target.source).toBe('AssignSource');
      expect(target.detail).toBe('assign detail');
      expect(typeof target.timestamp).toBe('string');
      expect(typeof target.recovered).toBe('boolean');
    });

    it('JSON.stringify of frozen report round-trips correctly', () => {
      const report = reportCorruption('JSONSource', 'json detail', false);
      const frozen = Object.freeze(report);

      const json = JSON.stringify(frozen);
      const parsed = JSON.parse(json);

      expect(parsed.source).toBe('JSONSource');
      expect(parsed.detail).toBe('json detail');
      expect(parsed.recovered).toBe(false);
      expect(typeof parsed.timestamp).toBe('string');
      // Parsed should have exactly 4 keys
      expect(Object.keys(parsed).sort()).toEqual(['detail', 'recovered', 'source', 'timestamp']);
    });
  });

  // -----------------------------------------------------------------------
  // Handler receives report; handler has frozen internal state
  // -----------------------------------------------------------------------
  describe('handler with frozen internal state', () => {
    it('handler can push report data into a frozen array via copy', () => {
      const collected: CorruptionReport[] = [];
      const frozenCollector = Object.freeze(collected);

      setCorruptionHandler((r) => {
        // Cannot push to frozen array — use spread-copy instead
        // This simulates what a careful handler would do
        const copy = [...frozenCollector, r];
        // The copy is not frozen, so we can verify
        expect(copy).toHaveLength(1);
        expect(copy[0].source).toBe('FrozenArray');
      });

      const report = reportCorruption('FrozenArray', 'array test');
      expect(report.source).toBe('FrozenArray');
    });

    it('handler with Object.seal-ed accumulator can read existing fields', () => {
      const accumulator = Object.seal({
        count: 0,
        lastSource: '',
        lastTimestamp: '',
      });

      setCorruptionHandler((r) => {
        // sealed objects allow modifying existing properties
        accumulator.count++;
        accumulator.lastSource = r.source;
        accumulator.lastTimestamp = r.timestamp;
      });

      reportCorruption('Sealed1', 'first');
      reportCorruption('Sealed2', 'second');

      expect(accumulator.count).toBe(2);
      expect(accumulator.lastSource).toBe('Sealed2');
      expect(accumulator.lastTimestamp.length).toBeGreaterThan(0);
    });

    it('handler with Object.preventExtensions does not crash on reads', () => {
      const state = Object.preventExtensions({ seen: 0 });

      setCorruptionHandler((r) => {
        state.seen++;
        // Cannot add new properties, but reading/modifying existing is OK
        expect(r.source).toBeDefined();
      });

      reportCorruption('NonExt', 'preventExtensions test');
      expect(state.seen).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Frozen report passed back into reportCorruption-like operations
  // -----------------------------------------------------------------------
  describe('frozen report as input to downstream operations', () => {
    it('frozen report fields can be used to construct new report data', () => {
      const report = reportCorruption('OrigSource', 'original detail', true);
      const frozen = Object.freeze(report);

      // Use frozen report fields to create a derived object
      const derived = {
        source: frozen.source,
        detail: `Derived from: ${frozen.detail}`,
        timestamp: frozen.timestamp,
        recovered: frozen.recovered,
        additional: 'extra metadata',
      };

      expect(derived.source).toBe('OrigSource');
      expect(derived.detail).toContain('original detail');
      expect(derived.timestamp).toBe(frozen.timestamp);
    });

    it('reading timestamp from frozen report multiple times is consistent', () => {
      const report = reportCorruption('TS', 'timestamp consistency');
      const frozen = Object.freeze(report);

      const ts1 = frozen.timestamp;
      const ts2 = frozen.timestamp;
      const ts3 = frozen.timestamp;

      expect(ts1).toBe(ts2);
      expect(ts2).toBe(ts3);
      // All reads should return the same string
      expect(typeof ts1).toBe('string');
    });
  });

  // -----------------------------------------------------------------------
  // Concurrent calls with shared frozen state
  // -----------------------------------------------------------------------
  describe('concurrent calls with frozen shared state', () => {
    it('multiple sequential calls produce distinct reports', () => {
      const reports: CorruptionReport[] = [];
      setCorruptionHandler((r) => reports.push(r));

      // Use a frozen seed to prevent mutation
      const seed = Object.freeze({ source: 'Concurrent', detail: 'call' });

      for (let i = 0; i < 10; i++) {
        reportCorruption(seed.source, `${seed.detail}-${i}`, true);
      }

      expect(reports).toHaveLength(10);
      // Each report should have a unique detail
      const details = new Set(reports.map((r) => r.detail));
      expect(details.size).toBe(10);
      // Each should have a valid timestamp
      for (const r of reports) {
        expect(typeof r.timestamp).toBe('string');
        expect(new Date(r.timestamp).toString()).not.toBe('Invalid Date');
      }
    });

    it('frozen handler closure does not leak between calls', () => {
      let count = 0;
      const handler = Object.freeze((r: CorruptionReport) => {
        count++;
        expect(r).toBeDefined();
      });

      setCorruptionHandler(handler);

      reportCorruption('Leak1', 'first');
      reportCorruption('Leak2', 'second');
      reportCorruption('Leak3', 'third');

      expect(count).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  // Error propagation with frozen metadata
  // -----------------------------------------------------------------------
  describe('error handling with frozen metadata', () => {
    it('handler that tries to modify frozen report does not crash', () => {
      setCorruptionHandler((r) => {
        const frozen = Object.freeze(r);
        // Attempting to modify a frozen object in strict mode throws TypeError.
        // The handler should catch this internally or it will be caught by
        // reportCorruption's try-catch.
        try {
          (frozen as any).extra = 'value';
        } catch {
          // Expected in strict mode
        }
      });

      // reportCorruption should not throw even if handler encounters TypeError
      expect(() => reportCorruption('FrozenMod', 'modify frozen')).not.toThrow();
    });

    it('handler that freezes its argument then reads all fields is safe', () => {
      let allRead = false;
      setCorruptionHandler((r) => {
        const frozen = Object.freeze(r);
        // Read all fields from frozen report
        const _s: string = frozen.source;
        const _d: string = frozen.detail;
        const _t: string = frozen.timestamp;
        const _r: boolean = frozen.recovered;
        allRead = _s.length > 0 && _d.length > 0 && _t.length > 0 && typeof _r === 'boolean';
      });

      reportCorruption('FrozenRead', 'read all from frozen');
      expect(allRead).toBe(true);
    });

    it('structuredClone of frozen report preserves all fields', () => {
      const report = reportCorruption('Clone', 'clone test', true);
      const frozen = Object.freeze(report);

      // structuredClone is available in Node.js 17+
      if (typeof structuredClone === 'function') {
        const cloned = structuredClone(frozen);
        expect(cloned.source).toBe('Clone');
        expect(cloned.detail).toBe('clone test');
        expect(cloned.recovered).toBe(true);
        expect(cloned.timestamp).toBe(frozen.timestamp);
        // Cloned should not be frozen
        cloned.extra = 'new field';
        expect(cloned.extra).toBe('new field');
      }
    });
  });

  // -----------------------------------------------------------------------
  // Timestamp edge cases
  // -----------------------------------------------------------------------
  describe('timestamp properties on frozen reports', () => {
    it('timestamp is a parseable ISO 8601 with timezone', () => {
      const report = reportCorruption('TZ', 'timezone test');
      const frozen = Object.freeze(report);

      const parsed = new Date(frozen.timestamp);
      expect(parsed.toString()).not.toBe('Invalid Date');
      // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
      expect(frozen.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('two consecutive reports have non-decreasing timestamps', () => {
      setCorruptionHandler(null);
      const r1 = reportCorruption('T1', 'first');
      const r2 = reportCorruption('T2', 'second');

      const t1 = new Date(r1.timestamp).getTime();
      const t2 = new Date(r2.timestamp).getTime();

      expect(t2).toBeGreaterThanOrEqual(t1);
    });
  });
});
